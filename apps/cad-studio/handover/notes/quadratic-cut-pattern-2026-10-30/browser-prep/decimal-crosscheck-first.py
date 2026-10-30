"""Independent Decimal80 analytic quadratic cross-check. No product imports; not an interval certificate."""
import json, sys, hashlib
from decimal import Decimal as D, localcontext
from pathlib import Path

def scalar(x): return D.from_float(x) if isinstance(x, float) else D(x)
def solve(points, distances):
    with localcontext() as context:
        context.prec = 80
        p = [[scalar(x) for x in point] for point in points]
        v = [2 * (p[1][a] - p[0][a]) for a in range(2)]
        d = [2 * (p[2][a] - 2 * p[1][a] + p[0][a]) for a in range(2)]
        A, B, C = sum(x*x for x in d), 2 * sum(x*y for x,y in zip(v,d)), sum(x*x for x in v)
        K = 4*A*C-B*B
        assert A > 0 and K > 0
        def primitive(t):
            speed=(A*t*t+B*t+C).sqrt();z=2*A*t+B;argument=2*A.sqrt()*speed+z
            assert argument > 0
            return z*speed/(4*A)+K*argument.ln()/(8*A*A.sqrt())
        base=primitive(D(0))
        def length(t):return primitive(t)-base
        length_total=length(D(1)); results=[]
        for distance in distances:
            target=scalar(distance);assert 0 < target < length_total
            low,high=D(0),D(1)
            for _ in range(320):
                mid=(low+high)/2
                if mid==low or mid==high:break
                if length(mid)<target:low=mid
                else:high=mid
            t=(low+high)/2
            offset=[v[a]*t+d[a]*t*t/2 for a in range(2)]
            results.append({'distance':distance,'parameter':str(t),'offset':[str(x) for x in offset],'analyticArcResidual':str(abs(length(t)-target))})
        return {'points':points,'length':str(length_total),'coefficients':{'A':str(A),'B':str(B),'C':str(C),'K':str(K)},'positions':results}

root=Path('/tmp/d346-browser-prep');reference_bytes=(root/'certified-reference-input.json').read_bytes();reference=json.loads(reference_bytes)
assert reference['status']=='PASS' and reference['productImports']==0
out={'status':'PASS','productImports':0,'python':sys.version,'precision':80,'quality':'Analytic high-precision cross-check, not a Decimal interval certificate','reference':{'original':'/tmp/d346-plan/oracle-final.json','sha256':hashlib.sha256(reference_bytes).hexdigest(),'authority':'High fixed-point sqrt intervals and rigorous Simpson remainder'},'cases':[]}
with localcontext() as context:
    context.prec=80
    for case in reference['cases']:
        result=solve(case['points'],[8,10,12,16,20,24]);result['name']=case['name'];length=scalar(result['length']);lo,hi=map(scalar,case['totalLength']);assert lo<=length<=hi
        result['insideCertifiedLengthBounds']=True;result['certifiedLengthBounds']=case['totalLength'];result['certifiedPointCrosschecks']=[]
        for certified in case['offsets']:
            numerical=next(x for x in result['positions'] if x['distance']==certified['distance'])
            center=[D(x['n'])/D(x['d']) for x in certified['exactOffset']];delta=[scalar(x)-y for x,y in zip(numerical['offset'],center)];error=sum(x*x for x in delta).sqrt();radius=scalar(certified['worldEuclideanResidualUpper'])
            assert error<=radius
            result['certifiedPointCrosschecks'].append({'distance':certified['distance'],'distanceFromExactCertifiedCenter':str(error),'certifiedRadius':str(radius),'insideCertifiedBall':True})
        out['cases'].append(result)
    translated=solve([[3,4],[23,9],[23,24]],[8,10,12,16,20,24]);live=out['cases'][2]
    assert translated['coefficients']==live['coefficients'] and translated['length']==live['length'] and translated['positions']==live['positions']
    out['translatedLiveControl']={'sameRelativePositions':True,'calculation':translated,'scope':'Exact represented integer translation leaves polynomial derivative coefficients and relative positions unchanged'}
    out['spacing12Control']={'distances':[12,24],'status':'DECIMAL80_CROSSCHECK_ONLY','certifiedBallAtTheseDistances':'NOT_PROVIDED_BY_THIS_REFERENCE','note':'Do not call these Decimal positions certified without the final High/root production and reference contract'}
(root/'decimal-crosscheck.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
