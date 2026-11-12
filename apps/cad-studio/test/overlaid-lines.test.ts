import test from 'node:test';
import assert from 'node:assert/strict';
import type { SketchShape } from '@barocss/cad-model/sketch/types';
import { findOverlaidLines, OVERLAID_LINE_RESULT_LIMIT, OVERLAID_LINE_SCAN_LIMIT } from '../src/sketch/overlaidLines';

const line = (a: [number, number], b: [number, number], id?: string): Extract<SketchShape, { kind: 'polygon' }> =>
  ({ kind: 'polygon', points: [a, b], closed: false, ...(id ? { ids: [id] } : {}) });

test('exact reversed and signed-zero endpoints keep separate source occurrences', () => {
  const shapes = [
    line([-0, 0], [10, 0], 'e1'),
    line([10, 0], [0, 0], 'e1'),
    line([0, 0], [10, 0]),
    line([5, 0], [15, 0]),
    line([0, 0], [10, 0.000001]),
    line([10, 0], [20, 0]),
    line([5, -5], [5, 5]),
    line([10, 10], [10, 10]),
    line([1, 2], [Infinity, 3]),
    { ...line([0, 0], [10, 0]), bulges: [1, 0] },
    { ...line([0, 0], [10, 0]), construction: true as const },
  ];
  const before = structuredClone(shapes);
  const report = findOverlaidLines(shapes);
  assert.equal(report.status, 'complete');
  assert.deepEqual(report.groups, [[
    { shape: 0, side: 0, id: 'e1', start: [-0, 0], end: [10, 0] },
    { shape: 1, side: 0, id: 'e1', start: [10, 0], end: [0, 0] },
    { shape: 2, side: 0, id: undefined, start: [0, 0], end: [10, 0] },
  ]]);
  assert.equal(report.checked, 7);
  assert.equal(report.excludedSegments, 3);
  assert.equal(report.excludedShapes, 1);
  assert.deepEqual(shapes, before);
});

test('rectangle sides keep authored positions and only a closed polygon contributes its closing side', () => {
  const rect: SketchShape = { kind: 'rectangle', a: [0, 0], b: [10, 10], ids: ['bottom', 'right', 'top', 'left'] };
  const neighbor: SketchShape = { kind: 'rectangle', a: [10, 0], b: [20, 10], ids: ['bottom2', 'right2', 'top2', 'left2'] };
  const report = findOverlaidLines([rect, neighbor]);
  assert.equal(report.status, 'complete');
  assert.deepEqual(report.groups, [[
    { shape: 0, side: 1, id: 'right', start: [10, 0], end: [10, 10] },
    { shape: 1, side: 3, id: 'left2', start: [10, 10], end: [10, 0] },
  ]]);
  const duplicate = findOverlaidLines([rect, { kind: 'rectangle', a: [10, 10], b: [0, 0] }]);
  assert.equal(duplicate.status, 'complete');
  assert.equal(duplicate.groups.length, 4);
  const triangle = { kind: 'polygon' as const, closed: false, points: [[0, 0], [5, 6], [10, 0]] as [number, number][] };
  const straight = line([0, 0], [10, 0]);
  const open = findOverlaidLines([triangle, straight]);
  const closed = findOverlaidLines([{ ...triangle, closed: true }, straight]);
  assert.equal(open.status, 'complete');
  assert.equal(closed.status, 'complete');
  assert.deepEqual(open.groups, []);
  assert.equal(closed.groups[0][0].side, 2);
});

test('curved and unfinished input and both limits report their exact scope', () => {
  const source = line([0, 0], [10, 0]);
  const report = findOverlaidLines([
    { ...source, circles: [{ c: [1, 1], r: 1 }] }, { ...source, fromSpline: true }, { ...source, fromEllipse: true },
    { kind: 'circle', c: [0, 0], r: 3 }, { kind: 'slot', a: [0, 0], b: [10, 0], r: 3 },
    { kind: 'bezier', poles: [[0, 0], [5, 6], [10, 0]] },
  ]);
  assert.deepEqual(report, { status: 'complete', groups: [], checked: 1, excludedShapes: 6, excludedSegments: 0 });
  assert.deepEqual(findOverlaidLines([source, { ...source, pending: true }]), { status: 'unfinished' });
  assert.deepEqual(findOverlaidLines(Array.from({ length: OVERLAID_LINE_RESULT_LIMIT + 1 }, () => source)), { status: 'result-limit' });
  assert.deepEqual(findOverlaidLines(Array.from({ length: OVERLAID_LINE_SCAN_LIMIT + 1 }, () => source)), { status: 'scan-limit' });
  const long: SketchShape = { kind: 'polygon', closed: false, points: Array.from({ length: OVERLAID_LINE_SCAN_LIMIT + 1 }, (_, i) => [i, 0]) };
  assert.deepEqual(findOverlaidLines([long]), { status: 'scan-limit' });
});
