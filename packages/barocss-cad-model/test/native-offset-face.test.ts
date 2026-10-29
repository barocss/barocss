import test from 'node:test';
import assert from 'node:assert/strict';
import { exportStep } from '@barocss/cad';
import { cylinderPart, emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { resolveNativeOffsetFace, validateNativeOffsetDistance } from '../src/app/nativeOffsetFace';
import { isRefusal } from '../src/engine/refusal';
import type { Ctx } from '../src/app/commands';
function context(doc: StudioDoc, name = 'n1.top'): Ctx {
  const result = evaluateDoc(doc, 1); assert.ok(result.ok, JSON.stringify(result));
  const face = result.bodies[0].mesh.faces.findIndex(f => f.name === name); assert.ok(face >= 0, name);
  return { doc, bodies: result.bodies, selection: { faces: [{ body: 0, face }], edges: [], bodies: [] } };
}
const rejected = (run: () => unknown, code: 'VALUE' | 'BAD_REFERENCE' | 'FACE_DISTANCE') => assert.throws(run, e => isRefusal(e, code));

test('native Offset face: six fractional box caps use signed cardinal native coordinates and owned loops', () => {
  const doc = rectanglePart(20.00003, 10, 5), ctx = context(doc), before = structuredClone(doc);
  for (let face = 0; face < ctx.bodies[0].mesh.faces.length; face++) {
    const p = resolveNativeOffsetFace({ ...ctx, selection: { ...ctx.selection, faces: [{ body: 0, face }] } });
    assert.equal(p.kind, 'polygon'); assert.ok(p.thickness > 0); assert.equal(p.sketch.profile, 'loop');
    assert.equal(p.sketch.plane!.origin[p.axis], p.coordinate); assert.equal(p.sketch.plane!.normal[p.axis], p.sign);
    assert.deepEqual(p.sketch.on, { node: 1, side: 'solid' });
    validateNativeOffsetDistance(p, 2); validateNativeOffsetDistance(p, -1);
    rejected(() => validateNativeOffsetDistance(p, -p.thickness), 'FACE_DISTANCE');
    rejected(() => validateNativeOffsetDistance(p, -p.thickness - 1), 'FACE_DISTANCE');
  }
  const top = resolveNativeOffsetFace(ctx); if (top.sketch.profile !== 'loop') throw new Error('Expected loop');
  assert.ok(top.sketch.segments.some(s => s.start[0] === 20.00003));
  const topLoop = top.sketch;
  assert.throws(() => { topLoop.segments[0].start[0] = 123; }, TypeError);
  assert.throws(() => { top.sketch.on!.node = 123; }, TypeError);
  assert.notEqual(resolveNativeOffsetFace(ctx).sketch, top.sketch); assert.deepEqual(doc, before);
});

test('native Offset face: translated plane and triangle footprint preserve native fractions', () => {
  const doc = withNode(rectanglePart(20.00003, 10, 5), { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [.1234567, -.2345678, .3456789] });
  const p = resolveNativeOffsetFace(context(doc)); assert.equal(p.coordinate, 5.3456789); assert.equal(p.sketch.plane!.origin[2], 5.3456789); validateNativeOffsetDistance(p, 2);
  const triangle = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [.125, .25] }, { kind: 'line', start: [7.75, .25] }, { kind: 'line', start: [.125, 4.625] }] }), { kind: 'extrude', sketch: 0, height: 3.375 });
  const t = resolveNativeOffsetFace(context(triangle)); assert.equal(t.kind, 'polygon'); if (t.sketch.profile !== 'loop') throw new Error('Expected loop'); assert.equal(t.sketch.segments.length, 3); assert.equal(t.coordinate, 3.375);
});

