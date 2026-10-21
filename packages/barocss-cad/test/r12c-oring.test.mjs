import test from 'node:test';
import assert from 'node:assert/strict';
import { glandCheck, glandCut, oringInGland, oringRowProblem, O2_RANGES, GlandError, checkBrep, brepMassProperties, evaluateCadPart } from '../dist/index.js';

// R12c.5 (D159): O-ring glands. The ring row is D139's O1 (AS568-214: CS 3.53, ID 24.99 — the Global O-Ring chart), a
// test row citing it; the gland is S0's (groove Ø25.5, bore Ø31.1, 4.7 wide); the other rings and the fit rows are test
// values flagged estimates. Oracles written here:
// - the stretched section by the torus's volume r'²(R_b + r') = r²(ID/2 + r), solved by bisection; S0's figures: stretch
//   2.04 %, the section 3.5006, squeeze 20.7 % nominal and 20.0 % stretched, fill 74.4 %;
// - the free ring's overlap with the sealing surface by Pappus on a circular segment (S0: 136.48580 mm³ for the piston):
//   A = r'² acos(c/r') − c√(r'² − c²), ȳ = (2/3)(r'² − c²)^{3/2}/A, V = 2π(R' ± ȳ)A (a rod's on the inner side), a face's
//   2πR'A (its chord square to the axis);
// - the groove's removal π(R² − r²)w (radial), π((R + w)² − R²)h (face).

