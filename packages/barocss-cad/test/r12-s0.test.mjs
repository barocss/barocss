import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, evaluateCurve, curveDomain, faceGeometry, writeDxf, checkOutput, massPropertiesOf, surfaceAreaOf, exportStep } from '../dist/index.js';

// R12 S0 (D115): the feasibility checkpoint before sheet metal. No research note; probed here against closed forms:
// whether today's kernel builds a sheet's pieces exactly (a contour flange as one section extruded; an edge flange, any
// angle, either way, full or part width, as a section unioned onto a plate; a relief as a difference; a tray of four
// flanges with holes), and whether its B-rep can be unfolded — the skin found from a fixed face across smooth edges, planes
// moved rigidly and bends developed at the neutral radius R + K·T — against the kernel's own volume (flat area = V/T +
// (K − ½)·T·Σθw, the K-factor's definition), the textbook flat length h + θ(R + K·T), and the DXF writer (R11b) taking the
// flat outline. No product code changed.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const xzAt = y => ({ origin: [0, y, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] });

/**
 * An edge flange's section in a plane square to the plate's edge at x = 0 (the plate at x ≥ 0, z ∈ [0, T]): the bend
 * outside the plate (its tangent line on the edge), inner radius R, turned `deg` degrees up (towards +z) or down, then a
 * straight leg `h` long. As a loop of lines and arcs (each segment from its start to the next one's).
 */
function flangeSection(T, R, h, deg, down = false) {
  const th = deg * Math.PI / 180;
  if (!down) {
    const c = [0, R + T], a = -Math.PI / 2 - th, d = [-Math.cos(th), Math.sin(th)];
    const pi = [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)], po = [c[0] + (R + T) * Math.cos(a), c[1] + (R + T) * Math.sin(a)];
    return [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [0, T], center: c, direction: 'cw' }, { kind: 'line', start: pi }, { kind: 'line', start: [pi[0] + h * d[0], pi[1] + h * d[1]] }, { kind: 'line', start: [po[0] + h * d[0], po[1] + h * d[1]] }, { kind: 'arc', start: po, center: c, direction: 'ccw' }];
  }
  const c = [0, -R], a = Math.PI / 2 + th, d = [-Math.cos(th), -Math.sin(th)];
  const po = [c[0] + (R + T) * Math.cos(a), c[1] + (R + T) * Math.sin(a)], pi = [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)];
  return [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [0, T], center: c, direction: 'ccw' }, { kind: 'line', start: po }, { kind: 'line', start: [po[0] + h * d[0], po[1] + h * d[1]] }, { kind: 'line', start: [pi[0] + h * d[0], pi[1] + h * d[1]] }, { kind: 'arc', start: pi, center: c, direction: 'cw' }];
}
/** A flange's volume per unit width: its leg and its bend, θ·T·(R + T/2). */
const flangeArea = (T, R, h, deg) => h * T + deg * Math.PI / 180 * T * (R + T / 2);

/** A plate a × W × T with an edge flange on its edge x = 0 from y0 to y1 (a union). */
const edgeFlanged = ({ T, R, h, deg, down = false, a = 30, W = 40, y0 = 0, y1 = W }) => [
  { id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [a, W] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: T },
  { id: 'f', kind: 'sketch', profile: 'loop', segments: flangeSection(T, R, h, deg, down), plane: xzAt(y1) }, { id: 'fe', kind: 'extrude', sketch: 'f', height: y1 - y0 },
  { id: 'u', kind: 'union', target: 'pe', tool: 'fe' },
];

/**
 * A tray: a plate A × C × T, a 90° flange up on each edge, each `g` short of the corners at both ends; optionally a hole
 * through the plate and one through the flange on x = 0.
 */
