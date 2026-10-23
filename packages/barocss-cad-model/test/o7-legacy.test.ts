import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { readStudioFile } from '../src/engine/container';
import { threadsOf } from '../src/app/threads';
import { fastenerSizesOf } from '../src/engine/fastenerSizeRows';
import { fastenerFit } from '../src/app/fasteners';
import { drawingInputs } from '../src/chat/drawing';
import { readDrawing } from '../src/drawing/types';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { toleranceSuggestions } from '../src/drawing/tolerance';
import { holesOf, tappedHoles } from '../src/machining/holes';
import { machinability } from '../src/machining/report';
import { processProfile } from '../src/library/materials';
import { printability } from '../src/print/rules';
import { bomView, deriveBom } from '../src/team/assembly';
import { withSampleRows } from './person-file';

// O7: the built-in fastener sizes, casting rules and enclosure variants became the person's rows (owner, 2026-10-23: the
// studio is unreleased, so the schema tracks the latest and nothing is migrated). These fixtures are the equivalence
// oracle. Each .bcad in fixtures/o7-legacy was saved once by the pre-O7 code (2026-10-23, over integration e4ba3c579), one
// per built-in use, and expected.json is what it opened to then. With the sample rows loaded as the person loads them
// (samples/rows), each must open to exactly that: the sample rows give what the built-in values gave. Without rows, each
// gives the readings of no data: no fastener thread, no tap drill, the position estimate. UPDATE_O7_EXPECTED=1 rewrites
// expected.json, which only a decision record may do.

const dir = resolve(import.meta.dirname, 'fixtures/o7-legacy');
const expectedFile = resolve(dir, 'expected.json');
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const milling = processProfile('cnc-milling')!;
const rules = (r: { rules: readonly { id: string; status: string; message: string; value?: number | null }[] }) => r.rules.map(x => ({ id: x.id, status: x.status, message: x.message, ...(x.value !== undefined ? { value: x.value } : {}) }));
/** Numbers to 9 decimals, so a last-bit difference in a bore's diameter is not a change. */
const plain = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => typeof x === 'number' ? +x.toFixed(9) : x));
const madeFasteners = (doc: StudioDoc) => doc.nodes.flatMap(n => 'made' in n && n.made?.command === 'fastener' ? [n.made.values] : []);

/** What a saved document opens to, as plain data. */
async function opened(doc: StudioDoc) {
  const ev = evaluateDoc(doc, 1);
  if (!ev.ok) return { error: ev.error.title };
  const bodies = ev.bodies, sizes = fastenerSizesOf(doc);
  const drawing = drawingInputs(doc);
  const ctx = typeof drawing === 'string' ? null : issueContext(drawing);
  // (The same sheet with its accepted tolerances taken off: what the fastener data suggests on it at open.)
  const settings = readDrawing(doc.drawing), bare = drawingInputs(doc, { ...settings, dimensions: settings.dimensions.map(({ tol: _tol, ...d }) => d) });
  return plain({
    bodies: bodies.map(b => ({ key: b.key, volume: b.volumeMM3 == null ? null : +b.volumeMM3.toFixed(6), faces: b.mesh.faces.length })),
    threads: [...threadsOf(doc.nodes, sizes)],
    fastenerSteps: madeFasteners(doc).map(v => fastenerFit(v, sizes)),
    // (A placed part's sizes: the assembly's rows it inherits, its own over them.)
    instances: (doc.instances ?? []).map(i => { const own = { ...sizes, ...fastenerSizesOf(i.doc) }; return { id: i.id, name: i.name, threads: [...threadsOf(i.doc.nodes, own)], fastenerSteps: madeFasteners(i.doc).map(v => fastenerFit(v, own)) }; }),
    drawing: ctx ? {
      suggestions: toleranceSuggestions(ctx).map(s => ({ kind: s.kind, message: s.message, estimate: s.estimate })),
      issues: drawingIssues(ctx).map(x => `${x.code}: ${x.message}`),
      dimensions: ctx.sheet.dimensions.map(d => d.ok ? (d as { text: string }).text : `not ok ${d.dim.id}`),
      tolerances: settings.dimensions.flatMap(d => d.tol ? [{ id: d.id, tol: d.tol }] : []),
      suggestedUntoleranced: typeof bare === 'string' ? bare : toleranceSuggestions(issueContext(bare)).map(s => ({ kind: s.kind, message: s.message, estimate: s.estimate })),
    } : drawing,
    tapped: tappedHoles(doc, holesOf(bodies)),
    machining: rules(machinability(doc, bodies, milling)),
    manufacturing: rules(await printability(doc, bodies, evaluate)),
    bom: deriveBom(await bomView(doc, evaluate)).lines.map(l => ({ item: l.item, qty: l.qty, size: l.size ?? null, kind: l.kind, estimate: l.estimate ?? null })),
  });
}

