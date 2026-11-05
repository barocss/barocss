// D547: retained reverse Subtract, original-parent Corner X lifecycle only.
// Numerical author: Sol High. Root owns all executions, source freeze and custody.
// Importing this module runs no evaluator, test, Python or browser.
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const seedPath='/tmp/barocss-d452-workflow-run02/reverse-difference-created.bcad';
export const seedBytes=742;
export const seedSHA256='33939ab021eb196e3fe8177b633ca2ba0767e79bfd03bcaf1ea728cffe9bbde4';
export const seedJSON="{\"format\":\"barocss-cad-model\",\"schema\":3,\"units\":\"mm\",\"parameters\":{},\"nodes\":[{\"kind\":\"sketch\",\"profile\":\"rectangle\",\"min\":[-20,-20],\"max\":[60,20],\"outline\":{\"points\":[[-20,-20],[60,-20],[60,20],[-20,20]],\"lengths\":{\"0\":80,\"1\":40},\"hv\":{\"h\":[0,2],\"v\":[1,3]}},\"sideTags\":{\"outer\":[\"e1\",\"e2\",\"e3\",\"e4\"]},\"id\":\"n0\"},{\"kind\":\"extrude\",\"sketch\":0,\"height\":10,\"id\":\"n1\"},{\"kind\":\"sketch\",\"profile\":\"rectangle\",\"min\":[40,-10],\"max\":[80,10],\"sideTags\":{\"outer\":[\"e1\",\"e2\",\"e3\",\"e4\"]},\"id\":\"n2\"},{\"kind\":\"extrude\",\"sketch\":2,\"height\":10,\"id\":\"n3\"},{\"kind\":\"difference\",\"parent\":{\"node\":3,\"side\":\"solid\"},\"tool\":{\"node\":1,\"side\":\"solid\"},\"id\":\"n4\"}],\"outputs\":{\"b4\":{\"node\":4,\"side\":\"solid\"}},\"nextId\":5,\"bodies\":{\"b1\":{\"name\":\"A\"},\"b3\":{\"name\":\"B\"}}}";
export const seedText=seedJSON;
export const seedDoc=JSON.parse(seedJSON);
const b=JSON.parse(seedJSON);b.nodes[2].min[0]=36;b.nodes[2].max[0]=76;
const state=(doc,minX)=>({doc,documentJSON:JSON.stringify(doc),documentSHA256:sha(JSON.stringify(doc)),parameters:{minX}});
export const states={A:state(JSON.parse(seedJSON),40),B:state(b,36)};
export const oracleStatus='PASS_ONE_DECLARED_D547_REVERSE_SUBTRACT_STATE';
export const config={workId:'D547',sourceOrigin:'RETAINED_D452_ACTUAL_ORDERED_REVERSE_SUBTRACT_CREATION',seedPath,seedBytes,seedSHA256,states,
 fields:{B:{index:3,key:'c0',label:'Corner X',from:40,value:36},postA:{index:3,key:'c0',label:'Corner X',from:36,value:40}},
 guard:{index:3,key:'h',label:'Distance',value:0,sourceClass:'B',expectedCode:'PARAMETER',expectedFeature:'n3',reason:'height must not be zero',expectedMessage:'n3: height must not be zero'},
 groups:['retained-A-current-Open','original-parent-Corner36','Distance0-refused-Apply-retains-B','FIRST-document-Undo-A','document-Redo-B','own-project-Save-B','same-context-reload-Open-B','postOpen-Corner40-A'],
 counts:{consumerGroups:8,currentWorkerPythonJoins:8,freshNativePositiveClasses:2,separateNegativeControls:1},
 limits:['Retained public creation, no source/Boolean creation replay.','Only two reversed original-parent source states; no general Boolean/empty/Keep/contact claim.','Historical native packets cannot be reused after source drift. Every Studio join needs fresh Worker and new Python.','Same-context reload, not cold-process restart; no mobile/full-fit/manufacturing/release claim.']};
