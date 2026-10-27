import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brepMassProperties, evaluateCadPart, surfaceDomain, evaluateSurface, curveD1Evaluator, curveEvaluator, curveDomain, outputOf } from '../dist/index.js';
import { brepQuadratureIntegrals } from '../dist/brep/brep-mass-quadrature.js';
import { faceIntegrals } from './d149-oracle.mjs';

// FRk8b (D167): the trimmed-face quadrature's wrong mass on the 16/20 bevel pair at 4° (D152: 39.109 against D149's Green
// 38.571 and the mesh's 38.497). Per face against oracles of their own, the error sat in four trimmed flank faces: their
// few domain triangles each spanned several knot spans of the fitted flank, and the 16-point rule straddled the spans'
// breaks (1–2 % of each face, moving with the tessellation). The oracles, none of them the kernel's: D149's Green
// theorem in a face's domain, where it converges (24 and 48 pieces agree to 1e-9); on the faces lying on a sphere
// (heels, toes, roots), Green's theorem in spherical coordinates about an axis square to the face, its boundary the exact
// edges mapped by atan2 and acos — no surface parameters, no projection. (D149's Green does not converge on those: it
// moves 2 % between 24 and 192 pieces.) The pair is the fixture `frk8b-bevel-pair-4deg.brep.json` (built by the kernel
// at 56e11f3ae: 22 faces, 3 bodies), so the test does not rebuild it (24 s).
const GX = [-0.9602898564975363, -0.7966664774136267, -0.525532409916329, -0.1834346424956498, 0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363];
const GW = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.362683783378362, 0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = a => Math.hypot(...a), unit = a => a.map(x => x / len(a));
/** The sphere a surface lies on: its centre and radius from four points, checked on a 9 × 9 grid; null if it is none. */
function sphereOf(S) {
  if (S.kind !== 'surface') return null;
  const { u: U, v: V } = surfaceDomain(S), at = (a, b) => evaluateSurface(S, U[0] + (U[1] - U[0]) * a, V[0] + (V[1] - V[0]) * b);
  const P = [at(0.2, 0.2), at(0.8, 0.3), at(0.4, 0.8), at(0.6, 0.55)];
  const A = [1, 2, 3].map(i => sub(P[i], P[0]).map(x => 2 * x)), r = [1, 2, 3].map(i => dot(P[i], P[i]) - dot(P[0], P[0])), det = dot(A[0], cross(A[1], A[2]));
  if (!(Math.abs(det) > 1e-12)) return null;
  const c = [0, 1, 2].map(k => { const M = A.map((row, i) => row.map((x, j) => j === k ? r[i] : x)); return dot(M[0], cross(M[1], M[2])) / det; }), R = len(sub(P[0], c));
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) if (Math.abs(len(sub(at(i / 8, j / 8), c)) - R) > 1e-9 * R) return null;
  return { c, R };
}
/**
 * A face on a sphere: its flux ∫ x·n dA by Green's theorem in spherical coordinates (θ about an axis z square to the face's
 * mean direction, so the face is near the equator with no wrap in θ): ∬ g R² sin φ dφ dθ = ∮ G dθ, G = ∫ from π/2 to φ.
 * Each edge per knot span, `pieces` sub-intervals of 8 Gauss points; its exact points mapped by atan2 and acos.
 */
