import test from 'node:test';
import assert from 'node:assert/strict';
import { spurGear, spurGearDimensions, checkSpurGearPair, checkSpurGearRack, evaluateCadPart, GearError, checkBrep, brepMassProperties, exportStep, importStep, evaluateCurve, curveDomain } from '../dist/index.js';

// R12b.1a (D130): the generated root — the root the basic rack cuts (its tip rounded by ρ, 0.38 m by default), generator
// spur-gear@1. Every check here is against an oracle written in this file, apart from gear.ts: the tool's true signed
// distance maximised over its travel (a point on the cut boundary is touched, never entered), the textbook form circle,
// and the area of the boundary built here from its own envelope and involute.
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (|Δ| ${Math.abs(a - b).toExponential(3)} > ${tol})`);
const ALPHA = 20 * Math.PI / 180, TAN = Math.tan(ALPHA), SIN = Math.sin(ALPHA), COS = Math.cos(ALPHA), inv = p => Math.tan(p) - p;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });

/**
 * The cutting tool: the basic rack, addendum 1.25m into the gear, flanks at α, its tooth πm/2 + Δs wide on its reference
 * line (Δs the gear's thickness reduction), tip rounds ρ; its reference line at y = r + x m above the gear's centre, a
 * tooth on x = 0 pointing down. As the gear turns φ the rack moves by −rφ.
 */
function tool(m, z, x = 0, red = 0, rho = 0.38 * m) {
  const r = m * z / 2, yRef = r + x * m, hA = 1.25 * m, hc = hA - rho, xc = Math.PI * m / 4 + red / 2 - hc * TAN - rho / COS, yc = yRef - hc;
  return { m, z, x, red, rho, r, yRef, hA, xc, yc, rb: r * COS, rf: yRef - hA, ra: r + m * (1 + x), tx: xc + rho * COS, ty: yc - rho * SIN, psi: (m * (Math.PI / 2 + 2 * x * TAN) - red) / (2 * r) + inv(ALPHA) };
}
const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
/** The tool's signed distance at a point of its own frame: + inside the tool, − outside (its outline: flat, round, flank, by symmetry). */
function toolDistance(T, qx, qy) {
  const p = Math.PI * T.m;
  let u = qx - p * Math.round(qx / p); u = Math.abs(u);
  const yt = T.yRef - T.hA;
  // The round: from its lowest point (angle −90°) to its tangent point with the flank (angle −α).
  const ang = Math.atan2(qy - T.yc, u - T.xc), onArc = ang >= -Math.PI / 2 && ang <= -ALPHA;
  const dArc = onArc ? Math.abs(Math.hypot(u - T.xc, qy - T.yc) - T.rho) : Infinity;
  // The flank, from the tangent point up to the half period.
  const hTop = (Math.PI * T.m / 4 + T.red / 2 - p / 2) / TAN, fx1 = p / 2, fy1 = T.yRef - hTop;
  const d = Math.min(segDist(u, qy, 0, yt, T.xc, yt), dArc, segDist(u, qy, T.tx, T.ty, fx1, fy1), Math.hypot(u - T.xc, qy - yt), Math.hypot(u - T.tx, qy - T.ty));
  const low = u <= T.xc ? yt : u <= T.tx ? T.yc - Math.sqrt(Math.max(0, T.rho ** 2 - (u - T.xc) ** 2)) : T.yRef - (Math.PI * T.m / 4 + T.red / 2 - u) / TAN;
  return qy >= low ? d : -d;
}
/** How deep the gear point p ever gets into the tool over its travel (scan, then golden section). On the cut boundary: 0. */
function maxPenetration(T, px, py) {
  const span = 2.2 * Math.PI / T.z + 0.6, n = 1200, at = phi => { const c = Math.cos(phi), s = Math.sin(phi); return toolDistance(T, c * px - s * py + T.r * phi, s * px + c * py); };
  let best = -Infinity, arg = 0;
  for (let i = 0; i <= n; i++) { const phi = -span + 2 * span * i / n, v = at(phi); if (v > best) { best = v; arg = phi; } }
  let lo = arg - 2 * span / n, hi = arg + 2 * span / n;
  const G = 0.618033988749895;
  let x1 = hi - G * (hi - lo), x2 = lo + G * (hi - lo), f1 = at(x1), f2 = at(x2);
  for (let it = 0; it < 120 && hi - lo > 1e-15; it++) { if (f1 > f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - G * (hi - lo); f1 = at(x1); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + G * (hi - lo); f2 = at(x2); } }
  return Math.max(best, f1, f2);
}

/** The gear's own profile curves at z 0 (each side face's bottom edge), by face name. */
function profileCurves(brep) {
  const edges = new Map(brep.edges.map(e => [e.id, e])), coedges = new Map(brep.coedges.map(c => [c.id, c])), loops = new Map(brep.loops.map(l => [l.id, l])), out = [];
  for (const f of brep.faces) {
    if (!f.name || /face[01]$|bore/.test(f.name)) continue;
    for (const lid of f.loops) for (const cid of loops.get(lid).coedges) {
      const e = edges.get(coedges.get(cid).edge);
      if (e.curve.controlPoints.every(p => Math.abs(p[2]) < 1e-12)) out.push({ name: f.name, curve: e.curve });
    }
  }
  return out;
}
/** The largest |penetration| over points along the named profile curves (tooth 1 only: the others are its turns). */
function worstOn(brep, T, pattern, per = 24) {
  let worst = 0;
  for (const { name, curve } of profileCurves(brep)) {
    if (!pattern.test(name) || !/#1(\.\d)?$/.test(name)) continue;
    const [t0, t1] = curveDomain(curve);
    for (let i = 1; i < per; i++) {
      const q = evaluateCurve(curve, t0 + (t1 - t0) * i / per);
      // The gear's tooth 1 is centred on +X; the oracle's space on +Y: turn by π/2 − π/z (that space follows tooth 1).
      const g = Math.PI / 2 - Math.PI / T.z, c = Math.cos(g), s = Math.sin(g);
      worst = Math.max(worst, Math.abs(maxPenetration(T, c * q[0] - s * q[1], s * q[0] + c * q[1])));
    }
  }
  return worst;
}

/** The envelope of the right tip round at the gear's turn φ, in the oracle's frame (D129's probe, written again here). */
function envelope(T, phi) {
  const cx = T.xc - T.r * phi, dx = cx, dy = T.yc - T.r, L = Math.hypot(dx, dy), px = cx + T.rho * dx / L, py = T.yc + T.rho * dy / L, c = Math.cos(phi), s = Math.sin(phi);
  return [c * px + s * py, -s * px + c * py];
}
const involuteAt = (T, rr) => Math.PI / 2 - Math.PI / T.z + T.psi - inv(Math.acos(Math.min(1, T.rb / rr)));
/**
 * Where the fillet meets the involute, by this file's own reasoning: the form circle's turn when not undercut; when
 * undercut, the envelope's crossing of the involute, by a scan for the sign change then bisection.
 */
function filletEnd(T) {
  const phiRoot = T.xc / T.r, phiF = (T.xc - (T.r - T.yc) / TAN) / T.r, lead = T.r * SIN - (T.hA - T.x * T.m - T.rho * (1 - SIN)) / SIN;
  if (lead >= 0) return { phiRoot, phiEnd: phiF, undercut: false, rForm: Math.sqrt(T.rb ** 2 + lead ** 2) };
  const off = phi => { const p = envelope(T, phi), R = Math.hypot(p[0], p[1]); return R < T.rb ? NaN : Math.atan2(p[1], p[0]) - involuteAt(T, R); };
  let prev = NaN, a = 0, b = 0;
  for (let i = 0; i <= 4000; i++) { const phi = phiRoot + (phiF - phiRoot) * i / 4000, v = off(phi); if (Number.isFinite(prev) && prev < 0 && v >= 0) { a = phiRoot + (phiF - phiRoot) * (i - 1) / 4000; b = phi; break; } prev = v; }
  for (let i = 0; i < 100; i++) { const mid = (a + b) / 2; if (off(mid) < 0) a = mid; else b = mid; }
  return { phiRoot, phiEnd: (a + b) / 2, undercut: true };
}
/** The exact profile's area: the root arcs, envelopes and involutes sampled densely here, by Green's theorem (one tooth × z). */
function generatedArea(T) {
  const { phiRoot, phiEnd } = filletEnd(T), end = envelope(T, phiEnd), rs = Math.hypot(end[0], end[1]), z = T.z, pts = [], n = 20000;
  // One tooth in the oracle's frame, clockwise from the space's middle at +Y down to the tooth's middle (root arc,
  // fillet, involute, tip arc), then that path's mirror on to the previous space's middle; with the centre, by the
  // shoelace formula.
  const toothAt = Math.PI / 2 - Math.PI / z, mirror = ([x, y]) => { const a = 2 * toothAt - Math.atan2(y, x), R = Math.hypot(x, y); return [R * Math.cos(a), R * Math.sin(a)]; };
  const right = [];
  for (let i = 0; i <= n; i++) { const a = Math.PI / 2 - phiRoot * i / n; right.push([T.rf * Math.cos(a), T.rf * Math.sin(a)]); }
  for (let i = 0; i <= n; i++) right.push(envelope(T, phiRoot + (phiEnd - phiRoot) * i / n));
  const t0 = Math.sqrt((rs / T.rb) ** 2 - 1), t1 = Math.sqrt((T.ra / T.rb) ** 2 - 1);
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, R = T.rb * Math.sqrt(1 + t * t); right.push([R * Math.cos(involuteAt(T, R)), R * Math.sin(involuteAt(T, R))]); }
  // The tip arc to the tooth's middle; then the mirror image back down to the previous space's middle.
  const aTip = involuteAt(T, T.ra);
  for (let i = 1; i <= n; i++) { const a = aTip + (toothAt - aTip) * i / n; right.push([T.ra * Math.cos(a), T.ra * Math.sin(a)]); }
  for (const p of right) pts.push(p);
  for (const p of right.slice().reverse().map(mirror)) pts.push(p);
  pts.push([0, 0]);
  let A = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(A) / 2 * z;
}

const CASES = [[2, 20, 0, 0], [3, 12, 0.6, 0.05], [2, 30, -0.3, 0], [1, 60, 0, 0.02], [2, 12, 0, 0], [2, 8, 0, 0], [2, 6, 0.4, 0]];

test('the generated root is refused at the previous HEAD and builds now: valid, its report (spur-gear@1, form circle, undercut), fillet faces per tooth', () => {
  const { brep, report } = spurGear({ moduleMM: 2, teeth: 20, faceWidthMM: 10, rootPolicy: 'generated', boreDiameterMM: 10 }, { id: 'g' });
  assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues?.[0]);
  assert.equal(report.generator, 'spur-gear@1'); assert.equal(report.rootPolicy, 'generated'); assert.equal(report.manufacturingValidated, false);
  assert.deepEqual(report.diagnostics, []);
  const gr = report.generatedRoot;
  assert.equal(gr.toolTipRadiusMM, 0.76); assert.equal(gr.undercut, false);
  assert.ok(gr.filletDeviationMM <= report.profileToleranceMM && gr.filletPieces >= 1 && gr.filletPieces <= 15, JSON.stringify(gr));
  const names = brep.faces.map(f => f.name);
  for (const k of [1, 20]) for (const role of ['filletL', 'filletR', 'flankL', 'flankR', 'tip', 'root']) assert.ok(names.includes(`g.${role}#${k}`), `g.${role}#${k}`);
  assert.ok(!names.some(n => /root[LR]#/.test(n)), 'no schematic radial joins');
  // (A fillet's later faces put their number before the tooth's: `filletL2#k` — R12b.1b, D131 — so a helical gear's axial `#k.2` stays apart.)
  if (gr.filletPieces > 5) assert.ok(names.includes('g.filletL2#1') && names.includes('g.filletR2#20'));
  // The schematic root is as it was: no fillet faces, the warning, generator @0.
  const old = spurGear({ moduleMM: 2, teeth: 20, faceWidthMM: 10, boreDiameterMM: 10 }, { id: 'g' });
  assert.equal(old.report.generator, 'spur-gear@0'); assert.equal(old.report.diagnostics[0].code, 'ROOT_TRANSITION_UNVALIDATED');
  assert.ok(!old.brep.faces.some(f => /fillet/.test(f.name)));
});

