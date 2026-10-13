/** Test-only instrumented original World at the pre-contact energy boundary.
 * The tracked packages/barocss-physics code and public API remain unchanged.
 */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temporary=await mkdtemp(join(tmpdir(),'physics1572-energy-phases-'));
let hooks=0;
try{
 const outfile=join(temporary,'energy-phases.mjs');
 await build({
  entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/total-energy-phase-ledger.ts')],
  outfile,bundle:true,platform:'node',format:'esm',target:'node22',
  plugins:[{name:'p1572-free-contact-phase',setup(api){
   api.onLoad({filter:/world\.ts$/},async args=>{
    hooks++;
    const original=await readFile(args.path,'utf8');
    const anchor='      const nextPersistentPoints = new Map<string, PointImpulse>();';
    if(original.split(anchor).length!==2)throw Error('PHASE_ENERGY_SOURCE_MISMATCH');
    const lines=[
      '      (globalThis as {__physics1572FreeEnergyProbe?:(event:unknown)=>void}).__physics1572FreeEnergyProbe?.({',
      '        step:stepIndex+1,',
      "        bodies:next.filter(body=>body.id==='b0'||body.id==='b1'||body.id==='b2')",
      '          .map(body=>({id:body.id,positionM:[...body.positionM],',
      '            velocityMps:[...body.velocityMps],angularVelocityRadps:[...body.angularVelocityRadps]}))',
      '      });'
    ];
    return {contents:original.replace(anchor,anchor+'\n'+lines.join('\n')),loader:'ts'};
   });
  }}]
 });
 if(hooks!==1)throw Error('PHASE_ENERGY_EXPECTED_SINGLE_WORLD_HOOK:'+hooks);
 await import(pathToFileURL(outfile).href);
}finally{await rm(temporary,{recursive:true,force:true});}
