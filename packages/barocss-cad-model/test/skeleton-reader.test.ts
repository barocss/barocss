import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { evaluatePart } from '../src/engine/evaluate';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { emptyDirect, geometryOf, importSource } from '../src/engine/direct';
import { loadDirect } from '../src/engine/directModule';
import { createRouteBundle, routeBundleDocumentIdentity } from '../src/engine/routeBundle';

function document(node: unknown, schema = 3) { return { ...emptyDoc(), schema, nodes: [{ id: 'n7', ...node as object }], nextId: 9 }; }
const one: Extract<ModelNode, { kind: 'skeleton' }> = { kind: 'skeleton', name: 'datum', points: [[1, 2, 3]], segments: [] };

test('latest skeleton reader preserves single-point, empty-segment and constrained drafts in schema 3', async () => {
  for (const constraints of [undefined, [], [{ kind: 'fixed', point: 0, at: [1, 2, 3] }], [{ kind: 'on-axis', point: 0, axis: { origin: [1, 2, 3], direction: [1, 0, 0] } }], [{ kind: 'on-plane', point: 0, plane: { origin: [1, 2, 3], normal: [0, 0, 1] } }]]) {
    const input = document({ ...one, ...(constraints === undefined ? {} : { constraints }) }), text = JSON.stringify(input);
    const read = readStudioDoc(text); assert.ok('doc' in read, JSON.stringify(read));
    assert.deepEqual(read.doc.nodes, input.nodes); assert.equal(read.doc.nextId, 9); assert.equal(read.doc.schema, 3);
    assert.deepEqual(read.notes, []); assert.equal(JSON.stringify(input), text);
    const opened = await readStudioFile(encodeStudioFile(read.doc)); assert.ok('doc' in opened, JSON.stringify(opened));
    assert.deepEqual(opened.doc, read.doc);
    const evaluated = evaluatePart(opened.doc, 1); assert.ok(evaluated.ok, evaluated.ok ? '' : evaluated.error.detail); assert.equal(evaluated.bodies.length, 0);
  }
});

test('a skeleton on an actual schema 4 route bundle survives the reader and codec without changing either contract', async () => {
  await loadDirect();
  const source = `@model bundle { version: 0; length-unit: mm;
    @curve #A { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[-2,0,0],[-2,0,10],[-2,0,20],[-2,0,30]]; weights: [1,1,1,1]; }
    @curve #B { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[2,0,0],[2,0,10],[2,0,20],[2,0,30]]; weights: [1,1,1,1]; } }`;
  const direct = importSource(emptyDirect(), source, 'bundle');
  let doc: StudioDoc = { ...emptyDoc(), direct };
  for (const [i, object] of direct.objects.entries()) {
    const curve = geometryOf(direct, object); assert.ok(curve.kind === 'curve');
    doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [i ? 2 : -2, 0], radius: 0.5 });
    doc = withNode(doc, { kind: 'sweep-curve', sketch: 2 * i, name: object.name, path: { degree: curve.degree, knots: [...curve.knots], controlPoints: curve.controlPoints.map(p => [p[0], p[1], p[2]]), weights: [...curve.weights] } });
  }
  doc = withNode(doc, { ...one, id: 'n7', constraints: [{ kind: 'fixed', point: 0, at: [1, 2, 3] }] } as ModelNode);
  const input = createRouteBundle(doc, { id: 'bundle1', tieId: 'tie1', anchorMM: [0, 0, 10], expectedDocumentIdentity: routeBundleDocumentIdentity(doc), members: [
    { id: 'A', curveObjectId: direct.objects[0].id, handleKey: '1', sweepFeatureId: 'n1', profileFeatureId: 'n0' },
    { id: 'B', curveObjectId: direct.objects[1].id, handleKey: '1', sweepFeatureId: 'n3', profileFeatureId: 'n2' },
  ] });
  assert.equal(input.schema, 4);
  const read = readStudioDoc(JSON.stringify(input)); assert.ok('doc' in read, JSON.stringify(read));
  const opened = await readStudioFile(encodeStudioFile(read.doc)); assert.ok('doc' in opened, JSON.stringify(opened));
  assert.deepEqual(opened.doc, input); assert.equal(opened.doc.schema, 4);
});

