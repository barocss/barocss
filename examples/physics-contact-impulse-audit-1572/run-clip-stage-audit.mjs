/** Exact guarded temporary transformations in real World + manifold source. */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-clip-stage-'));
let worldHooks=0,manifoldHooks=0;
function unique(s,needle,replacement){
 if(s.split(needle).length!==2)throw Error('P1572_CLIP_SOURCE_CHANGED: '+needle);
 return s.replace(needle,replacement);
}
try{
 const outfile=join(temp,'run.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/clip-stage-audit.ts')],
  outfile,bundle:true,platform:'node',format:'esm',target:'node22',
  plugins:[{name:'p1572-clip-stages',setup(api){
   api.onLoad({filter:/world\.ts$/},async args=>{
    worldHooks++;let s=await readFile(args.path,'utf8');
    const needle='          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;';
    s=unique(s,needle,`
          (globalThis as {__p1572ClipContext?:unknown}).__p1572ClipContext=
            a.id==='b0'&&b.id==='b1'?{step:stepIndex+1,pass,pair:'b0/b1'}:undefined;
`+needle);
    return {contents:s,loader:'ts'};
   });
   api.onLoad({filter:/contact-manifold\.ts$/},async args=>{
    manifoldHooks++;let s=await readFile(args.path,'utf8');
    const setup='  let polygon = faceVertices(incident);';
    s=unique(s,setup,setup+`
  let __p1572Stage=0;
  const __p1572Ctx=(globalThis as {__p1572ClipContext?:{step:number,pass:number,pair:string}}).__p1572ClipContext;
  const __p1572Emit=(stage:'clip'|'separation',stageIndex:number,before:number,after:number)=>{
    if(!__p1572Ctx)return;
    (globalThis as {__p1572ClipProbe?:(e:unknown)=>void}).__p1572ClipProbe?.({
      ...__p1572Ctx,stage,stageIndex,before,after,rejected:before-after});
  };
`);
    const first='    polygon = clip(polygon, centre, reference.axes[axis], reference.extents[axis]);';
    s=unique(s,first,`
    const __p1572Before0=polygon.length;
`+first+`
    __p1572Emit('clip',__p1572Stage++,__p1572Before0,polygon.length);
`);
    const second='    polygon = clip(polygon, centre, scale(reference.axes[axis], -1), reference.extents[axis]);';
    s=unique(s,second,`
    const __p1572Before1=polygon.length;
`+second+`
    __p1572Emit('clip',__p1572Stage++,__p1572Before1,polygon.length);
`);
    const filter='  }).filter((point) => point.separation <= 1e-6);';
    s=unique(s,filter,filter+`
  __p1572Emit('separation',4,polygon.length,candidates.length);
`);
    return {contents:s,loader:'ts'};
   });
  }}]});
 if(worldHooks!==1||manifoldHooks!==1)throw Error('P1572_CLIP_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
