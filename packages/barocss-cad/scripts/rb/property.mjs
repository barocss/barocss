// Property-based tests for the kernel (RB4, L3): our own small harness (seeded generators, shrinking to a
// minimal counterexample) and the metamorphic properties a correct kernel must keep. Used by
// scripts/rb/props.mjs (pnpm rb:props: a fixed seed, ~200 runs a property) and test/property.test.mjs (a few).

import { crossedCase, cylinderBoxCase, grazing, VOLUME_TOL } from './oracle-cases.mjs';

/** A seeded generator (mulberry32): the same seed, the same cases. */
export function random(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A number in [lo, hi] rounded to 3 decimals (generic: coincidences are RB5's job). */
const num = (rnd, lo, hi) => Math.round((lo + (hi - lo) * rnd()) * 1000) / 1000;

/**
 * Runs `prop` on `runs` values from `gen`; on a failure, shrinks the value (each candidate from `shrink` that
 * still fails replaces it) and reports the smallest. `prop` returns true, false, or 'skip' (a refusal the
 * property does not judge); it may throw (a crash fails it).
 */
export function forAll({ name, runs, seed, gen, shrink, prop }) {
  const rnd = random(seed), t0 = performance.now(), times = [];
  let passed = 0, skipped = 0;
  const judge = v => { try { return prop(v); } catch (cause) { return { crash: String(cause?.message ?? cause).slice(0, 200) }; } };
  for (let k = 0; k < runs; k++) {
    const value = gen(rnd), t = performance.now(), r = judge(value);
    times.push(performance.now() - t);
    if (r === true) { passed++; continue; }
    if (r === 'skip') { skipped++; continue; }
    // Shrink: keep taking a smaller failing candidate (at most 200 steps).
    let smallest = value, why = r;
    for (let step = 0, better = true; better && step < 200; step++) {
      better = false;
      for (const c of shrink(smallest)) { const rc = judge(c); if (rc !== true && rc !== 'skip') { smallest = c; why = rc; better = true; break; } }
    }
    return { name, runs: k + 1, passed, skipped, failed: { run: k, value, smallest, why }, seed, ms: performance.now() - t0, times };
  }
  return { name, runs, passed, skipped, failed: null, seed, ms: performance.now() - t0, times };
}

// ---- generators -----------------------------------------------------------------------------------------
/** A box or cylinder standing on z: its parameters as plain data (shrinkable). */
function prim(rnd) {
  const z0 = num(rnd, -4, 4), h = num(rnd, 1, 8);
  // Half of them tilted by a generic angle about X or Y: out of the upright family, into the general Booleans.
  const tilt = rnd() < 0.5 ? { axis: rnd() < 0.5 ? 'x' : 'y', angle: num(rnd, 5, 85) } : null;
  if (rnd() < 0.5) { const x = num(rnd, -8, 6), y = num(rnd, -8, 6); return { kind: 'box', x, y, w: num(rnd, 1, 8), d: num(rnd, 1, 8), z0, h, tilt }; }
  return { kind: 'cyl', x: num(rnd, -6, 6), y: num(rnd, -6, 6), r: num(rnd, 0.5, 5), z0, h, tilt };
}
/** A primitive's features, its last one named `id` (the solid). */
function features(p, id) {
  const body = p.tilt ? `${id}0` : id, out = p.kind === 'box'
    ? [{ id: `${id}s`, kind: 'sketch', profile: 'rectangle', min: [p.x, p.y], max: [p.x + p.w, p.y + p.d] }, { id: body, kind: 'extrude', sketch: `${id}s`, height: p.h, from: p.z0 }]
    : [{ id: `${id}s`, kind: 'sketch', profile: 'circle', center: [p.x, p.y], radius: p.r }, { id: body, kind: 'extrude', sketch: `${id}s`, height: p.h, from: p.z0 }];
  if (p.tilt) out.push({ id, kind: 'rotate', target: body, axis: p.tilt.axis, angleDegrees: p.tilt.angle, pivot: [0, 0, 0] });
  return out;
}
/** Smaller versions of a primitive: integer coordinates, halved sizes, moved to the origin. */
function shrinkPrim(p) {
  const out = [], round = q => Object.fromEntries(Object.entries(q).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : v]));
  if (p.tilt) out.push({ ...p, tilt: null });
  const r = round(p); if (JSON.stringify(r) !== JSON.stringify(p) && (r.kind !== 'box' || (r.w >= 1 && r.d >= 1)) && r.h >= 1 && (r.kind !== 'cyl' || r.r >= 0.5)) out.push(r);
  for (const k of ['x', 'y', 'z0']) if (p[k] !== 0) out.push({ ...p, [k]: 0 });
  for (const k of ['w', 'd', 'h', 'r']) if (p[k] !== undefined && p[k] > 1) out.push({ ...p, [k]: Math.max(1, Math.round(p[k] / 2 * 1000) / 1000) });
  return out;
}
export const pairs = { gen: rnd => ({ a: prim(rnd), b: prim(rnd) }), shrink: v => [...shrinkPrim(v.a).map(a => ({ ...v, a })), ...shrinkPrim(v.b).map(b => ({ ...v, b }))] };

