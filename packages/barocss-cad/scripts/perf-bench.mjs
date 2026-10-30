// Kernel performance bench (apps/cad-studio/handover/notes/report-kernel-performance-2026-10-28.md): fixed workloads,
// their time (median of runs) and a fingerprint of the whole result (sha256 of its JSON — every vertex, curve, surface
// and name), so a refactor can be checked bit-identical; and a shape record (validity, counts, volume, centroid,
// projected lines) for changes judged within tolerance. Run after build:library, from any directory:
//   node scripts/perf-bench.mjs run [case,case…]                  times and fingerprints
//   BASE=base.json node scripts/perf-bench.mjs save|compare [cases] fingerprints (RUNS=3 runs a case, default)
//   SHAPE=shape.json node scripts/perf-bench.mjs shape-save|shape-compare [cases]
// A/B: save on the old build, rebuild with the change, compare (same machine, nothing else heavy running).
// native-cylinder-*-first-mass only: WARMUP=3 untimed batches, BATCH=32 fresh B-reps per timed batch;
// cloning/setup stay outside the timer. New-case rawDuration/median/perQuery retain sub-ms precision (unit: ms).
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
const D = new URL('../dist', import.meta.url).pathname;
const K = await import(`${D}/index.js`);
const { buildCylindricalWrapNativeBoundAssembly } = await import(`${D}/features/cylindrical-wrap-assembly.js`);
const { certifyCylindricalWrapFormalPadMass } = await import(`${D}/features/cylindrical-wrap-formal-mass.js`);
const { buildCylindricalWrapClosedReference } = await import(`${D}/features/cylindrical-wrap-closed-reference.js`);
const doc = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const fp = x => createHash('sha256').update(JSON.stringify(nativeMassReceipts.has(x) ? { brep: x, masses: nativeMassReceipts.get(x) } : threadFingerprint(x), (k, v) => (v instanceof Float32Array || v instanceof Float64Array || v instanceof Uint32Array) ? Array.from(v) : v)).digest('hex').slice(0, 16);
// These native mass cases prepare outside the timer. Every query receives a fresh B-rep identity,
// so neither the quadrature WeakMap nor a preceding area query can supply its integrals.
const nativeMassReceipts = new WeakMap();
function nativeCylinderFirstMass(height) {
  let fixture;
  const batch = Number(process.env.BATCH ?? 32), warmup = Number(process.env.WARMUP ?? 3);
  const run = breps => {
    const masses = breps.map(brep => K.brepMassProperties(brep, 1, { quadratureSegments: 8 }));
    nativeMassReceipts.set(breps[0], masses);
    return breps[0];
  };
  run.prepare = () => {
    if (!Number.isInteger(batch) || batch < 1 || !Number.isInteger(warmup) || warmup < 0) throw new Error('BATCH must be positive and WARMUP nonnegative integers');
    fixture ??= K.brepFromPrismatic(K.transformPrismatic(K.prismaticFromProfile({
      outer: [{ kind: 'arc', start: [3, 0], center: [0, 0], direction: 'ccw' }], height, tag: 'cylinder',
    }), { matrix: [1, 0, 0, 1], offset: [.1234567, -.2345678], zOffset: .3456789 }), { id: 'cylinder' });
    return Array.from({ length: batch }, () => structuredClone(fixture));
  };
  run.batch = batch;
  run.warmup = warmup;
  return run;
}
// New thread cases still return actual B-reps, so shape-save/compare retain their existing meaning.
// Construction-only cases calculate their acceptance mass after the runner stops its timer, in fp().
// The first-mass case computes it inside its timer on a freshly constructed B-rep: construction + first mass,
// never cached mass alone. Do not subtract the two case medians to claim a pure mass time.
const threadMassReceipts = new WeakMap();
function threadBenchmark(brep, includeFirstMass = false) {
  threadMassReceipts.set(brep, includeFirstMass ? K.brepMassProperties(brep, 1) : null);
  return brep;
}
function binary64(value) {
  const bytes = Buffer.allocUnsafe(8);
  bytes.writeDoubleBE(value);
  return bytes.toString('hex');
}
function threadFingerprint(brep) {
  if (!threadMassReceipts.has(brep)) return brep;
  const mass = threadMassReceipts.get(brep) ?? K.brepMassProperties(brep, 1);
  return { brep, mass, massBits: {
    volume: binary64(mass.volume), mass: binary64(mass.mass),
    centroid: mass.centroid.map(binary64), inertia: mass.inertia.map(row => row.map(binary64)),
    ...(mass.volumeBound === undefined ? {} : { volumeBound: binary64(mass.volumeBound) }),
  } };
}
function directLongThread() {
  return K.threadSolid({ id: 'th', diameter: 6, pitch: 1, seat: 60, length: 60, form: 'helical' });
}
function directLongThreadConstruction() { return threadBenchmark(directLongThread()); }
function directLongThreadConstructionFirstMass() { return threadBenchmark(directLongThread(), true); }
const out = (f, id) => K.outputOf(K.evaluateCadPart(doc(f)), id);
const tee = (tilt) => { const t = tilt * Math.PI / 180, n = [Math.cos(t), 0, Math.sin(t)]; return [{ id: 'ms', kind: 'sketch', profile: 'circle', plane: { origin: [-30, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] }, center: [0, 0], radius: 10 }, { id: 'm', kind: 'extrude', sketch: 'ms', height: 60 }, { id: 'bs', kind: 'sketch', profile: 'circle', plane: { origin: [0, 0, 0], normal: n, xAxis: [0, 1, 0] }, center: [0, 0], radius: 6 }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 25 }, { id: 'u', kind: 'union', target: 'm', tool: 'b' }]; };
const pin = () => { const n = [0.5, 0, Math.sqrt(3) / 2]; return [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-25, -25], max: [25, 25] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 5 }, { id: 'cs', kind: 'sketch', profile: 'circle', plane: { origin: [0, 0, 3], normal: n, xAxis: [0, 1, 0] }, center: [0, 0], radius: 4 }, { id: 'c', kind: 'extrude', sketch: 'cs', height: 20 }, { id: 'u', kind: 'union', target: 'p', tool: 'c' }]; };
const ff = (id, target, faces, radius) => ({ id, kind: 'face-fillet', target, faces, radius });
// Tilted planar boxes (the exact polyhedral Boolean).
const boxes = () => { const f = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'a', kind: 'extrude', sketch: 's', height: 20 }]; let last = 'a';
  for (let k = 0; k < 4; k++) { f.push({ id: `t${k}s`, kind: 'sketch', profile: 'rectangle', min: [5 + 8 * k, -5], max: [9 + 8 * k, 35] }, { id: `t${k}e`, kind: 'extrude', sketch: `t${k}s`, height: 30, from: -5 }, { id: `t${k}`, kind: 'rotate', target: `t${k}e`, axis: 'y', angle: 7 + 5 * k, pivot: [7 + 8 * k, 15, 10] }, { id: `d${k}`, kind: 'difference', target: last, tool: `t${k}` }); last = `d${k}`; }
  return [f, last]; };
