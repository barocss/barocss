// D546: current CONTROLLED_SCRIPTED D121 bracket, not historical Studio provenance.
// Root owns all materialization, native, Python, reader and browser executions.
export const config={"sourceOrigin":"CONTROLLED_SCRIPTED_D121_CURRENT_DISPATCH_TOOL_NOT_HISTORICAL_STUDIO_DOC","fixturePath":"/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/test/fixtures/sheet-l-bracket.calls.json","fixtureBytes":1826,"fixtureSHA256":"4452e164457bcb22cc50093a2b52094d40ddcc3374f6423ee1571bff44dd11a5","fixtureText":"{\n \"about\": \"RB9 rung 5 (R12.5, D121): a sheet-metal L-bracket \\u2014 legs 40 and 30 to the outside of the bend, 30 wide, 1.5 mm sheet, inner radius 1.5, K 0.44 (the shop's, given in the brief), a \\u00d85.5 hole through each leg.\",\n \"calls\": [\n  {\n   \"tool\": \"features\",\n   \"args\": {\n    \"action\": \"command\",\n    \"command\": \"sheet-profile\",\n    \"values\": {\n     \"shape\": \"l\",\n     \"a\": 40,\n     \"b\": 30,\n     \"angle\": 90,\n     \"w\": 30,\n     \"t\": 1.5,\n     \"r\": 1.5,\n     \"k\": 0.44,\n     \"x\": 0,\n     \"y\": 0,\n     \"z\": 0\n    }\n   }\n  },\n  {\n   \"tool\": \"features\",\n   \"args\": {\n    \"action\": \"add\",\n    \"features\": [\n     {\n      \"kind\": \"sketch\",\n      \"profile\": \"circle\",\n      \"center\": [\n       25,\n       15\n      ],\n      \"radius\": 2.75,\n      \"plane\": {\n       \"origin\": [\n        0,\n        0,\n        -1\n       ],\n       \"normal\": [\n        0,\n        0,\n        1\n       ],\n       \"xAxis\": [\n        1,\n        0,\n        0\n       ]\n      }\n     },\n     {\n      \"kind\": \"extrude\",\n      \"sketch\": 1,\n      \"height\": 4\n     },\n     {\n      \"kind\": \"difference\",\n      \"parent\": {\n       \"node\": 0,\n       \"side\": \"solid\"\n      },\n      \"tool\": {\n       \"node\": 2,\n       \"side\": \"solid\"\n      }\n     },\n     {\n      \"kind\": \"sketch\",\n      \"profile\": \"circle\",\n      \"center\": [\n       15,\n       20\n      ],\n      \"radius\": 2.75,\n      \"plane\": {\n       \"origin\": [\n        -1,\n        0,\n        0\n       ],\n       \"normal\": [\n        1,\n        0,\n        0\n       ],\n       \"xAxis\": [\n        0,\n        1,\n        0\n       ]\n      }\n     },\n     {\n      \"kind\": \"extrude\",\n      \"sketch\": 4,\n      \"height\": 4\n     },\n     {\n      \"kind\": \"difference\",\n      \"parent\": {\n       \"node\": 3,\n       \"side\": \"solid\"\n      },\n      \"tool\": {\n       \"node\": 5,\n       \"side\": \"solid\"\n      }\n     }\n    ]\n   }\n  }\n ]\n}\n","canonicalPath":"/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/conformance/r12/accept-l-bracket.json","canonicalBytes":3685,"canonicalSHA256":"961e5a90a2ea69d69b9a480ad8165cfbe322b1a9f2c1553d7498d4a4c277a45e","canonicalText":"{\n  \"id\": \"r12-accept-l-bracket\",\n  \"step\": \"R12\",\n  \"decisions\": [\n    \"D121\"\n  ],\n  \"about\": \"RB9 rung 5 (R12.5): the sheet-metal L-bracket the agent builds (test/fixtures/sheet-l-bracket.calls.json): legs 40 and 30 outside, 30 wide, 1.5 sheet, R 1.5, K 0.44, a Ø5.5 hole in each leg.\",\n  \"input\": {\n    \"partDocument\": {\n      \"format\": \"barocss-cad-part\",\n      \"version\": 1,\n      \"units\": \"mm\",\n      \"parameters\": {},\n      \"features\": [\n        {\n          \"id\": \"n0\",\n          \"kind\": \"sheet-contour\",\n          \"path\": [\n            [\n              -1.83697019872103e-15,\n              30\n            ],\n            [\n              0,\n              0\n            ],\n            [\n              40,\n              0\n            ]\n          ],\n          \"plane\": {\n            \"origin\": [\n              0,\n              30,\n              0\n            ],\n            \"normal\": [\n              0,\n              -1,\n              0\n            ],\n            \"xAxis\": [\n              1,\n              0,\n              0\n            ]\n          },\n          \"side\": \"left\",\n          \"width\": 30,\n          \"thickness\": 1.5,\n          \"bendRadius\": 1.5,\n          \"kFactor\": 0.44\n        },\n        {\n          \"id\": \"n1\",\n          \"kind\": \"sketch\",\n          \"profile\": \"circle\",\n          \"center\": [\n            25,\n            15\n          ],\n          \"radius\": 2.75,\n          \"plane\": {\n            \"origin\": [\n              0,\n              0,\n              -1\n            ],\n            \"normal\": [\n              0,\n              0,\n              1\n            ],\n            \"xAxis\": [\n              1,\n              0,\n              0\n            ]\n          }\n        },\n        {\n          \"id\": \"n2\",\n          \"kind\": \"extrude\",\n          \"sketch\": \"n1\",\n          \"height\": 4\n        },\n        {\n          \"id\": \"n3\",\n          \"kind\": \"difference\",\n          \"target\": \"n0\",\n          \"tool\": \"n2\"\n        },\n        {\n          \"id\": \"n4\",\n          \"kind\": \"sketch\",\n          \"profile\": \"circle\",\n          \"center\": [\n            15,\n            20\n          ],\n          \"radius\": 2.75,\n          \"plane\": {\n            \"origin\": [\n              -1,\n              0,\n              0\n            ],\n            \"normal\": [\n              1,\n              0,\n              0\n            ],\n            \"xAxis\": [\n              0,\n              1,\n              0\n            ]\n          }\n        },\n        {\n          \"id\": \"n5\",\n          \"kind\": \"extrude\",\n          \"sketch\": \"n4\",\n          \"height\": 4\n        },\n        {\n          \"id\": \"n6\",\n          \"kind\": \"difference\",\n          \"target\": \"n3\",\n          \"tool\": \"n5\"\n        }\n      ]\n    }\n  },\n  \"expect\": {\n    \"outputs\": [\n      {\n        \"volume\": {\n          \"value\": 2967.768244759665,\n          \"relTol\": 1e-9\n        },\n        \"centroid\": {\n          \"value\": [\n            12.14109805412094,\n            14.999999999999991,\n            7.007842511490728\n          ],\n          \"absTol\": 1e-9\n        },\n        \"bodies\": 1,\n        \"topology\": [\n          {\n            \"shells\": 1,\n            \"genus\": 2\n          }\n        ],\n        \"flat\": {\n          \"area\": {\n            \"value\": 1974.2710130907637,\n            \"relTol\": 1e-12\n          },\n          \"loops\": 3,\n          \"bends\": [\n            {\n              \"name\": \"n0.bend1\",\n              \"direction\": \"down\",\n              \"angle\": 90\n            }\n          ]\n        }\n      }\n    ],\n    \"stepRoundTrip\": {\n      \"relTol\": 1e-9\n    }\n  },\n  \"oracle\": \"Closed form: the middle line 70 − 2(R + T) + (π/2)(R + T/2) × 30 × T less two holes; the flat (70 − BD) × 30 less two holes. Centroid by this kernel.\"\n}\n","canonicalPartDocument":{"format":"barocss-cad-part","version":1,"units":"mm","parameters":{},"features":[{"id":"n0","kind":"sheet-contour","path":[[-1.83697019872103e-15,30],[0,0],[40,0]],"plane":{"origin":[0,30,0],"normal":[0,-1,0],"xAxis":[1,0,0]},"side":"left","width":30,"thickness":1.5,"bendRadius":1.5,"kFactor":0.44},{"id":"n1","kind":"sketch","profile":"circle","center":[25,15],"radius":2.75,"plane":{"origin":[0,0,-1],"normal":[0,0,1],"xAxis":[1,0,0]}},{"id":"n2","kind":"extrude","sketch":"n1","height":4},{"id":"n3","kind":"difference","target":"n0","tool":"n2"},{"id":"n4","kind":"sketch","profile":"circle","center":[15,20],"radius":2.75,"plane":{"origin":[-1,0,0],"normal":[1,0,0],"xAxis":[0,1,0]}},{"id":"n5","kind":"extrude","sketch":"n4","height":4},{"id":"n6","kind":"difference","target":"n3","tool":"n5"}]},"dxfReaderPath":"/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/scripts/dxf-oracle.py","dxfReaderSHA256":"9a24b5e1d1632fd4629e4449f2a73007a2fd6fff84a25a21142700bb1b8e3a47","dxfPythonPath":"/Users/user/.cache/barocss-ezdxf/bin/python","readerRuntimeReceipt":"/tmp/barocss-d546-reader01/receipt.json","readerRuntimeJSON":"/tmp/barocss-d546-reader01/runtime.json","readerRuntimeFiles":["/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/scripts/dxf-oracle.py","/Users/user/.cache/barocss-ezdxf/lib/python3.12/site-packages/ezdxf/__init__.py","/opt/homebrew/Cellar/python@3.12/3.12.9/Frameworks/Python.framework/Versions/3.12/bin/python3.12","/Users/user/.cache/barocss-ezdxf/pyvenv.cfg"],"owner":"n6","bodyKey":"b6","parameters":{"A":{"thickness":1.5},"B":{"thickness":2}},"fields":{"B":{"index":0,"key":"t","label":"Thickness","value":2},"postOpen":{"index":0,"key":"t","label":"Thickness","value":1.5}},"guard":{"index":0,"key":"t","label":"Thickness","value":0,"expectedCode":"PARAMETER","expectedFeature":"n0","reason":"thickness must be positive"}};
export const builderFiles=['apps/cad-studio/test/b04-sheet-bracket-oracles.mjs'];
export const inputFiles=[config.fixturePath,config.canonicalPath,config.dxfReaderPath,config.readerRuntimeReceipt,config.readerRuntimeJSON,...config.readerRuntimeFiles];
export const retainedFiles=inputFiles;
export const oracleStatus='PASS_ONE_DECLARED_D546_SHEET_BRACKET_STATE';
export const inventoryContract='Freeze builderFiles/inputFiles, resolved dispatchTool/evaluatePart/compiler/native/flat/writer inputs, exact expanded TS/Python and actual materialization/runtime-config/Doc/native/reader packets. No historical native or invented authored seed reuse.';

