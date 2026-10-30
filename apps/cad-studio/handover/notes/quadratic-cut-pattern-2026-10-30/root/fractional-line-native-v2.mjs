import {pathToFileURL} from 'node:url';
const base=process.cwd()+'/packages/barocss-cad/dist/';
const {part}=await import(pathToFileURL(base+'api/index.js'));
const {checkBrep,evaluateCadPart}=await import(pathToFileURL(base+'index.js'));
const path={degree:1,knots:[0,0,1,1],controlPoints:[[0,0,0],[20,20,0]],weights:[1,1]};
const p=part('fractional straight baseline').box({w:60,d:40,h:10}).subtract(p=>p.box({w:3,d:5,h:10,x:7,y:6})).curveFeaturePattern({path,spacing:10,count:3});
const snapshot=evaluateCadPart(p.doc),out=snapshot.outputs[0],expected=24000-3*150;
const corners=[];for(let k=0;k<3;k++)for(const x of [7,10])for(const y of [6,11])for(const z of [0,10]){const point=[x+k*10/Math.SQRT2,y+k*10/Math.SQRT2,z];corners.push({point,error:Math.min(...out.brep.vertices.map(v=>Math.max(...v.point.map((c,a)=>Math.abs(c-point[a])))))});}
console.log(JSON.stringify({node:process.version,path,expectedVolume:expected,mass:p.mass({density:1}),strict:checkBrep(out.brep,{strict:true}),maxCornerError:Math.max(...corners.map(x=>x.error)),corners},null,2));
