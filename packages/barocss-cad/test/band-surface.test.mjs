// B2: a ruled band surface between two edge chains — exact geometry against independent quadrature, pairing, the
// references' strictness, every refusal. (No thickening: it waits on exact thicken, #2258.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, surfaceAreaOf, evaluateCurve, evaluateSurface, CadPartError, outputOf } from '../dist/index.js';
import { evaluateSurfaceD1 } from '../dist/core/derivatives.js';
import { bandSurface, BandError } from '../dist/features/band-surface.js';

const D = (features, parameters = {}) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters, features });
const circle = (id, r, cx = 0, cy = 0) => ({ id, kind: 'sketch', profile: 'circle', center: [cx, cy], radius: r });
const rect = (id, x0, y0, x1, y1) => ({ id, kind: 'sketch', profile: 'rectangle', min: [x0, y0], max: [x1, y1] });
const poly = (id, points) => ({ id, kind: 'sketch', profile: 'polygon', points });
const extrude = (id, sketch, height, from) => ({ id, kind: 'extrude', sketch, height, ...(from === undefined ? {} : { from }) });
const band = (a, b, extra = {}, id = 'band') => ({ id, kind: 'band-surface', a, b, ...extra });
const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
const run = features => evaluateCadPart(D(features));
const bandOut = (features, id = 'band') => outputOf(run(features), id);
const refused = (features, code, pattern) => assert.throws(() => run(features), e => e instanceof CadPartError && (e.details?.category ?? e.code) === code && pattern.test(e.message), pattern.source);

// ---- helpers: names by position, independent quadrature, independent polylines --------------------------------------
/** The edge names of body `id` whose two ends and middle satisfy `where` (a loop, picked by where it lies). */
function namesWhere(snapshot, id, where) {
  const brep = outputOf(snapshot, id).brep, point = new Map(brep.vertices.map(v => [v.id, v.point])), out = [];
  for (const e of brep.edges) {
    const mid = evaluateCurve(e.curve, (e.curve.knots[0] + e.curve.knots.at(-1)) / 2);
    if (where(point.get(e.vertices[0])) && where(point.get(e.vertices[1])) && where(mid) && !out.includes(e.name)) out.push(e.name);
  }
  return out;
}
const atZ = z => p => Math.abs(p[2] - z) < 1e-9;
/** The edge between two points (either way). */
function nameBetween(snapshot, id, p, q) {
  const brep = outputOf(snapshot, id).brep, point = new Map(brep.vertices.map(v => [v.id, v.point])), same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9;
  const e = brep.edges.find(x => (same(point.get(x.vertices[0]), p) && same(point.get(x.vertices[1]), q)) || (same(point.get(x.vertices[0]), q) && same(point.get(x.vertices[1]), p)));
  assert.ok(e, `no edge between ${p} and ${q}`); return e.name;
}
/** Gauss–Legendre nodes (n points), by Newton on the Legendre polynomial. */
function legendre(n) {
  const x = [], w = [];
  for (let i = 0; i < n; i++) {
    let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), dp;
    for (let it = 0; it < 100; it++) { let p0 = 1, p1 = z; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } dp = n * (z * p1 - p0) / (z * z - 1); const dz = p1 / dp; z -= dz; if (Math.abs(dz) < 1e-16) break; }
    x.push(z); w.push(2 / ((1 - z * z) * dp * dp));
  }
  return { x, w };
}
const G = legendre(14);
/** The area of a surface: ∫∫ |Su × Sv| over every knot span, by Gauss quadrature on the analytic first derivatives. */
function surfaceArea(s) {
  const spans = (k, p) => { const u = [...new Set(k)].filter(x => x >= k[p] && x <= k[k.length - 1 - p]); return u.slice(1).map((b, i) => [u[i], b]); };
  let total = 0;
  for (const [u0, u1] of spans(s.knotsU, s.degreeU)) for (const [v0, v1] of spans(s.knotsV, s.degreeV)) for (let i = 0; i < G.x.length; i++) for (let j = 0; j < G.x.length; j++) {
    const u = (u0 + u1) / 2 + (u1 - u0) / 2 * G.x[i], v = (v0 + v1) / 2 + (v1 - v0) / 2 * G.x[j], { du, dv } = evaluateSurfaceD1(s, u, v);
    total += G.w[i] * G.w[j] * (u1 - u0) / 2 * (v1 - v0) / 2 * Math.hypot(du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]);
  }
  return total;
}
const bandArea = brep => brep.faces.reduce((s, f) => s + surfaceArea(f.surface), 0);
/** A band side's edges in patch order: [{ curve }] by name `${id}.a|${id}.band<k>`. */
const sideEdges = (brep, id, side) => brep.faces.map((_, k) => brep.edges.find(e => e.name === `${id}.${side}|${id}.band${k}`));
/** Cumulative normalized length at each patch's start, from independent 4000-point polylines of the boundary edges. */
function startFractions(brep, id, side) {
  const lengths = sideEdges(brep, id, side).map(e => { const [a, b] = [e.curve.knots[0], e.curve.knots.at(-1)]; let L = 0, prev = evaluateCurve(e.curve, a); for (let i = 1; i <= 4000; i++) { const p = evaluateCurve(e.curve, a + (b - a) * i / 4000); L += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]); prev = p; } return L; });
  const total = lengths.reduce((s, x) => s + x, 0); let run = 0;
  return lengths.map(l => { const f = run / total; run += l; return f; });
}
const cone = (extra = {}) => [circle('c1', 20), extrude('e1', 'c1', 5), circle('c2', 10), extrude('e2', 'c2', 5, 25),
  band({ target: 'e1', edges: ['e1.bottom|e1.side0#2', 'e1.bottom|e1.side0#1'] }, { target: 'e2', edges: ['e2.side0#2|e2.top', 'e2.side0#1|e2.top'] }, extra)];

