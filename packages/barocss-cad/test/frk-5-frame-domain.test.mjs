import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, brepMassProperties, evaluateSurface, surfaceDomain } from '../dist/index.js';
import { tessellateBrepWithParameters } from '../dist/brep-tessellate.js';

// A tilted plane cuts a hollow cylinder. Symmetry gives V = annulus area * (L-h),
// independently of the tessellation, knot coordinates, or the FRk5 notch oracles.
const specimen = () => evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{
  id: 'tube', kind: 'frame', points: [[0, 0, 0], [0, 0, 80]], segments: [[0, 1]],
  section: { kind: 'round-tube', diameter: 30, wall: 2 },
  trims: [{ member: 0, end: 'start', plane: { origin: [0, 0, 10], normal: [.25, 0, -1] } }],
}] }).outputs[0].brep;
const near = (got, want, relative, message) => assert.ok(Math.abs(got - want) <= relative * Math.max(1, Math.abs(want)), `${message}: ${got} vs ${want}`);

test('FRk5 frame integration is invariant to a cylinder surface knot-domain change', () => {
  const brep = specimen(), { mesh, parameters } = tessellateBrepWithParameters(brep, { segmentsPerQuarter: 8 });
  const face = mesh.faces.find(f => parameters.has(f.faceId) && !parameters.get(f.faceId).own);
  assert.ok(face, 'exercise a cylinder frame, not the native NURBS UV path');
  const fp = parameters.get(face.faceId), ids = Array.from(mesh.indices.slice(face.indexOffset, face.indexOffset + 3));
  // Put an otherwise arbitrary NURBS domain boundary at a triangle's interior.
  // That boundary is not a boundary of the arc-length evaluator used for integration.
  const lower = ids.reduce((sum, i) => sum + fp.uv[i - face.vertexOffset][0] / 3, 0);
  const changed = structuredClone(brep), target = changed.faces.find(f => f.id === face.faceId), original = target.surface;
  const { u: [a, b], v: [c, d] } = surfaceDomain(original);
  target.surface = { ...original, knotsU: original.knotsU.map(k => lower + (k - a) / (b - a)) };
  // The knot change is a reparameterization, not a geometry edit.
  for (const t of [.125, .375, .625, .875]) {
    const before = evaluateSurface(original, a + t * (b - a), c + .4 * (d - c));
    const after = evaluateSurface(target.surface, lower + t, c + .4 * (d - c));
    before.forEach((x, i) => near(after[i], x, 1e-12, 'same physical cylinder'));
  }
  const first = brepMassProperties(brep, 1), second = brepMassProperties(changed, 1);
  assert.equal(first.method, 'quadrature'); assert.equal(second.method, 'quadrature');
  near(first.volumeMM3, Math.PI * (15 ** 2 - 13 ** 2) * 70, 1e-9, 'independent tilted-annulus volume control');
  near(second.volumeMM3, first.volumeMM3, 1e-12, 'knot coordinates cannot change physical volume');
  // No change to the FRk5 notch comparison tolerances is made by this regression.
});
