import test from 'node:test';
import assert from 'node:assert/strict';
import { sprocket, sprocketPitchDiameter, timingPitchDiameter, pulley, openBeltLength, chainLinks, beltBand, couplingEnvelope, driveRowProblem, DriveError, checkBrep, brepMassProperties, evaluateSurface, surfaceDomain, evaluateCadPart } from '../dist/index.js';

// R12c.6b (D161): sprockets and chain, pulleys and belts, couplings. The rows are test rows flagged estimates (no chain,
// belt or coupling table was read: D139 found none as public text). Oracles written here, apart from the kernel's code:
// - a sprocket's area by integrating, ray by ray, a membership test of the region (the tip disc less each seat's circle and
//   the gap above its seats' tangent line outside both neighbours' flank circles), transitions refined by bisection;
//   the roller turning out of a seat about its neighbour measured against the built faces' own curves;
// - a timing pulley's area: the disc less each groove (its polygon cut at the outside circle, by a quadratic solved here,
//   plus the circular segment under its chord);
// - V and flat pulleys and the coupling by Pappus on their sections by hand;
// - the belt's length by 2√(C² − (R1 − R2)²) + R1·2(π − acos((R1 − R2)/C)) + R2·2acos((R1 − R2)/C) (another form than the
//   kernel's), the band's volume L·t·w (Steiner: the offsets' lengths differ from L by πt).

const near = (got, want, abs, what) => assert.ok(Math.abs(got - want) <= abs, `${what}: ${got} vs ${want} (±${abs})`);
const code = c => e => e instanceof DriveError && e.code === c;
const vol = b => brepMassProperties(b, 1, { quadratureSegments: 16 }).volumeMM3;
const TAU = 2 * Math.PI;
const CHAIN = { kind: 'chain', id: 'chain-a', pitchMM: 12.7, rollerDiameterMM: 8.51, innerWidthMM: 7.75, plateHeightMM: 11.8, estimate: true };
const TIMING = { kind: 'timing-belt', id: 'timing-a', pitchMM: 5, pitchLineOffsetMM: 0.5, groove: [[-1.6, 0], [-1.1, 1.2], [1.1, 1.2], [1.6, 0]], thicknessMM: 2.2, estimate: true };
const VBELT = { kind: 'v-belt', id: 'v-a', angleDeg: 38, datumWidthMM: 8.5, aboveDatumMM: 2, belowDatumMM: 9, spacingMM: 12, edgeMM: 8, thicknessMM: 8, estimate: true };
const FLAT = { kind: 'flat-belt', id: 'flat-a', widthMM: 40, thicknessMM: 3, estimate: true };
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
/** Points along the solid's side faces at z 0 (their surfaces' v = 0 edge). */
function profilePoints(brep, re, per = 64) {
  const pts = [];
  for (const f of brep.faces) { if (!re.test(f.name)) continue; const d = surfaceDomain(f.surface); for (let i = 0; i <= per; i++) pts.push(evaluateSurface(f.surface, d.u[0] + (d.u[1] - d.u[0]) * i / per, d.v[0])); }
  return pts;
}

test('R12c.6b drive rows: chain, timing, V, flat belt and coupling rows checked — a source or an estimate, no unknown field, sizes that make sense', () => {
  for (const r of [CHAIN, TIMING, VBELT, FLAT]) assert.equal(driveRowProblem(r), null, r.id);
  const bad = (r, re) => assert.match(String(driveRowProblem(r)), re);
  bad({ ...CHAIN, estimate: undefined }, /never neither/); bad({ ...CHAIN, source: 'x' }, /not both/); bad({ ...CHAIN, colour: 'red' }, /unknown field colour/);
  bad({ ...CHAIN, rollerDiameterMM: 13 }, /under the pitch/); bad({ ...CHAIN, kind: 'rope' }, /kind is chain/);
  bad({ ...TIMING, groove: [[-1, 0], [1, 0]] }, /at least three points/); bad({ ...TIMING, groove: [[-1, 0.2], [0, 1], [1, 0]] }, /first and last points/);
  bad({ ...VBELT, belowDatumMM: 20 }, /sides meet above its bottom/); bad({ ...VBELT, spacingMM: 9 }, /need a spacing/);
  bad({ kind: 'coupling', id: 'c', boreMM: [12, 40], outsideMM: 30, lengthMM: 40, estimate: true }, /under its outside/);
});

