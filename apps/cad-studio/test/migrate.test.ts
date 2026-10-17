import test from 'node:test';
import assert from 'node:assert/strict';
import { readStudioDoc } from '../src/engine/migrate';
import { rectanglePart } from '../src/engine/doc';

test('reading a model file: the current one as it is, an older one filled in and said so, a newer one refused', () => {
  const now = readStudioDoc(JSON.stringify(rectanglePart(10, 10, 5)));
  assert.ok('doc' in now && now.notes.length === 0 && now.doc.nodes.length === 2);
  const old = Object.fromEntries(Object.entries(rectanglePart(10, 10, 5)).filter(([k]) => !['schema', 'parameters', 'units'].includes(k)));
  const back = readStudioDoc(JSON.stringify(old));
  assert.ok('doc' in back);
  assert.equal(back.doc.schema, 1); assert.deepEqual(back.doc.parameters, {});
  assert.deepEqual(back.notes, ['saved before schema 1: read as schema 1', 'no units given: read as millimetres', 'no parameters list: started empty']);
  assert.match((readStudioDoc(JSON.stringify({ ...rectanglePart(1, 1, 1), schema: 7 })) as { error: string }).error, /newer cad-studio \(schema 7/);
  assert.match((readStudioDoc(JSON.stringify({ ...rectanglePart(1, 1, 1), nodes: [{ kind: 'warp' }] })) as { error: string }).error, /does not know: warp/);
  assert.match((readStudioDoc('{"hello":1}') as { error: string }).error, /not a BaroCSS model/);
  assert.match((readStudioDoc(JSON.stringify({ ...rectanglePart(1, 1, 1), units: 'inch' })) as { error: string }).error, /only millimetre/);
});
