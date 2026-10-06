import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel, surfaceDomain, extractSurfaceBoundary, exportIGES } from '../../packages/barocss-cad/dist/index.js';

const [sourcePath,surfaceId,outputPath,sourceVersion] = process.argv.slice(2);
if(!sourcePath||!surfaceId||!outputPath||!['0','1'].includes(sourceVersion)) throw new Error('Usage: node boundary-demo.mjs source.css surfaceId output-directory source-version(0|1)');
const source=readFileSync(resolve(sourcePath),'utf8');
const compiled=compileCadModel(source,{sourceVersion:Number(sourceVersion)});if(!compiled.ok)throw new Error(JSON.stringify(compiled.diagnostics));const model=compiled.model;
const surface=model.objects.find(o=>o.id===surfaceId);
const domain=surfaceDomain(surface),mapping=[];
const curves=['v-min','u-max','v-max','u-min'].map(boundary=> {
  const curveId=surfaceId+'_'+boundary.replace('-','_');
  const curve=extractSurfaceBoundary(surface,{boundary,id:curveId});
  mapping.push({surfaceId,boundary,curveId,parameterDirection:boundary==='v-max'||boundary==='u-min'?'decreasing':'increasing',originalDomain:boundary.startsWith('v-')?domain.u:domain.v});
  return curve;
});
const boundaryModel={name:'surface_boundaries',version:0,lengthUnit:'mm',objects:curves};
const exported=exportIGES(boundaryModel,mapping.map(m=>m.curveId));
const output=resolve(outputPath);mkdirSync(output,{recursive:true});const json=value=>JSON.stringify(value,null,2)+'\n';
for(const [name,bytes] of Object.entries({'source.css':source,'native.json':json(model),'features.json':json(compiled?.constructions??[]),'boundaries.json':json(boundaryModel),'mapping.json':json(mapping),'boundaries.iges':exported.iges,'export-report.json':json(exported.report)})) writeFileSync(resolve(output,name),bytes);
console.log(output);
