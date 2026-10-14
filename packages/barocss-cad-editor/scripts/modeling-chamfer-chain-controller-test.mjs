// Replay a preserved real #1625 transport through the actual controller; never rerun CAD.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const input = resolve(process.argv[2] ?? resolve(import.meta.dirname, 'fixtures/modeling-chamfer-chain/baseline-transport.json'));
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-chamfer-chain-real-controller'); mkdirSync(output, {recursive:true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({entryPoints:[resolve(root,'packages/barocss-cad-editor/src/modeling-controller.ts')],bundle:true,platform:'node',format:'esm',write:false,
  alias:{'@barocss/gpu':resolve(root,'packages/barocss-gpu/src/index.ts'),'@barocss/cad':resolve(root,'packages/barocss-cad/src/index.ts')}});
writeFileSync(resolve(output,'controller.mjs'),bundle.outputFiles[0].text);
const {createCadEditorModelingController:create} = await import(pathToFileURL(resolve(output,'controller.mjs')));
const bytes = readFileSync(input), native = JSON.parse(bytes), workers = [];
assert.equal(native.ok,true); assert.deepEqual(native.summary.parameters,{frontDistance:1,backDistance:2,backY:24});
assert.deepEqual(native.summary.features.map(feature => [feature.kind,feature.dependencies]),[['sketch',[]],['extrude',[0]],['chamfer',[1]],['chamfer',[2]]]);
assert.deepEqual(native.summary.outputs.map(o=>[o.name,o.volumeMM3]),[['part',{numerator:'6064',denominator:'1'}]]);
globalThis.Worker = class {
  callbacks=new Map(); requests=[];
  constructor(){workers.push(this);}
  addEventListener(kind,callback){this.callbacks.set(kind,callback);}
  postMessage(request){this.requests.push(request);}
  terminate(){}
  send(reply){this.callbacks.get('message')({data:{...structuredClone(reply),id:this.requests.at(-1).id}});}
};
const session=create(); let p=session.example('two-chamfer'); const worker=workers.at(-1); worker.send(native); await p;
assert.equal(session.getSnapshot().error,null); assert.deepEqual(session.getSnapshot().accepted,native.summary);
assert.equal(session.getSnapshot().display.scene.geometries.length,native.display.components[0].mesh.faces.length);
const accepted=session.getSnapshot(); session.select(3,accepted.generation);
let picked=null;
for(let y=4;y<160&&!picked;y+=8)for(let x=4;x<160&&!picked;x+=8){session.pick(160,160,x,y,accepted.generation);picked=session.getSnapshot().faceSelection;}
assert.ok(picked);assert.equal(picked.role,'part');assert.equal(picked.solidId,native.summary.outputs[0].solidId);
p=session.open(accepted.authoredText);worker.send(native);await p;
assert.equal(session.getSnapshot().error,null);assert.equal(session.getSnapshot().authoredText,native.text);
assert.equal(session.getSnapshot().history.count,1);assert.throws(()=>session.select(3,accepted.generation),/stale/);
const reopen=session.getSnapshot(); session.stage('backY','0');p=session.apply();worker.send({ok:false,message:'Native candidate refused'});await p;
assert.deepEqual(session.getSnapshot().accepted,reopen.accepted);assert.equal(session.getSnapshot().authoredText,native.text);
assert.deepEqual(session.getSnapshot().drafts,{backY:'0'});
session.discard(); session.stage('backDistance','3'); const prior=session.getSnapshot(); p=session.apply();
const forged=structuredClone(native), document=JSON.parse(forged.text);
document.parameters.backDistance=3;document.nodes[3].parent.node=1;
forged.text=JSON.stringify(document);forged.summary.parameters.backDistance=3;forged.summary.revision=1;forged.display.revision=1;
worker.send(forged);await p;assert.ok(session.getSnapshot().error);assert.deepEqual(session.getSnapshot().accepted,prior.accepted);assert.equal(session.getSnapshot().authoredText,native.text);
session.dispose();
const result={ok:true,actualNativeTransportReplays:2,sourceTransportSHA256:createHash('sha256').update(bytes).digest('hex'),checks:['real four-node serial chain','native output6064','actual CPU scene','CPU output picking','authored reopen','stale selection','simulated refusal retains accepted source and draft','second-parent tamper refusal'],evidence:'preserved real provider baseline DTO through actual controller with mocked Worker; no native geometry rerun, browser/GPU, physical file dialog or sample worker execution'};
writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
