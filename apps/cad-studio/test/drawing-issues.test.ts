import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brepsFor } from '../src/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { snapPoints } from '../src/drawing/dimensions';
import { holeCallout } from '../src/drawing/callout';
import { autoDimensions } from '../src/drawing/auto';
import { applyFix, drawingIssues, fixAll, issueContext, quadsOverlap, segmentHitsQuad, textBox, type SheetInputs } from '../src/drawing/issues';
import { defaultDrawing, type DrawingDimension, type DrawingSettings, type DrawingViews } from '../src/drawing/types';

// R14.2 (O3): the drawing's issue list. Conformance cases packages/barocss-cad/conformance/r14/issues-<name>/case.json:
// a studio document and drawing settings, the issue codes found, and those left after every fix is applied
// (UPDATE_R14_FIXTURES=1 writes them from the drawings below; each expectation checked by hand).

const root = resolve(process.cwd(), '../../packages/barocss-cad/conformance/r14');
const hole = (node: number, center: [number, number], radius: number, extra: object = {}) => ({ kind: 'hole' as const, parent: { node, side: 'solid' as const }, center, radius, ...extra });
const plate = () => withNode(rectanglePart(64, 32, 8), hole(1, [32, 16], 4));
const bolt = () => withNode(rectanglePart(80, 80, 10), hole(1, [60, 40], 3, { pattern: { count: 6, about: [40, 40] } }));

function viewsOf(doc: StudioDoc): DrawingViews {
  const b = brepsFor(doc); assert.ok('breps' in b); const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok); return r.views;
}
const inputsOf = (doc: StudioDoc, settings: DrawingSettings): SheetInputs => ({ views: viewsOf(doc), settings, callout: e => holeCallout(doc.nodes, e), meta: { title: 't', date: 'd' } });
const codes = (i: SheetInputs) => drawingIssues(issueContext(i)).map(x => x.code).sort();
const ref = (v: DrawingViews, view: 'front' | 'top', u: number, w: number) => snapPoints(v[view]).find(p => Math.abs(p.at[0] - u) < 1e-6 && Math.abs(p.at[1] - w) < 1e-6)!.ref;
const auto = (doc: StudioDoc, s: DrawingSettings = defaultDrawing()) => { const i = inputsOf(doc, s); return autoDimensions(i.views, issueContext(i).layout, s, i.callout).dimensions; };

/** The drawings of the cases: each a part and the settings it is checked with. */
const CASES: Record<string, { about: string; doc: () => StudioDoc; settings: (v: DrawingViews, doc: StudioDoc) => DrawingSettings }> = {
  'issues-undimensioned': { about: 'the starter plate with no dimensions: a hole without size or position, the overall sizes missing; Auto-dimension fixes them all', doc: plate, settings: () => defaultDrawing() },
  'issues-auto-clean': { about: 'the starter plate auto-dimensioned: no issue', doc: plate, settings: (_, doc) => ({ ...defaultDrawing(), dimensions: auto(doc) }) },
  'issues-wrong-on-sheet': {
    about: 'a lost dimension, the width given again three times by hand (in the top view, two of them on one spot, and in the front view off the sheet), a re-matched reference: each found, each fixed',
    doc: plate,
    settings: (v, doc) => {
      const dims = auto(doc), hand: DrawingDimension[] = [
        { id: 'lost', view: 'top', kind: 'diameter', edge: 'n9.nothing', near: [0, 0, 0], place: [80, 40] },
        { id: 'twice', view: 'top', kind: 'linear', a: ref(v, 'top', 0, 0), b: ref(v, 'top', 64, 0), orient: 'horizontal', place: [32, 50] },
        { id: 'onspot', view: 'top', kind: 'linear', a: ref(v, 'top', 0, 32), b: ref(v, 'top', 64, 32), orient: 'horizontal', place: [32, 50] },
        { id: 'far', view: 'front', kind: 'linear', a: ref(v, 'front', 0, 8), b: ref(v, 'front', 64, 8), orient: 'horizontal', place: [32, 400] },
      ];
      const width = dims.find(d => d.kind === 'linear' && d.view === 'front' && d.orient === 'horizontal')!;
      const rematched = { ...width, a: { ...(width as Extract<DrawingDimension, { kind: 'linear' }>).a, was: 'n1.side0|n1.bottom' } } as DrawingDimension;
      return { ...defaultDrawing(), dimensions: [...dims.filter(d => d !== width), rematched, ...hand] };
    },
  },
  'issues-scale-too-big': { about: 'the plate at a fixed 10:1: the views do not fit; the fix goes back to an automatic scale', doc: plate, settings: (_, doc) => ({ ...defaultDrawing(), scale: 10, dimensions: auto(doc) }) },
  'issues-crowded-a4': { about: 'the bolt-circle plate auto-dimensioned on A4 at 1:1: a callout over lines (moved clear) and the top view’s name pushed into the front view (left: it needs room, R14.3)', doc: bolt, settings: (_, doc) => ({ ...defaultDrawing(), dimensions: auto(doc) }) },
};

if (process.env.UPDATE_R14_FIXTURES) for (const [name, c] of Object.entries(CASES)) {
  const doc = c.doc(), v = viewsOf(doc), settings = c.settings(v, doc), i = inputsOf(doc, settings), dir = resolve(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'case.json'), JSON.stringify({
    id: `r14-${name}`, step: 'R14.2', decisions: ['O3'], about: c.about,
    input: { document: { format: doc.format, schema: doc.schema, units: doc.units, parameters: doc.parameters, nodes: doc.nodes, nextId: doc.nextId, outputs: doc.outputs }, drawing: settings },
    expect: { issues: codes(i), afterFixAll: fixAll(i).left.map(x => x.code).sort() },
    oracle: 'what is on the sheet, checked by hand against the rules in decisions-outer.md O3; run by apps/cad-studio/test/drawing-issues.test.ts',
  }, null, 1) + '\n');
}

