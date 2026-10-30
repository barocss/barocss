import { pathToFileURL } from 'node:url';
const { curveCutOffsets } = await import(pathToFileURL(process.cwd() + '/packages/barocss-cad/dist/features/curve-cut-pattern.js'));
const line={degree:1,knots:[0,0,1,2,2],controlPoints:[[0,0,0],[16,0,0],[16,16,0]],weights:[1,1,1]};
const quadratic={degree:2,knots:[0,0,0,1,1,2,2,2],controlPoints:[[0,0,0],[8,0,0],[16,0,0],[16,8,0],[16,16,0]],weights:[1,1,1,1,1]};
const translated=structuredClone(line);translated.controlPoints=translated.controlPoints.map(p=>p.map((v,k)=>v+[100,-200,300][k]));translated.knots=[-10,-10,-9,20,20];
const cases=[];
for(const [name,path] of [['line',line],['quadratic-straight',quadratic],['translated-nonuniform',translated]])for(const [spacing,count] of [[8,5],[6,5],[10,3],[8,1],[8.000000000000002,5]]){
 const row={name,path,spacing,count};try{row.offsets=curveCutOffsets(path,spacing,count,10000,(code,message)=>{throw Object.assign(new Error(message),{code});});row.status='ACCEPTED';}catch(e){row.status='REFUSED';row.code=e.code;row.message=e.message;}cases.push(row);
}
console.log(JSON.stringify({node:process.version,scope:'Captured old straight placement/error behavior for differential preservation; not an independent curved geometry oracle',cases},null,2));
