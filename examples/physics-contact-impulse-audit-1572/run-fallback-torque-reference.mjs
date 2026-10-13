/** Exact-guarded, temporary World patch for fallback single-point solve. */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-fallback-torque-'));
let hooked=0;
try{
 const outfile=join(temp,'audit.mjs');
 await build({
  entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/fallback-torque-reference.ts')],
  outfile,bundle:true,format:'esm',platform:'node',target:'node22',
  plugins:[{name:'p1572-fallback-torque',setup(api){
   api.onLoad({filter:/world\.ts$/},async args=>{
    hooked++;let source=await readFile(args.path,'utf8');
    const marker='            const resolved = solve(a, b, hit);';
    if(source.split(marker).length!==2)throw Error('P1572_FALLBACK_SOURCE_CHANGED');
    const instrument=`
            const __selected=stepIndex+1===600&&a.id==='b0'&&b.id==='b1';
            const __copy=(v:Body)=>({
              pos:[...v.positionM],v:[...v.velocityMps],w:[...v.angularVelocityRadps],
              q:[...v.orientation],invMass:v.inverseMass,invInertia:[...v.inverseInertiaLocal]
            });
            const __beforeA=__selected?__copy(a):null;
            const __beforeB=__selected?__copy(b):null;
`+marker+`
            if(__selected){
              (globalThis as {__p1572FallbackTorqueProbe?:(event:unknown)=>void}).__p1572FallbackTorqueProbe?.({
                step:stepIndex+1,pair:a.id+'/'+b.id,point:[...hit.pointM],
                normal:[...hit.normal],impulseNormal:resolved.normalImpulseNs,
                impulseTangent:[...resolved.tangentImpulseNs],
                beforeA:__beforeA,beforeB:__beforeB,afterA:__copy(a),afterB:__copy(b)
              });
            }
`;
    source=source.replace(marker,instrument);
    return {contents:source,loader:'ts'};
   });
  }}]
 });
 if(hooked!==1)throw Error('P1572_FALLBACK_HOOK_COUNT');
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
