import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseModel,buildParametricFace,buildAxisBoxShell,validateAxisBoxShell,validateAxisBoxSolid,validateFaceBundle,exportIGES } from '../../packages/barocss-cad/dist/index.js';

const [sourcePath,inputPath,outputPath]=process.argv.slice(2);
if(!sourcePath||!inputPath||!outputPath)throw new Error('Usage: node box-solid-demo.mjs six-surfaces.css input.json output-directory');
const source=readFileSync(resolve(sourcePath),'utf8'),input=JSON.parse(readFileSync(resolve(inputPath),'utf8')),model=parseModel(source);
const bundles=input.surfaceIds.map(id=>buildParametricFace(model.objects.find(o=>o.id===id),input.localIds));
const shell=buildAxisBoxShell(input.origin,input.sides,bundles,input.shellIds),validation=validateAxisBoxShell(shell),solidValidation=validateAxisBoxSolid(shell),output=resolve(outputPath),json=v=>JSON.stringify(v,null,2)+'\n';mkdirSync(output,{recursive:true});
for(const [name,bytes]of Object.entries({'source.css':source,'input.json':json(input),'source-model.json':json(model),'shell.json':json(shell),'shell-validation.json':json(validation),'solid-validation.json':json(solidValidation)}))writeFileSync(resolve(output,name),bytes);
shell.faces.forEach((face,i)=>{const exported=exportIGES(face.bundle.geometry,face.bundle.geometry.objects.map(o=>o.id));for(const [suffix,bytes]of Object.entries({'bundle.json':json(face.bundle),'local-validation.json':json(validateFaceBundle(face.bundle)),'iges':exported.iges,'export-report.json':json(exported.report)}))writeFileSync(resolve(output,'face-'+i+'.'+suffix),bytes);});
console.log(json({output,shellValidation:validation,solidValidation,interchange:'Six original per-face geometry files; no serialized/sewn shell or original solid'}));
