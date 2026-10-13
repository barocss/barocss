import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const tmp=await mkdtemp(join(tmpdir(),'p1572-redetect-'));let hooks=0;
function once(s,n,r){if(s.split(n).length!==2)throw Error('REDETECT_SOURCE_CHANGED');return s.replace(n,r);}
try{
 const outfile=join(tmp,'run.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/post-correction-redetect.ts')],outfile,bundle:true,platform:'node',format:'esm',target:'node22',
 plugins:[{name:'read-only-post-correction-detection',setup(api){
 api.onLoad({filter:/world\.ts$/},async args=>{
  hooks++;let s=await readFile(args.path,'utf8');
  const marker='          if (bounds) {\n            bounds[aIndex] = bodyBounds(a);';
  s=once(s,marker,`
          if(a.id==='b0'&&b.id==='b1'&&[1,600,1200].includes(stepIndex+1)){
            const __afterHit=detect(a,b);
            const __afterManifold=__afterHit&&usePersistentBox?boxFaceManifold(a,b,__afterHit):null;
            (globalThis as {__p1572Redetect?:(e:unknown)=>void}).__p1572Redetect?.({
              step:stepIndex+1,pass,beforePenetrationM:hit.penetration,
              afterPenetrationM:__afterHit?.penetration??null,
              beforePoints:manifold?.length??0,afterPoints:__afterHit?(__afterManifold?.length??0):null,
              beforeNormal:[...hit.normal],afterNormal:__afterHit?[...__afterHit.normal]:null
            });
          }
`+marker);
  return {contents:s,loader:'ts'};
 });
 }}]});
 if(hooks!==1)throw Error('REDETECT_WORLD_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(tmp,{recursive:true,force:true});}
