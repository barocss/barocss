// Recorded #1643 native geometry through the actual worker serializer/controller; all providers and Worker are mocked.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=resolve(import.meta.dirname,'../../..'), output=resolve(process.env.EVIDENCE_DIR??'/tmp/cad-hole-controller');mkdirSync(output,{recursive:true});
const require=createRequire(resolve(process.env.REPO_DEPS_ROOT??root,'package.json'));
const bytes=readFileSync(resolve(import.meta.dirname,'fixtures/modeling-hole/baseline-native.json')), native=JSON.parse(bytes), authored=JSON.parse(native.text);
const hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(hash(bytes),'3ee3d585448a24ad6d8fcdbc3cddd927eb6e13b399db6a707444940080fc4024');
let providerRefusal=false;const snapshots=[],edits=[],loads=[];
function snapshot(data) {
 const value={parameters:structuredClone(data.parameters),suppression:{},features:structuredClone(native.features),bodies:structuredClone(native.bodies),
 save:()=>JSON.stringify(data)+'\n',withParameters(changes){edits.push({snapshot:value,changes:structuredClone(changes)});if(providerRefusal)throw new Error('Recorded native qualification refusal');return snapshot({...data,parameters:{...data.parameters,...changes}});},withSuppression(){throw new Error('No named finishes in this part');}};
 snapshots.push(value);return value;
}
globalThis.__holeCad={cad:{load(text){const data=JSON.parse(text);const value=snapshot(data);loads.push(value);return value;},model(){
 const values={};const shape={hole(){return shape;}};
 return{parameter(name,value){values[name]=value;return{parameter:name};},sketch:{rectangle(){return{extrude(){return shape;}};}},build(){return snapshot({...structuredClone(authored),parameters:Object.fromEntries(Object.entries(values).sort(([a],[b])=>a.localeCompare(b)))});}}; }},
 tessellateConvexPlanarSolid(){return structuredClone(native.blankMesh);},
 tessellateOwnPlateCircularHole(_bundle,{context}){const preview=structuredClone(native.holeMesh);preview.mesh.context=structuredClone(context);return preview;}};
