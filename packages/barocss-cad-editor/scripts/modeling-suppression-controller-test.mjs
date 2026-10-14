// Adapt measured #1640 intent/negative mesh with the exactly body-equivalent #1631 positive mesh; CPU replay only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const input = resolve(process.argv[2] ?? resolve(import.meta.dirname, 'fixtures/modeling-suppression/baseline-native.json'));
const predecessorPath = resolve(import.meta.dirname, 'fixtures/modeling-chamfer-split/baseline-transport.json');
const providerPin = 'bf349441ec853a5349156d01a9e235e8b99e990e', predecessorPin = '3a7b7ea2712c739f1d7bbc8774301f821027e9e6';
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-suppression-adapted-controller'); mkdirSync(output, {recursive:true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({entryPoints:[resolve(root,'packages/barocss-cad-editor/src/modeling-controller.ts')],bundle:true,platform:'node',format:'esm',write:false,
  alias:{'@barocss/gpu':resolve(root,'packages/barocss-gpu/src/index.ts'),'@barocss/cad':resolve(root,'packages/barocss-cad/src/index.ts')}});
writeFileSync(resolve(output,'controller.mjs'),bundle.outputFiles[0].text);
const {createCadEditorModelingController:create} = await import(pathToFileURL(resolve(output,'controller.mjs')));
const bytes = readFileSync(input), transfer = JSON.parse(bytes), predecessorBytes = readFileSync(predecessorPath), predecessor = JSON.parse(predecessorBytes), workers = [];
const digest = b => createHash('sha256').update(b).digest('hex');
const proof = JSON.parse(execFileSync('git',['show',`${providerPin}:packages/barocss-cad/test/modeling-suppression-evidence/verification.json`],{cwd:root,encoding:'utf8'}));
const priorProof = JSON.parse(execFileSync('git',['show',`${predecessorPin}:packages/barocss-cad/test/modeling-chamfer-split-evidence/verification.json`],{cwd:root,encoding:'utf8'}));
assert.equal(proof.attempts[0].modelCalls,8);assert.equal(proof.attempts[0].tessellations,1); assert.equal(proof.actual.source.literalPredecessorBodyParity,true);
assert.deepEqual(proof.actual.source.transfer,{bytes:bytes.length,sha256:digest(bytes)});
assert.deepEqual(priorProof.actual.source.transport,{bytes:predecessorBytes.length,sha256:digest(predecessorBytes)});
assert.equal(transfer.bodySHA256,proof.actual.source.initialBodySHA256);assert.equal(transfer.bodySHA256,priorProof.actual.source.initialBodySHA256);
assert.deepEqual(transfer.negativeComponent,predecessor.display.components.find(c=>c.role==='negative'));
const native = structuredClone(predecessor); native.text=transfer.text;
native.summary.parameters=structuredClone(transfer.parameters);native.summary.features=structuredClone(transfer.features);native.summary.suppression=structuredClone(transfer.suppression);
native.display.components=native.display.components.map(c=>c.role==='negative'?structuredClone(transfer.negativeComponent):c);
assert.deepEqual(Object.keys(native.summary.parameters).sort(),['backDistance','backY','frontDistance']);
assert.deepEqual(native.summary.features.map(f=>[f.kind,f.dependencies]),[['sketch',[]],['extrude',[0]],['chamfer',[1]],['chamfer',[2]],['split',[3]]]);
assert.deepEqual([proof.actual.source.baseline.negativeMM3,proof.actual.source.baseline.positiveMM3],[3032,3032]);
assert.deepEqual(native.summary.outputs.map(o=>[o.name,o.volumeMM3]),[['negative',{numerator:'3032',denominator:'1'}],['positive',{numerator:'3032',denominator:'1'}]]);
const nodes=JSON.parse(native.text).nodes;assert.equal(nodes[4].at,16);assert.equal(nodes[4].axis,'x');assert.deepEqual(native.summary.suppression,{frontFinish:false,backFinish:false});
assert.deepEqual(nodes.filter(n=>n.name).map(n=>[n.name,n.suppressed]),[['frontFinish',false],['backFinish',false]]);
assert.deepEqual([proof.actual.source.plain.negativeMM3,proof.actual.source.frontOnly.negativeMM3,proof.actual.cold.reedited.negativeMM3],[3072,3064,3040]);
globalThis.Worker = class {
  callbacks=new Map(); requests=[];
  constructor(){workers.push(this);}
  addEventListener(kind,callback){this.callbacks.set(kind,callback);}
  postMessage(request){this.requests.push(request);}
  terminate(){}
  send(reply){this.callbacks.get('message')({data:{...structuredClone(reply),id:this.requests.at(-1).id}});}
};
const session=create(); let p=session.example('configurable-finishes'); const worker=workers.at(-1); worker.send(native); await p;
assert.equal(session.getSnapshot().error,null); assert.deepEqual(session.getSnapshot().accepted,native.summary);
const scene = session.getSnapshot().display;
assert.equal(scene.scene.geometries.length, native.display.components.reduce((sum, component) => sum + component.mesh.faces.length, 0));
assert.deepEqual(scene.scene.geometries.flatMap(geometry => geometry.indices), native.display.components.flatMap(component => component.mesh.indices));
const accepted=session.getSnapshot(); session.select(4,accepted.generation);
const roles = new Set(), hits = [];
for(let y=2;y<160&&roles.size<2;y+=4)for(let x=2;x<160&&roles.size<2;x+=4){
  session.pick(160,160,x,y,accepted.generation);
  const picked=session.getSnapshot().faceSelection;
  if(picked){assert.equal(picked.solidId,native.summary.outputs.find(o=>o.name===picked.role).solidId);if(!roles.has(picked.role))hits.push({x,y,role:picked.role,solidId:picked.solidId,faceId:picked.face.faceId,triangleIndex:picked.triangleIndex,approximate:picked.approximate});roles.add(picked.role);}
}
assert.deepEqual([...roles].sort(),['negative','positive']);
const ranges=native.display.components.map(component=>{
  const z=component.lineage.graph.vertices.map(v=>v.pointMM[0]);return {role:component.role,minX:Math.min(...z),maxX:Math.max(...z)};
});
assert.deepEqual(ranges,[{role:'negative',minX:0,maxX:16},{role:'positive',minX:16,maxX:32}]);
assert.notEqual(native.summary.outputs[0].solidId,native.summary.outputs[1].solidId);
p=session.open(accepted.authoredText);worker.send(native);await p;
assert.equal(session.getSnapshot().error,null);assert.equal(session.getSnapshot().authoredText,native.text);
assert.equal(session.getSnapshot().history.count,1);assert.throws(()=>session.select(4,accepted.generation),/stale/);
const reopen=session.getSnapshot(); session.stage('backY','1');p=session.apply();worker.send({ok:false,message:'Native candidate refused'});await p;
assert.deepEqual(session.getSnapshot().accepted,reopen.accepted);assert.equal(session.getSnapshot().authoredText,native.text);
assert.deepEqual(session.getSnapshot().drafts,{backY:'1'});
session.discard();session.stage('backDistance','3');const beforeTamper=session.getSnapshot();p=session.apply();
const tampered=structuredClone(native), document=JSON.parse(tampered.text);
document.parameters.backDistance=3;document.nodes[3].name='renamedFinish';tampered.text=JSON.stringify(document);
tampered.summary.parameters.backDistance=3;tampered.summary.features[3].name='renamedFinish';tampered.summary.suppression={frontFinish:false,renamedFinish:false};tampered.summary.revision=1;tampered.display.revision=1;
worker.send(tampered);await p;
assert.ok(session.getSnapshot().error);assert.deepEqual(session.getSnapshot().accepted,beforeTamper.accepted);
assert.equal(session.getSnapshot().authoredText,native.text);
session.dispose();
const result={ok:true,adaptedTransportReplays:2,providerPin,predecessorPin,sourceNativeTransferSHA256:digest(bytes),predecessorTransportSHA256:digest(predecessorBytes),exactBodyParitySHA256:transfer.bodySHA256,negativeMeshExactlyMatchesPredecessor:true,ranges,hits,checks:['three numeric drivers plus two named flags','actual provider four-state output volume proof','actual named-node metadata','two CPU outputs with complete face draws/picks','authored reopen','simulated refusal retains accepted source/draft','named feature identity tamper refusal'],evidence:'geometry-equivalent adapted transport: actual new authored save/summary/negative mesh plus prior positive mesh after pinned full-body parity; actual controller with mocked Worker; not a new two-body native tessellation, sample worker execution, browser/GPU or physical file flow'};
writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
