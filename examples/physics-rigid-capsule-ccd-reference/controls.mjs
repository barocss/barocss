import assert from 'node:assert/strict';
import { fixtures } from '../physics-rigid-engine-reference/fixtures.mjs';
import { originalReferenceInput, yawReferenceInput } from './reference-controls.mjs';
export const fixture = fixtures().find(f => f.id === 'CAPSULE_THIN_CCD').input;
export function snapshot(input = originalReferenceInput) {
  return { version: 1, profile: 'rigid-capsule-linear-face-v1', selectedFace: 'negative-x', revision: 'fixture-1280',
    capsule: { ...structuredClone(input.capsule), orientationXYZW: [0, 0, 0, 1], angularVelocityRadps: [0, 0, 0] },
    box: { ...structuredClone(input.box), velocityMps: [0, 0, 0], angularVelocityRadps: [0, 0, 0] } };
}
const movement = input => ({ revision: 'fixture-1280', centerM: [...input.centerM], velocityMps: [...input.velocityMps], stepSeconds: input.stepSeconds });
export function runControls(api) {
  const receipts = [], candidates = [];
  function refusal(name, action, code, message) {
    let caught;
    try { action(); } catch (error) { if (!(error instanceof api.PhysicsError)) throw error; caught = error; }
    assert.ok(caught, name); assert.equal(caught.code, code, name); assert.equal(caught.message, message, name);
    receipts.push({ name, code: caught.code, message: caught.message, originalPhysicsError: true });
  }
  assert.deepEqual(fixture.bodies[0].shape, { kind: 'capsule', radiusM: .1, halfLengthM: .2 });
  assert.deepEqual(fixture.bodies[0].positionM, originalReferenceInput.centerM);
  assert.deepEqual(fixture.bodies[0].velocityMps, originalReferenceInput.velocityMps);
  assert.equal(fixture.fixedStepSeconds, originalReferenceInput.stepSeconds);
  refusal('original-ccd-admission', () => api.parseBody(structuredClone(fixture.bodies[0])), 'INVALID_CONFIG', 'ccd is supported for dynamic spheres or boxes only and must be true');
  // Keep detached candidate records before mutating the returned hit.
  function measure(name, input) {
    const s = snapshot(input), q = movement(input), ref = api.createRigidCapsuleFaceReference(s);
    const beforeS = structuredClone(s), beforeQ = structuredClone(q), hit = ref.sweep(q);
    const hitCopy = structuredClone(hit), result = api.advanceHeadOnFaceStep({ snapshot: s, ...q }, hit, q.stepSeconds), resultCopy = structuredClone(result);
    assert.deepEqual(s, beforeS); assert.deepEqual(q, beforeQ);
    s.box.centerM[0] = 42; ref.getSnapshot().box.centerM[0] = 99; assert.deepEqual(ref.getSnapshot(), beforeS);
    if (hit) hit.pointM[0] = 42; result.centerM[0] = 42; assert.deepEqual(ref.sweep(q), hitCopy);
    const snap = ref.getSnapshot();
    refusal(name + '-stale', () => ref.sweep({ ...q, revision: 'stale' }), 'STALE_SNAPSHOT', 'Revision mismatch');
    assert.deepEqual(ref.getSnapshot(), snap); assert.deepEqual(resultCopy.orientationXYZW, snap.capsule.orientationXYZW); assert.deepEqual(resultCopy.box, snap.box);
    ref.dispose(); ref.dispose();
    refusal(name + '-disposed-query', () => ref.sweep(q), 'DISPOSED', api.ERRORS.disposed);
    refusal(name + '-disposed-snapshot', () => ref.getSnapshot(), 'DISPOSED', api.ERRORS.disposed);
    const row = { name, input: structuredClone(input), hit: hitCopy, result: resultCopy }; candidates.push(row); return row;
  }
  for (const [name, change] of [['original-head-on',{}], ['initial-touch',{centerM:[-.101,0,0]}], ['resting-at-touch',{centerM:[-.101,0,0],velocityMps:[0,0,0]}], ['contact-beyond-step',{velocityMps:[10,0,0]}], ['zero-motion',{velocityMps:[0,0,0]}], ['departing',{velocityMps:[-100,0,0]}], ['departing-at-touch',{centerM:[-.101,0,0],velocityMps:[-100,0,0]}]]) measure(name, { ...structuredClone(originalReferenceInput), ...change });
  measure('yaw-head-on', structuredClone(yawReferenceInput));
  const first = measure('first-half', { ...structuredClone(originalReferenceInput), stepSeconds: 1/240 });
  const second = measure('second-half', { ...structuredClone(originalReferenceInput), centerM: first.result.centerM, velocityMps: first.result.velocityMps, stepSeconds: 1/240 });
  const full = candidates[0]; assert.deepEqual(second.result.centerM, full.result.centerM); assert.deepEqual(second.result.velocityMps, full.result.velocityMps); assert.ok(Math.abs(first.result.hitTimeSeconds - full.result.hitTimeSeconds) <= 1e-12);
  const ref = api.createRigidCapsuleFaceReference(snapshot()), q = movement(originalReferenceInput), before = ref.getSnapshot(), accepted = ref.sweep(q);
  for (const [name, change, code, message] of [
    ['overlap',{centerM:[-.1009,0,0]},'INITIAL_OVERLAP','Initial capsule overlaps a box'],
    ['tangent',{velocityMps:[100,1,0]},'INVALID_QUERY',api.ERRORS.movement],
    ['opposite-side',{centerM:[.4,0,0]},'INVALID_QUERY',api.ERRORS.movement],
    ['edge-corner',{centerM:[-.4,.8,0]},'INVALID_QUERY',api.ERRORS.movement],
    ['nonfinite',{centerM:[NaN,0,0]},'INVALID_QUERY',api.ERRORS.movement],
    ['zero-time',{stepSeconds:0},'INVALID_QUERY',api.ERRORS.movement],
    ['negative-time',{stepSeconds:-1/120},'INVALID_QUERY',api.ERRORS.movement],
    ['nonfinite-time',{stepSeconds:Infinity},'INVALID_QUERY',api.ERRORS.movement],
    ['extra-field',{angularVelocityRadps:[0,1,0]},'INVALID_QUERY',api.ERRORS.movement],
  ]) { refusal(name,()=>ref.sweep({...q,...change}),code,message); assert.deepEqual(ref.getSnapshot(),before); assert.deepEqual(ref.sweep(q),accepted); }
  for (const [name, edit] of [['angular', s=>s.capsule.angularVelocityRadps[1]=1],['orientation',s=>s.capsule.orientationXYZW[1]=.1],['moving-box',s=>s.box.velocityMps[0]=1],['box-spin',s=>s.box.angularVelocityRadps[1]=1],['wrong-radius',s=>s.capsule.radiusM=.15],['unknown-profile',s=>s.profile='unknown']]) { const s=snapshot(); edit(s); refusal(name,()=>api.createRigidCapsuleFaceReference(s),'INVALID_CONFIG',api.ERRORS.profile); }
  refusal('numeric-fraction',()=>api.advanceHeadOnFaceStep({snapshot:snapshot(),...q},{...accepted,toiFraction:2},q.stepSeconds),'NUMERIC_LIMIT',api.ERRORS.numeric);
  for (const [name, change, hit, code, message] of [
    ['response-null-hit',{},null,'NUMERIC_LIMIT',api.ERRORS.numeric],
    ['response-wrong-witness',{}, {...accepted, pointM:[1,0,0]},'NUMERIC_LIMIT',api.ERRORS.numeric],
    ['response-wrong-normal',{}, {...accepted, normalFixtureToCapsule:[1,0,0]},'NUMERIC_LIMIT',api.ERRORS.numeric],
    ['response-tangent',{velocityMps:[100,1,0]},null,'INVALID_QUERY',api.ERRORS.movement],
    ['response-footprint',{centerM:[-.4,.8,0]},null,'INVALID_QUERY',api.ERRORS.movement],
    ['response-overlap',{centerM:[-.1009,0,0]},null,'INITIAL_OVERLAP','Initial capsule overlaps a box'],
    ['response-opposite',{centerM:[.4,0,0]},null,'INVALID_QUERY',api.ERRORS.movement],
  ]) { refusal(name,()=>api.advanceHeadOnFaceStep({snapshot:snapshot(),...q,...change},hit,q.stepSeconds),code,message); assert.deepEqual(ref.getSnapshot(),before); assert.deepEqual(ref.sweep(q),accepted); }
  const marker = new Error('Unexpected reflection failure'); const proxy = new Proxy({}, { getPrototypeOf() { throw marker; } });
  assert.throws(()=>api.createRigidCapsuleFaceReference(proxy), e=>e===marker); receipts.push({name:'unexpected-error-propagates',ok:true});
  const publicScene = {version:1,profile:'upright-capsule-box-v1',revision:'fixture-1280',boxes:[structuredClone(originalReferenceInput.box)]};
  refusal('public-refuses-private-profile',()=>api.createUprightCapsuleQuery({...publicScene,profile:api.PROFILE}),'INVALID_CONFIG','Unsupported capsule query profile');
  const pub = api.createUprightCapsuleQuery(publicScene), publicHit = pub.sweep({revision:publicScene.revision,centerM:[-.4,0,0],displacementM:[100/120,0,0],excludeId:null});
  assert.ok(publicHit); assert.ok(Math.abs(publicHit.toiFraction-.2988)<=1e-12); const publicStored=pub.getSnapshot(); publicScene.boxes[0].centerM[0]=42; publicStored.boxes[0].centerM[0]=42; assert.equal(pub.getSnapshot().boxes[0].centerM[0],0);
  pub.dispose(); pub.dispose(); refusal('public-disposed',()=>pub.getSnapshot(),'DISPOSED','Capsule query is disposed');
  const geometryOnly = structuredClone(fixture.bodies[0]); delete geometryOnly.ccd;
  const cap = api.parseBody(geometryOnly), box = api.parseBody(structuredClone(fixture.bodies[1]));
  const startContact = api.detect(cap, box); assert.equal(startContact,null); cap.positionM=[...full.result.centerM]; const contact=api.detect(cap,box);
  if(contact) { assert.ok(contact.penetration<=1e-12); assert.ok(Math.abs(contact.normal[0]-1)<=1e-12); }
  receipts.push({name:'original-discrete-detect',startContact,contact,discreteOnly:true,ccdRemovedOnlyFromDetachedGeometryCopy:true});
  return { candidates, receipts, fixture, publicHit, fullWorldCCDGO:false, rigidAngularResponseMeasured:false, contactFrictionMeasured:false, physicsWorldCreated:false, physicsWorldStepped:false };
}
