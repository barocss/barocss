import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const K=await import(pathToFileURL(resolve('dist/index.js')));
const {certifyCylindricalWrapFormalPadMass}=await import(pathToFileURL(resolve('dist/features/cylindrical-wrap-formal-mass.js')));
function source(z=0){const solid=K.prismaticFromProfile({outer:[{kind:'arc',start:[10,0],center:[0,0],direction:'ccw'}],height:30,from:z,tag:'post'});return {solid:{kind:'upright',solid},brep:K.brepFromPrismatic(solid,{id:'post'})};}
const budgets={volume:1e-8,mass:1e-10,centroid:[1e-10,1e-10,1e-10],inertia:[1e-7,1e-7,1e-7,1e-7,1e-7,1e-7]};
const cases=[{label:'D304-standard-formal-reference',part:source(),rectangle:{u:[1/16,5/16],v:[1/4,3/4]},density:1},{label:'negative-Z-asymmetric-density',part:source(-7),rectangle:{u:[.1,.4],v:[.2,.7]},density:7.85}];
const results=[];
for(const c of cases){const result=certifyCylindricalWrapFormalPadMass(c.part,c.rectangle,{id:'wrap',density:c.density,budgets});results.push({label:c.label,result});}
const storage=new DataView(new ArrayBuffer(8));
function bits(_key,value){if(typeof value==='number'){storage.setFloat64(0,value,false);return {$float64:storage.getBigUint64(0,false).toString(16).padStart(16,'0')};}return value;}
process.stdout.write(JSON.stringify({scope:'separate formal reference mass requests only; not a combined native binding request, literal stored BRep mass, physical wrapped solid or product provider',results},bits,2)+'\n');
