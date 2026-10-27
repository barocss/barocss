// Facade/core ownership regression source; execution is deferred with the API improvement bundle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part } from '../src/api';
import { bodiesOf, meshesOf, stepOf } from '../src/api/core';
import { meshSelection } from '../src/api/select';

const unstamped = (text: string) => text.replace(/'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d'/g, "'stamp'");

test('editing returned mesh buffers does not alter the same document core, selection or STEP', () => {
  const doc = part('isolated').box({ w: 2, d: 3, h: 4 }).doc;
  // Reuse the exact document identity so independent evaluations cannot hide core-cache pollution.
  const [body] = bodiesOf(doc), before = {
    positions: body.mesh.positions.slice(), normals: body.mesh.normals.slice(),
    indices: body.mesh.indices.slice(), lines: body.mesh.edgeLines.slice(),
  };
  const selected = meshSelection(body.mesh), names = selected.faces().names(), edges = selected.edges().names();
  const step = unstamped(stepOf(doc, 'isolated'));
  const [first] = meshesOf(doc), [second] = meshesOf(doc);
  assert.equal(first.key, body.key);
  for (const key of ['positions', 'normals', 'indices', 'lines'] as const) {
    const output = first[key]!, sibling = second[key]!;
    assert.ok(output.length > 0, `${key}: fixture must exercise a non-empty buffer`);
    assert.deepEqual(output, before[key]);
    assert.equal(output.constructor, before[key].constructor);
    assert.notEqual(output.buffer, before[key].buffer);
    assert.notEqual(output.buffer, sibling.buffer);
    output.fill(0);
    assert.deepEqual(sibling, before[key]);
  }
  assert.deepEqual(body.mesh.positions, before.positions);
  assert.deepEqual(body.mesh.normals, before.normals);
  assert.deepEqual(body.mesh.indices, before.indices);
  assert.deepEqual(body.mesh.edgeLines, before.lines);
  const [next] = meshesOf(doc), [core] = bodiesOf(doc);
  for (const key of ['positions', 'normals', 'indices', 'lines'] as const) assert.deepEqual(next[key], before[key]);
  const afterSelection = meshSelection(core.mesh);
  assert.deepEqual(afterSelection.faces().names(), names);
  assert.deepEqual(afterSelection.edges().names(), edges);
  assert.deepEqual(afterSelection.faces().list(), selected.faces().list());
  assert.equal(unstamped(stepOf(doc, 'isolated')), step);
});
