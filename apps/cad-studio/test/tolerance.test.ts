import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeDxf } from '@barocss/cad';
import { brepsFor } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart, starterDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { projectViews } from '@barocss/cad-model/drawing/project';
import { holeCallout } from '@barocss/cad-model/drawing/callout';
import { drawingIssues, issueContext, type SheetInputs } from '@barocss/cad-model/drawing/issues';
import { autoLayout } from '@barocss/cad-model/drawing/layout';
import { GENERAL_NOTE_PREFIX, POSITION_ESTIMATE_MM, acceptAll, holePosition, toleranceSuggestions } from '@barocss/cad-model/drawing/tolerance';
import { sheetDxfDocument } from '../src/drawing/dxf';
import { sheetPdf, pdfMissing } from '../src/drawing/pdf';
import { defaultDrawing, readDrawing, type DrawingSettings, type DrawingViews } from '@barocss/cad-model/drawing/types';

// R14.4 (O5): tolerance and GD&T suggestions. Conformance cases packages/barocss-cad/conformance/r14/tol-<name>/case.json:
// a studio document and its laid-out drawing in a mode; the suggestions offered (kind, message, estimate) and, after
// accepting them all, the issue list (empty), the datums and frames. UPDATE_R14_FIXTURES=1 writes them.

const root = resolve(process.cwd(), '../../packages/barocss-cad/conformance/r14');
const hole = (node: number, center: [number, number], radius: number, extra: object = {}) => ({ kind: 'hole' as const, parent: { node, side: 'solid' as const }, center, radius, ...extra });
const viewsOf = (doc: StudioDoc): DrawingViews => { const b = brepsFor(doc); assert.ok('breps' in b); const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok); return r.views; };
const inputsOf = (doc: StudioDoc, settings: DrawingSettings): SheetInputs => ({ views: viewsOf(doc), settings, callout: e => holeCallout(doc.nodes, e), meta: { title: 't', date: 'd' } });
const holeRow = () => withNode(withNode(rectanglePart(100, 40, 10), hole(1, [20, 12], 3.3, { pattern: { count: 4, step: [20, 0] } })), hole(2, [20, 30], 2.5, { thread: 'M6×1', depth: 12 }));
const laidOut = (doc: StudioDoc, mode?: 'geometric') => { const s = autoLayout(inputsOf(doc, defaultDrawing())).settings; return mode ? { ...s, tolerancing: mode } : s; };

const CASES: Record<string, { about: string; doc: () => StudioDoc; mode?: 'geometric' }> = {
  'tol-row-plus-minus': { about: '± mode on the hole-row plate: the general note (an estimate); ±0.21 on the clearance holes’ positions (M6 floating, Ø0.6 / 2√2), ±0.1 on the tapped M6 hole’s (fixed, Ø0.3 / 2√2)', doc: holeRow },
  'tol-row-geometric': { about: 'geometric mode on the hole-row plate: datums A bottom, B front side, C left side; position Ø0.6 on the clearance holes (H − F = 6.6 − 6), Ø0.3 on the tapped one ((6.6 − 6)/2, the mating hole assumed medium clearance); their locations basic', doc: holeRow, mode: 'geometric' },
  'tol-plate-geometric': { about: 'geometric mode on the starter plate: its Ø8 hole fits no fastener in the data, so its position Ø0.2 is an estimate (said so)', doc: starterDoc, mode: 'geometric' },
  'tol-cross-hole-geometric': { about: 'geometric mode on a block with a hole along X: the hole’s frame in the right view, to datums A, B, C', doc: () => withNode(rectanglePart(60, 30, 30), hole(1, [15, 15], 4, { axis: 'x' })), mode: 'geometric' },
};

const outcome = (i: SheetInputs) => {
  const ctx = issueContext(i), offered = toleranceSuggestions(ctx).map(x => ({ kind: x.kind, message: x.message, estimate: x.estimate }));
  const a = acceptAll(i), after = issueContext({ ...i, settings: a.settings });
  return {
    offered,
    after: {
      issues: drawingIssues(after).map(x => x.code).sort(),
      datums: (a.settings.datums ?? []).map(d => `${d.letter} ${d.view}`).sort(),
      frames: (a.settings.frames ?? []).map(f => `${after.sheet.dimensions.find(d => d.dim.id === f.dim)?.ok ? (after.sheet.dimensions.find(d => d.dim.id === f.dim) as { text: string }).text : '?'}: Ø${f.value} ${f.datums.join(' ')}`).sort(),
      basic: a.settings.dimensions.filter(d => d.basic).length,
      tolerances: a.settings.dimensions.filter(d => d.tol?.kind === 'symmetric').map(d => (d.tol as { value: number }).value).sort(),
      left: toleranceSuggestions(after).length,
    },
  };
};

if (process.env.UPDATE_R14_FIXTURES) for (const [name, c] of Object.entries(CASES)) {
  const doc = c.doc(), settings = laidOut(doc, c.mode), i = inputsOf(doc, settings), dir = resolve(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'case.json'), JSON.stringify({
    id: `r14-${name}`, step: 'R14.4', decisions: ['O5'], about: c.about,
    input: { document: { format: doc.format, schema: doc.schema, units: doc.units, parameters: doc.parameters, nodes: doc.nodes, nextId: doc.nextId, outputs: doc.outputs }, drawing: settings },
    expect: outcome(i),
    oracle: 'the fastener data’s ISO 273 clearances (app/fasteners.ts, sourced) and the floating / fixed fastener relations and T/(2√2), worked by hand; estimates said so; run by apps/cad-studio/test/tolerance.test.ts',
  }, null, 1) + '\n');
}

