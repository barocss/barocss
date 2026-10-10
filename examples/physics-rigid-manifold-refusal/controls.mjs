import assert from 'node:assert/strict';
import {digest,verifyHash,restoreRaw} from './archive.mjs';
import {reconstruct,rawBodies,sortedPairs} from './reconstruct.mjs';
export function controls(module) {
  const rows=[];const record=(name,fn)=>{fn();rows.push({name,passed:true});};
  const input={id:'a',kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[0,0,0],velocityMps:[1,2,3],massKg:1,restitution:0};
  const body=module.parseBody(input);const config={bodies:[input],fixedStepSeconds:.125,gravityMps2:[0,-8,0]};const last={bodies:[body]};
  record('zero-spin finite-gravity exact integration',()=>{const saved=structuredClone(last);const [next]=reconstruct(module,config,last);assert.deepEqual(next.positionM,[.125,.125,.375]);assert.deepEqual(next.velocityMps,[1,1,3]);assert.deepEqual(next.orientation,[0,0,0,1]);assert.deepEqual(next.angularVelocityRadps,[0,0,0]);assert.deepEqual(last,saved);});
  record('identity zero-gravity resting reconstruction',()=>{const c=structuredClone(config);c.bodies[0].velocityMps=[0,0,0];c.gravityMps2=[0,0,0];const b=module.parseBody(c.bodies[0]);const [next]=reconstruct(module,c,{bodies:[b]});assert.deepEqual(rawBodies([next]),rawBodies([b]));});
  const a=module.parseBody({...input,velocityMps:[0,0,0]});const b=module.parseBody({...input,id:'b',positionM:[0,.499,0],velocityMps:[0,0,0]});
  record('actual face hit copied observer point parity',()=>{const hit=module.detect(a,b);assert.ok(hit);const trace=module.inspectFaceManifold(a,b,hit);assert.equal(trace.reason,'face-points');assert.deepEqual(trace.points,module.boxFaceManifold(a,b,hit));assert.equal(trace.stages.length,4);});
  record('missing face direction differs from empty clipping',()=>{const hit={normal:[1/Math.sqrt(3),1/Math.sqrt(3),1/Math.sqrt(3)],penetration:0,pointM:[0,0,0]};const trace=module.inspectFaceManifold(a,b,hit);assert.equal(trace.reason,'no-reference-face');assert.equal(trace.points,null);assert.equal(module.boxFaceManifold(a,b,hit),null);assert.equal(trace.stages.length,0);});
  record('empty tangent clip with face-normal hit',()=>{const far=structuredClone(b);far.positionM=[2,.499,0];const hit={normal:[0,1,0],penetration:.001,pointM:[0,0,0]};const trace=module.inspectFaceManifold(a,far,hit);assert.equal(trace.reason,'no-clipped-candidate');assert.equal(trace.points,null);assert.equal(module.boxFaceManifold(a,far,hit),null);assert.equal(trace.stages.length,4);assert.ok(trace.stages.some(s=>s.after===0));});
  record('sorted IDs preserve eligible pair ordering',()=>{const bodies=[b,a,module.parseBody({id:'floor',kind:'static',shape:input.shape,positionM:[0,-1,0],restitution:0})];assert.deepEqual(sortedPairs(bodies).map(([a,b])=>[bodies[a].id,bodies[b].id]),[['a','b'],['a','floor'],['b','floor']]);});
  record('frozen hash corruption is an explicit refusal',()=>assert.throws(()=>verifyHash(Buffer.from('changed'),digest(Buffer.from('original')),'synthetic')));
  const rawBody=structuredClone(a);rawBody.positionM[0]=-0;const bytes=rawBodies([rawBody]);const report={ids:['a'],states:[{bodies:[JSON.parse(JSON.stringify(rawBody))],stepIndex:0,timeSeconds:0}],config:{fixedStepSeconds:.125},rawBytes:bytes.length,rawSha256:digest(bytes)};
  record('signed-zero raw field restoration',()=>assert.ok(Object.is(restoreRaw(report,bytes)[0].bodies[0].positionM[0],-0)));
  record('raw layout length refuses corruption',()=>assert.throws(()=>restoreRaw(report,bytes.subarray(8))));
  record('raw nonfinite input refuses corruption',()=>{const invalid=Buffer.from(bytes);invalid.writeDoubleLE(Infinity,0);assert.throws(()=>restoreRaw({...report,rawSha256:digest(invalid)},invalid));});
  return rows;
}
