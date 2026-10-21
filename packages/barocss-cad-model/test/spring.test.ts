import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, type ModelNode } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editFields } from '../src/app/editFields';
import { STEEL_G_ESTIMATE_MPA } from '../src/app/primitives';
import { CHAT_COMMANDS, runTool, type ChatState } from '../src/chat/tools';

// R12c.1a (D153): the Spring command, its node, edit fields and notes; the chat's v2 surface names it (describe has
// its values). Closed forms written here: k = Gd⁴/(8D³n), the ground spring's volume πa²S − (4/3)a³R/h_s (the kernel
// test's derivation, packages/barocss-cad/test/r12c-spring.test.mjs), its free length 2p_s + n_a p.

const ctx: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
type Spring = Extract<ModelNode, { kind: 'spring' }>;

test('Spring (R12c.1a): the command\'s default — closed and ground, steel\'s G prefilled and flagged an estimate; its volume, notes and label', () => {
  const cmd = commands.find(c => c.id === 'spring')!;
  assert.ok(cmd.available(ctx).ok);
  const doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), x: 0, y: 0, z: 0, F: 20 }), r = evaluateDoc(doc, 1);
  assert.ok(r.ok, r.ok ? '' : `${r.error.title} ${r.error.hint}`);
  const node = doc.nodes[0] as Spring;
  assert.deepEqual([node.kind, node.wire, node.diameter, node.activeCoils, node.pitch, node.ends, node.hand, node.shearModulus, node.shearModulusEstimate, node.load], ['spring', 2, 20, 6, 5, 'closed-ground', 'right', STEEL_G_ESTIMATE_MPA, true, 20]);
  assert.equal(featureLabel(node, 0, doc.nodes), 'Ground spring d2 × Ø20, 6 coils');
  const body = r.ok ? r.bodies[0] : null!;
  // The volume: πa²·S − (4/3)a³R/h_s with S the centreline's length (dead coils at p_s 2.0010140, 90° transitions):
  // 1541.19988 mm³, within the 1e-4·d fit's bound (rel 4e-4).
  assert.ok(Math.abs(body.volumeMM3! - 1541.1998773) <= 4e-4 * 1541.2, String(body.volumeMM3));
  assert.ok(Math.abs(body.mesh.bounds.min[2]) < 1e-4 && Math.abs(body.mesh.bounds.max[2] - (2 * 2.0010139858630147 + 30)) < 1e-4, JSON.stringify(body.mesh.bounds));
  const k = 79300 * 16 / (8 * 8000 * 6), notes = body.notes!.map(n => n.text);
  assert.ok(notes.some(t => /^Compression spring, right hand, ends closed and ground: wire Ø2, mean Ø20 \(outer 22, inner 18\), index C 10; 6 active of 8 coils, pitch 5 mm/.test(t)), JSON.stringify(notes));
  assert.ok(notes.some(t => /^Solid height 16\.0081 mm \(turns a wire Ø apart at pitch 2\.001\); 16 mm by the supplier's rule d·n_t/.test(t)), JSON.stringify(notes));
  assert.ok(body.notes!.some(n => n.text.startsWith(`Rate ${+k.toFixed(4)} N/mm`) && /an estimate for steel/.test(n.text) && n.warning), JSON.stringify(notes));
  assert.ok(notes.some(t => t.startsWith(`At 20 N: deflection ${+(20 / k).toFixed(4)} mm`)), JSON.stringify(notes));
  assert.ok(body.notes!.some(n => /^Not validated for manufacturing/.test(n.text) && n.warning));
});

test('Spring (R12c.1a) edit fields: pitch, ends, hand; G typed in drops the estimate flag; a pitch below the solid pitch is refused as overlapping coils', () => {
  const cmd = commands.find(c => c.id === 'spring')!, doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), x: 0, y: 0, z: 0 });
  const field = (nodes: ModelNode[], key: string) => editFields(nodes, 0).find(f => f.key === key)!;
  const g = field(doc.nodes, 'G'), withG = g.kind === 'number' ? g.set(doc.nodes, 81000) : doc.nodes, s = withG[0] as Spring;
  assert.equal(s.shearModulus, 81000); assert.equal(s.shearModulusEstimate, undefined);
  const r = evaluateDoc({ ...doc, nodes: withG }, 2);
  assert.ok(r.ok && r.bodies[0].notes!.some(n => n.text.startsWith(`Rate ${+(81000 * 16 / (8 * 8000 * 6)).toFixed(4)} N/mm (Gd⁴/8D³n, G 81000 MPa)`) && !n.warning), r.ok ? JSON.stringify(r.bodies[0].notes) : r.error.hint);
  const e = field(doc.nodes, 'ends'), open = e.kind === 'choice' ? e.set(doc.nodes, 'open') : doc.nodes;
  const ro = evaluateDoc({ ...doc, nodes: open }, 3);
  // (Open: L0 = n p + 2aγ, the helix's tilt γ = R/√(R² + h²).)
  const L0 = 30 + 2 * 10 / Math.hypot(10, 5 / (2 * Math.PI));
  assert.ok(ro.ok && Math.abs(ro.bodies[0].mesh.bounds.max[2] - L0) < 1e-4, ro.ok ? JSON.stringify(ro.bodies[0].mesh.bounds) : ro.error.hint);
  const p = field(open, 'p'), tight = p.kind === 'number' ? p.set(open, 2) : open, rt = evaluateDoc({ ...doc, nodes: tight }, 4);
  assert.ok(!rt.ok && rt.error.title === 'The spring\'s coils would overlap' && /\[COILS_OVERLAP\].*2\.001014/.test(rt.error.detail), rt.ok ? 'built' : `${rt.error.title} ${rt.error.detail}`);
  const h = field(doc.nodes, 'hand'), left = h.kind === 'choice' ? h.set(doc.nodes, 'left') : doc.nodes, rl = evaluateDoc({ ...doc, nodes: left }, 5);
  assert.ok(rl.ok && rl.bodies[0].notes!.some(n => /^Compression spring, left hand/.test(n.text)));
});

test('Spring (R12c.1a) in the chat: a v2 features command, its values behind describe', async () => {
  assert.ok(CHAT_COMMANDS.includes('spring'));
  const evaluate = async (doc: ChatState['doc']) => evaluatePart(doc, 1);
  const state: ChatState = { doc: emptyDoc(), bodies: [] };
  const d = await runTool(state, 'describe', { command: 'spring' }, evaluate);
  assert.ok(!d.isError, d.content);
  assert.match(d.content, /mean coil diameter/); assert.match(d.content, /steel's, an estimate/);
  const made = await runTool(state, 'features', { action: 'command', command: 'spring', values: { d: 1.5, D: 12, n: 8, p: 3, ends: 'closed', x: 0, y: 0, z: 0 } }, evaluate);
  assert.ok(!made.isError && made.changed, made.content.slice(0, 400));
  const node = made.state.doc.nodes[0] as Spring;
  assert.deepEqual([node.kind, node.wire, node.diameter, node.activeCoils, node.pitch, node.ends], ['spring', 1.5, 12, 8, 3, 'closed']);
});
