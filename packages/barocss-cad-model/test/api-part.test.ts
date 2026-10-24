// R7, cad-model's facade (the one part over the studio document, api-conventions.md §11): a part built through it
// equals the hand-written StudioDoc byte for byte — the very one the agent's run_command writes for the same commands
// (§12) — and its results equal the core functions' on that document byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, BarocssError, StudioPart } from '../src/api';
import { type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, exportStudioStep } from '../src/engine/evaluate';
import { bodyMass } from '../src/app/mass';
import { runTool, type ChatState } from '../src/chat/tools';

// The bracket by hand: an 80 × 40 × 10 block (the box command's sketch and extrude, its values remembered), a Ø8 hole
// through its top at (20, 20), its four vertical edges rounded R2.
const handWritten = (): StudioDoc => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 40], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1', made: { command: 'box', values: { w: 80, d: 40, h: 10, x: 0, y: 0, z: 0 } } },
    { kind: 'hole', parent: { node: 1, side: 'solid' }, radius: 4, center: [20, 20], face: 'n1.top', id: 'n2' },
    // (Its edges' signatures — the geometry they were picked on — as every commit records them, engine/references.ts.)
    { kind: 'fillet', parent: { node: 2, side: 'solid' }, edges: ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3'], radius: 2, id: 'n3',
      sigs: {
        'n1.side0|n1.side1': { k: 'line', p: [80, 0, 5], d: [0, 0, 1], s: 10 }, 'n1.side0|n1.side3': { k: 'line', p: [0, 0, 5], d: [0, 0, 1], s: 10 },
        'n1.side1|n1.side2': { k: 'line', p: [80, 40, 5], d: [0, 0, 1], s: 10 }, 'n1.side2|n1.side3': { k: 'line', p: [0, 40, 5], d: [0, 0, 1], s: 10 },
      } },
  ],
  outputs: { b3: { node: 3, side: 'solid' } }, nextId: 4,
});

const bracket = () => part('bracket')
  .box({ wMM: 80, dMM: 40, hMM: 10 })
  .hole(body => body.faces().facing('+z'), { dMM: 8, xMM: 20, yMM: 20 })
  .fillet(body => body.edges().along('z'), { radiusMM: 2 });

// (exportStudioStep stamps the export's time in FILE_NAME; the two runs are compared without it.)
const unstamped = (text: string) => text.replace(/'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d'/g, "'stamp'");

test('the facade writes the hand-written document, byte for byte', () => {
  assert.equal(JSON.stringify(bracket().doc), JSON.stringify(handWritten()));
});