test('R12c.6b a sprocket for chain-a, 17 teeth (pivot-clearance form): the pitch Ø p/sin(π/z), the root, the pointed tip; the area by a membership test integrated ray by ray; a roller turning out of its seat clears the built teeth by r_s − r_1', () => {
  const spec = { chain: { ...CHAIN }, teeth: 17, tipDiameterMM: 75, widthMM: 7, seatDiameterMM: 8.8, boreDiameterMM: 20 }, { brep, report } = sprocket(spec, { id: 's' });
  assert.equal(checkBrep(brep).valid, true);
  const z = 17, p = 12.7, rs = 4.4, rf = p - rs, R = p / (2 * Math.sin(Math.PI / z)), Rt = 37.5, r1 = 8.51 / 2;
  near(report.pitchDiameterMM, sprocketPitchDiameter(p, z), 1e-6, 'pitch Ø'); near(report.pitchDiameterMM, 69.115828, 1e-6, 'pitch Ø value');
  near(report.rootDiameterMM, 2 * (R - rs), 1e-6, 'root'); near(report.flankRadiusMM, rf, 1e-12, 'flank radius');
  near(report.pointedTipDiameterMM, 2 * (R * Math.cos(Math.PI / z) + Math.sqrt(rf * rf - p * p / 4)), 1e-6, 'pointed tip');
  // Membership: inside the tip disc, outside the nearest seat's circle, and not in its gap (above the seats' tangent line,
  // outside both neighbours' flank circles).
  const P = k => [R * Math.cos(TAU * k / z), R * Math.sin(TAU * k / z)], rT = R - rs * Math.sin(Math.PI / z);
  const inside = (x, y) => {
    if (x * x + y * y > Rt * Rt) return false;
    const k = Math.round(Math.atan2(y, x) / (TAU / z)), c = P(k), e = [c[0] / R, c[1] / R];
    if (Math.hypot(x - c[0], y - c[1]) < rs) return false;
    const a = P(k - 1), b = P(k + 1);
    return !(x * e[0] + y * e[1] > rT && Math.hypot(x - a[0], y - a[1]) > rf && Math.hypot(x - b[0], y - b[1]) > rf);
  };
  // One tooth's period by rays (the region is the same in each): ∫ r dr over the inside runs, then × z, less the bore.
  let area = 0; const NA = 3000, NR = 600;
  for (let i = 0; i < NA; i++) {
    const phi = (i + 0.5) / NA * TAU / z, cx = Math.cos(phi), sy = Math.sin(phi), f = r => inside(r * cx, r * sy);
    let prev = f(10), rin = 10;
    for (let j = 1; j <= NR; j++) {
      const r = 10 + (Rt + 0.01 - 10) * j / NR, now = f(r);
      if (now !== prev) { let lo = 10 + (Rt + 0.01 - 10) * (j - 1) / NR, hi = r; for (let q = 0; q < 50; q++) { const m = (lo + hi) / 2; if (f(m) === prev) lo = m; else hi = m; } const at = (lo + hi) / 2; if (prev) area += (at * at - rin * rin) / 2; else rin = at; prev = now; }
    }
    if (prev) area += ((Rt) ** 2 - rin * rin) / 2;
  }
  // (From r 10, the bore's radius: the area outside the bore.)
  const want = area * (TAU / z / NA) * z * 7;
  near(vol(brep), want, 2e-5 * want, 'volume (rays)');
  // The roller of seat 5 turning out about seat 6's centre: its gap to the built faces' curves.
  const pts = profilePoints(brep, /\.(seat|flank|tip)\d+$/, 96), a5 = P(5), a6 = P(6), g0 = Math.atan2(a5[1] - a6[1], a5[0] - a6[0]);
  let gap = Infinity;
  for (let i = 0; i <= 40; i++) {
    const g = g0 + i / 40 * Math.PI / 3, X = [a6[0] + p * Math.cos(g), a6[1] + p * Math.sin(g)];
    if (Math.hypot(X[0], X[1]) > Rt + r1) break;
    for (const q of pts) gap = Math.min(gap, Math.hypot(q[0] - X[0], q[1] - X[1]) - r1);
  }
  near(gap, rs - r1, 2e-3, 'engagement clearance (sampled)'); near(report.engagementClearanceMM, rs - r1, 1e-6, 'the kernel\'s');
  assert.deepEqual(report.warnings, ['the chain row chain-a is an estimate']);
  const names = new Set(brep.faces.map(f => f.name.replace(/\d+$/, '')));
  assert.deepEqual([...names].sort(), ['s.bore#', 's.face', 's.flank', 's.seat', 's.tip']);
});

