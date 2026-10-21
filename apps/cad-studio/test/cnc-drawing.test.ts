import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { runDrawingTool } from '../src/chat/drawing';
import { defaultDrawing, type DrawingSettings } from '../src/drawing/types';
import { processProfile } from '@barocss/cad-model/library/materials';
import { machinability } from '../src/machining/report';
import { DRAWING_PAGES, drawingCheck } from '../src/machining/drawing';

// CNC5 (O88): the drawing a machined part goes with, on the studio's own (R14): needed (threads go on a drawing; with
// neither threads nor tolerances the standard ±0.125 holds), and on it each item a shop needs — every item's oracle the
// sheet as built, every one a mutant: the drawing made complete, then each item taken away in turn, only it warned.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of [...calls, ['set_material', { material: 'al6061' }] as [string, Record<string, unknown>]]) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
const milling = processProfile('cnc-milling')!;
const plate = [cmd('box', { w: 60, d: 40, h: 20, x: 0, y: 0, z: 0 }), cmd('hole', { type: 'tapped', thread: 'M6', tend: 'blind', depth: 12, x: 45, y: 20 }, { faces: ['n1.top'] })];
const status = (doc: StudioDoc, bodies: ChatState['bodies']) => Object.fromEntries(drawingCheck(doc, bodies).items.map(x => [x.id, x.status]));
const withDrawing = (doc: StudioDoc, d: Partial<DrawingSettings>): StudioDoc => ({ ...doc, drawing: { ...(doc.drawing ?? defaultDrawing()), ...d } });
const NOTES = [{ id: 'g', text: 'UNLESS OTHERWISE STATED: LINEAR ±0.2 · ANGULAR ±0.5°', at: [20, 20] as [number, number] }, { id: 'm', text: 'MATERIAL: ALUMINIUM 6061', at: [20, 30] as [number, number] }];

test('CNC5 the pages: every drawing item names its page — https, read 2026-10-21, the page\'s own words', () => {
  for (const [k, p] of Object.entries(DRAWING_PAGES)) assert.ok(/^https:\/\/www\.hubs\.com\//.test(p.url) && p.read === '2026-10-21' && p.label.length > 10, k);
});

test('CNC5 no drawing: a plain block holds the standard ±0.125 — passes; with an M6 tapped hole a drawing is needed — failed (the mutant: the thread taken off — passes again)', async () => {
  let s = await build([cmd('box', { w: 60, d: 40, h: 20, x: 0, y: 0, z: 0 })]);
  let r = machinability(s.doc, s.bodies, milling).rules.find(x => x.id === 'drawing')!;
  assert.equal(r.status, 'pass'); assert.match(r.message, /the standard ±0\.125 mm holds/);
  s = await build(plate); r = machinability(s.doc, s.bodies, milling).rules.find(x => x.id === 'drawing')!;
  assert.equal(r.status, 'fail'); assert.match(r.message, /no drawing, but 1 tapped hole \(M6×1\)/);
  const plain = { ...s.doc, nodes: s.doc.nodes.map(n => n.kind === 'hole' ? { ...n, thread: undefined } : n) };
  assert.equal(machinability(plain, s.bodies, milling).rules.find(x => x.id === 'drawing')!.status, 'pass');
});

test('CNC5 a drawing made complete — Auto-dimension, the iso view, a title, the general note and the material — every item passes; each taken away, only it warned', async () => {
  const s = await build(plate);
  // (A bare drawing first: everything a shop needs missing but its views — none chosen shows all four, the iso one among them.)
  let doc = withDrawing(s.doc, {});
  assert.deepEqual(status(doc, s.bodies), { views: 'pass', dimensions: 'warn', threads: 'warn', tolerance: 'warn', title: 'warn', material: 'warn', finish: 'pass' });
  const auto = runDrawingTool(doc, 'auto_dimension', {}); assert.ok(!('error' in auto)); doc = auto.doc;
  const full = withDrawing(doc, { views: ['front', 'top', 'right', 'iso'], title: 'Bracket', notes: NOTES });
  assert.deepEqual(status(full, s.bodies), { views: 'pass', dimensions: 'pass', threads: 'pass', tolerance: 'pass', title: 'pass', material: 'pass', finish: 'pass' }, JSON.stringify(drawingCheck(full, s.bodies).items));
  const all = { views: 'pass', dimensions: 'pass', threads: 'pass', tolerance: 'pass', title: 'pass', material: 'pass', finish: 'pass' };
  const without: [string, Partial<DrawingSettings>][] = [['views', { views: full.drawing!.views!.filter(v => v !== 'iso') }], ['title', { title: undefined }], ['tolerance', { notes: [NOTES[1]] }], ['material', { notes: [NOTES[0]] }],
    ['dimensions', { dimensions: full.drawing!.dimensions.filter(d => d.kind !== 'linear') }], ['threads', { dimensions: full.drawing!.dimensions.filter(d => d.kind !== 'diameter') }]];
  for (const [id, d] of without) {
    const got = status(withDrawing(full, d), s.bodies), changed = Object.keys(got).filter(k => got[k] !== all[k as keyof typeof all]);
    assert.ok(changed.includes(id) && got[id] === 'warn', `${id}: ${JSON.stringify(got)}`);
    if (id !== 'threads' && id !== 'dimensions') assert.deepEqual(changed, [id], `${id} alone: ${JSON.stringify(got)}`);
  }
  // (A dimension on an edge the part does not have: R14's error — the sheet is wrong — failed.)
  const lost = withDrawing(full, { dimensions: [...full.drawing!.dimensions, { id: 'dx', view: 'front', kind: 'diameter', edge: 'n99.side0', near: [0, 0, 0], place: [0, 0] }] });
  assert.equal(status(lost, s.bodies).dimensions, 'fail');
  const r = machinability(full, s.bodies, milling).rules.find(x => x.id === 'drawing')!;
  assert.equal(r.status, 'pass'); assert.match(r.message, /7 of 7 items in order/);
});

test('CNC5 the finish: the brief states one — the drawing without it warned; a note naming it passes; no material set — material undecided', async () => {
  let s = await build(plate);
  const set = await dispatchTool(s, 'set_brief', { fields: { finish: { value: 'bead blasted', basis: 'stated', source: 'bead blasted' } } }, evaluate); assert.ok(!set.isError, set.content); s = set.state;
  const auto = runDrawingTool(withDrawing(s.doc, {}), 'auto_dimension', {}); assert.ok(!('error' in auto));
  const doc = withDrawing(auto.doc, { views: ['front', 'top', 'iso'], title: 'Bracket', notes: NOTES });
  assert.equal(status(doc, s.bodies).finish, 'warn');
  assert.equal(status(withDrawing(doc, { notes: [...NOTES, { id: 'f', text: 'FINISH: BEAD BLASTED', at: [20, 40] }] }), s.bodies).finish, 'pass');
  const bare = { ...doc, bodies: undefined };
  assert.equal(status(bare as StudioDoc, s.bodies).material, 'unknown');
});
