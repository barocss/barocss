import test from 'node:test';
import assert from 'node:assert/strict';
import { spurGear, spurRack, checkSpurGearPair, checkSpurGearRack, evaluateCadPart, isGearError, checkBrep, brepMassProperties, exportStep, importStep, evaluateCurve, curveDomain } from '../dist/index.js';

// R12b.1b (D131): the generated root on helical gears — in the transverse plane the normal rack's tip round, a cylinder
// along the tooth at β to the axis, is an ellipse (a = ρ / cos β along the pitch line, b = ρ across) — and the rack part's
// own root fillet (spur-rack@1). Oracles written here, apart from gear.ts and gear-rack.ts: the transverse tool's true
// signed distance (the point-to-ellipse distance by minimisation) maximised over its travel, the form circle, the area
// of the boundary built here, closed forms for the rack's fillet.
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (|Δ| ${Math.abs(a - b).toExponential(3)} > ${tol})`);
const AN = 20 * Math.PI / 180, TAN = Math.tan(AN), inv = p => Math.tan(p) - p;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const G = 0.618033988749895;

/** The transverse cutting tool of a helical gear (normal module mn, β, shift x, reduction Δs on the transverse circle). */
function tool(mn, z, betaDeg, x = 0, red = 0, rho = 0.38 * mn) {
  const beta = betaDeg * Math.PI / 180, cb = Math.cos(beta), mt = mn / cb, at = Math.atan(TAN / cb), r = mt * z / 2, yRef = r + x * mn, hA = 1.25 * mn;
  const a = rho / cb, b = rho, hc = hA - b, ta = Math.tan(at), reach = Math.sqrt(a * a * Math.cos(at) ** 2 + b * b * Math.sin(at) ** 2);
  const W = Math.PI * mt / 4 + red / 2, xc = W - hc * ta - reach / Math.cos(at), yc = yRef - hc, thT = -Math.atan(b / a * ta);
  return { mn, mt, z, x, red, at, ta, r, yRef, hA, a, b, W, xc, yc, thT, tx: xc + a * Math.cos(thT), ty: yc + b * Math.sin(thT), rb: r * Math.cos(at), rf: yRef - hA, ra: r + mn * (1 + x), psi: (mt * (Math.PI / 2 + 2 * x * TAN) - red) / (2 * r) + inv(at), pitch: Math.PI * mt };
}
const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
/** The distance from (u, y) to the tool's tip ellipse arc (θ from −π/2 to its flank tangent), by a scan and golden section. */
function arcDistance(T, u, y) {
  const f = th => Math.hypot(u - T.xc - T.a * Math.cos(th), y - T.yc - T.b * Math.sin(th)), n = 64;
  let best = Infinity, at = 0;
  for (let i = 0; i <= n; i++) { const th = -Math.PI / 2 + (T.thT + Math.PI / 2) * i / n, v = f(th); if (v < best) { best = v; at = th; } }
  let lo = Math.max(-Math.PI / 2, at - (T.thT + Math.PI / 2) / n), hi = Math.min(T.thT, at + (T.thT + Math.PI / 2) / n), x1 = hi - G * (hi - lo), x2 = lo + G * (hi - lo), f1 = f(x1), f2 = f(x2);
  for (let it = 0; it < 80; it++) { if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - G * (hi - lo); f1 = f(x1); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + G * (hi - lo); f2 = f(x2); } }
  return Math.min(best, f1, f2);
}
/** The tool's signed distance at a point of its frame: + inside, − outside (flat, ellipse arc, flank; by symmetry). */
function toolDistance(T, qx, qy) {
  let u = qx - T.pitch * Math.round(qx / T.pitch); u = Math.abs(u);
  const yt = T.yRef - T.hA, fy1 = T.yRef + (T.pitch / 2 - T.W) / T.ta;
  const d = Math.min(segDist(u, qy, 0, yt, T.xc, yt), arcDistance(T, u, qy), segDist(u, qy, T.tx, T.ty, T.pitch / 2, fy1));
  const low = u <= T.xc ? yt : u <= T.tx ? T.yc - T.b * Math.sqrt(Math.max(0, 1 - ((u - T.xc) / T.a) ** 2)) : T.yRef - (T.W - u) / T.ta;
  return qy >= low ? d : -d;
}
function maxPenetration(T, px, py) {
  const span = 2.2 * Math.PI / T.z + 0.6, n = 900, at = phi => { const c = Math.cos(phi), s = Math.sin(phi); return toolDistance(T, c * px - s * py + T.r * phi, s * px + c * py); };
  let best = -Infinity, arg = 0;
  for (let i = 0; i <= n; i++) { const phi = -span + 2 * span * i / n, v = at(phi); if (v > best) { best = v; arg = phi; } }
  let lo = arg - 2 * span / n, hi = arg + 2 * span / n, x1 = hi - G * (hi - lo), x2 = lo + G * (hi - lo), f1 = at(x1), f2 = at(x2);
  for (let it = 0; it < 100 && hi - lo > 1e-15; it++) { if (f1 > f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - G * (hi - lo); f1 = at(x1); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + G * (hi - lo); f2 = at(x2); } }
  return Math.max(best, f1, f2);
}
/** The B-rep's profile curves at z 0 (each side face's bottom edge), by face name. */
function profileCurves(brep) {
  const edges = new Map(brep.edges.map(e => [e.id, e])), coedges = new Map(brep.coedges.map(c => [c.id, c])), loops = new Map(brep.loops.map(l => [l.id, l])), out = [];
  for (const f of brep.faces) {
    if (!f.name || /face[01]$|bore/.test(f.name)) continue;
    for (const lid of f.loops) for (const cid of loops.get(lid).coedges) { const e = edges.get(coedges.get(cid).edge); if (e.curve.controlPoints.every(p => Math.abs(p[2]) < 1e-12)) out.push({ name: f.name, curve: e.curve }); }
  }
  return out;
}
function worstOn(brep, T, pattern, per = 16) {
  let worst = 0;
  const g = Math.PI / 2 - Math.PI / T.z, c = Math.cos(g), s = Math.sin(g);
  for (const { name, curve } of profileCurves(brep)) {
    if (!pattern.test(name) || !/#1$/.test(name)) continue;
    const [t0, t1] = curveDomain(curve);
    for (let i = 1; i < per; i++) { const q = evaluateCurve(curve, t0 + (t1 - t0) * i / per); worst = Math.max(worst, Math.abs(maxPenetration(T, c * q[0] - s * q[1], s * q[0] + c * q[1]))); }
  }
  return worst;
}
/** The ellipse's point θ touching the gear, the turn at which it does (its normal through the pitch point), in the gear's frame. */
function envelopeAt(T, th) {
  const phi = (T.xc + T.a * Math.cos(th) + T.b / T.a * (T.r - T.yc - T.b * Math.sin(th)) * Math.cos(th) / Math.sin(th)) / T.r;
  const wx = T.xc - T.r * phi + T.a * Math.cos(th), wy = T.yc + T.b * Math.sin(th), c = Math.cos(phi), s = Math.sin(phi);
  return [c * wx + s * wy, -s * wx + c * wy];
}
const involuteAt = (T, R) => Math.PI / 2 - Math.PI / T.z + T.psi - inv(Math.acos(Math.min(1, T.rb / R)));
/** Where the fillet ends, by this file's reasoning in θ: the flank's tangent point (not undercut), else the envelope's crossing of the involute. */
function filletEnd(T) {
  const hF = T.r - T.ty, lead = T.r * Math.sin(T.at) - hF / Math.sin(T.at);
  if (lead >= 0) return { thEnd: T.thT, undercut: false, rForm: Math.sqrt(T.rb ** 2 + lead ** 2) };
  const off = th => { const p = envelopeAt(T, th), R = Math.hypot(p[0], p[1]); return R < T.rb ? NaN : Math.atan2(p[1], p[0]) - involuteAt(T, R); };
  let prev = NaN, lo = 0, hi = 0;
  for (let i = 0; i <= 4000; i++) { const th = -Math.PI / 2 + (T.thT + Math.PI / 2) * i / 4000, v = off(th); if (Number.isFinite(prev) && prev < 0 && v >= 0) { lo = -Math.PI / 2 + (T.thT + Math.PI / 2) * (i - 1) / 4000; hi = th; break; } prev = v; }
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (off(mid) < 0) lo = mid; else hi = mid; }
  return { thEnd: (lo + hi) / 2, undercut: true };
}
/** The transverse profile's area: root arc, envelope (dense in θ), involute, tip arc, mirrored; the shoelace with the centre. */
function transverseArea(T) {
  const { thEnd } = filletEnd(T), n = 20000, toothAt = Math.PI / 2 - Math.PI / T.z, right = [], phiRoot = T.xc / T.r;
  const mirror = ([x, y]) => { const a = 2 * toothAt - Math.atan2(y, x), R = Math.hypot(x, y); return [R * Math.cos(a), R * Math.sin(a)]; };
  for (let i = 0; i <= n; i++) { const a = Math.PI / 2 - phiRoot * i / n; right.push([T.rf * Math.cos(a), T.rf * Math.sin(a)]); }
  for (let i = 1; i <= n; i++) right.push(envelopeAt(T, -Math.PI / 2 + (thEnd + Math.PI / 2) * i / n));
  const e = right.at(-1), rs = Math.hypot(e[0], e[1]), t0 = Math.sqrt((rs / T.rb) ** 2 - 1), t1 = Math.sqrt((T.ra / T.rb) ** 2 - 1);
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, R = T.rb * Math.sqrt(1 + t * t); right.push([R * Math.cos(involuteAt(T, R)), R * Math.sin(involuteAt(T, R))]); }
  const aTip = involuteAt(T, T.ra);
  for (let i = 1; i <= n; i++) { const a = aTip + (toothAt - aTip) * i / n; right.push([T.ra * Math.cos(a), T.ra * Math.sin(a)]); }
  const pts = [...right, ...right.slice().reverse().map(mirror), [0, 0]];
  let A = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(A) / 2 * T.z;
}
const H = (mn, z, beta, hand, extra = {}) => ({ normalModuleMM: mn, helixAngleDeg: beta, hand, teeth: z, faceWidthMM: 10, rootPolicy: 'generated', ...extra });
const CASES = [[2, 20, 20, 0, 0], [3, 12, 30, 0, 0], [2, 25, 45, 0, 0], [2, 40, 15, 0.3, 0.05], [2, 9, 15, 0, 0]];

test('helical gears take the generated root (refused at the previous HEAD): valid, spur-gear@1; the B-rep\'s own transverse curves lie on the boundary the elliptical tool cuts, within the measured fits; fillet faces turned along the helix', t => {
  for (const [mn, z, beta, x, red] of CASES) {
    const { brep, report } = spurGear(H(mn, z, beta, 'right', { profileShiftCoefficient: x, toothThicknessReductionMM: red }), { id: 'g' }), T = tool(mn, z, beta, x, red);
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues?.[0]);
    assert.equal(report.generator, 'spur-gear@1'); assert.ok(report.helix && report.generatedRoot);
    const t0 = performance.now(), fillet = worstOn(brep, T, /fillet[LR]\d?#/), flank = worstOn(brep, T, /flank[LR]#/), root = worstOn(brep, T, /\.root#/, 4);
    assert.ok(fillet <= report.generatedRoot.filletDeviationMM * 1.001 + 1e-9, `mn${mn} z${z} β${beta}: fillets ${fillet} vs fit ${report.generatedRoot.filletDeviationMM}`);
    assert.ok(flank <= report.profileDeviationMM * 1.001 + 1e-9, `mn${mn} z${z} β${beta}: flanks ${flank}`);
    assert.ok(root <= 1e-9 * mn, `mn${mn} z${z} β${beta}: root ${root}`);
    assert.ok(brep.faces.some(f => f.name === 'g.filletL#1') && brep.faces.some(f => f.name === `g.filletR#${z}`));
    t.diagnostic(`mn${mn} z${z} β${beta}° x${x}: |penetration| fillets ${fillet.toExponential(2)} (fit ${report.generatedRoot.filletDeviationMM.toExponential(2)}, ${report.generatedRoot.filletPieces} pieces), flanks ${flank.toExponential(2)}, root ${root.toExponential(2)}${report.generatedRoot.undercut ? ', undercut' : ''} (${(performance.now() - t0).toFixed(0)} ms)`);
  }
});

