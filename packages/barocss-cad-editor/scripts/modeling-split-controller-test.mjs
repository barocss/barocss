// Replay a preserved real #1619 transport through the actual controller; never rerun CAD.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const input = resolve(process.argv[2] ?? resolve(import.meta.dirname, 'fixtures/modeling-split/baseline-transport.json'));
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-split-real-controller'); mkdirSync(output, {recursive:true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({entryPoints:[resolve(root,'packages/barocss-cad-editor/src/modeling-controller.ts')],bundle:true,platform:'node',format:'esm',write:false,
  alias:{'@barocss/gpu':resolve(root,'packages/barocss-gpu/src/index.ts'),'@barocss/cad':resolve(root,'packages/barocss-cad/src/index.ts')}});
writeFileSync(resolve(output,'controller.mjs'),bundle.outputFiles[0].text);
const {createCadEditorModelingController:create} = await import(pathToFileURL(resolve(output,'controller.mjs')));
const bytes = readFileSync(input), native = JSON.parse(bytes), workers = [];
assert.equal(native.ok,true); assert.deepEqual(native.summary.parameters,{height:8,splitHeight:2});
assert.equal(native.summary.features.at(-1).kind,'split');
assert.deepEqual(native.summary.outputs.map(o=>[o.name,o.volumeMM3]),[['lower',{numerator:'1792',denominator:'1'}],['upper',{numerator:'5376',denominator:'1'}]]);
globalThis.Worker = class {
  callbacks=new Map(); requests=[];
  constructor(){workers.push(this);}
  addEventListener(kind,callback){this.callbacks.set(kind,callback);}
  postMessage(request){this.requests.push(request);}
  terminate(){}
  send(reply){this.callbacks.get('message')({data:{...structuredClone(reply),id:this.requests.at(-1).id}});}
};
const session=create(); let p=session.example('horizontal-split'); const worker=workers.at(-1); worker.send(native); await p;
assert.equal(session.getSnapshot().error,null); assert.deepEqual(session.getSnapshot().accepted,native.summary);
const scene = session.getSnapshot().display;
assert.equal(scene.scene.geometries.length, native.display.components.reduce((sum, component) => sum + component.mesh.faces.length, 0));
assert.deepEqual(scene.scene.geometries.flatMap(geometry => geometry.indices), native.display.components.flatMap(component => component.mesh.indices));
const accepted=session.getSnapshot(); session.select(2,accepted.generation);
const roles = new Set(), hits = [];
for(let y=2;y<160&&roles.size<2;y+=4)for(let x=2;x<160&&roles.size<2;x+=4){
  session.pick(160,160,x,y,accepted.generation);
  const picked=session.getSnapshot().faceSelection;
  if(picked){assert.equal(picked.solidId,native.summary.outputs.find(o=>o.name===picked.role).solidId);if(!roles.has(picked.role))hits.push({x,y,role:picked.role,solidId:picked.solidId,faceId:picked.face.faceId,triangleIndex:picked.triangleIndex,approximate:picked.approximate});roles.add(picked.role);}
}
assert.deepEqual([...roles].sort(),['lower','upper']);
const ranges=native.display.components.map(component=>{
  const z=component.lineage.graph.vertices.map(v=>v.pointMM[2]);return {role:component.role,minZ:Math.min(...z),maxZ:Math.max(...z)};
});
assert.deepEqual(ranges,[{role:'lower',minZ:0,maxZ:2},{role:'upper',minZ:2,maxZ:8}]);
assert.notEqual(native.summary.outputs[0].solidId,native.summary.outputs[1].solidId);
p=session.open(accepted.authoredText);worker.send(native);await p;
assert.equal(session.getSnapshot().error,null);assert.equal(session.getSnapshot().authoredText,native.text);
assert.equal(session.getSnapshot().history.count,1);assert.throws(()=>session.select(2,accepted.generation),/stale/);
const reopen=session.getSnapshot(); session.stage('splitHeight','0');p=session.apply();worker.send({ok:false,message:'Native candidate refused'});await p;
assert.deepEqual(session.getSnapshot().accepted,reopen.accepted);assert.equal(session.getSnapshot().authoredText,native.text);
assert.deepEqual(session.getSnapshot().drafts,{splitHeight:'0'});
session.discard();session.stage('splitHeight','4');const beforeTamper=session.getSnapshot();p=session.apply();
const tampered=structuredClone(native), document=JSON.parse(tampered.text);
document.parameters.splitHeight=4;document.outputs.lower.side='positive';tampered.text=JSON.stringify(document);
tampered.summary.parameters.splitHeight=4;tampered.summary.revision=1;tampered.display.revision=1;
worker.send(tampered);await p;
assert.ok(session.getSnapshot().error);assert.deepEqual(session.getSnapshot().accepted,beforeTamper.accepted);
assert.equal(session.getSnapshot().authoredText,native.text);
session.dispose();
const result={ok:true,actualNativeTransportReplays:2,sourceTransportSHA256:createHash('sha256').update(bytes).digest('hex'),ranges,hits,checks:['real split kind','native outputs1792/5376','two distinct CPU outputs with complete face draws','CPU picking of both named outputs','authored reopen','stale selection','simulated refusal retains accepted source/draft','output-side tamper refusal'],evidence:'preserved real provider baseline DTO through actual controller with mocked Worker; no native geometry rerun, browser/GPU, physical file dialog or sample worker execution'};
writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
