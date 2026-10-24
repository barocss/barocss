import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, evaluateSurfaceCurvature, nurbsOf, massPropertiesOf } from '../dist/index.js';
import { evaluateSurfaceD1 } from '../dist/core/derivatives.js';
import { evaluateCurve } from '../dist/core/math.js';
import { tessellateBrep } from '../dist/brep/brep-tessellate.js';

// R11.2c-1 (D112): the offset route (R11.2a/b) takes kept faces that are planes or circular cylinders however trimmed —
// offset exactly (a plane moved, a cylinder scaled about its axis: affine maps of the face's own NURBS and edges) — beside
// fitted freeform patches, where the opening leaves no sharp edge between kept faces: a filleted pipe tee with its three
// ends opened is one smooth region (two trimmed cylinders, the rolling-ball fillet). No Boolean. The oracle is the kept
// faces' normal bands ∫∫ (t − Ht² + Kt³/3) dA: a cylinder's A·(t − t²/2r), its area r ∮ −h dθ over its own edges (Green); a
// fillet patch's by quadrature of its curvature.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const refused = (features, code, pattern) => assert.throws(() => out(features), e => (e.details?.category ?? e.code) === code && pattern.test(e.message), String(pattern));
const yzAt = x => ({ origin: [x, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] });
const GL8 = [[-0.9602898564975363, 0.1012285362903763], [-0.7966664774136267, 0.2223810344533745], [-0.5255324099163290, 0.3137066458778873], [-0.1834346424956498, 0.3626837833783620], [0.1834346424956498, 0.3626837833783620], [0.5255324099163290, 0.3137066458778873], [0.7966664774136267, 0.2223810344533745], [0.9602898564975363, 0.1012285362903763]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** A patch's area and normal band, by 8 × 8 Gauss–Legendre on halves of each knot span. */
function patchBand(f, t) {
  const S = nurbsOf(f), sg = f.sense === 'forward' ? 1 : -1, ku = [...new Set(S.knotsU)], kv = [...new Set(S.knotsV)];
  let A = 0, V = 0;
  for (let a = 0; a + 1 < ku.length; a++) for (let c = 0; c + 1 < kv.length; c++) for (let su = 0; su < 2; su++) for (let sv = 0; sv < 2; sv++) for (const [x, wx] of GL8) for (const [y, wy] of GL8) {
    const hu = (ku[a + 1] - ku[a]) / 2, hv = (kv[c + 1] - kv[c]) / 2, u = ku[a] + hu * (su + (x + 1) / 2), v = kv[c] + hv * (sv + (y + 1) / 2), r = evaluateSurfaceCurvature(S, u, v), d = evaluateSurfaceD1(S, u, v);
    const J = Math.hypot(...cross(d.du, d.dv)) * hu * hv / 4 * wx * wy;
    A += J; V += (t + sg * r.meanCurvaturePerMM * t * t + r.gaussianCurvaturePerMM2 * t ** 3 / 3) * J;
  }
  return { A, V };
}
/** A face on a cylinder of radius r (frame: p → [X, Y] across the axis, h along it): its area r ∮ −h dθ over its loops. */
function cylinderArea(b, f, frame, r) {
  const loops = new Map(b.loops.map(l => [l.id, l])), coedges = new Map(b.coedges.map(c => [c.id, c])), edges = new Map(b.edges.map(e => [e.id, e]));
  let I = 0;
  for (const lid of f.loops) for (const cid of loops.get(lid).coedges) {
    const c = coedges.get(cid), C = edges.get(c.edge).curve, ks = [...new Set(C.knots)], s = c.sense === 'forward' ? 1 : -1;
    for (let k = 0; k + 1 < ks.length; k++) for (let q = 0; q < 4; q++) for (const [x, w] of GL8) {
      const h0 = (ks[k + 1] - ks[k]) / 4, u = ks[k] + h0 * (q + (x + 1) / 2), e = 1e-7 * (ks[k + 1] - ks[k]), up = Math.min(ks.at(-1), u + e), dn = Math.max(ks[0], u - e);
      const [X, Y, H] = frame(evaluateCurve(C, u)), [X1, Y1] = frame(evaluateCurve(C, up)), [X0, Y0] = frame(evaluateCurve(C, dn));
      I += s * -H * (X * (Y1 - Y0) - Y * (X1 - X0)) / (X * X + Y * Y) / (up - dn) * h0 / 2 * w;
    }
  }
  return Math.abs(r * I);
}
/** A pipe R along X (60 long) with a branch r up Z at x 30 (25 high), its junction filleted f (R10.2a: a rolling ball). */
const tee = (R, r, f) => [{ id: 'as', kind: 'sketch', profile: 'circle', center: [0, 0], radius: R, plane: yzAt(0) }, { id: 'a', kind: 'extrude', sketch: 'as', height: 60 }, { id: 'bs', kind: 'sketch', profile: 'circle', center: [30, 0], radius: r }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 25 }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }, { id: 'f', kind: 'fillet', target: 'u', edges: ['a.side0#1|b.side0#2#4'], radius: f }];
const ENDS = ['a.top', 'a.bottom', 'b.top'];
const shell = (R, r, f, t, open = ENDS) => [...tee(R, r, f), { id: 'sh', kind: 'shell', target: 'f', thickness: t, open }];

