// The kernel's object facade (`@barocss/cad/api`): the bracket over a CadPartDocument, its `.doc` the very document
// written by hand, its mass, STEP and STL the kernel's own; sketches on planes, two bodies chosen and combined, patterns
// and a Location; the display lines; the refusals typed. The Object API page includes the #region blocks.
// Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { part, sketch, Plane, Location, BarocssError } from '@barocss/cad/api';
// #endregion import
import { evaluateCadPart } from '@barocss/cad';

const unstamped = text => text.replace(/^FILE_NAME\(.*$/m, '');

test('the bracket through the kernel facade: the hand-written document, the kernel\'s results', () => {
  // #region bracket
  const bracket = part('bracket')
    .box({ wMM: 80, dMM: 40, hMM: 10 })
    .hole(body => body.faces().facing('+z'), { dMM: 8, xMM: 20, yMM: 20 })
    .fillet(body => body.edges().along('z'), { radiusMM: 2 });

  const mass = bracket.mass({ densityGPerCm3: 2.7 });   // a density: the kernel keeps no material library
  const step = bracket.step();              // STEP AP214 text
  const stl = bracket.stl();                // binary STL
  const meshes = bracket.meshes();          // [{ key, positions, normals, indices }], one a body
  // #endregion bracket

  // #region doc
  // The CadPartDocument it builds: string ids the facade assigns in feature order, each feature naming its target, and
  // the hole the face it went into.
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'sketch1', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 40] },
    { id: 'extrude1', kind: 'extrude', sketch: 'sketch1', height: 10 },
    { id: 'hole1', kind: 'hole', target: 'extrude1', center: [20, 20], radius: 4, face: 'extrude1.top' },
    { id: 'fillet1', kind: 'fillet', target: 'hole1',
      edges: ['extrude1.side0|extrude1.side1', 'extrude1.side0|extrude1.side3', 'extrude1.side1|extrude1.side2', 'extrude1.side2|extrude1.side3'], radius: 2 },
  ] };
  assert.equal(JSON.stringify(bracket.doc), JSON.stringify(doc));   // byte for byte
  // #endregion doc

  const [out] = evaluateCadPart(doc).outputs, kernel = out.massProperties(2700);   // kg/m³ in the kernel
  assert.equal(mass.volumeMM3, kernel.volumeMM3);
  assert.equal(mass.massG, kernel.massKG * 1000);
  assert.equal(unstamped(step), unstamped(out.exportStep({ name: 'bracket' })));
  assert.deepEqual(stl, out.exportStl());
  assert.equal(meshes.length, 1);
  assert.equal(meshes[0].key, 'fillet1');
});

test('refusals: the facade\'s own codes, the kernel\'s passed through with the feature', () => {
  // #region refusals
  const block = part().box({ wMM: 10, dMM: 10, hMM: 10 });
  assert.throws(() => part().mass({ densityGPerCm3: 2.7 }), e => e instanceof BarocssError && e.code === 'NO_BODY');
  assert.throws(() => block.mass({ densityGPerCm3: -1 }), e => e instanceof BarocssError && e.code === 'DENSITY');
  assert.throws(() => part().box({ wMM: -1, dMM: 10, hMM: 10 }), e => e instanceof BarocssError && e.code === 'VALUE');
  // A hole goes into one face: two picked is refused before the kernel.
  assert.throws(() => block.hole(body => body.faces().planar(), { dMM: 2, xMM: 5, yMM: 5 }),
    e => e instanceof BarocssError && e.code === 'SELECTION_ONE');
  // A fillet too large for its walls: the kernel's refusal, with the feature it came from.
  assert.throws(() => block.fillet(body => body.edges().along('z'), { radiusMM: 50 }).mass({ densityGPerCm3: 2.7 }),
    e => e instanceof BarocssError && e.code === 'RADIUS_EXCEEDS_FACE' && e.where === 'evaluate' && e.details?.feature === 'fillet1'
      && e.message.startsWith('[RADIUS_EXCEEDS_FACE] '));
  // #endregion refusals
});

