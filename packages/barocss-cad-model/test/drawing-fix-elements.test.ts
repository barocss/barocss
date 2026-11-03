import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { editBearingRows } from '../src/engine/bearings';
import { editFitTables } from '../src/engine/fits';
import { drawingInputs } from '../src/chat/drawing';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { snapPoints } from '../src/drawing/dimensions';

// O172 (A9's F8). Fix's Auto-dimension had no part elements, so it dropped the keyseat's dimensions (O146's plans);
// a snap point kept the first edge found at a place, hidden or not; and in a later round of one Fix, Auto-dimension and the
// moves undid each other on issues it cannot meet. (Kept from O170's note:) One Fix leaves a sheet it can fix fixed. On the default shaft with its key and bearing, Fix adds the
// keyseat's section B (O148 X3) and places the dimensions again; the new section is a new view, and the overlap it brings
// (a dimension over the key's note) was invisible to that same pass, so a second Fix was needed. Fix now builds the sheet
// again and fixes what it shows until a round applies none.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const ROW = { id: '6204', designation: '6204', bore: 20, outside: 47, width: 14, chamfer: 1, daMin: 25, daMax: 26.5, DaMax: 42, raMax: 1, source: 'test' };
const FITS = { id: 'f', rows: [{ class: 'k5', over: 18, upTo: 30, upper: 0.011, lower: 0.002, estimate: true }] };
async function shaft(): Promise<ChatState> {
  let s: ChatState = { doc: emptyDoc(), bodies: [] };
  const call = async (tool: string, args: Record<string, unknown>) => { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, r.content); s = r.state; return JSON.parse(r.content); };
  await call('features', { action: 'command', command: 'shaft', values: {} });
  const bearingRows = editBearingRows(s.doc, [ROW]); assert.ok('doc' in bearingRows, 'error' in bearingRows ? bearingRows.error : '');
  const fitTables = editFitTables(bearingRows.doc, [FITS]); assert.ok('doc' in fitTables, 'error' in fitTables ? fitTables.error : '');
  s = { ...s, doc: fitTables.doc };
  await call('features', { action: 'command', command: 'key', values: { h: 6 }, bodies: ['b0'] });
  await call('features', { action: 'command', command: 'bearing', values: { sc: 'k5', step: 3, against: 'start' }, bodies: ['b0'] });
  await call('drawing', { action: 'auto' });
  return s;
}

test('O172: one Fix on the shaft keeps the keyseat\'s dimension, on its section B; it dimensions again only in its first round and after the section', async () => {
  let s = await shaft();
  const r = await dispatchTool(s, 'drawing', { action: 'fix' }, evaluate); assert.ok(!r.isError, r.content); s = r.state;
  const applied = (JSON.parse(r.content) as { applied: string[] }).applied;
  assert.ok(applied.includes('add-section'));
  assert.equal(applied.filter(k => k === 'auto-dimension').length, 2, JSON.stringify(applied));
  const onSection = (s.doc.drawing?.dimensions ?? []).filter(d => d.view === 'section:B');
  assert.equal(onSection.length, 1, 'the keyseat\'s d − t1 on section B–B');
  const i = drawingInputs(s.doc); if (typeof i === 'string') throw Error(i);
  assert.deepEqual(drawingIssues(issueContext(i)).filter(x => x.severity === 'error').map(x => x.code), []);
});

test('O172: where two edges meet one place on the view, the snap point is the visible edge\'s, whichever was found first', () => {
  const line = (x: number) => ({ kind: 'line' as const, a: [x, 0] as [number, number], b: [x, 10] as [number, number] });
  const edge = (name: string, visible: boolean) => ({ name, kind: 'line' as const, ends: [[0, 0, 0], [0, 10, 0]] as [[number, number, number], [number, number, number]], circle: null, pieces: [{ curve: line(0), visible }] });
  const pr = { right: [1, 0, 0], up: [0, 1, 0], toward: [0, 0, 1], edges: [edge('hidden.one', false), edge('shown.one', true)], min: [0, 0], max: [0, 10] } as never;
  assert.deepEqual(snapPoints(pr).map(p => p.ref.edge), ['shown.one', 'shown.one']);
  const first = { ...(pr as object), edges: [edge('shown.one', true), edge('hidden.one', false)] } as never;
  assert.deepEqual(snapPoints(first).map(p => p.ref.edge), ['shown.one', 'shown.one']);
});

test('round circle center snaps prefer the visible rim while endpoints retain their legacy ranking', () => {
  const arc = { kind: 'arc' as const, center: [28, 0] as [number, number], u: [2, 0] as [number, number], v: [0, 2] as [number, number], t0: 0, t1: Math.PI };
  const edge = (name: string, z: number, centerY: number, visible: boolean) => ({
    name, kind: 'circle' as const, ends: [[26, 0, z], [30, 0, z]],
    circle: { center: [28, centerY, z], radius: 2, normal: [0, 0, 1], full: false, sweep: Math.PI },
    pieces: visible ? [{ curve: arc, visible: true }] : [],
  });
  const bottom = edge('empty.bottom', 0, -4.440892098500626e-16, false), top = edge('visible.top', 10, 3.9968028886505635e-15, true);
  const projection = (edges: unknown[]) => ({ right: [1, 0, 0], up: [0, 1, 0], toward: [0, 0, 1], edges, min: [-20, -20], max: [60, 20] }) as never;
  for (const edges of [[bottom, top], [top, bottom]]) {
    const snaps = snapPoints(projection(edges)); assert.equal(snaps.length, 3);
    const center = snaps.find(s => s.ref.at === 'center')!; assert.equal(center.ref.edge, top.name); assert.deepEqual(center.ref.near, top.circle.center);
    const ends = snaps.filter(s => s.ref.at === 'end'); assert.equal(ends.length, 2);
    assert.ok(ends.every(s => s.ref.edge === edges[0].name && s.ref.near[2] === edges[0].circle.center[2]), 'empty-circle endpoints retain the first legacy-visible reference');
  }
  const fallback = snapPoints(projection([bottom])); assert.equal(fallback.length, 3);
  assert.ok(fallback.every(s => s.ref.edge === bottom.name && s.ref.near[2] === 0));
  assert.deepEqual(fallback.find(s => s.ref.at === 'center')!.ref.near, bottom.circle.center);
  const nonround = [bottom, top].map(e => ({ ...e, circle: { ...e.circle, normal: [0, 1, 0] } }));
  assert.equal(snapPoints(projection(nonround)).find(s => s.ref.at === 'center')!.ref.edge, bottom.name, 'non-round centers keep the legacy first-reference policy');
});
