// D534: existing D373 linear cut pattern, one finite source/edit/history/project chain.
// No execution on import. Root owns native preflight, the serial gate and actual Studio.
export const seedSHA256 = '020a7942b1fb4cc177b13c43bf0561c2002094ea5afc82ca3841cbccd900944c';
export const seedJSON = JSON.stringify({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
    {kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 30], id: 'n0'},
    {kind: 'extrude', sketch: 0, height: 10, id: 'n1', made: {command: 'box', values: {w: 60, d: 30, h: 10, x: 0, y: 0, z: 0}}},
    {kind: 'sketch', profile: 'rectangle', min: [0, 8], max: [4, 12], id: 'n2'},
    {kind: 'extrude', sketch: 2, height: 10, id: 'n3', made: {command: 'box', values: {w: 4, d: 4, h: 10, x: 0, y: 8, z: 0}}},
    {kind: 'translate', parent: {node: 3, side: 'solid'}, offset: [8, 0, 0], id: 'n4'},
    {kind: 'difference', parent: {node: 1, side: 'solid'}, tool: {node: 4, side: 'solid'}, id: 'n5'},
    {kind: 'linear-feature-pattern', parent: {node: 5, side: 'solid'}, axis: 'x', spacing: 16, count: 3, id: 'n6'},
  ], outputs: {b6: {node: 6, side: 'solid'}}, nextId: 7,
}, null, 2);

// TS stdin resolved from apps/cad-studio. CLI: node inspector.mjs ACTUAL_DOC OPTIONS_JSON.
// Same raw-transport convention as D533; no expected fixture replaces the actual input.
export const inspectorSource = String.raw`
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
export function inspect(doc:any,request:any={}){
 const documentJSON=JSON.stringify(doc),documentSHA256=sha(documentJSON),reader=safe(()=>readStudioDoc(documentJSON));
 let partDocument:any=null;const outputs:any[]=[];
 try{
  partDocument=toPartDocument(doc);const snapshot=evaluateCadPart(partDocument);
  // Preserve ALL original native outputs before any selected owner or physical checks.
  for(const out of snapshot.outputs){const nativeBRepJSON=JSON.stringify(out.brep);outputs.push({outputId:out.id,bodyKey:bodyKeyOf(out.id,doc.nodes),representation:out.representation,nativeBodyCount:out.bodyCount,brep:out.brep,nativeBRepJSON,nativeBRepSHA256:sha(nativeBRepJSON)});}
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
  return {ok:true,status:request.pickOnly?'ANTECEDENT_OBSERVATION_ONLY':'CAPTURED',request,documentJSON,documentSHA256,inputUnchanged:JSON.stringify(doc)===documentJSON,reader,partDocument,outputs,outputIds:outputs.map(o=>o.outputId),target,native,bodyCount:outputs.length,bodyKey:target?.bodyKey??null,outputId:target?.outputId??null,nativeBodyCount:target?.nativeBodyCount??null,mass:target?.massProperties??null,brepMass:target?.brepMass??null,bounds:target?.bounds??null,kernelPattern:partDocument.features.find((f:any)=>f.id==='n6')??null};
 }catch(e){return {ok:false,status:'FAIL_CAPTURE_READINESS',request,documentJSON,documentSHA256,inputUnchanged:JSON.stringify(doc)===documentJSON,reader,partDocument,outputs,error:error(e)};}
}
const inputFile=process.argv[2],inputBytes=readFileSync(inputFile,'utf8');
console.log(JSON.stringify({...inspect(JSON.parse(inputBytes),JSON.parse(process.argv[3]??'{}')),inputPath:inputFile,inputBytes,inputSHA256:sha(inputBytes)}));
`;

// Five accepted new physical classes only. Retained S is a controlled antecedent,
// not a replay or a new certificate of D373 creation. No product imports.
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
def sub(a,b): return [x-y for x,y in zip(a,b)]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def unit(a):
 length=math.sqrt(dot(a,a));need(length>0,'nondegenerate original surface');return [v/length for v in a]
def bbox(points):
 need(points,'nonempty original trimmed boundary');return {s:[fn(p[i] for p in points) for i in range(3)] for s,fn in [('min',min),('max',max)]}
def bounds(a,b,label):
 for side in ['min','max']: vec(a[side],b[side],label+side)
