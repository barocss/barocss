import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const K=await import(pathToFileURL(resolve('dist/index.js')));
const {buildCylindricalWrapClosedReference}=await import(pathToFileURL(resolve('dist/features/cylindrical-wrap-closed-reference.js')));
function source(z){const solid=K.prismaticFromProfile({outer:[{kind:'arc',start:[10,0],center:[0,0],direction:'ccw'}],height:30,from:z,tag:'post'});return {solid:{kind:'upright',solid},brep:K.brepFromPrismatic(solid,{id:'post'})};}
const budgets={volume:1e-8,mass:1e-10,centroid:[1e-10,1e-10,1e-10],inertia:[1e-7,1e-7,1e-7,1e-7,1e-7,1e-7]};
const cases=[{label:'lower-half-pad',z:-5,u:[.125,.375],v:[.25,.5],density:1},{label:'upper-half-pad',z:-5,u:[.125,.375],v:[.5,.75],density:1}];
const results=[];
for(const c of cases){const part=source(c.z),components=[{outer:[[c.u[0],c.v[0]],[c.u[1],c.v[0]],[c.u[1],c.v[1]],[c.u[0],c.v[1]]],holes:[]}];try{results.push({label:c.label,status:'returned',result:buildCylindricalWrapClosedReference(part,components,{id:'wrap',height:10,density:c.density,budgets})});}catch(error){if(typeof error.code!=='string'||!error.details?.source)throw error;results.push({label:c.label,status:'refused',code:error.code,source:error.details.source,message:error.message});}}
process.stdout.write(JSON.stringify({scope:'fresh single-source closed-reference geometry and mass; literal stored shell and product excluded',results},null,2)+'\n');
