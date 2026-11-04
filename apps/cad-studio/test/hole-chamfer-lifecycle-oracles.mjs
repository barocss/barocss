// D533: one retained D449/D508 Chamfer plus one disjoint Through Hole.
// Source preparation only. Root owns the serial gate, execution and first-failure custody.
// Observer fields follow the retained D508 inspector and D500 display mapping.
// Python independently evaluates the original rational data and literal physical formulas.
export const seedSHA256 = 'bff9ee71ea46e2432a186016c8e74d639c15b08803fe388f6a9dd5980059b7bb';
export const seedJSON = '{"format":"barocss-cad-model","schema":3,"units":"mm","parameters":{},"nodes":[{"kind":"sketch","profile":"rectangle","min":[-20,-20],"max":[60,20],"outline":{"points":[[-20,-20],[60,-20],[60,20],[-20,20]],"lengths":{"0":80,"1":40},"hv":{"h":[0,2],"v":[1,3]}},"sideTags":{"outer":["e1","e2","e3","e4"]},"id":"n0"},{"kind":"extrude","sketch":0,"height":10,"id":"n1"},{"kind":"chamfer","parent":{"node":1,"side":"solid"},"edges":["n1.side[e1]|n1.top"],"distance":3,"id":"n2","sigs":{"n1.side[e1]|n1.top":{"k":"line","p":[20,-20,10],"d":[1,0,0],"s":80}}}],"outputs":{"b2":{"node":2,"side":"solid"}},"nextId":3}';

