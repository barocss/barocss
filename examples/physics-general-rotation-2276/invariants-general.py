#!/usr/bin/env python3
"""Independent Fraction geometry, invariants, and analytic rotation checks.

CLI: --input FILE --output FILE. Input is a raw-f64 JSON object containing
packets:[{config,pair,before,after}] and optional long:{pair,before,after,samples}.
No package, candidate, private-inertia, floating-point, or third-party imports.
"""
import argparse
import json
import math
import signal
import sys
from fractions import Fraction as F
from pathlib import Path

EPS = F(1,10**12)
TRAJECTORY = F(1,10**11)


def need(value, message):
    if not value: raise ValueError(message)


def unique(items):
    result = {}
    for key,value in items:
        need(key not in result,'duplicate JSON key')
        result[key] = value
    return result


def decode(value):
    if isinstance(value,dict):
        if set(value) == {'$f64le'}:
            word = value['$f64le']
            need(isinstance(word,str) and len(word) == 16,'f64 word')
            bits = int.from_bytes(bytes.fromhex(word),'little')
            sign,exponent,mantissa = -1 if bits >> 63 else 1,(bits >> 52)&2047,bits&((1<<52)-1)
            need(exponent != 2047,'finite IEEE operand')
            if exponent: mantissa += 1<<52
            shift = exponent-1075 if exponent else -1074
            return F(sign*mantissa*(1<<max(shift,0)),1<<max(-shift,0))
        return {key:decode(item) for key,item in value.items()}
    if isinstance(value,list): return [decode(item) for item in value]
    need(value is None or isinstance(value,(str,bool)),'all input numbers must be raw IEEE words')
    return value


def packed(value):
    if isinstance(value,F):
        # Large exact analytic rationals can exceed Python's decimal-string
        # limit. Power-of-two conversion has no such limit. Keep the exact
        # decision and value; do not change the interpreter's security limit.
        if max(value.numerator.bit_length(),value.denominator.bit_length()) > 4096:
            return {'numeratorHex':hex(value.numerator),'denominatorHex':hex(value.denominator)}
        return {'numerator':str(value.numerator),'denominator':str(value.denominator)}
    if isinstance(value,dict): return {key:packed(item) for key,item in value.items()}
    if isinstance(value,(tuple,list)): return [packed(item) for item in value]
    return value


def dot(a,b): return sum((x*y for x,y in zip(a,b)),F(0))
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def mv(r,v): return [dot(row,v) for row in r]
def transpose(r): return [list(row) for row in zip(*r)]


def rotation(q):
    x,y,z,w = q
    n = dot(q,q)
    need(n > 0,'nonzero homogeneous quaternion')
    return [[1-2*(y*y+z*z)/n,2*(x*y-z*w)/n,2*(x*z+y*w)/n],
            [2*(x*y+z*w)/n,1-2*(x*x+z*z)/n,2*(y*z-x*w)/n],
            [2*(x*z-y*w)/n,2*(y*z+x*w)/n,1-2*(x*x+y*y)/n]],n


def inertia(pair):
    model = pair['model']
    need(len(model['bodies']) == len(model['colliders']) == 1,'one native primitive')
    body,collider = model['bodies'][0],model['colliders'][0]
    need(body['inertia'] == {'kind':'primitive-com','about':'com','frame':'body-local'},'native COM inertia')
    need(collider['bodyId'] == body['id'],'collider body')
    need(collider['local'] == {'positionM':[0,0,0],'orientationXYZW':[0,0,0,1]},'centered primitive')
    mass,shape = body['massKg'],collider['geometry']
    need(mass > 0,'positive mass')
    kind = shape['kind']
    if kind == 'box':
        h = shape['halfExtentsM']
        need(len(h) == 3 and all(x > 0 for x in h),'positive box dimensions')
        # Integral[-h,h] x^2 dx / Integral[-h,h] dx = h^2/3.
        return [mass*sum(h[j]**2 for j in range(3) if j != i)/3 for i in range(3)]
    radius = shape['radiusM']
    need(radius > 0,'positive radius')
    if kind == 'sphere':
        # Ball volume integral of x^2+y^2 divided by ball volume.
        return [F(2,5)*mass*radius**2]*3
    need(kind == 'capsule','box/sphere/capsule uniform-volume geometry')
    half = shape['halfLengthM']
    need(half >= 0,'nonnegative capsule half length')
    # Cylinder plus two hemispheres. Pi cancels from all mass fractions.
    cylinder = mass*3*half/(3*half+2*radius)
    caps = mass*2*radius/(3*half+2*radius)
    axial = cylinder*radius**2/2+caps*F(2,5)*radius**2
    # Hemisphere first moment about its cut plane is 3*r/8. Shifting the
    # two caps by +/-half adds half^2 + 2*half*(3*r/8).
    transverse = cylinder*(radius**2/4+half**2/3)+caps*(F(2,5)*radius**2+half**2+F(3,4)*half*radius)
    return [transverse,axial,transverse]


