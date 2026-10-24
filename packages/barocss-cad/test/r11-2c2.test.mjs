import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, evaluateSurfaceCurvature, nurbsOf } from '../dist/index.js';
import { evaluateSurfaceD1 } from '../dist/core/derivatives.js';
import { evaluateCurve } from '../dist/core/math.js';
import { tessellateBrep } from '../dist/brep/brep-tessellate.js';

// R11.2c-2 (D113): shells of bodies whose smooth regions (freeform or trimmed faces) meet planes that bound the body at
// sharp edges — the wall the union of a band per bounding plane (from the wall inside to 1.37 walls out, unbounded along
// the plane, so its face's outline and any growth do not matter) and a slab per region (the region offset in by the wall
// and out by its reach, closed along its edges by bands ruled along its normals), the shell the body within it; a face
// opened beside a region by first extending the body through it. Both bodies were refused on HEAD (a conic-bounded
// plane, a curve-trimmed cylinder). Oracles in closed form: the conic-filleted box is a prism along X, so its hollow is
// its section eroded; the closed pipe tee's wall is its faces' normal bands less their overlaps at its caps' circles.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const refused = (features, code, pattern) => assert.throws(() => out(features), e => (e.details?.category ?? e.code) === code && pattern.test(e.message), String(pattern));
const yzAt = x => ({ origin: [x, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] });
const GL8 = [[-0.9602898564975363, 0.1012285362903763], [-0.7966664774136267, 0.2223810344533745], [-0.5255324099163290, 0.3137066458778873], [-0.1834346424956498, 0.3626837833783620], [0.1834346424956498, 0.3626837833783620], [0.5255324099163290, 0.3137066458778873], [0.7966664774136267, 0.2223810344533745], [0.9602898564975363, 0.1012285362903763]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const valid = (o, what) => { const r = checkBrep(o.brep, { strict: true }); assert.equal(r.valid, true, `${what}: ${r.issues}`); };
/** Over each coedge of a face's loops, by Gauss–Legendre on its knot spans (four pieces each): Σ f(p, p') ds. */
function alongLoops(b, face, f) {
  const loops = new Map(b.loops.map(l => [l.id, l])), coedges = new Map(b.coedges.map(c => [c.id, c])), edges = new Map(b.edges.map(e => [e.id, e]));
  let I = 0;
  for (const lid of face.loops) for (const cid of loops.get(lid).coedges) {
    const c = coedges.get(cid), C = edges.get(c.edge).curve, ks = [...new Set(C.knots)], s = c.sense === 'forward' ? 1 : -1;
    for (let k = 0; k + 1 < ks.length; k++) for (let q = 0; q < 4; q++) for (const [x, w] of GL8) {
      const h = (ks[k + 1] - ks[k]) / 4, u = ks[k] + h * (q + (x + 1) / 2), e = 1e-7 * (ks[k + 1] - ks[k]), up = Math.min(ks.at(-1), u + e), dn = Math.max(ks[0], u - e);
      const p = evaluateCurve(C, u), a = evaluateCurve(C, up), z = evaluateCurve(C, dn), d = [0, 1, 2].map(i => s * (a[i] - z[i]) / (up - dn));
      I += f(p, d) * h / 2 * w;
    }
  }
  return I;
}

// ---- The conic-filleted box: 40 × 30 × 20, its edge y = 0, z = 20 rounded by a conic (ρ 0.5) of 3 ----
const BOX = [{ id: 'q', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 'q', height: 20 }, { id: 'f', kind: 'fillet', target: 'e', edges: ['e.side0|e.top'], radius: 3, section: { kind: 'conic', rho: 0.5 } }];
/** Its section (the end face at x = 0): area by Green's theorem ½∮(y dz − z dy), perimeter ∮ ds, over its own edges. */
function section() {
  const b = out(BOX).brep, end = b.faces.find(f => f.loops.length === 1 && nurbsOf(f).controlPoints.flat().every(p => Math.abs(p[0]) < 1e-9));
  return { A: Math.abs(alongLoops(b, end, (p, d) => (p[1] * d[2] - p[2] * d[1]) / 2)), P: alongLoops(b, end, (_, d) => Math.hypot(...d)) };
}

test('R11.2c-2 a box with a conic-filleted edge shelled closed and open at the bottom: its section eroded, × (40 − 2t) (refused on HEAD: a plane bounded by the conic)', () => {
  const { A, P } = section(), V = 40 * A;
  // The section's turning: three right angles and the conic's quarter turn. Eroded by t it keeps
  // A − Pt + t²(Σ cot(α/2) + ½∫κ ds) = A − Pt + (3 + π/4)t² (the wall below the conic's least radius, 2.12 mm);
  // with the bottom open, A − (P − 30)t + (1 + π/4)t² (only the top right corner between two kept sides).
  // (The body's own volume is 40 A: a check on the quadrature.)
  assert.ok(Math.abs(A / (out(BOX).massProperties(1).volumeMM3 / 40) - 1) < 1e-9 && P > 98 && P < 99, `${A} ${P}`);
  for (const t of [1, 2]) {
    const closed = out([...BOX, { id: 'sh', kind: 'shell', target: 'f', thickness: t }]), open = out([...BOX, { id: 'sh', kind: 'shell', target: 'f', thickness: t, open: ['e.bottom'] }]);
    valid(closed, `closed t ${t}`); valid(open, `open t ${t}`);
    assert.equal(closed.brep.shells.length, 2); assert.equal(open.brep.shells.length, 1);
    const ec = V - (40 - 2 * t) * (A - P * t + (3 + Math.PI / 4) * t * t), eo = V - (40 - 2 * t) * (A - (P - 30) * t + (1 + Math.PI / 4) * t * t);
    for (const [o, e, what] of [[closed, ec, 'closed'], [open, eo, 'open']]) {
      const m = o.massProperties(1);
      assert.equal(m.method, 'quadrature', what);
      assert.ok(Math.abs(m.volumeMM3 / e - 1) < 1e-7, `${what} t ${t}: ${m.volumeMM3} vs ${e} (${(m.volumeMM3 - e) / e})`);
    }
  }
});

// ---- The filleted pipe tee (D112), its ends kept ----
const TEE = [{ id: 'as', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: yzAt(0) }, { id: 'a', kind: 'extrude', sketch: 'as', height: 60 }, { id: 'bs', kind: 'sketch', profile: 'circle', center: [30, 0], radius: 5 }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 25 }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }, { id: 'f', kind: 'fillet', target: 'u', edges: ['a.side0#1|b.side0#2#4'], radius: 2 }];
function patchBand(f, t) {
  const S = nurbsOf(f), sg = f.sense === 'forward' ? 1 : -1, ku = [...new Set(S.knotsU)], kv = [...new Set(S.knotsV)];
  let V = 0;
  for (let a = 0; a + 1 < ku.length; a++) for (let c = 0; c + 1 < kv.length; c++) for (let su = 0; su < 2; su++) for (let sv = 0; sv < 2; sv++) for (const [x, wx] of GL8) for (const [y, wy] of GL8) {
    const hu = (ku[a + 1] - ku[a]) / 2, hv = (kv[c + 1] - kv[c]) / 2, u = ku[a] + hu * (su + (x + 1) / 2), v = kv[c] + hv * (sv + (y + 1) / 2), r = evaluateSurfaceCurvature(S, u, v), d = evaluateSurfaceD1(S, u, v);
    V += (t + sg * r.meanCurvaturePerMM * t * t + r.gaussianCurvaturePerMM2 * t ** 3 / 3) * Math.hypot(...cross(d.du, d.dv)) * hu * hv / 4 * wx * wy;
  }
  return V;
}
/** The tee's wall with the named ends kept: its faces' normal bands (D112's), the kept caps' discs × t, less each kept cap's overlap with its pipe, 2π(r − t/2)t². */
function teeWall(t, kept) {
  // (Each pipe's frame: across its axis X, Y and along it H, for points; its axis's direction for a curve's derivative.)
  const b = out(TEE).brep, main = [p => [p[1], p[2], p[0]], d => [d[1], d[2]]], branch = [p => [p[0] - 30, p[1], p[2]], d => [d[0], d[1]]];
  const area = (f, [frame, along], r) => Math.abs(r * alongLoops(b, f, (p, d) => { const [X, Y, H] = frame(p), [dX, dY] = along(d); return -H * (X * dY - Y * dX) / (X * X + Y * Y); }));
  let V = 0;
  for (const f of b.faces) {
    if (/^a\.side0/.test(f.name)) V += area(f, main, 10) * (t - t * t / 20);
    else if (/^b\.side0/.test(f.name)) V += area(f, branch, 5) * (t - t * t / 10);
    else if (/^f\./.test(f.name)) V += patchBand(f, t);
  }
  for (const n of kept) { const r = n === 'b.top' ? 5 : 10; V += Math.PI * r * r * t - 2 * Math.PI * (r - t / 2) * t * t; }
  return V;
}