test('R12c.6b sprocket refusals: a pointed tip, a tip under the seats\' edge, a seat smaller than the roller, another tooth form (UNSUPPORTED_TOOTH_FORM), a bore through the roots', () => {
  const s = f => () => sprocket({ chain: CHAIN, teeth: 17, tipDiameterMM: 75, widthMM: 7, ...f });
  assert.throws(s({ tipDiameterMM: 80 }), e => code('TOOTH_FORM')(e) && /pointed at Ø79\.07/.test(e.message));
  assert.throws(s({ tipDiameterMM: 62 }), e => code('TOOTH_FORM')(e) && /above where the flanks leave the seats/.test(e.message));
  assert.throws(s({ seatDiameterMM: 8 }), e => code('INVALID_INPUT')(e) && /at least the roller/.test(e.message));
  assert.throws(s({ toothForm: 'iso-606' }), e => code('UNSUPPORTED_TOOTH_FORM')(e) && /ISO 606's formulas were not read/.test(e.message));
  assert.throws(s({ boreDiameterMM: 60 }), e => code('INVALID_INPUT')(e) && /below the roots/.test(e.message));
});

test('R12c.6b a timing pulley for timing-a (the row\'s groove profile), 20 grooves: pitch Ø pz/π, outside Ø less 2u; the area the disc less each groove cut at the outside circle', () => {
  const { brep, report } = pulley({ belt: TIMING, teeth: 20, widthMM: 10, boreDiameterMM: 8 }, { id: 't' });
  assert.equal(checkBrep(brep).valid, true);
  const PD = 5 * 20 / Math.PI, Ro = PD / 2 - 0.5;
  near(report.pitchDiameterMM, timingPitchDiameter(5, 20), 1e-6, 'pitch Ø'); near(report.outsideDiameterMM, 2 * Ro, 1e-6, 'outside Ø');
  // One groove in its frame (x along, y = Ro − depth up): its ends cut at the circle x² + y² = Ro².
  const g = TIMING.groove.map(([x, d]) => [x, Ro - d]);
  const cutAt = (A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1], a = dx * dx + dy * dy, b = 2 * (A[0] * dx + A[1] * dy), c = A[0] ** 2 + A[1] ** 2 - Ro * Ro, t = (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a); return [A[0] + t * dx, A[1] + t * dy]; };
  g[0] = cutAt(g[0], g[1]); g[3] = cutAt(g[3], g[2]);
  let poly = 0; for (let i = 0; i < g.length; i++) { const a = g[i], b = g[(i + 1) % g.length]; poly += (a[0] * b[1] - b[0] * a[1]) / 2; }
  const th = 2 * Math.asin(Math.hypot(g[3][0] - g[0][0], g[3][1] - g[0][1]) / (2 * Ro)), seg = Ro * Ro / 2 * (th - Math.sin(th));
  const groove = Math.abs(poly) + seg, want = (Math.PI * Ro * Ro - 20 * groove - Math.PI * 16) * 10;
  near(vol(brep), want, 1e-7 * want, 'volume');
  assert.ok(brep.faces.some(f => f.name === 't.groove7.2') && brep.faces.some(f => f.name === 't.land20'));
  assert.throws(() => pulley({ belt: { ...TIMING, groove: [[-3, 0], [-2, 1.2], [2, 1.2], [3, 0]] }, teeth: 10, widthMM: 10 }), e => code('TOOTH_FORM')(e) && /no land left/.test(e.message));
});

