import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep, tessellateBrep, evaluateCadPart, massPropertiesOf, checkOutput } from '../dist/index.js';
import { loftSolid } from '../dist/features/loft.js';

// CG1.3: a general (polynomial B-spline) seam guide on a ruled loft of parallel sections. Each slice is the ruled one
// moved by the guide's departure from its chord, at the guide's height; the checks below are independent of that build:
// Cavalieri (a slice's area does not change when it moves), and the guide's own points by de Boor written here.
const sq = (x0, y0, w) => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + w], [x0, y0 + w]].map(start => ({ kind: 'line', start }));
/** de Boor at t of a polynomial B-spline. */
function deBoor(p, U, P, t) {
  let k = p; while (k < P.length - 1 && t >= U[k + 1]) k++;
  const d = Array.from({ length: p + 1 }, (_, j) => [...P[k - p + j]]);
  for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) {
    const i = k - p + j, a = (t - U[i]) / (U[i + p + 1 - r] - U[i]);
    d[j] = d[j].map((x, c) => (1 - a) * d[j - 1][c] + a * x);
  }
  return d[p];
}
/** ∫ f(G(t)) dz(t) along the guide by the midpoint rule on N steps (dz from the guide's own points). */
function alongGuide(g, f, N = 200000) {
  const t0 = g.knots[0], t1 = g.knots.at(-1); let s = 0, prev = deBoor(g.degree, g.knots, g.controlPoints, t0);
  for (let i = 1; i <= N; i++) { const q = deBoor(g.degree, g.knots, g.controlPoints, t0 + (t1 - t0) * i / N), m = prev.map((x, c) => (x + q[c]) / 2); s += f(m) * (q[2] - prev[2]); prev = q; }
  return s;
}
function watertight(brep) {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: 8 }), P = mesh.positions, uses = new Map();
  for (let t = 0; t < mesh.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = mesh.indices[t + k], b = mesh.indices[t + (k + 1) % 3], ka = `${P[3 * a]},${P[3 * a + 1]},${P[3 * a + 2]}`, kb = `${P[3 * b]},${P[3 * b + 1]},${P[3 * b + 2]}`;
    const e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`; uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  return [...uses.values()].every(n => n === 2);
}
const solid = input => { const r = loftSolid(input); assert.equal(checkBrep(r.brep, { strict: true }).valid, true, input.id); assert.ok(watertight(r.brep), `${input.id}: watertight`); return { ...r, m: r.mass(1) }; };

test('CG1.3 a straight guide at an uneven pace on an oblique prism: the prism (volume and centroid)', () => {
  const chord = s => [6 * s, 3 * s, 12 * s], sections = [{ profile: sq(0, 0, 10), z: 0 }, { profile: sq(6, 3, 10), z: 12 }];
  const { m } = solid({ id: 'a', name: 'a', sections, guide: { kind: 'nurbs', degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: [chord(0), chord(0.1), chord(0.3), chord(1)] } });
  assert.ok(Math.abs(m.volume - 1200) < 1e-9, `${m.volume}`);
  for (const [k, x] of [8, 6.5, 6].entries()) assert.ok(Math.abs(m.centroid[k] - x) < 1e-9, `centroid ${m.centroid}`);
});

test('CG1.3 a guide bowed sideways through equal squares (two spans of a quadratic): Cavalieri — A·H, the centroid the guide\'s mean offset', () => {
  const g = { kind: 'nurbs', degree: 2, knots: [0, 0, 0, 0.5, 1, 1, 1], controlPoints: [[0, 0, 0], [8, 0, 5], [-4, 2, 14], [0, 0, 20]] };
  const { m, brep } = solid({ id: 'b', name: 'b', sections: [{ profile: sq(0, 0, 10), z: 0 }, { profile: sq(0, 0, 10), z: 20 }], guide: g });
  assert.ok(Math.abs(m.volume - 2000) < 1e-9, `${m.volume}`);
  // Each slice is the square moved by the guide's (x, y) at its height: centroid = the square's + the mean of G over z.
  const cx = 5 + alongGuide(g, q => q[0]) / 20, cy = 5 + alongGuide(g, q => q[1]) / 20;
  assert.ok(Math.abs(m.centroid[0] - cx) < 1e-8 && Math.abs(m.centroid[1] - cy) < 1e-8 && Math.abs(m.centroid[2] - 10) < 1e-9, `${m.centroid} vs ${cx}, ${cy}`);
  // The seam edge is the guide itself.
  const seam = brep.edges.find(e => e.curve.degree === 2 && e.curve.controlPoints[0].every((x, c) => x === [0, 0, 0][c]));
  assert.ok(seam && seam.curve.controlPoints.length === 4, 'seam edge');
});

test('CG1.3 three sections, the guide through a corner of each with a height linear in its parameter: the unguided loft\'s volume (Cavalieri), its centroid moved by the guide', () => {
  const sections = [{ profile: sq(-10, -10, 20), z: 0 }, { profile: sq(-5, -5, 10), z: 10 }, { profile: sq(-10, -10, 20), z: 20 }];
  const g = { kind: 'nurbs', degree: 1, knots: [0, 0, 1, 2, 3, 4, 4], controlPoints: [[-10, -10, 0], [-4, -9, 5], [-5, -5, 10], [-9, -2, 15], [-10, -10, 20]] };
  const plain = solid({ id: 'c', name: 'c', sections }).m, { m } = solid({ id: 'c', name: 'c', sections, guide: g });
  assert.ok(Math.abs(m.volume - plain.volume) < 1e-9 * plain.volume, `${m.volume} vs ${plain.volume}`);
  // A slice's area at height z: the ruled square's side 20 − |10 − z|; moved by G(z) − its chord on that span.
  const chordAt = q => { const [a, b] = q[2] <= 10 ? [[-10, -10, 0], [-5, -5, 10]] : [[-5, -5, 10], [-10, -10, 20]], l = (q[2] - a[2]) / (b[2] - a[2]); return [0, 1].map(c => a[c] + l * (b[c] - a[c])); };
  const area = q => (20 - Math.abs(10 - q[2])) ** 2;
  const cx = alongGuide(g, q => area(q) * (q[0] - chordAt(q)[0])) / plain.volume, cy = alongGuide(g, q => area(q) * (q[1] - chordAt(q)[1])) / plain.volume;
  assert.ok(Math.abs(m.centroid[0] - cx) < 1e-6 && Math.abs(m.centroid[1] - cy) < 1e-6, `${m.centroid} vs ${cx}, ${cy}`);
});

test('CG1.3 a cubic crossing the middle section inside its one span (cut there): equal squares whose corner is the guide — A·H, the centroid the guide\'s mean', () => {
  // The cubic reaches z 10 at t ½, at (4.5, 0): the middle square's corner. Every slice's corner is G(t).
  const g = { kind: 'nurbs', degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: [[0, 0, 0], [6, 0, 6], [6, 0, 14], [0, 0, 20]] };
  const { m, brep } = solid({ id: 'd', name: 'd', sections: [{ profile: sq(0, 0, 10), z: 0 }, { profile: sq(4.5, 0, 10), z: 10 }, { profile: sq(0, 0, 10), z: 20 }], guide: g });
  assert.ok(Math.abs(m.volume - 2000) < 1e-9, `${m.volume}`);
  const cx = 5 + alongGuide(g, q => q[0]) / 20;
  assert.ok(Math.abs(m.centroid[0] - cx) < 1e-8 && Math.abs(m.centroid[1] - 5) < 1e-9, `${m.centroid} vs ${cx}`);
  // Each span's seam edge is a whole cubic Bézier (the cut at t ½, knots on [0, 1]).
  const seams = brep.edges.filter(e => e.curve.degree === 3 && e.curve.controlPoints.some(p => p[0] === 0 && p[1] === 0));
  assert.ok(seams.length >= 2 && seams.every(e => JSON.stringify(e.curve.knots) === '[0,0,0,0,1,1,1,1]'), JSON.stringify(seams.map(e => e.curve.knots)));
});

test('CG1.3 refusals: smooth sections, a guide that misses a section\'s vertex, one that does not rise, one that ends off the top', () => {
  const sections = [{ profile: sq(-10, -10, 20), z: 0 }, { profile: sq(-5, -5, 10), z: 10 }, { profile: sq(-10, -10, 20), z: 20 }];
  const g = pts => ({ kind: 'nurbs', degree: 1, knots: [0, 0, ...pts.slice(1, -1).map((_, i) => i + 1), pts.length - 1, pts.length - 1], controlPoints: pts });
  const refused = (input, re) => assert.throws(() => loftSolid({ id: 'r', name: 'r', ...input }), e => re.test(e.message), String(re));
  refused({ sections, smooth: true, guide: g([[-10, -10, 0], [-5, -5, 10], [-10, -10, 20]]) }, /a guide takes ruled sections/);
  refused({ sections, guide: g([[-10, -10, 0], [-4, -5, 10], [-10, -10, 20]]) }, /guide must pass through a vertex of section 1/);
  refused({ sections, guide: g([[-10, -10, 0], [-5, -5, 12], [-6, -6, 11], [-10, -10, 20]]) }, /must rise along the sections' normal/);
  refused({ sections, guide: g([[-10, -10, 0], [-5, -5, 10], [-10, -10, 18]]) }, /must end on the top section/);
});

test('CG1.3 the part model: a guide in world coordinates on sketches stacked along a tilted plane\'s normal', () => {
  // The same bowed guide as above, the sketches on a plane turned 30° about X: the guide given in world coordinates.
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6), plane = { origin: [1, 2, 3], normal: [0, -s, c], xAxis: [1, 0, 0] };
  const world = q => [1 + q[0], 2 + c * q[1] - s * q[2], 3 + s * q[1] + c * q[2]];
  const local = [[0, 0, 0], [8, 0, 5], [-4, 2, 14], [0, 0, 20]], g = { kind: 'nurbs', degree: 2, knots: [0, 0, 0, 0.5, 1, 1, 1], controlPoints: local.map(world) };
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10], plane },
    { id: 'l', kind: 'loft', sections: [{ sketch: 's', z: 0 }, { sketch: 's', z: 20 }], guide: g }] };
  const o = evaluateCadPart(doc).outputs.at(-1), m = massPropertiesOf(o);
  assert.equal(checkOutput(o).valid, true);
  assert.ok(Math.abs(m.volume - 2000) < 1e-9, `${m.volume}`);
  const lc = [5 + alongGuide({ ...g, controlPoints: local }, q => q[0]) / 20, 5 + alongGuide({ ...g, controlPoints: local }, q => q[1]) / 20, 10], wc = world(lc);
  assert.ok(Math.hypot(...m.centroid.map((x, k) => x - wc[k])) < 1e-8, `${m.centroid} vs ${wc}`);
});
