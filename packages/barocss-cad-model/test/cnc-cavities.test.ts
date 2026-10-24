import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { MATERIALS_DATA, checkMaterials, processProfile, type MaterialsData, type ProcessProfile } from '../src/library/materials';
import { machinability } from '../src/machining/report';
import { cavitiesOf, narrowest } from '../src/machining/cavities';

// CNC3 (O86): inside corners, cavities, small features and tall walls against closed forms — every oracle the
// construction (a pocket's depth, width and corner radius as built), with mutants: a tighter radius, a moved limit, a
// thinner rib. And the data: a value derived from a page (the drill table's steps) is marked so, its rule named.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of [...calls, ['set_material', { material: 'al6061' }] as [string, Record<string, unknown>]]) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
const milling = processProfile('cnc-milling')!;
const report = (s: ChatState, p: ProcessProfile = milling) => Object.fromEntries(machinability(s.doc, s.bodies, p).rules.map(x => [x.id, x]));
const moved = (o: Record<string, number>): ProcessProfile => ({ ...milling, thresholds: { ...milling.thresholds, ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...milling.thresholds[k], value: v }])) } });
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
// (A 120 × 80 × 12 plate with a pocket w × d, from z0 up through the top: depth 12 − z0; corners filleted r.)
const pocket = (w: number, d: number, z0: number, r: number | null) => [cmd('box', { w: 120, d: 80, h: 12, x: 0, y: 0, z: 0 }), cmd('box', { w, d, h: 20, x: 60 - w / 2, y: 40 - d / 2, z: z0 }), cmd('difference', {}, { bodies: ['b1', 'b3'] }),
  ...(r ? [cmd('fillet', { radius: r }, { edges: [0, 1, 2, 3].map(k => ({ between: [`n3.side${k}`, `n3.side${(k + 1) % 4}`] })) })] : [])];
const shell = [cmd('box', { w: 60, d: 40, h: 25, x: 0, y: 0, z: 0 }), cmd('shell', { t: 2 }, { faces: ['n1.top'] })];
const withRib = (w: number) => [...shell, cmd('box', { w, d: 36, h: 15, x: 30, y: 2, z: 2 }), cmd('union', {}, { bodies: ['b2', 'b4'] })];

test('CNC3 data: the drill table\'s steps derived from the page (W-DERIVED, their rule in the note), its sizes as printed (W-WEB); a derived value without its rule refused', () => {
  const T = milling.thresholds;
  assert.deepEqual(['drillFineStepMM', 'drillStepMM', 'drillQuarterStepMM', 'drillCoarseStepMM'].map(k => [T[k].source, /^derived: /.test(T[k].page!.note!)]), [['W-DERIVED', true], ['W-DERIVED', true], ['W-DERIVED', true], ['W-DERIVED', true]]);
  assert.deepEqual(['drillMinMM', 'drillMaxMM', 'drillFineToMM', 'drillStepToMM'].map(k => T[k].source), ['W-WEB', 'W-WEB', 'W-WEB', 'W-WEB']);
  const bad = JSON.parse(JSON.stringify(MATERIALS_DATA)) as { profiles: { id: string; thresholds: Record<string, { page: { note?: string } }> }[] };
  delete bad.profiles.find(p => p.id === 'cnc-milling')!.thresholds.drillQuarterStepMM.page.note;
  assert.deepEqual(checkMaterials(bad as unknown as MaterialsData), ['cnc-milling.drillQuarterStepMM: a derived value needs its page and its rule (the page\'s note)']);
});

test('CNC3 narrowest: a rectangle\'s width, a rotated one\'s, a disc\'s diameter — rotating calipers on the hull, against closed forms', () => {
  assert.ok(near(narrowest([[0, 0, 0], [50, 0, 0], [50, 30, 0], [0, 30, 0]], [0, 0, 1])!, 30));
  const c = Math.cos(0.3), s = Math.sin(0.3);
  assert.ok(near(narrowest([[0, 0], [50, 0], [50, 30], [0, 30]].map(([x, y]) => [c * x - s * y, s * x + c * y, 4]), [0, 0, 1])!, 30, 1e-9));
  const disc = Array.from({ length: 360 }, (_, k) => [10 * Math.cos(k * Math.PI / 180), 10 * Math.sin(k * Math.PI / 180), 0]);
  assert.ok(Math.abs(narrowest(disc, [0, 0, 1])! - 20 * Math.cos(Math.PI / 360)) <= 1e-9, 'edge to the opposite edge: 20 cos(π/360)');
});

