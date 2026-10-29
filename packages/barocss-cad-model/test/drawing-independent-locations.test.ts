import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { samePointDependency } from '../src/drawing/measurement';
import { holeCalloutOwner, holeCalloutOwnerOf } from '../src/drawing/callout';
import { drawingInputs } from '../src/chat/drawing';
import { autoDimensions } from '../src/drawing/auto';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { defaultDrawing, type DrawingDimension, type DrawingSettings } from '../src/drawing/types';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const context = (doc: StudioDoc, settings: DrawingSettings) => {
  const input = drawingInputs(doc, settings); assert.ok(typeof input !== 'string', String(input));
  return issueContext(input);
};
async function bracket(): Promise<ChatState> {
  const calls = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/sheet-l-bracket.calls.json'), 'utf8')).calls as { tool: string; args: Record<string, unknown> }[];
  let state: ChatState = { doc: emptyDoc(), bodies: [] };
  for (const call of calls) { const result = await dispatchTool(state, call.tool, call.args, evaluate); assert.ok(!result.isError, result.content); state = result.state; }
  return state;
}
function dimensions(doc: StudioDoc): DrawingSettings {
  const settings = defaultDrawing(), ctx = context(doc, settings);
  return { ...settings, dimensions: autoDimensions(ctx.views, ctx.layout, settings, ctx.callout, [], [], ctx.locationOwner).dimensions };
}
function location(settings: DrawingSettings, feature: string, orient: 'horizontal' | 'vertical') {
  const dim = settings.dimensions.find(d => d.kind === 'linear' && d.orient === orient && [d.a.edge, d.b.edge].some(e => e.includes(feature)));
  assert.ok(dim && dim.kind === 'linear', `location for ${feature}`); return dim;
}
const duplicates = (doc: StudioDoc, settings: DrawingSettings) => drawingIssues(context(doc, settings)).filter(i => i.code === 'DUPLICATE');
const missing = (doc: StudioDoc, settings: DrawingSettings) => drawingIssues(context(doc, settings)).filter(i => i.code === 'HOLE_NOT_LOCATED');
const scene = bracket();

test('independent cross-view hole locations with equal values are retained; missing target remains diagnosed', async () => {
  const { doc } = await scene, settings = dimensions(doc), first = location(settings, 'n2.side', 'vertical'), second = location(settings, 'n5.side', 'horizontal');
  const values = context(doc, settings).sheet.dimensions.filter(d => d.dim.id === first.id || d.dim.id === second.id);
  assert.deepEqual(values.map(d => d.ok ? d.value : null), [15, 15]);
  assert.deepEqual(duplicates(doc, settings).filter(i => i.dims?.includes(first.id) && i.dims.includes(second.id)), []);
  const retained = { ...settings, dimensions: settings.dimensions.filter(d => d.id !== second.id) };
  assert.equal(missing(doc, retained).length, 1);
  assert.equal(missing(doc, retained)[0].view, 'right');
});

test('public edit changes only the second hole location from 15 to 17; both targets remain independently covered', async () => {
  const state = await scene, settings = dimensions(state.doc), first = location(settings, 'n2.side', 'vertical'), second = location(settings, 'n5.side', 'horizontal');
  const node = state.doc.nodes[4]; assert.ok(node.kind === 'sketch' && node.profile === 'circle');
  const result = await dispatchTool({ ...state, doc: { ...state.doc, drawing: settings } }, 'features', { action: 'edit', index: 4, feature: { ...node, center: [17, 20] } }, evaluate);
  assert.ok(!result.isError, result.content);
  assert.deepEqual(result.state.doc.nodes, state.doc.nodes.map((n, index) => index === 4 ? { ...node, center: [17, 20] } : n));
  // Signature metadata can be refreshed by the public edit. Persistent references and placements stay authored.
  assert.deepEqual(JSON.parse(JSON.stringify(result.state.doc.drawing, (key, value) => key === 'sig' ? undefined : value)), settings);
  const ctx = context(result.state.doc, settings);
  assert.deepEqual([first.id, second.id].map(id => { const r = ctx.sheet.dimensions.find(d => d.dim.id === id); return r?.ok ? r.value : null; }), [15, 17]);
  assert.deepEqual(duplicates(result.state.doc, settings).filter(i => i.dims?.includes(first.id) && i.dims.includes(second.id)), []);
  assert.deepEqual(missing(result.state.doc, settings), []);
  assert.equal(missing(result.state.doc, { ...settings, dimensions: settings.dimensions.filter(d => d.id !== second.id) }).length, 1);
});