export const inspectorSource=String.raw`
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readStudioDoc} from '../../packages/barocss-cad-model/src/engine/migrate.ts';
import {toPartDocument,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {evaluateCadPart,massPropertiesOf,brepMassProperties,checkBrep,checkOutput,faceGeometry,evaluateSurfaceD1,surfaceDomain,curveDomain,curveEvaluator,flatPatternOf,flatPatternDxf,writeDxf} from '../../packages/barocss-cad/src/index.ts';
import {stepValidationBounds} from '../../packages/barocss-cad/src/brep/brep-bounds.ts';
const sha=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const error=(e:any)=>({name:e?.name??null,code:e?.code??null,feature:e?.feature??null,message:String(e?.message??e)});
const safe=(fn:()=>any)=>{try{return fn();}catch(e){return {observationError:error(e)};}};
const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function inspect(doc:any,request:any={}){
 const documentJSON=JSON.stringify(doc),packet:any={ok:false,status:'FAIL_CAPTURE_READINESS',request,documentJSON,documentSHA256:sha(documentJSON),outputs:[]};
 try{
  packet.partDocument=toPartDocument(doc);const snapshot=evaluateCadPart(packet.partDocument);
  // Every original BRep is captured before selected checks/observations.
  for(const out of snapshot.outputs){const nativeBRepJSON=JSON.stringify(out.brep);packet.outputs.push({outputId:out.id,bodyKey:bodyKeyOf(out.id,doc.nodes),representation:out.representation,nativeBodyCount:out.bodyCount,brep:out.brep,nativeBRepJSON,nativeBRepSHA256:sha(nativeBRepJSON)});}
  packet.reader=safe(()=>readStudioDoc(documentJSON));
  snapshot.outputs.forEach((out:any,i:number)=>{const raw=packet.outputs[i],b=raw.brep;
   raw.massUnits={density:1,densityUnit:'g/cm3',volume:'mm3',mass:'g',centroid:'mm',authority:'massPropertiesOf/brepMassProperties MMGS'};raw.mass=safe(()=>massPropertiesOf(out,1));raw.brepMass=safe(()=>brepMassProperties(b,1));raw.bounds=safe(()=>stepValidationBounds(b));raw.productChecks={authority:'PRODUCT_OBSERVATIONS_NOT_INDEPENDENT_ORACLE',default:safe(()=>checkBrep(b)),strict:safe(()=>checkBrep(b,{strict:true})),output:safe(()=>checkOutput(out))};
   raw.sheetReport=out.sheet??null;
   raw.flat=safe(()=>flatPatternOf(out));raw.flatAuthority='flatPatternOf_ORIGINAL_LIVE_EVALUATED_OUTPUT; NOT_DESERIALIZED_BREP';
   raw.apiDxfAC1015=safe(()=>{const document=flatPatternDxf(raw.flat),written=writeDxf(document,{version:'AC1015'});return {authority:'CURRENT_API_WRITER_BYTES_NOT_BROWSER_EXPORT_OR_READER',version:'AC1015',document,text:written.text,bytes:Array.from(written.bytes),sha256:sha(written.bytes)};});
   raw.surfaces=b.faces.map((f:any)=>({id:f.id,name:f.name,geometry:safe(()=>faceGeometry(f)),probe:safe(()=>{const domain=surfaceDomain(f.surface);return {domain,probes:[[.25,.37],[.75,.63]].map(([a,z])=>{const u=domain.u[0]+a*(domain.u[1]-domain.u[0]),v=domain.v[0]+z*(domain.v[1]-domain.v[0]),d=evaluateSurfaceD1(f.surface,u,v),n=cross(d.du,d.dv),normalNorm=Math.hypot(...n),sign=f.sense==='forward'?1:-1;return {u,v,point:d.point,du:d.du,dv:d.dv,normal:n.map(x=>sign*x/normalNorm),normalNorm};})};})}));
   raw.edgeProbes=b.edges.map((e:any)=>({id:e.id,name:e.name,probe:safe(()=>{const[a,z]=curveDomain(e.curve),at=curveEvaluator(e.curve);return {domain:[a,z],samples:[0,.125,.25,.375,.5,.625,.75,.875,1].map(t=>at(a+(z-a)*t))};})}));
  });
  packet.bodyCount=packet.outputs.length;packet.outputIds=packet.outputs.map((o:any)=>o.outputId);packet.target=packet.outputs.length===1?packet.outputs[0]:null;packet.bodyKey=packet.target?.bodyKey??null;packet.ok=true;packet.status='CAPTURED';
 }catch(e){packet.error=error(e);}
 packet.inputUnchanged=JSON.stringify(doc)===documentJSON;return packet;
}
const inputFile=process.argv[2],inputBytes=readFileSync(inputFile,'utf8');
console.log(JSON.stringify({...inspect(JSON.parse(inputBytes),JSON.parse(process.argv[3]??'{}')),inputPath:inputFile,inputBytes,inputSHA256:sha(inputBytes)}));
`;

