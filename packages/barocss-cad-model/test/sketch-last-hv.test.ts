import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { emptyDoc, withNode, type SketchNode } from '../src/engine/doc';
import { profileOf } from '../src/sketch/loops';
import { sketchShapes } from '../src/sketch/reopen';
import { constraintEntries, removeConstraint, solveShape, type Polygon } from '../src/sketch/rules';
import { settleShape } from '../src/sketch/settle';

const horizontal: Polygon['points'] = [[0, 0], [40, 0], [36, 21], [3, 23]];
const vertical: Polygon['points'] = [[0, 0], [0, 40], [-21, 36], [-23, 3]];
const both: Polygon['points'] = [[0, 0], [40, 0], [40, 21], [3, 23]];
const neither: Polygon['points'] = [[0, 0], [40, 1], [36, 21], [3, 23]];
const empty = { h: [], v: [] };

function close(points: Polygon['points']): Polygon {
  const open: Polygon = { kind: 'polygon', closed: false, points, bulges: [0, 0, 0, 0] };
  const result = settleShape({ ...open, closed: true }, open);
  assert.equal(result.error, null);
  assert.ok(result.shape?.kind === 'polygon');
  return result.shape;
}

function finish(shape: Polygon): SketchNode {
  const result = profileOf([shape]);
  assert.ok('node' in result);
  return result.node;
}

function reopen(node: SketchNode): Polygon {
  const result = sketchShapes(node);
  assert.ok(result.shape?.kind === 'polygon');
  return result.shape;
}

function constraints(shape: Polygon, ids: string[], dof: number) {
  assert.deepEqual(constraintEntries(shape).map(entry => entry.id), ['anchor', ...ids]);
  const result = solveShape(shape);
  assert.ok(result.ok);
  assert.equal(result.dof, dof);
}

for (const { points, relation } of [
  { points: horizontal, relation: 'h:0' },
  { points: vertical, relation: 'v:0' },
]) {
  test(`D747: removing the last ${relation} survives Finish, file load and a second Finish`, async () => {
    const start = close(points);
    // Four 2D vertices, two anchor equations and one independent axis equation.
    constraints(start, [relation], 5);
    const removed = removeConstraint(start, relation);
    constraints(removed, [], 6);
    const node = finish(removed);
    assert.equal(node.profile, 'polygon');
    assert.deepEqual(node.points, points);
    assert.deepEqual(node.outline?.hv, empty);
    assert.deepEqual(node.sideTags, finish(start).sideTags);

    const doc = withNode(withNode(emptyDoc(), node), { kind: 'extrude', sketch: 0, height: 8 });
    const read = await readStudioFile(encodeStudioFile(doc));
    assert.ok('doc' in read);
    assert.deepEqual(read.doc, doc);
    const reopened = reopen(read.doc.nodes[0] as SketchNode);
    constraints(reopened, [], 6);
    assert.deepEqual(finish(reopened), node);
  });
}

test('D747: deleting relations one at a time keeps the remaining relation and its rank', () => {
  const start = close(both);
  constraints(start, ['h:0', 'v:1'], 4);
  const one = reopen(finish(removeConstraint(start, 'h:0')));
  constraints(one, ['v:1'], 5);
  assert.deepEqual(one.hv, { h: [], v: [1] });
  const none = reopen(finish(removeConstraint(one, 'v:1')));
  constraints(none, [], 6);
  assert.deepEqual(none.hv, empty);
  assert.deepEqual(none.points, both);
});

test('D747: an explicit dimension and fixed point survive deletion of the last H/V', () => {
  const start: Polygon = { ...close(horizontal), lengths: { 0: 40 }, rules: [{ kind: 'fix', point: 2, at: [36, 21] }] };
  const node = finish(removeConstraint(start, 'h:0'));
  assert.deepEqual(node.outline?.lengths, start.lengths);
  assert.deepEqual(node.outline?.rules, start.rules);
  const reopened = reopen(node);
  constraints(reopened, ['len:0', 'rule:0'], 3);
  assert.deepEqual(reopened.hv, empty);
  assert.deepEqual(reopened.points, horizontal);
});

test('D747: explicit empty intent and omitted legacy intent keep distinct meanings', () => {
  const aligned: SketchNode = { kind: 'sketch', profile: 'polygon', points: horizontal };
  const legacy = reopen(aligned);
  assert.equal(legacy.hv, undefined);
  assert.equal(finish(legacy).outline, undefined);
  constraints(legacy, ['h:0'], 5);
  const explicit = reopen({ ...aligned, outline: { points: horizontal, hv: empty } });
  constraints(explicit, [], 6);
  assert.deepEqual(finish(explicit).outline?.hv, empty);

  const unaligned = reopen(finish(close(neither)));
  constraints(unaligned, [], 6);
  assert.deepEqual(unaligned.hv, empty);
  assert.deepEqual(unaligned.points, neither);
});

test('D747: ordinary Rectangle-tool outlines keep their compact, undimensioned form', () => {
  const points: Polygon['points'] = [[0, 0], [40, 0], [40, 21], [0, 21]];
  const node = finish({ ...close(points), fromRectangle: true });
  assert.equal(node.profile, 'rectangle');
  assert.equal(node.outline, undefined);
  assert.deepEqual(node.min, [0, 0]);
  assert.deepEqual(node.max, [40, 21]);
});