def line(c,t):
 p=c['controlPoints'];need(c['degree']==1 and len(p)==len(c['weights'])==2 and c['weights']==[1,1],'selected original exact straight line')
 a,z=c['knots'][1],c['knots'][2];need(a<z and c['knots']==[a,a,z,z] and a<=t<=z,'selected original line domain')
 u=(t-a)/(z-a);return [(1-u)*v+u*w for v,w in zip(p[0],p[1])]
def domain(c): return c['knots'][c['degree']],c['knots'][len(c['controlPoints'])]
def planar_d1(s,u,v):
 need(s['kind']=='surface' and s['degreeU']==s['degreeV']==1 and s['weights']==[[1,1],[1,1]],'selected original bilinear plane')
 p=s['controlPoints'];need(len(p)==2 and all(len(row)==2 for row in p),'original plane dimensions')
 ua,uz=s['knotsU'][1:3];va,vz=s['knotsV'][1:3];need(s['knotsU']==[ua,ua,uz,uz] and s['knotsV']==[va,va,vz,vz] and ua<uz and va<vz,'original plane domains')
 U=(u-ua)/(uz-ua);V=(v-va)/(vz-va)
 at=[(1-U)*(1-V)*p[0][0][i]+(1-U)*V*p[0][1][i]+U*(1-V)*p[1][0][i]+U*V*p[1][1][i] for i in range(3)]
 du=[((1-V)*(p[1][0][i]-p[0][0][i])+V*(p[1][1][i]-p[0][1][i]))/(uz-ua) for i in range(3)]
 dv=[((1-U)*(p[0][1][i]-p[0][0][i])+U*(p[1][1][i]-p[1][0][i]))/(vz-va) for i in range(3)]
 return at,du,dv
def parameters(p):
 need(set(p)=={'toolWidth','spacing','count','suppressed'} and type(p['suppressed']) is bool,'exact finite parameter fields')
 w,s,n,off=p['toolWidth'],p['spacing'],p['count'],p['suppressed']
 need(all(isinstance(v,(int,float)) and not isinstance(v,bool) for v in [w,s,n]),'plain numeric source parameters')
 need((w,s,n,off) in [(6,16,3,False),(6,12,3,False),(6,12,4,False),(6,12,4,True),(6,10,4,False)],'five declared new A/B/C/D/E classes only')
 m=1 if off else int(n);holes=[(8+k*s,8+w+k*s) for k in range(m)]
 need(all(0<a<b<60 for a,b in holes) and all(holes[k][1]<holes[k+1][0] for k in range(m-1)),'strictly inside and disjoint declared cuts')
 volume=Q(18000)-Q(40)*Q(w)*m;sumx=m*(Q(8)+Q(w)/2)+Q(s)*m*(m-1)/2
 mx=Q(540000)-Q(40)*Q(w)*sumx;my=Q(270000)-Q(400)*Q(w)*m
 return {'volume':float(volume),'massDensity1':float(volume/1000),'centroid':[float(mx/volume),float(my/volume),5],'bounds':{'min':[0,0,0],'max':[60,30,10]},'effectiveCutCount':m,'genus':m,'holes':holes,'exact':{'volume':str(volume),'centroid':[str(mx/volume),str(my/volume),'5'],'sumCutCenterX':str(sumx)}}
def inside(p,holes,label):
 need(-L<=p[0]<=60+L and -L<=p[1]<=30+L and -L<=p[2]<=10+L,label+' stock enclosure')
 need(not any(a+L<p[0]<b-L and 8+L<p[1]<12-L for a,b in holes),label+' no material boundary inside a declared void')
