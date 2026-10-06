import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel,buildParametricFace,buildRectangleAdjacency,validateRectangleAdjacency,validateFaceBundle,exportIGES } from '../../packages/barocss-cad/dist/index.js';

const [leftPath,leftId,rightPath,rightId,localIdsPath,globalIdsPath,outputPath]=process.argv.slice(2);
if(![leftPath,leftId,rightPath,rightId,localIdsPath,globalIdsPath,outputPath].every(Boolean)) throw new Error('Usage: node adjacency-demo.mjs left.css leftSurfaceId right.css rightSurfaceId local-ids.json global-ids.json output-directory');
const localIds=JSON.parse(readFileSync(resolve(localIdsPath),'utf8')),globalIds=JSON.parse(readFileSync(resolve(globalIdsPath),'utf8'));
const sources=[leftPath,rightPath].map(p=>readFileSync(resolve(p),'utf8')),compiled=sources.map(source=>compileCadModel(source,{sourceVersion:0})),surfaceIds=[leftId,rightId];if(compiled.some(result=>!result.ok))throw new Error(JSON.stringify(compiled.flatMap(result=>result.diagnostics)));const models=compiled.map(result=>result.model);
const bundles=models.map((model,i)=>buildParametricFace(model.objects.find(o=>o.id===surfaceIds[i]),localIds));
const descriptor=buildRectangleAdjacency(...bundles,globalIds),validation=validateRectangleAdjacency(descriptor),output=resolve(outputPath),json=v=>JSON.stringify(v,null,2)+'\n';mkdirSync(output,{recursive:true});
writeFileSync(resolve(output,'adjacency.json'),json(descriptor));writeFileSync(resolve(output,'validation.json'),json(validation));
descriptor.faces.forEach((face,i)=>{
  const name=i===0?'left':'right',exported=exportIGES(face.bundle.geometry,face.bundle.geometry.objects.map(o=>o.id));
  for(const [suffix,bytes]of Object.entries({'css':sources[i],'source-model.json':json(models[i]),'bundle.json':json(face.bundle),'local-validation.json':json(validateFaceBundle(face.bundle)),'iges':exported.iges,'export-report.json':json(exported.report)}))writeFileSync(resolve(output,name+'.'+suffix),bytes);
});
console.log(json({output,...validation,interchange:'Two separate geometry files; no serialized shared IsSame topology'}));
