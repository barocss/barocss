// Representative evaluation costs, best of several runs, each against a budget: a few times the time
// measured when the budget was set (2026-10-17, Apple M-series, Node 22), so noise passes and a real
// regression (a lost cache, a quadratic loop) fails. Run: pnpm bench (BENCH_JSON=1 for machine output).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brepMassProperties, evaluateCadPart, extrudeFaces, subdBrep, tessellateBrep, type CadPartDocument } from '@barocss/cad';
import { boxCage } from '../../src/app/primitives';
import { evaluateDoc } from '../../src/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '../../src/engine/doc';
import { directDisplay, emptyDirect, importSource, movePole } from '../../src/engine/direct';
import { projectViews } from '../../src/drawing/project';
import { checkSpec, type Requirement } from '../../src/chat/spec';
import { withLook } from '../../src/app/bodies';

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
const scenarios: Scenario[] = [
  { name: 'evaluate: 16-hole plate (cold)', budgetMS: 3000, runs: 3, setup() { let k = 0; return () => evaluateDoc(holePlate(100 + 1e-3 * ++k), k); } },
  { name: 'tessellate: 12-edge filleted box', budgetMS: 120, runs: 5, setup() {
    const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
    const edges = evaluateCadPart(D(box)).outputs[0].brep.edges.map(e => e.name);
    const brep = evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges, radius: 2 }])).outputs[0].brep;
    return () => tessellateBrep(brep, { segmentsPerQuarter: 8 });
  } },
  { name: 'mass: 12-edge filleted box', budgetMS: 900, runs: 3, setup() {
    const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
    const edges = evaluateCadPart(D(box)).outputs[0].brep.edges.map(e => e.name);
    const brep = evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges, radius: 2 }])).outputs[0].brep;
    return () => brepMassProperties(brep, 1);
  } },
  { name: 'evaluate: 20-feature chain, unchanged', budgetMS: 10, runs: 10, setup() { const doc = chain20(); evaluateDoc(doc, 1); let k = 1; return () => evaluateDoc(doc, ++k); } },
  { name: 'evaluate: stepped body patterned × 12', budgetMS: 1500, runs: 3, setup() {
    const f: unknown[] = [];
    for (let k = 0; k < 6; k++) f.push({ id: `s${k}`, kind: 'sketch', profile: 'circle', center: [5, 5], radius: 5 - k * 0.6 }, { id: `e${k}`, kind: 'extrude', sketch: `s${k}`, height: 2, ...(k ? { from: 2 * k } : {}) });
    for (let k = 1; k < 6; k++) f.push({ id: `u${k}`, kind: 'union', target: k === 1 ? 'e0' : `u${k - 1}`, tool: `e${k}` });
    let r = 30;
    return () => evaluateCadPart(D([...f, { id: 'p', kind: 'circular-pattern', target: 'u5', axis: 'z', angleDegrees: 30, count: 12, pivot: [r += 1e-3, 5, 0] }]));
  } },
  { name: 'drawing: 120-hole plate, 4 views (cold)', budgetMS: 4000, runs: 3, setup() {
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
  { name: 'direct: pole-drag step (warped sheet)', budgetMS: 20, runs: 20, setup() {
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
