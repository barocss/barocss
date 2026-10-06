import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as cad from '../../packages/barocss-cad/dist/index.js';
import * as gpu from '../../packages/barocss-gpu/dist/index.js';
import {prepareCandidate} from './pipeline.mjs';
import {validateProject,serializeProject,parseProject} from './project.mjs';
const source=await readFile(new URL('../cad-nurbs/parameter-line-v2.css',import.meta.url),'utf8');
test('actual source2 unit/expression results remain native0 packets with stable identities',()=>{
 for(const width of [100,120]){
  const compiled=cad.compileCadModel(width===100?source:source.replace('10 cm','12cm'),{sourceVersion:2});assert(compiled.ok);assert.equal(compiled.ir.schemaVersion,2);assert.equal(compiled.model.version,0);assert.deepEqual(compiled.model.objects.map(o=>o.id),['profile','wall']);const surface=compiled.model.objects[1];assert.deepEqual(cad.evaluateSurface(surface,1,1),[width,0,width]);const preview=cad.tessellateSurface(surface,{countU:17,countV:9,revision:545});assert.equal(preview.packet.version,0);assert.equal(preview.packet.surfaceId,'wall');gpu.prepareMesh(preview.packet,{mmToSceneUnit:.02,translate:[-1,0,-1],color:[.2,.75,.9],background:[.025,.035,.055]});assert.equal(cad.exportIGES(compiled.model,['wall']).report.objects[0].entity,128);
 }
});
test('source2 compiler availability does not widen current application or project admission',()=>{
 const compiled=cad.compileCadModel(source,{sourceVersion:2});assert(compiled.ok);
 assert.throws(()=>prepareCandidate(source,{sourceVersion:2,surfaceId:'wall',countU:17,countV:9,revision:1,options:{}},cad,gpu),/explicitly 0 or 1/);
 const file={format:'barocss-cad-project',version:1,sourceVersion:2,source,surfaceId:'wall',grid:{countU:17,countV:9},options:{mmToSceneUnit:.02,translate:[-1,0,-1],color:[.2,.75,.9],background:[.025,.035,.055]},primitive:null};
 for(const validate of [()=>validateProject(file,gpu),()=>serializeProject(file,gpu),()=>parseProject(JSON.stringify(file),gpu)])assert.throws(validate);
});