const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
/**
 * How closely a mass method's volume is known (relative): closed forms and planar bodies to rounding, the
 * quadrature over Boolean-trimmed curved faces to about 1e-5 (D4), a tessellation to its chord error.
 */
const METHOD_TOL = { 'closed-form': 1e-9, 'planar-exact': 1e-9, quadrature: 2e-5, tessellated: 2e-3 };
let lastTol = 1e-9;
/**
 * The total volume of a document's outputs (0 when it has none); 'skip' when the kernel refuses it (a typed
 * error). `lastTol` is left at the loosest of their methods' accuracies (see `tolOf`).
 */
function volumeOf(cad, doc) {
  try {
    let tol = 1e-9, v = 0;
    for (const o of cad.evaluateCadPart(doc).outputs) { const m = cad.massPropertiesOf(o); v += m.volume; tol = Math.max(tol, METHOD_TOL[m.method] ?? 2e-3); }
    lastTol = tol; return v;
  } catch (cause) { if (cause?.name && !['TypeError', 'RangeError', 'ReferenceError', 'Error'].includes(cause.name)) return 'skip'; throw cause; }
}
/** The loosest accuracy of the volumes of `docs` (each evaluated again: cached by the kernel's snapshot). */
function tolOf(cad, docs) { let t = 1e-9; for (const d of docs) { if (volumeOf(cad, d) !== 'skip') t = Math.max(t, lastTol); } return t; }
const op = (v, kind, swap = false) => D([...features(v.a, 'A'), ...features(v.b, 'B'), { id: 'X', kind, target: swap ? 'B' : 'A', tool: swap ? 'A' : 'B' }]);
const close = (x, y, scale, tol) => Math.abs(x - y) <= tol * scale;