test('coaxial circles r20 z0 / r10 z30: every sample on the cone, the area exact, an open shell that checks', () => {
  const snapshot = run(cone()), o = outputOf(snapshot, 'band'), brep = o.brep;
  assert.equal(brep.bodies.length, 1); assert.equal(brep.bodies[0].kind, 'sheet'); assert.equal(brep.shells[0].closed, false);
  assert.deepEqual(brep.faces.map(f => f.name), ['band.band0', 'band.band1']);
  assert.ok(brep.edges.every(e => e.name) && new Set(brep.edges.map(e => e.name)).size === brep.edges.length);
  for (const n of ['band.a|band.band0', 'band.b|band.band1', 'band.band0|band.band1', 'band.band1|band.band0']) assert.ok(brep.edges.some(e => e.name === n), n);
  const report = checkBrep(brep, { strict: true });
  assert.equal(report.valid, true, report.issues.join('; '));
  let worst = 0;
  for (const f of brep.faces) for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) {
    const p = evaluateSurface(f.surface, i / 12, j / 12);
    worst = Math.max(worst, Math.abs(Math.hypot(p[0], p[1]) - (20 - 10 * p[2] / 30)), Math.abs(p[2] - 0) > 30 + 1e-9 || p[2] < -1e-9 ? 1 : 0);
  }
  assert.ok(worst <= 1e-9, `off the cone by ${worst}`);
  const expected = Math.PI * (20 + 10) * Math.sqrt(100 + 900);
  assert.ok(close(bandArea(brep), expected, 1e-9), `${bandArea(brep)} vs ${expected}`);
  assert.ok(close(surfaceAreaOf(o), expected, 1e-9));
  assert.deepEqual([o.band.pairs, o.band.closed, o.band.exact, o.band.pairing, o.band.pieces], [2, true, true, 'pieces', [2, 2]]);
  assert.ok(o.band.boundaryDeviation <= 1e-9 * 30 && /2 exact ruled patches \(paired by pieces\); boundary deviation/.test(o.band.note), o.band.note);
  assert.equal(o.band.chord, undefined);
});

test('closed loops of either winding join untwisted: top or bottom rim of each cylinder gives the exact frustum', () => {
  const base = [circle('c1', 20), extrude('e1', 'c1', 5), circle('c2', 10), extrude('e2', 'c2', 5, 25)];
  const rims = { e1: { bottom: ['e1.bottom|e1.side0#2', 'e1.bottom|e1.side0#1'], top: ['e1.side0#2|e1.top', 'e1.side0#1|e1.top'] }, e2: { bottom: ['e2.bottom|e2.side0#2', 'e2.bottom|e2.side0#1'], top: ['e2.side0#2|e2.top', 'e2.side0#1|e2.top'] } };
  const z = { e1: { bottom: 0, top: 5 }, e2: { bottom: 25, top: 30 } };
  for (const ra of ['bottom', 'top']) for (const rb of ['bottom', 'top']) for (const flip of [false, true]) {
    const o = bandOut([...base, band({ target: 'e1', edges: rims.e1[ra] }, { target: 'e2', edges: rims.e2[rb] }, flip ? { flip: true } : {})]), h = z.e2[rb] - z.e1[ra], frustum = Math.PI * 30 * Math.sqrt(100 + h * h);
    if (!flip) assert.ok(close(bandArea(o.brep), frustum, 1e-9), `${ra}/${rb}: ${bandArea(o.brep)} vs ${frustum}`);
    else assert.ok(Math.abs(bandArea(o.brep) - frustum) > 1, `${ra}/${rb} flipped: ${bandArea(o.brep)}`);
  }
});

test('targets stay bodies: the band reads its two bodies, never consumes them', () => {
  const ids = run(cone()).outputs.map(o => o.id).sort();
  assert.deepEqual(ids, ['band', 'e1', 'e2']);
});

test('two parallel lines: a planar trapezoid, whichever way each edge is stored', () => {
  const features = [rect('r1', 0, 0, 10, 10), extrude('b1', 'r1', 5), rect('r2', 30, 2, 36, 8), extrude('b2', 'r2', 5)];
  const s = run(features), a = nameBetween(s, 'b1', [0, 0, 0], [0, 10, 0]), b = nameBetween(s, 'b2', [30, 2, 0], [30, 8, 0]);
  const o = bandOut([...features, band({ target: 'b1', edges: [a] }, { target: 'b2', edges: [b] })]);
  assert.ok(close(bandArea(o.brep), (10 + 6) / 2 * 30, 1e-12), String(bandArea(o.brep)));
  for (const f of o.brep.faces) for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) assert.ok(Math.abs(evaluateSurface(f.surface, i / 8, j / 8)[2]) < 1e-12);
  assert.deepEqual([o.band.closed, o.band.pairs], [false, 1]);
  assert.equal(checkBrep(o.brep).valid, true);
});

