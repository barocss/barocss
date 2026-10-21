import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, usesOf, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { deleteFeature } from '../src/chat/features';
import { runTool, type ChatState } from '../src/chat/tools';

// R12c.3b (D157) in the studio: the default shaft (a 6 × 3.5 × 18 end-milled seat on Ø20 from z 6, a Ø19 × 1.3 groove
// at z 88), a hub over the seat (a tube Ø40 / Ø20 bore, z 4–26), its keyway, the key, a ring, a pin. Oracles: the key
// (l − b)bh + π(b/2)²h, its clearance t1 + t2 − h (D139 S0: 0.3), the ring π(R_o² − r_g²)s.

const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
function run(doc: StudioDoc, id: string, pick: { bodies?: number[]; face?: string }, values: Record<string, number | string> = {}) {
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const faces = pick.face ? [(() => { const body = r.bodies.findIndex(b => b.mesh.faces.some(f => f.name === pick.face)); return { body, face: r.bodies[body].mesh.faces.findIndex(f => f.name === pick.face) }; })()] : [];
  const bodies = (pick.bodies ?? []).map(node => r.bodies.findIndex(b => b.ref?.node === node));
  const ctx: Ctx = { doc, bodies: r.bodies, selection: { faces, edges: [], bodies }, }, c = cmd(id), ok = c.available(ctx);
  assert.ok(ok.ok, ok.ok ? '' : `${id}: ${ok.reason}`);
  return c.build!(ctx, { ...c.defaults!(ctx), ...values });
}

test('Shaft parts (R12c.3b): the default shaft, a hub over its seat with a keyway, the key under it, a ring in the groove, a pin in a cross hole — the checks in the notes', () => {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  // (A cross hole on the last step, for the pin: the Shaft command takes none, so it is set on the node.)
  doc = { ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? { ...(n as Extract<ModelNode, { kind: 'shaft' }>), holes: [{ diameter: 4, at: 80 }] } : n) };
  const tube = cmd('tube'); doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 20, ri: 10, h: 22, x: 0, y: 0, z: 4 });
  const hub = doc.nodes.length - 1;
  doc = run(doc, 'keyway', { face: `n${hub}.hole0.side0` }, { b: 6, t2: 2.8 });
  const way = doc.nodes.length - 1;
  doc = run(doc, 'key', { bodies: [0] }, { h: 6 });
  const key = doc.nodes[doc.nodes.length - 1] as Extract<ModelNode, { kind: 'key' }>;
  assert.deepEqual([key.kind, key.shaft, key.keyseat, key.height, key.hub], ['key', 0, 1, 6, way]);
  assert.deepEqual(usesOf(key), [0, way]);
  doc = run(doc, 'retaining-ring', { bodies: [0] });
  doc = run(doc, 'pin', { bodies: [0] });
  const r = evaluateDoc(doc, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const body = (kind: string) => r.ok ? r.bodies.find(b => b.ref && doc.nodes[b.ref.node].kind === kind)! : null!;
  const k = body('key'), notes = k.notes!.map(n => n.text);
  assert.ok(Math.abs(k.volumeMM3! - (12 * 36 + Math.PI * 9 * 6)) < 1e-6, String(k.volumeMM3));
  assert.ok(notes.some(t => t === 'Key 6 × 6 × 18 (round ends) in keyseat 1: 0 play in the seat\'s width, 0 to spare in its length; it stands 2.5 above the shaft'), JSON.stringify(notes));
  assert.ok(notes.some(t => t === 'In the hub\'s keyway: 0 play in its width, 0.3 under its floor'), JSON.stringify(notes));
  assert.ok(body('keyway').notes!.some(n => /^Keyway 6 wide, 2\.8 deep in the Ø20 bore \(its floor 12\.8 from the axis\), 22 long at 0°$/.test(n.text)));
  const ring = body('retaining-ring');
  // (The prefills: the groove's width less 0.1 thick, to its Ø + 5: 1.2 to Ø24.)
  assert.ok(Math.abs(ring.volumeMM3! - Math.PI * (144 - 90.25) * 1.2) < 1e-6, String(ring.volumeMM3));
  assert.ok(ring.notes!.some(n => n.text === 'Retaining ring 1.2 thick, Ø19 to Ø24 in groove 1: 0.1 axial play') && ring.notes!.some(n => /an estimate: your ring's row/.test(n.text) && n.warning));
  assert.ok(body('pin').notes!.some(n => n.text === 'Pin Ø4 × 20 in cross hole 1 (Ø4): 0 clearance'));
  assert.equal(featureLabel(key, 0, doc.nodes), 'Key 6 high in keyseat 1');
  // The shaft and the hub cannot go from under them.
  assert.match(String((deleteFeature(doc, 0) as { error?: string }).error), /used by feature/);
});

test('Shaft parts (R12c.3b) refusals in the studio: a key too high for its keyway, a keyway turned off the seat', () => {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  const tube = cmd('tube'); doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 20, ri: 10, h: 22, x: 0, y: 0, z: 4 });
  doc = run(doc, 'keyway', { face: `n${doc.nodes.length - 1}.hole0.side0` }, { b: 6, t2: 2.8 });
  const high = run(doc, 'key', { bodies: [0] }, { h: 6.4 }), rh = evaluateDoc(high, 3);
  assert.ok(!rh.ok && /\[KEY_FIT\].*reaches the keyway's floor/.test(rh.error.detail), rh.ok ? 'built' : rh.error.detail);
  const turned = run({ ...doc, nodes: doc.nodes.map(n => n.kind === 'keyway' ? { ...n, angle: 90 } : n) }, 'key', { bodies: [0] }, { h: 6 }), rt = evaluateDoc(turned, 4);
  assert.ok(!rt.ok && /\[KEY_FIT\].*not over keyseat 1/.test(rt.error.detail), rt.ok ? 'built' : rt.error.detail);
});

test('Shaft parts (R12c.3b) in the chat: key, keyway, retaining-ring and pin are v2 features commands, their values behind describe', async () => {
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1), state: ChatState = { doc: emptyDoc(), bodies: [] };
  for (const c of ['key', 'keyway', 'retaining-ring', 'pin']) { const d = await runTool(state, 'describe', { command: c }, evaluate); assert.ok(!d.isError, `${c}: ${d.content}`); }
});
