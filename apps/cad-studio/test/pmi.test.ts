import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { drawingInputs } from '@barocss/cad-model/chat/drawing';
import { autoLayout } from '@barocss/cad-model/drawing/layout';
import { acceptAll } from '@barocss/cad-model/drawing/tolerance';
import { issueContext } from '@barocss/cad-model/drawing/issues';
import { readDrawing } from '@barocss/cad-model/drawing/types';
import { modelAnnotations, type ModelAnnotation } from '@barocss/cad-model/drawing/annotations3d';
import { PMI_COLOR, PMI_SELECTED, pmiDrawings, pmiEdgeOn, pmiFacingKey, pmiLabels, pmiPick, pmiSelection } from '../src/viewport/pmiGeometry';

// G24 (G-R9): the drawing's annotations on the model as the viewport draws and picks them, on the outer lane's own
// fixture (the r14 geometrically toleranced plate, auto-dimensioned, tolerances accepted, a fit on its hole): every
// line and head of the data is drawn once, the selected annotation apart; texts lie in their planes (their height, their
// direction and up) or face the eye nearly edge-on; a click on a text picks its annotation and selects its targets by
// their persistent names on the evaluated bodies.

// (The test runs bundled from a temporary folder; the repository's conformance cases are read from the studio's cwd.)
const conformance = join(process.cwd(), '../../packages/barocss-cad/conformance');
function plate() {
  const c = JSON.parse(readFileSync(join(conformance, 'r14/tol-plate-geometric/case.json'), 'utf8')) as { input: { document: StudioDoc; drawing: unknown } };
  const doc = { ...emptyDoc(), ...c.input.document } as StudioDoc, i = drawingInputs(doc, { ...readDrawing(c.input.drawing), sheet: 'A3' });
  assert.ok(typeof i !== 'string', String(i));
  const meta = { ...i.meta, date: '2026-10-23' }, auto = autoLayout({ ...i, meta }).settings, tol = acceptAll({ ...i, meta, settings: auto }).settings;
  const settings = { ...tol, dimensions: tol.dimensions.map(d => d.kind === 'diameter' ? { ...d, tol: { kind: 'fit' as const, code: 'H7' } } : d) };
  const ctx = issueContext({ ...i, meta, settings });
  const items = modelAnnotations({ views: i.views, layout: ctx.layout, settings, sheet: ctx.sheet }).items;
  const result = evaluatePart(doc, 1);
  assert.ok(result.ok, JSON.stringify(!result.ok && result.error));
  return { items, bodies: result.ok ? result.bodies : [] };
}
const segments = (items: readonly ModelAnnotation[]) => items.reduce((n, a) => n + a.lines.length + a.arcs.reduce((m, c) => m + Math.max(4, Math.ceil(Math.abs(c.t1 - c.t0) / (Math.PI / 24))), 0) + a.arrows.filter(h => h.style === 'open').length * 2 + a.arrows.filter(h => h.style === 'tick').length, 0);

test('every line, arc and head of the data is drawn once; the selected annotation apart, in the accent colour', () => {
  const { items } = plate();
  assert.ok(items.length >= 5 && items.some(a => a.kind === 'datum') && items.some(a => a.kind === 'frame'), items.map(a => a.kind).join(','));
  const all = pmiDrawings(items), lines = all.find(d => d.name === 'pmi:lines')!;
  assert.equal(lines.positions.length / 6, segments(items));
  assert.deepEqual(lines.color, PMI_COLOR);
  // (Each line's ends are the data's, exactly in Float32.)
  const first = items[0].lines[0];
  assert.deepEqual(Array.from(lines.positions.slice(0, 6)), [...first.a, ...first.b].map(v => Math.fround(v)));
  const heads = all.find(d => d.name === 'pmi:heads');
  const filled = items.reduce((n, a) => n + a.arrows.filter(h => h.style === 'filled').length, 0), dots = items.reduce((n, a) => n + a.arrows.filter(h => h.style === 'dot').length, 0);
  assert.equal((heads?.positions.length ?? 0) / 9, filled + dots * 12);
  const sel = items.find(a => a.kind === 'frame')!, split = pmiDrawings(items, sel.id);
  const selLines = split.find(d => d.name === 'pmi:selected')!;
  assert.deepEqual(selLines.color, PMI_SELECTED);
  assert.equal(selLines.positions.length / 6 + split.find(d => d.name === 'pmi:lines')!.positions.length / 6, segments(items), 'the same segments, the selected ones apart');
});

test('texts lie in their planes at their height, or face the eye when the plane is nearly edge-on; the key changes only then', () => {
  const { items } = plate(), a = items[0], n = a.plane.normal;
  const square = pmiLabels(items, [-n[0], -n[1], -n[2]]);
  const label = square.plain.labels[0];
  assert.equal(label.text, a.texts[0].text); assert.equal(label.size, a.texts[0].height); assert.ok(label.plane, 'planar when seen square on');
  assert.deepEqual(Array.from(label.plane!.right), a.texts[0].dir);
  // (Seen along the plane's right: edge-on, so it faces the eye at 12 px.)
  const along = a.plane.right, edge = pmiLabels(items, along);
  assert.ok(pmiEdgeOn(n, along));
  const facing = edge.plain.labels.find(l => l.text === a.texts[0].text && !l.plane);
  assert.ok(facing && facing.size === 12);
  assert.notEqual(pmiFacingKey(items, along), pmiFacingKey(items, [-n[0], -n[1], -n[2]]));
  const sel = pmiLabels(items, [-n[0], -n[1], -n[2]], a.id);
  assert.ok(sel.selected && sel.selected.labels.length === a.texts.length && sel.plain.labels.length === square.plain.labels.length - a.texts.length);
});

test('a click on an annotation\'s text picks it; a miss picks none; its targets are selected by their names on the bodies', () => {
  const { items, bodies } = plate();
  // (An orthographic projection along the first item's normal, 1 px a mm: the plane's right and up on screen.)
  const a = items.find(x => x.kind === 'dimension')!, P = a.plane;
  const project = (p: readonly number[]): [number, number] => [p[0] * P.right[0] + p[1] * P.right[1] + p[2] * P.right[2], -(p[0] * P.up[0] + p[1] * P.up[1] + p[2] * P.up[2])];
  const sameView = items.filter(x => x.plane.normal.every((v, k) => Math.abs(v - P.normal[k]) < 1e-9));
  const t = a.texts[0], at = project(t.at), up = project([t.at[0] + t.up[0] * t.height / 2, t.at[1] + t.up[1] * t.height / 2, t.at[2] + t.up[2] * t.height / 2]);
  assert.equal(pmiPick(sameView, project, up[0], up[1], 3), a.id);
  assert.equal(pmiPick(sameView, project, at[0] + 1e5, at[1] + 1e5, 3), null);
  const sel = pmiSelection(a, bodies);
  const named = a.targets.filter(x => x.edge).length;
  assert.ok(named > 0 && sel.edges.length > 0 && sel.edges.length <= named, JSON.stringify({ named, sel }));
  for (const e of sel.edges) assert.ok(a.targets.some(x => x.edge && bodies[e.body].mesh.edges[e.edge].names.includes(x.edge)));
});