// TS stdin resolved from apps/cad-studio by flow-helper's esbuild wrapper.
// CLI: node inspector.mjs ACTUAL_DOC_PATH OPTIONS_JSON
export const inspectorSource = String.raw`
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readStudioDoc} from '../../packages/barocss-cad-model/src/engine/migrate.ts';
import {toPartDocument,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {bodyMesh} from '../../packages/barocss-cad-model/src/engine/mesh.ts';
import {evaluateCadPart,massPropertiesOf,brepMassProperties,checkBrep,checkOutput,faceGeometry,evaluateSurfaceD1,surfaceDomain,curveDomain,curveEvaluator} from '../../packages/barocss-cad/src/index.ts';
import {stepValidationBounds} from '../../packages/barocss-cad/src/brep/brep-bounds.ts';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const error=(e:any)=>({name:e?.name??null,code:e?.code??null,feature:e?.feature??null,message:String(e?.message??e)});
const safe=(fn:()=>any)=>{try{return fn();}catch(e){return {observationError:error(e)};}};
const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function inspect(doc:any,request:any={}){
 const documentJSON=JSON.stringify(doc),documentSHA256=sha(documentJSON),reader=safe(()=>readStudioDoc(documentJSON));
 let partDocument:any=null;const outputs:any[]=[];
 try{
  partDocument=toPartDocument(doc);const snapshot=evaluateCadPart(partDocument);
  // Capture every original world BRep before checks, selected owners or geometry expectations.
  for(const out of snapshot.outputs){const nativeBRepJSON=JSON.stringify(out.brep);outputs.push({outputId:out.id,bodyKey:bodyKeyOf(out.id,doc.nodes),representation:out.representation,nativeBodyCount:out.bodyCount,brep:out.brep,nativeBRepJSON,nativeBRepSHA256:sha(nativeBRepJSON)});}
  if(!request.pickOnly)for(let i=0;i<outputs.length;i++){
   const raw=outputs[i],out=snapshot.outputs[i],brep=raw.brep;
   // Current public massPropertiesOf/brepMassProperties are MMGS (part-model.ts,
   // solid-mass.ts). Preserve their raw objects; no native-SI tensor conversion.
   raw.massUnits={density:1,densityUnit:'g/cm3',volume:'mm3',mass:'g',centroid:'mm',authority:'massPropertiesOf/brepMassProperties MMGS'};
   raw.massProperties=safe(()=>massPropertiesOf(out,1));raw.brepMass=safe(()=>brepMassProperties(brep,1));
   raw.bounds=safe(()=>stepValidationBounds(brep));raw.defaultCheck=safe(()=>checkBrep(brep));raw.strict=safe(()=>checkBrep(brep,{strict:true}));raw.outputCheck=safe(()=>checkOutput(out));
   raw.surfaces=brep.faces.map((f:any)=>({id:f.id,name:f.name,geometry:safe(()=>faceGeometry(f)),probe:safe(()=>{
    const s=f.surface;if(s.kind!=='surface')return {unsupportedSurfaceKind:s.kind};const domain=surfaceDomain(s);
    return {domain,probes:[[.25,.37],[.75,.63]].map(([u,v])=>{const U=domain.u[0]+u*(domain.u[1]-domain.u[0]),V=domain.v[0]+v*(domain.v[1]-domain.v[0]),d=evaluateSurfaceD1(s,U,V),n=cross(d.du,d.dv),norm=Math.hypot(...n),sign=f.sense==='forward'?1:-1;return {u:U,v:V,point:d.point,du:d.du,dv:d.dv,normal:n.map(x=>sign*x/norm),normalNorm:norm};})};
   })}));
   raw.edgeProbes=brep.edges.map((e:any)=>({id:e.id,name:e.name,probe:safe(()=>{const[a,z]=curveDomain(e.curve),at=curveEvaluator(e.curve);return {domain:[a,z],samples:[0,.125,.25,.375,.5,.625,.75,.875,1].map(t=>at(a+(z-a)*t))};})}));
  }
  const target=outputs.length===1?outputs[0]:null;
  const display=target?safe(()=>{const mesh=bodyMesh(target.brep,0,8);return {bodyIndex:0,bodyKey:target.bodyKey,faces:mesh.faces.map((f:any)=>({index:f.index,nativeName:f.name,kind:f.kind,normal:f.normal,centroid:f.centroid,radius:f.radius,exact:f.exact})),edges:mesh.edges};}):null;
  const native=target?{...target,documentSHA256,mass:target.massProperties,check:target.strict}:null;
  return {ok:true,status:request.pickOnly?'PICK_MAPPING_ONLY':'CAPTURED',request,documentJSON,documentSHA256,inputUnchanged:JSON.stringify(doc)===documentJSON,reader,partDocument,outputs,outputIds:outputs.map(o=>o.outputId),target,native,bodyCount:outputs.length,bodyKey:target?.bodyKey??null,outputId:target?.outputId??null,nativeBodyCount:target?.nativeBodyCount??null,mass:target?.massProperties??null,brepMass:target?.brepMass??null,bounds:target?.bounds??null,display,kernelChamfer:partDocument.features.find((f:any)=>f.kind==='chamfer')??null,kernelHole:partDocument.features.find((f:any)=>f.kind==='hole')??null};
 }catch(e){return {ok:false,status:'FAIL_CAPTURE_READINESS',request,documentJSON,documentSHA256,inputUnchanged:JSON.stringify(doc)===documentJSON,reader,partDocument,outputs,error:error(e)};}
}
const inputFile=process.argv[2];const inputBytes=readFileSync(inputFile,'utf8');
const result=inspect(JSON.parse(inputBytes),JSON.parse(process.argv[3]??'{}'));
// Source bytes are retained independently from JSON.stringify's original object transport.
console.log(JSON.stringify({...result,inputPath:inputFile,inputBytes,inputSHA256:sha(inputBytes)}));
`;

