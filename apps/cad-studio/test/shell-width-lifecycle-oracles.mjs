// D535 retained open-top rectangular Shell: one upstream-width lifecycle.
// Root owns execution and first-failure custody. Importing this file executes no jobs.
export const seedSHA256 = '17351eb2ad01ffbafcf9c76d21e2da5030b794600ca80a55a41a0928fdbaf6c9';
export const seedJSON = '{"format":"barocss-cad-model","schema":3,"units":"mm","parameters":{},"nodes":[{"kind":"sketch","profile":"rectangle","min":[-20,-20],"max":[60,20],"outline":{"points":[[-20,-20],[60,-20],[60,20],[-20,20]],"lengths":{"0":80,"1":40},"hv":{"h":[0,2],"v":[1,3]}},"sideTags":{"outer":["e1","e2","e3","e4"]},"id":"n0"},{"kind":"extrude","sketch":0,"height":10,"id":"n1"},{"kind":"shell","parent":{"node":1,"side":"solid"},"thickness":3,"open":["n1.top"],"id":"n2","sigs":{"n1.top":{"k":"plane","p":[20,0,10],"d":[0,0,1],"s":3200}}}],"outputs":{"b2":{"node":2,"side":"solid"}},"nextId":3}';

// TS stdin resolved from apps/cad-studio; node inspector.mjs ACTUAL_DOC OPTIONS_JSON.
export const inspectorSource = String.raw`
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readStudioDoc} from '../../packages/barocss-cad-model/src/engine/migrate.ts';
import {prefixDoc} from '../../packages/barocss-cad-model/src/engine/doc.ts';
import {toPartDocument,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {bodyMesh} from '../../packages/barocss-cad-model/src/engine/mesh.ts';
import {evaluateCadPart,massPropertiesOf,brepMassProperties,checkBrep,checkOutput,faceGeometry,evaluateSurfaceD1,surfaceDomain,curveDomain,curveEvaluator} from '../../packages/barocss-cad/src/index.ts';
import {stepValidationBounds} from '../../packages/barocss-cad/src/brep/brep-bounds.ts';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const error=(e:any)=>({name:e?.name??null,code:e?.code??null,feature:e?.feature??null,message:String(e?.message??e)});
const safe=(fn:()=>any)=>{try{return fn();}catch(e){return {observationError:error(e)};}};
const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const capture=(out:any,nodes:any[])=>{const nativeBRepJSON=JSON.stringify(out.brep);return {outputId:out.id,bodyKey:bodyKeyOf(out.id,nodes),representation:out.representation,nativeBodyCount:out.bodyCount,brep:out.brep,nativeBRepJSON,nativeBRepSHA256:sha(nativeBRepJSON)};};
export function inspect(doc:any,request:any={}){
 const documentJSON=JSON.stringify(doc),documentSHA256=sha(documentJSON),reader=safe(()=>readStudioDoc(documentJSON));
 let partDocument:any=null,parentObservation:any=null;const outputs:any[]=[];
 try{
  partDocument=toPartDocument(doc);const snapshot=evaluateCadPart(partDocument);
  // All original accepted-output bytes precede assertions, selected owners and physical checks.
  for(const out of snapshot.outputs)outputs.push(capture(out,doc.nodes));
  if(!request.pickOnly)for(let i=0;i<outputs.length;i++){
   const raw=outputs[i],out=snapshot.outputs[i],brep=raw.brep;
   raw.massUnits={density:1,densityUnit:'g/cm3',volume:'mm3',mass:'g',centroid:'mm',authority:'massPropertiesOf/brepMassProperties MMGS'};
   raw.massProperties=safe(()=>massPropertiesOf(out,1));raw.brepMass=safe(()=>brepMassProperties(brep,1));
   raw.bounds=safe(()=>stepValidationBounds(brep));raw.defaultCheck=safe(()=>checkBrep(brep));raw.strict=safe(()=>checkBrep(brep,{strict:true}));raw.outputCheck=safe(()=>checkOutput(out));
   raw.surfaces=brep.faces.map((f:any)=>({id:f.id,name:f.name,geometry:safe(()=>faceGeometry(f)),probe:safe(()=>{
    const s=f.surface;if(s.kind!=='surface')return {unsupportedSurfaceKind:s.kind};const domain=surfaceDomain(s);
    return {domain,probes:[[.25,.37],[.75,.63]].map(([u,v])=>{const U=domain.u[0]+u*(domain.u[1]-domain.u[0]),V=domain.v[0]+v*(domain.v[1]-domain.v[0]),d=evaluateSurfaceD1(s,U,V),n=cross(d.du,d.dv),norm=Math.hypot(...n),sign=f.sense==='forward'?1:-1;return {u:U,v:V,point:d.point,du:d.du,dv:d.dv,normal:n.map(x=>sign*x/norm),normalNorm:norm};})};
   })}));
   raw.edgeProbes=brep.edges.map((e:any)=>({id:e.id,name:e.name,probe:safe(()=>{const[a,z]=curveDomain(e.curve),at=curveEvaluator(e.curve);return {domain:[a,z],samples:[0,.125,.25,.375,.5,.625,.75,.875,1].map(t=>at(a+(z-a)*t))};})}));
  }
  // This is an explicitly derived observation of the same actual source BEFORE Shell.
  // It is not another final fixture and does not overwrite the captured accepted Doc.
  if(!request.pickOnly)parentObservation=safe(()=>{
   const parentDoc=prefixDoc(doc,2),parentJSON=JSON.stringify(parentDoc),parentPartDocument=toPartDocument(parentDoc),parent=evaluateCadPart(parentPartDocument);
   const parentOutputs=parent.outputs.map((out:any)=>capture(out,parentDoc.nodes));
   for(const raw of parentOutputs){raw.defaultCheck=safe(()=>checkBrep(raw.brep));raw.strict=safe(()=>checkBrep(raw.brep,{strict:true}));raw.bounds=safe(()=>stepValidationBounds(raw.brep));raw.faces=raw.brep.faces.map((f:any)=>({id:f.id,name:f.name,geometry:safe(()=>faceGeometry(f))}));raw.displayTop=safe(()=>bodyMesh(raw.brep,0,8).faces.filter((f:any)=>f.name==='n1.top').map((f:any)=>({name:f.name,area:f.area,centroid:f.centroid,normal:f.normal})));}
   return {authority:'OBSERVER_DERIVED_SAME_ACTUAL_SOURCE_PREFIX_BEFORE_SHELL',documentJSON:parentJSON,documentSHA256:sha(parentJSON),partDocument:parentPartDocument,outputs:parentOutputs};
  });
  const target=outputs.length===1?outputs[0]:null,native=target?{...target,documentSHA256,mass:target.massProperties,check:target.strict}:null;
  return {ok:true,status:request.pickOnly?'ANTECEDENT_OBSERVATION_ONLY':'CAPTURED',request,documentJSON,documentSHA256,inputUnchanged:JSON.stringify(doc)===documentJSON,reader,partDocument,outputs,outputIds:outputs.map(o=>o.outputId),target,native,bodyCount:outputs.length,bodyKey:target?.bodyKey??null,outputId:target?.outputId??null,nativeBodyCount:target?.nativeBodyCount??null,mass:target?.massProperties??null,brepMass:target?.brepMass??null,bounds:target?.bounds??null,parentObservation,kernelShell:partDocument.features.find((f:any)=>f.id==='n2')??null};
 }catch(e){return {ok:false,status:'FAIL_CAPTURE_READINESS',request,documentJSON,documentSHA256,inputUnchanged:JSON.stringify(doc)===documentJSON,reader,partDocument,outputs,parentObservation,error:error(e)};}
}
const inputFile=process.argv[2],inputBytes=readFileSync(inputFile,'utf8');
console.log(JSON.stringify({...inspect(JSON.parse(inputBytes),JSON.parse(process.argv[3]??'{}')),inputPath:inputFile,inputBytes,inputSHA256:sha(inputBytes)}));
`;