test('manual first-hole location does not suppress automatic location of an independent equal-value target', async () => {
  const { doc } = await scene, settings = dimensions(doc), first = location(settings, 'n2.side', 'vertical'), second = location(settings, 'n5.side', 'horizontal');
  const manual: DrawingDimension = { ...first }; delete manual.auto; const input = { ...settings, dimensions: [manual] }, ctx = context(doc, input);
  const generated = autoDimensions(ctx.views, ctx.layout, input, ctx.callout, [], [], ctx.locationOwner).dimensions;
  assert.deepEqual(generated.find(d => d.id === manual.id), manual);
  assert.ok(generated.some(d => d.kind === 'linear' && d.view === second.view && d.orient === second.orient && d.b.edge === second.b.edge));
});

test('a later repeat of the second target is found after an independent target with the same span', async () => {
  const { doc } = await scene, settings = dimensions(doc), first = location(settings, 'n2.side', 'vertical'), second = location(settings, 'n5.side', 'horizontal');
  const repeat = { ...second, id: 'repeat', a: second.b, b: second.a }; delete repeat.auto;
  const input = { ...settings, dimensions: [first, second, repeat] };
  const found = duplicates(doc, input);
  assert.equal(found.length, 1); assert.deepEqual(found[0].dims, [second.id, repeat.id]);
  assert.deepEqual(found[0].fix, { kind: 'remove', dim: second.id });
});

function fixtureDoc(name: string): StudioDoc {
  return JSON.parse(readFileSync(join(import.meta.dirname, '../../barocss-cad/conformance/r14', name, 'case.json'), 'utf8')).input.document as StudioDoc;
}

test('independently authored square-grid holes each retain two target-owned locations and distinct placement rows', () => {
  const doc = fixtureDoc('pcd-square-grid'), settings = dimensions(doc), ctx = context(doc, settings);
  const locations = settings.dimensions.filter(d => d.kind === 'linear' && (d.a.at === 'center' || d.b.at === 'center'));
  assert.equal(locations.length, 8);
  for (const feature of ['n2.side', 'n3.side', 'n4.side', 'n5.side']) for (const orient of ['horizontal', 'vertical'] as const) assert.ok(location(settings, feature, orient));
  assert.equal(new Set(locations.map(d => JSON.stringify([d.view, d.place]))).size, 8);
  assert.deepEqual(missing(doc, settings), []); assert.deepEqual(duplicates(doc, settings), []);
  const removed = location(settings, 'n5.side', 'horizontal');
  assert.equal(missing(doc, { ...settings, dimensions: settings.dimensions.filter(d => d.id !== removed.id) }).length, 1);
  if (process.env.D331_EVIDENCE_DIR) writeFileSync(join(process.env.D331_EVIDENCE_DIR, 'grid-targets.json'), JSON.stringify({ settings, resolved: ctx.sheet.dimensions, issues: drawingIssues(ctx) }, null, 2));
});

test('same-target orthographic repeat keeps manual reference and removes its automatic repeat', async () => {
  const { doc } = await scene, settings = dimensions(doc), first = location(settings, 'n2.side', 'vertical');
  const manual = { ...first }; delete manual.auto;
  const repeat = { ...first, id: 'orthographic-repeat', view: 'right' as const, orient: 'horizontal' as const, a: first.b, b: first.a };
  const found = duplicates(doc, { ...settings, dimensions: [manual, repeat] });
  assert.equal(found.length, 1); assert.deepEqual(found[0].fix, { kind: 'remove', dim: repeat.id });
});

