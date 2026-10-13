import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-face-choice-'));let wh=0,mh=0;
function once(s,n,r){if(s.split(n).length!==2)throw Error('FACE_CHOICE_SOURCE_DRIFT:'+n);return s.replace(n,r)}
try{
 const outfile=join(temp,'run.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/face-choice-audit.ts')],outfile,bundle:true,platform:'node',format:'esm',target:'node22',
 plugins:[{name:'face-choice',setup(api){
 api.onLoad({filter:/world\.ts$/},async args=>{wh++;let s=await readFile(args.path,'utf8');const n='          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;';
 s=once(s,n,`
          (globalThis as {__p1572FaceContext?:unknown}).__p1572FaceContext=
            a.id==='b0'&&b.id==='b1'?{step:stepIndex+1,pass}:undefined;
`+n);return {contents:s,loader:'ts'};});
 api.onLoad({filter:/contact-manifold\.ts$/},async args=>{mh++;let s=await readFile(args.path,'utf8');
 const n='  if (!candidates.length) return null;';
 s=once(s,n,`
  const __ctx=(globalThis as {__p1572FaceContext?:{step:number,pass:number}}).__p1572FaceContext;
  if(__ctx){
    (globalThis as {__p1572FaceProbe?:(e:unknown)=>void}).__p1572FaceProbe?.({
      ...__ctx,referenceBody:reference.body.id,referenceAxis:reference.axis,referenceSide:reference.side,
      incidentBody:incident.body.id,incidentAxis:incident.axis,incidentSide:incident.side,
      normalAlignment:Math.abs(dot(reference.axes[reference.axis],normal)),
      incidentAlignment:dot(incidentAxes[incident.axis],normal),acceptedCount:candidates.length
    });
  }
`+n);return {contents:s,loader:'ts'};});
 }}]});
 if(wh!==1||mh!==1)throw Error('FACE_CHOICE_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
