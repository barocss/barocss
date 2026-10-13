/** #1572 bounded pair-response observer: exact World markers and temporary graph.
 * The tracked packages/barocss-physics source is never modified.
 */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'physics1572-pair-'));
let matched=0;
function replaceUnique(source,needle,replacement){
 if(source.split(needle).length!==2)throw Error('P1572_EXACT_PAIR_SOURCE_MISMATCH: '+needle);
 return source.replace(needle,replacement);
}
try{
 const outfile=join(temp,'pair.mjs');
 await build({
  entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/pair-response-ledger.ts')],
  outfile,bundle:true,format:'esm',platform:'node',target:'node22',
  plugins:[{name:'p1572-pair-response',setup(api){
   api.onLoad({filter:/world\.ts$/},async args=>{
    matched++;
    let source=await readFile(args.path,'utf8');
    const before='          const hit = detect(a, b);';
    source=replaceUnique(source,before,before+`
          const __p1572Pair=(a.id==='b0'&&b.id==='b1')||(a.id==='b1'&&b.id==='b2')
            ? {ax:a.positionM[0],bx:b.positionM[0],avx:a.velocityMps[0],bvx:b.velocityMps[0]}
            : null;
`);
    const after=`          if (bounds) {
            bounds[aIndex] = bodyBounds(a);
            bounds[bIndex] = bodyBounds(b);
          }`;
    source=replaceUnique(source,after,`
          if (__p1572Pair) {
            (globalThis as {__physics1572PairProbe?:(event:unknown)=>void}).__physics1572PairProbe?.({
              step:stepIndex+1,pass,pair:a.id+'/'+b.id,
              deltaAVx:a.velocityMps[0]-__p1572Pair.avx,
              deltaBVx:b.velocityMps[0]-__p1572Pair.bvx,
              deltaAxM:a.positionM[0]-__p1572Pair.ax,
              deltaBxM:b.positionM[0]-__p1572Pair.bx,
              normalX:hit.normal[0],
              pointCount:manifold?.length??0,
              fallback:manifold===null,
              normalImpulseNs:contact.impulseNs,
              tangentImpulseXNs:contact.tangentImpulseNs[0]
            });
          }
`+after);
    return {contents:source,loader:'ts'};
   });
  }}]
 });
 if(matched!==1)throw Error('P1572_PAIR_WORLD_HOOK_COUNT:'+matched);
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
