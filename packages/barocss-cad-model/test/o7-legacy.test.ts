import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { readStudioFile } from '../src/engine/container';
import { threadsOf } from '../src/app/threads';
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

// O7a: documents saved before O7 open as they did. Each built-in use (fasteners made in a part and placed as parts,
// tapped holes, a drawing's fastener-sized tolerances, die and sand casting, the enclosure library's variants) is a
// .bcad in fixtures/o7-legacy, saved once by the pre-O7 code (2026-10-23, over integration e4ba3c579) and never
// rewritten. What it opens to — bodies, threads, the fastener edit steps, the drawing's suggestions and issues, the
// tapped holes, CAM and DFM rules, the BOM — is expected.json, taken at that same code. O7's migration must keep it
// identical; UPDATE_O7_EXPECTED=1 rewrites it, which only a decision record may do.

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
  const bodies = ev.bodies;
  const drawing = drawingInputs(doc);
  const ctx = typeof drawing === 'string' ? null : issueContext(drawing);
  // (The same sheet with its accepted tolerances taken off: what the fastener data suggests on it at open.)
  const settings = readDrawing(doc.drawing), bare = drawingInputs(doc, { ...settings, dimensions: settings.dimensions.map(({ tol: _tol, ...d }) => d) });
  return plain({
    bodies: bodies.map(b => ({ key: b.key, volume: b.volumeMM3 == null ? null : +b.volumeMM3.toFixed(6), faces: b.mesh.faces.length })),
    threads: [...threadsOf(doc.nodes)],
    fastenerSteps: madeFasteners(doc).map(v => fastenerFit(v)),
    instances: (doc.instances ?? []).map(i => ({ id: i.id, name: i.name, threads: [...threadsOf(i.doc.nodes)], fastenerSteps: madeFasteners(i.doc).map(v => fastenerFit(v)) })),
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

for (const name of names) test(`O7a: ${name} opens as the pre-O7 studio opened it (Save/Open)`, async () => {
  const want = JSON.parse(readFileSync(expectedFile, 'utf8'))[name];
  assert.deepEqual(await opened(await read(name)), want);
});
