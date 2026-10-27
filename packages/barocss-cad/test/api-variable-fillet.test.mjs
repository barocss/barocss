import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, BarocssError } from '../dist/api/index.js';
import { evaluateCadPart, outputOf, checkBrep, saveCadPart, loadCadPart } from '../dist/index.js';

// Fixed before candidate source: work/k04-variable-fillet-51a59/oracle.json.
// MMGS; the removed-volume relative comparison is the existing R10.5 1e-9 contract.
const plate = () => part('variable fillet').parameter('R', 1).parameter('E', 3).box({ w: 40, d: 30, h: 10 });
const picked = body => body.edges().along('x').where(e => e.a[1] === 0 && e.b[1] === 0 && e.a[2] === 10 && e.b[2] === 10);
const refused = (run, code, where = 'facade') => assert.throws(run, e => e instanceof BarocssError && e.code === code && e.where === where);
const removed = (r0, r1) => (1 - Math.PI / 4) * 40 * (r0 * r0 + r0 * r1 + r1 * r1) / 3;
function volume(p, r0, r1) {
  const mass = p.mass({ density: 1 }), want = removed(r0, r1), actual = 12000 - mass.volume;
  assert.ok(Math.abs(actual / want - 1) < 1e-9, `${actual} vs ${want}`);
  assert.ok(Math.abs(mass.mass - mass.volume / 1000) <= 1e-12);
  const feature = p.doc.features.at(-1), out = outputOf(evaluateCadPart(p.doc), feature.id), report = checkBrep(out.brep);
  assert.equal(report.valid, true, JSON.stringify(report.issues)); assert.equal(out.brep.bodies.length, 1);
}

test('public variable fillet: one straight edge stores its a/b radius direction and fixed R10.5 removed volume', () => {
  const source = plate(), before = source.doc, selected = picked(source.select()); assert.equal(selected.count, 1);
  const edge = selected.list()[0]; assert.equal(edge.names.length, 1);
  // Selected and stored endpoint direction is checked separately from the symmetric volume.
  // The actual section/contact radius direction is not certified by these assertions.
  assert.deepEqual(edge.a, [0, 0, 10]); assert.deepEqual(edge.b, [40, 0, 10]);
  const options = { radius: 1, endRadius: 3 }, optionsBefore = structuredClone(options), accepted = source.fillet(picked, options);
  const node = accepted.doc.features.at(-1); assert.equal(node.kind, 'fillet'); assert.equal(node.target, 'extrude1');
  assert.deepEqual(node.edges, edge.names); assert.equal(Object.hasOwn(node, 'radius'), false);
  assert.deepEqual(node.radii, [{ at: [0, 0, 10], radius: 1 }, { at: [40, 0, 10], radius: 3 }]);
  volume(accepted, 1, 3);
  const opposite = source.fillet(picked, { radius: 3, endRadius: 1 });
  assert.deepEqual(opposite.doc.features.at(-1).radii, [{ at: [0, 0, 10], radius: 3 }, { at: [40, 0, 10], radius: 1 }]);
  volume(opposite, 3, 1);
  assert.deepEqual(source.doc, before); assert.deepEqual(options, optionsBefore);
  options.endRadius = 4; const copy = accepted.doc; copy.features.at(-1).radii[0].at[0] = 99;
  assert.deepEqual(accepted.doc.features.at(-1), node);
});