test('R12c.6b a V pulley (two v-a grooves on a Ø100 datum) and a crowned flat pulley: Pappus on their sections by hand', () => {
  const { brep, report } = pulley({ belt: VBELT, diameterMM: 100, grooves: 2, boreDiameterMM: 20 }, { id: 'v' });
  assert.equal(checkBrep(brep).valid, true);
  const t = Math.tan(19 * Math.PI / 180), ro = 52, rb = 41, wt = 8.5 + 4 * t, wb = 8.5 - 18 * t, W = 12 + 16;
  // The trapezoid's area and its centroid's radius (from rb: the parallel sides wb at rb and wt at ro).
  const h = ro - rb, A = (wt + wb) / 2 * h, xc = rb + h * (wb + 2 * wt) / (3 * (wb + wt));
  const want = Math.PI * (ro * ro - 100) * W - 2 * TAU * xc * A;
  near(vol(brep), want, 1e-7 * want, 'V volume'); near(report.outsideDiameterMM, 104, 1e-9, 'outside'); near(report.widthMM, 28, 1e-9, 'width');
  // Flat Ø80 × 50 crowned 0.5: the edge radius 39.5, the cap a circular segment of ρ = (h² + 25²)/(2h) beyond x = 39.5.
  const f = pulley({ belt: FLAT, diameterMM: 80, widthMM: 50, crownMM: 0.5, boreDiameterMM: 20 }, { id: 'f' });
  assert.equal(checkBrep(f.brep).valid, true);
  const rho = (0.25 + 625) / 1, xc0 = 40 - rho, th = 2 * Math.asin(25 / rho), As = rho * rho / 2 * (th - Math.sin(th)), xs = xc0 + 4 * rho * Math.sin(th / 2) ** 3 / (3 * (th - Math.sin(th)));
  const wf = Math.PI * (39.5 ** 2 - 100) * 50 + TAU * xs * As;
  near(vol(f.brep), wf, 1e-7 * wf, 'flat volume'); assert.deepEqual(f.report.warnings, ['the belt row flat-a is an estimate']);
  const narrow = pulley({ belt: FLAT, diameterMM: 80, widthMM: 30, boreDiameterMM: 20 }).report;
  assert.ok(narrow.warnings.some(w => /^FACE_WIDTH: the belt 40 mm wide runs off a face 30 mm wide/.test(w)));
});

test('R12c.6b belts and chains: the open length by another form, the band\'s volume L·t·w; a chain\'s pitches rounded to whole and even links, the distance solved back; overlapping wheels refused', () => {
  const L = (R1, R2, C) => { const c = (R1 - R2) / C; return 2 * Math.sqrt(C * C - (R1 - R2) ** 2) + R1 * 2 * (Math.PI - Math.acos(c)) + R2 * 2 * Math.acos(c); };
  near(openBeltLength(40, 25, 150).lengthMM, L(40, 25, 150), 1e-9, 'length'); near(openBeltLength(25, 40, 150).lengthMM, L(25, 40, 150), 1e-9, 'length, small first');
  const { brep, report } = beltBand({ row: FLAT, pitchRadiiMM: [40, 25], centerDistanceMM: 150 }, { id: 'b' });
  assert.equal(checkBrep(brep).valid, true);
  near(vol(brep), L(40, 25, 150) * 3 * 40, 1e-7 * 60685, 'band volume L·t·w');
  near(report.wrapDeg[0], 360 - 2 * Math.acos(15 / 150) * 180 / Math.PI, 1e-9, 'wrap on the large wheel');
  const R1 = sprocketPitchDiameter(12.7, 17) / 2, R2 = sprocketPitchDiameter(12.7, 34) / 2, ch = chainLinks(12.7, R1, R2, 200);
  near(ch.pitches, L(R1, R2, 200) / 12.7, 1e-9, 'pitches'); assert.equal(ch.links, 58); near(L(R1, R2, ch.centerDistanceMM), 58 * 12.7, 1e-6, 'the distance for 58 links');
  const even = chainLinks(12.7, R1, R2, 205, 'even'); assert.equal(even.links % 2, 0);
  const band = beltBand({ row: CHAIN, pitchRadiiMM: [R1, R2], centerDistanceMM: 200 }).report;
  assert.ok(band.warnings.some(w => /^CHAIN_LINKS: 57\.53\d+ pitches at 200 mm; 58 links need a centre distance of 203\.01\d+ mm$/.test(w)), JSON.stringify(band.warnings));
  assert.deepEqual([band.bandThicknessMM, band.bandWidthMM, band.bandEstimate], [11.8, 7.75, false]);
  assert.throws(() => openBeltLength(40, 25, 60), e => code('BELT_GEOMETRY')(e) && /overlap/.test(e.message));
});

