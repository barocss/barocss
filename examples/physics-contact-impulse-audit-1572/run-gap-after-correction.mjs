import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const tmp=await mkdtemp(join(tmpdir(),'p1572-gap-correction-'));let w=0,m=0;
function once(s,n,repl){if(s.split(n).length!==2)throw Error('GAP_SOURCE_CHANGED');return s.replace(n,repl)}
try{
 const outfile=join(tmp,'run.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/gap-after-correction.ts')],
 outfile,bundle:true,platform:'node',format:'esm',target:'node22',
 plugins:[{name:'gap-before-after',setup(api){
 api.onLoad({filter:/world\.ts$/},async args=>{
  w++;let s=await readFile(args.path,'utf8');
  const pre='          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;';
  s=once(s,pre,`
          const __measure=a.id==='b0'&&b.id==='b1'&&[1,600,1200].includes(stepIndex+1);
          if(__measure)(globalThis as {__p1572GapContext?:unknown}).__p1572GapContext=
            {step:stepIndex+1,pass,phase:'before',depth:hit.penetration};
`+pre);
  const end='          if (bounds) {\n            bounds[aIndex] = bodyBounds(a);';
  s=once(s,end,`
          if(__measure){
            (globalThis as {__p1572GapContext?:unknown}).__p1572GapContext=
              {step:stepIndex+1,pass,phase:'after',depth:hit.penetration};
            // Test-only read of the same source manifold at corrected body poses
            // against the unchanged original SAT hit normal.
            boxFaceManifold(a,b,hit);
            (globalThis as {__p1572GapContext?:unknown}).__p1572GapContext=undefined;
          }
`+end);
  return {contents:s,loader:'ts'};
 });
 api.onLoad({filter:/contact-manifold\.ts$/},async args=>{
  m++;let s=await readFile(args.path,'utf8');
  const mark='  if (!candidates.length) return null;';
  s=once(s,mark,`
  const __ctx=(globalThis as {__p1572GapContext?:{step:number,pass:number,phase:'before'|'after',depth:number}}).__p1572GapContext;
  if(__ctx){
   const __seps=polygon.map(p=>dot(sub(p,centre),normal));
   (globalThis as {__p1572GapObserver?:(e:unknown)=>void}).__p1572GapObserver?.({
     ...__ctx,reference:reference.body.id+':'+reference.axis+':'+reference.side,
     pointCount:candidates.length,
     minGap:__seps.length?Math.min(...__seps):null,
     maxGap:__seps.length?Math.max(...__seps):null
   });
  }
`+mark);
  return {contents:s,loader:'ts'};
 });
 }}]});
 if(w!==1||m!==1)throw Error('GAP_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(tmp,{recursive:true,force:true});}
