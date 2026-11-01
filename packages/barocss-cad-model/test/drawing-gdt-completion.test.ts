// Roadmap 11 ①: spherical, statistical, unequal, all-around/over, profile composite and stacked frames; the semantic rules;
// datum existence. Authoring refuses a frame that breaks a rule; Open keeps it and the drawing check reports it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDrawingFrames, frameRules, readFrames, type DrawingFrame } from '../src/drawing/controls';
import { frameMarks, type Mark } from '../src/drawing/sheet';
import { defaultDrawing, readDrawing, type DrawingSettings } from '../src/drawing/types';
import { starterDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { drawingInputs, runDrawingTool } from '../src/chat/drawing';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { sheetSvg } from '../src/io/svg';
import { modelAnnotations } from '../src/drawing/annotations3d';

const base = { id: 'f', view: 'front' as const, place: [10, 20] as [number, number], value: 0.2, datums: [] as string[] };
const make = (characteristic: DrawingFrame['characteristic'], extra: Record<string, unknown> = {}) => ({ ...base, characteristic, ...extra }) as DrawingFrame;
const under = { kind: 'text' as const, at: [20, 30] as [number, number], text: '10', size: 3.5, anchor: 'start' as const };
const texts = (marks: Mark[]) => marks.filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text').map(m => m.text);
const accepted = (f: DrawingFrame) => { assert.deepEqual(frameRules(f), [], JSON.stringify(f)); assert.deepEqual(checkDrawingFrames({ frames: [f] }), [], JSON.stringify(f)); };
const refused = (f: DrawingFrame, words: RegExp) => {
  assert.match(frameRules(f).join(' | '), words, JSON.stringify(f));
  const why = checkDrawingFrames({ frames: [f] })[0]; assert.equal(why?.code, 'DRAWING_OPTIONS'); assert.match(why.message, words);
};

test('form tolerances: no datums; maximum or least only on straightness and flatness', () => {
  for (const k of ['straightness', 'flatness', 'circularity', 'cylindricity'] as const) { accepted(make(k)); refused(make(k, { datums: ['A'] }), /form tolerance and takes no datums/); }
  for (const k of ['straightness', 'flatness'] as const) accepted(make(k, { material: 'maximum' }));
  for (const k of ['circularity', 'cylindricity'] as const) refused(make(k, { material: 'least' }), /no maximum or least/);
});

test('orientation, concentricity, symmetry and runout need a datum', () => {
  for (const k of ['parallelism', 'perpendicularity', 'angularity', 'concentricity', 'symmetry', 'circular-runout', 'total-runout'] as const) {
    accepted(make(k, { datums: ['A'], diameter: false })); refused(make(k, { diameter: false }), /needs at least one datum/);
  }
  accepted(make('perpendicularity', { datums: ['A'], material: 'maximum', datumModifiers: { A: 'maximum' } }));
});

test('no material modifiers on runout or profile; ISO allows them on concentricity and symmetry, so they stay allowed', () => {
  for (const k of ['concentricity', 'symmetry'] as const) accepted(make(k, { datums: ['A'], diameter: false, material: 'maximum', datumModifiers: { A: 'maximum' } }));
  for (const k of ['circular-runout', 'total-runout'] as const) {
    refused(make(k, { datums: ['A'], diameter: false, material: 'maximum' }), /no maximum or least/);
    refused(make(k, { datums: ['A'], diameter: false, datumModifiers: { A: 'least' } }), /no material modifier on its datums/);
  }
  for (const k of ['profile-line', 'profile-surface'] as const) { refused(make(k, { material: 'least' }), /no maximum or least/); accepted(make(k, { datums: ['A'], datumModifiers: { A: 'maximum' } })); }
});

test('diameter zone: position, straightness, orientation and concentricity only', () => {
  accepted(make('straightness', { diameter: true }));
  for (const k of ['position', 'parallelism', 'perpendicularity', 'angularity', 'concentricity'] as const) accepted(make(k, { diameter: true, datums: ['A'] }));
  for (const k of ['flatness', 'circularity', 'cylindricity', 'symmetry', 'profile-line', 'profile-surface', 'circular-runout', 'total-runout'] as const) refused(make(k, { diameter: true, datums: ['flatness', 'circularity', 'cylindricity'].includes(k) ? [] : ['A'] }), /no diameter zone/);
  accepted(make('flatness', { diameter: false }));
});

test('projected zone: position and orientation; tangent plane: orientation and profile', () => {
  for (const k of ['position', 'parallelism', 'perpendicularity', 'angularity'] as const) accepted(make(k, { projected: 5, datums: ['A'], diameter: false }));
  for (const k of ['flatness', 'profile-surface', 'symmetry', 'total-runout'] as const) refused(make(k, { projected: 5, datums: k === 'flatness' || k === 'profile-surface' ? [] : ['A'], diameter: false }), /no projected zone/);
  for (const k of ['parallelism', 'angularity', 'profile-line', 'profile-surface'] as const) accepted(make(k, { tangentPlane: true, datums: ['A'], diameter: false }));
  for (const k of ['position', 'flatness', 'concentricity'] as const) refused(make(k, { tangentPlane: true, datums: k === 'flatness' ? [] : ['A'], diameter: false }), /no tangent plane/);
});

test('spherical zone: position only, and it is a diameter zone', () => {
  accepted(make('position', { sphere: true }));
  refused(make('position', { sphere: true, diameter: false }), /diameter zone/);
  refused(make('parallelism', { sphere: true, datums: ['A'], diameter: false }), /position only/);
});

test('unequal profile: profile only, 0 up to the value; all around and all over: profile only', () => {
  accepted(make('profile-surface', { unequal: 0 })); accepted(make('profile-line', { unequal: 0.2 }));
  refused(make('profile-surface', { unequal: 0.3 }), /cannot be more than the tolerance/);
  refused(make('position', { unequal: 0.1 }), /profile only/);
  assert.equal(checkDrawingFrames({ frames: [make('profile-surface', { unequal: -1 })] })[0]?.code, 'DRAWING_OPTIONS');
  for (const around of ['all-around', 'all-over'] as const) { accepted(make('profile-line', { around })); refused(make('flatness', { around }), /profile only/); }
  assert.equal(checkDrawingFrames({ frames: [make('profile-line', { around: 'everywhere' })] })[0]?.code, 'DRAWING_OPTIONS');
  accepted(make('position', { statistical: true }));
});

test('composite: position or profile; datums are some of the first row\'s in order; value smaller', () => {
  accepted(make('position', { datums: ['A', 'B'], composite: { value: 0.1, datums: ['A'] } }));
  accepted(make('position', { datums: ['A', 'B', 'C'], composite: { value: 0.05, datums: ['A', 'C'] } }));
  accepted(make('profile-surface', { datums: ['A'], composite: { value: 0.1, datums: [] } }));
  accepted(make('profile-line', { datums: ['A', 'B'], composite: { value: 0.1, datums: ['A', 'B'] } }));
  refused(make('position', { datums: ['A', 'B'], composite: { value: 0.1, datums: ['B', 'A'] } }), /same order/);
  refused(make('position', { datums: ['A'], composite: { value: 0.1, datums: ['A', 'C'] } }), /same order/);
  refused(make('profile-surface', { datums: ['A'], composite: { value: 0.2, datums: ['A'] } }), /smaller/);
  refused(make('profile-surface', { datums: ['A'], composite: { value: 0.3, datums: ['A'] } }), /smaller/);
  refused(make('profile-line', { datums: ['A'], composite: { value: 0.1, datums: ['A'], material: 'maximum' } }), /Second segment: .*no maximum or least/);
  assert.equal(checkDrawingFrames({ frames: [make('flatness', { composite: { value: 0.1, datums: [] } })] })[0]?.code, 'DRAWING_OPTIONS');
});

test('stacked: position or profile, not with composite; each stacked frame follows the rules too', () => {
  accepted(make('position', { datums: ['A'], stacked: { value: 0.5, datums: ['B'] } }));
  accepted(make('profile-surface', { stacked: { value: 0.5, datums: ['A'] } }));
  refused(make('position', { composite: { value: 0.1, datums: [] }, stacked: { value: 0.5, datums: [] } }), /composite or stacked, not both/);
  refused(make('profile-line', { stacked: { value: 0.1, datums: [], material: 'least' } }), /Stacked frame: .*no maximum or least/);
  assert.equal(checkDrawingFrames({ frames: [make('flatness', { stacked: { value: 0.1, datums: [] } })] })[0]?.code, 'DRAWING_OPTIONS');
  assert.equal(checkDrawingFrames({ frames: [make('position', { stacked: { value: 0, datums: [] } })] })[0]?.code, 'DRAWING_OPTIONS');
});

test('a tangent plane is not combined with a diameter zone or a projected zone', () => {
  accepted(make('angularity', { datums: ['A'], diameter: false, tangentPlane: true }));
  accepted(make('profile-surface', { tangentPlane: true }));
  refused(make('angularity', { datums: ['A'], diameter: true, tangentPlane: true }), /not combined with a diameter zone or a projected zone/);
  refused(make('parallelism', { datums: ['A'], diameter: false, projected: 4, tangentPlane: true }), /not combined with a diameter zone or a projected zone/);
});

test('an old frame that breaks rules can be repaired one field at a time; only a new break is refused', () => {
  const old = make('flatness', { datums: ['A'], tangentPlane: true }), other = make('position', { id: 'g' });
  // Saved: flatness with a datum and a tangent plane (two breaks). Either can go first.
  const noDatum = { ...old, datums: [] } as DrawingFrame, noTangent = { ...old } as DrawingFrame & { tangentPlane?: boolean }; delete noTangent.tangentPlane;
  assert.deepEqual(checkDrawingFrames({ frames: [noDatum] }, [old]), []);
  assert.deepEqual(checkDrawingFrames({ frames: [noTangent as DrawingFrame] }, [old]), []);
  const repaired = { ...noDatum } as DrawingFrame & { tangentPlane?: boolean }; delete repaired.tangentPlane;
  assert.deepEqual(checkDrawingFrames({ frames: [repaired as DrawingFrame] }, [noDatum]), []);
  assert.deepEqual(frameRules(repaired as DrawingFrame), []);
  assert.equal(checkDrawingFrames({ frames: [{ ...old, material: 'maximum', projected: 3 } as DrawingFrame] }, [old])[0]?.code, 'DRAWING_OPTIONS', 'a rule the frame did not break before is refused');
  assert.match(checkDrawingFrames({ frames: [{ ...old, around: 'all-around' } as DrawingFrame] }, [old])[0]?.message, /profile only/);
  // The workspace's own commits with the old frame present: add, drag and remove another frame are not refused.
  const moved = { ...old, place: [30, 40] } as DrawingFrame;
  assert.deepEqual(checkDrawingFrames({ frames: [old, other] }, [old]), [], 'add');
  assert.deepEqual(checkDrawingFrames({ frames: [moved] }, [old]), [], 'drag');
  assert.deepEqual(checkDrawingFrames({ frames: [old] }, [old, other]), [], 'remove another');
  // Without the current list the same frame is new, and is refused.
  assert.equal(checkDrawingFrames({ frames: [old] })[0]?.code, 'DRAWING_OPTIONS');
});

test('changing an old frame\'s dimension is a change: it may keep its breaks but not gain one', () => {
  const old = make('flatness', { id: 'x', datums: ['A'] }), attached = { id: 'x', dim: 'd1', characteristic: 'flatness', value: 0.2, datums: ['A'] } as DrawingFrame;
  assert.deepEqual(checkDrawingFrames({ frames: [attached] }, [old]), []);
  assert.equal(checkDrawingFrames({ frames: [{ ...attached, around: 'all-over' } as DrawingFrame] }, [old])[0]?.code, 'DRAWING_OPTIONS');
});

test('the frame draws SØ, an ST hexagon, a circled U with its amount, and the all-around circles', () => {
  const sphere = frameMarks(under, make('position', { sphere: true, datums: ['A'] })), texts1 = texts(sphere);
  assert.deepEqual(texts1, ['SØ0.2', 'A']);
  const st = frameMarks(under, make('position', { statistical: true })), hexagons = st.filter(m => m.kind === 'polyline' && m.points.length === 7);
  assert.equal(hexagons.length, 1); assert.ok(texts(st).includes('ST'));
  const border = st[0]; assert.ok(border.kind === 'polyline');
  const hex = hexagons[0]; assert.ok(hex.kind === 'polyline');
  assert.ok(hex.points.every(p => p[0] > border.points[0][0] && p[0] < border.points[1][0] && p[1] >= border.points[0][1] && p[1] <= border.points[2][1]), 'the hexagon is inside the frame');
  const un = frameMarks(under, make('profile-surface', { unequal: 0.05 }));
  assert.deepEqual(texts(un), ['0.2', 'U', '0.05']);
  const plain = frameMarks(under, make('profile-surface')), x0 = (plain[0] as Extract<Mark, { kind: 'polyline' }>).points[0][0];
  const circles = (marks: Mark[]) => marks.filter(m => m.kind === 'arc' && m.u[0] <= 1.7 && m.center[0] < x0 - 1);
  assert.equal(circles(plain).length, 0);
  assert.equal(circles(frameMarks(under, make('profile-surface', { around: 'all-around' }))).length, 1);
  assert.equal(circles(frameMarks(under, make('profile-surface', { around: 'all-over' }))).length, 2);
});

test('a profile composite draws two rows with one symbol; a stacked frame is a separate full frame below with its own symbol', () => {
  const composite = frameMarks(under, make('profile-surface', { datums: ['A'], composite: { value: 0.1, datums: ['A'] } }));
  const border = composite[0]; assert.ok(border.kind === 'polyline');
  assert.equal(border.points[2][1] - border.points[0][1], 12);
  assert.deepEqual(texts(composite), ['0.2', 'A', '0.1', 'A']);
  const symbol = (marks: Mark[]) => marks.filter(m => m.kind === 'arc' && m.t1 - m.t0 === Math.PI).length;
  assert.equal(symbol(composite), 1, 'one symbol cell spans both rows');
  const stacked = frameMarks(under, make('profile-surface', { datums: ['A'], stacked: { value: 0.5, datums: ['A', 'B'] } }));
  const borders = stacked.filter((m): m is Extract<Mark, { kind: 'polyline' }> => m.kind === 'polyline' && m.points.length === 5 && m.points[0][0] === m.points[4][0]);
  const first = borders[0], second = borders[borders.length - 1];
  assert.equal(second.points[0][1], first.points[2][1], 'the second frame starts where the first ends');
  assert.equal(second.points[0][0], first.points[0][0]);
  assert.equal(symbol(stacked), 2, 'each frame has its own symbol');
  assert.deepEqual(texts(stacked), ['0.2', 'A', '0.5', 'A', 'B']);
  const positions = frameMarks(under, make('position', { stacked: { value: 0.5, datums: [] } }));
  assert.deepEqual(texts(positions), ['Ø0.2', 'Ø0.5']);
});

const withFrames = (frames: DrawingFrame[], extra: Partial<DrawingSettings> = {}) => {
  const input = drawingInputs(starterDoc()); if (typeof input === 'string') assert.fail(input);
  return { input, settings: { ...defaultDrawing(), ...extra, frames } as DrawingSettings };
};

test('Open keeps an old drawing that breaks a rule and the drawing check says so; authoring refuses the same frame', async () => {
  const old = make('flatness', { id: 'old', datums: ['A'], tangentPlane: true });
  const doc = { ...starterDoc(), drawing: { ...defaultDrawing(), frames: [old] } };
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened);
  assert.deepEqual(opened.doc.drawing?.frames, [old]);
  const { input, settings } = withFrames(readDrawing(opened.doc.drawing).frames!);
  const issues = drawingIssues(issueContext({ ...input, settings })).filter(i => i.code === 'FRAME_RULE');
  assert.equal(issues.length, 2); assert.ok(issues.every(i => i.frames?.includes('old') && i.severity === 'error'));
  assert.match(issues.map(i => i.message).join(' '), /form tolerance and takes no datums/); assert.match(issues.map(i => i.message).join(' '), /no tangent plane/);
  const refusedEdit = runDrawingTool({ ...starterDoc() }, 'set_drawing', { frames: [old] }); assert.ok('error' in refusedEdit);
  const same = runDrawingTool(doc, 'set_drawing', { frames: [old] }); assert.ok(!('error' in same), 'resending an unchanged old frame is not an edit');
});

