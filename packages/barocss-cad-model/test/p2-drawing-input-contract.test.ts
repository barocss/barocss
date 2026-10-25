import test from 'node:test';
import assert from 'node:assert/strict';
import type { BrepProjection } from '@barocss/cad';
import { validate, type JsonSchema } from '../src/chat/contract';
import { runDrawingTool } from '../src/chat/drawing';
import { starterDoc } from '../src/engine/doc';
import { checkManufacturingDrawing, manufacturingDrawingProperties, withManufacturingDrawing } from '../src/drawing/options';
import { checkDatumOptions, datumsProperty, readDatums } from '../src/drawing/datums';
import { drawingIssues, type IssueContext } from '../src/drawing/issues';
import { defaultDrawing, sectionsOf, type DrawingDatum, type DrawingSection, type DrawingSettings, type DrawingViews } from '../src/drawing/types';
import type { SheetLayout } from '../src/drawing/views';

// Source contract regressions only. These synthetic inputs do not replay P2, evaluate geometry,
// run a browser or prove real Save/Open acceptance. No fixture supplies new manufacturing values.
const edgeDatum = (): DrawingDatum => ({ id: 'edge-a', letter: 'A', view: 'front', place: [-10, 42], edge: {
  edge: 'part-1/n0.side', near: [0, 0, 0], was: 'part-1/old.side', sig: { k: 'line', p: [0, 0, 0], d: [1, 0, 0], s: 64, n: 1 },
} });
const faceDatum = (): DrawingDatum => ({ id: 'face-b', letter: 'B', view: 'top', place: [-10, 42], face: { face: 'part-2/n0.side#1', near: [0, 0, 0] } });
const clone = <T,>(value: T): T => structuredClone(value);
const hole = (length: number, index: number): number[] => {
  const tuple = Array.from({ length }, () => 0); delete tuple[index]; return tuple;
};

function assertAtomicRefusal(args: Record<string, unknown>): void {
  const original = { ...starterDoc(), drawing: { ...defaultDrawing(), title: 'Keep this title', datums: [edgeDatum()] } };
  const docBefore = clone(original), inputBefore = clone(args);
  const result = runDrawingTool(original, 'set_drawing', { title: 'Must not apply', ...args });
  assert.ok('error' in result && /^\[DRAWING_OPTIONS\]/.test(result.error), 'invalid input returns a typed refusal');
  assert.deepEqual(original, docBefore, 'refusal preserves the original document');
  assert.deepEqual(args, inputBefore, 'validation preserves caller input, including sparse slots');
}

function context(settings: DrawingSettings): IssueContext {
  const pr = (): BrepProjection => ({ right: [1, 0, 0], up: [0, 1, 0], toward: [0, 0, 1], min: [0, 0], max: [64, 32], edges: [] });
  const views: DrawingViews = { front: pr(), top: pr(), right: pr(), iso: pr(), faces: [] };
  const layout: SheetLayout = { size: [420, 297], scale: 1, fits: true, frame: [10, 10, 410, 287], title: [290, 270, 410, 287], views: {
    front: { id: 'front', scale: 1, origin: [30, 240], box: [30, 208, 94, 240] },
    top: { id: 'top', scale: 1, origin: [30, 100], box: [30, 68, 94, 100] },
    right: { id: 'right', scale: 1, origin: [150, 240], box: [150, 208, 214, 240] },
    iso: { id: 'iso', scale: 1, origin: [250, 100], box: [250, 68, 314, 100] },
  } };
  return { views, layout, settings, sheet: { size: layout.size, groups: [], dimensions: [] }, callout: () => null };
}

test('sections retain independent dir, half, steps and removed snapshots after caller mutation', () => {
  const sections: DrawingSection[] = [
    { id: 'B', view: 'front', at: 1, dir: [1, 1, 0] },
    { id: 'C', view: 'top', at: 2, half: { line: 'vertical', at: 3, cut: 'after' } },
    { id: 'D', view: 'right', at: 4, steps: [{ past: 5, at: 6 }, { past: 7, at: 8 }], along: 'vertical' },
    { id: 'E', view: 'front', at: 9, removed: { at: [120, 140], scale: 2 } },
  ];
  const args = { sections }, inputBefore = clone(args), previous = defaultDrawing(), previousBefore = clone(previous);
  assert.deepEqual(checkManufacturingDrawing(args), []);
  const saved = withManufacturingDrawing(previous, args);
  assert.deepEqual(args, inputBefore); assert.deepEqual(previous, previousBefore);
  sections[0].dir![0] = 99;
  sections[1].half!.at = 99;
  sections[2].steps![0].past = 99; sections[2].steps!.push({ past: 100, at: 100 });
  sections[3].removed!.at![0] = 99; sections.push({ id: 'F', view: 'front', at: 99 });
  assert.deepEqual(sectionsOf(saved), [
    { id: 'B', view: 'front', at: 1, dir: [1, 1, 0] },
    { id: 'C', view: 'top', at: 2, half: { line: 'vertical', at: 3, cut: 'after' } },
    { id: 'D', view: 'right', at: 4, steps: [{ past: 5, at: 6 }, { past: 7, at: 8 }], along: 'vertical' },
    { id: 'E', view: 'front', at: 9, removed: { at: [120, 140], scale: 2 } },
  ]);
  assert.deepEqual(previous, previousBefore);
});