test('reader preserves parameter coordinates and bound constraints without solving or rewriting authored points', () => {
  for (const node of [
    { ...one, points: [[{ parameter: 'X' }, 2, 3]] },
    { ...one, points: [[{ parameter: 'X' }, 2, 3]], constraints: [] },
    { ...one, points: [[1, 2, 3], [1, 2, 3]], segments: [[0, 0], [0, 1]] },
    { kind: 'skeleton', points: [[0, 0, 0], [3, 0, 0]], segments: [[0, 1]], constraints: [{ kind: 'length', segment: 0, value: { parameter: 'L' } }] },
  ]) {
    const input = { ...document(node), parameters: { X: 1, L: 5 } }, read = readStudioDoc(JSON.stringify(input));
    assert.ok('doc' in read, JSON.stringify(read)); assert.deepEqual(read.doc.nodes, input.nodes);
  }
});

test('reader refuses malformed skeleton structure, nested vectors, indices and bindings before evaluation', () => {
  const bad = [
    { ...one, points: null }, { ...one, points: [[1, 2]] }, { ...one, points: [[null, 2, 3]] },
    { ...one, points: [[{ parameter: 'missing' }, 2, 3]] }, { ...one, segments: null }, { ...one, segments: [[0, 1]] },
    { ...one, points: [[{ parameter: 'toString' }, 2, 3]] },
    { ...one, segments: [[0, -1]] }, { ...one, segments: [[0, 0.5]] }, { ...one, constraints: [null] },
    { ...one, constraints: [{ kind: 'unknown' }] }, { ...one, constraints: [{ kind: 'fixed', point: 1 }] },
    { ...one, constraints: [{ kind: 'fixed', point: 0, at: [1, 2] }] },
    { ...one, constraints: [{ kind: 'on-axis', point: 0, axis: 'q' }] },
    { ...one, constraints: [{ kind: 'on-axis', point: 0, axis: { origin: [0, 0, 0], direction: [0, 0, 0] } }] },
    { ...one, constraints: [{ kind: 'on-plane', point: 0, plane: { origin: [0, 0, 0], normal: [0, 0, 0] } }] },
    { ...one, constraints: [{ kind: 'on-plane', point: 0, plane: { origin: [0, 0, 0], normal: [Number.MAX_VALUE, Number.MAX_VALUE, 0] } }] },
    { ...one, constraints: [{ kind: 'length', segment: 0, value: { parameter: 'missing' } }] },
    { ...one, points: [[{ parameter: 'X' }, 2, 3]], constraints: [{ kind: 'fixed', point: 0 }] },
    { ...one, constraints: [{ kind: 'along', segment: 0, axis: [0, 0, 0] }] },
    { ...one, constraints: [{ kind: 'along', segment: 0, axis: 'q' }] },
  ];
  for (const node of bad) {
    const text = JSON.stringify(document(node)), read = readStudioDoc(text);
    assert.ok('error' in read, text); assert.match(read.error, /skeleton/i);
  }
});

test('reader checks every constraint shape without solving redundant or conflicting authored constraints', () => {
  const constraints = [
    { kind: 'coincident', a: 0, b: 1 }, { kind: 'fixed', point: 0 }, { kind: 'length', segment: 0, value: 1 },
    { kind: 'distance', a: 0, b: 1, value: 1 }, { kind: 'angle', a: 0, b: 1, degrees: 90 },
    { kind: 'parallel', a: 0, b: 1 }, { kind: 'perpendicular', a: 0, b: 1 },
    { kind: 'on-axis', point: 0, axis: 'x' }, { kind: 'along', segment: 0, axis: [2, 0, 0] },
    { kind: 'on-plane', point: 0, plane: { origin: [0, 0, 0], normal: [0, 0, 2] } },
  ];
  const node = { kind: 'skeleton', points: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], segments: [[0, 1], [1, 2]], constraints };
  const input = document(node), read = readStudioDoc(JSON.stringify(input));
  assert.ok('doc' in read, JSON.stringify(read)); assert.deepEqual(read.doc.nodes, input.nodes);
  for (const constraint of [{ kind: 'length', segment: 0, value: -1 }, { kind: 'distance', a: 0, b: 0, value: 1 }, { kind: 'angle', a: 0, b: 1, degrees: 180 }, { kind: 'parallel', a: 0, b: 9 }, { kind: 'length', segment: 0, value: { parameter: 'constructor' } }]) {
    const bad = readStudioDoc(JSON.stringify(document({ ...node, constraints: [constraint] })));
    assert.ok('error' in bad); assert.match(bad.error, /skeleton/i);
  }
});