test('the transverse form circle by the textbook formula with the ellipse\'s tangent point; the undercut z 9 at β 15° trimmed where the envelope crosses; the volume the transverse area × b within the flank, fillet and twist fits', () => {
  for (const [mn, z, beta, x, red] of CASES) {
    const b = 10, { brep, report } = spurGear(H(mn, z, beta, 'right', { profileShiftCoefficient: x, toothThicknessReductionMM: red }), { id: 'g' }), T = tool(mn, z, beta, x, red), e = filletEnd(T);
    assert.equal(report.generatedRoot.undercut, e.undercut);
    const rs = report.generatedRoot.formDiameterMM / 2;
    if (!e.undercut) close(rs, e.rForm, 1e-9 * mn, `mn${mn} z${z} β${beta}: form circle`);
    else { const p = envelopeAt(T, e.thEnd); close(rs, Math.hypot(p[0], p[1]), 1e-8 * mn, `mn${mn} z${z} β${beta}: the crossing`); assert.equal(report.diagnostics[0].code, 'UNDERCUT'); }
    const A = transverseArea(T), tw = report.helix.twistDeviationMM / T.ra, want = A * b, got = brepMassProperties(brep, 1).volumeMM3;
    const slack = 2 * z * (report.profileDeviationMM * 1.25 * mn + report.generatedRoot.filletDeviationMM * 1.5 * mn) * b + (2 * tw + tw * tw) * want + 1e-9 * want;
    close(got, want, slack, `mn${mn} z${z} β${beta} volume`);
  }
});

