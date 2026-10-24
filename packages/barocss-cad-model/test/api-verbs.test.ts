// R7.4b, cad-model's facade grown (the one part over the studio document, api-conventions.md §11): cylinder, sketch →
// extrude and revolve on a Plane, chamfer, shell, union, subtract and intersect, the patterns, a body chooser and
// Location. Each part built through it equals what the agent's own tools write for the same commands (§12) — and, where
// no reference needs a signature, the hand-written StudioDoc — byte for byte; its results equal the core functions' on
// that document byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch, Plane, Location, BarocssError, type StudioPart } from '../src/api';
import { prefixDoc, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, exportStudioStep } from '../src/engine/evaluate';
import { bodyMass } from '../src/app/mass';
import { runTool, type ChatState } from '../src/chat/tools';

const tags = (n: number) => ({ outer: Array.from({ length: n }, (_, k) => `e${k + 1}`) });
const XZ = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] }, YZ = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };

type Call = [tool: string, args: Record<string, unknown>];
interface Case { name: string; built: () => StudioPart; agent: Call[]; hand?: () => StudioDoc }

const CASES: Case[] = [
  {
    // A 60 × 40 × 8 plate, a Ø8 bore cut through it by a cylinder, its top's four straight edges chamfered 1.
    name: 'plate',
    built: () => part('plate').box({ wMM: 60, dMM: 40, hMM: 8 })
      .subtract(p => p.cylinder({ rMM: 4, hMM: 20, xMM: 15, yMM: 20, zMM: -6 }))
      .chamfer(b => b.faces().facing('+z').edges().straight(), { distanceMM: 1 }),
    agent: [
      ['run_command', { command: 'box', values: { w: 60, d: 40, h: 8, x: 0, y: 0, z: 0 } }],
      ['run_command', { command: 'cylinder', values: { r: 4, h: 20, x: 15, y: 20, z: -6 } }],
      ['run_command', { command: 'difference', bodies: ['b1', 'b3'] }],
      ['run_command', { command: 'chamfer', edges: ['n1.side0|n1.top', 'n1.side1|n1.top', 'n1.side2|n1.top', 'n1.side3|n1.top'], values: { distance: 1 } }],
    ],
  },
  {
    // A cup: a 20 × 30 section on XZ turned a full turn about Z, hollowed to 2 mm walls with its top open.
    name: 'cup',
    built: () => part('cup').revolve(sketch(Plane.XZ).polygon([[0, 0], [20, 0], [20, 30], [0, 30]])).shell(b => b.faces().facing('+z'), { tMM: 2 }),
    agent: [
      ['add_features', { features: [{ kind: 'sketch', profile: 'polygon', points: [[0, 0], [20, 0], [20, 30], [0, 30]], plane: XZ, sideTags: tags(4) }] }],
      ['run_command', { command: 'revolve', values: { axis: 'y', deg: 360 } }],
      ['run_command', { command: 'shell', faces: ['n1.side[e3]'], values: { t: 2 } }],
    ],
  },
  {
    // A ring of six blocks round Z, two tiers, stood up on X and lifted 5.
    name: 'ring',
    built: () => part('ring').box({ wMM: 10, dMM: 10, hMM: 5, xMM: 20 }).circularPattern({ count: 6 }).linearPattern({ axis: 'z', spacingMM: 10, count: 2 })
      .moved(Location.of({ positionMM: [0, 0, 5], rotationDeg: [90, 0, 0] })),
    agent: [
      ['run_command', { command: 'box', values: { w: 10, d: 10, h: 5, x: 20, y: 0, z: 0 } }],
      ['run_command', { command: 'circular-pattern', bodies: ['b1'], values: { axis: 'z', count: 6, span: 360, px: 0, py: 0 } }],
      ['run_command', { command: 'linear-pattern', bodies: ['b2'], values: { axis: 'z', spacing: 10, count: 2 } }],
      ['run_command', { command: 'rotate', bodies: ['b3'], values: { axis: 'x', angle: 90, px: 0, py: 0, pz: 0 } }],
      ['run_command', { command: 'move', bodies: ['b4'], values: { x: 0, y: 0, z: 5 } }],
    ],
    hand: () => ({
      format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
      nodes: [
        { kind: 'sketch', profile: 'rectangle', min: [20, 0], max: [30, 10], id: 'n0' },
        { kind: 'extrude', sketch: 0, height: 5, id: 'n1', made: { command: 'box', values: { w: 10, d: 10, h: 5, x: 20, y: 0, z: 0 } } },
        { kind: 'circular-pattern', parent: { node: 1, side: 'solid' }, axis: 'z', angleDegrees: 60, count: 6, id: 'n2' },
        { kind: 'linear-pattern', parent: { node: 2, side: 'solid' }, axis: 'z', spacing: 10, count: 2, id: 'n3' },
        { kind: 'rotate', parent: { node: 3, side: 'solid' }, axis: 'x', angleDegrees: 90, pivot: [0, 0, 0], id: 'n4' },
        { kind: 'translate', parent: { node: 4, side: 'solid' }, offset: [0, 0, 5], id: 'n5' },
      ],
      outputs: { b5: { node: 5, side: 'solid' } }, nextId: 6,
    }),
  },
  {
    // Two bodies: a block and a peg through it; the peg's top rim rounded (the chooser), joined to the block by name, and
    // the whole cut down to a 20 × 20 core by intersecting with a box the callback adds.
    name: 'pegged',
    built: () => {
      const p = part('pegged').box({ wMM: 30, dMM: 30, hMM: 10 }).cylinder({ rMM: 5, hMM: 30, xMM: 15, yMM: 15 });
      // (The studio's display gives a closed rim one edge of two names; the kernel's B-rep, two half-circles.)
      const q = p.body('b3').fillet(b => b.edges().curved().sortBy('z').last(1), { radiusMM: 1 });
      return q.body('b1').union('b4').intersect(x => x.box({ wMM: 20, dMM: 20, hMM: 40, xMM: 5, yMM: 5 }));
    },
    agent: [
      ['run_command', { command: 'box', values: { w: 30, d: 30, h: 10, x: 0, y: 0, z: 0 } }],
      ['run_command', { command: 'cylinder', values: { r: 5, h: 30, x: 15, y: 15, z: 0 } }],
      ['run_command', { command: 'fillet', edges: ['n3.side0#2|n3.top', 'n3.side0#1|n3.top'], values: { radius: 1 } }],
      ['run_command', { command: 'union', bodies: ['b1', 'b4'] }],
      ['run_command', { command: 'box', values: { w: 20, d: 20, h: 40, x: 5, y: 5, z: 0 } }],
      ['run_command', { command: 'intersect', bodies: ['b5', 'b7'] }],
    ],
  },
  {
    // Two bodies of sketches on other planes: a drafted tab from a loop on XY lifted 5, and a quarter-turned ring section on YZ.
    name: 'tabs',
    built: () => part('tabs')
      .extrude(sketch(Plane.XY.offset(5)).moveTo([0, 0]).lineTo([30, 0]).arcTo([30, 20], { center: [30, 10] }).lineTo([0, 20]).close(), { hMM: 6, draftDeg: 3 })
      .revolve(sketch(Plane.YZ).rectangle({ wMM: 4, dMM: 6, xMM: 10 }), { angleDeg: 90 }),
    agent: [
      ['add_features', { features: [{ kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [30, 0], center: [30, 10], direction: 'ccw' }, { kind: 'line', start: [30, 20] }, { kind: 'line', start: [0, 20] }], plane: { origin: [0, 0, 5], normal: [0, 0, 1], xAxis: [1, 0, 0] }, sideTags: tags(4) }] }],
      ['run_command', { command: 'extrude', values: { h: 6, draft: 3 } }],
      ['add_features', { features: [{ kind: 'sketch', profile: 'rectangle', min: [10, 0], max: [14, 6], plane: YZ, sideTags: tags(4) }] }],
      ['run_command', { command: 'revolve', values: { axis: 'y', deg: 90 } }],
    ],
    hand: () => ({
      format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
      nodes: [
        { kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [30, 0], center: [30, 10], direction: 'ccw' }, { kind: 'line', start: [30, 20] }, { kind: 'line', start: [0, 20] }], plane: { origin: [0, 0, 5], normal: [0, 0, 1], xAxis: [1, 0, 0] }, sideTags: tags(4), id: 'n0' },
        { kind: 'extrude', sketch: 0, height: 6, draft: 3, id: 'n1' },
        { kind: 'sketch', profile: 'rectangle', min: [10, 0], max: [14, 6], plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] }, sideTags: tags(4), id: 'n2' },
        { kind: 'revolve', sketch: 2, axis: 'y', angleDegrees: 90, id: 'n3' },
      ],
      outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
    } as StudioDoc),
  },
];

