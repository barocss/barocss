import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const tmp=await mkdtemp(join(tmpdir(),'p1572-axes-'));let hooked=0;
try{
 const outfile=join(tmp,'run.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/independent-axis-selection.ts')],
 outfile,bundle:true,platform:'node',format:'esm',target:'node22',
 plugins:[{name:'p1572-axis-witness',setup(api){
 api.onLoad({filter:/world\.ts$/},async args=>{
  hooked++;let s=await readFile(args.path,'utf8');
  const needle='          if (!hit) continue;';
  if(s.split(needle).length!==2)throw Error('AXIS_SOURCE_MISMATCH');
  s=s.replace(needle,needle+`
          if(a.id==='b0'&&b.id==='b1'){
            const pose=(v:Body)=>({p:[...v.positionM],q:[...v.orientation],
              e:[...(v.shape.kind==='box'?v.shape.halfExtentsM:[0,0,0])]});
            (globalThis as {__p1572AxisProbe?:(e:unknown)=>void}).__p1572AxisProbe?.({
              step:stepIndex+1,pass,a:pose(a),b:pose(b),
              normal:[...hit.normal],penetration:hit.penetration
            });
          }
`);
  return {contents:s,loader:'ts'};
 });
 }}]});
 if(hooked!==1)throw Error('AXIS_WORLD_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(tmp,{recursive:true,force:true});}