test('a common hole target does not merge measurements from two independent coincident datum features', async () => {
  const { doc } = await scene, settings = dimensions(doc), first = location(settings, 'n2.side', 'vertical'), input = drawingInputs(doc, settings);
  assert.ok(typeof input !== 'string');
  const source = input.views.top.edges.find(e => e.name === first.a.edge); assert.ok(source);
  const alternate = { ...first, id: 'other-datum', a: { ...first.a, edge: 'independentDatum.face' } };
  // A projection-level unit control: identical end geometry has a distinct authored feature identity.
  const views = { ...input.views, top: { ...input.views.top, edges: [...input.views.top.edges, { ...source, name: alternate.a.edge }] } };
  assert.deepEqual(drawingIssues(issueContext({ ...input, views, settings: { ...settings, dimensions: [first, alternate] } })).filter(i => i.code === 'DUPLICATE'), []);
});


test('reversing a counted pitch changes its extension direction and does not offer a duplicate removal', async () => {
  const { doc } = await scene, settings = dimensions(doc), first = location(settings, 'n2.side', 'vertical');
  const forward = { ...first, count: 3 }, reverse = { ...first, id: 'reverse-count', count: 3, a: first.b, b: first.a };
  assert.deepEqual(duplicates(doc, { ...settings, dimensions: [forward, reverse] }), []);
});

test('same-owner endpoint pitches keep direction and count; a same-direction repeat prefers the manual dimension', async () => {
  const { doc } = await scene, settings = dimensions(doc);
  const width = settings.dimensions.find(d => d.kind === 'linear' && d.view === 'front' && d.orient === 'horizontal'); assert.ok(width && width.kind === 'linear');
  const manual = { ...width, count: 3 }; delete manual.auto;
  const reversed = { ...width, id: 'reverse-endpoints', count: 3, a: width.b, b: width.a };
  assert.deepEqual(duplicates(doc, { ...settings, dimensions: [manual, reversed] }), []);
  assert.deepEqual(duplicates(doc, { ...settings, dimensions: [manual, { ...width, id: 'different-count', count: 2 }] }), []);
  const repeat = { ...width, id: 'same-direction', count: 3 };
  const found = duplicates(doc, { ...settings, dimensions: [manual, repeat] });
  assert.equal(found.length, 1); assert.deepEqual(found[0].fix, { kind: 'remove', dim: repeat.id });
});

test('a manual endpoint count does not suppress a generated overall size with a different count or direction', async () => {
  const { doc } = await scene, settings = dimensions(doc);
  const width = settings.dimensions.find(d => d.kind === 'linear' && d.view === 'front' && d.orient === 'horizontal'); assert.ok(width && width.kind === 'linear');
  const manual = { ...width, count: 3 }; delete manual.auto;
  const input = { ...settings, dimensions: [manual] }, ctx = context(doc, input);
  const generated = autoDimensions(ctx.views, ctx.layout, input, ctx.callout, [], [], ctx.locationOwner).dimensions;
  assert.ok(generated.some(d => d.kind === 'linear' && d.view === width.view && d.orient === width.orient && !d.count && d.a.edge === width.a.edge && d.b.edge === width.b.edge));
  assert.deepEqual(generated.find(d => d.id === manual.id), manual);
});

