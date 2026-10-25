import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { commands, shownFields, type Ctx } from '../src/app/commands';
import { editFields } from '../src/app/editFields';
import { runTool, type ChatState } from '../src/chat/tools';

// R12c.3a (D156): the Shaft command, its node, notes and edit fields; the chat's v2 surface. Oracles written here:
// Pappus on the default's half-section, less its end-milled keyseat (l − b)·A + the disc ends (the kernel test's
// closed form and quadrature, packages/barocss-cad/test/r12c-shaft.test.mjs).

const ctx: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
type Shaft = Extract<ModelNode, { kind: 'shaft' }>;
const simpson = (f: (z: number) => number, a: number, b: number, n = 20000) => { const h = (b - a) / n; let s = 0; for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * f(a + i * h); return s * h / 3; };

test('Shaft (R12c.3a): the command\'s default — Ø20 × 30 keyed, Ø25 × 40, Ø20 × 25 grooved, fillets and chamfers 0.5; V by Pappus less the keyseat; notes and label', () => {
  const cmd = commands.find(c => c.id === 'shaft')!, doc = cmd.build!(ctx, { ...cmd.defaults!(ctx) }), r = evaluateDoc(doc, 1);
  assert.ok(r.ok, r.ok ? '' : `${r.error.title} ${r.error.detail}`);
  const node = doc.nodes[0] as Shaft;
  assert.deepEqual(node.steps.map(s => [s.diameter, s.length, s.fillet]), [[20, 30, 0.5], [25, 40, 0.5], [20, 25, undefined]]);
  assert.deepEqual(node.chamfers, [0.5, 0.5]);
  assert.equal(featureLabel(node, 0, doc.nodes), 'Shaft 3 steps Ø20–Ø25 × 95, keyed');
  // The half-section: chamfer 0–0.5 (9.5 → 10), R 10 to 29.5, the fillet into the step-up shoulder (centre (10.5, 29.5)),
  // R 12.5 30–70, the fillet out of the step-down shoulder (centre (10.5, 70.5)), R 10 with the groove (R 9.5, 88–89.3), chamfer at 94.5–95.
  // (Each piece by its own r(z): a piece's ends are evaluated on it, not on its neighbour.)
  const fil = (c: number) => (z: number) => 10.5 - Math.sqrt(Math.max(0, 0.25 - (z - c) ** 2));
  const pieces: [number, number, (z: number) => number][] = [[0, 0.5, z => 9.5 + z], [0.5, 29.5, () => 10], [29.5, 30, fil(29.5)], [30, 70, () => 12.5], [70, 70.5, fil(70.5)], [70.5, 88, () => 10], [88, 89.3, () => 9.5], [89.3, 94.5, () => 10], [94.5, 95, z => 10 - (z - 94.5)]];
  const pap = pieces.reduce((s, [a, b, r]) => s + Math.PI * simpson(z => r(z) ** 2, a, b), 0);
  const R = 10, b = 6, t1 = 3.5, l = 18, h = R - t1, F = (x: number) => (x * Math.sqrt(R * R - x * x) + R * R * Math.asin(x / R)) / 2, A = F(b / 2) - F(-b / 2) - b * h;
  const disc = simpson(u => 2 * (b / 2) ** 2 * Math.cos(u) ** 2 * (Math.sqrt(R * R - (b / 2 * Math.sin(u)) ** 2) - h), -Math.PI / 2, Math.PI / 2);
  const want = pap - ((l - b) * A + disc), body = r.ok ? r.bodies[0] : null!;
  assert.ok(Math.abs(body.volume! - want) <= 1e-6 * want, `${body.volume} vs ${want}`);
  const notes = body.notes!.map(n => n.text);
  assert.ok(notes.some(t => t === 'Shaft 95 mm: Ø20 from 0 to 30; Ø25 from 30 to 70; Ø20 from 70 to 95'), JSON.stringify(notes));
  assert.ok(notes.some(t => /^Keyseat 1 \(step 1, end-mill\): 6 wide, 3\.5 deep \(floor 6\.5 from the axis\), 18 long from 6, at 0°$/.test(t)), JSON.stringify(notes));
  assert.ok(notes.some(t => t === 'Groove 1 (step 3): Ø19, 1.3 wide from 88'), JSON.stringify(notes));
  // The prefills that are key and ring sizes say they are estimates.
  const labels = shownFields(cmd.fields!(ctx), cmd.defaults!(ctx)).map(f => f.label);
  for (const l2 of ['Keyseat width (estimate)', 'Keyseat depth t1 (estimate)', 'Groove Ø (estimate)', 'Groove width (estimate)']) assert.ok(labels.includes(l2), l2);
  assert.ok(!labels.includes('Step 4 Ø'), 'three steps shown');
});

test('Shaft (R12c.3a) edit fields and refusals: a step\'s length, the fillets together; a keyseat deeper than its step is refused with its code', () => {
  const cmd = commands.find(c => c.id === 'shaft')!, doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), ks: 0, gs: 0 });
  const field = (nodes: ModelNode[], key: string) => editFields(nodes, 0).find(f => f.key === key)!;
  const l2 = field(doc.nodes, 'l2'), longer = l2.kind === 'number' ? l2.set(doc.nodes, 50) : doc.nodes, r = evaluateDoc({ ...doc, nodes: longer }, 2);
  assert.ok(r.ok && r.bodies[0].notes!.some(n => n.text.startsWith('Shaft 105 mm:')), r.ok ? '' : r.error.detail);
  const f = field(doc.nodes, 'r'), none = f.kind === 'number' ? f.set(doc.nodes, 0) : doc.nodes;
  assert.deepEqual((none[0] as Shaft).steps.map(s => s.fillet), [undefined, undefined, undefined]);
  const deep = cmd.build!(ctx, { ...cmd.defaults!(ctx), kt: 12 }), rd = evaluateDoc(deep, 3);
  assert.ok(!rd.ok && /\[KEYSEAT_DIMENSIONS\]/.test(rd.error.detail), rd.ok ? 'built' : rd.error.detail);
});

test('Shaft (R12c.3a) in the chat: a v2 features command, its values behind describe', async () => {
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1), state: ChatState = { doc: emptyDoc(), bodies: [] };
  const d = await runTool(state, 'describe', { command: 'shaft' }, evaluate);
  assert.ok(!d.isError, d.content); assert.match(d.content, /the key's from the user's own data, else say the prefill is an estimate/);
  const made = await runTool(state, 'features', { action: 'command', command: 'shaft', values: { n: 2, d1: 30, l1: 20, d2: 24, l2: 30, ks: 2, kb: 8, kt: 4, kl: 20, ko: 5, gs: 0 } }, evaluate);
  assert.ok(!made.isError && made.changed, made.content.slice(0, 400));
  const node = made.state.doc.nodes[0] as Shaft;
  assert.deepEqual(node.steps.map(s => [s.diameter, s.length, s.keyseats?.[0]?.width]), [[30, 20, undefined], [24, 30, 8]]);
});