test('native Offset face: integer native circle control survives without display fitting', () => {
  for (const name of ['n1.top', 'n1.bottom']) {
    const p = resolveNativeOffsetFace(context(cylinderPart(3, 5), name)); assert.equal(p.kind, 'circle');
    if (p.sketch.profile !== 'loop') throw new Error('Expected loop');
    assert.deepEqual(p.sketch.segments, [{ kind: 'arc', start: [3, 0], center: [0, 0], direction: 'ccw' }]);
    validateNativeOffsetDistance(p, 2); validateNativeOffsetDistance(p, -2);
  }
});

test('native Offset face: unsupported drafted/holed caps and ambiguous picks refuse atomically', () => {
  const base = rectanglePart(20, 10, 5), draft = { ...base, nodes: base.nodes.map((n, i) => i === 1 ? { ...n, draft: 5 } : n) } as StudioDoc;
  rejected(() => resolveNativeOffsetFace(context(draft)), 'VALUE');
  const hole = withNode(rectanglePart(20, 10, 5), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [8, 5], radius: 1 }); rejected(() => resolveNativeOffsetFace(context(hole)), 'VALUE');
  const doc = rectanglePart(20, 10, 5), ctx = context(doc), before = structuredClone(doc);
  const ambiguous = structuredClone(ctx); ambiguous.bodies.push(structuredClone(ambiguous.bodies[0])); rejected(() => resolveNativeOffsetFace(ambiguous), 'BAD_REFERENCE');
  const merged = structuredClone(ctx); merged.bodies[0].mesh.faces[merged.selection.faces[0].face].name += '+other.top'; rejected(() => resolveNativeOffsetFace(merged), 'BAD_REFERENCE');
  const missing = structuredClone(ctx); missing.bodies[0].mesh.faces[missing.selection.faces[0].face].id = 'missing'; rejected(() => resolveNativeOffsetFace(missing), 'BAD_REFERENCE');
  const faceted = structuredClone(ctx); faceted.bodies[0].mesh.faces[faceted.selection.faces[0].face].facet = true; rejected(() => resolveNativeOffsetFace(faceted), 'BAD_REFERENCE'); assert.deepEqual(doc, before);
});

test('native Offset face: mutated current source invalidates the cache and old display consistency', () => {
  const doc = rectanglePart(20, 10, 5), old = context(doc); assert.equal(resolveNativeOffsetFace(old).coordinate, 5);
  const node = doc.nodes[1]; if (node.kind !== 'extrude') throw new Error('Expected extrusion'); node.height = 6;
  rejected(() => resolveNativeOffsetFace(old), 'BAD_REFERENCE'); assert.equal(resolveNativeOffsetFace(context(doc)).coordinate, 6);
});

test('native Offset face: distance refuses zero, nonfinite, rounded no-move and inverted caps', () => {
  const p = resolveNativeOffsetFace(context(rectanglePart(20.00003, 10, 5)));
  for (const d of [0, -0, NaN, Infinity, -Infinity, Number.MIN_VALUE, -Number.MIN_VALUE, -5, -6, 10000]) rejected(() => validateNativeOffsetDistance(p, d), 'FACE_DISTANCE');
  for (const d of [.125, -.125, 2]) validateNativeOffsetDistance(p, d);
});

test('native Offset face: a mutated owned profile cannot reuse its earlier geometric proof', () => {
  const ctx = context(cylinderPart(3, 5));
  const coordinate = resolveNativeOffsetFace(ctx);
  assert.throws(() => Object.defineProperty(coordinate, 'coordinate', { get: () => 123 }), TypeError);
  const sketch = resolveNativeOffsetFace(ctx); if (sketch.sketch.profile !== 'loop') throw new Error('Expected loop');
  const sketchLoop = sketch.sketch;
  assert.throws(() => { sketchLoop.segments[0].start[0] = 4; }, TypeError);
  validateNativeOffsetDistance(sketch, 2);
  const clone = structuredClone(resolveNativeOffsetFace(ctx)); rejected(() => validateNativeOffsetDistance(clone, 2), 'FACE_DISTANCE');
  validateNativeOffsetDistance(resolveNativeOffsetFace(ctx), 2);
});

