import test from 'node:test';
import assert from 'node:assert/strict';
import { part, Location } from '../src/api';
import { commands, type Ctx } from '../src/app/commands';
import { evaluateDoc } from '../src/engine/evaluate';
import { isRefusal } from '../src/engine/refusal';

// Independent oracle: 60 × 40 × 10 minus six 4 × 4 × 10 through cuts = 23040.
const seed = () => part('command seed').box({ w: 60, d: 40, h: 10 })
  .subtract(p => p.box({ w: 4, d: 4, h: 10, x: 0, y: 8 }).moved(Location.at([8, 0, 0])));
function context(p = seed()): Ctx {
  const doc = p.doc, result = evaluateDoc(doc, 1);
  assert.ok(result.ok, result.ok ? '' : result.error.detail); assert.equal(result.bodies.length, 1);
  return { doc, bodies: result.bodies, selection: { faces: [], edges: [], bodies: [0] } };
}
function command() {
  const cmd = commands.find(c => c.id === 'rectangular-feature-pattern'); assert.ok(cmd && cmd.build); return cmd;
}
const values = { axis: 'x', spacing: 16, count: 3, axis2: 'y', spacing2: 16, count2: 2 };

test('rectangular cut pattern command: the real registry builds one append with original base and tool history intact', () => {
  const cmd = command(), ctx = context(), before = structuredClone(ctx), input = { ...values };
  assert.deepEqual(cmd.defaults!(ctx), values);
  assert.deepEqual(cmd.fields!(ctx).map(f => f.label), ['First direction', 'First spacing', 'First count', 'Second direction', 'Second spacing', 'Second count']);
  assert.equal(cmd.available(ctx).ok, true);
  assert.equal(cmd.available({ ...ctx, direct: [] }).ok, true, 'an empty direct selection is not a direct pick');
  const made = cmd.build!(ctx, input), last = made.nodes.at(-1);
  assert.ok(last && last.kind === 'rectangular-feature-pattern');
  assert.deepEqual(last.parent, { node: ctx.doc.nodes.length - 1, side: 'solid' });
  assert.equal(last.axis, 'x'); assert.equal(last.spacing, 16); assert.equal(last.count, 3);
  assert.equal(made.nodes.length, before.doc.nodes.length + 1);
  assert.deepEqual(made.nodes.slice(0, -1), before.doc.nodes);
  const duplicate = { ...ctx, selection: { faces: [], edges: [], bodies: [0, 0] } }, duplicateBefore = structuredClone(duplicate);
  assert.equal(cmd.available(duplicate).ok, true, 'duplicate picks name the same single body');
  assert.deepEqual(cmd.build!(duplicate, { ...values }), made, 'deduplicated selection makes the same append');
  assert.deepEqual(duplicate, duplicateBefore);
  const result = evaluateDoc(made, 2); assert.ok(result.ok, result.ok ? '' : result.error.detail);
  assert.equal(result.bodies.length, 1); assert.ok(result.bodies[0].volume !== null);
  assert.ok(Math.abs(result.bodies[0].volume - 23040) <= 1e-9 * 23040);
  assert.deepEqual(ctx, before); assert.deepEqual(input, values);
});

test('rectangular cut pattern command: invalid values and direct, missing, stale or suppressed selections refuse atomically', () => {
  const cmd = command(), ctx = context(), before = structuredClone(ctx);
  for (const edits of [
    { axis: 'q' }, { axis2: 'x' }, { axis2: 'q' }, { count: 33, count2: 2 }, { count2: 0 }, { count2: 2.5 }, { spacing2: 0 }, { spacing2: -1 }, { spacing2: 10001 }, ...[0, 2.5, 65, NaN, Infinity].map(count => ({ count })),
    ...[0, -1, 10001, NaN, Infinity].map(spacing => ({ spacing })),
  ]) {
    const input = { ...values, ...edits }, inputBefore = structuredClone(input);
    assert.throws(() => cmd.build!(ctx, input), error => isRefusal(error, 'VALUE'));
    assert.deepEqual(input, inputBefore); assert.deepEqual(ctx, before);
  }
  const reject = (bad: Ctx, code: 'ONE_BODY' | 'BAD_REFERENCE' | 'DIRECT_PICK') => {
    const snapshot = structuredClone(bad), available = cmd.available(bad);
    assert.equal(available.ok, false);
    assert.ok(!available.ok && available.reason.startsWith(`[${code}]`), JSON.stringify(available));
    assert.throws(() => cmd.build!(bad, { ...values }), error => isRefusal(error, code));
    assert.deepEqual(bad, snapshot);
  };
  reject({ ...ctx, direct: ['intentional-invalid-direct-pick'] }, 'DIRECT_PICK');
  reject({ ...ctx, selection: { faces: [], edges: [], bodies: [] } }, 'ONE_BODY');
  const two = seed().box({ w: 4, d: 4, h: 10, x: 80 }), twoDoc = two.doc, twoResult = evaluateDoc(twoDoc, 1);
  assert.ok(twoResult.ok, twoResult.ok ? '' : twoResult.error.detail); assert.equal(twoResult.bodies.length, 2);
  reject({ doc: twoDoc, bodies: twoResult.bodies, selection: { faces: [], edges: [], bodies: [0, 1] } }, 'ONE_BODY');
  reject({ ...ctx, selection: { faces: [], edges: [], bodies: [99] } }, 'ONE_BODY');
  reject(context(part('non-cut').box({ w: 60, d: 40, h: 10 })), 'BAD_REFERENCE');
  const source = seed(), moved = source.moved(Location.at([0, 0, 1]));
  reject(context(moved), 'BAD_REFERENCE');
  // Explicit stale UI contexts retain a real former BodyResult but point at the newer/changed document.
  reject({ ...ctx, doc: moved.doc }, 'BAD_REFERENCE');
  const suppressed = structuredClone(ctx.doc), i = suppressed.nodes.findIndex(n => n.kind === 'difference'); assert.ok(i >= 0);
  suppressed.nodes[i] = { ...suppressed.nodes[i], suppressed: true };
  reject({ ...ctx, doc: suppressed }, 'BAD_REFERENCE');
  const body = ctx.bodies[0]; assert.ok(body.ref);
  reject({ ...ctx, bodies: [{ ...body, ref: { ...body.ref, side: 'negative' } }] }, 'BAD_REFERENCE');
  assert.deepEqual(ctx, before);
  const accepted = cmd.build!(ctx, { ...values }), result = evaluateDoc(accepted, 3);
  assert.ok(result.ok, result.ok ? '' : result.error.detail); assert.equal(result.bodies.length, 1);
  assert.ok(result.bodies[0].volume !== null && Math.abs(result.bodies[0].volume - 23040) <= 1e-9 * 23040);
});