test('CNC3 a pocket 50 × 30, 8 deep, corners r 5: four corners along the tool\'s axis, 5 ≥ ⅓ × 8 — pass; the floor 8 deep, 30 wide; the mutant r 2 (under 2.667) warned', async () => {
  let s = await build(pocket(50, 30, 4, 5));
  const cv = cavitiesOf(s.doc, s.bodies, new Set());
  assert.deepEqual(cv.corners.map(c => [c.kind, +c.radius.toFixed(9), +c.depth.toFixed(9), c.reach]), Array(4).fill(['fillet', 5, 8, true]));
  assert.deepEqual(cv.floors.map(f => [+f.depth.toFixed(9), +f.width.toFixed(9)]), [[8, 30]]);
  let r = report(s);
  assert.deepEqual(['corners', 'pocket', 'feature', 'tall', 'text'].map(id => r[id].status), ['pass', 'pass', 'pass', 'pass', 'pass']);
  assert.ok(near(r.pocket.value!, 0.267, 1e-3));
  s = await build(pocket(50, 30, 4, 2)); r = report(s);
  assert.equal(r.corners.status, 'warn'); assert.match(r.corners.message, /4 under ⅓ of its depth, r 2 on a corner 8 deep, under ⅓ of it \(2\.667\)/);
});

test('CNC3 a pocket with sharp corners: four reached along the tool\'s axis, radius 0 — warned (a rotating tool leaves its radius); its four floor edges cut sharp (the floor open to the end mill)', async () => {
  const s = await build(pocket(50, 30, 4, null)), cv = cavitiesOf(s.doc, s.bodies, new Set());
  assert.deepEqual(cv.corners.map(c => [c.kind, c.radius, +c.depth.toFixed(9), c.reach]), Array(4).fill(['sharp', 0, 8, true]));
  assert.deepEqual(cv.edges.map(e => e.kind), ['cut', 'cut', 'cut', 'cut']);
  const r = report(s);
  assert.equal(r.corners.status, 'warn'); assert.match(r.corners.message, /a sharp inside corner 8 deep \(a rotating tool leaves its radius: at least 2\.667 mm wanted\); 4 sharp edges cut sharp/);
});

test('CNC3 slots: 2 wide, 8 deep — 4 × (not over) passes, 2 mm warned as a small feature (under 2.5); 10 deep — 5 × warned; the limit moved to 6 — passes', async () => {
  let s = await build(pocket(2, 30, 4, null)), r = report(s);
  assert.equal(r.pocket.status, 'pass', r.pocket.message); assert.ok(near(r.pocket.value!, 4, 1e-9));
  assert.equal(r.feature.status, 'warn'); assert.match(r.feature.message, /the narrowest cavity 2 mm wide/);
  s = await build(pocket(2, 30, 2, null)); r = report(s);
  assert.equal(r.pocket.status, 'warn'); assert.ok(near(r.pocket.value!, 5, 1e-9));
  assert.equal(report(s, moved({ pocketDepthWidthRatio: 6 })).pocket.status, 'pass');
  assert.equal(report(s, moved({ featureMinMM: 2.2 })).feature.status, 'fail', 'under a moved feasible least');
});

test('CNC3 a shelled box (t 2) with a rib 1.2 thick, 15 high: the rib\'s height over thickness 12.5 — warned (under 4 wanted); 4 thick, 3.75 — passes; its top not a cavity (the walls 36 apart)', async () => {
  let s = await build(withRib(1.2));
  const cv = cavitiesOf(s.doc, s.bodies, new Set());
  assert.deepEqual(cv.tall.map(t => [+t.thickness.toFixed(9), +t.height!.toFixed(9)]), [[1.2, 15]]);
  assert.ok(cv.floors.every(f => f.width > 2.5), JSON.stringify(cv.floors));
  assert.ok(cv.floors.some(f => near(f.depth, 8) && near(f.width, 36)), 'the rib\'s top: 8 below the rim, the walls 36 apart');
  let r = report(s);
  assert.equal(r.tall.status, 'warn'); assert.ok(near(r.tall.value!, 12.5, 1e-3)); assert.equal(r.feature.status, 'pass');
  assert.equal(r.corners.status, 'warn', 'the shell\'s inside corners are sharp, 23 deep');
  s = await build(withRib(4)); r = report(s);
  assert.equal(r.tall.status, 'pass'); assert.ok(near(r.tall.value!, 3.75, 1e-3));
});

test('CNC3 an L bracket: its inside edge cut sharp (the base looks up), its fillet an edge fillet (not a cavity\'s corner); the base a step open at its side, no cavity', async () => {
  const L = (r: number | null) => [cmd('box', { w: 40, d: 20, h: 3, x: 0, y: 0, z: 0 }), cmd('box', { w: 3, d: 20, h: 30, x: 0, y: 0, z: 0 }), cmd('union', {}, { bodies: ['b1', 'b3'] }), ...(r ? [cmd('fillet', { radius: r }, { edges: [{ between: ['n1.top', 'n3.side1'] }] })] : [])];
  let s = await build(L(null)), cv = cavitiesOf(s.doc, s.bodies, new Set());
  assert.deepEqual([cv.corners.length, cv.edges.map(e => e.kind), cv.floors.length], [0, ['cut'], 0]);
  let r = report(s); assert.deepEqual([r.corners.status, r.pocket.status], ['pass', 'pass']); assert.match(r.pocket.message, /no cavities/);
  s = await build(L(5)); cv = cavitiesOf(s.doc, s.bodies, new Set());
  assert.deepEqual([cv.corners.length, cv.edgeFillets], [0, 1]);
  r = report(s); assert.equal(r.corners.status, 'pass'); assert.match(r.corners.message, /1 edge fillet \(not along a tool's axis\)/);
});
