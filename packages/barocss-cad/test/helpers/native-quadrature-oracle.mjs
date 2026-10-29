// Independent arithmetic over the native quadratic/linear ruled patches at fixed binary64 Gauss nodes.
// Product imports: zero. This certifies the stored-node V/X/Y arithmetic, not exact integration or pi.
import assert from 'node:assert/strict';
import { rational as q, fromNumber as f, add, sub, mul, div, compare } from './prismatic-mass-oracle.mjs';
const GU = [[0.007908472640705932, 0.020242002382657907], [0.04120080038851098, 0.04606074991886419], [0.09921095463334506, 0.0694367551098936], [0.17882533027982989, 0.08907299038097284], [0.2757536244817766, 0.1039080237684442], [0.3847708420224326, 0.11314159013144857], [0.5, 0.11627577661543695], [0.6152291579775674, 0.11314159013144857], [0.7242463755182234, 0.1039080237684442], [0.8211746697201701, 0.08907299038097284], [0.9007890453666549, 0.0694367551098936], [0.9587991996114891, 0.04606074991886419], [0.9920915273592941, 0.020242002382657907]];
const GV = [[0.010885670926971514, 0.02783428355808677], [0.05646870011595234, 0.06279018473245236], [0.13492399721297532, 0.09314510546386713], [0.2404519353965941, 0.11659688229599514], [0.36522842202382755, 0.1314022722551233], [0.5, 0.1364625433889503], [0.6347715779761725, 0.1314022722551233], [0.7595480646034058, 0.11659688229599514], [0.8650760027870247, 0.09314510546386713], [0.9435312998840477, 0.06279018473245236], [0.9891143290730284, 0.02783428355808677]];
const zero = () => q(0n), two = q(2n), one = q(1n);
const cross = (a, b) => [sub(mul(a[1], b[2]), mul(a[2], b[1])), sub(mul(a[2], b[0]), mul(a[0], b[2])), sub(mul(a[0], b[1]), mul(a[1], b[0]))];
export function assertNearRational(actual, expected, tolerance, label) {
  const delta = sub(f(actual), expected), magnitude = q(delta.n < 0n ? -delta.n : delta.n, delta.d);
  assert.ok(compare(magnitude, f(tolerance)) <= 0, `${label}: ${actual} exceeds independent rational tolerance ${tolerance}`);
}
/** This fixed fixture's two half-circle sides: full native poles, weights, knots and face senses. */
export function nativeCylinderNodes(brep) {
  const sides = brep.faces.filter(face => face.surface.kind === 'surface' && face.surface.degreeU === 2);
  assert.equal(sides.length, 2);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const face of brep.faces) for (const row of face.surface.controlPoints) for (const p of row) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  const center = lo.map((value, k) => f((value + hi[k]) / 2));
  const totals = [zero(), zero(), zero()]; let count = 0;
  for (const face of sides) {
    const s = face.surface;
    assert.equal(s.degreeV, 1); assert.deepEqual(s.knotsU, [0, 0, 0, .5, .5, 1, 1, 1]); assert.deepEqual(s.knotsV, [0, 0, 1, 1]); assert.equal(s.controlPoints.length, 5);
    for (let row = 0; row < 5; row++) {
      assert.equal(s.controlPoints[row].length, 2); assert.equal(s.weights[row][0], s.weights[row][1]); assert.ok(s.weights[row][0] > 0);
      assert.equal(s.controlPoints[row][0][0], s.controlPoints[row][1][0]); assert.equal(s.controlPoints[row][0][1], s.controlPoints[row][1][1]);
      assert.equal(s.controlPoints[row][0][2], s.controlPoints[0][0][2]); assert.equal(s.controlPoints[row][1][2], s.controlPoints[0][1][2]);
    }
    const poles = s.controlPoints.map((row, i) => row.map((point, j) => [...point.map(v => mul(f(v), f(s.weights[i][j]))), f(s.weights[i][j])]));
    const h = sub(f(s.controlPoints[0][1][2]), f(s.controlPoints[0][0][2]));
    for (let span = 0; span < 2; span++) for (const [gx, gw] of GU) for (const [vx, vw] of GV) {
      // Evaluate at the actual stored affine-mapped parameters, then use exact independent Bernstein bases.
      const t = div(sub(f(span * .5 + .5 * gx), f(span * .5)), f(.5)), v = f(vx), a = sub(one, t);
      const N = [mul(a, a), mul(two, mul(t, a)), mul(t, t)], D = [div(mul(q(-2n), a), f(.5)), div(sub(two, mul(q(4n), t)), f(.5)), div(mul(two, t), f(.5))], M = [sub(one, v), v], E = [q(-1n), one];
      const H = Array.from({ length: 4 }, zero), U = Array.from({ length: 4 }, zero), V = Array.from({ length: 4 }, zero);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 4; k++) {
        const p = poles[2 * span + i][j][k]; H[k] = add(H[k], mul(mul(N[i], M[j]), p)); U[k] = add(U[k], mul(mul(D[i], M[j]), p)); V[k] = add(V[k], mul(mul(N[i], E[j]), p));
      }
      const point = H.slice(0, 3).map(value => div(value, H[3])), du = point.map((value, k) => div(sub(U[k], mul(value, U[3])), H[3])), dv = point.map((value, k) => div(sub(V[k], mul(value, V[3])), H[3]));
      assert.equal(du[2].n, 0n); assert.equal(dv[0].n, 0n); assert.equal(dv[1].n, 0n); assert.equal(compare(dv[2], h), 0);
      const normal = cross(du, dv), w = f((face.sense === 'forward' ? 1 : -1) * gw * vw * .5), x = sub(point[0], center[0]), y = sub(point[1], center[1]);
      const fields = [mul(x, normal[0]), mul(div(mul(x, x), two), normal[0]), mul(div(mul(y, y), two), normal[1])];
      for (let k = 0; k < 3; k++) totals[k] = add(totals[k], mul(fields[k], w)); count++;
    }
  }
  const [volume, x, y] = totals; assert.ok(volume.n > 0n); assert.equal(count, 572);
  return { volume, centroid: [add(div(x, volume), center[0]), add(div(y, volume), center[1]), div(add(f(lo[2]), f(hi[2])), two)], nodeCount: count };
}
