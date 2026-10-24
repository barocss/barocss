// The object facade (`@barocss/cad-model/api`): one bracket three ways — the StudioDoc written by hand, the agent's
// run_command calls, and the facade — all one document byte for byte; its mass and STEP the core's, a part never changed
// by a method, a body's material, parameters, configurations and suppression, the studio's own commands (gears, a
// spring, a fastener from a person's rows), an assembly placed, mated, varied and framed, and the refusals typed. The Object API
// page includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { part, assembly, Location, param, BarocssError } from '@barocss/cad-model/api';
// #endregion import
import { evaluateDoc, exportStudioStep } from '@barocss/cad-model/engine/evaluate';
import { bodyMass } from '@barocss/cad-model/app/mass';
import { runTool } from '@barocss/cad-model/chat/tools';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  // 3. The facade: the same command names, the same value names (no unit suffix), the selectors in place of
  // the names.
  const bracket = part('bracket')
    .box({ w: 80, d: 40, h: 10 })
    .hole(body => body.faces().facing('+z'), { d: 8, x: 20, y: 20 })
    .fillet(body => body.edges().along('z'), { radius: 2 });

  const mass = bracket.mass('al6061');      // or mass({ density: 2.7 }): { volumeMM3, massG, centroidMM, inertiaGMM2 }
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
  assert.equal(JSON.stringify(bracket.mass({ density: 2.7 })), JSON.stringify(mass));
  const coreStep = exportStudioStep(raw, { name: 'bracket' });
  assert.equal(unstamped(step), unstamped(coreStep.text));
  assert.equal(meshes.length, 1);
  assert.equal(meshes[0].positions.length, meshes[0].normals.length);
});

test('immutable: a method returns a new part; .doc is a copy', () => {
  // #region immutable
  const plate = part('plate').box({ w: 60, d: 40, h: 8 });
  const holed = plate.hole(body => body.faces().facing('+z'), { d: 6, x: 30, y: 20 });
  assert.equal(plate.doc.nodes.length, 2);    // the sketch and its extrude, still
  assert.equal(holed.doc.nodes.length, 3);
  const copy = holed.doc; copy.nodes.length = 0;
  assert.equal(holed.doc.nodes.length, 3);    // changing the copy changes nothing
  // #endregion immutable
});

test('selectors: typed filters that hand back the core\'s names', () => {
  // #region select
  const plate = part('plate').box({ w: 60, d: 40, h: 8 });
  const top = plate.select().faces().facing('+z');
  assert.deepEqual(top.names(), ['n1.top']);
  assert.equal(top.edges().count, 4);                       // the top face's four edges
  assert.equal(plate.select().edges().along('z').count, 4); // the four vertical edges
  // #endregion select
});

test('refusals: one error class, the facade\'s own codes and the core\'s passed through', () => {
  // #region refusals
  assert.throws(() => part().hole(body => body.faces().facing('+z'), { d: 4, x: 0, y: 0 }),
    e => e instanceof BarocssError && e.code === 'NO_BODY' && e.where === 'facade' && e.message.startsWith('[NO_BODY] '));
  assert.throws(() => part().box({ w: 10, d: 10, h: 10 }).mass('unobtainium'),
    e => e instanceof BarocssError && e.code === 'MATERIAL_UNKNOWN');
  // A fillet too large for its walls: the kernel's own code, with the core's words.
  assert.throws(() => part().box({ w: 10, d: 10, h: 10 }).fillet(body => body.edges().along('z'), { radius: 50 }).mass('al6061'),
    e => e instanceof BarocssError && e.code === 'RADIUS_EXCEEDS_FACE' && e.where === 'evaluate' && !!e.details?.friendly);
  // #endregion refusals
});

test('a material by its library id: set on the body, weighed in it, carried by its meshes', () => {
  // #region material
  const plate = part('plate').box({ w: 60, d: 40, h: 8 }).material('al6061');   // as set_material writes it
  assert.equal(JSON.stringify(plate.mass()), JSON.stringify(plate.mass('al6061')));    // weighed in its own material
  assert.equal(plate.meshes()[0].material, 'al6061');                                  // for a scene to look up
  // #endregion material
});

test('an assembly: a pin placed, mated into a plate\'s bore, an input with a variant, a tool frame', () => {
  // #region assembly
  // A 60 × 40 × 8 plate with a Ø10 bore at (20, 20), and a Ø10 pin 30 long.
  const plate = part('plate').box({ w: 60, d: 40, h: 8 }).hole(b => b.faces().facing('+z'), { d: 10, x: 20, y: 20 });
  const pin = part('pin').cylinder({ r: 5, h: 30 });

  const fixture = assembly('fixture', plate)                  // the base part, fixed at the origin
    .addPart('pin', pin, { at: Location.at([100, 0, 0]) })     // placed off to the side
    .addMate('concentric', { part: 'base', face: b => b.faces().curved() }, { part: 'pin', face: b => b.faces().curved() })
    .addMate('distance', { part: 'base', face: b => b.faces().facing('-z') }, { part: 'pin', face: b => b.faces().facing('-z') },
      { distance: 0, flip: true })                           // the bottoms flush
    .inputs({ depth: { type: 'number', unit: 'mm', default: 0, min: -10, max: 10,
      bindings: [{ to: 'mate', mate: 'm2', field: 'distance' }] } })   // an input driving the second mate
    .variants({ low: { depth: -5 } })
    .frames({ tip: { link: 'pin', at: Location.at([0, 0, 30]), kind: 'tool' } });

  assert.deepEqual(fixture.placements()[0].position, [20, 20, 0]);                // solved: in the bore
  assert.deepEqual(fixture.variant({ depth: -5 }).placements()[0].position, [20, 20, 5]);
  assert.deepEqual(fixture.framePoses()[0].position, [20, 20, 30]);               // the tip, on the pin's top
  assert.deepEqual(fixture.meshes().map(m => m.key), ['base/b2', 'p1/b2']);         // each part where it stands
  // #endregion assembly
  assert.deepEqual(fixture.problems(), []);
  assert.throws(() => fixture.addPart('pin', pin), e => e instanceof BarocssError && e.code === 'NAME_TAKEN');
});

