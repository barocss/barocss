import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, type SketchNode, type StudioDoc, type ModelNode } from '../src/engine/doc';
import { encodeStudioFile, decodeStudioFile } from '../src/engine/container';
import { readStudioDoc } from '../src/engine/migrate';
import { toPartDocument } from '../src/engine/part';
import { evaluateDoc } from '../src/engine/evaluate';
import { checkNode } from '../src/chat/features';
import { editFields } from '../src/app/editFields';
import { profileOf } from '../src/sketch/loops';
import { rectangleOutline, startPicking } from '../src/sketch/select';
import { sketchShapes } from '../src/sketch/reopen';
import { commitDimension, constraintEntries, solveShape, type Polygon } from '../src/sketch/rules';
import { xyPlane } from '../src/sketch/plane';

function authored(count: number): Polygon {
  let shape = rectangleOutline({ kind: 'rectangle', a: [-20, -20], b: [60, 20], ids: ['e1', 'e2', 'e3', 'e4'] });
  assert.ok(shape);
  for (const [key, value] of [['len0', 80], ['len1', 40]].slice(0, count) as [string, number][]) {
    const result = commitDimension(shape, key, value); assert.ok(result.ok); shape = result.shape;
  }
  return shape;
}
function finish(shape: Polygon): SketchNode {
  const result = profileOf([shape]); assert.ok('node' in result);
  return { ...result.node, id: 'n0' } as unknown as SketchNode;
}
const documentOf = (node: SketchNode): StudioDoc => ({ ...emptyDoc(), nodes: [node, { kind: 'extrude', id: 'n1', sketch: 0, height: 10 }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 });
async function codec(doc: StudioDoc): Promise<StudioDoc> {
  const decoded = await decodeStudioFile(encodeStudioFile(doc)), read = readStudioDoc(decoded.text);
  assert.ok('doc' in read); return read.doc;
}
function reopened(node: SketchNode, params: Record<string, number> = {}): Polygon {
  const initial = sketchShapes(node, params);
  const state = startPicking({ ...initial, plane: xyPlane(), tool: 'select', editNode: 0 }, 'select');
  assert.ok(state.shape?.kind === 'polygon'); return state.shape;
}
function checkLocks(shape: Polygon, count: number) {
  assert.equal(Object.keys(shape.lengths ?? {}).length, count);
  assert.equal(constraintEntries(shape).filter(row => row.label === 'Length').length, count);
  const solved = solveShape(shape); assert.ok(solved.ok); assert.equal(solved.dof, 2 - count);
}
for (const count of [0, 1, 2]) test(`compact rectangle codec/reopen retains exactly ${count} authored driving dimensions`, async () => {
  const before = authored(count), node = finish(before); assert.equal(node.profile, 'rectangle');
  const restored = (await codec(documentOf(node))).nodes[0] as SketchNode;
  const shape = reopened(restored); checkLocks(shape, count);
  assert.deepEqual(shape.points, before.points); assert.deepEqual(shape.ids, before.ids);
  assert.deepEqual(finish(shape), node, 'unchanged Finish retains compact native geometry and metadata');
  if (count === 0) assert.equal(restored.outline, undefined, 'legacy rectangle gains no locks or outline');
});

test('authored metadata does not change the compact rectangle kernel input or evaluated mesh', async () => {
  const node = finish(authored(2)), plain = { ...node }; delete plain.outline;
  const a = documentOf(node), b = documentOf(plain);
  assert.deepEqual(toPartDocument(a), toPartDocument(b), 'same rectangle profile, IDs and side tags reach native CAD');
  const x = await evaluateDoc(a, 1), y = await evaluateDoc(b, 2); assert.ok(x.ok && y.ok);
  assert.equal(x.bodies.length, 1); assert.ok(Math.abs(x.bodies[0].volume! - 32000) < 1e-8);
  assert.deepEqual(x.bodies[0].mesh, y.bodies[0].mesh);
});

for (const count of [0, 1, 2]) test(`rectangle Width/Depth/Corner field edits preserve ${count} authored locks through codec and reopen`, async () => {
  let doc = documentOf(finish(authored(count)));
  for (const [label, value] of [['Width', 60], ['Depth', 30], ['Corner X', -10], ['Corner Y', -5]] as [string, number][]) {
    const field = editFields(doc.nodes, 1, doc.parameters).find(field => field.label === label); assert.ok(field?.kind === 'number');
    doc = { ...doc, nodes: field.set(doc.nodes, value) };
    assert.equal(field.get(doc.nodes), value);
    doc = await codec(doc); const shape = reopened(doc.nodes[0] as SketchNode); checkLocks(shape, count);
    const node = doc.nodes[0] as Extract<SketchNode, { profile: 'rectangle' }>;
    assert.equal(node.profile, 'rectangle');
    const xs = shape.points.map(p => p[0]), ys = shape.points.map(p => p[1]);
    assert.deepEqual([Math.min(...xs), Math.min(...ys)], node.min); assert.deepEqual([Math.max(...xs), Math.max(...ys)], node.max);
    if (count > 0) assert.equal(shape.lengths?.[0], Number(node.max[0]) - Number(node.min[0]));
    if (count > 1) assert.equal(shape.lengths?.[1], Number(node.max[1]) - Number(node.min[1]));
    assert.deepEqual(finish(shape), node);
    const plain = { ...node }; delete plain.outline;
    assert.deepEqual(toPartDocument(doc), toPartDocument({ ...doc, nodes: [plain, doc.nodes[1]] }));
  }
});

test('rectangle width binding keeps authored locks and reopens at a later parameter value', async () => {
  let doc = documentOf(finish(authored(2))); doc.parameters = { W: 60 };
  const corner = editFields(doc.nodes, 1, doc.parameters).find(field => field.label === 'Corner X'); assert.ok(corner?.kind === 'number');
  doc = { ...doc, nodes: corner.set(doc.nodes, 0) };
  const field = editFields(doc.nodes, 1, doc.parameters).find(field => field.label === 'Width') as unknown as { bind(nodes: readonly ModelNode[], name: string): ModelNode[] | null };
  assert.ok(field); const bound = field.bind(doc.nodes, 'W'); assert.ok(bound, 'derived outline writes must not prevent the existing single-value binding');
  const stored = await codec({ ...doc, nodes: bound, parameters: { W: 50 } });
  const shape = reopened(stored.nodes[0] as SketchNode, stored.parameters); checkLocks(shape, 2);
  assert.equal(shape.lengths?.[0], 50, 'bound max X follows W with fixed min X=0');
  assert.deepEqual(shape.points, [[0, -20], [50, -20], [50, 20], [0, 20]]);
  const fields = editFields(stored.nodes, 1, stored.parameters);
  for (const label of ['Width', 'Length of edge 1']) {
    const field = fields.find(field => field.label === label); assert.ok(field?.kind === 'number');
    assert.equal(field.get(stored.nodes), 50, `${label} follows the current parameter and reopened geometry`);
  }
});

for (const points of [
  [[60, 20], [-20, 20], [-20, -20], [60, -20]],
  [[-20, -20], [-20, 20], [60, 20], [60, -20]],
] as [number, number][][]) test(`noncanonical rectangle outline order preserves its authored edge IDs (${points[1]})`, async () => {
  const shape: Polygon = { ...authored(0), points, ids: ['e11', 'e12', 'e13', 'e14'], hv: { h: points[0][1] === points[1][1] ? [0, 2] : [1, 3], v: points[0][0] === points[1][0] ? [0, 2] : [1, 3] }, lengths: { 0: Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) } };
  const node = finish(shape), restored = (await codec(documentOf(node))).nodes[0] as SketchNode;
  const next = reopened(restored); checkLocks(next, 1);
  assert.deepEqual(next.points, shape.points); assert.deepEqual(next.ids, shape.ids); assert.deepEqual(next.lengths, shape.lengths);
  assert.deepEqual(finish(next), node); assert.equal(node.profile, 'rectangle');
});