const boxes24 = () => { const f = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [120, 60] }, { id: 'a', kind: 'extrude', sketch: 's', height: 40 }]; let last = 'a';
  for (let k = 0; k < 24; k++) { f.push({ id: `t${k}s`, kind: 'sketch', profile: 'rectangle', min: [3 + 4.8 * k, -10], max: [5.5 + 4.8 * k, 70] }, { id: `t${k}e`, kind: 'extrude', sketch: `t${k}s`, height: 60, from: -10 }, { id: `t${k}r`, kind: 'rotate', target: `t${k}e`, axis: 'y', angle: 7 + 1.3 * k, pivot: [4 + 4.8 * k, 30, 20] }, { id: `t${k}`, kind: 'rotate', target: `t${k}r`, axis: 'x', angle: 11 + 0.7 * k, pivot: [4 + 4.8 * k, 30, 20] }, { id: `d${k}`, kind: k % 3 === 2 ? 'union' : 'difference', target: last, tool: `t${k}` }); last = `d${k}`; }
  return [f, last]; };
// 48 tilted boxes along a longer slab (more faces in one Boolean chain).
const boxes48 = () => { const f = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [240, 60] }, { id: 'a', kind: 'extrude', sketch: 's', height: 40 }]; let last = 'a';
  for (let k = 0; k < 48; k++) { f.push({ id: `t${k}s`, kind: 'sketch', profile: 'rectangle', min: [3 + 4.8 * k, -10], max: [5.5 + 4.8 * k, 70] }, { id: `t${k}e`, kind: 'extrude', sketch: `t${k}s`, height: 60, from: -10 }, { id: `t${k}r`, kind: 'rotate', target: `t${k}e`, axis: 'y', angle: 7 + 0.65 * k, pivot: [4 + 4.8 * k, 30, 20] }, { id: `t${k}`, kind: 'rotate', target: `t${k}r`, axis: 'x', angle: 11 + 0.35 * k, pivot: [4 + 4.8 * k, 30, 20] }, { id: `d${k}`, kind: k % 3 === 2 ? 'union' : 'difference', target: last, tool: `t${k}` }); last = `d${k}`; }
  return [f, last]; };