function sphereFlux(brep, face, { c, R }, pieces = 4) {
  const loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(x => [x.id, x])), edges = new Map(brep.edges.map(e => [e.id, e]));
  let m = [0, 0, 0];
  for (const lid of face.loops) for (const cid of loops.get(lid).coedges) { const e = edges.get(coedges.get(cid).edge), ev = curveEvaluator(e.curve), [t0, t1] = curveDomain(e.curve); for (let k = 0; k < 8; k++) m = m.map((x, i) => x + ev(t0 + (t1 - t0) * (k + 0.5) / 8)[i] - c[i]); }
  const x = unit(m), z = unit(cross(x, Math.abs(x[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), y = cross(z, x);
  const g = (th, ph) => { const p = [0, 1, 2].map(i => c[i] + R * (Math.sin(ph) * (Math.cos(th) * x[i] + Math.sin(th) * y[i]) + Math.cos(ph) * z[i])); return dot(p, p.map((q, i) => (q - c[i]) / R)) * R * R * Math.sin(ph); };
  const G = (th, ph) => { const h = (ph - Math.PI / 2) / 2; let s = 0; for (let k = 0; k < 8; k++) s += GW[k] * h * g(th, Math.PI / 2 + h * (GX[k] + 1)); return s; };
  // (With it the loop's own area, ∮ R²(cos(π/2) − cos φ) dθ: its sign says which way the loop runs in (φ, θ).)
  let F = 0, area = 0;
  for (const lid of face.loops) for (const cid of loops.get(lid).coedges) {
    const co = coedges.get(cid), e = edges.get(co.edge), d1 = curveD1Evaluator(e.curve), [t0, t1] = curveDomain(e.curve), dir = co.sense === 'forward' ? 1 : -1;
    const knots = [t0, ...e.curve.knots.filter(k => k > t0 && k < t1), t1].filter((k, i, all) => i === 0 || k > all[i - 1]);
    for (let j = 0; j + 1 < knots.length; j++) for (let p = 0; p < pieces; p++) for (let k = 0; k < 8; k++) {
      const a = knots[j], b = knots[j + 1], r = d1(a + (b - a) * (p + (GX[k] + 1) / 2) / pieces), q = sub(r.point, c), dq = r.derivative;
      const X = dot(q, x), Y = dot(q, y), th = Math.atan2(Y, X), ph = Math.acos(Math.max(-1, Math.min(1, dot(q, z) / len(q))));
      const w = dir * GW[k] / 2 * (b - a) / pieces * (X * dot(dq, y) - Y * dot(dq, x)) / (X * X + Y * Y);
      F += w * G(th, ph); area += w * -R * R * Math.cos(ph);
    }
  }
  // (The face's outward normal along the radius or against it — a convex patch of the sphere or a concave one — by its
  // surface's tangents at its domain's middle and its sense; the (φ, θ) parameters' normal is the radius's, so a loop anticlockwise about the outward normal runs anticlockwise in (φ, θ) on a convex patch.)
  const S = face.surface, { u: U, v: V } = surfaceDomain(S), um = (U[0] + U[1]) / 2, vm = (V[0] + V[1]) / 2, hu = 1e-6 * (U[1] - U[0]), hv = 1e-6 * (V[1] - V[0]);
  const N = cross(sub(evaluateSurface(S, um + hu, vm), evaluateSurface(S, um - hu, vm)), sub(evaluateSurface(S, um, vm + hv), evaluateSurface(S, um, vm - hv)));
  const outward = (face.sense === 'forward' ? 1 : -1) * Math.sign(dot(N, sub(evaluateSurface(S, um, vm), c)));
  globalThis.__sph = { outward, area };
  return outward * Math.sign(area) * F;
}
/** A closed B-rep's volume by the oracles: the sphere's Green on spherical faces, D149's Green elsewhere (checked converged). */
function oracleVolume(b) {
  let V = 0;
  for (const f of b.faces) {
    const sph = sphereOf(f.surface);
    if (sph) { V += sphereFlux(b, f, sph) / 3; continue; }
    const a = faceIntegrals(b, f.name, 24).flux, w = faceIntegrals(b, f.name, 48).flux;
    assert.ok(Math.abs(a - w) <= 1e-9 * Math.max(1, Math.abs(w)), `${f.name}: Green not converged (${a} vs ${w})`);
    V += w / 3;
  }
  return V;
}

test('FRk8b the sphere oracle against closed forms: a sphere\'s cap (πh²(3R − h)/3) and a sphere cut by a cylinder off its axis (the two-variable Gauss–Legendre of FRk S0)', () => {
  const XY = { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] }, R = 20, h = 7;
  const s = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'hs', kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [0, -R], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, R] }], plane: XY },
    { id: 'sph', kind: 'revolve', sketch: 'hs', axis: { origin: [0, 0], direction: 'y' }, angle: 360 },
    { id: 'bs', kind: 'sketch', profile: 'rectangle', min: [-30, R - h], max: [30, 30], plane: { origin: [0, 0, -30], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'box', kind: 'extrude', sketch: 'bs', height: 60 },
    { id: 'cap', kind: 'intersect', target: 'sph', tool: 'box' }] });
  const cap = outputOf(s, 'cap').brep, want = Math.PI * h * h * (3 * R - h) / 3, V = oracleVolume(cap);
  assert.ok(Math.abs(V - want) <= 1e-10 * want, `the cap: ${V} vs ${want}`);
  // R 20 ∩ a cylinder r 6 at 9 off its axis: ∫∫ over the disk of 2√(R² − x² − y²), x = 9 + 6 sin u (FRk S0's oracle).
  const gl = (f, a, b, n) => { let I = 0; const h = (b - a) / n; for (let i = 0; i < n; i++) for (let k = 0; k < 8; k++) I += GW[k] * h / 2 * f(a + h * i + h / 2 * (GX[k] + 1)); return I; };
  const want2 = gl(u => { const xx = 9 + 6 * Math.sin(u), hw = 6 * Math.cos(u); return 6 * Math.cos(u) * gl(yy => 2 * Math.sqrt(R * R - xx * xx - yy * yy), -hw, hw, 16); }, -Math.PI / 2, Math.PI / 2, 64);
  const cut = outputOf(evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'hs', kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [0, -R], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, R] }], plane: XY },
    { id: 'sph', kind: 'revolve', sketch: 'hs', axis: { origin: [0, 0], direction: 'y' }, angle: 360 },
    { id: 'cs', kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [15, 0], center: [9, 0], direction: 'ccw' }], plane: { origin: [0, -30, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] } },
    { id: 'cyl', kind: 'extrude', sketch: 'cs', height: 60 }, { id: 'x', kind: 'intersect', target: 'sph', tool: 'cyl' }] }), 'x').brep;
  const V2 = oracleVolume(cut);
  // (The oracles together hold this body to 2e-9: the fitted intersection edges, the cylinder by D149's Green.)
  assert.ok(Math.abs(V2 - want2) <= 1e-8 * want2, `sphere ∩ cylinder: ${V2} vs ${want2}`);
});

test('FRk8b the bevel pair\'s mass: within 1e-5 of the oracles (was 1.4 % above them), the same at 8, 16 and 32 segments a quarter (it moved 35.9 → 38.7 → 38.4), no strip dropped', () => {
  const b = JSON.parse(readFileSync(new URL('./fixtures/frk8b-bevel-pair-4deg.brep.json', import.meta.url), 'utf8'));
  assert.deepEqual([b.faces.length, b.bodies.length], [22, 3]);
  const want = oracleVolume(b), got = brepMassProperties(b, 1).volume;
  assert.ok(Math.abs(got - want) <= 1e-5 * want, `kernel ${got} vs the oracles' ${want} (rel ${Math.abs(got - want) / want})`);
  const runs = [8, 16, 32].map(k => brepQuadratureIntegrals(b, k)), q = runs.map(r => r.integrals[0]);
  assert.ok(Math.max(...q) - Math.min(...q) <= 1e-5 * want, `by the step: ${q.join(', ')}`);
  // (Its flanks' trims along their patches' own sides: every strip integrated now — 2 to 5 a face were dropped.)
  assert.deepEqual(runs.map(r => r.dropped), [0, 0, 0]);
});