test('a frame whose datum letter has no datum feature or datum target set is reported', () => {
  const f = make('position', { datums: ['A', 'B'], composite: { value: 0.1, datums: ['A'] } });
  const { input, settings } = withFrames([f]);
  const missing = (s: DrawingSettings) => drawingIssues(issueContext({ ...input, settings: s })).filter(i => i.code === 'DATUM_UNDEFINED');
  assert.match(missing(settings)[0].message, /A, B/);
  const target = { id: 't1', letter: 'A', number: 1, view: 'front' as const, place: [0, 0] as [number, number], point: { edge: 'e', at: 'end' as const, near: [0, 0, 0] as [number, number, number], endpoint: 'min' as const } };
  const withTarget = { ...settings, datumTargets: [target] };
  assert.match(missing(withTarget)[0].message, /datum B,/);
  const stacked = { ...settings, frames: [make('position', { datums: [], stacked: { value: 0.5, datums: ['Z'] } })] };
  assert.match(missing(stacked)[0].message, /datum Z/);
});

test('all the new fields survive Save and Open and drawing.set', async () => {
  const frames = [
    make('position', { id: 'a', sphere: true, statistical: true, datums: ['A'] }),
    make('profile-surface', { id: 'b', place: [1, 2], unequal: 0.05, around: 'all-over', tangentPlane: true, datums: ['A'], composite: { value: 0.1, datums: [] } }),
    make('profile-line', { id: 'c', place: [3, 4], around: 'all-around', stacked: { value: 0.4, datums: ['A'], datumModifiers: { A: 'maximum' } } }),
  ];
  const doc = starterDoc(), changed = runDrawingTool(doc, 'set_drawing', { frames }); if ('error' in changed) assert.fail(changed.error);
  assert.deepEqual(changed.doc.drawing?.frames, frames);
  const opened = await readStudioFile(encodeStudioFile(changed.doc)); assert.ok('doc' in opened);
  assert.deepEqual(opened.doc.drawing?.frames, frames);
  assert.deepEqual(readFrames(JSON.parse(JSON.stringify(frames))), frames);
  const { input, settings } = withFrames(frames, { datums: [{ id: 'da', letter: 'A', view: 'front', place: [0, 0], edge: { edge: 'x', at: 'end', near: [0, 0, 0] } } as never] });
  const svg = sheetSvg(issueContext({ ...input, settings }).sheet, 'gdt');
  for (const word of ['SØ0.2', 'ST', '0.05']) assert.ok(svg.includes(word), word);
});

