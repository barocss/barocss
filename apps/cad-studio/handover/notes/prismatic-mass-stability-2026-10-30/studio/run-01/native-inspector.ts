import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {partBreps,evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {partSnapshot,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {brepMassProperties,massPropertiesOf,checkBrep} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc),p=part('D343 native and provider read',doc),view=evaluateDoc(doc,0),snapshot=partSnapshot(doc);assert.equal(view.ok,true,JSON.stringify(view));
function quadrature(brep){try{return brepMassProperties(brep,1);}catch(e){return {error:e instanceof Error?e.message:String(e)};}}
const bodies=partBreps(doc).map(({key,brep})=>{const displayed=view.bodies.find(b=>b.key===key),output=snapshot.outputs.find(o=>bodyKeyOf(o.id,doc.nodes)===key);assert.ok(output);return {key,ref:displayed.ref??null,brep,check:checkBrep(brep,{strict:true}),kernelRepresentation:output.representation,kernelMass:massPropertiesOf(output,1),nativeQuadrature:quadrature(brep),
 modelMass:{volume:displayed.volume,centroid:displayed.centroid},publicMass:p.body(key).mass({density:1}),publicNames:p.body(key).select().faces().names().sort(),nativeNames:brep.faces.map(f=>f.name),
 structure:{nativeSolidCount:brep.bodies.filter(b=>b.kind==='solid').length,nativeShellCount:brep.shells.length,nativeClosedShellCount:brep.shells.filter(s=>s.closed).length},
 displayBodyIndex:view.bodies.findIndex(b=>b.key===key),displayFaces:displayed.mesh.faces.map((f,index)=>({index,name:f.name,kind:f.kind,normal:f.normal,centroid:f.centroid}))};});assert.equal(JSON.stringify(doc),before,'Provider queries cannot change authored document');console.log(JSON.stringify({bodies}));