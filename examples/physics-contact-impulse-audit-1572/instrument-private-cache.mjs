/**
 * #1572 only: compile a TEMPORARY instrumented Physics World graph, leaving
 * tracked packages/barocss-physics files and the public API unchanged.
 * Run from repository root: node examples/physics-contact-impulse-audit-1572/instrument-private-cache.mjs
 */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

function patchUnique(text, needle, injection) {
  const first=text.indexOf(needle);
  if(first<0||text.indexOf(needle,first+needle.length)!==-1)
    throw Error('CACHE_INSTRUMENT_SOURCE_MISMATCH: '+needle);
  return text.slice(0,first+needle.length)+'\n'+injection+text.slice(first+needle.length);
}
const observer="(globalThis as {__physics1572Probe?: (event: unknown)=>void}).__physics1572Probe?.";
let hooked=0;
const temporary=await mkdtemp(join(tmpdir(),'physics1572-cache-'));
try{
  const output=join(temporary,'instrumented.mjs');
  await build({
    entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/private-cache-entry.ts')],
    outfile:output,bundle:true,platform:'node',format:'esm',target:'node22',
    plugins:[{name:'private-physics-1572-only',setup(api){
      api.onLoad({filter:/world\.ts$/},
        async args=>{
          hooked++;
          let source=await readFile(args.path,'utf8');
          const functionMarker='function publicState(';
          if(source.split(functionMarker).length!==2)throw Error('PHASE_SOURCE_MISMATCH_FUNCTION');
          source=source.replace(functionMarker,`
function __physics1572Slip(a:Body,b:Body,p:Vec3,n:Vec3):number{
  const armA:[number,number,number]=[p[0]-a.positionM[0],p[1]-a.positionM[1],p[2]-a.positionM[2]];
  const armB:[number,number,number]=[p[0]-b.positionM[0],p[1]-b.positionM[1],p[2]-b.positionM[2]];
  const cross=(w:Vec3,r:Vec3):Vec3=>[
    w[1]*r[2]-w[2]*r[1],w[2]*r[0]-w[0]*r[2],w[0]*r[1]-w[1]*r[0]];
  const va=cross(a.angularVelocityRadps,armA),vb=cross(b.angularVelocityRadps,armB);
  const rel:Vec3=[0,1,2].map(i=>(b.velocityMps[i]+vb[i])-(a.velocityMps[i]+va[i])) as Vec3;
  const vn=rel[0]*n[0]+rel[1]*n[1]+rel[2]*n[2];
  return Math.hypot(rel[0]-vn*n[0],rel[1]-vn*n[1],rel[2]-vn*n[2]);
}
`+functionMarker);

          source=patchUnique(source,
            '          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;',
            "          if (pass === 0 && a.id === 'b0' && b.id === 'b1') "+
             observer+"({kind:'manifold',step:stepIndex+1,pass,pointCount:manifold?.length??0,fallback:manifold===null});");
          source=patchUnique(source,
            '                const prior = persistentPoints.get(pointKey);',
            "                if (a.id === 'b0' && b.id === 'b1') "+
              observer+"({kind:'new-point',step:stepIndex+1,pass,pointId:point.id,reused:prior!==undefined,priorNormalNs:prior?.normalNs??0,priorTangentMagnitudeNs:prior?Math.hypot(...prior.tangentNs):0});");
          const beforeWarm='                if (prior) warmStartPoint(a, b, point.pointM, hit.normal, impulse);';
          if(source.split(beforeWarm).length!==2)throw Error('PHASE_WARM_SOURCE_MISMATCH');
          source=source.replace(beforeWarm,`
                const __auditPoint=pass===0&&a.id==='b0'&&b.id==='b1';
                const __auditBefore=__auditPoint?__physics1572Slip(a,b,point.pointM,hit.normal):0;
`+beforeWarm+`
                if(__auditPoint) `+observer+`({kind:'phase',phase:'warm',step:stepIndex+1,pointId:point.id,
                  reused:prior!==undefined,beforeSlipMps:__auditBefore,
                  afterSlipMps:__physics1572Slip(a,b,point.pointM,hit.normal),
                  normalNs:impulse.normalNs,tangentNs:Math.hypot(...impulse.tangentNs)});
`);
          const solveMarker='                solvePersistentPoint(a, b, point.pointM, hit.normal, impulse);';
          if(source.split(solveMarker).length!==2)throw Error('PHASE_SOLVE_SOURCE_MISMATCH');
          source=source.replace(solveMarker,`
                if(pass===0&&(iteration===0||iteration===7)&&a.id==='b0'&&b.id==='b1'){
                  const __before=__physics1572Slip(a,b,point.pointM,hit.normal);
`+solveMarker+`
                  `+observer+`({kind:'phase',phase:iteration===0?'solve0':'solve7',
                    step:stepIndex+1,pointId:point.id,beforeSlipMps:__before,
                    afterSlipMps:__physics1572Slip(a,b,point.pointM,hit.normal),
                    normalNs:impulse.normalNs,tangentNs:Math.hypot(...impulse.tangentNs)});
                }else{
`+solveMarker+`
                }
`);
          source=patchUnique(source,
            '      persistentPoints = nextPersistentPoints;',
            "      "+observer+"({kind:'commit',step:stepIndex+1,cachedPoints:[...nextPersistentPoints.keys()].filter(k=>k.startsWith('b0\\u0000b1\\u0000')).length});");
          return {contents:source,loader:'ts'};
        });
    }}]
  });
  if(hooked!==1)throw Error('CACHE_INSTRUMENT_WORLD_COUNT: expected 1 got '+hooked);
  await import(pathToFileURL(output).href);
}finally{await rm(temporary,{recursive:true,force:true});}
