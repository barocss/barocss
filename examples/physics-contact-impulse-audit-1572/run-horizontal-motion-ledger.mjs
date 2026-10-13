/** Run a TEMPORARY source-augmented Physics World graph for #1572.
 * Exact single-marker match required. Never change the tracked library.
 */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const temporary=await mkdtemp(join(tmpdir(),'physics1572-horizontal-'));
let matched=0;
try{
 const outfile=join(temporary,'horizontal.mjs');
 await build({
  entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/horizontal-motion-ledger.ts')],
  outfile,bundle:true,platform:'node',format:'esm',target:'node22',
  plugins:[{name:'p1572-horizontal-only',setup(api){
   api.onLoad({filter:/world\.ts$/},async args=>{
    matched++;
    const source=await readFile(args.path,'utf8');
    const anchor='      const nextPersistentPoints = new Map<string, PointImpulse>();';
    if(source.split(anchor).length!==2)
      throw Error('P1572_WORLD_PHASE_SOURCE_MISMATCH');
    const injection=`
      (globalThis as {__physics1572HorizontalProbe?: (event: unknown)=>void}).__physics1572HorizontalProbe?.({
        step:stepIndex+1,
        predicted:next.filter(body=>body.kind==='dynamic')
          .map(body=>({id:body.id,x:body.positionM[0],vx:body.velocityMps[0]}))
      });
`;
    return {contents:source.replace(anchor,anchor+'\n'+injection),loader:'ts'};
   });
  }}]
 });
 if(matched!==1)throw Error('P1572_WORLD_PHASE_HOOK_COUNT:'+matched);
 await import(pathToFileURL(outfile).href);
}finally{await rm(temporary,{recursive:true,force:true});}
