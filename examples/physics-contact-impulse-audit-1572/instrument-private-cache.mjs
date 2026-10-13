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
          source=patchUnique(source,
            '          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;',
            "          if (pass === 0 && a.id === 'b0' && b.id === 'b1') "+
             observer+"({kind:'manifold',step:stepIndex+1,pass,pointCount:manifold?.length??0,fallback:manifold===null});");
          source=patchUnique(source,
            '                const prior = persistentPoints.get(pointKey);',
            "                if (a.id === 'b0' && b.id === 'b1') "+
              observer+"({kind:'new-point',step:stepIndex+1,pass,pointId:point.id,reused:prior!==undefined,priorNormalNs:prior?.normalNs??0,priorTangentMagnitudeNs:prior?Math.hypot(...prior.tangentNs):0});");
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
