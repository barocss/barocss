import test from 'node:test';
import assert from 'node:assert/strict';
import { part, BarocssError } from '../dist/api/index.js';
import { evaluateCadPart, reevaluate, outputOf, massPropertiesOf, checkBrep } from '../dist/index.js';

// Fixed fixture: mm, mm^3; explicit density 1 g/cm^3 for comparisons, not a material claim.
// Reuse the existing part-model relative criterion without changing production tolerances.
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${actual} vs ${expected}`);
const edgeA = 'extrude1.side0|extrude1.side1', edgeB = 'extrude2.side0|extrude2.side1';
const boxes = () => part('separate-boxes')
  .box({ w: 20, d: 10, h: 8 })
  .box({ w: 20, d: 10, h: 8, x: 40 });
const named = (body, name) => body.edges().where(edge => edge.names.includes(name));
const ends = (edge, x, y, height) => {
  for (const p of [edge.a, edge.b]) { close(p[0], x); close(p[1], y); }
  close(Math.min(edge.a[2], edge.b[2]), 0);
  close(Math.max(edge.a[2], edge.b[2]), height);
};
const sourceEdge = (model, id, name, x, height) => {
  const query = named(model.body(id).select(), name);
  assert.equal(query.count, 1);
  assert.deepEqual(query.names(), [name]);
  ends(query.list()[0], x, 0, height);
};
const checkBody = (output, x, height, expectedVolume, tangents) => {
  assert.equal(output.bodyCount, 1);
  assert.equal(checkBrep(output.brep).valid, true);
  const points = output.brep.vertices.map(vertex => vertex.point);
  for (const [axis, lo, hi] of [[0, x, x + 20], [1, 0, 10], [2, 0, height]]) {
    close(Math.min(...points.map(p => p[axis])), lo);
    close(Math.max(...points.map(p => p[axis])), hi);
  }
  close(massPropertiesOf(output).volume, expectedVolume);
  for (const [tx, ty] of tangents) {
    const matches = output.brep.edges.filter(edge => edge.curve.degree === 1 && edge.curve.controlPoints.length === 2)
      .map(edge => edge.curve.controlPoints)
      .filter(cp => cp.every(p => Math.abs(p[0] - tx) <= 1e-9 * Math.max(1, Math.abs(tx)) && Math.abs(p[1] - ty) <= 1e-9 * Math.max(1, Math.abs(ty))));
    assert.equal(matches.length, 1, `one target-local tangent edge at ${tx},${ty}`);
    const [a, b] = matches[0];
    ends({ a, b }, tx, ty, height);
  }
};

test('public named fillets stay on their separate boxes after one source height edit', () => {
  const source = boxes(), sourceBefore = source.doc;
  assert.deepEqual(source.bodies(), ['extrude1', 'extrude2']);
  sourceEdge(source, 'extrude1', edgeA, 20, 8);
  sourceEdge(source, 'extrude2', edgeB, 60, 8);
  const first = source.body('extrude1').fillet(body => named(body, edgeA), { radius: 2 });
  const finished = first.body('extrude2').fillet(body => named(body, edgeB), { radius: 2 });
  assert.deepEqual(first.bodies(), ['extrude2', 'fillet1']);
  assert.deepEqual(finished.bodies(), ['fillet1', 'fillet2']);
  const document = finished.doc;
  assert.deepEqual(document.features.filter(f => f.kind === 'fillet'), [
    { id: 'fillet1', kind: 'fillet', target: 'extrude1', edges: [edgeA], radius: 2 },
    { id: 'fillet2', kind: 'fillet', target: 'extrude2', edges: [edgeB], radius: 2 },
  ]);
  const before = evaluateCadPart(document), a0 = outputOf(before, 'fillet1'), b0 = outputOf(before, 'fillet2');
  assert.deepEqual(before.outputs.map(output => [output.id, output.feature]), [['fillet1', 'fillet1'], ['fillet2', 'fillet2']]);
  // A vertical R2 fillet removes cross-section 4-pi; retained area is 196+pi.
  checkBody(a0, 0, 8, 1568 + 8 * Math.PI, [[18, 0], [20, 2]]);
  checkBody(b0, 40, 8, 1568 + 8 * Math.PI, [[58, 0], [60, 2]]);
  close(finished.body('fillet1').mass({ density: 1 }).volume, 1568 + 8 * Math.PI);
  close(finished.body('fillet2').mass({ density: 1 }).volume, 1568 + 8 * Math.PI);

  // Edit only the authored upstream height; keep target IDs and stored edge names unchanged.
  const editedDocument = { ...document, features: document.features.map(f => f.id === 'extrude1' ? { ...f, height: 12 } : f) };
  const after = reevaluate(before, { document: editedDocument }), a1 = outputOf(after, 'fillet1'), b1 = outputOf(after, 'fillet2');
  const edited = part('edited-boxes', editedDocument);
  const savedFillets = document.features.filter(f => f.kind === 'fillet');
  assert.deepEqual(after.document.features.filter(f => f.kind === 'fillet'), savedFillets);
  assert.deepEqual(edited.doc.features.filter(f => f.kind === 'fillet'), savedFillets);
  assert.deepEqual(edited.bodies(), ['fillet1', 'fillet2']);
  assert.deepEqual(after.outputs.map(output => [output.id, output.feature]), [['fillet1', 'fillet1'], ['fillet2', 'fillet2']]);
  checkBody(a1, 0, 12, 2352 + 12 * Math.PI, [[18, 0], [20, 2]]);
  checkBody(b1, 40, 8, 1568 + 8 * Math.PI, [[58, 0], [60, 2]]);
  close(edited.body('fillet1').mass({ density: 1 }).volume, 2352 + 12 * Math.PI);
  assert.deepEqual(b1.brep, b0.brep);
  assert.deepEqual(massPropertiesOf(b1), massPropertiesOf(b0));
  assert.deepEqual(edited.body('fillet2').mass({ density: 1 }), finished.body('fillet2').mass({ density: 1 }));
  for (const id of ['extrude1', 'fillet1']) assert.ok(after.recomputation.evaluated.includes(id), id);
  for (const id of ['extrude2', 'fillet2']) assert.ok(after.recomputation.reused.includes(id), id);
  assert.deepEqual(source.doc, sourceBefore);
  assert.deepEqual(finished.doc, document);
  assert.deepEqual(before.document, document);
});

test('a valid edge name on the other box is refused on the selected target without fallback', () => {
  const source = boxes(), before = source.doc;
  const otherEdge = named(source.body('extrude2').select(), edgeB);
  assert.deepEqual(otherEdge.names(), [edgeB]);
  assert.throws(() => source.body('extrude1').fillet(() => otherEdge, { radius: 2 }), error => {
    assert.ok(error instanceof BarocssError);
    assert.equal(error.code, 'SELECTION');
    assert.equal(error.where, 'evaluate');
    assert.equal(error.details?.feature, 'fillet1');
    assert.match(error.message, /no edge named extrude2\.side0\|extrude2\.side1/);
    return true;
  });
  assert.deepEqual(source.doc, before);
  assert.deepEqual(source.bodies(), ['extrude1', 'extrude2']);
});
