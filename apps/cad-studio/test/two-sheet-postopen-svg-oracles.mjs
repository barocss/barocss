// D548: issued-B two-sheet post-Open source height and actual current-sheet SVG consumers.
// Numerical author: Sol High; root owns native/Python/Studio/export execution and freeze.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectorSource as nativeBase,oracleSource as reverseMath} from './reverse-subtract-oracles.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const seedPath='/tmp/barocss-d486-workflow-run01/06-issued-B-H8-saved-opfs.bcad';
export const seedBytes=3891;
export const seedSHA256='5416d43c65ed56c38ae5f99cbe2ab89b6d5180aff1d48fb1f84dfe6d699aff11';
export const seedText="{\n  \"format\": \"barocss-cad-model\",\n  \"schema\": 3,\n  \"units\": \"mm\",\n  \"parameters\": {},\n  \"nodes\": [\n    {\n      \"id\": \"n0\",\n      \"kind\": \"sketch\",\n      \"profile\": \"rectangle\",\n      \"min\": [\n        0,\n        0\n      ],\n      \"max\": [\n        30,\n        12\n      ]\n    },\n    {\n      \"id\": \"n1\",\n      \"kind\": \"extrude\",\n      \"sketch\": 0,\n      \"height\": 8\n    }\n  ],\n  \"outputs\": {\n    \"b1\": {\n      \"node\": 1,\n      \"side\": \"solid\"\n    }\n  },\n  \"nextId\": 2,\n  \"drawing\": {\n    \"sheet\": \"A4\",\n    \"scope\": {\n      \"kind\": \"part\"\n    },\n    \"projection\": \"third\",\n    \"hidden\": true,\n    \"revision\": \"B\",\n    \"revisedModel\": \"3336e060\",\n    \"dimensions\": [\n      {\n        \"view\": \"top\",\n        \"kind\": \"linear\",\n        \"a\": {\n          \"edge\": \"n1.bottom|n1.side0\",\n          \"at\": \"end\",\n          \"near\": [\n            0,\n            0,\n            0\n          ],\n          \"sig\": {\n            \"k\": \"line\",\n            \"p\": [\n              15,\n              0,\n              0\n            ],\n            \"d\": [\n              1,\n              0,\n              0\n            ],\n            \"s\": 30\n          }\n        },\n        \"b\": {\n          \"edge\": \"n1.bottom|n1.side2\",\n          \"at\": \"end\",\n          \"near\": [\n            0,\n            12,\n            0\n          ],\n          \"sig\": {\n            \"k\": \"line\",\n            \"p\": [\n              15,\n              12,\n              0\n            ],\n            \"d\": [\n              -1,\n              0,\n              0\n            ],\n            \"s\": 30\n          }\n        },\n        \"orient\": \"vertical\",\n        \"place\": [\n          -5,\n          6\n        ],\n        \"id\": \"d1\",\n        \"auto\": true\n      },\n      {\n        \"view\": \"front\",\n        \"kind\": \"linear\",\n        \"a\": {\n          \"edge\": \"n1.bottom|n1.side0\",\n          \"at\": \"end\",\n          \"near\": [\n            0,\n            0,\n            0\n          ],\n          \"sig\": {\n            \"k\": \"line\",\n            \"p\": [\n              15,\n              0,\n              0\n            ],\n            \"d\": [\n              1,\n              0,\n              0\n            ],\n            \"s\": 30\n          }\n        },\n        \"b\": {\n          \"edge\": \"n1.bottom|n1.side0\",\n          \"at\": \"end\",\n          \"near\": [\n            30,\n            0,\n            0\n          ],\n          \"sig\": {\n            \"k\": \"line\",\n            \"p\": [\n              15,\n              0,\n              0\n            ],\n            \"d\": [\n              1,\n              0,\n              0\n            ],\n            \"s\": 30\n          }\n        },\n        \"orient\": \"horizontal\",\n        \"place\": [\n          15,\n          -5\n        ],\n        \"id\": \"d2\",\n        \"auto\": true\n      },\n      {\n        \"view\": \"front\",\n        \"kind\": \"linear\",\n        \"a\": {\n          \"edge\": \"n1.bottom|n1.side0\",\n          \"at\": \"end\",\n          \"near\": [\n            0,\n            0,\n            0\n          ],\n          \"sig\": {\n            \"k\": \"line\",\n            \"p\": [\n              15,\n              0,\n              0\n            ],\n            \"d\": [\n              1,\n              0,\n              0\n            ],\n            \"s\": 30\n          }\n        },\n        \"b\": {\n          \"edge\": \"n1.side0|n1.top\",\n          \"at\": \"end\",\n          \"near\": [\n            0,\n            0,\n            6\n          ],\n          \"sig\": {\n            \"k\": \"line\",\n            \"p\": [\n              15,\n              0,\n              6\n            ],\n            \"d\": [\n              1,\n              0,\n              0\n            ],\n            \"s\": 30\n          }\n        },\n        \"orient\": \"vertical\",\n        \"place\": [\n          35,\n          3\n        ],\n        \"id\": \"d3\",\n        \"auto\": true\n      }\n    ],\n    \"views\": [\n      \"front\",\n      \"top\",\n      \"iso\"\n    ],\n    \"sheets\": [\n      {\n        \"id\": \"S2\",\n        \"views\": [\n          \"top\"\n        ]\n      }\n    ]\n  }\n}";
export const seedDoc=JSON.parse(seedText),seedJSON=JSON.stringify(seedDoc);
const second=structuredClone(seedDoc);second.nodes[1].height=10;
const state=(doc,height)=>({doc,documentJSON:JSON.stringify(doc),documentSHA256:sha(JSON.stringify(doc)),parameters:{height}});
export const states={A:state(structuredClone(seedDoc),8),B:state(second,10)};
export const oracleStatus='PASS_ONE_DECLARED_D548_TWO_SHEET_POSTOPEN_STATE';
export const physicalPath='/tmp/barocss-d486-geometry01/box-physical.py';
export const physicalSHA256='c221419823b38a3b4d2797518c115c6c89b4a17433e49398b0dc30d484f6c8d9';
const physicalSource=readFileSync(physicalPath,'utf8');
if(sha(physicalSource)!==physicalSHA256)throw Error('Retained D486 pure physical source changed');
export const config={workId:'D548',sourceOrigin:'EXACT_RETAINED_D486_ACTUAL_ISSUED_B_H8_OWN_PROJECT',seedPath,seedBytes,seedSHA256,states,
 fields:{B:{index:1,key:'h',label:'Distance',from:8,value:10},postA:{index:1,key:'h',label:'Distance',from:10,value:8}},
 guard:{index:1,key:'h',label:'Distance',value:0,sourceClass:'B',expectedCode:'PARAMETER',expectedFeature:'n1',reason:'height must not be zero',expectedMessage:'n1: height must not be zero'},
 groups:['initial-issuedB-H8-Open','postOpen-original-Distance10','Distance0-refusal-retainsH10','FIRST-document-UndoH8','document-RedoH10','own-project-SaveH10','same-context-reload-OpenH10','actual-SVG-Sheet1-H10','actual-SVG-Sheet2-H10','postOpen-Distance8-dirty'],
 counts:{consumerGroups:10,currentWorkerPythonJoins:10,freshNativePositiveClasses:2,separateNegativeControls:1,actualSVGDownloads:2},
 limits:['Retained creation/revision issue antecedent, no fresh drawing/part creation or NextC.','RevisionB/H8 issue stamp remains; H10 is deliberately stale with current native dimensions, H8 return clears staleness.','Two actual current-sheet SVG exports after own OpenH10, no PDF/DXF/font/raster/standards or mobile claim.','Existing four-decimal SVG formatting is separate from unchanged1e-9 native budgets.','Only validated source-signature cache policy may vary; each accepted actual Doc remains exact for history/cache/Open.']};
