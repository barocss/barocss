/** Exact-guarded temporary World instrumentation; production remains untouched. */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-fallback-'));let hooks=0;
function unique(source,anchor,injected){
 if(source.split(anchor).length!==2)throw Error('P1572_WORLD_ANCHOR_MISMATCH');
 return source.replace(anchor,injected);
}
try{
 const outfile=join(temp,'run.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/fallback-inclusive-impulse.ts')],
  outfile,bundle:true,platform:'node',format:'esm',target:'node22',
  plugins:[{name:'p1572-fallback-inclusive',setup(api){
   api.onLoad({filter:/world\.ts$/},async args=>{
    hooks++;let source=await readFile(args.path,'utf8');
    const before='          if (manifold) {';
    source=unique(source,before,`
          const __probe=(stepIndex+1===1||stepIndex+1===600||stepIndex+1===1200)
            &&((a.id==='b0'&&b.id==='b1')||(a.id==='b1'&&b.id==='b2'));
          const __preA=__probe?[...a.velocityMps]:null;
          const __preB=__probe?[...b.velocityMps]:null;
`+before);
    const after='          if (bounds) {\n            bounds[aIndex] = bodyBounds(a);';
    source=unique(source,after,`
          if(__probe){
            (globalThis as {__p1572FallbackProbe?:(e:unknown)=>void}).__p1572FallbackProbe?.({
              step:stepIndex+1,pass,pair:a.id+'/'+b.id,fallback:manifold===null,
              pointCount:manifold?.length??0,pointM:[...contact.pointM],normal:[...hit.normal],
              deltaAV:a.velocityMps.map((v,i)=>v-__preA![i]),
              deltaBV:b.velocityMps.map((v,i)=>v-__preB![i]),
              impulseNs:contact.impulseNs,tangentImpulseNs:[...contact.tangentImpulseNs]
            });
          }
`+after);
    return {contents:source,loader:'ts'};
   });
  }}]});
 if(hooks!==1)throw Error('P1572_WORLD_HOOK_COUNT:'+hooks);
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
