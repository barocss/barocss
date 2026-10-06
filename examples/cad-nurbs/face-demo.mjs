import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel, buildParametricFace, validateFaceBundle, exportIGES } from '../../packages/barocss-cad/dist/index.js';

const [sourcePath,surfaceId,idsPath,outputPath,sourceVersion]=process.argv.slice(2);
if(!sourcePath||!surfaceId||!idsPath||!outputPath||!['0','1'].includes(sourceVersion)) throw new Error('Usage: node face-demo.mjs source.css surfaceId ids.json output-directory source-version(0|1)');
const source=readFileSync(resolve(sourcePath),'utf8'),ids=JSON.parse(readFileSync(resolve(idsPath),'utf8'));
const compiled=compileCadModel(source,{sourceVersion:Number(sourceVersion)});if(!compiled.ok)throw new Error(JSON.stringify(compiled.diagnostics));const model=compiled.model;
const surface=model.objects.find(o=>o.id===surfaceId),bundle=buildParametricFace(surface,ids),validation=validateFaceBundle(bundle);
const exported=exportIGES(bundle.geometry,bundle.geometry.objects.map(o=>o.id));
const output=resolve(outputPath);mkdirSync(output,{recursive:true});const json=value=>JSON.stringify(value,null,2)+'\n';
for(const [name,bytes]of Object.entries({'source.css':source,'native-source.json':json(model),'features.json':json(compiled?.constructions??[]),'ids.json':json(ids),'bundle.json':json(bundle),'validation.json':json(validation),'geometry.iges':exported.iges,'export-report.json':json(exported.report)}))writeFileSync(resolve(output,name),bytes);
console.log(json({output,...validation,interchange:'IGES stores native geometry; the separate incidence graph is retained in bundle.json'}));
