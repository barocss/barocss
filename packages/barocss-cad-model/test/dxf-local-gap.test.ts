import assert from 'node:assert/strict';
import test from 'node:test';
import { runDraftTool } from '../src/chat/drafts';
import { emptyDoc } from '../src/engine/doc';
import { isRefusal } from '../src/engine/refusal';
import { readDxfSketch } from '../src/sketch/dxfRead';

type Point = readonly [number, number];
type Entity = (number | string)[];
const T = 2 ** 20;
const line = (a: Point, b: Point): Entity => [0, 'LINE', 10, a[0], 20, a[1], 11, b[0], 21, b[1]];
const circle = (c: Point, r: number): Entity => [0, 'CIRCLE', 10, c[0], 20, c[1], 40, r];
const arc = (c: Point, r: number, from: number, to: number): Entity => [0, 'ARC', 10, c[0], 20, c[1], 40, r, 50, from, 51, to];
const dxf = (entities: Entity[], unit = 4) => [
  0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, unit, 0, 'ENDSEC',
  0, 'SECTION', 2, 'ENTITIES', ...entities.flat(), 0, 'ENDSEC', 0, 'EOF', '',
].join('\n');

function rectangle(gap: Point, x = 0, y = 0, factor = 1, internal = false): Entity[] {
  const map = (p: Point): Point => [(p[0] + x) / factor, (p[1] + y) / factor];
  const a: Point = [0, 0], b: Point = [20, 0], c: Point = [20, 10], d: Point = [0, 10];
  const startOfSecond: Point = internal ? [b[0] + gap[0], b[1] + gap[1]] : b;
  return [line(map(a), map(b)), line(map(startOfSecond), map(c)), line(map(c), map(d)), line(map(d), map(internal ? a : gap))];
}
const refusesOpen = (text: string) => assert.throws(() => readDxfSketch(text), error => isRefusal(error, 'DXF_OPEN'));

test('translated DXF profiles retain encoded closure and unrelated geometry cannot admit an open gap', () => {
  const accepted = runDraftTool(emptyDoc(), 'import_drawing', { name: 'closed', dxf: dxf(rectangle([0, 0])) });
  assert.ok(!('error' in accepted));
  const original = structuredClone(accepted.doc);
  for (const x of [0, T, -T]) {
    const source = dxf(rectangle([0, 0], x, x));
    const closed = readDxfSketch(source);
    assert.equal(closed.regions.length, 1);
    assert.equal(closed.regions[0].area, 200);
    assert.deepEqual(closed.regions[0].box, [x, x, x + 20, x + 10]);
    assert.equal(closed.holes.length, 0);
    const open = rectangle([0, 0.125], x, x);
    const unrelated = circle([T * 2, -10], 1);
    for (const entities of [open, [...open, unrelated], [unrelated, ...open.slice().reverse()]]) {
      const text = dxf(entities);
      refusesOpen(text);
      const failed = runDraftTool(accepted.doc, 'import_drawing', { name: 'open', dxf: text });
      assert.ok('error' in failed);
      assert.match(failed.error, /^\[DXF_OPEN\]/);
      assert.deepEqual(accepted.doc, original);
    }
  }
});

test('DXF endpoint connections use the same inclusive physical distance for the final and internal joins', () => {
  const inside = 2 ** -20, outside = 2 ** -19;
  for (const x of [0, T, -T]) for (const internal of [false, true]) {
    for (const gap of [[inside, 0], [0, inside]] as const) {
      assert.equal(readDxfSketch(dxf(rectangle(gap, x, x, 1, internal))).regions[0].area, 200);
    }
    for (const gap of [[outside, 0], [0, outside], [inside, inside]] as const) {
      refusesOpen(dxf(rectangle(gap, x, x, 1, internal)));
    }
  }
  assert.equal(readDxfSketch(dxf(rectangle([0, 1e-6]))).regions[0].area, 200);
  refusesOpen(dxf(rectangle([0, 1.00001e-6])));
  for (const [unit, factor] of [[4, 1], [1, 25.4], [6, 1000]]) {
    assert.equal(readDxfSketch(dxf(rectangle([0, inside], 0, 0, factor), unit)).regions[0].area, 200);
    refusesOpen(dxf(rectangle([0, outside], 0, 0, factor), unit));
  }
});

test('duplicate and branching DXF connections produce a typed refusal', () => {
  const edges = rectangle([0, 0]);
  for (const extra of [edges[1], line([20, 0], [23, 5]), line([0, 0], [-1, 1])]) {
    assert.throws(() => readDxfSketch(dxf([...edges, extra])), error => isRefusal(error, 'DXF_OPEN') && /ambiguous connections/.test(error.message));
    refusesOpen(dxf([extra, ...edges.slice().reverse()]));
  }
});

function bulges(x: number, first: number, second: number): Entity {
  return [0, 'LWPOLYLINE', 90, 2, 70, 1, 10, x - 4, 20, 0, 42, first, 10, x + 4, 20, 0, 42, second];
}

test('DXF round recognition uses each original radius and center and retains reverse arcs', () => {
  const mixedSweep = 4 * Math.atan(7 / 8);
  const mixedArea = 8 * Math.PI + 0.5 * (113 / 28) ** 2 * (mixedSweep - Math.sin(mixedSweep));
  for (const x of [0, T, -T]) {
    const mixed = readDxfSketch(dxf([bulges(x, 1, 7 / 8), circle([T * 2, -10], 1)])).regions[0];
    assert.equal(mixed.circle, undefined);
    assert.ok(Math.abs(mixed.area - mixedArea) < 1e-8);
    assert.ok(Math.abs(mixed.box[3] - mixed.box[1] - 7.5) < 1e-8);
    assert.deepEqual(mixed.segments.map(s => s.kind === 'arc' && s.direction), ['ccw', 'ccw']);
    for (const sign of [1, -1]) {
      const closed = readDxfSketch(dxf([bulges(x, sign, sign)])).regions[0];
      assert.ok(closed.circle);
      assert.ok(Math.hypot(closed.circle.center[0] - x, closed.circle.center[1]) < 1e-9);
      assert.equal(closed.circle.radius, 4);
      assert.ok(Math.abs(closed.area - 16 * Math.PI) < 1e-8);
      assert.deepEqual(closed.segments.map(s => s.kind === 'arc' && s.direction), Array(2).fill(sign > 0 ? 'ccw' : 'cw'));
    }
    const distinct = readDxfSketch(dxf([arc([x, 0], 4, 0, 180), arc([x, 0], 4 + 5e-7, 180, 360)])).regions[0];
    assert.equal(distinct.circle, undefined);
    assert.equal(distinct.segments.length, 2);
  }
  const reversed = readDxfSketch(dxf([line([-4, 0], [4, 0]), arc([0, 0], 4, 180, 360)])).regions[0];
  assert.equal(reversed.segments[1].kind === 'arc' && reversed.segments[1].direction, 'cw');
  assert.ok(Math.abs(reversed.area - 8 * Math.PI) < 1e-9);
});