export const builderFiles=['apps/cad-studio/test/reverse-subtract-oracles.mjs'];
export const retainedFiles=[seedPath,'/tmp/barocss-d452-workflow-run01/receipt.json','/tmp/barocss-d452-workflow-run02/receipt.json','/tmp/barocss-d452-workflow-run02/source-frozen.json','/tmp/barocss-d452-geometry/boolean-oracle.py'];
export const inputFiles=[...retainedFiles,'apps/cad-studio/handover/notes/ordinary-booleans-2026-11-03/README.md','apps/cad-studio/handover/notes/ordinary-booleans-2026-11-03/qualification.json'];
export const historicalAuthority={run01:{path:retainedFiles[1],sha256:'0ad78a5b4b30d204ae0b013d925695893b8edbcf4b6bd8489430ae19f574ba61',status:'FAIL_RETAINED_HELPER_VERSIONS_PANEL_AFTER_PASSING_SUBTRACT_AND_INTERSECT_PREFIX'},run02:{path:retainedFiles[2],sha256:'8627a7c72667101ccf9e09f95ba06902496b1b7685902e30d23f4c482f6c9c3d',status:'PASS_INTERSECT_COMPLETION_AND_REVERSE_CREATION_ONLY'},oldOracleSHA256:'8eb8aff46c6551b9675d661e212eee35d297ef19274b7bb8ab488ce02dd5414b',reuse:'SOURCE_AND_CREATION_PROVENANCE_ONLY_NO_HISTORICAL_NATIVE_REUSE'};
// Existing observer methods copied from D535: native public MMGS, original graph,
// rational line/surface derivatives and optional pcurves. No source-prefix evaluator.
export const inspectorSource=String.raw`
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readStudioDoc} from '../../packages/barocss-cad-model/src/engine/migrate.ts';
import {toPartDocument,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {evaluateCadPart,massPropertiesOf,brepMassProperties,checkBrep,checkOutput,faceGeometry,evaluateSurfaceD1,surfaceDomain,curveDomain,curveEvaluator} from '../../packages/barocss-cad/src/index.ts';
import {stepValidationBounds} from '../../packages/barocss-cad/src/brep/brep-bounds.ts';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const error=(e:any)=>({name:e?.name??null,code:e?.code??null,feature:e?.feature??null,message:String(e?.message??e)});
const safe=(fn:()=>any)=>{try{return fn();}catch(e){return {observationError:error(e)};}};
const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const capture=(out:any,nodes:any[])=>{const nativeBRepJSON=JSON.stringify(out.brep);return {outputId:out.id,bodyKey:bodyKeyOf(out.id,nodes),representation:out.representation,nativeBodyCount:out.bodyCount,brep:out.brep,nativeBRepJSON,nativeBRepSHA256:sha(nativeBRepJSON)};};
export function inspect(doc:any,request:any={}){
 const documentJSON=JSON.stringify(doc),documentSHA256=sha(documentJSON),reader=safe(()=>readStudioDoc(documentJSON));
 let partDocument:any=null;const outputs:any[]=[];
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
  const target=outputs.length===1?outputs[0]:null,native=target?{...target,documentSHA256,mass:target.massProperties,check:target.strict}:null;
  return {ok:true,status:request.pickOnly?'ANTECEDENT_OBSERVATION_ONLY':'CAPTURED',request,documentJSON,documentSHA256,inputUnchanged:JSON.stringify(doc)===documentJSON,reader,partDocument,outputs,outputIds:outputs.map(o=>o.outputId),target,native,bodyCount:outputs.length,bodyKey:target?.bodyKey??null,outputId:target?.outputId??null,nativeBodyCount:target?.nativeBodyCount??null,mass:target?.massProperties??null,brepMass:target?.brepMass??null,bounds:target?.bounds??null,kernelDifference:partDocument.features.find((f:any)=>f.id==='n4')??null};
 }catch(e){return {ok:false,status:'FAIL_CAPTURE_READINESS',request,documentJSON,documentSHA256,inputUnchanged:JSON.stringify(doc)===documentJSON,reader,partDocument,outputs,error:error(e)};}
}
const inputFile=process.argv[2],inputBytes=readFileSync(inputFile,'utf8');
console.log(JSON.stringify({...inspect(JSON.parse(inputBytes),JSON.parse(process.argv[3]??'{}')),inputPath:inputFile,inputBytes,inputSHA256:sha(inputBytes)}));
`;
// Independent Python imports only the standard library. Source constraints and
// exact Fraction boundary integrals are independent of native mass/mesh reports.
export const oracleSource=String.raw`
import copy, hashlib, itertools, json, math, sys, traceback
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
def no_errors(v,label):
 if isinstance(v,dict):
  need('observationError' not in v,label+' no hidden observer error')
  for k,w in v.items(): no_errors(w,label+'.'+k)
 elif isinstance(v,list):
  for i,w in enumerate(v): no_errors(w,label+'.'+str(i))
def expected(parameters):
 need(set(parameters)=={'minX'} and type(parameters['minX']) in (int,float) and parameters['minX'] in (40,36),'only declared reverse parent minX40/36')
 b=Q(parameters['minX']);v=200*(b-20)
 return {'volume':float(v),'massDensity1':float(v/1000),'centroid':[float((b+100)/2),0,5],'bounds':{'min':[60,-10,0],'max':[float(b+40),10,10]},'exact':{'remainingWidth':str(b-20),'volume':str(v),'centroid':[str((b+100)/2),'0','5']}}
def geometry(raw,exp):
 b=raw['brep'];need(finite(b),'finite original BRep');keys=['bodies','shells','faces','loops','coedges','edges','vertices'];counts={k:len(b[k]) for k in keys}
 need(counts==dict(zip(keys,[1,1,6,6,24,12,8])),'only declared six-plane box topology')
 tab={k:{v['id']:v for v in b[k]} for k in keys};need(all(len(tab[k])==len(b[k]) for k in keys),'unique original entity IDs')
 body,shell=b['bodies'][0],b['shells'][0];faces,loops,co,edges,verts=[tab[k] for k in keys[2:]]
 need(body['kind']=='solid' and shell['closed'] is True and body['shells']==[shell['id']] and shell['body']==body['id'] and len(shell['faces'])==6 and set(shell['faces'])==set(faces),'complete one original closed solid')
 lo,hi=exp['bounds']['min'],exp['bounds']['max'];corners=list(itertools.product(*zip(lo,hi)))
 for point in corners: need(sum(max(abs(a-z) for a,z in zip(v['point'],point))<=L for v in verts.values())==1,'each independent nominal corner exactly once')
 for v in verts.values(): need(any(max(abs(a-z) for a,z in zip(v['point'],point))<=L for point in corners),'no unexpected original vertex')
 cap=1e-3*max(1,max(abs(x) for v in verts.values() for x in v['point']));ep={};max_endpoint=0.;max_lift=0.;pc=0
 for v in verts.values(): need(0<v['tolerance']<=cap,'unchanged strict original vertex tolerance cap')
 for e in edges.values():
  need(0<e['tolerance']<=cap and len(e['vertices'])==2 and len(set(e['vertices']))==2 and all(v in verts for v in e['vertices']),'original edge endpoints/tolerance')
  a,z=domain(e['curve']);points=[line(e['curve'],a+(z-a)*i/8) for i in range(9)];ep[e['id']]=points
  for pp,vid in zip([points[0],points[-1]],e['vertices']):
   gap=math.dist(pp,verts[vid]['point']);max_endpoint=max(max_endpoint,gap);near(gap,0,'independent line endpoint',min(L,e['tolerance']))
  need(sum(abs(v-w)>L for v,w in zip(points[0],points[-1]))==1,'nominal axis-parallel straight edge')
  need(all(all(lo[j]-L<=p[j]<=hi[j]+L for j in range(3)) for p in points),'original edge samples inside literal bounds')
 owned_loops=[];owned_co=[];graph={fid:set() for fid in faces}
 for f in faces.values():
  need(f['shell']==shell['id'] and len(f['loops'])==1 and f['sense'] in ('forward','reversed'),'original face ownership and orientation');owned_loops+=f['loops']
  for lid in f['loops']:
   lp=loops[lid];need(lp['face']==f['id'] and len(lp['coedges'])==4 and len(set(lp['coedges']))==4,'one original rectangular face loop');owned_co+=lp['coedges']
   for j,cid in enumerate(lp['coedges']):
    c=co[cid];nxt=co[lp['coedges'][(j+1)%4]];need(c['loop']==lid and c['sense'] in ('forward','reversed') and c['next']==nxt['id'] and c['prev']==lp['coedges'][j-1],'original ordered coedge cycle')
    need(edges[c['edge']]['vertices'][1 if c['sense']=='forward' else 0]==edges[nxt['edge']]['vertices'][0 if nxt['sense']=='forward' else 1],'original directed loop closure')
 for c in co.values():
  other=co[c['twin']];need(other['twin']==c['id'] and other['edge']==c['edge'] and other['sense']!=c['sense'],'original opposed closed twins');graph[loops[c['loop']]['face']].add(loops[other['loop']]['face'])
  if c.get('pcurve') is not None:
   pc+=1;e=edges[c['edge']];need(domain(c['pcurve'])==domain(e['curve']),'original optional pcurve domain');a,z=domain(e['curve'])
   for i in range(5):
    t=a+(z-a)*i/4;uv=line(c['pcurve'],t);lift=planar_d1(faces[loops[c['loop']]['face']]['surface'],uv[0],uv[1])[0];gap=math.dist(lift,line(e['curve'],t));max_lift=max(max_lift,gap);near(gap,0,'finite original optional UV lift',min(L,e['tolerance']))
 need(len(owned_loops)==len(loops) and set(owned_loops)==set(loops) and len(owned_co)==len(co) and set(owned_co)==set(co),'every original loop/coedge owned once')
 for eid in edges: need(sum(c['edge']==eid for c in co.values())==2,'two coedges per original closed edge')
 need(set(v for e in edges.values() for v in e['vertices'])==set(verts),'all original vertices used');seen=set();todo=[next(iter(faces))]
 while todo:
  fid=todo.pop()
  if fid not in seen: seen.add(fid);todo+=list(graph[fid]-seen)
 need(seen==set(faces),'connected original box boundary');chi=len(verts)-len(edges)+2*len(faces)-len(loops);need(chi==2,'independent Euler genus0')
 observations={v['id']:v for v in raw['surfaces']};need(len(observations)==len(raw['surfaces'])==6 and set(observations)==set(faces),'all original surface observations')
 roles={};role_rows=[];maximum_carrier=0.;maximum_point=0.;maximum_d1=0.;maximum_normal=0.;volume=Q(0);first=[Q(0)]*3
 names={(0,0):'n1.side[e2]',(0,1):'n3.side[e2]',(1,0):'n3.side[e1]',(1,1):'n3.side[e3]',(2,0):'n3.bottom',(2,1):'n3.top'}
 for f in faces.values():
  ob=observations[f['id']];g=ob['geometry'];need(g['kind']=='plane','only nominal original planar carriers');points=loop_points(f['loops'][0],loops,co,edges,verts);fp=[[float(v) for v in p] for p in points]
  candidates=[(axis,side) for axis in range(3) for side in (0,1) if all(abs(p[axis]-(lo if side==0 else hi)[axis])<=L for p in fp)]
  need(len(candidates)==1,'one nominal plane role');axis,side=candidates[0];need((axis,side) not in roles,'one face per nominal box side');roles[(axis,side)]=f['id'];normal=[0,0,0];normal[axis]=-1 if side==0 else 1
  need(f.get('name')==names[(axis,side)],'original target/tool cut-face ownership');vec(g['n'],normal,'original native outward normal');near(g['o'][axis],(lo if side==0 else hi)[axis],'original native carrier offset')
  bounds(bbox(fp),{'min':[lo[j] if j!=axis else (lo if side==0 else hi)[axis] for j in range(3)],'max':[hi[j] if j!=axis else (lo if side==0 else hi)[axis] for j in range(3)]},'complete nominal rectangular face trim')
  signed_area=Q(0)
  for j in range(1,len(points)-1):
   tri=[points[0],points[j],points[j+1]];cr=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]));signed_area+=dot(cr,normal)/2;v=dot(tri[0],cross(tri[1],tri[2]))/6;volume+=v;first=[old+v*sum(pp[k] for pp in tri)/4 for k,old in enumerate(first)]
  face_area=math.prod(hi[k]-lo[k] for k in range(3) if k!=axis);near(float(signed_area),face_area,'independent oriented exact face area')
  for lid in f['loops']:
   for cid in loops[lid]['coedges']:
    for pp in ep[co[cid]['edge']]:
     gap=abs(pp[axis]-(lo if side==0 else hi)[axis]);maximum_carrier=max(maximum_carrier,gap);near(gap,0,'nominal edge/plane trim')
  need(len(ob['probe']['probes'])==2,'two original surface stations')
  for station in ob['probe']['probes']:
   point,du,dv=planar_d1(f['surface'],station['u'],station['v']);vec(station['point'],point,'independent original rational plane point');vec(station['du'],du,'independent original du');vec(station['dv'],dv,'independent original dv');n=unit(cross(du,dv));n=[v*(1 if f['sense']=='forward' else -1) for v in n];vec(n,normal,'independent oriented plane normal');vec(station['normal'],n,'observed outward plane normal');need(station['normalNorm']>0,'nondegenerate original derivatives');near(point[axis],(lo if side==0 else hi)[axis],'independent carrier support')
   maximum_point=max(maximum_point,max(abs(a-z) for a,z in zip(station['point'],point)));maximum_d1=max(maximum_d1,max(abs(a-z) for a,z in zip(station['du']+station['dv'],du+dv)));maximum_normal=max(maximum_normal,max(abs(a-z) for a,z in zip(n,normal)))
  role_rows.append({'face':f['id'],'name':f['name'],'axis':axis,'side':side,'areaExact':str(signed_area)})
 need(len(roles)==6,'all nominal sides');obs_edges={e['id']:e for e in raw['edgeProbes']};need(len(obs_edges)==len(raw['edgeProbes'])==12 and set(obs_edges)==set(edges),'all original straight edge samples');maximum_edge=0.
 for eid,e in edges.items():
  a,z=domain(e['curve']);ob=obs_edges[eid]['probe'];need(ob['domain']==[a,z] and len(ob['samples'])==9,'original edge sample stations')
  for i,pp in enumerate(ob['samples']):
   point=line(e['curve'],a+(z-a)*i/8);vec(pp,point,'independent original rational line');maximum_edge=max(maximum_edge,max(abs(v-w) for v,w in zip(pp,point)))
 need(volume>0,'positive original exact oriented boundary volume');near(float(volume),exp['volume'],'exact boundary versus literal reverse box volume',L*exp['volume']);vec([float(v/volume) for v in first],exp['centroid'],'exact boundary versus literal reverse box centroid')
 bounds(bbox([v['point'] for v in verts.values()]),exp['bounds'],'all original box boundary extrema')
 return {'counts':counts,'genus':0,'eulerCharacteristic':chi,'carriers':role_rows,'exactOriginalBoundaryIntegrals':{'volume':str(volume),'centroid':[str(v/volume) for v in first]},'maximumEndpointGapMM':max_endpoint,'maximumCarrierResidualMM':maximum_carrier,'maximumIndependentProbePointGapMM':maximum_point,'maximumIndependentD1ComponentGapMM':maximum_d1,'maximumIndependentEdgeProbeGapMM':maximum_edge,'maximumOutwardNormalComponentError':maximum_normal,'pcurveCount':pc,'pcurveStatus':'EXERCISED_FINITE_ORIGINAL_UV_LIFTS' if pc else 'NOT_EXERCISED','maximumPcurveLiftGapMM':max_lift if pc else None,'proofBoundary':'Complete original box graph/trims and Fraction boundary integrals with finite rational point/D1/normal/optional UV witnesses; no full-domain/general Boolean theorem.'}
def run(x):
 exp=expected(x['parameters']);b=x['parameters']['minX'];need(len(SEED_TEXT.encode())==742 and hashlib.sha256(SEED_TEXT.encode()).hexdigest()==SEED_SHA,'exact retained D452 actual ordered creation seed bytes/hash');seed=json.loads(SEED_TEXT);need(x['seedDoc']==seed,'caller original retained seed');wanted=copy.deepcopy(seed);wanted['nodes'][2]['min'][0]=b;wanted['nodes'][2]['max'][0]=b+40
 doc=x['doc'];rd=x['read'];text=x.get('documentJSON',rd['documentJSON']);need(doc==wanted==x['expectedDoc'],'only original n3 parent source n2 CornerX translation; exact A locks/tags/n4parentn3/tooln1/outputb4/all extras retained')
 need(rd['ok'] is True and rd['status']=='CAPTURED' and rd['inputUnchanged'] is True and rd['documentJSON']==text and json.loads(text)==doc==rd['reader']['doc'] and rd['reader']['notes']==[],'exact captured actual Doc/read binding');need(hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256'] and rd['request']['parameters']==x['parameters'],'actual original Doc hash/request');no_errors(rd,'read')
 need(rd['outputIds']==['n4'] and rd['bodyCount']==1 and rd['bodyKey']=='b4' and rd['outputId']=='n4' and rd['nativeBodyCount']==1 and len(rd['outputs'])==1 and rd['target']==rd['outputs'][0],'all outputs then sole n4/b4 owner');raw=rd['outputs'][0];need(raw['outputId']=='n4' and raw['bodyKey']=='b4' and raw['nativeBodyCount']==1 and raw['representation'] in ('upright','planar'),'original native output owner')
 bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'exact original native BRep JS bytes/hash')
 features=[{'id':'n0','kind':'sketch','profile':'rectangle','min':[-20,-20],'max':[60,20],'sideTags':{'outer':['e1','e2','e3','e4']}},{'id':'n1','kind':'extrude','sketch':'n0','height':10},{'id':'n2','kind':'sketch','profile':'rectangle','min':[b,-10],'max':[b+40,10],'sideTags':{'outer':['e1','e2','e3','e4']}},{'id':'n3','kind':'extrude','sketch':'n2','height':10},{'id':'n4','kind':'difference','target':'n3','tool':'n1'}]
 need(rd['partDocument']=={'format':'barocss-cad-part','version':1,'units':'mm','parameters':{},'features':features} and rd['kernelDifference']==features[-1],'original raw source/compiled reversed target/tool exact')
 need(rd['native']==dict(raw,documentSHA256=rd['documentSHA256'],mass=raw['massProperties'],check=raw['strict']) and rd['mass']==raw['massProperties'] and rd['brepMass']==raw['brepMass'] and rd['bounds']==raw['bounds'],'same original native aliases')
 for key in ['defaultCheck','strict','outputCheck']:
  ck=raw[key];need(ck['valid'] is True and ck['issues']==[] and len(ck['topology'])==1 and ck['topology'][0]['genus']==0,'unchanged native '+key)
 need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'explicit native public MMGS density1g/cm3');bounds(raw['bounds'],exp['bounds'],'native original boundary-aware box bounds');errors={}
 for key in ['massProperties','brepMass']:
  m=raw[key];need(finite(m) and m['method'] in ('closed-form','planar-exact'),'nonmesh planar native mass');near(m['volume'],exp['volume'],key+' literal reverse volume',L*exp['volume']);near(m['mass'],exp['massDensity1'],key+' density1grams');vec(m['centroid'],exp['centroid'],key+' literal reverse centroid');errors[key]={'volumeRelative':abs(m['volume']-exp['volume'])/exp['volume'],'massAbsoluteG':abs(m['mass']-exp['massDensity1']),'centroidAbsoluteMM':max(abs(a-z) for a,z in zip(m['centroid'],exp['centroid']))}
 geo=geometry(raw,exp);worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ONLY';worker_errors=None
 if x.get('consumer') is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True,'original exact current Studio Doc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==1 and w['bodies'][0]['key']=='b4','fresh current Worker n4/b4');body=w['bodies'][0];near(body['volume'],exp['volume'],'Worker literal reverse volume',L*exp['volume']);vec(body['centroid'],exp['centroid'],'Worker literal reverse centroid');near(body['volume'],raw['massProperties']['volume'],'Worker/native volume',L*exp['volume']);vec(body['centroid'],raw['massProperties']['centroid'],'Worker/native centroid');worker='PASS_ORIGINAL_FRESH_STUDIO_DOC_WORKER';worker_errors={'volumeRelative':abs(body['volume']-exp['volume'])/exp['volume'],'centroidAbsoluteMM':max(abs(a-z) for a,z in zip(body['centroid'],exp['centroid']))}
 return {'status':'PASS_ONE_DECLARED_D547_REVERSE_SUBTRACT_STATE','parameters':x['parameters'],'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'expected':exp,'massErrors':errors,'geometry':geo,'worker':worker,'workerErrors':worker_errors,'budgets':{'volumeRelative':L,'centroidBoundsBoundaryCarrierD1EndpointPcurveAbsoluteMM':L,'unitNormalComponent':L,'density1MassAbsoluteG':L},'limits':['Only retained reverse n3 minus n1 source states40/36. No fresh creation or general Boolean/Keep/empty/contact/curved claim.','Actual refusal/FIRST UndoRedo/project/re-edit need separate fresh Studio bindings.','Finite original rational/normal/UV witnesses are not a full-domain theorem. Optional null pcurves stay NOT_EXERCISED.']}
if __name__=='__main__':
 try: print(json.dumps(run(json.load(sys.stdin)),indent=2,allow_nan=False))
 except Exception as exc: print(json.dumps({'status':'FAIL_D547_REVERSE_SUBTRACT','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
// ROOT ONLY: esbuild TS stdin, resolveDir apps/cad-studio, target node22.
// node FRESH_EXTERNAL_NATIVE_BUNDLE.mjs /tmp/barocss-d547-control01
// Root wrapper pins metafile imports plus builder/input/retainedFiles and expanded
// executable bytes. It stores source-pins.json beside the bundle, before child runs.
const cli='\nconst inputFile=';
if(!inspectorSource.includes(cli))throw Error('D547 observer CLI boundary changed');
export const preflightSource=inspectorSource.slice(0,inspectorSource.indexOf(cli))+String.raw`
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {editFields} from '../../packages/barocss-cad-model/src/app/editFields.ts';
const config:any=${JSON.stringify(config)},states:any=${JSON.stringify(states)},seedText=${JSON.stringify(seedJSON)};
const output=resolve(process.argv[2]??'');assert.ok(output.startsWith('/tmp/barocss-d547-')&&!existsSync(output),'fresh owned external D547 output required');mkdirSync(output);
const save=(name:string,value:any)=>writeFileSync(join(output,name),typeof value==='string'?value:JSON.stringify(value,null,2));
const report:any={status:'RUNNING_D547_CURRENT_NATIVE_AB_AND_GUARD',sourceOrigin:config.sourceOrigin,seed:{path:config.seedPath,bytes:config.seedBytes,sha256:config.seedSHA256},rows:[],freshPositiveNativeCalls:0,negativeNativeCalls:0,independentPython:'NOT_RUN',actualStudio:'NOT_RUN',historicalNativeReuse:0};
const persist=()=>save('receipt.json',report);let phase='original-input';persist();
try{
 const source=readFileSync(config.seedPath,'utf8');save('exact-retained-D452-actual-created-source.bcad',source);assert.equal(Buffer.byteLength(source),config.seedBytes);assert.equal(sha(source),config.seedSHA256);assert.equal(source,seedText);const A=JSON.parse(source);assert.deepEqual(A,states.A.doc);
 for(const label of ['A','B']){
  phase=label;let doc:any;
  if(label==='A')doc=JSON.parse(source);
  else{
   const before=JSON.stringify(A),field=editFields(A.nodes,3,A.parameters).find((f:any)=>f.key===config.fields.B.key);assert.ok(field&&field.kind==='number'&&field.label==='Corner X');assert.equal(field.get(A.nodes),40);doc={...A,nodes:field.set(A.nodes,36)};save('B-public-original-parent-CornerX-candidate-before-assert.json',{owner:3,key:field.key,label:field.label,from:40,value:36,source:A,candidate:doc});assert.equal(JSON.stringify(A),before,'original source immutable through public field setter');
  }
  const state=states[label],documentJSON=JSON.stringify(doc);save(label+'-actual.bcad',documentJSON);
  const read=inspect(doc,{label,parameters:state.parameters});report.freshPositiveNativeCalls++;const packet=JSON.stringify(read,null,2);save(label+'-native-before-assert.json',packet);
  const row:any={label,status:'CAPTURED_BEFORE_ASSERTIONS',parameters:state.parameters,packet:label+'-native-before-assert.json',packetSHA256:sha(packet),documentSHA256:read.documentSHA256,outputs:read.outputs.map((o:any)=>({outputId:o.outputId,nativeBRepSHA256:o.nativeBRepSHA256}))};report.rows.push(row);persist();
  save(label+'-oracle-input.json',{doc,documentJSON,expectedDoc:state.doc,seedDoc:A,read,parameters:state.parameters});
  assert.equal(documentJSON,state.documentJSON);assert.equal(sha(documentJSON),state.documentSHA256);assert.equal(read.ok,true,JSON.stringify(read.error));assert.equal(read.status,'CAPTURED');assert.equal(read.inputUnchanged,true);assert.deepEqual(read.reader,{doc,notes:[]});assert.equal(read.documentJSON,documentJSON);assert.deepEqual(read.outputIds,['n4']);assert.equal(read.bodyKey,'b4');assert.equal(read.nativeBodyCount,1);assert.equal(read.outputs.length,1);assert.deepEqual(read.target,read.outputs[0]);assert.deepEqual(read.kernelDifference,{id:'n4',kind:'difference',target:'n3',tool:'n1'});
  const raw=read.outputs[0];assert.equal(sha(raw.nativeBRepJSON),raw.nativeBRepSHA256);assert.deepEqual(JSON.parse(raw.nativeBRepJSON),raw.brep);assert.equal(raw.brep.bodies.length,1);assert.equal(raw.brep.bodies[0].kind,'solid');assert.equal(raw.brep.shells.length,1);assert.equal(raw.brep.shells[0].closed,true);
  for(const key of ['defaultCheck','strict','outputCheck']){const c=raw[key];assert.equal(c.valid,true,JSON.stringify(c));assert.deepEqual(c.issues,[]);assert.equal(c.topology.length,1);assert.equal(c.topology[0].genus,0);}
  assert.deepEqual(raw.massUnits,{density:1,densityUnit:'g/cm3',volume:'mm3',mass:'g',centroid:'mm',authority:'massPropertiesOf/brepMassProperties MMGS'});
  Object.assign(row,{status:'PASS_ONE_CURRENT_D547_NATIVE_CLASS_ONLY',strict:raw.strict,mass:raw.massProperties});persist();
 }
 phase='negative1';const base=JSON.parse(states.B.documentJSON),before=JSON.stringify(base),field=editFields(base.nodes,3,base.parameters).find((f:any)=>f.key==='h');assert.ok(field&&field.kind==='number'&&field.label==='Distance');const candidate={...base,nodes:field.set(base.nodes,0)};save('negative1-candidate-before-assert.bcad',JSON.stringify(candidate));save('negative1-original-parent-Distance0-before-assert.json',{owner:3,key:'h',label:'Distance',value:0,source:base,candidate});assert.equal(JSON.stringify(base),before);
 const read=inspect(candidate,{label:'negative1',parameters:states.B.parameters,guard:config.guard});report.negativeNativeCalls++;const packet=JSON.stringify(read,null,2);save('negative1-native-before-assert.json',packet);const row:any={label:'negative1',status:'CAPTURED_BEFORE_ASSERTIONS',packet:'negative1-native-before-assert.json',packetSHA256:sha(packet),documentSHA256:read.documentSHA256,error:read.error};report.rows.push(row);persist();
 assert.equal(read.ok,false,'original n3 zero-height source must refuse');assert.equal(read.inputUnchanged,true);assert.equal(read.error.code,config.guard.expectedCode);assert.equal(read.error.feature,config.guard.expectedFeature);assert.equal(read.error.message,config.guard.expectedMessage);assert.equal(read.documentJSON,JSON.stringify(candidate));assert.deepEqual(JSON.parse(read.documentJSON),candidate);row.status='PASS_EXPECTED_CURRENT_TYPED_REFUSAL';persist();
 const runtime={workId:'D547',sourceOrigin:config.sourceOrigin,sourceDoc:A,sourceDocA:A,seedPath:join(output,'A-actual.bcad'),seedBytes:config.seedBytes,seedSHA256:config.seedSHA256,originalSeedPath:config.seedPath,states,guard:config.guard,packetPaths:Object.fromEntries(['A','B'].map(label=>[label,join(output,label+'-native-before-assert.json')])),nativeAuthority:'TWO_NEW_CURRENT_NATIVE_POSITIVES_PLUS_ONE_SEPARATE_NEGATIVE_NO_HISTORICAL_PACKET_REUSE'};save('runtime-config.json',runtime);
 report.status='PASS_D547_CURRENT_NATIVE_AB_AND_GUARD';persist();console.log(JSON.stringify({status:report.status,output,rows:report.rows.map((r:any)=>({label:r.label,status:r.status,documentSHA256:r.documentSHA256,packetSHA256:r.packetSHA256})),runtimeConfig:join(output,'runtime-config.json')}));
}catch(cause){report.status='FAIL_D547_CURRENT_NATIVE_ADMISSION';report.firstFailure={phase,...error(cause)};persist();console.log(JSON.stringify({status:report.status,output,firstFailure:report.firstFailure}));process.exitCode=1;}
`;
