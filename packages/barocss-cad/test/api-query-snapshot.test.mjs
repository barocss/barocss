// API input snapshots only. Geometry evaluation and execution are deferred.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Part, param, BodyQuery, EdgeQuery, FaceQuery } from '../dist/api/index.js';

const fixture = () => ({
  edges: [{ names: ['bottom|side'], straight: true, axis: 'x', a: [0, 0, 0], b: [2, 0, 0], faces: ['bottom', 'side'] }],
  faces: [{ name: 'bottom', kind: 'plane', normal: [0, 0, -1], centroid: [1, 1, 0], edges: [0] }],
});

test('public Part snapshots the caller document and each backend result', () => {
  let produced;
  const backend = {
    copy: doc => structuredClone(doc),
    parameters: doc => doc.parameters,
    apply: (doc, spec) => { produced = { ...doc, specs: [...doc.specs, spec] }; return produced; },
  };
  const input = { parameters: { W: 2 }, specs: [] };
  const p = new Part(backend, 'snapshot', input);
  input.parameters.W = 99; input.specs.push({ external: true });
  assert.deepEqual(p.doc, { parameters: { W: 2 }, specs: [] });
  const q = p.box({ w: param('W'), d: 3, h: 4 });
  produced.parameters.W = 88; produced.specs[0].values.w = 88;
  assert.equal(q.doc.parameters.W, 2);
  assert.equal(q.doc.specs[0].values.w, 2);
  assert.deepEqual(p.doc.specs, []);
  const exposed = q.doc;
  exposed.specs[0].values.w = 77;
  assert.equal(q.doc.specs[0].values.w, 2);
});

test('BodyQuery and direct query constructors isolate caller arrays and nested records', () => {
  for (const direct of [false, true]) {
    const input = fixture(), body = new BodyQuery(input.edges, input.faces);
    const edges = direct ? new EdgeQuery(input.edges) : body.edges();
    const faces = direct ? new FaceQuery(input.faces, input.edges) : body.faces();
    input.edges[0].names[0] = 'changed'; input.edges[0].a[0] = 99;
    input.edges[0].b[0] = 99; input.edges[0].faces[0] = 'changed';
    input.faces[0].name = 'changed'; input.faces[0].normal[2] = 1;
    input.faces[0].centroid[0] = 99; input.faces[0].edges.length = 0;
    input.edges.length = 0; input.faces.length = 0;
    assert.deepEqual(edges.names(), ['bottom|side']);
    assert.deepEqual(edges.list()[0].a, [0, 0, 0]);
    assert.deepEqual(edges.list()[0].b, [2, 0, 0]);
    assert.deepEqual(edges.on('bottom').names(), ['bottom|side']);
    assert.deepEqual(faces.facing('-z').names(), ['bottom']);
    assert.deepEqual(faces.list()[0].centroid, [1, 1, 0]);
    assert.deepEqual(faces.edges().names(), ['bottom|side']);
  }
});

test('list and where cannot mutate a query or its sibling selections', () => {
  const input = fixture(), body = new BodyQuery(input.edges, input.faces);
  const edges = body.edges(), faces = body.faces(), sibling = edges.first();
  assert.throws(() => edges.list().pop(), TypeError);
  assert.throws(() => faces.list().pop(), TypeError);
  edges.where(edge => {
    for (const mutate of [() => { edge.axis = 'z'; }, () => edge.names.push('other'),
      () => { edge.a[0] = 9; }, () => { edge.b[0] = 9; }, () => { edge.faces[0] = 'other'; }]) {
      assert.throws(mutate, TypeError);
    }
    return true;
  });
  faces.where(face => {
    for (const mutate of [() => { face.name = 'other'; }, () => { face.normal[2] = 1; },
      () => { face.centroid[0] = 9; }, () => face.edges.pop()]) assert.throws(mutate, TypeError);
    return true;
  });
  assert.deepEqual(sibling.names(), ['bottom|side']);
  assert.deepEqual(edges.along('x').names(), ['bottom|side']);
  assert.deepEqual(faces.facing('-z').edges().names(), ['bottom|side']);
  input.edges[0].names.push('caller is editable');
  input.faces[0].edges.push(0);
  assert.equal(Object.isFrozen(input.edges[0]), false);
  assert.equal(Object.isFrozen(input.faces[0].normal), false);
  assert.deepEqual(edges.names(), ['bottom|side']);
});
