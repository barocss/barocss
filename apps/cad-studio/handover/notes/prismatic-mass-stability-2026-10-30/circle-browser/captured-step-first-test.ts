import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportStep, type Brep } from '@barocss/cad';
import { emptyDoc, withNode } from '../src/engine/doc';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { isRefusal } from '../src/engine/refusal';
import { resolveNativeOffsetFace, validateNativeOffsetDistance } from '../src/app/nativeOffsetFace';
import type { Ctx } from '../src/app/commands';

// Exact native coefficients captured from Chrome at f9c17c1461ad7814f89d6fefef0e358aac473596.
// Public seed: cylinder r3/h5.00009, translated by [.1234567,-.2345678,.3456789].
function captured(): Brep {
  return JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/offset-circle-chrome.json'), 'utf8')) as Brep;
}
function context(brep: Brep, sign: number): Ctx {
  const doc = withNode(emptyDoc(), { kind: 'import', name: 'chrome-native-circle.step', step: exportStep(brep) });
  const view = evaluateDoc(doc, 0); assert.ok(view.ok, JSON.stringify(view));
  const face = view.bodies[0].mesh.faces.findIndex(f => f.kind === 'plane' && f.normal[2] === sign); assert.ok(face >= 0);
  return { doc, bodies: view.bodies, selection: { faces: [{ body: 0, face }], bodies: [], edges: [] } };
}
function halfWidths(brep: Brep): [number, number] {
  const cap = brep.faces.find(f => f.surface.kind === 'surface' && f.surface.degreeU === 1 && f.surface.degreeV === 1)!;
  const points = cap.surface.controlPoints.flat();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return [(x1 - x0) / 2, (y1 - y0) / 2];
}

for (const sign of [-1, 1]) test(`native Offset circle: captured Chrome unequal cap half-widths retain signed cap ${sign}`, () => {
  const brep = captured(); assert.deepEqual(halfWidths(brep), [3, 3.0000000000000004]);
  {
    const ctx = context(brep, sign), before = structuredClone(ctx.doc), selection = structuredClone(ctx.selection);
    const widths = halfWidths(partBreps(ctx.doc)[0].brep); assert.notEqual(widths[0], widths[1]);
    const profile = resolveNativeOffsetFace(ctx); assert.equal(profile.kind, 'circle'); assert.equal(profile.sign, sign);
    validateNativeOffsetDistance(profile, 2); validateNativeOffsetDistance(profile, -.001);
    assert.deepEqual(ctx.doc, before); assert.deepEqual(ctx.selection, selection);
  }
});

test('native Offset circle: a captured native ellipse still fails complete circular quotient authority', () => {
  const brep = captured();
  // Preserve consistent native incidence while stretching every tangent pole and vertex.
  for (const vertex of brep.vertices) vertex.point[1] *= 1.01;
  for (const edge of brep.edges) for (const p of edge.curve.controlPoints) p[1] *= 1.01;
  for (const face of brep.faces) for (const row of face.surface.controlPoints) for (const p of row) p[1] *= 1.01;
  const ctx = context(brep, 1), before = structuredClone(ctx.doc);
  assert.throws(() => resolveNativeOffsetFace(ctx), e => isRefusal(e, 'VALUE') && /complete native circular quotient/.test(e.message));
  assert.deepEqual(ctx.doc, before);
});
