/** Explicit compiled checkpoints after source-first workspace defaults (#1016). */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,readdir,realpath} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,relative,join,isAbsolute} from 'node:path';
import {build} from 'esbuild';

const folders=['barocss-cad','barocss-gpu','barocss-physics','barocss-viewer','barocss-cad-interop','barocss-canvas2d'];
const owned=['barocss-cad','barocss-gpu'],prepared=new Map();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const slash=path=>path.replaceAll('\\','/');
const inside=(root,path)=>{const value=relative(root,path);return value!==''&&!value.startsWith('..'+String.fromCharCode(47))&&value!=='..'&&!isAbsolute(value);};
async function save(output,name,value){await writeFile(resolve(output,name),JSON.stringify(value,null,2)+'\n');}
async function walk(directory){const entries=await readdir(directory,{withFileTypes:true}),files=[];for(const item of entries.sort((a,b)=>a.name.localeCompare(b.name))){assert(!item.isSymbolicLink(),'Fingerprint refuses symbolic source/config files');const path=join(directory,item.name);if(item.isDirectory())files.push(...await walk(path));else if(item.isFile())files.push(path);}return files;}
async function fingerprint(repo,dist=false){
  const files=[];
  for(const folder of owned){
    const root=resolve(repo,'packages',folder);
    if(dist){files.push(...await walk(resolve(root,'dist')));continue;}
    files.push(...await walk(resolve(root,'src')));
    for(const item of await readdir(root,{withFileTypes:true})){
      if(item.isFile()&&(item.name==='package.json'||/^tsconfig.*\.json$/.test(item.name)||/\.config\.[cm]?[jt]s$/.test(item.name)))files.push(resolve(root,item.name));
      if(item.isDirectory()&&item.name==='scripts')files.push(...await walk(resolve(root,item.name)));
    }
  }
  assert(files.length<=8192,'Fingerprint file budget exceeded');
  const records=[];for(const file of files.sort()){const bytes=await readFile(file);records.push({path:slash(relative(repo,file)),bytes:bytes.length,sha256:hash(bytes)});}
  return{sha256:hash(JSON.stringify(records)),files:records};
}
async function maps(repo){
  const result=[];
  for(const folder of folders){
    const root=resolve(repo,'packages',folder),manifestPath=resolve(root,'package.json'),bytes=await readFile(manifestPath),manifest=JSON.parse(bytes);
    const exports=manifest.publishConfig?.exports;
    assert(exports&&typeof exports==='object'&&!Array.isArray(exports),'Missing complete publishConfig.exports: '+folder);
    assert.equal(manifest.name,'@barocss/'+folder.slice('barocss-'.length),'Unexpected declared package identity');
    for(const [subpath,entry]of Object.entries(exports)){
      assert(subpath==='.'||/^\.\/[A-Za-z0-9_-]+$/.test(subpath),'Unsupported published subpath');
      for(const condition of ['import','types'])assert(typeof entry?.[condition]==='string'&&/^\.\/dist\/[A-Za-z0-9_./-]+$/.test(entry[condition])&&!entry[condition].split('/').includes('..'),'Published '+condition+' must be a dist path');
      assert(/\.m?js$/.test(entry.import)&&/\.d\.[cm]?ts$/.test(entry.types),'Published JS/declaration pair required');
    }
    result.push({folder,name:manifest.name,root,manifestPath,manifestSHA256:hash(bytes),publishedExports:exports});
  }
  return result;
}
async function provider(map,subpath,sourceSHA256){
  const published=map.publishedExports[subpath];assert(published,'Missing explicit published subpath: '+map.name+subpath);
  const entry=resolve(map.root,published.import),types=resolve(map.root,published.types),dist=await realpath(resolve(map.root,'dist'));
  assert(inside(dist,await realpath(entry))&&inside(dist,await realpath(types)),'Compiled provider escaped its own dist');
  const [js,declaration]=await Promise.all([readFile(entry),readFile(types)]);
  return{entry,relative:'../../packages/'+map.folder+'/'+published.import.replace(/^\.\//,''),sha256:hash(js),
    package:map.name,folder:map.folder,subpath,publishedImport:published.import,publishedTypes:published.types,
    types,typesSHA256:hash(declaration),manifest:map.manifestPath,manifestSHA256:map.manifestSHA256,sourceSHA256};
}
async function affectedBuild(repo,output,name){
  const args=['--filter',name,'build:library'],log=resolve(output,name.slice('@barocss/'.length)+'-build.log');
  const chunks=[],env={...process.env,pnpm_config_verify_deps_before_run:'false'};
  const child=spawn('pnpm',args,{cwd:repo,env,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',data=>chunks.push(data));child.stderr.on('data',data=>chunks.push(data));
  let row;try{row=await new Promise((accept,reject)=>{child.once('error',reject);child.once('close',(exit,signal)=>accept({command:['pnpm',...args],exit,signal,log,node:process.execPath,nodeVersion:process.version,verifyDepsBeforeRun:false}));});}
  catch(error){await writeFile(log,Buffer.concat([...chunks,Buffer.from(String(error))]));throw error;}
  await writeFile(log,Buffer.concat(chunks));return row;
}
/** Fresh CAD then GPU builds precede manifest-resolved compiled provider admission. */
export async function prepareCompiledProviders(repoInput,outputInput){
  const repo=resolve(repoInput),output=resolve(outputInput);await mkdir(output,{recursive:true});
  assert.equal(Number(process.versions.node.split('.')[0]),22,'Compiled checkpoint requires Node22');
  const before=await fingerprint(repo),receipt={schema:'barocss-compiled-provider-builds',version:0,repo,node:process.version,sourceBefore:before,builds:[],accepted:false};
  try{
    for(const name of ['@barocss/cad','@barocss/gpu']){
      const row=await affectedBuild(repo,output,name);receipt.builds.push(row);await save(output,'provider-builds.json',receipt);
      assert.equal(row.exit,0,'Affected library build failed: '+name);assert.equal(row.signal,null,'Affected build was interrupted');
      const after=await fingerprint(repo);assert.equal(after.sha256,before.sha256,'Source/config changed during affected build');
    }
    const published=await maps(repo),sourceAfter=await fingerprint(repo);assert.equal(sourceAfter.sha256,before.sha256,'Source/config changed before provider resolution');
    const cad=await provider(published.find(map=>map.folder==='barocss-cad'),'.',before.sha256),gpu=await provider(published.find(map=>map.folder==='barocss-gpu'),'.',before.sha256);
    receipt.sourceAfter=sourceAfter;receipt.providers={cad,gpu};receipt.publishedMaps=published;receipt.compiledAfter=await fingerprint(repo,true);receipt.accepted=true;
    const value={gpu,cad,buildReceipt:receipt};prepared.set(repo+'\0'+output,{...value,maps:published});await save(output,'provider-builds.json',receipt);return value;
  }catch(error){receipt.failure=String(error.stack||error);await save(output,'provider-builds.json',receipt);throw error;}
}
/** Bundle only explicit published own-package paths, then inspect actual consumed inputs. */
export async function buildCompiledClient(repoInput,outputInput,options){
  const repo=resolve(repoInput),output=resolve(outputInput),state=prepared.get(repo+'\0'+output);assert(state,'Call prepareCompiledProviders first for this output');
  const before=await fingerprint(repo),distBefore=await fingerprint(repo,true),resolutions=[];
  assert.equal(before.sha256,state.buildReceipt.sourceBefore.sha256,'Source/config changed before client compilation');
  assert.equal(distBefore.sha256,state.buildReceipt.compiledAfter.sha256,'Compiled outputs changed before client compilation');
  const plugin={name:'explicit-published-map',setup(builder){builder.onResolve({filter:/^@barocss\//},async args=>{
    const map=state.maps.find(value=>args.path===value.name||args.path.startsWith(value.name+'/'));assert(map,'Unknown own package: '+args.path);
    const subpath=args.path===map.name?'.':'.'+args.path.slice(map.name.length),value=await provider(map,subpath,before.sha256);
    resolutions.push({request:args.path,importer:args.importer,...value});return{path:value.entry};
  });}};
  const virtual=options.stdin?.sourcefile?resolve(options.stdin.resolveDir??repo,options.stdin.sourcefile):null;
  const receipt={schema:'barocss-compiled-client-inputs',version:0,sourceBefore:before,compiledBefore:distBefore,providers:{gpu:state.gpu,cad:state.cad},resolutions,
    clientSource:options.stdin?{path:virtual,sha256:hash(options.stdin.contents)}:null,accepted:false};
  try{
    const result=await build({...options,absWorkingDir:repo,metafile:true,plugins:[plugin]});const ownInputs=[];
    for(const [path,input]of Object.entries(result.metafile.inputs)){
      if(path.startsWith('<'))continue;
      const absolute=resolve(repo,path);if(virtual===absolute)continue;
      const actual=await realpath(absolute),map=state.maps.find(value=>inside(value.root,actual));
      if(!map)continue;
      assert(inside(resolve(map.root,'dist'),actual),'Own source/non-dist input consumed: '+path);
      ownInputs.push({path,absolute:actual,package:map.name,bytes:input.bytes,sha256:hash(await readFile(actual))});
    }
    assert(ownInputs.some(row=>row.package==='@barocss/cad')&&ownInputs.some(row=>row.package==='@barocss/gpu'),'Actual compiled CAD/GPU inputs required');
    const after=await fingerprint(repo),distAfter=await fingerprint(repo,true),currentMaps=await maps(repo);
    assert.equal(after.sha256,before.sha256,'Source/config changed during client compilation');assert.equal(distAfter.sha256,distBefore.sha256,'Compiled outputs changed during client compilation');
    assert.deepEqual(currentMaps.map(map=>map.manifestSHA256),state.maps.map(map=>map.manifestSHA256),'Published maps changed during client compilation');
    Object.assign(receipt,{sourceAfter:after,compiledAfter:distAfter,publishedMaps:state.maps,ownSourceInputs:0,ownCompiledInputs:ownInputs,metafile:result.metafile,accepted:true});
    await save(output,'compiled-inputs.json',receipt);return result;
  }catch(error){receipt.failure=String(error.stack||error);await save(output,'compiled-inputs.json',receipt);throw error;}
}
