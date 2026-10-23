import test from 'node:test';
import assert from 'node:assert/strict';
import { shaftSolid, ShaftError, checkBrep, brepMassProperties, evaluateCadPart, exportStep, importStep } from '../dist/index.js';
import { brepBounds } from '../dist/brep/brep-bounds.js';

// R12c.3a (D156): shafts. Oracles written here, none of them the kernel's:
// - Pappus: V = π∫ r(z)² dz over the half-section, r(z) the test's own (steps, chamfers, grooves, undercuts; a fillet
//   r_s + ρ − √(ρ² − (z − z_c)²)), each piece by 24-point Gauss–Legendre;
// - a square keyseat removes A(R − t1)·l, A(h) = ∫_{|x| ≤ b/2} (√(R² − x²) − h)₊ dx in closed form (D139 S0);
// - end-milled: (l − b)·A plus the two half-disc ends, ∫∫_{disc b/2} (√(R² − x²) − (R − t1)) by quadrature (S0);
// - disc-cutter run-out: l·A(R − t1) + 2∫_0^e A(r_c − √(R_c² − u²)) du, e = √(R_c² − (R_c − t1)²) (quadrature);
// - a cross hole of radius ρ through a cylinder R: ∫_{−ρ}^{ρ} 4√(ρ² − x²)√(R² − x²) dx (x = ρ sin θ, quadrature).

const vol = brep => brepMassProperties(brep, 1, { quadratureSegments: 12 }).volumeMM3;
const near = (got, want, abs, what) => assert.ok(Math.abs(got - want) <= abs, `${what}: ${got} vs ${want} (off ${Math.abs(got - want)})`);
const code = c => e => e instanceof ShaftError && e.code === c;
const GL = (() => { const n = 24, x = [], w = []; for (let i = 0; i < n; i++) { let t = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), dp = 0; for (let it = 0; it < 100; it++) { let p0 = 1, p1 = t; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } dp = n * (t * p1 - p0) / (t * t - 1); const s = p1 / dp; t -= s; if (Math.abs(s) < 1e-16) break; } x.push(t); w.push(2 / ((1 - t * t) * dp * dp)); } return { x, w }; })();
/** ∫_a^b f by Gauss–Legendre on `m` equal pieces. */
const quad = (f, a, b, m = 8) => { let s = 0; for (let j = 0; j < m; j++) { const lo = a + (b - a) * j / m, hi = a + (b - a) * (j + 1) / m; for (let i = 0; i < GL.x.length; i++) s += GL.w[i] * (hi - lo) / 2 * f(lo + (hi - lo) * (GL.x[i] + 1) / 2); } return s; };
/** π∫ r² over pieces [z0, z1, r(z)]. */
const pappus = pieces => pieces.reduce((s, [a, b, r]) => s + Math.PI * quad(z => r(z) ** 2, a, b), 0);
const k = c => () => c;
/** A(h): the cross-section of a cylinder R above the line at h, within |x| ≤ b/2. */
function A(R, b, h) { const w = Math.sqrt(Math.max(0, R * R - h * h)), m = Math.min(b / 2, w), F = x => (x * Math.sqrt(R * R - x * x) + R * R * Math.asin(x / R)) / 2; return F(m) - F(-m) - 2 * m * h; }