function tray({ T = 1.5, R = 2, h = 20, A = 80, C = 50, g = 0.5, deg = 90, holes = false }) {
  const sect = flangeSection(T, R, h, deg), feats = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [A, C] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: T }];
  // Each edge: its ends and the direction into the plate d; the section's plane has x along d and y up, so its normal
  // is d × z, and the flange is extruded along that normal from the end it points away from.
  const edges = [[[0, 0], [0, C], [1, 0]], [[A, 0], [A, C], [-1, 0]], [[0, 0], [A, 0], [0, 1]], [[0, C], [A, C], [0, -1]]];
  let acc = 'pe';
  edges.forEach(([p0, p1, d], k) => {
    const n = [d[1], -d[0], 0], [s, e] = (p1[0] - p0[0]) * n[0] + (p1[1] - p0[1]) * n[1] > 0 ? [p0, p1] : [p1, p0], L = Math.hypot(e[0] - s[0], e[1] - s[1]), u = [(e[0] - s[0]) / L, (e[1] - s[1]) / L];
    feats.push({ id: `f${k}`, kind: 'sketch', profile: 'loop', segments: sect, plane: { origin: [s[0] + g * u[0], s[1] + g * u[1], 0], normal: n, xAxis: [d[0], d[1], 0] } }, { id: `fe${k}`, kind: 'extrude', sketch: `f${k}`, height: L - 2 * g }, { id: `u${k}`, kind: 'union', target: acc, tool: `fe${k}` });
    acc = `u${k}`;
  });
  let V = A * C * T + (2 * (A + C) - 8 * g) * flangeArea(T, R, h, deg);
  if (holes) {
    feats.push({ id: 'h0', kind: 'sketch', profile: 'circle', center: [A / 2, C / 2], radius: 5, plane: { origin: [0, 0, -1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'h0e', kind: 'extrude', sketch: 'h0', height: T + 2 }, { id: 'd0', kind: 'difference', target: acc, tool: 'h0e' });
    feats.push({ id: 'h1', kind: 'sketch', profile: 'circle', center: [C / 2, R + T + h / 2], radius: 3, plane: { origin: [-R - T - 1, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'h1e', kind: 'extrude', sketch: 'h1', height: T + 2 }, { id: 'd1', kind: 'difference', target: 'd0', tool: 'h1e' });
    V -= Math.PI * (25 + 9) * T;
  }
  return { feats, V, bendWidth: 2 * (A + C) - 8 * g };
}

// ---- the probe unfolder -----------------------------------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s], unit = a => scl(a, 1 / Math.hypot(...a));
const GL5 = [[-0.906179845938664, 0.2369268850561891], [-0.5384693101056831, 0.4786286704993665], [0, 0.5688888888888889], [0.5384693101056831, 0.4786286704993665], [0.906179845938664, 0.2369268850561891]];
/** A point of a face developed: planes rigidly (3D frame → 2D frame), cylinders by angle × the neutral radius. */
function develop(m, p) {
  if (m.kind === 'plane') { const d = sub(p, m.o3), x = dot(d, m.e1), y = dot(d, m.e2); return [m.o2[0] + x * m.f1[0] + y * m.f2[0], m.o2[1] + x * m.f1[1] + y * m.f2[1]]; }
  const d = sub(p, m.c), s = dot(sub(p, m.p3), m.a), r = unit(sub(d, scl(m.a, dot(d, m.a)))), phi = Math.atan2(m.sgn * dot(cross(m.d0, r), m.a), dot(m.d0, r)), w = m.rn * phi;
  return [m.o2[0] + s * m.fa[0] + w * m.fx[0], m.o2[1] + s * m.fa[1] + w * m.fx[1]];
}
function faceMid(ctx, fid) {
  let s = [0, 0, 0], n = 0;
  for (const cid of ctx.loops.get(ctx.faces.get(fid).loops[0]).coedges) { s = add(s, edgeMid(ctx.edges.get(ctx.co.get(cid).edge))); n++; }
  return scl(s, 1 / n);
}
function edgeMid(e) { const [a, b] = curveDomain(e.curve); return evaluateCurve(e.curve, (a + b) / 2); }
function normalAt(g, p) { if (g.kind === 'plane') return g.n; const d = sub(p, g.c); return scl(unit(sub(d, scl(g.a, dot(d, g.a)))), g.out); }
/**
 * The sheet's skin — the faces joined to the fixed planar face (by name, or the first a test accepts) across smooth edges —
 * developed onto the fixed face's plane.
 * A bend's skin face of radius ρ lies at the neutral radius ρ − T + K·T when its normal points away from its axis (the
 * outer side), else ρ + K·T. Returns the flat area (Green's theorem on the developed outline: skin edges not shared by two
 * skin faces), the largest gap between the two developments of an edge shared by skin faces, the skin's names, the bends
 * and the developed outline.
 */
function unfold(brep, fixedFace, T, K) {
  const ctx = { faces: new Map(brep.faces.map(f => [f.id, f])), loops: new Map(brep.loops.map(l => [l.id, l])), co: new Map(brep.coedges.map(c => [c.id, c])), edges: new Map(brep.edges.map(e => [e.id, e])) };
  const geo = new Map(brep.faces.map(f => [f.id, faceGeometry(f)])), usedBy = new Map(), maps = new Map();
  for (const c of brep.coedges) { const f = ctx.loops.get(c.loop).face; if (!usedBy.has(c.edge)) usedBy.set(c.edge, []); usedBy.get(c.edge).push(f); }
  const fixed = brep.faces.find(typeof fixedFace === 'function' ? f => fixedFace(f, geo.get(f.id)) : f => f.name === fixedFace), g0 = geo.get(fixed.id);
  assert.equal(g0.kind, 'plane');
  const e1 = unit(Math.abs(g0.n[0]) < 0.9 ? cross(g0.n, [1, 0, 0]) : cross(g0.n, [0, 1, 0]));
  maps.set(fixed.id, { kind: 'plane', o3: g0.o, e1, e2: cross(g0.n, e1), o2: [0, 0], f1: [1, 0], f2: [0, 1] });
  const smooth = new Set(), queue = [fixed.id], bends = [];
  while (queue.length) {
    const fid = queue.shift(), gF = geo.get(fid), m = maps.get(fid);
    for (const lid of ctx.faces.get(fid).loops) for (const cid of ctx.loops.get(lid).coedges) {
      const e = ctx.edges.get(ctx.co.get(cid).edge), other = usedBy.get(e.id).find(f => f !== fid), p = edgeMid(e);
      if (!other || dot(normalAt(gF, p), normalAt(geo.get(other), p)) < 1 - 1e-9) continue;
      smooth.add(e.id);
      if (maps.has(other)) continue;
      const gO = geo.get(other), [t0, t1] = curveDomain(e.curve), A = evaluateCurve(e.curve, t0), toFace = sub(faceMid(ctx, fid), A);
      if (gF.kind === 'plane' && gO.kind === 'cylinder') {
        // Across the tangent line, away from the plane: t. The bend's angle runs from the line's radial d0 towards t.
        let t = cross(gF.n, unit(sub(evaluateCurve(e.curve, t1), A))); if (dot(toFace, t) > 0) t = scl(t, -1);
        const d0 = unit(sub(sub(A, gO.c), scl(gO.a, dot(sub(A, gO.c), gO.a)))), sgn = Math.sign(dot(cross(d0, t), gO.a)) || 1;
        const lin = v => [dot(v, m.e1) * m.f1[0] + dot(v, m.e2) * m.f2[0], dot(v, m.e1) * m.f1[1] + dot(v, m.e2) * m.f2[1]];
        maps.set(other, { kind: 'cyl', c: gO.c, a: gO.a, p3: A, d0, sgn, o2: develop(m, A), fa: lin(gO.a), fx: lin(t), rn: gO.out === 1 ? gO.r - T + K * T : gO.r + K * T });
        bends.push({ face: ctx.faces.get(other).name, r: gO.r, out: gO.out });
      } else if (gF.kind === 'cylinder' && gO.kind === 'plane') {
        // The plane beyond: its frame the axis and the tangent of increasing angle at the far line.
        const d1 = unit(sub(sub(A, m.c), scl(m.a, dot(sub(A, m.c), m.a)))), tp = scl(cross(m.a, d1), m.sgn), on = dot(toFace, tp) > 0 ? -1 : 1;
        maps.set(other, { kind: 'plane', o3: A, e1: m.a, e2: scl(tp, on), o2: develop(m, A), f1: m.fa, f2: scl(m.fx, on).slice(0, 2) });
      } else if (gF.kind === 'plane' && gO.kind === 'plane') maps.set(other, m);
      else throw new Error(`no development across ${gF.kind}/${gO.kind}`);
      queue.push(other);
    }
  }
  let area = 0, gap = 0; const outline = [];
  for (const fid of maps.keys()) for (const lid of ctx.faces.get(fid).loops) for (const cid of ctx.loops.get(lid).coedges) {
    const c = ctx.co.get(cid), e = ctx.edges.get(c.edge);
    if (smooth.has(e.id)) { const p = edgeMid(e), [f, g] = usedBy.get(e.id), a = develop(maps.get(f), p), b = develop(maps.get(g), p); gap = Math.max(gap, Math.hypot(a[0] - b[0], a[1] - b[1])); continue; }
    const m = maps.get(fid), [t0, t1] = curveDomain(e.curve), knots = [...new Set(e.curve.knots.filter(k => k >= t0 && k <= t1))];
    // ∮ x dy over the edge's image: Gauss–Legendre on 64 pieces a span, dy/dt by a five-point stencil.
    let I = 0;
    for (let k = 0; k + 1 < knots.length; k++) for (let j = 0; j < 64; j++) {
      const lo = knots[k] + (knots[k + 1] - knots[k]) * j / 64, hi = knots[k] + (knots[k + 1] - knots[k]) * (j + 1) / 64, hs = (hi - lo) * 1e-3;
      for (const [x, w] of GL5) {
        const t = (lo + hi) / 2 + (hi - lo) / 2 * x, y = q => develop(m, evaluateCurve(e.curve, q))[1];
        I += w * (hi - lo) / 2 * develop(m, evaluateCurve(e.curve, t))[0] * (-y(t + 2 * hs) + 8 * y(t + hs) - 8 * y(t - hs) + y(t - 2 * hs)) / (12 * hs);
      }
    }
    area += c.sense === 'forward' ? I : -I;
    outline.push({ map: m, curve: e.curve, t0, t1 });
  }
  return { area: Math.abs(area), gap, skin: [...maps.keys()].map(f => ctx.faces.get(f).name), bends, outline, maps };
}

// ---- the tests --------------------------------------------------------------------------------------------------------
test('R12 S0 today: a contour flange (one section extruded) and edge flanges at any angle, up or down, full or part width, are exact; a relief cut too', () => {
  // An L-bracket's section (legs a and b, a 90° bend of inner radius R) extruded W: W(aT + bT + θT(R + T/2)), area too.
  const T = 2, R = 3, a = 30, b = 25, W = 40, c = [0, R + T];
  const L = [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [a, 0] }, { kind: 'line', start: [a, T] }, { kind: 'arc', start: [0, T], center: c, direction: 'cw' }, { kind: 'line', start: [-R, R + T] }, { kind: 'line', start: [-R, R + T + b] }, { kind: 'line', start: [-R - T, R + T + b] }, { kind: 'arc', start: [-R - T, R + T], center: c, direction: 'ccw' }];
  const o = out([{ id: 's', kind: 'sketch', profile: 'loop', segments: L, plane: xzAt(0) }, { id: 'e', kind: 'extrude', sketch: 's', height: W }]);
  const V = W * (a * T + flangeArea(T, R, b, 90)), S = 2 * (a * T + flangeArea(T, R, b, 90)) + W * (2 * a + 2 * b + Math.PI / 2 * (2 * R + T) + 2 * T);
  assert.equal(checkOutput(o).valid, true);
  assert.ok(Math.abs(massPropertiesOf(o).volume / V - 1) < 1e-14 && Math.abs(surfaceAreaOf(o) / S - 1) < 1e-12);
  // Its faces are named by the section's sides (`e.side3` the inner bend, `e.side7` the outer): no sheet roles.
  assert.deepEqual(o.brep.faces.map(f => f.name), ['e.side0', 'e.side1', 'e.side2', 'e.side3', 'e.side4', 'e.side5', 'e.side6', 'e.side7', 'e.bottom', 'e.top']);
  // An edge flange as a union, every angle from 30° to 175°, up and down; part width (y 5–30) too.
  for (const deg of [30, 45, 90, 120, 150, 175]) for (const down of [false, true]) for (const [y0, y1] of [[0, 40], [5, 30]]) {
    const T = 2, R = 3, h = 25, o = out(edgeFlanged({ T, R, h, deg, down, y0, y1 })), V = 30 * 40 * T + (y1 - y0) * flangeArea(T, R, h, deg);
    assert.equal(checkOutput(o).valid, true, `${deg}° ${down ? 'down' : 'up'} ${y0}–${y1}`);
    assert.ok(Math.abs(massPropertiesOf(o).volume / V - 1) < 1e-11, `${deg}° ${down ? 'down' : 'up'} ${y0}–${y1}`);
  }
  // Rectangular reliefs at both ends of a part-width flange (w 2 wide, d 1.5 into the plate), by difference: exact.
  const T2 = 2, w = 2, d = 1.5, feats = edgeFlanged({ T: T2, R: 3, h: 25, deg: 90, y0: 5, y1: 30 });
  for (const [k, y] of [[0, 5 - w], [1, 30]]) feats.push({ id: `r${k}`, kind: 'sketch', profile: 'rectangle', min: [-6, y], max: [d, y + w], plane: { origin: [0, 0, -1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: `re${k}`, kind: 'extrude', sketch: `r${k}`, height: 35 }, { id: `c${k}`, kind: 'difference', target: k ? 'c0' : 'u', tool: `re${k}` });
  const r = out(feats);
  assert.equal(checkOutput(r).valid, true);
  assert.ok(Math.abs(massPropertiesOf(r).volume / (30 * 40 * T2 + 25 * flangeArea(T2, 3, 25, 90) - 2 * w * d * T2) - 1) < 1e-11);
});

test('R12 S0 today: a tray of four flanges with holes is exact, with or without a gap at the corners; flanges leaning in overlap there and are united silently', () => {
  const t = tray({ holes: true }), o = out(t.feats);
  assert.equal(checkOutput(o).valid, true);
  assert.ok(Math.abs(massPropertiesOf(o).volume / t.V - 1) < 1e-11);
  // The faces keep their extrusions' names, split where the Booleans cut them (`fe3.side3#1` … `#4`): a sheet's roles —
  // which face is a bend, which skin — are not named anywhere.
  assert.ok(o.brep.faces.some(f => f.name === 'fe3.side3#4') && !o.brep.faces.some(f => /bend|flange/.test(f.name ?? '')));
  // No gap: the neighbouring bends' ends meet only along the plate's corner edge, a reflex edge of a valid solid.
  for (const deg of [90, 60]) {
    const z = tray({ g: 0, deg }), oz = out(z.feats);
    assert.equal(checkOutput(oz).valid, true);
    assert.ok(Math.abs(massPropertiesOf(oz).volume / z.V - 1) < 1e-11, `${deg}°`);
  }
  // Flanges leaning in (turned past 90°) cross their neighbours near the corners. The union takes the overlap once: a
  // valid solid, 0.3–1.8 % under its pieces, that no sheet folds into — and nothing says so.
  for (const [g, deg, under] of [[0.5, 120, 8.8e-3], [0.5, 150, 1.8e-2], [5, 120, 3.2e-3]]) {
    const c = tray({ g, deg }), oc = out(c.feats);
    assert.equal(checkOutput(oc).valid, true);
    assert.ok(1 - massPropertiesOf(oc).volume / c.V > under, `${deg}° gap ${g}`);
  }
});

test('R12 S0 probe: the B-rep unfolds — its skin developed at the neutral radius gives the K-factor\'s flat area, the textbook flat length, either skin', () => {
  // The tray with holes: the skin (the plate's bottom, four outer bend faces, four flange faces) developed for three K.
  const T = 1.5, R = 2, h = 20, t = tray({ T, R, h, holes: true }), o = out(t.feats), V = massPropertiesOf(o).volume;
  for (const K of [0.5, 0.44, 0.33]) {
    const u = unfold(o.brep, 'pe.bottom', T, K);
    assert.equal(u.skin.length, 9); assert.equal(u.bends.length, 4);
    // Each edge between skin faces lands at one place from both sides.
    assert.ok(u.gap < 1e-12, `gap ${u.gap}`);
    // The neutral layer: the flat's area is V/T where each bend's neutral radius is its middle (K = ½), plus (K − ½)·T
    // per unit angle and width of bend. V by the kernel's quadrature; the flat by Green's theorem.
    const oracle = V / T + (K - 0.5) * T * (Math.PI / 2) * t.bendWidth;
    assert.ok(Math.abs(u.area / oracle - 1) < 1e-11, `K ${K}: ${u.area / oracle - 1}`);
    // The textbook flat length: the flange's far edge lies h + θ(R + K·T) beyond the plate's edge.
    const flange = [...u.maps.entries()].find(([, m]) => m.kind === 'plane' && Math.abs(m.e1[1]) > 0.99 && Math.abs(m.o3[0] + R + T) < 1e-9)[1];
    const far = develop(flange, [-R - T, 25, R + T + h]), edge = develop(u.maps.values().next().value, [0, 25, 0]);
    assert.ok(Math.abs(Math.hypot(far[0] - edge[0], far[1] - edge[1]) - (h + Math.PI / 2 * (R + K * T))) < 1e-12);
  }
  // Through STEP (no names, no history): the imported body unfolds to the same flat, its fixed face found by its plane.
  { const back = out([{ id: 'i', kind: 'import', step: exportStep(o) }]), bottom = (f, g) => g.kind === 'plane' && g.n[2] < -0.999 && Math.abs(g.o[2]) < 1e-9;
    const Vb = massPropertiesOf(back).volume;
    for (const K of [0.5, 0.33]) { const u = unfold(back.brep, bottom, T, K); assert.ok(u.skin.length === 9 && u.gap < 1e-12 && Math.abs(u.area / (Vb / T + (K - 0.5) * T * (Math.PI / 2) * t.bendWidth) - 1) < 1e-11, `STEP, K ${K}`); } }
  // No gap at the corners: the tabs' outlines touch at the plate's corners, and the area still holds.
  { const z = tray({ T, R, h, g: 0 }), oz = out(z.feats), u = unfold(oz.brep, 'pe.bottom', T, 0.44);
    assert.ok(u.gap < 1e-12 && Math.abs(u.area / (massPropertiesOf(oz).volume / T + (0.44 - 0.5) * T * (Math.PI / 2) * z.bendWidth) - 1) < 1e-11); }
  // Every angle, up and down, and from either skin: the same flat area.
  for (const deg of [30, 120, 175]) for (const down of [false, true]) {
    const T = 2, K = 0.4, o = out(edgeFlanged({ T, R: 3, h: 25, deg, down, y0: 5, y1: 30 })), V = massPropertiesOf(o).volume, oracle = V / T + (K - 0.5) * T * deg * Math.PI / 180 * 25;
    for (const fixed of ['pe.bottom', 'pe.top']) {
      const u = unfold(o.brep, fixed, T, K);
      assert.equal(u.skin.length, 3); assert.ok(u.gap < 1e-12);
      assert.ok(Math.abs(u.area / oracle - 1) < 1e-11, `${deg}° ${down ? 'down' : 'up'} from ${fixed}: ${u.area / oracle - 1}`);
    }
  }
});

test('R12 S0 probe: the developed outline is lines and circular arcs, and the DXF writer takes it as it is', () => {
  const T = 1.5, o = out(tray({ T, holes: true }).feats), u = unfold(o.brep, 'pe.bottom', T, 0.44), entities = [];
  let deviation = 0;
  for (const e of u.outline) {
    const P = s => develop(e.map, evaluateCurve(e.curve, s)), a = P(e.t0), b = P(e.t1), m = P((e.t0 + e.t1) / 2), turn = (b[0] - a[0]) * (m[1] - a[1]) - (b[1] - a[1]) * (m[0] - a[0]), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (Math.abs(turn) < 1e-9 * L * L) {
      for (let k = 1; k < 8; k++) { const p = P(e.t0 + (e.t1 - e.t0) * k / 8); deviation = Math.max(deviation, Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / L); }
      entities.push({ type: 'line', a, b, layer: 'OUTLINE' });
      continue;
    }
    const d = 2 * (a[0] * (m[1] - b[1]) + m[0] * (b[1] - a[1]) + b[0] * (a[1] - m[1])), q = p => p[0] * p[0] + p[1] * p[1];
    const cx = (q(a) * (m[1] - b[1]) + q(m) * (b[1] - a[1]) + q(b) * (a[1] - m[1])) / d, cy = (q(a) * (b[0] - m[0]) + q(m) * (a[0] - b[0]) + q(b) * (m[0] - a[0])) / d, r = Math.hypot(a[0] - cx, a[1] - cy);
    for (let k = 1; k < 8; k++) { const p = P(e.t0 + (e.t1 - e.t0) * k / 8); deviation = Math.max(deviation, Math.abs(Math.hypot(p[0] - cx, p[1] - cy) - r)); }
    const deg = p => Math.atan2(p[1] - cy, p[0] - cx) * 180 / Math.PI, [s, f] = turn > 0 ? [deg(a), deg(b)] : [deg(b), deg(a)];
    entities.push({ type: 'arc', center: [cx, cy], radius: r, startDeg: s, endDeg: f, layer: 'OUTLINE' });
  }
  // Each image is a line or a circle to rounding: planar edges move rigidly, a bend's end arcs develop straight.
  assert.ok(deviation < 1e-12, `${deviation}`);
  // 28 lines (collinear pieces where the Booleans split the plate's edges kept apart: one merge for R12) and 4 half circles.
  assert.equal(entities.filter(e => e.type === 'line').length, 28); assert.equal(entities.filter(e => e.type === 'arc').length, 4);
  assert.ok(entities.some(e => e.type === 'arc' && Math.abs(e.radius - 3) < 1e-12) && entities.some(e => e.type === 'arc' && Math.abs(e.radius - 5) < 1e-12));
  const { text } = writeDxf({ units: 'mm', layers: [{ name: 'OUTLINE', color: 7 }, { name: 'BEND_UP', color: 1, linetype: 'DASHED' }], linetypes: [{ name: 'DASHED', description: 'Dashed __ __', pattern: [3, -1.5] }], entities }, {});
  assert.equal(text.match(/\nLINE\r?\n/g).length, 28); assert.equal(text.match(/\nARC\r?\n/g).length, 4);
});
