import test from 'node:test';
import assert from 'node:assert/strict';
import type { BrepProjection } from '@barocss/cad';
import { checkDatumTargetOptions, datumTargetConflicts, datumTargetsProperty, readDatumTargets, resolveDatumTarget, type DrawingDatumTarget } from '../src/drawing/datumTargets';
import { validate, type JsonSchema } from '../src/chat/contract';
import { drawingInputs, runDrawingTool } from '../src/chat/drawing';
import { starterDoc, type StudioDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { defaultDrawing, readDrawing } from '../src/drawing/types';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { modelAnnotations } from '../src/drawing/annotations3d';
import { sheetGroupsSvg, sheetSvg } from '../src/io/svg';
import { changeDrawingScope } from '../src/drawing/scope';

const target: DrawingDatumTarget = { id: 'point-a1', letter: 'A', number: 1, view: 'front', place: [-12, 16], point: { edge: 'instance/edge-1', at: 'end', near: [1, 0, 0] } };
const edge: BrepProjection['edges'][number] = { name: target.point.edge, kind: 'line', ends: [[0, 0, 0], [64, 0, 0]], circle: null, pieces: [{ curve: { kind: 'line', a: [0, 0], b: [64, 0] }, visible: true }] };
const projection: BrepProjection = { right: [1, 0, 0], up: [0, 0, 1], toward: [0, -1, 0], min: [0, 0], max: [64, 0], edges: [edge] };
const inputOf = (doc: StudioDoc) => {
  const input = drawingInputs(doc);
  if (typeof input === 'string') assert.fail(input);
  return input;
};

test('DR6 endpoint targets: schema and authored input refuse atomically; legacy and saved duplicate evidence remain', () => {
  assert.deepEqual(validate(datumTargetsProperty as JsonSchema, [target]), []);
  assert.deepEqual(checkDatumTargetOptions({ datumTargets: [target] }), []);
  const legacy = { ...starterDoc(), drawing: { ...defaultDrawing(), notes: [{ id: 'old-note', text: 'Keep this note', at: [12, 18] as [number, number] }], datumTargets: [target] } };
  const before = JSON.stringify(legacy);
  const sparse = new Array(1);
  const sparsePlace = new Array(2); sparsePlace[1] = 0;
  const bad = [null, sparse, [target, target], [target, { ...target, id: 'other' }], [{ ...target, number: 0 }], [{ ...target, number: 1.5 }], [{ ...target, number: Number.MAX_SAFE_INTEGER + 1 }], [{ ...target, letter: 'I' }], [{ ...target, place: sparsePlace }], [{ ...target, extra: true }], [{ ...target, point: { ...target.point, at: 'center' } }], [{ ...target, point: { ...target.point, near: [0, NaN, 0] } }], [{ ...target, point: { ...target.point, sig: {} } }], Array.from({ length: 201 }, (_, i) => ({ ...target, id: `target-${i}`, number: i + 1 }))];
  for (const datumTargets of bad) {
    assert.equal(checkDatumTargetOptions({ datumTargets })[0]?.code, 'DRAWING_OPTIONS');
    const result = runDrawingTool(legacy, 'set_drawing', { title: 'Must not apply', datumTargets });
    assert.ok('error' in result && result.error.includes('DRAWING_OPTIONS'));
    assert.equal(JSON.stringify(legacy), before);
  }
  const kept = runDrawingTool(legacy, 'set_drawing', { title: 'New title' });
  if ('error' in kept) assert.fail(kept.error);
  assert.deepEqual(kept.doc.drawing?.datumTargets, [target]);
  assert.deepEqual(kept.doc.drawing?.notes, legacy.drawing.notes);
  const cleared = runDrawingTool(legacy, 'set_drawing', { datumTargets: [] });
  if ('error' in cleared) assert.fail(cleared.error);
  assert.equal(cleared.doc.drawing?.datumTargets, undefined);
  assert.deepEqual(cleared.doc.drawing?.notes, legacy.drawing.notes);
  const raw = [target, { ...target, id: 'other' }, { ...target, number: 2 }];
  const saved = readDatumTargets(raw);
  assert.deepEqual(saved, raw);
  assert.notEqual(saved[0].point, target.point);
  assert.notEqual(saved[0].point.near, target.point.near);
  assert.notEqual(saved[0].place, target.place);
  assert.equal(datumTargetConflicts(saved).size, 3, 'all rows involved in either duplicate are diagnosed');
  assert.deepEqual(readDrawing({ datumTargets: saved }).datumTargets, raw);
  assert.equal(readDrawing(defaultDrawing()).datumTargets, undefined);
});

test('DR6 endpoint targets: current literal 3D endpoints replace the hint; missing, duplicate, tied and non-line references stay unresolved', () => {
  assert.deepEqual(resolveDatumTarget(projection, target), { ok: true, at: [0, 0, 0], edge: 'instance/edge-1' });
  const moved: BrepProjection = { ...projection, edges: [{ ...edge, ends: [[10, 0, 0], [74, 0, 0]] }] };
  assert.deepEqual(resolveDatumTarget(moved, target), { ok: true, at: [10, 0, 0], edge: 'instance/edge-1' });
  const cases: [BrepProjection, DrawingDatumTarget, string][] = [
    [{ ...projection, edges: [] }, target, 'DATUM_TARGET_LOST'],
    [{ ...projection, edges: [edge, edge] }, target, 'DATUM_TARGET_AMBIGUOUS'],
    [projection, { ...target, point: { ...target.point, near: [32, 0, 0] } }, 'DATUM_TARGET_AMBIGUOUS'],
    [{ ...projection, edges: [{ ...edge, kind: 'silhouette' }] }, target, 'DATUM_TARGET_UNSUPPORTED'],
    [{ ...projection, edges: [{ ...edge, kind: 'circle' }] }, target, 'DATUM_TARGET_UNSUPPORTED'],
    [{ ...projection, edges: [{ ...edge, ends: null }] }, target, 'DATUM_TARGET_UNSUPPORTED'],
    [projection, { ...target, point: { ...target.point, near: [0, Infinity, 0] } }, 'DATUM_TARGET_INVALID'],
  ];
  for (const [view, item, code] of cases) {
    const result = resolveDatumTarget(view, item);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
  }
  assert.deepEqual(target.point.near, [1, 0, 0]);
});

test('DR6 endpoint targets: a scope change cannot silently retarget a sheet with a saved point target', () => {
  const settings = { ...defaultDrawing(), datumTargets: [target] }, before = JSON.stringify(settings);
  assert.deepEqual(changeDrawingScope(settings, { kind: 'part' }).datumTargets, [target]);
  assert.throws(() => changeDrawingScope(settings, { kind: 'assembly' }), /DRAWING_SCOPE_REFERENCES/);
  assert.equal(JSON.stringify(settings), before);
});

test('DR6 endpoint targets: drawing.set and the real file codec preserve sheet/PMI identity; lost and duplicate targets remain visible as diagnostics', async () => {
  const doc = starterDoc(), first = inputOf(doc);
  const current = first.views.front.edges.find(e => e.kind === 'line' && e.circle === null && e.ends?.some(p => p.every(v => v === 0)) && e.ends.some(p => p[0] === 64 && p[1] === 0 && p[2] === 0));
  assert.ok(current, 'the 64 by 32 by 8 starter has a real straight edge from [0,0,0] to [64,0,0]');
  const authored: DrawingDatumTarget = { ...target, point: { edge: current.name, at: 'end', near: [1, 0, 0] } };
  const moving: DrawingDatumTarget = { ...authored, id: 'point-a2', number: 2, place: [76, 16], point: { ...authored.point, near: [63, 0, 0] } };
  const legacyDatum = { id: authored.id, letter: 'B', view: 'front' as const, place: [-20, 20] as [number, number], edge: { edge: current.name, near: [0, 0, 0] as [number, number, number] } };
  const applied = runDrawingTool(doc, 'set_drawing', { datums: [legacyDatum], datumTargets: [authored, moving] });
  if ('error' in applied) assert.fail(applied.error);
  const opened = await readStudioFile(encodeStudioFile(applied.doc));
  assert.ok('doc' in opened, 'the actual Studio container reopens');
  assert.deepEqual(opened.doc.drawing?.datumTargets, [authored, moving]);
  assert.deepEqual(opened.doc.drawing?.datums, [legacyDatum]);
  const input = inputOf(opened.doc), ctx = issueContext(input);
  const group = ctx.sheet.groups.find(g => g.datumTarget && g.id === authored.id);
  assert.ok(group, 'the target reaches the actual sheet display list');
  assert.ok(group.marks.some(m => m.kind === 'text' && m.text === 'A1'));
  assert.ok(group.marks.some(m => m.kind === 'arc' && m.t1 - m.t0 === 2 * Math.PI), 'a point target has a divided circular label');
  const fragment = sheetGroupsSvg({ ...ctx.sheet, groups: [group] });
  assert.match(fragment, /data-datum-target="point-a1"/);
  assert.doesNotMatch(fragment, /data-dim=/);
  const targetSelected = sheetGroupsSvg({ ...ctx.sheet, groups: [group] }, null, authored.id);
  assert.match(targetSelected, /class="datum sel"/);
  assert.doesNotMatch(sheetGroupsSvg({ ...ctx.sheet, groups: [group] }, authored.id), /class="datum sel"/);
  assert.match(sheetSvg(ctx.sheet, 'Endpoint target'), />A1<\/text>/);
  const pmi = modelAnnotations({ ...input, layout: ctx.layout, sheet: ctx.sheet });
  const item = pmi.items.find(a => a.id === authored.id && a.datum?.targetNumber === 1);
  assert.ok(item, 'PMI distinguishes a target from a legacy datum with the same id');
  assert.deepEqual(item.targets, [{ at: [0, 0, 0], edge: current.name }]);
  assert.ok(item.text.includes('A1'));
  assert.deepEqual(pmi.items.find(a => a.id === moving.id)?.targets, [{ at: [64, 0, 0], edge: current.name }]);
  assert.ok(!drawingIssues(ctx).some(i => i.code.startsWith('DATUM_TARGET_')));

  const base = opened.doc.nodes[0];
  assert.ok(base.kind === 'sketch' && base.profile === 'rectangle');
  const widened: StudioDoc = { ...opened.doc, nodes: opened.doc.nodes.map((node, index): StudioDoc['nodes'][number] => index === 0 && node.kind === 'sketch' && node.profile === 'rectangle' ? { ...node, max: [80, 32] } : node) };
  const changed = inputOf(widened), changedContext = issueContext(changed);
  const changedPmi = modelAnnotations({ ...changed, layout: changedContext.layout, sheet: changedContext.sheet });
  assert.deepEqual(changedPmi.items.find(a => a.id === moving.id)?.targets, [{ at: [80, 0, 0], edge: current.name }], 'the same stored target follows the current endpoint after a real sketch width edit');
  assert.deepEqual(widened.drawing?.datumTargets, [authored, moving], 'the saved selection hints are not replaced with sampled geometry');

  for (const [rows, code] of [[[{ ...authored, point: { ...authored.point, edge: 'missing-edge' } }], 'DATUM_TARGET_LOST'], [[authored, { ...authored, id: 'other' }], 'DATUM_TARGET_DUPLICATE']] as const) {
    const stored = { ...opened.doc, drawing: { ...readDrawing(opened.doc.drawing), datumTargets: [...rows] } };
    const before = JSON.stringify(stored), next = inputOf(stored), context = issueContext(next);
    assert.ok(drawingIssues(context).some(i => i.code === code));
    assert.ok(!context.sheet.groups.some(g => g.datumTarget));
    const annotations = modelAnnotations({ ...next, layout: context.layout, sheet: context.sheet });
    assert.ok(annotations.left.some(a => a.id === authored.id && a.code === code));
    assert.equal(JSON.stringify(stored), before, 'diagnosis does not repair or discard the saved target');
  }
});
