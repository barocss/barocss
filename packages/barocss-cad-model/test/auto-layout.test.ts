import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brepsFor } from '../src/engine/evaluate';
import { isRefusal } from '../src/engine/refusal';
import { rectanglePart, starterDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { holeCallout, holeCalloutOwner } from '../src/drawing/callout';
import { snapPoints } from '../src/drawing/dimensions';
import { applyFix, drawingIssues, issueContext, type SheetInputs } from '../src/drawing/issues';
import { MIN_HOLE_ON_PAPER_MM, autoLayout, chooseViews, rightAddsNothing } from '../src/drawing/layout';
import { layoutSheet } from '../src/drawing/views';
import { forSheet, mergeSheet } from '../src/drawing/sheets';
import { autoLayoutSheets } from '../src/drawing/sheetSet';
import { defaultDrawing, readDrawing, type DrawingDimension, type DrawingSettings, type DrawingViews } from '../src/drawing/types';

// R14.3 (O4): views chosen and laid out for their dimensions. Conformance cases packages/barocss-cad/conformance/r14/
// layout-<name>/case.json: a studio document and drawing settings; the views shown, the sheet and scale chosen, whether
// it reads (smallest hole on paper), the issues left and the dimensions as they read. UPDATE_R14_FIXTURES=1 writes them.

const root = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/r14');
const hole = (node: number, center: [number, number], radius: number, extra: object = {}) => ({ kind: 'hole' as const, parent: { node, side: 'solid' as const }, center, radius, ...extra });
const viewsOf = (doc: StudioDoc): DrawingViews => { const b = brepsFor(doc); assert.ok('breps' in b); const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok); return r.views; };
const inputsOf = (doc: StudioDoc, settings: DrawingSettings): SheetInputs => ({ views: viewsOf(doc), settings, callout: e => holeCallout(doc.nodes, e), locationOwner: e => holeCalloutOwner(doc.nodes, e), meta: { title: 't', date: 'd' } });

const CASES: Record<string, { about: string; doc: () => StudioDoc; settings?: (v: DrawingViews) => DrawingSettings }> = {
  'layout-plate': { about: 'the starter plate: the right view shows nothing the others do and is left out; A4 at 1:1, clean', doc: starterDoc },
  'layout-cross-hole': { about: 'a block with a hole along X: the right view shows it round and stays; the hole located and called out there', doc: () => withNode(rectanglePart(60, 30, 30), hole(1, [15, 15], 4, { axis: 'x' })) },
  'layout-bolt-circle': { about: 'the bolt-circle plate: its pitch circle and centre (R14.5); A4, clean, its Ø6 holes 3 mm on paper at the scale chosen', doc: () => withNode(rectanglePart(80, 80, 10), hole(1, [60, 40], 3, { pattern: { count: 6, about: [40, 40] } })) },
  'layout-long-plate': { about: 'a 240 × 120 plate with a row of Ø8 holes: 1:5 on A4 would put them at 1.6 mm, so A3 at 1:2', doc: () => withNode(rectanglePart(240, 120, 10), hole(1, [20, 20], 4, { pattern: { count: 10, step: [20, 0] } })) },
  'layout-hand-in-right': {
    about: 'the starter plate with a dimension placed by hand in the right view: the right view stays, the dimension kept',
    doc: starterDoc,
    settings: v => { const s = snapPoints(v.right), at = (u: number, w: number) => s.find(p => Math.abs(p.at[0] - u) < 1e-6 && Math.abs(p.at[1] - w) < 1e-6)!.ref; return { ...defaultDrawing(), dimensions: [{ id: 'mine', view: 'right', kind: 'linear', a: at(0, 0), b: at(32, 0), orient: 'horizontal', place: [16, -12] }] }; },
  },
};

const read = (i: SheetInputs, settings: DrawingSettings) => issueContext({ ...i, settings }).sheet.dimensions.map(d => ({ view: d.dim.view, kind: d.dim.kind, text: d.ok ? d.text : `lost: ${d.reason}` })).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1);

