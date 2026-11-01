/** Static tools only. No application module is imported or evaluated. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export async function authenticateValidation(root,freezePath,expected){
  const raw=await readFile(freezePath);assert.equal(sha(raw),expected);const freeze=JSON.parse(raw);assert(freeze.files);
  for(const [name,pin]of Object.entries(freeze.files)){const b=await readFile(resolve(root,name));assert.equal(b.length,pin.bytes,name);assert.equal(sha(b),pin.sha256,name);}
  return freeze;
}
function target(entry,kind){return typeof entry==='string'?entry:entry?.[kind]??entry?.import??entry?.default;}
export async function publicMaps(root,mode){
  const own=new Map(),reverse=new Map(),types={};
  for(const folder of await readdir(resolve(root,'packages'))){
    let manifest;const directory=resolve(root,'packages',folder);
    try{manifest=JSON.parse(await readFile(resolve(directory,'package.json'),'utf8'));}catch(e){if(['ENOENT','ENOTDIR'].includes(e.code))continue;throw e;}
    if(!manifest.name?.startsWith('@barocss/'))continue;
    own.set(manifest.name,{directory,manifest});
    for(const [key,value]of Object.entries(manifest.exports??{})){
      const source=target(value,'import'),published=target(manifest.publishConfig?.exports?.[key],'import');
      if(typeof source!=='string'||typeof published!=='string')continue;
      const specifier=manifest.name+(key==='.'?'':key.slice(1));
      const selected=mode==='source'?value:manifest.publishConfig.exports[key];
      const t=target(selected,'types');if(typeof t==='string')types[specifier]=[resolve(directory,t)];
      for(const v of [source,published]){
        const path=resolve(directory,v);reverse.set(path,{directory,source:resolve(directory,source),native:resolve(directory,published),specifier});
        if(path.endsWith('.ts'))reverse.set(path.slice(0,-3)+'.js',{directory,source:resolve(directory,source),native:resolve(directory,published),specifier});
      }
    }
  }
  const resolutions=[];
  const plugin={name:'actual-public-mode-maps',setup(api){
    api.onResolve({filter:/^file:\/\//},args=>{const path=fileURLToPath(args.path);assert(path.startsWith(root+'/'));return {path};});
    api.onResolve({filter:/^@barocss\//},args=>{
      const parts=args.path.split('/'),name=parts.slice(0,2).join('/'),key=parts.length===2?'.':'./'+parts.slice(2).join('/');
      const item=own.get(name);assert(item,'unknown own package '+name);
      const exported=(mode==='source'?item.manifest.exports:item.manifest.publishConfig?.exports)?.[key];
      const selected=target(exported,'import');assert(typeof selected==='string','missing actual public map '+args.path);
      if(mode==='native')assert(selected.startsWith('./dist/'),'native map must select dist '+args.path);
      const path=resolve(item.directory,selected);resolutions.push({specifier:args.path,importer:relative(root,args.importer),target:relative(root,path),kind:'actual-package-map'});return{path};
    });
    api.onResolve({filter:/^\.\.?\//},args=>{
      const path=resolve(args.resolveDir,args.path),key=path.endsWith('.js')?path.slice(0,-3)+'.ts':path;
      const insideOwn=args.importer.startsWith(resolve(root,'packages')+'/');
      // Published modules are never repaired with a source fallback.
      if(insideOwn&&mode==='native'&&/\/packages\/[^/]+\/src\//.test(path))throw Error('published graph references source '+path);
      if(insideOwn&&mode==='source'&&/\/packages\/[^/]+\/dist\//.test(path))throw Error('source graph references emitted module '+path);
      if(insideOwn)return;
      const entry=reverse.get(path)??reverse.get(key);if(!entry)return;
      const chosen=entry[mode];resolutions.push({specifier:args.path,importer:relative(root,args.importer),target:relative(root,chosen),kind:'paired-public-caller-entry'});return{path:chosen};
    });
  }};
  return {own,types,plugin,resolutions};
}
export async function bundleStatic({root,mode,entry,contents,platform,pins,write,name,banner,observe,expectedOwn,externalRuntime=[],sdkBoundary=null}){
  assert(expectedOwn&&['physics','none'].includes(expectedOwn.kind),'explicit per-entry own-closure policy required');
  const {build}=await import(pathToFileURL(resolve(root,'node_modules/esbuild/lib/main.js')).href);
  const maps=await publicMaps(root,mode),inputs={};
  const sdk=await missingNativeSDKBoundary(root,mode,sdkBoundary);
  const verify={name:'authenticate-source-text-before-build',setup(api){api.onLoad({filter:/\.(?:ts|mts|mjs|js)$/},async args=>{
    const path=relative(root,args.path),pin=pins[path];assert(pin,'unfrozen compiler input '+path);const bytes=await readFile(args.path);assert.equal(sha(bytes),pin.sha256,path);
    const original=bytes.toString(),effective=observe?observe(args.path,original):original;
    inputs[path]={bytes:bytes.length,sha256:sha(bytes),effectiveSha256:sha(effective)};return{contents:effective,loader:/\.(?:ts|mts)$/.test(args.path)?'ts':'js'};
  });}};
  const options={absWorkingDir:root,bundle:true,write:false,platform,format:'esm',target:platform==='node'?'node22':'es2022',packages:'external',external:externalRuntime,metafile:true,plugins:[...(sdk.plugin?[sdk.plugin]:[]),maps.plugin,verify],logLevel:'silent',...(banner?{banner:{js:banner}}:{})};
  if(contents!==undefined)options.stdin={contents,resolveDir:root,sourcefile:name+'.mjs'};else options.entryPoints=[entry];
  const result=await build(options);let bytes=0;const outputHash=createHash('sha256');for(const file of result.outputFiles){bytes+=file.contents.length;outputHash.update(file.contents);}assert(bytes<=20*1024*1024,'single bundle bound');
  const ownInputs=Object.keys(result.metafile.inputs).filter(p=>/^packages\//.test(p));
  if(expectedOwn.kind==='none')assert.equal(ownInputs.length,0,'data/loader entry must have exactly zero own-package closure');
  else assert(ownInputs.some(p=>p.startsWith('packages/barocss-physics/')),'actual own Physics closure required');
  for(const input of ownInputs)assert(!input.includes(mode==='native'?'/src/':'/dist/'),'wrong source/native input '+input);
  const report={mode,entry:entry?relative(root,entry):'generated:'+name,platform,inputs,resolutions:maps.resolutions,ownSourceFiles:ownInputs.filter(x=>x.includes('/src/')).length,ownDistFiles:ownInputs.filter(x=>x.includes('/dist/')).length,outputBytes:bytes,outputSha256:outputHash.digest('hex'),expectedOwn,externalRuntime,missingNativeSDKBoundary:sdk.report,nativeHostSDKIntegration:sdk.report?'NOT_RUN_MISSING_SDK_IMPLEMENTATION':'NOT_CLAIMED_BY_COMPILE',externalImports:[...new Set(Object.values(result.metafile.outputs).flatMap(o=>o.imports.filter(i=>i.external).map(i=>i.path)))],moduleEvaluation:false};
  await write(name+'.json',report);
  return {report,code:result.outputFiles[0].contents};
}
export async function strictConsumers({root,out,mode,write}){
  const imported=await import(pathToFileURL(resolve(root,'node_modules/typescript/lib/typescript.js')).href),ts=imported.default??imported;
  const maps=await publicMaps(root,mode),directory=resolve(out,'types-'+mode);await mkdir(directory,{recursive:false});
  const asset=resolve(root,'examples/physics-model-data-2276/model-data.mjs').replaceAll('\\','/');
  const positive=`import {createPhysicsWorld,PhysicsError,type PhysicsModel,type PhysicsState,type Cloth,type Fluid,type VisualProfileId} from '@barocss/physics';
import {createPhysicsRecorder} from '@barocss/physics/replay';
import {admitCadFluidStaticData,assertCadProxyCurrent} from '@barocss/physics/cad-proxy';
import {copyPhysicsModelPreset} from ${JSON.stringify(asset)};
const profile:VisualProfileId='cloth-pinned-sphere-visual-v1';
const input=copyPhysicsModelPreset(profile);const model:PhysicsModel=input.model;
const world=createPhysicsWorld(model,input.options);const state:PhysicsState=world.step([]);
const p:Float64Array=state.cloths[0].positionsM;const c:Cloth=model.cloths[0];const f:Fluid=model.fluids[0];
const e:typeof PhysicsError=PhysicsError;void [p,c,f,e,createPhysicsRecorder,admitCadFluidStaticData,assertCadProxyCurrent];world.dispose();`;
  const negative=`import {createPhysicsWorld,type WorldOptions} from '@barocss/physics';
import {copyPhysicsModelPreset} from ${JSON.stringify(asset)};
// @ts-expect-error Removed root factory.
import {createClothWorld} from '@barocss/physics';
// @ts-expect-error Direct type rename has no alias.
import type {PlannedVisualProfileId} from '@barocss/physics';
// @ts-expect-error Removed cloth runtime subpath.
import {createClothWorld as removedCloth} from '@barocss/physics/cloth';
// @ts-expect-error Removed fluid runtime subpath.
import {createFluidWorld} from '@barocss/physics/fluid';
// @ts-expect-error Removed CAD-fluid runtime subpath.
import {createCadFluidWorld} from '@barocss/physics/fluid-cad';
const input=copyPhysicsModelPreset('fluid-basin-visual-v1');const world=createPhysicsWorld(input.model,input.options);
// @ts-expect-error No dt overload.
world.step(1/120);
// @ts-expect-error No reset method.
world.reset();
// @ts-expect-error Explicit options required.
createPhysicsWorld(input.model);
// @ts-expect-error domain-fixed broad phase is required by visual profiles.
const bad:WorldOptions={profile:'fluid-basin-visual-v1',fixedStepSeconds:1/120,broadPhase:'direct'};
void [bad,createClothWorld,removedCloth,createFluidWorld,createCadFluidWorld];`;
  const paths=[resolve(directory,'strict-positive.mts'),resolve(directory,'strict-negative.mts')];
  await writeFile(paths[0],positive,{flag:'wx'});await writeFile(paths[1],negative,{flag:'wx'});
  const options={strict:true,noEmit:true,skipLibCheck:false,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,baseUrl:root,paths:maps.types,types:['node'],typeRoots:[resolve(root,'node_modules/@types')],lib:['lib.es2022.d.ts','lib.dom.d.ts']};
  const host=ts.createCompilerHost(options),deniedOwnSpecifiers=new Set();
  host.resolveModuleNames=(names,containingFile)=>names.map(name=>{
    if(name.startsWith('@barocss/')){
      const selected=maps.types[name]?.[0];
      if(!selected){deniedOwnSpecifiers.add(name);return undefined;}
      assert(selected.startsWith(resolve(root,'packages')+'/'),'foreign own type map');
      const extension=selected.endsWith('.d.ts')?ts.Extension.Dts:selected.endsWith('.d.mts')?ts.Extension.Dmts:selected.endsWith('.mts')?ts.Extension.Mts:ts.Extension.Ts;
      return {resolvedFileName:selected,extension,isExternalLibraryImport:false,resolvedUsingTsExtension:false};
    }
    return ts.resolveModuleName(name,containingFile,options,host).resolvedModule;
  });
  const program=ts.createProgram(paths,options,host),diagnostics=ts.getPreEmitDiagnostics(program);
  const own=program.getSourceFiles().map(f=>f.fileName).filter(p=>p.includes('/packages/barocss-')||p.includes('/node_modules/@barocss/'));
  assert(own.every(p=>p.startsWith(resolve(root,'packages')+'/')),'foreign worktree own type fallback');
  const wrong=own.filter(p=>p.includes(mode==='native'?'/src/':'/dist/'));
  const report={mode,strict:true,noEmit:true,skipLibCheck:false,positiveAndExpectedNegativeDiagnostics:diagnostics.map(d=>({code:d.code,file:d.file?.fileName,start:d.start,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')})),actualOwnTypeFiles:own.map(p=>relative(root,p)),wrongModeTypes:wrong,WorldCalls:0,moduleEvaluation:false,ownResolution:'failclosed actual public maps; missing own specifier never falls through node_modules',deniedOwnSpecifiers:[...deniedOwnSpecifiers]};
  await write('strict-types-'+mode+'.json',report);assert.equal(diagnostics.length,0,'strict positive/negative consumer diagnostic');assert.equal(wrong.length,0,'native/source declaration fallback');
  return report;
}
export async function generatedPrograms(root){
  const imported=await import(pathToFileURL(resolve(root,'node_modules/typescript/lib/typescript.js')).href),ts=imported.default??imported;
  const result=[];
  for(const file of ['examples/physics-scene/source-import-probe.mjs','examples/physics-scene/cloth-source-import-probe.mjs']){
    const text=await readFile(resolve(root,file),'utf8'),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    // TypeScript's visit callback is synchronous; resolve template slots without evaluating expressions.
    const declarations=[];function collect(n){if(ts.isVariableDeclaration(n)&&['contents','program'].includes(n.name.getText(tree)))declarations.push(n);ts.forEachChild(n,collect);}collect(tree);
    for(const node of declarations){const name=node.name.getText(tree),v=node.initializer;if(!v)continue;
      if(ts.isStringLiteral(v)||ts.isNoSubstitutionTemplateLiteral(v))result.push({file,variable:name,contents:v.text,modes:['source','native']});
      else if(ts.isTemplateExpression(v)){
        assert.equal(file,'examples/physics-scene/cloth-source-import-probe.mjs');assert.equal(name,'program');assert.equal(v.templateSpans.length,2);
        const manifest=JSON.parse(await readFile(resolve(root,'packages/barocss-physics/package.json'),'utf8'));
        const values=[JSON.stringify(pathToFileURL(resolve(root,'packages/barocss-physics',manifest.publishConfig.exports['.'].import)).href),JSON.stringify(pathToFileURL(resolve(root,'examples/physics-model-data-2276/model-data.mjs')).href)];
        let contents=v.head.text;for(let i=0;i<2;i++)contents+=values[i]+v.templateSpans[i].literal.text;
        result.push({file,variable:name,contents,modes:['native'],slots:v.templateSpans.map(s=>s.expression.getText(tree))});
      }
    }
  }
  assert.equal(result.length,3);return result;
}

/** Exact absent SDK endpoints only; never a namespace wildcard or source fallback. */
async function missingNativeSDKBoundary(root,mode,config){
  if(!config)return {plugin:null,report:null};
  assert.equal(mode,'native');
  const definitions=[];
  for(const item of config.entries){
    assert(['@barocss/viewer','@barocss/cad-interop'].includes(item.packageName));
    const manifest=JSON.parse(await readFile(resolve(root,item.manifestPath),'utf8'));
    assert.equal(manifest.name,item.packageName);
    const source=target(manifest.exports[item.exportKey],'import'),native=target(manifest.publishConfig.exports[item.exportKey],'import');
    assert.equal(resolve(root,item.packageDirectory,source),resolve(root,item.sourcePath));
    assert.equal(resolve(root,item.packageDirectory,native),resolve(root,item.nativePath));
    assert.equal(item.specifier,item.packageName+(item.exportKey==='.'?'':item.exportKey.slice(1)));
    let absent=false;try{await stat(resolve(root,item.nativePath));}catch(e){if(e.code==='ENOENT')absent=true;else throw e;}
    assert(absent,'SDK endpoint now exists; boundary must be reviewed '+item.nativePath);
    definitions.push(item);
  }
  const report={scope:'native caller compilation with exact missing SDK endpoints external',implementationClosure:'NOT_RUN',productIntegration:'NOT_RUN',sourceFallback:false,missingEndpoints:definitions.map(x=>({specifier:x.specifier,path:x.nativePath})),used:[]};
  return {report,plugin:{name:'exact-missing-native-host-sdk-boundary',setup(api){api.onResolve({filter:/^(?:@barocss\/|\.\.?\/)/,namespace:'file'},args=>{
    const absolute=args.path.startsWith('.')?resolve(args.resolveDir,args.path):null;
    const item=definitions.find(x=>args.path===x.specifier||absolute===resolve(root,x.sourcePath)||absolute===resolve(root,x.nativePath));
    if(!item)return;
    const importer=relative(root,args.importer);
    assert(!importer.startsWith('packages/barocss-physics/')&&!importer.startsWith('packages/barocss-cad/'),'numerical providers cannot use host SDK boundary');
    assert(config.reviewedImports.some(row=>row.target===item.sourcePath&&row.importer===importer),'unreviewed SDK importer '+importer);
    report.used.push({specifier:args.path,canonicalSpecifier:item.specifier,importer,sourcePath:item.sourcePath,missingNativePath:item.nativePath});
    return {path:item.specifier,external:true};
  });}}};
}
