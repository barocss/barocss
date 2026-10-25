import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERISTICS, characteristicMarks, checkDrawingFrames, readFrames, type DrawingFrame } from '../src/drawing/controls';
import { frameMarks, type Mark } from '../src/drawing/sheet';
import { readDrawing, defaultDrawing, type DrawingDatum, type Vec3 } from '../src/drawing/types';
import { textCorners } from '../src/drawing/text';
import { starterDoc } from '../src/engine/doc';
import { drawingInputs, runDrawingTool } from '../src/chat/drawing';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { evaluatePart, brepsFor } from '../src/engine/evaluate';
import { dispatchTool } from '../src/chat/tools';
import { autoLayout } from '../src/drawing/layout';
import { modelAnnotations } from '../src/drawing/annotations3d';
import { checkDatumOptions, datumAnchor, datumsProperty } from '../src/drawing/datums';
import { projectViews } from '../src/drawing/project';
import { validate, type JsonSchema } from '../src/chat/contract';

const frame: DrawingFrame = { id: 'f1', dim: 'd1', characteristic: 'position', value: 0.25, datums: ['A', 'B'] };
const under = { kind: 'text' as const, at: [20, 30] as [number, number], text: '10', size: 3.5, anchor: 'start' as const };
const texts = (marks: Mark[]) => marks.filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
const modified: DrawingFrame = { ...frame, material: 'maximum', datumModifiers: { A: 'least', B: 'maximum' }, projected: 12, freeState: true, tangentPlane: true };

test('vector characteristics: circle radii, position cross, flatness area, half-circle profiles and parallel lines', () => {
  const pos = characteristicMarks('position', [10, 20]);
  assert.deepEqual(pos[0], { kind: 'arc', center: [10, 20], u: [1.7, 0], v: [0, 1.7], t0: 0, t1: 2 * Math.PI, pen: 'thin', role: 'frame' });
  assert.deepEqual(pos.slice(1).map(m => m.kind === 'line' ? [m.a, m.b] : null), [[[7.7, 20], [12.3, 20]], [[10, 17.7], [10, 22.3]]]);
  const flat = characteristicMarks('flatness', [0, 0])[0]; assert.ok(flat.kind === 'polyline');
  const area = Math.abs(flat.points.slice(1).reduce((a, q, k) => a + flat.points[k][0] * q[1] - q[0] * flat.points[k][1], 0)) / 2;
  assert.ok(Math.abs(area - 9.36) < 1e-12);
  for (const k of ['profile-line', 'profile-surface'] as const) { const p = characteristicMarks(k, [0, 0])[0]; assert.ok(p.kind === 'arc'); assert.equal(p.t1 - p.t0, Math.PI); }
  assert.equal(characteristicMarks('profile-surface', [0, 0]).length, 2);
  const parallel = characteristicMarks('parallelism', [0, 0]);
  const vectors = parallel.map(m => { assert.ok(m.kind === 'line'); return [m.b[0] - m.a[0], m.b[1] - m.a[1]]; });
  assert.deepEqual(vectors, [[1.7, -3.6], [1.7, -3.6]]);
  const rendered = CHARACTERISTICS.map(k => JSON.stringify(characteristicMarks(k, [0, 0])));
  assert.equal(new Set(rendered).size, 14, 'each characteristic has its own symbol');
  for (const k of CHARACTERISTICS) for (const m of characteristicMarks(k, [0, 0])) {
    const pts = m.kind === 'line' ? [m.a, m.b] : m.kind === 'polyline' ? m.points : m.kind === 'arc' ? [m.center] : [];
    assert.ok(pts.every(p => p.every(Number.isFinite) && p.every(v => Math.abs(v) <= 2.3)), k);
  }
});