test('an authored frame equals its reopened form as JSON, whatever order the fields were written in', async () => {
  // The editor adds keys one at a time, so this order is not the reader's.
  const editorOrder = { id: 'e', view: 'front', place: [1, 2], characteristic: 'profile-surface', value: 0.3, datums: ['A'], around: 'all-over', stacked: { datums: ['B'], value: 0.2 }, statistical: true, unequal: 0.1 } as unknown as DrawingFrame;
  const clean = editorOrder;
  const viaEditor = readFrames([clean]), viaTool = runDrawingTool(starterDoc(), 'set_drawing', { frames: [clean] });
  if ('error' in viaTool) assert.fail(viaTool.error);
  assert.equal(JSON.stringify(viaTool.doc.drawing?.frames), JSON.stringify(viaEditor));
  for (const frames of [viaEditor, viaTool.doc.drawing!.frames!]) {
    const opened = await readStudioFile(encodeStudioFile({ ...starterDoc(), drawing: { ...defaultDrawing(), frames } })); assert.ok('doc' in opened);
    assert.equal(JSON.stringify(opened.doc.drawing?.frames), JSON.stringify(frames));
    assert.equal(JSON.stringify(readFrames(frames)), JSON.stringify(frames), 'reading is a fixed point');
  }
});

test('frame numbers show as authored: up to 4 decimals, no 0.01 rounding, on the sheet and in 3D cells', () => {
  for (const [value, text] of [[0.125, '0.125'], [0.005, '0.005'], [0.0125, '0.0125'], [0.5, '0.5'], [2, '2']] as const) {
    const f = make('profile-surface', { value, unequal: value / 5, projected: undefined, stacked: { value, datums: [] } });
    assert.ok(texts(frameMarks(under, f)).filter(t => t === text).length >= 2, `${text} in the value and the stacked row`);
  }
  assert.ok(texts(frameMarks(under, make('profile-surface', { value: 0.5, unequal: 0.125 }))).includes('0.125'));
  assert.ok(texts(frameMarks(under, make('position', { projected: 0.0125 }))).includes('0.0125'));
  assert.ok(texts(frameMarks(under, make('position', { composite: { value: 0.005, datums: [] } }))).includes('Ø0.005'));
});

