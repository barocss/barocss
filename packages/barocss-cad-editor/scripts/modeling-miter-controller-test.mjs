// Replay a preserved real #1637 transport through the actual controller; never rerun CAD.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const input = resolve(process.argv[2] ?? resolve(import.meta.dirname, 'fixtures/modeling-miter/baseline-transport.json'));
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-miter-real-controller'); mkdirSync(output, {recursive:true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({entryPoints:[resolve(root,'packages/barocss-cad-editor/src/modeling-controller.ts')],bundle:true,platform:'node',format:'esm',write:false,
  alias:{'@barocss/gpu':resolve(root,'packages/barocss-gpu/src/index.ts'),'@barocss/cad':resolve(root,'packages/barocss-cad/src/index.ts')}});
writeFileSync(resolve(output,'controller.mjs'),bundle.outputFiles[0].text);
const {createCadEditorModelingController:create} = await import(pathToFileURL(resolve(output,'controller.mjs')));
const bytes = readFileSync(input), native = JSON.parse(bytes), workers = [];
assert.equal(bytes.length,49139); assert.equal(createHash('sha256').update(bytes).digest('hex'),'74850cdff999f76a47a9c01b34b4a55fddc5a64aa95b7156f6fef6ab7cc7154f');
assert.equal(native.ok,true); assert.deepEqual(native.summary.parameters,{cutPosition:24});
assert.deepEqual(native.summary.features.map(f => [f.kind,f.dependencies]), [['sketch',[]],['extrude',[0]],['split',[1]]]);
const savedGraph = JSON.parse(native.text); assert.deepEqual(savedGraph.nodes[2],{kind:'split',parent:{node:1,side:'solid'},plane:'x+y',at:{parameter:'cutPosition'}});
assert.deepEqual(native.summary.outputs.map(o=>[o.name,o.volumeMM3]),[['negative',{numerator:'2304',denominator:'1'}],['positive',{numerator:'3840',denominator:'1'}]]);
globalThis.Worker = class {
  callbacks=new Map(); requests=[];
  constructor(){workers.push(this);}
  addEventListener(kind,callback){this.callbacks.set(kind,callback);}
  postMessage(request){this.requests.push(request);}
  terminate(){}
  send(reply){this.callbacks.get('message')({data:{...structuredClone(reply),id:this.requests.at(-1).id}});}
};
const session=create(); let p=session.example('miter-split'); const worker=workers.at(-1); worker.send(native); await p;
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
assert.deepEqual([...roles].sort(),['negative','positive']);
const ranges=native.display.components.map(component=>{
  const sums=component.lineage.graph.vertices.map(v=>v.pointMM[0]+v.pointMM[1]);
  assert.ok(sums.every(sum=>component.role==='negative'?sum<=24:sum>=24));
  return {role:component.role,minSum:Math.min(...sums),maxSum:Math.max(...sums)};
});
assert.deepEqual(ranges,[{role:'negative',minSum:0,maxSum:24},{role:'positive',minSum:24,maxSum:56}]);
assert.notEqual(native.summary.outputs[0].solidId,native.summary.outputs[1].solidId);
p=session.open(accepted.authoredText);worker.send(native);await p;
assert.equal(session.getSnapshot().error,null);assert.equal(session.getSnapshot().authoredText,native.text);
assert.equal(session.getSnapshot().history.count,1);assert.throws(()=>session.select(2,accepted.generation),/stale/);
const reopen=session.getSnapshot(); session.stage('cutPosition','60');p=session.apply();worker.send({ok:false,message:'Native candidate refused'});await p;
assert.deepEqual(session.getSnapshot().accepted,reopen.accepted);assert.equal(session.getSnapshot().authoredText,native.text);
assert.deepEqual(session.getSnapshot().drafts,{cutPosition:'60'});
session.discard();session.stage('cutPosition','32');const beforeTamper=session.getSnapshot();p=session.apply();
const tampered=structuredClone(native), document=JSON.parse(tampered.text);
document.parameters.cutPosition=32;document.outputs.negative.side='positive';tampered.text=JSON.stringify(document);
tampered.summary.parameters.cutPosition=32;tampered.summary.revision=1;tampered.display.revision=1;
worker.send(tampered);await p;
assert.ok(session.getSnapshot().error);assert.deepEqual(session.getSnapshot().accepted,beforeTamper.accepted);
assert.equal(session.getSnapshot().authoredText,native.text);
session.dispose();
const result={ok:true,actualNativeTransportReplays:2,sourceTransportSHA256:createHash('sha256').update(bytes).digest('hex'),ranges,hits,checks:['real split kind','native miter outputs2304/3840','two distinct CPU outputs with complete face draws','CPU picking of both named outputs','authored reopen','stale selection','simulated refusal retains accepted source/draft','output-side tamper refusal'],evidence:'preserved real provider baseline DTO through actual controller with mocked Worker; no native geometry rerun, browser/GPU, physical file dialog or sample worker execution'};
writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
