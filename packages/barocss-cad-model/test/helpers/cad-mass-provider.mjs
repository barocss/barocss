// Test-only provider seam. The actual CAD facade is bundled unchanged into an external temporary graph.
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
export async function controlledCadMass(t,{modelRoot,provider}){
 const{build}=createRequire(join(modelRoot,'package.json'))('esbuild');
 const repo=await realpath(resolve(modelRoot,'../..'));
 const outside=path=>{if(path===repo||path.startsWith(`${repo}/`))throw new Error('Mass provider overlays must stay outside the worktree');return path;};
 const core=await realpath(resolve(modelRoot,'../barocss-cad/src/api/core.ts'));
 const native=await realpath(resolve(modelRoot,'../barocss-cad/src/part/part-model.ts'));
 const temp=await mkdtemp(join(tmpdir(),'cad-api-mass-provider-')),key=`__cadMassProvider${temp.split('/').at(-1).replaceAll('-','')}`;
 globalThis[key]=provider;t.after(async()=>{delete globalThis[key];await rm(temp,{recursive:true,force:true});});
 let overlay=null;
 const manifest=process.env.BAROCSS_MASS_PROVENANCE_OVERLAY;
 if(manifest){
  const descriptor=JSON.parse(await readFile(outside(await realpath(manifest)),'utf8'));
  const file=outside(await realpath(descriptor.file));
  if(await realpath(descriptor.source)===core)overlay=await readFile(file,'utf8');
 }
 const outfile=join(temp,'core.mjs');
 await build({entryPoints:[core],outfile,bundle:true,format:'esm',platform:'node',target:'node22',logLevel:'warning',plugins:[{
  name:'controlled-native-mass-provider',setup(builder){
   // Only the dependency imported by CAD api/core is replaced. Native fixture computation stays real.
   builder.onResolve({filter:/part-model\.js$/},args=>args.importer===core?{path:'native-mass-provider',namespace:'test'}:undefined);
   builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export * from ${JSON.stringify(native)};export const massPropertiesOf=(output,density)=>globalThis[${JSON.stringify(key)}](output,density);`,loader:'js',resolveDir:resolve(core,'..')}));
   if(overlay!==null)builder.onLoad({filter:/[\\/]api[\\/]core\.ts$/},args=>args.path===core?{contents:overlay,loader:'ts',resolveDir:resolve(core,'..')}:undefined);
  }
 }]});
 return import(pathToFileURL(outfile).href);
}