test('a spherical position frame draws SØ in its second and stacked rows', () => {
  assert.deepEqual(texts(frameMarks(under, make('position', { sphere: true, composite: { value: 0.1, datums: [] } }))), ['SØ0.2', 'SØ0.1']);
  assert.deepEqual(texts(frameMarks(under, make('position', { sphere: true, stacked: { value: 0.1, datums: [] } }))), ['SØ0.2', 'SØ0.1']);
});

test('all around on a composite frame is centred on both rows', () => {
  const marks = frameMarks(under, make('profile-surface', { around: 'all-around', datums: ['A'], composite: { value: 0.1, datums: ['A'] } }));
  const border = marks[0]; assert.ok(border.kind === 'polyline');
  const ring = marks.find(m => m.kind === 'arc' && m.center[0] < border.points[0][0]); assert.ok(ring && ring.kind === 'arc');
  assert.equal(ring.center[1], (border.points[0][1] + border.points[2][1]) / 2);
});

test('DATUM_UNDEFINED counts a stacked row\'s datums for an attached frame', () => {
  const input = drawingInputs(starterDoc()); if (typeof input === 'string') assert.fail(input);
  const edge = input.views.front.edges.find(e => e.kind === 'line' && e.ends?.some(p => p[0] === 0 && p[1] === 0 && p[2] === 0) && e.ends.some(p => p[0] === 64 && p[1] === 0 && p[2] === 0)); assert.ok(edge);
  const dim = { id: 'd1', kind: 'linear' as const, view: 'front' as const, a: { edge: edge.name, at: 'end' as const, near: [0, 0, 0] as [number, number, number] }, b: { edge: edge.name, at: 'end' as const, near: [64, 0, 0] as [number, number, number] }, orient: 'horizontal' as const, place: [0, -10] as [number, number] };
  const f = { id: 'att', dim: 'd1', characteristic: 'position', value: 0.2, datums: [], stacked: { value: 0.1, datums: ['Z'] } } as DrawingFrame;
  const issues = drawingIssues(issueContext({ ...input, settings: { ...defaultDrawing(), dimensions: [dim], frames: [f] } })).filter(i => i.code === 'DATUM_UNDEFINED');
  assert.equal(issues.length, 1); assert.match(issues[0].message, /datum Z/);
});