test('R12c.3a shaft: steps, end chamfers, shoulder fillets both ways — V by Pappus on the test\'s own profile; valid, genus 0; the faces named', t => {
  const spec = { steps: [{ diameterMM: 25, lengthMM: 30, filletMM: 1 }, { diameterMM: 20, lengthMM: 40, filletMM: 1.5 }, { diameterMM: 30, lengthMM: 10 }], chamfersMM: [1, 0.5] };
  const t0 = performance.now(), { brep, report } = shaftSolid(spec, { id: 'sh' }), ms = performance.now() - t0;
  const chk = checkBrep(brep); assert.equal(chk.valid, true, chk.issues[0]); assert.equal(chk.topology[0].genus, 0);
  // Step 1 (R 12.5) 0–30, its chamfer 1 at z 0; shoulder down at 30, the fillet ρ 1 in step 2 (centre (11, 31));
  // step 2 (R 10) 30–70, a fillet ρ 1.5 before the shoulder up at 70 (centre (11.5, 68.5)); step 3 (R 15) 70–80, chamfer 0.5 at 80.
  const V = pappus([[0, 1, z => 11.5 + z], [1, 30, k(12.5)], [30, 31, z => 11 - Math.sqrt(1 - (z - 31) ** 2)], [31, 68.5, k(10)], [68.5, 70, z => 11.5 - Math.sqrt(2.25 - (z - 68.5) ** 2)], [70, 79.5, k(15)], [79.5, 80, z => 15 - (z - 79.5)]]);
  near(vol(brep), V, 1e-6 * V, 'Pappus');
  assert.deepEqual(report.steps.map(s => [s.fromMM, s.toMM]), [[0, 30], [30, 70], [70, 80]]); assert.equal(report.lengthMM, 80);
  assert.deepEqual([...new Set(brep.faces.map(f => f.name.replace(/#\d+$/, '')))].sort(), ['sh.chamfer0', 'sh.chamfer1', 'sh.end0', 'sh.end1', 'sh.fillet1', 'sh.fillet2', 'sh.seat1', 'sh.seat2', 'sh.seat3', 'sh.shoulder1', 'sh.shoulder2']);
  const b = brepBounds(brep); near(b.max[2], 80, 1e-9, 'length'); near(b.max[0], 15, 1e-9, 'radius');
  const back = importStep(exportStep([brep], { name: 'shaft' })); assert.equal(checkBrep(back).valid, true); near(vol(back), vol(brep), 1e-9 * V, 'STEP');
  t.diagnostic(`fillets and chamfers: ${brep.faces.length} faces, ${ms.toFixed(0)} ms; V ${vol(brep).toFixed(6)} vs Pappus ${V.toFixed(6)}`);
});

test('R12c.3a shaft: an undercut against its shoulder and a ring groove (DIN 471-size at Ø20: Ø19, 1.30 wide; D139 R1) — V by Pappus; the groove\'s faces', () => {
  const spec = { steps: [{ diameterMM: 25, lengthMM: 30, undercut: { widthMM: 2, depthMM: 0.3 } }, { diameterMM: 20, lengthMM: 40, grooves: [{ diameterMM: 19, widthMM: 1.3, atMM: 15 }] }, { diameterMM: 30, lengthMM: 5 }] };
  // (The undercut is in the smaller step after shoulder 1: step 2, z 30–32, at R 9.7.) Step 2 is smaller than step 3 too.
  const { brep, report } = shaftSolid(spec, { id: 'g' });
  assert.equal(checkBrep(brep).valid, true);
  const V = pappus([[0, 30, k(12.5)], [30, 32, k(9.7)], [32, 45, k(10)], [45, 46.3, k(9.5)], [46.3, 70, k(10)], [70, 75, k(15)]]);
  near(vol(brep), V, 1e-6 * V, 'Pappus');
  assert.deepEqual(report.grooves, [{ index: 1, step: 2, diameterMM: 19, widthMM: 1.3, fromMM: 45 }]);
  const names = new Set(brep.faces.map(f => f.name.replace(/#\d+$/, '')));
  for (const n of ['g.undercut1', 'g.undercutwall1', 'g.groove1', 'g.groovewall1.1', 'g.groovewall1.2', 'g.seat2', 'g.seat2.2']) assert.ok(names.has(n), n);
});

test('R12c.3a keyseats: square A·l, end-milled (l − b)A plus its disc ends, a disc cutter\'s run-out by quadrature — on Ø20 with a 6 × 3.5 seat (D139 K1\'s sizes, test values)', t => {
  const R = 10, b = 6, t1 = 3.5, l = 18, base = { diameterMM: 20, lengthMM: 40 };
  const plain = Math.PI * R * R * 40, Af = A(R, b, R - t1);
  near(Af, 20.087441, 1e-6, 'S0\'s segment');
  // (The end-mill's two half discs make one disc of radius b/2: ∫∫ (√(R² − x²) − h) over it, x = (b/2) sin u.)
  const disc = quad(u => (b / 2) * Math.cos(u) * 2 * (b / 2) * Math.cos(u) * (Math.sqrt(R * R - (b / 2 * Math.sin(u)) ** 2) - (R - t1)), -Math.PI / 2, Math.PI / 2, 16);
  near(disc, 95.742473, 1e-6, 'S0\'s end-mill ends');
  const Rc = 8, rc = R - t1 + Rc, e = Math.sqrt(Rc * Rc - (Rc - t1) ** 2), run = quad(u => A(R, b, rc - Math.sqrt(Rc * Rc - u * u)), 0, e, 16);
  const cases = [['square', {}, Af * l], ['end-mill', {}, (l - b) * Af + disc], ['disc', { cutterRadiusMM: Rc }, l * Af + 2 * run]];
  for (const [ends_, extra, removed] of cases) {
    const off = ends_ === 'disc' ? 12 : 10, { brep, report } = shaftSolid({ steps: [{ ...base, keyseats: [{ widthMM: b, depthMM: t1, lengthMM: l, offsetMM: off, ends: ends_, ...extra }] }] }, { id: 'k' });
    assert.equal(checkBrep(brep).valid, true, ends_);
    near(plain - vol(brep), removed, 1e-6 * removed + 1e-9, `${ends_} keyseat`);
    assert.equal(report.keyseats[0].floorRadiusMM, R - t1);
    if (ends_ === 'disc') near(report.keyseats[0].surfaceLengthMM, l + 2 * e, 1e-12, 'run-out length');
    t.diagnostic(`${ends_}: removed ${(plain - vol(brep)).toFixed(6)} vs ${removed.toFixed(6)} mm³`);
  }
  // Turned 180° about the axis: the same volume, the seat on −X.
  const turned = shaftSolid({ steps: [{ ...base, keyseats: [{ widthMM: b, depthMM: t1, lengthMM: l, offsetMM: 10, ends: 'square', angleDeg: 180 }] }] }).brep;
  near(plain - vol(turned), Af * l, 1e-6 * Af * l, 'turned'); near(brepBounds(turned).max[0], R, 1e-9, '+X side whole');
});

test('R12c.3a cross hole: Ø4 through Ø25 — ∫4√(ρ² − x²)√(R² − x²) dx by quadrature; along Y by default', () => {
  const R = 12.5, rho = 2, { brep, report } = shaftSolid({ steps: [{ diameterMM: 25, lengthMM: 30 }], holes: [{ diameterMM: 4, atMM: 15 }] }, { id: 'p' });
  assert.equal(checkBrep(brep).valid, true); assert.equal(checkBrep(brep).topology[0].genus, 1);
  const removed = quad(th => 4 * rho * rho * Math.cos(th) ** 2 * Math.sqrt(R * R - (rho * Math.sin(th)) ** 2), -Math.PI / 2, Math.PI / 2, 16);
  near(Math.PI * R * R * 30 - vol(brep), removed, 1e-6 * removed, 'cross hole');
  assert.deepEqual(report.holes, [{ index: 1, diameterMM: 4, atMM: 15, angleDeg: 90 }]);
  assert.ok(brep.faces.some(f => f.name.startsWith('p.hole1')));
});

test('R12c.3a refusals: SHAFT_STEPS, KEYSEAT_DIMENSIONS, GROOVE_DIMENSIONS, HOLE_DIMENSIONS', () => {
  const two = [{ diameterMM: 25, lengthMM: 30 }, { diameterMM: 20, lengthMM: 20 }];
  for (const s of [{ steps: [] }, { steps: [{ diameterMM: 0, lengthMM: 5 }] }, { steps: [{ diameterMM: 20, lengthMM: 5 }, { diameterMM: 20, lengthMM: 5 }] }, { steps: [{ ...two[0], filletMM: 3 }, two[1]] },
    { steps: [{ ...two[0], filletMM: 1, undercut: { widthMM: 1, depthMM: 0.2 } }, two[1]] }, { steps: two, chamfersMM: [13, 0] }, { steps: [two[0], { ...two[1], filletMM: 1 }] }])
    assert.throws(() => shaftSolid(s), code('SHAFT_STEPS'), JSON.stringify(s));
  const ks = x => ({ steps: [{ diameterMM: 20, lengthMM: 40, keyseats: [{ widthMM: 6, depthMM: 3.5, lengthMM: 18, offsetMM: 5, ...x }] }] });
  for (const x of [{ depthMM: 10 }, { widthMM: 16 }, { offsetMM: 30 }, { ends: 'disc', cutterRadiusMM: 3 }, { ends: 'disc', cutterRadiusMM: 8, offsetMM: 1 }, { ends: 'end-mill', lengthMM: 5 }, { ends: 'woodruff' }])
    assert.throws(() => shaftSolid(ks(x)), code('KEYSEAT_DIMENSIONS'), JSON.stringify(x));
  const gr = x => ({ steps: [{ diameterMM: 20, lengthMM: 40, grooves: [{ diameterMM: 19, widthMM: 1.3, atMM: 15, ...x }] }] });
  for (const x of [{ diameterMM: 20 }, { atMM: 39.5 }, { widthMM: 0 }]) assert.throws(() => shaftSolid(gr(x)), code('GROOVE_DIMENSIONS'), JSON.stringify(x));
  assert.throws(() => shaftSolid({ steps: [{ diameterMM: 20, lengthMM: 40, grooves: [{ diameterMM: 19, widthMM: 2, atMM: 10 }, { diameterMM: 19, widthMM: 2, atMM: 11 }] }] }), code('GROOVE_DIMENSIONS'));
  for (const h of [{ diameterMM: 4, atMM: 29 }, { diameterMM: 25, atMM: 15 }, { diameterMM: 4, atMM: 49 }]) assert.throws(() => shaftSolid({ steps: two, holes: [h] }), code('HOLE_DIMENSIONS'), JSON.stringify(h));
});

test('R12c.3a part model: the `shaft` kind placed on its axis, a parameter for a diameter; its report; the codes mapped', () => {
  const D = (f, p = {}) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: p, features: f });
  const out = evaluateCadPart(D([{ id: 's', kind: 'shaft', steps: [{ diameter: { parameter: 'd' }, length: 30, keyseats: [{ width: 6, depth: 3.5, length: 18, offset: 5, ends: 'square' }] }, { diameter: 25, length: 20 }], chamfers: [0.5, 0.5], center: [40, 10], from: 5, rotation: 90 }], { d: 20 })).output('s');
  assert.equal(out.shaft.generator, 'shaft@0'); assert.equal(out.shaft.keyseats[0].widthMM, 6);
  const b = brepBounds(out.brep); near(b.min[2], 5, 1e-9, 'from'); near(b.max[2], 55, 1e-9, 'to'); near((b.min[0] + b.max[0]) / 2, 40, 1e-9, 'x');
  // (Turned 90°: the seat on +Y, so the +Y side is the cut one.)
  assert.ok(b.max[1] - 10 > 12.4 && 10 - b.min[1] > 12.4);
  const refused = (f, c, tag) => assert.throws(() => evaluateCadPart(D([{ id: 's', kind: 'shaft', steps: [{ diameter: 20, length: 30 }], ...f }])), e => e.code === c && e.message.includes(`[${tag}]`), tag);
  refused({ steps: [{ diameter: 20, length: 30, keyseats: [{ width: 6, depth: 12, length: 10, offset: 2 }] }] }, 'GEOMETRY', 'KEYSEAT_DIMENSIONS');
  refused({ steps: [{ diameter: 20, length: 30, grooves: [{ diameter: 21, width: 1, at: 5 }] }] }, 'GEOMETRY', 'GROOVE_DIMENSIONS');
  refused({ steps: [] }, 'INPUT', 'SHAFT_STEPS');
});
