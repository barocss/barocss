// D549: one exact retained D455 H12 section/detail, one actual SVG, then retention.
// Sol High owns this private numerical module. Root owns all execution and freeze.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {oracleSource as graphMath} from './bracket-baseline-oracles.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const originalPath=(directory,name)=>join(process.env.BAROCSS_D455_CAPSULE??directory,name);
export const seedPath=originalPath('/tmp/barocss-d455-workflow-run02','section-detail-05-opfs-saved.bcad');
export const seedBytes=1767,seedSHA256='ddd7b9b7a5303f5ac9f092ae557e88a1a7cff2cd7280b31fc16bfeb0e77d8fb1';
export const seedText=readFileSync(seedPath,'utf8');
if(Buffer.byteLength(seedText)!==seedBytes||sha(seedText)!==seedSHA256)throw Error('Exact retained D455 saved H12 input changed');
export const seedDoc=JSON.parse(seedText),seedJSON=JSON.stringify(seedDoc);
export const states={H12:{doc:seedDoc,documentJSON:seedJSON,documentSHA256:sha(seedJSON),parameters:{height:12}}};
export const oracleStatus='PASS_ONE_DECLARED_D549_SECTION_DETAIL_SVG_STATE';
export const legacyOraclePath=originalPath('/tmp/barocss-d455-geometry','section-oracle-v2.py');
export const legacyOracleSHA256='fb4d65e5fc44d51b16daf90d08ea923ada9846eb23e9491a19e6f105efb22d05';
const legacyText=readFileSync(legacyOraclePath,'utf8');
if(sha(legacyText)!==legacyOracleSHA256)throw Error('Retained D455 pure section/detail oracle changed');
export const observerPath=originalPath('/tmp/barocss-d455-driver04','worker-observer.mjs');
const observerText=readFileSync(observerPath,'utf8');
if(sha(observerText)!=='c81d8a43177de2b4679f27496cd31409deb383814e10db740a5038e9f03ede08')throw Error('Retained passive Worker observer changed');
const initStart=observerText.indexOf('await context.addInitScript('),initEnd=observerText.lastIndexOf(');');
if(initStart<0||initEnd<initStart)throw Error('Retained observer injection boundary changed');
// Browser: context.addInitScript({content:observerSource}) BEFORE first measured Open.
// The read hook stays __d455DrawingObserver; its original implementation is unchanged.
export const observerSource='('+observerText.slice(initStart+'await context.addInitScript('.length,initEnd)+')();';
export const observerReadHook='__d455DrawingObserver';
// Pass these functions directly to page.evaluate. They read the actual page;
// none creates a request, changes the Doc, or returns invented Worker identity.
export function observerPageRead(){return window.__d455DrawingObserver();}
export function currentWorkerPageRead({source,exclude=[]}){
 const observer=window.__d455DrawingObserver(),sourceJSON=JSON.stringify(source),optionsJSON=JSON.stringify({tangentEdges:false,sections:[{id:'A',view:'front',at:23}],made:true});
 const records=observer.records.filter(r=>r.received&&r.nativePostReturned&&JSON.stringify(r.sourceDoc)===sourceJSON&&JSON.stringify(r.request.options)===optionsJSON&&!exclude.includes(`${r.generation}/${r.worker}/${r.id}`));
 return {observer,record:records.at(-1)??null};
}
export function drawingPageRead(){
 const svg=document.querySelector('svg[aria-label="Drawing sheet"]');if(!svg)throw Error('Current Drawing sheet absent');
 const matrix=svg.getScreenCTM();if(!matrix)throw Error('Current Drawing CTM absent');const inverse=matrix.inverse(),summary=window.__studioDrawing();if(!summary)throw Error('Current Drawing summary absent');
 const sheetAt=(view,u,v)=>{const p=window.__studioDrawingAt(view,u,v);if(!p)throw Error('Current readonly placement absent: '+view);const q=new DOMPoint(p.x,p.y).matrixTransform(inverse);return [q.x,q.y];};
 const placement=(view,box)=>{const o=sheetAt(view,0,0),x=sheetAt(view,1,0),y=sheetAt(view,0,1);return {origin:o,scale:x[0]-o[0],yScale:o[1]-y[1],box,crossAxis:[x[1]-o[1],y[0]-o[0]]};};
 const titles=[...svg.querySelectorAll('g.title text')].map(e=>e.textContent??''),dateAt=titles.indexOf('DATE'),source=titles.filter(t=>t.startsWith('SRC '));
 if(dateAt<0||source.length!==1)throw Error('Current DATE/SRC title observations absent');
 const section=summary.placedSections.find(s=>s.id==='A'),detail=summary.details.find(d=>d.id==='B');if(!section||!detail)throw Error('Current A/B placements absent');
 const observer=window.__d455DrawingObserver();
 return {doc:JSON.parse(JSON.stringify(window.__studioDoc)),documentJSON:JSON.stringify(window.__studioDoc),rootFresh:window.__studioFresh,worker:window.__studioBodies(),historyRows:[...document.querySelectorAll('.history .hs')].map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')})),dirty:!!document.querySelector('[aria-label="Unsaved changes"]'),fileName:document.querySelector('.doc-tab input')?.value??null,summary,svg:svg.outerHTML,busy:!!document.querySelector('.dw-busy'),sectionPlacement:placement('section:A',section.box),detailPlacement:placement('detail:B',detail.box),date:titles[dateAt+1],currentSRC:source[0],titleObservation:titles[titles.indexOf('TITLE')+1],observerErrors:observer.errors,nativeWorkerConstructorPreserved:observer.nativeWorkerConstructorPreserved,nativeWorkerPrototypePreserved:observer.nativeWorkerPrototypePreserved};
}
export const signedZeroComparisonPath=originalPath('/tmp/barocss-d455-driver04','signed-zero.mjs');
export const signedZeroComparisonSource=readFileSync(signedZeroComparisonPath,'utf8');
if(sha(signedZeroComparisonSource)!=='d92542bc93fc18220b4bb8541d420a403ac711eb6f95c902ec089a128a15fafc')throw Error('Retained zero-only structured comparison changed');
export const config={workId:'D549',sourceOrigin:'EXACT_RETAINED_D455_ACTUAL_SAVED_H12_SECTION_A_DETAIL_B',seedPath,seedBytes,seedSHA256,states,
 groups:['01-current-Open-H12','02-actual-SVG-H12','03-post-export-retention-H12'],
 counts:{consumerGroups:3,currentWorkerPythonJoins:3,minimumFreshCurrentDrawingPairs:1,freshNativePositiveClasses:1,actualSVGDownloads:1},
 workerPolicy:'One new actual current Drawing pair, then three fresh Doc/UI/Python observations; groups02/03 may reuse the exact original raw pair only after current-Doc/options/DOM revalidation. Record unsolicited new pairs honestly; no extra remount or private post to create counts.',
 parameters:{height:12},titleFallback:'section-detail-05-opfs-saved',
 section:{id:'A',view:'front',at:23},detail:{id:'B',view:'top',center:[15,20],radius:6,scale:2},
 sourceDrift:{oldPins:2407,equal:2339,changed:68,missing:0,historicalNativeReuse:0},
 limits:['Only exact saved H12 Doc; no creation/edit/history/project-loop replay.',
  'One fresh H12 physical class: direct source evaluation and explicit full-source split are separate actual calls. No controlled sectionOf reevaluation; Worker executes the real provider.',
  'One new actual current generation/worker/request-id pair, raw V8 first; same-Doc consumers may reference its exact original bytes after current validation. Message, consumer and physical-evaluation counts stay separate.',
  'Stored H10 fillet signature is retained identity metadata. No unexpected repair/cache/rematch/held change is accepted.',
  'Native analytic1e-9; existing SVG coordinate envelope5.0001e-5 sheet mm. General visibility/curves,16-per-quarter section hatch and512-gon detail hatch stay approximate.',
  'One generated local current-sheet SVG; no API/browser byte-equality rule, PDF/DXF/raster/font/standards/mobile/performance/general-kernel claim.']};
export const builderFiles=['apps/cad-studio/test/section-detail-svg-oracles.mjs','apps/cad-studio/test/bracket-baseline-oracles.mjs'];
export const retainedFiles=[seedPath,legacyOraclePath,observerPath,'/tmp/barocss-d455-driver04/worker-bridge.mjs','/tmp/barocss-d455-driver04/signed-zero.mjs','/tmp/barocss-d455-driver04/svg-contract.mjs','/tmp/barocss-d455-geometry/section-inspector.ts','/tmp/barocss-d455-geometry/final-evidence-review.json','/tmp/barocss-d455-workflow-run02/receipt.json','/tmp/barocss-d455-workflow-run02/source-frozen.json','/tmp/barocss-d455-workflow-run02/07-project-open-section-detail.bcad'];
export const inputFiles=[...retainedFiles,'apps/cad-studio/handover/notes/section-detail-workflow-2026-11-03/README.md','apps/cad-studio/handover/notes/section-detail-workflow-2026-11-03/qualification.json'];

// TS stdin resolveDir apps/cad-studio, target node22. No evaluator runs on import.
export const inspectorCore=String.raw`
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readStudioDoc} from '../../packages/barocss-cad-model/src/engine/migrate.ts';
import {toPartDocument,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {evaluateCadPart,outputOf,massPropertiesOf,brepMassProperties,checkBrep,checkOutput,faceGeometry,curveDomain,curveEvaluator,evaluateSurfaceD1,surfaceDomain,projectBrepHiddenLines} from '../../packages/barocss-cad/src/index.ts';
import {stepValidationBounds} from '../../packages/barocss-cad/src/brep/brep-bounds.ts';
import {projectViews} from '../../packages/barocss-cad-model/src/drawing/project.ts';
import {cutRings} from '../../packages/barocss-cad-model/src/drawing/section.ts';
import {sectionFrame,layoutSheet,toSheet} from '../../packages/barocss-cad-model/src/drawing/views.ts';
import {readDrawing,sectionsOf} from '../../packages/barocss-cad-model/src/drawing/types.ts';
import {clipProjectionToDisk} from '../../packages/barocss-cad-model/src/drawing/detail.ts';
import {buildSheet,sheetSections,sectionExtents} from '../../packages/barocss-cad-model/src/drawing/sheet.ts';
import {drawingDocument} from '../../packages/barocss-cad-model/src/drawing/scope.ts';
import {revisionOf} from '../../packages/barocss-cad-model/src/util/revision.ts';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const error=(e:any)=>({name:e?.name??null,code:e?.code??null,feature:e?.feature??null,message:String(e?.message??e)});
const safe=(fn:()=>any)=>{try{return fn();}catch(e){return {observationError:error(e)};}};
const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const capture=(out:any,nodes:any[])=>{const nativeBRepJSON=JSON.stringify(out.brep);return {outputId:out.id,bodyKey:bodyKeyOf(out.id,nodes),representation:out.representation,nativeBodyCount:out.bodyCount,brep:out.brep,nativeBRepJSON,nativeBRepSHA256:sha(nativeBRepJSON)};};
function observe(raw:any,out:any){
 const b=raw.brep;
 raw.massUnits={density:1,densityUnit:'g/cm3',volume:'mm3',mass:'g',centroid:'mm',authority:'massPropertiesOf/brepMassProperties MMGS'};
 raw.massProperties=safe(()=>massPropertiesOf(out,1));raw.brepMass=safe(()=>brepMassProperties(b,1));raw.bounds=safe(()=>stepValidationBounds(b));
 raw.productChecks={authority:'PRODUCT_OBSERVATIONS_NOT_INDEPENDENT_ORACLE',default:safe(()=>checkBrep(b)),strict:safe(()=>checkBrep(b,{strict:true})),output:safe(()=>checkOutput(out))};
 raw.surfaces=b.faces.map((f:any)=>({id:f.id,name:f.name,geometry:safe(()=>faceGeometry(f)),probe:safe(()=>{
  const s=f.surface;if(s.kind!=='surface')return {unsupportedSurfaceKind:s.kind};const domain=surfaceDomain(s);
  return {domain,probes:[[.21,.37],[.71,.63]].map(([u,v])=>{const U=domain.u[0]+u*(domain.u[1]-domain.u[0]),V=domain.v[0]+v*(domain.v[1]-domain.v[0]),d=evaluateSurfaceD1(s,U,V),n=cross(d.du,d.dv),norm=Math.hypot(...n),sign=f.sense==='forward'?1:-1;return {u:U,v:V,point:d.point,du:d.du,dv:d.dv,normal:n.map(x=>sign*x/norm),normalNorm:norm};})};
 })}));
 raw.edgeProbes=b.edges.map((e:any)=>({id:e.id,name:e.name,probe:safe(()=>{const[a,z]=curveDomain(e.curve),at=curveEvaluator(e.curve);return {domain:[a,z],samples:[0,.125,.25,.375,.5,.625,.75,.875,1].map(t=>at(a+(z-a)*t))};})}));
}
export function inspect(doc:any,request:any={}){
 const documentJSON=JSON.stringify(doc),documentSHA256=sha(documentJSON),r:any={ok:false,status:'FAIL_CAPTURE_READINESS',request,documentJSON,documentSHA256,outputs:[],calls:{sourceEvaluate:0,explicitSplitEvaluate:0,controlledSectionProvider:0,projectViews:0,nativeCutProjection:0,cutRings:0}};
 try{
  r.partDocument=toPartDocument(doc);r.calls.sourceEvaluate++;const original=evaluateCadPart(r.partDocument);
  // ALL original whole-body bytes, graph, carriers, masses and bounds precede the derived cut.
  for(const out of original.outputs)r.outputs.push(capture(out,doc.nodes));
  for(let i=0;i<r.outputs.length;i++)observe(r.outputs[i],original.outputs[i]);
  r.reader=safe(()=>readStudioDoc(documentJSON));r.outputIds=r.outputs.map((o:any)=>o.outputId);r.bodyCount=r.outputs.length;r.target=r.outputs.length===1?r.outputs[0]:null;r.bodyKey=r.target?.bodyKey??null;r.outputId=r.target?.outputId??null;r.nativeBodyCount=r.target?.nativeBodyCount??null;
  if(r.outputIds.length!==1||r.outputIds[0]!=='n2')throw Error('Exactly original n2 output required');
  const sourceBodyKey=r.bodyKey,A={id:'A',view:'front' as const,at:23},split={id:'section_'+sourceBodyKey,kind:'split' as const,target:'n2',axis:'y' as const,at:23};
  r.calls.explicitSplitEvaluate++;const splitSnapshot=evaluateCadPart({...r.partDocument,features:[...r.partDocument.features,split]}),cutOutputId=split.id+'/1',kept=outputOf(splitSnapshot,cutOutputId);
  r.cut=capture(kept,doc.nodes);observe(r.cut,kept);
  const frame=sectionFrame(A,'y-');r.calls.nativeCutProjection++;const projection=projectBrepHiddenLines([kept.brep],frame.view);r.calls.cutRings++;const rings=cutRings(kept.brep,23,projection,1);
  // Same original native cut, not another source/provider evaluation and not a fabricated Worker reply.
  const sectionResult={ok:true as const,projection,rings,ringBodies:rings.map(()=>0)};
  const settings=readDrawing(doc.drawing);r.calls.projectViews++;const projected=projectViews(r.outputs.map((o:any)=>o.brep),[''],{orientation:'y-',tangentEdges:!!settings.tangent});
  if(!projected.ok)throw Error(projected.error);
  const top=projected.views.top,world=[15,20,0],dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,v,i)=>s+v*b[i],0),center:[number,number]=[dot(world,top.right),dot(world,top.up)],detailProjection=clipProjectionToDisk(top,center,6);
  const sourceModel=drawingDocument(doc,settings),sourceRevision=revisionOf(sourceModel),sections=sheetSections([{...A,result:sectionResult}]),layout=layoutSheet(projected.views,settings,sectionExtents(settings,sections));
  const meta={title:request.title??'section-detail-05-opfs-saved',date:request.date??'2026-11-05',source:sourceRevision},sheet=buildSheet(projected.views,layout,settings,meta,sections),placedA=sheet.sections?.find(s=>s.id==='A'),placedB=sheet.details?.find(d=>d.id==='B');
  const b=kept.brep,loops=new Map(b.loops.map(l=>[l.id,l])),co=new Map(b.coedges.map(c=>[c.id,c])),edges=new Map(b.edges.map(e=>[e.id,e])),vertices=new Map(b.vertices.map(v=>[v.id,v]));
  const capFaces:any[]=[];
  for(const f of b.faces){const g=faceGeometry(f);if(g.kind!=='plane'||Math.abs(g.o[1]-23)>1e-9||Math.abs(Math.abs(g.n[1])-1)>1e-9)continue;const ids=new Set<string>(),members:any[]=[];for(const lid of f.loops)for(const cid of loops.get(lid)!.coedges){const e=edges.get(co.get(cid)!.edge)!;ids.add(e.vertices[0]);ids.add(e.vertices[1]);members.push(e);}capFaces.push({id:f.id,name:f.name,geometry:g,vertices:[...ids].map(id=>vertices.get(id)),edges:members});}
  r.native={originalOutputId:r.outputId,originalBodyKey:r.bodyKey,originalSurfaces:r.target.surfaces.map((s:any)=>({id:s.id,name:s.name,geometry:s.geometry})),cutOutputId,splitFeature:split,strict:r.cut.productChecks.strict,capFaces,brep:r.cut.brep};
  r.provider={section:sectionResult,topProjection:top,detailProjection};
  if(request.captureAllViews)r.projections=projected.views;
  const transportSource={format:doc.format,schema:doc.schema,units:doc.units,parameters:doc.parameters,nodes:doc.nodes,outputs:doc.outputs};
  r.bridge={transportSource,transportSourceSHA256:sha(JSON.stringify(transportSource)),sectionResult,topProjection:top,authority:'VIEW_OF_SAME_CAPTURED_ORIGINAL_FULL_SOURCE_AND_NATIVE_CUT_NO_CONTROLLED_PROVIDER_REEVALUATION',documentSHA256,nativeBRepSHA256:r.target.nativeBRepSHA256,cutBRepSHA256:r.cut.nativeBRepSHA256};
  r.sheet={settings,meta,layout,sectionPlacement:placedA?.placement??null,detailPlacement:placedB?.placement??null,detailCenterModelView:center,detailCircleSheet:placedB?toSheet(placedB.placement,center):null,topCircleSheet:toSheet(layout.views.top,center),sectionModelPointsToSheet:placedA?[[11,0],[19,0],[11,12],[19,12]].map(p=>toSheet(placedA.placement,p as [number,number])):null,groups:sheet.groups,size:sheet.size};
  r.sourceRevision=sourceRevision;r.drawingModel=sourceModel;r.sections=sectionsOf(settings);r.ok=true;r.status='CAPTURED';
 }catch(cause){r.error=error(cause);}
 r.inputUnchanged=JSON.stringify(doc)===documentJSON;return r;
}
`;
export const inspectorSource=inspectorCore+String.raw`
const inputFile=process.argv[2],inputBytes=readFileSync(inputFile,'utf8');
console.log(JSON.stringify({...inspect(JSON.parse(inputBytes),JSON.parse(process.argv[3]??'{}')),inputPath:inputFile,inputBytes,inputSHA256:sha(inputBytes)}));
`;

// Reuse only profile-neutral independent graph/rational arithmetic, never its
// bracket/source/physical formula. The D455 oracle is called in a separate pure
// namespace with explicit views of these SAME original captures and observations.
const between=(text,a,b)=>{const i=text.indexOf(a),j=text.indexOf(b,i+1);if(i<0||j<0)throw Error('Retained pure arithmetic boundary changed: '+a);return text.slice(i,j);};
const arithmetic=between(graphMath,'def need(v,label):','def source(doc,width,seed):');
const rational=between(graphMath,'def deboor(','def carriers(width):');
const graph=between(graphMath,'def native_geometry(raw,width):','def measurement(');
const legacyEnd=legacyText.lastIndexOf('\ntry:main()');
if(legacyEnd<0)throw Error('Retained D455 pure oracle entry boundary changed');
export const oracleSource=String.raw`
import contextlib,copy,hashlib,io,json,math,re,sys,traceback,xml.etree.ElementTree as ET
from decimal import Decimal,localcontext
N=1e-9
SVG=5.0001e-5
PI=Decimal('3.14159265358979323846264338327950288419716939937510')
SEED_TEXT=${JSON.stringify(seedText)}
SEED_SHA='${seedSHA256}'
LEGACY_TEXT=${JSON.stringify(legacyText)}
LEGACY_SHA='${legacyOracleSHA256}'
LEGACY_END=${legacyEnd}
LABELS=${JSON.stringify(config.groups)}
${arithmetic}
${rational}
def carriers(width):
 planes=[('left',[0,0,0],[-1,0,0]),('right',[60,0,0],[1,0,0]),('front',[0,0,0],[0,-1,0]),('back',[0,40,0],[0,1,0]),('bottom',[0,0,0],[0,0,-1]),('top',[0,0,12],[0,0,1])]
 cylinders=[('bore',[15,20],5,-1),('farFillet',[57,37],3,1)]
 return planes,cylinders
${graph}

def source_revision(doc):
 text=json.dumps({k:doc[k] for k in ['nodes','parameters','outputs']},sort_keys=True,separators=(',',':'),ensure_ascii=False)
 a,b=0x811c9dc5,0x050c5d1f
 for c in text:
  a=((a^ord(c))*0x01000193)&0xffffffff;b=((b^ord(c))*0x01000193)&0xffffffff;b=(b^(a>>7))&0xffffffff
 return format(a,'08x')+format(b,'08x')

def physical():
 with localcontext() as ctx:
  ctx.prec=48
  removed=Decimal(9)-9*PI/4;area=2400-25*PI-removed;volume=12*area
  centroid=[(72000-375*PI-57*removed-Decimal('4.5'))/area,(48000-500*PI-37*removed-Decimal('4.5'))/area,Decimal(6)]
  return {'area':+area,'removedCornerArea':+removed,'volume':+volume,'mass':volume/1000,'centroid':[+v for v in centroid]}

def compiled(doc):
 s=doc['nodes'][0];sig=doc['nodes'][2]['sigs']['n1.side[e2]|n1.side[e3]']
 return {'format':'barocss-cad-part','version':1,'units':'mm','parameters':{},'features':[copy.deepcopy(s),{'id':'n1','kind':'extrude','sketch':'n0','height':12},{'id':'n2','kind':'fillet','target':'n1','edges':['n1.side[e2]|n1.side[e3]'],'radius':3,'expect':{'n1.side[e2]|n1.side[e3]':{'kind':sig['k'],'at':sig['p'],'dir':sig['d'],'size':sig['s']}}}]}

def bounds(actual,wanted,label):
 for key in ['min','max']: vec(actual[key],wanted[key],label+key)

def nominal_boundary(raw):
 # Native full graph first; all carriers and all original rational boundary
 # probes belong to the declared footprint. Horizontal trim integrals below
 # check the actual complete outer/inner loops, not a display polygon.
 result=native_geometry(raw,60);b=raw['brep'];faces={f['id']:f for f in b['faces']};loops={v['id']:v for v in b['loops']};co={v['id']:v for v in b['coedges']};edges={v['id']:v for v in b['edges']};smap={s['id']:s for s in raw['surfaces']};vertices={v['id']:v['point'] for v in b['vertices']}
 def footprint(p):
  need(-N<=p[0]<=60+N and -N<=p[1]<=40+N and -N<=p[2]<=12+N,'original nominal footprint/height enclosure')
  need(math.dist(p[:2],[15,20])>=5-N,'original material excludes R5 bore interior')
  if p[0]>57+N and p[1]>37+N: need(math.dist(p[:2],[57,37])<=3+N,'original rounded corner excludes removed square wedge')
 def arc_points(e,sense):
  a,z=domain(e['curve']);ps=[curve(e['curve'],a+(z-a)*i/8) for i in range(9)]
  return ps if sense=='forward' else list(reversed(ps))
 for e in edges.values():
  for p in arc_points(e,'forward'):footprint(p)
 for ob in raw['surfaces']:
  g=ob['geometry']
  if g['kind']=='cylinder':
   vec([g['a'][0],g['a'][1],abs(g['a'][2])],[0,0,1],'original cylinder vertical axis');need(g['out']==(-1 if abs(g['r']-5)<=N else 1),'original bore/fillet outward sign')
  for q in ob['probe']['probes']:
   # Carrier probes need not lie within planar trims; only cylinder patches
   # represent bounded footprint walls at every sampled parameter.
   if g['kind']=='cylinder':footprint(q['point'])
 for xy in [[0,0],[60,0],[60,37],[57,40],[0,40]]:
  for z in [0,12]: need(any(math.dist(p,xy+[z])<=N for p in vertices.values()),'actual rounded-footprint corner and H12 endpoint '+str(xy+[z]))
 vertical=[]
 for xy in [[60,37],[57,40]]:
  matches=[]
  for e in edges.values():
   ps=arc_points(e,'forward')
   if e['curve']['degree']==1 and min(max(math.dist(ps[0],xy+[0]),math.dist(ps[-1],xy+[12])),max(math.dist(ps[-1],xy+[0]),math.dist(ps[0],xy+[12])))<=N:matches.append(e['id'])
  need(len(matches)==1,'one actual H12 vertical fillet boundary; historical H10 signature is not measured geometry');vertical.append({'xy':xy,'edgeId':matches[0],'lengthMM':12})
 cap_rows=[];exp=physical();outer=2400-float(exp['removedCornerArea']);bore=25*math.pi
 for f in faces.values():
  g=smap[f['id']]['geometry']
  if g['kind']!='plane' or abs(abs(g['n'][2])-1)>N:continue
  z=g['o'][2];need(min(abs(z),abs(z-12))<=N,'full-body cap Z0/H12');areas=[]
  for lid in f['loops']:
   area=0.;span_by_circle={}
   for cid in loops[lid]['coedges']:
    use=co[cid];e=edges[use['edge']];ps=arc_points(e,use['sense']);a,q=ps[0],ps[-1]
    for p in ps:near(p[2],z,'horizontal original trim')
    area+=(a[0]*q[1]-q[0]*a[1])/2
    if e['curve']['degree']!=1:
     matches=[(name,c,r) for name,c,r in [('bore',[15,20],5),('farFillet',[57,37],3)] if all(abs(math.dist(p[:2],c)-r)<=N for p in ps)];need(len(matches)==1,'one declared rational circular cap trim');name,c,r=matches[0];angles=[math.atan2(p[1]-c[1],p[0]-c[0]) for p in ps];delta=sum(math.atan2(math.sin(v-u),math.cos(v-u)) for u,v in zip(angles,angles[1:]));need(abs(delta)>N,'nonzero original circular trim span');area+=r*r*(delta-math.sin(delta))/2;span_by_circle[name]=span_by_circle.get(name,0)+delta
   areas.append(abs(area))
   if abs(abs(area)-bore)<=N:near(abs(span_by_circle.get('bore',0)),2*math.pi,'complete original R5 bore loop')
   elif abs(abs(area)-outer)<=N:near(abs(span_by_circle.get('farFillet',0)),math.pi/2,'complete original R3 corner quarter')
   else:need(False,'unexpected original nominal cap loop area')
  need(len(areas)==2,'each original full cap has one exterior and one through-hole');vec(sorted(areas),sorted([outer,bore]),'independent original cap trim areas');near(max(areas)-min(areas),float(exp['area']),'independent original footprint area');cap_rows.append({'z':z,'loopAreasMM2':areas,'materialAreaMM2':max(areas)-min(areas)})
 need(len(cap_rows)==2 and sorted(round(q['z']) for q in cap_rows)==[0,12],'two complete original nominal caps')
 result.update({'nominalCaps':cap_rows,'currentFilletVerticalBoundaries':vertical,'historicalSignatureAuthority':'Exact retained H10 identity metadata only; original H12 resulting boundaries and full footprint checked independently','pcurveStatus':'EXERCISED_FINITE_ORIGINAL_UV_LIFTS' if result['pcurveCount'] else 'ABSENT_ORIGINAL_OPTIONAL_FIELDS_NO_LIFT_CLAIM','proofBoundary':'Declared complete rational graph/carriers/circular cap trims and finite point/D1/normal/optional UV witnesses of this exact H12 plate; no general-domain or Boolean theorem.'})
 return result

def reject_observation_errors(x,path='read'):
 if isinstance(x,dict):
  need('observationError' not in x,path+' no failed observation')
  for k,v in x.items():reject_observation_errors(v,path+'.'+k)
 elif isinstance(x,list):
  for i,v in enumerate(x):reject_observation_errors(v,path+'['+str(i)+']')

def legacy_check(x):
 need(hashlib.sha256(LEGACY_TEXT.encode()).hexdigest()==LEGACY_SHA,'byte-exact retained D455 independent section/detail math')
 ns={};exec(compile(LEGACY_TEXT[:LEGACY_END],'<byte-exact-D455-pure-section-detail-oracle>','exec'),ns)
 # This is an explicit view of the SAME complete original captures and actual
 # request/reply/DOM/placements. It contains no re-evaluation or invented input.
 view={'doc':x['doc'],'read':x['read'],'height':12}
 if x.get('consumer') is not None:
  c=x['consumer'];pair=c['workerPair'];view['consumer']={'request':pair['request'],'reply':pair['reply'],'svg':c['svg'],'sectionPlacement':c['sectionPlacement'],'detailPlacement':c['detailPlacement'],'observerErrors':c['observerErrors']}
 out=io.StringIO();prior=ns['sys'].stdin
 try:
  ns['sys'].stdin=io.StringIO(json.dumps(view))
  with contextlib.redirect_stdout(out):ns['main']()
 finally:ns['sys'].stdin=prior
 row=json.loads(out.getvalue());need(row['status']=='PASS','retained D455 same-capture oracle');return row,ns['svg_consumer_contract']

def local(e):return e.tag.rsplit('}',1)[-1]
def field(texts,name):
 indexes=[i for i,t in enumerate(texts) if t==name];need(len(indexes)==1 and indexes[0]+1<len(texts),'one title field '+name);return texts[indexes[0]+1]
def svg_contract(text,c,rd,legacy_svg,exported=False):
 root=ET.fromstring(text);need(local(root)=='svg','actual UTF8 XML root');wanted=[0,0,420,297] if exported else [-6,-6,432,309];vec([float(v) for v in root.attrib['viewBox'].split()],wanted,'file A3 vs default padded UI viewBox')
 if exported:
  need(root.attrib.get('width')=='420mm' and root.attrib.get('height')=='297mm','file declares A3 millimetres');need([e.text for e in root if local(e)=='title']==[c['fileName']],'original file title fallback')
 title_groups=[e for e in root.iter() if local(e)=='g' and 'title' in e.attrib.get('class','').split()];need(len(title_groups)==1,'one current title block');texts=[e.text or '' for e in title_groups[0].iter() if local(e)=='text'];scale=rd['sheet']['layout']['scale'];scale_text=(str(int(scale))+':1') if scale>=1 else ('1:'+str(int(1/scale)))
 need(field(texts,'TITLE')==c['fileName'] and field(texts,'UNITS')=='mm' and field(texts,'SCALE')==scale_text and field(texts,'DATE')==c['date'] and field(texts,'SHEET')=='A3','actual current title/date/units/scale/single-sheet A3 context')
 need([t for t in texts if t.startswith('SRC ')]==['SRC '+rd['sourceRevision']],'actual current SRC not old identity print')
 adapted={'svg':text,'sectionPlacement':c['sectionPlacement'],'detailPlacement':c['detailPlacement']};evidence=legacy_svg(adapted,12)
 # The clip's R12 outline has a full two-A path. Its own geometry must not be
 # confused with the two separate R10 bore semicircles checked by D455.
 details=[e for e in root.iter() if local(e)=='g' and 'detail' in e.attrib.get('class','').split() and e.attrib.get('data-dim')=='B' and e.attrib.get('data-view')=='detail:B'];need(len(details)==1,'one selected actual DetailB group');full=[];number=r'[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][-+]?\d+)?'
 center=evidence['boreCenterSheet'];positive=[center[0]+12,center[1]];negative=[center[0]-12,center[1]]
 for e in details[0].iter():
  if local(e)!='path':continue
  textpath=e.attrib.get('d','');tokens=re.findall(number+r'|[A-Za-z]',textpath)
  if len(tokens)!=19 or tokens[0]!='M' or tokens[3]!='A' or tokens[11]!='A':continue
  need(re.sub(r'[\s,]','',textpath)==''.join(tokens),'clip full-circle syntax retained');values=[float(tokens[k]) for k in [1,2,4,5,6,7,8,9,10,12,13,14,15,16,17,18]]
  if max(abs(values[k]-12) for k in [2,3,9,10])>SVG:continue
  vec(values[:2],positive,'clip R12 start',SVG);vec(values[7:9],negative,'clip R12 half end',SVG);vec(values[14:16],positive,'clip R12 full end',SVG);near(values[4],0,'clip rotation',SVG);near(values[11],0,'clip rotation',SVG);need(values[5]==values[12]==0 and values[6]==values[13] and values[6] in [0,1],'two complementary clip half flags');full.append(textpath)
 need(len(full)==1,'one actual R12 clip outline, separate from R10 bore')
 return {'status':'PASS_ORIGINAL_FILE_XML_AND_NATIVE_BOUND_SECTION_DETAIL' if exported else 'PASS_ORIGINAL_CURRENT_DOM','sizeMM':[420,297],'sheetIndex':0,'title':c['fileName'],'date':c['date'],'units':'mm','scale':scale,'sourceRevision':rd['sourceRevision'],'section':evidence,'clipRadiusPaperMM':12,'clipOutlineCount':len(full),'coordinateEnvelopeSheetMM':SVG,'areaAuthority':'Native exact Y23 cap area624; formatted SVG boundaries have their separate coordinate envelope, not native area1e-9.'}

def run(x):
 need(len(SEED_TEXT.encode())==1767 and hashlib.sha256(SEED_TEXT.encode()).hexdigest()==SEED_SHA,'exact retained1767B D455 savedH12');seed=json.loads(SEED_TEXT);doc=x['doc'];rd=x['read'];need(x['seedDoc']==seed and doc==seed==x['expectedDoc'],'whole accepted Doc exact; no cache/rematch/held/repair exception');need(x['parameters']=={'height':12},'one fixed H12 class');text=x['documentJSON'];need(json.loads(text)==doc and rd['documentJSON']==text and hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256'],'whole original accepted Doc/hash/native join');need(rd['ok'] is True and rd['status']=='CAPTURED' and rd['inputUnchanged'] is True and rd['reader']=={'doc':doc,'notes':[]},'current exact reader with no repairs');reject_observation_errors(rd)
 need(rd['partDocument']==compiled(doc),'whole original source/sideTags/through-bore/fillet expectation compiled exactly');need(rd['outputIds']==['n2'] and rd['bodyCount']==1 and rd['bodyKey']=='b2' and rd['outputId']=='n2' and rd['nativeBodyCount']==1 and len(rd['outputs'])==1 and rd['target']==rd['outputs'][0],'sole original n2/b2 output');raw=rd['outputs'][0];need(raw['outputId']=='n2' and raw['bodyKey']=='b2' and raw['nativeBodyCount']==1,'original output owner');need(json.loads(raw['nativeBRepJSON'])==raw['brep'] and hashlib.sha256(raw['nativeBRepJSON'].encode()).hexdigest()==raw['nativeBRepSHA256'],'original whole BRep bytes/hash')
 need(rd['calls']=={'sourceEvaluate':1,'explicitSplitEvaluate':1,'controlledSectionProvider':0,'projectViews':1,'nativeCutProjection':1,'cutRings':1},'actual controlled calls separated from physical class and Worker/provider calls')
 bridge=rd['bridge'];need(bridge['authority']=='VIEW_OF_SAME_CAPTURED_ORIGINAL_FULL_SOURCE_AND_NATIVE_CUT_NO_CONTROLLED_PROVIDER_REEVALUATION' and bridge['documentSHA256']==rd['documentSHA256'] and bridge['nativeBRepSHA256']==raw['nativeBRepSHA256'] and bridge['cutBRepSHA256']==rd['cut']['nativeBRepSHA256'],'same original full/cut source association');need(json.loads(rd['cut']['nativeBRepJSON'])==rd['cut']['brep'] and hashlib.sha256(rd['cut']['nativeBRepJSON'].encode()).hexdigest()==rd['cut']['nativeBRepSHA256'] and rd['native']['brep']==rd['cut']['brep'],'original derived cut bytes/hash');need(rd['native']['originalSurfaces']==[{k:s[k] for k in ['id','name','geometry']} for s in raw['surfaces']],'legacy view sees original whole carriers')
 for key in ['default','strict','output']:
  check=raw['productChecks'][key];need(check['valid'] is True and check['issues']==[] and len(check['topology'])==1 and check['topology'][0]['genus']==1,'whole body native '+key+' through-bore genus1')
 need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'explicit density1 native MMGS');bounds(raw['bounds'],{'min':[0,0,0],'max':[60,40,12]},'original source bounds');geometry=nominal_boundary(raw);exp=physical();errors={}
 for key in ['massProperties','brepMass']:
  m=raw[key];need(finite(m) and m['method'] in ['closed-form','planar-exact','quadrature'],'native nonmesh mass '+key);ve=decimal_close(m['volume'],exp['volume'],Decimal('1e-9')*exp['volume'],key+' independent whole nominal volume');me=decimal_close(m['mass'],exp['mass'],Decimal('1e-9'),key+' density1 grams');ce=max(decimal_close(v,q,Decimal('1e-9'),key+' independent centroid') for v,q in zip(m['centroid'],exp['centroid']));errors[key]={'volumeRelative':ve/float(exp['volume']),'massAbsoluteG':me,'centroidAbsoluteMM':ce}
 src=source_revision(doc);need(rd['sourceRevision']==src and rd['drawingModel']==doc,'independent current canonical source/actual drawingDoc');need(rd['sections']==[{'id':'A','view':'front','at':23}],'exact ordinary SectionA');need(rd['sheet']['settings']==doc['drawing'] and rd['sheet']['size']==[420,297],'exact current A3 settings');legacy,legacy_svg=legacy_check(x);need(legacy['native']['gap']==8 and legacy['native']['materialRingsArea']==624,'independent exact native Y23/chord/material area')
 worker='NOT_SUPPLIED_CURRENT_NATIVE_CONTROL_ONLY';worker_errors=None;dom=None;export=None;pair=None;retention=None
 if x.get('consumer') is not None:
  need(x['label'] in LABELS,'only three selected consumer labels');c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True and c['busy'] is False,'settled actual current Doc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==1 and w['bodies'][0]['key']=='b2','fresh actual original b2 Worker');body=w['bodies'][0];worker_errors={'volumeRelative':decimal_close(body['volume'],exp['volume'],Decimal('1e-9')*exp['volume'],'Worker independent whole volume')/float(exp['volume']),'centroidAbsoluteMM':max(decimal_close(v,q,Decimal('1e-9'),'Worker independent centroid') for v,q in zip(body['centroid'],exp['centroid']))};worker='PASS_ORIGINAL_FRESH_STUDIO_DOC_WORKER'
  pair=c['workerPair'];need(isinstance(pair['generation'],str) and pair['generation'] and type(pair['worker']) is int and pair['worker']>0 and type(pair['id']) is int and pair['reply']['id']==pair['id'] and re.fullmatch('[0-9a-f]{64}',pair['rawV8SHA256']),'original generation/Worker/id/rawV8 custody');need(c['nativeWorkerConstructorPreserved'] is True and c['nativeWorkerPrototypePreserved'] is True and c['observerErrors']==[],'passive observer preserves original Worker');need(pair['request']['doc']==bridge['transportSource'] and pair['request']['options']=={'tangentEdges':False,'sections':[{'id':'A','view':'front','at':23}],'made':True},'original actual request/options/source');need(pair['reply']['drawing']['ok'] is True,'actual native drawing reply')
  pair_key=pair['generation']+'/'+str(pair['worker'])+'/'+str(pair['id']);need(isinstance(pair['initialKey'],str) and pair['initialKey'] and re.fullmatch('[0-9a-f]{64}',pair['initialRawV8SHA256']),'original initial-pair reference')
  if x['label']==LABELS[0]:need(pair['observationMode']=='NEW_CURRENT_PAIR' and pair['firstObservedLabel']==x['label'] and pair['initialKey']==pair_key and pair['initialRawV8SHA256']==pair['rawV8SHA256'],'first actual current raw pair')
  elif pair['observationMode']=='EXACT_CURRENT_DOC_PAIR_REUSE':
   need(pair['firstObservedLabel'] in LABELS[:LABELS.index(x['label'])],'reuse references a previously preserved actual raw pair, current source/options rechecked')
   if pair['firstObservedLabel']==LABELS[0]:need(pair['initialKey']==pair_key and pair['initialRawV8SHA256']==pair['rawV8SHA256'],'exact original initial raw pair/hash reused')
   else:need(pair['initialKey']!=pair_key,'previous unsolicited pair reused without calling it new again')
  else:need(pair['observationMode']=='NEW_CURRENT_PAIR' and pair['firstObservedLabel']==x['label'] and pair['initialKey']!=pair_key,'unsolicited new actual pair counted separately, never synthetic refresh')
  need(c['currentSRC'] in [src,'SRC '+src] and isinstance(c['date'],str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}',c['date']) and isinstance(c['fileName'],str) and c['fileName'],'actual current SRC/date/file title observations');need(c['dirty'] is False,'unmodified exact current file remains clean')
  for name in ['sectionPlacement','detailPlacement']:
   a=c[name];q=rd['sheet'][name];vec(a['origin'],q['origin'],'actual read-only '+name+' origin');near(a['scale'],q['scale'],'actual read-only '+name+' scale');near(a['yScale'],q['scale'],'actual read-only '+name+' yScale');vec(a['box'],q['box'],'actual read-only '+name+' box');vec(a['crossAxis'],[0,0],'actual orthogonal placement axes')
  summary=c['summary'];need(summary['dimensions']==[] and summary['section']['rings']==2 and summary['section']['edges']==len(rd['provider']['section']['projection']['edges']),'actual section summary and no new dimensions');need([(d['id'],d['view'],d['scale']) for d in summary['details']]==[('B','top',2)],'actual local DetailB identity/scale');dom=svg_contract(c['svg'],c,rd,legacy_svg)
  if x['label']==LABELS[2]:
   before=x['retentionBaseline'];need(before['documentJSON']==text and before['workerBodies']==w['bodies'] and before['historyRows']==c['historyRows'] and before['dirty']==c['dirty'],'post-export exact Doc/body/history/dirty retention');retention='PASS_EXACT_ORIGINAL_BASELINE_DOC_BODY_HISTORY_DIRTY'
  if x.get('svgExport') is not None:
   need(x['label']==LABELS[1],'only actual export group supplies file');e=x['svgExport'];data=e['bytes'];need(isinstance(data,list) and data and all(type(v) is int and 0<=v<=255 for v in data),'original actual file bytes');data=bytes(data);need(e['sheetIndex']==0 and e['documentSHA256']==rd['documentSHA256'] and e['nativeBRepSHA256']==raw['nativeBRepSHA256'] and e['sha256']==hashlib.sha256(data).hexdigest(),'file bytes/selected sheet/Doc/paired native class custody');need(e['filename']==c['fileName']+'.svg' and e['title']==c['fileName'],'single-sheet filename/current fallback title');selected=svg_contract(e['domSVG'],c,rd,legacy_svg);file=svg_contract(data.decode('utf8'),c,rd,legacy_svg,True);export={'bytes':len(data),'sha256':e['sha256'],'filename':e['filename'],'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'file':file,'selectedDOM':selected,'authority':'Actual file and paired same-source physical class; no embedded BRep or product-to-product byte-equality accuracy claim'}
  else:need(x['label']!=LABELS[1],'selected export group requires original file')
 return {'status':'${oracleStatus}','parameters':{'height':12},'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'sourceRevision':src,'expected':{'footprintAreaMM2':str(exp['area']),'volumeMM3':str(exp['volume']),'massDensity1G':str(exp['mass']),'centroidMM':[str(v) for v in exp['centroid']],'boundsMM':{'min':[0,0,0],'max':[60,40,12]}},'geometry':geometry,'massErrors':errors,'legacySameCaptureSectionDetail':{'sourceSHA256':LEGACY_SHA,'result':legacy},'controlledCalls':rd['calls'],'worker':worker,'workerErrors':worker_errors,'workerPair':None if pair is None else {k:pair[k] for k in ['generation','worker','id','rawV8SHA256','observationMode','firstObservedLabel','initialKey','initialRawV8SHA256']},'currentDOM':dom,'actualSVGExport':export,'retention':retention,'budgets':{'nativeAbsoluteMM':N,'nativeVolumeRelative':N,'nativeCentroidAbsoluteMM':N,'density1MassAbsoluteG':N,'SVGCoordinateEnvelopeSheetMM':SVG},'limits':${JSON.stringify(config.limits)}}
if __name__=='__main__':
 try:print(json.dumps(run(json.load(sys.stdin)),indent=2,allow_nan=False))
 except Exception as exc:print(json.dumps({'status':'FAIL_D549_SECTION_DETAIL_SVG','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;

// Root builds once; root runs this under its gate in a NEW external output path.
// This captures ONE H12 physical class. Python/Studio qualification stays separate.
export const preflightSource=inspectorCore+String.raw`
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const config:any=${JSON.stringify(config)},seedText=${JSON.stringify(seedText)},state:any=${JSON.stringify(states.H12)};
const output=resolve(process.argv[2]??'');assert.ok(output.startsWith('/tmp/barocss-d549-')&&!existsSync(output),'fresh owned external D549 output required');mkdirSync(output);
const save=(name:string,value:any)=>writeFileSync(join(output,name),typeof value==='string'?value:JSON.stringify(value,null,2));
const report:any={status:'RUNNING_D549_CURRENT_H12_NATIVE_CLASS',sourceOrigin:config.sourceOrigin,rows:[],physicalClasses:0,actualCalls:null,independentPython:'NOT_RUN',actualStudio:'NOT_RUN',actualSVGExports:'NOT_RUN',historicalNativeReuse:0};const persist=()=>save('receipt.json',report);let phase='exact-retained-input';persist();
try{
 const source=readFileSync(config.seedPath,'utf8');save('exact-retained-D455-saved-H12.bcad',source);assert.equal(Buffer.byteLength(source),config.seedBytes);assert.equal(sha(source),config.seedSHA256);assert.equal(source,seedText);const doc=JSON.parse(source);assert.deepEqual(doc,state.doc);
 phase='H12-original-native-class';const read=inspect(doc,{label:'H12',parameters:{height:12},title:config.titleFallback,date:'2026-11-05'}),packet=JSON.stringify(read,null,2);save('H12-native-before-assert.json',packet);report.physicalClasses=1;report.actualCalls=read.calls;const row:any={label:'H12',status:'CAPTURED_BEFORE_ASSERTIONS',packet:'H12-native-before-assert.json',packetSHA256:sha(packet),documentSHA256:read.documentSHA256,outputs:read.outputs.map((o:any)=>({outputId:o.outputId,nativeBRepSHA256:o.nativeBRepSHA256}))};report.rows.push(row);persist();
 save('H12-oracle-input.json',{doc,documentJSON:JSON.stringify(doc),expectedDoc:state.doc,seedDoc:doc,parameters:{height:12},read});
 assert.equal(read.ok,true,JSON.stringify(read.error));assert.equal(read.status,'CAPTURED');assert.equal(read.inputUnchanged,true);assert.equal(read.documentJSON,state.documentJSON);assert.deepEqual(read.reader,{doc,notes:[]});assert.deepEqual(read.outputIds,['n2']);assert.equal(read.bodyKey,'b2');assert.equal(read.nativeBodyCount,1);assert.equal(read.outputs.length,1);assert.deepEqual(read.target,read.outputs[0]);
 const raw=read.outputs[0];assert.equal(sha(raw.nativeBRepJSON),raw.nativeBRepSHA256);assert.deepEqual(JSON.parse(raw.nativeBRepJSON),raw.brep);for(const key of ['default','strict','output']){const c=raw.productChecks[key];assert.equal(c.valid,true,JSON.stringify(c));assert.deepEqual(c.issues,[]);assert.equal(c.topology.length,1);assert.equal(c.topology[0].genus,1);}
 assert.equal(read.cut.productChecks.strict.valid,true);assert.equal(read.cut.productChecks.strict.topology[0].genus,0);assert.deepEqual(read.calls,{sourceEvaluate:1,explicitSplitEvaluate:1,controlledSectionProvider:0,projectViews:1,nativeCutProjection:1,cutRings:1});
 row.status='PASS_ONE_CURRENT_D549_NATIVE_H12_CLASS_ONLY';persist();const runtime={workId:'D549',sourceOrigin:config.sourceOrigin,sourceDoc:doc,seedPath:config.seedPath,seedBytes:config.seedBytes,seedSHA256:config.seedSHA256,originalSeedPath:config.seedPath,materializedSeedPath:join(output,'exact-retained-D455-saved-H12.bcad'),states:{H12:state},packetPaths:{H12:join(output,'H12-native-before-assert.json')},nativeAuthority:'ONE_NEW_CURRENT_H12_CLASS_WITH_SEPARATE_SOURCE_AND_SPLIT_EVALUATIONS_NO_HISTORICAL_PACKET_REUSE',actualCalls:read.calls};save('runtime-config.json',runtime);report.status='PASS_D549_CURRENT_NATIVE_H12_CLASS_ONLY';persist();console.log(JSON.stringify({status:report.status,output,physicalClasses:report.physicalClasses,actualCalls:report.actualCalls,rows:report.rows,runtimeConfig:join(output,'runtime-config.json')}));
}catch(cause){report.status='FAIL_D549_CURRENT_NATIVE_H12_CLASS';report.firstFailure={phase,...error(cause)};persist();console.log(JSON.stringify({status:report.status,output,firstFailure:report.firstFailure}));process.exitCode=1;}
`;