test('half, step and removed unknown fields follow the offered schema and refuse atomically', () => {
  const cases = [
    { id: 'B', view: 'front', at: 1, half: { line: 'vertical', at: 2, cut: 'after', injected: true } },
    { id: 'B', view: 'front', at: 1, steps: [{ past: 2, at: 3, injected: true }] },
    { id: 'B', view: 'front', at: 1, removed: { at: [10, 20], scale: 2, injected: true } },
  ];
  for (const section of cases) {
    assert.ok(validate(manufacturingDrawingProperties.sections as JsonSchema, [section]).length > 0);
    assert.equal(checkManufacturingDrawing({ sections: [section] })[0]?.code, 'DRAWING_OPTIONS');
    assertAtomicRefusal({ sections: [section] });
  }
});

test('dense section options remain accepted while sparse steps and supplied coordinates refuse atomically', () => {
  const valid = { sections: [{ id: 'B', view: 'front', at: 1, half: { line: 'horizontal', at: 2, cut: 'before' } }, { id: 'C', view: 'top', at: 1, steps: [{ past: 2, at: 3 }] }] };
  assert.deepEqual(checkManufacturingDrawing(valid), []);
  const sparseSteps = [{ past: 2, at: 3 }]; sparseSteps.length = 2;
  const cases: Record<string, unknown>[] = [
    { sections: [{ id: 'B', view: 'front', at: 1, steps: sparseSteps }] },
    { sections: [{ id: 'B', view: 'front', at: 1, removed: { at: hole(2, 1) } }] },
    { details: [{ id: 'B', view: 'top', center: hole(2, 1), radius: 2 }] },
    { details: [{ id: 'B', view: 'top', center: [1, 2], radius: 2, at: hole(2, 0) }] },
    { tables: [{ id: 'bom', from: 'bom', at: hole(2, 1) }] },
  ];
  for (const args of cases) {
    assert.equal(checkManufacturingDrawing(args)[0]?.code, 'DRAWING_OPTIONS');
    assertAtomicRefusal(args);
  }
});

test('readDatums snapshots signature objects and p/d arrays without changing saved identity', () => {
  const raw = edgeDatum(); assert.ok(raw.edge && raw.edge.sig);
  const inputBefore = clone(raw), saved = readDatums([raw]);
  assert.deepEqual(raw, inputBefore);
  assert.notEqual(saved[0].edge!.sig, raw.edge.sig);
  assert.notEqual(saved[0].edge!.sig!.p, raw.edge.sig.p);
  assert.notEqual(saved[0].edge!.sig!.d, raw.edge.sig.d);
  raw.place[0] = 99; raw.edge.near[0] = 99; raw.edge.sig.p[0] = 99;
  raw.edge.sig.d![0] = 99; raw.edge.sig.s = 99; raw.edge.was = 'changed';
  assert.deepEqual(saved, [{ id: 'edge-a', letter: 'A', view: 'front', place: [-10, 42], edge: {
    edge: 'part-1/n0.side', near: [0, 0, 0], was: 'part-1/old.side', sig: { k: 'line', p: [0, 0, 0], d: [1, 0, 0], s: 64, n: 1 },
  } }]);
});

test('saved legacy edge ids, names, was, metadata and duplicate rows keep their reader acceptance', () => {
  const legacy = { id: '', letter: 'A', view: 'front', place: [-10, 42], edge: {
    edge: '', near: [0, 0, 0], was: 'previous-edge', legacyNote: 'preserve', sig: { k: 'legacy-kind', p: [1, 2], d: [3], s: 'old-value' },
  } };
  const raw = [legacy, clone(legacy)], before = clone(raw), saved = readDatums(raw);
  assert.deepEqual(saved, before); assert.deepEqual(raw, before);
  legacy.edge.sig.p[0] = 99; legacy.edge.sig.d[0] = 99;
  assert.deepEqual(saved, before, 'snapshot does not add authored validation to the legacy reader');
});

