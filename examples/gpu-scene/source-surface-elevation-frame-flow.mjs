/** #1409: ONE complete Surface elevation/source/CPU-frame/file flow.
 * After affected GPU build, run with --fixtures <CAD1401 demo-output> --output <fresh directory>.
 * No browser, public raw-result codec, native history or coefficient oracle is used.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { prepareSurfaceElevationFrame } from './source-surface-elevation-frame-internal.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
function option(name){const i=process.argv.indexOf(name);assert(i>=0&&process.argv[i+1],name+' required');return resolve(process.argv[i+1]);}
const fixtures=option('--fixtures'),output=option('--output');
await mkdir(output,{recursive:false});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Private signed Number observations only. Decimal JSON round trips Binary64;
// the explicit -0 token retains its sign. This is not a public result codec.
function nativeJSON(value){
 if(typeof value==='number'){assert(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(ArrayBuffer.isView(value))return '['+Array.from(value,nativeJSON).join(',')+']';
 if(Array.isArray(value))return '['+value.map(nativeJSON).join(',')+']';
 return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+nativeJSON(value[key])).join(',')+'}';
}
const digest=value=>sha(nativeJSON(value)),clone=value=>JSON.parse(nativeJSON(value));
const pins=[['main-u-quartic.request.json',1367,'4926b3c5ec1c385c4473d1fcd68d5623cedc3d3fad6daea4cc056a7f5491778a'],
 ['main-u-quartic.result.json',46689,'8031547dbd251a0148bf9b8e655998c9d39f36fa1b1a4c2819853aad5f19e159']];
const values=[];
for(const [file,size,hash]of pins){const bytes=await readFile(resolve(fixtures,file));assert.equal(bytes.length,size);assert.equal(sha(bytes),hash);values.push(JSON.parse(bytes.toString('utf8')));}
const [request,reference]=values;
const sourcePath=resolve(output,'ordinary-providers.mjs');
const bundle=await build({stdin:{contents:`import * as cad from ${JSON.stringify(resolve(repo,'packages/barocss-cad/src/index.ts'))}; import * as gpu from ${JSON.stringify(resolve(repo,'packages/barocss-gpu/src/index.ts'))}; export {cad,gpu};`,resolveDir:repo},bundle:true,platform:'node',format:'esm',target:'node22',outfile:sourcePath,metafile:true});
const inputs=Object.keys(bundle.metafile.inputs);
assert(inputs.some(path=>path.endsWith('source-surface-degree-elevation.ts')));
assert(inputs.some(path=>path.endsWith('source-surface-control-net-wide.ts')));
assert(inputs.some(path=>path.endsWith('primitive-frame-preflight.ts')));
assert(!inputs.some(path=>path.includes('/dist/')),'Ordinary providers use source only');
const ordinary=await import(pathToFileURL(sourcePath).href);
const {cad}=ordinary;
for(const name of ['elevateSourceSurfaceAxisDegree','validateSourceSurfaceAxisDegreeElevation','editSourceSurfaceControlNetWide','validateSourceSurfaceControlNetWideEdit','evaluateSurface','tessellateSurface'])assert.equal(typeof cad[name],'function');
const emittedPath=resolve(repo,'packages/barocss-gpu/dist/index.js');
const emitted=await import(pathToFileURL(emittedPath).href);
const namespace=Object.keys(ordinary.gpu).sort();assert.deepEqual(Object.keys(emitted).sort(),namespace);
const declarations=await readFile(resolve(repo,'packages/barocss-gpu/dist/index.d.ts'),'utf8');
assert(declarations.includes('preparePrimitiveSceneFrame'));
const providers=[{label:'ordinary-source',path:sourcePath,gpu:ordinary.gpu},{label:'emitted-gpu',path:emittedPath,gpu:emitted}];
const callNames=['elevateSourceSurfaceAxisDegree','validateSourceSurfaceAxisDegreeElevation','editSourceSurfaceControlNetWide','validateSourceSurfaceControlNetWideEdit','tessellateSurface','preparePrimitiveSceneFrame'];
const ledger=[];
function counted(namespace,names,calls){const facade={...namespace};for(const name of names)facade[name]=(...args)=>{calls[name]++;return namespace[name](...args);};return facade;}
function buffers(record){return record.prepared.primitives.map(primitive=>Object.fromEntries(['positions','normals','indices'].map(name=>{const view=primitive[name];return[name,sha(Buffer.from(view.buffer,view.byteOffset,view.byteLength))];})));}
function frozen(value){if(value&&typeof value==='object'){assert(!ArrayBuffer.isView(value));assert(Object.isFrozen(value));Object.values(value).forEach(frozen);}}
function qualify(record,surface,revision){
 const {prepared,surfacePreview}=record,packet=surfacePreview.packet;
 assert.equal(prepared.primitives.length,1);assert.equal(prepared.bufferBytes,2712);
 assert.equal(prepared.frame.version,0);assert.equal(prepared.frame.scene.version,2);assert.equal(prepared.frame.particles,null);assert.deepEqual(prepared.frame.materials,[]);
 assert.equal(packet.revision,revision);assert.equal(packet.surfaceId,'main_surface');assert.equal(packet.lengthUnit,'mm');assert.equal(packet.coordinateSystem,'right-handed-y-up');
 assert.equal(packet.positions.length,243);assert.equal(packet.parameters.length,162);assert.equal(packet.indices.length,384);
 assert.equal(surfacePreview.report.normalMethod,'area-weighted-incident-triangle');assert.equal(surfacePreview.report.certified,false);
 const primitive=prepared.primitives[0];
 assert.deepEqual(primitive.entry.ref,{modelId:'original_surface_degree_model',geometryId:'main_surface'});
 assert(primitive.positions instanceof Float32Array);assert(primitive.normals instanceof Float32Array);assert(primitive.indices instanceof Uint16Array);
 for(let i=0;i<81;i++){const u=packet.parameters[2*i],v=packet.parameters[2*i+1];assert(u>=0&&u<=3&&v>=-2&&v<=2);assert.deepEqual(packet.positions.slice(3*i,3*i+3),cad.evaluateSurface(surface,u,v));}
 assert.deepEqual(Array.from(primitive.positions),packet.positions.map(value=>Math.fround(value*.01+0)));
 assert.deepEqual(Array.from(primitive.normals),packet.normals.map(Math.fround));assert.deepEqual(Array.from(primitive.indices),packet.indices);
 assert.notStrictEqual(primitive.entry.packet.positions,packet.positions);frozen(prepared.frame);
}
function preserved(elevation){
 assert.deepEqual(elevation,reference,'Actual public constructor matches whole pinned donor; donor is comparison data');
 assert.equal(elevation.model.name,'original_surface_degree_model');assert.equal(elevation.report.selectedObjectIndex,1);
 assert.deepEqual(elevation.model.objects.map(object=>[object.kind,object.id]),elevation.originalModel.objects.map(object=>[object.kind,object.id]));
 for(const i of [0,2])assert.deepEqual(elevation.model.objects[i],elevation.originalModel.objects[i]);
 assert.deepEqual(elevation.report.grids,{original:{u:5,v:5,total:25},elevated:{u:6,v:5,total:30}});
 assert.equal(elevation.surface.degreeU,5);assert.equal(elevation.surface.degreeV,4);
 assert.deepEqual(elevation.surface.knotsV,elevation.originalSurface.knotsV);
 const patches=elevation.provenance.patches;assert.equal(patches.length,4);
 let cursor=0,reconstructed='';
 for(const patch of patches){assert(patch.startUTF16>=cursor);assert.equal(request.source.slice(patch.startUTF16,patch.endUTF16),patch.originalText);reconstructed+=request.source.slice(cursor,patch.startUTF16)+patch.replacementText;cursor=patch.endUTF16;}
 reconstructed+=request.source.slice(cursor);assert.equal(reconstructed,elevation.source);
 assert(!elevation.provenance.copiedPoles.some(pole=>pole.elevatedUIndex===1&&pole.elevatedVIndex===0),'New edit is not an endpoint/join copy');
 assert(elevation.provenance.strips[0].calculation.spans[0].generated.some(pole=>pole.outputPoleIndex===1),'Actual selected strip generated this index');
 assert.equal(elevation.surface.controlPoints[1][0][0],1.6363636363636362);
}
const admissions=[],refusals=[],saved={},rows=[];
async function save(name,text){const path=resolve(output,name);await writeFile(path,text);saved[name]={path,sha256:sha(text),bytes:Buffer.byteLength(text)};return path;}
let expected,editRequest;
for(const provider of providers){
 const calls=Object.fromEntries(callNames.map(name=>[name,0]));
 const c=counted(cad,callNames.slice(0,5),calls),g=counted(provider.gpu,callNames.slice(5),calls);
 const originalRequest=clone(request),elevation=c.elevateSourceSurfaceAxisDegree(request);assert.deepEqual(request,originalRequest);preserved(elevation);
 const before=digest(elevation);
 const original=prepareSurfaceElevationFrame(c,g,elevation,{stage:'original'});qualify(original,elevation.originalSurface,0);
 const elevated=prepareSurfaceElevationFrame(c,g,elevation,{stage:'elevated'});qualify(elevated,elevation.surface,1);
 assert.equal(digest(elevation),before);assert.strictEqual(elevated.native,elevation);assert.notStrictEqual(elevated.validationReport,elevation.report);
 assert.deepEqual(elevated.validationReport,elevation.report);assert(!Object.isFrozen(elevated.validationReport));
 elevated.validationReport.observations[0].originalPointMM[0]+=1;assert.equal(digest(elevation),before,'Mutable report copy does not change native authority');
 // Retain the clean report for the actual saved/cold observation.
 elevated.validationReport.observations[0].originalPointMM[0]=elevation.report.observations[0].originalPointMM[0];
 editRequest={source:elevation.source,sourceVersion:0,surfaceId:'main_surface',edits:{poleEdits:[{uIndex:1,vIndex:0,xMM:1.7613636363636362}]}};
 const edit=c.editSourceSurfaceControlNetWide(editRequest),edited=prepareSurfaceElevationFrame(c,g,elevation,{stage:'edited',edit});
 qualify(edited,edit.surface,2);assert.equal(digest(elevation),before);assert.strictEqual(edited.nativeEdit,edit);
 assert.equal(edit.surface.controlPoints[1][0][0],1.7613636363636362);
 assert.deepEqual(edit.surface.weights,elevation.surface.weights);assert.deepEqual(edit.surface.knotsU,elevation.surface.knotsU);assert.deepEqual(edit.surface.knotsV,elevation.surface.knotsV);
 for(let u=0;u<6;u++)for(let v=0;v<5;v++)for(let axis=0;axis<3;axis++)if(!(u===1&&v===0&&axis===0))assert(Object.is(edit.surface.controlPoints[u][v][axis],elevation.surface.controlPoints[u][v][axis]));
 for(const i of [0,2])assert.deepEqual(edit.model.objects[i],elevation.model.objects[i]);
 assert.deepEqual(edit.originalModel,elevation.model);assert.deepEqual(edited.editValidationReport,edit.report);assert.notStrictEqual(edited.editValidationReport,edit.report);
 assert.notEqual(digest(cad.evaluateSurface(edit.surface,1.5,0)),digest(cad.evaluateSurface(elevation.surface,1.5,0)));
 const beforePoint=cad.evaluateSurface(elevation.surface,1.5,-2),afterPoint=cad.evaluateSurface(edit.surface,1.5,-2);
 // Independent rational Bernstein sensitivity for this one changed weighted pole.
 assert(Math.abs((afterPoint[0]-beforePoint[0])-.0171875)<2e-14);
 assert.equal(afterPoint[1],beforePoint[1]);assert.equal(afterPoint[2],beforePoint[2]);
 assert.notEqual(digest(edited.surfacePreview.packet.positions),digest(elevated.surfacePreview.packet.positions));
 const observe=record=>({elevationDigest:digest(record.native),reportDigest:digest(record.validationReport),frameDigest:digest(record.prepared.frame),packetDigest:digest(record.surfacePreview.packet),buffers:buffers(record),ref:record.prepared.primitives[0].entry.ref,revision:record.surfacePreview.packet.revision,...(record.nativeEdit?{editDigest:digest(record.nativeEdit),editReportDigest:digest(record.editValidationReport)}:{})});
 const actual={elevated:observe(elevated),edited:observe(edited)};
 if(expected)assert.deepEqual(actual,expected,'Ordinary and emitted GPU rebuild the same complete frames');else expected=actual;
 admissions.push({provider:provider.label,stages:['original','elevated','edited'],bufferBytes:2712});
 const retained={native:digest(elevation),edit:digest(edit),frame:digest(edited.prepared.frame),buffers:buffers(edited)};
 if(!saved['elevation.request.json']){await save('elevation.request.json',nativeJSON(request)+'\n');await save('original.source0.css',request.source);await save('elevated.source0.css',elevation.source);await save('edited.source0.css',edit.source);await save('edit.request.json',nativeJSON(editRequest)+'\n');}
 async function refuse(label,operation,name,code){let error;try{operation();}catch(actual){error=actual;}assert(error,label+' must refuse');if(name)assert.equal(error.name,name);if(code)assert.equal(error.code,code);refusals.push({provider:provider.label,label,name:error.name,code:error.code??null,message:error.message,cause:error.cause?.name??null});assert.equal(digest(elevation),retained.native);assert.equal(digest(edit),retained.edit);assert.equal(digest(edited.prepared.frame),retained.frame);assert.deepEqual(buffers(edited),retained.buffers);for(const file of Object.values(saved))assert.equal(sha(await readFile(file.path)),file.sha256);return error;}
 for(const [label,mutate]of [['source',value=>{value.source+=' ';}],['native-sibling',value=>{value.model.objects[0].controlPoints[0][0]+=1;}],['strip',value=>{value.provenance.strips[0].fixedPoleIndex=1;}],['report',value=>{value.report.maximumPointDifferenceMM+=1;}]]){const bad=clone(elevation);mutate(bad);await refuse('whole-elevation-'+label,()=>prepareSurfaceElevationFrame(c,g,bad,{stage:'elevated'}),'SourceSurfaceDegreeElevationError','OWNED');}
 for(const [label,mutate]of [['pole',value=>{value.surface.controlPoints[1][0][0]+=.125;}],['report',value=>{value.report.noOp=!value.report.noOp;}]]){const bad=clone(edit);mutate(bad);await refuse('whole-edit-'+label,()=>prepareSurfaceElevationFrame(c,g,elevation,{stage:'edited',edit:bad}),'SourceSurfaceControlNetWideError','OWNED');}
 let getters=0;const getter=clone(elevation);Object.defineProperty(getter,'request',{enumerable:true,get(){getters++;return request;}});await refuse('getter',()=>prepareSurfaceElevationFrame(c,g,getter,{stage:'elevated'}),'SourceSurfaceDegreeElevationError','OWNED');assert.equal(getters,0);
 const actualCause=new Error('actual caller reflection failure'),proxy=new Proxy(elevation,{ownKeys(){throw actualCause;}});
 const reflectionError=await refuse('reflection',()=>prepareSurfaceElevationFrame(c,g,proxy,{stage:'elevated'}),'Error');
 assert.strictEqual(reflectionError,actualCause,'This actual provider propagates the caller reflection Error directly');
 await refuse('stage',()=>prepareSurfaceElevationFrame(c,g,elevation,{stage:'invalid'}),'AssertionError');
 const detached=clone(edit);detached.request.source=request.source;await refuse('foreign-edit-source',()=>prepareSurfaceElevationFrame(c,g,elevation,{stage:'edited',edit:detached}));
 const frame=clone(edited.prepared.frame);frame.scene.entries.push(clone(frame.scene.entries[0]));await refuse('duplicate-native-ref',()=>g.preparePrimitiveSceneFrame(frame));
 const spare=prepareSurfaceElevationFrame(c,g,elevation,{stage:'edited',edit});spare.prepared.primitives[0].positions[0]=999;spare.prepared.primitives[0].normals[0]=999;spare.prepared.primitives[0].indices[0]=65535;assert.deepEqual(buffers(edited),retained.buffers);assert.equal(digest(elevation),retained.native);
 ledger.push({provider:provider.label,directPublicCalls:calls,nestedWholeReconstruction:'Each native whole validator performs its own real reconstruction; direct counts are not kernel telemetry',getterCalls:getters,reflectionAttempts:1});
 rows.push(actual);
}

const coldChildSource = "\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\nimport { pathToFileURL } from 'node:url';\nimport { createHash } from 'node:crypto';\n\nassert.equal(Number(process.versions.node.split('.')[0]), 22, 'Actual fresh Node22 child required');\nconst cfg = JSON.parse(await readFile(process.argv[2], 'utf8'));\nconst { cad } = await import(pathToFileURL(cfg.cadPath).href);\nassert(cad && typeof cad === 'object', 'Actual bundled ordinary-providers CAD namespace');\nconst { prepareSurfaceElevationFrame } = await import(pathToFileURL(cfg.helperPath).href);\nassert.equal(typeof prepareSurfaceElevationFrame, 'function');\nfor (const name of ['elevateSourceSurfaceAxisDegree', 'validateSourceSurfaceAxisDegreeElevation',\n  'editSourceSurfaceControlNetWide', 'validateSourceSurfaceControlNetWideEdit', 'tessellateSurface'])\n  assert.equal(typeof cad[name], 'function', 'Actual public CAD source provider ' + name);\nconst sha256 = value => createHash('sha256').update(value).digest('hex');\nfunction nativeJSON(value) {\n  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);\n  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }\n  assert(value && typeof value === 'object' && !ArrayBuffer.isView(value), 'Semantic value contains source data only');\n  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';\n  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + nativeJSON(value[key])).join(',') + '}';\n}\nconst digest = value => sha256(Buffer.from(nativeJSON(value), 'utf8'));\nassert.notEqual(digest(-0), digest(+0), 'Round-trip decimal observations preserve signed Number zeros');\nassert.notEqual(digest('-0'), digest('+0'), 'CSS/text signs remain distinct strings');\nfunction frozenFrame(value) {\n  if (value && typeof value === 'object') {\n    assert(!ArrayBuffer.isView(value), 'Canonical frame is frozen source data, not execution buffers');\n    assert(Object.isFrozen(value)); Object.values(value).forEach(frozenFrame);\n  }\n}\nconst paths = ['elevationRequestPath', 'originalCSSPath', 'elevatedCSSPath', 'editCSSPath', 'editRequestPath'];\nconst files = {};\nfor (const field of paths) { const bytes = await readFile(cfg[field]); files[field] = { text: bytes.toString('utf8'), bytes: bytes.length, sha256: sha256(bytes) }; }\nconst elevationRequest = JSON.parse(files.elevationRequestPath.text), editRequest = JSON.parse(files.editRequestPath.text);\nassert.equal(elevationRequest.source, files.originalCSSPath.text, 'Full original CSS is the saved public constructor request');\nassert.equal(editRequest.source, files.elevatedCSSPath.text, 'Fresh edit targets exactly the full elevated CSS');\nassert.equal(elevationRequest.sourceVersion, 0); assert.equal(editRequest.sourceVersion, 0);\nassert.equal(elevationRequest.surfaceId, 'main_surface'); assert.equal(editRequest.surfaceId, elevationRequest.surfaceId);\nassert.equal(elevationRequest.axis, 'u'); assert.equal(elevationRequest.targetDegree, 5); assert.equal(elevationRequest.maximumObservations, 1024);\nassert.equal(editRequest.edits.poleEdits.length, 1);\nassert.deepEqual(Object.keys(editRequest.edits.poleEdits[0]).sort(), ['uIndex', 'vIndex', 'xMM'].sort());\nassert.equal(editRequest.edits.poleEdits[0].uIndex, 1); assert.equal(editRequest.edits.poleEdits[0].vIndex, 0);\nconst requestBefore = nativeJSON(elevationRequest), editRequestBefore = nativeJSON(editRequest);\nconst rows = [];\nfor (const provider of cfg.providers) {\n  const imported = await import(pathToFileURL(provider.path).href);\n  const gpu = Object.hasOwn(imported, 'gpu') ? imported.gpu : imported;\n  assert(gpu && typeof gpu === 'object', 'Actual ordinary wrapper or direct emitted GPU namespace');\n  assert.deepEqual(Object.keys(gpu).sort(), cfg.namespace, 'Actual ' + provider.label + ' public GPU namespace');\n  const elevation = cad.elevateSourceSurfaceAxisDegree(elevationRequest);\n  assert.equal(elevation.source, files.elevatedCSSPath.text, 'Reconstructed complete elevated source spelling');\n  assert.equal(elevation.request.source, files.originalCSSPath.text);\n  assert.equal(elevation.model.name, 'original_surface_degree_model'); assert.equal(elevation.model.objects.length, 3);\n  assert.equal(elevation.provenance.selectedObjectIndex, 1); assert.equal(elevation.surface.id, 'main_surface');\n  assert.equal(elevation.surface.degreeU, 5); assert.equal(elevation.surface.degreeV, 4);\n  assert.equal(elevation.provenance.strips[0].calculation.spans[0].generated[0].outputPoleIndex, 1);\n  assert(!elevation.provenance.copiedPoles.some(pole => pole.elevatedUIndex === 1 && pole.elevatedVIndex === 0));\n  const elevationBefore = nativeJSON(elevation);\n  assert.equal(digest(elevation), cfg.expected.elevated.elevationDigest, 'Whole native elevation semantic digest');\n  const records = [];\n  records.push(['elevated', prepareSurfaceElevationFrame(cad, gpu, elevation, { stage: 'elevated' })]);\n  assert.equal(editRequest.edits.poleEdits[0].xMM, elevation.surface.controlPoints[1][0][0] + .125, 'New generated-pole consumer edit');\n  const edit = cad.editSourceSurfaceControlNetWide(editRequest);\n  assert.equal(edit.source, files.editCSSPath.text, 'Reconstructed complete edited source spelling');\n  assert.deepEqual(edit.originalModel, elevation.model); assert.equal(edit.request.source, elevation.source);\n  const editBefore = nativeJSON(edit);\n  records.push(['edited', prepareSurfaceElevationFrame(cad, gpu, elevation, { stage: 'edited', edit })]);\n  for (const [stage, record] of records) {\n    const expected = cfg.expected[stage], prepared = record.prepared, revision = stage === 'elevated' ? 1 : 2;\n    assert.equal(nativeJSON(elevation), elevationBefore, 'Helper does not mutate whole caller elevation');\n    assert.equal(digest(record.native), expected.elevationDigest);\n    assert.equal(digest(record.validationReport), expected.reportDigest, 'Independent report-only elevation validation');\n    assert.notStrictEqual(record.validationReport, elevation.report);\n    assert.equal(prepared.primitives.length, 1); assert.equal(prepared.bufferBytes, 2712);\n    assert.equal(prepared.frame.scene.entries.length, 1); assert.equal(prepared.frame.particles, null); assert.deepEqual(prepared.frame.materials, []);\n    frozenFrame(prepared.frame); assert.equal(digest(prepared.frame), expected.frameDigest, 'Frozen canonical source frame digest');\n    const ref = prepared.frame.scene.entries[0].ref; assert.deepEqual(ref, expected.ref);\n    assert.equal(ref.modelId, elevation.model.name); assert.equal(ref.geometryId, elevation.surface.id);\n    assert.equal(record.surfacePreview.packet.revision, revision); assert.equal(prepared.primitives[0].entry.packet.revision, revision);\n    assert.equal(digest(record.surfacePreview.packet), expected.packetDigest, 'Actual sampled Number packet, not an analytic normal certificate');\n    const buffers = prepared.primitives.map(primitive => Object.fromEntries(['positions', 'normals', 'indices'].map(name => {\n      const view = primitive[name]; assert(ArrayBuffer.isView(view));\n      return [name, sha256(Buffer.from(view.buffer, view.byteOffset, view.byteLength))];\n    })));\n    assert.deepEqual(buffers, expected.buffers, 'Actual independently regenerated typed execution bytes');\n    if (stage === 'elevated') {\n      assert.equal(record.nativeEdit, null); assert.equal(record.editValidationReport, null);\n    } else {\n      assert.equal(nativeJSON(edit), editBefore, 'Helper does not mutate whole caller edit');\n      assert.equal(digest(record.nativeEdit), expected.editDigest);\n      assert.equal(digest(record.editValidationReport), expected.editReportDigest);\n      assert.notStrictEqual(record.editValidationReport, edit.report);\n    }\n    rows.push({ provider: provider.label, stage, revision, elevationDigest: digest(record.native), reportDigest: digest(record.validationReport),\n      editDigest: stage === 'edited' ? digest(record.nativeEdit) : null,\n      editReportDigest: stage === 'edited' ? digest(record.editValidationReport) : null,\n      frameDigest: digest(prepared.frame), packetDigest: digest(record.surfacePreview.packet), buffers, ref,\n      bufferBytes: prepared.bufferBytes, frozenFrame: true, sourceCSS: {\n        original: sha256(Buffer.from(elevation.request.source, 'utf8')), elevated: sha256(Buffer.from(elevation.source, 'utf8')),\n        edited: stage === 'edited' ? sha256(Buffer.from(edit.source, 'utf8')) : null,\n      } });\n  }\n  assert.equal(nativeJSON(elevationRequest), requestBefore); assert.equal(nativeJSON(editRequest), editRequestBefore);\n}\nassert.equal(rows.length, 4, 'Two stages for each of the two actual GPU providers');\nfor (const field of paths) assert.equal(sha256(await readFile(cfg[field])), files[field].sha256, 'Cold qualification does not change saved source/request files');\nconsole.log(JSON.stringify({ node: process.version, rows, sourceFiles: Object.fromEntries(paths.map(field => [field,\n  { path: cfg[field], bytes: files[field].bytes, sha256: files[field].sha256 }])),\n  publicWorkScope: 'Per provider: one constructor, one wide edit, two helper stages; helper whole validators reconstruct internally. No producer campaign or fabricated kernel telemetry.',\n  rawResultReader: false, parentNativeOrIRInputs: false, actualGL: false }));\n";

const childPath=await save('cold-child.mjs',coldChildSource);
const configPath=await save('cold-config.json',JSON.stringify({cadPath:sourcePath,helperPath:resolve(repo,'examples/gpu-scene/source-surface-elevation-frame-internal.mjs'),providers:providers.map(({label,path})=>({label,path})),namespace,elevationRequestPath:saved['elevation.request.json'].path,originalCSSPath:saved['original.source0.css'].path,elevatedCSSPath:saved['elevated.source0.css'].path,editCSSPath:saved['edited.source0.css'].path,editRequestPath:saved['edit.request.json'].path,expected},null,2)+'\n');
const child=spawnSync(process.execPath,[childPath,configPath],{encoding:'utf8',maxBuffer:4*1024*1024,timeout:180000});
await writeFile(resolve(output,'cold.stdout'),child.stdout??'');await writeFile(resolve(output,'cold.stderr'),child.stderr??'');
assert.equal(child.status,0,'Genuine fresh child '+(child.stderr??''));assert.equal(child.stderr,'');
const cold=JSON.parse(child.stdout);assert.equal(cold.rows.length,4);
const result={issue:1409,nativeAuthority:'whole source/elevation and separate whole wide-edit results',namespaceCount:namespace.length,admissions,refusals,ledger,cold,observations:rows,saved,sourceInputs:inputs.length,allPublishedCAD:false,actualGL:false,rawResultCodec:false,currentRootFlow:false,publication:false};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify({issue:1409,admittedStages:admissions.length*3,refusals:refusals.length,coldRows:cold.rows.length,exports:namespace.length,actualGL:false})+'\n');