def physical(body,moments):
    r,n = rotation(body['orientationXYZW'])
    local_omega = mv(transpose(r),body['angularVelocityRadps'])
    local_l = [moments[i]*local_omega[i] for i in range(3)]
    return {'R':r,'norm':n,'L':mv(r,local_l),'localL':local_l,'E':dot(local_omega,local_l)/2}


def multiply(a,b):
    x,y,z,w = a; u,v,s,t = b
    return [w*u+x*t+y*s-z*v,w*v-x*s+y*t+z*u,w*s+x*v-y*u+z*t,w*t-x*u-y*v-z*s]


def exponential(rate,time_value):
    """Quaternion exponential with an exact rational tail certificate."""
    z = dot(rate,rate)*time_value**2/4
    need(z <= 4,'finite analytic exponential angle bound')
    cosine,sinc,tc,ts = F(1),F(1),F(1),F(1)
    for k in range(1,33):
        tc *= -z/F((2*k-1)*(2*k))
        ts *= -z/F((2*k)*(2*k+1))
        cosine += tc; sinc += ts
    cosine_error = 2*abs(tc*z/F(65*66))
    sinc_error = 2*abs(ts*z/F(66*67))
    error = max(cosine_error,max([abs(x*time_value/2)*sinc_error for x in rate]+[F(0)]))
    need(error <= F(1,10**50),'analytic exponential remainder1e-50')
    return [x*time_value*sinc/2 for x in rate]+[cosine],error


def isotropic_forced_q(q0,omega0,alpha,time_value):
    """Independent exact Taylor recurrence for q'=0.5*(omega0+alpha*t)*q.

    The absolute coefficient tail is bounded by the Peano-series majorant.
    Terms omitted above degree64 require at least33 linear/quadratic factors.
    """
    coefficients = [q0]
    for degree in range(64):
        a = multiply(omega0+[F(0)],coefficients[degree])
        b = multiply(alpha+[F(0)],coefficients[degree-1]) if degree else [F(0)]*4
        row = [(a[i]+b[i])/F(2*(degree+1)) for i in range(4)]
        need(all(max(x.numerator.bit_length(),x.denominator.bit_length()) <= 65536 for x in row),'analytic rational65536 bits')
        coefficients.append(row)
    result = [F(0)]*4
    for row in reversed(coefficients): result = [result[i]*time_value+row[i] for i in range(4)]
    amplitude = abs(time_value)*(sum(abs(x) for x in omega0)+abs(time_value)*sum(abs(x) for x in alpha))/2
    need(amplitude <= 1,'isotropic affine-rate majorant1')
    error = sum(abs(x) for x in q0)*2*amplitude**33/F(math.factorial(33))
    need(error <= F(1,10**35),'isotropic affine-rate Taylor remainder1e-35')
    return result,error


