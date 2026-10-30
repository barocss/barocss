"""Independent exact stored-interval cylinder authority. Product imports: zero."""
import json,math,sys
from fractions import Fraction as F

def q(v):return F.from_float(v) if isinstance(v,float) else F(v)
def emit(x):return {'numerator':str(x.numerator),'denominator':str(x.denominator),'value':float(x)}
def normal_bounds(b):
 values=[q(v['point'][2]) for v in b['vertices']];return min(values),max(values)
def tangent_bounds(b):
 points=[p for edge in b['edges'] for p in edge['curve']['controlPoints']]
 return [[min(q(p[k]) for p in points),max(q(p[k]) for p in points)] for k in range(2)]
if __name__=='__main__':
 data=json.load(sys.stdin);original=data['original'];actual=data['actual'];ob=original['brep'];b=actual['brep'];lo,old=normal_bounds(ob);intended=old+q(data['distance']);hi=q(float(intended));gap=hi-lo;assert gap>0
 assert any(all(q(p[2])==old for row in f['surface'].get('controlPoints',[]) for p in row) and f['surface'].get('controlPoints') for f in ob['faces']),'Original selected cap has exact constant normal coefficients'
 actualLo,actualHi=normal_bounds(b);assert (actualLo,actualHi)==(lo,hi),'Actual native endpoints equal original authority plus once-rounded distance'
 if data['distance']==-5.00009:assert lo==q(.3456789) and hi==q(.34567890000000023) and gap==F(1,4503599627370496),'Captured physical residue is the exact four-ulp interval'
 assert len(b['bodies'])==1 and b['bodies'][0]['kind']=='solid';assert len(b['shells'])==1 and b['shells'][0]['closed'];assert actual['check']['valid']
 caps=[]
 for face in b['faces']:
  poles=[p for row in face['surface']['controlPoints'] for p in row];assert all(lo<=q(p[2])<=hi for p in poles),'All normal coefficients lie inside actual interval'
  if all(p[2]==poles[0][2] for p in poles):caps.append({'name':face.get('name'),'level':poles[0][2]})
 assert {q(c['level']) for c in caps}=={lo,hi},'Two exact native cap levels required; no old exposed cap'
 assert all(q(c['level'])!=old for c in caps),'Old cap cannot remain exposed'
 beforeFoot=tangent_bounds(ob);afterFoot=tangent_bounds(b)
 assert all(abs(x-y)<=q(1e-7) for a,c in zip(beforeFoot,afterFoot) for x,y in zip(a,c)),'Native tangent boundary footprint unchanged'
 midpoint=(lo+hi)/2;ulp=q(math.nextafter(float(midpoint),math.inf))-q(float(midpoint));tolerance=8*ulp;volumeGuide=math.pi*9*float(gap);pipelines=[]
 for name,mass in [('kernelMassPropertiesOf',actual['kernelMass']),('publicPart',actual['publicMass']),('actualModelEvaluate',actual['modelMass']),('actualStudioModel',data['studio']['target'])]:
  assert mass['volume']>0 and math.isfinite(mass['volume']),(name,'positive finite volume');z=q(mass['centroid'][2]);assert lo<=z<=hi,(name,'centroid outside exact physical interval',mass['centroid'][2]);assert abs(z-midpoint)<=tolerance,(name,'normal midpoint')
  assert abs(mass['volume']/volumeGuide-1)<1e-10,(name,'rounded circle analytic volume guide')
  assert abs(mass['centroid'][0]-.1234567)<=1e-7 and abs(mass['centroid'][1]+.2345678)<=1e-7,(name,'tangent centroid')
  pipelines.append({'name':name,'volume':mass['volume'],'centroid':mass['centroid'],'normalError':emit(z-midpoint),'withinExactStoredInterval':True})
 assert data['studio']['target']['key']==actual['key'];assert actual['kernelMass']['method']=='closed-form'
 quadrature=actual['nativeQuadrature'];quadratureReport={'observed':quadrature,'scope':'Separate B-rep quadrature provider; not repaired or certified by the two longitudinal formulas'}
 if 'volume' in quadrature:quadratureReport['relativeVolumeDifferenceToRoundedCircleGuide']=quadrature['volume']/volumeGuide-1
 print(json.dumps({'status':'PASS','expected':{'lower':emit(lo),'oldCap':emit(old),'intendedUpperBeforeRounding':emit(intended),'storedUpper':emit(hi),'gap':emit(gap),'normalMidpoint':emit(midpoint),'normalToleranceEightMidpointUlps':emit(tolerance),'circleVolumeRoundedPiGuide':volumeGuide},'pipelines':pipelines,'nativeCaps':caps,'nativeStructure':{'solidCount':sum(v['kind']=='solid' for v in b['bodies']),'shellCount':len(b['shells'])},'tangentFootprint':[[emit(v) for v in r] for r in afterFoot],'nativeQuadrature':quadratureReport,'scope':'Z-upright closed-form mass only; no central inertia, generic transformed provider, exact pi, Float32 interval or global mass claim'},indent=2))