if (process.env.UPDATE_R14_FIXTURES) for (const [name, c] of Object.entries(CASES)) {
  const doc = c.doc(), v = viewsOf(doc), settings = c.settings?.(v) ?? defaultDrawing(), i = inputsOf(doc, settings), r = autoLayout(i), dir = resolve(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'case.json'), JSON.stringify({
    id: `r14-${name}`, step: 'R14.3', decisions: ['O4'], about: c.about,
    input: { document: { format: doc.format, schema: doc.schema, units: doc.units, parameters: doc.parameters, nodes: doc.nodes, nextId: doc.nextId, outputs: doc.outputs }, drawing: settings },
    expect: { views: r.report.views, dropped: r.report.dropped, sheet: r.report.sheet, scale: r.report.scale, readable: r.report.readable, left: r.report.left.map(x => x.code).sort(), dimensions: read(i, r.settings) },
    oracle: 'the part’s design values and the rules in decisions-outer.md O4, checked by hand; run by apps/cad-studio/test/auto-layout.test.ts',
  }, null, 1) + '\n');
}

for (const name of existsSync(root) ? readdirSync(root).filter(n => n.startsWith('layout-') && existsSync(resolve(root, n, 'case.json'))) : []) {
  const c = JSON.parse(readFileSync(resolve(root, name, 'case.json'), 'utf8'));
  test(`conformance ${c.id}: ${c.about}`, () => {
    const i = inputsOf(c.input.document as StudioDoc, c.input.drawing as DrawingSettings), r = autoLayout(i);
    assert.deepEqual({ views: r.report.views, dropped: r.report.dropped, sheet: r.report.sheet, scale: r.report.scale, readable: r.report.readable, left: r.report.left.map(x => x.code).sort() },
      { views: c.expect.views, dropped: c.expect.dropped, sheet: c.expect.sheet, scale: c.expect.scale, readable: c.expect.readable, left: c.expect.left });
    assert.deepEqual(read(i, r.settings), c.expect.dimensions);
    // What it chose reads back from a saved file and gives the same clean sheet.
    const again = readDrawing(JSON.parse(JSON.stringify(r.settings)));
    assert.deepEqual(again, r.settings);
    assert.deepEqual(drawingIssues(issueContext({ ...i, settings: again })).filter(x => x.severity === 'error'), []);
  });
}

test('the layout cases cover the parts (UPDATE_R14_FIXTURES=1 writes them)', () => {
  for (const name of Object.keys(CASES)) assert.ok(existsSync(resolve(root, name, 'case.json')), name);
});

test('room widens the gaps only where it is more than they give; without it the layout is as before', () => {
  const v = viewsOf(starterDoc()), plain = layoutSheet(v, defaultDrawing());
  assert.deepEqual(layoutSheet(v, { ...defaultDrawing(), room: {} }), plain, 'empty room: the same layout');
  assert.deepEqual(layoutSheet(v, { ...defaultDrawing(), room: { top: { left: 5 } } }), plain, 'room the margins already give');
  const wide = layoutSheet(v, { ...defaultDrawing(), room: { front: { right: 30 }, right: { left: 10 } } });
  const gap = (l: typeof plain) => l.views.right.box[0] - l.views.front.box[2];
  assert.ok(gap(wide) >= 30 + 10 + 3 - 1e-9 && gap(plain) < gap(wide), `${gap(plain)} → ${gap(wide)}`);
  // A view not shown takes no room and is drawn nowhere.
  const two = layoutSheet(v, { ...defaultDrawing(), views: ['front', 'top'] });
  assert.ok(two.views.right.hidden && two.views.iso.hidden && !two.views.front.hidden);
  const sheet = issueContext({ ...inputsOf(starterDoc(), defaultDrawing()), settings: { ...defaultDrawing(), views: ['front', 'top'] } }).sheet;
  assert.ok(!sheet.groups.some(g => g.view === 'right' || g.view === 'iso'));
});

test('the right view adds nothing on a plate, something with a hole along X; a dimension in a hidden view is listed', () => {
  assert.equal(rightAddsNothing(viewsOf(starterDoc())), true);
  assert.equal(rightAddsNothing(viewsOf(withNode(rectanglePart(60, 30, 30), hole(1, [15, 15], 4, { axis: 'x' })))), false);
  // A step seen only from the side: an L in the XZ plane extruded along Y shows its step in the front view and the right view's edges are the top's and front's.
  const v = viewsOf(starterDoc());
  assert.deepEqual(chooseViews(v, { ...defaultDrawing(), views: ['front', 'top', 'iso'] }), { views: ['front', 'top', 'iso'], dropped: [] });
  const i = inputsOf(withNode(rectanglePart(60, 30, 30), hole(1, [15, 15], 4, { axis: 'x' })), { ...defaultDrawing(), views: ['front', 'top', 'iso'] });
  const list = drawingIssues(issueContext(i));
  assert.ok(list.some(x => x.code === 'VIEW_NEEDED' && x.fix?.kind === 'show-view'), JSON.stringify(list.map(x => x.code)));
  assert.ok(MIN_HOLE_ON_PAPER_MM > 0);
});

