import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const cwd = process.cwd();
const { curveCutOffsets } = await import(pathToFileURL(cwd + '/packages/barocss-cad/dist/features/curve-cut-pattern.js'));
const { part } = await import(pathToFileURL(cwd + '/packages/barocss-cad/dist/api/index.js'));
const path = {degree:2,knots:[0,0,0,1,1,1],controlPoints:[[0,0,0],[20,0,0],[20,20,0]],weights:[1,1,1]};
const results=[];
for(const [label,run] of [
 ['kernel-offsets',()=>curveCutOffsets(path,10,3,10000,(code,message)=>{throw Object.assign(new Error(message),{code});})],
 ['public-part',()=>part('quadratic baseline').box({w:60,d:40,h:10}).subtract(p=>p.box({w:3,d:5,h:10,x:7,y:6})).curveFeaturePattern({path,spacing:10,count:3}).mass({density:1})]
]) {try{results.push({label,status:'ACCEPTED',result:run()});}catch(e){results.push({label,status:'INTENTIONAL_REFUSAL',code:e.code,message:e.message});}}
console.log(JSON.stringify({node:process.version,path,spacing:10,count:3,results},null,2));
