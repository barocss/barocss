// Root executes on a frozen private Source or Native module. No production test seam.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync,openSync,readFileSync,readSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'../..');
function hash(path){const fd=openSync(path,'r'),h=createHash('sha256'),b=Buffer.alloc(65536);try{let n;while((n=readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');}
const modulePath=process.env.FRICTIONLESS_ISOTROPY_MODULE,moduleSHA=process.env.FRICTIONLESS_ISOTROPY_MODULE_SHA256;
assert.ok(modulePath&&modulePath.startsWith('/'));assert.match(moduleSHA??'',/^[0-9a-f]{64}$/);assert.equal(hash(modulePath),moduleSHA);
const paid=resolve(root,'examples/physics-coupled-cubes-floor-2276/evidence/private-03/source-free-capture.json');
assert.equal(hash(paid),'7b716d78456581a5d8ff14d326d11f768c5429f42830f86750ad33ccd8a30f5b');
const packet=JSON.parse(readFileSync(paid,'utf8'));
function restore(value,hex){assert.match(hex,/^(?:[0-9a-f]{16})*$/);const b=Buffer.from(hex,'hex');assert.ok(b.length<=512*1024);let at=0,nodes=0;function visit(x,depth){assert.ok(++nodes<=262144&&depth<=32);if(typeof x==='number'){assert.ok(at+8<=b.length);const n=b.readDoubleLE(at);at+=8;assert.ok(Number.isFinite(n)&&n===x);return n;}if(Array.isArray(x))return x.map(v=>visit(v,depth+1));if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,visit(v,depth+1)]));return x;}const out=visit(value,0);assert.equal(at,b.length);return out;}
const actual=restore(packet.data,packet.numericWordsF64leHex).free;
const captured=actual.freeBodies.find(body=>body.id==='lower').orientation;
assert.ok(captured.slice(0,3).some(x=>x!==0));
const rotations=[[0,0,0,1],[0,0,Math.SQRT1_2,Math.SQRT1_2],[...captured]];
const api=await import(pathToFileURL(modulePath));let calls=0;
function cube(c,orientation){const mass=6/c,half=[.5,.5,.5],inertia=mass/3*(half[1]**2+half[2]**2);assert.equal(1/inertia,c);return{id:'moving',kind:'dynamic',shape:{kind:'box',halfExtentsM:half},positionM:[1,2,3],velocityMps:[.25,-.5,.125],orientation:[...orientation],angularVelocityRadps:[0,0,0],inertiaDiagonalKgM2:[inertia,inertia,inertia],inverseInertiaLocal:[c,c,c],inverseMass:1/mass,sensor:false,restitution:0,frictionStatic:0,frictionDynamic:0};}
function run(body,pairs=[],context={jointCount:0}){const input=Array.isArray(body)?body:[body],before=structuredClone(input);calls++;try{return{result:api.prepareFrictionlessIsland(input,pairs,context),error:null};}catch(error){assert.ok(error instanceof api.FrictionlessIslandFailure);return{result:null,error};}finally{assert.deepEqual(input,before);}}
function tensor(observation,id='moving'){const d=observation.result?.diagnostics??observation.error?.diagnostics;assert.ok(d?.normalProblem);return d.normalProblem.bodies.find(b=>b.id===id).inverseInertiaWorld;}

test('exact isotropy: three physical masses and three represented rotations',()=>{
 for(const c of [.5,3,12])for(const orientation of rotations){
  const body=cube(c,orientation),observation=run(body);assert.equal(observation.error,null,'no-contact isotropic private phase');
  assert.deepEqual(tensor(observation),[[c,0,0],[0,c,0],[0,0,c]]);
  assert.deepEqual(observation.result.candidateBodies[0].orientation,orientation);
  assert.deepEqual(observation.result.candidateBodies[0].velocityMps,body.velocityMps);
  assert.equal(observation.result.diagnostics.normalSolverCalls,1);assert.equal(observation.result.diagnostics.positionSolverCalls,1);
 }
});
test('unequal local values keep represented anisotropic columns and strict symmetry refusal',()=>{
 const rectangle=cube(3,[0,0,0,1]);rectangle.shape.halfExtentsM=[.25,.5,.75];
 const [hx,hy,hz]=rectangle.shape.halfExtentsM,mass=2;
 rectangle.inertiaDiagonalKgM2=[mass/3*(hy*hy+hz*hz),mass/3*(hx*hx+hz*hz),mass/3*(hx*hx+hy*hy)];
 rectangle.inverseInertiaLocal=rectangle.inertiaDiagonalKgM2.map(x=>1/x);
 const identity=run(rectangle);assert.equal(identity.error,null);const [a,b,c]=rectangle.inverseInertiaLocal;
 assert.deepEqual(tensor(identity),[[a,0,0],[0,b,0],[0,0,c]]);
 const near=cube(3,captured);near.inverseInertiaLocal[2]=3+2**-50;
 const observed=run(near),matrix=tensor(observed);assert.notDeepEqual(matrix,[[3,0,0],[0,3,0],[0,0,3]]);
 const symmetric=matrix.every((row,i)=>row.every((value,j)=>value===matrix[j][i]));
 if(!symmetric){assert.ok(observed.error);assert.equal(observed.error.code,'NUMERIC_LIMIT');assert.match(observed.error.diagnostics.normalResult.reason,/symmetric inertia required/);}
 else assert.equal(observed.error,null,'symmetric positive no-contact anisotropic tensor');
});
test('static zero route and original material/joint refusal boundaries remain',()=>{
 const body=cube(3,captured),fixed={id:'fixed',kind:'static',shape:{kind:'box',halfExtentsM:[.5,.5,.5]},positionM:[-4,2,3],velocityMps:[0,0,0],orientation:[0,0,0,1],angularVelocityRadps:[0,0,0],inverseInertiaLocal:[0,0,0],inverseMass:0,sensor:false,restitution:0,frictionStatic:0,frictionDynamic:0};
 const observed=run([body,fixed],[[1,0]]);assert.equal(observed.error,null);assert.deepEqual(tensor(observed,'fixed'),[[0,0,0],[0,0,0],[0,0,0]]);assert.deepEqual(observed.result.candidateBodies[1],fixed);
 for(const name of ['friction','restitution','joint']){const value=cube(3,captured);if(name==='friction')value.frictionStatic=.25;if(name==='restitution')value.restitution=.25;const refused=run(value,[],{jointCount:name==='joint'?1:0});assert.ok(refused.error);assert.equal(refused.error.code,'NUMERIC_LIMIT');assert.equal(refused.error.diagnostics.normalProblem,null);}
});
test.after(()=>{assert.equal(calls,15,'fixed private function call count; zero World calls');assert.equal(hash(modulePath),moduleSHA);assert.equal(hash(paid),'7b716d78456581a5d8ff14d326d11f768c5429f42830f86750ad33ccd8a30f5b');});