async function agentDoc(calls: Call[]): Promise<StudioDoc> {
  const was = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = '3';
  try {
    const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
    let s: ChatState = { doc: part().doc, bodies: [] };
    for (const [tool, args] of calls) {
      const r = await runTool(s, tool, args, evaluate);
      assert.ok(!r.isError, `${tool} ${JSON.stringify(args)}: ${r.content}`);
      s = r.state;
    }
    return s.doc;
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
}

// (exportStudioStep stamps the export's time in FILE_NAME; the two runs are compared without it.)
const unstamped = (text: string) => text.replace(/'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d'/g, "'stamp'");

for (const c of CASES) {
  test(`${c.name}: the facade writes what the agent's run_command and add_features write, byte for byte`, async () => {
    assert.equal(JSON.stringify(c.built().doc), JSON.stringify(await agentDoc(c.agent)));
    if (c.hand) assert.equal(JSON.stringify(c.built().doc), JSON.stringify(c.hand()));
  });
  test(`${c.name}: its bodies, mass and STEP are the core functions' on that document`, async () => {
    const doc = await agentDoc(c.agent), r = evaluateDoc(doc, 7), p = c.built();
    assert.ok(r.ok);
    assert.deepEqual(p.bodies(), r.bodies.map(b => b.key));
    for (const body of r.bodies) {
      // (MMGS: the core's inertia is in kg·mm² today, the facade's in g·mm², api-conventions.md §2.)
      const m = bodyMass(body, 1.2)!, expected = { volumeMM3: body.volumeMM3, massG: m.massG, centroidMM: m.centroid, inertiaGMM2: m.inertia.map(row => row.map(v => v * 1000)) };
      assert.equal(JSON.stringify(p.body(body.key).mass({ densityGPerCm3: 1.2 })), JSON.stringify(expected));
    }
    const core = exportStudioStep(doc, { name: c.name });
    assert.equal(unstamped(p.step()), unstamped(core.text));
  });
}

test('a body chooser leaves the document as it was, and follows its body through the verbs that replace it', () => {
  const p = part().box({ wMM: 30, dMM: 30, hMM: 10 }).cylinder({ rMM: 5, hMM: 30, xMM: 15, yMM: 15 });
  assert.equal(JSON.stringify(p.body('b3').doc), JSON.stringify(p.doc));
  const q = p.body('b3').fillet(b => b.edges().curved().sortBy('z').last(1), { radiusMM: 1 });
  assert.deepEqual(q.bodies(), ['b1', 'b4']);
  assert.equal(q.mass('al6061').volumeMM3, q.body('b4').mass('al6061').volumeMM3);
});

test('the growth\'s refusals are typed: the facade\'s own, and the studio command\'s', () => {
  const refusal = (f: () => unknown) => { try { f(); } catch (e) { return e; } assert.fail('no refusal'); };
  const two = () => part().box({ wMM: 10, dMM: 10, hMM: 10 }).cylinder({ rMM: 2, hMM: 10, xMM: 30 });
  const cases: [string, () => unknown][] = [
    ['BODY_AMBIGUOUS', () => two().mass('al6061')],
    ['BODY_UNKNOWN', () => two().body('nope')],
    ['VALUE', () => two().body('b1').union('b1')],
    ['SELECTION_ONE', () => two().body('b1').subtract(x => x.box({ wMM: 1, dMM: 1, hMM: 1 }).box({ wMM: 1, dMM: 1, hMM: 1, xMM: 5 }))],
    ['VALUE', () => part().box({ wMM: 10, dMM: 10, hMM: 10, yMM: 20 }).circularPattern({ axis: 'x', count: 5 })],
    // (The studio's command allows 2–24 copies in a row: its own check, as run_command's.)
    ['VALUE', () => part().box({ wMM: 10, dMM: 10, hMM: 10 }).linearPattern({ axis: 'x', spacingMM: 20, count: 30 })],
    ['NO_BODY', () => part().shell({ tMM: 1 })],
  ];
  for (const [code, f] of cases) {
    const e = refusal(f);
    assert.ok(e instanceof BarocssError, `${code}: ${String(e)}`);
    assert.equal(e.code, code, e.message);
  }
});

// R7.4b, the selector-stability test (Onshape FeatureScript's point): after an upstream edit is re-evaluated, the names a
// feature stores still pick the same edge — moved with the edit — or the part is refused, typed; never another edge.
const bracket = () => part('bracket').box({ wMM: 80, dMM: 40, hMM: 10 })
  .hole(b => b.faces().facing('+z'), { dMM: 8, xMM: 20, yMM: 20 })
  .fillet(b => b.edges().along('z'), { radiusMM: 2 });
const before = (doc: StudioDoc, n: number) => part('before', prefixDoc(doc, doc.nodes.length - n));
const volume = (p: StudioPart) => p.mass({ densityGPerCm3: 1 }).volumeMM3;
type Loose = Record<string, unknown>;

test('stability: a dimension edit upstream — the stored names pick the same edges, moved with it', () => {
  const was = bracket(), edited = was.doc;
  edited.nodes[0] = { ...edited.nodes[0], max: [60, 40] } as StudioDoc['nodes'][number];
  ((edited.nodes[1] as Loose).made as { values: Loose }).values.w = 60;
  const now = part('bracket', edited), stored = (edited.nodes[3] as { edges: string[] }).edges;
  assert.deepEqual(before(edited, 1).select().edges().along('z').names(), stored);
  const far = before(edited, 1).select().edges().where(e => e.names.includes('n1.side0|n1.side1')).list();
  assert.deepEqual(far.map(e => [e.a[0], e.b[0]]), [[60, 60]]);
  assert.ok(Math.abs(volume(was) - volume(now) - 20 * 40 * 10) < 1e-6, `${volume(was) - volume(now)}`);
});

test('stability: a vertex inserted upstream (the studio sketcher\'s edit, keeping the side tags) — the same named edge', () => {
  const corner = (b: ReturnType<StudioPart['select']>) => b.edges().along('z').where(e => e.a[0] === 40 && e.a[1] === 40);
  const was = part('tab').extrude(sketch().polygon([[0, 0], [40, 0], [40, 40], [0, 40]]), { hMM: 10 }).fillet(corner, { radiusMM: 3 }), edited = was.doc;
  assert.deepEqual((edited.nodes[2] as { edges: string[] }).edges, ['n1.side[e2]|n1.side[e3]']);
  edited.nodes[0] = { ...edited.nodes[0], points: [[0, 0], [20, -5], [40, 0], [40, 40], [0, 40]], sideTags: { outer: ['e1', 'e5', 'e2', 'e3', 'e4'] } } as StudioDoc['nodes'][number];
  const named = before(edited, 1).select().edges().where(e => e.names.includes('n1.side[e2]|n1.side[e3]')).list();
  assert.deepEqual(named.map(e => [e.a[0], e.a[1]]), [[40, 40]]);
  const fresh = part('tab').extrude(sketch().polygon([[0, 0], [20, -5], [40, 0], [40, 40], [0, 40]]), { hMM: 10 }).fillet(corner, { radiusMM: 3 });
  assert.ok(Math.abs(volume(part('tab', edited)) - volume(fresh)) < 1e-9 * volume(fresh));
});

test('stability: an edit that takes the named edges away — a typed refusal, never another edge', () => {
  const edited = bracket().doc;
  edited.nodes[0] = { kind: 'sketch', profile: 'circle', center: [40, 20], radius: 20, id: 'n0' };
  let e: unknown;
  try { part('bracket', edited); } catch (error) { e = error; }
  assert.ok(e instanceof BarocssError, String(e));
  assert.equal(e.code, 'SELECTION'); assert.equal(e.where, 'evaluate');
  assert.match(e.message, /^\[SELECTION\] no edge named n1\.side0\|n1\.side1/);
});