const cli='\nconst inputFile=';
if(!inspectorSource.includes(cli))throw Error('D546 observer CLI boundary');
// ROOT ONLY: TS stdin bundle from apps/cad-studio; CLI fresh /tmp/barocss-d546-control01.
export const preflightSource=inspectorSource.slice(0,inspectorSource.indexOf(cli))+String.raw`
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {emptyDoc} from '../../packages/barocss-cad-model/src/engine/doc.ts';
import {dispatchTool} from '../../packages/barocss-cad-model/src/chat/tools.ts';
import {evaluatePart} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {editFields} from '../../packages/barocss-cad-model/src/app/editFields.ts';
const config:any=${JSON.stringify(config)},output=resolve(process.argv[2]??'');assert.ok(output.startsWith('/tmp/barocss-d546-')&&!existsSync(output),'fresh owned D546 output');mkdirSync(output);
const save=(name:string,value:any)=>writeFileSync(join(output,name),typeof value==='string'?value:JSON.stringify(value,null,2));
const receipt:any={status:'RUNNING_D546_CONTROLLED_SCRIPTED_ADMISSION',sourceOrigin:'CONTROLLED_SCRIPTED_D121_CURRENT_DISPATCH_TOOL_NOT_HISTORICAL_STUDIO_DOC',constructionEvaluateCalls:0,constructionCalls:[],rows:[],independentPython:'NOT_RUN',dxfReader:'NOT_RUN_API_BYTES_ONLY',actualStudio:'NOT_RUN'};const persist=()=>save('receipt.json',receipt);let phase='inputs';persist();
const evaluate=async(doc:any)=>{const index=++receipt.constructionEvaluateCalls,label='construction-evaluate'+index;save(label+'-actual.bcad',JSON.stringify(doc));save(label+'-part-before-evaluate.json',safe(()=>toPartDocument(doc)));persist();const result=await evaluatePart(doc,1);save(label+'-result-before-assert.json',result);return result;};
function edited(doc:any,value:number){const before=JSON.stringify(doc),f=editFields(doc.nodes,0,doc.parameters).find((f:any)=>f.key==='t');assert.ok(f&&f.kind==='number'&&f.label==='Thickness');const candidate={...doc,nodes:f.set(doc.nodes,value)};save('typed-thickness'+value+'-source-before-assert.json',{source:doc,field:{index:0,key:'t',label:'Thickness',value},candidate});assert.equal(JSON.stringify(doc),before);return candidate;}
function capture(label:string,doc:any,parameters:any){phase=label;const documentJSON=JSON.stringify(doc);save(label+'-actual.bcad',documentJSON);const read=inspect(doc,{label,parameters}),bytes=JSON.stringify(read,null,2);save(label+'-native-before-assert.json',bytes);const row:any={label,status:'CAPTURED_BEFORE_ASSERTIONS',parameters,documentSHA256:read.documentSHA256,packet:label+'-native-before-assert.json',packetSHA256:sha(bytes),outputs:read.outputs.map((o:any)=>({outputId:o.outputId,nativeBRepSHA256:o.nativeBRepSHA256}))};receipt.rows.push(row);persist();return {read,row};}
try{
 const fixtureBytes=readFileSync(config.fixturePath,'utf8'),canonicalBytes=readFileSync(config.canonicalPath,'utf8');save('original-D121-fixture.json',fixtureBytes);save('original-D121-canonical.json',canonicalBytes);assert.equal(Buffer.byteLength(fixtureBytes),config.fixtureBytes);assert.equal(sha(fixtureBytes),config.fixtureSHA256);assert.equal(Buffer.byteLength(canonicalBytes),config.canonicalBytes);assert.equal(sha(canonicalBytes),config.canonicalSHA256);assert.equal(fixtureBytes,config.fixtureText);assert.equal(canonicalBytes,config.canonicalText);
 const fixture=JSON.parse(fixtureBytes),canonical=JSON.parse(canonicalBytes),initial=emptyDoc();let state:any={doc:initial,bodies:[],turnBase:emptyDoc()};
 for(let i=0;i<fixture.calls.length;i++){
  phase='construction-call'+(i+1);const call=fixture.calls[i];save(phase+'-input.json',{call,sourceDoc:state.doc});const result=await dispatchTool(state,call.tool,call.args,evaluate);save(phase+'-original-result-before-assert.json',result);save(phase+'-accepted-source-before-assert.bcad',JSON.stringify(result.state.doc));save(phase+'-part-before-assert.json',safe(()=>toPartDocument(result.state.doc)));receipt.constructionCalls.push({index:i+1,call,resultIsError:result.isError,documentSHA256:sha(JSON.stringify(result.state.doc))});persist();assert.equal(result.isError,false,result.content);state=result.state;
 }
 const A=state.doc,sourceDoc=JSON.parse(JSON.stringify(A)),actualPart=toPartDocument(A);save('materialized-A-current-PartDoc-before-assert.json',actualPart);save('materialized-A-source-before-assert.bcad',JSON.stringify(A));assert.deepEqual(actualPart,canonical.input.partDocument,'current fixture lowering equals exact canonical antecedent');assert.equal(A.nodes.length,7);assert.ok(A.nodes.every((n:any)=>!Object.hasOwn(n,'made')),'preserve actual unstamped sheet-contour/raw tools');assert.equal(A.nodes[0].kind,'sheet-contour');assert.equal(A.nodes[0].thickness,1.5);
 const B=edited(A,2),runtime:any={...config,sourceOrigin:receipt.sourceOrigin,sourceDoc,sourceDocumentSHA256:sha(JSON.stringify(A)),states:{}};
 for(const [label,doc,T]of [['A',A,1.5],['B',B,2]] as const){
  const parameters={thickness:T},{read,row}=capture(label,doc,parameters),documentJSON=JSON.stringify(doc);runtime.states[label]={doc,documentJSON,documentSHA256:sha(documentJSON),parameters,inputPath:join(output,label+'-actual.bcad')};save('runtime-config.json',runtime);save(label+'-oracle-input.json',{doc,documentJSON,expectedDoc:doc,sourceDoc,read,parameters});
  const dxf=read.outputs[0]?.apiDxfAC1015;if(dxf?.bytes)writeFileSync(join(output,label+'-flat-AC1015.dxf'),Buffer.from(dxf.bytes));
  assert.equal(read.ok,true,JSON.stringify(read.error));assert.equal(read.inputUnchanged,true);assert.deepEqual(read.reader,{doc,notes:[]});assert.deepEqual(read.outputIds,['n6']);assert.equal(read.bodyKey,'b6');assert.equal(read.outputs.length,1);const raw=read.outputs[0];assert.equal(sha(raw.nativeBRepJSON),raw.nativeBRepSHA256);assert.deepEqual(JSON.parse(raw.nativeBRepJSON),raw.brep);assert.equal(raw.nativeBodyCount,1);
  for(const key of ['default','strict','output']){const check=raw.productChecks[key];assert.equal(check.valid,true,JSON.stringify(check));assert.deepEqual(check.issues,[]);assert.equal(check.topology.length,1);assert.equal(check.topology[0].genus,2);}assert.equal(raw.sheetReport.thickness,T);assert.equal(raw.flat.thickness,T);assert.equal(raw.flat.loops.length,3);assert.equal(raw.flat.bends.length,1);assert.equal(raw.apiDxfAC1015.version,'AC1015');assert.equal(sha(Buffer.from(raw.apiDxfAC1015.bytes)),raw.apiDxfAC1015.sha256);row.status='PASS_ONE_CURRENT_D546_NATIVE_FLAT_CLASS_ONLY';persist();
 }
 const acceptedBefore=JSON.stringify(B),invalid=edited(B,0),{read,row}=capture('negative1',invalid,{attemptedFrom:{thickness:2},field:config.guard});assert.equal(read.ok,false);assert.equal(read.inputUnchanged,true);assert.equal(read.error.code,'PARAMETER');assert.equal(read.error.feature,'n0');assert.ok(read.error.message.includes('thickness must be positive'));assert.equal(JSON.stringify(B),acceptedBefore);row.status='PASS_EXPECTED_CURRENT_TYPED_REFUSAL';row.observedError=read.error;
 runtime.seedPath=runtime.states.A.inputPath;runtime.seedBytes=Buffer.byteLength(runtime.states.A.documentJSON);runtime.seedSHA256=runtime.states.A.documentSHA256;save('runtime-config.json',runtime);receipt.runtimeConfig={path:join(output,'runtime-config.json'),sourceDocumentSHA256:runtime.sourceDocumentSHA256,origin:receipt.sourceOrigin};receipt.status='PASS_D546_CURRENT_CONTROLLED_SCRIPTED_TWO_CLASSES_AND_GUARD';persist();console.log(JSON.stringify({status:receipt.status,output,constructionEvaluateCalls:receipt.constructionEvaluateCalls,positiveNativeCaptures:2,typedGuards:1}));
}catch(cause){receipt.status='FAIL_D546_CURRENT_CONTROLLED_SCRIPTED_ADMISSION';receipt.firstFailure={phase,...error(cause)};persist();console.log(JSON.stringify({status:receipt.status,output,firstFailure:receipt.firstFailure}));process.exitCode=1;}
`;