test('public variable fillet: end radius binding, parameter edits and codec preserve exact stored endpoint refs', () => {
  const source = plate(), before = source.doc, options = { radius: 1, endRadius: param('E') }, optionsBefore = structuredClone(options);
  const accepted = source.fillet(picked, options), doc = accepted.doc, stored = doc.features.at(-1);
  assert.deepEqual(stored.radii, [{ at: [0, 0, 10], radius: 1 }, { at: [40, 0, 10], radius: { parameter: 'E' } }]);
  volume(accepted, 1, 3);
  const changed = accepted.withParameters({ E: 4 }); volume(changed, 1, 4);
  assert.deepEqual(changed.doc.features, doc.features); assert.equal(changed.parameters().E, 4);
  // Stored Dim edits bypass initial authoring admission: retain the endpoint binding even at equal/near-equal values.
  for (const endRadius of [1, 1 + 5e-10]) {
    const edited = accepted.withParameters({ E: endRadius });
    assert.equal(edited.parameters().E, endRadius); assert.deepEqual(edited.doc.features, doc.features);
    assert.deepEqual(edited.doc.features.at(-1).radii, [{ at: [0, 0, 10], radius: 1 }, { at: [40, 0, 10], radius: { parameter: 'E' } }]);
    volume(edited, 1, endRadius);
  }

  const snapshot = evaluateCadPart(doc), text = saveCadPart(snapshot), loaded = loadCadPart(text);
  assert.deepEqual(loaded.document, snapshot.document);
  assert.deepEqual(outputOf(loaded, stored.id).brep, outputOf(snapshot, stored.id).brep);
  const reopened = part('reopened variable fillet', loaded.document); volume(reopened, 1, 3); volume(reopened.withParameters({ E: 4 }), 1, 4);
  const massBefore = accepted.mass({ density: 1 });
  refused(() => accepted.withParameters({ E: 0 }), 'PARAMETER', 'evaluate');
  assert.deepEqual(accepted.doc, doc); assert.deepEqual(accepted.mass({ density: 1 }), massBefore);
  assert.deepEqual(source.doc, before); assert.deepEqual(options, optionsBefore);
});

test('public variable fillet: equal numeric radii retain constant behavior and invalid options or selections refuse atomically', () => {
  const source = plate(), before = source.doc, constant = source.fillet(picked, { radius: 1 });
  const equal = source.fillet(picked, { radius: 1, endRadius: 1 }); assert.deepEqual(equal.doc, constant.doc);
  assert.deepEqual(equal.mass({ density: 1 }), constant.mass({ density: 1 }));
  const boundConstant = source.fillet(picked, { radius: param('R') });
  assert.deepEqual(boundConstant.doc.features.at(-1).radius, { parameter: 'R' });
  for (const endRadius of [0, -1, NaN, Infinity, 0.05, 1 + 5e-10]) {
    const options = { radius: 1, endRadius }, saved = structuredClone(options);
    refused(() => source.fillet(picked, options), 'VALUE'); assert.deepEqual(options, saved);
  }
  refused(() => source.fillet(picked, { radius: 0.05, endRadius: 3 }), 'VALUE');
  refused(() => source.fillet(picked, { radius: param('R'), endRadius: 3 }), 'PARAMETER_UNBINDABLE');
  refused(() => source.withParameters({ E: 1 }).fillet(picked, { radius: 1, endRadius: param('E') }), 'PARAMETER_UNBINDABLE');
  refused(() => source.fillet(b => b.edges().along('x'), { radius: 1, endRadius: 3 }), 'SELECTION_ONE');
  refused(() => source.fillet(b => b.edges().where(() => false), { radius: 1, endRadius: 3 }), 'SELECTION_EMPTY');
  const curved = part('curved selection').cylinder({ r: 8, h: 10 }), curvedBefore = curved.doc;
  refused(() => curved.fillet(b => b.edges().curved().first(), { radius: 1, endRadius: 3 }), 'VALUE'); assert.deepEqual(curved.doc, curvedBefore);
  // Two actual bodies are distinct from several edges on one body. Explicit focus changes only that body.
  const pair = source.box({ w: 40, d: 30, h: 10, x: 60 }), pairBefore = pair.doc; assert.equal(pair.bodies().length, 2);
  refused(() => pair.fillet(picked, { radius: 1, endRadius: 3 }), 'BODY_AMBIGUOUS');
  const focused = pair.body('extrude1').fillet(picked, { radius: 1, endRadius: 3 });
  assert.equal(focused.doc.features.at(-1).target, 'extrude1');
  assert.deepEqual(focused.body('extrude2').mass({ density: 1 }), pair.body('extrude2').mass({ density: 1 }));
  assert.deepEqual(pair.doc, pairBefore); assert.deepEqual(source.doc, before);
});
