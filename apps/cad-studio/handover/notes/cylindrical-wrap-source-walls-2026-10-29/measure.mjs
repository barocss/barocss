import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const K=await import(pathToFileURL(resolve('dist/index.js')));
const {buildCylindricalWrapWallReference}=await import(pathToFileURL(resolve('dist/features/cylindrical-wrap-source-walls.js')));
function source(z){const solid=K.prismaticFromProfile({outer:[{kind:'arc',start:[10,0],center:[0,0],direction:'ccw'}],height:30,from:z,tag:'post'});return {solid:{kind:'upright',solid},brep:K.brepFromPrismatic(solid,{id:'post'})};}
const budgets={volume:1e-8,mass:1e-10,centroid:[1e-10,1e-10,1e-10],inertia:[1e-7,1e-7,1e-7,1e-7,1e-7,1e-7]};
const cases=[{label:'Z0-reference-standard',z:0,u:[1/16,5/16],v:[1/4,3/4],density:1},{label:'centered-negative-Z-density',z:-5,u:[.125,.375],v:[.25,.75],density:7.85},{label:'asymmetric-negative-Z-budget-frontier',z:-7,u:[.1,.4],v:[.2,.7],density:7.85}];
const results=[];
for(const c of cases){const part=source(c.z),components=[{outer:[[c.u[0],c.v[0]],[c.u[1],c.v[0]],[c.u[1],c.v[1]],[c.u[0],c.v[1]]],holes:[]}];try{results.push({label:c.label,status:'returned',result:buildCylindricalWrapWallReference(part,components,{id:'wrap',height:10,density:c.density,budgets})});}catch(error){if(typeof error.code!=='string'||!error.details?.source)throw error;results.push({label:c.label,status:'refused',code:error.code,source:error.details.source,message:error.message});}}
process.stdout.write(JSON.stringify({scope:'fresh bound reference plus all original wall coefficient proofs; caps, shell, mass transfer and product excluded',results},null,2)+'\n');
