/** Test-only source probe: classify Manifold null causes, no production writes. */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-face-cause-'));let hooks=0;
try{
 const outfile=join(temp,'audit.mjs');
 await build({
  entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/manifold-fallback-cause.ts')],
  outfile,bundle:true,platform:'node',format:'esm',target:'node22',
  plugins:[{name:'p1572-face-alignment',setup(api){
   api.onLoad({filter:/world\.ts$/},async args=>{
    hooks++;let source=await readFile(args.path,'utf8');
    const before='function publicState(';
    if(source.split(before).length!==2)throw Error('P1572_FACE_FUNCTION_MARKER_CHANGED');
    source=source.replace(before,`
function __p1572FaceAlignment(q:[number,number,number,number],n:Vec3):number{
 const [x,y,z,w]=q;
 const axes:Vec3=[
  [1-2*(y*y+z*z),2*(x*y+w*z),2*(x*z-w*y)],
  [2*(x*y-w*z),1-2*(x*x+z*z),2*(y*z+w*x)],
  [2*(x*z+w*y),2*(y*z-w*x),1-2*(x*x+y*y)]];
 return Math.max(...axes.map(axis=>Math.abs(axis[0]*n[0]+axis[1]*n[1]+axis[2]*n[2])));
}
`+before);
    const anchor='          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;';
    if(source.split(anchor).length!==2)throw Error('P1572_FACE_ANCHOR_CHANGED');
    source=source.replace(anchor,anchor+`
          if(a.id==='b0'&&b.id==='b1'){
            (globalThis as {__p1572FaceCauseProbe?:(e:unknown)=>void}).__p1572FaceCauseProbe?.({
              step:stepIndex+1,pass,pair:a.id+'/'+b.id,
              maxAlignmentA:__p1572FaceAlignment(a.orientation,hit.normal),
              maxAlignmentB:__p1572FaceAlignment(b.orientation,hit.normal),
              hasManifold:manifold!==null,manifoldCount:manifold?.length??0,
              normal:[...hit.normal]
            });
          }
`);
    return {contents:source,loader:'ts'};
   });
  }}]
 });
 if(hooks!==1)throw Error('P1572_WORLD_SOURCE_NOT_HOOKED');
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