/** The properties, each over its generator; `cad` is the kernel module. */
export function properties(cad) {
  return [
    { name: 'inclusion–exclusion: |A∪B| + |A∩B| = |A| + |B|', ...pairs, prop: v => {
      const a = volumeOf(cad, D(features(v.a, 'A'))), b = volumeOf(cad, D(features(v.b, 'B'))), u = volumeOf(cad, op(v, 'union')), i = volumeOf(cad, op(v, 'intersect'));
      if ([a, b, u, i].includes('skip')) return 'skip';
      const tol = tolOf(cad, [op(v, 'union'), op(v, 'intersect')]);
      return close(u + i, a + b, a + b, tol) || { u, i, a, b, tol };
    } },
    { name: 'difference: |A−B| + |A∩B| = |A|', ...pairs, prop: v => {
      const a = volumeOf(cad, D(features(v.a, 'A'))), d = volumeOf(cad, op(v, 'difference')), i = volumeOf(cad, op(v, 'intersect'));
      if ([a, d, i].includes('skip')) return 'skip';
      const tol = tolOf(cad, [op(v, 'difference'), op(v, 'intersect')]);
      return close(d + i, a, a, tol) || { d, i, a, tol };
    } },
    { name: 'commutativity: |A∪B| = |B∪A|, |A∩B| = |B∩A|', ...pairs, prop: v => {
      const u1 = volumeOf(cad, op(v, 'union')), u2 = volumeOf(cad, op(v, 'union', true)), i1 = volumeOf(cad, op(v, 'intersect')), i2 = volumeOf(cad, op(v, 'intersect', true));
      if ([u1, u2, i1, i2].includes('skip')) return 'skip';
      const tol = tolOf(cad, [op(v, 'union'), op(v, 'union', true), op(v, 'intersect'), op(v, 'intersect', true)]);
      return (close(u1, u2, u1, tol) && close(i1, i2, Math.max(i1, u1), tol)) || { u1, u2, i1, i2, tol };
    } },
    { name: 'rigid motions exact in binary64 (quarter turns, power-of-two moves) keep the volume of A∪B', ...pairs, prop: v => {
      const base = volumeOf(cad, op(v, 'union')); if (base === 'skip') return 'skip';
      const moved = volumeOf(cad, D([...op(v, 'union').features, { id: 'R', kind: 'rotate', target: 'X', axis: 'z', angleDegrees: 90 }, { id: 'T', kind: 'translate', target: 'R', offset: [8, -4, 0.5] }, { id: 'Q', kind: 'rotate', target: 'T', axis: 'x', angleDegrees: 180 }]));
      if (moved === 'skip') return 'skip';
      const tol = Math.max(tolOf(cad, [op(v, 'union')]), lastTol);
      return close(moved, base, base, tol) || { base, moved, tol };
    } },
    { name: 'a uniform scale s multiplies the volume of A∪B by s³', gen: rnd => ({ ...pairs.gen(rnd), s: [0.5, 2, 3, 0.25][Math.floor(rnd() * 4)] }), shrink: v => pairs.shrink(v).map(x => ({ ...x, s: v.s })), prop: v => {
      const base = volumeOf(cad, op(v, 'union')); if (base === 'skip') return 'skip';
      const scaled = volumeOf(cad, D([...op(v, 'union').features, { id: 'S', kind: 'scale', target: 'X', factor: v.s }]));
      if (scaled === 'skip') return 'skip';
      const tol = Math.max(tolOf(cad, [op(v, 'union')]), lastTol);
      return close(scaled, base * v.s ** 3, base * v.s ** 3, tol) || { base, scaled, s: v.s, tol };
    } },
    { name: 'knot insertion and degree elevation of a curved face keep the mass', gen: rnd => ({ bump: num(rnd, -3, 3), side: num(rnd, 2, 10), knot: num(rnd, 0.1, 0.9) }),
      shrink: v => [{ ...v, bump: Math.round(v.bump) }, { ...v, side: Math.round(v.side) }, { ...v, knot: 0.5 }].filter(x => JSON.stringify(x) !== JSON.stringify(v)), prop: v => {
        const top = pillowTop(v), ref = cad.insertSurfaceKnot(top, { axis: 'u', knot: v.knot, insertions: 1 }).refined, ele = cad.elevateSurfaceBezierAxisDegree(top, { axis: 'v', targetDegree: 3 }).elevated;
        const vol = t => volumeOf(cad, D([{ id: 'p', kind: 'sew', surfaces: [t, ...pillowSides(v)] }]));
        const a = vol(top), b = vol(ref), c = vol(ele);
        if ([a, b, c].includes('skip')) return 'skip';
        return (close(a, b, a, 1e-9) && close(a, c, a, 1e-9)) || { a, b, c };
      } },
    { name: 'fillet volume falls as the radius grows, at most at the rate of its edges (Lipschitz)', gen: rnd => ({ w: num(rnd, 8, 40), d: num(rnd, 8, 40), h: num(rnd, 6, 20), r1: num(rnd, 0.2, 2.5), dr: num(rnd, 0.01, 1) }),
      shrink: v => [{ ...v, w: Math.round(v.w) }, { ...v, d: Math.round(v.d) }, { ...v, h: Math.round(v.h) }, { ...v, r1: Math.round(v.r1 * 10) / 10 || 0.2 }].filter(x => JSON.stringify(x) !== JSON.stringify(v)), prop: v => {
        const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [v.w, v.d] }, { id: 'e', kind: 'extrude', sketch: 's', height: v.h }];
        const top = cad.evaluateCadPart(D(box)).outputs[0].brep.edges.map(e => e.name).filter(n => /top/.test(n));
        const at = r => volumeOf(cad, D([...box, { id: 'f', kind: 'fillet', target: 'e', edges: top, radius: r }]));
        const r2 = v.r1 + v.dr, a = at(v.r1), b = at(r2);
        if (a === 'skip' || b === 'skip') return 'skip';
        // −dV/dr along a straight edge is (2 − π/2)·r a unit of length; corners take less.
        const bound = (2 - Math.PI / 2) * r2 * 2 * (v.w + v.d) * v.dr;
        return (b < a && a - b <= bound * (1 + 1e-9)) || { a, b, bound };
      } },
    { name: 'translational fillets (R10.1, D88): a rod on a plate or a groove in it, the edge along it filleted, against the closed-form section', gen: rnd => {
        const rho = num(rnd, 2, 8);
        return { rho, c: num(rnd, -0.8 * rho, 0.8 * rho), r: num(rnd, 0.2, 3), groove: rnd() < 0.5 };
      },
      shrink: v => [{ ...v, rho: Math.round(v.rho) || 2 }, { ...v, c: 0 }, { ...v, r: Math.round(v.r * 10) / 10 || 0.2 }, { ...v, groove: false }].filter(x => JSON.stringify(x) !== JSON.stringify(v)), prop: v => {
        const body = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, -30], max: [40, 30] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 20 },
          { id: 'c', kind: 'sketch', profile: 'circle', center: [0, 20 + v.c], radius: v.rho, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'ce', kind: 'extrude', sketch: 'c', height: 40 },
          { id: 'u', kind: v.groove ? 'difference' : 'union', target: 'pe', tool: 'ce' }];
        let edge; try { edge = cad.evaluateCadPart(D(body)).outputs[0].brep.edges.find(e => e.curve.degree === 1 && /ce\.side0/.test(e.name) && /pe\.top/.test(e.name) && e.curve.controlPoints[0][1] > 0)?.name; } catch { return 'skip'; }
        if (!edge) return 'skip';
        const a = volumeOf(cad, D(body)), b = volumeOf(cad, D([...body, { id: 'f', kind: 'fillet', target: 'u', edges: [edge], radius: v.r }]));
        if (a === 'skip' || b === 'skip') return 'skip';
        // In (y, z − 20): the ball r above the top (a rod) or below it (a groove's rim), ρ + r from the axis (0, c).
        const s = v.groove ? -1 : 1, yc = Math.sqrt((v.rho + v.r) ** 2 - (s * v.r - v.c) ** 2), C = [yc, s * v.r], A0 = [0, v.c];
        const d = Math.hypot(C[0] - A0[0], C[1] - A0[1]), X = [Math.sqrt(v.rho ** 2 - v.c ** 2), 0], T1 = [yc, 0], T2 = [A0[0] + v.rho * (C[0] - A0[0]) / d, A0[1] + v.rho * (C[1] - A0[1]) / d];
        const exact = 40 * sectionArea([{ kind: 'line', start: X }, arcTo(T1, C, T2), arcTo(T2, A0, X)]), got = v.groove ? a - b : b - a;
        return Math.abs(got - exact) <= 1e-8 * exact + 1e-10 * a || { got, exact, rel: got / exact - 1 };
      } },
    { name: 'coaxial fillets (R10.1, D88): a turned wall meeting a cone, the rim filleted, against Pappus', gen: rnd => {
        const R = num(rnd, 4, 12);
        return { R, h: num(rnd, 4, 12), top: num(rnd, 0.2, 0.9), hc: num(rnd, 2, 10), r: num(rnd, 0.2, 3) };
      },
      shrink: v => [{ ...v, R: Math.round(v.R) }, { ...v, h: Math.round(v.h) }, { ...v, hc: Math.round(v.hc) }, { ...v, r: Math.round(v.r * 10) / 10 || 0.2 }].filter(x => JSON.stringify(x) !== JSON.stringify(v)), prop: v => {
        const Rt = Math.round(v.R * v.top * 1000) / 1000, H = v.h + v.hc;
        const body = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [v.R, 0], [v.R, v.h], [Rt, H], [0, H]], plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } }, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }];
        let edge; try { edge = cad.evaluateCadPart(D(body)).outputs[0].brep.edges.find(e => /side1#1/.test(e.name) && /side2#1/.test(e.name))?.name; } catch { return 'skip'; }
        if (!edge) return 'skip';
        const a = volumeOf(cad, D(body)), filleted = D([...body, { id: 'f', kind: 'fillet', target: 'r', edges: [edge], radius: v.r }]), b = volumeOf(cad, filleted), tol = lastTol;
        if (a === 'skip') return 'skip';
        // (A typed refusal is not judged; the analytic Boolean failing on the tool — it touches the cone tangentially
        // along a circle — is a failure, the S0 method's too: a TODO, robustness/properties-todo.json.)
        if (b === 'skip') { try { cad.evaluateCadPart(filleted); } catch (cause) { if (/not a manifold solid/.test(cause.message)) return { boolean: cause.message.slice(0, 160) }; } return 'skip'; }
        // The meridian corner at (R, h): down the wall, up the cone; the ball r from both, on the bisector.
        const P = [v.R, v.h], w1 = [0, -1], l = Math.hypot(Rt - v.R, v.hc), w2 = [(Rt - v.R) / l, v.hc / l], alpha = Math.acos(w1[0] * w2[0] + w1[1] * w2[1]);
        const t = v.r / Math.tan(alpha / 2), b2 = [w1[0] + w2[0], w1[1] + w2[1]], bl = Math.hypot(...b2), k = v.r / Math.sin(alpha / 2);
        const T1 = [P[0] + w1[0] * t, P[1] + w1[1] * t], T2 = [P[0] + w2[0] * t, P[1] + w2[1] * t], C = [P[0] + b2[0] / bl * k, P[1] + b2[1] / bl * k];
        const exact = 2 * Math.PI * sectionMoments([{ kind: 'line', start: P }, arcTo(T1, C, T2), { kind: 'line', start: T2 }]).M;
        // (To the filleted body's mass method: quadrature, or — where its finer pass cannot place a mesh point on the
        // torus, D88 — the tessellation, each to its stated accuracy.)
        return Math.abs(a - b - exact) <= Math.max(1e-9, tol) * a || { got: a - b, exact, ofPart: (a - b - exact) / a, tol };
      } },
    { name: 'exact oracles: a cylinder against a box turned about X, Y or Z (or grazing it), and crossed cylinders', gen: oracleGen, shrink: oracleShrink, prop: v => {
      const c = oracleCaseOf(v);
      let outputs; try { outputs = cad.evaluateCadPart(D(c.features)).outputs; } catch (cause) { if (cause?.name && !['TypeError', 'RangeError', 'ReferenceError', 'Error'].includes(cause.name)) return 'skip'; throw cause; }
      if (c.volume <= 0) return outputs.length === 0 || { outputs: outputs.length, exact: 0 };
      if (outputs.length !== 1) return { outputs: outputs.length, exact: c.volume };
      const m = cad.massPropertiesOf(outputs[0]), tol = Math.max(VOLUME_TOL.relTol * c.volume, VOLUME_TOL.absTol), off = Math.hypot(...m.centroid.map((x, k) => x - c.centroid[k]));
      return (Math.abs(m.volume - c.volume) <= tol && off <= Math.max(1e-6, 1e-11 / c.volume)) || { volume: m.volume, exact: c.volume, centroidOff: off, method: m.method };
    } },
    { name: 'mass by quadrature and by a finer and finer tessellation agree (the chord error falls)', ...pairs, prop: v => {
      let o; try { o = cad.evaluateCadPart(op(v, 'union')).outputs; } catch (cause) { if (cause?.name && !['TypeError', 'RangeError', 'ReferenceError', 'Error'].includes(cause.name)) return 'skip'; throw cause; }
      for (const out of o) {
        const exact = cad.massPropertiesOf(out).volume, coarse = cad.brepMassProperties(out.brep, 1, { quadratureSegments: 0, segmentsPerQuarter: 8 }).volume, fine = cad.brepMassProperties(out.brep, 1, { quadratureSegments: 0, segmentsPerQuarter: 32 }).volume;
        const ec = Math.abs(coarse - exact), ef = Math.abs(fine - exact);
        if (!(ef <= ec + 1e-9 * exact && ef <= 2e-3 * exact)) return { exact, coarse, fine };
      }
      return true;
    } },
  ];
}

