// R7.4d, cad-model's facade: parameters, configurations and suppression on the studio's own nodes. A part built with
// parameters equals the document the studio's own functions write for it — the agent's run_command for the features,
// the Parameters panel's writes for the parameters and configurations, the feature editor's ƒ (editFields' bind) for
// each binding, the History panel's toggle for suppression — byte for byte; a part at new parameter values has the
// volume and centroid of the same part built with those numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, BarocssError, type StudioPart } from '../src/api';
import { type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { editFields, type BindableField } from '../src/app/editFields';
import { runTool, type ChatState } from '../src/chat/tools';

async function agentDoc(calls: [string, Record<string, unknown>][]): Promise<StudioDoc> {
  const was = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = '3';
  try {
    const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
    let s: ChatState = { doc: part().doc, bodies: [] };
    for (const [tool, args] of calls) {
      const r = await runTool(s, tool, args, evaluate);
      assert.ok(!r.isError, `${tool}: ${r.content}`);
      s = r.state;
    }
    return s.doc;
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
}
// (The panel's Add, `{ ...params, [name]: value }`, and the ƒ editor's binding of one field, as the studio writes them.)
const added = (doc: StudioDoc, name: string, value: number): StudioDoc => ({ ...doc, parameters: { ...doc.parameters, [name]: value } });
function bound(doc: StudioDoc, node: number, field: string, name: string): StudioDoc {
  const f = editFields(doc.nodes, node, doc.parameters).find(x => x.key === field) as BindableField;
  return { ...doc, nodes: f.bind(doc.nodes, name)! };
}
const look = (p: StudioPart) => { const m = p.mass({ density: 1 }); return { volume: m.volume, centroid: m.centroid }; };
const near = (a: ReturnType<typeof look>, b: ReturnType<typeof look>) => {
  assert.ok(Math.abs(a.volume - b.volume) <= 1e-9 * b.volume, `volume ${a.volume} vs ${b.volume}`);
  a.centroid.forEach((v, k) => assert.ok(Math.abs(v - b.centroid[k]) <= 1e-9, `centroid ${a.centroid} vs ${b.centroid}`));
};

// An 80 × 40 × 10 plate, its width W and its corners' radius R parameters, its four vertical edges rounded R.
const plate = () => part('plate').parameter('W', 80).parameter('R', 2)
  .box({ w: param('W'), d: 40, h: 10 })
  .fillet(b => b.edges().along('z'), { radius: param('R') });
const edges = ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3'];

test('bound values: what the panel and the ƒ editor write after the agent\'s commands, byte for byte', async () => {
  let doc = await agentDoc([
    ['run_command', { command: 'box', values: { w: 80, d: 40, h: 10, x: 0, y: 0, z: 0 } }],
    ['run_command', { command: 'fillet', edges, values: { radius: 2 } }],
  ]);
  doc = added(added(doc, 'W', 80), 'R', 2);
  doc = bound(bound(doc, 1, 'w', 'W'), 2, 'r', 'R');
  assert.equal(JSON.stringify(plate().doc), JSON.stringify(doc));
  // (The bindings are the documents' own references: the sketch's far corner and the fillet's radius.)
  assert.deepEqual((plate().doc.nodes[0] as { max: unknown }).max, [{ parameter: 'W' }, 40]);
  assert.deepEqual((plate().doc.nodes[2] as { radius: unknown }).radius, { parameter: 'R' });
  assert.deepEqual(plate().parameters(), { W: 80, R: 2 });
});

test('withParameters: the panel\'s value written; the part has the shape built with the new numbers, its stored names kept', () => {
  const narrow = plate().withParameters({ W: 60, R: 3 });
  assert.equal(JSON.stringify(narrow.doc), JSON.stringify({ ...plate().doc, parameters: { W: 60, R: 3 } }));
  near(look(narrow), look(part().box({ w: 60, d: 40, h: 10 }).fillet(b => b.edges().along('z'), { radius: 3 })));
  assert.deepEqual((narrow.doc.nodes[2] as { edges: string[] }).edges, edges);
});

test('configurations: the panel\'s Save and Apply', () => {
  const p = plate().configuration('wide').withParameters({ W: 60 }).configuration('narrow');
  assert.deepEqual(p.configurations(), { wide: { W: 80, R: 2 }, narrow: { W: 60, R: 2 } });
  const back = p.withConfiguration('wide');
  assert.deepEqual(back.parameters(), { W: 80, R: 2 });
  near(look(back), look(plate()));
  assert.throws(() => p.withConfiguration('tall'), e => e instanceof BarocssError && e.code === 'CONFIGURATION_UNKNOWN');
});

test('features by their stable ids; suppressed as the History toggle writes it, and back', () => {
  const p = plate();
  assert.deepEqual(p.features().map(f => [f.id, f.kind]), [['n0', 'sketch'], ['n1', 'extrude'], ['n2', 'fillet']]);
  const off = p.suppressed('n2');
  // (The toggle's write: the flag added to the node; taken away, the node as it was.)
  const doc = p.doc;
  assert.equal(JSON.stringify(off.doc), JSON.stringify({ ...doc, nodes: doc.nodes.map((n, k) => k === 2 ? { ...n, suppressed: true } : n) }));
  near(look(off), look(part().box({ w: 80, d: 40, h: 10 })));
  assert.equal(JSON.stringify(off.suppressed('n2', false).doc), JSON.stringify(doc));
});

test('the refusals are typed: unknown, misnamed and unbindable parameters, and what the History offers no toggle for', () => {
  const refusal = (f: () => unknown) => { try { f(); } catch (e) { return e; } assert.fail('no refusal'); };
  const cases: [string, () => unknown][] = [
    ['PARAMETER_UNKNOWN', () => part().box({ w: param('W'), d: 1, h: 1 })],
    ['PARAMETER_NAME', () => part().parameter('2nd', 1)],
    ['PARAMETER_UNKNOWN', () => plate().withParameters({ H: 1 })],
    ['VALUE', () => plate().withParameters({ W: Number.NaN })],
    // (A box whose width doesn't start at 0: the sketch holds x + w, two numbers — the ƒ editor can't bind it either.)
    ['PARAMETER_UNBINDABLE', () => part().parameter('W', 10).box({ w: param('W'), d: 10, h: 10, x: 5 })],
    // (A hole's diameter, stored as a radius: its options that bind are x and y.)
    ['PARAMETER_UNBINDABLE', () => part().parameter('D', 4).box({ w: 10, d: 10, h: 10 }).hole(b => b.faces().facing('+z'), { d: param('D'), x: 5, y: 5 })],
    ['FEATURE_UNKNOWN', () => plate().suppressed('n9')],
    ['UNAVAILABLE', () => plate().suppressed('n0')],
  ];
  for (const [code, f] of cases) {
    const e = refusal(f);
    assert.ok(e instanceof BarocssError, `${code}: ${String(e)}`);
    assert.equal(e.code, code, e.message);
  }
  const hole = refusal(cases[5][1]) as BarocssError;
  assert.match(hole.message, /x, y/);
});
