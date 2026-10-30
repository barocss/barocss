"""Independent exact arithmetic at captured binary64 Gauss nodes; no CAD imports."""
import json,sys,math
from fractions import Fraction as Q
from pathlib import Path
p=Path('/tmp/d344-kernel');data=json.loads((p/'baseline.json').read_text());brep=json.loads((p/'input-brep.json').read_text());faces={f['id']:f for f in brep['faces']};nodes=data['trace']['nodes'];patches={p['faceId']:p for p in data['trace']['patches']};center=[Q(x) for x in data['trace']['centre']]
def emit(q):return {'value':float(q),'numerator':str(q.numerator),'denominator':str(q.denominator)}
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def basis(n,exact):
 if not exact:return [[Q(x) for x in n[k]] for k in ['N','D','M','E']]
 a,b=map(Q,n['spanU']);c,d=map(Q,n['spanV']);u=(Q(n['u'])-a)/(b-a);v=(Q(n['v'])-c)/(d-c)
 return [[(1-u)**2,2*u*(1-u),u*u],[-2*(1-u)/(b-a),(2-4*u)/(b-a),2*u/(b-a)],[1-v,v],[-1/(d-c),1/(d-c)]]
def evaluate(n,exact,stage):
 s=faces[n['faceId']]['surface'];N,D,M,E=basis(n,exact);h=[Q(0)]*4;hu=[Q(0)]*4;hv=[Q(0)]*4
 for r in range(3):
  for c in range(2):
   i=n['firstU']+r;j=n['firstV']+c;w=Q(s['weights'][i][j]);pw=[Q(v)*w for v in s['controlPoints'][i][j]]+[w]
   if stage!='nativeProduct':
    patch=patches[n['faceId']];at=4*(i*patch['nv']+j);pw=[Q(v) for v in patch['Pw'][at:at+4]]
   for k in range(4):h[k]+=N[r]*M[c]*pw[k];hu[k]+=D[r]*M[c]*pw[k];hv[k]+=N[r]*E[c]*pw[k]
 if stage=='observedColumns':
  h=[sum(M[c]*Q(n['R'][4*c+k]) for c in range(2)) for k in range(4)];hu=[sum(M[c]*Q(n['Ru'][4*c+k]) for c in range(2)) for k in range(4)];hv=[sum(E[c]*Q(n['R'][4*c+k]) for c in range(2)) for k in range(4)]
 point=[v/h[3] for v in h[:3]];du=[(hu[k]-point[k]*hu[3])/h[3] for k in range(3)];dv=[(hv[k]-point[k]*hv[3])/h[3] for k in range(3)];normal=cross(du,dv)
 return point,du,dv,normal
results={};nodeerrors=[]
for label,exact,stage in [('exactBasis',True,'nativeProduct'),('storedBasisExactArithmetic',False,'nativeProduct'),('storedBasisRoundedProducts',False,'roundedProducts'),('storedBasisObservedColumns',False,'observedColumns')]:
 total=[Q(0)]*3;maxdv=Q(0);maxduz=Q(0);maxtangentdv=Q(0);maxFloatDvRelative=0
 for n in nodes:
  point,du,dv,normal=evaluate(n,exact,stage);s=faces[n['faceId']]['surface'];h=Q(s['controlPoints'][0][1][2])-Q(s['controlPoints'][0][0][2]);
  assert h!=0
  if exact:
   assert du[2]==0 and dv[0]==dv[1]==0 and dv[2]==h
  weight=Q(n['weight']);x,y,z=[point[k]-center[k] for k in range(3)];total[0]+=x*normal[0]*weight;total[1]+=x*x/2*normal[0]*weight;total[2]+=y*y/2*normal[1]*weight
  maxdv=max(maxdv,abs(dv[2]-h)/abs(h));maxduz=max(maxduz,abs(du[2]));maxtangentdv=max(maxtangentdv,abs(dv[0]),abs(dv[1]));relative=abs((Q(n['dv'][2])-dv[2])/h);maxFloatDvRelative=max(maxFloatDvRelative,float(relative))
  if exact:nodeerrors.append({'faceId':n['faceId'],'span':n['a'],'i':n['i'],'j':n['j'],'exactH':emit(h),'actualDvNormal':n['dv'][2],'actualDuNormal':n['du'][2],'actualDvTangents':n['dv'][:2],'relativeDvNormalError':float(relative)})
 V,X,Y=total;results[label]={'volume':emit(V),'centroidXY':[emit(X/V+center[0]),emit(Y/V+center[1])],'maximumExactRelativeDvDeviationFromH':float(maxdv),'maximumExactDuNormal':float(maxduz),'maximumExactDvTangents':float(maxtangentdv),'maximumFloatingRelativeDvError':maxFloatDvRelative}
raw=data['untouched']['mass'];guide=math.pi*9*float(Q(.34567890000000023)-Q(.3456789));result={'status':'PASS','authority':'exact arithmetic at actual stored binary64 nodes; not exact integration or exact pi','nodeCount':len(nodes),'results':results,'untouchedMass':raw,'roundedPiGuide':guide,'floatingVolumeRelativeToGuide':raw['volume']/guide-1,'exactNodeVolumeRelativeToGuide':results['exactBasis']['volume']['value']/guide-1,'floatingTangentCenterErrors':[raw['centroid'][0]-.1234567,raw['centroid'][1]+.2345678],'maximumNodeRelativeDvNormalError':max(e['relativeDvNormalError'] for e in nodeerrors)}
(p/'oracle-node-errors.json').write_text(json.dumps(nodeerrors,indent=2)+'\n');(p/'oracle-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='results'},indent=2));print(json.dumps({k:{'volume':v['volume']['value'],'centroidXY':[x['value'] for x in v['centroidXY']],'maximumExactRelativeDvDeviationFromH':v['maximumExactRelativeDvDeviationFromH'],'maximumFloatingRelativeDvError':v['maximumFloatingRelativeDvError']} for k,v in results.items()},indent=2))