export const builderFiles=['apps/cad-studio/test/two-sheet-postopen-svg-oracles.mjs','apps/cad-studio/test/reverse-subtract-oracles.mjs'];
export const retainedFiles=[seedPath,physicalPath,'/tmp/barocss-d486-geometry01/manifest.json','/tmp/barocss-d486-geometry01/lifecycle-oracle.py','/tmp/barocss-d486-geometry01/native-inspector.ts','/tmp/barocss-d486-workflow-run01/receipt.json','/tmp/barocss-d486-workflow-run01/source-frozen.json'];
export const inputFiles=[...retainedFiles,'apps/cad-studio/handover/notes/two-sheet-revision-workflow-2026-11-04/README.md','apps/cad-studio/handover/notes/two-sheet-revision-workflow-2026-11-04/qualification.json'];
const cli='\nconst inputFile=';
if(!nativeBase.includes(cli))throw Error('Retained native observer CLI boundary changed');
const nativeCore=nativeBase.slice(0,nativeBase.indexOf(cli)).replace('export function inspect(', 'function inspectNative(');
export const inspectorSource=nativeCore+String.raw`
import {bodyMesh} from '../../packages/barocss-cad-model/src/engine/mesh.ts';
import {projectViews} from '../../packages/barocss-cad-model/src/drawing/project.ts';
import {drawingDocument} from '../../packages/barocss-cad-model/src/drawing/scope.ts';
import {forSheet} from '../../packages/barocss-cad-model/src/drawing/sheets.ts';
import {issueContext,drawingIssues} from '../../packages/barocss-cad-model/src/drawing/issues.ts';
import {resolveDimension} from '../../packages/barocss-cad-model/src/drawing/dimensions.ts';
import {canonicalOf,revisionOf} from '../../packages/barocss-cad-model/src/util/revision.ts';
import {signaturesOf} from '../../packages/barocss-cad-model/src/engine/rematch.ts';
import {toSig} from '../../packages/barocss-cad-model/src/engine/references.ts';
import {drawingRevisionPrint} from './src/ui/drawing/revisionPrint.ts';
export function inspect(doc:any,request:any={}){
 const raw=inspectNative(doc,request);
 if(!raw.ok)return raw;
 // Original ALL-output BRep bytes are already captured by inspectNative. Every
 // projection/legacy view below observes those same objects, never a second evaluation.
 try{
  const whole=doc.drawing,model=drawingDocument(doc,whole),modelJSON=JSON.stringify(model),expectedSourceRevision=revisionOf(model),projection=projectViews(raw.outputs.map((o:any)=>o.brep),raw.outputs.map(()=>''),{tangentEdges:!!whole.tangent,...(whole.orientation?{orientation:whole.orientation}:{})});
  const dimensions:any[]=[],sheets:any[]=[],expectedCaptureSignaturesByDimension:any={};
  if(projection.ok){
   for(const dim of whole.dimensions)dimensions.push({dim,resolved:safe(()=>resolveDimension(projection.views,dim))});
   if(raw.outputs.length===1){const signatures=signaturesOf({mesh:bodyMesh(raw.outputs[0].brep,0,8)} as any).edges;for(const dim of whole.dimensions){const refs:any={};for(const key of ['a','b'])if(dim[key]?.edge){const signature=signatures.get(dim[key].edge);refs[key]=signature?toSig(signature):null;}expectedCaptureSignaturesByDimension[dim.id]=refs;}}
   for(let sheetIndex=0;sheetIndex<2;sheetIndex++){
    const settings=forSheet(whole,sheetIndex),ctx=safe(()=>issueContext({views:projection.views,settings,meta:{title:request.title??whole.title??'D548 retained drawing',date:request.date??'2026-11-05',source:expectedSourceRevision}}));
    if(ctx.observationError){sheets.push({sheetIndex,settings,observationError:ctx.observationError});continue;}
    sheets.push({sheetIndex,settings,dimensions:ctx.sheet.dimensions,groups:ctx.sheet.groups,dimensionGroups:ctx.sheet.groups.filter((g:any)=>g.role==='dimension'),layout:ctx.layout,issues:safe(()=>drawingIssues(ctx)),titleTexts:ctx.sheet.groups.filter((g:any)=>g.role==='title').flatMap((g:any)=>g.marks.filter((m:any)=>m.kind==='text').map((m:any)=>m.text))});
   }
  }
  const target=raw.target,legacyNative=target?{outputId:target.outputId,bodyKey:target.bodyKey,rawBrep:target.brep,mass:target.massProperties,brepMass:target.brepMass,bounds:target.bounds,check:target.strict,defaultCheck:target.defaultCheck,surfaces:target.surfaces.map((s:any)=>({id:s.id,name:s.name,geometry:s.geometry}))}:null;
  return {...raw,nodeVersion:process.versions.node,drawingModel:JSON.parse(modelJSON),drawingModelJSON:modelJSON,drawingModelSHA256:sha(modelJSON),modelCanonicalSHA256:sha(canonicalOf(model)),expectedSourceRevision,currentSourceRevision:expectedSourceRevision,expectedDrawingRevisionPrint:drawingRevisionPrint(doc),projection,dimensions,expectedCaptureSignaturesByDimension,sheets,common:{revision:whole.revision??null,revisedModel:whole.revisedModel??null},kernelExtrude:raw.partDocument.features.find((f:any)=>f.id==='n1')??null,
   legacyView:{authority:'BYTE_EXACT_D486_PURE_FUNCTION_VIEW_OF_SAME_ORIGINAL_CAPTURED_OUTPUT_NO_REEVALUATION',originalDocumentSHA256:raw.documentSHA256,originalNativeBRepSHA256:target?.nativeBRepSHA256??null,read:{native:legacyNative,outputs:legacyNative?[legacyNative]:[],outputCount:raw.outputs.length}},inputUnchanged:JSON.stringify(doc)===raw.documentJSON};
 }catch(cause){return {...raw,ok:false,status:'FAIL_DRAWING_OBSERVATION',error:error(cause)};}
}
const inputFile=process.argv[2],inputBytes=readFileSync(inputFile,'utf8');
console.log(JSON.stringify({...inspect(JSON.parse(inputBytes),JSON.parse(process.argv[3]??'{}')),inputPath:inputFile,inputBytes,inputSHA256:sha(inputBytes)}));
`;
// Independent stdlib-only arithmetic: original D486 physical function bytes,
// independently copied rational/graph math, literal standard-view and paper axes.
const helperStart=reverseMath.indexOf('def need(v,label):'),geometryStart=reverseMath.indexOf('def geometry(raw,exp):'),geometryEnd=reverseMath.indexOf('def run(x):');
if(helperStart<0||geometryStart<0||geometryEnd<0)throw Error('Retained independent helper source boundary changed');
const helpers=reverseMath.slice(helperStart,reverseMath.indexOf('def expected(parameters):'));
const geometry=reverseMath.slice(geometryStart,geometryEnd).replace("names={(0,0):'n1.side[e2]',(0,1):'n3.side[e2]',(1,0):'n3.side[e1]',(1,1):'n3.side[e3]',(2,0):'n3.bottom',(2,1):'n3.top'}","names={(0,0):'n1.side3',(0,1):'n1.side1',(1,0):'n1.side0',(1,1):'n1.side2',(2,0):'n1.bottom',(2,1):'n1.top'}");
const oracleHead=String.raw`
import copy, hashlib, itertools, json, math, sys, traceback, xml.etree.ElementTree as ET
from fractions import Fraction as Q
L=1e-9
SEED_TEXT=${JSON.stringify(seedText)}
SEED_SHA='${seedSHA256}'
PHYSICAL_TEXT=${JSON.stringify(physicalSource)}
PHYSICAL_SHA='${physicalSHA256}'
${helpers}
${geometry}
`;
export const oracleSource=oracleHead+String.raw`
def compact(x): return json.dumps(x,separators=(',',':'),ensure_ascii=False)
def without_sig(doc):
 out=copy.deepcopy(doc)
 for dim in out['drawing']['dimensions']:
  for key in ('a','b'): dim[key].pop('sig',None)
 return out
def expected(p):
 need(set(p)=={'height'} and type(p['height']) in (int,float) and p['height'] in (8,10),'only declared height8/10')
 h=p['height'];return {'volume':360*h,'massDensity1':360*h/1000,'centroid':[15,6,h/2],'bounds':{'min':[0,0,0],'max':[30,12,h]},'dimensions':{'d1':12,'d2':30,'d3':h}}
REV=['nodes','parameters','outputs','fits','bearings','orings','rings','drives','connectors','frames','bodies','requirements','brief','references','process','printer','print','mould','machining','casting','drafts','interfaces','instances','fastenerSizes','castingRules','mounts']
def model_print(doc):
 a=0x811c9dc5
 for char in compact(doc['nodes']): a=((a^ord(char))*0x01000193)&0xffffffff
 return format(a,'08x')
def source_revision(doc):
 text=json.dumps({k:doc[k] for k in REV if k in doc},sort_keys=True,separators=(',',':'),ensure_ascii=False);a=0x811c9dc5;b=0x050c5d1f
 for char in text: a=((a^ord(char))*0x01000193)&0xffffffff;b=((b^ord(char))*0x01000193)&0xffffffff;b=(b^(a>>7))&0xffffffff
 return format(a,'08x')+format(b,'08x')
def validate_source(doc,seed,h):
 wanted=copy.deepcopy(seed);wanted['nodes'][1]['height']=h;need(without_sig(doc)==without_sig(wanted),'only original n1 height plus explicitly validated signature-cache policy; all authored drawing refs/near/place/IDs/auto/sheets/revisionB/stamp exact')
 for dim in doc['drawing']['dimensions']:
  for key in ('a','b'):
   need('sig' in dim[key],'original signed reference must not silently lose its cache');s=dim[key]['sig'];original=next(d for d in seed['drawing']['dimensions'] if d['id']==dim['id'])[key]['sig'];need(set(s)==set(original) and s['k']=='line' and len(s['p'])==len(s['d'])==3,'only original line signature structure');near(s['s'],30,'original line cache length');need(min(max(abs(v-w) for v,w in zip(s['d'],original['d'])),max(abs(v+w) for v,w in zip(s['d'],original['d'])))<=L,'original line cache direction');vec(s['p'][:2],original['p'][:2],'original cache horizontal centre')
   allowed=[6,8,10] if dim['id']=='d3' and key=='b' else [0];need(any(abs(s['p'][2]-level)<=L for level in allowed),'signature is retained original H6 anchor or a declared actual source-height cache, never a dimension measurement')
def legacy_physical(rd,raw,h):
 need(hashlib.sha256(PHYSICAL_TEXT.encode()).hexdigest()==PHYSICAL_SHA,'byte-exact retained pure D486 physical source');namespace={};exec(compile(PHYSICAL_TEXT,'retained-D486-box-physical.py','exec'),namespace)
 view=rd['legacyView'];need(view['authority']=='BYTE_EXACT_D486_PURE_FUNCTION_VIEW_OF_SAME_ORIGINAL_CAPTURED_OUTPUT_NO_REEVALUATION' and view['originalDocumentSHA256']==rd['documentSHA256'] and view['originalNativeBRepSHA256']==raw['nativeBRepSHA256'],'labelled same-original native legacy bridge')
 wanted={'outputId':raw['outputId'],'bodyKey':raw['bodyKey'],'rawBrep':raw['brep'],'mass':raw['massProperties'],'brepMass':raw['brepMass'],'bounds':raw['bounds'],'check':raw['strict'],'defaultCheck':raw['defaultCheck'],'surfaces':[{k:s[k] for k in ('id','name','geometry')} for s in raw['surfaces']]}
 need(view['read']=={'native':wanted,'outputs':[wanted],'outputCount':1},'legacy checker sees only the same complete original native object, not synthesized geometry or another evaluation');result=namespace['physical'](view['read'],h);need(result['failures']==[],'retained pure physical checker: '+str(result['failures']));return {'authority':view['authority'],'sourceSHA256':PHYSICAL_SHA,'originalNativeBRepSHA256':raw['nativeBRepSHA256'],'errors':result['errors']}
AXES={'front':([1,0,0],[0,0,1],[0,-1,0]),'top':([1,0,0],[0,1,0],[0,0,1]),'iso':([1/math.sqrt(2),1/math.sqrt(2),0],[-1/math.sqrt(6),1/math.sqrt(6),2/math.sqrt(6)],[1/math.sqrt(3),-1/math.sqrt(3),1/math.sqrt(3)])}
def project(point,view): return [dot(point,AXES[view][0]),dot(point,AXES[view][1])]
def paper(point,placement): return [placement['origin'][0]+placement['scale']*point[0],placement['origin'][1]-placement['scale']*point[1]]
def same_line(a,b,c,d,t=L): return min(max(max(abs(v-w) for v,w in zip(a,c)),max(abs(v-w) for v,w in zip(b,d))),max(max(abs(v-w) for v,w in zip(a,d)),max(abs(v-w) for v,w in zip(b,c))))<=t
def drawing(rd,raw,doc,h,src):
 b=raw['brep'];edges={e['name']:e for e in b['edges']};verts={v['id']:v['point'] for v in b['vertices']};faces={f['id']:f for f in b['faces']};loops={l['id']:l for l in b['loops']};co={c['id']:c for c in b['coedges']};normal={s['id']:s['geometry']['n'] for s in raw['surfaces']};adj={e['id']:set() for e in b['edges']}
 for c in co.values(): adj[c['edge']].add(loops[c['loop']]['face'])
 need(rd['projection']['ok'] is True,'current native projection admitted');need(rd['common']=={'revision':'B','revisedModel':'3336e060'},'common issued-B/H8 stamp retained')
 for view,axes in AXES.items():
  pr=rd['projection']['views'][view]
  for key,want in zip(('right','up','toward'),axes): vec(pr[key],want,'literal default '+view+' '+key)
  projected={name:[project(verts[v],view) for v in e['vertices']] for name,e in edges.items()};noncollapsed={name for name,p in projected.items() if math.dist(*p)>L};need(len(pr['edges'])==len(noncollapsed) and {e['name'] for e in pr['edges']}==noncollapsed,'all and only noncollapsed original '+view+' edges')
  corner_points=[project(p,view) for p in verts.values()];vec(pr['min'],[min(p[k] for p in corner_points) for k in range(2)],'independent '+view+' min');vec(pr['max'],[max(p[k] for p in corner_points) for k in range(2)],'independent '+view+' max')
  for pe in pr['edges']:
   original=edges[pe['name']];ends=[verts[v] for v in original['vertices']];need(pe['kind']=='line' and same_line(pe['ends'][0],pe['ends'][1],ends[0],ends[1]),'native projected edge retains original 3D endpoints');visible=any(dot(normal[fid],axes[2])>L for fid in adj[original['id']]);expected_pieces=1 if view=='iso' or visible else 0;need(len(pe['pieces'])==expected_pieces,'finite convex-box visibility and coincident orthographic rear-edge suppression')
   for piece in pe['pieces']:
    need(piece['visible'] is visible and piece['curve']['kind']=='line','original convex-box visibility and straight projection');need(same_line(piece['curve']['a'],piece['curve']['b'],*projected[pe['name']]),'independent literal line projection')
 values={'d1':12,'d2':30,'d3':h};world={'d1':[[0,0,0],[0,12,0]],'d2':[[0,0,0],[30,0,0]],'d3':[[0,0,0],[0,0,h]]};resolved={r['dim']['id']:r['resolved'] for r in rd['dimensions']};references=[]
 for dim in doc['drawing']['dimensions']:
  name=dim['id'];picked=[]
  for key,want in zip(('a','b'),world[name]):
   ref=dim[key];e=edges[ref['edge']];ends=[verts[v] for v in e['vertices']];dist=[sum((a-z)**2 for a,z in zip(point,ref['near'])) for point in ends];need(abs(dist[0]-dist[1])>L,'unique actual native endpoint near hint');point=ends[0 if dist[0]<dist[1] else 1];vec(point,want,'independent original endpoint '+name+key);picked.append(point);signature=rd['expectedCaptureSignaturesByDimension'][name][key];vec(signature['p'],[(a+z)/2 for a,z in zip(*ends)],'observed current native cache centre');near(signature['s'],math.dist(*ends),'observed current native cache size');direction=unit(sub(ends[1],ends[0]));need(min(max(abs(a-z) for a,z in zip(signature['d'],direction)),max(abs(a+z) for a,z in zip(signature['d'],direction)))<=L,'observed current native line direction');references.append({'dimension':name,'endpoint':key,'edge':ref['edge'],'currentPoint':point,'storedSignature':ref['sig'],'currentNativeSignature':signature})
  row=resolved[name];need(row['ok'] is True and row['dim']==dim,'current exact authored dimension resolves');vec(row['a'],project(picked[0],dim['view']),'independent projected endpointa');vec(row['b'],project(picked[1],dim['view']),'independent projected endpointb');near(row['value'],values[name],'independent current native dimension');need(row.get('text',str(values[name]))==str(values[name]),'native current numeric label')
 need(len(rd['sheets'])==2,'both current sheet contexts');paper_rows=[]
 for index,row in enumerate(rd['sheets']):
  ids=['d2','d3'] if index==0 else ['d1'];views=['front','iso'] if index==0 else ['top'];settings=row['settings'];layout=row['layout'];need(row['sheetIndex']==index and settings['views']==views and [d['id'] for d in settings['dimensions']]==ids,'local authored view/dimension ownership');need(settings['revision']=='B' and settings['revisedModel']=='3336e060' and settings['sheetContext']['n']==index+1 and settings['sheetContext']['of']==2,'common stamp and local sheet context');vec(layout['size'],[297,210],'landscape A4mm');need(layout['scale']>0 and math.isfinite(layout['scale']),'positive declared paper scale')
  for view in views:
   placement=layout['views'][view];need(not placement.get('hidden') and not placement.get('breaks') and placement['scale']==layout['scale'],'same unbroken declared paper scale');marks=next(g['marks'] for g in row['groups'] if g['role']=='view' and g['view']==view);pr=rd['projection']['views'][view];expected_lines=[]
   for visible in (False,True):
    for edge in pr['edges']:
     for piece in edge['pieces']:
      if piece['visible']==visible and (visible or (settings['hidden'] and view!='iso')): expected_lines.append((paper(piece['curve']['a'],placement),paper(piece['curve']['b'],placement),'visible' if visible else 'hidden'))
   need(len(marks)==len(expected_lines),'complete current view marks under supported finite visibility')
   for mark,(a,z,pen) in zip(marks,expected_lines): need(mark['kind']=='line' and mark['pen']==pen and same_line(mark['a'],mark['b'],a,z),'independent world-to-view-to-paper line')
  need([g['id'] for g in row['dimensionGroups']]==ids,'native paper local dimension groups')
  for group in row['dimensionGroups']:
   ident=group['id'];dim=next(d for d in doc['drawing']['dimensions'] if d['id']==ident);placement=layout['views'][dim['view']];a,z=[project(p,dim['view']) for p in world[ident]]
   if dim['orient']=='horizontal': a[1]=z[1]=dim['place'][1]
   else: a[0]=z[0]=dim['place'][0]
   dimension_lines=[m for m in group['marks'] if m.get('role')=='dimension'];need(len(dimension_lines)==1 and same_line(dimension_lines[0]['a'],dimension_lines[0]['b'],paper(a,placement),paper(z,placement)),'independent authored dimension line paper location/length');texts=[m['text'] for m in group['marks'] if m['kind']=='text'];need(texts==[str(values[ident])],'independent native dimension label on paper')
  paper_rows.append({'sheetIndex':index,'views':views,'dimensions':{i:values[i] for i in ids},'scale':layout['scale'],'sizeMM':[297,210]})
 return {'nativeReferences':references,'sheets':paper_rows,'defaultAxes':AXES,'proofBoundary':'Only three default views of this exact convex box; independent original endpoint/visibility/frame/paper math, not arbitrary hidden-line layout.'}
def local_name(element): return element.tag.split('}')[-1]
def rounded(v):
 value=math.floor(v*10000+.5)/10000
 return 0 if value==0 else value

def svg_check(text,index,rd,h,src,title=None,exported=False):
 root=ET.fromstring(text);need(local_name(root)=='svg','original SVG XML root');vec([float(v) for v in root.attrib['viewBox'].split()],[0,0,297,210] if exported else [-6,-6,309,222],'exported A4paper viewBox' if exported else 'default padded UI paper viewBox')
 if exported: need(root.attrib.get('width')=='297mm' and root.attrib.get('height')=='210mm','actual export declares mmA4dimensions');need([e.text for e in root if local_name(e)=='title']==[title],'actual export current fallback/title custody')
 groups=[e for e in root.iter() if local_name(e)=='g'];role=lambda e:e.attrib.get('class','').split();views=['front','iso'] if index==0 else ['top'];ids=['d2','d3'] if index==0 else ['d1'];vgs=[e for e in groups if 'view' in role(e)];dgs=[e for e in groups if 'dimension' in role(e) and 'data-dim' in e.attrib];need([e.attrib.get('data-view') for e in vgs]==views and [e.attrib['data-dim'] for e in dgs]==ids,'SVG exact local view/dimension ownership');row=rd['sheets'][index];maximum=0.;labels={}
 for group in vgs+dgs:
  ident=group.attrib.get('data-dim');view=group.attrib.get('data-view');expected_group=next(g for g in row['groups'] if g['role']=='dimension' and g.get('id')==ident) if ident else next(g for g in row['groups'] if g['role']=='view' and g.get('view')==view)
  lines=[e for e in group if local_name(e)=='line'];marks=[m for m in expected_group['marks'] if m['kind']=='line'];need(len(lines)==len(marks),'serialized current local line count')
  for element,mark in zip(lines,marks):
   for key,value in [('x1',mark['a'][0]),('y1',mark['a'][1]),('x2',mark['b'][0]),('y2',mark['b'][1])]:
    residual=abs(float(element.attrib[key])-rounded(value));maximum=max(maximum,residual);near(residual,0,'existing four-decimal source-accurate SVG coordinate',1e-12)
  if ident:
   texts=[e.text or '' for e in group if local_name(e)=='text'];need(texts==[str({'d1':12,'d2':30,'d3':h}[ident])],'actualSVG independentlycorrect currentdimensiontext');labels[ident]=texts[0]
 titles=[e for e in groups if 'title' in role(e)];need(len(titles)==1,'one actual sheet titleblock');tt=[e.text or '' for e in titles[0].iter() if local_name(e)=='text'];scale=row['layout']['scale'];scale_text=str(int(scale))+':1' if scale>=1 else '1:'+str(int(1/scale));need('SRC '+src in tt and 'REV' in tt and tt[tt.index('REV')+1]=='B' and str(index+1)+' OF 2 A4' in tt and 'UNITS'in tt and tt[tt.index('UNITS')+1]=='mm' and 'SCALE'in tt and tt[tt.index('SCALE')+1]==scale_text,'actualSVG commonREV/currentSRC/localnumber/mm/declaredscale');
 if title is not None: need('TITLE'in tt and tt[tt.index('TITLE')+1]==title,'actualSVG currenttitle fallback')
 return {'sheetIndex':index,'dimensions':labels,'maximumExistingFourDecimalSerializerResidualMM':maximum,'declaredUnits':'mm','scale':scale,'SVGBytesAuthority':'Original actual downloaded UTF8 bytes' if exported else 'Original current DOM SVG string'}
def run(x):
 exp=expected(x['parameters']);h=x['parameters']['height'];need(len(SEED_TEXT.encode())==3891 and hashlib.sha256(SEED_TEXT.encode()).hexdigest()==SEED_SHA,'exact retained D486 saved3891Bsource');seed=json.loads(SEED_TEXT);need(x['seedDoc']==seed,'caller originalissuedB/H8seed');doc=x['doc'];validate_source(doc,seed,h);need(doc==x['expectedDoc'],'exact validated actual accepted baseline for history/project');rd=x['read'];text=x.get('documentJSON',rd['documentJSON']);need(rd['ok'] is True and rd['status']=='CAPTURED' and rd['inputUnchanged'] is True and rd['documentJSON']==text and json.loads(text)==doc==rd['reader']['doc'] and rd['reader']['notes']==[],'original rawcurrentDoc/native reader binding');need(hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256'] and rd['request']['parameters']==x['parameters'],'original wholeDoctext/hash/request');no_errors(rd,'read')
 need(rd['outputIds']==['n1'] and rd['bodyCount']==1 and rd['bodyKey']=='b1' and rd['outputId']=='n1' and rd['nativeBodyCount']==1 and len(rd['outputs'])==1 and rd['target']==rd['outputs'][0],'all outputs then sole originaln1/b1');raw=rd['outputs'][0];need(raw['outputId']=='n1' and raw['bodyKey']=='b1' and raw['nativeBodyCount']==1 and raw['representation'] in ('upright','planar'),'same exact native output');bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'all original BRepJSON/hash no reserializationauthority')
 need(rd['partDocument']=={'format':'barocss-cad-part','version':1,'units':'mm','parameters':{},'features':[{'id':'n0','kind':'sketch','profile':'rectangle','min':[0,0],'max':[30,12]},{'id':'n1','kind':'extrude','sketch':'n0','height':h}]} and rd['kernelExtrude']=={'id':'n1','kind':'extrude','sketch':'n0','height':h},'exact compiled originalsource');need(rd['drawingModel']==doc and json.loads(rd['drawingModelJSON'])==doc and hashlib.sha256(rd['drawingModelJSON'].encode()).hexdigest()==rd['drawingModelSHA256'],'labelled drawing-only source corresponds exactly to same originalpart')
 for key in ['defaultCheck','strict','outputCheck']:
  ck=raw[key];need(ck['valid'] is True and ck['issues']==[] and len(ck['topology'])==1 and ck['topology'][0]['genus']==0,'unchanged native '+key)
 need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'explicit native density1g/cm3 MMGS');bounds(raw['bounds'],exp['bounds'],'native boundary-aware box bounds');mass_errors={}
 for key in ['massProperties','brepMass']:
  m=raw[key];need(finite(m) and m['method'] in ('closed-form','planar-exact'),'nonmesh native boxmass');near(m['volume'],exp['volume'],key+' independent volume',L*exp['volume']);near(m['mass'],exp['massDensity1'],key+' independent density1grams');vec(m['centroid'],exp['centroid'],key+' independent centroid');mass_errors[key]={'volumeRelative':abs(m['volume']-exp['volume'])/exp['volume'],'massAbsoluteG':abs(m['mass']-exp['massDensity1']),'centroidAbsoluteMM':max(abs(a-z) for a,z in zip(m['centroid'],exp['centroid']))}
 need(rd['native']==dict(raw,documentSHA256=rd['documentSHA256'],mass=raw['massProperties'],check=raw['strict']) and rd['mass']==raw['massProperties'] and rd['brepMass']==raw['brepMass'] and rd['bounds']==raw['bounds'],'same original native aliases');physical=legacy_physical(rd,raw,h);geo=geometry(raw,exp);src=source_revision(doc);need(rd['expectedSourceRevision']==rd['currentSourceRevision']==src and rd['expectedDrawingRevisionPrint']==model_print(doc),'independent currentSRC16 and currentissueprint8 distinctroles');need(model_print(seed)=='3336e060' and (model_print(doc)!='3336e060')==(h==10),'issued-B/H8print remainsold atH10 only');paper_observation=drawing(rd,raw,doc,h,src);worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ONLY';worker_errors=None;dom=[];export=None
 if x.get('consumer') is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True,'exact actualcurrentconsumerDoc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==1 and w['bodies'][0]['key']=='b1','fresh actualWorker b1');body=w['bodies'][0];near(body['volume'],exp['volume'],'Worker independentvolume',L*exp['volume']);vec(body['centroid'],exp['centroid'],'Worker independentcentroid');worker_errors={'volumeRelative':abs(body['volume']-exp['volume'])/exp['volume'],'centroidAbsoluteMM':max(abs(a-z) for a,z in zip(body['centroid'],exp['centroid']))};worker='PASS_ORIGINAL_FRESH_STUDIO_DOC_WORKER';need(len(c['sheets'])==2 and {s['sheetIndex'] for s in c['sheets']}=={0,1},'two fresh actualsheets');title=doc['drawing'].get('title') or c.get('fileName');need(isinstance(title,str) and title,'actualcurrenttitle/fileName observation')
  for sheet in c['sheets']:
   i=sheet['sheetIndex'];need(sheet['doc']==doc and sheet['busy'] is False and sheet['revisionInput']=='B' and sheet['staleWarningCount']==(1 if h==10 else 0),'both settled actualsheets originalDoc/commonB/stale semantics');printed=sheet['printedSRC'];need(printed=='SRC '+src or printed==['SRC '+src],'actual currentSRC bothsheets');ids=['d2','d3'] if i==0 else ['d1'];summary=sheet['summary'];near(summary['scale'],rd['sheets'][i]['layout']['scale'],'actualdeclaredscale');need([d['id'] for d in summary['dimensions']]==ids and all('lost' not in d and d['value']==exp['dimensions'][d['id']] and d['text']==str(exp['dimensions'][d['id']]) for d in summary['dimensions']),'actual localdimension ownership/nativevalue/label');dom.append(svg_check(sheet['svg'],i,rd,h,src,title))
  if x.get('svgExport') is not None:
   witness=x['svgExport'];need(h==10 and witness['sheetIndex'] in (0,1),'only two selected postOpenH10SVGexport consumers');data=witness['bytes'];need(isinstance(data,list) and data and all(type(v)is int and 0<=v<=255 for v in data),'original actualdownloadbytes');data=bytes(data);need(hashlib.sha256(data).hexdigest()==witness['sha256'] and witness['documentSHA256']==rd['documentSHA256'] and witness['nativeBRepSHA256']==raw['nativeBRepSHA256'],'actualfilebytehash and pairedsameDoc/nativeclassprovenance');need(witness['title']==title and witness['filename']==c['fileName']+'-sheet-'+str(witness['sheetIndex']+1)+'.svg','actual selectedsheet/currentfilename/titleprovenance');download=data.decode('utf8');selected_dom=svg_check(witness['domSVG'],witness['sheetIndex'],rd,h,src,title);actual_file=svg_check(download,witness['sheetIndex'],rd,h,src,title,True);need(selected_dom['dimensions']==actual_file['dimensions'],'selected DOM/export file sameoriginalsheet/native sourceintent');export={'sha256':witness['sha256'],'bytes':len(data),'filename':witness['filename'],'title':title,'sheetIndex':witness['sheetIndex'],'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'file':actual_file,'selectedDOM':selected_dom,'proofBoundary':'Actualfilebytes/custody plus independent sameoriginalnative/paper/label/units checks; no Node-versus-Chrome byteequality requirement.'}
 return {'status':'PASS_ONE_DECLARED_D548_TWO_SHEET_POSTOPEN_STATE','parameters':x['parameters'],'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'expected':exp,'sourceRevision':src,'currentDrawingRevisionPrint':model_print(doc),'issuedRevision':'B','issuedStamp':'3336e060','stale':h==10,'massErrors':mass_errors,'geometry':geo,'retainedPurePhysical':physical,'drawing':paper_observation,'worker':worker,'workerErrors':worker_errors,'currentDOMSheets':dom,'actualSVGExport':export,'budgets':{'volumeRelative':L,'nativeGeometryAbsoluteMM':L,'normalComponent':L,'density1MassAbsoluteG':L,'SVGExistingFourDecimalSerializerResidualMM':1e-12},'limits':['Only retained issued-B two-sheet box H8/H10; no creation/NextC/general drawingfamily.','StoredH6/currentdeclaredheight caches are identitymetadata and never supplycurrentdimensionvalues.','WholeactualacceptedDocs remainexact for UndoRedo/project/nativecache, eachconsumerfreshlyobservesbothsheets.','Two actualcurrentSheetSVGexports; noPDF/DXF/font/raster/standard/coldprocess/mobileclaim.']}
if __name__=='__main__':
 try: print(json.dumps(run(json.load(sys.stdin)),indent=2,allow_nan=False))
 except Exception as exc: print(json.dumps({'status':'FAIL_D548_TWO_SHEET_POSTOPEN','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
// ROOT ONLY: esbuild TS stdin resolveDir apps/cad-studio targetnode22;
// node FRESH_EXTERNAL_BUNDLE.mjs /tmp/barocss-d548-control01
// Root wrapper retains module/import closure/expandedstrings/source-pins.json.
export const preflightSource=inspectorSource.slice(0,inspectorSource.indexOf(cli))+String.raw`
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {editFields} from '../../packages/barocss-cad-model/src/app/editFields.ts';
const config:any=${JSON.stringify(config)},states:any=${JSON.stringify(states)},seedText=${JSON.stringify(seedText)};
const output=resolve(process.argv[2]??'');assert.ok(output.startsWith('/tmp/barocss-d548-')&&!existsSync(output),'fresh owned external D548 output required');mkdirSync(output);
const save=(name:string,value:any)=>writeFileSync(join(output,name),typeof value==='string'?value:JSON.stringify(value,null,2));
const report:any={status:'RUNNING_D548_CURRENT_NATIVE_AB_AND_GUARD',sourceOrigin:config.sourceOrigin,seed:{path:config.seedPath,bytes:config.seedBytes,sha256:config.seedSHA256},rows:[],freshPositiveNativeCalls:0,negativeNativeCalls:0,independentPython:'NOT_RUN',actualStudio:'NOT_RUN',actualSVGExports:'NOT_RUN',historicalNativeReuse:0};
const persist=()=>save('receipt.json',report);let phase='original-input';persist();
try{
 const source=readFileSync(config.seedPath,'utf8');save('exact-retained-D486-issued-B-H8-source.bcad',source);assert.equal(Buffer.byteLength(source),config.seedBytes);assert.equal(sha(source),config.seedSHA256);assert.equal(source,seedText);const A=JSON.parse(source);assert.deepEqual(A,states.A.doc);
 for(const label of ['A','B']){
  phase=label;let doc:any;
  if(label==='A')doc=JSON.parse(source);
  else{
   const before=JSON.stringify(A),field=editFields(A.nodes,1,A.parameters).find((f:any)=>f.key==='h');assert.ok(field&&field.kind==='number'&&field.label==='Distance');assert.equal(field.get(A.nodes),8);doc={...A,nodes:field.set(A.nodes,10)};save('B-original-source-Distance10-candidate-before-assert.json',{owner:1,key:'h',label:'Distance',from:8,value:10,source:A,candidate:doc});assert.equal(JSON.stringify(A),before,'public setter must preserve original source');
  }
  const state=states[label],documentJSON=JSON.stringify(doc);save(label+'-actual.bcad',documentJSON);
  // Native wholeDoc/PartDoc/ALL original output BRep bytes precede validation;
  // drawing/projection and labelled legacy views reuse only those original objects.
  const read=inspect(doc,{label,parameters:state.parameters});report.freshPositiveNativeCalls++;const packet=JSON.stringify(read,null,2);save(label+'-native-before-assert.json',packet);
  const row:any={label,status:'CAPTURED_BEFORE_ASSERTIONS',parameters:state.parameters,packet:label+'-native-before-assert.json',packetSHA256:sha(packet),documentSHA256:read.documentSHA256,outputs:read.outputs.map((o:any)=>({outputId:o.outputId,nativeBRepSHA256:o.nativeBRepSHA256}))};report.rows.push(row);persist();
  save(label+'-oracle-input.json',{doc,documentJSON,expectedDoc:state.doc,seedDoc:A,read,parameters:state.parameters});
  assert.equal(documentJSON,state.documentJSON);assert.equal(sha(documentJSON),state.documentSHA256);assert.equal(read.ok,true,JSON.stringify(read.error));assert.equal(read.status,'CAPTURED');assert.equal(read.inputUnchanged,true);assert.deepEqual(read.reader,{doc,notes:[]});assert.equal(read.documentJSON,documentJSON);assert.deepEqual(read.outputIds,['n1']);assert.equal(read.bodyKey,'b1');assert.equal(read.nativeBodyCount,1);assert.equal(read.outputs.length,1);assert.deepEqual(read.target,read.outputs[0]);assert.deepEqual(read.kernelExtrude,{id:'n1',kind:'extrude',sketch:'n0',height:state.parameters.height});
  const raw=read.outputs[0];assert.equal(sha(raw.nativeBRepJSON),raw.nativeBRepSHA256);assert.deepEqual(JSON.parse(raw.nativeBRepJSON),raw.brep);assert.equal(raw.brep.bodies.length,1);assert.equal(raw.brep.bodies[0].kind,'solid');assert.equal(raw.brep.shells.length,1);assert.equal(raw.brep.shells[0].closed,true);
  for(const key of ['defaultCheck','strict','outputCheck']){const c=raw[key];assert.equal(c.valid,true,JSON.stringify(c));assert.deepEqual(c.issues,[]);assert.equal(c.topology.length,1);assert.equal(c.topology[0].genus,0);}
  assert.equal(read.projection.ok,true);assert.equal(read.sheets.length,2);assert.deepEqual(read.common,{revision:'B',revisedModel:'3336e060'});assert.equal(read.legacyView.originalNativeBRepSHA256,raw.nativeBRepSHA256);assert.equal(read.legacyView.read.native.rawBrep,raw.brep);
  Object.assign(row,{status:'PASS_ONE_CURRENT_D548_NATIVE_DRAWING_CLASS_ONLY',strict:raw.strict,mass:raw.massProperties,sourceRevision:read.expectedSourceRevision});persist();
 }
 phase='negative1';const base=JSON.parse(states.B.documentJSON),before=JSON.stringify(base),field=editFields(base.nodes,1,base.parameters).find((f:any)=>f.key==='h');assert.ok(field&&field.kind==='number'&&field.label==='Distance');const candidate={...base,nodes:field.set(base.nodes,0)};save('negative1-candidate-before-assert.bcad',JSON.stringify(candidate));save('negative1-original-source-Distance0-before-assert.json',{owner:1,key:'h',label:'Distance',value:0,source:base,candidate});assert.equal(JSON.stringify(base),before);
 const read=inspect(candidate,{label:'negative1',parameters:states.B.parameters,guard:config.guard});report.negativeNativeCalls++;const packet=JSON.stringify(read,null,2);save('negative1-native-before-assert.json',packet);const row:any={label:'negative1',status:'CAPTURED_BEFORE_ASSERTIONS',packet:'negative1-native-before-assert.json',packetSHA256:sha(packet),documentSHA256:read.documentSHA256,error:read.error};report.rows.push(row);persist();
 assert.equal(read.ok,false);assert.equal(read.inputUnchanged,true);assert.equal(read.error.code,config.guard.expectedCode);assert.equal(read.error.feature,config.guard.expectedFeature);assert.equal(read.error.message,config.guard.expectedMessage);assert.equal(read.documentJSON,JSON.stringify(candidate));row.status='PASS_EXPECTED_CURRENT_TYPED_REFUSAL';persist();
 const runtime={workId:'D548',sourceOrigin:config.sourceOrigin,sourceDoc:A,sourceDocA:A,seedPath:config.seedPath,seedBytes:config.seedBytes,seedSHA256:config.seedSHA256,originalSeedPath:config.seedPath,materializedSeedPath:join(output,'exact-retained-D486-issued-B-H8-source.bcad'),states,guard:config.guard,packetPaths:Object.fromEntries(['A','B'].map(label=>[label,join(output,label+'-native-before-assert.json')])),nativeAuthority:'TWO_NEW_CURRENT_NATIVE_DRAWING_POSITIVES_PLUS_ONE_SEPARATE_NEGATIVE_NO_HISTORICAL_PACKET_REUSE'};save('runtime-config.json',runtime);
 report.status='PASS_D548_CURRENT_NATIVE_AB_AND_GUARD';persist();console.log(JSON.stringify({status:report.status,output,rows:report.rows.map((r:any)=>({label:r.label,status:r.status,documentSHA256:r.documentSHA256,packetSHA256:r.packetSHA256})),runtimeConfig:join(output,'runtime-config.json')}));
}catch(cause){report.status='FAIL_D548_CURRENT_NATIVE_DRAWING_ADMISSION';report.firstFailure={phase,...error(cause)};persist();console.log(JSON.stringify({status:report.status,output,firstFailure:report.firstFailure}));process.exitCode=1;}
`;
