import test from 'node:test';
import assert from 'node:assert/strict';
import type { BrepProjection } from '@barocss/cad';
import { starterDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { drawingInputs } from '../src/chat/drawing';
import { defaultDrawing, readDrawing, type DrawingFrame, type DrawingSettings, type DrawingViews, type Vec3 } from '../src/drawing/types';
import { issueContext, drawingIssues } from '../src/drawing/issues';
import { modelAnnotations } from '../src/drawing/annotations3d';
import { holesOf } from '../src/drawing/auto';
import { frontByInformation } from '../src/drawing/layout';
import { reorient } from '../src/drawing/reorient';
import { applySuggestion, toleranceSuggestions } from '../src/drawing/tolerance';
import { sheetGroupsSvg, sheetSvg } from '../src/io/svg';

const standalone: Extract<DrawingFrame, { view: string }> = { id: 'standalone', view: 'front', place: [10, 20], characteristic: 'flatness', value: 0.25, datums: [] };
const inputs = (doc = starterDoc()) => {
  const input = drawingInputs(doc);
  if (typeof input === 'string') assert.fail(input);
  return input;
};

test('standalone frame: real file codec reaches sheet and SVG at view-mm place while attached geometry and PMI remain attached', async () => {
  const input = inputs();
  const edge = input.views.front.edges.find(e => e.kind === 'line' && e.ends?.some(p => p[0] === 0 && p[1] === 0 && p[2] === 0) && e.ends.some(p => p[0] === 64 && p[1] === 0 && p[2] === 0));
  assert.ok(edge, 'the starter has a real 64 mm edge');
  const attached: DrawingFrame = { id: 'attached', dim: 'd1', characteristic: 'straightness', value: 0.1, datums: [] };
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [{ id: 'd1', kind: 'linear', view: 'front', a: { edge: edge.name, at: 'end', near: [0, 0, 0] }, b: { edge: edge.name, at: 'end', near: [64, 0, 0] }, orient: 'horizontal', place: [0, -10] }], frames: [attached, standalone] };
  const doc = { ...starterDoc(), drawing: settings }, before = structuredClone(doc);
  const opened = await readStudioFile(encodeStudioFile(doc));
  assert.ok('doc' in opened);
  assert.deepEqual(opened.doc.drawing?.frames, [attached, standalone]);
  for (const scale of [0.5, 2]) {
    const current = { ...readDrawing(opened.doc.drawing), scale }, ctx = issueContext({ ...input, settings: current });
    const group = ctx.sheet.groups.find(g => g.standaloneFrame && g.id === standalone.id);
    assert.ok(group);
    assert.equal(group.role, 'control'); assert.equal(group.view, 'front');
    const border = group.marks[0]; assert.ok(border.kind === 'polyline');
    const origin = ctx.layout.views.front.origin;
    assert.deepEqual(border.points[0], [origin[0] + scale * 10, origin[1] - scale * 20], 'view-mm place is the frame top-left, converted once');
    assert.ok(Math.abs(border.points[2][1] - border.points[0][1] - 6) <= 1e-9, 'the frame stays 6 paper mm high');
    assert.deepEqual(group.marks.filter(m => m.kind === 'text').map(m => m.text), ['0.25']);
    const without = issueContext({ ...input, settings: { ...current, frames: [attached] } });
    assert.deepEqual(ctx.sheet.groups.filter(g => g.role === 'view'), without.sheet.groups.filter(g => g.role === 'view'));
    assert.deepEqual(ctx.sheet.groups.find(g => g.role === 'control' && g.id === attached.id), without.sheet.groups.find(g => g.role === 'control' && g.id === attached.id), 'standalone rendering leaves the attached path unchanged');
    const fragment = sheetGroupsSvg({ ...ctx.sheet, groups: [group] }, null, null, standalone.id);
    assert.match(fragment, /class="control sel"/); assert.match(fragment, /data-standalone-frame="standalone"/);
    assert.doesNotMatch(fragment, /data-dim=|data-datum-target=/);
    assert.doesNotMatch(sheetGroupsSvg({ ...ctx.sheet, groups: [group] }, standalone.id), /class="control sel"/);
    assert.match(sheetSvg(ctx.sheet, 'Standalone frame'), /width="297mm" height="210mm"/);
    const pmi = modelAnnotations({ ...input, settings: current, layout: ctx.layout, sheet: ctx.sheet });
    assert.ok(pmi.items.some(item => item.id === attached.id && item.kind === 'frame' && item.frame?.dim === 'd1'));
    assert.ok(!pmi.items.some(item => item.id === standalone.id));
    assert.ok(pmi.left.some(item => item.id === standalone.id && item.why === 'a standalone frame has no attached model geometry'));
  }
  assert.deepEqual(doc, before);
});

