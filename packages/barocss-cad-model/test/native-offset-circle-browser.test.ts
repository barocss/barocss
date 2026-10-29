import test from 'node:test';
import assert from 'node:assert/strict';
import { exportStep, type Brep } from '@barocss/cad';
import { cylinderPart, emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { isRefusal } from '../src/engine/refusal';
import { resolveNativeOffsetFace, validateNativeOffsetDistance } from '../src/app/nativeOffsetFace';
import type { Ctx } from '../src/app/commands';

// Chrome exposed an equality-only bounding-span rejection. A public authored Node
// fixture below produces the same unequal-span condition without a private geometry seam.
function translated(): StudioDoc {
  return withNode(cylinderPart(.1, 5.00009), { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [.1, .2, .3456789] });
}
function context(doc: StudioDoc, sign: number): Ctx {
  const view = evaluateDoc(doc, 0); assert.ok(view.ok, JSON.stringify(view));
  const face = view.bodies[0].mesh.faces.findIndex(f => f.kind === 'plane' && f.normal[2] === sign); assert.ok(face >= 0);
  return { doc, bodies: view.bodies, selection: { faces: [{ body: 0, face }], bodies: [], edges: [] } };
}
function halfWidths(brep: Brep): [number, number] {
  const cap = brep.faces.find(f => f.surface.kind === 'surface' && f.surface.degreeU === 1 && f.surface.degreeV === 1)!;
  assert.equal(cap.surface.kind, 'surface'); if (cap.surface.kind !== 'surface') throw new Error('Expected NURBS cap');
  const points = cap.surface.controlPoints.flat();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return [(x1 - x0) / 2, (y1 - y0) / 2];
}

for (const sign of [-1, 1]) test(`native Offset circle: authored unequal cap half-widths retain signed cap ${sign}`, () => {
  const doc = translated(), widths = halfWidths(partBreps(doc)[0].brep); assert.notEqual(widths[0], widths[1]);
  const ctx = context(doc, sign), before = structuredClone(ctx.doc), selection = structuredClone(ctx.selection);
  const profile = resolveNativeOffsetFace(ctx); assert.equal(profile.kind, 'circle'); assert.equal(profile.sign, sign);
  validateNativeOffsetDistance(profile, 2); validateNativeOffsetDistance(profile, -.001);
  assert.deepEqual(ctx.doc, before); assert.deepEqual(ctx.selection, selection);
});

test('native Offset circle: a native ellipse still fails complete circular quotient authority', () => {
  const brep = structuredClone(partBreps(translated())[0].brep);
  // Preserve consistent native incidence while stretching every tangent pole and vertex.
  for (const vertex of brep.vertices) vertex.point[1] *= 1.01;
  for (const edge of brep.edges) for (const p of edge.curve.controlPoints) p[1] *= 1.01;
  for (const face of brep.faces) {
    if (face.surface.kind !== 'surface') throw new Error('Expected NURBS surface');
    for (const row of face.surface.controlPoints) for (const p of row) p[1] *= 1.01;
  }
  const doc = withNode(emptyDoc(), { kind: 'import', name: 'native-ellipse.step', step: exportStep(brep) });
  const ctx = context(doc, 1), before = structuredClone(ctx.doc);
  assert.throws(() => resolveNativeOffsetFace(ctx), e => isRefusal(e, 'VALUE') && /complete native circular quotient/.test(e.message));
  assert.deepEqual(ctx.doc, before);
});
