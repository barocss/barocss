import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {solveXYLinearSketch,exportIGES} from '../../packages/barocss-cad/dist/index.js';
const [filename,directory]=process.argv.slice(2);if(!filename||!directory)throw new Error('Usage: node xy-linear-sketch-demo.mjs document.json output-directory');
const request=JSON.parse(readFileSync(resolve(filename),'utf8')),result=solveXYLinearSketch(request),output=resolve(directory);mkdirSync(output,{recursive:true});
const json=value=>JSON.stringify(value,(_,v)=>typeof v==='number'&&Object.is(v,-0)?JSON.rawJSON('-0'):v,2)+'\n';writeFileSync(resolve(output,'result.json'),json(result));
if(!result.ok){console.log('Sketch failed with diagnostics; no partial geometry was returned.');process.exitCode=1;}else{const exported=exportIGES(result.solution.model,result.solution.model.objects.map(o=>o.id));writeFileSync(resolve(output,'source.css'),result.solution.source);writeFileSync(resolve(output,'geometry.iges'),exported.iges);writeFileSync(resolve(output,'export-report.json'),json(exported.report));console.log('Solved original lines exported; no closed-wire, region or solid certificate.');}
