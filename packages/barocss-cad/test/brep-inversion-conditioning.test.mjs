import test from 'node:test';
import assert from 'node:assert/strict';
import { importStep } from '../dist/index.js';
import { tessellateBrepWithParameters } from '../dist/brep/brep-tessellate.js';
import { surfaceDomain, surfaceEvaluator } from '../dist/core/math.js';
import { massTranslationSphereStep } from './brep-mass-translation-fixtures.mjs';
import { normalSheet } from './brep-mesh-normal-fixtures.mjs';

// Nine browser-produced weights differ by one binary64 ULP from the Node import.
// All control points, knots, edges, vertices and other weights stay as generated.
function browserWeightSphere(options) {
  const b = importStep(massTranslationSphereStep(options)), s = b.faces[0].surface;
  assert.equal(b.faces.length, 2);
  assert.deepEqual([s.controlPoints.length, s.controlPoints[0].length], [7, 5]);
  for (const i of [1, 3, 5]) for (const j of [0, 2, 4]) {
    assert.equal(s.weights[i][j], .7403836081153048);
    s.weights[i][j] = .7403836081153047;
  }
  return b;
}

function assertWorldBinding(b, result) {
  const { mesh, parameters } = result;
  assert.ok(mesh.indices.length > 0 && mesh.indices.length / 3 < 20000);
  assert.ok([...mesh.positions, ...mesh.normals].every(Number.isFinite));
  const points = new Set();
  for (const face of mesh.faces) {
    assert.equal(face.kind, 'trimmed');
    const nativeFace = b.faces.find(f => f.id === face.faceId), s = nativeFace.surface, at = surfaceEvaluator(s), { u, v } = surfaceDomain(s), p = parameters.get(face.faceId);
    assert.equal(p.own, true);
    let Lu = 0, Lv = 0;
    for (let i = 0; i < 8; i++) {
      const a = u[0] + (u[1] - u[0]) * (i + .5) / 8, c = v[0] + (v[1] - v[0]) * (i + .5) / 8;
      Lu += Math.hypot(...at(u[1], c).map((x, k) => x - at(u[0], c)[k])) / 8;
      Lv += Math.hypot(...at(a, v[1]).map((x, k) => x - at(a, v[0])[k])) / 8;
    }
    const edgeIds = new Set(b.loops.filter(l => nativeFace.loops.includes(l.id)).flatMap(l => l.coedges).map(id => b.coedges.find(c => c.id === id).edge));
    const off = Math.max(1e-5 * (Lu + Lv) + 1e-6, ...b.edges.filter(e => edgeIds.has(e.id)).map(e => e.tolerance));
    for (let i = 0; i < face.vertexCount; i++) {
      const k = 3 * (face.vertexOffset + i), q = Array.from(mesh.positions.slice(k, k + 3)), world = at(...p.uv[i]);
      assert.ok(p.uv[i].every(Number.isFinite));
      assert.ok(p.uv[i][0] >= u[0] && p.uv[i][0] <= u[1] && p.uv[i][1] >= v[0] && p.uv[i][1] <= v[1], 'original UV domain is unchanged');
      assert.ok(Math.hypot(...q.map((x, j) => x - world[j])) <= off, 'original world evaluator binds every vertex at the unchanged threshold');
      assert.deepEqual(p.at(...p.uv[i]), world, 'published evaluator retains the original world surface');
      points.add(q.join(','));
    }
  }
  for (const edge of mesh.edges) for (let i = 0; i < edge.points.length; i += 3) assert.ok(points.has(Array.from(edge.points.slice(i, i + 3)).join(',')), 'shared world edge samples remain mesh vertices');
}

for (const q of [8, 12]) test(`compound far sphere with nine browser weights binds in world coordinates at q${q}`, () => {
  const b = browserWeightSphere(), before = structuredClone(b);
  assertWorldBinding(b, tessellateBrepWithParameters(b, { segmentsPerQuarter: q }));
  assert.deepEqual(b, before);
});

test('local inversion still refuses a genuinely separated surface at the original world guard', () => {
  const b = browserWeightSphere();
  for (const row of b.faces[0].surface.controlPoints) for (const p of row) p[0] -= .01;
  const before = structuredClone(b), id = b.faces[0].id;
  assert.throws(() => tessellateBrepWithParameters(b, { segmentsPerQuarter: 8 }), error => error.code === 'GEOMETRY' && error.message === `B-rep: tessellation: an edge of face ${id} does not lie on its surface`);
  assert.deepEqual(b, before);
});

for (const [name, options] of [
  ['zero-origin frame', {}],
  ['positive narrow axes', { center: [999000, 999000, 999000] }],
  ['negative narrow axes', { center: [-999000, -999000, -999000] }],
  ['wide cross-zero axis', { wide: true }],
  ['same-sign wide axis', { wide: 'positive' }],
  ['wide cross-zero axis and shifted narrow axis', { wide: true, center: [0, 0, 999000] }],
  ['same-sign wide axis and shifted narrow axis', { wide: 'positive', center: [0, 0, 999000] }],
]) test(`curved rational sheet retains world binding with ${name}`, () => {
  const b = normalSheet(options), before = structuredClone(b);
  assertWorldBinding(b, tessellateBrepWithParameters(b, { segmentsPerQuarter: 8 }));
  assert.deepEqual(b, before);
});

test('targets outside a control-net axis interval stay in the bounds and retain off-surface refusal', () => {
  const b = normalSheet({ center: [10, 10, 10] });
  for (const edge of b.edges) edge.curve.controlPoints = edge.curve.controlPoints.map(p => [p[0] - 20, p[1], p[2]]);
  for (const vertex of b.vertices) vertex.point = [vertex.point[0] - 20, vertex.point[1], vertex.point[2]];
  const before = structuredClone(b), id = b.faces[0].id;
  assert.throws(() => tessellateBrepWithParameters(b), error => error.code === 'GEOMETRY' && error.message === `B-rep: tessellation: an edge of face ${id} does not lie on its surface`);
  assert.deepEqual(b, before);
});