test('unchanged bounds preserve a typed decimal lock instead of remeasuring endpoint subtraction', async () => {
  const shape: Polygon = { ...authored(0), points: [[100, 0], [110.1, 0], [110.1, 40], [100, 40]], lengths: { 0: 10.1 } };
  const node = finish(shape), restored = (await codec(documentOf(node))).nodes[0] as SketchNode;
  const next = reopened(restored); assert.equal(next.lengths?.[0], 10.1);
  assert.notEqual(110.1 - 100, 10.1, 'independent represented-endpoint negative witness');
  assert.deepEqual(finish(next), node);
});


for (const route of ['Width', 'parameter']) test(`fractional ${route} edit maps rectangle endpoints to exact authoritative bounds`, async () => {
  const original: Polygon = { ...authored(0), points: [[0, 0], [1.1, 0], [1.1, 40], [0, 40]], lengths: { 0: 1.1, 1: 40 } };
  let doc = documentOf(finish(original));
  const field = editFields(doc.nodes, 1, doc.parameters).find(field => field.label === 'Width'); assert.ok(field?.kind === 'number');
  if (route === 'Width') doc = { ...doc, nodes: field.set(doc.nodes, 60.1) };
  else {
    const node = doc.nodes[0] as Extract<SketchNode, { profile: 'rectangle' }>;
    doc = { ...doc, parameters: { W: 60.1 }, nodes: [{ ...node, max: [{ parameter: 'W' }, 40] }, doc.nodes[1]] };
  }
  const read = await codec(doc), node = read.nodes[0] as SketchNode, shape = reopened(node, read.parameters);
  assert.notEqual(1.1 * 60.1 / 1.1, 60.1, 'negative witness for interpolation of an exact corner');
  assert.deepEqual(shape.points, [[0, 0], [60.1, 0], [60.1, 40], [0, 40]]);
  assert.equal(shape.lengths?.[0], 60.1); checkLocks(shape, 2);
  const finished = finish(shape) as Extract<SketchNode, { profile: 'rectangle' }>;
  assert.equal(finished.profile, 'rectangle'); assert.deepEqual(finished.max, [60.1, 40]);
  const plain = { ...finished }; delete plain.outline;
  assert.deepEqual(toPartDocument(documentOf(finished)), toPartDocument(documentOf(plain)));
  for (const label of ['Width', 'Length of edge 1']) {
    const current = editFields(read.nodes, 1, read.parameters).find(field => field.label === label); assert.ok(current?.kind === 'number');
    assert.equal(current.get(read.nodes), 60.1);
  }
});