test('B stored against A\'s direction is turned (the loops\' sides run opposite ways): still the untwisted trapezoid', () => {
  const features = [rect('r1', 0, 0, 10, 10), extrude('b1', 'r1', 5), rect('r2', 30, 2, 36, 8), extrude('b2', 'r2', 5)], s = run(features);
  // x = 10 is the far side of the first rectangle's loop, x = 30 the near side of the second's: their loops run opposite ways.
  const a = nameBetween(s, 'b1', [10, 0, 0], [10, 10, 0]), b = nameBetween(s, 'b2', [30, 2, 0], [30, 8, 0]);
  const o = bandOut([...features, band({ target: 'b1', edges: [a] }, { target: 'b2', edges: [b] })]);
  assert.ok(close(bandArea(o.brep), (10 + 6) / 2 * 20, 1e-12), String(bandArea(o.brep)));
  const turned = bandOut([...features, band({ target: 'b1', edges: [a] }, { target: 'b2', edges: [b] }, { flip: true })]);
  assert.ok(bandArea(turned.brep) < bandArea(o.brep) - 1);
});

test('rectangle to a rotated square, equal counts: B seams where it is nearest A\'s start, and the rulings join equal normalized lengths', () => {
  const r = Math.SQRT1_2 * 10, c = [10, 5], square = poly('sq', [[c[0], c[1] - r], [c[0] + r, c[1]], [c[0], c[1] + r], [c[0] - r, c[1]]]);
  const features = [rect('r', 0, 0, 20, 10), extrude('e', 'r', 2), square, extrude('f', 'sq', 2, 20)];
  const s = run(features), top = namesWhere(s, 'e', atZ(2)), up = namesWhere(s, 'f', atZ(22));
  assert.equal(top.length, 4); assert.equal(up.length, 4);
  const o = bandOut([...features, band({ target: 'e', edges: top }, { target: 'f', edges: up })]);
  // The point of the square nearest the rectangle's start corner is no corner of it: the joints do not coincide, so by length.
  assert.deepEqual([o.band.closed, o.band.pairing, o.band.pieces], [true, 'length', [4, 4]]);
  assert.ok(o.band.pairs > 4);
  const fa = startFractions(o.brep, 'band', 'a'), fb = startFractions(o.brep, 'band', 'b');
  fa.forEach((f, k) => assert.ok(Math.abs(f - fb[k]) < 1e-4, `ruling ${k}: ${f} vs ${fb[k]}`));
  const expected = bandArea(o.brep);
  assert.ok(close(surfaceAreaOf(o), expected, 1e-4), 'the kernel area (tessellated for a twisted patch) agrees to 1e-4');
  assert.ok(expected > 0 && checkBrep(o.brep, { strict: true }).valid);
  // Bilinear patches: S = p00 + u e1 + v e2 + uv e3, its area by a 600 x 600 midpoint grid from the four corners alone (no kernel call but the corners).
  for (const f of o.brep.faces) {
    const P = (u, v) => evaluateSurface(f.surface, u, v), p00 = P(0, 0), p10 = P(1, 0), p01 = P(0, 1), p11 = P(1, 1), N = 600;
    const e1 = p10.map((x, i) => x - p00[i]), e2 = p01.map((x, i) => x - p00[i]), e3 = p00.map((x, i) => x - p10[i] - p01[i] + p11[i]);
    let area = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const u = (i + 0.5) / N, v = (j + 0.5) / N, su = e1.map((x, k) => x + v * e3[k]), sv = e2.map((x, k) => x + u * e3[k]);
      area += Math.hypot(su[1] * sv[2] - su[2] * sv[1], su[2] * sv[0] - su[0] * sv[2], su[0] * sv[1] - su[1] * sv[0]) / N / N;
    }
    assert.ok(close(surfaceArea(f.surface), area, 1e-6), `${surfaceArea(f.surface)} vs ${area}`);
  }
});

const roundedRectangle = () => [rect('r', 0, 0, 40, 24), extrude('e', 'r', 5),
  { id: 'f', kind: 'fillet', target: 'e', edges: ['e.side0|e.side1', 'e.side1|e.side2', 'e.side2|e.side3', 'e.side0|e.side3'], radius: 3 },
  circle('c', 10, 20, 12), extrude('k', 'c', 5, 40)];
const roundedBand = (extra = {}) => {
  const features = roundedRectangle(), s = run(features), top = namesWhere(s, 'f', atZ(5)), up = namesWhere(s, 'k', atZ(45));
  return { features, top, up, doc: [...features, band({ target: 'f', edges: top }, { target: 'k', edges: up }, extra)] };
};

test('rounded rectangle (8 pieces) to a circle: split at normalized length, rulings join equal-length points, boundary on the sources', () => {
  const { top, up, doc } = roundedBand(), o = bandOut(doc);
  assert.equal(top.length, 8); assert.equal(up.length, 2);
  assert.equal(o.band.pairing, 'length'); assert.deepEqual(o.band.pieces, [8, 2]);
  // A has 7 interior joints; B's circle has two joints, one of them the seam cut into it: 9 breaks, 10 patches.
  assert.equal(o.band.pairs, 10); assert.equal(o.brep.faces.length, 10);
  assert.ok(/10 exact ruled patches \(paired by length 8↔2\)/.test(o.band.note), o.band.note);
  // Every ruling joins points of equal normalized length (independent polylines): the patch starts of A and B agree.
  const fa = startFractions(o.brep, 'band', 'a'), fb = startFractions(o.brep, 'band', 'b');
  assert.equal(fa.length, 10);
  fa.forEach((f, k) => assert.ok(Math.abs(f - fb[k]) <= 1e-6, `ruling ${k}: ${f} vs ${fb[k]}`));
  assert.ok(o.band.boundaryDeviation > 0 && o.band.boundaryDeviation <= 1e-9 * 40, `measured from samples, not by construction: ${o.band.boundaryDeviation}`);
  assert.equal(checkBrep(o.brep, { strict: true }).valid, true);
  assert.ok(close(surfaceAreaOf(o), bandArea(o.brep), 1e-4));
});