for (const name of existsSync(root) ? readdirSync(root).filter(n => n.startsWith('tol-') && existsSync(resolve(root, n, 'case.json'))) : []) {
  const c = JSON.parse(readFileSync(resolve(root, name, 'case.json'), 'utf8'));
  test(`conformance ${c.id}: ${c.about}`, () => {
    const i = inputsOf(c.input.document as StudioDoc, c.input.drawing as DrawingSettings);
    assert.deepEqual(outcome(i), c.expect);
    assert.deepEqual(c.expect.after.issues, [], 'accepting them all leaves no issue');
  });
}

test('the tolerance cases cover the parts (UPDATE_R14_FIXTURES=1 writes them)', () => {
  for (const name of Object.keys(CASES)) assert.ok(existsSync(resolve(root, name, 'case.json')), name);
});

test('position values from the fastener data, by the floating and fixed fastener relations; else an estimate', () => {
  assert.deepEqual([holePosition('4× Ø6.6 THRU', 6.6).value, holePosition('4× Ø6.6 THRU', 6.6).estimate], [0.6, false]);
  assert.match(holePosition('Ø6.6 THRU', 6.6).basis, /M6.*medium.*6\.6 − 6/);
  assert.deepEqual([holePosition('Ø5.5 THRU', 5.5).value, holePosition('Ø9 THRU', 9).value, holePosition('Ø3.4 THRU', 3.4).value], [0.5, 1, 0.4]);
  // Near an ISO 273 hole only: the screw assumed, an estimate (Ø6 is M5's nearest, its coarse hole Ø5.8).
  const near = holePosition('Ø6 THRU', 6); assert.equal(near.estimate, true); assert.equal(near.value, 1); assert.match(near.basis, /no ISO 273 hole; M5 assumed \(its coarse hole is Ø5\.8\)/);
  // Tapped: (medium clearance − d) / 2 — M6 (6.6 − 6)/2, M8 (9 − 8)/2, M4 (4.5 − 4)/2.
  assert.deepEqual(['M6×1 × 12 DEEP', 'M8×1.25 THRU', 'M4×0.7 × 8 DEEP'].map(c => holePosition(c, 5).value), [0.3, 0.5, 0.25]);
  assert.deepEqual(holePosition('Ø8 THRU', 8), { value: POSITION_ESTIMATE_MM, basis: 'an estimate: no fastener in the studio data fits this hole', estimate: true });
});

test('suggestions are never applied by themselves; a mode switch only changes what is offered', () => {
  const doc = holeRow(), pm = laidOut(doc), geo = { ...pm, tolerancing: 'geometric' as const };
  const a = toleranceSuggestions(issueContext(inputsOf(doc, pm))), b = toleranceSuggestions(issueContext(inputsOf(doc, geo)));
  assert.ok(a.some(x => x.kind === 'hole-plus-minus') && !a.some(x => x.kind === 'datum' || x.kind === 'position'));
  assert.ok(b.some(x => x.kind === 'datum') && b.some(x => x.kind === 'position') && !b.some(x => x.kind === 'hole-plus-minus'));
  assert.ok(a.every(x => x.basis.length > 10), 'every one says its basis');
  assert.equal(a.find(x => x.kind === 'general-note')!.estimate, true);
  // A note the user wrote with the same opening is not suggested again.
  const own = { ...pm, notes: [{ id: 'n1', text: `${GENERAL_NOTE_PREFIX}: ±0.1`, at: [20, 150] as [number, number] }] };
  assert.ok(!toleranceSuggestions(issueContext(inputsOf(doc, own))).some(x => x.kind === 'general-note'));
});

test('datums and frames: saved and read back, drawn in the SVG, PDF and DXF; their issues', () => {
  const doc = holeRow(), i = inputsOf(doc, laidOut(doc, 'geometric')), a = acceptAll(i).settings;
  assert.deepEqual(readDrawing(JSON.parse(JSON.stringify(a))), a);
  const ctx = issueContext({ ...i, settings: a });
  assert.equal(ctx.sheet.groups.filter(g => g.role === 'datum').length, 3); assert.equal(ctx.sheet.groups.filter(g => g.role === 'control').length, 2);
  assert.deepEqual(pdfMissing(ctx.sheet), []); assert.ok(sheetPdf(ctx.sheet, 't').length > 1000);
  const dxf = writeDxf(sheetDxfDocument(ctx.sheet, ctx.layout)).text;
  for (const t of ['%%c0.6', '%%c0.3', 'A', 'B', 'C']) assert.ok(dxf.includes(`\n  1\n${t}\n`), t);
  // Broken references are listed: a datum's edge gone, a frame's dimension gone, a datum named that is not there, a letter twice.
  const broken: DrawingSettings = { ...a, datums: [...a.datums!, { ...a.datums![0], id: 'again' }, { id: 'gone', letter: 'D', view: 'front', edge: { edge: 'n9.none', near: [0, 0, 0] }, place: [0, -20] }], frames: [...a.frames!, { id: 'f9', dim: 'nope', characteristic: 'position', value: 0.2, datums: ['A'] }, { ...a.frames![0], id: 'f8', datums: ['E'] }] };
  const codes = drawingIssues(issueContext({ ...i, settings: broken })).map(x => x.code);
  for (const c of ['DATUM_LOST', 'DATUM_TWICE', 'FRAME_LOST', 'DATUM_UNDEFINED']) assert.ok(codes.includes(c as never), c);
  // Bad values are dropped on reading.
  const bad = readDrawing({ ...JSON.parse(JSON.stringify(a)), datums: [{ id: 'x', letter: 'I', view: 'top', edge: { edge: 'e', near: [0, 0, 0] }, place: [0, 0] }], frames: [{ id: 'y', dim: 'd1', characteristic: 'flatness', value: 0.1, datums: [] }] });
  assert.equal(bad.datums, undefined); assert.equal(bad.frames, undefined);
});