def geometry(raw,p,exp):
 b=raw['brep'];need(finite(b),'finite original native BRep');keys=['bodies','shells','faces','loops','coedges','edges','vertices'];tab={k:{q['id']:q for q in b[k]} for k in keys}
 need(all(len(tab[k])==len(b[k]) for k in keys),'unique original entity IDs');need(len(b['bodies'])==len(b['shells'])==1,'one original body/shell')
 body,shell=b['bodies'][0],b['shells'][0];faces,loops,co,edges,verts=[tab[k] for k in keys[2:]]
 need(body['kind']=='solid' and shell['closed'] and set(body['shells'])==set(tab['shells']) and shell['body']==body['id'] and set(shell['faces'])==set(faces),'complete closed original solid')
 edgepoints={};max_endpoint=0.;max_pcurve=0.;pcurve_count=0;owned_loops=[];owned_co=[];graph={fid:set() for fid in faces}
 cap=1e-3*max(1,max(abs(x) for v in verts.values() for x in v['point']))
 for v in verts.values(): need(0<v['tolerance']<=cap,'unchanged strict vertex tolerance cap')
 for e in edges.values():
  need(0<e['tolerance']<=cap and len(e['vertices'])==2 and all(v in verts for v in e['vertices']),'original edge endpoints/tolerance');a,z=domain(e['curve']);pts=[line(e['curve'],a+(z-a)*i/8) for i in range(9)];edgepoints[e['id']]=pts
  for pp,vid in zip([pts[0],pts[-1]],e['vertices']):
   gap=math.dist(pp,verts[vid]['point']);max_endpoint=max(max_endpoint,gap);near(gap,0,'independent original line endpoint',min(L,e['tolerance']))
 for f in faces.values():
  need(f['shell']==shell['id'] and f['loops'],'face/shell reciprocity');owned_loops+=f['loops']
  for lid in f['loops']:
   lp=loops[lid];need(lp['face']==f['id'] and lp['coedges'],'face/loop reciprocity');owned_co+=lp['coedges']
   for j,cid in enumerate(lp['coedges']):
    c=co[cid];nxt=co[lp['coedges'][(j+1)%len(lp['coedges'])]];need(c['loop']==lid and c['next']==nxt['id'] and c['prev']==lp['coedges'][j-1],'ordered original loop')
    need(edges[c['edge']]['vertices'][1 if c['sense']=='forward' else 0]==edges[nxt['edge']]['vertices'][0 if nxt['sense']=='forward' else 1],'original directed loop endpoint continuity')
 for c in co.values():
  t=co[c['twin']];need(t['twin']==c['id'] and t['edge']==c['edge'] and t['sense']!=c['sense'],'original opposed reciprocal twins');graph[loops[c['loop']]['face']].add(loops[t['loop']]['face'])
  if c.get('pcurve') is not None:
   pcurve_count+=1;e=edges[c['edge']];need(domain(c['pcurve'])==domain(e['curve']),'original pcurve domain');a,z=domain(e['curve'])
   for i in range(5):
    tt=a+(z-a)*i/4;uv=line(c['pcurve'],tt);lift=planar_d1(faces[loops[c['loop']]['face']]['surface'],uv[0],uv[1])[0];gap=math.dist(lift,line(e['curve'],tt));max_pcurve=max(max_pcurve,gap);near(gap,0,'original optional pcurve lift',min(L,e['tolerance']))
 need(len(owned_loops)==len(loops) and set(owned_loops)==set(loops) and len(owned_co)==len(co) and set(owned_co)==set(co),'complete original loop/coedge ownership')
 for eid in edges: need(sum(c['edge']==eid for c in co.values())==2,'two original uses per edge')
 need(set(v for e in edges.values() for v in e['vertices'])==set(verts),'no orphan original vertices');seen=set();todo=[next(iter(faces))]
 while todo:
  fid=todo.pop()
  if fid not in seen: seen.add(fid);todo+=list(graph[fid]-seen)
 need(seen==set(faces),'one connected original shell');chi=len(verts)-len(edges)+2*len(faces)-len(loops);need(chi==2-2*exp['effectiveCutCount'],'independent effective-hole genus')
 roles={
  'outer-x0':([-1,0,0],[0,0,0],{'min':[0,0,0],'max':[0,30,10]}),
  'outer-x60':([1,0,0],[60,0,0],{'min':[60,0,0],'max':[60,30,10]}),
  'outer-y0':([0,-1,0],[0,0,0],{'min':[0,0,0],'max':[60,0,10]}),
  'outer-y30':([0,1,0],[0,30,0],{'min':[0,30,0],'max':[60,30,10]}),
  'bottom':([0,0,-1],[0,0,0],{'min':[0,0,0],'max':[60,30,0]}),
  'top':([0,0,1],[0,0,10],{'min':[0,0,10],'max':[60,30,10]})}
 for k,(a,z) in enumerate(exp['holes']):
  roles.update({f'hole{k}-xmin':([1,0,0],[a,0,0],{'min':[a,8,0],'max':[a,12,10]}),f'hole{k}-xmax':([-1,0,0],[z,0,0],{'min':[z,8,0],'max':[z,12,10]}),f'hole{k}-ymin':([0,1,0],[0,8,0],{'min':[a,8,0],'max':[z,8,10]}),f'hole{k}-ymax':([0,-1,0],[0,12,0],{'min':[a,12,0],'max':[z,12,10]})})
 role_points={key:[] for key in roles};carriers=[];max_carrier=0.;max_probe=0.;max_d1=0.;max_normal=0.;smap={s['id']:s for s in raw['surfaces']};need(len(smap)==len(raw['surfaces'])==len(faces) and set(smap)==set(faces),'all original carrier observations')
 for f in faces.values():
  obs=smap[f['id']];g=obs['geometry'];need(g['kind']=='plane','only declared native planar carriers');ps=[pp for lid in f['loops'] for cid in loops[lid]['coedges'] for pp in edgepoints[co[cid]['edge']]]
  for pp in ps: inside(pp,exp['holes'],'actual trimmed line')
  candidates=[]
  for role,(n,o,bb) in roles.items():
   if max(abs(a-z) for a,z in zip(g['n'],n))<=L and abs(dot(n,sub(g['o'],o)))<=L and all(all(bb['min'][j]-L<=pp[j]<=bb['max'][j]+L for j in range(3)) for pp in ps): candidates.append(role)
  need(len(candidates)==1,'unique physical nominal plane/trim role');role=candidates[0];n,o,_=roles[role];role_points[role]+=ps
  for pp in ps: gap=abs(dot(n,sub(pp,o)));max_carrier=max(max_carrier,gap);near(gap,0,'independent nominal trimmed carrier')
  for ob in obs['probe']['probes']:
   pp,du,dv=planar_d1(f['surface'],ob['u'],ob['v']);vec(ob['point'],pp,'independent original plane point');vec(ob['du'],du,'independent original plane du');vec(ob['dv'],dv,'independent original plane dv');nn=unit(cross(du,dv));nn=[v*(1 if f['sense']=='forward' else -1) for v in nn];vec(nn,n,'independent outward nominal normal');vec(ob['normal'],nn,'original native normal');need(ob['normalNorm']>0,'native nondegenerate plane derivative');near(dot(n,sub(pp,o)),0,'independent full carrier support');max_probe=max(max_probe,max(abs(a-z) for a,z in zip(ob['point'],pp)));max_d1=max(max_d1,max(abs(a-z) for a,z in zip(ob['du']+ob['dv'],du+dv)));max_normal=max(max_normal,max(abs(a-z) for a,z in zip(nn,n)))
  carriers.append({'face':f['id'],'name':f.get('name'),'role':role})
 for role,ps in role_points.items(): need(ps,'all declared outer/cavity roles '+role);bounds(bbox(ps),roles[role][2],'complete original trimmed role extent '+role)
 ep={e['id']:e for e in raw['edgeProbes']};need(len(ep)==len(raw['edgeProbes'])==len(edges) and set(ep)==set(edges),'all original edge observations');max_edge=0.
 for eid,e in edges.items():
  a,z=domain(e['curve']);ob=ep[eid]['probe'];need(ob['domain']==[a,z] and len(ob['samples'])==9,'original line observation domain/stations')
  for i,pp in enumerate(ob['samples']):
   independent=line(e['curve'],a+(z-a)*i/8);vec(pp,independent,'independent observed original line');max_edge=max(max_edge,max(abs(v-w) for v,w in zip(pp,independent)))
 rims=[]
 for k,(a,z) in enumerate(exp['holes']):
  for level in [0,10]:
   rim=[];length=0.
   for e in edges.values():
    ps=edgepoints[e['id']]
    if all(abs(pp[2]-level)<=L and a-L<=pp[0]<=z+L and 8-L<=pp[1]<=12+L and (abs(pp[0]-a)<=L or abs(pp[0]-z)<=L or abs(pp[1]-8)<=L or abs(pp[1]-12)<=L) for pp in ps): rim+=ps;length+=math.dist(ps[0],ps[-1])
   need(rim,'each original rectangular hole rim');bounds(bbox(rim),{'min':[a,8,level],'max':[z,12,level]},'nominal rectangular rim extent');near(length,2*((z-a)+4),'complete native rectangular rim perimeter')
   for xx,yy in [(a,8),(z,8),(z,12),(a,12)]: need(any(max(abs(v-w) for v,w in zip(pp,[xx,yy,level]))<=L for pp in rim),'all four nominal rim corners')
   rims.append({'hole':k,'z':level,'perimeterMM':length})
 bounds(bbox([v['point'] for v in verts.values()]+[pp for ps in edgepoints.values() for pp in ps]),exp['bounds'],'complete native material boundary bounds')
 # Exact rational tetrahedral integration of every original directed planar loop,
 # including cap inner loops. No mesh, product integration or nominal replacement.
 volume=Q(0);first=[Q(0)]*3
 for f in faces.values():
  for lid in f['loops']:
   corners=[]
   for cid in loops[lid]['coedges']:
    c=co[cid];e=edges[c['edge']];corners.append([Q(v) for v in verts[e['vertices'][0 if c['sense']=='forward' else 1]]['point']])
   need(len(corners)>=3,'original polygon loop corners')
   for i in range(1,len(corners)-1):
    tri=[corners[0],corners[i],corners[i+1]];v=dot(tri[0],cross(tri[1],tri[2]))/6;volume+=v;first=[old+v*sum(pp[j] for pp in tri)/4 for j,old in enumerate(first)]
 need(volume>0,'positive original oriented boundary volume');near(float(volume),exp['volume'],'exact original boundary vs literal volume',L*exp['volume']);centroid=[float(v/volume) for v in first];vec(centroid,exp['centroid'],'exact original boundary vs literal centroid')
 return {'counts':{key:len(b[key]) for key in keys},'genus':exp['effectiveCutCount'],'eulerCharacteristic':chi,'carriers':carriers,'rims':rims,'pcurveCount':pcurve_count,'pcurvePresence':'ORIGINAL_OPTIONAL_FIELDS_ONLY','maximumEndpointGapMM':max_endpoint,'maximumPcurveLiftGapMM':max_pcurve,'maximumCarrierResidualMM':max_carrier,'maximumIndependentProbePointGapMM':max_probe,'maximumIndependentD1ComponentGapMM':max_d1,'maximumIndependentEdgeProbeGapMM':max_edge,'maximumOutwardNormalComponentError':max_normal,'exactOriginalBoundaryIntegrals':{'volume':str(volume),'centroid':[str(v/volume) for v in first]},'proofBoundary':'Selected straight planar profile, complete original topology/trim traversal, independent literal and rational boundary integration; no generic geometry theorem.'}