test('native Offset face: cardinally rotated native circle caps retain the actual signed frame', () => {
  for (const axis of ['x', 'y'] as const) {
    const doc = withNode(cylinderPart(3, 5), { kind: 'rotate', parent: { node: 1, side: 'solid' }, axis, angle: 90 });
    for (const name of ['n1.top', 'n1.bottom']) {
      const p = resolveNativeOffsetFace(context(doc, name)); assert.equal(p.kind, 'circle'); assert.notEqual(p.axis, 2);
      validateNativeOffsetDistance(p, 2); validateNativeOffsetDistance(p, -2);
    }
  }
});


test('native Offset face: cached display consistency owns its records and rejects a tampered caller clone', () => {
  const ctx = context(rectanglePart(20, 10, 5)); resolveNativeOffsetFace(ctx);
  const tampered = { ...ctx, bodies: structuredClone(ctx.bodies) };
  tampered.bodies[0].mesh.faces[tampered.selection.faces[0].face].centroid[0] += 1;
  rejected(() => resolveNativeOffsetFace(tampered), 'BAD_REFERENCE');
  validateNativeOffsetDistance(resolveNativeOffsetFace(ctx), 2);
});


test('native Offset face: mixed selections cannot bypass command availability', () => {
  const ctx = context(rectanglePart(20, 10, 5));
  for (const selection of [
    { ...ctx.selection, edges: [{ body: 0, edge: 0 }] },
    { ...ctx.selection, bodies: [0] },
    { ...ctx.selection, sketches: [0] },
    { ...ctx.selection, vertices: [{ body: 0, at: [0, 0, 0] as [number, number, number] }] },
  ]) rejected(() => resolveNativeOffsetFace({ ...ctx, selection }), 'BAD_REFERENCE');
  rejected(() => resolveNativeOffsetFace({ ...ctx, direct: ['curve'] }), 'BAD_REFERENCE');
});

test('native Offset face: full native curved coefficients reject a noncircular ruled cap with unchanged endpoints', () => {
  const original = partBreps(cylinderPart(3, 5))[0].brep, changed = structuredClone(original);
  // Keep endpoints, weights, all cap bounds and native incidence. Move the interior tangent pole
  // in both arc edges and ruled supports, so endpoint-only and bounding-box circle fits would pass.
  for (const edge of changed.edges) for (const p of edge.curve.controlPoints) if (p[0] === 3 && p[1] > 2.9) p[0] = 2.5;
  for (const face of changed.faces) if (face.surface.kind === 'surface' && face.surface.degreeU === 2) for (const row of face.surface.controlPoints) for (const p of row) if (p[0] === 3 && p[1] > 2.9) p[0] = 2.5;
  const doc = withNode(emptyDoc(), { kind: 'import', name: 'noncircular.step', step: exportStep(changed) });
  const evaluated = evaluateDoc(doc, 1); assert.ok(evaluated.ok, JSON.stringify(evaluated));
  const face = evaluated.bodies[0].mesh.faces.findIndex(f => f.kind === 'plane' && f.normal[2] > .99); assert.ok(face >= 0);
  const ctx: Ctx = { doc, bodies: evaluated.bodies, selection: { faces: [{ body: 0, face }], edges: [], bodies: [] } };
  const before = structuredClone(doc);
  assert.throws(() => resolveNativeOffsetFace(ctx), e => isRefusal(e, 'VALUE') && /complete native circular quotient/.test(e.message));
  assert.deepEqual(doc, before);
});

test('native Offset face: positive represented near-full residue must also pass native strict target validity', () => {
  const doc = withNode(rectanglePart(20.00003, 10.00007, 5.00009), { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [.1234567, -.2345678, .3456789] });
  const ctx = context(doc), p = resolveNativeOffsetFace(ctx), distance = -(p.coordinate - p.opposite), next = p.coordinate + p.sign * distance, before = structuredClone(doc);
  assert.ok(next > p.opposite); assert.equal(next - p.opposite, 2.220446049250313e-16);
  assert.throws(() => validateNativeOffsetDistance(p, distance), e => isRefusal(e, 'FACE_DISTANCE') && /native strict validity/.test(e.message));
  assert.deepEqual(doc, before);
  validateNativeOffsetDistance(p, distance + .001);
});

