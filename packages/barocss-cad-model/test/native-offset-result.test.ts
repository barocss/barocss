import test from 'node:test';
import assert from 'node:assert/strict';
import { cylinderPart, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { bodyKeyFor } from '../src/engine/ids';
import { deferMasses, evaluateDoc, partBreps } from '../src/engine/evaluate';
import { isRefusal } from '../src/engine/refusal';
import { extrudeCommand } from '../src/app/profileCommands';
import { resolveNativeOffsetFace, validateNativeOffsetDistance, validateNativeOffsetResult, type NativeOffsetFaceProfile } from '../src/app/nativeOffsetFace';
import type { Ctx } from '../src/app/commands';
function fixture(axis: 0 | 1 | 2, witness = true): StudioDoc {
  const rotation = axis === 0 ? 'y' : axis === 1 ? 'x' : 'z', angle = axis === 1 ? -90 : axis === 0 ? 90 : 0;
  const rotated = withNode(cylinderPart(3, 5.00009), { kind: 'rotate', parent: { node: 1, side: 'solid' }, axis: rotation, angle });
  let doc = withNode(rotated, { kind: 'translate', parent: { node: 2, side: 'solid' }, offset: [.1234567, -.2345678, .3456789] });
  if (witness) { doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [100, 100], max: [106, 110] }); doc = withNode(doc, { kind: 'extrude', sketch: 4, height: 7 }); }
  return doc;
}
function context(doc: StudioDoc, axis: 0 | 1 | 2, sourceNode: number, sign = 1): Ctx {
  const evaluated = evaluateDoc(doc, 0); assert.ok(evaluated.ok, JSON.stringify(evaluated));
  const key = bodyKeyFor(doc.nodes, sourceNode), body = evaluated.bodies.findIndex(b => b.key === key); assert.ok(body >= 0);
  const face = evaluated.bodies[body].mesh.faces.findIndex(f => f.kind === 'plane' && f.normal[axis] === sign); assert.ok(face >= 0);
  return { doc, bodies: evaluated.bodies, selection: { faces: [{ body, face }], edges: [], bodies: [] } };
}
/** The existing composition only, deliberately bypassing Offset.build's new postcondition for direct tests. */
function candidate(ctx: Ctx, profile: NativeOffsetFaceProfile, distance: number): StudioDoc {
  validateNativeOffsetDistance(profile, distance);
  const doc = withNode(ctx.doc, structuredClone(profile.sketch)), index = doc.nodes.length - 1;
  return extrudeCommand.build!({ ...ctx, doc, selection: { sketches: [index], faces: [], edges: [], bodies: [] }, direct: [] }, { h: Math.abs(distance), draft: 0, op: distance > 0 ? 'join' : 'cut', depth: 'distance' });
}
for (const axis of [0, 1] as const) test(`actual Offset target: axis${axis} empty result cannot borrow a witness body`, () => {
  const doc = fixture(axis), ctx = context(doc, axis, 3), before = structuredClone(doc), selection = structuredClone(ctx.selection), p = resolveNativeOffsetFace(ctx), distance = -5.00009;
  const empty = candidate(ctx, p, distance), key = bodyKeyFor(empty.nodes, empty.nodes.length - 1), actual = evaluateDoc(empty, 0); assert.ok(actual.ok, JSON.stringify(actual));
  assert.equal(actual.bodies.length, 1); assert.ok(Math.abs(actual.bodies[0].volume! - 420) <= 1e-7); assert.notEqual(actual.bodies[0].key, key); assert.ok(!partBreps(empty).some(b => b.key === key));
  for (let i = 0; i < 2; i++) assert.throws(() => validateNativeOffsetResult(ctx, empty, p, distance), e => isRefusal(e, 'FACE_DISTANCE') && /empty, missing, or ambiguous/.test(e.message));
  assert.deepEqual(doc, before); assert.deepEqual(ctx.selection, selection);
  const retry = candidate(ctx, p, distance + .001); validateNativeOffsetResult(ctx, retry, p, distance + .001);
  const outward = candidate(ctx, p, 2); validateNativeOffsetResult(ctx, outward, p, 2);
  assert.deepEqual(doc, before); assert.deepEqual(ctx.selection, selection);
});

