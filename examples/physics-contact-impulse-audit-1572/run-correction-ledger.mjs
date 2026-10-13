import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const tmp=await mkdtemp(join(tmpdir(),'p1572-correction-'));let hooks=0;
function once(s,n,r){if(s.split(n).length!==2)throw Error('CORRECTION_SOURCE_DRIFT');return s.replace(n,r)}
try{
 const outfile=join(tmp,'run.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/correction-ledger.ts')],outfile,bundle:true,platform:'node',format:'esm',target:'node22',
 plugins:[{name:'contact-correction-observer',setup(api){
 api.onLoad({filter:/world\.ts$/},async args=>{
  hooks++;let s=await readFile(args.path,'utf8');
  const before='          if (manifold) {';
  s=once(s,before,`
          const __p1572Observe=a.id==='b0'&&b.id==='b1';
          const __p1572A=__p1572Observe?[...a.positionM]:null;
          const __p1572B=__p1572Observe?[...b.positionM]:null;
`+before);
  const after='          if (bounds) {\n            bounds[aIndex] = bodyBounds(a);';
  s=once(s,after,`
          if(__p1572Observe){
            (globalThis as {__p1572Correction?:(e:unknown)=>void}).__p1572Correction?.({
              step:stepIndex+1,pass,fallback:manifold===null,depth:hit.penetration,
              normal:[...hit.normal],aBefore:__p1572A,bBefore:__p1572B,
              aAfter:[...a.positionM],bAfter:[...b.positionM]
            });
          }
`+after);
  return {contents:s,loader:'ts'};
 });
 }}]});
 if(hooks!==1)throw Error('CORRECTION_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(tmp,{recursive:true,force:true});}
