/** Exact-guarded, test-only World and manifold source hooks. */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-sat-sep-'));let worlds=0,manifolds=0;
function once(s,needle,replacement){if(s.split(needle).length!==2)throw Error('SAT_SEP_SOURCE_CHANGED:'+needle);return s.replace(needle,replacement);}
try{
 const outfile=join(temp,'audit.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/sat-separation-witness.ts')],
 outfile,bundle:true,platform:'node',format:'esm',target:'node22',
 plugins:[{name:'p1572-sat-separation',setup(api){
 api.onLoad({filter:/world\.ts$/},async args=>{
  worlds++;let s=await readFile(args.path,'utf8');
  const needle='          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;';
  s=once(s,needle,`
          (globalThis as {__p1572SepContext?:unknown}).__p1572SepContext=
            a.id==='b0'&&b.id==='b1'?{step:stepIndex+1,pass,penetrationM:hit.penetration,normal:[...hit.normal]}:undefined;
`+needle);
  return {contents:s,loader:'ts'};
 });
 api.onLoad({filter:/contact-manifold\.ts$/},async args=>{
  manifolds++;let s=await readFile(args.path,'utf8');
  const filter='  }).filter((point) => point.separation <= 1e-6);';
  s=once(s,filter,`  });
  const __p1572Ctx=(globalThis as {__p1572SepContext?:{
    step:number,pass:number,penetrationM:number,normal:number[]}}).__p1572SepContext;
  const __p1572Selected=__p1572Ctx?__p1572Ctx:null;
  const __p1572Accepted=__p1572Selected?candidates.filter(point=>point.separation<=1e-6):null;
  if(__p1572Selected){
    const separations=candidates.map(point=>point.separation);
    (globalThis as {__p1572SepProbe?:(e:unknown)=>void}).__p1572SepProbe?.({
      ...__p1572Selected,candidateCount:candidates.length,acceptedCount:__p1572Accepted!.length,
      minSeparationM:separations.length?Math.min(...separations):null,
      maxSeparationM:separations.length?Math.max(...separations):null
    });
  }
  const __p1572Filtered=candidates.filter(point=>point.separation<=1e-6);
  const __p1572Final=__p1572Filtered;
`);
  // Retain the original downstream reference to candidates using a scoped
  // re-binding: the original declaration is changed to 'let', and assignment
  // supplies exactly the original filtered candidates before further logic.
  s=once(s,'  const candidates = polygon.map((point) => {','  let candidates = polygon.map((point) => {');
  s=once(s,'  const __p1572Final=__p1572Filtered;','  const __p1572Final=__p1572Filtered;\n  candidates=__p1572Final;');
  return {contents:s,loader:'ts'};
 });
 }}]});
 if(worlds!==1||manifolds!==1)throw Error('SAT_SEP_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
