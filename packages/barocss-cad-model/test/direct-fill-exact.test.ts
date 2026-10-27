import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCurve, evaluateSurface, type Curve, type Surface } from '@barocss/cad';
import { directOps, emptyDirect, geometryOf, importSource, type DirectGeometry } from '../src/engine/direct';

// Direct Fill (Studio's Direct panel → directOps.fill). Expectations come from the input curves: the patch's
// edges must be the picked curves and its inside the Coons formula evaluated from those curves.
type P = [number, number, number];
const EPS = 1e-9;
const curve = (id: string, degree: number, points: P[], weights = points.map(() => 1)) =>
  `  @curve #${id} { type: nurbs; degree: ${degree}; knots: [${[...Array(degree + 1).fill(0), ...Array(degree + 1).fill(1)].join(',')}]; control-points: [${points.map(p => `[${p.join(',')}]`).join(',')}]; weights: [${weights.join(',')}]; }`;
const source = (lines: string[]) => `@model loop {\n  version: 0;\n  length-unit: mm;\n${lines.join('\n')}\n}`;
// Corners A(0,0,0) B(30,0,0) C(30,20,0) D(0,20,0). Two sides are stored against the loop's direction.
const AB: P[] = [[0, 0, 0], [10, 0, 5], [20, 0, -5], [30, 0, 0]];
const BC: P[] = [[30, 0, 0], [35, 10, 2], [30, 20, 0]];
const CD: P[] = [[30, 20, 0], [20, 20, 4], [10, 20, -4], [0, 20, 0]];
const DA: P[] = [[0, 20, 0], [-5, 10, 3], [0, 0, 0]];
const ids = (d: DirectGeometry, names: string[]) => names.map(n => { const o = d.objects.find(x => x.name.endsWith(`· ${n}`)); assert.ok(o, n); return o.id; });
const filled = (d: DirectGeometry): Surface => {
  const o = d.objects.at(-1); assert.ok(o && o.name === 'Filled surface');
  const g = geometryOf(d, o); assert.equal(g.kind, 'surface'); return g as Surface;
};
const near = (a: readonly number[], b: readonly number[], what: string) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= EPS, `${what}: ${a} vs ${b}`);
const at = (c: Curve, s: number, flip = false) => evaluateCurve(c, flip ? 1 - s : s);

test('Fill: four polynomial Bezier sides make the exact Coons patch, in any pick order and direction', () => {
  const d0 = importSource(emptyDirect(), source([curve('ab', 3, AB), curve('bc', 2, BC), curve('cd', 3, CD), curve('da', 2, DA)]), 'loop');
  const before = JSON.stringify(d0);
  // Picked from the top: the loop then runs C→D, D→A, A→B, B→C.
  const d = directOps.fill(d0, ids(d0, ['cd', 'da', 'ab', 'bc']));
  assert.equal(JSON.stringify(d0), before, 'the picked curves and document stay as they were');
  const s = filled(d), get = (n: string) => geometryOf(d, d.objects.find(o => o.name.endsWith(`· ${n}`))!) as Curve;
  assert.deepEqual([s.degreeU, s.degreeV], [3, 2], 'the sides\' own degrees: no resampling');
  assert.equal(s.controlPoints.length, 4); assert.equal(s.controlPoints[0].length, 3);
  const cd = get('cd'), da = get('da'), ab = get('ab'), bc = get('bc');
  // bottom = C→D (as stored), right = D→A (as stored), top = B→A (ab reversed), left = C→B (bc reversed).
  const bottom = (u: number) => at(cd, u), right = (v: number) => at(da, v), top = (u: number) => at(ab, u, true), left = (v: number) => at(bc, v, true);
  for (const t of [0, 0.13, 0.5, 0.87, 1]) {
    near(evaluateSurface(s, t, 0), bottom(t), `bottom ${t}`); near(evaluateSurface(s, t, 1), top(t), `top ${t}`);
    near(evaluateSurface(s, 0, t), left(t), `left ${t}`); near(evaluateSurface(s, 1, t), right(t), `right ${t}`);
  }
  const P00 = bottom(0), P10 = bottom(1), P01 = top(0), P11 = top(1);
  for (const [u, v] of [[0.25, 0.4], [0.6, 0.7], [0.9, 0.15]]) {
    const coons = [0, 1, 2].map(k => (1 - v) * bottom(u)[k] + v * top(u)[k] + (1 - u) * left(v)[k] + u * right(v)[k]
      - ((1 - u) * (1 - v) * P00[k] + u * (1 - v) * P10[k] + (1 - u) * v * P01[k] + u * v * P11[k]));
    near(evaluateSurface(s, u, v), coons, `inside ${u},${v}`);
  }
});

test('Fill: sides the exact patch does not admit still fill by sampling, as before', () => {
  const sampled = (lines: string[], picked: string[]) => {
    const d0 = importSource(emptyDirect(), source(lines), 'loop'), s = filled(directOps.fill(d0, ids(d0, picked)));
    assert.deepEqual([s.degreeU, s.degreeV], [3, 3]); assert.equal(s.controlPoints.length, 16, 'the 16 × 16 interpolated net');
  };
  // A rational side (a weight other than 1).
  sampled([curve('ab', 3, AB), curve('bc', 2, BC, [1, 0.8, 1]), curve('cd', 3, CD), curve('da', 2, DA)], ['ab', 'bc', 'cd', 'da']);
  // Opposite sides of different degrees: the top is a straight line.
  sampled([curve('ab', 3, AB), curve('bc', 2, BC), curve('cd', 1, [CD[0], CD[3]]), curve('da', 2, DA)], ['ab', 'bc', 'cd', 'da']);
  // Corners meeting within the join tolerance but not exactly.
  sampled([curve('ab', 3, AB), curve('bc', 2, [[30, 0, 0.000001], BC[1], BC[2]]), curve('cd', 3, CD), curve('da', 2, DA)], ['ab', 'bc', 'cd', 'da']);
});

test('Fill: a broken loop is refused with the same message', () => {
  const d0 = importSource(emptyDirect(), source([curve('ab', 3, AB), curve('bc', 2, BC), curve('cd', 3, CD), curve('xx', 1, [[0, 20, 0], [0, 5, 0]])]), 'loop');
  assert.throws(() => directOps.fill(d0, ids(d0, ['ab', 'bc', 'cd', 'xx'])), /do not close into a loop|do not meet end to end/);
});
