import test from 'node:test';
import assert from 'node:assert/strict';
import { readStudioDoc } from '../src/engine/migrate';
import { rectanglePart } from '../src/engine/doc';

test('reading a model file: the current one as it is, what was left out filled in and said, an older or newer one refused', () => {
  const now = readStudioDoc(JSON.stringify(rectanglePart(10, 10, 5)));
  assert.ok('doc' in now && now.notes.length === 0 && now.doc.nodes.length === 2);
  const lacking = Object.fromEntries(Object.entries(rectanglePart(10, 10, 5)).filter(([k]) => !['parameters', 'units'].includes(k)));
  const back = readStudioDoc(JSON.stringify(lacking));
  assert.ok('doc' in back);
  assert.equal(back.doc.schema, 3); assert.deepEqual(back.doc.parameters, {});
  assert.deepEqual(back.notes, ['no units given: read as millimetres', 'no parameters list: started empty']);
  // Only schemas 3 and 4 are read: an older file (2, 1 or none) is refused, not migrated.
  const part = rectanglePart(10, 10, 5), noSchema = Object.fromEntries(Object.entries(part).filter(([k]) => k !== 'schema'));
  const refused = (file: unknown) => (readStudioDoc(JSON.stringify(file)) as { error: string }).error;
  assert.equal(refused({ ...part, schema: 2 }), 'This model was saved in an older form (schema 2); this cad-studio reads schemas 3 and 4. Re-save it with a studio that reads it.');
  assert.match(refused({ ...part, schema: 1 }), /older form \(schema 1\); this cad-studio reads schemas 3 and 4/);
  assert.match(refused({ ...part, schema: 0 }), /older form \(schema 0\)/);
  assert.match(refused(noSchema), /older form \(no schema\); this cad-studio reads schemas 3 and 4/);
  assert.ok('doc' in readStudioDoc(JSON.stringify({ ...part, schema: 3 })));
  assert.match(refused({ ...part, schema: 7 }), /newer cad-studio \(schema 7/);
  assert.match((readStudioDoc(JSON.stringify({ ...rectanglePart(1, 1, 1), nodes: [{ kind: 'warp' }] })) as { error: string }).error, /does not know: warp/);
  assert.match((readStudioDoc('{"hello":1}') as { error: string }).error, /not a BaroCSS model/);
  assert.match((readStudioDoc(JSON.stringify({ ...rectanglePart(1, 1, 1), units: 'inch' })) as { error: string }).error, /only millimetre/);
});