test('Auto-layout and the issue fix retain a tolerance through reruns and source changes', () => {
  const original = inputsOf(rectanglePart(40, 12, 6), defaultDrawing());
  const first = autoLayout(original).settings;
  const width = first.dimensions.find(d => d.kind === 'linear' && d.view === 'front' && d.orient === 'horizontal');
  assert.ok(width);
  const height = first.dimensions.find(d => d.kind === 'linear' && d.view === 'front' && d.orient === 'vertical');
  assert.ok(height);
  const manual = { ...height, id: 'manual-height', auto: undefined };
  const controls = [
    { kind: 'symmetric', value: 0.05 },
    { kind: 'deviation', upper: 0.10, lower: -0.02 },
    { kind: 'fit', code: 'H7' },
  ] as const;
  for (const tol of controls) {
    const authored: DrawingDimension = { ...width, tol };
    const settings: DrawingSettings = { ...first, dimensions: [authored, manual] };
    const input: SheetInputs = { ...original, settings };
    const outputs: DrawingSettings[] = [autoLayout(input).settings, applyFix(issueContext(input), { kind: 'auto-dimension' })];
    for (const output of outputs) {
      assert.equal(output.dimensions.length, first.dimensions.length);
      assert.deepEqual(output.dimensions.find(d => d.id === width.id)?.tol, tol);
      assert.deepEqual(output.dimensions.find(d => d.id === 'manual-height'), manual);
      const reopened = readDrawing(JSON.parse(JSON.stringify(output)));
      const resized = inputsOf(rectanglePart(48, 12, 6), reopened);
      const rerun = autoLayout(resized).settings;
      const measured = issueContext({ ...resized, settings: rerun }).sheet.dimensions.filter(r => r.ok && r.value === 48);
      assert.equal(measured.length, 1);
      assert.equal(measured[0].dim.id, width.id);
      assert.deepEqual(measured[0].dim.tol, tol);
    }
  }
  const withoutTolerance = { ...first, dimensions: [{ ...width, id: 'old-auto-width' }, manual] };
  const regenerated = autoLayout({ ...original, settings: withoutTolerance });
  assert.equal(regenerated.report.dimensions.kept, 1);
  assert.equal(regenerated.settings.dimensions.some(d => d.id === 'old-auto-width'), false);
  assert.equal(regenerated.settings.dimensions.length, first.dimensions.length);
});

