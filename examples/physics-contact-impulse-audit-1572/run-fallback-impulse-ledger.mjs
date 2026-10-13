/** Bounded read-only test observer in a temporary World build only. */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'physics1572-fallback-'));let hooked=0;
const replace=(s,needle,newText)=>{
 if(s.split(needle).length!==2)throw Error('FALLBACK_SOURCE_DRIFT:'+needle);
 return s.replace(needle,newText);
};
try{
 const outfile=join(temp,'audit.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/fallback-impulse-ledger.ts')],
  outfile,bundle:true,platform:'node',format:'esm',target:'node22',
  plugins:[{name:'p1572-fallback-ledger',setup(api){
   api.onLoad({filter:/world\.ts$/},async args=>{
    hooked++;
    let s=await readFile(args.path,'utf8');
    const begin='          const hit = detect(a, b);';
    s=replace(s,begin,begin+`
          const __auditPair=(a.id==='b0'&&b.id==='b1')||(a.id==='b1'&&b.id==='b2');
          const __initialA=__auditPair?[...a.velocityMps]:null;
          const __initialB=__auditPair?[...b.velocityMps]:null;
`);
    const end='          if (bounds) {\n            bounds[aIndex] = bodyBounds(a);';
    s=replace(s,end,`
          if(__auditPair && __initialA && __initialB){
            const da=a.velocityMps.map((v,i)=>v-__initialA[i]);
            const db=b.velocityMps.map((v,i)=>v-__initialB[i]);
            (globalThis as {__physics1572FallbackProbe?:(e:unknown)=>void}).__physics1572FallbackProbe?.({
              step:stepIndex+1,pass,pair:a.id+'/'+b.id,
              fallback:manifold===null,pointCount:manifold?.length??0,
              impulseOnB:[...db],deltaAV:[...da],deltaBV:[...db]
            });
          }
`+end);
    return {contents:s,loader:'ts'};
   });
  }}]});
 if(hooked!==1)throw Error('WORLD_HOOK_COUNT:'+hooked);
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
