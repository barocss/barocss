import assert from 'node:assert/strict';
function assertFinite(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(assertFinite);
  else if (value && typeof value === 'object') Object.values(value).forEach(assertFinite);
}
export function runAdmission(createPhysicsWorld, PhysicsError, fixtures) {
  return fixtures.map(({ id, input }) => {
    const immutableInput = structuredClone(input);
    let world;
    try { world = createPhysicsWorld(input); }
    catch (e) {
      assert.ok(e instanceof PhysicsError, `${id}: canonical public error`);
      assert.equal(e.code, 'INVALID_CONFIG');
      assert.deepEqual(input, immutableInput, `${id}: create refusal mutated input`);
      return { id, input: immutableInput, admission: 'refused', error: { code: e.code, message: e.message }, quality: 'unmeasured' };
    }
    try {
      const initial = world.getState();
      assert.equal(initial.stepIndex, 0);
      assert.equal(initial.timeSeconds, 0);
      const accepted = world.step(input.fixedStepSeconds);
      assert.equal(accepted.stepIndex, 1);
      assert.equal(accepted.timeSeconds, input.fixedStepSeconds);
      assertFinite(accepted);
      const retained = structuredClone(accepted);
      accepted.bodies[0].positionM[0] += 100;
      assert.deepEqual(world.getState(), retained, `${id}: copied state`);
      assert.throws(() => world.step(1 / 100), e => e instanceof PhysicsError && e.code === 'INVALID_STEP');
      assert.deepEqual(world.getState(), retained, `${id}: failed-step retention`);
      assert.deepEqual(input, immutableInput, `${id}: create/step mutated caller input`);
      world.dispose(); world.dispose();
      assert.throws(() => world.getState(), e => e instanceof PhysicsError && e.code === 'DISPOSED');
      return { id, input: immutableInput, admission: 'admitted', initial, accepted: retained, lifecycle: { finite: true, copied: true, badStepRetained: true, disposed: true }, quality: 'unmeasured' };
    } finally { world.dispose(); }
  });
}