test('raw feature authoring admits a canonical two-length rectangle and preserves decimal intent', async () => {
  const node = {
    kind: 'sketch', profile: 'rectangle', min: [100, -3.3], max: [110.1, 1.5],
    outline: { points: [[100, -3.3], [110.1, -3.3], [110.1, 1.5], [100, 1.5]], lengths: { 0: 10.1, 1: 4.8 }, hv: { h: [0, 2], v: [1, 3] } },
    sideTags: { outer: ['a'.repeat(32), 'side-b', 'side-c', 'side-d'] },
  } satisfies SketchNode;
  assert.notEqual(node.max[0] - node.min[0], node.outline.lengths[0], 'binary64 span differs from the authored decimal');
  assert.equal(checkNode(node, [], {}), null);
  const authoredNode = { ...node, id: 'n0' };
  const stored = await codec(documentOf(authoredNode));
  assert.deepEqual(stored.nodes[0], authoredNode);
  const shape = reopened(stored.nodes[0] as SketchNode);
  checkLocks(shape, 2);
  assert.deepEqual(shape.lengths, { 0: 10.1, 1: 4.8 });
  assert.deepEqual(shape.ids, node.sideTags.outer);

  const compact = { kind: 'sketch', profile: 'rectangle', min: node.min, max: [{ parameter: 'X' }, 1.5] };
  assert.equal(checkNode(compact, [], { X: 110.1 }), null);
  assert.equal(checkNode({ ...node, sideTags: undefined }, [], {}), null);
});

test('raw feature authoring refuses malformed or unsupported authored rectangle data', () => {
  const node = finish(authored(2));
  const outline = node.outline!;
  const sparse = [...outline.points];
  delete sparse[2];
  const cases: [string, unknown, RegExp][] = [
    ['nonstring kind', { ...node, kind: ['sketch'] }, /kind must be the string sketch/],
    ['wrong length', { ...node, outline: { ...outline, lengths: { 0: 81, 1: 40 } } }, /driving lengths must match/],
    ['missing length', { ...node, outline: { ...outline, lengths: { 0: 80 } } }, /edges 0 and 1/],
    ['extra length', { ...node, outline: { ...outline, lengths: { 0: 80, 1: 40, 2: 80 } } }, /edges 0 and 1/],
    ['duplicate axis edge', { ...node, outline: { ...outline, hv: { h: [0, 0], v: [1, 3] } } }, /horizontal edges/],
    ['skewed corner', { ...node, outline: { ...outline, points: [outline.points[0], [60, -19], ...outline.points.slice(2)] } }, /four rectangle corners/],
    ['sparse corner', { ...node, outline: { ...outline, points: sparse } }, /four rectangle corners/],
    ['noncanonical anchor', { ...node, outline: { ...outline, points: [...outline.points.slice(1), outline.points[0]] } }, /four rectangle corners/],
    ['extra member', { ...node, outline: { ...outline, rules: [] } }, /only points/],
    ['duplicate tag', { ...node, sideTags: { outer: ['a', 'b', 'c', 'a'] } }, /distinct identifiers/],
    ['overlong tag', { ...node, sideTags: { outer: ['a'.repeat(33), 'b', 'c', 'd'] } }, /distinct identifiers/],
    ['bad tag', { ...node, sideTags: { outer: ['a', 'b', 'c', 'x]'] } }, /distinct identifiers/],
    ['named bound', { ...node, min: [{ parameter: 'X' }, -20] }, /numeric min and max/],
    ['additional region', { ...node, regions: [] }, /default XY plane/],
    ['alternate plane', { ...node, plane: { origin: [0, 0, 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, /default XY plane/],
    ['nonrectangular outline', { kind: 'sketch', profile: 'polygon', points: outline.points, outline }, /unknown field "outline"/],
    ['nonfinite bound', { ...node, max: [Infinity, 20] }, /numeric min and max/],
    ['unordered bound', { ...node, max: [-21, 20] }, /numeric min and max/],
    ['outside solver envelope', { ...node, min: [10001, 0], max: [10081, 40], outline: { ...outline, points: [[10001, 0], [10081, 0], [10081, 40], [10001, 40]] } }, /valid numerical rectangle/],
  ];
  for (const [name, value, reason] of cases) assert.match(checkNode(value, [], { X: -20 }) ?? '', reason, name);
});
