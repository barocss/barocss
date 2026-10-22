import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { camPackage, type CamPackage, type Move, type SetupProgram, type StockSolid, type ToolShape } from '@barocss/cad-model/machining/camPackage';
import { CAM_OVERCUT_TOLERANCE_MM, CamHeightfield, camSetupToWorld, camToolBottom, type CamPartMesh } from '../src/viewport/camHeightfield';
import { camToolGeometry } from '../src/viewport/camToolGeometry';
import { CamOverlayGeometry, camStockBounds, camStockWire, camToWorld } from '../src/viewport/camOverlayGeometry';
import type { CamDisplay } from '../src/viewport/camDisplay';

// G23 CNC (G-R3): the material-removal preview's pure parts — the tool's profile, the setup frame's inverse, the stock's
// refusals, the height field cut by the ordered program from pristine stock, and the world-space overlay drawings.
// The oracle is the Model's own CNC8 pocket (cad-model's cam-package test): 50 × 30 and 8 deep in a 120 × 80 × 20 plate,
// fed by a flat Ø6. The field's cut area there is the pocket's 1500 mm² less at most the four corners a flat Ø6 tool
// cannot reach, 4(1 − π/4)·3², and less a boundary band no wider than the field's stated lateral uncertainty.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
const POCKET: [string, Record<string, unknown>][] = [cmd('box', { w: 120, d: 80, h: 20, x: 0, y: 0, z: 0 }), cmd('box', { w: 50, d: 30, h: 20, x: 35, y: 25, z: 12 }), ['run_command', { command: 'difference', values: {}, bodies: ['b1', 'b3'] }]];
// (A stock row written into the test document, as cad-model's test does: not rows an agent loaded.)
const withStock = (doc: StudioDoc): StudioDoc => ({ ...doc, machining: { version: 1, stock: [{ id: 'B1', kind: 'block', size: [125, 85, 25], source: 'the test\'s list' }] } } as StudioDoc);
let pocket: Promise<CamPackage> | null = null;
const pocketPackage = () => pocket ??= build(POCKET).then(s => camPackage(withStock(s.doc), s.bodies));
/** A box's 12 triangles (outward), as a part mesh. */
function boxMesh(min: number[], max: number[]): CamPartMesh {
  const positions: number[] = [];
  for (let i = 0; i < 8; i++) positions.push(i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]);
  return { positions, indices: [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5] };
}

const flat = (d = 6, flute = 3 * d): ToolShape => ({ kind: 'flat', diameterMM: d, cornerMM: 0, fluteMM: flute, shankMM: d, basis: { diameter: 'given', shape: 'given' } });
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const program = (moves: Move[], frame = IDENTITY, safe = 40): SetupProgram => ({ setup: '+Z', frame, axis: [frame[2], frame[6], frame[10]], safeZ: { mm: safe, basis: 'estimate' }, entry: { rampDeg: 3, basis: 'estimate', rule: '' }, moves, passes: [] });
const box = (min: [number, number, number], max: [number, number, number]): StockSolid => ({ kind: 'box', min, max });

test('the tool profile: flat 0 across, a ball\'s and a bull\'s nose exact; a mismatched corner or a flute shorter than the nose refused', () => {
  assert.equal(camToolBottom(flat(), 2.9), 0);
  const ball: ToolShape = { ...flat(), kind: 'ball', cornerMM: 3 };
  for (const r of [0, 1, 2, 3]) assert.ok(Math.abs(camToolBottom(ball, r) - (3 - Math.sqrt(9 - r * r))) < 1e-12, `ball at ${r}`);
  const bull: ToolShape = { ...flat(), kind: 'bull', cornerMM: 1 };
  assert.equal(camToolBottom(bull, 1.5), 0, 'a bull is flat inside its corner');
  assert.ok(Math.abs(camToolBottom(bull, 2.5) - (1 - Math.sqrt(1 - 0.25))) < 1e-12);
  assert.equal(camToolBottom(flat(), 3.01), Infinity, 'outside the tool');
  assert.throws(() => camToolBottom({ ...ball, cornerMM: 2 }, 0), /CAM_TOOL/);
  assert.throws(() => camToolBottom({ ...flat(), cornerMM: 1 }, 0), /CAM_TOOL/);
  assert.throws(() => camToolBottom({ ...ball, fluteMM: 2 }, 0), /shorter than the rounded nose/);
  // (The mesh: the flute's last ring is the full radius at the flute's length; the shank one diameter long, an estimate.)
  const g = camToolGeometry(ball);
  assert.equal(g.shankExtensionMM, 6);
  let top = 0; for (let i = 2; i < g.flute.positions.length; i += 3) top = Math.max(top, g.flute.positions[i]);
  assert.ok(Math.abs(top - 18) < 1e-6);
  assert.ok(g.angularChordMM > 0 && g.noseChordMM > 0);
});

