import test from 'node:test';
import assert from 'node:assert/strict';
import { runDrawingTool } from '../src/chat/drawing';
import { starterDoc } from '../src/engine/doc';
import { checkDrawingMetadata, readRevisions, type DrawingRevision } from '../src/drawing/metadata';
import { withManufacturingDrawing } from '../src/drawing/options';
import { defaultDrawing } from '../src/drawing/types';

// Synthetic source-contract regressions only; these do not prove real Save/Open or product acceptance.
const first = (): DrawingRevision => ({ revision: 'A', date: '2026-10-24', description: 'Initial issue', by: 'Designer' });
const second = (): DrawingRevision => ({ revision: 'B', date: '2026-10-25', description: 'Drawing note changed' });

function assertAtomicRefusal(revisions: unknown[]): void {
  const doc = { ...starterDoc(), drawing: { ...defaultDrawing(), title: 'Keep title', revision: 'C', revisions: [first()] } };
  const args = { title: 'Must not apply', revisions };
  const beforeDoc = structuredClone(doc), beforeArgs = structuredClone(args);
  assert.equal(checkDrawingMetadata(args)[0]?.code, 'DRAWING_OPTIONS');
  const result = runDrawingTool(doc, 'set_drawing', args);
  assert.ok('error' in result && result.error.startsWith('[DRAWING_OPTIONS]'));
  assert.deepEqual(doc, beforeDoc, 'a rejected history does not change the document');
  assert.deepEqual(args, beforeArgs, 'validation preserves caller rows and sparse slots');
}

test('an authored history containing one empty slot is refused instead of clearing stored history', () => {
  const revisions: unknown[] = []; revisions.length = 1;
  assertAtomicRefusal(revisions);
});

for (const gap of [0, 1, 2]) test(`an authored history with a hole at index ${gap} refuses the whole update`, () => {
  const revisions: unknown[] = [first(), second()];
  revisions.splice(gap, 0, undefined); delete revisions[gap];
  assertAtomicRefusal(revisions);
});

test('valid dense history remains copied, omission keeps it and an empty list clears only history', () => {
  const original = { ...defaultDrawing(), title: 'Keep title', revision: 'C', revisedModel: 'existing-fingerprint', revisions: [first()] };
  const before = structuredClone(original), rows = [first(), second()];
  assert.deepEqual(checkDrawingMetadata({ revisions: rows }), []);
  const saved = withManufacturingDrawing(original, { revisions: rows });
  rows[0].description = 'Caller changed this'; rows.push({ revision: 'D', date: '2026-10-26', description: 'Caller appended this' });
  assert.deepEqual(saved.revisions, [first(), second()]);
  assert.equal(saved.revision, 'C'); assert.equal(saved.revisedModel, 'existing-fingerprint');
  assert.deepEqual(withManufacturingDrawing(saved, {}), saved);
  const cleared = withManufacturingDrawing(saved, { revisions: [] });
  assert.equal(cleared.revisions, undefined); assert.equal(cleared.revision, 'C');
  assert.equal(cleared.revisedModel, 'existing-fingerprint'); assert.equal(cleared.title, 'Keep title');
  assert.deepEqual(original, before);
});

test('the saved reader still filters sparse, malformed and duplicate rows without adding authored strictness', () => {
  const raw: unknown[] = [first()]; raw.length = 2;
  raw.push(null, { ...second(), date: '2026-02-30' }, { ...first(), description: 'Duplicate' }, { ...second(), ignored: true });
  const before = structuredClone(raw), saved = readRevisions(raw);
  assert.deepEqual(saved, [first(), second()]);
  assert.deepEqual(raw, before, 'the lenient reader does not change the source');
  assert.notEqual(saved[0], raw[0], 'accepted saved rows remain independent copies');
});

test('existing dates, duplicate labels, unknown fields and record-count limits retain their input rules', () => {
  assert.deepEqual(checkDrawingMetadata({ revisions: [{ ...first(), date: '2024-02-29' }] }), []);
  assert.deepEqual(checkDrawingMetadata({ revisions: [] }), []);
  const fifty = Array.from({ length: 50 }, (_, k) => ({ ...first(), revision: String(k) }));
  assert.deepEqual(checkDrawingMetadata({ revisions: fifty }), []);
  for (const revisions of [
    [{ ...first(), date: '2026-02-29' }],
    [first(), first()],
    [{ ...first(), extra: true }],
    [{ ...first(), description: 'Two\nlines' }],
    [...fifty, { ...second(), revision: '50' }],
  ]) assert.equal(checkDrawingMetadata({ revisions })[0]?.code, 'DRAWING_OPTIONS');
});