test('R11.2c-2 the filleted pipe tee shelled closed, and with its branch\'s end opened (the body run out through it first): its faces\' bands less the caps\' overlaps (refused on HEAD: a trimmed cylinder)', () => {
  for (const [open, t] of [[[], 1], [[], 2], [['b.top'], 1]]) {
    const o = out([...TEE, { id: 'sh', kind: 'shell', target: 'f', thickness: t, open }]), what = `open [${open}] t ${t}`;
    valid(o, what);
    assert.equal(o.brep.shells.length, open.length ? 1 : 2, what);
    const m = o.massProperties(1), e = teeWall(t, ['a.top', 'a.bottom', 'b.top'].filter(n => !open.includes(n)));
    assert.equal(m.method, 'quadrature', what);
    assert.ok(Math.abs(m.volumeMM3 / e - 1) < 2e-6, `${what}: ${m.volumeMM3} vs ${e} (${(m.volumeMM3 - e) / e})`);
    if (t === 1 && !open.length) for (const q of [8, 16]) assert.ok(tessellateBrep(o.brep, { segmentsPerQuarter: q }).indices.length > 0, `${what}: ${q} a quarter`);
  }
});

test('R11.2c-2 refused by name: two smooth regions meeting sharply (an unfilleted tee), a plane the body crosses beside a region, an opened curved face beside a region', () => {
  const bare = TEE.slice(0, 5);
  refused([...bare, { id: 'sh', kind: 'shell', target: 'u', thickness: 1 }], 'CAPABILITY', /\[SHELL_REGIONS_SHARP\] faces [ab]\.side0#\d and [ab]\.side0#\d of two smooth regions meet at a sharp edge/);
  // A pocket in the conic box's floor: its floor is a plane the body crosses, beside its walls.
  const pocket = [...BOX, { id: 'p', kind: 'sketch', profile: 'rectangle', min: [10, 10], max: [30, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 5 }, { id: 'd', kind: 'difference', target: 'f', tool: 'pe' }];
  refused([...pocket, { id: 'sh', kind: 'shell', target: 'd', thickness: 1 }], 'CAPABILITY', /\[SHELL_PLANE_NOT_BOUNDING\] face pe\.\w+ is a plane the body crosses/);
  const fillet = out(TEE).brep.faces.find(f => /^f\./.test(f.name)).name;
  refused([...TEE, { id: 'sh', kind: 'shell', target: 'f', thickness: 1, open: [fillet] }], 'CAPABILITY', /\[SHELL_OPENING_NOT_PLANAR\] the opened face f\.face#\d+ lies beside a smooth region and is not a plane/);
});