// Pure scalar/rational/graph algorithms follow the retained D539 finite-oracle method.
export const oracleSource=String.raw`
import copy,hashlib,json,math,sys,traceback
N=1e-9
CONFIG=json.loads(${JSON.stringify(JSON.stringify(config))})
def need(v,label):
 if not v: raise AssertionError(label)
def near(a,b,label,t=N):
 need(isinstance(a,(int,float)) and not isinstance(a,bool) and math.isfinite(a) and abs(a-b)<=t,f'{label}: {a} != {b}; budget {t}')
def vec(a,b,label,t=N):
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
 size=math.sqrt(dot(v,v));need(size>0,'nondegenerate direction');return [x/size for x in v]
def wrap(a): return math.atan2(math.sin(a),math.cos(a))
def deboor(points,knots,degree,t):
 n=len(points)-1;need(n>=degree>=0 and len(knots)==len(points)+degree+1,'original rational dimensions');lo,hi=knots[degree],knots[n+1];need(lo<=t<=hi and lo<hi,'original rational domain');k=n if t==hi else next(i for i in range(degree,n+1) if knots[i]<=t<knots[i+1]);q=[list(points[j]) for j in range(k-degree,k+1)]
 for r in range(1,degree+1):
  for j in range(degree,r-1,-1):
   i=k-degree+j;den=knots[i+degree-r+1]-knots[i];a=(t-knots[i])/den if den else 0;q[j]=[(1-a)*v+a*w for v,w in zip(q[j-1],q[j])]
 return q[degree]
def derivative(points,knots,degree,t):
 need(degree>=1,'positive rational degree');d=[]
 for i in range(len(points)-1):
  den=knots[i+degree+1]-knots[i+1];d.append([degree*(b-a)/den if den else 0 for a,b in zip(points[i],points[i+1])])
 return deboor(d,knots[1:-1],degree-1,t)
def domain(c): return c['knots'][c['degree']],c['knots'][len(c['controlPoints'])]
def curve(c,t):
 p=c['controlPoints'];w=c['weights'];need(len(p)==len(w) and all(v>0 for v in w),'positive original curve weights');q=deboor([[v*ww for v in pp]+[ww] for pp,ww in zip(p,w)],c['knots'],c['degree'],t);need(q[-1]>0,'positive curve denominator');return [v/q[-1] for v in q[:-1]]
def surface_d1(s,u,v):
 need(s['kind']=='surface','native rational surface');p=s['controlPoints'];w=s['weights'];need(len(p)==len(w) and all(len(a)==len(b) for a,b in zip(p,w)) and all(ww>0 for row in w for ww in row),'positive original surface weights');h=[[[q*ww for q in pp]+[ww] for pp,ww in zip(row,weights)] for row,weights in zip(p,w)];rows=[deboor(row,s['knotsV'],s['degreeV'],v) for row in h];rowsv=[derivative(row,s['knotsV'],s['degreeV'],v) for row in h];q=deboor(rows,s['knotsU'],s['degreeU'],u);du=derivative(rows,s['knotsU'],s['degreeU'],u);dv=deboor(rowsv,s['knotsU'],s['degreeU'],u);need(q[3]>0,'positive surface denominator');return [a/q[3] for a in q[:3]],[(a*q[3]-b*du[3])/q[3]**2 for a,b in zip(du[:3],q[:3])],[(a*q[3]-b*dv[3])/q[3]**2 for a,b in zip(dv[:3],q[:3])]
def expected_source(T):
 part=copy.deepcopy(CONFIG['canonicalPartDocument']);part['features'][0]['thickness']=T;nodes=[]
 for f in part['features']:
  n=copy.deepcopy(f)
  if n['kind']=='extrude':n['sketch']=int(n['sketch'][1:])
  elif n['kind']=='difference':n['parent']={'node':int(n.pop('target')[1:]),'side':'solid'};n['tool']={'node':int(n['tool'][1:]),'side':'solid'}
  nodes.append(n)
 return {'format':'barocss-cad-model','schema':3,'units':'mm','parameters':{},'nodes':nodes,'outputs':{'b6':{'node':6,'side':'solid'}},'nextId':7},part
def physical(T):
 R=1.5;W=30;r=2.75;s=R+T;vh=W*T*(40-s);vv=W*T*(30-s);vq=W*math.pi*(s*s-R*R)/4;q=4*(s**3-R**3)/(3*math.pi*(s*s-R*R));hole=math.pi*r*r*T;V=vh+vv+vq-2*hole;X=vh*(40+s)/2+vv*T/2+vq*(s-q)-hole*(25+T/2);Z=vh*T/2+vv*(30+s)/2+vq*(s-q)-hole*(20+T/2);BA=math.pi/2*(R+.44*T);L=70-2*s+BA
 return {'volume':V,'mass':V/1000,'centroid':[X/V,15,Z/V],'bounds':{'min':[0,0,0],'max':[40,30,30]},'flatLength':L,'flatArea':30*L-2*math.pi*r*r,'allowance':BA,'setback':s,'deduction':2*s-BA,'bendCentre':30-s+BA/2,'sectionArea':T*(70-2*s)+math.pi*(s*s-R*R)/4}
def specs(T):
 s=1.5+T;r=2.75;A=physical(T)['sectionArea'];planes=[]
 def pl(role,axis,at,n,area):planes.append({'role':role,'axis':axis,'at':at,'n':n,'area':area})
 pl('verticalOuter',0,0,[-1,0,0],30*(30-s)-math.pi*r*r);pl('verticalInner',0,T,[1,0,0],30*(30-s)-math.pi*r*r);pl('horizontalOuter',2,0,[0,0,-1],30*(40-s)-math.pi*r*r);pl('horizontalInner',2,T,[0,0,1],30*(40-s)-math.pi*r*r);pl('freeBaseEnd',0,40,[1,0,0],30*T);pl('freeLegEnd',2,30,[0,0,1],30*T);pl('yLow',1,0,[0,-1,0],A);pl('yHigh',1,30,[0,1,0],A)
 cylinders=[{'role':'bendInner','axis':1,'c':[s,s],'r':1.5,'sign':-1,'levels':[0,30],'quarter':True},{'role':'bendOuter','axis':1,'c':[s,s],'r':s,'sign':1,'levels':[0,30],'quarter':True},{'role':'horizontalBore','axis':2,'c':[25,15],'r':r,'sign':-1,'levels':[0,T],'quarter':False},{'role':'verticalBore','axis':0,'c':[15,20],'r':r,'sign':-1,'levels':[0,T],'quarter':False}]
 return planes,cylinders
def radial(q,c):
 keep=[i for i in range(3)if i!=c['axis']];v=[q[i]-x for i,x in zip(keep,c['c'])];return keep,v,math.hypot(*v)
def material(q,T,label):
 s=1.5+T;x,y,z=q;need(-N<=x<=40+N and -N<=y<=30+N and -N<=z<=30+N,label+' nominal material bounds');need((x>=s-N and -N<=z<=T+N)or(z>=s-N and -N<=x<=T+N)or(x<=s+N and z<=s+N and 1.5-N<=math.hypot(x-s,z-s)<=s+N),label+' two prisms/annular quadrant');need(math.hypot(x-25,y-15)>=2.75-N and math.hypot(y-15,z-20)>=2.75-N,label+' outside both orthogonal bores')
def angle(q,c):
 _,v,_=radial(q,c)
 return math.atan2(-v[1],-v[0]) if c['quarter'] else math.atan2(v[1],v[0])
def coverage(points,c,level):
 intervals=[];limit=math.pi/2 if c['quarter']else 2*math.pi;tol=N/c['r']
 for ps in points.values():
  if not all(abs(q[c['axis']]-level)<=N and abs(radial(q,c)[2]-c['r'])<=N for q in ps):continue
  aa=[angle(q,c)for q in ps];sweep=sum(wrap(z-a)for a,z in zip(aa,aa[1:]));need(abs(sweep)>0,'noncollapsed actual circular trim');start=aa[0]if sweep>0 else aa[-1];a=start%(2*math.pi)
  if abs(a-2*math.pi)<=tol:a=0.
  z=a+abs(sweep)
  if z<=2*math.pi+tol:intervals.append((a,min(z,2*math.pi)))
  else:intervals.extend([(a,2*math.pi),(0,z-2*math.pi)])
 need(intervals,'original circular boundary present');end=0.
 for a,z in sorted(intervals):need(a<=end+tol and z<=limit+tol,'complete nominal circular interval without gap/excess');end=max(end,z)
 near(end,limit,'complete nominal circular extent',tol);return len(intervals)
def planar_area(loop,co,edges,points,spec,circles):
 keep=[i for i in range(3)if i!=spec['axis']];area=0.
 for cid in loop['coedges']:
  use=co[cid];e=edges[use['edge']];ps=points[e['id']]if use['sense']=='forward'else list(reversed(points[e['id']]));a=[ps[0][i]for i in keep];z=[ps[-1][i]for i in keep];area+=(a[0]*z[1]-a[1]*z[0])/2
  if e['curve']['degree']!=1:
   matches=[c for c in circles if c['axis']==spec['axis']and all(abs(radial(q,c)[2]-c['r'])<=N for q in ps)];need(len(matches)==1,'unique source circular planar trim');c=matches[0];aa=[math.atan2(radial(q,c)[1][1],radial(q,c)[1][0])for q in ps];sweep=sum(wrap(z-a)for a,z in zip(aa,aa[1:]));area+=c['r']**2*(sweep-math.sin(sweep))/2
 return area
def geometry(raw,T):
 b=raw['brep'];need(finite(b),'finite original native coefficients');keys=['bodies','shells','faces','loops','coedges','edges','vertices'];tab={k:{v['id']:v for v in b[k]} for k in keys};need(all(len(tab[k])==len(b[k]) for k in keys),'unique original IDs');need(len(b['bodies'])==len(b['shells'])==1 and b['bodies'][0]['kind']=='solid' and b['shells'][0]['closed'],'one original closed solid for each live output');body,shell=b['bodies'][0],b['shells'][0];faces,loops,co,edges,verts=[tab[k] for k in keys[2:]];need(set(body['shells'])==set(tab['shells']) and shell['body']==body['id'] and set(shell['faces'])==set(faces),'complete original solid ownership');cap=1e-3*max(1,max(abs(x) for v in verts.values() for x in v['point']));points={};max_endpoint=0.;owned_l=[];owned_c=[];graph={f:set() for f in faces};pcurves=0;max_lift=None
 for v in verts.values(): need(0<v['tolerance']<=cap,'unchanged strict native vertex tolerance cap')
 for e in edges.values():
  need(0<e['tolerance']<=cap and len(e['vertices'])==2 and all(v in verts for v in e['vertices']),'original edge references/tolerance');a,z=domain(e['curve']);points[e['id']]=[curve(e['curve'],a+(z-a)*i/8) for i in range(9)]
  for p,vid in zip([points[e['id']][0],points[e['id']][-1]],e['vertices']): gap=math.dist(p,verts[vid]['point']);max_endpoint=max(max_endpoint,gap);near(gap,0,'independent original curve/vertex endpoint',min(N,e['tolerance']))
  if e['curve']['degree']==1:
   start,end=points[e['id']][0],points[e['id']][-1];v=sub(end,start);length=math.sqrt(dot(v,v));need(length>0,'noncollapsed original line');stations=[]
   for p in points[e['id']]: d=sub(p,start);near(math.sqrt(dot(cross(v,d),cross(v,d)))/length,0,'original straight-edge carrier');stations.append(dot(d,v)/length)
   need(all(z>=a-N for a,z in zip(stations,stations[1:])),'ordered original straight trim')
 for f in faces.values():
  need(f['shell']==shell['id'] and f['loops'],'face/shell reciprocity');owned_l+=f['loops']
  for lid in f['loops']:
   lp=loops[lid];need(lp['face']==f['id'] and lp['coedges'],'face/loop reciprocity');owned_c+=lp['coedges']
   for j,cid in enumerate(lp['coedges']):
    c=co[cid];nxt=co[lp['coedges'][(j+1)%len(lp['coedges'])]];need(c['loop']==lid and c['next']==nxt['id'] and c['prev']==lp['coedges'][j-1],'ordered original native loop');need(edges[c['edge']]['vertices'][1 if c['sense']=='forward' else 0]==edges[nxt['edge']]['vertices'][0 if nxt['sense']=='forward' else 1],'directed original loop endpoints')
 for c in co.values():
  twin=co[c['twin']];need(twin['twin']==c['id'] and twin['edge']==c['edge'] and twin['sense']!=c['sense'],'original opposed twins');graph[loops[c['loop']]['face']].add(loops[twin['loop']]['face'])
  if c.get('pcurve') is not None:
   pcurves+=1;e=edges[c['edge']];need(domain(c['pcurve'])==domain(e['curve']),'original pcurve domain');a,z=domain(e['curve'])
   for i in range(5):
    tt=a+(z-a)*i/4;uv=curve(c['pcurve'],tt);lift=surface_d1(faces[loops[c['loop']]['face']]['surface'],uv[0],uv[1])[0];gap=math.dist(lift,curve(e['curve'],tt));max_lift=max(max_lift or 0,gap);near(gap,0,'independent original pcurve lift',min(N,e['tolerance']))
 need(len(owned_l)==len(loops) and set(owned_l)==set(loops) and len(owned_c)==len(co) and set(owned_c)==set(co),'all original loops/coedges owned once')
 for eid in edges: need(sum(c['edge']==eid for c in co.values())==2,'two original edge uses')
 need(set(v for e in edges.values() for v in e['vertices'])==set(verts),'no orphan original vertices');seen=set();todo=[next(iter(faces))]
 while todo:
  f=todo.pop()
  if f not in seen: seen.add(f);todo+=list(graph[f]-seen)
 need(seen==set(faces),'one connected original material shell');chi=len(verts)-len(edges)+2*len(faces)-len(loops);genus=2;need(chi==2-2*genus,'independent original Euler/genus')
 need(b['format']=='barocss-brep'and b['version']==0 and b['lengthUnit']=='mm','original native format/mm units');planes,cylinders=specs(T);observed={s['id']:s for s in raw['surfaces']};need(len(observed)==len(raw['surfaces'])==len(faces)and set(observed)==set(faces),'all original surface observations');roles={};areas={p['role']:0. for p in planes};bands={c['role']:[]for c in cylinders};max_carrier=0.;max_point=0.;max_d1=0.;max_normal=0.
 for f in faces.values():
  ob=observed[f['id']];need(ob['name']==f.get('name'),'original name observation');g=ob['geometry'];matches=[]
  if g['kind']=='plane':matches=[('plane',p)for p in planes if abs(g['o'][p['axis']]-p['at'])<=N and math.dist(g['n'],p['n'])<=N]
  elif g['kind']=='cylinder':
   for c in cylinders:
    keep=[i for i in range(3)if i!=c['axis']];axis=[0,0,0];axis[c['axis']]=1
    if abs(g['r']-c['r'])<=N and math.dist([g['c'][i]for i in keep],c['c'])<=N and math.dist([abs(v)for v in g['a']],axis)<=N and g['out']==c['sign']:matches.append(('cylinder',c))
  need(len(matches)==1,'one finite source plane/cylinder carrier, no role widening');kind,s=matches[0];roles[f['id']]=s['role']
  def support(q):
   nonlocal max_carrier
   if kind=='plane':gap=abs(q[s['axis']]-s['at']);normal=s['n']
   else:
    keep,v,rho=radial(q,s);gap=abs(rho-s['r']);need(rho>0,'regular cylinder');normal=[0.,0.,0.];normal[keep[0]]=s['sign']*v[0]/rho;normal[keep[1]]=s['sign']*v[1]/rho
   near(gap,0,'independent nominal carrier equation');max_carrier=max(max_carrier,gap);return normal
  boundary=[q for lid in f['loops']for cid in loops[lid]['coedges']for q in points[co[cid]['edge']]]
  for q in boundary:support(q);material(q,T,'original face trim')
  if kind=='plane':
   directed=[];orientation=s['n'][s['axis']]*(-1 if s['axis']==1 else 1)
   for lid in f['loops']:
    a=planar_area(loops[lid],co,edges,points,s,cylinders);need(loops[lid]['kind']in ['outer','inner']and a*orientation*(1 if loops[lid]['kind']=='outer'else -1)>0,'original planar trim orientation agrees with outward carrier');directed.append(a)
   areas[s['role']]+=abs(sum(directed))
  else:
   bands[s['role']]+=boundary
   for q in boundary:
    need(s['levels'][0]-N<=q[s['axis']]<=s['levels'][1]+N,'source cylindrical trim extent')
    if s['quarter']:need(-N/s['r']<=angle(q,s)<=math.pi/2+N/s['r'],'source SW annular quarter trim')
  sf=f['surface'];U=[sf['knotsU'][sf['degreeU']],sf['knotsU'][len(sf['controlPoints'])]];V=[sf['knotsV'][sf['degreeV']],sf['knotsV'][len(sf['controlPoints'][0])]];need(ob['probe']['domain']=={'u':U,'v':V}and len(ob['probe']['probes'])==2,'original carrier domains')
  for i in range(5):
   for j in range(5):support(surface_d1(sf,U[0]+i*(U[1]-U[0])/4,V[0]+j*(V[1]-V[0])/4)[0])
  for q,(a,z)in zip(ob['probe']['probes'],[(.25,.37),(.75,.63)]):
   near(q['u'],U[0]+a*(U[1]-U[0]),'original U station');near(q['v'],V[0]+z*(V[1]-V[0]),'original V station');point,du,dv=surface_d1(sf,q['u'],q['v']);vec(q['point'],point,'independent rational point');vec(q['du'],du,'independent rational du');vec(q['dv'],dv,'independent rational dv');nn=[v*(1 if f['sense']=='forward'else -1)for v in unit(cross(du,dv))];vec(nn,support(point),'nominal outward normal');vec(q['normal'],nn,'observed native outward normal');need(q['normalNorm']>0,'regular actual derivatives');max_point=max(max_point,max(abs(a-b)for a,b in zip(q['point'],point)));max_d1=max(max_d1,max(abs(a-b)for a,b in zip(q['du']+q['dv'],du+dv)));max_normal=max(max_normal,max(abs(a-b)for a,b in zip(nn,support(point))))
 need(set(roles.values())=={p['role']for p in planes}|{c['role']for c in cylinders},'every nominal material carrier role present');area_errors={}
 for p in planes:near(areas[p['role']],p['area'],'independent directed plane trim area');area_errors[p['role']]=abs(areas[p['role']]-p['area'])
 rims=[]
 for c in cylinders:
  ps=bands[c['role']];vec([min(q[c['axis']]for q in ps),max(q[c['axis']]for q in ps)],c['levels'],'complete source cylindrical span')
  for level in c['levels']:rims.append({'role':c['role'],'level':level,'radius':c['r'],'intervals':coverage(points,c,level)})
 rim_roles=[(c,level,plane)for c in cylinders for level,plane in zip(c['levels'],['yLow','yHigh']if c['quarter']else['horizontalOuter','horizontalInner']if c['axis']==2 else['verticalOuter','verticalInner'])]
 for c,level,plane in rim_roles:
  found=[]
  for eid,ps in points.items():
   if all(abs(q[c['axis']]-level)<=N and abs(radial(q,c)[2]-c['r'])<=N for q in ps):need({roles[loops[u['loop']]['face']]for u in co.values()if u['edge']==eid}=={c['role'],plane},'original rim twin carrier ownership');found.append(eid)
  need(found,'complete rim carrier adjacency observed')
 s=1.5+T
 for x,z,role_a,role_b in [(0,s,'verticalOuter','bendOuter'),(T,s,'verticalInner','bendInner'),(s,0,'horizontalOuter','bendOuter'),(s,T,'horizontalInner','bendInner')]:
  candidates=[e for e in edges.values()if all(abs(q[0]-x)<=N and abs(q[2]-z)<=N for q in points[e['id']])and {roles[loops[u['loop']]['face']]for u in co.values()if u['edge']==e['id']}=={role_a,role_b}];need(len(candidates)==1,'one complete original tangent seam');ends=[verts[v]['point']for v in candidates[0]['vertices']];need(all(any(math.dist(q,[x,y,z])<=N for q in ends)for y in [0,30]),'full width tangent seam endpoints')
 probes={e['id']:e for e in raw['edgeProbes']};need(len(probes)==len(raw['edgeProbes'])and set(probes)==set(edges),'all original edge probes');max_edge=0.
 for eid,e in edges.items():
  ob=probes[eid];a,z=domain(e['curve']);need(ob['name']==e.get('name')and ob['probe']['domain']==[a,z]and len(ob['probe']['samples'])==9,'original edge observer stations')
  for i,q in enumerate(ob['probe']['samples']):p=curve(e['curve'],a+(z-a)*i/8);vec(q,p,'independent edge observation');max_edge=max(max_edge,max(abs(a-b)for a,b in zip(q,p)))
 bound={side:[fn(q[i]for ps in points.values()for q in ps)for i in range(3)]for side,fn in [('min',min),('max',max)]}
 for side in ['min','max']:vec(bound[side],physical(T)['bounds'][side],'original nominal boundary extrema')
 return {'counts':{k:len(raw['brep'][k])for k in keys},'genus':2,'carrierRoles':sorted(set(roles.values())),'planarAreaAbsoluteErrorsMM2':area_errors,'completeRims':rims,'originalBoundaryBounds':bound,'maximumEndpointGapMM':max_endpoint,'maximumCarrierResidualMM':max_carrier,'maximumRationalPointGapMM':max_point,'maximumIndependentD1GapMM':max_d1,'maximumOutwardNormalComponentError':max_normal,'maximumRationalEdgeGapMM':max_edge,'pcurveCount':pcurves,'pcurveStatus':'PASS_ORIGINAL_OPTIONAL_PCURVE_FINITE_WITNESSES'if pcurves else'NOT_EXERCISED_ORIGINAL_PCURVES_ABSENT','maximumPcurveLiftGapMM':max_lift}
def circle_loop(loop,label):
 segs=loop['segments'];need(segs and all(s['kind']=='arc'for s in segs),label+' actual circular arcs');c=segs[0]['center'];r=segs[0]['radius'];sweep=0.;area=0.
 for i,s in enumerate(segs):
  vec(s['center'],c,label+' common circle centre');near(s['radius'],r,label+' circle radius');near(math.dist(s['start'],c),r,label+' circle start');near(math.dist(s['end'],c),r,label+' circle end');vec(s['end'],segs[(i+1)%len(segs)]['start'],label+' directed closed arc loop');a=math.atan2(s['start'][1]-c[1],s['start'][0]-c[0]);z=math.atan2(s['end'][1]-c[1],s['end'][0]-c[0]);d=z-a
  if s['ccw']:
   while d<=0:d+=2*math.pi
  else:
   while d>=0:d-=2*math.pi
  sweep+=d;area+=(s['start'][0]*s['end'][1]-s['start'][1]*s['end'][0]+r*r*(d-math.sin(d)))/2
 near(sweep,-2*math.pi,label+' one clockwise hole');near(area,-math.pi*r*r,label+' independently integrated circle area');near(loop['area'],area,label+' original circle signed area');return c,r,area
def alignment(lines,circles,bend,T):
 e=physical(T);L=e['flatLength'];W=30;pts=[p for s in lines for p in [s['a'],s['b']]];accepted=[]
 for edge in lines:
  d=[edge['b'][i]-edge['a'][i]for i in range(2)];norm=math.hypot(*d)
  if norm<=N:continue
  for sign in [-1,1]:
   u=[sign*x/norm for x in d]
   for signv in [-1,1]:
    v=[-u[1]*signv,u[0]*signv];project=lambda p:[dot(p,u),dot(p,v)];qs=[project(p)for p in pts];lo=[min(q[i]for q in qs)for i in range(2)];hi=[max(q[i]for q in qs)for i in range(2)]
    if abs(hi[0]-lo[0]-L)>N or abs(hi[1]-lo[1]-W)>N:continue
    mapped=lambda p:[dot(p,u)-lo[0],dot(p,v)-lo[1]];holes=[mapped(c)for c in circles];wanted=[[10,15],[L-15,15]]
    if not all(any(math.dist(q,p)<=N for q in holes)for p in wanted):continue
    centre=[mapped(p)for p in bend['centre']];want_c=[[e['bendCentre'],0],[e['bendCentre'],30]]
    if not all(any(math.dist(q,p)<=N for q in centre)for p in want_c):continue
    intervals={i:[]for i in range(4)};valid=True
    for line in lines:
     a,z=map(mapped,[line['a'],line['b']]);matches=[]
     for i,(axis,at,other)in enumerate([(0,0,1),(0,L,1),(1,0,0),(1,W,0)]):
      if abs(a[axis]-at)<=N and abs(z[axis]-at)<=N:matches.append((i,sorted([a[other],z[other]])))
     if len(matches)!=1:valid=False;break
     i,interval=matches[0];intervals[i].append(interval)
    if not valid:continue
    for i,segments in intervals.items():
     end=0.;limit=W if i<2 else L
     for a,z in sorted(segments):
      if a>end+N or a<end-N or z<a-N or z>limit+N:valid=False;break
      end=max(end,z)
     if abs(end-limit)>N:valid=False
    if not valid:continue
    if 'tangents'in bend:
     tangents=[[mapped(p)for p in pair]for pair in bend['tangents']];expected=[30-e['setback'],30-e['setback']+e['allowance']]
     if not all(any(all(abs(q[0]-at)<=N for q in pair)and all(any(abs(q[1]-w)<=N for q in pair)for w in [0,30])for pair in tangents)for at in expected):continue
    accepted.append({'u':u,'v':v,'originProjected':lo,'holeLongCoordinates':sorted(q[0]for q in holes),'bendCentreLong':e['bendCentre']})
 need(accepted,'one single rigid alignment/reversal must explain rectangle, both holes, bend and tangents');return accepted[0]
def flat_checks(raw,T):
 flat=raw['flat'];report=raw['sheetReport'];e=physical(T);need(raw['flatAuthority']=='flatPatternOf_ORIGINAL_LIVE_EVALUATED_OUTPUT; NOT_DESERIALIZED_BREP','original LIVE native flat authority');need(report['thickness']==T and report['bendRadius']==1.5 and report['kFactor']==.44 and 'bendTable'not in report and report['fixedFace']=='n0.leg0.a','original sheet rules/fixed face/brief K');need(flat['thickness']==T and flat['kFactor']==.44 and flat['fixedFace'].split('#')[0]=='n0.leg0.a','current original flat rules/fixed face');need(len(report['bends'])==len(flat['bends'])==1,'one original bend');rb=report['bends'][0];bend=flat['bends'][0];need(rb['name']==bend['name']=='n0.bend1'and rb['inner']=='n0.bend1.inner'and rb['outer']=='n0.bend1.outer','original bend identities');near(rb['radius'],1.5,'sheet inner radius');near(rb['angle'],90,'sheet angle');near(rb['kFactor'],.44,'sheet brief K');near(rb['allowance'],e['allowance'],'sheet allowance');near(rb['setback'],e['setback'],'sheet setback');near(rb['deduction'],e['deduction'],'sheet deduction');vec(rb['axis']['origin'],[1.5+T,30,1.5+T],'original bend axis origin');vec(rb['axis']['direction'],[0,-1,0],'original bend axis direction');need(bend['direction']=='down'and 'table'not in bend,'one actual DOWN bend/no table');near(bend['angle'],90,'flat angle');near(bend['radius'],1.5,'flat inner radius');near(bend['kFactor'],.44,'flat brief K');near(bend['allowance'],e['allowance'],'flat allowance');need(set(bend['faces'])=={'n0.bend1.outer'},'original selected outer bend face')
 loops=flat['loops'];need(len(loops)==3 and sum(l['outer']for l in loops)==1,'one outer and two hole loops');outer=next(l for l in loops if l['outer']);lines=outer['segments'];need(lines and all(s['kind']=='line'for s in lines),'original linear outer rectangle');area=0.
 for i,s in enumerate(lines):vec(s['b'],lines[(i+1)%len(lines)]['a'],'closed original rectangle');area+=(s['a'][0]*s['b'][1]-s['a'][1]*s['b'][0])/2
 near(area,30*e['flatLength'],'independently integrated outer flat area',1e-12*max(1,30*e['flatLength']));near(outer['area'],area,'stored actual outer signed area');circles=[];holes_area=0.
 for i,l in enumerate(x for x in loops if not x['outer']):c,r,a=circle_loop(l,'hole'+str(i));near(r,2.75,'source nominal flat hole radius');circles.append(c);holes_area+=a
 fitted=alignment(lines,circles,bend,T);near(flat['area'],e['flatArea'],'independent nominal flat area',1e-12*max(1,e['flatArea']));near(flat['area'],area+holes_area,'actual integrated loops area');vec(flat['box']['min'],[0,0],'original flat translated box min');size=sorted(flat['box']['max']);near(size[0],30,'flat width',30e-12);near(size[1],e['flatLength'],'flat length',e['flatLength']*1e-12)
 dxf=raw['apiDxfAC1015'];need(dxf['authority']=='CURRENT_API_WRITER_BYTES_NOT_BROWSER_EXPORT_OR_READER'and dxf['version']=='AC1015','selected original API writer authority');need(all(type(v)is int and 0<=v<=255 for v in dxf['bytes'])and hashlib.sha256(bytes(dxf['bytes'])).hexdigest()==dxf['sha256'],'original CP1252 DXF bytes/hash, no UTF8 text substitution');return {'length':e['flatLength'],'width':30,'area':e['flatArea'],'singleAlignment':fitted,'originalFixedFace':flat['fixedFace'],'loopCount':3,'direction':'down','apiDxfSHA256':dxf['sha256'],'KAuthority':'BRIEF_VALUE_ONLY_NOT_SHOP_CALIBRATION'}
def dxf_checks(x,raw,T):
 if x.get('dxfReading')is None:return {'status':'NOT_SUPPLIED_NO_READER_CLAIM'}
 need(T==2,'actual selected export occurs on reopened B only');reading=x['dxfReading'];data=x['dxfBytes'];p=x['dxfProvenance'];need(all(type(v)is int and 0<=v<=255 for v in data),'actual file byte array');digest=hashlib.sha256(bytes(data)).hexdigest();need(digest==p['sha256']==p['readerInputSHA256'],'actual generated bytes/hash and original reader input join');reader_text=x['dxfReadingJSON'];need(json.loads(reader_text)==reading and hashlib.sha256(reader_text.encode()).hexdigest()==p['readerOutputSHA256'],'original reader stdout bytes/hash, not reserialized JSON');need(p['documentSHA256']==x['read']['documentSHA256']and p['nativeBRepSHA256']==raw['nativeBRepSHA256']and p['readerSHA256']==CONFIG['dxfReaderSHA256']and p['readerExit']==0,'actual exported B/reader source provenance');need(reading['ezdxf']=='1.4.5'and reading['dxfversion']=='AC1015'and reading['insunits']==4 and reading['audit']=={'errors':[],'fixes':[]},'independent current AC1015/mm reader audit');entities=reading['modelspace'];need(all(e['type']in ['LINE','CIRCLE','TEXT']for e in entities),'finite expected DXF entity kinds');lines=[e for e in entities if e['type']=='LINE'and e['layer']=='OUTLINE'];circles=[e for e in entities if e['type']=='CIRCLE'and e['layer']=='OUTLINE'];bends=[e for e in entities if e['type']=='LINE'and e['layer']=='BEND_DOWN'];notes=[e for e in entities if e['type']=='TEXT'and e['layer']=='BEND_NOTES'];need(len(circles)==2 and len(bends)==len(notes)==1 and len(entities)==len(lines)+4,'selected outline/two circles/oneDOWN/one note roles');need(all(abs(e['radius']-2.75)<=N for e in circles),'independently read nominal bores');need(lines,'independent reader has actual outer boundary lines');bend={'centre':[bends[0]['a'],bends[0]['b']]};align=alignment(lines,[c['center']for c in circles],bend,T);need(notes[0]['text']=='DOWN 90° R1.5','independently read existing bend note');mid=[(bends[0]['a'][i]+bends[0]['b'][i])/2 for i in range(2)];vec(notes[0].get('alignAt',notes[0]['at']),mid,'independently read bend-note centre');layers={l['name']:l for l in reading['layers']};need(all(n in layers for n in ['OUTLINE','BEND_UP','BEND_DOWN','BEND_NOTES'])and layers['BEND_DOWN']['linetype']=='DASHED','existing DXF layer/linetype roles');return {'status':'PASS_ONE_ACTUAL_B_AC1015_READER','fileSHA256':digest,'readerVersion':reading['ezdxf'],'audit':reading['audit'],'singleAlignment':align,'apiBytesEqualObservedOnly':data==raw['apiDxfAC1015']['bytes'],'entityCounts':{'OUTLINE_LINES':len(lines),'OUTLINE_CIRCLES':2,'BEND_DOWN':1,'BEND_NOTES':1},'units':'mm'}
def run(x):
 need(len(CONFIG['fixtureText'].encode())==CONFIG['fixtureBytes']and hashlib.sha256(CONFIG['fixtureText'].encode()).hexdigest()==CONFIG['fixtureSHA256'],'exact original D121 call fixture');need(len(CONFIG['canonicalText'].encode())==CONFIG['canonicalBytes']and hashlib.sha256(CONFIG['canonicalText'].encode()).hexdigest()==CONFIG['canonicalSHA256']and json.loads(CONFIG['canonicalText'])['input']['partDocument']==CONFIG['canonicalPartDocument'],'exact original canonical PartDoc antecedent')
 p=x['parameters'];need(set(p)=={'thickness'}and type(p['thickness'])in [int,float]and p['thickness']in [1.5,2],'only two declared finite thicknesses');T=p['thickness'];doc=x['doc'];expected,part=expected_source(T);original,_=expected_source(1.5);need(x['sourceDoc']==original and doc==expected==x['expectedDoc'],'observed current scripted source matches exact canonical owners/planes/tools; only sheet thickness changes');need(all('made'not in n for n in doc['nodes']),'actual unstamped source retained');rd=x['read'];text=x.get('documentJSON',rd['documentJSON']);need(rd['ok']is True and rd['status']=='CAPTURED'and rd['inputUnchanged']is True and rd['documentJSON']==text and json.loads(text)==doc and rd['reader']=={'doc':doc,'notes':[]},'current original raw Doc/reader');need(hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256']and rd['request']['parameters']==p and rd['partDocument']==part,'original Doc hash/current PartDoc/canonical source intent');need(rd['bodyCount']==1 and rd['outputIds']==['n6']and rd['bodyKey']=='b6'and len(rd['outputs'])==1 and rd['target']==rd['outputs'][0],'sole original n6/b6 output');raw=rd['outputs'][0];need(raw['outputId']=='n6'and raw['bodyKey']=='b6'and raw['nativeBodyCount']==1 and json.loads(raw['nativeBRepJSON'])==raw['brep']and hashlib.sha256(raw['nativeBRepJSON'].encode()).hexdigest()==raw['nativeBRepSHA256'],'original complete BRep bytes/hash/owner');need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'explicit density1 MMGS');e=physical(T);errors={}
 for name in ['default','strict','output']:
  q=raw['productChecks'][name];need(q['valid']is True and q['issues']==[]and len(q['topology'])==1 and q['topology'][0]['genus']==2,'current product '+name)
 for name in ['mass','brepMass']:
  m=raw[name];need(finite(m)and m['method']in ['closed-form','planar-exact','quadrature'],'native nonmesh mass');near(m['volume'],e['volume'],name+' independent volume',N*e['volume']);near(m['mass'],e['mass'],name+' density1 grams');vec(m['centroid'],e['centroid'],name+' independent first-moment centroid');errors[name]={'volumeRelative':abs(m['volume']-e['volume'])/e['volume'],'massAbsoluteG':abs(m['mass']-e['mass']),'centroidAbsoluteMM':max(abs(a-b)for a,b in zip(m['centroid'],e['centroid']))}
 need(isinstance(raw.get('bounds'),dict)and set(raw['bounds'])=={'min','max'},'current native helper bounds required; no synthesized substitute')
 for side in ['min','max']:vec(raw['bounds'][side],e['bounds'][side],'actual native bounds')
 geo=geometry(raw,T);flat=flat_checks(raw,T);reading=dxf_checks(x,raw,T);worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ADMISSION'
 if x.get('consumer')is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh']is True,'fresh actual consumer Doc');w=c['worker'];need(w['fresh']is True and w['massReady']is True and len(w['bodies'])==1 and w['bodies'][0]['key']=='b6','fresh Worker owner');near(w['bodies'][0]['volume'],e['volume'],'fresh Worker independent volume',N*e['volume']);vec(w['bodies'][0]['centroid'],e['centroid'],'fresh Worker independent centroid');worker='PASS_FRESH_ACTUAL_STUDIO_EXACT_DOC_WORKER'
 return {'status':'PASS_ONE_DECLARED_D546_SHEET_BRACKET_STATE','parameters':p,'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'sourceOrigin':'CONTROLLED_SCRIPTED_D121_CURRENT_DISPATCH_TOOL_NOT_HISTORICAL_STUDIO_DOC','expected':e,'massErrors':errors,'geometry':geo,'flat':flat,'dxfReading':reading,'worker':worker,'budgets':{'nativeVolumeRelative':N,'centroidBoundsBoundaryCarrierD1EndpointPcurveMM':N,'outwardNormalComponent':N,'density1MassAbsoluteG':N,'flatLengthAreaRelative':1e-12},'limits':['Only two declared thicknesses of this seven-node D121 bracket; current scripted materialization is not historical person-authored Studio or a live agent.','Complete original graph/nominal rims/trims plus finite rational/normal/presentUV witnesses are not full-domain/general sheet or Boolean proof.','Native LIVE-output flat and one actual generated B AC1015 read remain distinct; raw API writer bytes are not a reader result.','K.44 is a brief value, not shop calibration/manufacturing validation. No table adoption, transform/angle/exporter/role/geometry expansion.','Rounded SVG/text, cold-process recovery, final resave, mobile/paid/download/release and held research are not qualified.']}
if __name__=='__main__':
 try:print(json.dumps(run(json.load(sys.stdin)),indent=2,allow_nan=False))
 except Exception as exc:print(json.dumps({'status':'FAIL_D546_SHEET_BRACKET_STATE','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
