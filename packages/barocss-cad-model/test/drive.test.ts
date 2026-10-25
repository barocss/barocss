import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, usesOf, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluatedPart } from '../src/engine/wireDoc';
import { commands, type Ctx } from '../src/app/commands';
import { editDriveRows } from '../src/engine/drives';
import { deleteFeature } from '../src/chat/features';
import { runTool, type ChatState } from '../src/chat/tools';

// R12c.6b (D161) in the studio: the user's drive rows (none built in; test rows flagged estimates), a sprocket at the
// kernel conformance case's sizes (r12c/sprocket-z17: 21697.2300 mm³ by ray integration), a chain on two sprockets with
// the second moved to the distance for whole links (the band's volume 58·p·t·w), flat pulleys and their belt
// (L·t·w on R = d/2 + t/2), a coupling as a bought item.

const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const CHAIN = { kind: 'chain', id: 'chain-a', pitch: 12.7, rollerDiameter: 8.51, innerWidth: 7.75, plateHeight: 11.8, estimate: true };
const FLAT = { kind: 'flat-belt', id: 'flat-a', width: 40, thickness: 3, estimate: true };
const COUPLING = { kind: 'coupling', id: 'sleeve-a', type: 'rigid sleeve', bore: [12, 14], outside: 30, length: 40, boreStep: 18, partNumber: 'TEST-1', supplier: 'a test supplier', estimate: true };
const rows = (doc: StudioDoc, add: unknown[]) => (editDriveRows(doc, add) as { doc: StudioDoc }).doc;
const L = (R1: number, R2: number, C: number) => { const c = (R1 - R2) / C; return 2 * Math.sqrt(C * C - (R1 - R2) ** 2) + 2 * R1 * (Math.PI - Math.acos(c)) + 2 * R2 * Math.acos(c); };
function build(doc: StudioDoc, id: string, values: Record<string, string | number>, selection: number[] = []) {
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const ctx: Ctx = { doc, bodies: r.bodies, selection: { faces: [], edges: [], bodies: selection.map(n => r.bodies.findIndex(b => b.ref?.node === n)) } }, c = cmd(id), ok = c.available(ctx);
  assert.ok(ok.ok, ok.ok ? '' : ok.reason);
  return c.build!(ctx, { ...c.defaults!(ctx), ...values });
}
const bodyOf = (doc: StudioDoc, kind: string, rev = 2) => { const r = evaluateDoc(doc, rev); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.ok ? r.bodies.filter(b => b.ref && doc.nodes[b.ref.node].kind === kind) : []; };

