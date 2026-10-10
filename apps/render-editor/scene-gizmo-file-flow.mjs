import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),args=process.argv.slice(2);
assert(args.length===8&&args[0]==='--original'&&args[2]==='--edited'&&args[4]==='--reopened'&&args[6]==='--output',
  'Use --original <actual baseline file> --edited <actual gizmo file> --reopened <actual re-edit file> --output <new directory>.');
const output=resolve(args[7]);await mkdir(dirname(output),{recursive:true});await mkdir(output);
const receipt={issue:1242,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  clean:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()==='',node:process.version,
  scope:'Cold real browser files; CUA pointer/GL evidence separate',actualGL:false,ok:false};
let stage='current source imports';
try{
  assert.equal(Number(process.versions.node.split('.')[0]),22);
  const bundle=await build({absWorkingDir:root,stdin:{contents:"export * from '@barocss/render-editor'; export {compileGpu} from '@barocss/gpu';",resolveDir:resolve(root,'apps/render-editor'),sourcefile:'actual-gizmo-files.mjs'},
    bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true});
  const inputs=Object.keys(bundle.metafile.inputs),own=inputs.filter(p=>/packages\/barocss-[^/]+\/src\//.test(p));
  assert(own.length);assert.equal(inputs.filter(p=>/packages\/barocss-[^/]+\/dist\//.test(p)).length,0);
  await writeFile(resolve(output,'source-metafile.json'),JSON.stringify(bundle.metafile,null,2)+'\n');
  const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  stage='actual authored files';const rows=[];
  for(const index of [1,3,5]){
    const path=resolve(args[index]),text=await readFile(path,'utf8'),document=api.parseRenderEditorDocument(text);
    assert.equal(api.serializeRenderEditorDocument(document),text);
    const compiled=api.compileGpu({kind:'scene',source:document.sceneSource,sourceVersion:1});assert(compiled.ok&&compiled.execution.kind==='sdf');
    rows.push({path,bytes:Buffer.byteLength(text),document,scene:compiled.execution.scene});
  }
  const [original,edited,reopened]=rows,stable=doc=>{const {sceneSource,revision,...rest}=doc;return rest;};
  assert.deepEqual(original.scene.objects.map(o=>[o.id,o.type]),[['orb','sphere'],['block','box'],['post','cylinder']]);
  for(const value of [edited,reopened]){
    assert.deepEqual(stable(value.document),stable(original.document));assert(value.document.revision>original.document.revision);
    assert.equal(value.scene.name,original.scene.name);assert.deepEqual(value.scene.background,original.scene.background);
    assert.deepEqual(value.scene.objects.map(o=>[o.id,o.type]),original.scene.objects.map(o=>[o.id,o.type]));
    for(const object of original.scene.objects)if(object.id!=='block')assert.deepEqual(value.scene.objects.find(o=>o.id===object.id),object);
    const before=original.scene.objects.find(o=>o.id==='block'),after=value.scene.objects.find(o=>o.id==='block');
    assert.deepEqual(after.color,before.color);assert.equal(after.radius,before.radius);
    assert.notDeepEqual(after.translate,before.translate);assert.notDeepEqual(after.rotateDegrees,before.rotateDegrees);assert.notDeepEqual(after.size,before.size);
    const ratios=after.size.map((v,i)=>v/before.size[i]);assert(ratios.every(v=>Math.abs(v-ratios[0])<1e-10),'Scale must be real uniform primitive dimensions.');
    assert(value.document.sceneSource.startsWith('/* Primitive study: edit the original source, then Apply. */'));
    assert(!Object.keys(value.document).some(k=>/gizmo|preview|gesture|pointer|layout|mode/i.test(k)));
  }
  stage='fresh original object re-edit';
  const a=edited.scene.objects.find(o=>o.id==='block'),b=reopened.scene.objects.find(o=>o.id==='block');
  assert.notEqual(a.translate[0],b.translate[0]);assert.deepEqual(a.translate.slice(1),b.translate.slice(1));
  assert.deepEqual(a.rotateDegrees,b.rotateDegrees);assert.deepEqual(a.size,b.size);
  assert(reopened.document.revision>edited.document.revision);
  receipt.source={ownSourceInputs:own.length,ownDistInputs:0};
  receipt.files=rows.map(({path,bytes,document,scene})=>({path,bytes,revision:document.revision,box:scene.objects.find(o=>o.id==='block')}));
  receipt.invariants={identityCameraExact:true,originalObjectIds:true,unselectedObjectsExact:true,actualSelectedTranslationRotationUniformDimensions:true,
    realFreshSourceReedit:true,previewStateAbsent:true};receipt.ok=true;
}catch(error){receipt.firstFailure={stage,message:error.message??String(error),stack:error.stack??String(error)};process.exitCode=1;}
await writeFile(resolve(output,'cold-files.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