def run(x):
 p=x['parameters'];exp=parameters(p);doc=x['doc'];rd=x['read'];text=x.get('documentJSON',rd['documentJSON'])
 need(len(SEED_TEXT.encode())==1695 and hashlib.sha256(SEED_TEXT.encode()).hexdigest()==SEED_SHA,'exact versioned D373 retained input bytes/SHA');seed=json.loads(SEED_TEXT);need(x['seedDoc']==seed,'caller exact retained antecedent Doc')
 wanted=copy.deepcopy(seed);wanted['nodes'][2]['max'][0]=6;del wanted['nodes'][3]['made'];wanted['nodes'][6]['spacing']=p['spacing'];wanted['nodes'][6]['count']=p['count']
 if p['suppressed']: wanted['nodes'][6]['suppressed']=True
 need(doc==wanted==x['expectedDoc'],'only anchored n2 Width/n3 stale-made removal/n6 spacing-count-suppression; n1 made and all refs/IDs/b6/nextId unchanged')
 need(rd['ok'] is True and rd['status']=='CAPTURED' and rd['inputUnchanged'] is True and rd['documentJSON']==text and json.loads(text)==doc==rd['reader']['doc'] and rd['reader']['notes']==[],'exact actual Doc/native reader binding');need(hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256'],'original whole Doc transport hash');need(rd['request']['parameters']==p,'original native request parameter binding')
 need(len(rd['outputs'])==1 and rd['target']==rd['outputs'][0] and rd['outputIds']==['n6'] and rd['bodyKey']=='b6' and rd['outputId']=='n6' and rd['nativeBodyCount']==1,'all captured outputs then sole original n6/b6 owner');raw=rd['outputs'][0];need(raw['outputId']=='n6' and raw['bodyKey']=='b6' and raw['nativeBodyCount']==1,'original physical output owner')
 bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'original JS BRep bytes/SHA, not Python reserialization');native=rd['native'];need(native['nativeBRepJSON']==bj and native['nativeBRepSHA256']==raw['nativeBRepSHA256'] and native['documentSHA256']==rd['documentSHA256'] and native['mass']==raw['massProperties'] and rd['mass']==raw['massProperties'] and rd['brepMass']==raw['brepMass'] and rd['bounds']==raw['bounds'],'original native aliases')
 expected_features=[{'id':'n0','kind':'sketch','profile':'rectangle','min':[0,0],'max':[60,30]},{'id':'n1','kind':'extrude','sketch':'n0','height':10},{'id':'n2','kind':'sketch','profile':'rectangle','min':[0,8],'max':[6,12]},{'id':'n3','kind':'extrude','sketch':'n2','height':10},{'id':'n4','kind':'translate','target':'n3','offset':[8,0,0]},{'id':'n5','kind':'difference','target':'n1','tool':'n4'}]
 expected_features.append({'id':'n6','kind':'translate','target':'n5','offset':[0,0,0]} if p['suppressed'] else {'id':'n6','kind':'linear-feature-pattern','target':'n5','axis':'x','spacing':p['spacing'],'count':p['count']})
 need(rd['partDocument']=={'format':'barocss-cad-part','version':1,'units':'mm','parameters':{},'features':expected_features},'exact native original source operands and active pattern or suppressed identity pass-through');need(rd['kernelPattern']==expected_features[-1],'native n6 ownership survives suppression')
 for key in ['defaultCheck','strict','outputCheck']:
  ck=raw[key];need(ck['valid'] is True and ck['issues']==[] and len(ck['topology'])==1 and ck['topology'][0]['genus']==exp['genus'],'unchanged native '+key)
 need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'explicit public MMGS at density1 g/cm3');bounds(raw['bounds'],exp['bounds'],'native boundary-aware material bounds');errors={}
 for key in ['massProperties','brepMass']:
  m=raw[key];need(finite(m) and m['method'] in ['closed-form','planar-exact'],'selected nonmesh planar native mass');near(m['volume'],exp['volume'],key+' literal volume',L*exp['volume']);near(m['mass'],exp['massDensity1'],key+' literal density1 grams');vec(m['centroid'],exp['centroid'],key+' literal cut-center centroid');errors[key]={'volumeRelative':abs(m['volume']-exp['volume'])/exp['volume'],'centroidAbsoluteMM':max(abs(a-b) for a,b in zip(m['centroid'],exp['centroid']))}
 geo=geometry(raw,p,exp);worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ADMISSION'
 if x.get('consumer') is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True,'original exact fresh Studio Doc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==1 and w['bodies'][0]['key']=='b6','fresh current root Worker n6/b6');body=w['bodies'][0];near(body['volume'],exp['volume'],'current Worker literal volume',L*exp['volume']);vec(body['centroid'],exp['centroid'],'current Worker literal centroid');near(body['volume'],raw['massProperties']['volume'],'current Worker/native volume',L*exp['volume']);vec(body['centroid'],raw['massProperties']['centroid'],'current Worker/native centroid');worker='PASS_ORIGINAL_FRESH_STUDIO_DOC_WORKER'
 return {'status':'PASS_ONE_DECLARED_D534_LINEAR_CUT_PATTERN_STATE','parameters':p,'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'expected':exp,'massErrors':errors,'geometry':geo,'worker':worker,'budgets':{'volumeRelative':L,'centroidBoundsBoundaryCarrierD1EndpointPcurveAbsoluteMM':L,'unitNormalComponent':L,'density1MassAbsoluteG':L},'limits':['Only the five declared disjoint straight integer-prism A/B/C/D/E source/pattern states on the retained D373 part.','The original retained S is antecedent input, not a new D373 creation certificate. Public refusal/history/suppression/project actions need separate actual Studio evidence.','No overlap/touch/other axis, generic Boolean/pattern geometry, inertia, full viewport fit, manufacturing, mobile or release claim.']}
if __name__=='__main__':
 try: print(json.dumps(run(json.load(sys.stdin)),indent=2,allow_nan=False))
 except Exception as exc: print(json.dumps({'status':'FAIL_D534_DECLARED_LINEAR_CUT_PATTERN','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
