// R7.5, cad-model's assembly facade: a base part, a part placed and mated to it by typed face selectors, an input
// driving a mate with a variant, and a tool frame. Its `.doc` equals what the agent's assembly tools write for the same
// calls (add_part, the part's own run_command, add_mate, set_inputs, set_variants, set_frames), byte for byte, and its
// results equal the core's on that document: the solved placements, the variant, the frames' poses, the meshes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, assembly, Location, BarocssError, type Assembly } from '../src/api';
import { placedDoc, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { variantOf } from '../src/assembly/variability';
import { solveDoc } from '../src/chat/assembly';
import { treeOfDoc } from '../src/chat/robot';
import { eulerOf } from '../src/engine/placement';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// A 60 × 40 × 8 plate with a Ø10 bore at (20, 20); a Ø10 pin 30 long, placed off to the side, then mated into the bore
// (concentric) and its bottom flush with the plate's (a distance mate, 0); an input `depth` drives that distance, the
// variant `low` sets it to −5; a tool frame `tip` on the pin's top.
const plate = () => part('plate').box({ wMM: 60, dMM: 40, hMM: 8 }).hole(b => b.faces().facing('+z'), { dMM: 10, xMM: 20, yMM: 20 });
const pin = () => part('pin').cylinder({ rMM: 5, hMM: 30 });
const DEPTH = { type: 'number', unit: 'mm', default: 0, min: -10, max: 10, bindings: [{ to: 'mate', mate: 'm2', field: 'distance' }] };
const fixture = (): Assembly => assembly('fixture', plate())
  .addPart('pin', pin(), { at: Location.at([100, 0, 0]) })
  .addMate('concentric', { part: 'base', face: b => b.faces().curved() }, { part: 'pin', face: b => b.faces().curved() })
  .addMate('distance', { part: 'base', face: b => b.faces().facing('-z') }, { part: 'pin', face: b => b.faces().facing('-z') }, { distanceMM: 0, flip: true })
  .inputs({ depth: DEPTH })
  .variants({ low: { depth: -5 } })
  .frames({ tip: { link: 'pin', at: Location.at([0, 0, 30]), kind: 'tool' } });

const AGENT: [string, Record<string, unknown>][] = [
  ['run_command', { command: 'box', values: { w: 60, d: 40, h: 8, x: 0, y: 0, z: 0 } }],
  ['run_command', { command: 'hole', faces: ['n1.top'], values: { type: 'through', d: 10, x: 20, y: 20 } }],
  ['add_part', { name: 'pin', position: [100, 0, 0], rotation: [0, 0, 0] }],
  ['run_command', { part: 'p1', command: 'cylinder', values: { r: 5, h: 30, x: 0, y: 0, z: 0 } }],
  ['add_mate', { kind: 'concentric', a: { part: 'base', face: 'n2.side0' }, b: { part: 'p1', face: 'n1.side0' } }],
  ['add_mate', { kind: 'distance', a: { part: 'base', face: 'n1.bottom' }, b: { part: 'p1', face: 'n1.bottom' }, distance: 0, flip: true }],
  ['set_inputs', { inputs: { depth: DEPTH } }],
  ['set_variants', { variants: { low: { depth: -5 } } }],
  ['set_frames', { frames: { tip: { link: 'p1', position: [0, 0, 30], rotation: [0, 0, 0], kind: 'tool' } } }],
];
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);

// (The tools without the session's gates — an agent proposes assembly changes for a person to accept, D41; what the
// accepted proposal replays is this.)
async function agentDoc(calls = AGENT): Promise<StudioDoc> {
  let s: ChatState = { doc: part().doc, bodies: [] };
  for (const [tool, args] of calls) {
    const r = await dispatchTool(s, tool, args, evaluate);
    assert.ok(!r.isError, `${tool} ${JSON.stringify(args)}: ${r.content}`);
    s = r.state;
    const e = evaluateDoc(s.doc, 1);
    if (e.ok) s = { ...s, bodies: e.bodies };
  }
  return s.doc;
}

test('the assembly facade writes what the agent\'s assembly tools write, byte for byte', async () => {
  assert.equal(JSON.stringify(fixture().doc), JSON.stringify(await agentDoc()));
});

