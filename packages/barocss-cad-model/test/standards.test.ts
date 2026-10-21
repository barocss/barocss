import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, SYSTEM_PROMPT, TOOLS } from '../src/chat/tools';
import { SYSTEM_PROMPT_V2, TOOLS_V2 } from '../src/chat/toolset';
import { GROUPS } from '../src/chat/groups';
import { FASTENER_SIZES } from '../src/app/fasteners';
import { ALLOWED_LICENCES, checkTables, NAMED_STANDARDS, STANDARD_SOURCES, STANDARD_TABLES, type StdSource, type StdTable } from '../src/standards/provenance';

// A6.5 (O29): standards data with provenance. Every value of the standards-derived tables has a source and every source
// a licence a table may carry (GPL, share-alike, non-commercial and unknown refused); the fastener values are the ones
// they were before the migration (a snapshot); the lookup tool gives a value with its source; the prompts and tool
// descriptions name standards only by number, from an allowlist, and quote none.

const CASES = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/a6/standards');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);

test('every value of every standards-derived table has a source, and every source a licence a table may carry', () => {
  assert.deepEqual(checkTables(), []);
  for (const s of STANDARD_SOURCES) {
    assert.ok(ALLOWED_LICENCES.includes(s.licence), `${s.id}: ${s.licence}`);
    assert.ok(s.where.length > 10, s.id);
    if (s.kind === 'page') assert.match(s.where, /https:\/\//, `${s.id}: a page has its address`);
  }
  const counted = STANDARD_TABLES.reduce((n, t) => n + Object.values(t.rows).reduce((m, r) => m + Object.keys(r).length, 0), 0);
  assert.ok(counted >= 140, `${counted} values`);
  // (The ISO 4017 lengths not cross-checked are said so, row by row.)
  const fast = STANDARD_TABLES.find(t => t.id === 'fasteners-metric-coarse')!;
  for (const [size, f] of Object.entries(FASTENER_SIZES)) assert.equal(fast.rowSources?.[size]?.lengths ?? fast.fieldSources.lengths, f.checked4017 ? 'FAST-4017-L' : 'FAST-4017-RULE', size);
});

test('a table whose data is GPL, share-alike, non-commercial, unknown or unsourced is refused, typed', () => {
  const t: StdTable = { id: 't', title: 't', unit: 'mm', standards: [], rows: { a: { x: 1, y: 2 } }, fieldSources: { x: 'S1', y: 'S2' } };
  for (const licence of ['GPL-3.0', 'LGPL-2.1', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'unknown']) {
    const src: StdSource[] = [{ id: 'S1', kind: 'page', where: 'https://example.invalid/table', licence }, { id: 'S2', kind: 'own', where: 'written for BaroCSS', licence: 'own' }];
    const p = checkTables([t], src); assert.deepEqual(p.map(x => [x.code, x.field]), [['LICENCE', 'x']], licence);
  }
  const p = checkTables([{ ...t, fieldSources: { x: 'S2' } }], [{ id: 'S2', kind: 'own', where: 'written for BaroCSS', licence: 'own' }]);
  assert.deepEqual(p.map(x => [x.code, x.field]), [['NO_SOURCE', 'y']]);
});

test('the fastener values are the ones they were before the migration (a snapshot), and the table holds them as they are', () => {
  const file = join(CASES, 'fasteners-values.json'), now = JSON.stringify(FASTENER_SIZES);
  if (process.env.UPDATE_A6_FIXTURES || !existsSync(file)) writeFileSync(file, JSON.stringify({ case: 'fasteners-values', step: 'A6.5', note: 'The metric coarse fastener values (src/app/fasteners.ts) as they were when A6.5 gave them sources, field by field: a change to any value shows here.', values: FASTENER_SIZES }, null, 1) + '\n');
  assert.equal(JSON.stringify(JSON.parse(readFileSync(file, 'utf8')).values), now);
  const fast = STANDARD_TABLES.find(t => t.id === 'fasteners-metric-coarse')!;
  for (const [size, f] of Object.entries(FASTENER_SIZES)) for (const [k, v] of Object.entries(fast.rows[size])) assert.deepEqual(v, (f as unknown as Record<string, unknown>)[k], `${size}.${k}`);
});

test('standards_lookup: a value with its source; the tables listed; refused, typed, for a table or row not there', async () => {
  const s = { doc: emptyDoc(), bodies: [] }, call = (args: object) => dispatchTool(s, 'standards_lookup', args, evaluate);
  const r = JSON.parse((await call({ table: 'fasteners-metric-coarse', row: 'M6', field: 'tap' })).content);
  assert.deepEqual(r.values, { tap: 5 }); assert.equal(r.sources.tap.id, 'FAST-TAP'); assert.equal(r.sources.tap.kind, 'derived');
  const row = JSON.parse((await call({ table: 'fasteners-metric-coarse', row: 'M8' })).content);
  assert.equal(row.sources.capLengths.where.startsWith('https://engineersedge.com/'), true); assert.equal(row.sources.cdk.unverified, true);
  const all = JSON.parse((await call({})).content);
  assert.deepEqual(all.tables.map((t: { id: string }) => t.id), STANDARD_TABLES.map(t => t.id));
  assert.match((await call({ table: 'nope', row: 'x' })).content, /NO_TABLE/);
  assert.match((await call({ table: 'fasteners-metric-coarse', row: 'M7' })).content, /NO_ROW/);
});

test('prompts and tool descriptions name standards only by number, from the allowlist, and quote none', () => {
  const prose = [SYSTEM_PROMPT, SYSTEM_PROMPT_V2, ...TOOLS.map(t => t.description), ...TOOLS_V2.map(t => t.description), ...Object.values(GROUPS).map(g => `${g.title} ${'about' in g ? (g as { about: string }).about : ''}`)].join('\n');
  const named = [...new Set([...prose.matchAll(/\b(ISO|DIN|EN|ANSI|ASME|JIS|BS|IEC|ASTM|GB)[ \u00a0]?\d[\d.:-]*/g)].map(m => m[0].replace(/[.:-]+$/, '')))];
  for (const n of named) assert.ok(NAMED_STANDARDS.includes(n), `${n} is named but not in the allowlist (${NAMED_STANDARDS.join(', ')})`);
  // (No sentence quoted near a standard's number: a quote of six words or more within 80 characters of one.)
  for (const m of prose.matchAll(/["“]([^"”\n]+)["”]/g)) {
    if (m[1].trim().split(/\s+/).length < 6) continue;
    const near = prose.slice(Math.max(0, m.index! - 80), m.index! + m[0].length + 80);
    assert.ok(!/\b(ISO|DIN|ANSI|ASME|JIS|IEC|ASTM)[ \u00a0]?\d/.test(near), `a quote near a standard's number: ${m[0].slice(0, 80)}`);
  }
  assert.ok(named.length >= 5, named.join());
});