test('standalone frame: hidden or missing views and missing datums are explicit diagnostics without retarget or deletion', () => {
  const input = inputs();
  for (const frame of [{ ...standalone, view: 'right' as const }, { ...standalone, view: 'section:ZZ' as const }, { ...standalone, view: 'detail:ZZ' as const }]) {
    const settings: DrawingSettings = { ...defaultDrawing(), views: ['front', 'top'], frames: [frame] }, before = structuredClone(settings);
    const ctx = issueContext({ ...input, settings }), issues = drawingIssues(ctx);
    const code = frame.view === 'right' ? 'VIEW_NEEDED' : 'FRAME_VIEW_MISSING';
    assert.ok(issues.some(issue => issue.code === code && issue.frames?.includes(frame.id) && issue.view === frame.view));
    assert.ok(!issues.some(issue => issue.code === 'FRAME_LOST' && issue.frames?.includes(frame.id)));
    assert.ok(!ctx.sheet.groups.some(group => group.standaloneFrame));
    assert.deepEqual(settings, before);
  }
  const settings: DrawingSettings = { ...defaultDrawing(), frames: [{ ...standalone, datums: ['A'], place: [1e6, 1e6] }] }, before = structuredClone(settings);
  const ctx = issueContext({ ...input, settings }), issues = drawingIssues(ctx);
  assert.ok(issues.some(issue => issue.code === 'DATUM_UNDEFINED' && issue.frames?.includes(standalone.id)));
  assert.ok(issues.some(issue => issue.code === 'OFF_SHEET' && issue.frames?.includes(standalone.id) && issue.fix === undefined));
  assert.deepEqual(settings, before);
});

