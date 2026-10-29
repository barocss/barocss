import test from 'node:test';
import assert from 'node:assert/strict';
import { brepMassProperties, checkBrep, type Brep } from '@barocss/cad';
import { offsetFaceCommand } from '../src/app/profileCommands';
import { editCommand } from '../src/app/editCommand';
import type { Ctx } from '../src/app/commands';
import { cylinderPart, emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { isRefusal } from '../src/engine/refusal';

function near(a: number, b: number, tolerance = 1e-7): void { assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`); }
function bodyOf(doc: StudioDoc): Brep { const native = partBreps(doc); assert.equal(native.length, 1); return native[0].brep; }
function context(doc: StudioDoc, axis = 2, sign = 1): Ctx {
  const result = evaluateDoc(doc, 1); assert.ok(result.ok, result.ok ? '' : result.error.detail); assert.equal(result.bodies.length, 1);
  const face = result.bodies[0].mesh.faces.findIndex(f => f.kind === 'plane' && f.normal.every((n, k) => Math.abs(n - (k === axis ? sign : 0)) < 1e-8));
  assert.ok(face >= 0); return { doc, bodies: result.bodies, selection: { faces: [{ body: 0, face }], edges: [], bodies: [] } };
}
function bounds(brep: Brep): { min: number[]; max: number[] } {
  return { min: [0, 1, 2].map(k => Math.min(...brep.vertices.map(v => v.point[k]))), max: [0, 1, 2].map(k => Math.max(...brep.vertices.map(v => v.point[k]))) };
}
function closed(brep: Brep): void {
  assert.equal(brep.bodies.length, 1, 'One Model body must contain one native solid'); assert.equal(brep.shells.length, 1); assert.ok(brep.shells[0].closed);
  const check = checkBrep(brep, { strict: true }); assert.equal(check.valid, true, JSON.stringify(check));
}
function freezeDoc(doc: StudioDoc): void {
  function freeze(value: unknown): void { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } }
  freeze(doc);
}
// Independent exact binary64 endpoint arithmetic. No production geometry predicate supplies the oracle.
type Q = { n: bigint; d: bigint };
function reduced(n: bigint, d: bigint): Q {
  if (n === 0n) return { n: 0n, d: 1n };
  let a = n < 0n ? -n : n, b = d;
  while (b !== 0n) { const remainder = a % b; a = b; b = remainder; }
  return { n: n / a, d: d / a };
}
function q(value: number): Q {
  assert.ok(Number.isFinite(value)); const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, value);
  const bits = bytes.getBigUint64(0), exponent = Number((bits >> 52n) & 2047n), mantissa = (bits & ((1n << 52n) - 1n)) | (exponent === 0 ? 0n : 1n << 52n);
  const n = (bits >> 63n ? -1n : 1n) * mantissa, power = exponent === 0 ? -1074 : exponent - 1075;
  return power < 0 ? reduced(n, 1n << BigInt(-power)) : reduced(n << BigInt(power), 1n);
}
const add = (a: Q, b: Q): Q => reduced(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Q, b: Q): Q => reduced(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q): Q => reduced(a.n * b.n, a.d * b.d);
const numberOf = (a: Q): number => Number(a.n) / Number(a.d);
function boxOracle(input: { min: number[]; max: number[] }, axis: number, sign: number, distance: number): { min: number[]; max: number[]; volume: number; volumeFraction: { numerator: string; denominator: string }; centroid: number[] } {
  const min = input.min.map(q), max = input.max.map(q), boundary = sign === 1 ? max : min;
  boundary[axis] = add(boundary[axis], q(sign * distance));
  const widths = min.map((lo, k) => sub(max[k], lo)), volume = widths.reduce(mul, q(1));
  return { min: min.map(numberOf), max: max.map(numberOf), volume: numberOf(volume), volumeFraction: { numerator: String(volume.n), denominator: String(volume.d) }, centroid: min.map((lo, k) => numberOf(mul(add(lo, max[k]), q(0.5)))) };
}
function assertBoxNative(doc: StudioDoc, target: ReturnType<typeof boxOracle>, axis: number, oldCoordinate: number): void {
  const brep = bodyOf(doc); closed(brep); const actual = bounds(brep), mass = brepMassProperties(brep, 1);
  actual.min.forEach((n, k) => near(n, target.min[k])); actual.max.forEach((n, k) => near(n, target.max[k])); near(mass.volume, target.volume); mass.centroid.forEach((n, k) => near(n, target.centroid[k]));
  for (const face of brep.faces) {
    assert.equal(face.surface.kind, 'surface'); if (face.surface.kind !== 'surface') continue;
    const poles = face.surface.controlPoints.flat();
    assert.ok([0, 1, 2].some(k => poles.every(p => Math.abs(p[k] - target.min[k]) <= 1e-7) || poles.every(p => Math.abs(p[k] - target.max[k]) <= 1e-7)), 'Every native plane must lie on an intended box support');
    assert.ok(!poles.every(p => Math.abs(p[axis] - oldCoordinate) <= 1e-7), 'The old cap must not remain exposed as a ledge');
  }
}
const translated = (): StudioDoc => withNode(rectanglePart(20.00003, 10.00007, 5.00009), { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [0.1234567, -0.2345678, 0.3456789] });

for (const axis of [0, 1, 2]) for (const sign of [-1, 1]) for (const distance of [-1.25, 2.125]) {
  test(`Offset native box cap axis${axis}/sign${sign}/distance${distance}: exact footprint, plane and one closed solid`, t => {
    const doc = translated(), before = structuredClone(doc), ctx = context(doc, axis, sign), initial = bounds(bodyOf(doc)), old = (sign === 1 ? initial.max : initial.min)[axis];
    freezeDoc(doc); assert.equal(offsetFaceCommand.available(ctx).ok, true);
    const handles = offsetFaceCommand.handles!(ctx, { d: distance }); assert.equal(handles.length, 1); handles[0].dir.forEach((n, k) => near(n, k === axis ? sign : 0)); near(handles[0].at[axis], old);
    const out = offsetFaceCommand.build!(ctx, { d: distance }); assert.deepEqual(doc, before); assert.equal(out.nodes.length, doc.nodes.length + 3);
    const sketch = out.nodes[doc.nodes.length]; assert.equal(sketch.kind, 'sketch'); if (sketch.kind !== 'sketch') return;
    assert.deepEqual(sketch.on, ctx.bodies[0].ref); assert.ok(sketch.plane); near(sketch.plane.origin[axis], old);
    const target = boxOracle(initial, axis, sign, distance); assertBoxNative(out, target, axis, old);
    const native = bodyOf(out), actualBounds = bounds(native), mass = brepMassProperties(native, 1);
    t.diagnostic(JSON.stringify({ axis, sign, distance, currentRef: sketch.on, nativeOrigin: sketch.plane.origin, originalBounds: initial, target,
      actual: { bounds: actualBounds, volume: mass.volume, centroid: mass.centroid, solids: native.bodies.length, shells: native.shells.length, vertices: native.vertices.length, edges: native.edges.length, faces: native.faces.length },
      differences: { volume: mass.volume - target.volume, centroid: mass.centroid.map((value, k) => value - target.centroid[k]), min: actualBounds.min.map((value, k) => value - target.min[k]), max: actualBounds.max.map((value, k) => value - target.max[k]) } }));
  });
}

test('Offset native face: changed display data refuses stale context before authoring', () => {
  const doc = rectanglePart(20.00003, 10, 5), ctx = context(doc), before = structuredClone(doc);
  ctx.bodies = structuredClone(ctx.bodies); ctx.bodies[0].mesh.positions.fill(12345);
  ctx.bodies[0].mesh.bounds = { min: [-9000, -9000, -9000], max: [9000, 9000, 9000] };
  assert.throws(() => offsetFaceCommand.build!(ctx, { d: 2 }), error => isRefusal(error, 'BAD_REFERENCE') && /picked display no longer agrees/.test(error.message));
  assert.deepEqual(doc, before);
});

test('Offset native face: an existing polygon cap keeps its authored fractional outline', () => {
  const points: [number, number][] = [[0.1234567, -0.2345678], [7.1234867, -0.2345678], [9.1234867, 3.7654322], [2.1234567, 6.7654322]];
  const doc = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'polygon', points }), { kind: 'extrude', sketch: 0, height: 5 }), ctx = context(doc), before = structuredClone(doc);
  const out = offsetFaceCommand.build!(ctx, { d: 2 }), brep = bodyOf(out); closed(brep); assert.deepEqual(doc, before);
  let twice = 0, mx = 0, my = 0;
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length], cross = a[0] * b[1] - b[0] * a[1]; twice += cross; mx += (a[0] + b[0]) * cross; my += (a[1] + b[1]) * cross; }
  const mass = brepMassProperties(brep, 1); near(mass.volume, twice / 2 * 7); near(mass.centroid[0], mx / (3 * twice)); near(mass.centroid[1], my / (3 * twice)); near(mass.centroid[2], 3.5);
  for (const vertex of brep.vertices) assert.ok(points.some(p => Math.abs(p[0] - vertex.point[0]) <= 1e-7 && Math.abs(p[1] - vertex.point[1]) <= 1e-7));
});

test('Offset native cylinder cap: integer circle support remains a native one-solid control', () => {
  for (const sign of [-1, 1]) for (const distance of [-1.25, 2]) {
    const doc = cylinderPart(3, 5), ctx = context(doc, 2, sign), out = offsetFaceCommand.build!(ctx, { d: distance }), brep = bodyOf(out); closed(brep);
    const expected = boxOracle({ min: [-3, -3, 0], max: [3, 3, 5] }, 2, sign, distance), mass = brepMassProperties(brep, 1), actual = bounds(brep);
    near(mass.volume, Math.PI * 9 * (5 + distance)); near(mass.centroid[2], expected.centroid[2]); near(actual.min[2], expected.min[2]); near(actual.max[2], expected.max[2]);
    const sketch = out.nodes[doc.nodes.length]; assert.equal(sketch.kind, 'sketch'); if (sketch.kind === 'sketch') assert.ok(sketch.profile === 'circle' || sketch.profile === 'loop');
  }
});

test('Offset native face: distance and unsupported draft refusals are atomic, then a valid retry works', () => {
  const doc = translated(), ctx = context(doc), before = structuredClone(doc), selection = structuredClone(ctx.selection); freezeDoc(doc);
  for (const d of [0, NaN, Infinity, -Infinity, -6]) assert.throws(() => offsetFaceCommand.build!(ctx, { d }), e => isRefusal(e, 'FACE_DISTANCE'));
  assert.deepEqual(doc, before); assert.deepEqual(ctx.selection, selection);
  const exactCollapse = context(rectanglePart(20, 10, 5));
  assert.throws(() => offsetFaceCommand.build!(exactCollapse, { d: -5 }), e => isRefusal(e, 'FACE_DISTANCE'));
  const draft = rectanglePart(20, 10, 5); draft.nodes[1] = { ...draft.nodes[1], draft: 5 } as typeof draft.nodes[number]; const drafted = context(draft), draftBefore = structuredClone(draft); freezeDoc(draft);
  assert.throws(() => offsetFaceCommand.build!(drafted, { d: 2 }), e => isRefusal(e, 'VALUE')); assert.deepEqual(offsetFaceCommand.handles!(drafted, { d: 2 }), []); assert.deepEqual(draft, draftBefore);
  assertBoxNative(offsetFaceCommand.build!(ctx, { d: 2 }), boxOracle(bounds(bodyOf(doc)), 2, 1, 2), 2, bounds(bodyOf(doc)).max[2]);
});

test('Offset native face: malformed, ambiguous and stale selected identities refuse before publication', () => {
  const doc = translated(), valid = context(doc), before = structuredClone(doc);
  const contexts: Ctx[] = [
    { ...valid, selection: { faces: [], edges: [], bodies: [] } },
    { ...valid, selection: { ...valid.selection, faces: [valid.selection.faces[0], valid.selection.faces[0]] } },
    { ...valid, selection: { ...valid.selection, bodies: [0] } },
    { ...valid, selection: { ...valid.selection, vertices: [{ body: 0, at: [0, 0, 0] }] } },
    { ...valid, direct: ['mixed-direct'] },
    { ...valid, bodies: [{ ...valid.bodies[0], key: 'missing-native-body' }] },
    { ...valid, bodies: [{ ...valid.bodies[0], ref: { node: 999, side: 'solid' } }] },
  ];
  for (const ctx of contexts) { assert.throws(() => offsetFaceCommand.build!(ctx, { d: 2 }), e => isRefusal(e, 'VALUE') || isRefusal(e, 'BAD_REFERENCE')); assert.deepEqual(doc, before); }
  const merged = context(doc); merged.bodies = structuredClone(merged.bodies); merged.bodies[0].mesh.faces[merged.selection.faces[0].face].name += '+ambiguous';
  assert.throws(() => offsetFaceCommand.build!(merged, { d: 2 }), e => isRefusal(e, 'VALUE') || isRefusal(e, 'BAD_REFERENCE')); assert.deepEqual(doc, before);
});

test('Offset native face: Save/Open keeps native cap sketch and reediting the new Extrude preserves the footprint', async () => {
  const doc = translated(), initial = bounds(bodyOf(doc)), ctx = context(doc), out = offsetFaceCommand.build!(ctx, { d: 2 });
  const bytes = encodeStudioFile(out), read = await readStudioFile(bytes); assert.ok(!('error' in read)); assert.deepEqual(read.doc, out); assert.deepEqual(encodeStudioFile(read.doc), bytes);
  assertBoxNative(read.doc, boxOracle(initial, 2, 1, 2), 2, initial.max[2]);
  const extrudeIndex = doc.nodes.length + 1, edit = editCommand(extrudeIndex, read.doc.nodes); assert.ok(edit?.build && edit.defaults);
  const edited = edit.build(context(read.doc), { ...edit.defaults(context(read.doc)), h: 3 });
  const node = edited.nodes[extrudeIndex]; assert.equal(node.kind, 'extrude'); if (node.kind === 'extrude') near(Number(node.height), 3);
  assertBoxNative(edited, boxOracle(initial, 2, 1, 3), 2, initial.max[2]);
  const again = await readStudioFile(encodeStudioFile(edited)); assert.ok(!('error' in again)); assert.deepEqual(again.doc, edited);
});

test('Offset native face: a second current-cap edit retains one solid and the fractional footprint', () => {
  const doc = rectanglePart(20.00003, 10, 5), initial = bounds(bodyOf(doc)), one = offsetFaceCommand.build!(context(doc), { d: 2 }), before = structuredClone(one);
  const two = offsetFaceCommand.build!(context(one), { d: 1 }); assert.deepEqual(one, before); assertBoxNative(two, boxOracle(initial, 2, 1, 3), 2, initial.max[2]);
});

test('Offset native face: explicit new sketch selection ignores an unrelated newer sketch', () => {
  const doc = withNode(rectanglePart(20.00003, 10, 5), { kind: 'sketch', profile: 'circle', center: [100, 100], radius: 1 });
  const initial = bounds(bodyOf(doc)), ctx = context(doc), before = structuredClone(doc), out = offsetFaceCommand.build!(ctx, { d: 2 });
  assert.deepEqual(doc, before); assert.deepEqual(out.nodes[2], doc.nodes[2]); assertBoxNative(out, boxOracle(initial, 2, 1, 2), 2, initial.max[2]);
});

test('Offset native face: frozen factory proof becomes an owned mutable authored sketch', async () => {
  const doc = translated(), before = structuredClone(doc), out = offsetFaceCommand.build!(context(doc), { d: 2 }), sketch = out.nodes[doc.nodes.length];
  assert.equal(sketch.kind, 'sketch'); if (sketch.kind !== 'sketch') return;
  assert.ok(sketch.plane && sketch.on); assert.equal(Object.isFrozen(sketch.plane.origin), false); assert.equal(Object.isFrozen(sketch.on), false);
  const coordinate = sketch.plane.origin[2]; sketch.plane.origin[2] = coordinate + 0.125; near(sketch.plane.origin[2], coordinate + 0.125); sketch.plane.origin[2] = coordinate;
  if (sketch.profile === 'polygon') { const value = sketch.points[0][0]; assert.equal(Object.isFrozen(sketch.points[0]), false); sketch.points[0][0] = Number(value) + 0.125; near(Number(sketch.points[0][0]), Number(value) + 0.125); sketch.points[0][0] = value; }
  else if (sketch.profile === 'loop') { const value = sketch.segments[0].start[0]; assert.equal(Object.isFrozen(sketch.segments[0].start), false); sketch.segments[0].start[0] = Number(value) + 0.125; near(Number(sketch.segments[0].start[0]), Number(value) + 0.125); sketch.segments[0].start[0] = value; }
  assert.deepEqual(doc, before);
  const read = await readStudioFile(encodeStudioFile(out)); assert.ok(!('error' in read)); const opened = read.doc.nodes[doc.nodes.length];
  assert.equal(opened.kind, 'sketch'); if (opened.kind !== 'sketch') return;
  assert.ok(opened.plane); opened.plane.origin[2] += 0.25; near(opened.plane.origin[2], coordinate + 0.25); assert.deepEqual(doc, before); near(sketch.plane.origin[2], coordinate);
});

for (const kind of ['polygon', 'circle'] as const) {
  test(`Offset native ${kind}: translated near-full cut refuses atomically and a positive 0.001 interval retry remains valid`, t => {
    const base = kind === 'polygon' ? rectanglePart(20.00003, 10.00007, 5.00009) : cylinderPart(3, 5.00009);
    const doc = withNode(base, { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [0.1234567, -0.2345678, 0.3456789] });
    const ctx = context(doc), initial = bounds(bodyOf(doc)), coordinate = initial.max[2], opposite = initial.min[2], span = coordinate - opposite, distance = -span;
    const before = structuredClone(doc), selection = structuredClone(ctx.selection), exactGap = sub(add(q(coordinate), q(distance)), q(opposite)); freezeDoc(doc);
    assert.throws(() => offsetFaceCommand.build!(ctx, { d: distance }), error => isRefusal(error, 'FACE_DISTANCE'));
    assert.deepEqual(doc, before); assert.deepEqual(ctx.selection, selection);
    const retryDistance = 0.001 - span, out = offsetFaceCommand.build!(ctx, { d: retryDistance }), brep = bodyOf(out); closed(brep);
    const native = bounds(brep), stored = coordinate + retryDistance, mass = brepMassProperties(brep, 1), evaluated = evaluateDoc(out, 2); assert.ok(evaluated.ok);
    assert.ok(native.max[2] > native.min[2]); near(native.min[2], opposite); near(native.max[2], stored);
    assert.ok(mass.centroid[2] >= native.min[2] && mass.centroid[2] <= native.max[2]);
    assert.ok(evaluated.bodies[0].centroid); assert.ok(evaluated.bodies[0].centroid[2] >= native.min[2] && evaluated.bodies[0].centroid[2] <= native.max[2]);
    if (kind === 'polygon') assertBoxNative(out, boxOracle(initial, 2, 1, retryDistance), 2, coordinate);
    else { near(mass.volume, Math.PI * 9 * (stored - opposite)); near(mass.centroid[2], (stored + opposite) / 2); }
    assert.deepEqual(doc, before); assert.deepEqual(ctx.selection, selection);
    t.diagnostic(JSON.stringify({ kind, coordinate, opposite, distance, intendedGap: { numerator: String(exactGap.n), denominator: String(exactGap.d) }, storedGap: coordinate + distance - opposite,
      nearfull: 'FACE_DISTANCE atomic refusal', retryDistance, retryNative: { min: native.min, max: native.max, volume: mass.volume, centroid: mass.centroid, modelCentroid: evaluated.bodies[0].centroid } }));
  });
}
