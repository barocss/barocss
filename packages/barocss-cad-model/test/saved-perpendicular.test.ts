import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeStudioFile, encodeStudioSnapshot, readStudioFile, readStudioSnapshot } from '../src/engine/container';
import { emptyDirect, importSource } from '../src/engine/direct';
import { emptyDoc, withNode, type ModelNode, type SketchOutline, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { createRouteBundle, routeBundleDocumentIdentity, type CreateRouteBundleMemberInput } from '../src/engine/routeBundle';
import { profileOf } from '../src/sketch/loops';
import { sketchShapes } from '../src/sketch/reopen';
import { solveShape, type Polygon } from '../src/sketch/rules';
import { snapshotKeyOf } from '../src/versions/log';

function part(a: number, b: number): StudioDoc {
  const shape: Polygon = {
    kind: 'polygon', closed: true, points: [[0, 0], [20, 0], [20, 10], [0, 10]],
    bulges: [0, Math.tan(Math.PI / 8), 0, 0], hv: { h: [], v: [] }, rules: [{ kind: 'perpendicular', a, b }],
  };
  const built = profileOf([shape]);
  assert.ok('node' in built);
  return withNode(withNode(emptyDoc(), built.node), { kind: 'extrude', sketch: 0, height: 6 });
}

function routed(part: StudioDoc): StudioDoc {
  const curve = (id: string, x: number) => `@curve #${id} { type:nurbs; degree:3; knots:[0,0,0,0,1,1,1,1]; control-points:[[ ${x},0,0],[ ${x},0,10],[ ${x},0,20],[ ${x},0,30]]; weights:[1,1,1,1]; }`;
  const direct = importSource(emptyDirect(), `@model routes { version:0; length-unit:mm; ${curve('a', -2)} ${curve('b', 2)} }`, 'routes');
  const base: StudioDoc = { ...emptyDoc(), direct, nextId: 4, nodes: [-2, 2].flatMap((x, i): ModelNode[] => [
    { kind: 'sketch', id: `n${2 * i}`, profile: 'circle', center: [x, 0], radius: 0.5 },
    { kind: 'sweep-curve', id: `n${2 * i + 1}`, sketch: 2 * i, name: `route ${i}`, path: {
      degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: [[x, 0, 0], [x, 0, 10], [x, 0, 20], [x, 0, 30]], weights: [1, 1, 1, 1],
    } },
  ]) };
  const member = (geometry: string, i: number): CreateRouteBundleMemberInput => ({
    id: `member${i}`, curveObjectId: direct.objects.find(object => object.geometry === geometry)!.id,
    handleKey: '1', sweepFeatureId: `n${2 * i + 1}`, profileFeatureId: `n${2 * i}`,
  });
  const owner = createRouteBundle(base, { id: 'bundle1', tieId: 'tie1', anchorMM: [0, 0, 10],
    expectedDocumentIdentity: routeBundleDocumentIdentity(base), members: [member('a', 0), member('b', 1)],
  });
  const [sketch, extrude] = part.nodes;
  assert.equal(extrude.kind, 'extrude');
  return withNode(withNode(owner, { ...sketch, id: 'n4' }), { ...extrude, id: 'n5', sketch: 4 });
}

const message = (feature: number) => `[BAD_REFERENCE] Sketch ${feature}, perpendicular constraint 1 needs two different straight edges.`;

test('raw and native schema 3 and genuine schema 4 refuse a saved perpendicular arc reference', async () => {
  const invalid = part(0, 1);
  for (const [doc, feature] of [[invalid, 1], [routed(invalid), 5]] as const) {
    const source = structuredClone(doc);
    const bytes = encodeStudioFile(doc), retained = bytes.slice();
    assert.deepEqual(readStudioDoc(JSON.stringify(doc)), { error: message(feature) });
    assert.deepEqual(await readStudioFile(bytes), { error: message(feature) });
    assert.deepEqual(doc, source);
    assert.deepEqual(bytes, retained);
    const key = snapshotKeyOf(doc);
    assert.throws(() => encodeStudioSnapshot(doc, key), /snapshot document is not admitted.*BAD_REFERENCE/);
    const snapshot = await readStudioSnapshot(bytes, key);
    assert.ok('error' in snapshot);
    assert.match(snapshot.error, /snapshot document is not admitted.*BAD_REFERENCE/);
  }
});

test('two straight sides in a mixed outline preserve the rule and exact saved coordinates', async () => {
  const ordinary = part(0, 3);
  for (const doc of [ordinary, routed(ordinary)]) {
    const bytes = encodeStudioFile(doc);
    const read = await readStudioFile(bytes);
    assert.ok('doc' in read, JSON.stringify(read));
    assert.deepEqual(encodeStudioFile(read.doc), bytes);
    const node = read.doc.nodes[doc.schema === 4 ? 4 : 0];
    assert.equal(node.kind, 'sketch');
    const shape = sketchShapes(node).shape;
    assert.ok(shape?.kind === 'polygon');
    assert.deepEqual(shape.rules, [{ kind: 'perpendicular', a: 0, b: 3 }]);
    const solved = solveShape(shape);
    assert.ok(solved.ok);
    assert.equal(solved.rank, 4);
    assert.equal(solved.dof, 6);
  }
});

test('stored references must be distinct integer indices and straight in both representations', () => {
  for (const [a, b] of [[1, 0], [0, 0], [-1, 0], [0, 4], [0, 2.5], [0, '3']]) {
    const doc = part(a as number, b as number);
    assert.deepEqual(readStudioDoc(JSON.stringify(doc)), { error: message(1) });
  }
  const mixed = part(0, 1);
  const node = mixed.nodes[0];
  assert.ok(node.kind === 'sketch' && node.profile === 'loop');
  node.outline!.bulges = [0, 0, 0, 0];
  assert.deepEqual(readStudioDoc(JSON.stringify(mixed)), { error: message(1) });
  node.segments[1] = { kind: 'line', start: [20, 0] };
  node.outline!.bulges = [0, Math.tan(Math.PI / 8), 0, 0];
  assert.deepEqual(readStudioDoc(JSON.stringify(mixed)), { error: message(1) });
});

test('ordinary polygon and rectangle recipes keep valid straight-edge references', async () => {
  const points: [number, number][] = [[0, 0], [20, 0], [20, 10], [0, 10]];
  const outline: SketchOutline = { points, hv: { h: [], v: [] }, rules: [{ kind: 'perpendicular', a: 0, b: 3 }] };
  for (const node of [
    { kind: 'sketch', profile: 'polygon', points, outline },
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10], outline },
  ] satisfies ModelNode[]) {
    const doc = withNode(emptyDoc(), node);
    const bytes = encodeStudioFile(doc), key = snapshotKeyOf(doc);
    const opened = await readStudioFile(bytes);
    assert.ok('doc' in opened);
    assert.deepEqual(opened.doc, doc);
    const snapshot = await readStudioSnapshot(encodeStudioSnapshot(doc, key), key);
    assert.ok('doc' in snapshot);
    assert.deepEqual(snapshot.doc, doc);
  }
});
