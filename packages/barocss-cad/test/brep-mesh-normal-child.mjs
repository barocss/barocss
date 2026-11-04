import assert from 'node:assert/strict';
import { importStep, transformBrep } from '../dist/index.js';
import { tessellateBrepWithParameters } from '../dist/brep/brep-tessellate.js';
import { sphereCoverageStep } from './step-sphere-coverage-fixtures.mjs';
import { normalSheet, oracleNormal } from './brep-mesh-normal-fixtures.mjs';
const options=JSON.parse(process.argv[2]),before=performance.now();
let b,center=options.center??[0,0,0];
if(options.kind==='sheet')b=normalSheet(options);
else {b=importStep(sphereCoverageStep(options));if(options.mirror){b=transformBrep(b,{matrix:[-1,0,0,0,1,0,0,0,1]});center=[-center[0],center[1],center[2]];}}
const original=JSON.stringify(b),{mesh,parameters}=tessellateBrepWithParameters(b,{segmentsPerQuarter:options.q??8});
assert.equal(JSON.stringify(b),original,'normal calculation must not mutate the authored B-rep');
assert.ok(mesh.indices.length>0&&mesh.indices.length/3<20000,'bounded native triangulation work');
assert.ok([...mesh.positions,...mesh.normals].every(Number.isFinite),'finite mesh positions and normals');
const boundaries=new Set();for(const edge of mesh.edges)for(let i=0;i<edge.points.length;i+=3)boundaries.add(Array.from(edge.points.slice(i,i+3)).join(','));
let minimum=1,checked=0;
for(const face of mesh.faces){
  assert.equal(face.kind,'trimmed','exercise the native parameter-domain path');
  const param=parameters.get(face.faceId),s=b.faces.find(f=>f.id===face.faceId).surface;
  for(let i=0;i<face.vertexCount;i++){
    const k=3*(face.vertexOffset+i),p=Array.from(mesh.positions.slice(k,k+3)),n=Array.from(mesh.normals.slice(k,k+3));
    assert.ok(Math.abs(Math.hypot(...n)-1)<1e-10,'unit mesh normal');
    let expected;
    if(options.kind==='sheet')expected=oracleNormal(s,...param.uv[i]);
    else {const d=p.map((x,j)=>x-center[j]),r=Math.hypot(...d);assert.ok(Math.abs(r-(options.radius??.001))<=1e-7,'literal sphere support');const pole=options.tilted?(.8*d[0]+.6*d[2])/r:d[2]/r;if(Math.abs(pole)>.99)continue;expected=d.map(x=>x/r);}
    const at=param.at(...param.uv[i]);assert.ok(boundaries.has(p.join(','))||Math.hypot(...p.map((x,j)=>x-at[j]))<=1e-7,`world displacement ${Math.hypot(...p.map((x,j)=>x-at[j]))}: positions retain the original world evaluator or exact shared boundary`);
    const dot=n.reduce((sum,x,j)=>sum+x*expected[j],0);minimum=Math.min(minimum,dot);checked++;
    assert.ok(dot>=Math.cos(Math.PI/180),`normal direction dot ${dot}, vertex ${i}, p ${p}`);
  }
}
if(options.kind!=='sheet'){
 const uses=new Map(),key=i=>Array.from(mesh.positions.slice(i*3,i*3+3)).join(',');
 for(let t=0;t<mesh.indices.length;t+=3)for(let e=0;e<3;e++){const a=key(mesh.indices[t+e]),b=key(mesh.indices[t+(e+1)%3]);assert.notEqual(a,b,'noncollapsed mesh edge');const k=a<b?a+'|'+b:b+'|'+a;uses.set(k,(uses.get(k)??0)+1);}
 assert.ok([...uses.values()].every(n=>n===2),'closed sphere mesh edges are shared twice');
}
assert.ok(checked>0,'normal oracle exercised');
process.stdout.write(JSON.stringify({options,elapsed:performance.now()-before,units:{time:'ms',length:'mm',angle:'rad'},vertices:mesh.positions.length/3,triangles:mesh.indices.length/3,checked,minimum})+'\n');