// An 80 × 40 × 10 plate, its width W and its corners' radius R parameters, its four vertical edges rounded R.
const plate = () => part('plate').parameter('W', 80).parameter('R', 2)
  .box({ w: param('W'), d: 40, h: 10 })
  .fillet(body => body.edges().along('z'), { radius: param('R') });
/** The plate's volume at width w and corner radius r. */
const plateVolume = (w, r) => w * 40 * 10 - 4 * (r ** 2 - Math.PI * r ** 2 / 4) * 10;
const volume = p => p.mass({ density: 1 }).volumeMM3;
const near = (a, b) => Math.abs(a - b) < 1e-9 * b;

test('parameters: bound as the studio\'s editor binds them, edited by withParameters', () => {
  // #region parameters
  const p = plate();
  assert.deepEqual(p.parameters(), { W: 80, R: 2 });
  assert.deepEqual(p.doc.nodes[0].max, [{ parameter: 'W' }, 40]);    // the sketch's far corner follows W
  assert.deepEqual(p.doc.nodes[2].radius, { parameter: 'R' });      // the fillet's radius follows R

  const narrow = p.withParameters({ W: 60, R: 3 });
  assert.ok(near(volume(narrow), plateVolume(60, 3)));               // the shape built with the new numbers
  assert.deepEqual(narrow.doc.nodes[2].edges, p.doc.nodes[2].edges); // the same named edges
  // #endregion parameters
  assert.throws(() => p.withParameters({ H: 1 }), e => e instanceof BarocssError && e.code === 'PARAMETER_UNKNOWN');
  // A hole's diameter is stored as a radius, so it can't follow a parameter: refused, never baked in.
  assert.throws(() => p.parameter('D', 4).hole(b => b.faces().facing('+z'), { d: param('D'), x: 20, y: 20 }),
    e => e instanceof BarocssError && e.code === 'PARAMETER_UNBINDABLE');
});

test('configurations: saved sets of parameter values', () => {
  // #region configurations
  const p = plate().configuration('wide')                   // the current values, as the panel's Save
    .withParameters({ W: 60 }).configuration('narrow');
  assert.deepEqual(p.configurations(), { wide: { W: 80, R: 2 }, narrow: { W: 60, R: 2 } });
  const wide = p.withConfiguration('wide');                 // its values applied, as the panel's Apply
  assert.deepEqual(wide.parameters(), { W: 80, R: 2 });
  // #endregion configurations
  assert.ok(near(volume(wide), plateVolume(80, 2)));
  assert.throws(() => p.withConfiguration('tall'), e => e instanceof BarocssError && e.code === 'CONFIGURATION_UNKNOWN');
});

test('suppression: a feature switched off by its id, and back', () => {
  // #region suppression
  const p = plate();
  assert.deepEqual(p.features().map(f => [f.id, f.kind]), [['n0', 'sketch'], ['n1', 'extrude'], ['n2', 'fillet']]);
  const sharp = p.suppressed('n2');                          // as the History panel's toggle writes it
  assert.ok(near(volume(sharp), 80 * 40 * 10));              // the unrounded plate
  assert.equal(JSON.stringify(sharp.suppressed('n2', false).doc), JSON.stringify(p.doc));   // back, byte for byte
  // #endregion suppression
});

test('the studio\'s own commands: a gear pair and a spring', () => {
  // #region gears
  // A module-1.5 spur gear of 20 teeth, 10 wide, with a Ø20 bore; then a 40-tooth gear meshing with it along +X.
  const pair = part('pair')
    .gear({ m: 1.5, teeth: 20, b: 10, bore: 20 })
    .gearMesh({ teeth: 40, dir: 0, bore: 16 });
  const [pinion, wheel] = pair.bodies();
  const centre = pair.body(wheel).mass({ density: 1 }).centroidMM;
  assert.ok(Math.abs(centre[0] - 1.5 * (20 + 40) / 2) < 1e-6);   // the centre distance, m (z1 + z2) / 2 = 45

  const spring = part('spring').spring({ type: 'compression', d: 2.5, D: 18, n: 5, p: 6, ends: 'closed-ground', hand: 'right' });
  // #endregion gears
  assert.notEqual(pinion, wheel);
  assert.equal(spring.bodies().length, 1);
});

test('rows from a person\'s file, then a fastener from them', () => {
  // #region fastener
  // The fastener sizes cad-model ships as a sample; your own file loads the same way. None is built in.
  const sizes = { name: 'fastener-sizes.json',
    text: readFileSync(resolve(import.meta.dirname, '../../../packages/barocss-cad-model/samples/rows/fastener-sizes.json'), 'utf8') };
  assert.throws(() => part('bolt').fastener({ kind: 'hex-bolt', size: 'M8', length: '60' }),
    e => e instanceof BarocssError && e.message.includes('[FASTENER_SIZE_ROW] no fastener sizes loaded'));   // no rows: refused
  const bolt = part('bolt')
    .loadRows('fastener-sizes', sizes)        // its receipt names the file, as the studio's Library writes it
    .fastener({ kind: 'hex-bolt', size: 'M8', length: '60' });
  assert.equal(bolt.bodies().length, 1);
  // #endregion fastener
});
