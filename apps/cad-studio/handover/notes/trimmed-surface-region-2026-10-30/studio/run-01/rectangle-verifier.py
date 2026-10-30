"""Independent exact rectangle slab oracle and stored-output Green verifier.
No CAD, clipping, arrangement, or production rational imports.
"""
import json,sys
from fractions import Fraction as F

def q(v):return F.from_float(v) if isinstance(v,float) else F(v)
def encoded(x):return {'numerator':str(x.numerator),'denominator':str(x.denominator),'value':float(x)}
def rectangle_components(poly,domain,crop,keep):
 # Sweep v. Perpendicular u boundary switch levels make clamped endpoints fixed per slab.
 pts=[(p[1],p[0]) for p in poly];td=crop['v'];od=crop['u'];levels=set([*td,*(p[0] for p in pts)])
 for a,b in zip(pts,pts[1:]+pts[:1]):
  if a[0]==b[0] or a[1]==b[1]:continue
  for boundary in od:
   t=a[0]+(boundary-a[1])*(b[0]-a[0])/(b[1]-a[1])
   if min(a[0],b[0])<=t<=max(a[0],b[0]):levels.add(t)
 levels=sorted(t for t in levels if td[0]<=t<=td[1]);nodes=[];parents=[];previous=[]
 def root(i):
  while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
  return i
 def value(line,t):return line[0]*t+line[1]
 def integral(a,b,cs):return sum(c*(b**(i+1)-a**(i+1))/F(i+1) for i,c in enumerate(cs))
 for lo,hi in zip(levels,levels[1:]):
  if lo==hi:continue
  mid=(lo+hi)/2;cross=[]
  for a,b in zip(pts,pts[1:]+pts[:1]):
   if min(a[0],b[0])<mid<max(a[0],b[0]):
    m=(b[1]-a[1])/(b[0]-a[0]);cross.append((m,a[1]-m*a[0]))
  cross.sort(key=lambda line:value(line,mid));assert len(cross)%2==0
  ins=list(zip(cross[::2],cross[1::2]))
  if keep=='inside':intervals=ins
  else:
   intervals=[];left=(F(0),domain['u'][0])
   for a,b in ins:intervals.append((left,a));left=b
   intervals.append((left,(F(0),domain['u'][1])))
  current=[]
  for left,right in intervals:
   left=max([left,(F(0),od[0])],key=lambda line:value(line,mid));right=min([right,(F(0),od[1])],key=lambda line:value(line,mid))
   if value(right,mid)<=value(left,mid):continue
   da,db=right[0]-left[0],right[1]-left[1]
   area=integral(lo,hi,[db,da]);mv=integral(lo,hi,[F(0),db,da])
   mu=integral(lo,hi,[(right[1]**2-left[1]**2)/2,right[0]*right[1]-left[0]*left[1],(right[0]**2-left[0]**2)/2])
   i=len(nodes);nodes.append((area,mu,mv));parents.append(i)
   for j,ol,orr,oh in previous:
    if oh==lo and min(value(right,lo),value(orr,lo))-max(value(left,lo),value(ol,lo))>0:parents[root(i)]=root(j)
   current.append((i,left,right,hi))
  previous=current
 sums={}
 for i,node in enumerate(nodes):
  r=root(i);sums[r]=tuple(x+y for x,y in zip(sums.get(r,(F(0),F(0),F(0))),node))
 return [{'area':25*a,'centroid':[20+5*mu/a,-11+5*mv/a,F(3)]} for a,mu,mv in sums.values()],len(levels)
def ring_moments(uv):
 p=[tuple(map(q,v)) for v in uv];a=mx=my=F(0)
 for (x,y),(xx,yy) in zip(p,p[1:]+p[:1]):
  cross=x*yy-xx*y;a+=cross;mx+=(x+xx)*cross;my+=(y+yy)*cross
 assert a!=0,'No zero-area output ring'
 return abs(a)/2,mx/(3*a),my/(3*a)
def inside(uv,point):
 x,y=map(q,point);p=[tuple(map(q,v)) for v in uv];hit=False
 for (a,b),(c,d) in zip(p,p[1:]+p[:1]):
  if (b>y)!=(d>y) and x<a+(y-b)*(c-a)/(d-b):hit=not hit
 return hit
def kept(loops,point):return all(inside(loop['uv'],point)==(loop['keep']=='inside') for loop in loops)
if __name__=='__main__':
 data=json.load(sys.stdin);poly=[tuple(map(q,p)) for p in data['uv']];domain={k:list(map(q,v)) for k,v in data['domain'].items()};crop={k:list(map(q,v)) for k,v in data['crop'].items()}
 expected,slabLevels=rectangle_components(poly,domain,crop,data['keep']);actual=[];tol=q(1e-7)
 for child in data['children']:
  loops=child['trims'];assert loops and loops[0]['keep']=='inside';assert all(l['keep']=='outside' for l in loops[1:])
  area=mu=mv=F(0)
  for i,loop in enumerate(loops):
   a,u,v=ring_moments(loop['uv']);sign=1 if i==0 else -1;area+=sign*a;mu+=sign*a*u;mv+=sign*a*v
  assert area>0,'Every emitted component has positive material'
  actual.append({'id':child['id'],'area':25*area,'centroid':[20+5*mu/area,-11+5*mv/area,F(3)]})
 assert len(expected)==len(actual),('component count',len(expected),len(actual))
 for a,b in zip(sorted(actual,key=lambda x:tuple(x['centroid'])),sorted(expected,key=lambda x:tuple(x['centroid']))):
  assert abs(a['area']-b['area'])<=tol,('area',float(a['area']),float(b['area']))
  assert all(abs(x-y)<=tol for x,y in zip(a['centroid'],b['centroid'])),('centroid',a['id'])
 probes=[]
 for x,y in [[18,11.25],[32,11.25],[25,6.25],[25,11.25],[25,3],[13,-3],[44,19],[23,9]]:
  uv=[(q(x)-20)/5,(q(y)+11)/5];inCrop=all(crop[k][0]<uv[i]<crop[k][1] for i,k in enumerate(['u','v']));expect=inCrop and (inside(data['uv'],uv)==(data['keep']=='inside'))
  owners=[c['id'] for c in data['children'] if kept(c['trims'],uv)]
  assert len(owners)<=1,('Overlapping components',x,y,owners)
  assert bool(owners)==expect,('Lost material or bridge/crop leakage',x,y,owners,expect)
  probes.append({'world':[x,y,3],'inCrop':inCrop,'expectedMaterial':expect,'owners':owners})
 def item(a):return {**({'id':a['id']} if 'id' in a else {}),'areaWorld':encoded(a['area']),'centroidWorld':[encoded(x) for x in a['centroid']]}
 print(json.dumps({'status':'PASS','expectedExactRectangleComponents':[item(a) for a in expected],'actualStoredComponents':[item(a) for a in actual],'slabLevelsIncludingPerpendicularBoundarySwitches':slabLevels,'probes':probes,'tolerance':1e-7,'scope':'Independent exact Fraction rectangle sweep and stored Green moments/ray parity; no CAD or production predicates'},indent=2))
