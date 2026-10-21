import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brepMassProperties, checkPlacedBevelGears, checkPlacedInternalGears, checkPlacedSpurGears, checkPlacedThroatedPair, evaluateCadPart, internalGear, spurGear, type CadPartSnapshot } from '@barocss/cad';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';

// R12b.7 (D138): the gears' acceptance — a planetary set, a right-angle bevel pair and a worm reducer, each built by the
// agent's tools in one turn from the calls in test/fixtures (the flow sends the same calls through the real chat).
// Acceptance by closed forms of the sets' geometry, none read from the build: the working centre distances by
// inv α_w, where each gear stands, the pitch cones and cone distance, the throat and its torus, the tip and root
// diameters, the speed ratios by turning the driver. Every pair is then checked by the kernel's full sweep of the two
// exact profiles as placed — the pairs no placement made among them (the sun with the second and third planets, which
// mesh only if (zs + zr)/3 is whole) and, as a control that the check can fail, a planet off its place. The kernel's
// conformance cases r12b/accept-* hold the same part documents (WRITE_ACCEPTANCE=1).
const root = process.cwd(), conformance = join(root, '../../packages/barocss-cad/conformance/r12b');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function build(name: string): Promise<{ state: ChatState; results: string[] }> {
  const { calls } = JSON.parse(readFileSync(join(root, 'test/fixtures', `${name}.calls.json`), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  let state: ChatState = { doc: emptyDoc(), bodies: [] };
  const results: string[] = [];
  for (const c of calls) { const r = await dispatchTool(state, c.tool, c.args, evaluate); assert.ok(!r.isError, `${c.tool}: ${r.content}`); state = r.state; results.push(r.content); }
  return { state, results };
}
const close = (a: number, b: number, tol: number, what: string) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const near = (a: readonly number[], b: readonly number[], tol: number, what: string) => a.forEach((v, k) => close(v, b[k], tol, `${what}[${k}]`));
const DEG = Math.PI / 180, ALPHA = 20 * DEG;
const inv = (a: number) => Math.tan(a) - a;
/** The angle whose involute function is v (Newton from 20°). */
function invInverse(v: number): number { let a = ALPHA; for (let k = 0; k < 50; k++) a -= (inv(a) - v) / (Math.tan(a) ** 2); return a; }
/** The working centre distance of a pair, (zΣ m/2) cos α / cos α_w with inv α_w = 2 tan α xΣ/zΣ + inv α (external: sums; internal: differences). */
const workingDistance = (m: number, zSum: number, xSum: number) => zSum * m / 2 * Math.cos(ALPHA) / Math.cos(invInverse(2 * Math.tan(ALPHA) * xSum / zSum + inv(ALPHA)));
const warnings = (b: { notes?: { text: string; warning?: boolean }[] }) => (b.notes ?? []).filter(n => n.warning).map(n => n.text);
const out = (snap: CadPartSnapshot, id: string) => { const o = snap.outputs.find(x => x.id === id); assert.ok(o, id); return o!; };
function caseFile(name: string, doc: StudioDoc, about: string, expect: object, oracle: string) {
  const file = join(conformance, `${name}.json`), partDocument = toPartDocument(doc);
  if (process.env.WRITE_ACCEPTANCE) writeFileSync(file, JSON.stringify({ id: `r12b-${name}`, step: 'R12b', decisions: ['D138'], about, input: { partDocument }, expect, oracle }, null, 2) + '\n');
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).input.partDocument, JSON.parse(JSON.stringify(partDocument)), `${name}: the conformance case holds the part the agent built`);
}
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

