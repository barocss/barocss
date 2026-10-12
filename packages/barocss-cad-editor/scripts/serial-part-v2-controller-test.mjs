// CPU/controller proof using genuine saved native replies; does not rerun native geometry.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=resolve(import.meta.dirname,'../../..'), output=resolve(process.env.EVIDENCE_DIR??'/tmp/serial-v2-controller');mkdirSync(output,{recursive:true});
const require=createRequire(resolve(root,'package.json'));
const signedJSON=value=>JSON.stringify(value,(_key,v)=>Object.is(v,-0)?'__serial_negative_zero__':v).replaceAll('"__serial_negative_zero__"','-0');
const replies=JSON.parse(readFileSync(process.env.SERIAL_REPLIES,'utf8'));
const bundled=await require('esbuild').build({stdin:{contents:`export * from '${resolve(root,'packages/barocss-cad-editor/src/prism-feature-controller.ts')}'; export * from '${resolve(root,'packages/barocss-cad-editor/src/prism-feature-scene.ts')}';`,resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,alias:{'@barocss/gpu':resolve(root,'packages/barocss-gpu/src/index.ts')}});
writeFileSync(resolve(output,'controller.mjs'),bundled.outputFiles[0].text);
const {createCadEditorPrismFeatureController,preparePrismFeatureScene,pickPrismFeatureScene}=await import(pathToFileURL(resolve(output,'controller.mjs')));
const workers=[];
class Worker { callbacks=new Map();requests=[];terminated=false;constructor(){workers.push(this)}addEventListener(k,f){this.callbacks.set(k,f)}postMessage(c){this.requests.push(c)}terminate(){this.terminated=true}send(r){this.callbacks.get('message')({data:{...structuredClone(r),id:this.requests.at(-1).id}})}}
globalThis.Worker=Worker;
let checks=0;
const session=createCadEditorPrismFeatureController(undefined,undefined,2);
let pending=session.open(replies[0].text);let worker=workers.at(-1);assert.equal(worker.requests.at(-1).version,2);worker.send(replies[0]);await pending;assert.equal(session.getSnapshot().accepted.serial.finalSolidId,replies[0].summary.serial.finalSolidId);checks++;
for(const [parameter,value,reply] of [['parentHeight','6',replies[1]],['setback','2',replies[2]]]){session.stage(parameter,value);pending=session.apply();assert.deepEqual(worker.requests.at(-1).edits,[{parameterId:parameter,valueMM:Number(value)}]);worker.send(reply);await pending;assert.equal(session.getSnapshot().accepted.document.revision,reply.summary.document.revision);checks++}
pending=session.undo();assert.deepEqual(worker.requests.at(-1).edits,[{parameterId:'setback',valueMM:1}]);worker.send(replies[3]);await pending;checks++;
pending=session.redo();worker.send(replies[4]);await pending;assert.equal(session.getSnapshot().history.index,2);checks++;
const before=session.getSnapshot();session.stage('upperX','24');pending=session.apply();session.cancel();worker.send(replies[6]);await pending;assert.deepEqual(session.getSnapshot().accepted,before.accepted);assert.equal(session.getSnapshot().busy,false);checks++;session.discard();
// A new worker must explicitly reopen accepted v2 source before applying.
session.stage('setback','1');pending=session.apply();worker=workers.at(-1);assert.equal(worker.requests[0].version,2);assert.equal(worker.requests[0].text,before.authoredText);worker.send(replies[4]);await new Promise(r=>setTimeout(r,0));assert.equal(worker.requests.at(-1).kind,'apply');worker.send({ok:false,message:'bounded refusal'});await pending;assert.deepEqual(session.getSnapshot().accepted,before.accepted);checks++;session.discard();session.dispose();
// Full native lineage is required; these mutations are refusals before any display commit.
const malformed=[
 p=>p.components.find(c=>c.role==='second').lineage.parentSolidId='wrong_parent',
 p=>p.components.find(c=>c.role==='second').lineage.original.caps=[],
 p=>p.components.find(c=>c.role==='second').lineage.subtraction.faces[0].output.sourceId='forged',
 p=>p.components.find(c=>c.role==='second').lineage.resolution.a.origin.useId='forged',
 p=>p.components.find(c=>c.role==='second').lineage.split.capUses[0].negative.useId='forged',
 p=>p.components.find(c=>c.role==='second').lineage.split.faces.find(f=>f.side==='negative'&&f.output).output.faceId='forged',
 p=>p.components.find(c=>c.role==='second').lineage.chamfer.parentEdgeId='forged',
];
for(const mutate of malformed){const packet=structuredClone(replies[0].display);mutate(packet);assert.throws(()=>preparePrismFeatureScene(packet,'result'));checks++}
for(const mutate of [r=>{r.summary.serial.finalSolidId='forged'},r=>{r.summary.document.nodes[5].options.retainedSolidId='forged';r.text=signedJSON(r.summary.document)},r=>{r.text='{}'},r=>{r.summary.document.version=0;r.text=signedJSON(r.summary.document)}]){
 const s=createCadEditorPrismFeatureController(undefined,undefined,2),p=s.open(replies[0].text),r=structuredClone(replies[0]);mutate(r);workers.at(-1).send(r);await p;assert.equal(s.getSnapshot().accepted,null);assert.ok(s.getSnapshot().error);s.dispose();checks++;
}
for(const reply of [replies[0],replies[1],replies[2]]) for(const view of ['source','result']) {
 const scene=preparePrismFeatureScene(reply.display,view), found=new Set(), wanted=view==='source'?1:2;
 for(let y=2;y<192&&found.size<wanted;y+=4) for(let x=2;x<192&&found.size<wanted;x+=4){
  const hit=pickPrismFeatureScene(scene,192,192,x,y);if(!hit)continue;found.add(hit.role);
  const component=reply.display.components.find(c=>c.role===hit.role);
  assert.equal(hit.documentId,reply.summary.document.id);assert.equal(hit.revision,reply.summary.document.revision);
  assert.equal(hit.solidId,component.report.solidId);assert.deepEqual(hit.lineage,component.lineage);
  assert.ok(component.mesh.faces.some(f=>f.sourceId===hit.face.sourceId&&f.faceId===hit.face.faceId));
  assert.ok(hit.boundaries.every(b=>b.role==='native-boundary'&&b.sourceId===hit.face.sourceId&&b.faceId===hit.face.faceId));
  if(hit.role==='second')assert.equal(hit.solidId,reply.summary.serial.finalSolidId);
 }
 assert.deepEqual([...found].sort(),view==='source'?['source']:['first','second']);checks++;
}
const stable=s=>{const x=s.getSnapshot();return {accepted:x.accepted,display:x.display,authoredText:x.authoredText,selection:x.selection,history:x.history,drafts:x.drafts}};
for(const mode of ['commit-failure','cancel-staging','wrong-document','wrong-revision','wrong-version']){
 let commits=0,disposals=0,release;
 const port={prepare:async()=>({commit(){commits++},dispose(){disposals++}})};
 const s=createCadEditorPrismFeatureController(port,undefined,2);let p=s.open(replies[0].text);workers.at(-1).send(replies[0]);await p;
 s.select(replies[0].summary.document.nodes[5].id,0);s.stage('parentHeight','6');const prior=stable(s);
 if(mode==='commit-failure')port.prepare=async()=>({commit(){throw new Error('injected display refusal')},dispose(){disposals++}});
 if(mode==='cancel-staging')port.prepare=()=>new Promise(resolve=>{release=()=>resolve({commit(){commits++},dispose(){disposals++}})});
 p=s.apply();const r=structuredClone(replies[1]);
 if(mode==='wrong-document'){r.summary.document.id='other_document';r.text=signedJSON(r.summary.document)}
 if(mode==='wrong-revision'){r.summary.document.revision=19;r.text=signedJSON(r.summary.document)}
 if(mode==='wrong-version'){r.summary.document.version=0;r.text=signedJSON(r.summary.document)}
 workers.at(-1).send(r);await new Promise(r=>setTimeout(r,0));
 if(mode==='cancel-staging'){assert.equal(typeof release,'function');s.cancel();release()}
 await p;assert.deepEqual(stable(s),prior);assert.equal(commits,1);assert.equal(s.getSnapshot().busy,false);
 if(mode==='commit-failure'||mode==='cancel-staging')assert.ok(disposals>=2);
 s.dispose();checks++;
}
const v0=createCadEditorPrismFeatureController();const mismatch=v0.open(readFileSync(resolve(root,'apps/cad-editor/src/fixtures/affine-prism.authored.json'),'utf8'));workers.at(-1).send(replies[0]);await mismatch;assert.equal(v0.getSnapshot().accepted,null);assert.ok(v0.getSnapshot().error);v0.dispose();checks++;
const result={ok:true,checks,evidence:'saved real v2 replies, CPU and mocked Worker only'};writeFileSync(resolve(output,'result.json'),JSON.stringify(result));console.log(JSON.stringify(result));