test('R11.2c-1 a filleted pipe tee shelled with its three ends opened: the kept faces\' normal bands (refused on HEAD: a trimmed cylinder)', () => {
  for (const [R, r, f, ts] of [[10, 5, 2, [0.5, 1, 2]], [10, 6, 1.5, [1]]]) {
    const body = out(tee(R, r, f)).brep, main = p => [p[1], p[2], p[0]], branch = p => [p[0] - 30, p[1], p[2]];
    for (const t of ts) {
      let A = 0, V = 0;
      for (const face of body.faces) {
        if (ENDS.includes(face.name)) continue;
        if (/^a\.side0/.test(face.name)) { const a = cylinderArea(body, face, main, R); A += a; V += a * (t - t * t / (2 * R)); }
        else if (/^b\.side0/.test(face.name)) { const a = cylinderArea(body, face, branch, r); A += a; V += a * (t - t * t / (2 * r)); }
        else { const x = patchBand(face, t); A += x.A; V += x.V; }
      }
      const o = out(shell(R, r, f, t)), report = checkBrep(o.brep, { strict: true }), m = massPropertiesOf(o), what = `R ${R} r ${r} f ${f} t ${t}`;
      assert.equal(report.valid, true, `${what}: ${report.issues}`);
      assert.equal(o.brep.shells.length, 1, what);
      assert.equal(m.method, 'quadrature', what);
      assert.ok(Math.abs(m.volume - V) <= A * 1e-6 * 60, `${what}: ${m.volume} vs ${V} (${(m.volume - V) / V})`);
      // The kept faces keep their names; the hollow's are named after them; no end face is left.
      const names = o.brep.faces.map(x => x.name);
      for (const n of ENDS) assert.ok(!names.includes(n), `${what}: ${n}`);
      assert.ok(names.includes('a.side0#1') && names.some(n => /^sh\.in\.a\.side0#1/.test(n)) && names.some(n => /^sh\.rim\./.test(n)), what);
      // Tessellated at 8 and 16 a quarter (HEAD's tessellator took its edges for off its small cells beyond 1e-5 of the
      // cell's size, not their own tolerance; and its mean of a run of one parameter rounded past the domain's end).
      if (t === 1) for (const q of [8, 16]) assert.ok(tessellateBrep(o.brep, { segmentsPerQuarter: q }).indices.length > 0, `${what}: ${q} a quarter`);
    }
  }
});

test('R11.2c-1 refused by name: a wall past the fillet\'s convex radius (4.048 mm, where it turns round the branch)', () => {
  refused(shell(10, 5, 2, 4.1), 'CAPABILITY', /\[OFFSET_FOLDS\] face f\.face#\d+ curves more tightly than the wall .*its radius there 4\.048\d* mm, the wall 4\.1 mm/);
  // (An end kept, a sharp edge between kept faces, was refused here until R11.2c-2, D113: r11-2c2.test.mjs.)
});