/** The short arc from `start` about `center` (to the next segment's start). */
const arcTo = (start, center, end) => ({ kind: 'arc', start, center, direction: ((start[0] - center[0]) * (end[1] - center[1]) - (start[1] - center[1]) * (end[0] - center[0])) > 0 ? 'ccw' : 'cw' });
/** The area and first moment about x = 0 (∫∫ x dA) of a closed loop of lines and arcs (each ending at the next one's
 * start), exactly (Green's theorem). */
function sectionMoments(loop) {
  let A = 0, M = 0;
  loop.forEach((s, i) => {
    const p = s.start, q = loop[(i + 1) % loop.length].start;
    if (s.kind === 'line') { A += (p[0] * q[1] - q[0] * p[1]) / 2; M += (q[1] - p[1]) * (p[0] ** 2 + p[0] * q[0] + q[0] ** 2) / 6; return; }
    const [cx, cy] = s.center, r = Math.hypot(p[0] - cx, p[1] - cy), a0 = Math.atan2(p[1] - cy, p[0] - cx), b = Math.atan2(q[1] - cy, q[0] - cx), T = 2 * Math.PI;
    const d = s.direction === 'ccw' ? ((b - a0) % T + T) % T : -(((a0 - b) % T + T) % T), a1 = a0 + d;
    A += (cx * r * (Math.sin(a1) - Math.sin(a0)) - cy * r * (Math.cos(a1) - Math.cos(a0)) + r * r * d) / 2;
    const F = t => cx * cx * r * Math.sin(t) + 2 * cx * r * r * (t / 2 + Math.sin(2 * t) / 4) + r ** 3 * (Math.sin(t) - Math.sin(t) ** 3 / 3);
    M += (F(a1) - F(a0)) / 2;
  });
  return { A: Math.abs(A), M: Math.abs(M) };
}
const sectionArea = loop => sectionMoments(loop).A;

