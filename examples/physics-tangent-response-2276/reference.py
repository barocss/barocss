"""Independent scalar principal-frame no-slip and momentum constraints.

No candidate matrix/basis/LDL or contact points enter this reference.
Static cases are exact Fractions. The single dynamic-ray law case is evaluated
at80/120 Decimal digits; discrepancies must stay<=1e-60 before auditing output.
Public SI gates remain1e-10, tangent plane1e-12. No World/candidate calls.
"""
import json
import struct
import sys
from decimal import Decimal as D, localcontext
from fractions import Fraction as F
from pathlib import Path


def decode(x):
    if isinstance(x, dict):
        if '$f64le' in x:
            return F.from_float(struct.unpack('<d', bytes.fromhex(x['$f64le']))[0])
        return {k: decode(v) for k,v in x.items()}
    if isinstance(x, list):
        return [decode(v) for v in x]
    return F.from_float(x) if isinstance(x, float) else x


def cross(a,b):
    return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]


def dot(a,b):
    return sum((x*y for x,y in zip(a,b)),F(0))


def audit(directory):
    frozen = decode(json.loads((directory/'frozen-inputs.json').read_text()))
    maxima = {k:F(0) for k in ['velocity','omega','impulse','momentum','angularMomentum','slip','geometry','energy','work','tangentPlane','referencePrecision']}
    reports=[]

    def gate(k,residual):
        v=abs(residual);maxima[k]=max(maxima[k],v)
        limit=F('1e-60') if k=='referencePrecision' else F('1e-12') if k=='tangentPlane' else F('1e-10')
        assert v<=limit,(k,float(v),float(limit))

    for graph in ['source','native']:
        for case in frozen['cases']:
            if 'expectedError' in case:
                rejected=decode(json.loads((directory/(graph+'-'+case['id']+'-creation-refusal.json')).read_text()))
                assert rejected['returnedWorld'] is False
                assert rejected['error']['code']==case['expectedError']=='INVALID_CONFIG'
                assert case['muS']>2
                continue
            data=decode(json.loads((directory/(graph+'-'+case['id']+'.json')).read_text()))
            p,initial,after=data['input'],data['before'],data['after']
            models={b['id']:b for b in p['model']['bodies']}
            colliders={c['bodyId']:c for c in p['model']['colliders']}
            b0=next(b for b in initial['bodies'] if b['id']==p['moving'])
            b=next(b for b in after['bodies'] if b['id']==p['moving'])
            floor=colliders[p['fixed']]
            axis=floor['geometry']['halfExtentsM'].index(F(1,2))
            half=colliders[p['moving']]['geometry']['halfExtentsM']
            mass=models[p['moving']]['massKg'];assert mass==1
            assert b0['orientationXYZW']==[0,0,0,1]
            assert all(w==0 for w in b0['angularVelocityRadps'])
            inertia=[mass*(half[(i+1)%3]**2+half[(i+2)%3]**2)/3 for i in range(3)]
            closing=max(F(0),-b0['velocityMps'][axis]);normal=[F(0)]*3;normal[axis]=1
            arm=[F(0)]*3;arm[axis]=-half[axis]
            impulse=[F(0)]*3;impulse[axis]=mass*closing
            friction=colliders[p['moving']]['material']['friction']
            assert friction==floor['material']['friction']
            for i in range(3):
                if i==axis:continue
                # I*w=(r cross J), v'=v+J/m and v'+w cross r=0.
                spin_axis=3-i-axis
                impulse[i]=-b0['velocityMps'][i]/(1/mass+half[axis]**2/inertia[spin_axis])
            tangent=[v if i!=axis else F(0) for i,v in enumerate(impulse)]
            if closing==0 or friction['static']==0:
                for i in range(3):
                    if i!=axis:impulse[i]=F(0)
            elif dot(tangent,tangent)>(friction['static']*mass*closing)**2:
                values=[]
                for precision in [80,120]:
                    with localcontext() as ctx:
                        ctx.prec=precision
                        conv=lambda x:D(x.numerator)/D(x.denominator)
                        speed=conv(sum((v*v for i,v in enumerate(b0['velocityMps']) if i!=axis),F(0))).sqrt()
                        values.append([F(-conv(friction['dynamic']*mass*closing*b0['velocityMps'][i])/speed) if i!=axis else mass*closing for i in range(3)])
                for a,z in zip(*values):gate('referencePrecision',a-z)
                impulse=values[1]
            expected_v=[u+j/mass for u,j in zip(b0['velocityMps'],impulse)]
            expected_w=[j/I for j,I in zip(cross(arm,impulse),inertia)]
            actual=[F(0)]*3
            for c in after['contacts']:
                sign=1 if c['bodyBId']==p['moving'] else -1
                gate('tangentPlane',dot(c['normalAtoB'],c['tangentImpulseOnBNs']))
                for i in range(3):actual[i]+=sign*(c['normalAtoB'][i]*c['normalImpulseNs']+c['tangentImpulseOnBNs'][i])
            torque=cross(arm,actual)
            for i in range(3):
                gate('impulse',actual[i]-impulse[i]);gate('velocity',b['velocityMps'][i]-expected_v[i]);gate('omega',b['angularVelocityRadps'][i]-expected_w[i])
                gate('momentum',mass*(b['velocityMps'][i]-b0['velocityMps'][i])-actual[i])
                gate('angularMomentum',inertia[i]*b['angularVelocityRadps'][i]-torque[i])
                gate('geometry',b['positionM'][i]-(half[axis] if i==axis else 0))
                if case['branch']=='stick':gate('slip',b['velocityMps'][i]+cross(b['angularVelocityRadps'],arm)[i])
            kinetic=lambda v,w:mass*dot(v,v)/2+sum((I*x*x/2 for I,x in zip(inertia,w)),F(0))
            E=kinetic(b['velocityMps'],b['angularVelocityRadps']);E0=kinetic(b0['velocityMps'],b0['angularVelocityRadps'])
            gate('energy',E-kinetic(expected_v,expected_w));gate('energy',max(F(0),E-E0))
            work=dot(actual,[(v+u)/2 for v,u in zip(b['velocityMps'],b0['velocityMps'])])+dot(torque,[w/2 for w in b['angularVelocityRadps']])
            gate('work',E-E0-work)
            reports.append({'graph':graph,'id':case['id'],'expectedImpulseNs':[str(x) for x in impulse],'expectedVelocityMps':[str(x) for x in expected_v],'expectedOmegaRadps':[str(x) for x in expected_w]})
    return {'status':'PASS_INDEPENDENT_TANGENT_CONSTRAINTS','audits':len(reports),'maxima':{k:float(v) for k,v in maxima.items()},'cases':reports,'WorldCalls':0,'candidateCalls':0}


if __name__=='__main__':
    directory=Path(sys.argv[1])
    try:report=audit(directory)
    except Exception as error:report={'status':'FAIL_INDEPENDENT_TANGENT_CONSTRAINTS','firstFailure':repr(error)}
    with (directory/'independent-reference.json').open('x') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps({k:v for k,v in report.items() if k!='cases'}))
    sys.exit(0 if report['status'].startswith('PASS_') else 1)
