import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),args=process.argv.slice(2);
assert(args.length===8&&args[0]==='--original'&&args[2]==='--edited'&&args[4]==='--reopened'&&args[6]==='--output');
const output=resolve(args[7]);await mkdir(dirname(output),{recursive:true});await mkdir(output);
const receipt={issue:1276,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),clean:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()==='',actualGL:false,scope:'Cold real browser Source dimension/axis files',ok:false};
try{
  assert.equal(Number(process.versions.node.split('.')[0]),22);
  const bundle=await build({absWorkingDir:root,stdin:{contents:"export * from '@barocss/render-editor'; export {compileGpu} from '@barocss/gpu';",resolveDir:resolve(root,'apps/render-editor'),sourcefile:'actual-axis-files.mjs'},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true});
  const inputs=Object.keys(bundle.metafile.inputs);assert(inputs.some(p=>p.includes('barocss-render-editor/src/')));assert(!inputs.some(p=>/packages\/barocss-[^/]+\/dist\//.test(p)));
  await writeFile(resolve(output,'source-metafile.json'),JSON.stringify(bundle.metafile,null,2)+'\n');
  const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64')),rows=[];
  for(const index of [1,3,5]){const path=resolve(args[index]),text=await readFile(path,'utf8'),document=api.parseRenderEditorDocument(text);assert.equal(api.serializeRenderEditorDocument(document),text);const value=api.compileGpu({kind:'scene',source:document.sceneSource,sourceVersion:1});assert(value.ok&&value.execution.kind==='sdf');rows.push({path,bytes:Buffer.byteLength(text),document,scene:value.execution.scene});}
  const [original,edited,reopened]=rows,stable=doc=>{const {revision,sceneSource,...rest}=doc;void revision;void sceneSource;return rest;};
  for(const row of [edited,reopened]){assert.deepEqual(stable(row.document),stable(original.document));assert(row.document.revision>original.document.revision);assert.equal(row.scene.name,original.scene.name);assert.deepEqual(row.scene.background,original.scene.background);assert.deepEqual(row.scene.objects.map(o=>[o.id,o.type]),original.scene.objects.map(o=>[o.id,o.type]));for(const object of original.scene.objects)if(object.id!=='block')assert.deepEqual(row.scene.objects.find(o=>o.id===object.id),object);}
  const a=original.scene.objects.find(o=>o.id==='block'),b=edited.scene.objects.find(o=>o.id==='block'),c=reopened.scene.objects.find(o=>o.id==='block');
  assert.equal(a.type,'box');assert.deepEqual(b.translate,a.translate);assert.deepEqual(c.translate,a.translate);assert.deepEqual(b.color,a.color);assert.deepEqual(c.color,a.color);assert.equal(b.radius,a.radius);assert.equal(c.radius,a.radius);
  for(let axis=0;axis<3;axis++){assert.notEqual(b.size[axis],a.size[axis]);assert.notEqual(b.rotateDegrees[axis],a.rotateDegrees[axis]);}
  const ratios=b.size.map((v,i)=>v/a.size[i]);assert(ratios.some(v=>Math.abs(v-ratios[0])>1e-4),'Actual XYZ dimension edits must not be only uniform.');
  assert.notEqual(c.size[0],b.size[0]);assert.deepEqual(c.size.slice(1),b.size.slice(1));assert.deepEqual(c.rotateDegrees,b.rotateDegrees);assert(reopened.document.revision>edited.document.revision);
  receipt.sourceInputs=inputs.filter(p=>/packages\/barocss-[^/]+\/src\//.test(p)).length;receipt.ownDistInputs=0;receipt.files=rows.map(({path,bytes,document,scene})=>({path,bytes,revision:document.revision,box:scene.objects.find(o=>o.id==='block')}));receipt.invariants={originalIdentityCameraClip:true,unselectedExact:true,independentXYZDimensions:true,requestedRotations:true,freshXOnlySizeReedit:true};receipt.ok=true;
}catch(error){receipt.firstFailure={message:error.message,stack:error.stack};process.exitCode=1;}
await writeFile(resolve(output,'cold-files.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