for (const name of existsSync(root) ? readdirSync(root).filter(n => n.startsWith('issues-') && existsSync(resolve(root, n, 'case.json'))) : []) {
  const c = JSON.parse(readFileSync(resolve(root, name, 'case.json'), 'utf8'));
  test(`conformance ${c.id}: ${c.about}`, () => {
    const i = inputsOf(c.input.document as StudioDoc, c.input.drawing as DrawingSettings);
    assert.deepEqual(codes(i), c.expect.issues);
    assert.deepEqual(fixAll(i).left.map(x => x.code).sort(), c.expect.afterFixAll);
  });
}

test('the issue cases cover the drawings (UPDATE_R14_FIXTURES=1 writes them)', () => {
  for (const name of Object.keys(CASES)) assert.ok(existsSync(resolve(root, name, 'case.json')), name);
});

test('each issue on the wrong sheet, with its fix', () => {
  const doc = plate(), v = viewsOf(doc), settings = CASES['issues-wrong-on-sheet'].settings(v, doc), i = inputsOf(doc, settings), ctx = issueContext(i), list = drawingIssues(ctx);
  const of = (code: string) => list.filter(x => x.code === code);
  assert.deepEqual(of('DIMENSION_LOST').map(x => x.fix), [{ kind: 'remove', dim: 'lost' }]);
  // The width again three times (in the top view at both edges, and in the front at the top): the axis is shared, so each
  // repeats the front view's auto width. Against an auto one the auto one goes; between two by hand, the later.
  const dup = of('DUPLICATE'); assert.equal(dup.length, 3);
  for (const x of dup) { const [a, b] = x.dims!.map(id => settings.dimensions.find(d => d.id === id)!); assert.equal((x.fix as { dim: string }).dim, a.auto && !b.auto ? a.id : b.id); }
  assert.ok(of('REMATCHED').length === 1 && of('REMATCHED')[0].fix?.kind === 'accept');
  assert.ok(of('TEXT_OVERLAP').some(x => x.dims?.includes('onspot') || x.dims?.includes('twice')));
  assert.ok(of('OFF_SHEET').some(x => x.dims?.includes('far') && x.fix?.kind === 'move'));
  // A move's place clears: after it the dimension is no longer listed there.
  const off = of('OFF_SHEET').find(x => x.dims?.includes('far'))!, moved = issueContext({ ...i, settings: applyFix(ctx, off.fix!) });
  assert.ok(!drawingIssues(moved).some(x => x.code === 'OFF_SHEET' && x.dims?.includes('far')));
  // Accepting a re-matched reference clears its mark only.
  const acc = applyFix(ctx, of('REMATCHED')[0].fix!), d = acc.dimensions.find(x => x.id === of('REMATCHED')[0].dims![0])!;
  assert.ok(d.kind === 'linear' && d.a.was === undefined && d.a.edge);
  // Fix all: nothing left, the hand-placed dimensions kept unless one was the issue.
  const after = fixAll(i);
  assert.deepEqual(after.left, []);
  assert.ok(after.settings.dimensions.some(x => x.id === 'twice') && !after.settings.dimensions.some(x => x.id === 'lost' || x.id === 'onspot'));
});

test('text boxes and lines: overlap by the separating-axis test, a segment through a turned box', () => {
  const t = (at: [number, number], angle = 0) => textBox({ kind: 'text', at, text: '64 ±0.1', size: 3.5, anchor: 'middle', ...(angle ? { angle } : {}) });
  assert.ok(quadsOverlap(t([10, 10]), t([12, 10]))); assert.ok(!quadsOverlap(t([10, 10]), t([10, 20])));
  assert.ok(!quadsOverlap(t([10, 10]), t([10 + 13.5, 10])), 'side by side, apart');
  const turned = t([10, 10], 90);
  assert.ok(segmentHitsQuad([5, 8], [15, 8], turned)); assert.ok(!segmentHitsQuad([5, 30], [15, 30], turned));
  // A box of turned text is as tall as the plain one is wide.
  const w = Math.hypot(turned[1][0] - turned[0][0], turned[1][1] - turned[0][1]), plain = t([0, 0]);
  assert.ok(Math.abs(w - Math.hypot(plain[1][0] - plain[0][0], plain[1][1] - plain[0][1])) < 1e-12 && Math.abs(turned[1][0] - turned[0][0]) < 1e-12);
});

test('Auto-dimension leaves no issue on the R14.1 parts it does not report crowded', () => {
  for (const name of readdirSync(root).filter(n => !n.startsWith('issues-') && existsSync(resolve(root, n, 'case.json')))) {
    const c = JSON.parse(readFileSync(resolve(root, name, 'case.json'), 'utf8')), doc = c.input.document as StudioDoc;
    if (c.step !== 'R14.1' && c.step !== 'R14.5') continue;
    const settings: DrawingSettings = { ...defaultDrawing(), ...c.input.drawing }, dims = auto(doc, settings), list = drawingIssues(issueContext(inputsOf(doc, { ...settings, dimensions: dims })));
    // (Crowded is a reserve, not a finding: a crowded side may still draw cleanly. Only the others are asserted clean.)
    if (!c.expect.crowded.length) assert.deepEqual(list.map(x => `${x.code}: ${x.message}`), [], name);
  }
});
