// The object facade (`@barocss/cad-model/api`, experimental, R7): one bracket three ways — the StudioDoc written by
// hand, the agent's run_command calls, and the facade — all one document byte for byte; its mass and STEP the core's,
// a part never changed by a method, and the refusals typed. The Object API page includes the #region blocks.
// Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { part, BarocssError } from '@barocss/cad-model/api';
// #endregion import
import { evaluateDoc, exportStudioStep } from '@barocss/cad-model/engine/evaluate';
import { bodyMass } from '@barocss/cad-model/app/mass';
import { runTool } from '@barocss/cad-model/chat/tools';

/** STEP text with its FILE_NAME line (the export's time stamp) set aside. */
const unstamped = text => text.replace(/^FILE_NAME\(.*$/m, '');

// #region raw
// 1. The document, as the studio's commands write it: the box's values remembered (`made`), the face the hole went
// into, and each filleted edge's geometry where it was picked (`sigs`).
const EDGES = ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3'];
const raw = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 40], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1', made: { command: 'box', values: { w: 80, d: 40, h: 10, x: 0, y: 0, z: 0 } } },
    { kind: 'hole', parent: { node: 1, side: 'solid' }, radius: 4, center: [20, 20], face: 'n1.top', id: 'n2' },
    { kind: 'fillet', parent: { node: 2, side: 'solid' }, edges: EDGES, radius: 2, id: 'n3',
      sigs: {
        'n1.side0|n1.side1': { k: 'line', p: [80, 0, 5], d: [0, 0, 1], s: 10 }, 'n1.side0|n1.side3': { k: 'line', p: [0, 0, 5], d: [0, 0, 1], s: 10 },
        'n1.side1|n1.side2': { k: 'line', p: [80, 40, 5], d: [0, 0, 1], s: 10 }, 'n1.side2|n1.side3': { k: 'line', p: [0, 40, 5], d: [0, 0, 1], s: 10 },
      } },
  ],
  outputs: { b3: { node: 3, side: 'solid' } }, nextId: 4 };
// #endregion raw

test('one bracket three ways: the document by hand, the agent\'s commands and the facade', async () => {
  // #region commands
  // 2. The agent's v2 commands (the features tool's `command`, run_command): the faces and edges by persistent name.
  const commands = [
    { command: 'box', values: { w: 80, d: 40, h: 10, x: 0, y: 0, z: 0 } },
    { command: 'hole', faces: ['n1.top'], values: { type: 'through', d: 8, x: 20, y: 20 } },
    { command: 'fillet', edges: EDGES, values: { radius: 2 } },
  ];
  // #endregion commands
  const was = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = '3';   // L3: the agent's commands apply
  try {
    let state = { doc: part().doc, bodies: [] };
    for (const args of commands) {
      const r = await runTool(state, 'run_command', args, async doc => evaluateDoc(doc, 1));
      assert.ok(!r.isError, r.content);
      state = r.state;
    }
    assert.equal(JSON.stringify(state.doc), JSON.stringify(raw));   // byte for byte
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }

  // #region bracket
  // 3. The facade: the same command names, the same values with their units in the names, the selectors in place of
  // the names.
  const bracket = part('bracket')
    .box({ wMM: 80, dMM: 40, hMM: 10 })
    .hole(body => body.faces().facing('+z'), { dMM: 8, xMM: 20, yMM: 20 })
    .fillet(body => body.edges().along('z'), { radiusMM: 2 });

  const mass = bracket.mass('al6061');      // or mass({ densityGPerCm3: 2.7 }): { volumeMM3, massG, centroidMM, inertiaGMM2 }
  const step = bracket.step();              // STEP AP214 text
  const meshes = bracket.meshes();          // [{ key, positions, normals, indices }], one a body
  // #endregion bracket
  assert.equal(JSON.stringify(bracket.doc), JSON.stringify(raw));   // byte for byte

  const r = evaluateDoc(raw, 1);
  assert.ok(r.ok);
  const core = bodyMass(r.bodies[0], 2.7);
  assert.equal(mass.volumeMM3, r.bodies[0].volumeMM3);
  assert.equal(mass.massG, core.massG);
  assert.deepEqual(mass.centroidMM, core.centroid);
  assert.equal(JSON.stringify(bracket.mass({ densityGPerCm3: 2.7 })), JSON.stringify(mass));
  const coreStep = exportStudioStep(raw, { name: 'bracket' });
  assert.equal(unstamped(step), unstamped(coreStep.text));
  assert.equal(meshes.length, 1);
  assert.equal(meshes[0].positions.length, meshes[0].normals.length);
});

test('immutable: a method returns a new part; .doc is a copy', () => {
  // #region immutable
  const plate = part('plate').box({ wMM: 60, dMM: 40, hMM: 8 });
  const holed = plate.hole(body => body.faces().facing('+z'), { dMM: 6, xMM: 30, yMM: 20 });
  assert.equal(plate.doc.nodes.length, 2);    // the sketch and its extrude, still
  assert.equal(holed.doc.nodes.length, 3);
  const copy = holed.doc; copy.nodes.length = 0;
  assert.equal(holed.doc.nodes.length, 3);    // changing the copy changes nothing
  // #endregion immutable
});

test('selectors: typed filters that hand back the core\'s names', () => {
  // #region select
  const plate = part('plate').box({ wMM: 60, dMM: 40, hMM: 8 });
  const top = plate.select().faces().facing('+z');
  assert.deepEqual(top.names(), ['n1.top']);
  assert.equal(top.edges().count, 4);                       // the top face's four edges
  assert.equal(plate.select().edges().along('z').count, 4); // the four vertical edges
  // #endregion select
});

test('refusals: one error class, the facade\'s own codes and the core\'s passed through', () => {
  // #region refusals
  assert.throws(() => part().hole(body => body.faces().facing('+z'), { dMM: 4, xMM: 0, yMM: 0 }),
    e => e instanceof BarocssError && e.code === 'NO_BODY' && e.where === 'facade' && e.message.startsWith('[NO_BODY] '));
  assert.throws(() => part().box({ wMM: 10, dMM: 10, hMM: 10 }).mass('unobtainium'),
    e => e instanceof BarocssError && e.code === 'MATERIAL_UNKNOWN');
  // A fillet too large for its walls: the kernel's own code, with the core's words.
  assert.throws(() => part().box({ wMM: 10, dMM: 10, hMM: 10 }).fillet(body => body.edges().along('z'), { radiusMM: 50 }).mass('al6061'),
    e => e instanceof BarocssError && e.code === 'RADIUS_EXCEEDS_FACE' && e.where === 'evaluate' && !!e.details?.friendly);
  // #endregion refusals
});
