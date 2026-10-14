import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),args=process.argv.slice(2);
assert(args.length===8&&args[0]==='--original'&&args[2]==='--edited'&&args[4]==='--reopened'&&args[6]==='--output',
  'Use --original <actual V0 file> --edited <actual V1 download> --reopened <actual key re-edit> --output <new directory>.');
const output=resolve(args[7]);await mkdir(dirname(output),{recursive:true});await mkdir(output);
const receipt={issue:1255,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  clean:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()==='',node:process.version,
  scope:'Cold actual browser original-animation files. CUA visible playback is separate.',actualGL:false,ok:false};
let stage='ordinary source imports';
try{
  assert.equal(Number(process.versions.node.split('.')[0]),22);
  const bundle=await build({absWorkingDir:root,stdin:{contents:"export * from '@barocss/render-editor'; export {compileGpu} from '@barocss/gpu';",resolveDir:resolve(root,'apps/render-editor'),sourcefile:'actual-animation-files.mjs'},
    bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true});
  const inputs=Object.keys(bundle.metafile.inputs),own=inputs.filter(p=>/packages\/barocss-[^/]+\/src\//.test(p));
  assert(own.length);assert.equal(inputs.filter(p=>/packages\/barocss-[^/]+\/dist\//.test(p)).length,0);
  await writeFile(resolve(output,'source-metafile.json'),JSON.stringify(bundle.metafile,null,2)+'\n');
  const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  stage='actual original files';const rows=[];
  for(const index of [1,3,5]){
    const path=resolve(args[index]),text=await readFile(path,'utf8'),document=api.parseRenderEditorDocument(text);
    assert.equal(api.serializeRenderEditorDocument(document),text);
    const result=api.compileGpu({kind:'scene',source:document.sceneSource,sourceVersion:1});assert(result.ok&&result.execution.kind==='sdf');
    rows.push({path,bytes:Buffer.byteLength(text),document,scene:result.execution.scene});
  }
  const [original,edited,reopened]=rows;
  assert.equal(original.document.version,0);assert.equal(edited.document.version,1);assert.equal(reopened.document.version,1);
  const stable=document=>{const {version,revision,animation,...base}=document;void version;void revision;void animation;return base;};
  assert.deepEqual(original.scene.objects.map(o=>[o.id,o.type]),[['orb','sphere'],['block','box'],['post','cylinder']]);
  for(const value of [edited,reopened]){
    assert.deepEqual(stable(value.document),stable(original.document),'Complete base Source/camera/identity must stay exact.');
    assert.deepEqual(value.scene,original.scene);assert(value.document.revision>original.document.revision);
    assert.equal(value.document.animation.format,'barocss-render-editor-translation-clip');
    assert.equal(value.document.animation.version,0);assert.equal(value.document.animation.timeUnit,'seconds');assert.equal(value.document.animation.interpolation,'linear');
    assert.equal(value.document.animation.tracks.length,1);assert.equal(value.document.animation.tracks[0].objectId,'block');
    assert.deepEqual(value.document.animation.tracks[0].keys.map(k=>k.timeSeconds),[0,1,2]);
    assert(!Object.keys(value.document).some(k=>/preview|clock|player|pose|layout|playing|currentTime/i.test(k)));
  }
  const a=edited.document.animation,b=reopened.document.animation;
  assert.equal(b.id,a.id);assert.deepEqual(a.tracks[0].keys,[{timeSeconds:0,translation:[0,0,0]},{timeSeconds:1,translation:[1,.4,.2]},{timeSeconds:2,translation:[0,0,0]}]);
  assert.deepEqual(b.tracks[0].keys,[{timeSeconds:0,translation:[0,0,0]},{timeSeconds:1,translation:[1.25,.4,.2]},{timeSeconds:2,translation:[0,0,0]}]);
  assert(reopened.document.revision>edited.document.revision);
  stage='independent actual sampled source';
  const sampled=[];
  for(const [row,time,expected] of [[edited,0,[0,0,0]],[edited,.5,[.5,.2,.1]],[edited,1,[1,.4,.2]],[edited,1.5,[.5,.2,.1]],[edited,2,[0,0,0]],[reopened,1,[1.25,.4,.2]]]){
    const source=api.sampleRenderSceneAnimationSource(row.document.sceneSource,row.document.animation,row.document.camera,time);
    const result=api.compileGpu({kind:'scene',source,sourceVersion:1});assert(result.ok&&result.execution.kind==='sdf');
    const scene=result.execution.scene,block=scene.objects.find(o=>o.id==='block');
    assert.deepEqual(block.translate,expected);
    for(const object of original.scene.objects){const actual=scene.objects.find(o=>o.id===object.id);assert.deepEqual(object.id==='block'?{...actual,translate:object.translate}:actual,object);}
    assert.equal(scene.name,original.scene.name);assert.deepEqual(scene.background,original.scene.background);
    assert.equal(row.document.sceneSource,original.document.sceneSource);sampled.push({version:row.document.version,time,translation:block.translate});
  }
  receipt.source={ownSourceInputs:own.length,ownDistInputs:0};receipt.samples=sampled;
  receipt.files=rows.map(({path,bytes,document})=>({path,bytes,version:document.version,revision:document.revision,animation:document.animation??null}));
  receipt.invariants={baseSourceCameraObjectsExact:true,originalIdAndNumberKeys:true,onlyFreshKeyXChanged:true,transientStateAbsent:true};receipt.ok=true;
}catch(error){receipt.firstFailure={stage,message:error.message??String(error),stack:error.stack??String(error)};process.exitCode=1;}
await writeFile(resolve(output,'cold-files.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
