import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { loadSizesFile, SAMPLE_SIZES_FILE } from '../src/app/sizesFile';

// O7e: the Library panel's fastener sizes — the shipped sample or the person's file, loaded as the person's act with its
// receipt; a bad file refused, nothing changed.

// (The test runs bundled from a temporary folder; the package's sample is read from the studio's cwd.)
const sampleText = readFileSync(join(process.cwd(), '../../packages/barocss-cad-model/samples/rows/fastener-sizes.json'), 'utf8');

test('O7e: the sample loads the seven sizes with the person\'s receipt naming it; a bad row is refused', () => {
  const r = loadSizesFile(emptyDoc(), SAMPLE_SIZES_FILE, sampleText);
  assert.ok('doc' in r, 'error' in r ? r.error : '');
  assert.deepEqual(r.doc.fastenerSizes!.rows.map(x => x.id), ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12']);
  const receipts = r.doc.rowSources!.rows.filter(x => x.kind === 'fastener-sizes');
  assert.equal(receipts.length, 7);
  assert.ok(receipts.every(x => x.file.filename === SAMPLE_SIZES_FILE && x.file.suppliedBy === 'person'), JSON.stringify(receipts[0]));
  const bad = loadSizesFile(emptyDoc(), 'mine.json', JSON.stringify([{ id: 'M6', d: 6 }]));
  assert.ok('error' in bad); assert.match(bad.error, /fastener size row M6: pitch is a number of mm above 0/);
  assert.ok('error' in loadSizesFile(emptyDoc(), 'mine.json', 'not json'));
});