// A plate with n holes, one hole feature each (the common long Boolean chain).
const plateHoles = n => { const f = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10 * n / 2 + 10, 30] }, { id: 'p', kind: 'extrude', sketch: 's', height: 8 }]; let last = 'p';
  for (let k = 0; k < n; k++) { const h = `h${k}`; f.push({ id: h, kind: 'hole', target: last, center: [10 + 10 * Math.floor(k / 2), k % 2 ? 22 : 8], radius: 2.5 }); last = h; }
  return [f, last]; };
// A plate with n cylinders joined (bosses) or cut (pockets) by the general Boolean, one feature each.
const plateCyl = (n, op) => { const f = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10 * n / 2 + 10, 30] }, { id: 'p', kind: 'extrude', sketch: 's', height: 8 }]; let last = 'p';
  for (let k = 0; k < n; k++) { f.push({ id: `c${k}s`, kind: 'sketch', profile: 'circle', plane: { origin: [0, 0, op === 'union' ? 8 : 4], normal: [0, 0, 1], xAxis: [1, 0, 0] }, center: [10 + 10 * Math.floor(k / 2), k % 2 ? 22 : 8], radius: 3 }, { id: `c${k}`, kind: 'extrude', sketch: `c${k}s`, height: 6 }, { id: `b${k}`, kind: op, target: last, tool: `c${k}` }); last = `b${k}`; }
  return [f, last]; };
// A plate with one edge rounded first (a B-rep from then on), then n bosses joined: each through the general Boolean.
const roundedPlateBosses = n => { const f = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10 * n / 2 + 10, 30] }, { id: 'p', kind: 'extrude', sketch: 's', height: 8 }];
  const e = out(f, 'p').brep.edges.map(x => x.name).filter(x => x && /top/.test(x))[0]; f.push({ id: 'r', kind: 'fillet', target: 'p', edges: [e], radius: 2 }); let last = 'r';
  for (let k = 0; k < n; k++) { f.push({ id: `c${k}s`, kind: 'sketch', profile: 'circle', plane: { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] }, center: [10 + 10 * Math.floor(k / 2), k % 2 ? 22 : 8], radius: 3 }, { id: `c${k}`, kind: 'extrude', sketch: `c${k}s`, height: 6 }, { id: `b${k}`, kind: 'union', target: last, tool: `c${k}` }); last = `b${k}`; }
  return [f, last]; };
