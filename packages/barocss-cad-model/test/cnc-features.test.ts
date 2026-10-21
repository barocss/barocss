import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { processProfile } from '../src/library/materials';
import { machinability } from '../src/machining/report';
import { featuresOf, type Feature } from '../src/machining/features';

// CNC7a (O101): machining features recognised, against the construction — O100's plate (a pocket, a through slot, an
// edge step the slot runs through, a through and a blind hole, a boss), a counterbored and a tapped hole, a pocket cut
// from the side; and mutants: the pocket run out through an edge (a slot, then a step), its corners filleted (still a
// pocket of the same size), the boss taken away.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
const diff = (a: string, b: string): [string, Record<string, unknown>] => ['run_command', { command: 'difference', values: {}, bodies: [a, b] }];
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
const PLATE = (pocket = { w: 30, x: 10 }, boss = true): [string, Record<string, unknown>][] => [
  cmd('box', { w: 120, d: 80, h: 20, x: 0, y: 0, z: 0 }),
  cmd('box', { w: pocket.w, d: 20, h: 20, x: pocket.x, y: 10, z: 12 }), diff('b1', 'b3'),
  cmd('box', { w: 10, d: 100, h: 20, x: 60, y: -10, z: 14 }), diff('b4', 'b6'),
  cmd('box', { w: 140, d: 15, h: 20, x: -10, y: 65, z: 15 }), diff('b7', 'b9'),
  cmd('hole', { d: 6.6, x: 90, y: 20 }, { faces: ['n1.top'] }),
  cmd('hole', { type: 'blind', d: 5, depth: 10, x: 100, y: 40 }, { faces: ['n1.top'] }),
  ...(boss ? [cmd('cylinder', { r: 6, h: 8, x: 30, y: 50, z: 20 }), ['run_command', { command: 'union', values: {}, bodies: ['b12', 'b14'] }] as [string, Record<string, unknown>]] : []),
];
const brief = (f: Feature) => [f.id, f.setups.join(','), f.depthMM, f.widthMM ?? null, f.lengthMM ?? null, f.diameterMM ?? null, f.through ?? null];

test('CNC7a O100\'s plate: one of each feature, every size the construction\'s — the pocket 30 × 20 × 8, the slot 10 wide 80 long 6 deep, the step 15 wide 120 long 5 deep (one feature, two floors, from +Z and +Y), Ø6.6 through 20 from ±Z, Ø5 blind 10 from +Z, the boss Ø12 × 8', async () => {
  const s = await build(PLATE()), fs = featuresOf(s.doc, s.bodies);
  assert.deepEqual(fs.map(brief), [
    ['pocket1', '+Z', 8, 20, 30, null, null],
    ['slot1', '+Z', 6, 10, 80, null, null],
    // (The step from +Z, and from +Y by its riser — one feature reachable from both, its shallower reading kept.)
    ['step1', '+Y,+Z', 5, 15, 120, null, null],
    ['hole1', '+Z,−Z', 20, null, null, 6.6, true],
    ['hole2', '+Z', 10, null, null, 5, false],
    ['boss1', '+Z', 8, null, null, 12, null],
  ]);
  assert.deepEqual(fs.find(f => f.kind === 'step')!.faces, ['n9.bottom'], 'its two floors one face name');
  const r = machinability(s.doc, s.bodies, processProfile('cnc-milling')!), rule = r.rules.find(x => x.id === 'features')!;
  assert.equal(rule.message, '1 pocket, 1 slot, 1 step, 2 holes, 1 boss recognised, each with its setup'); assert.equal(r.machining!.features!.length, 6);
});

test('CNC7a mutants on the plate: the pocket run out through the near edge — a slot; its corners filleted r 5 — still a pocket 30 × 20 × 8; the boss taken away — none', async () => {
  let fs = featuresOf((await build(PLATE({ w: 30, x: -10 }))).doc, (await build(PLATE({ w: 30, x: -10 }))).bodies);
  assert.deepEqual(fs.filter(f => ['pocket', 'slot'].includes(f.kind)).map(f => f.kind).sort(), ['slot', 'slot'], 'run out through x = 0: walled across only');
  const filleted = [...PLATE(), cmd('fillet', { radius: 5 }, { edges: [0, 1, 2, 3].map(k => ({ between: [`n3.side${k}`, `n3.side${(k + 1) % 4}`] })) })] as [string, Record<string, unknown>][];
  const s = await build(filleted);
  fs = featuresOf(s.doc, s.bodies);
  assert.deepEqual(fs.filter(f => f.kind === 'pocket').map(brief), [['pocket1', '+Z', 8, 20, 30, null, null]]);
  const nb = await build(PLATE(undefined, false));
  assert.equal(featuresOf(nb.doc, nb.bodies).filter(f => f.kind === 'boss').length, 0);
});

test('CNC7a holes: a counterbored Ø6.6 through 20 (Ø11 × 6), an M6 tapped blind 12 — their counterbore and thread on the feature', async () => {
  const s = await build([cmd('box', { w: 60, d: 40, h: 20, x: 0, y: 0, z: 0 }), cmd('hole', { type: 'counterbore', d: 6.6, cd: 11, ch: 6, x: 15, y: 20 }, { faces: ['n1.top'] }),
    cmd('hole', { type: 'tapped', thread: 'M6', tend: 'blind', depth: 12, x: 45, y: 20 }, { faces: ['n1.top'] })]);
  const hs = featuresOf(s.doc, s.bodies).filter(f => f.kind === 'hole').map(f => [f.diameterMM, f.depthMM, f.through, f.counterbore ?? null, f.thread ?? null]);
  assert.deepEqual(hs, [[6.6, 20, true, { diameterMM: 11, depthMM: 6 }, null], [5, 12, false, null, 'M6×1']]);
});

test('CNC7a a pocket cut into the side: its floor faces −Y — the −Y setup reaches it, 10 deep', async () => {
  const s = await build([cmd('box', { w: 60, d: 40, h: 30, x: 0, y: 0, z: 0 }), cmd('box', { w: 20, d: 20, h: 10, x: 20, y: -10, z: 10 }), diff('b1', 'b3')]);
  const p = featuresOf(s.doc, s.bodies).filter(f => f.kind === 'pocket');
  assert.deepEqual(p.map(brief), [['pocket1', '−Y', 10, 10, 20, null, null]]);
});
