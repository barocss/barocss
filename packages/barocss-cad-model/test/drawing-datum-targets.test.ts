import test from 'node:test';
import assert from 'node:assert/strict';
import type { BrepProjection } from '@barocss/cad';
import { checkDatumTargetOptions, datumTargetConflicts, datumTargetEndpoint, datumTargetsProperty, readDatumTargets, resolveDatumTarget, type DrawingDatumTarget, type DrawingPointDatumTarget } from '../src/drawing/datumTargets';
import { validate, type JsonSchema } from '../src/chat/contract';
import { drawingInputs, runDrawingTool } from '../src/chat/drawing';
import { starterDoc, type StudioDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { defaultDrawing, readDrawing } from '../src/drawing/types';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { modelAnnotations } from '../src/drawing/annotations3d';
import { sheetGroupsSvg, sheetSvg } from '../src/io/svg';
import { changeDrawingScope } from '../src/drawing/scope';
import { candidatesFor, captureSignatures, confirmReference, referencesOf, refreshSignatures, verifyReferences } from '../src/engine/references';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';

const target: DrawingPointDatumTarget = { id: 'point-a1', letter: 'A', number: 1, view: 'front', place: [-12, 16], point: { edge: 'instance/edge-1', at: 'end', near: [1, 0, 0], endpoint: 'min', sig: { k: 'line', p: [32, 0, 0], d: [1, 0, 0], s: 64 } } };
const edge: BrepProjection['edges'][number] = { name: target.point.edge, kind: 'line', ends: [[0, 0, 0], [64, 0, 0]], circle: null, pieces: [{ curve: { kind: 'line', a: [0, 0], b: [64, 0] }, visible: true }] };
const projection: BrepProjection = { right: [1, 0, 0], up: [0, 0, 1], toward: [0, -1, 0], min: [0, 0], max: [64, 0], edges: [edge] };
// Agent-authored reference-unit data, not native geometry or browser acceptance.
function lineBody(a: [number, number, number], b: [number, number, number], name = target.point.edge): BodyResult {
  return { key: 'b1', family: 'planar', volume: null, mass: null, mesh: {
    positions: new Float32Array(), normals: new Float32Array(), faceOfVertex: new Float32Array(), indices: new Uint32Array(),
    edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), faces: [],
    edges: [{ index: 0, names: [name], a, b, faces: [0, 0], straight: true, axis: null }], bounds: { min: a, max: b },
  } };
}
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
  const bad = [null, sparse, [target, target], [target, { ...target, id: 'other' }], [{ ...target, number: 0 }], [{ ...target, number: 1.5 }], [{ ...target, number: Number.MAX_SAFE_INTEGER + 1 }], [{ ...target, letter: 'I' }], [{ ...target, place: sparsePlace }], [{ ...target, extra: true }], [{ ...target, point: { ...target.point, at: 'center' } }], [{ ...target, point: { ...target.point, endpoint: undefined } }], [{ ...target, point: { ...target.point, endpoint: 'first' } }], [{ ...target, point: { ...target.point, near: [0, NaN, 0] } }], [{ ...target, point: { ...target.point, sig: {} } }], [{ ...target, point: { ...target.point, was: 1 } }], Array.from({ length: 201 }, (_, i) => ({ ...target, id: `target-${i}`, number: i + 1 }))];
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
  assert.notEqual(saved[0].point.sig, target.point.sig);
  assert.notEqual(saved[0].point.sig!.p, target.point.sig!.p);
  assert.notEqual(saved[0].point.sig!.d, target.point.sig!.d);
  const marked = { ...target, point: { ...target.point, was: 'previous-edge' } };
  assert.deepEqual(checkDatumTargetOptions({ datumTargets: [marked] }), []);
  assert.deepEqual(readDatumTargets([marked]), [marked]);
  const nearOnly = { ...target, point: { edge: target.point.edge, at: 'end' as const, near: [63, 0, 0] as [number, number, number] } };
  assert.deepEqual(readDatumTargets([nearOnly]), [nearOnly], 'legacy near-only evidence is preserved without inventing an endpoint or signature');
  assert.deepEqual(checkDatumTargetOptions({ datumTargets: [nearOnly] }).map(p => p.code), ['DRAWING_OPTIONS']);
  assert.equal(datumTargetConflicts(saved).size, 3, 'all rows involved in either duplicate are diagnosed');
  assert.deepEqual(readDrawing({ datumTargets: saved }).datumTargets, raw);
  assert.equal(readDrawing(defaultDrawing()).datumTargets, undefined);
});