test('R12b.7 the planetary set by the agent: a ring of 60, three planets of 18 at 120°, a sun of 24 — at the working centre distance by inv α_w, the sun on the ring\'s axis through planet 1, every one of its six pairs clear by the full sweep (the sun with planets 2 and 3 by (zs + zr)/3 whole), a planet off its place crossing the sun; turned, the ratios −zr/zs and +zr/zp', async () => {
  const { state, results } = await build('gear-planetary'), bodies = state.bodies, m = 2, zr = 60, zp = 18, zs = 24, x2 = 0.5, xs = 0.5;
  assert.equal(bodies.length, 5);
  // The agent's own checks: the sun clear of each planet (check_spec, gear_clearance ≥ 0).
  assert.deepEqual(JSON.parse(results.at(-1)!).summary, { pass: 3, fail: 0, unknown: 0, hard_failing: 0 });
  // Nothing warned but the ring's cutter tip radius, an estimate (D133); each planet assembles radially.
  assert.deepEqual(bodies.map(b => warnings(b).length), [1, 0, 0, 0, 0], JSON.stringify(bodies.map(warnings)));
  assert.match(warnings(bodies[0])[0], /cutter's tip radius .* is an estimate/);
  for (const b of bodies.slice(1, 4)) assert.ok(b.notes!.some(n => n.text === 'Radial assembly clear: it can be moved in from the ring\'s centre'), JSON.stringify(b.notes));
  // zr = zs + 2 zp, and x_s = x2 − 2 x_p: the internal pair's (z diff 42, x diff 0.5) and the external one's (z sum 42, x sum 0.5) working distances are one.
  assert.equal(zr, zs + 2 * zp); assert.equal((zs + zr) % 3, 0);
  const aw = workingDistance(m, zr - zp, x2 - 0), awSun = workingDistance(m, zs + zp, xs + 0);
  close(aw, awSun, 1e-15, 'one working distance');
  const snap = evaluateCadPart(toPartDocument(state.doc)), ring = out(snap, 'n0').internalGearPlacement!, planets = ['n1', 'n2', 'n3'].map(id => out(snap, id).gearPlacement!), sun = out(snap, 'n4').gearPlacement!;
  planets.forEach((p, k) => near(p.center, [aw * Math.cos(120 * k * DEG), aw * Math.sin(120 * k * DEG)], 1e-12, `planet ${k + 1}`));
  near(sun.center, [0, 0], 1e-12, 'the sun on the ring\'s axis');
  // Diameters by the shifted standard proportions: tip m(z + 2 + 2x), root m(z − 2.5 + 2x); the ring's tip (inside) m(z − 2 + 2x2).
  const dims = (id: string) => out(snap, id).gear!.dimensions;
  near([dims('n1').tipDiameterMM, dims('n1').rootDiameterMM], [m * (zp + 2), m * (zp - 2.5)], 1e-12, 'planet');
  near([dims('n4').tipDiameterMM, dims('n4').rootDiameterMM], [m * (zs + 2 + 2 * xs), m * (zs - 2.5 + 2 * xs)], 1e-12, 'sun');
  close(out(snap, 'n0').internalGear!.dimensions.tipDiameterMM, m * (zr - 2 + 2 * x2), 1e-12, 'ring tip');
  // Every pair by the full sweep of the exact profiles as placed: touching at no backlash, never crossing.
  function pairs(s: CadPartSnapshot): number[] {
    const R = out(s, 'n0').internalGearPlacement!, S = out(s, 'n4').gearPlacement!, least: number[] = [];
    for (const id of ['n1', 'n2', 'n3']) {
      const P = out(s, id).gearPlacement!, inside = checkPlacedInternalGears(R, P, { mode: 'report' }), outside = checkPlacedSpurGears(S, P, { mode: 'report' });
      assert.ok(!inside.sweep.interference && !outside.sweep.interference, `${id}: ${inside.sweep.minimumClearanceMM}, ${outside.sweep.minimumClearanceMM}`);
      close(inside.centerDistanceMM, aw, 1e-12, `${id} in the ring`); close(outside.centerDistanceMM, aw, 1e-12, `${id} on the sun`);
      least.push(inside.sweep.minimumClearanceMM, outside.sweep.minimumClearanceMM);
    }
    return least;
  }
  const least = pairs(snap);
  for (const c of least) assert.ok(c >= 0 && c < 1e-3, `touching: ${least}`);
  // The control: planet 2 at 110° meshes with the ring but not the sun — the sweep finds them crossing.
  const off = toPartDocument({ ...state.doc, nodes: state.doc.nodes.map((n, k) => k === 2 ? { ...n, mesh: { gear: 0, direction: 110 } } as typeof n : n) }), so = evaluateCadPart(off);
  assert.equal(checkPlacedInternalGears(out(so, 'n0').internalGearPlacement!, out(so, 'n2').gearPlacement!, { mode: 'report' }).sweep.interference, false);
  assert.equal(checkPlacedSpurGears(out(so, 'n4').gearPlacement!, out(so, 'n2').gearPlacement!, { mode: 'report' }).sweep.interference, true, 'off its place it crosses the sun');
  // Turned: the ring 7.5° (the carrier held), the planets +zr/zp of it the same way, the sun −zr/zs; every pair still clear.
  const turned = evaluateCadPart(toPartDocument({ ...state.doc, nodes: state.doc.nodes.map((n, k) => k === 0 ? { ...n, rotation: 7.5 } as typeof n : n) })), d = 7.5 * DEG;
  close(out(turned, 'n0').internalGearPlacement!.rotation - ring.rotation, d, 1e-12, 'ring');
  ['n1', 'n2', 'n3'].forEach((id, k) => close(out(turned, id).gearPlacement!.rotation - planets[k].rotation, d * zr / zp, 1e-12, `${id} turned`));
  close(out(turned, 'n4').gearPlacement!.rotation - sun.rotation, -d * zr / zs, 1e-12, 'sun turned');
  for (const c of pairs(turned)) assert.ok(c >= 0, 'clear turned');
  // Each body is its gear as built alone, placed rigidly; the conformance case pins them.
  const alone = [brepMassProperties(internalGear(out(snap, 'n0').internalGearPlacement!.spec).brep, 1).volumeMM3, ...['n1', 'n2', 'n3', 'n4'].map(id => brepMassProperties(spurGear(out(snap, id).gearPlacement!.spec).brep, 1).volumeMM3)];
  bodies.forEach((b, k) => close(b.volumeMM3!, alone[k], 1e-9, `body ${k}`));
  const centres = [[0, 0], ...planets.map(p => p.center), [0, 0]];
  caseFile('accept-planetary', state.doc, 'R12b.7 acceptance: the planetary set the agent builds (apps/cad-studio/test/fixtures/gear-planetary.calls.json) — module 2, a ring of 60 (x2 0.5, the root of a 24-tooth pinion cutter), three planets of 18 at 0°, 120° and 240°, a sun of 24 (x 0.5) meshing with the first planet, all 15 wide.',
    { outputs: bodies.map((b, k) => ({ volumeMM3: { value: r6(b.volumeMM3!), relTol: 1e-6 }, centroidMM: { value: [r6(centres[k][0]), r6(centres[k][1]), 7.5], absTol: 1e-6 }, bodies: 1, topology: [{ shells: 1, genus: 1 }] })), stepRoundTrip: { relTol: 1e-6 } },
    `Closed forms: the working centre distance (zΣ m/2) cos α / cos α_w with inv α_w = 2 tan α xΣ/zΣ + inv α, the same ${r6(aw)} mm for the ring with a planet (42, 0.5) and the sun with one (42, 0.5); the planets there at 0°, 120°, 240°, the sun on the ring's axis; zr = zs + 2zp, (zs + zr)/3 = 28. Volumes: each gear's as in its own stage's cases (r12b-internal-*, r12b-generated-*), by this kernel.`);
});

test('R12b.7 the right-angle bevel pair by the agent: m3 z20 and z40 at Σ 90° — the pitch cones atan(z1/z2), the cone distance m z1 / (2 sin δ1), the heel diameters, one apex and square axes, the toe on its plane; clear by the sweep on the heel sphere, the contact ratio beside Tredgold\'s by its formula; turned, the ratio z1/z2', async () => {
  const { state } = await build('gear-bevel-pair'), bodies = state.bodies, m = 3, z1 = 20, z2 = 40, b = 18;
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies.map(warnings), [['Schematic root: not the generating tool\'s, not validated for manufacturing'], ['Schematic root: not the generating tool\'s, not validated for manufacturing']]);
  const d1 = Math.atan(z1 / z2), d2 = Math.PI / 2 - d1, Re = m * z1 / (2 * Math.sin(d1)), ta = Math.atan(m / Re), tf = Math.atan(1.25 * m / Re);
  const snap = evaluateCadPart(toPartDocument(state.doc)), P = out(snap, 'n0'), W = out(snap, 'n1'), pp = P.bevelGearPlacement!, wp = W.bevelGearPlacement!;
  [[P.bevelGear!.dimensions, d1, z1], [W.bevelGear!.dimensions, d2, z2]].forEach(([g, delta, z], k) => {
    const dim = g as NonNullable<typeof P.bevelGear>['dimensions'], dl = delta as number;
    close(dim.pitchAngleDeg, dl / DEG, 1e-12, `δ${k + 1}`); close(dim.coneDistanceMM, Re, 1e-12, 'Re'); close(dim.innerConeDistanceMM, Re - b, 1e-12, 'Ri');
    close(dim.referenceDiameterMM, m * (z as number), 1e-12, 'd'); close(dim.addendumAngleDeg, ta / DEG, 1e-12, 'θa'); close(dim.dedendumAngleDeg, tf / DEG, 1e-12, 'θf');
    close(dim.tipDiameterAtHeelMM, 2 * Re * Math.sin(dl + ta), 1e-12, 'tip at the heel'); close(dim.rootDiameterAtHeelMM, 2 * Re * Math.sin(dl - tf), 1e-12, 'root at the heel');
  });
  // One apex, the axes square; the pinion stands on Z 0 by its toe's tip edge, Ri cos(δ1 + θa) from the apex.
  near(wp.apex, pp.apex, 1e-12, 'one apex'); near(pp.axis, [0, 0, 1], 1e-15, 'pinion axis'); near(wp.axis, [1, 0, 0], 1e-15, 'the mate toward 0°');
  close(pp.apex[2], -(Re - b) * Math.cos(d1 + ta), 1e-12, 'apex below the toe');
  // Tredgold's virtual spur pair by its formula (z/cos δ teeth on the back cones), the estimate beside the exact spherical ratio.
  const rv = [Re * Math.tan(d1), Re * Math.tan(d2)], rbv = rv.map(r => r * Math.cos(ALPHA)), rav = rv.map(r => r + m);
  const tredgold = (Math.sqrt(rav[0] ** 2 - rbv[0] ** 2) + Math.sqrt(rav[1] ** 2 - rbv[1] ** 2) - (rv[0] + rv[1]) * Math.sin(ALPHA)) / (Math.PI * m * Math.cos(ALPHA));
  function check(s: CadPartSnapshot) {
    const c = checkPlacedBevelGears(out(s, 'n0').bevelGearPlacement!, out(s, 'n1').bevelGearPlacement!, { mode: 'report' });
    assert.ok(!c.sweep.interference && c.sweep.minimumClearanceMM >= 0 && c.sweep.minimumClearanceMM < 1e-3 + c.sweep.chordSagMM, JSON.stringify(c.sweep));
    return c;
  }
  const c = check(snap);
  close(c.speedRatio, z2 / z1, 1e-15, 'ratio'); close(c.shaftAngleDeg, 90, 1e-12, 'Σ'); close(c.tredgoldContactRatio, tredgold, 1e-9, 'Tredgold');
  assert.ok(Math.abs(c.idealContactRatio - tredgold) < 0.01 * tredgold, `${c.idealContactRatio} beside ${tredgold}`);
  // Turned: the pinion 9°, its mate 4.5° — and still clear.
  const turned = evaluateCadPart(toPartDocument({ ...state.doc, nodes: state.doc.nodes.map((n, k) => k === 0 ? { ...n, rotation: 9 } as typeof n : n) }));
  close(Math.abs(out(turned, 'n1').bevelGearPlacement!.rotation - wp.rotation), 9 * DEG * z1 / z2, 1e-12, 'the mate turned');
  check(turned);
  caseFile('accept-bevel-pair', state.doc, 'R12b.7 acceptance: the right-angle straight bevel pair the agent builds (apps/cad-studio/test/fixtures/gear-bevel-pair.calls.json) — module 3 at the heel, 20 and 40 teeth, face width 18, bores 12 and 20, the pinion\'s toe on Z 0.',
    { outputs: bodies.map(x => ({ volumeMM3: { value: r6(x.volumeMM3!), relTol: 1e-6 }, centroidMM: { value: x.centroid!.map(r6), absTol: 1e-5 }, bodies: 1, topology: [{ shells: 1, genus: 1 }] })), stepRoundTrip: { relTol: 1e-6 } },
    `Closed forms: δ1 = atan(z1/z2) = ${r6(d1 / DEG)}°, δ2 = 90° − δ1, Re = m z1/(2 sin δ1) = ${r6(Re)} mm, θa = atan(m/Re), θf = atan(1.25 m/Re), the apex ${r6((Re - b) * Math.cos(d1 + ta))} mm below Z 0; the mate's axis along +X through it. Volumes and centroids by this kernel (as r12b-bevel-* for their solids).`);
});

