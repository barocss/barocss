import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, starterDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { acceptProposal, dispatchTool, runTool, TOOLS, type ChatState } from '../src/chat/tools';
import { DRAWING_TOOL_NAMES } from '../src/chat/drawing';
import { readDrawing } from '../src/drawing/types';
import { withSampleRows } from './person-file';

// R14.5 (O6): the agent's drawing tools — the issue list and tolerance suggestions to read, Auto layout and dimensions,
// fixes and accepted suggestions as proposals only (a drawing change always needs the user, D41).

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
const hole = (node: number, center: [number, number], radius: number, extra: object = {}) => ({ kind: 'hole' as const, parent: { node, side: 'solid' as const }, center, radius, ...extra });

test('the drawing tools are offered, with schemas', () => {
  for (const name of DRAWING_TOOL_NAMES) { const t = TOOLS.find(x => x.name === name); assert.ok(t && t.description.length > 40 && t.input_schema, name); }
});

test('drawing_issues and tolerance_suggestions read the drawing and change nothing', async () => {
  const s = await stateOf(starterDoc());
  const r = await runTool(s, 'drawing_issues', {}, evaluate), out = parse(r.content);
  assert.ok(!r.isError && !r.changed, r.content); assert.equal(r.state.doc, s.doc, 'the document as it was');
  assert.deepEqual(out.issues.map((x: { code: string }) => x.code).sort(), ['HOLE_NOT_LOCATED', 'HOLE_SIZE_MISSING', 'OVERALL_MISSING']);
  assert.ok(out.issues.every((x: { fix?: string }) => x.fix === 'auto-dimension'));
  assert.deepEqual([out.sheet.sheet, out.sheet.scale, out.sheet.views], ['A4', '1:1', ['front', 'top', 'right', 'iso']]);
  // The other mode looked at without changing it: three datums and the note (a position frame comes with the hole's callout).
  const g = parse((await runTool(s, 'tolerance_suggestions', { mode: 'geometric' }, evaluate)).content);
  assert.equal(g.mode, 'geometric');
  assert.deepEqual(g.suggestions.map((x: { kind: string }) => x.kind).sort(), ['datum', 'datum', 'datum', 'general-note']);
  assert.ok(g.suggestions.find((x: { kind: string }) => x.kind === 'general-note').estimate);
  assert.equal(s.doc.drawing, undefined, 'still no drawing settings');
  // Nothing to draw: said so.
  const none = await runTool(await stateOf(emptyDoc()), 'drawing_issues', {}, evaluate);
  assert.ok(none.isError && /no body to draw/.test(none.content));
});

test('a drawing change is the user’s: refused made directly, made as a proposal, accepted only by the user', async () => {
  // (O7: the fastener sizes are the sample rows, loaded as the person loads them.)
  const s = await stateOf(withSampleRows(withNode(rectanglePart(100, 40, 10), hole(1, [20, 12], 3.3, { pattern: { count: 4, step: [20, 0] } }))));
  for (const [name, args] of [['auto_dimension', {}], ['set_drawing', { sheet: 'A3' }], ['fix_drawing', {}], ['accept_tolerances', {}]] as const) {
    const r = await runTool(s, name, args, evaluate);
    assert.ok(r.isError && /propose it/.test(r.content) && parse(r.content).code === 'needs_approval', `${name}: ${r.content}`);
    assert.equal(r.state.doc.drawing, undefined, `${name}: the drawing unchanged`);
  }
  // As a proposal: laid out, dimensioned and toleranced on a copy; the part and its drawing as they were.
  const p = await runTool(s, 'propose', { title: 'Drawing: dimensions and tolerances', plan: 'Auto layout and dimensions, then geometric tolerancing.', ops: [{ tool: 'auto_dimension', args: {} }, { tool: 'accept_tolerances', args: { mode: 'geometric' } }] }, evaluate);
  assert.ok(!p.isError, p.content);
  const out = parse(p.content);
  assert.deepEqual(out.risk.approval, ['drawing']);
  assert.equal(p.state.doc.drawing, undefined, 'the drawing is unchanged until the user accepts');
  // The agent may not accept it, at any autonomy (a drawing always needs the user).
  const own = await runTool(p.state, 'accept_proposal', { id: 'P1' }, evaluate);
  assert.ok(own.isError, own.content);
  // The user accepts: the drawing has its dimensions, datums and the frame; its issue list is clean.
  const accepted = await acceptProposal(p.state, 'P1', evaluate);
  assert.ok(!('error' in accepted), JSON.stringify(accepted));
  const doc = (accepted as { state: ChatState }).state.doc, d = readDrawing(doc.drawing);
  assert.ok(d.dimensions.length >= 6 && d.dimensions.some(x => x.count === 3));
  assert.deepEqual(d.datums!.map(x => x.letter).sort(), ['A', 'B', 'C']); assert.equal(d.frames!.length, 1); assert.equal(d.frames![0].value, 0.6);
  const after = parse((await dispatchTool({ ...p.state, doc }, 'drawing_issues', {}, evaluate)).content);
  assert.deepEqual(after.issues, []);
});

test('the change tools through dispatch (what a proposal replays): layout off, fixes by code, suggestions by id, settings', async () => {
  const s = await stateOf(starterDoc());
  const dims = await dispatchTool(s, 'auto_dimension', { layout: false }, evaluate), o = parse(dims.content);
  assert.ok(dims.changed && o.added.overall === 3 && o.sheet.views.length === 4, dims.content);
  const set = await dispatchTool(dims.state, 'set_drawing', { scale: 2, views: ['iso'], tolerancing: 'geometric', title: 'PLATE' }, evaluate), so = parse(set.content);
  assert.deepEqual([so.sheet.scale, so.sheet.views, so.sheet.tolerancing], ['2:1', ['front', 'top', 'iso'], 'geometric']);
  assert.ok((await dispatchTool(dims.state, 'set_drawing', { scale: 3 }, evaluate)).isError, 'not a standard scale');
  const sug = parse((await dispatchTool(set.state, 'tolerance_suggestions', {}, evaluate)).content).suggestions as { id: string; kind: string }[];
  const datum = sug.find(x => x.kind === 'datum')!;
  const one = await dispatchTool(set.state, 'accept_tolerances', { ids: [datum.id] }, evaluate);
  assert.equal(readDrawing(one.state.doc.drawing).datums!.length, 1);
  assert.match((await dispatchTool(set.state, 'accept_tolerances', { ids: ['nope'] }, evaluate)).content, /No suggestion nope/);
  // Fixes by code: only VIEWS_DONT_FIT's (back to an automatic scale).
  const big = await dispatchTool(set.state, 'set_drawing', { scale: 10 }, evaluate);
  const fixed = await dispatchTool(big.state, 'fix_drawing', { codes: ['VIEWS_DONT_FIT'] }, evaluate), fo = parse(fixed.content);
  assert.deepEqual(fo.applied, ['scale']); assert.equal(readDrawing(fixed.state.doc.drawing).scale, undefined);
});
