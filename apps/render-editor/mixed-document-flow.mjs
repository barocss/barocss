import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
assert.equal(process.argv[2], '--output'); assert(process.argv[3], 'Use --output <new-evidence-directory>');
const output = resolve(process.argv[3]); await mkdir(dirname(output), {recursive: true}); await mkdir(output);
const receipt = {issue: 1092, node: process.version, head: execFileSync('git', ['rev-parse','HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  mode: 'ordinary-pure-source-api-real-files', ok: false, actualGL: false, appMixedMode: false};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const result = await build({absWorkingDir: root, stdin: {contents: "export * from '@barocss/render-editor';", resolveDir: resolve(root,'apps/render-editor'), sourcefile: 'mixed-document-source-consumer.mjs'},
    bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022', metafile: true});
  const ownInputs = Object.keys(result.metafile.inputs).filter(path => /packages\/barocss-/.test(path));
  assert(ownInputs.some(path => path.endsWith('barocss-render-editor/src/mixed-frame.ts')));
  assert(ownInputs.some(path => path.endsWith('barocss-gpu/src/mixed-depth-frame.ts')));
  assert(ownInputs.some(path => path.endsWith('barocss-cad/src/model-compiler.ts')));
  assert(!ownInputs.some(path => path.includes('/dist/'))); assert(!Object.keys(result.metafile.inputs).some(path => /react(?:-dom)?\//.test(path)));
  const previous = new Map(); let api;
  try {
    for (const key of ['window','document','setTimeout','setInterval','requestAnimationFrame','addEventListener']) {
      previous.set(key, Object.getOwnPropertyDescriptor(globalThis,key)); Object.defineProperty(globalThis,key,{configurable:true,get(){throw Error('Pure root accessed '+key);}});
    }
    api = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
  } finally { for (const [key,descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key]; } }
  const sceneSource = `/* Original scene bytes, including "__NEGATIVE_ZERO__". */
@scene original_scene { version: 1; background: #14212d; sphere #orb; }
#orb { radius: .7; color: #d6b37a; }
`;
  const nativeSource = `/* Complete original model, not only its selected Surface. */
@model original_model {
 version: 0; length-unit: mm;
 @surface #sheet { type: nurbs; degree-u: 1; degree-v: 1;
  knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
  control-points: [[[-10,-0,10],[-10,10,10]],[[10,-0,10],[10,10,10]]];
  weights: [[1,2],[3,4]];
 }
 @curve #boundary { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[-10,-0,10],[10,-0,10]]; weights: [1,1]; }
 @curve #origin { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[-0,0,0],[1,0,0]]; weights: [24000,24000]; }
}
`;
  const input = {format:'barocss-render-editor',version:1,kind:'mixed-depth',documentId:'mixed_authoring',title:'Original source pair',revision:3,
    profile:'sdf-sphere-native-surface-v0',sourceVersion:1,sceneSource,camera:{eye:[-0,0,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100},
    asset:{assetId:'original_asset',revision:7,sourceVersion:0,source:nativeSource,modelId:'original_model',surfaceId:'sheet'},
    display:{mmToSceneUnit:.1,translate:[-0,0,0],color:[.3,.7,.9],countU:17,countV:17}};
  const prepared = api.prepareRenderMixedDocument(input);
  assert.deepEqual(prepared.metadata.nativeObjects.map(object => object.id),['sheet','boundary','origin']);
  assert.equal(prepared.metadata.objectId,'orb'); assert.equal(prepared.metadata.modelId,'original_model'); assert.equal(prepared.metadata.surfaceId,'sheet');
  assert.equal(prepared.metadata.vertexCount,289); assert.equal(prepared.metadata.triangleCount,512);
  assert.deepEqual(prepared.model.objects[0].weights,[[1,2],[3,4]]); assert(Object.is(prepared.model.objects[0].controlPoints[0][0][1],-0));
  assert.equal(prepared.frame.surface.ref.modelId,'original_model'); assert.equal(prepared.frame.surface.packet.surfaceId,'sheet');
  assert(Object.isFrozen(prepared.model.objects[0].controlPoints[0][0]) && Object.isFrozen(prepared.frame));
  input.asset.source = 'changed caller'; input.display.translate[0] = 9; input.camera.eye[0] = 9;
  assert.equal(prepared.document.asset.source,nativeSource); assert.equal(prepared.frame.translate[0],-0); assert.equal(prepared.frame.camera.eye[0],-0);
  const original = structuredClone(prepared.document), refusals=[];
  const refuse = (label, candidate, code) => { assert.throws(() => api.prepareRenderMixedDocument(candidate), error => error instanceof api.RenderMixedDocumentError && error.code===code); refusals.push(label); };
  refuse('unsupported version',{...original,version:2},'VERSION');
  refuse('profile',{...original,profile:'all-scene'},'VERSION');
  refuse('foreign model',{...original,asset:{...original.asset,modelId:'foreign'}},'QUALIFICATION');
  refuse('foreign Surface',{...original,asset:{...original.asset,surfaceId:'boundary'}},'QUALIFICATION');
  refuse('invalid original native source',{...original,asset:{...original.asset,source:'bad source'}},'SOURCE');
  refuse('invalid scene source',{...original,sceneSource:'bad source'},'SOURCE');
  refuse('extra original scene object',{...original,sceneSource:sceneSource.replace('sphere #orb;','sphere #orb; box #kept;')},'GPU');
  refuse('camera inside Sphere',{...original,camera:{...original.camera,eye:[0,0,0],target:[0,0,-1]}},'GPU');
  refuse('unsafe sample count',{...original,display:{...original.display,countU:18}},'INPUT');
  refuse('nonfinite display',{...original,display:{...original.display,mmToSceneUnit:NaN}},'INPUT');
  refuse('Source bytes',{...original,asset:{...original.asset,source:'x'.repeat(65537)}},'BYTES');
  refuse('derived packet must not become authoring',{...original,packet:prepared.frame.surface.packet},'INPUT');
  let getters=0; const getter = {...original}; Object.defineProperty(getter,'asset',{enumerable:true,get(){getters++;return original.asset;}}); refuse('getter',getter,'INPUT'); assert.equal(getters,0);
  const sparse = structuredClone(original); delete sparse.display.translate[1]; refuse('sparse array',sparse,'INPUT');
  const schemaOnly = api.copyRenderMixedDocument({...original,asset:{...original.asset,source:'bad source'}}); assert.equal(schemaOnly.asset.source,'bad source');
  const text = api.serializeRenderMixedDocument(prepared.document);
  assert.throws(() => api.parseRenderEditorDocument(text), error => ['DOCUMENT_INPUT','DOCUMENT_VERSION'].includes(error.code));
  assert.throws(() => api.parseRenderMixedDocument(' '.repeat(524289)), error => error.code==='BYTES');
  await writeFile(resolve(output,'authored.render-mixed.json'),text); await writeFile(resolve(output,'original.scene1.css'),sceneSource); await writeFile(resolve(output,'original.source0.css'),nativeSource);
  const disk = await readFile(resolve(output,'authored.render-mixed.json'),'utf8'), cold = api.prepareRenderMixedDocument(api.parseRenderMixedDocument(disk));
  assert.equal(cold.document.sceneSource,sceneSource); assert.equal(cold.document.asset.source,nativeSource);
  assert(Object.is(cold.document.camera.eye[0],-0) && Object.is(cold.document.display.translate[0],-0));
  assert.deepEqual(cold.model,prepared.model); assert.deepEqual(cold.frame,prepared.frame); assert.deepEqual(cold.metadata,prepared.metadata);
  assert.deepEqual(JSON.parse(disk),JSON.parse(text)); assert(!Object.keys(JSON.parse(disk)).some(key=>['frame','packet','model','metadata','ir','glsl'].includes(key)));
  Object.assign(receipt,{ok:true,headlessRoot:true,sourceInputs:ownInputs.length,ownDistInputs:0,getters,refusals,schemaIsNotAdmission:true,
    metadata:cold.metadata,originalModelObjects:cold.model.objects.length,originalWeights:prepared.model.objects[0].weights,
    signedZeroPreserved:true,sourceHashes:{scene:digest(sceneSource),native:digest(nativeSource)},file:{path:resolve(output,'authored.render-mixed.json'),bytes:Buffer.byteLength(disk),sha256:digest(disk)},
    originalSourcesAndNativeBitsColdRetained:true,derivedFrameReconstructed:true,serializedDerivedFields:false});
} catch(error) { receipt.firstFailure=error.stack??String(error); process.exitCode=1; }
await writeFile(resolve(output,'mixed-document-flow.json'),JSON.stringify(receipt,null,2)+'\n'); console.log(JSON.stringify(receipt,null,2));