const vol = brep => brepMassProperties(brep, 1, { quadratureSegments: 12 }).volumeMM3;
const near = (got, want, abs, what) => assert.ok(Math.abs(got - want) <= abs, `${what}: ${got} vs ${want}`);
const code = c => e => e instanceof GlandError && e.code === c;
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const O1 = { id: '214', dash: '2-214', insideDiameterMM: 24.99, crossSectionMM: 3.53, source: 'O1 (D139): the Global O-Ring AS568 chart' };
/** r' with r'²(Rb + r') = r²R, by bisection on [r/4, 4r] (a different solver from the kernel's iteration). */
function stretchedR(r, R, Rb) { let lo = r / 4, hi = 4 * r; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (m * m * (Rb + m) < r * r * R) lo = m; else hi = m; } return (lo + hi) / 2; }
/** The circular segment of radius ρ beyond a chord at c from its centre: area and its centroid's distance from the centre. */
function segment(rho, c) { const A = rho * rho * Math.acos(c / rho) - c * Math.sqrt(rho * rho - c * c); return { A, y: 2 / 3 * (rho * rho - c * c) ** 1.5 / A }; }
const cyl = (id, r, h, z0 = 0, bore) => [{ id: `${id}s`, kind: 'sketch', profile: 'circle', center: [0, 0], radius: r, plane: { origin: [0, 0, z0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id, kind: 'extrude', sketch: `${id}s`, height: h },
  ...(bore ? [{ id: `${id}bs`, kind: 'sketch', profile: 'circle', center: [0, 0], radius: bore, plane: { origin: [0, 0, z0 - 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: `${id}b`, kind: 'extrude', sketch: `${id}bs`, height: h + 2 }, { id: `${id}h`, kind: 'difference', target: id, tool: `${id}b` }] : [])];

test('R12c.5 piston gland arithmetic: AS568-214 on S0\'s gland — stretch, the stretched section, squeeze nominal and stretched, fill; against O2\'s ranges, flagged estimates', () => {
  const g = glandCheck({ kind: 'piston', ring: O1, grooveDiameterMM: 25.5, widthMM: 4.7, sealDiameterMM: 31.1 });
  const r = 1.765, R = 24.99 / 2 + r, rs = stretchedR(r, R, 12.75), h = 2.8;
  near(g.depthMM, h, 1e-12, 'depth'); near(g.stretchPercent, 100 * (25.5 - 24.99) / 24.99, 1e-12, 'stretch'); near(g.stretchedCrossSectionMM, 2 * rs, 1e-12, 'the stretched section');
  near(g.stretchedCrossSectionMM, 3.5006, 1e-4, 'S0\'s 3.5006'); near(g.squeezePercent, 100 * (3.53 - h) / 3.53, 1e-12, 'squeeze'); near(g.squeezeStretchedPercent, 100 * (2 * rs - h) / (2 * rs), 1e-10, 'squeeze stretched');
  near(g.fillPercent, 100 * Math.PI * 3.53 ** 2 / 4 / (4.7 * h), 1e-10, 'fill'); near(g.fillPercent, 74.4, 0.05, 'S0\'s 74.4 %');
  assert.deepEqual([+g.stretchPercent.toFixed(2), +g.squeezePercent.toFixed(1), +g.squeezeStretchedPercent.toFixed(1)], [2.04, 20.7, 20]);
  assert.deepEqual(g.ranges, O2_RANGES.radial); assert.equal(g.ranges.estimate, true);
  // The stretched fill 73.1 % is under O2's 75 %: a warning, said to be an estimate.
  assert.deepEqual(g.warnings.map(w => w.code), ['FILL_RANGE']); assert.match(g.warnings[0].message, /\(an estimate\)$/);
  // The user's own ranges with their source: no estimate said.
  const own = glandCheck({ kind: 'piston', ring: O1, grooveDiameterMM: 25.5, widthMM: 4.7, sealDiameterMM: 31.1, ranges: { squeezePercent: [15, 30], fillPercent: [65, 90], stretchMaxPercent: 3, source: 'our seal maker' } });
  assert.deepEqual(own.warnings, []);
});

test('R12c.5 gland refusals and warnings: GLAND_DIMENSIONS for no depth, no squeeze, a full groove; SQUEEZE_RANGE, STRETCH_RANGE; the rows checked', () => {
  const base = { kind: 'piston', ring: O1, grooveDiameterMM: 25.5, widthMM: 4.7, sealDiameterMM: 31.1 };
  assert.throws(() => glandCheck({ ...base, sealDiameterMM: 25 }), e => code('GLAND_DIMENSIONS')(e) && /no depth/.test(e.message));
  assert.throws(() => glandCheck({ ...base, sealDiameterMM: 32.6 }), e => code('GLAND_DIMENSIONS')(e) && /not squeezed/.test(e.message));
  assert.throws(() => glandCheck({ ...base, widthMM: 3 }), e => code('GLAND_DIMENSIONS')(e) && /cannot fit/.test(e.message));
  assert.throws(() => glandCheck({ ...base, kind: 'face', depthMM: undefined }), code('GLAND_DIMENSIONS'));
  assert.deepEqual(glandCheck({ ...base, sealDiameterMM: 30.6 }).warnings.map(w => w.code), ['SQUEEZE_RANGE']);
  assert.ok(glandCheck({ ...base, grooveDiameterMM: 26.5, sealDiameterMM: 32.1 }).warnings.some(w => w.code === 'STRETCH_RANGE' && /above 5 %/.test(w.message)));
  assert.ok(glandCheck({ ...base, grooveDiameterMM: 24.5, sealDiameterMM: 30.1 }).warnings.some(w => w.code === 'STRETCH_RANGE' && /loose/.test(w.message)));
  for (const [bad, why] of [[{ ...O1, source: undefined }, /never neither/], [{ ...O1, crossSectionMM: 0 }, /above 0/], [{ ...O1, extra: 1 }, /unknown field/]]) assert.match(oringRowProblem(bad) ?? 'accepted', why);
  assert.throws(() => glandCheck({ ...base, ranges: { squeezePercent: [25, 18], fillPercent: [75, 85], stretchMaxPercent: 5, estimate: true } }), code('INVALID_INPUT'));
});

test('R12c.5 squeeze at the fit\'s extremes: the bore H8 and the groove h9 (test rows) — the depth 2.8 … 2.8455, so the squeeze\'s range', () => {
  const tables = [{ id: 't', rows: [{ class: 'H8', overMM: 30, upToMM: 50, upperUM: 39, lowerUM: 0, estimate: true }, { class: 'h9', overMM: 18, upToMM: 30, upperUM: 0, lowerUM: -52, estimate: true }] }];
  const g = glandCheck({ kind: 'piston', ring: O1, grooveDiameterMM: 25.5, widthMM: 4.7, sealDiameterMM: 31.1, fit: { tables, seal: 'H8', groove: 'h9' } });
  const cs = g.stretchedCrossSectionMM, hMax = (31.139 - 25.448) / 2, hMin = (31.1 - 25.5) / 2;
  near(g.squeezeRangePercent[0], 100 * (cs - hMax) / cs, 1e-9, 'least'); near(g.squeezeRangePercent[1], 100 * (cs - hMin) / cs, 1e-9, 'greatest');
  assert.throws(() => glandCheck({ kind: 'piston', ring: O1, grooveDiameterMM: 25.5, widthMM: 4.7, sealDiameterMM: 31.1, fit: { tables, seal: 'H7' } }), e => code('GLAND_DIMENSIONS')(e) && /load a row for H7/.test(e.message));
});

test('R12c.5 piston gland cut and its ring: π(R² − r²)w removed; the torus 2π²R\'r\'²; the free ring\'s overlap with the bore by Pappus on its segment (S0: 136.48580)', () => {
  const piston = evaluateCadPart(D(cyl('pe', 15.5, 20))).output('pe').brep;
  const g = glandCut(piston, { kind: 'piston', ring: O1, grooveDiameterMM: 25.5, widthMM: 4.7, sealDiameterMM: 31.1, face: 'pe.side0', atMM: 6 }, 'gl');
  assert.equal(checkBrep(g.brep).valid, true);
  near(vol(piston) - vol(g.brep), Math.PI * (15.5 ** 2 - 12.75 ** 2) * 4.7, 1e-6, 'groove'); assert.ok(g.brep.faces.some(f => f.name.startsWith('gl.groove')));
  const o = oringInGland(g.report, g.place, 'or'), rs = g.report.stretchedCrossSectionMM / 2, Rs = 12.75 + rs;
  assert.equal(checkBrep(o.brep).valid, true); near(vol(o.brep), 2 * Math.PI ** 2 * Rs * rs * rs, 1e-9, 'torus');
  const s = segment(rs, 31.1 / 2 - Rs), want = 2 * Math.PI * (Rs + s.y) * s.A;
  near(o.overlapMM3, want, 1e-6, 'overlap'); near(want, 136.48580, 1e-4, 'S0\'s figure');
  // (Centred in the groove: z 6 + 4.7/2.)
  const pts = o.brep.vertices.map(v => v.point[2]); near((Math.min(...pts) + Math.max(...pts)) / 2, 8.35, 1e-9, 'centred');
});

test('R12c.5 rod and face glands: their grooves and the rings\' overlaps — on the inner side 2π(R\' − ȳ)A, under a flange 2πR\'A', () => {
  const ring = { id: 'r1', insideDiameterMM: 19.5, crossSectionMM: 2.62, estimate: true };
  // A housing Ø40 with a Ø20 bore, 20 long; the rod Ø20; the groove's bottom Ø24.2 (h 2.1), 3.6 wide.
  const housing = evaluateCadPart(D(cyl('hs', 20, 20, 0, 10))).output('hsh').brep;
  const rod = glandCut(housing, { kind: 'rod', ring, grooveDiameterMM: 24.2, widthMM: 3.6, sealDiameterMM: 20, face: 'hsb.side0', atMM: 8 }, 'rg');
  assert.equal(checkBrep(rod.brep).valid, true); near(vol(housing) - vol(rod.brep), Math.PI * (12.1 ** 2 - 100) * 3.6, 1e-6, 'rod groove');
  // (The free ring rests on the groove's bottom Ø24.2: the rod displaces its inner side.)
  const ro = oringInGland(rod.report, rod.place, 'rr'), rs = rod.report.stretchedCrossSectionMM / 2, Rs = 12.1 - rs, sr = segment(rs, Rs - 10);
  near(rod.report.stretchPercent, 100 * (20 - 19.5) / 19.5, 1e-12, 'stretch on the rod');
  near(ro.overlapMM3, 2 * Math.PI * (Rs - sr.y) * sr.A, 1e-6, 'rod overlap');
  // A plate 80 × 80 × 10; a face groove about its top's centre, inner Ø30, 4 wide, 2.6 deep, for O1.
  const plate = evaluateCadPart(D([{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-40, -40], max: [40, 40] }, { id: 'pl', kind: 'extrude', sketch: 'ps', height: 10 }])).output('pl').brep;
  const fg = glandCut(plate, { kind: 'face', ring: { ...O1, insideDiameterMM: 29.5 }, grooveDiameterMM: 30, widthMM: 4, depthMM: 2.6, face: 'pl.top', centerMM: [0, 0, 10] }, 'fg');
  assert.equal(checkBrep(fg.brep).valid, true); near(vol(plate) - vol(fg.brep), Math.PI * (19 ** 2 - 15 ** 2) * 2.6, 1e-6, 'face groove');
  const fo = oringInGland(fg.report, fg.place, 'fr'), fr = fg.report.stretchedCrossSectionMM / 2, FR = 15 + fr, sf = segment(fr, 2.6 - fr);
  near(fo.overlapMM3, 2 * Math.PI * FR * sf.A, 1e-6, 'face overlap');
  assert.deepEqual(fg.report.ranges, O2_RANGES.face);
});

test('R12c.5 cut refusals: a piston gland on a bore, a groove off its face, a groove through a thin wall; the part model with its codes', () => {
  const tube = evaluateCadPart(D(cyl('t', 15.5, 20, 0, 13))).output('th').brep;
  const g = { kind: 'piston', ring: O1, grooveDiameterMM: 25.5, widthMM: 4.7, sealDiameterMM: 31.1 };
  assert.throws(() => glandCut(tube, { ...g, face: 'tb.side0', atMM: 6 }, 'x'), e => code('GLAND_DIMENSIONS')(e) && /is a bore/.test(e.message));
  assert.throws(() => glandCut(tube, { ...g, face: 't.side0', atMM: 18 }, 'x'), e => code('GLAND_DIMENSIONS')(e) && /runs off the face/.test(e.message));
  assert.throws(() => glandCut(tube, { ...g, face: 't.side0', atMM: 6 }, 'x'), e => code('GLAND_DIMENSIONS')(e) && /through the part's wall/.test(e.message));
  const feats = [...cyl('pe', 15.5, 20), { id: 'gl', kind: 'oring-gland', target: 'pe', face: 'pe.side0', gland: 'piston', ring: { id: '214', insideDiameter: 24.99, crossSection: 3.53, source: 'O1' }, groove: { diameter: 25.5, width: 4.7, at: 6 }, seal: 31.1 }, { id: 'or', kind: 'oring', gland: 'gl' }];
  const snap = evaluateCadPart(D(feats));
  assert.equal(snap.output('gl').gland.kind, 'piston'); near(snap.output('or').oring.overlapMM3, 136.48580, 1e-4, 'the ring\'s overlap');
  assert.throws(() => evaluateCadPart(D(feats.map(f => f.id === 'gl' ? { ...f, seal: 25 } : f))), e => e.code === 'GEOMETRY' && e.message.includes('[GLAND_DIMENSIONS]'));
  assert.throws(() => evaluateCadPart(D([...feats, { id: 'x', kind: 'oring', gland: 'pe' }])), e => e.code === 'REFERENCE');
});