test('the setup frame: its inverse turns machine points back exactly for every Model setup; skew and reflection refused', async () => {
  const p = await pocketPackage();
  assert.ok(p.setups.length >= 1);
  for (const s of p.setups) {
    const m = camSetupToWorld(s.frame);
    for (const mv of s.moves.slice(0, 20)) {
      const w = camToWorld(mv.a, m), back = [0, 1, 2].map(k => s.frame[k] * w[0] + s.frame[4 + k] * w[1] + s.frame[8 + k] * w[2] + s.frame[12 + k]);
      assert.ok(back.every((v, k) => Math.abs(v - mv.a[k]) < 1e-4), `${s.setup}: ${JSON.stringify(back)} for ${JSON.stringify(mv.a)}`);
    }
  }
  // (Every one of the Model's six setup directions is a signed axis permutation.)
  for (const frame of [[0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]]) assert.doesNotThrow(() => camSetupToWorld(frame));
  const c = Math.SQRT1_2;
  assert.throws(() => camSetupToWorld([c, c, 0, 0, -c, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), /CAM_FRAME/, 'a 45° turn');
  assert.throws(() => camSetupToWorld([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), /proper rotation/, 'a mirror');
  assert.throws(() => camSetupToWorld([2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), /CAM_FRAME/, 'a scale');
});

test('stock: a box and a bar along the machine Z are fields; a bar across it, a flat box, a too-coarse grid and a mismatched axis refused', () => {
  const moves: Move[] = [{ kind: 'rapid', a: [0, 0, 40], b: [10, 0, 40] }];
  assert.doesNotThrow(() => new CamHeightfield(box([-10, -10, 0], [10, 10, 10]), program(moves), flat()));
  const bar: StockSolid = { kind: 'cylinder', start: [0, 0, 0], axis: [0, 0, 1], length: 20, diameter: 30 };
  const field = new CamHeightfield(bar, program(moves), flat(), 0.5), pristine = field.evaluate(0);
  assert.equal(pristine.removedMM3, 0);
  assert.throws(() => new CamHeightfield({ ...bar, axis: [1, 0, 0] }, program(moves), flat()), /CAM_STOCK/);
  assert.throws(() => new CamHeightfield(box([0, 0, 0], [10, 0, 10]), program(moves), flat()), /CAM_STOCK/);
  assert.throws(() => new CamHeightfield(box([0, 0, 0], [1000, 1000, 10]), program(moves), flat(1)), /CAM_GRID/, 'a Ø1 tool on a 1000 mm block at the 192-cell cap');
  assert.throws(() => new CamHeightfield(box([0, 0, 0], [10, 10, 10]), { ...program(moves), axis: [0, 0, -1] }, flat()), /CAM_FRAME/);
  assert.throws(() => new CamHeightfield(box([0, 0, 0], [10, 10, 10]), program([]), flat()), /CAM_PROGRAM/);
});

test('the field cuts only feeds, plunges and ramps; a prefix rebuilds from pristine stock; a buried flute and too much work are refused', () => {
  const stock = box([0, 0, 0], [40, 40, 10]);
  const rapids = new CamHeightfield(stock, program([{ kind: 'rapid', a: [20, 20, 5], b: [30, 20, 5] }, { kind: 'retract', a: [30, 20, 5], b: [30, 20, 40] }]), flat());
  assert.equal(rapids.evaluate(2).removedMM3, 0, 'rapids and retracts never cut, even below the top');
  // (A plunge 4 deep, then a feed 20 along x: a slot 6 wide.)
  const slot = program([{ kind: 'plunge', a: [10, 20, 40], b: [10, 20, 6] }, { kind: 'feed', a: [10, 20, 6], b: [30, 20, 6] }, { kind: 'retract', a: [30, 20, 6], b: [30, 20, 40] }]);
  const field = new CamHeightfield(stock, slot, flat(), 0.5);
  const end = field.evaluate(3), half = field.evaluate(1.5), none = field.evaluate(0);
  assert.equal(none.removedMM3, 0);
  // (The slot's exact volume: 20 × 6 plus the two half-discs, 4 deep; the field takes less, by a band no wider than its uncertainty.)
  const exact = (20 * 6 + Math.PI * 9) * 4, band = (2 * 20 + 2 * Math.PI * 3) * end.lateralUncertaintyMM * 4;
  assert.ok(end.removedMM3 <= exact + 1e-6 && end.removedMM3 >= exact - band, `${end.removedMM3} in [${exact - band}, ${exact}]`);
  assert.ok(half.removedMM3 > none.removedMM3 && half.removedMM3 < end.removedMM3, 'half the feed: between');
  assert.equal(field.evaluate(1.5).removedMM3, half.removedMM3, 'scrubbing back gives the same field: it starts from pristine stock');
  assert.throws(() => field.evaluate(3.5), /CAM_PROGRESS/);
  // (A flute 2 long fed 6 under the top: the cut would be a sealed void.)
  const buried = new CamHeightfield(stock, program([{ kind: 'feed', a: [10, 20, 4], b: [30, 20, 4] }]), flat(6, 2));
  assert.throws(() => buried.evaluate(1), /CAM_BURIED/);
  // (A 0.05 mm grid on a long feed: more cutter-tip samples than the cap.)
  const long = new CamHeightfield(box([0, 0, 0], [9.6, 9.6, 10]), program(Array.from({ length: 200 }, (_, i): Move => ({ kind: 'feed', a: [0, 4.8, 8], b: [9.6, 4.8 + (i % 2) * 0.001, 8] }))), flat(6), 0.05);
  assert.throws(() => long.evaluate(200), /CAM_WORK/);
});

test('the Model\'s CNC8 pocket: the cut area, end to end, is the pocket\'s less its corners and the stated boundary band', async () => {
  const p = await pocketPackage(), s = p.setups[0];
  assert.ok('kind' in p.stock && p.stock.kind === 'box', JSON.stringify(p.stock));
  const field = new CamHeightfield(p.stock, s, p.tool, 0.5), end = field.evaluate(s.moves.length), top = p.stock.max[2];
  // (Each cut cell goes down to the floor at z 12, from the stock's top.)
  const area = end.removedMM3 / (top - 12), corners = 4 * (1 - Math.PI / 4) * 9, band = (2 * (50 + 30)) * end.lateralUncertaintyMM;
  assert.ok(area <= 1500 + 1e-6, `area ${area} > 1500`);
  assert.ok(area >= 1500 - corners - band, `area ${area} < ${1500 - corners - band}`);
  assert.ok(end.nx <= 192 && end.ny <= 192 && end.cellMM >= 0.5);
  // (The prefix only grows: removal at quarter steps never shrinks.)
  let last = -1;
  for (const q of [0, 0.25, 0.5, 0.75, 1]) { const r = field.evaluate(q * s.moves.length).removedMM3; assert.ok(r >= last - 1e-9); last = r; }
});

test('overlay drawings: world coordinates through the setup\'s inverse, identities kept while their inputs are, and cleared on null', async () => {
  const p = await pocketPackage(), s = p.setups[0], field = new CamHeightfield(p.stock as StockSolid, s, p.tool, 1);
  const display = (progress: number, removal = field.evaluate(progress)): CamDisplay => {
    const i = Math.min(Math.floor(progress), s.moves.length - 1), m = s.moves[i], f = progress >= s.moves.length ? 1 : progress - i;
    return { request: 1, packageKey: 1, package: p, setupIndex: 0, setup: s, progress, position: [0, 1, 2].map(k => m.a[k] + (m.b[k] - m.a[k]) * f) as [number, number, number], removal };
  };
  const g = new CamOverlayGeometry(), r10 = field.evaluate(10), a = g.update(display(10, r10)), b = g.update(display(10, r10));
  assert.deepEqual(a.map(d => d.name), b.map(d => d.name));
  assert.ok(a.every((d, i) => d === b[i]), 'the same display: the same drawings');
  const names = a.map(d => d.name);
  for (const n of ['stock', 'path:feed', 'remaining', 'tool:flute', 'tool:shank']) assert.ok(names.includes(n), `${n} in ${names}`);
  const c = g.update(display(20));
  assert.equal(c.find(d => d.name === 'stock'), a.find(d => d.name === 'stock'), 'the stock and whole paths stay with the setup');
  assert.notEqual(c.find(d => d.name === 'remaining'), a.find(d => d.name === 'remaining'), 'a new removal: a new remaining-stock drawing');
  assert.notEqual(c.find(d => d.name === 'tool:flute'), a.find(d => d.name === 'tool:flute'), 'a new pose: the tool moved');
  // (The tool's tip is where the program is, in world coordinates: its lowest point.)
  const flute = c.find(d => d.name === 'tool:flute')!, at = display(20).position, world = camToWorld(at, camSetupToWorld(s.frame));
  let low = Infinity; for (let i = 2; i < flute.positions.length; i += 3) low = Math.min(low, flute.positions[i]);
  assert.ok(Math.abs(low - world[2]) < 1e-4, `tip ${low} vs ${world[2]}`);
  // (The stock wire is the Model's box; its bounds frame the camera.)
  const wire = camStockWire(p.stock as StockSolid), bounds = camStockBounds(p.stock as StockSolid);
  for (let i = 0; i < wire.length; i += 3) for (let k = 0; k < 3; k++) assert.ok(wire[i + k] >= bounds.min[k] - 1e-6 && wire[i + k] <= bounds.max[k] + 1e-6);
  assert.deepEqual(g.update(null), []);
  const refused = { ...p, stock: { refused: { code: 'STOCK_NONE_LOADED', message: 'none loaded' } } } as CamPackage;
  assert.throws(() => g.update({ ...display(1), package: refused }), /STOCK_NONE_LOADED/, 'a refusal is shown, never the part\'s box in its place');
});

test('overcut: a slot through a solid part is overcut by all it removes; one reaching a part\'s top is not; one ending in a part is, in part', async () => {
  // (The same slot as above, through a part that is the whole stock: every cut is into the part.)
  const stock = box([0, 0, 0], [40, 40, 10]);
  const slot = program([{ kind: 'plunge', a: [10, 20, 40], b: [10, 20, 6] }, { kind: 'feed', a: [10, 20, 6], b: [30, 20, 6] }, { kind: 'retract', a: [30, 20, 6], b: [30, 20, 40] }]);
  const solid = new CamHeightfield(stock, slot, flat(), 0.5, [boxMesh([0, 0, 0], [40, 40, 10])]).evaluate(3);
  assert.ok(solid.overcutCells > 0);
  assert.ok(Math.abs(solid.overcutMM3 - solid.removedMM3) < 1e-6, `${solid.overcutMM3} vs ${solid.removedMM3}`);
  // (A part whose top is the slot's floor, 6: the slot only reaches it — within the tolerance, not overcut.)
  const floor = new CamHeightfield(stock, slot, flat(), 0.5, [boxMesh([0, 0, 0], [40, 40, 6 - CAM_OVERCUT_TOLERANCE_MM / 2])]).evaluate(3);
  assert.equal(floor.overcutCells, 0);
  // (A part 2 under the stock's top beside the slot only, x 32 to 40: the slot ends at x 33, so the tool's end enters it.)
  const beside = new CamHeightfield(stock, slot, flat(), 0.5, [boxMesh([32, 0, 0], [40, 40, 8])]).evaluate(3);
  assert.ok(beside.overcutCells > 0 && beside.overcutMM3 < solid.overcutMM3);
});
