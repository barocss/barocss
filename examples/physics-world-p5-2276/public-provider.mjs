import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {instrumentPublic} from './public-instrument.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function listFiles(dir){const a=[];for(const e of await readdir(dir,{withFileTypes:true})){assert(!e.isSymbolicLink(),`symlink ${dir}/${e.name}`);const p=resolve(dir,e.name);if(e.isDirectory())a.push(...await listFiles(p));else if(e.isFile())a.push(p);}return a.sort();}
export async function authenticateFreeze(root,file,digest){const b=await readFile(file);assert.equal(sha(b),digest,'parent freeze');const f=JSON.parse(b);assert(f.files&&Object.keys(f.files).length>20);for(const [p,pin]of Object.entries(f.files)){const bytes=await readFile(resolve(root,p));assert.equal(bytes.length,pin.bytes,p);assert.equal(sha(bytes),pin.sha256,p);}return f;}
export async function preparePublicProvider({root,out,graph,freeze,write,evaluate=true}){
 const ts=(await import(pathToFileURL(resolve(root,'node_modules/typescript/lib/typescript.js')).href)).default;
 const inputs={},siteTotals={};
 async function transform(path){const key=relative(root,path),b=await readFile(path),pin=freeze.files[key];assert(pin,`unfrozen provider ${key}`);assert.equal(sha(b),pin.sha256,key);const t=instrumentPublic(ts,path,b.toString());for(const [s,n]of Object.entries(t.sites))siteTotals[s]=(siteTotals[s]??0)+n;inputs[key]={bytes:b.length,sha256:sha(b),effectiveSha256:sha(t.source),sites:t.sites};return t.source;}
 const host=resolve(root,'examples/physics-cloth-viewer/host-controller.mjs');
 if(graph==='source'){
  const {build}=await import(pathToFileURL(resolve(root,'node_modules/esbuild/lib/main.js')).href);
  const pkg='packages/barocss-physics/src/';
  const entry=[`export * as root from ${JSON.stringify(resolve(root,pkg+'index.ts'))};`,`export * as replay from ${JSON.stringify(resolve(root,pkg+'replay.ts'))};`,`export * as cad from ${JSON.stringify(resolve(root,pkg+'cad-proxy.ts'))};`,`export * as canonical from ${JSON.stringify(resolve(root,pkg+'types.ts'))};`,`export {createHostController} from ${JSON.stringify(host)};`].join('\n');
  const result=await build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root,sourcefile:'public-owned-entry.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true,plugins:[{name:'public-owned-source-graph',setup(b){
   b.onResolve({filter:/^@barocss\//},async a=>{const parts=a.path.split('/'),name=parts[1],sub=parts.slice(2).join('/'),manifest=JSON.parse(await readFile(resolve(root,`packages/barocss-${name}/package.json`),'utf8'));const exp=manifest.exports[sub?'./'+sub:'.'];assert(exp,`unknown owned alias ${a.path}`);return{path:resolve(root,`packages/barocss-${name}`,typeof exp==='string'?exp:exp['barocss-source']??exp.import)};});
   b.onLoad({filter:/\.(?:ts|mjs|js)$/},async a=>({contents:await transform(a.path),loader:a.path.endsWith('.ts')?'ts':'js'}));
  }}]});
  assert(result.outputFiles[0].contents.length<=16*1024*1024);
  for(const p of Object.keys(result.metafile.inputs))if(p!=='public-owned-entry.mjs')assert(inputs[p],`untracked ${p}`);
  // A separate root closure proves that optional CAD is absent from the numeric input graph.
  const rootGraph=await build({absWorkingDir:root,entryPoints:[resolve(root,pkg+'index.ts')],bundle:true,platform:'node',format:'esm',write:false,metafile:true});
  for(const key of Object.keys(rootGraph.metafile.inputs))assert(inputs[key],`unfrozen numeric-root closure ${key}`);
  assert(!Object.keys(rootGraph.metafile.inputs).some(p=>/barocss-cad|cad-proxy|cad-fluid/.test(p)),'numeric root imports CAD');
  await write('public-source.mjs',result.outputFiles[0].contents);
  await write('provider-graph.json',{graph,inputs,siteTotals,numericRootInputs:Object.keys(rootGraph.metafile.inputs),bundleSha256:sha(result.outputFiles[0].contents)});
  assert.equal(siteTotals.factory,1);assert.equal(siteTotals['return-world'],1);assert.equal(siteTotals.step,1);assert.equal(siteTotals.commit,2);assert.equal(siteTotals.numeric,2);assert.equal(siteTotals.diagnostic,2);assert.equal(siteTotals['log-prepare'],1);
  return evaluate?import(pathToFileURL(resolve(out,'public-source.mjs')).href):{inputs,siteTotals};
 }
 assert.equal(graph,'native');
 // Parent builds first. This path stages actual emitted files with actual publishConfig maps.
 let stagedBytes=0;
 for(const name of ['physics','cad']){
  const pkg=resolve(root,`packages/barocss-${name}`),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8'));
  if(name==='physics'){assert.deepEqual(Object.keys(manifest.publishConfig.exports).sort(),['.','./cad-proxy','./replay']);const emitted=await listFiles(resolve(pkg,'dist'));for(const legacy of ['cloth.js','fluid.js','fluid-cad.js','cloth/world.js','fluid/world.js','fluid/cad-world.js'])assert(!emitted.includes(resolve(pkg,'dist',legacy)),'obsolete emitted '+legacy);}
  const dest=resolve(out,'provider/node_modules/@barocss',name);await mkdir(dest,{recursive:true});
  await writeFile(resolve(dest,'package.json'),JSON.stringify({...manifest,...manifest.publishConfig,publishConfig:undefined,scripts:undefined}));
  for(const p of await listFiles(resolve(pkg,'dist'))){const b=await readFile(p);stagedBytes+=b.length;assert(stagedBytes<=32*1024*1024);const target=resolve(dest,relative(pkg,p));await mkdir(dirname(target),{recursive:true});const effective=p.endsWith('.js')?await transform(p):b;if(!p.endsWith('.js')){const pin=freeze.files[relative(root,p)];assert(pin,`unfrozen emitted declaration ${p}`);assert.equal(sha(b),pin.sha256);}await writeFile(target,effective,{flag:'wx'});}
 }
 // No bundled clone of the native public root: the consumer imports the staged package map.
 const nativeBase=resolve(out,'provider/node_modules/@barocss/physics/dist');
 const numeric=await readFile(resolve(nativeBase,'index.js'),'utf8');assert(!/from\s*['"][^'"]*(?:@barocss\/cad|cad-proxy|cad-fluid)/.test(numeric));
 const {build}=await import(pathToFileURL(resolve(root,'node_modules/esbuild/lib/main.js')).href);
 const hostBuild=await build({absWorkingDir:root,entryPoints:[host],bundle:true,platform:'node',format:'esm',write:false,metafile:true,external:['@barocss/physics'],plugins:[{name:'freeze-host-inputs',setup(b){b.onLoad({filter:/\.mjs$/},async a=>({contents:await transform(a.path),loader:'js'}));}}]});
 await mkdir(resolve(out,'provider'),{recursive:true});await writeFile(resolve(out,'provider/host.mjs'),hostBuild.outputFiles[0].contents,{flag:'wx'});
 const consumer=`export * as root from '@barocss/physics';\nexport * as replay from '@barocss/physics/replay';\nexport * as cad from '@barocss/physics/cad-proxy';\nexport * as canonical from './node_modules/@barocss/physics/dist/types.js';\nexport {createHostController} from './host.mjs';\n`;
 await writeFile(resolve(out,'provider/consumer.mjs'),consumer,{flag:'wx'});
 await write('provider-graph.json',{graph,mode:'actual-published-native-root-and-native-siblings-no-rebundle-no-source-fallback',stagedBytes,inputs,siteTotals,hostInputs:hostBuild.metafile.inputs});
 const actualRoot=inputs['packages/barocss-physics/dist/index.js'];assert(actualRoot);for(const site of ['factory','return-world','step','numeric','diagnostic','mid-kernel','dispose'])assert(actualRoot.sites[site]>0,'native root overlay '+site);
 return evaluate?import(pathToFileURL(resolve(out,'provider/consumer.mjs')).href):{inputs,siteTotals};
}
