import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-energy-'));let hooks=0;
function replaceOnce(source,needle,withText){if(source.split(needle).length!==2)throw Error('ENERGY_SOURCE_MISMATCH:'+needle);return source.replace(needle,withText);}
try{
 const outfile=join(temp,'energy.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/contact-energy-ledger.ts')],outfile,bundle:true,platform:'node',format:'esm',target:'node22',plugins:[{name:'test-only-energy',setup(api){
  api.onLoad({filter:/world\.ts$/},async args=>{
   hooks++;let source=await readFile(args.path,'utf8');
   source=replaceOnce(source,'function publicState(',`
function __energy1572Body(body:Body){
 return {vel:[...body.velocityMps],omega:[...body.angularVelocityRadps],orientation:[...body.orientation],
  inverseMass:body.inverseMass,inverseInertiaLocal:[...body.inverseInertiaLocal]};
}
`+'function publicState(');
   const warm='                if (prior) warmStartPoint(a, b, point.pointM, hit.normal, impulse);';
   source=replaceOnce(source,warm,`
                if(prior){
                  const __observe=((a.id==='b0'&&b.id==='b1')||(a.id==='b1'&&b.id==='b2'))&&(stepIndex+1===1||(stepIndex+1)%120===0||((stepIndex+1)>=680&&(stepIndex+1)<=720));
                  const __before=__observe?[__energy1572Body(a),__energy1572Body(b)]:null;
                  warmStartPoint(a,b,point.pointM,hit.normal,impulse);
                  if(__before)(globalThis as {__physics1572EnergyProbe?:(event:unknown)=>void}).__physics1572EnergyProbe?.({
                    kind:'warm',step:stepIndex+1,pass,iteration:null,pair:a.id+'/'+b.id,
                    aBefore:__before[0],bBefore:__before[1],aAfter:__energy1572Body(a),bAfter:__energy1572Body(b)});
                }
`);
   const solve='                solvePersistentPoint(a, b, point.pointM, hit.normal, impulse);';
   source=replaceOnce(source,solve,`
                const __observe=((a.id==='b0'&&b.id==='b1')||(a.id==='b1'&&b.id==='b2'))&&(stepIndex+1===1||(stepIndex+1)%120===0||((stepIndex+1)>=680&&(stepIndex+1)<=720));
                const __before=__observe?[__energy1572Body(a),__energy1572Body(b)]:null;
`+solve+`
                if(__before)(globalThis as {__physics1572EnergyProbe?:(event:unknown)=>void}).__physics1572EnergyProbe?.({
                  kind:'solve',step:stepIndex+1,pass,iteration,pair:a.id+'/'+b.id,
                  aBefore:__before[0],bBefore:__before[1],aAfter:__energy1572Body(a),bAfter:__energy1572Body(b)});
`);
   return {contents:source,loader:'ts'};
  });
 }}]});
 if(hooks!==1)throw Error('ENERGY_WORLD_HOOK_COUNT:'+hooks);
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
