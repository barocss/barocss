import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'physics1572-clip-regression-'));
let hookCount=0;
try{
 const outfile=join(dir,'run.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/clip-tolerance-regression.ts')],
  outfile,bundle:true,platform:'node',format:'esm',target:'node22',
  plugins:[{name:'test-production-clip',setup(api){
   api.onLoad({filter:/contact-manifold\.ts$/},async args=>{
    hookCount++;
    const source=await readFile(args.path,'utf8');
    if(!source.includes('const toleranceM = 1e-9;')||
       !source.includes('const insideA = a <= 0, insideB = b <= 0;'))
      throw Error('CLIP_REGRESSION_SOURCE_CHANGED');
    return {contents:source+'\nexport const __physics1572Clip = clip;\n',loader:'ts'};
   });
  }}]});
 if(hookCount!==1)throw Error('CLIP_REGRESSION_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(dir,{recursive:true,force:true});}
