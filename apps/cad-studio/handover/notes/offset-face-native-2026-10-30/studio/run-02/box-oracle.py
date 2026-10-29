"""Independent Fraction native-endpoint box oracle. No production imports."""
import json,sys
from fractions import Fraction as F

def q(v):return F.from_float(v) if isinstance(v,float) else F(v)
def encoded(x):return {'numerator':str(x.numerator),'denominator':str(x.denominator),'value':float(x)}
def bounds(b):
 p=[list(map(q,v['point'])) for v in b['vertices']]
 return [min(v[k] for v in p) for k in range(3)],[max(v[k] for v in p) for k in range(3)]
def face_points(b,face):
 vs={v['id']:list(map(q,v['point'])) for v in b['vertices']};es={e['id']:e for e in b['edges']};cs={c['id']:c for c in b['coedges']};ls={l['id']:l for l in b['loops']};ids=set()
 for lid in face['loops']:
  for cid in ls[lid]['coedges']:ids.update(es[cs[cid]['edge']]['vertices'])
 return [vs[i] for i in sorted(ids)]
def nonzero_area(points):
 if len(points)<3:return False
 a=points[0]
 for i in range(1,len(points)):
  u=[x-y for x,y in zip(points[i],a)]
  for j in range(i+1,len(points)):
   v=[x-y for x,y in zip(points[j],a)]
   if any([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]):return True
 return False
if __name__=='__main__':
 data=json.load(sys.stdin);original=data['original']['brep'];actual=data['actual']['brep'];lo,hi=bounds(original);old=hi[2];hi[2]+=q(data['distance']);widths=[b-a for a,b in zip(lo,hi)]
 assert all(v>0 for v in widths)
 volume=widths[0]*widths[1]*widths[2];centroid=[(a+b)/2 for a,b in zip(lo,hi)];area=2*(widths[0]*widths[1]+widths[0]*widths[2]+widths[1]*widths[2]);linear=q(1e-7);mass_tol=q(1e-7)
 nativeSolids=[b for b in actual['bodies'] if b['kind']=='solid'];assert len(actual['bodies'])==len(nativeSolids)==1,'One Model body must contain exactly one native solid'
 assert len(actual['shells'])==1 and actual['shells'][0]['closed'],'One closed native shell required'
 actualLo,actualHi=bounds(actual)
 assert all(abs(a-b)<=linear for a,b in zip(actualLo,lo)) and all(abs(a-b)<=linear for a,b in zip(actualHi,hi)),'Native result bounds must preserve original tangent endpoints and intended cap'
 pipelines=[]
 for name,mass in [('nativeCore',data['actual']['mass']),('publicPart',data['actual']['publicMass']),('actualStudioModel',data['studio']['target'])]:
  assert abs(q(mass['volume'])-volume)<=mass_tol,(name,'volume',mass['volume'],float(volume))
  assert len(mass['centroid'])==3 and all(abs(q(a)-b)<=linear for a,b in zip(mass['centroid'],centroid)),(name,'centroid')
  pipelines.append({'name':name,'actualVolume':mass['volume'],'actualCentroid':mass['centroid'],'sameOriginalNativeEndpointOracle':True,'volumeError':encoded(q(mass['volume'])-volume),'centroidErrors':[encoded(q(a)-b) for a,b in zip(mass['centroid'],centroid)]})
 assert data['studio']['target']['key']==data['actual']['key'],'Studio mass target is mapped by the actual native body key'
 assert abs(q(data['actual']['area'])-area)<=q(1e-6),'Native boundary surface area'
 supports=[(k,value) for k in range(3) for value in [lo[k],hi[k]]];faces=[];seen=set()
 for face in actual['faces']:
  points=face_points(actual,face);assert nonzero_area(points),'No zero-area native boundary face'
  signature=tuple(sorted(tuple(p) for p in points));assert signature not in seen,'No duplicate native boundary face';seen.add(signature)
  boundaryResiduals=[max(abs(p[k]-value) for p in points) for k,value in supports];boundaryBest=min(boundaryResiduals)
  assert boundaryBest<=linear,('Native face boundary is on no intended support',face.get('name'),float(boundaryBest))
  s=face['surface'];assert 'controlPoints' in s,'Box has native surface support'
  poles=[list(map(q,p)) for row in s['controlPoints'] for p in row];surfaceResiduals=[max(abs(p[k]-value) for p in poles) for k,value in supports];surfaceBest=min(surfaceResiduals)
  assert surfaceBest<=linear,('Native face support plane is wrong',face.get('name'),float(surfaceBest))
  oldLedge=all(abs(p[2]-old)<=linear for p in points);assert not oldLedge,('Old selected cap remains exposed',face.get('name'))
  faces.append({'id':face['id'],'name':face.get('name'),'boundarySupportResidual':encoded(boundaryBest),'surfaceSupportResidual':encoded(surfaceBest),'oldCapExposed':oldLedge})
 print(json.dumps({'status':'PASS','expected':{'min':list(map(encoded,lo)),'max':list(map(encoded,hi)),'volume':encoded(volume),'centroid':list(map(encoded,centroid)),'surfaceArea':encoded(area),'oldCap':encoded(old)},'nativeStructure':{'bodies':len(actual['bodies']),'solidCount':len(nativeSolids),'shellCount':len(actual['shells']),'closedShellCount':sum(s['closed'] for s in actual['shells']),'vertices':len(actual['vertices']),'edges':len(actual['edges']),'faces':len(actual['faces'])},'massPipelines':pipelines,'studioTargetIdentity':{'key':data['studio']['target']['key'],'ref':data['actual'].get('ref')},'faceSupports':faces,'linearTolerance':1e-7,'massTolerance':1e-7,'scope':'Actual stored native original endpoints + represented distance, Fraction arithmetic; native support planes/boundary vertices plus native Core, public Part and accepted Studio Model mass; not display mesh or rounded UI text'},indent=2))