test('…the one the agent\'s run_command writes for the same three commands', async () => {
  const was = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = '3';
  try {
    const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
    let s: ChatState = { doc: part().doc, bodies: [] };
    for (const args of [
      { command: 'box', values: { w: 80, d: 40, h: 10, x: 0, y: 0, z: 0 } },
      { command: 'hole', faces: ['n1.top'], values: { type: 'through', d: 8, x: 20, y: 20 } },
      { command: 'fillet', edges: ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3'], values: { radius: 2 } },
    ]) {
      const r = await runTool(s, 'run_command', args, evaluate);
      assert.ok(!r.isError, r.content);
      s = r.state;
    }
    assert.equal(JSON.stringify(s.doc), JSON.stringify(bracket().doc));
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
});

test('its mass, meshes and STEP are the core functions\' on that document, byte for byte', () => {
  const doc = handWritten(), r = evaluateDoc(doc, 7);
  assert.ok(r.ok);
  const body = r.bodies[0], props = bodyMass(body, 2.7)!;
  // (MMGS: the core's inertia is in kg·mm² today, the facade's in g·mm², api-conventions.md §2.)
  const expected = { volumeMM3: body.volumeMM3, massG: props.massG, centroidMM: props.centroid, inertiaGMM2: props.inertia.map(row => row.map(v => v * 1000)) };
  assert.equal(JSON.stringify(bracket().mass('al6061')), JSON.stringify(expected));
  // (A material id or a density, the same verb as the kernel part's: al6061 is 2.7 g/cm³.)
  assert.equal(JSON.stringify(bracket().mass({ densityGPerCm3: 2.7 })), JSON.stringify(expected));
  const [mesh] = bracket().meshes();
  assert.equal(mesh.key, body.key);
  assert.deepEqual([Buffer.from(mesh.positions.buffer), Buffer.from(mesh.normals.buffer), Buffer.from(mesh.indices.buffer)], [Buffer.from(body.mesh.positions.buffer), Buffer.from(body.mesh.normals.buffer), Buffer.from(body.mesh.indices.buffer)]);
  const core = exportStudioStep(doc, { name: 'bracket' });
  assert.equal(unstamped(bracket().step()), unstamped(core.text));
});

test('every method returns a new part of its own kind and leaves the old one as it was', () => {
  const block = part('b').box({ wMM: 80, dMM: 40, hMM: 10 }), before = JSON.stringify(block.doc);
  const holed = block.hole(b => b.faces().facing('+z'), { dMM: 8, xMM: 20, yMM: 20 });
  assert.ok(holed instanceof StudioPart, 'the studio layer is kept through the chain');
  assert.equal(JSON.stringify(block.doc), before);
  assert.notEqual(JSON.stringify(holed.doc), before);
  // (`.doc` is a copy: changing it changes nothing in the part.)
  const copy = holed.doc; copy.nodes.length = 0;
  assert.equal(holed.doc.nodes.length, 3);
});

test('typed selectors read the core\'s edges and faces by their names', () => {
  const body = part().box({ wMM: 80, dMM: 40, hMM: 10 }).hole(b => b.faces().facing('+z'), { dMM: 8, xMM: 20, yMM: 20 }).select();
  assert.deepEqual(body.edges().along('z').names(), ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3']);
  assert.deepEqual(body.faces().facing('+z').names(), ['n1.top']);
  // The top face's edges: its four sides and the hole's rim (a closed curve, two names).
  const top = body.faces().facing('+z').edges();
  assert.equal(top.count, 5);
  assert.equal(top.curved().names().length, 2);
  assert.deepEqual(body.edges().along('x').sortBy('z').last(2).names(), ['n1.side0|n1.top', 'n1.side2|n1.top']);
});

test('refusals are typed: the facade\'s own, and the core\'s passed through with its code', () => {
  const refusal = (f: () => unknown) => { try { f(); } catch (e) { return e; } assert.fail('no refusal'); };
  const e1 = refusal(() => part().hole(b => b.faces().facing('+z'), { dMM: 4, xMM: 0, yMM: 0 }));
  assert.ok(e1 instanceof BarocssError); assert.equal(e1.code, 'NO_BODY'); assert.equal(e1.where, 'facade');
  const e2 = refusal(() => part().box({ wMM: 10, dMM: 10, hMM: 10 }).fillet(b => b.edges().along('z').where(() => false), { radiusMM: 1 }));
  assert.ok(e2 instanceof BarocssError); assert.equal(e2.code, 'SELECTION_EMPTY');
  const e3 = refusal(() => part().box({ wMM: 10, dMM: 10, hMM: 10 }).mass('unobtainium'));
  assert.ok(e3 instanceof BarocssError); assert.equal(e3.code, 'MATERIAL_UNKNOWN');
  // A fillet larger than its walls: the kernel refuses it, and the facade passes its code and words on.
  const e4 = refusal(() => part().box({ wMM: 10, dMM: 10, hMM: 10 }).fillet(b => b.edges().along('z'), { radiusMM: 8 }).mass('al6061'));
  assert.ok(e4 instanceof BarocssError); assert.equal(e4.where, 'evaluate');
  // (The core's code, when it gave one, is the refusal's: the kernel's bracketed code, or its error's kind.)
  const given = (e4.details?.friendly as { code?: string } | undefined)?.code;
  assert.ok(given, 'the core gave a code'); assert.equal(e4.code, given); assert.notEqual(e4.code, 'EVALUATION');
  assert.match(e4.message, /^\[[A-Z_]+\] /);
});