test('Auto layout reports every searched sheet and leaves input intact when no projected view fits', () => {
  for (const sheet of ['A4', 'A3'] as const) {
    for (const withHole of [false, true]) {
      const doc = withHole ? starterDoc() : rectanglePart(40, 20, 6);
      const normal = inputsOf(doc, defaultDrawing()), control = autoLayout(normal);
      const settings = { ...control.settings, sheet, scale: 1, notes: [{ id: 'keep', text: 'Existing note', at: [20, 30] as [number, number] }] };
      // Isolate the layout boundary with a projected span. The native model itself is within its length limit.
      const front = { ...normal.views.front, max: [normal.views.front.min[0] + 50000, normal.views.front.max[1]] as [number, number] };
      const input = { ...normal, settings, views: { ...normal.views, front } };
      const before = structuredClone(settings);
      const attemptedSheets = sheet === 'A4' ? ['A4', 'A3'] : ['A3'];
      const standardScales = [1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
      const expectedAttempts = [{ sheet, ceiling: 1, scales: standardScales }, ...(sheet === 'A4' ? [{ sheet: 'A3', ceiling: 0.01, scales: [0.01] }] : [])];
      assert.ok(50000 * 0.01 > 420);
      assert.equal(layoutSheet(input.views, { ...settings, sheet: 'A3', scale: 0.01 }).fits, false);
      for (let k = 0; k < 2; k++) assert.throws(() => autoLayout(input), error => {
        assert.ok(isRefusal(error, 'VIEWS_DONT_FIT'));
        assert.match(error.message, /1:100/);
        for (const size of attemptedSheets) assert.ok(error.message.includes(size));
        assert.deepEqual(error.details, { sheets: expectedAttempts, tried: standardScales.length + (sheet === 'A4' ? 1 : 0) });
        return true;
      });
      assert.deepEqual(input.settings, before);
      assert.equal(drawingIssues(issueContext(input)).find(issue => issue.code === 'VIEWS_DONT_FIT')?.fix, undefined);
      assert.ok(autoLayout(normal).report.dimensions.added.overall > 0);
    }
  }
});

test('Auto layout reports the stored scale when there are zero supported candidates', () => {
  const input = inputsOf(rectanglePart(40, 20, 6), { ...defaultDrawing(), sheet: 'A3', scale: 0.005 });
  assert.equal(layoutSheet(input.views, input.settings).fits, true);
  assert.throws(() => autoLayout(input), error => {
    assert.ok(isRefusal(error, 'VIEWS_DONT_FIT'));
    assert.match(error.message, /A3 .*no supported scale.*1:200/);
    assert.deepEqual(error.details, { sheets: [{ sheet: 'A3', ceiling: 0.005, scales: [] }], tried: 0 });
    return true;
  });
});

test('Auto layout returns a fitting candidate with existing annotation issues', () => {
  const lost: DrawingDimension = { id: 'lost', view: 'front', kind: 'diameter', edge: 'missing', near: [0, 0, 0], place: [10, 10] };
  const input = inputsOf(rectanglePart(40, 20, 6), { ...defaultDrawing(), dimensions: [lost] });
  const result = autoLayout(input);
  assert.ok(result.report.left.some(issue => issue.code === 'DIMENSION_LOST'));
  assert.ok(issueContext({ ...input, settings: result.settings }).layout.fits);
  assert.deepEqual(result.settings.dimensions.find(d => d.id === lost.id), lost);
});

test('D754: sequential automatic layouts reserve dimension IDs on other sheets in either order', () => {
  const initial = inputsOf(CASES['layout-cross-hole'].doc(), {
    ...defaultDrawing(),
    sheets: [{ id: 'S2', name: 'Continuation', size: 'A3', views: ['right'] }],
  });
  const sortedIds = (s: DrawingSettings) => s.dimensions.map(d => d.id).sort();
  const check = (settings: DrawingSettings, firstSheetIds: string[], secondSheetIds: string[]) => {
    const first = forSheet(settings, 0), second = forSheet(settings, 1);
    assert.deepEqual(sortedIds(first), firstSheetIds);
    assert.deepEqual(sortedIds(second), secondSheetIds);
    assert.deepEqual(read(initial, first).map(dim => dim.text).sort(), ['30', '30', '60']);
    assert.deepEqual(read(initial, second).map(dim => dim.text).sort(), ['15', '15', 'Ø8 THRU']);
    assert.equal(settings.sheetContext, undefined);
    assert.deepEqual(readDrawing(JSON.parse(JSON.stringify(settings))).dimensions, settings.dimensions);
  };
  const lower = ['d1', 'd2', 'd3'], upper = ['d4', 'd5', 'd6'];
  check(autoLayoutSheets(initial).settings, lower, upper);
  for (const order of [[0, 1], [1, 0]]) {
    let whole = initial.settings;
    for (const sheet of order) {
      const local = forSheet(whole, sheet);
      whole = mergeSheet(whole, sheet, autoLayout({ ...initial, settings: local }).settings);
    }
    check(whole, order[0] === 0 ? lower : upper, order[0] === 0 ? upper : lower);
  }
});

test('D754: Auto-dimension reserves an existing sibling dimension and preserves its exact authored control', () => {
  const initial = inputsOf(CASES['layout-cross-hole'].doc(), {
    ...defaultDrawing(),
    sheets: [{ id: 'S2', views: ['right'] }],
  });
  const right = autoLayout({ ...initial, settings: forSheet(initial.settings, 1) }).settings.dimensions.find(d => d.kind === 'diameter');
  assert.ok(right);
  const manual: DrawingDimension = { ...right, id: 'd1', auto: undefined, tol: { kind: 'symmetric', value: 0.05 } };
  const whole = { ...initial.settings, dimensions: [manual] };
  const local = forSheet(whole, 0);
  assert.deepEqual(local.sheetContext?.dimensionIdsOnOtherSheets, ['d1']);
  const result = mergeSheet(whole, 0, autoLayout({ ...initial, settings: local }).settings);
  assert.deepEqual(forSheet(result, 0).dimensions.map(d => d.id).sort(), ['d2', 'd3', 'd4']);
  assert.deepEqual(forSheet(result, 1).dimensions, [manual]);
  assert.equal(result.sheetContext, undefined);
});
