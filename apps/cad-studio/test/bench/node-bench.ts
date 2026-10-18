// Representative evaluation costs, best of several runs, each against a budget: about twice the time
// measured when the budget was set (PERF3 D18, 2026-10-18, Apple M-series, Node 22; sub-millisecond
// rows have a 1 ms floor), so noise passes and a real regression (a lost cache, a quadratic loop) fails. Run: pnpm bench (BENCH_JSON=1 for machine output).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brepMassProperties, checkSpurGearPair, evaluateCadPart, exportStep, extrudeFaces, facetBoolean, facetBrepFromTriangles, splitFacetBrep, stepMeshes, subdBrep, tessellateBrep, type CadPartDocument } from '@barocss/cad';
import { boxCage } from '../../src/app/primitives';
import { evaluateDoc } from '../../src/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '../../src/engine/doc';
import { directDisplay, emptyDirect, importSource, movePole } from '../../src/engine/direct';
import { projectViews } from '../../src/drawing/project';
import { checkSpec, type Requirement } from '../../src/chat/spec';
import { withLook } from '../../src/app/bodies';
import { emptyDoc } from '../../src/engine/doc';
import { faceTableOf } from '../../src/assembly/faces';
import { searchOrientation } from '../../src/print/orient';
import { printability } from '../../src/print/rules';
import { write3mf } from '../../src/print/threemf';
import { toPartDocument } from '../../src/engine/part';
import { commands, type Ctx } from '../../src/app/commands';
import { checkFits, libraryById } from '../../src/library/libraries';
import { faceRuns, paintFaces, type ColorTarget, type Painted } from '../../src/viewport/facePaint';
import { fillVertexColors, nearestSegment, prepareGeometry, vertexColors } from '../../../../packages/barocss-gpu/src/viewer/geometry';
import { lookAt, multiply, perspectiveReversed } from '../../../../packages/barocss-gpu/src/viewer/math';

interface Scenario { name: string; budgetMS: number; runs: number; setup(): () => unknown }
const D = (features: unknown[]): CadPartDocument => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features } as unknown as CadPartDocument);
const root = join(import.meta.dirname, '..', '..');

/** A 100 × 40 × 12 plate with ten cross holes and six holes down (all curved Booleans). */
function holePlate(width: number): StudioDoc {
  let doc = rectanglePart(width, 40, 12);
  for (let k = 0; k < 10; k++) doc = withNode(doc, { kind: 'hole', parent: { node: doc.nodes.length - 1, side: 'solid' }, center: [11 + 8 * k, 6], radius: 2, axis: 'y' });
  for (let k = 0; k < 6; k++) doc = withNode(doc, { kind: 'hole', parent: { node: doc.nodes.length - 1, side: 'solid' }, center: [15 + 14 * k, 30], radius: 3 });
  return doc;
}
/** A plate with 20 features on it: holes down, a row of them, chamfers by name. */
function chain20(): StudioDoc {
  let doc = rectanglePart(120, 60, 10);
  for (let k = 0; k < 18; k++) doc = withNode(doc, { kind: 'hole', parent: { node: doc.nodes.length - 1, side: 'solid' }, center: [8 + 6 * k, 15 + (k % 3) * 15], radius: 1.5 });
  return doc;
}

