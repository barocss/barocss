import assert from 'node:assert/strict';
import test from 'node:test';
import type { SketchNode } from '@barocss/cad-model/engine/doc';
import { xyPlane } from '@barocss/cad-model/sketch/plane';
import { commitDimension, type Polygon } from '@barocss/cad-model/sketch/rules';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { studioSketchViewportActions } from '../src/viewport/studioSketchViewportActions';

function fixture() {
  const source: Polygon = {
    kind: 'polygon', closed: true,
    points: [[0, 0], [4, 0], [130.35031249999975, 20.484104353190723]],
    hv: { h: [], v: [] }, lengths: { 1: 128, 2: 131.95 },
    rules: [{ kind: 'fix', point: 1, at: [4, 0] }], ids: ['e1', 'e2', 'e3'],
  };
  const node = {
    kind: 'sketch', profile: 'polygon', points: source.points,
    outline: { points: source.points, hv: source.hv, lengths: source.lengths, rules: source.rules },
    sideTags: { outer: source.ids! },
  } satisfies SketchNode;
  const sketch: SketchState = { shape: source, tool: 'select', plane: xyPlane(), editNode: 0, editDim: 'len2' };
  return { source, node, sketch };
}

function commit(source: Polygon, sketch: SketchState | null, storedSketch?: SketchNode, live: SketchShape = source, value = 124.05, recoveredLengths = new WeakSet<Polygon>()) {
  const shapes: (SketchShape | null)[] = [], errors: string[] = [], drafts: (SketchState | null)[] = [];
  const actions = studioSketchViewportActions({
    liveShape: { current: live }, sketch, currentSketchSource: () => drafts.length === 0 && storedSketch ? { source: storedSketch, recoveredLengths } : undefined,
    updateShape: shape => { shapes.push(shape); },
    setSketch: setter => { drafts.push(typeof setter === 'function' ? setter(sketch) : setter); },
    setSketchError: reason => { errors.push(reason); }, setLengthConflict: reason => { errors.push(reason); }, trimSketch: () => undefined,
  });
  actions.onDimCommit?.('len2', value, source);
  return { shapes, errors, drafts };
}

test('inline recovery publishes the verified literal main outline once', () => {
  const { source, node, sketch } = fixture();
  const result = commit(source, sketch, node);
  assert.equal(result.shapes.length, 1);
  const next = result.shapes[0];
  assert.ok(next?.kind === 'polygon');
  assert.equal(next.lengths?.[2], 124.05);
  assert.deepEqual(next.points.slice(0, 2), source.points.slice(0, 2));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.drafts, [{ ...sketch, editDim: null }]);
});

test('unowned, parameter-valued and multi-shape drafts retain the original one-shot result', () => {
  const { source, node, sketch } = fixture();
  const ordinary = commitDimension(source, 'len2', 124.05);
  assert.ok(!ordinary.ok);
  const named: SketchNode = { ...node, points: [[{ parameter: 'X' }, 0], node.points[1], node.points[2]] };
  const other = { ...node, sideTags: { outer: ['other1', 'other2', 'other3'] } };
  const differentNativePoints: SketchNode = { ...node, points: [[0, 1], node.points[1], node.points[2]] };
  const differentOutlinePoints: SketchNode = { ...node, outline: { ...node.outline, points: [[0, 1], node.points[1], node.points[2]] } };
  const changedRecipe = { ...source, points: [[0, 0], [4, 0], [130.35031249999975, 20.48410435]] } satisfies Polygon;
  const withConstruction = { ...node, construction: [{ kind: 'circle', c: [0, 5], r: 1, construction: true }] };
  const beside: SketchState = { ...sketch, done: [{ kind: 'circle', c: [0, 5], r: 1 }] };
  for (const [draft, raw] of [[sketch, undefined], [sketch, named], [sketch, other], [sketch, differentNativePoints], [sketch, differentOutlinePoints],
    [sketch, withConstruction], [beside, node]] as const) {
    const result = commit(source, draft, raw);
    assert.deepEqual(result.shapes, []);
    assert.deepEqual(result.errors, [ordinary.reason]);
  }
  const changed = commit(changedRecipe, { ...sketch, shape: changedRecipe }, node);
  assert.deepEqual(changed.shapes, []);
  assert.deepEqual(changed.errors, [ordinary.reason]);
  const stale = commit(source, sketch, node, { ...source });
  assert.deepEqual(stale, { shapes: [], errors: [], drafts: [] });
});

test('only exact verified descendants can recover another length in the same edit session', () => {
  const { source, node, sketch } = fixture();
  const recoveredLengths = new WeakSet<Polygon>();
  const first = commit(source, sketch, node, source, 124.05, recoveredLengths).shapes[0];
  assert.ok(first?.kind === 'polygon' && recoveredLengths.has(first));
  const reversed = commit(first, { ...sketch, shape: first }, node, first, 131.95, recoveredLengths);
  const next = reversed.shapes[0];
  assert.ok(next?.kind === 'polygon' && recoveredLengths.has(next));
  assert.equal(next.lengths?.[2], 131.95);
  assert.deepEqual(next.points.slice(0, 2), source.points.slice(0, 2));
  const clone = { ...first };
  for (const rejected of [
    commit(first, { ...sketch, shape: first }, node, first, 131.95),
    commit(clone, { ...sketch, shape: clone }, node, clone, 131.95, recoveredLengths),
    commit(first, { ...sketch, shape: first, done: [{ kind: 'circle', c: [0, 5], r: 1 }] }, node, first, 131.95, recoveredLengths),
  ]) {
    assert.deepEqual(rejected.shapes, []);
    assert.equal(rejected.errors.length, 1);
  }
});