const engineBundle=await require('esbuild').build({entryPoints:[resolve(root,'packages/barocss-cad-editor/src/modeling-engine.ts')],bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'recorded-native-provider',setup(build){build.onResolve({filter:/^@barocss\/cad$/},()=>({path:'cad',namespace:'stub'}));build.onResolve({filter:/^\.\/prism-feature-engine\.js$/},()=>({path:'legacy',namespace:'stub'}));build.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='cad'?'export const {cad,tessellateConvexPlanarSolid,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell}=globalThis.__holeCad;export function tessellateSurface(){throw Error("No union panel execution");}':'export function createPrismFeatureEngine(){return ()=>{throw new Error("No legacy native execution");};}'}));}}]});
writeFileSync(resolve(output,'engine.mjs'),engineBundle.outputFiles[0].text);
const {createModelingEngine}=await import(pathToFileURL(resolve(output,'engine.mjs')));
const bundle=await require('esbuild').build({stdin:{contents:`export * from '${resolve(root,'packages/barocss-cad-editor/src/modeling-controller.ts')}'; export {preparePrismFeatureScene} from '${resolve(root,'packages/barocss-cad-editor/src/prism-feature-scene.ts')}';`,resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,
 alias:{'@barocss/gpu':resolve(root,'packages/barocss-gpu/src/index.ts'),'@barocss/cad':resolve(root,'packages/barocss-cad/src/index.ts')}});
writeFileSync(resolve(output,'controller.mjs'),bundle.outputFiles[0].text);
const {createCadEditorModelingController:create,preparePrismFeatureScene}=await import(pathToFileURL(resolve(output,'controller.mjs')));
const workers=[],sessions=[];let checks=0;
globalThis.Worker=class {callbacks=new Map();requests=[];answered=new Set();engine=createModelingEngine();terminated=false;
 constructor(){workers.push(this);}addEventListener(kind,fn){this.callbacks.set(kind,fn);}postMessage(command){this.requests.push(command);}terminate(){this.terminated=true;}
 send(reply,id=this.requests.at(-1).id){this.callbacks.get('message')({data:{...structuredClone(reply),id}});}
 accept(mutate,command=this.requests.at(-1)){this.answered.add(command.id);const reply=this.engine(command);if(mutate)mutate(reply);this.send(reply,command.id);return reply;}};
const tick=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
async function pump(p){let done=false;p.finally(()=>{done=true;});for(let i=0;i<12&&!done;i++){const w=workers.at(-1),request=w?.requests.at(-1);if(request&&!w.answered.has(request.id))w.accept();await tick();}assert.ok(done,'bounded mocked worker flow completed');await p;}
const stable=s=>{const value=s.getSnapshot();delete value.busy;delete value.error;return value;};
const open=async(port)=>{const s=create(port);sessions.push(s);await pump(s.example('mounting-plate'));assert.equal(s.getSnapshot().error,null);return s;};
try {
 const s=await open(), first=s.getSnapshot(), worker=workers.at(-1);checks++;
 assert.equal(first.authoredText,native.text);assert.equal(first.display.selectedOutput,'plate');assert.equal(first.display.scene.geometries.length,1);
 assert.equal(first.accepted.outputs[0].volumeMM3.numerator,'25600');assert.equal(first.accepted.outputs[1].volumeMM3,null);checks++;
 const hole=first.display.packet.components[1];assert.deepEqual(hole.preview.mesh.chunks,native.holeMesh.mesh.chunks);assert.deepEqual(hole.preview.provenance,native.holeMesh.provenance);assert.deepEqual(hole.preview.report,native.holeMesh.report);checks++;
 assert.equal(hole.preview.mesh.context.taskToken,worker.requests[0].taskToken);assert.match(worker.requests[0].taskToken,/^[A-Za-z0-9_-]{36}$/);checks++;
 const beforeNoop=stable(s), count=worker.requests.length;await s.viewOutput('plate',first.generation);assert.deepEqual(stable(s),beforeNoop);assert.equal(worker.requests.length,count);checks++;
 s.stage('radius','2.5');const drafted=s.getSnapshot();await s.viewOutput('blank',drafted.generation);const blank=s.getSnapshot();
 assert.equal(blank.display.selectedOutput,'blank');assert.deepEqual(blank.drafts,drafted.drafts);assert.deepEqual(blank.history,drafted.history);assert.equal(blank.authoredText,drafted.authoredText);assert.deepEqual(blank.accepted,drafted.accepted);assert.equal(worker.requests.length,count);checks++;
 await assert.rejects(s.viewOutput('plate',drafted.generation),/current named output/);await assert.rejects(s.viewOutput('missing',blank.generation),/current named output/);checks+=2;
 await s.viewOutput('plate',blank.generation);const previous=s.getSnapshot();await pump(s.apply());assert.equal(s.getSnapshot().accepted.parameters.radius,2.5);assert.equal(s.getSnapshot().display.selectedOutput,'plate');assert.notEqual(s.getSnapshot().display.packet.taskToken,previous.display.packet.taskToken);checks++;
 await pump(s.undo());assert.equal(s.getSnapshot().accepted.parameters.radius,5);await pump(s.redo());assert.equal(s.getSnapshot().accepted.parameters.radius,2.5);checks++;
 // Parameter changes above exercise history with deliberately reused baseline geometry, not a new tessellation.
 const beforeRefusal=stable(s);s.stage('width','81');const pending=stable(s);providerRefusal=true;await pump(s.apply());providerRefusal=false;
 assert.deepEqual(stable(s),pending);assert.match(s.getSnapshot().error,/qualification refusal/);s.discard();checks++;
 s.stage('centerX','32.5');await pump(s.apply());assert.equal(s.getSnapshot().accepted.parameters.centerX,32.5);assert.equal(s.getSnapshot().display.selectedOutput,'plate');checks++;
 const beforeCancel=stable(s);s.stage('radius','5');const draftBefore=stable(s);let p=s.apply();const late=worker.requests.at(-1);s.cancel();worker.accept(undefined,late);await p;assert.deepEqual(stable(s),draftBefore);checks++;
 const tokensBefore=new Set(workers.flatMap(w=>w.requests.map(r=>r.taskToken)));await pump(s.apply());const recovered=s.getSnapshot(), rebuilt=workers.at(-1);
 assert.equal(rebuilt.requests[0].kind,'open');assert.equal(rebuilt.requests[1].kind,'apply');assert.equal(recovered.display.selectedOutput,'plate');assert.notEqual(rebuilt.requests[0].taskToken,rebuilt.requests[1].taskToken);assert.ok(!tokensBefore.has(rebuilt.requests[0].taskToken));checks++;
 const saved=recovered.authoredText;await s.viewOutput('blank',recovered.generation);await pump(s.open(saved));assert.equal(s.getSnapshot().display.selectedOutput,'plate');assert.equal(s.getSnapshot().history.count,1);assert.equal(s.getSnapshot().authoredText,saved);checks++;
 // Renamed output IDs are selected by saved inventory order, never by a 'plate' spelling heuristic.
 const renamed=JSON.parse(saved);renamed.outputs={a_hole:renamed.outputs.plate,z_blank:renamed.outputs.blank};
 // This focused import uses the real serializer with a matching recorded family map; no native geometry is built.
 const imported=create();sessions.push(imported);p=imported.open(JSON.stringify(renamed)+'\n');const iw=workers.at(-1),command=iw.requests.at(-1);
 const sourceReply=createModelingEngine()({id:command.id,kind:'open',text:native.text,taskToken:command.taskToken});
 sourceReply.text=JSON.stringify(renamed)+'\n';sourceReply.summary.parameters=renamed.parameters;
 const [blankSummary,plateSummary]=sourceReply.summary.outputs;sourceReply.summary.outputs=[{...plateSummary,name:'a_hole'},{...blankSummary,name:'z_blank'}];
 const [blankComponent,plateComponent]=sourceReply.display.components;plateComponent.role='a_hole';blankComponent.component.role='z_blank';blankComponent.component.lineage.name='z_blank';
 sourceReply.display.components=[plateComponent,blankComponent];sourceReply.display.outcomes=sourceReply.summary.outputs.map(o=>({role:o.name,solidId:o.solidId,family:o.family,status:'solid'}));
 iw.send(sourceReply);await p;assert.equal(imported.getSnapshot().error,null);assert.equal(imported.getSnapshot().display.selectedOutput,'z_blank');checks++;
 // Invalid current-reply metadata/geometry never replaces accepted source, scene or history, even for hidden bodies.
 const mutations=[r=>r.display.taskToken='old_request',r=>r.display.components[1].preview.mesh.context.taskToken='old_request',
 r=>r.display.components[1].preview.mesh.context.documentRevision='old',r=>r.summary.outputs[1].volumeMM3={numerator:'1',denominator:'1'},
 r=>r.summary.outputs[1].family='convex-planar',r=>r.summary.outputs[0].volumeMM3={numerator:'25600',denominator:'0'},r=>r.summary.outputs[0].volumeMM3=null,r=>r.display.components[0].component.mesh.positionsMM[0]+=1,
 r=>r.display.components[1].preview.provenance[4].nativeLoopIds.pop(),r=>r.display.components[1].preview.mesh.chunks.pop(),
 r=>r.display.outcomes.reverse(),r=>{const d=JSON.parse(r.text);d.outputs.plate={node:1,side:'solid'};r.text=JSON.stringify(d)+'\n';},
 r=>{const d=JSON.parse(r.text);d.nodes[2].radius=3;r.text=JSON.stringify(d)+'\n';}];
 for(const mutate of mutations){const q=await open(),qw=workers.at(-1);q.stage('radius','2.5');const before=stable(q);p=q.apply();qw.accept(mutate);await p;assert.deepEqual(stable(q),before);assert.ok(q.getSnapshot().error);q.dispose();checks++;}
 // A valid old convex packet cannot disguise an authored hole output, even with family metadata omitted.
 const downgraded=await open(), beforeDowngrade=stable(downgraded), downgradeData=JSON.parse(native.text);downgradeData.outputs={plate:downgradeData.outputs.plate};p=downgraded.open(JSON.stringify(downgradeData)+'\n');
 workers.at(-1).accept(r=>{const data=JSON.parse(r.text);data.outputs={plate:data.outputs.plate};r.text=JSON.stringify(data)+'\n';
 const component=structuredClone(first.display.packet.components[0].component);component.role='plate';component.lineage.name='plate';
 const summary=structuredClone(first.accepted.outputs[0]);delete summary.family;summary.name='plate';r.summary.outputs=[summary];
 r.display={profile:'model-outputs',documentId:r.summary.documentId,revision:r.summary.revision,components:[component],outcomes:[{role:'plate',solidId:summary.solidId,status:'solid'}]};assert.ok(preparePrismFeatureScene(r.display,'result'));});
 await p;assert.deepEqual(stable(downgraded),beforeDowngrade);assert.match(downgraded.getSnapshot().error,/Authored hole outputs require tagged/);checks++;
 // Actual controller face selection returns original native face provenance at the current accepted generation.
 const pickedSession=await open(), generation=pickedSession.getSnapshot().generation;let picked;
 for(let y=4;y<160&&!picked;y+=8)for(let x=4;x<160&&!picked;x+=8){pickedSession.pick(160,160,x,y,generation);picked=pickedSession.getSnapshot().faceSelection;}
 assert.equal(picked.family,'stored-rational-plate-hole');assert.ok(native.holeMesh.provenance.some(f=>f.nativeFaceId===picked.reference.nativeFaceId));checks++;
 await pickedSession.viewOutput('blank',generation);assert.equal(pickedSession.getSnapshot().faceSelection,null);assert.throws(()=>pickedSession.pick(160,160,40,40,generation),/stale/);checks++;
 let reject=false,commitReject=false,defer=false,resolvePrepare;const commits=[],disposals=[];
 const port={async prepare(display){if(reject)throw new Error('recorded display refusal');const candidate={commit(){if(commitReject)throw new Error('recorded commit refusal');commits.push(display.selectedOutput);},dispose(){disposals.push(display.selectedOutput);}};if(defer)return new Promise(resolve=>{resolvePrepare=()=>resolve(candidate);});return candidate;}};
 const staged=await open(port);staged.stage('radius','2.5');
 for(let y=4;y<160&&!staged.getSnapshot().faceSelection;y+=8)for(let x=4;x<160&&!staged.getSnapshot().faceSelection;x+=8)staged.pick(160,160,x,y,staged.getSnapshot().generation);
 assert.ok(staged.getSnapshot().faceSelection);let before=stable(staged);reject=true;await staged.viewOutput('blank',staged.getSnapshot().generation);reject=false;assert.deepEqual(stable(staged),before);checks++;
 commitReject=true;await staged.viewOutput('blank',staged.getSnapshot().generation);commitReject=false;assert.deepEqual(stable(staged),before);checks++;
 defer=true;p=staged.viewOutput('blank',staged.getSnapshot().generation);await tick();await assert.rejects(staged.viewOutput('plate',staged.getSnapshot().generation),/in progress/);staged.cancel();resolvePrepare();await p;defer=false;assert.deepEqual(stable(staged),before);assert.deepEqual(commits,['plate']);assert.ok(disposals.includes('blank'));checks++;
 // Same parsed source plus changed native task context is valid reconstruction; summary/graph mutation is not.
 const recon=await open();recon.cancel();recon.stage('radius','2.5');before=stable(recon);p=recon.apply();const rw=workers.at(-1);rw.accept(r=>{r.summary.parameters.radius=9;});await p;assert.deepEqual(stable(recon),before);assert.ok(recon.getSnapshot().error);checks++;
 void beforeRefusal;void beforeCancel;
 const result={ok:true,checks,sourceSHA256:hash(readFileSync(resolve(root,'packages/barocss-cad-editor/src/modeling-controller.ts'))),nativeTransferSHA256:hash(bytes),nativeTransferBytes:bytes.length,
 actualBaselineArraysUnchanged:true,contextEnvelopeAdaptation:true,changedShapeDisplays:'mocked with retained baseline geometry; not newly tessellated',nativeEvaluations:0,browserGPU:false,
 scope:'actual worker serializer and controller with recorded native provider data and mocked Worker; atomic history/output choice/context/refusal and CPU picking'};
 writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
} finally {for(const s of sessions)s.dispose();}
