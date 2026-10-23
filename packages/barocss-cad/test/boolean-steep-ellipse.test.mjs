import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, tessellateBrep } from '../dist/index.js';
import { paramOf, segAt } from '../dist/curved-arrangement.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

test('curves: a point on a branch of a curve sampled sparsely against its turn maps onto that branch (D197)', () => {
  // Ellipses as a plane nearly along a cylinder's axis cuts it, in 64 samples some 30 mm apart along the long axis: a point
  // between two samples of one side lies nearer a sample of the other side (before D197, 7.1 and 4.1 mm off).
  for (const [a, b, t0, t] of [[3.5, 300, -3.2166, 0.07996], [2, 200, -3.1, -0.03555]]) {
    const g = { kind: 'curve', f: x => [a * Math.cos(x), b * Math.sin(x)], t0, t1: t0 + 2 * Math.PI - 0.01 }, p = g.f(t), q = segAt(g, paramOf(g, p));
    assert.ok(Math.hypot(q[0] - p[0], q[1] - p[1]) <= 1e-6, `${a} × ${b} at ${t}: ${q} vs ${p}`);
  }
});

test('analytic Boolean: faces nearly along a cylinder\'s axis cut it where its trims are (L4 fuzz 73, 139, D197)', () => {
  // (Their ellipses' crossings with the faces' edges were dropped as off the curve: a cut ended inside the cylinder's
  // face, and the result was refused as not manifold.)
  const leaf = (kind, dims, rot, move) => ({ leaf: { kind, ...dims, rot: rot.map(([axis, deg]) => ({ axis, deg })), move } });
  const cases = [
    ['a box ∩ a cylinder turned 188.8° about X, 85.75° about Z', { op: 'intersect', a: leaf('box', { w: 2, d: 4, h: 7 }, [], [2, -1.5, -0.5]), b: leaf('cyl', { r: 3.5, h: 2.5 }, [['x', 188.839], ['z', 85.75]], [0, 0.5, 1]) }],
    ['a cylinder ∪ a box, both turned a little', { op: 'union', a: leaf('cyl', { r: 1, h: 6.5 }, [['x', 351.227]], [0.5, 2.5, -1.5]), b: leaf('box', { w: 1.5, d: 2, h: 2 }, [['x', 355.606], ['z', 63.792]], [1, 2, -2]) }],
  ];
  for (const [name, tree] of cases) {
    const { document, root } = documentOf(tree), o = evaluateCadPart(document).outputs.find(x => x.id === root), m = o.massProperties(1), q = oracle(tree, 256, 6);
    assert.equal(o.validate().valid, true, name);
    const mesh = tessellateBrep(o.brep, { segmentsPerQuarter: 8 }), P = mesh.positionsMM, uses = new Map();
    for (let t = 0; t < mesh.indices.length; t += 3) for (let k = 0; k < 3; k++) {
      const a = mesh.indices[t + k], b = mesh.indices[t + (k + 1) % 3], ka = `${P[3 * a]},${P[3 * a + 1]},${P[3 * a + 2]}`, kb = `${P[3 * b]},${P[3 * b + 1]},${P[3 * b + 2]}`, e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      uses.set(e, (uses.get(e) ?? 0) + 1);
    }
    assert.ok([...uses.values()].every(n => n === 2), `${name}: watertight`);
    assert.ok(Math.abs(m.volumeMM3 - q.volumeMM3) <= 3 * q.e + 1e-9, `${name}: ${m.volumeMM3} vs the oracle ${q.volumeMM3} ± ${q.e}`);
  }
});
