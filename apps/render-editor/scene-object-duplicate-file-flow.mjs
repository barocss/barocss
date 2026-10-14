import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),args=process.argv.slice(2);
assert(args.length===8&&args[0]==='--original'&&args[2]==='--edited'&&args[4]==='--reopened'&&args[6]==='--output');
const output=resolve(args[7]);await mkdir(dirname(output),{recursive:true});await mkdir(output);
const receipt={issue:1315,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),clean:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()==='',actualGL:false,scope:'Cold genuine Source1 selected-object duplication files',ok:false};
try{
 assert.equal(Number(process.versions.node.split('.')[0]),22);
 const bundle=await build({absWorkingDir:root,stdin:{contents:"export * from '@barocss/render-editor'; export {compileGpu} from '@barocss/gpu';",resolveDir:resolve(root,'apps/render-editor'),sourcefile:'actual-duplicate-files.mjs'},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true});
 const inputs=Object.keys(bundle.metafile.inputs);assert(inputs.some(p=>p.includes('barocss-render-editor/src/')));assert(!inputs.some(p=>/packages\/barocss-[^/]+\/dist\//.test(p)));await writeFile(resolve(output,'source-metafile.json'),JSON.stringify(bundle.metafile,null,2)+'\n');
 const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64')),rows=[];
 for(const index of [1,3,5]){const path=resolve(args[index]),text=await readFile(path,'utf8'),document=api.parseRenderEditorDocument(text);assert.equal(api.serializeRenderEditorDocument(document),text);assert.equal(document.version,1);assert.equal(document.kind,'gpu-scene');const result=api.compileGpu({kind:'scene',source:document.sceneSource,sourceVersion:1});assert(result.ok&&result.execution.kind==='sdf');rows.push({path,bytes:Buffer.byteLength(text),document,scene:result.execution.scene});}
 const [original,edited,reopened]=rows,stable=doc=>{const {revision,sceneSource,...rest}=doc;void revision;void sceneSource;return rest;},oldIds=original.scene.objects.map(o=>o.id),added=edited.scene.objects.filter(o=>!oldIds.includes(o.id));
 assert.equal(original.scene.objects.length,3);assert.equal(added.length,1);const copyId=added[0].id;assert.equal(added[0].type,'box');assert(!original.document.animation.tracks.some(t=>t.objectId===copyId));
 for(const row of [edited,reopened]){assert.deepEqual(stable(row.document),stable(original.document));assert(row.document.revision>original.document.revision);assert.equal(row.scene.name,original.scene.name);assert.deepEqual(row.scene.background,original.scene.background);assert.deepEqual(row.scene.objects.map(o=>o.id),[...oldIds,copyId]);for(const object of original.scene.objects)assert.deepEqual(row.scene.objects.find(o=>o.id===object.id),object);assert(row.document.sceneSource.includes('translate: -0 0 0;'));assert(row.document.sceneSource.includes('Duplicate fixture'));}
 const base=original.scene.objects.find(o=>o.id==='block'),copy=added[0],fresh=reopened.scene.objects.find(o=>o.id===copyId);assert.equal(base.type,'box');assert.notDeepEqual(copy.translate,base.translate);assert.notDeepEqual(copy.color,base.color);assert.notEqual(copy.size[0],base.size[0]);assert.deepEqual(copy.size.slice(1),base.size.slice(1));assert.deepEqual({...copy,id:base.id,translate:base.translate,color:base.color,size:base.size},base);assert.notEqual(fresh.size[0],copy.size[0]);assert.deepEqual(fresh.size.slice(1),copy.size.slice(1));assert.deepEqual({...fresh,size:copy.size},copy);assert(reopened.document.revision>edited.document.revision);
 receipt.sourceInputs=inputs.filter(p=>/packages\/barocss-[^/]+\/src\//.test(p)).length;receipt.ownDistInputs=0;receipt.files=rows.map(({path,bytes,document,scene})=>({path,bytes,revision:document.revision,copy:scene.objects.find(o=>o.id===copyId)}));receipt.invariants={originalCameraIdentityClip:true,originalObjectsExact:true,newIndependentIdentity:true,copyOnlyPositionColorSizeEdit:true,freshCopyXOnlyReedit:true,originalCommentAndZeroToken:true,noImplicitTrack:true};receipt.ok=true;
}catch(error){receipt.firstFailure={message:error.message,stack:error.stack};process.exitCode=1;}
await writeFile(resolve(output,'cold-files.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
