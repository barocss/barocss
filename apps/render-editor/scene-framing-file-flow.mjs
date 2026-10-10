import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),args=process.argv.slice(2);
assert(args.length===8&&args[0]==='--original'&&args[2]==='--framed'&&args[4]==='--reopened'&&args[6]==='--output');
const output=resolve(args[7]);await mkdir(dirname(output),{recursive:true});await mkdir(output);
const receipt={issue:1323,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),clean:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()==='',actualGL:false,scope:'Cold genuine viewport-framing-only browser files',ok:false};
try{
 assert.equal(Number(process.versions.node.split('.')[0]),22);
 const bundle=await build({absWorkingDir:root,stdin:{contents:"export * from '@barocss/render-editor'; export {prepareSourceSceneBounds} from '@barocss/gpu';",resolveDir:resolve(root,'apps/render-editor'),sourcefile:'actual-framing-files.mjs'},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true});
 const inputs=Object.keys(bundle.metafile.inputs);assert(inputs.some(p=>p.includes('barocss-render-editor/src/')));assert(inputs.some(p=>p.includes('barocss-gpu/src/source-scene-bounds.ts')));assert(!inputs.some(p=>/packages\/barocss-[^/]+\/dist\//.test(p)));await writeFile(resolve(output,'source-metafile.json'),JSON.stringify(bundle.metafile,null,2)+'\n');
 const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64')),rows=[];
 for(const i of [1,3,5]){const path=resolve(args[i]),text=await readFile(path,'utf8'),document=api.parseRenderEditorDocument(text);assert.equal(api.serializeRenderEditorDocument(document),text);const bounds=api.prepareSourceSceneBounds({sourceVersion:1,source:document.sceneSource});assert(bounds.bounds&&bounds.objects.length===4);assert(document.animation.tracks.some(t=>t.objectId==='block'));assert(!document.animation.tracks.some(t=>t.objectId==='box_1'));rows.push({path,text,bytes:Buffer.byteLength(text),document,bounds});}
 const [original,framed,reopened]=rows;assert.equal(framed.text,original.text);assert.equal(reopened.text,original.text);assert.deepEqual(framed.bounds,original.bounds);assert.deepEqual(reopened.bounds,original.bounds);
 receipt.sourceInputs=inputs.filter(p=>/packages\/barocss-[^/]+\/src\//.test(p)).length;receipt.ownDistInputs=0;receipt.files=rows.map(({path,bytes,document,bounds})=>({path,bytes,revision:document.revision,objects:bounds.objects.map(o=>o.objectId)}));receipt.invariants={actualByteExactNavigationOnly:true,originalCameraSourceClipIdentity:true,noViewportOrFramingStateSerialized:true,freshOriginalGeometry:true};receipt.ok=true;
}catch(error){receipt.firstFailure={message:error.message,stack:error.stack};process.exitCode=1;}
await writeFile(resolve(output,'cold-files.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
