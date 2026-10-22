import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, usesOf, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { flattenAssembly } from '../src/assembly/flatten';
import { dispatchTool, runTool, type ChatState } from '../src/chat/tools';

// FRk1 (D165) in the studio: the Gusset and End cap commands on a frame's picked members, their nodes, notes and labels,
// the refusals' titles, and the agent's v2 features commands. Oracles: a clipped triangle (l₁l₂ − c²)/2·t, a rounded
// square 4h² − (4 − π)r² over a tube's end; sizes are test values.
const gusset = commands.find(c => c.id === 'gusset')!, cap = commands.find(c => c.id === 'end-cap')!;
const SHARP = { kind: 'rect-tube' as const, width: 40, height: 40, wall: 3, outerRadius: 0 };
const L = (section: Extract<ModelNode, { kind: 'frame' }>['section'] = SHARP): StudioDoc => withNode(emptyDoc(), { kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section, corners: { default: 'mitre' } });
function ctxOf(doc: StudioDoc, bodies: number[]): Ctx {
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  return { doc, bodies: r.bodies, selection: { bodies, faces: [], edges: [] } };
}

test('Gusset (FRk1): two members of a frame picked — the gusset in their corner, its node (point, members), its volume, notes and label; one picked, or two of different frames, says why', () => {
  const ctx = ctxOf(L(), [0, 1]);
  assert.ok(gusset.available(ctx).ok);
  assert.deepEqual(gusset.fields!(ctx).map(f => f.key), ['l1', 'l2', 't', 'clip', 'offset'], 'no along at a corner');
  const doc = gusset.build!(ctx, { ...gusset.defaults!(ctx), l1: 120, clip: 15 }), node = doc.nodes[1] as Extract<ModelNode, { kind: 'gusset' }>;
  assert.deepEqual([node.frame, node.point, node.members, node.legs, node.thickness, node.clip, usesOf(node)], [0, 1, [0, 1], [120, 100], 5, 15, [0]]);
  assert.equal(featureLabel(node, 1, doc.nodes), 'Gusset 120 × 100 × 5 at point 1 of n0');
  const r = evaluateDoc(doc, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const g = r.bodies.find(b => b.ref?.node === 1)!;
  assert.ok(Math.abs(g.volumeMM3! - (120 * 100 - 225) / 2 * 5) < 1e-9, String(g.volumeMM3));
  assert.deepEqual(g.notes!.map(n => n.text), ['Gusset at point 1, between members 1 and 2 (90°): legs 120 and 100, corner clipped 15, 5 thick', 'Plate 5887.5 mm² × 5: 29437.5 mm³', 'Seams: 105 on member 1 (n0.m0.top), 85 on member 2 (n0.m1.top)']);
  assert.equal(r.bodies.length, 3, 'the members stay bodies of their own');
  const one = gusset.available(ctxOf(L(), [0]));
  assert.ok(!one.ok && /two members of a frame/.test(one.reason));
  const two = withNode(L(), { kind: 'frame', points: [[0, 300, 0], [0, 300, 300]], segments: [[0, 1]], section: SHARP });
  const apart = gusset.available(ctxOf(two, [0, 2]));
  assert.ok(!apart.ok && /the same frame/.test(apart.reason), apart.ok ? '' : apart.reason);
});

test('Gusset (FRk1) at a T: its along field, both ways; on round tubes refused with its title', () => {
  const tee = withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400]], segments: [[0, 1], [2, 3]], section: SHARP, corners: { tee: 'butt' } });
  const ctx = ctxOf(tee, [1, 0]);
  assert.deepEqual(gusset.fields!(ctx).map(f => f.key), ['l1', 'l2', 't', 'clip', 'offset', 'along']);
  let doc = gusset.build!(ctx, { ...gusset.defaults!(ctx), clip: 0 });
  doc = gusset.build!({ ...ctx, doc }, { ...gusset.defaults!(ctx), clip: 0, along: '-1' });
  assert.deepEqual(doc.nodes.slice(1).map(n => n.kind === 'gusset' ? [n.point, n.members, n.along] : null), [[3, [1, 0], 1], [3, [1, 0], -1]]);
  const r = evaluateDoc(doc, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  for (const k of [1, 2]) assert.ok(Math.abs(r.bodies.find(b => b.ref?.node === k)!.volumeMM3! - 100 * 100 / 2 * 5) < 1e-9);
  const round = L({ kind: 'round-tube', diameter: 40, wall: 3 }), rc = ctxOf(round, [0, 1]);
  const bad = evaluateDoc(gusset.build!(rc, gusset.defaults!(rc)), 3);
  assert.ok(!bad.ok && bad.error.title === 'The gusset does not fit that corner' && /\[GUSSET_FIT\] member 0 has no flat face/.test(bad.error.detail), bad.ok ? 'built' : bad.error.detail);
});