/** The 16-hole plate printed in ABS on FDM, standing up Z, with eight requirements (bbox, volume, mass, wall, overhang, three print rules). */
function printedPlate(width: number): StudioDoc {
  const plate = holePlate(width), first = evaluateDoc(plate, 1);
  let doc: StudioDoc = { ...plate, process: 'fdm', printer: 'fdm-256', print: { direction: [0, 0, 1] } };
  if (first.ok) doc = withLook(doc, first.bodies[0], { material: 'abs' });
  const q = (id: string, query: Requirement['check']['query'], op: '<=' | '>=', value: number): Requirement => ({ id, source: id, hard: false, basis: 'stated', check: { op, query, value } } as Requirement);
  return { ...doc, requirements: [q('R1', { fn: 'bbox', axis: 'x' }, '<=', 200), q('R2', { fn: 'volume' }, '>=', 1), q('R3', { fn: 'mass' }, '<=', 500), q('R4', { fn: 'min_wall' }, '>=', 0.8),
    q('R5', { fn: 'overhang_area' }, '<=', 1e6), q('R6', { fn: 'print_rule', rule: 'wall' }, '>=', 0.8), q('R7', { fn: 'print_rule', rule: 'tip' }, '<=', 10), q('R8', { fn: 'print_rule', rule: 'overhang' }, '<=', 1e6)] };
}
/** A bumpy sphere of n × n quads with welded poles (about 2n² triangles), as the AM4 and AM5 tests make it. */
function bumpSphere(n: number): { positions: number[]; indices: number[] } {
  const P: number[] = [0, 0, 20], I: number[] = [];
  for (let i = 1; i < n; i++) for (let j = 0; j < n; j++) { const th = Math.PI * i / n, ph = 2 * Math.PI * j / n, r = 20 + 2 * Math.sin(5 * th) * Math.cos(3 * ph); P.push(r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)); }
  P.push(0, 0, -20);
  const at = (i: number, j: number) => i === 0 ? 0 : i === n ? 1 + (n - 1) * n : 1 + (i - 1) * n + (j % n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1); if (i > 0) I.push(a, b, d); if (i < n - 1) I.push(b, c, d); }
  return { positions: P, indices: I };
}
/** A plain torus mesh of n × m quads (2nm triangles), as the facet-split and facet-boolean tests make it. */
function torusMesh(R: number, r: number, n: number, m: number): { positions: number[]; indices: number[] } {
  const P: number[] = [], I: number[] = [], at = (i: number, j: number) => (i % n) * m + (j % m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m; P.push((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)); }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) I.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
  return { positions: P, indices: I };
}
const commandCtx: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const GEAR1 = { moduleMM: 2, teeth: 20, faceWidthMM: 10 }, GEAR2 = { moduleMM: 2, teeth: 40, faceWidthMM: 10 };
let uuidSeq = 0;
const benchUuid = () => `00000000-0000-4000-8000-${(++uuidSeq).toString(16).padStart(12, '0')}`;
const scenarios: Scenario[] = [
  { name: 'evaluate: 16-hole plate (cold)', budgetMS: 2800, runs: 3, setup() { let k = 0; return () => evaluateDoc(holePlate(100 + 1e-3 * ++k), k); } },
  { name: 'tessellate: 12-edge filleted box', budgetMS: 70, runs: 5, setup() {
    const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
    const edges = evaluateCadPart(D(box)).outputs[0].brep.edges.map(e => e.name);
    const brep = evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges, radius: 2 }])).outputs[0].brep;
    return () => tessellateBrep(brep, { segmentsPerQuarter: 8 });
  } },
  { name: 'mass: 12-edge filleted box', budgetMS: 800, runs: 3, setup() {
    const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
    const edges = evaluateCadPart(D(box)).outputs[0].brep.edges.map(e => e.name);
    const brep = evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges, radius: 2 }])).outputs[0].brep;
    return () => brepMassProperties(brep, 1);
  } },
  { name: 'evaluate: 20-feature chain, unchanged', budgetMS: 1, runs: 10, setup() { const doc = chain20(); evaluateDoc(doc, 1); let k = 1; return () => evaluateDoc(doc, ++k); } },
  { name: 'evaluate: stepped body patterned × 12', budgetMS: 1400, runs: 3, setup() {
    const f: unknown[] = [];
    for (let k = 0; k < 6; k++) f.push({ id: `s${k}`, kind: 'sketch', profile: 'circle', center: [5, 5], radius: 5 - k * 0.6 }, { id: `e${k}`, kind: 'extrude', sketch: `s${k}`, height: 2, ...(k ? { from: 2 * k } : {}) });
    for (let k = 1; k < 6; k++) f.push({ id: `u${k}`, kind: 'union', target: k === 1 ? 'e0' : `u${k - 1}`, tool: `e${k}` });
    let r = 30;
    return () => evaluateCadPart(D([...f, { id: 'p', kind: 'circular-pattern', target: 'u5', axis: 'z', angleDegrees: 30, count: 12, pivot: [r += 1e-3, 5, 0] }]));
  } },
  { name: 'drawing: 120-hole plate, 4 views (cold)', budgetMS: 2600, runs: 3, setup() {
    // (A fresh part each run: a drawing's tessellation is cached with its B-rep.)
    const plates = Array.from({ length: 4 }, (_, k) => {
      const f: unknown[] = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [240 + k * 1e-3, 120] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
      let t = 'e'; for (let i = 0; i < 12; i++) for (let j = 0; j < 10; j++) { const id = `h${i}_${j}`; f.push({ id, kind: 'hole', target: t, center: [10 + 20 * i, 6 + 12 * j], radius: 2 }); t = id; }
      return evaluateCadPart(D(f)).outputs[0].brep;
    });
    let k = 0; return () => projectViews([plates[k++]]);
  } },
  // (PERF3 A1: the requirement checks run after every edit, on the main thread.)
  { name: 'check_spec: 8 requirements after an edit', budgetMS: 50, runs: 3, setup() {
    // (Each run a fresh document, as after an edit; its evaluation done here, outside the time.)
    const ready = Array.from({ length: 4 }, (_, k) => { const doc = printedPlate(100 + 1e-3 * (k + 1)), r = evaluateDoc(doc, k + 1); if (!r.ok) throw new Error('eval'); return { doc, bodies: r.bodies }; });
    let k = 0;
    return () => { const { doc, bodies } = ready[k++ % ready.length]; return checkSpec(doc, bodies, async d => evaluateDoc(d, 1)); };
  } },
  // (PERF3 A4: SubD builds — cold, each run the cage shifted; a drag, one vertex moved away from every irregular one.)
  { name: 'subd: box cage build (cold)', budgetMS: 150, runs: 5, setup() { const c = boxCage(30, 20, 16, 1, [0, 0, 0]); let k = 0; return () => subdBrep({ ...c, positions: c.positions.map((x, i) => i % 3 ? x : x + 1e-3 * ++k) }); } },
  { name: 'subd: 6-a-side box, 4 bumps (cold)', budgetMS: 900, runs: 3, setup() {
    let c: { positions: readonly number[]; faces: readonly (readonly number[])[] } = boxCage(30, 20, 16, 6, [0, 0, 0]); for (const f of [3, 9, 14, 20]) c = extrudeFaces(c, [f + 180], 2).cage;
    let k = 0; return () => subdBrep({ ...c, positions: c.positions.map((x, i) => i % 3 ? x : x + 1e-3 * ++k) });
  } },
  { name: 'subd: ~2k-face cage, one vertex moved', budgetMS: 60, runs: 5, setup() {
    const c = boxCage(30, 20, 16, 18, [0, 0, 0]), v = Math.floor(c.positions.length / 6); subdBrep(c); let k = 0;
    return () => { const p = [...c.positions]; p[3 * v + 2] += 0.01 * ++k; return subdBrep({ ...c, positions: p }); };
  } },
  { name: 'tessellate: SubD box', budgetMS: 60, runs: 5, setup() { const b = subdBrep(boxCage(30, 20, 16, 1, [0, 0, 0])); return () => tessellateBrep(b, { segmentsPerQuarter: 8 }); } },
  // (PERF3 A5: the D79 split rounds tessellate again only the faces next to a split edge.)
  { name: 'tessellate: SubD body of a ~2k-face cage', budgetMS: 2000, runs: 2, setup() { const b = subdBrep(boxCage(30, 20, 16, 18, [0, 0, 0])); return () => tessellateBrep(b, { segmentsPerQuarter: 8 }); } },
  // (PERF3 D19: AM4 orientation search on a 100k-triangle facet body; AM3 printability of the 16-hole plate after an
  // edit (fresh bodies each run, so the wall thickness kept per mesh is not reused); AM5 3MF of 200k triangles.)
  { name: 'print: orientation search, 100k triangles', budgetMS: 1200, runs: 3, setup() {
    const m = bumpSphere(224), doc = withNode(emptyDoc(), { kind: 'mesh', name: 'bump', unit: 'mm', positions: m.positions, indices: m.indices, representation: 'facets' } as never);
    const r = evaluateDoc(doc, 1); if (!r.ok) throw new Error('eval');
    const mesh = r.bodies[0].mesh, table = faceTableOf(doc);
    return () => searchOrientation(mesh, table, 45);
  } },
  { name: 'print: printability, 16-hole plate', budgetMS: 45, runs: 3, setup() {
    const ready = Array.from({ length: 4 }, (_, k) => { const doc = printedPlate(100 + 2e-3 * (k + 1)), r = evaluateDoc(doc, k + 1); if (!r.ok) throw new Error('eval'); return { doc, bodies: r.bodies }; });
    let k = 0;
    return () => { const { doc, bodies } = ready[k++ % ready.length]; return printability(doc, bodies, async d => evaluateDoc(d, 1)); };
  } },
  { name: 'print: 3MF of 200k triangles', budgetMS: 800, runs: 2, setup() {
    const m = bumpSphere(317), date = new Date(2026, 9, 18, 12, 0, 0);
    return async () => { const r = await write3mf({ title: 'bump', objects: [{ name: 'bump', positions: m.positions, indices: m.indices, material: 'PLA', color: '#888' }], items: [{ object: 0 }], uuid: benchUuid, date }); if (!('bytes' in r)) throw new Error(r.error); return r; };
  } },
  // (PERF3 D19: masses as the body card gets them — the output's massProperties, which evaluateDoc keeps per B-rep, so
  // each run a B-rep of its own; the plate's curved holes and the SubD torus's B-spline faces both by quadrature.)
  { name: 'mass: 16-hole plate', budgetMS: 650, runs: 3, setup() {
    const outs = Array.from({ length: 4 }, (_, k) => evaluateCadPart(toPartDocument(holePlate(100 + 3e-3 * (k + 1)))).outputs[0]);
    let k = 0; return () => outs[k++ % outs.length].massProperties(2700);
  } },
  { name: 'mass: SubD torus, 2,048 quads', budgetMS: 70, runs: 3, setup() {
    const cmd = commands.find(c => c.id === 'subd-torus')!;
    const outs = Array.from({ length: 4 }, (_, k) => evaluateCadPart(toPartDocument(cmd.build!(commandCtx, { ...cmd.defaults!(commandCtx), R: 20, r: 6, nu: 64, nv: 32, x: 1e-3 * k, y: 0, z: 0 }))).outputs[0]);
    let k = 0; return () => outs[k++ % outs.length].massProperties(2700);
  } },
  // (Gears, R6a: the pair check keeps its last 64 answers by its arguments, so each run a face width of its own, which the
  // 2D sweep does not read. The verdict on a clear pair, and the report on a pair that interferes, its costliest case.)
  { name: 'gear: verdict, clear pair (m2, 20/40)', budgetMS: 450, runs: 3, setup() { let k = 0; return () => checkSpurGearPair(GEAR1, { ...GEAR2, faceWidthMM: 10 + 1e-6 * ++k }, { mode: 'verdict' }); } },
  { name: 'gear: report, interfering pair (a 59.8)', budgetMS: 11500, runs: 1, setup() { let k = 0; return () => checkSpurGearPair(GEAR1, { ...GEAR2, faceWidthMM: 10 + 1e-6 * ++k }, { centerDistanceMM: 59.8, mode: 'report' }); } },
  // (LIB2: every declared fit of the T-slot library built, placed and its overlap measured.)
  { name: 'library: tslot-20 fits (all)', budgetMS: 250, runs: 3, setup() { const lib = libraryById('tslot-20')!; return () => checkFits(lib); } },
  // (A tessellated STEP of 200k triangles read as the studio's worker reads it; F1 split and F2 hole on facet bodies,
  // a facet B-rep of its own each run: the kernel keeps per-B-rep indexes.)
  { name: 'step: tessellated read, 200k triangles', budgetMS: 300, runs: 3, setup() {
    const m = torusMesh(20, 5, 400, 250), text = exportStep([facetBrepFromTriangles(m.positions, m.indices, { id: 'm' })], { name: 'torus', meshes: 'tessellated' });
    return () => stepMeshes(text);
  } },
  { name: 'facet: F1 split, 200k triangles', budgetMS: 380, runs: 3, setup() {
    const m = torusMesh(20, 5, 400, 250), breps = Array.from({ length: 4 }, (_, k) => facetBrepFromTriangles(m.positions, m.indices, { id: `m${k}` }));
    let k = 0; return () => splitFacetBrep(breps[k++ % breps.length], { normal: [0, 0, 1], offset: 1, at: 'c' });
  } },
  { name: 'facet: F2 hole, 20k triangles', budgetMS: 1100, runs: 3, setup() {
    const m = torusMesh(20, 6, 100, 100), breps = Array.from({ length: 4 }, (_, k) => facetBrepFromTriangles(m.positions, m.indices, { id: `m${k}` }));
    const tool = evaluateCadPart(D([{ id: 's', kind: 'sketch', profile: 'circle', center: [20, 0.37], radius: 2 }, { id: 'c', kind: 'extrude', sketch: 's', height: 30, from: -15 }])).outputs[0].brep;
    let k = 0; return () => facetBoolean(breps[k++ % breps.length], tool, 'difference', { id: 'r' });
  } },
  // (PERF3 B7: a hover over the 120-hole plate's faces, as the GPU renderer paints it — only the faces whose state
  // changed, through the viewer geometry's own colour conversion; the upload is not timed here. The whole repaint
  // it replaces took 0.44 ms a hover, 4.4 ms for these ten.)
  { name: 'viewport: 10 hovers repainted, 120-hole plate', budgetMS: 1, runs: 20, setup() {
    let plate = rectanglePart(240, 120, 10);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 10; j++) plate = withNode(plate, { kind: 'hole', parent: { node: plate.nodes.length - 1, side: 'solid' }, center: [10 + 20 * i, 6 + 12 * j], radius: 2 });
    const r = evaluateDoc(plate, 1); if (!r.ok) throw new Error('eval');
    const m = r.bodies[0].mesh, nv = m.positions.length / 3, runs = faceRuns(m.faceOfVertex), faces = [...runs.byFace.keys()], shade: [number, number, number][] = [[0.74, 0.75, 0.78], [0.77, 0.75, 0.69], [0.81, 0.75, 0.6]];
    let bytes = vertexColors(undefined, nv);
    const target: ColorTarget = { setColors(c) { bytes = vertexColors(c, nv); }, fillColors(first, count, c) { fillVertexColors(bytes, first, count, c); } };
    let p: Painted = paintFaces(target, runs, null, 'k', new Map(), shade, new Map()), k = 0;
    return () => { for (let i = 0; i < 10; i++) p = paintFaces(target, runs, p, 'k', new Map([[faces[k++ % faces.length], 1]]), shade, new Map()); return p; };
  } },
  // (PERF3 B8: the edge pick of a hover, the viewer's pickLine, on the 120-hole plate's 7 692 edge segments seen from
  // above at an angle: 100 points across the canvas. The walk over every segment it replaces took 27 ms for them.)
  { name: 'viewport: 100 edge picks, 120-hole plate', budgetMS: 1, runs: 10, setup() {
    let plate = rectanglePart(240, 120, 10);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 10; j++) plate = withNode(plate, { kind: 'hole', parent: { node: plate.nodes.length - 1, side: 'solid' }, center: [10 + 20 * i, 6 + 12 * j], radius: 2 });
    const r = evaluateDoc(plate, 1); if (!r.ok) throw new Error('eval');
    const g = prepareGeometry({ positions: r.bodies[0].mesh.edgeLines, topology: 'lines' }), cw = 1400, ch = 860;
    const M = multiply(perspectiveReversed(Math.PI / 4, cw / ch, 0.1), lookAt([390, -150, 270], [120, 60, 5], [0, 0, 1]));
    nearestSegment(g, M, 0, 0, cw, ch, 6);
    return () => { let hits = 0; for (let k = 0; k < 100; k++) if (nearestSegment(g, M, 300 + 8 * k, 200 + 4.5 * k, cw, ch, 6)) hits++; return hits; };
  } },
  { name: 'direct: pole-drag step (warped sheet)', budgetMS: 10, runs: 20, setup() {
    let d = importSource(emptyDirect(), readFileSync(join(root, 'test/fixtures/warp.barocad'), 'utf8'), 'warp');
    const sheet = d.objects[0].id; directDisplay(d); let k = 0;
    return () => { d = movePole(d, sheet, '1,1', [110, 6.67, 6 + 0.01 * ++k]); return directDisplay(d); };
  } },
];

const rows: { name: string; ms: number; budgetMS: number; ok: boolean }[] = [];
for (const s of scenarios) {
  const run = s.setup(); await run();
  let best = Infinity;
  for (let i = 0; i < s.runs; i++) { const t0 = performance.now(); await run(); best = Math.min(best, performance.now() - t0); }
  rows.push({ name: s.name, ms: +best.toFixed(2), budgetMS: s.budgetMS, ok: best <= s.budgetMS });
}
if (process.env.BENCH_JSON) console.log(JSON.stringify(rows));
else for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'SLOW'} ${r.name.padEnd(42)} ${String(r.ms).padStart(9)} ms  (budget ${r.budgetMS} ms)`);
process.exitCode = rows.every(r => r.ok) ? 0 : 1;