test('the seam of a closed pair: B starts at the point nearest A\'s start', () => {
  const { doc } = roundedBand(), o = bandOut(doc), brep = o.brep, point = new Map(brep.vertices.map(v => [v.id, v.point]));
  const ruling = brep.edges.find(e => e.name === 'band.band9|band.band0'), a = point.get(ruling.vertices[0]), b = point.get(ruling.vertices[1]);
  // The nearest point of the circle (centre (20,12), r 10) to A's start is on the ray from the centre through it.
  const dx = a[0] - 20, dy = a[1] - 12, l = Math.hypot(dx, dy);
  assert.ok(Math.hypot(b[0] - (20 + 10 * dx / l), b[1] - (12 + 10 * dy / l)) < 1e-7, `${b} vs the nearest`);
});

test('input order and the start edge: the same band (area, report) whichever way the edges are listed', () => {
  const features = [rect('r1', 0, 0, 20, 10), extrude('b1', 'r1', 5), rect('r2', 0, 0, 20, 10), extrude('b2', 'r2', 5, 30)];
  const s = run(features);
  // Three of the four top edges, an open chain; A and B in every order.
  const make = (a, b) => bandOut([...features, band({ target: 'b1', edges: a }, { target: 'b2', edges: b })]);
  // (The loop's order from namesWhere is by edge, not adjacency: take the chain by walking vertices.)
  const walk = (id, z) => {
    const brep = outputOf(s, id).brep, point = new Map(brep.vertices.map(v => [v.id, v.point])), es = brep.edges.filter(e => [0, 1].every(i => Math.abs(point.get(e.vertices[i])[2] - z) < 1e-9));
    const order = [es[0]], used = new Set([0]); let at = es[0].vertices[1];
    while (order.length < 4) { const i = es.findIndex((e, k) => !used.has(k) && (e.vertices[0] === at || e.vertices[1] === at)); used.add(i); order.push(es[i]); at = es[i].vertices[0] === at ? es[i].vertices[1] : es[i].vertices[0]; }
    return order.map(e => e.name);
  };
  const A = walk('b1', 5), B = walk('b2', 35), base = make(A.slice(0, 3), B.slice(0, 3));
  assert.deepEqual([base.band.pairs, base.band.closed], [3, false]);
  const area = bandArea(base.brep);
  for (const [a, b] of [[[A[1], A[0], A[2]], B.slice(0, 3)], [[A[2], A[1], A[0]], B.slice(0, 3)], [A.slice(0, 3), [B[2], B[1], B[0]]], [A.slice(0, 3), [B[1], B[2], B[0]]], [[A[0], A[2], A[1]], [B[2], B[0], B[1]]]]) {
    const o = make(a, b);
    assert.ok(close(bandArea(o.brep), area, 1e-9), `${a} | ${b}: ${bandArea(o.brep)} vs ${area}`);
    assert.deepEqual([o.band.pairs, o.band.closed, o.band.pairing], [3, false, 'pieces']);
  }
  // A closed loop, listed from either piece of the circle: the cone's area either way.
  const swapped = bandOut(cone().slice(0, 4).concat(band({ target: 'e1', edges: ['e1.bottom|e1.side0#1', 'e1.bottom|e1.side0#2'] }, { target: 'e2', edges: ['e2.side0#1|e2.top', 'e2.side0#2|e2.top'] })));
  assert.ok(close(bandArea(swapped.brep), Math.PI * 30 * Math.sqrt(1000), 1e-9));
});

test('flip turns B the other way: the band changes', () => {
  const plain = bandOut(cone()), flipped = bandOut(cone({ flip: true }));
  assert.notEqual(bandArea(plain.brep).toFixed(3), bandArea(flipped.brep).toFixed(3));
  assert.ok(Math.abs(bandArea(flipped.brep) - bandArea(plain.brep)) > 1, `${bandArea(flipped.brep)} vs ${bandArea(plain.brep)}`);
  const open = [rect('r1', 0, 0, 10, 10), extrude('b1', 'r1', 5), rect('r2', 30, 2, 36, 8), extrude('b2', 'r2', 5)], s = run(open);
  const a = nameBetween(s, 'b1', [0, 0, 0], [0, 10, 0]), b = nameBetween(s, 'b2', [30, 2, 0], [30, 8, 0]);
  const two = flip => bandArea(bandOut([...open, band({ target: 'b1', edges: [a] }, { target: 'b2', edges: [b] }, flip ? { flip: true } : {})]).brep);
  assert.ok(two(true) < two(false) - 1, 'crossed rulings enclose less');
});