test('the gear\'s own profile curves lie on the boundary the rack cuts — the tool touches them over its travel and never goes in, within the measured fit — the fillets, the flanks above them and the root arcs', t => {
  for (const [m, z, x, red] of CASES) {
    const { brep, report } = spurGear({ moduleMM: m, teeth: z, faceWidthMM: 5, profileShiftCoefficient: x, toothThicknessReductionMM: red, rootPolicy: 'generated' }, { id: 'g' }), T = tool(m, z, x, red);
    const t0 = performance.now();
    const fillet = worstOn(brep, T, /fillet[LR]\d?#/), flank = worstOn(brep, T, /flank[LR]#/), root = worstOn(brep, T, /\.root#/, 6);
    assert.ok(fillet <= report.generatedRoot.filletDeviationMM * 1.001 + 1e-9, `m${m} z${z} x${x}: fillets ${fillet} vs their fit ${report.generatedRoot.filletDeviationMM}`);
    assert.ok(flank <= report.profileDeviationMM * 1.001 + 1e-9, `m${m} z${z} x${x}: flanks ${flank} vs ${report.profileDeviationMM}`);
    assert.ok(root <= 1e-9 * m, `m${m} z${z} x${x}: root arcs ${root}`);
    t.diagnostic(`m${m} z${z} x${x} Δs${red}: |penetration| fillets ${fillet.toExponential(2)} (fit ${report.generatedRoot.filletDeviationMM.toExponential(2)}, ${report.generatedRoot.filletPieces} pieces), flanks ${flank.toExponential(2)}, root ${root.toExponential(2)}${report.generatedRoot.undercut ? ', undercut' : ''} (${(performance.now() - t0).toFixed(0)} ms)`);
  }
});

test('the form circle by the textbook formula; the root circle; an undercut gear\'s flank starts where the tool cuts the involute — just above, untouched; just below, cut', () => {
  for (const [m, z, x, red] of CASES) {
    const { report } = spurGear({ moduleMM: m, teeth: z, faceWidthMM: 5, profileShiftCoefficient: x, toothThicknessReductionMM: red, rootPolicy: 'generated' }), T = tool(m, z, x, red), e = filletEnd(T);
    assert.equal(report.generatedRoot.undercut, e.undercut, `m${m} z${z} x${x} undercut`);
    close(report.dimensions.rootDiameterMM / 2, T.r - (1.25 - x) * m, 1e-12, 'root circle');
    const rs = report.generatedRoot.formDiameterMM / 2;
    if (!e.undercut) close(rs, e.rForm, 1e-9 * m, `m${m} z${z} x${x}: form circle √(rb² + (r sin α − hF / sin α)²)`);
    else {
      const p = envelope(T, e.phiEnd); close(rs, Math.hypot(p[0], p[1]), 1e-9 * m, `m${m} z${z} x${x}: the undercut's crossing`);
      assert.equal(report.diagnostics[0].code, 'UNDERCUT');
      const at = R => maxPenetration(T, R * Math.cos(involuteAt(T, R)), R * Math.sin(involuteAt(T, R)));
      assert.ok(Math.abs(at(rs + 0.01 * m)) < 1e-9 * m, `m${m} z${z}: above the crossing, untouched (${at(rs + 0.01 * m)})`);
      assert.ok(at(rs - 0.002 * m) > 1e-6 * m, `m${m} z${z}: below it, cut (${at(rs - 0.002 * m)})`);
    }
  }
});

test('the volume is the exact generated profile\'s area × the face width (the area from this file\'s own envelope and involute), within the measured fits', () => {
  for (const [m, z, x, red] of CASES) {
    const b = 6, { brep, report } = spurGear({ moduleMM: m, teeth: z, faceWidthMM: b, profileShiftCoefficient: x, toothThicknessReductionMM: red, rootPolicy: 'generated' }), T = tool(m, z, x, red);
    const want = generatedArea(T) * b, got = brepMassProperties(brep, 1).volumeMM3;
    // (Each flank's and fillet's area moves by at most its deviation times its length.)
    const slack = 2 * z * (report.profileDeviationMM * 1.25 * m + report.generatedRoot.filletDeviationMM * 1.5 * m) * b + 1e-9 * want;
    close(got, want, slack, `m${m} z${z} x${x} volume`);
  }
});

test('pairs: the sweep runs on the generated outlines — j cos α/2 with backlash j; the usable contact ratio starts at the form circle, or lower at an undercut pinion\'s crossing', () => {
  const g1 = { moduleMM: 2, teeth: 20, faceWidthMM: 10, rootPolicy: 'generated', toothThicknessReductionMM: 0.05 }, g2 = { ...g1, teeth: 40 };
  const p = checkSpurGearPair(g1, g2);
  close(p.sweep.minimumClearanceMM, 0.1 * COS / 2, 1e-5, 'clearance'); assert.equal(p.sweep.converged, true); assert.equal(p.sweep.interference, false);
  // An undercut pinion (z 12) with z 40: the usable path from where each flank's involute starts, by formula here.
  const u1 = { moduleMM: 2, teeth: 12, faceWidthMM: 10, rootPolicy: 'generated', toothThicknessReductionMM: 0.05 }, u = checkSpurGearPair(u1, g2);
  const T1 = tool(2, 12, 0, 0.05), e1 = envelope(T1, filletEnd(T1).phiEnd), rs1 = Math.hypot(e1[0], e1[1]), T2 = tool(2, 40, 0, 0.05), rs2 = filletEnd(T2).rForm;
  const a = 52, rb1 = 12 * COS, rb2 = 40 * COS, L = a * SIN, start = Math.max(Math.sqrt(rs1 ** 2 - rb1 ** 2), L - Math.sqrt(42 ** 2 - rb2 ** 2)), end = Math.min(Math.sqrt(14 ** 2 - rb1 ** 2), L - Math.sqrt(rs2 ** 2 - rb2 ** 2));
  close(u.usableContactRatio, (end - start) / (Math.PI * 2 * COS), 1e-9, 'usable contact ratio');
  assert.equal(u.sweep.interference, false);
  // And with a rack (addendum m, sharp tip corners): the generated outline in the rack sweep. The rack's tip reaches
  // depth m, a hair past the form circle's 0.99997m, so its corner passes the fillet a little nearer than the flanks'
  // j cos α/2: the corner's own path against this file's outline, apart from the sweep.
  const r = checkSpurGearRack(g1, { moduleMM: 2, teeth: 12, faceWidthMM: 10, heightMM: 8, toothThicknessReductionMM: 0.05 });
  const T = tool(2, 20, 0, 0.05), e = filletEnd(T), line = [];
  for (let i = 0; i <= 4000; i++) line.push(envelope(T, e.phiRoot + (e.phiEnd - e.phiRoot) * i / 4000));
  const t0 = Math.sqrt((filletEnd(T).rForm / T.rb) ** 2 - 1), t1 = Math.sqrt((T.ra / T.rb) ** 2 - 1);
  for (let i = 0; i <= 4000; i++) { const t = t0 + (t1 - t0) * i / 4000, R = T.rb * Math.sqrt(1 + t * t); line.push([R * Math.cos(involuteAt(T, R)), R * Math.sin(involuteAt(T, R))]); }
  let corner = Infinity;
  for (let i = -3000; i <= 3000; i++) {
    const phi = 0.6 * i / 3000, c = Math.cos(phi), s = Math.sin(phi), wx = Math.PI / 2 - 0.025 - 2 * TAN - 20 * phi, wy = 18, px = c * wx + s * wy, py = -s * wx + c * wy;
    for (let k = 0; k + 1 < line.length; k++) corner = Math.min(corner, segDist(px, py, line[k][0], line[k][1], line[k + 1][0], line[k + 1][1]));
  }
  assert.ok(corner < 0.1 * COS / 2);
  close(r.sweep.minimumClearanceMM, corner, 1e-5, 'rack clearance (its tip corner by the fillet)');
});

test('refusals: a tip radius that leaves no flat, fewer than six teeth, a tip radius without a generated root; the part model\'s generator', () => {
  const code = (spec, c, re) => assert.throws(() => spurGear(spec), e => e instanceof GearError && e.code === c && (!re || re.test(e.message)), `${JSON.stringify(spec)} → ${c}`);
  const g = { moduleMM: 2, teeth: 20, faceWidthMM: 5, rootPolicy: 'generated' };
  // (The largest: where the two rounds meet, (πm/4 − 1.25m tan α)/(1/cos α − tan α) = 0.4719 m.)
  const rhoMax = (Math.PI / 2 - 2.5 * TAN) / (1 / COS - TAN);
  close(rhoMax / 2, 0.47191, 1e-5, 'ρ max / m');
  code({ ...g, toolTipRadiusMM: rhoMax + 1e-6 }, 'INVALID_INPUT', /below 0\.9438/);
  code({ ...g, toolTipRadiusMM: 0 }, 'INVALID_INPUT');
  assert.equal(spurGear({ ...g, toolTipRadiusMM: 0.9 }).report.generatedRoot.toolTipRadiusMM, 0.9);
  code({ ...g, teeth: 5, profileShiftCoefficient: 0.5 }, 'INVALID_INPUT', /at least 6/);
  code({ moduleMM: 2, teeth: 20, faceWidthMM: 5, toolTipRadiusMM: 0.5 }, 'INVALID_INPUT');
  // The schematic root still refuses an undercut gear; the generated one builds it.
  code({ moduleMM: 2, teeth: 12, faceWidthMM: 5 }, 'UNSUPPORTED_PROFILE_SHIFT');
  assert.equal(spurGearDimensions({ ...g, teeth: 12 }).root.undercut, true);
  // The part model: spur-gear@1 is the generated root; toolTipRadius only with it; an unknown generator is CAPABILITY.
  const feat = extra => D([{ id: 'g', kind: 'spur-gear', module: 2, teeth: 14, faceWidth: 5, ...extra }]);
  const out = evaluateCadPart(feat({ generator: 'spur-gear@1', toolTipRadius: 0.6 })).output('g');
  assert.equal(out.gear.rootPolicy, 'generated'); assert.equal(out.gear.generatedRoot.toolTipRadiusMM, 0.6); assert.equal(out.gear.generatedRoot.undercut, true);
  assert.ok(out.brep.faces.some(f => f.name === 'g.filletL#1'));
  assert.throws(() => evaluateCadPart(feat({ toolTipRadius: 0.6 })).output('g'), e => e.code === 'INPUT' && /toolTipRadius/.test(e.message));
  assert.throws(() => evaluateCadPart(feat({ generator: 'spur-gear@2' })).output('g'), e => e.code === 'CAPABILITY');
  assert.throws(() => evaluateCadPart(feat({})).output('g'), e => e.code === 'CAPABILITY' && /UNSUPPORTED_PROFILE_SHIFT/.test(e.message));
});

test('STEP out and back: the same volume, the fillets\' names', () => {
  const { brep } = spurGear({ moduleMM: 2, teeth: 16, faceWidthMM: 8, boreDiameterMM: 8, rootPolicy: 'generated' }, { id: 'g' });
  const back = importStep(exportStep([brep], { name: 'gear' }));
  close(brepMassProperties(back, 1).volumeMM3, brepMassProperties(brep, 1).volumeMM3, 1e-6 * brepMassProperties(brep, 1).volumeMM3, 'round trip');
  assert.ok(back.faces.some(f => f.name === 'g.filletL#1') && back.faces.some(f => f.name === 'g.filletR#16'));
});