test('the 3D annotation cells match the sheet for sphere, composite, stacked, statistical and unequal frames', () => {
  const input = drawingInputs(starterDoc()); if (typeof input === 'string') assert.fail(input);
  const edge = input.views.front.edges.find(e => e.kind === 'line' && e.ends?.some(p => p[0] === 0 && p[1] === 0 && p[2] === 0) && e.ends.some(p => p[0] === 64 && p[1] === 0 && p[2] === 0)); assert.ok(edge);
  const ends = (x: number) => ({ edge: edge.name, at: 'end' as const, near: [x, 0, 0] as [number, number, number] });
  const dimension = (id: string, y: number) => ({ id, kind: 'linear' as const, view: 'front' as const, a: ends(0), b: ends(64), orient: 'horizontal' as const, place: [0, y] as [number, number] });
  const frames = [
    { id: 'p1', dim: 'd1', characteristic: 'position', value: 0.125, datums: [], sphere: true, statistical: true, stacked: { value: 0.05, datums: [] } },
    { id: 'p2', dim: 'd2', characteristic: 'profile-surface', value: 0.3, datums: [], unequal: 0.125, around: 'all-over', composite: { value: 0.0125, datums: [] } },
  ] as DrawingFrame[];
  const settings = { ...defaultDrawing(), dimensions: [dimension('d1', -10), dimension('d2', -30)], frames }, ctx = issueContext({ ...input, settings });
  const items = modelAnnotations({ views: input.views, layout: ctx.layout, settings, sheet: ctx.sheet }).items.filter(a => a.kind === 'frame');
  const byId = (id: string) => items.find(a => a.frame?.dim === (id === 'p1' ? 'd1' : 'd2'))!;
  const sheetTexts = (id: string) => texts(ctx.sheet.groups.find(g => g.role === 'control' && g.id === id)!.marks as Mark[]);
  const a = byId('p1'), b = byId('p2');
  assert.ok(sheetTexts('p1').includes('SØ0.125') && sheetTexts('p1').includes('ST') && sheetTexts('p1').includes('SØ0.05'));
  assert.equal(a.frame!.zone, 'sphere'); assert.equal(a.frame!.cells[1].text, 'SØ0.125(ST)');
  assert.equal(a.frame!.stacked!.zone, 'sphere'); assert.equal(a.frame!.stacked!.cells[1].text, 'SØ0.05'); assert.equal(a.frame!.stacked!.cells[0].symbol, 'position');
  assert.ok(a.texts.some(t => t.text === 'ST') && a.texts.some(t => t.text === 'SØ0.05'), 'the 3D texts carry the stacked row and ST');
  assert.equal(b.frame!.zone, 'linear'); assert.equal(b.frame!.cells[1].text, '0.3(U)0.125'); assert.equal(b.frame!.around, 'all-over');
  assert.equal(b.frame!.composite!.zone, 'linear', 'a profile composite has no diameter zone, as on the sheet'); assert.equal(b.frame!.composite!.cells[0].text, '0.0125');
  assert.ok(sheetTexts('p2').includes('0.0125') && sheetTexts('p2').includes('0.125'));
  assert.ok(b.arcs.length >= 3, 'the profile symbol and the double circle are drawn');
});