test('frame cells: position keeps its diameter default; other characteristics are linear; modifier text stays inside the border', () => {
  assert.deepEqual(texts(frameMarks(under, frame)).map(m => m.text), ['Ø0.25', 'A', 'B']);
  assert.equal(texts(frameMarks(under, { ...frame, characteristic: 'flatness' }))[0].text, '0.25');
  assert.equal(texts(frameMarks(under, { ...frame, diameter: false }))[0].text, '0.25');
  const marks = frameMarks(under, modified), border = marks[0]; assert.ok(border.kind === 'polyline');
  const x0 = border.points[0][0], x1 = border.points[1][0], y0 = border.points[0][1], y1 = border.points[2][1];
  assert.equal(y1 - y0, 6);
  assert.deepEqual(texts(marks).map(m => m.text), ['Ø0.25', 'M', 'F', 'T', 'P', '12', 'A', 'L', 'B', 'M']);
  for (const m of texts(marks)) for (const p of textCorners(m.at, m.text, m.size, m.anchor)) assert.ok(p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1, m.text);
  assert.equal(marks.filter(m => m.kind === 'arc').length, 7, 'position circle and six modifier circles');
});

test('frames round-trip through saved JSON; invalid and duplicate references are dropped without sharing input objects', () => {
  const read = readDrawing({ frames: [modified, { ...frame, id: 'again' }, { ...frame, id: 'bad', dim: 'd2', characteristic: 'unknown' }, { ...frame, id: 'flat', dim: 'd3', characteristic: 'flatness', datums: [] }] });
  assert.deepEqual(read.frames, [modified, { ...frame, id: 'flat', dim: 'd3', characteristic: 'flatness', datums: [] }]);
  assert.notEqual(read.frames![0].datums, modified.datums); assert.notEqual(read.frames![0].datumModifiers, modified.datumModifiers);
  assert.deepEqual(readDrawing(JSON.parse(JSON.stringify(read))), read);
  assert.deepEqual(readFrames([{ ...frame, freeState: false, tangentPlane: false }]), [frame]);
});

test('bad frame inputs refuse atomically; empty frames clear, omitted keeps; absent dimensions/datums stay visible as issues', () => {
  const doc = { ...starterDoc(), drawing: { ...defaultDrawing(), frames: [frame] } }, before = JSON.stringify(doc);
  for (const frames of [null, [frame, frame], [{ ...frame, value: NaN }], [{ ...frame, value: 100 }], [{ ...frame, material: 'guess' }], [{ ...frame, datumModifiers: { C: 'maximum' } }], [{ ...frame, projected: 0 }], [{ ...frame, diameter: 1 }], [{ ...frame, datums: ['A', 'A'] }], [{ ...frame, injected: true }], [{ ...frame, freeState: 'true' }]]) {
    assert.equal(checkDrawingFrames({ frames })[0]?.code, 'DRAWING_OPTIONS');
    const r = runDrawingTool(doc, 'set_drawing', { title: 'Must not apply', frames }); assert.ok('error' in r && /DRAWING_OPTIONS/.test(r.error)); assert.equal(JSON.stringify(doc), before);
  }
  const cleared = runDrawingTool(doc, 'set_drawing', { frames: [] }); assert.ok(!('error' in cleared)); if ('error' in cleared) return;
  assert.equal(cleared.doc.drawing?.frames, undefined);
  const input = drawingInputs(doc); assert.ok(typeof input !== 'string');
  assert.ok(drawingIssues(issueContext(input)).some(x => x.code === 'FRAME_LOST'));
});

test('v2 drawing.set and describe expose controls without extra per-turn tools; invalid proposals remain atomic', async () => {
  const doc = starterDoc(), evaluate = async (d: typeof doc) => evaluatePart(d, 1), result = await evaluate(doc);
  assert.ok(result.ok); if (!result.ok) return;
  const state = { doc, bodies: result.bodies };
  const described = await dispatchTool(state, 'describe', { tool: 'drawing', action: 'set' }, evaluate);
  assert.deepEqual(JSON.parse(described.content).input.properties.frames.items.properties.characteristic.enum, [...CHARACTERISTICS]);
  const r = await dispatchTool(state, 'drawing', { action: 'set', frames: [modified] }, evaluate);
  assert.ok(!r.isError, r.content); assert.deepEqual(r.state.doc.drawing?.frames, [modified]);
  const refused = await dispatchTool(state, 'proposals', { action: 'propose', title: 'Invalid frame', ops: [{ tool: 'set_drawing', args: { frames: [{ ...frame, material: 'guess' }] } }] }, evaluate);
  assert.ok(refused.isError); assert.match(refused.content, /DRAWING_OPTIONS/); assert.deepEqual(refused.state.doc, doc);
});

