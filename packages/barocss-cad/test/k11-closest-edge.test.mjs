import test from 'node:test';
import assert from 'node:assert/strict';
import { closestPointOnSurface, surfaceSeedGrid, surfaceEvaluator, surfaceDomain, evaluateCadPart } from '../dist/index.js';

// K11 (D211): a point off a patch whose foot lies on the patch's edge. The oracle is a dense scan of the domain, polished by
// shrinking windows (independent of Gauss–Newton).
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function scan(S, U, V, p) {
  let bu = U[0], bv = V[0], bd = Infinity;
  for (let i = 0; i <= 48; i++) for (let j = 0; j <= 48; j++) { const u = U[0] + (U[1] - U[0]) * i / 48, v = V[0] + (V[1] - V[0]) * j / 48, q = S(u, v), d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); if (d < bd) { bd = d; bu = u; bv = v; } }
  let hu = (U[1] - U[0]) / 48, hv = (V[1] - V[0]) / 48;
  for (let round = 0; round < 60; round++) {
    hu /= 2; hv /= 2; let nu = bu, nv = bv;
    for (const du of [-hu, 0, hu]) for (const dv of [-hv, 0, hv]) { const u = Math.min(U[1], Math.max(U[0], bu + du)), v = Math.min(V[1], Math.max(V[0], bv + dv)), q = S(u, v), d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); if (d < bd) { bd = d; nu = u; nv = v; } }
    bu = nu; bv = nv;
  }
  return { u: bu, v: bv, d: bd };
}

test('K11: a foot on a torus patch\'s edge, from a point off it farther than its tube\'s radius — found, in few steps (D211)', () => {
  // (A torus R 20, r 4 about Y: four biquadratic patches. Past an edge the foot is on it; there the step solved in both
  // parameters and clamped kept pointing out, its free part crawled, and where distance × curvature exceeds 1 the step grew
  // from the rounding noise: 30 steps, the foot up to 5e-4 mm short of the nearest.)
  const faces = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'c', kind: 'sketch', profile: 'circle', center: [20, 0], radius: 4 }, { id: 't', kind: 'revolve', sketch: 'c', axis: { origin: [0, 0], direction: 'y' } }] }).output('t').brep.faces.map(f => f.surface);
  const r = rng(5); let edge = 0, capped = 0;
  for (const s of faces) {
    const S = surfaceEvaluator(s), { u: U, v: V } = surfaceDomain(s), grid = surfaceSeedGrid(s);
    for (let k = 0; k < 40; k++) {
      const a = 2 * Math.PI * r(), b = 2 * Math.PI * r(), d = 4 + 12 * r(), rho = 20 + d * Math.cos(b), p = [rho * Math.cos(a), d * Math.sin(b), rho * Math.sin(a)];
      const o = scan(S, U, V, p); if (!(Math.min(o.u - U[0], U[1] - o.u) < 1e-9 || Math.min(o.v - V[0], V[1] - o.v) < 1e-9)) continue;
      const f = closestPointOnSurface(s, p, { grid });
      edge++; if (f.iterations >= 30) capped++;
      assert.ok(Math.abs(f.distance - o.d) <= 1e-9, `${f.distance} vs the scan's ${o.d}`);
    }
  }
  assert.ok(edge >= 60, `${edge} feet on an edge`);
  assert.ok(capped <= edge / 20, `${capped} of ${edge} ran all 30 steps`);
});