test('helical pairs on generated roots: the transverse sweep clears by j cos α_t / 2; with a filleted helical rack of the opposite hand, clear', () => {
  const at = Math.atan(TAN / Math.cos(20 * Math.PI / 180));
  const p = checkSpurGearPair(H(2, 18, 20, 'right', { toothThicknessReductionMM: 0.05 }), H(2, 30, 20, 'left', { toothThicknessReductionMM: 0.05 }));
  close(p.sweep.minimumClearanceMM, 0.1 * Math.cos(at) / 2, 1e-5, 'clearance'); assert.equal(p.sweep.converged, true); assert.equal(p.sweep.interference, false);
  const r = checkSpurGearRack(H(2, 18, 20, 'right', { toothThicknessReductionMM: 0.05 }), { normalModuleMM: 2, helixAngleDeg: 20, hand: 'left', teeth: 12, faceWidthMM: 10, heightMM: 8, toothThicknessReductionMM: 0.05, rootPolicy: 'filleted' });
  assert.equal(r.sweep.interference, false); assert.ok(r.sweep.minimumClearanceMM > 0.04 && r.sweep.minimumClearanceMM <= 0.1 * Math.cos(at) / 2 + 1e-5, String(r.sweep.minimumClearanceMM));
});

/** A rack's area by closed forms: the bar below the root line, the n trapezoidal teeth, and 2n fillets (in the frame scaled along the rack by cos β, a circle in a corner of 90° + α_n: ρ²(cot(45° + α_n/2) − (π/2 − α_n)/2), scaled back). */
function rackArea({ m, n, H, betaDeg = 0, red = 0, rho }) {
  const cb = Math.cos(betaDeg * Math.PI / 180), p = Math.PI * m / cb, t = TAN / cb, ha = m, hf = 1.25 * m, s = p / 2 - red;
  const bar = n * p * (H - hf), tooth = (ha + hf) * ((s + 2 * hf * t) + (s - 2 * ha * t)) / 2;
  const corner = rho * rho * (1 / Math.tan(Math.PI / 4 + AN / 2) - (Math.PI / 2 - AN) / 2) / cb;
  return bar + n * tooth + 2 * n * corner;
}

