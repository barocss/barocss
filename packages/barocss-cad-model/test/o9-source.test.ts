import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, stepFor } from '../src/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { threeMfModelOf } from '../src/print/export3mf';
import { write3mf } from '../src/print/threemf';
import { drawingInputs } from '../src/chat/drawing';
import { issueContext } from '../src/drawing/issues';
import { autoLayout } from '../src/drawing/layout';
import { sheetSvg } from '../src/io/svg';
import { defaultDrawing } from '../src/drawing/types';
import { revisionOf } from '../src/util/revision';
import { sourceBytes, sourceName, sourceRecord } from '../src/team/source';
import { readRobot } from '../src/robot/joints';

// O9: exports carry the revision they were made from — STEP's FILE_DESCRIPTION, 3MF's metadata, the drawing's title
// block in the file; a record beside the files that cannot (STL, the frozen robot exports) — and the same content gives
// the same source, so the same bytes; a change gives another.

const plate = rectanglePart(40, 20, 5), holed = withNode(plate, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 });
const bodiesOf = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok); return r.bodies; };
const DATE = new Date('2026-10-23T00:00:00Z');
let seq = 0; const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

test('O9: STEP names its source revision in FILE_DESCRIPTION; exported twice, the same bytes but the time stamp; another part, another source', () => {
  const a = stepFor(plate, 'p'), b = stepFor(plate, 'p'), c = stepFor(holed, 'p');
  assert.ok('text' in a && 'text' in b && 'text' in c);
  assert.equal(a.source, revisionOf(plate));
  assert.ok(a.text.includes(`FILE_DESCRIPTION(('BaroCSS CAD part','source revision ${revisionOf(plate)}'),'2;1');`), a.text.slice(0, 200));
  const stamped = (t: string) => t.replace(/^FILE_NAME\(.*$/m, '');
  assert.equal(stamped(a.text), stamped(b.text), 'the same content, the same bytes (the header time aside)');
  assert.notEqual(c.source, a.source);
});

test('O9: 3MF\'s metadata names the source revision; written twice, byte-identical; the drawing\'s title block draws it, the same twice', async () => {
  const model = threeMfModelOf(plate, [{ doc: plate, bodies: bodiesOf(plate) }], 'plate');
  assert.ok(typeof model !== 'string');
  seq = 0; const a = await write3mf({ ...model, uuid, date: DATE }); seq = 0; const b = await write3mf({ ...model, uuid, date: DATE });
  assert.ok('bytes' in a && 'bytes' in b);
  assert.ok(Buffer.from(a.bytes).equals(Buffer.from(b.bytes)), 'the same content, the same bytes');
  assert.equal(model.source, revisionOf(plate));
  const sheet = (doc: StudioDoc) => { const i = drawingInputs(doc, defaultDrawing()); assert.ok(typeof i !== 'string'); const s = autoLayout(i).settings, j = drawingInputs(doc, s); assert.ok(typeof j !== 'string'); return sheetSvg(issueContext({ ...j, meta: { ...j.meta, date: '2026-10-23' } }).sheet, 'p'); };
  const s1 = sheet(plate), s2 = sheet(plate);
  assert.equal(s1, s2); assert.ok(s1.includes(`SRC ${revisionOf(plate)}`), 'the title block names the source');
  assert.ok(sheet(holed).includes(`SRC ${revisionOf(holed)}`));
});

test('O9: the record beside a file — the revision, the input\'s SHA-256, the files, a robot\'s hand-set values — the same bytes twice', () => {
  const r = sourceRecord(plate, ['p.stl']);
  assert.deepEqual([r.format, r.version, r.revision, r.files, r.handSet], ['barocss-source', 1, revisionOf(plate), ['p.stl'], undefined]);
  assert.match(r.digest, /^[0-9a-f]{64}$/);
  assert.ok(Buffer.from(sourceBytes(r)).equals(Buffer.from(sourceBytes(sourceRecord(plate, ['p.stl'])))));
  assert.notEqual(sourceRecord(holed, ['p.stl']).digest, r.digest);
  const robot = { ...plate, robot: { version: 1 as const, joints: { 'base~l1': { velocity: 2, effort: 3 } } } };
  assert.deepEqual(sourceRecord(robot, ['robot.urdf'], { robot: true }).handSet, readRobot(robot.robot));
  assert.deepEqual([sourceName('part.stl'), sourceName('out/robot.urdf'), sourceName('x')], ['part.source.json', 'out/robot.source.json', 'x.source.json']);
});
