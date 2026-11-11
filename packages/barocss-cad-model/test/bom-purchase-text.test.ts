import assert from 'node:assert/strict';
import test from 'node:test';
import { purchaseCsv, type BomPanelData } from '../src/bom/bom';
import type { BomLine } from '../src/bom/core';

const header = 'item no.,item,qty,kind,size,row,catalogue,source,estimate\n';
const line = (fields: Partial<BomLine>): BomLine => ({ item: 'Plain part', parts: ['id'], qty: 2, material: null, mass: 12, source: null, ...fields });
const panel = (lines: BomLine[]): BomPanelData => ({ view: { parts: [] }, bom: { lines, totalQty: 2, totalMass: 12 }, made: [], single: false });

test('purchase CSV protects formula-like labels in all emitted text columns', () => {
  const data = panel([
    line({ item: '=1+1', kind: '+1+1', size: '-5 mm shim', row: '@label', catalogue: '＝1+1', source: " '＝1+1", estimate: true }),
    line({ item: "'=1+1", kind: 'part', size: '＋1+1', row: '－5', catalogue: '＠label', source: '00123' }),
    line({ item: '\t=1+1', kind: 'part', size: '\r+1+1', row: '\n=1+1', catalogue: '\u200B=1+1', source: '\u3000=1+1' }),
  ]);
  const source = structuredClone(data);
  assert.equal(purchaseCsv(data), header + [
    `1,"'=1+1",2,"'+1+1","'-5 mm shim","'@label","'＝1+1","' '＝1+1",estimate`,
    `2,"''=1+1",2,part,"'＋1+1","'－5","'＠label",00123,`,
    `3,"'\t=1+1",2,part,"'\r+1+1","'\n=1+1","'\u200B=1+1","'\u3000=1+1",`,
  ].join('\n') + '\n');
  assert.deepEqual(data, source);
});

test('CSV keeps number cells, ordinary apostrophes and raw separators within their cells', () => {
  const data = panel([
    line({ item: `Shim, ";"; note\rnext\nline\tlabel`, qty: 7, kind: 'part', row: '00123', catalogue: "'O-ring", source: `a,"b";=1+1` }),
    line({ item: 'Plain shim' }),
  ]);
  data.made.push({ item: '=1+1', parts: ['made:n1'], qty: 4, kind: 'part', size: '12.50', row: null, override: true });
  const bought = header + `1,"Shim, "";""; note\rnext\nline\tlabel",7,part,,00123,'O-ring,"a,""b"";=1+1",\n`;
  assert.equal(purchaseCsv(data), bought);
  assert.equal(purchaseCsv(data, true), bought + `2,Plain shim,2,part,,,,,\n3,"'=1+1",4,part,12.50,,,,\n`);
});