test('End cap (FRk1): over a member\'s end, a plug in its start; volumes, notes, label; a mitred end refused with its title; flattened into an assembly, its frame shifted', () => {
  const ro = 6, env = 1600 - (4 - Math.PI) * ro * ro, bore = 34 * 34 - (4 - Math.PI) * 9;
  const post = withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [0, 0, 300]], segments: [[0, 1]], section: { ...SHARP, outerRadius: ro } });
  const ctx = ctxOf(post, [0]);
  assert.ok(cap.available(ctx).ok);
  let doc = cap.build!(ctx, cap.defaults!(ctx));
  doc = cap.build!({ ...ctx, doc }, { end: 'start', fit: 'inset', t: 6 });
  const n1 = doc.nodes[1] as Extract<ModelNode, { kind: 'end-cap' }>;
  assert.deepEqual([n1.frame, n1.member, n1.end, n1.fit, n1.thickness], [0, 0, 'end', 'over', 4]);
  assert.deepEqual([featureLabel(doc.nodes[1], 1, doc.nodes), featureLabel(doc.nodes[2], 2, doc.nodes)], ['End cap over member 1\'s end, 4 thick', 'End cap in member 1\'s start, 6 thick']);
  const r = evaluateDoc(doc, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const body = (k: number) => r.ok ? r.bodies.find(b => b.ref?.node === k)! : null!;
  assert.ok(Math.abs(body(1).volumeMM3! - env * 4) < 1e-9 && Math.abs(body(2).volumeMM3! - bore * 6) < 1e-9);
  assert.equal(body(1).notes![1].text, `Seam ${+(160 - 48 + 12 * Math.PI).toFixed(4)} mm round its outline (exact)`);
  const mitred = ctxOf(L(), [1]), bad = evaluateDoc(cap.build!(mitred, { end: 'start', fit: 'over', t: 4 }), 3);
  assert.ok(!bad.ok && bad.error.title === 'The end cap does not fit that end' && /\[CAP_END\] member 1's start is cut by a mitre/.test(bad.error.detail), bad.ok ? 'built' : bad.error.detail);
  // As a placed part after a two-node base: the cap's frame index moves with it.
  const base = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }), { kind: 'extrude', sketch: 0, height: 5 } as ModelNode);
  const flat = flattenAssembly({ ...base, instances: [{ id: 'p', name: 'post', doc, position: [0, 0, 0], rotation: [0, 0, 0] }] });
  const shifted = flat.nodes.filter(n => n.kind === 'end-cap') as Extract<ModelNode, { kind: 'end-cap' }>[];
  assert.ok(shifted.length === 2 && shifted.every(n => flat.nodes[n.frame].kind === 'frame'), JSON.stringify(shifted));
});

test('Gusset and End cap (FRk1) in the chat: v2 features commands on bodies by key, their values behind describe', async () => {
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1);
  let state: ChatState = { doc: L(), bodies: [] };
  const first = await evaluate(state.doc); assert.ok(first.ok); state = { ...state, bodies: first.ok ? first.bodies : [] };
  const keys = state.bodies.map(b => b.key);
  const d = await runTool(state, 'describe', { command: 'gusset' }, evaluate);
  assert.ok(!d.isError, d.content); assert.match(d.content, /two members of one frame that meet/);
  const g = await dispatchTool(state, 'features', { action: 'command', command: 'gusset', values: { l1: 100, l2: 100, t: 5, clip: 10, offset: 0 }, bodies: keys }, evaluate);
  assert.ok(!g.isError, g.content); state = g.state;
  assert.equal(state.doc.nodes.at(-1)!.kind, 'gusset');
  const c = await dispatchTool(state, 'features', { action: 'command', command: 'end-cap', values: { end: 'start', fit: 'inset', t: 4 }, bodies: [keys[0]] }, evaluate);
  assert.ok(!c.isError, c.content);
  assert.deepEqual(c.state.doc.nodes.at(-1), { id: 'n2', kind: 'end-cap', frame: 0, member: 0, end: 'start', fit: 'inset', thickness: 4 });
});
