"""Independent exact stored-polygon verifier; no CAD or arrangement imports."""
import importlib.util,json,sys
from fractions import Fraction as F
spec=importlib.util.spec_from_file_location('independent_sweep',sys.argv[1]);sweep=importlib.util.module_from_spec(spec);spec.loader.exec_module(sweep)
data=json.load(sys.stdin)
def q(v):return F.from_float(v) if isinstance(v,float) else F(v)
def ring_moments(uv):
 p=[(q(u),q(v)) for u,v in uv];a=mx=my=F(0)
 for (x,y),(xx,yy) in zip(p,p[1:]+p[:1]):
  c=x*yy-xx*y;a+=c;mx+=(x+xx)*c;my+=(y+yy)*c
 assert a!=0,'No zero area output ring'
 return abs(a)/2,mx/(3*a),my/(3*a)
def inside(uv,point):
 x,y=map(q,point);p=[tuple(map(q,v)) for v in uv];hit=False
 for (a,b),(c,d) in zip(p,p[1:]+p[:1]):
  if (b>y)!=(d>y) and x<a+(y-b)*(c-a)/(d-b):hit=not hit
 return hit
def kept(loops,point):return all(inside(loop['uv'],point)==(loop['keep']=='inside') for loop in loops)
def rat(v):return F(int(v['numerator']),int(v['denominator']))
original=[list(map(q,p)) for p in data['uv']];domain={k:list(map(q,v)) for k,v in data['domain'].items()}
expected=sweep.integrate(original,domain,data['axis'],q(data['parameter']),data['keep'])
actual={'lower':[],'upper':[]};tol=q(1e-7)
for child in data['children']:
 loops=child['trims'];assert loops and loops[0]['keep']=='inside';assert all(l['keep']=='outside' for l in loops[1:])
 area=mu=mv=F(0)
 for i,loop in enumerate(loops):
  a,u,v=ring_moments(loop['uv']);sign=1 if i==0 else -1;area+=sign*a;mu+=sign*a*u;mv+=sign*a*v
 assert area>0,'Every emitted component has positive material'
 actual[child['side']].append({'id':child['id'],'area':25*area,'centroid':[20+5*mu/area,-11+5*mv/area,F(3)]})
for side in ['lower','upper']:
 got=sorted(actual[side],key=lambda x:tuple(x['centroid']));want=sorted(expected[side],key=lambda x:tuple(map(rat,x['centroidWorld'])))
 assert len(got)==len(want),(side,'component count',len(got),len(want))
 for a,b in zip(got,want):
  assert abs(a['area']-rat(b['areaWorld']))<=tol,(side,'area',float(a['area']),float(rat(b['areaWorld'])))
  assert all(abs(x-rat(y))<=tol for x,y in zip(a['centroid'],b['centroidWorld'])),(side,'centroid')
probes=[]
for x,y in [[18,11.25],[32,11.25],[25,6.25],[25,11.25],[25,3],[45,20]]:
 uv=[(q(x)-20)/5,(q(y)+11)/5];expect=inside(data['uv'],uv)==(data['keep']=='inside');owners=[c['id'] for c in data['children'] if kept(c['trims'],uv)]
 assert len(owners)<=1,('Overlapping material components',x,y,owners)
 assert bool(owners)==expect,('Lost material or bridge',x,y,owners,expect)
 probes.append({'world':[x,y,3],'originalMaterial':expect,'componentOwners':owners})
serialize=lambda a:{'numerator':str(a.numerator),'denominator':str(a.denominator),'value':float(a)}
print(json.dumps({'status':'PASS','expectedExactSweep':expected,'actualStoredComponents':{side:[{'id':a['id'],'areaWorld':serialize(a['area']),'centroidWorld':[serialize(x) for x in a['centroid']]} for a in rows] for side,rows in actual.items()},'probes':probes,'tolerance':1e-7,'scope':'Independent Fraction Green moments, positive-interior slab sweep and ray parity over actual stored original/result masks; no solid mass or child embedding claim'},indent=2))
