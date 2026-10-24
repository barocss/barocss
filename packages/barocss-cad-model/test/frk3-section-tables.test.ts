import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionTableRows } from '../src/frames/sectionTables';
import { editSections } from '../src/frames/sections';
import { emptyDoc, withNode } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';

// User dimensions only: these are test sections, not catalogue values.
const dims = { height: 100, width: 60, web: 6, flange: 8, rootRadius: 0 };
const i = { ...dims, toeRadius: 0, flangeSlope: 0 };
const table = (kind: string, row: Record<string, unknown>) => ({ id: 'user', label: 'User sizes', kind, source: 'User drawing, test', rows: [{ size: 'one', ...row }] });
const rows = (t: unknown) => { const r = sectionTableRows(t); assert.ok('rows' in r, 'error' in r ? r.error : ''); return r.rows; };
const volume = (t: unknown) => {
  const converted = rows(t), library = editSections(emptyDoc(), converted);
  assert.ok(!('error' in library), 'error' in library ? library.error : '');
  const doc = withNode(library.doc, { kind: 'frame-member', section: { kind: 'library', id: converted[0].id }, start: [0, 0, 0], end: [0, 0, 300] });
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  return r.bodies[0].volume!;
};

test('FRk3 user I/H table preserves all seven explicit dimensions and source through library conversion and actual member evaluation', () => {
  const t = table('i-beam', i), row = rows(t)[0];
  assert.deepEqual(row, { id: 'user:one', name: 'User sizes one', section: { kind: 'i-beam', ...i }, source: t.source });
  // Sharp parallel I: two full flanges plus the web between them.
  const expected = (2 * 60 * 8 + (100 - 16) * 6) * 300;
  assert.ok(Math.abs(volume(t) - expected) < 1e-9 * expected);
  assert.ok(volume(table('i-beam', { ...i, flangeSlope: 0.05, rootRadius: 2, toeRadius: 1 })) > 0);
});

test('FRk3 channel table retains omitted optional fields and explicit zero; sloped/toe row evaluates without replacing user provenance', () => {
  const old = rows(table('channel', dims))[0], explicit = rows(table('channel', { ...dims, toeRadius: 0, flangeSlope: 0 }))[0];
  assert.deepEqual(old.section, { kind: 'channel', ...dims });
  assert.deepEqual(explicit.section, { kind: 'channel', ...dims, toeRadius: 0, flangeSlope: 0 });
  assert.equal(volume(table('channel', dims)), volume(table('channel', { ...dims, toeRadius: 0, flangeSlope: 0 })));
  const t = { ...table('channel', { ...dims, rootRadius: 2, toeRadius: 1, flangeSlope: 0.05 }), rows: [{ size: 'estimate', ...dims, rootRadius: 2, toeRadius: 1, flangeSlope: 0.05, estimate: true }, { size: 'own', ...dims, source: 'Own row drawing' }] };
  assert.equal(rows(t)[0].estimate, true); assert.equal(rows(t)[0].source, undefined);
  assert.equal(rows(t)[1].source, 'Own row drawing'); assert.equal(rows(t)[1].estimate, undefined);
  assert.ok(volume(table('channel', { ...dims, rootRadius: 2, toeRadius: 1, flangeSlope: 0.05 })) > 0);
});

test('FRk3 tables refuse missing I fields, unknown fields, invalid values and missing source before importing any row', () => {
  for (const key of Object.keys(i)) {
    const bad: Record<string, unknown> = { ...i }; delete bad[key];
    const r = sectionTableRows(table('i-beam', bad));
    assert.ok('error' in r); assert.match(r.error, new RegExp(`${key} is missing`));
  }
  for (const kind of ['i-beam', 'channel']) {
    const input = kind === 'i-beam' ? i : dims;
    for (const bad of [{ ...input, mystery: 1 }, { ...input, flangeSlope: -0.1 }, { ...input, toeRadius: '1' }, { ...input, web: 80 }]) {
      const r = sectionTableRows({ ...table(kind, input), rows: [{ size: 'valid', ...input }, { size: 'invalid', ...bad }] });
      assert.ok('error' in r, JSON.stringify(bad)); assert.match(r.error, /^\[SECTION_TABLE\]/);
    }
    const r = sectionTableRows({ ...table(kind, input), source: undefined });
    assert.ok('error' in r); assert.match(r.error, /cite its source/);
  }
});