test('its placements, unmet mates, variant, frame poses and meshes are the core\'s on that document', async () => {
  const doc = await agentDoc(), a = fixture(), solved = solveDoc(doc);
  assert.deepEqual(a.problems(), solved.problems);
  assert.deepEqual(a.placements(), solved.doc.instances!.map(i => ({ part: i.id, name: i.name, positionMM: i.position, rotationDeg: i.rotation })));
  // The pin stands in the bore, its bottom flush with the plate's.
  assert.deepEqual(a.placements()[0].positionMM, [20, 20, 0]);
  const low = variantOf(doc, { depth: -5 });
  assert.equal(JSON.stringify(a.variant({ depth: -5 }).doc), JSON.stringify(low.doc));
  assert.deepEqual(a.variant({ depth: -5 }).placements()[0].positionMM, [20, 20, 5]);
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate);
  assert.deepEqual(a.framePoses(), tree.frames!.map(f => ({ name: f.name, link: f.link, kind: f.kind, positionMM: f.o, rotationDeg: eulerOf(f.R) })));
  assert.deepEqual(a.framePoses()[0].positionMM, [20, 20, 30]);
  const meshes = a.meshes(), inst = doc.instances![0], placed = evaluateDoc(placedDoc(inst, doc), 1);
  assert.ok(placed.ok);
  assert.deepEqual(meshes.map(m => m.key), ['base/b2', 'p1/b2']);
  assert.deepEqual(Buffer.from(meshes[1].positions.buffer), Buffer.from(placed.bodies[0].mesh.positions.buffer));
});

test('every method returns a new assembly; a part reads back as a studio part in its own coordinates', () => {
  const one = assembly('a', plate()), before = JSON.stringify(one.doc);
  const two = one.addPart('pin', pin());
  assert.equal(JSON.stringify(one.doc), before);
  assert.deepEqual(two.parts(), [{ id: 'base', name: 'base' }, { id: 'p1', name: 'pin' }]);
  assert.equal(JSON.stringify(two.part('pin').doc.nodes), JSON.stringify(pin().doc.nodes));
  assert.equal(two.part('pin').mass('al6061').volumeMM3, pin().mass('al6061').volumeMM3);
  // (place: moved and grounded, as place_part writes it.)
  const moved = two.place('pin', { at: Location.of({ positionMM: [5, 0, 0], rotationDeg: [0, 0, 90] }), grounded: true });
  assert.deepEqual(moved.placements(), [{ part: 'p1', name: 'pin', positionMM: [5, 0, 0], rotationDeg: [0, 0, 90], grounded: true }]);
});

test('the assembly\'s refusals are typed: the facade\'s own, and the core\'s passed through with its code', () => {
  const refusal = (f: () => unknown) => { try { f(); } catch (e) { return e; } assert.fail('no refusal'); };
  const two = () => assembly('a', plate()).addPart('pin', pin());
  const cases: [string, () => unknown][] = [
    ['NAME_TAKEN', () => two().addPart('pin', pin())],
    ['PART_UNKNOWN', () => two().place('peg', { at: Location.at([1, 0, 0]) })],
    ['SELECTION_ONE', () => two().addMate('coincident', { part: 'base', face: b => b.faces().planar() }, { part: 'pin', face: b => b.faces().facing('-z') })],
    ['VALUE', () => two().addMate('distance', { part: 'base', face: b => b.faces().facing('+z') }, { part: 'pin', face: b => b.faces().facing('-z') })],
    // (The core's: a frame on a part not joined to the robot's base link.)
    ['FRAME_LINK_STALE', () => two().frames({ tip: { link: 'pin' } })],
    // (The core's: an input whose default the master doesn't hold.)
    ['INPUT_DEFAULT', () => two().addMate('distance', { part: 'base', face: b => b.faces().facing('+z') }, { part: 'pin', face: b => b.faces().facing('-z') }, { distanceMM: 0 }).inputs({ gap: { ...DEPTH, default: 3, bindings: [{ to: 'mate', mate: 'm1', field: 'distance' }] } })],
  ];
  for (const [code, f] of cases) {
    const e = refusal(f);
    assert.ok(e instanceof BarocssError, `${code}: ${String(e)}`);
    assert.equal(e.code, code, e.message);
  }
  // A variant naming no input, and one out of its input's range: variantOf's own BarocssError, passed through as it is.
  for (const values of [{ nope: 1 }, { depth: 50 }] as Record<string, number>[]) {
    let core: unknown;
    try { variantOf(fixture().doc, values); } catch (error) { core = error; }
    const e = refusal(() => fixture().variant(values));
    assert.ok(e instanceof BarocssError && core instanceof BarocssError, String(e));
    assert.match(e.code, /^INPUT_/);
    assert.deepEqual([e.code, e.message, e.where], [core.code, core.message, core.where]);
  }
  // A concentric mate between flat faces: the solver's refusal, in its words.
  const e = refusal(() => two().addMate('concentric', { part: 'base', face: b => b.faces().facing('+z') }, { part: 'pin', face: b => b.faces().facing('-z') }));
  assert.ok(e instanceof BarocssError); assert.equal(e.where, 'evaluate');
});
