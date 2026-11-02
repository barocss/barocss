"""Independent exact closest-approach/chord reference. No candidate quadratic.

Classification uses Fraction only. Entry/normal use fixed80/120digits with
measuredagreement<=1e-60. TOI/distance/normal/norm² gates remain1e-12.
"""
import json
import struct
import sys
from pathlib import Path
from fractions import Fraction as F
from decimal import Decimal as D, localcontext


def decode(x):
    if isinstance(x,dict):
        if '$f64le' in x:return F.from_float(struct.unpack('<d',bytes.fromhex(x['$f64le']))[0])
        return {k:decode(v) for k,v in x.items()}
    if isinstance(x,list):return [decode(v) for v in x]
    return x


def dot(a,b):return sum((x*y for x,y in zip(a,b)),F(0))
def decimal(x):return D(x.numerator)/D(x.denominator)


def reference(encoded):
    g=decode(encoded);marker=int(g['marker']);other=1-marker
    p=[a-b for a,b in zip(g['starts'][marker],g['starts'][other])]
    d=[(g['ends'][marker][i]-g['starts'][marker][i])-(g['ends'][other][i]-g['starts'][other][i]) for i in range(3)]
    R=sum(g['radii'],F(0));distance2=dot(p,p);a=dot(d,d)
    result={'class':'MISS','radiusExact':str(R)}
    if distance2<=R*R:result['class']='OWNED';return result
    if a==0:return result
    center=-dot(p,d)/a;closest2=distance2-dot(p,d)**2/a
    result.update(closestTimeExact=str(center),closestDistanceSquaredExact=str(closest2))
    if center<=0 or closest2>R*R:return result
    chord_time2=(R*R-closest2)/a
    if center>1 and chord_time2<(center-1)**2:return result
    result['class']='HIT';max_agreement=D(0);previous=None
    for precision in [80,120]:
        with localcontext() as ctx:
            ctx.prec=precision
            t=decimal(center)-decimal(chord_time2).sqrt()
            n=[(decimal(p[i])+decimal(d[i])*t)/decimal(R) for i in range(3)]
            if previous:
                max_agreement=max(max_agreement,abs(t-D(previous['t'])),*[abs(x-D(y)) for x,y in zip(n,previous['normal'])])
            previous={'t':str(t),'normal':[str(x) for x in n]};result[str(precision)]=previous
    assert max_agreement<=D('1e-60'),max_agreement
    result['precisionAgreement']=str(max_agreement)
    return result


def bank(source,output):
    cases=json.loads(source.read_text())['cases'];results=[]
    for c in cases:
        ref=reference(c['geometry']);assert ref['class']==c['expectedClass'],(c['id'],ref,c['expectedClass'])
        results.append({**c,'reference':ref})
    data={'status':'PASS_INDEPENDENT_BANK','cases':results,'WorldCalls':0,'candidateCalls':0}
    with output.open('x') as f:json.dump(data,f,indent=2);f.write('\n')
    return {'status':data['status'],'cases':len(cases),'classes':{key:sum(c['reference']['class']==key for c in results) for key in ['HIT','MISS','OWNED']}}


def audit(directory,bank_path):
    cases=json.loads(bank_path.read_text())['cases'];maxima={k:D(0) for k in ['toi','normal','normSquared','distance']};audits=0
    def gate(k,value):
        value=abs(value);maxima[k]=max(maxima[k],value);assert value<=D('1e-12'),(k,str(value))
    for graph in ['source','native']:
        for c in cases:
            for kind in ['helper','public']:
                name=graph+'-'+c['id']+('-helper' if kind=='helper' else '')+'.json';packet=decode(json.loads((directory/name).read_text()));p=packet['input'];g=decode(c['geometry'])
                assert p['starts']==g['starts'] and p['ends']==g['ends'] and p['radii']==g['radii']
                marker=int(g['marker']);assert p['markedId']==p['ids'][marker]
                hit=packet['helper'] if kind=='helper' else (packet['after']['ccdHits'][0] if packet['after']['ccdHits'] else None)
                if c['reference']['class']!='HIT':assert hit is None
                else:
                    assert hit is not None
                    t=hit['fraction'] if kind=='helper' else hit['toiFraction'];n=hit['normal'] if kind=='helper' else hit['normalFixtureToBody'];assert 0<=t<=1
                    ref=c['reference']['120'];other=1-marker
                    r=sum(g['radii'],F(0));rel=[g['starts'][marker][i]-g['starts'][other][i]+((g['ends'][marker][i]-g['starts'][marker][i])-(g['ends'][other][i]-g['starts'][other][i]))*t for i in range(3)]
                    with localcontext() as ctx:
                        ctx.prec=120
                        gate('toi',decimal(t)-D(ref['t']))
                        gate('normSquared',decimal(dot(n,n)-1))
                        for value,expected in zip(n,ref['normal']):gate('normal',decimal(value)-D(expected))
                        gate('distance',decimal(dot(rel,rel)).sqrt()-decimal(r))
                    # Independent exact necessary contact witness, no producer points/bias.
                    assert (r-F('1e-12'))**2<=dot(rel,rel)<=(r+F('1e-12'))**2
                audits+=1
    return {'status':'PASS_INDEPENDENT_SPHERE_PAIR_CCD','audits':audits,'maxima':{k:str(v) for k,v in maxima.items()},'WorldCalls':0,'candidateCalls':0}


if __name__=='__main__':
    if sys.argv[1]=='--bank':
        print(json.dumps(bank(Path(sys.argv[2]),Path(sys.argv[3]))))
    else:
        directory=Path(sys.argv[1])
        try:result=audit(directory,Path(sys.argv[2]))
        except Exception as e:result={'status':'FAIL_INDEPENDENT_SPHERE_PAIR_CCD','firstFailure':repr(e)}
        with (directory/'independent-reference.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
        print(json.dumps(result));sys.exit(0 if result['status'].startswith('PASS_') else 1)
