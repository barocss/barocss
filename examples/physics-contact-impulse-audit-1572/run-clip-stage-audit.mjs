import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-clipping-'));let worldHooks=0,manifoldHooks=0;
function replaceOnce(source,needle,replacement){
 if(source.split(needle).length!==2)throw Error('P1572_CLIPPING_MARKER_CHANGED:'+needle);
 return source.replace(needle,replacement);
}
try{
 const outfile=join(temp,'run.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/clip-stage-audit.ts')],
  outfile,bundle:true,platform:'node',format:'esm',target:'node22',
  plugins:[{name:'p1572-clip-trace',setup(api){
   api.onLoad({filter:/world\.ts$/},async args=>{
    worldHooks++;let s=await readFile(args.path,'utf8');
    const anchor='          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;';
    s=replaceOnce(s,anchor,`
          (globalThis as {__p1572ClipContext?:unknown}).__p1572ClipContext={
            step:stepIndex+1,pass,pair:a.id+'/'+b.id,stageIndex:0};
`+anchor);
    return {contents:s,loader:'ts'};
   });
   api.onLoad({filter:/contact-manifold\.ts$/},async args=>{
    manifoldHooks++;let s=await readFile(args.path,'utf8');
    const clipReturn='  return result;\n}';
    s=replaceOnce(s,clipReturn,`
  const ctx=(globalThis as {__p1572ClipContext?:{step:number,pass:number,pair:string,stageIndex:number}}).__p1572ClipContext;
  if(ctx?.pair==='b0/b1'){
    (globalThis as {__p1572ClipProbe?:(e:unknown)=>void}).__p1572ClipProbe?.({
      stage:'clip',before:polygon.length,after:result.length,
      step:ctx.step,pass:ctx.pass,pair:ctx.pair,clipIndex:ctx.stageIndex++});
  }
`+clipReturn);
    const marker='  if (!candidates.length) return null;';
    s=replaceOnce(s,marker,`
  const ctx=(globalThis as {__p1572ClipContext?:{step:number,pass:number,pair:string}}).__p1572ClipContext;
  if(ctx?.pair==='b0/b1'){
    (globalThis as {__p1572ClipProbe?:(e:unknown)=>void}).__p1572ClipProbe?.({
      stage:'separation',before:polygon.length,after:candidates.length,
      step:ctx.step,pass:ctx.pass,pair:ctx.pair});
  }
`+marker);
    return {contents:s,loader:'ts'};
   });
  }}]});
 if(worldHooks!==1||manifoldHooks!==1)throw Error('P1572_INSTRUMENT_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