test('R12c.6b a coupling\'s envelope (stepped bores Ø12/Ø14 at 18 in a Ø30 × 40 sleeve): Pappus by hand; a bought item with the row\'s part number', () => {
  const row = { kind: 'coupling', id: 'R20', type: 'rigid sleeve', boreMM: [12, 14], outsideMM: 30, lengthMM: 40, boreStepMM: 18, partNumber: 'TEST-1', supplier: 'a test supplier', estimate: true };
  const { brep, report } = couplingEnvelope(row, { id: 'k' });
  assert.equal(checkBrep(brep).valid, true);
  near(vol(brep), Math.PI * ((225 - 36) * 18 + (225 - 49) * 22), 1e-7 * 22850, 'volume');
  assert.deepEqual(report.bought, { bought: true, partNumber: 'TEST-1', supplier: 'a test supplier' });
  assert.deepEqual([report.estimate, report.envelopeOnly], [true, true]);
  assert.deepEqual([...new Set(brep.faces.map(f => f.name.replace(/#\d+$/, '')))].sort(), ['k.bore1', 'k.bore2', 'k.face0', 'k.face1', 'k.outside', 'k.step']);
});

test('R12c.6b part model: sprocket, pulley, belt and coupling kinds placed, their reports on the outputs, refusals with their codes', () => {
  const snap = evaluateCadPart(D([
    { id: 's', kind: 'sprocket', row: CHAIN, teeth: 17, tip: 75, width: 7, bore: 20, center: [10, 5], from: 2 },
    { id: 'p', kind: 'pulley', row: FLAT, diameter: 80, width: 50, bore: 20, center: [200, 0] },
    { id: 'b', kind: 'belt', row: FLAT, pitchRadii: [40, 25], centerDistance: 150, rotation: 30 },
    { id: 'k', kind: 'coupling', row: { kind: 'coupling', id: 'R20', boreMM: [12, 12], outsideMM: 30, lengthMM: 40, estimate: true } },
  ]));
  assert.equal(snap.output('s').sprocket.teeth, 17); assert.equal(snap.output('p').pulley.type, 'flat'); assert.equal(snap.output('b').belt.row, 'flat-a'); assert.equal(snap.output('k').coupling.bought.bought, true);
  near(vol(snap.output('k').brep), Math.PI * (225 - 36) * 40, 1e-6, 'a straight bore');
  const refused = (f, c, tag) => assert.throws(() => evaluateCadPart(D([f])), e => (e.details?.category ?? e.code) === c && e.message.includes(`[${tag}]`), tag);
  refused({ id: 's', kind: 'sprocket', row: CHAIN, teeth: 17, tip: 85, width: 7 }, 'GEOMETRY', 'TOOTH_FORM');
  refused({ id: 's', kind: 'sprocket', row: CHAIN, teeth: 17, tip: 75, width: 7, toothForm: 'iso-606' }, 'CAPABILITY', 'UNSUPPORTED_TOOTH_FORM');
  refused({ id: 'b', kind: 'belt', row: FLAT, pitchRadii: [40, 25], centerDistance: 50 }, 'GEOMETRY', 'BELT_GEOMETRY');
  refused({ id: 'p', kind: 'pulley', row: { ...FLAT, estimate: undefined }, diameter: 80, width: 50, bore: 20 }, 'INPUT', 'INVALID_INPUT');
});
