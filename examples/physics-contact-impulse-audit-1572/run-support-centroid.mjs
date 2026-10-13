import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'p1572-centroid-'));let hooks=0;
try{
 const outfile=join(temp,'centroid.mjs');
 await build({entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/support-centroid.ts')],
 outfile,bundle:true,platform:'node',format:'esm',target:'node22',
 plugins:[{name:'p1572-centroid',setup(api){
 api.onLoad({filter:/world\.ts$/},async args=>{
  hooks++;let s=await readFile(args.path,'utf8');
  const needle='          if (bounds) {\n            bounds[aIndex] = bodyBounds(a);';
  if(s.split(needle).length!==2)throw Error('CENTROID_SOURCE_MISMATCH');
  s=s.replace(needle,`
          if(pass===7 && [1,600,1200].includes(stepIndex+1)
             && ((a.id==='b0'&&b.id==='b1')||(a.id==='b1'&&b.id==='b2'))){
            const observed=manifold?.map(point=>{
              const impulse=nextPersistentPoints.get(`\${key}\\u0000\${point.id}`);
              return {pointM:[...point.pointM],normalNs:impulse?.normalNs??0,
                tangentNs:[...(impulse?.tangentNs??[0,0,0])]};
            })??[];
            (globalThis as {__physics1572CentroidProbe?:(event:unknown)=>void}).__physics1572CentroidProbe?.({
              step:stepIndex+1,pass,pair:a.id+'/'+b.id,normal:[...hit.normal],
              points:observed,fallback:manifold===null
            });
          }
`+needle);
  return {contents:s,loader:'ts'};
 });
 }}]});
 if(hooks!==1)throw Error('CENTROID_HOOK_COUNT:'+hooks);
 await import(pathToFileURL(outfile).href);
}finally{await rm(temp,{recursive:true,force:true});}