test('the rack\'s root fillet (spur-rack@1): straight and helical, valid; its volume the closed form to 1e-9; its arcs exactly on their ellipses, tangent to the root and the flank; the flank ending ρ(1 − sin α_n) above the root', () => {
  for (const [m, n, Hh, betaDeg, hand, red, rho] of [[2, 10, 8, 0, undefined, 0, undefined], [2, 10, 8, 20, 'left', 0.05, undefined], [3, 7, 12, 0, undefined, 0, 0.9], [1.5, 12, 6, 35, 'right', 0, 0.5]]) {
    const spec = { ...(betaDeg ? { normalModuleMM: m, helixAngleDeg: betaDeg, hand } : { moduleMM: m }), teeth: n, faceWidthMM: 7, heightMM: Hh, toothThicknessReductionMM: red, rootPolicy: 'filleted', ...(rho ? { rootFilletRadiusMM: rho } : {}) };
    const { brep, report } = spurRack(spec, { id: 'k' }), R = rho ?? 0.38 * m;
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues?.[0]); assert.equal(report.generator, 'spur-rack@1'); assert.deepEqual(report.diagnostics, []);
    close(report.rootFillet.flankEndDepthMM, 1.25 * m - R * (1 - Math.sin(AN)), 1e-12, 'the flank\'s end');
    const want = rackArea({ m, n, H: Hh, betaDeg, red, rho: R }) * 7;
    close(brepMassProperties(brep, 1).volumeMM3, want, 1e-9 * want, `rack m${m} n${n} β${betaDeg} volume`);
    // The arcs at z 0: on the ellipse (x − cx)²/a² + (y − cy)²/b² = 1, a = ρ / cos β; their ends' tangents along the root line and the flank.
    const cb = Math.cos(betaDeg * Math.PI / 180), a = R / cb, t = Math.tan(Math.atan(TAN / cb));
    for (const { name, curve } of profileCurves(brep).filter(c => /fillet[LR]#/.test(c.name))) {
      const [t0, t1] = curveDomain(curve), p0 = evaluateCurve(curve, t0), p1 = evaluateCurve(curve, t1), bottom = Math.abs(p0[1] + 1.25 * m) < 1e-12 ? p0 : p1, top = bottom === p0 ? p1 : p0;
      assert.ok(Math.abs(bottom[1] + 1.25 * m) < 1e-12, `${name} meets the root line`);
      const cx = bottom[0], cy = -1.25 * m + R;
      for (let i = 0; i <= 8; i++) { const q = evaluateCurve(curve, t0 + (t1 - t0) * i / 8); close(((q[0] - cx) / a) ** 2 + ((q[1] - cy) / R) ** 2, 1, 1e-12, `${name} on its ellipse`); }
      // At the top end the ellipse's tangent runs along the flank (dx/dy = ∓ tan α_t).
      const nx = (top[0] - cx) / (a * a), ny = (top[1] - cy) / (R * R), slope = -ny / nx;
      close(Math.abs(slope), t, 1e-9, `${name} tangent to the flank`);
    }
  }
});