class Audit:
    def __init__(self):
        self.result = {'status':'PASS_INVARIANTS','physicalStatus':'PASS','firstPhysicalFailure':None,'errors':{},
                       'packets':0,'longSamples':0,'analyticFreePackets':0,'isotropicForcedPackets':0,
                       'analyticTailUpper':F(0),'coverage':[]}

    def check(self,name,actual,expected,location,trajectory=False,norm=False):
        error = abs(actual-expected)
        bound = EPS if norm else TRAJECTORY+EPS*abs(expected) if trajectory else EPS+EPS*max(F(1),abs(actual),abs(expected))
        if name not in self.result['errors'] or error > self.result['errors'][name]['measured']:
            self.result['errors'][name] = {'measured':error,'bound':bound,'location':location}
        if error > bound:
            self.result['physicalStatus'] = 'PHYSICAL_NO_GO'
            if self.result['firstPhysicalFailure'] is None:
                self.result['firstPhysicalFailure'] = {'quantity':name,'observed':actual,'expected':expected,'measured':error,'bound':bound,'location':location}

    def orientation(self,actual,expected,location):
        if dot(actual,expected) < 0: expected = [-x for x in expected]
        for a,b in zip(actual,expected): self.check('analyticQ',a,b,location,trajectory=True)
        ar,_ = rotation(actual); er,_ = rotation(expected)
        for a,b in zip(sum(ar,[]),sum(er,[])): self.check('analyticR',a,b,location,trajectory=True)

    def frame(self,initial,body,moments,impulse,torque,t,location):
        p0,p1 = physical(initial,moments),physical(body,moments)
        self.check('squaredQNorm',p1['norm'],F(1),location,norm=True)
        expected_l = [p0['L'][i]+impulse[i]+torque[i]*t for i in range(3)]
        for i in range(3):
            self.check('worldL',p1['L'][i],expected_l[i],location)
            self.check('comPosition',body['positionM'][i],initial['positionM'][i],location,norm=True)
            self.check('linearVelocity',body['velocityMps'][i],initial['velocityMps'][i],location,norm=True)
        local_j = mv(transpose(p0['R']),impulse)
        plus = [p0['localL'][i]+local_j[i] for i in range(3)]
        eplus = sum((plus[i]**2/moments[i] for i in range(3)),F(0))/2
        return p0,p1,plus,eplus

    def packet(self,packet):
        config,pair,before,after = (packet[key] for key in ('config','pair','before','after'))
        moments = inertia(pair)
        initial,body = before['bodies'][0],after['bodies'][0]
        need(all(initial[key] == value for key,value in pair['model']['bodies'][0]['initial'].items()),'initial state binding')
        t = (after['stepIndex']-before['stepIndex'])*pair['options']['fixedStepSeconds']
        need(t > 0,'positive packet time')
        impulse,torque = config.get('impulse',[F(0)]*3),config.get('torque',[F(0)]*3)
        location = {'case':config['name'],'stepIndex':after['stepIndex']}
        p0,p1,plus,eplus = self.frame(initial,body,moments,impulse,torque,t,location)
        self.check('time',after['timeSeconds']-before['timeSeconds'],t,location,norm=True)
        if not any(torque):
            self.check('energy',p1['E'],eplus,location)
            self.free_analytic(initial,body,moments,p0,plus,t,location)
        elif len(set(moments)) == 1:
            moment = moments[0]
            omega0 = mv(p0['R'],[x/moment for x in plus])
            alpha = [x/moment for x in torque]
            for i in range(3): self.check('isotropicOmega',body['angularVelocityRadps'][i],omega0[i]+alpha[i]*t,location,trajectory=True)
            work = dot(omega0,torque)*t+dot(torque,torque)*t*t/(2*moment)
            self.check('energy',p1['E'],eplus+work,location)
            self.check('continuousWork',p1['E']-eplus,work,location)
            expected,error = isotropic_forced_q(initial['orientationXYZW'],omega0,alpha,t)
            self.orientation(body['orientationXYZW'],expected,location)
            self.result['analyticTailUpper'] = max(self.result['analyticTailUpper'],error)
            self.result['isotropicForcedPackets'] += 1
        else:
            self.result['coverage'].append({'case':config['name'],'worldL':'CHECKED','norm':'CHECKED',
                'energyWork':'NOT_RUN_NO_INDEPENDENT_ANISOTROPIC_FORCED_WORK_ORACLE','trajectory':'NOT_RUN'})
        self.result['packets'] += 1

    def free_analytic(self,initial,body,moments,p0,plus,t,location):
        distinct = sorted(set(moments))
        if len(distinct) == 3:
            self.result['coverage'].append({'case':location['case'],'E_L_norm':'CHECKED','trajectory':'NOT_RUN_TRIAXIAL_ANALYTIC'})
            return
        world_l = mv(p0['R'],plus)
        if len(distinct) == 1:
            expected,error = exponential([x/moments[0] for x in world_l],t)
            expected = multiply(expected,initial['orientationXYZW'])
        else:
            axis = next(i for i in range(3) if moments.count(moments[i]) == 1)
            transverse = next(moments[i] for i in range(3) if i != axis)
            world,error1 = exponential([x/transverse for x in world_l],t)
            body_rate = [F(0)]*3
            body_rate[axis] = (1/moments[axis]-1/transverse)*plus[axis]
            local,error2 = exponential(body_rate,t)
            expected = multiply(multiply(world,initial['orientationXYZW']),local)
            error = 8*(error1+error2)
        self.orientation(body['orientationXYZW'],expected,location)
        er,_ = rotation(expected)
        local_l = mv(transpose(er),world_l)
        omega = mv(er,[local_l[i]/moments[i] for i in range(3)])
        for a,b in zip(body['angularVelocityRadps'],omega): self.check('analyticOmega',a,b,location,trajectory=True)
        self.result['analyticTailUpper'] = max(self.result['analyticTailUpper'],error)
        self.result['analyticFreePackets'] += 1

    def long(self,packet):
        pair,before = packet['pair'],packet['before']
        moments,initial = inertia(pair),before['bodies'][0]
        samples = packet['samples']
        need(len(samples) <= 64,'bounded long sample count')
        seen = set()
        for sample in samples:
            index,state = sample['stepIndex'],sample['state']
            need(index.denominator == 1 and index >= 0 and index not in seen,'unique long sample index')
            seen.add(index)
            need(state['stepIndex'] == index,'sample public index')
            t = (index-before['stepIndex'])*pair['options']['fixedStepSeconds']
            location = {'case':'long-free','stepIndex':index}
            _,p1,_,eplus = self.frame(initial,state['bodies'][0],moments,[F(0)]*3,[F(0)]*3,t,location)
            self.check('energy',p1['E'],eplus,location)
            self.check('time',state['timeSeconds']-before['timeSeconds'],t,location,norm=True)
            self.result['longSamples'] += 1
        need(packet['after']['stepIndex'] in seen,'final long sample retained')
        self.result['coverage'].append({'case':'long-free','E_L_norm':'CHECKED_AT_RETAINED_SAMPLES','trajectory':'NOT_RUN'})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    args = parser.parse_args()
    def deadline(*_): raise TimeoutError('invariants170s deadline')
    signal.signal(signal.SIGALRM,deadline); signal.setitimer(signal.ITIMER_REAL,170)
    audit = Audit()
    try:
        need(args.input.stat().st_size <= 4*1048576,'input4MiB bound')
        raw = json.loads(args.input.read_bytes(),object_pairs_hook=unique,
                         parse_float=lambda _: (_ for _ in ()).throw(ValueError('bare float')),
                         parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite JSON')))
        need(set(raw) <= {'packets','long'} and 'packets' in raw and len(raw['packets']) <= 64,'bounded packet envelope')
        for packet in raw['packets']: audit.packet(decode(packet))
        if 'long' in raw: audit.long(decode(raw['long']))
        result = audit.result
        code = 0
    except BaseException as error:
        result = {'status':'FAIL_INVARIANT_OPERATION','physicalStatus':audit.result['physicalStatus'],
                  'firstFailure':{'type':type(error).__name__,'message':str(error)[:2048]},'audit':audit.result}
        code = 1
    finally:
        signal.setitimer(signal.ITIMER_REAL,0)
    with args.output.open('x') as stream: json.dump(packed(result),stream,separators=(',',':')); stream.write('\n')
    print(json.dumps({'status':result['status'],'physicalStatus':result['physicalStatus']}))
    return code


if __name__ == '__main__': sys.exit(main())
