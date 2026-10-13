import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const tmp=await mkdtemp(join(tmpdir(),'physics1572-projection-'));let hooks=0;
try{
 const outfile=join(tmp,'run.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/independent-projection.ts')],
 outfile,bundle:true,platform:'node',format:'esm',target:'node22',
 plugins:[{name:'projection-temporary-probe',setup(api){
 api.onLoad({filter:/world\.ts$/},async args=>{
  hooks++;let s=await readFile(args.path,'utf8');
  const marker='          if (!hit) continue;';
  if(s.split(marker).length!==2)throw Error('PROJECTION_SOURCE_DRIFT');
  s=s.replace(marker,marker+`
          if(a.id==='b0'&&b.id==='b1'){
            const __snapshot=(body:Body)=>({
              positionM:[...body.positionM],orientation:[...body.orientation],
              halfExtentsM:[...(body.shape as BoxShape).halfExtentsM]
            });
            (globalThis as {__p1572ProjectionProbe?:(e:unknown)=>void}).__p1572ProjectionProbe?.({
              step:stepIndex+1,pass,a:__snapshot(a),b:__snapshot(b),
              normal:[...hit.normal],penetrationM:hit.penetration
            });
          }
`);
  // Type annotation must not require BoxShape type import in World; the
  // existent shape union is narrowed by the exact original three-box scenes.
  s=s.replace('halfExtentsM:[...(body.shape as BoxShape).halfExtentsM]',
              "halfExtentsM:[...(body.shape.kind==='box'?body.shape.halfExtentsM:[0,0,0])]");
  return {contents:s,loader:'ts'};
 });
 }}]});
 if(hooks!==1)throw Error('PROJECTION_WORLD_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(tmp,{recursive:true,force:true});}