function compoundStacks(): StudioDoc {
  let doc = rectanglePart(50, 50, 12);
  doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [25, 25], radius: 3.3 });
  doc = withNode(doc, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [25, 25], radius: 5.5, depth: 6.5 });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [50, 50], plane: { origin: [0, 0, 24], normal: [0, 0, 1], xAxis: [1, 0, 0] } });
  doc = withNode(doc, { kind: 'extrude', sketch: 4, height: 12 });
  doc = withNode(doc, { kind: 'hole', parent: { node: 5, side: 'solid' }, center: [25, 25], radius: 3.3 });
  return withNode(doc, { kind: 'hole', parent: { node: 6, side: 'solid' }, center: [25, 25], radius: 5.5, depth: 6.5 });
}

test('actual independent compound stacks keep different location owners despite equal text and coaxial circles', () => {
  const doc = compoundStacks(), ctx = context(doc, defaultDrawing()), pr = ctx.views.top;
  const point = (feature: string) => {
    const edge = pr.edges.find(e => e.name.includes(feature) && e.circle); assert.ok(edge?.circle);
    return { edge: edge.name, at: 'center' as const, near: [...edge.circle.center] as [number, number, number] };
  };
  const inner = point('n2.side'), outer = point('n3.side'), independent = point('n6.side');
  assert.equal(ctx.callout(inner.edge), ctx.callout(independent.edge));
  assert.equal(ctx.locationOwner?.(inner.edge), ctx.locationOwner?.(outer.edge));
  assert.notEqual(ctx.locationOwner?.(inner.edge), ctx.locationOwner?.(independent.edge));
  assert.equal(samePointDependency(inner, pr, outer, pr, 'X', ctx.locationOwner), true);
  assert.equal(samePointDependency(inner, pr, independent, pr, 'X', ctx.locationOwner), false);
  assert.equal(samePointDependency(inner, pr, outer, pr, 'X'), false, 'absent authored ownership stays conservative');
});

test('compound location owners retain instance paths and exact pattern-copy identity; invalid dependent cuts do not bind', () => {
  const doc = compoundStacks();
  assert.equal(holeCalloutOwner(doc.nodes, 'left/n1.top|left/n2.side0'), 'left/n2');
  assert.equal(holeCalloutOwner(doc.nodes, 'left/n1.top|left/n3.side0'), 'left/n2');
  assert.equal(holeCalloutOwner(doc.nodes, 'right/n1.top|right/n3.side0'), 'right/n2');
  assert.equal(holeCalloutOwner(doc.nodes, 'left/n1.top|left/n2_p2.side0'), 'left/n2_p2');
  const nodes = doc.nodes.map((node, index) => index === 3 ? { ...node, depth: -1 } : node);
  assert.equal(holeCalloutOwner(nodes, 'n1.top|n3.side0'), null);
});


test('assembly ownership resolves actual instance features rather than colliding base ids', () => {
  const base = compoundStacks();
  let part = rectanglePart(50, 50, 12);
  part = withNode(part, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [25, 25], radius: 3.3 });
  part = withNode(part, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [35, 25], radius: 5.5, depth: 6.5 });
  const doc: StudioDoc = { ...base, instances: [
    { id: 'left', name: 'left', doc: part, position: [80, 0, 0], rotation: [0, 0, 0] },
    { id: 'right', name: 'right', doc: part, position: [-80, 0, 0], rotation: [0, 0, 0] },
  ] };
  const edge = 'left/n1.top|left/n3.side0';
  assert.equal(holeCalloutOwner(base.nodes, edge), 'left/n2', 'base ids deliberately describe a different relationship');
  assert.equal(holeCalloutOwnerOf(doc, edge), 'left/n3');
  assert.equal(holeCalloutOwnerOf(doc, 'right/n1.top|right/n3.side0'), 'right/n3');
  assert.equal(holeCalloutOwnerOf(doc, 'unknown/n1.top|unknown/n3.side0'), null);
  assert.equal(holeCalloutOwnerOf(doc, 'left/n1.top|right/n3.side0'), null);
  const ctx = context(doc, { ...defaultDrawing(), scope: { kind: 'assembly' } });
  assert.equal(ctx.locationOwner?.(edge), 'left/n3');
});
