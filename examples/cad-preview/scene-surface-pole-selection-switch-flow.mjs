import assert from 'node:assert/strict';
import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=process.env.BAROCSS_SELECTION_SWITCH_RUN;
assert(output);const file=output+'.bundle.mjs';
const code=`import {EditorController} from '${root}/examples/cad-preview/src/editor-controller.ts'; export {EditorController};`;
await build({stdin:{contents:code,resolveDir:root,loader:'ts'},bundle:true,alias:{'@barocss/cad':root+'/packages/barocss-cad/src/index.ts','@barocss/gpu':root+'/packages/barocss-gpu/src/index.ts'},platform:'node',format:'esm',outfile:file});
const {EditorController}=await import(file);const c=new EditorController();c.add('surface');c.add('surface');c.add('box');const objects=c.getSnapshot().scene.objects;c.select(objects[0].id);c.selectPole(0,1);c.selectPole(1,1,true);
function selectFace(object){const s=c.getSnapshot(),face=s.display.faces.find(f=>f.objectId===object.id);assert(face);c.selectHit({objectId:object.id,nativeFaceId:face.nativeFaceId,index:face.indexRange[0],worldNative:[0,0,0],localNative:[0,0,0],...(face.reference?{reference:face.reference}:{})});}
let result;try{selectFace(objects[1]);assert.deepEqual(c.getSnapshot().selectedPoles,[[0,0]]);selectFace(objects[2]);assert.deepEqual(c.getSnapshot().selectedPoles,[]);result={ok:true,actualNativeObjectsAndAcceptedFaceReferences:true,changedObjectGroupReset:true};}catch(e){result={ok:false,message:e.message};await writeFile(output+'.json',JSON.stringify(result,null,2));throw e;}await writeFile(output+'.json',JSON.stringify(result,null,2));console.log('Actual accepted native face selection resets old Surface group.');
