import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { insertLibraryPart } from '../src/library/libraries';
import { loadPersonRows } from '../src/chat/rows';
import { personFile, withSampleRows } from './person-file';

// O7, tslot-20 (the coordinator's option C): the library parts' M5 values — the profile's core bore and the slot nut's
// drill 4.2, the end cap's and the bracket's hole 5.5 — are their own, never read from the person's fastener sizes. With
// the sample rows (the same values) nothing is said; with a row that differs the part's notes name both, and the part's
// shape is the same.

const warnings = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok); return { volume: r.bodies.map(b => +b.volumeMM3!.toFixed(6)), notes: r.bodies.flatMap(b => (b.notes ?? []).filter(n => n.warning && /fastener size/.test(n.text)).map(n => n.text)) }; };

test('O7 tslot-20 (C): the M5 values are the parts\' own; a loaded fastener size that differs is named in their notes, the shape unchanged', () => {
  const parts = ['profile', 'slot-nut-m5', 'end-cap', 'angle-bracket'] as const;
  const sample = withSampleRows(emptyDoc()), m5 = sample.fastenerSizes!.rows.find(r => r.id === 'M5')!;
  // (A shop's own M5: a 4.3 tap drill and a 5.6 medium clearance, from the person's file.)
  const f = personFile('shop-sizes.json', [{ ...m5, tap: 4.3, clearance: [5.3, 5.6, 5.8], source: 'the shop\'s drill chart', fieldSources: undefined, unchecked: undefined }]);
  const loaded = loadPersonRows(emptyDoc(), 'fastener-sizes', f.file, undefined, f.rowFiles); assert.ok('doc' in loaded, 'error' in loaded ? loaded.error : '');
  const want: Record<string, string> = {
    profile: 'bore Ø4.2 is the library part\'s own; your fastener size M5 gives a tap drill of Ø4.3 — check which the part needs',
    'slot-nut-m5': 'drill Ø4.2 is the library part\'s own; your fastener size M5 gives a tap drill of Ø4.3 — check which the part needs',
    'end-cap': 'hole Ø5.5 is the library part\'s own; your fastener size M5 gives a medium clearance hole of Ø5.6 — check which the part needs',
    'angle-bracket': 'hole Ø5.5 is the library part\'s own; your fastener size M5 gives a medium clearance hole of Ø5.6 — check which the part needs',
  };
  for (const part of parts) {
    const none = warnings(insertLibraryPart(emptyDoc(), 'tslot-20', part)), same = warnings(insertLibraryPart(sample, 'tslot-20', part)), other = warnings(insertLibraryPart(loaded.doc, 'tslot-20', part));
    assert.deepEqual([none.notes, same.notes], [[], []], `${part}: no rows, or rows that agree: nothing said`);
    assert.deepEqual(other.notes, [want[part]], part);
    assert.deepEqual([same.volume, other.volume], [none.volume, none.volume], `${part}: the shape is the library's`);
  }
});