export const oracleSource = String.raw`
"""D533 finite profile: literal box minus disjoint triangular wedge and cylinder.
No product imports, mesh integration, optional-pcurve synthesis or tolerance changes.
Pure rational de Boor/D1 and topology traversal follow the D500/D508 method.
Finite witnesses establish only this declared profile, not a full-domain theorem.
"""
import copy, hashlib, json, math, sys, traceback
L=1e-9
SEED_TEXT=${JSON.stringify(seedJSON)}
SEED_SHA='${seedSHA256}'
def need(v,label):
 if not v: raise AssertionError(label)
def finite(x):
 if isinstance(x,bool) or x is None or isinstance(x,str): return True
 if isinstance(x,(int,float)): return math.isfinite(x)
 if isinstance(x,list): return all(finite(v) for v in x)
 if isinstance(x,dict): return all(finite(v) for v in x.values())
 return False
def near(a,b,label,t=L):
 need(isinstance(a,(int,float)) and not isinstance(a,bool) and math.isfinite(a) and abs(a-b)<=t,f'{label}: {a} != {b}; budget {t}')
def vec(a,b,label,t=L):
 need(isinstance(a,list) and len(a)==len(b),label+' dimensions')
 for i,(v,w) in enumerate(zip(a,b)): near(v,w,label+str(i),t)
def sub(a,b): return [v-w for v,w in zip(a,b)]
def dot(a,b): return sum(v*w for v,w in zip(a,b))
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def unit(a):
 n=math.sqrt(dot(a,a));need(n>0,'nondegenerate normal');return [v/n for v in a]
def bbox(points):
 need(points,'nonempty material boundary');return {s:[f(p[i] for p in points) for i in range(3)] for s,f in [('min',min),('max',max)]}
def bounds(a,b,label):
 for side in ['min','max']: vec(a[side],b[side],label+side)
def deboor(points,knots,degree,t):
 n=len(points)-1;need(n>=degree>=0 and len(knots)==len(points)+degree+1,'original rational dimensions')
 lo,hi=knots[degree],knots[n+1];need(lo<=t<=hi and lo<hi,'original rational domain')
 k=n if t==hi else next(i for i in range(degree,n+1) if knots[i]<=t<knots[i+1])
 q=[list(points[j]) for j in range(k-degree,k+1)]
 for r in range(1,degree+1):
  for j in range(degree,r-1,-1):
   i=k-degree+j;den=knots[i+degree-r+1]-knots[i];alpha=(t-knots[i])/den if den else 0
   q[j]=[(1-alpha)*a+alpha*b for a,b in zip(q[j-1],q[j])]
 return q[degree]
def derivative(points,knots,degree,t):
 need(degree>=1,'positive rational degree')
 d=[]
 for i in range(len(points)-1):
  den=knots[i+degree+1]-knots[i+1];d.append([degree*(b-a)/den if den else 0 for a,b in zip(points[i],points[i+1])])
 return deboor(d,knots[1:-1],degree-1,t)
def domain(c): return c['knots'][c['degree']],c['knots'][len(c['controlPoints'])]
def curve(c,t):
 p=c['controlPoints'];w=c['weights'];need(len(p)==len(w) and all(v>0 for v in w),'original positive curve weights')
 q=deboor([[v*ww for v in pp]+[ww] for pp,ww in zip(p,w)],c['knots'],c['degree'],t);need(q[3]>0,'positive rational curve denominator');return [v/q[3] for v in q[:3]]
def surface_d1(s,u,v):
 p=s['controlPoints'];w=s['weights'];need(len(p)==len(w) and all(len(a)==len(b) for a,b in zip(p,w)) and all(ww>0 for row in w for ww in row),'original positive surface weights')
 h=[[[q*ww for q in pp]+[ww] for pp,ww in zip(row,weights)] for row,weights in zip(p,w)]
 rows=[deboor(row,s['knotsV'],s['degreeV'],v) for row in h];rows_v=[derivative(row,s['knotsV'],s['degreeV'],v) for row in h]
 q=deboor(rows,s['knotsU'],s['degreeU'],u);du=derivative(rows,s['knotsU'],s['degreeU'],u);dv=deboor(rows_v,s['knotsU'],s['degreeU'],u);need(q[3]>0,'positive rational surface denominator')
 return [a/q[3] for a in q[:3]],[(a*q[3]-b*du[3])/q[3]**2 for a,b in zip(du[:3],q[:3])],[(a*q[3]-b*dv[3])/q[3]**2 for a,b in zip(dv[:3],q[:3])]
def stations(c):
 a,z=domain(c);knots=sorted(set(t for t in c['knots'] if a<=t<=z));return sorted(set([a+(z-a)*i/8 for i in range(9)]+knots+[(u+v)/2 for u,v in zip(knots,knots[1:])]))
def expected(d,r):
 need((d,r) in [(3,2),(2,2),(2,3)] and not isinstance(d,bool) and not isinstance(r,bool),'three declared accepted states only')
 wedge=40*d*d;cylinder=10*math.pi*r*r;v=32000-wedge-cylinder
 return {'volume':v,'massDensity1':v/1000,'centroid':[20,wedge*(20-d/3)/v,(160000-wedge*(10-d/3)-5*cylinder)/v],'bounds':{'min':[-20,-20,0],'max':[60,20,10]},'wedgeRemovedVolume':wedge,'cylinderRemovedVolume':cylinder,'genus':1,'minimumHoleToChamferTopStripClearanceMM':20-d-r}
def inside(p,d,r,label):
 need(-20-L<=p[0]<=60+L and -20-L<=p[1]<=20+L and -L<=p[2]<=10+L and p[2]-p[1]<=30-d+L,label+' nominal outer material halfspaces')
 need(math.hypot(p[0]-20,p[1])>=r-L,label+' outside declared bore')
def geometry(raw,d,r):
 b=raw['brep'];need(finite(b),'finite original native data')
 keys=['bodies','shells','faces','loops','coedges','edges','vertices'];tab={k:{q['id']:q for q in b[k]} for k in keys}
 need(all(len(tab[k])==len(b[k]) for k in keys),'unique original native IDs')
 need(len(b['bodies'])==len(b['shells'])==1 and b['bodies'][0]['kind']=='solid' and b['shells'][0]['closed'],'one closed native solid')
 body,shell=b['bodies'][0],b['shells'][0];faces,loops,co,edges,verts=[tab[k] for k in keys[2:]]
 need(set(body['shells'])==set(tab['shells']) and shell['body']==body['id'] and set(shell['faces'])==set(faces),'complete original solid/shell membership')
 edgepoints={};endpoint_gap=0.;pcurve_gap=0.;pcurve_count=0;all_co=[];all_loops=[];graph={f:set() for f in faces}
 cap=1e-3*max(1,max(abs(x) for v in verts.values() for x in v['point']))
 for v in verts.values(): need(0<v['tolerance']<=cap,'existing strict vertex tolerance cap')
 for e in edges.values():
  need(0<e['tolerance']<=cap and len(e['vertices'])==2 and all(v in verts for v in e['vertices']),'original edge tolerance and endpoints')
  pts=[curve(e['curve'],t) for t in stations(e['curve'])];edgepoints[e['id']]=pts
  for p,vid in zip([pts[0],pts[-1]],e['vertices']):
   delta=math.dist(p,verts[vid]['point']);endpoint_gap=max(endpoint_gap,delta);near(delta,0,'independent original endpoint',min(L,e['tolerance']))
 for f in faces.values():
  need(f['shell']==shell['id'] and f['loops'],'face/shell membership');all_loops+=f['loops']
  for lid in f['loops']:
   lp=loops[lid];need(lp['face']==f['id'] and lp['coedges'],'reciprocal face/loop');all_co+=lp['coedges']
   for j,cid in enumerate(lp['coedges']):
    c=co[cid];n=co[lp['coedges'][(j+1)%len(lp['coedges'])]]
    need(c['loop']==lid and c['next']==n['id'] and c['prev']==lp['coedges'][j-1],'original ordered coedge loop')
    e=edges[c['edge']];en=edges[n['edge']];end=e['vertices'][1 if c['sense']=='forward' else 0];start=en['vertices'][0 if n['sense']=='forward' else 1]
    need(end==start,'directed original loop endpoint continuity')
 for c in co.values():
  t=co[c['twin']];need(t['twin']==c['id'] and c['edge']==t['edge'] and c['sense']!=t['sense'],'closed opposed reciprocal twins');graph[loops[c['loop']]['face']].add(loops[t['loop']]['face'])
  if c.get('pcurve') is not None:
   pcurve_count+=1;e=edges[c['edge']];need(domain(c['pcurve'])==domain(e['curve']),'original pcurve domain')
   for tt in stations(e['curve']):
    uv=curve(c['pcurve'],tt);p=surface_d1(faces[loops[c['loop']]['face']]['surface'],uv[0],uv[1])[0];delta=math.dist(p,curve(e['curve'],tt));pcurve_gap=max(pcurve_gap,delta);near(delta,0,'independent original optional pcurve lift',min(L,e['tolerance']))
 need(len(all_loops)==len(loops) and set(all_loops)==set(loops) and len(all_co)==len(co) and set(all_co)==set(co),'all original loops/coedges owned exactly once')
 for eid in edges: need(sum(c['edge']==eid for c in co.values())==2,'two original uses per edge')
 need(set(v for e in edges.values() for v in e['vertices'])==set(verts),'no orphan vertices')
 seen=set();todo=[next(iter(faces))]
 while todo:
  fid=todo.pop()
  if fid not in seen: seen.add(fid);todo+=list(graph[fid]-seen)
 need(seen==set(faces),'one connected original shell')
 chi=len(verts)-len(edges)+2*len(faces)-len(loops);need(chi==0,'independent genus1 Euler characteristic')
 q=1/math.sqrt(2)
 roles={
  'x-min':([-1,0,0],[-20,0,0],{'min':[-20,-20,0],'max':[-20,20,10]}),
  'x-max':([1,0,0],[60,0,0],{'min':[60,-20,0],'max':[60,20,10]}),
  'y-min':([0,-1,0],[0,-20,0],{'min':[-20,-20,0],'max':[60,-20,10-d]}),
  'y-max':([0,1,0],[0,20,0],{'min':[-20,20,0],'max':[60,20,10]}),
  'bottom':([0,0,-1],[0,0,0],{'min':[-20,-20,0],'max':[60,20,0]}),
  'top':([0,0,1],[0,0,10],{'min':[-20,-20+d,10],'max':[60,20,10]}),
  'chamfer':([0,-q,q],[0,-20,10-d],{'min':[-20,-20,10-d],'max':[60,-20+d,10]})}
 role_points={k:[] for k in roles};cavity=[];rim_points={0:[],10:[]};carriers=[];max_carrier=0.;max_normal=0.;max_probe=0.;max_d1=0.;max_edge=0.
 smap={s['id']:s for s in raw['surfaces']};need(len(smap)==len(raw['surfaces'])==len(faces) and set(smap)==set(faces),'all original carrier observations')
 for f in faces.values():
  sf=f['surface'];need(sf['kind']=='surface','no faceted native substitute');obs=smap[f['id']];g=obs['geometry']
  boundary=[p for lid in f['loops'] for cid in loops[lid]['coedges'] for p in edgepoints[co[cid]['edge']]]
  for p in boundary: inside(p,d,r,'actual face trim')
  if g['kind']=='plane':
   match=[key for key,(n,o,bb) in roles.items() if max(abs(a-b) for a,b in zip(g['n'],n))<=L and abs(dot(n,sub(g['o'],o)))<=L]
   need(len(match)==1,'one declared nominal plane role');role=match[0];normal,origin,_=roles[role];role_points[role]+=boundary
   for p in boundary: delta=abs(dot(normal,sub(p,origin)));max_carrier=max(max_carrier,delta);near(delta,0,'independent planar trim support')
  else:
   need(g['kind']=='cylinder','only seven plane roles and inward bore cylinders');role='bore';near(g['r'],r,'declared cylinder radius');vec([g['c'][0],g['c'][1]],[20,0],'declared cylinder axis center');vec([abs(v) for v in g['a']],[0,0,1],'declared Z cylinder axis');need(g['out']==-1,'cavity cylinder orientation')
   for p in boundary:
    delta=abs(math.hypot(p[0]-20,p[1])-r);max_carrier=max(max_carrier,delta);near(delta,0,'independent cylinder trim radius')
   cavity+=boundary
  for ob in obs['probe']['probes']:
   p,du,dv=surface_d1(sf,ob['u'],ob['v']);vec(ob['point'],p,'independent rational surface point');vec(ob['du'],du,'independent rational du');vec(ob['dv'],dv,'independent rational dv');max_probe=max(max_probe,max(abs(a-b) for a,b in zip(ob['point'],p)));max_d1=max(max_d1,max(abs(a-b) for a,b in zip(ob['du']+ob['dv'],du+dv)))
   nn=unit(cross(du,dv));nn=[v*(1 if f['sense']=='forward' else -1) for v in nn]
   if role=='bore':
    delta=abs(math.hypot(p[0]-20,p[1])-r);max_carrier=max(max_carrier,delta);near(delta,0,'independent cylinder carrier radius');normal=[-(p[0]-20)/r,-p[1]/r,0]
   else:
    delta=abs(dot(normal,sub(p,origin)));max_carrier=max(max_carrier,delta);near(delta,0,'independent plane carrier point')
   vec(nn,normal,'independent outward normal');vec(ob['normal'],nn,'observed native normal');need(ob['normalNorm']>0,'nondegenerate native derivative');max_normal=max(max_normal,max(abs(a-b) for a,b in zip(nn,normal)))
  carriers.append({'face':f['id'],'name':f.get('name'),'role':role})
  for lid in f['loops']:
   for cid in loops[lid]['coedges']:
    ps=edgepoints[co[cid]['edge']]
    for z in [0,10]:
     if all(abs(p[2]-z)<=L and abs(math.hypot(p[0]-20,p[1])-r)<=L for p in ps): rim_points[z]+=ps
 for role,ps in role_points.items(): need(ps,'missing declared plane '+role);bounds(bbox(ps),roles[role][2],'physical plane trim extent '+role)
 need(cavity,'actual inward cylinder trim');bounds(bbox(cavity),{'min':[20-r,-r,0],'max':[20+r,r,10]},'complete actual bore band')
 for z,ps in rim_points.items():
  need(ps,'both actual circular rims');bounds(bbox(ps),{'min':[20-r,-r,z],'max':[20+r,r,z]},'physical circular rim extent')
  angles=sorted(set(math.atan2(p[1],p[0]-20)%(2*math.pi) for p in ps));gaps=[(angles[(i+1)%len(angles)]-a)%(2*math.pi) for i,a in enumerate(angles)];need(len(angles)>=4 and max(gaps)<=math.pi/2+L,'full circular rim angular witnesses')
 ep={p['id']:p for p in raw['edgeProbes']};need(len(ep)==len(raw['edgeProbes'])==len(edges) and set(ep)==set(edges),'all original edge observations')
 for eid,e in edges.items():
  a,z=domain(e['curve']);ob=ep[eid]['probe'];need(ob['domain']==[a,z] and len(ob['samples'])==9,'original edge domain and native station count')
  for i,p in enumerate(ob['samples']):
   independent=curve(e['curve'],a+(z-a)*i/8);vec(p,independent,'independent original edge point');max_edge=max(max_edge,max(abs(v-w) for v,w in zip(p,independent)))
 bounds(bbox([v['point'] for v in verts.values()]+[p for ps in edgepoints.values() for p in ps]),expected(d,r)['bounds'],'complete native trimmed material bounds')
 need(any(f.get('name')=='n2.face' for f in faces.values()),'original Chamfer face retained')
 need(any((f.get('name') or '').split('#')[0]=='n1.top' for f in faces.values()),'Hole entry face reference retained')
 return {'counts':{k:len(b[k]) for k in keys},'genus':1,'eulerCharacteristic':chi,'carriers':carriers,'pcurveCount':pcurve_count,'pcurvePresence':'ORIGINAL_OPTIONAL_FIELDS_ONLY','maximumEndpointGapMM':endpoint_gap,'maximumPcurveLiftGapMM':pcurve_gap,'maximumCarrierResidualMM':max_carrier,'maximumIndependentProbePointGapMM':max_probe,'maximumIndependentD1ComponentGapMM':max_d1,'maximumIndependentEdgeProbeGapMM':max_edge,'maximumOutwardNormalComponentError':max_normal,'proofBoundary':'Complete original graph/trim traversal and finite rational witnesses; not a full-domain theorem.'}
def run(x):
 p=x['parameters'];d=p['chamferDistance'];diameter=p['holeDiameter'];r=diameter/2;exp=expected(d,r);rd=x['read'];doc=x['doc'];text=x.get('documentJSON',rd['documentJSON'])
 need(hashlib.sha256(SEED_TEXT.encode()).hexdigest()==SEED_SHA and len(SEED_TEXT.encode())==607,'exact original retained seed bytes and SHA')
 seed=json.loads(SEED_TEXT);need(x['seedDoc']==seed,'caller retained actual seed exact')
 wanted=copy.deepcopy(seed);wanted['nodes'][2]['distance']=d;wanted['nodes'].append({'kind':'hole','parent':{'node':2,'side':'solid'},'radius':r,'center':[20,0],'face':'n1.top','id':'n3'});wanted['outputs']={'b3':{'node':3,'side':'solid'}};wanted['nextId']=4
 need(doc==wanted==x['expectedDoc'],'only declared upstream distance/downstream diameter edits; all source refs/IDs/signature/constraints retained')
 need(rd['ok'] is True and rd['status']=='CAPTURED' and rd['inputUnchanged'] is True and rd['documentJSON']==text and json.loads(text)==doc==rd['reader']['doc'] and rd['reader']['notes']==[],'original actual Doc/native reader binding')
 need(hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256'],'original whole Doc transport SHA')
 need(rd['request']['parameters']==p,'native requested state matches independent oracle state')
 need(len(rd['outputs'])==1 and rd['target']==rd['outputs'][0] and rd['outputIds']==['n3'] and rd['bodyKey']=='b3' and rd['outputId']=='n3' and rd['nativeBodyCount']==1,'all outputs captured then sole n3/b3 owner')
 raw=rd['outputs'][0];need(raw['outputId']=='n3' and raw['bodyKey']=='b3' and raw['nativeBodyCount']==1,'original raw n3/b3 physical owner')
 bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'original native JS bytes/SHA; no Python reserialization')
 native=rd['native'];need(native['nativeBRepJSON']==bj and native['nativeBRepSHA256']==raw['nativeBRepSHA256'] and native['documentSHA256']==rd['documentSHA256'] and native['mass']==raw['massProperties'] and rd['mass']==raw['massProperties'] and rd['brepMass']==raw['brepMass'] and rd['bounds']==raw['bounds'],'original observer aliases bound')
 sig={'kind':'line','at':[20,-20,10],'dir':[1,0,0],'size':80};edge='n1.side[e1]|n1.top'
 need(rd['kernelChamfer']=={'id':'n2','kind':'chamfer','target':'n1','edges':[edge],'distance':d,'expect':{edge:sig}},'original Chamfer parent/edge/signature reaches native expect')
 need(rd['kernelHole']=={'id':'n3','kind':'hole','target':'n2','center':[20,0],'radius':r,'face':'n1.top'},'current native Hole parent/face/world center/radius/default axis')
 features=rd['partDocument']['features'];need([f['id'] for f in features]==['n0','n1','n2','n3'],'native feature IDs/order')
 need(features[0]=={'id':'n0','kind':'sketch','profile':'rectangle','min':[-20,-20],'max':[60,20],'sideTags':{'outer':['e1','e2','e3','e4']}} and features[1]=={'id':'n1','kind':'extrude','sketch':'n0','height':10},'original native stock profile/tags/height')
 for key in ['defaultCheck','strict','outputCheck']:
  ck=raw[key];need(ck['valid'] is True and ck['issues']==[] and len(ck['topology'])==1 and ck['topology'][0]['genus']==1,'unchanged native '+key)
 need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'explicit original public MMGS mass units at density1 g/cm3')
 bounds(raw['bounds'],exp['bounds'],'native boundary-aware bounds');mass_errors={}
 for key in ['massProperties','brepMass']:
  m=raw[key];need(finite(m) and m['method'] in ['closed-form','planar-exact','quadrature'],'nonmesh native mass '+key);near(m['volume'],exp['volume'],key+' literal volume',L*exp['volume']);near(m['mass'],exp['massDensity1'],key+' density1 grams');vec(m['centroid'],exp['centroid'],key+' literal centroid');mass_errors[key]={'volumeRelative':abs(m['volume']-exp['volume'])/exp['volume'],'centroidAbsoluteMM':max(abs(a-b) for a,b in zip(m['centroid'],exp['centroid']))}
 geo=geometry(raw,d,r);worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ADMISSION'
 if x.get('consumer') is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True,'fresh original Studio whole Doc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==1 and w['bodies'][0]['key']=='b3','fresh current root Worker n3/b3');body=w['bodies'][0];near(body['volume'],exp['volume'],'fresh Worker literal volume',L*exp['volume']);vec(body['centroid'],exp['centroid'],'fresh Worker literal centroid');near(body['volume'],raw['massProperties']['volume'],'fresh Worker/native volume',L*exp['volume']);vec(body['centroid'],raw['massProperties']['centroid'],'fresh Worker/native centroid');worker='PASS_ORIGINAL_FRESH_STUDIO_DOC_WORKER'
 return {'status':'PASS_ONE_DECLARED_D533_HOLE_CHAMFER_STATE','parameters':p,'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'expected':exp,'massErrors':mass_errors,'geometry':geo,'worker':worker,'budgets':{'volumeRelative':L,'centroidBoundsBoundaryCarrierD1EndpointPcurveAbsoluteMM':L,'unitNormalComponent':L,'density1MassAbsoluteG':L},'limits':['Only retained n2 Chamfer3/2 plus disjoint n3 Through Hole D4/6 on this stock, in the three declared combinations.','Actual public picks/preview/refusal/history/Save/Open/re-edit are separate driver observations.','No full kernel, generic Boolean/Chamfer/Hole, inertia, full viewport fit, manufacturing, mobile or release claim.']}
if __name__=='__main__':
 try: print(json.dumps(run(json.load(sys.stdin)),indent=2,allow_nan=False))
 except Exception as exc: print(json.dumps({'status':'FAIL_D533_DECLARED_HOLE_CHAMFER','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