// Independent finite planar-profile arithmetic. The stored signature is a historical
// identity anchor; actual current parent cap measurements are checked separately.
export const oracleSource = String.raw`
import copy, hashlib, json, math, sys, traceback
from fractions import Fraction as Q
L=1e-9
SEED_TEXT=${JSON.stringify(seedJSON)}
SEED_SHA='${seedSHA256}'
def need(v,label):
 if not v: raise AssertionError(label)
def near(a,b,label,t=L):
 need(isinstance(a,(int,float)) and not isinstance(a,bool) and math.isfinite(a) and abs(a-b)<=t,f'{label}: {a} != {b}; budget {t}')
def vec(a,b,label,t=L):
 need(isinstance(a,list) and len(a)==len(b),label+' dimensions')
 for i,(v,w) in enumerate(zip(a,b)): near(v,w,label+str(i),t)
def finite(x):
 if x is None or isinstance(x,(str,bool)): return True
 if isinstance(x,(int,float)): return math.isfinite(x)
 if isinstance(x,list): return all(finite(v) for v in x)
 if isinstance(x,dict): return all(finite(v) for v in x.values())
 return False
def sub(a,b): return [v-w for v,w in zip(a,b)]
def dot(a,b): return sum(v*w for v,w in zip(a,b))
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def unit(v):
 length=math.sqrt(dot(v,v));need(length>0,'nondegenerate original planar surface');return [a/length for a in v]
def bbox(points):
 need(points,'nonempty original trimmed boundary');return {s:[fn(p[i] for p in points) for i in range(3)] for s,fn in [('min',min),('max',max)]}
def bounds(a,b,label):
 for side in ['min','max']: vec(a[side],b[side],label+side)
def domain(c): return c['knots'][c['degree']],c['knots'][len(c['controlPoints'])]
def line(c,t):
 p=c['controlPoints'];need(c['degree']==1 and len(p)==len(c['weights'])==2 and c['weights']==[1,1],'selected original exact straight line')
 a,z=domain(c);need(a<z and c['knots']==[a,a,z,z] and a<=t<=z,'original line domain');u=(t-a)/(z-a);return [(1-u)*v+u*w for v,w in zip(p[0],p[1])]
def planar_d1(s,u,v):
 need(s['kind']=='surface' and s['degreeU']==s['degreeV']==1 and s['weights']==[[1,1],[1,1]],'selected original bilinear plane');p=s['controlPoints'];need(len(p)==2 and all(len(row)==2 for row in p),'original plane dimensions')
 ua,uz=s['knotsU'][1:3];va,vz=s['knotsV'][1:3];need(s['knotsU']==[ua,ua,uz,uz] and s['knotsV']==[va,va,vz,vz] and ua<uz and va<vz,'original plane domains');U=(u-ua)/(uz-ua);V=(v-va)/(vz-va)
 point=[(1-U)*(1-V)*p[0][0][i]+(1-U)*V*p[0][1][i]+U*(1-V)*p[1][0][i]+U*V*p[1][1][i] for i in range(3)]
 du=[((1-V)*(p[1][0][i]-p[0][0][i])+V*(p[1][1][i]-p[0][1][i]))/(uz-ua) for i in range(3)];dv=[((1-U)*(p[0][1][i]-p[0][0][i])+U*(p[1][1][i]-p[1][0][i]))/(vz-va) for i in range(3)]
 return point,du,dv
def loop_points(lid,loops,co,edges,verts):
 return [[Q(v) for v in verts[edges[co[cid]['edge']]['vertices'][0 if co[cid]['sense']=='forward' else 1]]['point']] for cid in loops[lid]['coedges']]
def xy_measure(polygons):
 area2=Q(0);mx6=Q(0);my6=Q(0)
 for points in polygons:
  for a,b in zip(points,points[1:]+points[:1]):
   turn=a[0]*b[1]-b[0]*a[1];area2+=turn;mx6+=(a[0]+b[0])*turn;my6+=(a[1]+b[1])*turn
 need(area2>0,'positive oriented horizontal material area');return area2/2,[mx6/(3*area2),my6/(3*area2)]
def expected(p):
 need(set(p)=={'width','wall'} and all(isinstance(p[k],(int,float)) and not isinstance(p[k],bool) for k in p),'exact finite parameter fields');w,t=p['width'],p['wall'];need((w,t) in [(80,3),(60,3),(60,2),(70,2)],'only retained S and three declared new A/B/C states')
 cavity=(Q(w)-2*Q(t))*(40-2*Q(t))*(10-Q(t));volume=400*Q(w)-cavity;cz=(2000*Q(w)-cavity*(10+Q(t))/2)/volume;cx=Q(w)/2-20
 return {'volume':float(volume),'massDensity1':float(volume/1000),'centroid':[float(cx),0,float(cz)],'bounds':{'min':[-20,-20,0],'max':[w-20,20,10]},'cavityBounds':{'min':[-20+t,-20+t,t],'max':[w-20-t,20-t,10]},'parentTop':{'area':40*w,'centroid':[float(cx),0,10]},'rimArea':40*w-(w-2*t)*(40-2*t),'floorArea':(w-2*t)*(40-2*t),'genus':0,'exact':{'volume':str(volume),'centroid':[str(cx),'0',str(cz)],'removedCavityVolume':str(cavity)}}
def inside(point,w,t,label):
 need(-20-L<=point[0]<=w-20+L and -20-L<=point[1]<=20+L and -L<=point[2]<=10+L,label+' literal stock bounds')
 need(not(point[2]>t+L and -20+t+L<point[0]<w-20-t-L and -20+t+L<point[1]<20-t-L),label+' no material boundary inside open cavity')
def parent_top(rd,doc,features,exp):
 ob=rd['parentObservation'];need(ob['authority']=='OBSERVER_DERIVED_SAME_ACTUAL_SOURCE_PREFIX_BEFORE_SHELL','explicit derived-source observer authority')
 wanted=copy.deepcopy(doc);wanted['nodes']=wanted['nodes'][:2];wanted['outputs']={'b1':{'node':1,'side':'solid'}};text=ob['documentJSON'];need(json.loads(text)==wanted and hashlib.sha256(text.encode()).hexdigest()==ob['documentSHA256'],'derived prefix exact original source, no alternate final fixture')
 need(ob['partDocument']=={'format':'barocss-cad-part','version':1,'units':'mm','parameters':{},'features':features[:2]} and len(ob['outputs'])==1,'derived native source feature/input ownership');raw=ob['outputs'][0];need(raw['outputId']=='n1' and raw['bodyKey']=='b1' and raw['nativeBodyCount']==1,'current native parent owner')
 bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'original derived parent BRep bytes/hash');need(raw['defaultCheck']['valid'] and raw['strict']['valid'] and raw['strict']['issues']==[],'derived parent strict validity');bounds(raw['bounds'],exp['bounds'],'current native parent bounds')
 b=raw['brep'];faces=[f for f in b['faces'] if f.get('name')=='n1.top'];need(len(faces)==1 and len(faces[0]['loops'])==1,'one current full parent top, not the Shell annular rim');f=faces[0];loops={v['id']:v for v in b['loops']};co={v['id']:v for v in b['coedges']};edges={v['id']:v for v in b['edges']};verts={v['id']:v for v in b['vertices']};points=loop_points(f['loops'][0],loops,co,edges,verts)
 need(len(points)==4,'actual parent rectangular top boundary');area,c=xy_measure([points]);near(float(area),exp['parentTop']['area'],'independent original parent cap area');vec([float(c[0]),float(c[1]),10],exp['parentTop']['centroid'],'independent original parent cap centroid')
 bounds(bbox([[float(v) for v in pp] for pp in points]),{'min':[-20,-20,10],'max':[doc['nodes'][0]['max'][0],20,10]},'current full parent top trimmed extent')
 g=next(v['geometry'] for v in raw['faces'] if v['id']==f['id']);need(g['kind']=='plane','parent top original plane');vec(g['n'],[0,0,1],'parent top native normal');near(g['o'][2],10,'parent top native support')
 need(len(raw['displayTop'])==1,'current parent display name mapping');display=raw['displayTop'][0];near(display['area'],float(area),'display observer versus independent parent trim area');vec(display['centroid'],exp['parentTop']['centroid'],'display observer versus independent parent trim centroid');vec(display['normal'],[0,0,1],'parent display normal')
 return {'authority':ob['authority'],'documentSHA256':ob['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'currentTopAreaExact':str(area),'currentTopCentroidExact':[str(c[0]),str(c[1]),'10'],'storedSignatureRole':'Historical identity anchor retained by ordinary NodeEditor policy; not a current measurement.'}
def geometry(raw,p,exp):
 w,t=p['width'],p['wall'];b=raw['brep'];need(finite(b),'finite original BRep');keys=['bodies','shells','faces','loops','coedges','edges','vertices'];tab={k:{v['id']:v for v in b[k]} for k in keys};need(all(len(tab[k])==len(b[k]) for k in keys),'unique original entity IDs')
 need(len(b['bodies'])==len(b['shells'])==1,'one native body/shell');body,shell=b['bodies'][0],b['shells'][0];faces,loops,co,edges,verts=[tab[k] for k in keys[2:]];need(body['kind']=='solid' and shell['closed'] and set(body['shells'])==set(tab['shells']) and shell['body']==body['id'] and set(shell['faces'])==set(faces),'complete closed original solid')
 edgepoints={};max_endpoint=0.;max_lift=0.;pcurve_count=0;owned_loops=[];owned_co=[];graph={fid:set() for fid in faces};cap=1e-3*max(1,max(abs(x) for v in verts.values() for x in v['point']))
 for v in verts.values(): need(0<v['tolerance']<=cap,'unchanged strict vertex tolerance cap')
 for e in edges.values():
  need(0<e['tolerance']<=cap and len(e['vertices'])==2 and all(v in verts for v in e['vertices']),'original edge endpoints/tolerance');a,z=domain(e['curve']);pts=[line(e['curve'],a+(z-a)*i/8) for i in range(9)];edgepoints[e['id']]=pts
  for pp,vid in zip([pts[0],pts[-1]],e['vertices']): gap=math.dist(pp,verts[vid]['point']);max_endpoint=max(max_endpoint,gap);near(gap,0,'independent original line endpoint',min(L,e['tolerance']))
 for f in faces.values():
  need(f['shell']==shell['id'] and f['loops'],'face/shell reciprocity');owned_loops+=f['loops']
  for lid in f['loops']:
   lp=loops[lid];need(lp['face']==f['id'] and lp['coedges'],'face/loop reciprocity');owned_co+=lp['coedges']
   for j,cid in enumerate(lp['coedges']):
    c=co[cid];nxt=co[lp['coedges'][(j+1)%len(lp['coedges'])]];need(c['loop']==lid and c['next']==nxt['id'] and c['prev']==lp['coedges'][j-1],'original ordered loop');need(edges[c['edge']]['vertices'][1 if c['sense']=='forward' else 0]==edges[nxt['edge']]['vertices'][0 if nxt['sense']=='forward' else 1],'original directed loop continuity')
 for c in co.values():
  other=co[c['twin']];need(other['twin']==c['id'] and other['edge']==c['edge'] and other['sense']!=c['sense'],'original closed opposed twins');graph[loops[c['loop']]['face']].add(loops[other['loop']]['face'])
  if c.get('pcurve') is not None:
   pcurve_count+=1;e=edges[c['edge']];need(domain(c['pcurve'])==domain(e['curve']),'original pcurve domain');a,z=domain(e['curve'])
   for i in range(5):
    tt=a+(z-a)*i/4;uv=line(c['pcurve'],tt);lift=planar_d1(faces[loops[c['loop']]['face']]['surface'],uv[0],uv[1])[0];gap=math.dist(lift,line(e['curve'],tt));max_lift=max(max_lift,gap);near(gap,0,'original optional pcurve lift',min(L,e['tolerance']))
 need(len(owned_loops)==len(loops) and set(owned_loops)==set(loops) and len(owned_co)==len(co) and set(owned_co)==set(co),'all original loops/coedges owned exactly once')
 for eid in edges: need(sum(c['edge']==eid for c in co.values())==2,'two original coedges per closed edge')
 need(set(v for e in edges.values() for v in e['vertices'])==set(verts),'no orphan vertices');seen=set();todo=[next(iter(faces))]
 while todo:
  fid=todo.pop()
  if fid not in seen: seen.add(fid);todo+=list(graph[fid]-seen)
 need(seen==set(faces),'one connected original Shell boundary');chi=len(verts)-len(edges)+2*len(faces)-len(loops);need(chi==2,'independent genus0 open-top cup boundary')
 x0,x1,y0,y1=-20+t,w-20-t,-20+t,20-t
 roles={
  'outer-xmin':([-1,0,0],[-20,0,0],{'min':[-20,-20,0],'max':[-20,20,10]}),
  'outer-xmax':([1,0,0],[w-20,0,0],{'min':[w-20,-20,0],'max':[w-20,20,10]}),
  'outer-ymin':([0,-1,0],[0,-20,0],{'min':[-20,-20,0],'max':[w-20,-20,10]}),
  'outer-ymax':([0,1,0],[0,20,0],{'min':[-20,20,0],'max':[w-20,20,10]}),
  'bottom':([0,0,-1],[0,0,0],{'min':[-20,-20,0],'max':[w-20,20,0]}),
  'rim':([0,0,1],[0,0,10],{'min':[-20,-20,10],'max':[w-20,20,10]}),
  'floor':([0,0,1],[0,0,t],{'min':[x0,y0,t],'max':[x1,y1,t]}),
  'inner-xmin':([1,0,0],[x0,0,0],{'min':[x0,y0,t],'max':[x0,y1,10]}),
  'inner-xmax':([-1,0,0],[x1,0,0],{'min':[x1,y0,t],'max':[x1,y1,10]}),
  'inner-ymin':([0,1,0],[0,y0,0],{'min':[x0,y0,t],'max':[x1,y0,10]}),
  'inner-ymax':([0,-1,0],[0,y1,0],{'min':[x0,y1,t],'max':[x1,y1,10]})}
 role_points={k:[] for k in roles};horizontal={k:[] for k in ['rim','floor']};carriers=[];smap={s['id']:s for s in raw['surfaces']};need(len(smap)==len(raw['surfaces'])==len(faces) and set(smap)==set(faces),'all original carrier observations');max_carrier=0.;max_point=0.;max_d1=0.;max_normal=0.
 for f in faces.values():
  ob=smap[f['id']];g=ob['geometry'];need(g['kind']=='plane','only finite declared planar carriers');ps=[pp for lid in f['loops'] for cid in loops[lid]['coedges'] for pp in edgepoints[co[cid]['edge']]]
  for pp in ps: inside(pp,w,t,'actual material trim')
  found=[role for role,(n,o,bb) in roles.items() if max(abs(a-z) for a,z in zip(g['n'],n))<=L and abs(dot(n,sub(g['o'],o)))<=L and all(all(bb['min'][j]-L<=pp[j]<=bb['max'][j]+L for j in range(3)) for pp in ps)]
  need(len(found)==1,'one nominal physical carrier/trim role');role=found[0];n,o,_=roles[role];role_points[role]+=ps
  if role in horizontal: horizontal[role]+=[loop_points(lid,loops,co,edges,verts) for lid in f['loops']]
  for pp in ps: gap=abs(dot(n,sub(pp,o)));max_carrier=max(max_carrier,gap);near(gap,0,'independent nominal trimmed support')
  for q in ob['probe']['probes']:
   pp,du,dv=planar_d1(f['surface'],q['u'],q['v']);vec(q['point'],pp,'independent original plane point');vec(q['du'],du,'independent original plane du');vec(q['dv'],dv,'independent original plane dv');nn=unit(cross(du,dv));nn=[v*(1 if f['sense']=='forward' else -1) for v in nn];vec(nn,n,'independent outward nominal normal');vec(q['normal'],nn,'observed native normal');need(q['normalNorm']>0,'nondegenerate native derivative');near(dot(n,sub(pp,o)),0,'independent full plane support');max_point=max(max_point,max(abs(a-z) for a,z in zip(q['point'],pp)));max_d1=max(max_d1,max(abs(a-z) for a,z in zip(q['du']+q['dv'],du+dv)));max_normal=max(max_normal,max(abs(a-z) for a,z in zip(nn,n)))
  carriers.append({'face':f['id'],'name':f.get('name'),'role':role})
 for role,ps in role_points.items(): need(ps,'all outer/cavity/floor/rim roles '+role);bounds(bbox(ps),roles[role][2],'complete actual nominal trimmed extent '+role)
 areas={}
 for role in horizontal:
  area,center=xy_measure(horizontal[role]);near(float(area),exp['rimArea'] if role=='rim' else exp['floorArea'],'independent exact horizontal '+role+' area');vec([float(center[0]),float(center[1])],[w/2-20,0],'independent horizontal '+role+' centroid');areas[role]=str(area)
 ep={e['id']:e for e in raw['edgeProbes']};need(len(ep)==len(raw['edgeProbes'])==len(edges) and set(ep)==set(edges),'all original line observations');max_edge=0.
 for eid,e in edges.items():
  a,z=domain(e['curve']);ob=ep[eid]['probe'];need(ob['domain']==[a,z] and len(ob['samples'])==9,'native original line domain/stations')
  for i,pp in enumerate(ob['samples']):
   actual=line(e['curve'],a+(z-a)*i/8);vec(pp,actual,'independent original line');max_edge=max(max_edge,max(abs(a-z) for a,z in zip(pp,actual)))
 rims=[]
 for label,(a,z,c,d,level) in {'outer-opening':(-20,w-20,-20,20,10),'inner-opening':(x0,x1,y0,y1,10),'floor-boundary':(x0,x1,y0,y1,t)}.items():
  points=[];length=0.
  for e in edges.values():
   ps=edgepoints[e['id']]
   if all(abs(pp[2]-level)<=L and a-L<=pp[0]<=z+L and c-L<=pp[1]<=d+L and (abs(pp[0]-a)<=L or abs(pp[0]-z)<=L or abs(pp[1]-c)<=L or abs(pp[1]-d)<=L) for pp in ps): points+=ps;length+=math.dist(ps[0],ps[-1])
  need(points,'complete opening/floor trim '+label);bounds(bbox(points),{'min':[a,c,level],'max':[z,d,level]},'nominal opening/floor extent '+label);near(length,2*((z-a)+(d-c)),'nominal closed rectangular perimeter '+label)
  for xx,yy in [(a,c),(z,c),(z,d),(a,d)]: need(any(max(abs(v-ww) for v,ww in zip(pp,[xx,yy,level]))<=L for pp in points),'all nominal rectangular corners '+label)
  rims.append({'role':label,'perimeterMM':length})
 bounds(bbox([v['point'] for v in verts.values()]+[pp for ps in edgepoints.values() for pp in ps]),exp['bounds'],'complete original native material bounds')
 volume=Q(0);first=[Q(0)]*3
 for f in faces.values():
  for lid in f['loops']:
   points=loop_points(lid,loops,co,edges,verts);need(len(points)>=3,'original polygon loop corners')
   for i in range(1,len(points)-1):
    tri=[points[0],points[i],points[i+1]];v=dot(tri[0],cross(tri[1],tri[2]))/6;volume+=v;first=[old+v*sum(pp[j] for pp in tri)/4 for j,old in enumerate(first)]
 need(volume>0,'positive original oriented boundary volume');near(float(volume),exp['volume'],'original exact boundary vs literal box-minus-cavity volume',L*exp['volume']);vec([float(v/volume) for v in first],exp['centroid'],'original exact boundary vs literal centroid')
 return {'counts':{k:len(b[k]) for k in keys},'genus':0,'eulerCharacteristic':chi,'carriers':carriers,'rims':rims,'horizontalAreasExact':areas,'pcurveCount':pcurve_count,'pcurvePresence':'ORIGINAL_OPTIONAL_FIELDS_ONLY','maximumEndpointGapMM':max_endpoint,'maximumPcurveLiftGapMM':max_lift,'maximumCarrierResidualMM':max_carrier,'maximumIndependentProbePointGapMM':max_point,'maximumIndependentD1ComponentGapMM':max_d1,'maximumIndependentEdgeProbeGapMM':max_edge,'maximumOutwardNormalComponentError':max_normal,'exactOriginalBoundaryIntegrals':{'volume':str(volume),'centroid':[str(v/volume) for v in first]},'proofBoundary':'Only declared straight planar Shell, complete original graph/trim traversal and rational boundary integrals; no generic Shell/offset theorem.'}
def run(x):
 p=x['parameters'];exp=expected(p);doc=x['doc'];rd=x['read'];text=x.get('documentJSON',rd['documentJSON']);need(len(SEED_TEXT.encode())==582 and hashlib.sha256(SEED_TEXT.encode()).hexdigest()==SEED_SHA,'exact retained actual D449 seed bytes/hash');seed=json.loads(SEED_TEXT);need(x['seedDoc']==seed,'caller exact retained antecedent')
 wanted=copy.deepcopy(seed);w,t=p['width'],p['wall'];wanted['nodes'][0]['max'][0]=w-20;wanted['nodes'][0]['outline']['points']=[[-20,-20],[w-20,-20],[w-20,20],[-20,20]];wanted['nodes'][0]['outline']['lengths']['0']=w;wanted['nodes'][2]['thickness']=t
 need(doc==wanted==x['expectedDoc'],'only anchored compact/outline/driving width and Wall change; original constraints/tags/IDs/parent/open/historical signature/b2/nextId retained')
 need(rd['ok'] is True and rd['status']=='CAPTURED' and rd['inputUnchanged'] is True and rd['documentJSON']==text and json.loads(text)==doc==rd['reader']['doc'] and rd['reader']['notes']==[],'exact actual whole Doc/native reader binding');need(hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256'] and rd['request']['parameters']==p,'original actual Doc hash and request binding')
 need(len(rd['outputs'])==1 and rd['target']==rd['outputs'][0] and rd['outputIds']==['n2'] and rd['bodyKey']=='b2' and rd['outputId']=='n2' and rd['nativeBodyCount']==1,'all outputs then sole original n2/b2 owner');raw=rd['outputs'][0];need(raw['outputId']=='n2' and raw['bodyKey']=='b2' and raw['nativeBodyCount']==1,'original physical owner');bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'original native JS BRep bytes/hash, no Python reserialization')
 native=rd['native'];need(native['nativeBRepJSON']==bj and native['nativeBRepSHA256']==raw['nativeBRepSHA256'] and native['documentSHA256']==rd['documentSHA256'] and native['mass']==raw['massProperties'] and rd['mass']==raw['massProperties'] and rd['brepMass']==raw['brepMass'] and rd['bounds']==raw['bounds'],'original native aliases')
 features=[{'id':'n0','kind':'sketch','profile':'rectangle','min':[-20,-20],'max':[w-20,20],'sideTags':{'outer':['e1','e2','e3','e4']}},{'id':'n1','kind':'extrude','sketch':'n0','height':10},{'id':'n2','kind':'shell','target':'n1','thickness':t,'open':['n1.top'],'expect':{'n1.top':{'kind':'plane','at':[20,0,10],'dir':[0,0,1],'size':3200}}}]
 need(rd['partDocument']=={'format':'barocss-cad-part','version':1,'units':'mm','parameters':{},'features':features} and rd['kernelShell']==features[-1],'native actual constrained-source geometry and original historical opening identity anchor')
 for key in ['defaultCheck','strict','outputCheck']:
  ck=raw[key];need(ck['valid'] is True and ck['issues']==[] and len(ck['topology'])==1 and ck['topology'][0]['genus']==0,'unchanged native '+key)
 need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'explicit public MMGS at density1g/cm3');bounds(raw['bounds'],exp['bounds'],'native boundary-aware material bounds');errors={}
 for key in ['massProperties','brepMass']:
  m=raw[key];need(finite(m) and m['method'] in ['closed-form','planar-exact'],'selected nonmesh planar native mass');near(m['volume'],exp['volume'],key+' independent literal volume',L*exp['volume']);near(m['mass'],exp['massDensity1'],key+' literal density1 grams');vec(m['centroid'],exp['centroid'],key+' literal centroid');errors[key]={'volumeRelative':abs(m['volume']-exp['volume'])/exp['volume'],'centroidAbsoluteMM':max(abs(a-b) for a,b in zip(m['centroid'],exp['centroid']))}
 geo=geometry(raw,p,exp);parent=parent_top(rd,doc,features,exp);worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ADMISSION'
 if x.get('consumer') is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True,'original exact fresh Studio Doc');ww=c['worker'];need(ww['fresh'] is True and ww['massReady'] is True and len(ww['bodies'])==1 and ww['bodies'][0]['key']=='b2','fresh current Worker n2/b2');body=ww['bodies'][0];near(body['volume'],exp['volume'],'current Worker literal volume',L*exp['volume']);vec(body['centroid'],exp['centroid'],'current Worker literal centroid');near(body['volume'],raw['massProperties']['volume'],'current Worker/native volume',L*exp['volume']);vec(body['centroid'],raw['massProperties']['centroid'],'current Worker/native centroid');worker='PASS_ORIGINAL_FRESH_STUDIO_DOC_WORKER'
 return {'status':'PASS_ONE_DECLARED_D535_SHELL_WIDTH_STATE','parameters':p,'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'expected':exp,'massErrors':errors,'geometry':geo,'currentParentObservation':parent,'worker':worker,'budgets':{'volumeRelative':L,'centroidBoundsBoundaryCarrierD1EndpointPcurveAbsoluteMM':L,'unitNormalComponent':L,'density1MassAbsoluteG':L},'limits':['Only retained S80/3 and three declared new A60/3,B60/2,C70/2 open-top rectangular Shell states; no creation replay.','Stored signature remains the historical identity anchor under the existing ordinary NodeEditor policy. Current parent geometry is observed and independently checked separately.','Actual public refusal/FIRST Undo/Redo/project/re-edit require their own fresh Studio bindings. No general Shell, public thicken, fitter, #2266, inertia, full viewport fit, manufacturing, mobile or release claim.']}
if __name__=='__main__':
 try: print(json.dumps(run(json.load(sys.stdin)),indent=2,allow_nan=False))
 except Exception as exc: print(json.dumps({'status':'FAIL_D535_DECLARED_SHELL_WIDTH','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
