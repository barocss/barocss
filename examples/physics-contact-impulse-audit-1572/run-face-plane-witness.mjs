/** #1572 exact source-guarded temporary World/manifold probe. */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-plane-'));let worlds=0,manifolds=0;
function once(s,needle,replacement){if(s.split(needle).length!==2)throw Error('PLANE_SOURCE_CHANGED:'+needle);return s.replace(needle,replacement);}
try{
 const outfile=join(temp,'run.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/face-plane-witness.ts')],
  outfile,bundle:true,platform:'node',format:'esm',target:'node22',
  plugins:[{name:'p1572-face-plane',setup(api){
   api.onLoad({filter:/world\.ts$/},async args=>{
    worlds++;let s=await readFile(args.path,'utf8');
    const marker='          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;';
    s=once(s,marker,`
          (globalThis as {__p1572PlaneCtx?:unknown}).__p1572PlaneCtx=
           a.id==='b0'&&b.id==='b1'?{step:stepIndex+1,pass,
             penetrationM:hit.penetration,normal:[...hit.normal]}:undefined;
`+marker);
    return {contents:s,loader:'ts'};
   });
   api.onLoad({filter:/contact-manifold\.ts$/},async args=>{
    manifolds++;let s=await readFile(args.path,'utf8');
    const filter='  }).filter((point) => point.separation <= 1e-6);';
    s=once(s,filter,`  });
  const __ctx=(globalThis as {__p1572PlaneCtx?:{step:number,pass:number,penetrationM:number,normal:Vec3}}).__p1572PlaneCtx;
  if(__ctx){
    (globalThis as {__p1572PlaneProbe?:(e:unknown)=>void}).__p1572PlaneProbe?.({
     ...__ctx,faceCenter:[...centre],faceNormal:[...normal],
     candidatePoints:polygon.map(p=>[...p]),
     sourceSeparations:candidates.map(p=>p.separation),
     accepted:candidates.filter(p=>p.separation<=1e-6).length
    });
  }
  candidates=candidates.filter(point=>point.separation<=1e-6);
`);
    s=once(s,'  const candidates = polygon.map((point) => {','  let candidates = polygon.map((point) => {');
    return {contents:s,loader:'ts'};
   });
  }}]});
 if(worlds!==1||manifolds!==1)throw Error('PLANE_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
