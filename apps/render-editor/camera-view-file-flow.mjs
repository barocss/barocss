import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'), args=process.argv.slice(2);
assert(args.length===8&&args[0]==='--original'&&args[2]==='--used'&&args[4]==='--reedited'&&args[6]==='--output',
  'Use --original <real file> --used <actual camera download> --reedited <fresh actual re-edit> --output <new directory>.');
const output=resolve(args[7]);await mkdir(dirname(output),{recursive:true});await mkdir(output);
const receipt={issue:1228,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  clean:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()==='',node:process.version,
  scope:'Cold actual browser files; GUI and GL proof is separate',actualGL:false,ok:false};
let stage='source import';
try{
  assert.equal(Number(process.versions.node.split('.')[0]),22);
  const bundle=await build({absWorkingDir:root,stdin:{contents:"export * from '@barocss/render-editor'; export {compileGpu} from '@barocss/gpu';",resolveDir:resolve(root,'apps/render-editor'),sourcefile:'actual-camera-files.mjs'},
    bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true});
  const inputs=Object.keys(bundle.metafile.inputs),own=inputs.filter(p=>/packages\/barocss-[^/]+\/src\//.test(p));
  assert(own.length>0);assert.equal(inputs.filter(p=>/packages\/barocss-[^/]+\/dist\//.test(p)).length,0);
  await writeFile(resolve(output,'source-metafile.json'),JSON.stringify(bundle.metafile,null,2)+'\n');
  const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  stage='real authored files';
  const values=[];
  for(const index of [1,3,5]){
    const path=resolve(args[index]),text=await readFile(path,'utf8'),document=api.parseRenderEditorDocument(text);
    assert.equal(api.serializeRenderEditorDocument(document),text);
    const compilation=api.compileGpu({kind:'scene',source:document.sceneSource,sourceVersion:1});
    assert(compilation.ok&&compilation.execution.kind==='sdf');
    values.push({path,bytes:Buffer.byteLength(text),document,scene:compilation.execution.scene});
  }
  const [original,used,reedited]=values;
  const stable=document=>{const {camera,revision,...fields}=document;void camera;void revision;return fields;};
  for(const value of [used,reedited]){
    assert.deepEqual(stable(value.document),stable(original.document));
    assert.equal(value.document.sceneSource,original.document.sceneSource);
    assert.deepEqual(value.scene,original.scene);
    assert.notDeepEqual(value.document.camera,original.document.camera);
    assert(value.document.revision>original.document.revision);
    assert(!Object.keys(value.document).some(k=>/preview|layout|mode|pointer|frame|draft/i.test(k)));
  }
  assert(reedited.document.revision>used.document.revision);
  assert.notDeepEqual(reedited.document.camera,used.document.camera);
  receipt.source={ownSourceInputs:own.length,ownDistInputs:0};
  receipt.files=values.map(({path,bytes,document,scene})=>({path,bytes,revision:document.revision,camera:document.camera,ids:scene.objects.map(o=>o.id)}));
  receipt.invariants={sourceByteExact:true,fullObjectSceneExact:true,nonCameraDocumentFieldsExact:true,realCameraChanged:true,freshReedit:true,previewAbsent:true};
  receipt.ok=true;
}catch(error){receipt.firstFailure={stage,message:error.message??String(error),stack:error.stack??String(error)};process.exitCode=1;}
await writeFile(resolve(output,'cold-files.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