test('actual Offset target: corrected upright tiny result keeps its actual Model provider', () => {
  const doc = fixture(2), ctx = context(doc, 2, 3), p = resolveNativeOffsetFace(ctx), distance = -5.00009, out = candidate(ctx, p, distance), before = structuredClone(out);
  validateNativeOffsetResult(ctx, out, p, distance); validateNativeOffsetResult(ctx, out, resolveNativeOffsetFace(ctx), distance);
  const evaluated = evaluateDoc(out, 0); assert.ok(evaluated.ok, JSON.stringify(evaluated)); const key = bodyKeyFor(out.nodes, out.nodes.length - 1), body = evaluated.bodies.find(b => b.key === key)!;
  assert.equal(body.family, 'upright'); assert.ok(body.volume! > 0); assert.equal(body.centroid![2], .3456789000000001); assert.deepEqual(out, before);
});

test('actual Offset target: all twelve ordinary signed box requests survive strict result checks', () => {
  const doc = withNode(rectanglePart(20.00003, 10.00007, 5.00009), { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [.1234567, -.2345678, .3456789] });
  for (const axis of [0, 1, 2] as const) for (const sign of [-1, 1]) for (const distance of [-.375, 2.125]) {
    const ctx = context(doc, axis, 2, sign), p = resolveNativeOffsetFace(ctx), out = candidate(ctx, p, distance); validateNativeOffsetResult(ctx, out, p, distance);
  }
});

test('actual Offset target: deferred Model mass is resolved from its own provider', () => {
  deferMasses(true);
  try {
    const doc = rectanglePart(17.123456, 9.234567, 4.345678), ctx = context(doc, 2, 1), p = resolveNativeOffsetFace(ctx), out = candidate(ctx, p, 1.234);
    const evaluated = evaluateDoc(out, 0); assert.ok(evaluated.ok, JSON.stringify(evaluated)); const key = bodyKeyFor(out.nodes, out.nodes.length - 1), body = evaluated.bodies.find(b => b.key === key)!;
    assert.ok(body.massRef !== undefined); assert.equal(body.volume, null);
    validateNativeOffsetResult(ctx, out, p, 1.234);
  } finally { deferMasses(false); }
});

test('actual Offset target: source, footprint, Boolean operands and outputs remain bound', () => {
  const doc = fixture(2), ctx = context(doc, 2, 3), p = resolveNativeOffsetFace(ctx), distance = 2, out = candidate(ctx, p, distance), before = structuredClone(doc);
  const changedSource = structuredClone(ctx); changedSource.doc.parameters.extra = 1;
  assert.throws(() => validateNativeOffsetResult(changedSource, out, p, distance), e => isRefusal(e, 'FACE_DISTANCE'));
  const changedSketch = structuredClone(out), sketch = changedSketch.nodes[doc.nodes.length]; if (sketch.kind !== 'sketch' || sketch.profile !== 'loop') throw Error('Expected loop'); sketch.segments[0].start[0] = 99;
  const changedOperation = structuredClone(out), operation = changedOperation.nodes.at(-1); if (operation?.kind !== 'union') throw Error('Expected union'); operation.left = { node: 5, side: 'solid' };
  const missingOutput = structuredClone(out); missingOutput.outputs = { b5: { node: 5, side: 'solid' } };
  for (const changed of [changedSketch, changedOperation, missingOutput]) assert.throws(() => validateNativeOffsetResult(ctx, changed, p, distance), e => isRefusal(e, 'FACE_DISTANCE'));
  validateNativeOffsetResult(ctx, out, p, distance);
  const cachedMutation = structuredClone(out); cachedMutation.parameters.extra = 2;
  assert.throws(() => validateNativeOffsetResult(ctx, cachedMutation, p, distance), e => isRefusal(e, 'FACE_DISTANCE'));
  assert.deepEqual(doc, before);
});


for (const axis of [0, 1] as const) test(`actual Offset target: ordinary axis${axis} circle without witness binds complete cap supports`, () => {
  const doc = fixture(axis, false), ctx = context(doc, axis, 3), p = resolveNativeOffsetFace(ctx), before = structuredClone(doc);
  const out = candidate(ctx, p, 2); validateNativeOffsetResult(ctx, out, p, 2);
  assert.deepEqual(doc, before);
});