test('strict authored datum lists and tuples reject sparse slots without applying any change', () => {
  const edge = edgeDatum(), face = faceDatum(); assert.ok(edge.edge && edge.edge.sig && face.face);
  const sparseList: unknown[] = [edge]; sparseList.length = 2;
  const cases: unknown[] = [
    sparseList,
    [{ ...face, place: hole(2, 1) }],
    [{ ...face, face: { ...face.face, near: hole(3, 1) } }],
    [{ ...edge, edge: { ...edge.edge, near: hole(3, 2) } }],
    [{ ...edge, edge: { ...edge.edge, sig: { ...edge.edge.sig, p: hole(3, 0) } } }],
    [{ ...edge, edge: { ...edge.edge, sig: { ...edge.edge.sig, d: hole(3, 1) } } }],
  ];
  assert.deepEqual(checkDatumOptions({ datums: [edge, face] }), []);
  for (const datums of cases) {
    assert.equal(checkDatumOptions({ datums })[0]?.code, 'DRAWING_OPTIONS');
    assertAtomicRefusal({ datums });
  }
});

test('authored edge/face exclusion and nested unknown rules preserve the established schema', () => {
  const edge = edgeDatum(), face = faceDatum(); assert.ok(edge.edge && face.face);
  assert.deepEqual(datumsProperty.items.oneOf, [
    { required: ['edge'], not: { required: ['face'] } },
    { required: ['face'], not: { required: ['edge'] } },
  ]);
  const exclusive = [
    [{ ...face, edge: edge.edge }],
    [{ id: face.id, letter: face.letter, view: face.view, place: face.place }],
  ];
  const unknowns = [
    [{ ...face, face: { ...face.face, injected: true } }],
    [{ ...edge, edge: { ...edge.edge, injected: true } }],
  ];
  // The repository's small validate helper does not evaluate oneOf/not; assert that metadata above.
  for (const datums of unknowns) assert.ok(validate(datumsProperty as JsonSchema, datums).length > 0);
  for (const datums of [...exclusive, ...unknowns]) {
    assert.equal(checkDatumOptions({ datums })[0]?.code, 'DRAWING_OPTIONS');
    assertAtomicRefusal({ datums });
  }
});

test('omitted datum and section options keep data; explicit empty lists clear only their stored fields', () => {
  const original: DrawingSettings = { ...defaultDrawing(), title: 'Keep title', balloons: true, datums: [edgeDatum(), faceDatum()], sections: [{ id: 'B', view: 'top', at: 2, half: { line: 'vertical', at: 3, cut: 'after' } }] };
  const before = clone(original), kept = withManufacturingDrawing(original, {});
  assert.deepEqual(kept, before); assert.deepEqual(original, before);
  const cleared = withManufacturingDrawing(original, { datums: [], sections: [] });
  assert.equal(cleared.datums, undefined); assert.deepEqual(sectionsOf(cleared), []);
  assert.equal(cleared.title, 'Keep title'); assert.equal(cleared.balloons, true);
  assert.deepEqual(original, before);
});

test('saved missing face identity remains explicit as DATUM_LOST with the existing removal fix', () => {
  const saved = readDatums([faceDatum()]), before = clone(saved);
  const ctx = context({ ...defaultDrawing(), datums: saved });
  assert.deepEqual(drawingIssues(ctx).filter(x => x.code === 'DATUM_LOST'), [{
    code: 'DATUM_LOST', severity: 'error',
    message: 'Datum B: its face in the top view has no unique current boundary anchor.', view: 'top', fix: { kind: 'remove-datum', datum: 'face-b' },
  }]);
  assert.deepEqual(saved, before, 'diagnosis keeps the stored face name and hint');
});

test('datum option copying preserves existing balloon warning numbers and selected views', () => {
  const ctx = context(withManufacturingDrawing({ ...defaultDrawing(), balloons: true }, { datums: [faceDatum()] }));
  ctx.sheet.balloons = { placed: [
    { no: 1, item: 'Part A', view: 'iso', tip: [250, 80], edge: 'part-1/n0.side', at: [250, 105] },
    { no: 2, item: 'Part B', view: 'top', tip: [30, 80], edge: 'part-2/n0.side', at: [20, 80] },
  ], unclear: [2], noEdge: [3] };
  const before = clone(ctx.sheet.balloons);
  assert.deepEqual(drawingIssues(ctx).filter(x => x.code.startsWith('BALLOON_')), [{
    code: 'BALLOON_NOT_CLEAR', severity: 'warning',
    message: 'Balloon 2: no clear room beside the top view, so it sits at the nearest place, over other marks. A larger sheet or a smaller scale gives room.',
  }, {
    code: 'BALLOON_NO_EDGE', severity: 'warning',
    message: 'BOM line 3: no edge of its item is visible in the iso view or any other shown base view (front, top, right), so no balloon is drawn. The BOM table holds it.',
  }]);
  assert.deepEqual(ctx.sheet.balloons, before);
});