test('a filleted rack with a generated gear: the usable contact ratio stops where the rack\'s flank ends (the formula), the least clearance its tip corner\'s by the gear\'s fillet, as with a sharp root; refusals; the part model\'s spur-rack@1; STEP', () => {
  const gear = { moduleMM: 2, teeth: 20, faceWidthMM: 10, rootPolicy: 'generated', toothThicknessReductionMM: 0.05 }, rack = { moduleMM: 2, teeth: 12, faceWidthMM: 10, heightMM: 8, toothThicknessReductionMM: 0.05 };
  const f = checkSpurGearRack(gear, { ...rack, rootPolicy: 'filleted' }), sharp = checkSpurGearRack(gear, rack);
  // Along the line of action: the gear's tip side √(ra² − rb²) − r sin α, cut at the rack's flank end (its depth / sin α);
  // the rack's tip side as before. At z 20 the tip meets the line of action 1.572 mm down, short of the fillet (no
  // change); at z 200 with ρ 0.9 (the flank ending 1.908 mm down) the tip reaches 1.929 mm, past it.
  for (const [z, rho] of [[20, 0.76], [200, 0.9]]) {
    const gz = { ...gear, teeth: z }, fz = checkSpurGearRack(gz, { ...rack, rootPolicy: 'filleted', rootFilletRadiusMM: rho }), sz = checkSpurGearRack(gz, rack);
    const r = z, rb = r * Math.cos(AN), A = Math.sqrt((r + 2) ** 2 - rb ** 2) - r * Math.sin(AN), end = (2.5 - rho * (1 - Math.sin(AN))) / Math.sin(AN);
    close(fz.usableContactRatio - sz.usableContactRatio, (Math.min(A, end) - A) / (Math.PI * 2 * Math.cos(AN)), 1e-12, `z${z} usable contact ratio`);
    assert.equal(end < A, z === 200); close(fz.idealContactRatio, sz.idealContactRatio, 0, 'ideal');
  }
  close(f.sweep.minimumClearanceMM, sharp.sweep.minimumClearanceMM, 1e-9, 'least clearance'); assert.equal(f.sweep.interference, false);
  const code = (spec, c, re) => assert.throws(() => spurRack(spec), e => isGearError(e) && e.code === c && (!re || re.test(e.message)), JSON.stringify(spec));
  // (Two fillets fill the root at ρ = (p − s − 2 hf tan α) / (2 (1 / cos α − tan α)) = 0.4719 m, as the tool's rounds meet.)
  const max = (Math.PI - 5 * TAN) / (2 * (1 / Math.cos(AN) - TAN));
  close(max, 0.943821, 1e-6, 'the largest fillet');
  code({ ...rack, toothThicknessReductionMM: 0, rootPolicy: 'filleted', rootFilletRadiusMM: max + 1e-6 }, 'INVALID_INPUT', /below 0\.943821/);
  code({ ...rack, rootFilletRadiusMM: 0.5 }, 'INVALID_INPUT', /filleted/);
  const out = evaluateCadPart(D([{ id: 'k', kind: 'spur-rack', module: 2, teeth: 6, faceWidth: 5, height: 8, generator: 'spur-rack@1', rootFillet: 0.6 }])).output('k');
  assert.equal(out.rack.rootFillet.radiusMM, 0.6); assert.ok(out.brep.faces.some(x => x.name === 'k.filletR#1'));
  assert.throws(() => evaluateCadPart(D([{ id: 'k', kind: 'spur-rack', module: 2, teeth: 6, faceWidth: 5, height: 8, rootFillet: 0.6 }])).output('k'), e => e.code === 'INPUT');
  assert.throws(() => evaluateCadPart(D([{ id: 'k', kind: 'spur-rack', module: 2, teeth: 6, faceWidth: 5, height: 8, generator: 'spur-rack@2' }])).output('k'), e => e.code === 'CAPABILITY');
  // A helical generated gear in the part model, and STEP out and back for it and a filleted helical rack.
  const g = evaluateCadPart(D([{ id: 'g', kind: 'spur-gear', normalModule: 2, helixAngle: 20, hand: 'right', teeth: 18, faceWidth: 8, generator: 'spur-gear@1' }])).output('g');
  assert.equal(g.gear.rootPolicy, 'generated'); assert.ok(g.brep.faces.some(x => x.name === 'g.filletL#1'));
  for (const brep of [g.brep, spurRack({ normalModuleMM: 2, helixAngleDeg: 20, hand: 'left', teeth: 6, faceWidthMM: 8, heightMM: 8, rootPolicy: 'filleted' }, { id: 'k' }).brep]) {
    const back = importStep(exportStep([brep], { name: 'x' }));
    close(brepMassProperties(back, 1).volumeMM3, brepMassProperties(brep, 1).volumeMM3, 1e-6 * brepMassProperties(brep, 1).volumeMM3, 'round trip');
    assert.ok(back.faces.some(x => /fillet/.test(x.name)));
  }
});
