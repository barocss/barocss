import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {partBreps,evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {brepMassProperties,brepSurfaceArea,checkBrep} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),p=part('D342 native read',doc),view=evaluateDoc(doc,0);assert.equal(view.ok,true,JSON.stringify(view));
const bodies=partBreps(doc).map(({key,brep})=>({key,ref:view.bodies.find(b=>b.key===key).ref??null,brep,mass:brepMassProperties(brep,1),area:brepSurfaceArea(brep),check:checkBrep(brep,{strict:true}),
 structure:{bodyKinds:brep.bodies.map(b=>b.kind),nativeSolidCount:brep.bodies.filter(b=>b.kind==='solid').length,nativeShellCount:brep.shells.length,nativeClosedShellCount:brep.shells.filter(s=>s.closed).length},
 publicMass:p.body(key).mass({density:1}),publicNames:p.body(key).select().faces().names().sort(),publicFaces:p.body(key).select().faces().list(),nativeNames:brep.faces.map(f=>f.name),
 displayBodyIndex:view.bodies.findIndex(b=>b.key===key),displayFaces:view.bodies.find(b=>b.key===key).mesh.faces.map((f,index)=>({index,name:f.name,kind:f.kind,normal:f.normal,centroid:f.centroid}))}));console.log(JSON.stringify({bodies}));