test('3D annotations preserve a linear zone, the selected characteristic and all authored modifiers', () => {
  const input = drawingInputs(starterDoc()); assert.ok(typeof input !== 'string');
  const auto = autoLayout(input).settings;
  const f: DrawingFrame = { ...modified, dim: auto.dimensions[0].id, characteristic: 'flatness', diameter: false };
  const settings = { ...auto, frames: [f] }, ctx = issueContext({ ...input, settings });
  const lifted = modelAnnotations({ views: input.views, layout: ctx.layout, settings, sheet: ctx.sheet }).items.find(a => a.kind === 'frame')!;
  assert.equal(lifted.frame!.characteristic, 'flatness'); assert.equal(lifted.frame!.zone, 'linear');
  assert.equal(lifted.frame!.material, 'maximum'); assert.deepEqual(lifted.frame!.datumModifiers, { A: 'least', B: 'maximum' });
  assert.equal(lifted.frame!.projected, 12); assert.ok(lifted.frame!.freeState && lifted.frame!.tangentPlane);
  assert.deepEqual(lifted.frame!.cells.map(c => c.text), ['flatness', '0.25(M)(F)(T)(P)12', 'A(L)', 'B(M)']);
  assert.equal(lifted.arcs.length, 6, 'the six modifier circles; the flatness symbol is a polyline');
  assert.ok(lifted.lines.every(l => l.role === 'frame'));
});


test('saved edge datums retain ids, signatures, previous names and duplicate-letter diagnostics', () => {
  const input = drawingInputs(starterDoc()); assert.ok(typeof input !== 'string');
  const sig = { k: 'line', p: [0, 0, 0] as Vec3, d: [1, 0, 0] as Vec3, s: 64, n: 1 };
  const d: DrawingDatum = { id: 'edge-a', letter: 'A', view: 'front', edge: { edge: input.views.front.edges[0].name, near: [0, 0, 0], sig, was: 'previous-edge' }, place: [-10, 42] };
  const rows = [d, { ...d, letter: 'B' }, { ...d, id: 'duplicate-letter' }];
  const settings = readDrawing({ ...defaultDrawing(), datums: JSON.parse(JSON.stringify(rows)) });
  assert.deepEqual(settings.datums, rows);
  assert.equal(settings.datums!.length, 3, 'saved duplicate ids and letters remain available to diagnostics');
  const first = settings.datums![0]; assert.ok(first.edge); assert.deepEqual(first.edge.sig, sig); assert.equal(first.edge.was, 'previous-edge');
  assert.equal(readDrawing({ datums: [{ ...d, id: '' }] }).datums![0].id, '', 'the old saved-reader id acceptance is unchanged');
  assert.ok(drawingIssues(issueContext({ ...input, settings })).some(i => i.code === 'DATUM_TWICE'));
});

