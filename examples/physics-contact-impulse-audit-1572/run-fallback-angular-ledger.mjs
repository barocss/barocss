/** Bounded test-only World probe: snapshot pair angular/linear velocities before
 * and after the actual contact-processing block, including fallback paths.
 */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-angular-'));let hooks=0;
function once(source,needle,replacement){
 if(source.split(needle).length!==2)throw Error('P1572_ANGULAR_SOURCE_MISMATCH');
 return source.replace(needle,replacement);
}
try{
 const outfile=join(temp,'angular.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/fallback-angular-ledger.ts')],
 outfile,bundle:true,platform:'node',format:'esm',target:'node22',
 plugins:[{name:'p1572-angular',setup(api){
 api.onLoad({filter:/world\.ts$/},async args=>{
  hooks++;let s=await readFile(args.path,'utf8');
  const before='          const hit = detect(a, b);';
  s=once(s,before,before+`
          const __p1572Watch=[1,600,1200].includes(stepIndex+1)
            && ((a.id==='b0'&&b.id==='b1')||(a.id==='b1'&&b.id==='b2'));
          const __p1572Before=__p1572Watch?{
            beforeA:[...a.angularVelocityRadps],beforeB:[...b.angularVelocityRadps],
            beforeAV:[...a.velocityMps],beforeBV:[...b.velocityMps]}:null;
`);
  const after='          if (bounds) {\n            bounds[aIndex] = bodyBounds(a);';
  s=once(s,after,`
          if(__p1572Before){
            (globalThis as {__p1572AngularProbe?:(e:unknown)=>void}).__p1572AngularProbe?.({
              step:stepIndex+1,pass,pair:a.id+'/'+b.id,
              fallback:manifold===null,pointCount:manifold?.length??0,
              normal:[...hit.normal],pointM:[...hit.pointM],
              ...__p1572Before,
              afterA:[...a.angularVelocityRadps],afterB:[...b.angularVelocityRadps],
              afterAV:[...a.velocityMps],afterBV:[...b.velocityMps]
            });
          }
`+after);
  return {contents:s,loader:'ts'};
 });
 }}]});
 if(hooks!==1)throw Error('P1572_ANGULAR_HOOK_COUNT:'+hooks);
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