test('reader preserves forward follower indices and cached geometry, and rejects mixed skeleton references', () => {
  const frame = { kind: 'frame', id: 'n5', follows: { skeleton: 1 }, points: [[99, 99, 99]], segments: [] };
  const input = { ...document(one), nodes: [frame, { ...one, id: 'n7' }] }, read = readStudioDoc(JSON.stringify(input));
  assert.ok('doc' in read, JSON.stringify(read)); assert.deepEqual(read.doc.nodes, input.nodes);
  for (const follows of [{ skeleton: -1 }, { skeleton: 99 }, { skeleton: 1, part: 'missing', sketch: 'x' }]) {
    const bad = readStudioDoc(JSON.stringify({ ...input, nodes: [{ ...frame, follows }, input.nodes[1]] }));
    assert.ok('error' in bad); assert.match(bad.error, /follows.skeleton/);
  }
  const noCache = { ...frame } as Record<string, unknown>; delete noCache.segments;
  const missing = readStudioDoc(JSON.stringify({ ...input, nodes: [noCache, input.nodes[1]] }));
  assert.ok('error' in missing); assert.match(missing.error, /saved points and segments arrays/);
  for (const segments of [[[0, 1]], [{ from: 0, to: 1, through: 2 }], [{ from: 0, to: 1, center: [50, 50, 50] }]]) {
    const cached = { ...frame, points: [[99, 99, 99], [100, 99, 99], [100, 100, 99]], segments };
    const stored = { ...input, nodes: [cached, input.nodes[1]] }, opened = readStudioDoc(JSON.stringify(stored));
    assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc.nodes, stored.nodes);
  }
  for (const patch of [{ points: [[null, 0, 0]] }, { segments: [[0, 9]] }, { segments: [{ from: 0, to: 0, through: 9 }] }, { segments: [{ from: 0, to: 0, center: [0, 0] }] }]) {
    const bad = readStudioDoc(JSON.stringify({ ...input, nodes: [{ ...frame, ...patch }, input.nodes[1]] }));
    assert.ok('error' in bad); assert.match(bad.error, /following a skeleton/);
  }
  const badNested = readStudioDoc(JSON.stringify({ ...emptyDoc(), instances: [{ id: 'p1', doc: document({ ...one, segments: [[0, 2]] }) }] }));
  assert.ok('error' in badNested); assert.match(badNested.error, /skeleton/);
});

test('skeleton Save/Open keeps IDs and shared frame followers, then a public edit updates their independent A times L volumes', async () => {
  const skeleton = { kind: 'skeleton' as const, id: 'n7', points: [[0, 0, 0], [100, 0, 0]] as [number, number, number][], segments: [[0, 1]] as [number, number][] };
  let doc: StudioDoc = { ...emptyDoc(), nodes: [skeleton], nextId: 8 };
  for (const width of [10, 20]) doc = withNode(doc, { kind: 'frame', follows: { skeleton: 0 }, points: structuredClone(skeleton.points), segments: structuredClone(skeleton.segments), section: { kind: 'rect-tube', width, height: width, wall: 1, outerRadius: 0 }, corners: { default: 'none' } });
  const read = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in read, JSON.stringify(read));
  assert.deepEqual(read.doc.nodes, doc.nodes); assert.equal(read.doc.nextId, doc.nextId);
  const result = evaluatePart(read.doc, 1); assert.ok(result.ok, result.ok ? '' : result.error.detail); assert.equal(result.bodies.length, 2);
  for (const [i, width] of [10, 20].entries()) assert.ok(Math.abs(result.bodies[i].volume! - (width ** 2 - (width - 2) ** 2) * 100) < 1e-8);
  const state: ChatState = { doc: read.doc, bodies: result.bodies };
  const edited = await dispatchTool(state, 'edit_feature', { index: 0, values: { 'p1.x': 150 } }, async d => evaluatePart(d, 2));
  assert.equal(edited.isError, false, edited.content); assert.equal(edited.state.doc.nodes[0].id, 'n7');
  for (const [i, width] of [10, 20].entries()) assert.ok(Math.abs(edited.state.bodies[i].volume! - (width ** 2 - (width - 2) ** 2) * 150) < 1e-8);
});