test('standalone frame: reorient follows explicit view axes and keeps missing parents; tolerance suggestions preserve standalone IDs', () => {
  // Agent-authored plane fixtures test coordinate policy, not a native projection oracle.
  const projection = (right: Vec3, up: Vec3, toward: Vec3): BrepProjection => ({ right, up, toward, min: [0, 0], max: [64, 32], edges: [] });
  const from: DrawingViews = { front: projection([1, 0, 0], [0, 0, 1], [0, -1, 0]), top: projection([1, 0, 0], [0, 1, 0], [0, 0, 1]), right: projection([0, 1, 0], [0, 0, 1], [1, 0, 0]), iso: projection([1, 0, 0], [0, 0, 1], [1, -1, 1]) };
  const to: DrawingViews = { front: projection([0, 1, 0], [0, 0, 1], [1, 0, 0]), top: projection([0, 1, 0], [-1, 0, 0], [0, 0, 1]), right: projection([-1, 0, 0], [0, 0, 1], [0, 1, 0]), iso: from.iso };
  const frames: DrawingFrame[] = [standalone, { ...standalone, id: 'top', view: 'top' }, { ...standalone, id: 'section', view: 'section:A' }, { ...standalone, id: 'detail', view: 'detail:B' }, { ...standalone, id: 'missing', view: 'section:ZZ' }, { ...standalone, id: 'iso', view: 'iso' }, { id: 'attached', dim: 'absent-dimension', characteristic: 'flatness', value: 0.1, datums: [] }];
  const settings: DrawingSettings = { ...defaultDrawing(), sections: [{ id: 'A', view: 'top', at: 4 }], details: [{ id: 'B', view: 'top', center: [0, 0], radius: 10 }], frames }, before = structuredClone(settings);
  const result = reorient(from, to, settings, 'x+'); assert.ok(result.ok);
  assert.deepEqual(result.settings.frames?.map(frame => frame.dim === undefined ? [frame.view, frame.place] : [frame.dim]), [['right', [-10, 20]], ['top', [20, -10]], ['section:A', [20, -10]], ['detail:B', [20, -10]], ['section:ZZ', [10, 20]], ['iso', [10, 20]], ['absent-dimension']]);
  assert.deepEqual(settings, before);

  const doc = starterDoc(), hole = doc.nodes.find(node => node.kind === 'hole');
  assert.ok(hole?.kind === 'hole');
  assert.equal(hole.radius, 4, 'the authored hole remains nominal diameter 8 mm');
  const input = inputs(doc);
  // Select the same authored hole as the tolerance consumer, not bit-exact reconstructed NURBS values.
  const circle = holesOf(input.views, input.callout).find(candidate => candidate.view === 'top' && candidate.callout === 'Ø8 THRU' && candidate.edge.name.split('|').some(face => face.startsWith(`${hole.id}.side`)))?.edge;
  assert.ok(circle?.circle, `Expected the starter Ø8 top hole; actual top candidates: ${JSON.stringify(input.views.top.edges.filter(edge => edge.circle || edge.name.split('|').some(face => face.startsWith(`${hole.id}.side`))).map(edge => ({ key: edge.name, kind: edge.kind, circle: edge.circle ? { radius: edge.circle.radius, normal: edge.circle.normal, center: edge.circle.center } : null })))}`);
  const collision: DrawingFrame = { ...standalone, id: 'frame-hole' };
  const geometric: DrawingSettings = { ...defaultDrawing(), tolerancing: 'geometric', frames: [collision], dimensions: [{ id: 'hole', kind: 'diameter', view: 'top', edge: circle.name, near: [...circle.circle.center], place: [60, 16] }, { id: 'hole-2', kind: 'diameter', view: 'top', edge: circle.name, near: [...circle.circle.center], place: [60, 26] }] };
  const suggestions = toleranceSuggestions(issueContext({ ...input, settings: geometric }));
  const suggestion = suggestions.find(s => s.kind === 'position');
  assert.ok(suggestion && suggestion.change.kind === 'frame');
  assert.equal(suggestion.change.frame.dim, 'hole'); assert.equal(suggestion.change.frame.id, 'frame-hole-2');
  assert.equal(suggestion.change.frame.value, 0.2);
  const positions = suggestions.filter(s => s.kind === 'position');
  assert.equal(positions.length, 2);
  assert.deepEqual(positions.map(s => s.change.kind === 'frame' ? s.change.frame.id : null), ['frame-hole-2', 'frame-hole-2-2'], 'one returned list reserves each generated id before the next suggestion');
  const accepted = positions.reduce((current, proposed) => applySuggestion(current, proposed), geometric);
  assert.deepEqual(accepted.frames?.find(f => f.id === collision.id), collision);
  assert.equal(accepted.frames?.length, 3);
  assert.equal(new Set(accepted.frames?.map(f => f.id)).size, 3, 'apply the original returned list without recalculating suggestions');

  // A synthetic information imbalance tests front-selection policy, not projection geometry.
  const informationViews: DrawingViews = { ...input.views, front: { ...input.views.front, edges: [] } };
  assert.ok(frontByInformation(informationViews, defaultDrawing()), 'the unchanged real right view has more information than the empty front');
  assert.equal(frontByInformation(informationViews, { ...defaultDrawing(), frames: [standalone] }), null, 'a manually placed standalone frame keeps the current front');
});
