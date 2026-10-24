// The object facade (`@barocss/cad-model/api`, experimental, R7): the bracket built through it, its `.doc` the very
// document the core functions build, its mass and STEP the core's, a part never changed by a method, and the refusals
// typed. The Object API page includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { part, BarocssError } from '@barocss/cad-model/api';
// #endregion import
import { rectanglePart, withNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, stepFor } from '@barocss/cad-model/engine/evaluate';
import { bodyMass } from '@barocss/cad-model/app/mass';

/** STEP text with its FILE_NAME line (the export's time stamp) set aside. */
const unstamped = text => text.replace(/^FILE_NAME\(.*$/m, '');

test('the bracket through the facade: the core\'s document, mass and STEP', () => {
  // #region bracket
  // An 80 × 40 × 10 block, a Ø8 hole through it at (20, 20), its four vertical edges rounded R2.
  const bracket = part('bracket')
    .box(80, 40, 10)
    .hole({ at: [20, 20], diameterMM: 8 })
    .fillet(body => body.edges().along('z'), 2);

  const mass = bracket.mass('al6061');      // { volumeMM3, massG, centroidMM, inertiaGMM2 }, in MMGS
  const step = bracket.step();              // STEP AP214 text
  const meshes = bracket.meshes();          // [{ key, positions, normals, indices }], one a body
  // #endregion bracket

  // #region core
  // The same document through the core functions: the node indices and edge names written out by hand.
  let doc = rectanglePart(80, 40, 10);
  doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [20, 20], radius: 4 });
  doc = withNode(doc, { kind: 'fillet', parent: { node: 2, side: 'solid' },
    edges: ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3'], radius: 2 });
  assert.equal(JSON.stringify(bracket.doc), JSON.stringify(doc));   // byte for byte
  // #endregion core

  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok);
  const core = bodyMass(r.bodies[0], 2.7);
  assert.equal(mass.volumeMM3, r.bodies[0].volumeMM3);
  assert.equal(mass.massG, core.massG);
  assert.deepEqual(mass.centroidMM, core.centroid);
  const coreStep = stepFor(doc, 'bracket');
  assert.ok('text' in coreStep);
  assert.equal(unstamped(step), unstamped(coreStep.text));
  assert.equal(meshes.length, 1);
  assert.equal(meshes[0].positions.length, meshes[0].normals.length);
});

test('immutable: a method returns a new part; .doc is a copy', () => {
  // #region immutable
  const plate = part('plate').box(60, 40, 8);
  const holed = plate.hole({ at: [30, 20], diameterMM: 6 });
  assert.equal(plate.doc.nodes.length, 2);    // the sketch and its extrude, still
  assert.equal(holed.doc.nodes.length, 3);
  const copy = holed.doc; copy.nodes.length = 0;
  assert.equal(holed.doc.nodes.length, 3);    // changing the copy changes nothing
  // #endregion immutable
});

test('selectors: typed filters that hand back the core\'s names', () => {
  // #region select
  const plate = part('plate').box(60, 40, 8);
  const top = plate.select().faces().facing('+z');
  assert.deepEqual(top.names(), ['n1.top']);
  assert.equal(top.edges().count, 4);                       // the top face's four edges
  assert.equal(plate.select().edges().along('z').count, 4); // the four vertical edges
  // #endregion select
});

test('refusals: one error class, the facade\'s own codes and the core\'s passed through', () => {
  // #region refusals
  assert.throws(() => part().hole({ at: [0, 0], diameterMM: 4 }),
    e => e instanceof BarocssError && e.code === 'NO_BODY' && e.where === 'facade' && e.message.startsWith('[NO_BODY] '));
  assert.throws(() => part().box(10, 10, 10).mass('unobtainium'),
    e => e instanceof BarocssError && e.code === 'MATERIAL_UNKNOWN');
  // A fillet too large for its walls: the kernel refuses it when the part is evaluated, here by .mass().
  assert.throws(() => part().box(10, 10, 10).fillet(body => body.edges().along('z'), 50).mass('al6061'),
    e => e instanceof BarocssError && e.where === 'evaluate' && /^\[[A-Z_]+\] /.test(e.message) && !!e.details?.friendly);
  // #endregion refusals
});