test('authored face and edge datums share schema metadata, refuse atomically, keep omitted data and clear explicitly', async () => {
  const doc = starterDoc(), input = drawingInputs(doc); assert.ok(typeof input !== 'string');
  const face = input.views.faces!.find(f => f.points.some(p => p.every(v => v === 0)))!; assert.ok(face);
  const edge: DrawingDatum = { id: 'edge-a', letter: 'A', view: 'front', edge: { edge: input.views.front.edges[0].name, near: [0, 0, 0], sig: { k: 'line', p: [0, 0, 0], s: 64 }, was: 'previous-edge' }, place: [-10, 42] };
  const d: DrawingDatum = { id: 'face-b', letter: 'B', view: 'top', face: { face: face.name, near: [0, 0, 0] }, place: [-10, 42] };
  assert.deepEqual(validate(datumsProperty as JsonSchema, [edge, d]), []);
  assert.deepEqual(Object.keys(datumsProperty.items.properties.edge.properties), ['edge', 'near', 'sig', 'was']);
  assert.deepEqual(checkDatumOptions({ datums: [edge, d] }), []);
  const original = { ...doc, drawing: { ...defaultDrawing(), datums: [edge] } }, before = JSON.stringify(original);
  for (const datums of [null, [edge, edge], [edge, { ...d, id: edge.id }], [edge, { ...d, letter: edge.letter }], [{ ...d, edge: edge.edge }], [{ ...d, injected: true }], [{ ...edge, edge: { ...edge.edge, sig: { k: 'line', p: [0, 0], s: 64 } } }]]) {
    assert.equal(checkDatumOptions({ datums })[0]?.code, 'DRAWING_OPTIONS');
    const refused = runDrawingTool(original, 'set_drawing', { title: 'Must not apply', datums });
    assert.ok('error' in refused && /DRAWING_OPTIONS/.test(refused.error)); assert.equal(JSON.stringify(original), before);
  }
  const kept = runDrawingTool(original, 'set_drawing', {}); assert.ok(!('error' in kept)); if ('error' in kept) return;
  assert.deepEqual(kept.doc.drawing?.datums, [edge]);
  const cleared = runDrawingTool(original, 'set_drawing', { datums: [] }); assert.ok(!('error' in cleared)); if ('error' in cleared) return;
  assert.equal(cleared.doc.drawing?.datums, undefined);
  const evaluate = async (source: typeof doc) => evaluatePart(source, 1), result = await evaluate(doc); assert.ok(result.ok); if (!result.ok) return;
  const state = { doc, bodies: result.bodies }, described = await dispatchTool(state, 'describe', { tool: 'drawing', action: 'set' }, evaluate);
  assert.deepEqual(JSON.parse(described.content).input.properties.datums, datumsProperty);
  const changed = await dispatchTool(state, 'drawing', { action: 'set', datums: [edge, d] }, evaluate);
  assert.ok(!changed.isError, changed.content); assert.deepEqual(changed.state.doc.drawing?.datums, [edge, d]);
});

test('face anchors keep exact occurrence prefixes and current plate vertices; missing, ambiguous and empty faces stay unresolved', () => {
  const source = brepsFor(starterDoc()); assert.ok(!('error' in source)); if ('error' in source) return;
  // Reuse the existing 64 × 32 × 8 starter plate twice: prefixes distinguish occurrences without creating new geometry.
  const projected = projectViews([source.breps[0], source.breps[0]], ['left/', 'right/']); assert.ok(projected.ok); if (!projected.ok) return;
  const views = projected.views, faces = views.faces!;
  const face = faces.find(f => f.name.startsWith('right/') && f.points.some(p => p.every(v => v === 0)) && f.points.some(p => p[0] === 0 && p[1] === 0 && p[2] === 8))!; assert.ok(face);
  assert.ok(faces.some(f => f.name === face.name.replace(/^right\//, 'left/')));
  const d: DrawingDatum = { id: 'face-b', letter: 'B', view: 'top', face: { face: face.name, near: [0, 0, 0] }, place: [-10, 42] };
  assert.deepEqual(datumAnchor(views, d), [0, 0, 0], 'independent original plate corner');
  const current = { ...views, faces: faces.map(f => f === face ? { ...f, points: f.points.filter(p => p[2] === 8) } : f) };
  assert.deepEqual(datumAnchor(current, d), [0, 0, 8], 'current upper boundary, not the obsolete origin hint');
  assert.equal(datumAnchor({ ...views, faces: faces.filter(f => f !== face) }, d), null, 'left occurrence is not a fallback');
  assert.equal(datumAnchor({ ...views, faces: [...faces, face] }, d), null);
  assert.equal(datumAnchor({ ...views, faces: faces.map(f => f === face ? { ...f, points: [] } : f) }, d), null);
});
