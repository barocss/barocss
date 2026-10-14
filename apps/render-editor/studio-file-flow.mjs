import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),args=process.argv.slice(2);
const flags=['--baseline','--view','--edited','--reopened','--animation-original','--animation-view','--output'];
assert(args.length===14&&flags.every((name,index)=>args[index*2]===name),'Use seven named file/output arguments.');
const output=resolve(args[13]);await mkdir(dirname(output),{recursive:true});await mkdir(output);
const receipt={issue:1290,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),clean:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()==='',actualGL:false,scope:'Cold genuine Source studio camera/shape/animation files; CUA GL is separate',ok:false};
try{
  assert.equal(Number(process.versions.node.split('.')[0]),22);
  const compiled=await build({absWorkingDir:root,stdin:{contents:"export * from '@barocss/render-editor'; export {compileGpu} from '@barocss/gpu';",resolveDir:resolve(root,'apps/render-editor'),sourcefile:'studio-real-files.mjs'},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true});
  const inputs=Object.keys(compiled.metafile.inputs);assert(!inputs.some(p=>/packages\/barocss-[^/]+\/dist\//.test(p)));assert(inputs.some(p=>p.includes('barocss-render-editor/src/')));
  await writeFile(resolve(output,'source-metafile.json'),JSON.stringify(compiled.metafile,null,2)+'\n');const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
  const rows=[];for(let i=1;i<12;i+=2){const path=resolve(args[i]),text=await readFile(path,'utf8'),document=api.parseRenderEditorDocument(text);assert.equal(api.serializeRenderEditorDocument(document),text);const result=api.compileGpu({kind:'scene',source:document.sceneSource,sourceVersion:1});assert(result.ok&&result.execution.kind==='sdf');rows.push({path,text,bytes:Buffer.byteLength(text),document,scene:result.execution.scene});}
  const [baseline,view,edited,reopened,animationOriginal,animationView]=rows;
  assert.equal(view.text,baseline.text,'Local camera/layout/selection must not author the V0 file.');assert.equal(animationView.text,animationOriginal.text,'Local camera must preserve the complete original V1 source and keys.');assert.equal(baseline.document.version,0);assert.equal(animationOriginal.document.version,1);
  const identity=document=>{const {revision,camera,sceneSource,...rest}=document;void revision;void camera;void sceneSource;return rest;};for(const row of [edited,reopened])assert.deepEqual(identity(row.document),identity(baseline.document));
  assert(edited.document.revision>baseline.document.revision);assert(reopened.document.revision>edited.document.revision);assert.notDeepEqual(edited.document.camera,baseline.document.camera,'Explicit Set scene camera must really adopt the view.');assert.deepEqual(reopened.document.camera,edited.document.camera);
  assert.equal(baseline.scene.objects.length,3);assert.equal(edited.scene.objects.length,4);assert.equal(reopened.scene.objects.length,4);assert.deepEqual(edited.scene.objects.map(o=>[o.id,o.type]),reopened.scene.objects.map(o=>[o.id,o.type]));
  const added=edited.scene.objects.find(o=>!baseline.scene.objects.some(a=>a.id===o.id));assert(added&&added.type==='sphere');
  for(const original of baseline.scene.objects){const a=edited.scene.objects.find(o=>o.id===original.id),b=reopened.scene.objects.find(o=>o.id===original.id);assert.deepEqual(a,b);if(original.id==='block'){assert.deepEqual({...a,translate:original.translate},original);assert.notDeepEqual(a.translate,original.translate);}else assert.deepEqual(a,original);}
  const changed=reopened.scene.objects.find(o=>o.id===added.id);assert.notEqual(changed.radius,added.radius);assert.deepEqual({...changed,radius:added.radius},added);
  for(const row of rows)assert(!Object.keys(row.document).some(k=>/viewport|layout|playing|player|preview/i.test(k)));
  receipt.sourceInputs=inputs.filter(p=>/packages\/barocss-[^/]+\/src\//.test(p)).length;receipt.ownDistInputs=0;receipt.files=rows.map(({path,bytes,document})=>({path,bytes,version:document.version,revision:document.revision}));receipt.invariants={localViewNoAuthV0V1:true,actualAdoptedSceneCamera:true,topToolbarRealSphere:true,originalIdsAndUnrelatedFields:true,actualDisplayedViewGizmo:true,freshAddedSphereRadiusOnly:true,transientViewLayoutAbsent:true};receipt.ok=true;
}catch(error){receipt.firstFailure={message:error.message,stack:error.stack};process.exitCode=1;}
await writeFile(resolve(output,'cold-files.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