// ---- exact oracles (D25) ---------------------------------------------------------------------------------
/**
 * A member of the oracle families as plain data: a cylinder and a box turned about X, Y or Z by any angle
 * (combined by intersect or difference), a quarter of them grazing (the box's outermost edge 10 µm to 100 nm
 * into the wall: at least 100 tolerances, RB5 owns closer), or (a quarter) two cylinders crossing obliquely.
 */
function oracleGen(rnd) {
  if (rnd() < 0.25) return { kind: 'crossed', a: num(rnd, 0.5, 4), b: num(rnd, 0.5, 4), angle: num(rnd, 10, 90) };
  const box = { x: num(rnd, -6, 2), y: num(rnd, -6, 2), w: num(rnd, 1, 8), d: num(rnd, 1, 8), z0: num(rnd, -3, 3), h: num(rnd, 1, 8) };
  const cyl = { x: num(rnd, -4, 4), y: num(rnd, -4, 4), r: num(rnd, 0.5, 5), z0: num(rnd, -4, 2), h: num(rnd, 1, 8) };
  return { kind: 'box', axis: ['x', 'y', 'z'][Math.floor(rnd() * 3)], angle: num(rnd, 0, 180), op: rnd() < 0.5 ? 'intersect' : 'difference', box, cyl, graze: rnd() < 0.25 ? [1e-2, 1e-3, 1e-4][Math.floor(rnd() * 3)] : null };
}
function oracleShrink(v) {
  const out = [];
  if (v.kind === 'crossed') { for (const k of ['a', 'b', 'angle']) if (Math.round(v[k]) !== v[k] && Math.round(v[k]) >= (k === 'angle' ? 10 : 1)) out.push({ ...v, [k]: Math.round(v[k]) }); return out; }
  if (v.graze !== null) out.push({ ...v, graze: null });
  if (v.op !== 'intersect') out.push({ ...v, op: 'intersect' });
  if (Math.round(v.angle) !== v.angle) out.push({ ...v, angle: Math.round(v.angle) });
  for (const part of ['box', 'cyl']) for (const k of Object.keys(v[part])) {
    const x = Math.round(v[part][k]); if (x !== v[part][k] && (!['w', 'd', 'h', 'r'].includes(k) || x >= 1)) out.push({ ...v, [part]: { ...v[part], [k]: x } });
  }
  return out;
}
/** The document and exact values of a generated member. */
function oracleCaseOf(v) {
  if (v.kind === 'crossed') return crossedCase(v.a, v.b, v.angle);
  const box = { min: [v.box.x, v.box.y, v.box.z0], max: [v.box.x + v.box.w, v.box.y + v.box.d, v.box.z0 + v.box.h] };
  const cyl = v.graze === null ? { cx: v.cyl.x, cy: v.cyl.y, r: v.cyl.r, z0: v.cyl.z0, z1: v.cyl.z0 + v.cyl.h } : grazing({ r: v.cyl.r }, box, v.axis, v.angle, v.graze);
  return cylinderBoxCase(cyl, box, v.axis, v.angle, v.op);
}

/** A square pillow's top: a quadratic Bézier patch, flat at its border (z = 4), its middle pole raised by `bump`. */
function pillowTop(v) {
  const s = v.side, z = 4, P = [0, 1, 2].map(i => [0, 1, 2].map(j => [s * i / 2, s * j / 2, z + (i === 1 && j === 1 ? v.bump : 0)]));
  return { kind: 'surface', id: 'top', degreeU: 2, degreeV: 2, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 0, 1, 1, 1], controlPoints: P, weights: P.map(r => r.map(() => 1)) };
}
/** The pillow's five flat sides (a box 4 mm tall under its top). */
function pillowSides(v) {
  const s = v.side, q = (a, b, c, d) => ({ degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[a, b], [c, d]], weights: [[1, 1], [1, 1]] });
  return [q([0, 0, 0], [0, s, 0], [s, 0, 0], [s, s, 0]), q([0, 0, 0], [s, 0, 0], [0, 0, 4], [s, 0, 4]), q([0, s, 0], [0, s, 4], [s, s, 0], [s, s, 4]), q([0, 0, 0], [0, 0, 4], [0, s, 0], [0, s, 4]), q([s, 0, 0], [s, s, 0], [s, 0, 4], [s, s, 4])];
}