test('Sprocket (R12c.6b): no rows, no sprocket; the user\'s chain row — the conformance case\'s sprocket, its notes; the tip prefilled ¾ of the way to the point', () => {
  const none = cmd('sprocket').available(blank);
  assert.ok(!none.ok && /Load your chain rows first .* none is built in/.test(none.reason));
  assert.match(String((editDriveRows(emptyDoc(), [{ ...CHAIN, estimate: undefined }]) as { error: string }).error), /never neither/);
  const doc0 = rows(emptyDoc(), [CHAIN]), d = cmd('sprocket').defaults!({ ...blank, doc: doc0 });
  // (The seats' edge Ø 2√((R − r sin(π/z))² + (r cos(π/z))²) and the point R cos(π/z) + √((p − r)² − p²/4), r = 4.255.)
  const z = 17, p = 12.7, R = p / (2 * Math.sin(Math.PI / z)), r = 4.255, edge = 2 * Math.hypot(R - r * Math.sin(Math.PI / z), r * Math.cos(Math.PI / z)), point = 2 * (R * Math.cos(Math.PI / z) + Math.sqrt((p - r) ** 2 - p * p / 4));
  assert.equal(d.tip, Math.round((edge + 0.75 * (point - edge)) * 1000) / 1000);
  const doc = build(doc0, 'sprocket', { tip: 75, w: 7, seat: 8.8, bore: 20, x: 0, y: 0, z: 0 }), s = doc.nodes[0] as Extract<ModelNode, { kind: 'sprocket' }>;
  assert.deepEqual([s.row, s.teeth, s.tip, s.width, s.seat, s.bore], ['chain-a', 17, 75, 7, 8.8, 20]);
  assert.equal(featureLabel(s, 0, doc.nodes), 'Sprocket z17 for chain-a, tip Ø75');
  const b = bodyOf(doc, 'sprocket')[0], notes = b.notes!.map(n => n.text);
  assert.ok(Math.abs(b.volume! - 21697.230025) <= 2e-5 * 21697.23, String(b.volume));
  assert.ok(notes.includes('Sprocket z17 for chain chain-a (an estimate): pitch 12.7, roller Ø8.51; pitch Ø69.1158'), JSON.stringify(notes));
  assert.ok(notes.some(t => /^Tooth form pivot-clearance \(derived here, not ISO 606's\): seats Ø8\.8, root Ø60\.3158, flanks r 8\.3 about the neighbouring seats, tip Ø75 \(pointed at Ø78\.6287\)$/.test(t)), JSON.stringify(notes));
  assert.ok(notes.includes('A roller turning out of its seat clears the teeth by 0.145 mm (measured on the built teeth)'), JSON.stringify(notes));
  assert.deepEqual(evaluatedPart(doc).drives, doc.drives);
  assert.match(String((editDriveRows(doc, [], ['chain-a']) as { error: string }).error), /used by a feature/);
});

test('Belt or chain (R12c.6b): two sprockets picked — the chain on them, the second moved to the distance for 58 links; the band 58·p × t × w; it refers to its wheels', () => {
  let doc = rows(emptyDoc(), [CHAIN]);
  doc = build(doc, 'sprocket', { teeth: 17, tip: 75, w: 7, x: 0, y: 0, z: 0 });
  doc = build(doc, 'sprocket', { teeth: 34, tip: 145, w: 7, x: 200, y: 0, z: 0 });
  doc = build(doc, 'belt-drive', {}, [0, 1]);
  const belt = doc.nodes[2] as Extract<ModelNode, { kind: 'belt' }>, moved = doc.nodes[1] as Extract<ModelNode, { kind: 'sprocket' }>;
  assert.deepEqual([belt.row, belt.wheels, usesOf(belt)], ['chain-a', [0, 1], [0, 1]]);
  const R1 = 12.7 / (2 * Math.sin(Math.PI / 17)), R2 = 12.7 / (2 * Math.sin(Math.PI / 34));
  assert.ok(Math.abs(L(R1, R2, moved.center[0]) - 58 * 12.7) < 1e-6 && moved.center[1] === 0, JSON.stringify(moved.center));
  assert.equal(featureLabel(belt, 2, doc.nodes), 'chain-a on features 1 and 2');
  const b = bodyOf(doc, 'belt')[0], notes = b.notes!.map(n => n.text);
  assert.ok(Math.abs(b.volume! - 58 * 12.7 * 11.8 * 7.75) < 1e-6 * 67362, String(b.volume));
  assert.ok(notes.some(t => /^Chain chain-a \(an estimate\): length 736\.6 mm on pitch radii 34\.5579 and 68\.821 at 203\.0146; wraps/.test(t)), JSON.stringify(notes));
  assert.ok(notes.some(t => /^58 pitches: 58 links .*chordal effect\) is not modelled$/.test(t)), JSON.stringify(notes));
  assert.match(String((deleteFeature(doc, 0) as { error?: string }).error), /used by feature/);
});

test('Pulleys and a flat belt (R12c.6b): two flat pulleys, the belt on R = d/2 + t/2 — L·t·w; a coupling\'s envelope, a bought item in its notes; refusals with their titles', () => {
  let doc = rows(emptyDoc(), [FLAT, COUPLING]);
  doc = build(doc, 'pulley', { d: 80, w: 50, bore: 20, x: 0, y: 0, z: 0 });
  doc = build(doc, 'pulley', { d: 50, w: 50, bore: 12, x: 150, y: 0, z: 0 });
  doc = build(doc, 'belt-drive', {}, [0, 1]);
  const belt = bodyOf(doc, 'belt')[0];
  assert.ok(Math.abs(belt.volume! - L(41.5, 26.5, 150) * 3 * 40) < 1e-6 * 60000, String(belt.volume));
  assert.ok(bodyOf(doc, 'pulley')[0].notes!.some(n => n.text === 'Flat pulley Ø80, 50 wide, for belt flat-a (an estimate)'));
  doc = build(doc, 'coupling', { x: 0, y: 80, z: 0 });
  const k = bodyOf(doc, 'coupling')[0], kn = k.notes!.map(n => n.text);
  assert.ok(Math.abs(k.volume! - Math.PI * ((225 - 36) * 18 + (225 - 49) * 22)) < 1e-6 * 22852, String(k.volume));
  assert.ok(kn.includes('Coupling sleeve-a (rigid sleeve) (an estimate): Ø30 × 40, bores Ø12 and Ø14 stepped at 18; its envelope only') && kn.includes('Bought: part TEST-1 from a test supplier'), JSON.stringify(kn));
  const gone = evaluateDoc({ ...doc, drives: { version: 1, rows: [COUPLING as never] } }, 5);
  assert.ok(!gone.ok && gone.error.title === 'A drive element names a row that is not in your drive rows', gone.ok ? 'built' : gone.error.detail);
  const close = evaluateDoc({ ...doc, nodes: doc.nodes.map((n, i) => i === 1 ? { ...(n as Extract<ModelNode, { kind: 'pulley' }>), center: [60, 0] as [number, number] } : n) }, 6);
  assert.ok(!close.ok && close.error.title === 'The wheels are too close for a belt', close.ok ? 'built' : close.error.detail);
});

test('Drive commands (R12c.6b) in the chat: v2 features commands, their values behind describe', async () => {
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1), state: ChatState = { doc: rows(emptyDoc(), [FLAT]), bodies: [] };
  const d = await runTool(state, 'describe', { command: 'sprocket' }, evaluate);
  assert.ok(!d.isError, d.content); assert.match(d.content, /none built in: if none, say so/);
  const made = await runTool(state, 'features', { action: 'command', command: 'pulley', values: { row: 'flat-a', d: 60, w: 45, bore: 10, x: 0, y: 0, z: 0 } }, evaluate);
  assert.ok(!made.isError && made.changed, made.content.slice(0, 400));
  assert.deepEqual([made.state.doc.nodes[0].kind, (made.state.doc.nodes[0] as { diameter?: number }).diameter], ['pulley', 60]);
});
