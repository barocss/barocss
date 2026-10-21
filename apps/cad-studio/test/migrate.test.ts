import test from 'node:test';
import assert from 'node:assert/strict';
import { readStudioDoc } from '../src/engine/migrate';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import { defaultRender } from '@barocss/cad-model/engine/render';

test('reading a model file: the current one as it is, an older one filled in and said so, a newer one refused', () => {
  const now = readStudioDoc(JSON.stringify(rectanglePart(10, 10, 5)));
  assert.ok('doc' in now && now.notes.length === 0 && now.doc.nodes.length === 2);
  const old = Object.fromEntries(Object.entries(rectanglePart(10, 10, 5)).filter(([k]) => !['schema', 'parameters', 'units'].includes(k)));
  const back = readStudioDoc(JSON.stringify(old));
  assert.ok('doc' in back);
  assert.equal(back.doc.schema, 3); assert.deepEqual(back.doc.parameters, {});
  assert.deepEqual(back.notes, ['saved before schema 3: read as schema 3', 'no units given: read as millimetres', 'no parameters list: started empty', 'features given stable ids (their names stay as they were)']);
  // A schema-1 file (no ids): node i is feature n<i>, as its stored names say; the next new feature follows on.
  const one = { ...rectanglePart(10, 10, 5), schema: 1, nextId: undefined, nodes: rectanglePart(10, 10, 5).nodes.map(({ id: _, ...n }) => n) };
  const read = readStudioDoc(JSON.stringify(one));
  assert.ok('doc' in read);
  assert.deepEqual(read.doc.nodes.map(n => n.id), ['n0', 'n1']); assert.equal(read.doc.nextId, 2);
  // A schema-2 file after a delete (ids n2, n3 at indices 0, 1): its looks, appearances and tracks were keyed by
  // index (b1), and now by the id (b3), so they stay on the same body.
  const two = { ...rectanglePart(10, 10, 5), schema: 2, nextId: 4, nodes: rectanglePart(10, 10, 5).nodes.map((n, i) => ({ ...n, id: `n${i + 2}` })),
    bodies: { b1: { color: '#ff0000', material: 'steel' } } };
  const r2 = readStudioDoc(JSON.stringify({ ...two, render: { ...defaultRender(), appearances: { b1: defaultRender().defaultAppearance }, animation: { ...defaultRender().animation, tracks: { b1: [{ t: 0, offset: [0, 0, 0] }] } } } }));
  assert.ok('doc' in r2);
  assert.deepEqual([Object.keys(r2.doc.bodies!), Object.keys(r2.doc.render!.appearances), Object.keys(r2.doc.render!.animation.tracks)], [['b3'], ['b3'], ['b3']]);
  assert.ok(r2.notes.includes('body looks, appearances and animation tracks keyed by feature ids'));
  assert.match((readStudioDoc(JSON.stringify({ ...rectanglePart(1, 1, 1), schema: 7 })) as { error: string }).error, /newer cad-studio \(schema 7/);
  assert.match((readStudioDoc(JSON.stringify({ ...rectanglePart(1, 1, 1), nodes: [{ kind: 'warp' }] })) as { error: string }).error, /does not know: warp/);
  assert.match((readStudioDoc('{"hello":1}') as { error: string }).error, /not a BaroCSS model/);
  assert.match((readStudioDoc(JSON.stringify({ ...rectanglePart(1, 1, 1), units: 'inch' })) as { error: string }).error, /only millimetre/);
});