const reliefCase = mode => out([
  { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
  { id: 'p', kind: 'extrude', sketch: 's', height: 10 },
  { id: 'ink', kind: 'sketch', profile: 'rectangle', min: [10, 10], max: [30, 20] },
  { id: 'r', kind: 'profile-relief', target: 'p', faces: ['p.top'], sketches: ['ink'], depth: 3, mode, clearance: 0.25 },
], 'r').brep;
// Time the complete fixed-profile proof, then fingerprint only its actual B-rep geometry.
// Cumulative proof counters are intentionally compared separately from geometry by the D305 evidence run.
function nativeBoundPad() {
  const solid = K.prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: -5, tag: 'post' });
  const part = { solid: { kind: 'upright', solid }, brep: K.brepFromPrismatic(solid, { id: 'post' }) };
  return buildCylindricalWrapNativeBoundAssembly(part, [{ outer: [[0.125, 0.25], [0.375, 0.25], [0.375, 0.75], [0.125, 0.75]], holes: [] }], { id: 'native_pad', height: 10 }).assembly.brep;
}
function nativeBoundAsymmetricPad() {
  const solid = K.prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: -7, tag: 'post' });
  const part = { solid: { kind: 'upright', solid }, brep: K.brepFromPrismatic(solid, { id: 'post' }) };
  return buildCylindricalWrapNativeBoundAssembly(part, [{ outer: [[0.1, 0.2], [0.4, 0.2], [0.4, 0.7], [0.1, 0.7]], holes: [] }], { id: 'wrap', height: 10 }).assembly.brep;
}
// Time the complete fresh request; the harness fingerprint covers only mass-property Number output.
// Compare full binary64 receipts separately, excluding only final counts. Generic shape mode is not applicable.
function formalPadMass() {
  const solid = K.prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: -7, tag: 'post' });
  const part = { solid: { kind: 'upright', solid }, brep: K.brepFromPrismatic(solid, { id: 'post' }) };
  return certifyCylindricalWrapFormalPadMass(part, { u: [0.1, 0.4], v: [0.2, 0.7] }, {
    id: 'formal_pad', density: 7.85, budgets: { volume: 1e-8, mass: 1e-10, centroid: [1e-10, 1e-10, 1e-10], inertia: [1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7] },
  }).properties;
}
// The D311 baseline contains D310 walls; the completed case also proves caps/closure/mass.
// Both versions fingerprint the same actual assembled B-rep, not proof counters.
function closedReferencePad(z = -5, u = [0.125, 0.375], v = [0.25, 0.75]) {
  const solid = K.prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: z, tag: 'post' });
  const part = { solid: { kind: 'upright', solid }, brep: K.brepFromPrismatic(solid, { id: 'post' }) };
  return buildCylindricalWrapClosedReference(part, [{ outer: [[u[0], v[0]], [u[1], v[0]], [u[1], v[1]], [u[0], v[1]]], holes: [] }], {
    id: 'wrap', height: 10, density: 7.85, budgets: { volume: 1e-8, mass: 1e-10, centroid: [1e-10, 1e-10, 1e-10], inertia: [1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7] },
  }).walls.reference.native.assembly.brep;
}
function closedReferenceAsymmetricPad() { return closedReferencePad(-7, [0.1, 0.4], [0.2, 0.7]); }
// These cases time complete feature evaluation and native B-rep construction, including CUT Booleans.
// Fresh authored fixtures are prepared outside each timer; they do not measure the planner alone.
function quadraticPathCutFixture() {
  return doc([
    { id: 'stockSketch', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] },
    { id: 'stock', kind: 'extrude', sketch: 'stockSketch', height: 10 },
    { id: 'toolSketch', kind: 'sketch', profile: 'rectangle', min: [7, 6], max: [10, 11] },
    { id: 'tool', kind: 'extrude', sketch: 'toolSketch', height: 10 },
    { id: 'seed', kind: 'difference', target: 'stock', tool: 'tool' },
    { id: 'pattern', kind: 'curve-feature-pattern', target: 'seed', spacing: 10, count: 3,
      path: { degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [[0, 0, 0], [20, 0, 0], [20, 20, 0]], weights: [1, 1, 1] } },
  ]);
}
function straightPathCutFixture() {
  const input = quadraticPathCutFixture();
  input.features[input.features.length - 1].path.controlPoints[1] = [10, 10, 0];
  return input;
}
function quadraticPathCutBrep(input) { return K.outputOf(K.evaluateCadPart(input), 'pattern').brep; }
function straightPathCutBrep(input) { return K.outputOf(K.evaluateCadPart(input), 'pattern').brep; }
quadraticPathCutBrep.prepare = quadraticPathCutFixture;
straightPathCutBrep.prepare = straightPathCutFixture;
quadraticPathCutBrep.batch = straightPathCutBrep.batch = 1;
quadraticPathCutBrep.warmup = straightPathCutBrep.warmup = 3;
const CASES = {
  'quadratic-path-cut-3': quadraticPathCutBrep,
  'straight-path-cut-3': straightPathCutBrep,
  'native-cylinder-ordinary-first-mass': nativeCylinderFirstMass(5.00009),
  'native-cylinder-tiny-first-mass': nativeCylinderFirstMass(.34567890000000023 - .3456789),
  'closed-reference-asymmetric-pad': closedReferenceAsymmetricPad,
  'native-bound-asymmetric-pad': nativeBoundAsymmetricPad,
  'closed-reference-pad': closedReferencePad,
  'formal-pad-mass': formalPadMass,
  'native-bound-pad': nativeBoundPad,
  'profile-relief-emboss': () => reliefCase('emboss'),
  'profile-relief-engrave': () => reliefCase('engrave'),
  'plate-holes-24': () => { const [f, last] = plateHoles(24); return out(f, last).brep; },
  'plate-holes-48': () => { const [f, last] = plateHoles(48); return out(f, last).brep; },
  'plate-bosses-24': () => { const [f, last] = plateCyl(24, 'union'); return out(f, last).brep; },
  'plate-bosses-48': () => { const [f, last] = plateCyl(48, 'union'); return out(f, last).brep; },
  'plate-pockets-48': () => { const [f, last] = plateCyl(48, 'difference'); return out(f, last).brep; },
  'rounded-plate-bosses-12': () => { const [f, last] = roundedPlateBosses(12); return out(f, last).brep; },
  'rounded-plate-bosses-24': () => { const [f, last] = roundedPlateBosses(24); return out(f, last).brep; },
  'rounded-plate-bosses-48': () => { const [f, last] = roundedPlateBosses(48); return out(f, last).brep; },
  'tilted-boxes-48': () => { const [f, last] = boxes48(); return out(f, last).brep; },
  'tilted-boxes-24': () => { const [f, last] = boxes24(); return out(f, last).brep; },
  'tee90-edge-fillet': () => { const t = tee(90), j = out(t, 'u').brep.edges.map(e => e.name).filter(x => x && /m\.side0/.test(x) && /b\.side0/.test(x)); return out([...t, { id: 'f', kind: 'fillet', target: 'u', edges: j, radius: 2 }], 'f').brep; },
  'tee60-face-fillet': () => out([...tee(60), ff('ff', 'u', ['m.side0', 'b.side0'], 2)], 'ff').brep,
  'pin-face-fillet-over-round': () => out([...pin(), ff('f1', 'u', ['p.top', 'c.side0'], 1), ff('ff', 'f1', ['p.top', 'c.side0'], 2)], 'ff').brep,
  'shaft-thread': () => out([{ id: 'c', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 3 }, { id: 'sh', kind: 'extrude', sketch: 'c', height: 30 }, { id: 'th', kind: 'face-thread', target: 'sh', face: 'sh.side0', pitch: 1, length: 12 }], 'th').brep,
  'tapped-hole': () => out([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 30] }, { id: 'p', kind: 'extrude', sketch: 's', height: 10 }, { id: 'h', kind: 'hole', target: 'p', center: [15, 15], radius: 2.5 }, { id: 'th', kind: 'face-thread', target: 'h', face: 'h.side0', pitch: 1, diameter: 6 }], 'th').brep,
  'shaft-thread-long': () => threadBenchmark(out([{ id: 'c', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 3 }, { id: 'sh', kind: 'extrude', sketch: 'c', height: 90 }, { id: 'th', kind: 'face-thread', target: 'sh', face: 'sh.side0', pitch: 1, length: 60 }], 'th').brep),
  'tapped-hole-long': () => threadBenchmark(out([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 30] }, { id: 'p', kind: 'extrude', sketch: 's', height: 40 }, { id: 'h', kind: 'hole', target: 'p', center: [15, 15], radius: 2.5 }, { id: 'th', kind: 'face-thread', target: 'h', face: 'h.side0', pitch: 1, diameter: 6 }], 'th').brep),
  'direct-thread-long-construction': directLongThreadConstruction,
  'direct-thread-long-construction-first-mass': directLongThreadConstructionFirstMass,
  'tilted-boxes-polyhedral': () => { const [f, last] = boxes(); return out(f, last).brep; },
  'hidden-lines-tee': () => { const b = out([...tee(60), ff('ff', 'u', ['m.side0', 'b.side0'], 2)], 'ff').brep; return K.projectBrepHiddenLines([b], { toward: [1, -1, -0.6], up: [0, 0, 1] }); },
  'hidden-lines-only': () => { const b = (globalThis.__hlBrep ??= out([...tee(60), ff('ff', 'u', ['m.side0', 'b.side0'], 2)], 'ff').brep); return K.projectBrepHiddenLines([b], { toward: [1, -1, -0.6], up: [0, 0, 1] }); },
  'tee60-over-round': () => out([...tee(60), ff('f2', 'u', ['m.side0', 'b.side0'], 2), ff('ff', 'f2', ['m.side0', 'b.side0'], 4)], 'ff').brep,
};
// Shape of a result, for changes judged within tolerance: validity, counts, volume and centroid (B-rep), or the lines'
// count and total length (a projection).
const shapeOf = r => {
  if (r && r.format === 'barocss-brep') { const m = K.brepMassProperties(r, 1); return { valid: K.checkBrep(r, { strict: true }).valid, bodies: r.bodies.length, faces: r.faces.length, edges: r.edges.length, vertices: r.vertices.length, volume: m.volume, centroid: m.centroid, names: r.faces.map(f => f.name ?? '').sort().join(',') + '|' + r.edges.map(e => e.name ?? '').sort().join(',') }; }
  const pieces = r.edges.flatMap(e => e.pieces);
  return { lines: r.edges.length, pieces: pieces.length, visible: pieces.filter(p => p.visible).length, names: r.edges.map(e => e.name).sort().join(',') };
};
if (process.argv[2] === 'shape-save' || process.argv[2] === 'shape-compare') {
  const file = process.env.SHAPE ?? `${process.cwd()}/shape.json`, only = process.argv[3], res = {};
  for (const [name, fn] of Object.entries(CASES)) { if (only && !only.split(',').includes(name)) continue; const input = fn.prepare?.(); const t0 = performance.now(); res[name] = shapeOf(fn(input)); res[name].ms = Math.round(performance.now() - t0); }
  if (process.argv[2] === 'shape-save') { const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; writeFileSync(file, JSON.stringify({ ...prev, ...res }, null, 1)); console.log(JSON.stringify(res)); }
  else { const base = JSON.parse(readFileSync(file, 'utf8')); let bad = 0;
    for (const [n, r] of Object.entries(res)) { const b = base[n], why = [];
      for (const k of ['valid', 'bodies', 'faces', 'edges', 'vertices', 'lines', 'pieces', 'visible', 'names']) if (b[k] !== r[k]) why.push(`${k} ${b[k]} → ${r[k]}`);
      if (b.volume !== undefined) { const dv = Math.abs(r.volume - b.volume) / Math.abs(b.volume), dc = Math.hypot(...r.centroid.map((x, i) => x - b.centroid[i])); if (dv > 1e-7) why.push(`volume ${b.volume} → ${r.volume}`); if (dc > 1e-5) why.push(`centroid moved ${dc}`); }
      if (b.length !== undefined && Math.abs(r.length - b.length) > 1e-6 * Math.max(1, b.length)) why.push(`length ${b.length} → ${r.length}`);
      if (why.length) bad++;
      console.log(`${why.length ? 'DIFF' : 'SAME'} ${n.padEnd(28)} ${String(b.ms).padStart(7)} → ${String(r.ms).padStart(7)} ms (${(100 * (r.ms - b.ms) / b.ms).toFixed(1)}%) ${why.join('; ')}`); }
    if (bad) process.exit(1); }
  process.exit(0);
}
const [mode = 'run', only] = process.argv.slice(2), file = process.env.BASE ?? `${process.cwd()}/baseline.json`, runs = Number(process.env.RUNS ?? 3);
const res = {};
for (const [name, fn] of Object.entries(CASES)) {
  if (only && !only.split(',').includes(name)) continue;
  for (let i = 0; i < (fn.warmup ?? 0); i++) fn(fn.prepare());
  const times = []; let f = null;
  for (let i = 0; i < (name === 'tee60-over-round' ? 1 : runs); i++) { const input = fn.prepare?.(); const t0 = performance.now(); const r = fn(input); times.push(performance.now() - t0); const g = fp(r); if (f && f !== g) throw new Error(`${name}: not deterministic`); f = g; }
  const rawDuration = [...times];
  times.sort((a, b) => a - b); res[name] = { ms: Math.round(times[Math.floor(times.length / 2)]), fp: f };
  if (fn.prepare) res[name] = { ...res[name], rawDuration, median: times[Math.floor(times.length / 2)], perQuery: times[Math.floor(times.length / 2)] / fn.batch, unit: 'ms', batch: fn.batch, warmup: fn.warmup, runs: times.length };
  console.log(name.padEnd(28), String(res[name].ms).padStart(7), 'ms', f);
}
if (mode === 'save') { const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; writeFileSync(file, JSON.stringify({ ...prev, ...res }, null, 1)); }
if (mode === 'compare') { const base = JSON.parse(readFileSync(file, 'utf8')); let bad = 0;
  for (const [n, r] of Object.entries(res)) { const b = base[n]; const same = b.fp === r.fp; if (!same) bad++; console.log(`${same ? 'SAME' : 'DIFF'} ${n.padEnd(28)} ${String(b.ms).padStart(7)} → ${String(r.ms).padStart(7)} ms (${(100 * (r.ms - b.ms) / b.ms).toFixed(1)}%)`); }
  if (bad) { console.log(`${bad} result(s) changed`); process.exit(1); } }