const names = readdirSync(dir).filter(n => n.endsWith('.bcad')).sort();
const read = async (name: string) => { const r = await readStudioFile(new Uint8Array(readFileSync(resolve(dir, name)))); assert.ok('doc' in r, name); return r.doc; };

if (process.env.UPDATE_O7_EXPECTED) test('O7a: expected.json written from the fixtures', async () => {
  const out: Record<string, unknown> = {};
  for (const name of names) out[name] = await opened(await read(name));
  writeFileSync(expectedFile, JSON.stringify(out, null, 1) + '\n');
});

test('O7a: the legacy fixtures are all there, each with its expectation', () => {
  assert.deepEqual(names, ['die-casting-zinc.bcad', 'drawing-holes.bcad', 'enclosure-parts.bcad', 'fasteners-in-part.bcad', 'fasteners-instances.bcad', 'sand-casting-a356.bcad', 'tapped-holes-milled.bcad']);
  assert.ok(existsSync(expectedFile));
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(expectedFile, 'utf8'))).sort(), names);
});

for (const name of names) test(`O7: ${name} with the sample rows (fastener sizes, casting rules) loaded by the person opens as the pre-O7 studio opened it`, async () => {
  const want = JSON.parse(readFileSync(expectedFile, 'utf8'))[name];
  assert.deepEqual(await opened(withSampleRows(withSampleRows(await read(name)), 'casting-rules')), want);
});

test('O7: without rows, the fixtures read as having no data — no fastener thread or edit steps, no tap drill, each position tolerance an estimate', async () => {
  const want = JSON.parse(readFileSync(expectedFile, 'utf8'));
  for (const name of names) {
    const got = await opened(await read(name)) as Record<string, never>, was = want[name];
    assert.deepEqual(got.bodies, was.bodies, `${name}: the same bodies (the shapes are the document's own nodes)`);
    assert.ok((got.fastenerSteps as unknown[][]).every(x => !x.length), `${name}: no fastener steps`);
    assert.ok((got.instances as { threads: unknown[]; fastenerSteps: unknown[][] }[]).every(i => !i.threads.length && i.fastenerSteps.every(x => !x.length)), `${name}: placed fasteners unsized`);
    assert.ok((got.tapped as { tapMM: number | null }[]).every(t => t.tapMM === null), `${name}: no tap drill`);
    const d = got.drawing as unknown as { suggestedUntoleranced: { kind: string; estimate: boolean; message: string }[] } | string;
    if (typeof d !== 'string') assert.ok(d.suggestedUntoleranced.filter(x => x.kind.startsWith('hole') || x.kind === 'position').every(x => x.estimate), `${name}: ${JSON.stringify(d.suggestedUntoleranced)}`);
  }
  // (O7c: a cast part with no casting rules: the report says why, and every rule that reads a limit or an allowance is
  // unknown — only the geometry's, the pull, hot spots and feeding, are judged.)
  for (const n of ['die-casting-zinc.bcad', 'sand-casting-a356.bcad']) {
    const m = ((await opened(await read(n))) as unknown as { manufacturing: { id: string; status: string; message: string }[] }).manufacturing;
    assert.match(m.find(r => r.id === 'casting-rules')?.message ?? '', /^\[CASTING_RULE_ROW\] no (die|sand)-casting rules loaded/, n);
    for (const id of ['material', 'wall', 'draft', 'shrink', 'section-change', 'tolerance']) assert.equal(m.find(r => r.id === id)?.status, 'unknown', `${n}: ${id}`);
  }
  // (The made fasteners' threads gone, the tapped holes' kept: fasteners-in-part has none left, tapped-holes-milled its three.)
  const threads = async (n: string) => ((await opened(await read(n))) as unknown as { threads: unknown[] }).threads.length;
  assert.deepEqual([await threads('fasteners-in-part.bcad'), await threads('tapped-holes-milled.bcad')], [0, 3]);
});