test('R12b.7 the worm reducer by the agent: a single-start ZA worm m_x 3 Ø44 and its throated wheel of 30 — the centre distance (d1 + m z2)/2, the lead angle and the axial sides, the throat and its torus, the tips and roots at the faces on the tori; in contact along lines in every section; turned, 30 : 1', async () => {
  const { state } = await build('gear-worm-reducer'), bodies = state.bodies, m = 3, z1 = 1, z2 = 30, d1 = 44, b = 20;
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies.map(x => warnings(x).length), [1, 0]); assert.match(warnings(bodies[0])[0], /^cut by a hob of the worm's own thread/);
  const a = (d1 + m * z2) / 2, d2 = m * z2, gamma = Math.atan(z1 * m / d1), Rt = a - d2 / 2 - m, Rh = d1 / 2 + m + 0.25 * m, c = b / 2;
  const snap = evaluateCadPart(toPartDocument(state.doc)), Wh = out(snap, 'n0'), Wo = out(snap, 'n1'), wheel = Wh.wormWheelPlacement!, worm = Wo.wormPlacement!;
  const w = Wo.worm!.dimensions, g = Wh.wormWheel!.dimensions;
  close(w.leadAngleDeg, gamma / DEG, 1e-12, 'γ'); close(w.leadMM, Math.PI * m * z1, 1e-12, 'lead'); close(w.axialPressureAngleDeg!, Math.atan(Math.tan(ALPHA) / Math.cos(gamma)) / DEG, 1e-12, 'α_x');
  near([w.tipDiameterMM, w.rootDiameterMM], [d1 + 2 * m, d1 - 2.5 * m], 1e-12, 'worm');
  near([g.centerDistanceMM, g.referenceDiameterMM, g.throatDiameterMM, g.throatRadiusMM, g.rootDiameterMM], [a, d2, d2 + 2 * m, Rt, 2 * (a - Rh)], 1e-12, 'wheel');
  // At the faces, c = b/2 off the mid-plane: the tip on the throat torus, a − √(R_t² − c²); the root on the hob crest's, a − √(R_h² − c²).
  near([g.tipDiameterAtFacesMM, g.rootDiameterAtFacesMM], [2 * (a - Math.sqrt(Rt ** 2 - c ** 2)), 2 * (a - Math.sqrt(Rh ** 2 - c ** 2))], 1e-12, 'at the faces');
  // The worm square to the wheel's axis in its mid-plane, its middle at a on the line of centres.
  const L = Wo.worm!.dimensions.lengthMM, mid = worm.origin.map((v, k) => v + worm.axis[k] * L / 2);
  near(mid, [a, 0, c], 1e-12, 'the worm\'s middle'); close(worm.axis[2], 0, 1e-15, 'square to the wheel\'s axis'); close(worm.axis[0], 0, 1e-15, 'square to the line of centres');
  function check(s: CadPartSnapshot) {
    const r = checkPlacedThroatedPair(out(s, 'n0').wormWheelPlacement!, out(s, 'n1').wormPlacement!, { mode: 'report', samples: 16 });
    assert.ok(!r.interference && r.planes.length === 5 && r.planes.every(p => !p.interference && p.minimumClearanceMM <= r.touchMM), JSON.stringify(r.planes));
    return r;
  }
  close(check(snap).speedRatio, z2 / z1, 1e-15, 'ratio');
  // Turned: the wheel 5°, the worm 150° — and still in contact along lines.
  const turned = evaluateCadPart(toPartDocument({ ...state.doc, nodes: state.doc.nodes.map((n, k) => k === 0 ? { ...n, rotation: 5 } as typeof n : n) }));
  close(Math.abs(out(turned, 'n1').wormPlacement!.rotation - worm.rotation), 5 * DEG * z2 / z1, 1e-12, 'the worm turned');
  check(turned);
  close(wheel.rotation, 0, 0, 'the wheel as placed');
  caseFile('accept-worm-reducer', state.doc, 'R12b.7 acceptance: the worm reducer the agent builds (apps/cad-studio/test/fixtures/gear-worm-reducer.calls.json) — a single-start right-hand ZA worm, axial module 3, Ø44, bored 12, and its throated wheel of 30 teeth, 20 wide, bored 20: 30 : 1.',
    { outputs: bodies.map((x, k) => ({ volumeMM3: { value: r6(x.volumeMM3!), relTol: 2e-6 }, centroidMM: { value: k ? x.centroid!.map(r6) : [0, 0, c], absTol: k ? 1e-5 : 1e-6 }, bodies: 1, topology: [{ shells: 1, genus: 1 }] })) },
    `Closed forms: a = (d1 + m z2)/2 = ${a}, the worm's middle there in the wheel's mid-plane Z ${c}, its axis along Y; γ = atan(z1 m/d1), the lead π m z1; the throat d2 + 2m, R_t = a − d2/2 − m. Volumes by this kernel, as r12b-worm-wheel-pair for its wheel; the worm's centroid by this kernel (off its middle by the thread's ends, 1.6e-3 mm).`);
});
