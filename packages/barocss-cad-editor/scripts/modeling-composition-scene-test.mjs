// Genuine retained58 raw Surface packets. CPU serialization/admission/rays only, no native runtime.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
export const root=resolve(import.meta.dirname,'../../..'),output=resolve(process.env.EVIDENCE_DIR??'/tmp/cad-1751-scene');mkdirSync(output,{recursive:true});
const require=createRequire(resolve(process.env.REPO_DEPS_ROOT??root,'package.json'));
const gpu=resolve(output,'gpu-entry.ts');writeFileSync(gpu,['engine-scene','engine-camera-ray','engine-raycast','kernel-face-preview'].map(n=>`export * from ${JSON.stringify(resolve(root,'packages/barocss-gpu/src/'+n+'.ts'))};`).join('\n'));
const entry=['modeling-composition','modeling-union','modeling-scene','modeling-controller'].map(n=>`export * from ${JSON.stringify((n==='modeling-union'&&process.env.MODELING_UNION_SOURCE?resolve(process.env.MODELING_UNION_SOURCE):resolve(root,'packages/barocss-cad-editor/src/'+n+'.ts')))};`).join('\n')+`\nexport {raycastEngineScene} from ${JSON.stringify(gpu)};`;
const b=await require('esbuild').build({stdin:{contents:entry,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,alias:{'@barocss/gpu':gpu},plugins:[{name:'no-native-runtime',setup(build){if(process.env.MODELING_UNION_SOURCE)build.onResolve({filter:/^\.\/modeling-union\.js$/},()=>({path:resolve(process.env.MODELING_UNION_SOURCE)}));build.onResolve({filter:/^@barocss\/cad$/},()=>{throw Error('CPU replay must not import native CAD runtime');});}}]});
writeFileSync(resolve(output,'scene.mjs'),b.outputFiles[0].text);export const api=await import(pathToFileURL(resolve(output,'scene.mjs')));
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=readFileSync(resolve(root,'packages/barocss-cad/test/modeling-composition-evidence/baseline-transfer.json'));
assert.equal(hash(bytes),'9a8ac520f0d4577b3a7e0ff411182e1c176eaaf8c73ac75073c129ae6380b79f');assert.equal(bytes.length,2334314);
export const baseline=JSON.parse(bytes),native=baseline.bodies.slotted.native;
const bracketBytes=readFileSync(resolve(import.meta.dirname,'fixtures/modeling-composition/bracket-preview.json'));
assert.equal(hash(bracketBytes),'419397690a131dd229e1cd03bf112227f529d91a468905c691088b710091544c');
export const bracketCapture=JSON.parse(bracketBytes);assert.equal(bracketCapture.status,'PASS');assert.equal(bracketCapture.tessellationAttempts,14);
const packets=[...bracketCapture.preview,...baseline.preview];assert.equal(packets.length,58);
/** Exact recorded raw result lookup; request revision changes are explicit replay context, no resampling. */
export function replayPanel(surface,options){assert.deepEqual(options,{countU:2,countV:2,revision:options.revision});assert.ok(Number.isSafeInteger(options.revision));
 const entry=packets.find(p=>p.surfaceId===surface.id);assert.ok(entry,'retained surface exists');
 const body=entry.panelId.startsWith('m4_')?baseline.bodies.bracket.native:native;
 const source=body.sources.find(s=>s.sourceId===entry.sourceId);assert.ok(source);assert.equal(source.panelId,entry.panelId);
 assert.deepEqual(source.model.objects.find(o=>o.kind==='surface'&&o.id===entry.surfaceId),surface);assert.deepEqual(entry.options,{countU:2,countV:2,revision:0});
 return structuredClone(entry.result);
}
export const signedJSON=data=>JSON.stringify(data,(_k,v)=>Object.is(v,-0)?'__NEG_ZERO__':v).replaceAll('"__NEG_ZERO__"','-0')+'\n';
export function reply(revision=0,taskToken='composition_context',text=baseline.text){const data=JSON.parse(text),context=id=>({documentId:'cad_model',bodyId:id,documentRevision:String(revision),kernelResultRevision:String(revision),topologyRevision:String(revision),taskToken});
 const parent=api.projectModelingUnion(baseline.bodies.bracket.native,'bracket',context(baseline.bodies.bracket.native.bodies[0].id),replayPanel,'union');
 const components=Object.entries(data.outputs).map(([role,ref])=>ref.node===4?{...structuredClone(parent),role}:api.projectModelingComposition(native,role,context(native.bodies[0].id),replayPanel,parent));
 const outcomes=components.map(c=>({role:c.role,solidId:c.solidId,family:c.family,status:'solid'}));
 return {ok:true,text,display:{profile:'model-body-faces',documentId:'cad_model',revision,taskToken,components,outcomes},summary:{documentId:'cad_model',revision,source:'model',parameters:data.parameters,
 features:baseline.features.map(({kind,index,dependencies})=>({kind,index,dependencies:[...dependencies]})),outputs:components.map(c=>({name:c.role,solidId:c.solidId,family:c.family,volumeMM3:{numerator:String(c.qualification.volumeMM3),denominator:'1'}}))}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let checks=0;const before=structuredClone(baseline),packet=reply().display,c=packet.components[1],parent=packet.components[0];
 assert.equal(c.mesh.chunks.length,44);assert.equal(parent.mesh.chunks.length,14);assert.equal(c.qualification.volumeMM3,2816);assert.equal(parent.qualification.volumeMM3,3072);checks++;
 const scene=api.prepareModelingScene(packet,1,'slotted'),g=scene.scene.geometries[0];assert.deepEqual(baseline,before);checks++;
 const raw=c.mesh.chunks.flatMap(v=>v.positionsMM),normals=c.mesh.chunks.flatMap(v=>v.normals);assert.equal(g.positions.length,528);assert.equal(g.indices.length,264);
 for(let i=0;i<176;i++){assert.deepEqual(g.positions.slice(i*3,i*3+3),[raw[i*3],raw[i*3+2],-raw[i*3+1]]);assert.deepEqual(g.normals.slice(i*3,i*3+3),[normals[i*3],normals[i*3+2],-normals[i*3+1]]);}checks++;
 assert.deepEqual(g.uvs,c.mesh.chunks.flatMap(v=>v.parametersUV));assert.deepEqual(c.lineage.parent.component.mesh.chunks,parent.mesh.chunks);checks++;
 const ray=(x,y,z,dx,dy,dz)=>({format:'barocss-gpu-engine-ray',version:0,coordinateSystem:'right-handed-y-up',positionUnit:'scene',origin:[x,y,z],direction:[dx,dy,dz],near:0,far:200});
 assert.equal(api.raycastEngineScene(scene.scene,ray(20,30,-4,0,-1,0)),null,'slot stays open');assert.equal(api.raycastEngineScene(scene.scene,ray(20,-20,-4,0,1,0)),null);checks++;
 const material=api.raycastEngineScene(scene.scene,ray(12,30,-4,0,-1,0));assert.ok(material);assert.equal(material.point[1],8);checks++;
 const wall=api.raycastEngineScene(scene.scene,ray(20,4,-4,-1,0,0));assert.ok(wall);assert.equal(wall.point[0],16);assert.ok(wall.normal[0]>.99);checks++;
 const wallPanel=c.lineage.panels[Math.floor(wall.triangleIndex/2)];assert.ok(wallPanel.lineage.some(l=>l.originalIndex===2&&l.relativeOrientation===-1));checks++;
 const parentScene=api.prepareModelingScene(packet,1,'bracket');assert.ok(api.raycastEngineScene(parentScene.scene,ray(20,30,-4,0,-1,0)));checks++;
 let picked;for(let y=8;y<160&&!picked;y+=8)for(let x=8;x<160&&!picked;x+=8)picked=api.pickModelingScene(scene,160,160,x,y);
 assert.ok(picked);assert.equal(picked.family,'orthogonal-cell');assert.equal(picked.reference.nativeFaceId,picked.provenance.id);assert.deepEqual(picked.lineage,c.lineage);checks++;
 assert.ok(api.resolveModelingFaceReference(scene,picked.reference));assert.equal(api.resolveModelingFaceReference(scene,{...picked.reference,taskToken:'stale'}),null);assert.throws(()=>api.resolveModelingFaceReference(structuredClone(scene),picked.reference),/original accepted/);checks++;
 for(const change of [d=>{d.outputs={part:{node:7,side:'solid'}};},d=>{d.outputs={original:{node:4,side:'solid'},cut:{node:7,side:'solid'}};}]){const d=JSON.parse(baseline.text);change(d);const r=reply(0,'alias',signedJSON(d));assert.ok(api.prepareModelingScene(r.display));assert.ok(api.isModelingCompositionGraph(d));checks++;}
 const changes=[
 ['volume',v=>v.qualification.volumeMM3++],['operation',v=>v.qualification.operation='union'],['original-count',v=>v.qualification.originalBoxCount=2],['owner',v=>v.qualification.evaluationId='m8_difference'],
 ['missing-original',v=>v.lineage.panels.find(p=>p.lineage.length).lineage.pop()],['extra-original',v=>{const p=v.lineage.panels.find(p=>p.lineage.length);p.lineage.push(structuredClone(p.lineage[0]));}],
 ['missing-parent',v=>v.lineage.panels.find(p=>p.parentPanels.length).parentPanels.pop()],['extra-parent',v=>{const p=v.lineage.panels.find(p=>p.parentPanels.length);p.parentPanels.push(structuredClone(p.parentPanels[0]));}],
 ['resurrected-contributor',v=>{const p=v.lineage.panels.find(p=>p.lineage.some(l=>l.originalIndex===0));p.lineage.find(l=>l.originalIndex===0).originalIndex=1;}],
 ['UV-fraction',v=>v.lineage.panels.find(p=>p.parentPanels.length).parentPanels[0].uvCorners[0][0].denominator='0'],
 ['parent-owner',v=>v.lineage.parent.evaluationId='m3_union'],['parent-index',v=>v.lineage.parent.originalIndices.reverse()],['parent-material',v=>v.lineage.parent.component.lineage.cells[0].occupied=!v.lineage.parent.component.lineage.cells[0].occupied],
 ['hidden-proof-context',v=>v.lineage.parent.component.mesh.context.taskToken='stale'],['right-origin',v=>v.lineage.right.origin[0]++],['right-support',v=>v.lineage.right.faces[0].surface.controlPoints[0][0][0]++],
 ['source-query',v=>v.lineage.panels[0].query.sourceId='foreign'],['collapsed-UV',v=>{const p=v.lineage.panels[0];for(const u of p.topology.loop.uses){u.boundary='u-min';u.pcurve.uv0=[0,0];u.pcurve.uv1=[0,0];}v.mesh.chunks[0].parametersUV.fill(0);}],
 ['loop-order',v=>v.lineage.panels[0].topology.loop.uses.reverse()],['triangle-winding',v=>v.mesh.chunks[0].indices.reverse()],['degenerate',v=>v.mesh.chunks[0].indices.fill(0)],['normal',v=>v.mesh.chunks[0].normals[0]+=1],['position',v=>v.mesh.chunks[0].positionsMM[0]+=1],
 ['chunks65',v=>{while(v.mesh.chunks.length<65)v.mesh.chunks.push(structuredClone(v.mesh.chunks[0]));}],['panels65',v=>{while(v.lineage.panels.length<65)v.lineage.panels.push(structuredClone(v.lineage.panels[0]));}],['array-order',v=>v.lineage.panels.reverse()],['quality',v=>v.qualification.quality.arbitraryCurvedSolidCertified=true],
 ];
 for(const [label,change]of changes){const wrong=structuredClone(packet);change(wrong.components[1]);assert.throws(()=>api.prepareModelingScene(wrong,1,'bracket'),undefined,label);checks++;}
 const badHidden=structuredClone(packet);badHidden.components[0].mesh.chunks[0].positionsMM[0]++;assert.throws(()=>api.prepareModelingScene(badHidden,1,'slotted'));checks++;
 const huge=structuredClone(packet);huge.components=[];huge.outcomes=[];for(let i=0;i<8;i++){const item=structuredClone(c);item.role='body'+i;huge.components.push(item);huge.outcomes.push({role:item.role,solidId:item.solidId,family:item.family,status:'solid'});}assert.throws(()=>api.prepareModelingScene(huge),/budget|2 MiB/);checks++;
 const getter=structuredClone(packet);Object.defineProperty(getter.components[1].lineage,'parent',{enumerable:true,get(){throw Error('getter executed');}});assert.throws(()=>api.prepareModelingScene(getter),e=>!String(e).includes('getter executed'));checks++;
 const finalOnly=JSON.parse(baseline.text);finalOnly.outputs={slotted:finalOnly.outputs.slotted};const finalPacket=reply(0,'final_only',signedJSON(finalOnly)).display;
 const result={ok:true,checks,unionDependencySHA256:hash(readFileSync(process.env.MODELING_UNION_SOURCE??resolve(root,'packages/barocss-cad-editor/src/modeling-union.ts'))),serializedDTOBytes:Buffer.byteLength(JSON.stringify(packet)),finalOnlyDTOBytes:Buffer.byteLength(JSON.stringify(finalPacket)),components:2,rawPackets:58,bracketCaptureSHA256:hash(bracketBytes),providerTransferSHA256:hash(bytes),nativeCalls:0,scope:'Actual retained raw Surface arrays through CPU receiving/picking; no GPU/browser/file acceptance; changed states require separately disclosed baseline mocks'};
 writeFileSync(resolve(output,'scene-result.json'),JSON.stringify(result,null,2)+'\n');writeFileSync(resolve(output,'baseline-display.json'),signedJSON(packet));console.log(JSON.stringify(result));
}