test('the stored names are exact: a lost name, a moved one, and nothing renamed', () => {
  const A = { target: 'e1', edges: ['e1.bottom|e1.side0#2', 'e1.bottom|e1.nowhere'] }, B = { target: 'e2', edges: ['e2.side0#2|e2.top', 'e2.side0#1|e2.top'] };
  const base = cone().slice(0, 4);
  refused([...base, band(A, B)], 'SELECTION', /^.*\[BAND_EDGE_LOST\] band side A: no edge named e1\.bottom\|e1\.nowhere on e1/);
  refused([...base, band({ target: 'e1', edges: ['e1.bottom|e1.side0#2', 'e1.bottom|e1.side0#1'] }, { target: 'e2', edges: ['e2.side0#2|e2.top', 'e2.side0#9|e2.top'] })], 'SELECTION', /\[BAND_EDGE_LOST\] band side B: no edge named e2\.side0#9\|e2\.top on e2/);
  // A name on other geometry: its signature says a straight edge was meant ([REFERENCE_MOVED], never a retarget).
  const named = band({ target: 'e1', edges: ['e1.bottom|e1.side0#2', 'e1.bottom|e1.side0#1'] }, { target: 'e2', edges: ['e2.side0#2|e2.top', 'e2.side0#1|e2.top'] });
  const curve = { kind: 'curve', at: [0, 0, 0], dir: null, size: 31.4 };
  assert.equal(outputOf(run([...base, { ...named, expect: { 'e1.bottom|e1.side0#2': curve, 'e2.side0#1|e2.top': { ...curve, at: [0, 0, 30] } } }]), 'band').band.pairs, 2);
  const wrong = { kind: 'line', at: [0, 0, 0], dir: [1, 0, 0], size: 31.4 };
  refused([...base, { ...named, expect: { 'e1.bottom|e1.side0#2': wrong } }], 'REFERENCE', /\[REFERENCE_MOVED\] band surface edge e1\.bottom\|e1\.side0#2 is no longer the edge it named/);
  refused([...base, { ...named, expect: { 'e2.side0#1|e2.top': wrong } }], 'REFERENCE', /\[REFERENCE_MOVED\] band surface edge e2\.side0#1\|e2\.top/);
  refused([...base, { ...named, expect: { 'e9.nothing': curve } }], 'INPUT', /expect names e9\.nothing, which this band-surface does not use/);
});

test('every refusal is typed and tagged', () => {
  const base = cone().slice(0, 4), A = { target: 'e1', edges: ['e1.bottom|e1.side0#2', 'e1.bottom|e1.side0#1'] }, B = { target: 'e2', edges: ['e2.side0#2|e2.top', 'e2.side0#1|e2.top'] };
  // Duplicate names, one side listing a name twice, unknown fields, thickening.
  refused([...base, band({ ...A, edges: [A.edges[0], A.edges[0]] }, B)], 'INPUT', /appears twice/);
  refused([...base, band(A, { ...B, edges: [A.edges[0]] })], 'INPUT', /appears twice/);
  refused([...base, band(A, B, { colour: 'red' })], 'INPUT', /no field colour/);
  refused([...base, band(A, B, { thickness: 2 })], 'CAPABILITY', /\[BAND_PROFILE\] band thickening waits on exact thicken \(#2258\)/);
  refused([...base, band(A, B, { side: 'both' })], 'CAPABILITY', /\[BAND_PROFILE\]/);
  refused([...base, band({ target: 'e1', edges: [] }, B)], 'INPUT', /1 to 32 edge names/);
  refused([...base, band({ target: 'nothing', edges: A.edges }, B)], 'REFERENCE', /no earlier feature nothing/);
  // A mesh body (facet faces).
  const P = [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10], I = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
  refused([...base, { id: 'm', kind: 'mesh', positions: P, indices: I, representation: 'facets' }, band({ target: 'm', edges: ['m.region0|m.region1'] }, B)], 'CAPABILITY', /\[BAND_PROFILE\] band side A: m is a mesh body/);
  // Branch: three edges at one corner. Gap: two edges apart. Two pieces: a chain and a loop.
  const boxes = [rect('r1', 0, 0, 10, 10), extrude('b1', 'r1', 5), rect('r2', 0, 0, 10, 10), extrude('b2', 'r2', 5, 30)], s = run(boxes);
  const e = (p, q) => nameBetween(s, 'b1', p, q), f = (p, q) => nameBetween(s, 'b2', p, q);
  const line = band({ target: 'b1', edges: [e([0, 0, 0], [10, 0, 0])] }, { target: 'b2', edges: [f([0, 0, 35], [10, 0, 35])] });
  assert.equal(outputOf(run([...boxes, line]), 'band').band.pairs, 1);
  const branch = band({ target: 'b1', edges: [e([0, 0, 0], [10, 0, 0]), e([0, 0, 0], [0, 10, 0]), e([0, 0, 0], [0, 0, 5])] }, line.b);
  refused([...boxes, branch], 'SELECTION', /\[BAND_CHAIN\] band side A: the edges branch at \(0, 0, 0\)/);
  const gap = band({ target: 'b1', edges: [e([0, 0, 0], [10, 0, 0]), e([0, 10, 5], [10, 10, 5])] }, line.b);
  refused([...boxes, gap], 'SELECTION', /\[BAND_CHAIN\] band side A: the edges are not one chain \(a gap at/);
  const loop = namesWhere(s, 'b1', atZ(5)), edge = e([0, 0, 0], [10, 0, 0]);
  refused([...boxes, band({ target: 'b1', edges: [...loop, edge] }, line.b)], 'SELECTION', /\[BAND_CHAIN\] band side A: the edges are two pieces \(a loop through/);
  refused([...boxes, band({ target: 'b1', edges: [loop[0], loop[1], loop[2], edge] }, line.b)], 'SELECTION', /\[BAND_CHAIN\] band side A: the edges are not one chain/);
  // A closed loop against an open chain.
  refused([...boxes, band({ target: 'b1', edges: loop }, line.b)], 'SELECTION', /\[BAND_CHAIN\] a band joins two open chains or two closed loops/);
  // Nearly perpendicular loops.
  refused([circle('c1', 10), extrude('e1', 'c1', 5), circle('c2', 10), extrude('e2', 'c2', 5, 20), { id: 'tip', kind: 'rotate', target: 'e2', axis: 'x', angle: 90 },
    band({ target: 'e1', edges: ['e1.bottom|e1.side0#2', 'e1.bottom|e1.side0#1'] }, { target: 'tip', edges: ['e2.bottom|e2.side0#2', 'e2.bottom|e2.side0#1'] })], 'SELECTION', /\[BAND_OBLIQUE\]/);
  // Touching: rulings of 5e-5 mm.
  refused([circle('c1', 10), extrude('e1', 'c1', 5), circle('c2', 10), extrude('e2', 'c2', 5, -4.99995),
    band({ target: 'e1', edges: ['e1.bottom|e1.side0#2', 'e1.bottom|e1.side0#1'] }, { target: 'e2', edges: ['e2.side0#2|e2.top', 'e2.side0#1|e2.top'] })], 'GEOMETRY', /\[BAND_TOUCH\] pair 0: the two sides meet at/);
  // Degenerate: two collinear lines, the ruling along both tangents.
  const row = [rect('r1', 0, 0, 10, 5), extrude('b1', 'r1', 5), rect('r2', 5, 0, 15, 5), extrude('b2', 'r2', 5)], t = run(row);
  refused([...row, band({ target: 'b1', edges: [nameBetween(t, 'b1', [0, 0, 0], [10, 0, 0])] }, { target: 'b2', edges: [nameBetween(t, 'b2', [5, 0, 0], [15, 0, 0])] })], 'GEOMETRY', /\[BAND_DEGENERATE\] pair 0: the surface has no normal at/);
});

// ---- kernel-level: synthetic chains (limits no sketch makes) --------------------------------------------------------
const brepOf = (edges, vertices) => ({ faces: [], edges, vertices: vertices.map((p, i) => ({ id: `v${i}`, point: p, tolerance: 1e-9 })) });
const lineEdge = (i, name, a, b) => ({ id: `x${i}`, name, vertices: [`v${i}`, `v${i + 1}`], tolerance: 1e-9, curve: { kind: 'curve', id: `k${i}`, degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] } });
const zig = (n, y) => { const pts = Array.from({ length: n + 1 }, (_, i) => [i, y + (i % 2), 0]); return brepOf(pts.slice(1).map((p, i) => lineEdge(i, 'x', pts[i], p)), pts); };
const refusal = (fn, tag, refusal) => assert.throws(fn, e => e instanceof BandError && e.tag === tag && e.refusal === refusal, tag);

test('limits: 32 pieces a side, 16 poles a patch, a cubic profile', () => {
  const side = (brep, body = 'x') => ({ body, brep, names: ['x'] });
  const ok = bandSurface({ id: 'z', a: side(zig(32, 0)), b: side(zig(32, 5)) });
  assert.equal(ok.report.pairs, 32); assert.equal(checkBrep(ok.brep).valid, true);
  refusal(() => bandSurface({ id: 'z', a: side(zig(33, 0)), b: side(zig(32, 5)) }), 'BAND_CHAIN', 'SELECTION');
  // A 17-pole cubic Bezier against a line: more than 16 poles.
  const poles = Array.from({ length: 17 }, (_, i) => [i, 3 * Math.sin(i), 0]), knots = [0, 0, 0, 0, ...Array.from({ length: 13 }, (_, i) => (i + 1) / 14), 1, 1, 1, 1];
  const long = { faces: [], vertices: [{ id: 'v0', point: poles[0], tolerance: 1e-9 }, { id: 'v1', point: poles[16], tolerance: 1e-9 }], edges: [{ id: 'x0', name: 'x', vertices: ['v0', 'v1'], tolerance: 1e-9, curve: { kind: 'curve', id: 'k0', degree: 3, knots, controlPoints: poles, weights: poles.map(() => 1) } }] };
  refusal(() => bandSurface({ id: 'z', a: side(long), b: side(zig(1, 9)) }), 'BAND_PROFILE', 'CAPABILITY');
});

test('a single closed edge is a closed side: two NURBS circles, one patch, the exact frustum', () => {
  const w = Math.SQRT1_2, knots = [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1], weights = [1, w, 1, w, 1, w, 1, w, 1];
  const ring = (r, z) => [[r, 0], [r, r], [0, r], [-r, r], [-r, 0], [-r, -r], [0, -r], [r, -r], [r, 0]].map(([x, y]) => [x, y, z]);
  const closedBrep = (r, z) => ({ faces: [], vertices: [{ id: 'v0', point: [r, 0, z], tolerance: 1e-9 }], edges: [{ id: 'x0', name: 'x', vertices: ['v0', 'v0'], tolerance: 1e-9, curve: { kind: 'curve', id: 'k0', degree: 2, knots, controlPoints: ring(r, z), weights } }] });
  const out = bandSurface({ id: 'z', a: { body: 'a', brep: closedBrep(20, 0), names: ['x'] }, b: { body: 'b', brep: closedBrep(10, 30), names: ['x'] } });
  assert.deepEqual([out.report.pairs, out.report.closed, out.report.pieces], [1, true, [1, 1]]);
  assert.ok(close(bandArea(out.brep), Math.PI * 30 * Math.sqrt(1000), 1e-9));
  assert.equal(checkBrep(out.brep).valid, true);
  assert.ok(out.report.boundaryDeviation < 1e-12);
});

// ---- B2 audit: seams at different angles, folds between samples, reversed B-splines, merged joints, plain messages ----
const W = Math.SQRT1_2;
/** A circle of radius r at z, its start at angle `theta`, as `pieces` (1, 2 or 4) NURBS edges sharing vertices (names all `x`). */
function circleSide(r, z, theta, pieces) {
  const at = (rad, a) => [rad * Math.cos(a + theta), rad * Math.sin(a + theta), z];
  const poles = Array.from({ length: 9 }, (_, i) => i % 2 === 0 ? at(r, i * Math.PI / 4) : at(r / W, i * Math.PI / 4)), per = 8 / pieces;
  const vertices = Array.from({ length: pieces }, (_, i) => ({ id: `v${i}`, point: poles[i * per], tolerance: 1e-9 }));
  const knots = { 1: [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1], 2: [0, 0, 0, 0.5, 0.5, 1, 1, 1], 4: [0, 0, 0, 1, 1, 1] }[pieces];
  const edges = Array.from({ length: pieces }, (_, i) => { const idx = Array.from({ length: per + 1 }, (_, k) => i * per + k); return { id: `x${i}`, name: 'x', vertices: [`v${i}`, `v${(i + 1) % pieces}`], tolerance: 1e-9, curve: { kind: 'curve', id: `k${i}`, degree: 2, knots, controlPoints: idx.map(k => poles[k]), weights: idx.map(k => k % 2 === 0 ? 1 : W) } }; });
  return { body: 'c', brep: { faces: [], edges, vertices }, names: ['x'] };
}
const angleOf = p => Math.atan2(p[1], p[0]);

test('seams at different angles give the frustum, never a twisted band: the rulings join equal angles (45 and 90 degrees; 1, 2 and 4 pieces)', () => {
  const frustum = Math.PI * 30 * Math.sqrt(100 + 900);
  for (const theta of [Math.PI / 4, Math.PI / 2, 0.3]) for (const pieces of [1, 2, 4]) {
    const out = bandSurface({ id: 'z', a: circleSide(20, 0, 0, pieces), b: circleSide(10, 30, theta, pieces) });
    // Exact when the seam falls on a quarter span (the two sides then share one parametrization law inside every patch); a seam
    // inside a span pairs equal parameters inside the patch, not equal angles: within 1e-4 of the frustum (3.6e-5 at 45 degrees), against -12% twisted.
    const tolerance = Math.abs(Math.round(theta / (Math.PI / 2)) - theta / (Math.PI / 2)) < 1e-12 ? 1e-9 : 1e-4;
    assert.ok(close(bandArea(out.brep), frustum, tolerance), `theta ${theta} pieces ${pieces}: ${bandArea(out.brep)} vs ${frustum}`);
    for (const e of out.brep.edges) if (/^z\.band\d+\|z\.band\d+$/.test(e.name)) {
      const p = e.curve.controlPoints, d = Math.abs(angleOf(p[0]) - angleOf(p.at(-1)));
      assert.ok(Math.min(d, 2 * Math.PI - d) < 1e-9, `${e.name} joins angles ${angleOf(p[0])} and ${angleOf(p.at(-1))}`);
    }
    // (Only a seam that is one of B's own joints and equal counts pair piece by piece.)
    assert.equal(out.report.pairing, theta === Math.PI / 2 && pieces === 4 ? 'pieces' : 'length', `theta ${theta} pieces ${pieces}`);
  }
  // The same repro through the part model: the second cylinder turned a quarter turn about z.
  const o = bandOut([circle('c1', 20), extrude('e1', 'c1', 5), circle('c2', 10), extrude('e2', 'c2', 5, 25), { id: 'tz', kind: 'rotate', target: 'e2', axis: 'z', angle: 90 },
    band({ target: 'e1', edges: ['e1.bottom|e1.side0#2', 'e1.bottom|e1.side0#1'] }, { target: 'tz', edges: ['e2.bottom|e2.side0#2', 'e2.bottom|e2.side0#1'] })]);
  assert.ok(close(bandArea(o.brep), Math.PI * 30 * Math.sqrt(100 + 625), 1e-9), String(bandArea(o.brep)));
});

test('a ruling that shrinks to zero between samples is refused where it is: a crossing bowtie', () => {
  const side = (a, b) => ({ body: 'l', brep: { faces: [], vertices: [{ id: 'v0', point: a, tolerance: 1e-9 }, { id: 'v1', point: b, tolerance: 1e-9 }], edges: [{ id: 'x0', name: 'x', vertices: ['v0', 'v1'], tolerance: 1e-9, curve: { kind: 'curve', id: 'k0', degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] } }] }, names: ['x'] });
  assert.throws(() => bandSurface({ id: 'z', a: side([0, 0, 0], [10, 0, 0]), b: side([0, 1, 0], [10, -1.03, 0]) }), e => e instanceof BandError && e.tag === 'BAND_TOUCH' && e.refusal === 'GEOMETRY' && /cross at \(4\.9\d*, 0, 0\)/.test(e.message), 'BAND_TOUCH near x = 4.926');
  // A fold that never touches: the ruling's normal turns over (x offset keeps the rulings off zero).
  assert.throws(() => bandSurface({ id: 'z', a: side([0, 0, 0], [10, 0, 0]), b: side([2, 1, 0], [12, -1.03, 0]) }), e => e instanceof BandError && e.tag === 'BAND_DEGENERATE' && /folds over/.test(e.message));
});

/** The distance of p from a curve: 3000 samples, then golden-section on the best span. */
function nearDistance(curve, p) {
  const a = curve.knots[0], b = curve.knots.at(-1), f = t => { const q = evaluateCurve(curve, t); return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); };
  let best = 0; for (let i = 1; i <= 3000; i++) if (f(a + (b - a) * i / 3000) < f(a + (b - a) * best / 3000)) best = i;
  let x = a + (b - a) * Math.max(0, best - 1) / 3000, y = a + (b - a) * Math.min(3000, best + 1) / 3000;
  for (let i = 0; i < 100; i++) { const c = y - 0.618033988749895 * (y - x), d = x + 0.618033988749895 * (y - x); if (f(c) < f(d)) y = d; else x = c; }
  return f((x + y) / 2);
}
const bsCurve = { degree: 3, knots: [0, 0, 0, 0, 0.3, 0.55, 1, 1, 1, 1], controlPoints: [[0, 0, 0], [3, 1, 1], [6, -0.5, 0], [9, 0.8, 0.6], [12, 0, 0.3], [15, 0.3, 0]], weights: [1, 0.7, 1.4, 0.9, 1.2, 1] };
const lineCurveOf = (a, b) => ({ degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] });
/** A synthetic side of curves joined end to end (vertices by position), edge names `${tag}.e<i>`. */
function curvesSide(curves, tag) {
  const vertices = [], vid = p => { const v = vertices.find(x => Math.hypot(x.point[0] - p[0], x.point[1] - p[1], x.point[2] - p[2]) < 1e-9); if (v) return v.id; vertices.push({ id: `${tag}v${vertices.length}`, point: p, tolerance: 1e-9 }); return vertices.at(-1).id; };
  const ends = c => [evaluateCurve({ kind: 'curve', id: 'q', ...c }, c.knots[0]), evaluateCurve({ kind: 'curve', id: 'q', ...c }, c.knots.at(-1))];
  const edges = curves.map((c, i) => ({ id: `${tag}e${i}`, name: `${tag}.e${i}`, tolerance: 1e-9, vertices: ends(c).map(vid), curve: { kind: 'curve', id: `${tag}c${i}`, ...c } }));
  return { body: tag, brep: { faces: [], vertices, edges }, names: edges.map(e => e.name) };
}

test('reversing a non-symmetric weighted B-spline keeps the boundary on the source (a chain run backward, and B turned against A)', () => {
  const lifted = { ...bsCurve, controlPoints: bsCurve.controlPoints.map(p => [p[0], p[1], p[2] + 10]) };
  const cases = [[[lineCurveOf([-5, 0, 0], [15, 0.3, 0]), bsCurve], [lineCurveOf([-5, 0, 10], [15, 0, 10])]], [[lineCurveOf([15, 0, 0], [0, 0, 0])], [lifted]]];
  for (const [A, B] of cases) {
    const out = bandSurface({ id: 'bd', a: curvesSide(A, 'A'), b: curvesSide(B, 'B') });
    let worst = 0;
    for (const f of out.brep.faces) for (let i = 0; i <= 40; i++) {
      const u = i / 40, pa = evaluateSurface(f.surface, u, 0), pb = evaluateSurface(f.surface, u, 1);
      worst = Math.max(worst, Math.min(...A.map(c => nearDistance({ kind: 'curve', id: 'q', ...c }, pa))), Math.min(...B.map(c => nearDistance({ kind: 'curve', id: 'q', ...c }, pb))));
    }
    assert.ok(worst <= 1e-9, `the boundary is ${worst} off its source`);
    assert.ok(out.report.boundaryDeviation <= 1e-9);
  }
});

test('joints within 1e-4 of each other (normalized length) are one break', () => {
  const run = (pts, y, z) => curvesSide(pts.slice(1).map((x, i) => lineCurveOf([pts[i], y, z], [x, y, z])), y === 0 ? 'A' : 'B');
  const out = bandSurface({ id: 'm', a: run([0, 5, 10], 0, 0), b: run([0, 5.0005, 8, 10], 3, 1) });
  // A's joint at 0.5 and B's at 0.50005 merge: 2 breaks, 3 patches (unmerged it would be a 4th, a sliver).
  assert.equal(out.report.pairs, 3); assert.equal(out.report.pairing, 'length');
  const ruling = out.brep.edges.find(e => e.name === 'm.band0|m.band1').curve.controlPoints;
  assert.deepEqual([ruling[0][0], ruling.at(-1)[0]], [5, 5.0005]);
});

test('the aligner\'s own words never reach a message: pole budget and coordinate range say it plainly', () => {
  const knotsOf = inner => [0, 0, 0, 0, ...inner, 1, 1, 1, 1];
  const wavy = (inner, y) => ({ degree: 3, knots: knotsOf(inner), controlPoints: Array.from({ length: inner.length + 4 }, (_, i) => [i, y + (i % 2), 0]), weights: Array.from({ length: inner.length + 4 }, () => 1) });
  const odd = Array.from({ length: 8 }, (_, i) => (2 * i + 1) / 18), even = Array.from({ length: 8 }, (_, i) => (2 * i + 2) / 18);
  assert.throws(() => bandSurface({ id: 'z', a: curvesSide([wavy(odd, 0)], 'A'), b: curvesSide([wavy(even, 5)], 'B') }), e => e instanceof BandError && e.tag === 'BAND_PROFILE' && /^\[BAND_PROFILE\] pair 0: the band would need more than 16 poles per direction$/.test(e.message), 'plain pole budget');
  assert.throws(() => bandSurface({ id: 'z', a: curvesSide([lineCurveOf([0, 0, 0], [20000, 0, 0])], 'A'), b: curvesSide([lineCurveOf([0, 5, 3], [20000, 5, 3])], 'B') }), e => e instanceof BandError && e.tag === 'BAND_PROFILE' && /^\[BAND_PROFILE\] pair 0: coordinates beyond ±10000 mm$/.test(e.message), 'plain range');
});