test('native Offset face: curved strict-valid near-full residue also needs a representable mass interval', () => {
  const doc = withNode(cylinderPart(3, 5.00009), { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [.1234567, -.2345678, .3456789] });
  const ctx = context(doc), p = resolveNativeOffsetFace(ctx), distance = -(p.coordinate - p.opposite), before = structuredClone(doc);
  assert.ok(p.coordinate + distance > p.opposite);
  assert.throws(() => validateNativeOffsetDistance(p, distance), e => isRefusal(e, 'FACE_DISTANCE') && /mass centroid/.test(e.message));
  assert.deepEqual(doc, before);
  // The shared current-source proof keeps only its last target result; valid retry then refusal works.
  validateNativeOffsetDistance(resolveNativeOffsetFace(ctx), distance + .001);
  rejected(() => validateNativeOffsetDistance(resolveNativeOffsetFace(ctx), distance), 'FACE_DISTANCE');
  validateNativeOffsetDistance(resolveNativeOffsetFace(ctx), distance + .001);
});

test('native Offset face: ordinary small positive remaining intervals pass on every signed cardinal cap', () => {
  const offset: [number, number, number] = [.1234567, -.2345678, .3456789];
  const documents = [withNode(rectanglePart(20.00003, 10.00007, 5.00009), { kind: 'translate', parent: { node: 1, side: 'solid' }, offset })];
  for (const axis of ['x', 'y', 'z'] as const) {
    const rotated = withNode(cylinderPart(3, 5.00009), { kind: 'rotate', parent: { node: 1, side: 'solid' }, axis, angle: axis === 'z' ? 0 : 90 });
    documents.push(withNode(rotated, { kind: 'translate', parent: { node: 2, side: 'solid' }, offset }));
  }
  let controls = 0;
  for (const doc of documents) {
    const evaluated = evaluateDoc(doc, 1); assert.ok(evaluated.ok, JSON.stringify(evaluated)); const before = structuredClone(doc);
    for (let face = 0; face < evaluated.bodies[0].mesh.faces.length; face++) {
      if (evaluated.bodies[0].mesh.faces[face].kind !== 'plane') continue;
      const ctx: Ctx = { doc, bodies: evaluated.bodies, selection: { faces: [{ body: 0, face }], edges: [], bodies: [] } }, p = resolveNativeOffsetFace(ctx);
      validateNativeOffsetDistance(p, -Math.abs(p.coordinate - p.opposite) + .001); controls++;
    }
    assert.deepEqual(doc, before);
  }
  assert.equal(controls, 12);
});

test('native Offset face: ordinary negative-cap outward offsets keep direct native interval endpoints', () => {
  const doc = withNode(rectanglePart(20.00003, 10.00007, 5.00009), { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [.1234567, -.2345678, .3456789] });
  const evaluated = evaluateDoc(doc, 1); assert.ok(evaluated.ok, JSON.stringify(evaluated)); const before = structuredClone(doc);
  for (const axis of [0, 1] as const) {
    const face = evaluated.bodies[0].mesh.faces.findIndex(f => f.normal[axis] === -1), ctx: Ctx = { doc, bodies: evaluated.bodies, selection: { faces: [{ body: 0, face }], edges: [], bodies: [] } };
    const p = resolveNativeOffsetFace(ctx), next = p.coordinate - 2.125, lo = Math.min(next, p.opposite), hi = Math.max(next, p.opposite);
    assert.notEqual(lo + (hi - lo), hi, 'This ordinary interval must exercise the extra-reassociation regression');
    validateNativeOffsetDistance(p, 2.125);
    validateNativeOffsetDistance(resolveNativeOffsetFace(ctx), 2.125);
  }
  assert.deepEqual(doc, before);
});
