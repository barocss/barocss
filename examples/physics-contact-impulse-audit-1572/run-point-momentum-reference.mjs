/** #1572 temporary-only source observer for matched point impulse applications.
 * Production Physics files stay unchanged. Every patch is exact-match guarded.
 */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

function replaceOnce(text,needle,replacement){
 if(text.split(needle).length!==2)throw Error('P1572_IMPULSE_SOURCE_MISMATCH:'+needle);
 return text.replace(needle,replacement);
}
const temporary=await mkdtemp(join(tmpdir(),'physics1572-impulse-'));
let actualWorldHooks=0;
try{
 const outfile=join(temporary,'checked.mjs');
 await build({
  entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/point-momentum-reference.ts')],
  outfile,bundle:true,format:'esm',platform:'node',target:'node22',
  plugins:[{name:'p1572-independent-point-impulse',setup(api){
   api.onLoad({filter:/world\.ts$/},async args=>{
    actualWorldHooks++;
    let source=await readFile(args.path,'utf8');
    source=replaceOnce(source,'function publicState(',`
function __p1572Capture(a:Body,b:Body,impulse:PointImpulse){
 const body=(value:Body)=>({
  pos:[...value.positionM],vel:[...value.velocityMps],
  omega:[...value.angularVelocityRadps],orientation:[...value.orientation],
  inverseMass:value.inverseMass,inverseInertiaLocal:[...value.inverseInertiaLocal]
 });
 return {a:body(a),b:body(b),normalNs:impulse.normalNs,tangentNs:[...impulse.tangentNs]};
}
function __p1572Select(step:number,a:Body,b:Body){
 return (step===1||step===600||step===1200)
   && ((a.id==='b0'&&b.id==='b1')||(a.id==='b1'&&b.id==='b2'));
}
`+'function publicState(');
    const warm='                if (prior) warmStartPoint(a, b, point.pointM, hit.normal, impulse);';
    source=replaceOnce(source,warm,`
                if(prior){
                  const __observe=__p1572Select(stepIndex+1,a,b);
                  const __before=__observe?__p1572Capture(a,b,impulse):null;
                  warmStartPoint(a,b,point.pointM,hit.normal,impulse);
                  if(__before){
                    (globalThis as {__physics1572ImpulseProbe?:(event:unknown)=>void}).__physics1572ImpulseProbe?.({
                      mode:'warm',step:stepIndex+1,pass,iteration:null,
                      pair:a.id+'/'+b.id,pointM:[...point.pointM],normal:[...hit.normal],
                      before:__before,after:__p1572Capture(a,b,impulse)
                    });
                  }
                }
`);
    const solve='                solvePersistentPoint(a, b, point.pointM, hit.normal, impulse);';
    source=replaceOnce(source,solve,`
                const __observe=__p1572Select(stepIndex+1,a,b);
                const __before=__observe?__p1572Capture(a,b,impulse):null;
`+solve+`
                if(__before){
                  (globalThis as {__physics1572ImpulseProbe?:(event:unknown)=>void}).__physics1572ImpulseProbe?.({
                    mode:'solve',step:stepIndex+1,pass,iteration,
                    pair:a.id+'/'+b.id,pointM:[...point.pointM],normal:[...hit.normal],
                    before:__before,after:__p1572Capture(a,b,impulse)
                  });
                }
`);
    return {contents:source,loader:'ts'};
   });
  }}]
 });
 if(actualWorldHooks!==1)throw Error('P1572_IMPULSE_WORLD_HOOK_COUNT:'+actualWorldHooks);
 await import(pathToFileURL(outfile).href);
}finally{
 await rm(temporary,{recursive:true,force:true});
}