test('sketches on planes: a section revolved into a cup, shelled with its top open', () => {
  // #region sketch
  // A 20 × 30 section on XZ, turned a full turn about Z: a Ø40 × 30 drum. Hollowed to 2 mm walls, its top left open.
  const cup = part('cup')
    .revolve(sketch(Plane.XZ).polygon([[0, 0], [20, 0], [20, 30], [0, 30]]))
    .shell(body => body.faces().facing('+z'), { tMM: 2 });
  const { volumeMM3 } = cup.mass({ densityGPerCm3: 1 });
  assert.ok(Math.abs(volumeMM3 - Math.PI * (20 ** 2 * 30 - 18 ** 2 * 28)) < 1e-6 * volumeMM3);

  // A tab from a loop of lines and an arc, on XY lifted 5, pulled 6 with a 3° draft.
  const tab = part('tab').extrude(sketch(Plane.XY.offset(5))
    .moveTo([0, 0]).lineTo([30, 0]).arcTo([30, 20], { center: [30, 10] }).lineTo([0, 20]).close(), { hMM: 6, draftDeg: 3 });
  assert.deepEqual(tab.doc.features.map(f => f.kind), ['sketch', 'extrude']);
  // #endregion sketch
});

test('two bodies: one chosen, combined with a body by name or a tool the callback adds', () => {
  // #region bodies
  const two = part('pegged')
    .box({ wMM: 30, dMM: 30, hMM: 10 })
    .cylinder({ rMM: 5, hMM: 30, xMM: 15, yMM: 15 });      // a peg standing through the block
  assert.deepEqual(two.bodies(), ['extrude1', 'extrude2']);
  assert.throws(() => two.mass({ densityGPerCm3: 1 }), e => e.code === 'BODY_AMBIGUOUS');
  const joined = two.body('extrude1').union('extrude2');   // the block, joined with the peg by name
  assert.deepEqual(joined.bodies(), ['union1']);

  // A tool added by a callback, in the part's own document: a Ø8 bore cut through a plate.
  const bored = part('plate').box({ wMM: 60, dMM: 40, hMM: 8 })
    .subtract(p => p.cylinder({ rMM: 4, hMM: 20, xMM: 30, yMM: 20, zMM: -6 }));
  // #endregion bodies
  const near = (a, b) => Math.abs(a - b) < 1e-6 * b;
  assert.ok(near(joined.mass({ densityGPerCm3: 1 }).volumeMM3, 30 * 30 * 10 + Math.PI * 25 * 20));
  assert.ok(near(bored.mass({ densityGPerCm3: 1 }).volumeMM3, 60 * 40 * 8 - Math.PI * 16 * 8));
});

test('patterns and a Location: a ring of blocks, two tiers, stood up and lifted', () => {
  // #region patterns
  const ring = part('ring')
    .box({ wMM: 10, dMM: 10, hMM: 5, xMM: 20 })
    .circularPattern({ count: 6 })                           // six round Z, joined into one body
    .linearPattern({ axis: 'z', spacingMM: 10, count: 2 })   // two tiers
    .moved(Location.of({ positionMM: [0, 0, 5], rotationDeg: [90, 0, 0] }));   // turned about X, then lifted
  assert.deepEqual(ring.doc.features.map(f => f.kind),
    ['sketch', 'extrude', 'circular-pattern', 'linear-pattern', 'rotate', 'translate']);
  // #endregion patterns
  assert.ok(Math.abs(ring.mass({ densityGPerCm3: 1 }).volumeMM3 - 12 * 10 * 10 * 5) < 1e-6);
});

test('the meshes carry their display lines', () => {
  // #region lines
  const [mesh] = part().box({ wMM: 10, dMM: 20, hMM: 30 }).meshes();
  assert.equal(mesh.lines.length, 12 * 2 * 3);   // the box's 12 edges, each a segment of two points
  // #endregion lines
});