test('DR6 endpoint targets: signed endpoint identity never switches after translation, width changes or edge ID reuse', async () => {
  assert.deepEqual(resolveDatumTarget(projection, target), { ok: true, at: [0, 0, 0], edge: 'instance/edge-1' });
  const maximum: DrawingDatumTarget = { ...target, point: { ...target.point, endpoint: 'max', near: [63, 0, 0] } };
  assert.deepEqual(resolveDatumTarget(projection, maximum), { ok: true, at: [64, 0, 0], edge: target.point.edge });
  const reversed: BrepProjection = { ...projection, edges: [{ ...edge, ends: [[64, 0, 0], [0, 0, 0]] }] };
  assert.deepEqual(resolveDatumTarget(reversed, maximum), { ok: true, at: [64, 0, 0], edge: target.point.edge }, 'max is lexicographic 3D identity, not a raw endpoint index');
  assert.deepEqual(resolveDatumTarget(projection, { ...target, point: { ...target.point, near: [32, 0, 0] } }), { ok: true, at: [0, 0, 0], edge: target.point.edge }, 'an equal-distance hint does not override the explicit endpoint');
  assert.equal(datumTargetEndpoint([[64, 0, 0], [0, 0, 0]], [64, 0, 0]), 'max');
  assert.equal(datumTargetEndpoint([[1, 4, 0], [1, 2, 8]], [1, 2, 8]), 'min', 'y decides when x is equal');
  assert.equal(datumTargetEndpoint([[1, 2, 8], [1, 2, 4]], [1, 2, 8]), 'max', 'z decides when x and y are equal');
  const changedEnds: NonNullable<BrepProjection['edges'][number]['ends']>[] = [[[100, 0, 0], [164, 0, 0]], [[0, 0, 0], [200, 0, 0]], [[100, 0, 0], [100, 64, 0]]];
  for (const ends of changedEnds) {
    const changed: BrepProjection = { ...projection, edges: [{ ...edge, ends }] };
    const result = resolveDatumTarget(changed, maximum);
    assert.equal(result.ok, false, 'translation, width or a reused edge name must not silently select the nearer opposite endpoint');
    if (!result.ok) assert.equal(result.code, 'DATUM_TARGET_UNVERIFIED');
  }
  const cases: [BrepProjection, DrawingDatumTarget, string][] = [
    [{ ...projection, edges: [] }, target, 'DATUM_TARGET_LOST'],
    [{ ...projection, edges: [edge, edge] }, target, 'DATUM_TARGET_AMBIGUOUS'],
    [{ ...projection, edges: [{ ...edge, kind: 'silhouette' }] }, target, 'DATUM_TARGET_UNSUPPORTED'],
    [{ ...projection, edges: [{ ...edge, kind: 'circle' }] }, target, 'DATUM_TARGET_UNSUPPORTED'],
    [{ ...projection, edges: [{ ...edge, ends: null }] }, target, 'DATUM_TARGET_UNSUPPORTED'],
    [projection, { ...target, point: { ...target.point, near: [0, Infinity, 0] } }, 'DATUM_TARGET_INVALID'],
    [projection, { ...target, point: { edge: target.point.edge, at: 'end', near: [63, 0, 0] } }, 'DATUM_TARGET_UNVERIFIED'],
    [projection, { ...maximum, point: { ...maximum.point, was: 'previous-edge' } }, 'DATUM_TARGET_UNVERIFIED'],
  ];
  for (const [view, item, code] of cases) {
    const result = resolveDatumTarget(view, item);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
  }
  assert.deepEqual(target.point.near, [1, 0, 0]);

  const noEvaluate = async () => { assert.fail('the reference unit fixture must not evaluate geometry'); };
  const noTables = () => { assert.fail('the reference unit fixture has no external part'); };
  const unsigned: DrawingDatumTarget = { ...maximum, point: { edge: maximum.point.edge, at: 'end', endpoint: 'max', near: [63, 0, 0] } };
  const original: StudioDoc = { ...starterDoc(), drawing: { ...defaultDrawing(), datumTargets: [unsigned] } }, before = structuredClone(original);
  const body = lineBody([0, 0, 0], [64, 0, 0]);
  const captured = captureSignatures(original, [body], noTables), signed = captured.drawing!.datumTargets![0] as DrawingPointDatumTarget;
  assert.deepEqual(signed.point.sig, { k: 'line', p: [32, 0, 0], d: [1, 0, 0], s: 64 });
  assert.equal(signed.point.endpoint, 'max');
  assert.deepEqual(original, before, 'capture copies the target point rather than mutating the original document');
  assert.equal(referencesOf(captured, true).refs.length, 1, 'a target-only drawing enters the common Ref enumeration');
  const valid = await verifyReferences(captured, [body], noEvaluate, noTables);
  assert.deepEqual(valid.changes, []); assert.deepEqual(valid.problems, []);
  for (const current of [lineBody([100, 0, 0], [164, 0, 0]), lineBody([0, 0, 0], [200, 0, 0]), lineBody([100, 0, 0], [100, 64, 0]), lineBody([0, 0, 0], [64, 0, 0], 'renamed-edge')]) {
    const checked = await verifyReferences(captured, [current], noEvaluate, noTables);
    assert.deepEqual(checked.changes, [], 'target verification does not automatically substitute another edge name');
    assert.equal(checked.problems.length, 1);
    assert.equal(checked.problems[0].name, target.point.edge);
    assert.deepEqual(checked.doc.drawing?.datumTargets, captured.drawing?.datumTargets);
  }
  const refreshed = await refreshSignatures(captured, [lineBody([100, 0, 0], [164, 0, 0])], noEvaluate, noTables);
  assert.deepEqual(refreshed.drawing?.datumTargets, captured.drawing?.datumTargets, 'refresh cannot bless a changed exact edge');
  assert.deepEqual(await candidatesFor(captured, 0, [body], noEvaluate, 4, noTables), []);
  assert.equal(await confirmReference(captured, 0, [body], noEvaluate, 'renamed-edge', noTables), captured, 'generic confirmation cannot replace explicit endpoint selection');
  for (const item of [unsigned, { ...signed, point: { ...signed.point, was: 'previous-edge' } }]) {
    const doc = { ...captured, drawing: { ...captured.drawing!, datumTargets: [item] } };
    const checked = await verifyReferences(doc, [body], noEvaluate, noTables);
    assert.equal(checked.problems.length, 1);
    assert.deepEqual(checked.changes, []);
    assert.deepEqual(checked.doc.drawing?.datumTargets, [item]);
  }
  const nearOnly: DrawingDatumTarget = { ...unsigned, point: { edge: unsigned.point.edge, at: 'end', near: [63, 0, 0] } };
  const legacy = { ...original, drawing: { ...original.drawing!, datumTargets: [nearOnly] } };
  assert.deepEqual(captureSignatures(legacy, [body], noTables).drawing?.datumTargets, [nearOnly], 'capture must not sign a legacy endpoint guess');
  const checkedLegacy = await verifyReferences(legacy, [body], noEvaluate, noTables);
  assert.equal(checkedLegacy.problems.length, 1); assert.deepEqual(checkedLegacy.changes, []);
  const reopenedLegacy = await readStudioFile(encodeStudioFile(legacy));
  assert.ok('doc' in reopenedLegacy);
  assert.deepEqual(reopenedLegacy.doc.drawing?.datumTargets, [nearOnly], 'the real codec preserves a legacy unsigned selection without upgrading it');
  const markedUnsigned = { ...unsigned, point: { ...unsigned.point, was: 'previous-edge' } };
  const markedDoc = { ...original, drawing: { ...original.drawing!, datumTargets: [markedUnsigned] } };
  assert.deepEqual(captureSignatures(markedDoc, [body], noTables).drawing?.datumTargets, [markedUnsigned], 'capture cannot sign an unconfirmed substitution');
  assert.deepEqual(original, before);
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
  const authoredInput: DrawingDatumTarget = { ...target, point: { edge: current.name, at: 'end', endpoint: 'min', near: [1, 0, 0] } };
  const movingInput: DrawingDatumTarget = { ...authoredInput, id: 'point-a2', number: 2, place: [76, 16], point: { ...authoredInput.point, endpoint: 'max', near: [63, 0, 0] } };
  const legacyDatum = { id: authoredInput.id, letter: 'B', view: 'front' as const, place: [-20, 20] as [number, number], edge: { edge: current.name, near: [0, 0, 0] as [number, number, number] } };
  const applied = runDrawingTool(doc, 'set_drawing', { datums: [legacyDatum], datumTargets: [authoredInput, movingInput] });
  if ('error' in applied) assert.fail(applied.error);
  const evaluated = evaluatePart(doc, 1);
  assert.ok(evaluated.ok, 'capture uses the actual evaluated starter bodies');
  const appliedBefore = structuredClone(applied.doc), captured = captureSignatures(applied.doc, evaluated.bodies);
  const [authored, moving] = captured.drawing!.datumTargets! as DrawingPointDatumTarget[];
  assert.ok(authored.point.sig && moving.point.sig, 'both explicit endpoint selections enter the actual reference capture path');
  assert.deepEqual(authored.point.sig.p, [32, 0, 0]); assert.equal(authored.point.sig.s, 64);
  assert.deepEqual(applied.doc, appliedBefore);
  const opened = await readStudioFile(encodeStudioFile(captured));
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
  assert.ok(changed.views.front.edges.some(e => e.name === current.name && e.ends?.some(p => p[0] === 80 && p[1] === 0 && p[2] === 0)), 'the actual sketch width edit reaches 80 mm');
  assert.ok(!changedPmi.items.some(a => a.id === moving.id), 'a changed source signature does not silently bless a current endpoint');
  assert.ok(changedPmi.left.some(a => a.id === moving.id && a.code === 'DATUM_TARGET_UNVERIFIED'));
  assert.ok(drawingIssues(changedContext).some(i => i.code === 'DATUM_TARGET_UNVERIFIED'));
  assert.deepEqual(widened.drawing?.datumTargets, [authored, moving], 'the saved selection hints are not replaced with sampled geometry');

  for (const [rows, code] of [[[{ ...authored, point: { ...authored.point, edge: 'missing-edge' } }], 'DATUM_TARGET_LOST'], [[authored, { ...authored, id: 'other' }], 'DATUM_TARGET_DUPLICATE']] as const) {
    const stored: StudioDoc = { ...opened.doc, drawing: { ...readDrawing(opened.doc.drawing), datumTargets: [...rows] } };
    const before: string = JSON.stringify(stored), next = inputOf(stored), context = issueContext(next);
    assert.ok(drawingIssues(context).some(i => i.code === code));
    assert.ok(!context.sheet.groups.some(g => g.datumTarget));
    const annotations = modelAnnotations({ ...next, layout: context.layout, sheet: context.sheet });
    assert.ok(annotations.left.some(a => a.id === authored.id && a.code === code));
    assert.equal(JSON.stringify(stored), before, 'diagnosis does not repair or discard the saved target');
  }
});
