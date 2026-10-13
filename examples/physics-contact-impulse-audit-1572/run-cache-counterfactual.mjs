/** #1572 TEMPORARY private World transform for matched warm-reuse/cold-reset control.
 * No tracked production package changes. Reject any source drift.
 */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-control-'));
let hooks=0;
try{
 const output=join(temp,'run.mjs');
 await build({
   entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/cache-counterfactual.ts')],
   outfile:output,bundle:true,platform:'node',format:'esm',target:'node22',
   plugins:[{name:'p1572-cold-reset-control',setup(api){
     api.onLoad({filter:/world\.ts$/},async args=>{
       hooks++;
       const contents=await readFile(args.path,'utf8');
       const needle='                const prior = persistentPoints.get(pointKey);';
       if(contents.split(needle).length!==2)throw Error('P1572_EXACT_SOURCE_MARKER_MISMATCH');
       return {contents:contents.replace(needle,
         '                const prior = (globalThis as {__physics1572ColdStart?:boolean}).__physics1572ColdStart ? undefined : persistentPoints.get(pointKey);'),
         loader:'ts'};
     });
   }}]
 });
 if(hooks!==1)throw Error('P1572_SOURCE_HOOK_COUNT:'+hooks);
 await import(pathToFileURL(output).href);
}finally{await rm(temp,{recursive:true,force:true});}
