import assert from 'node:assert/strict';
import test from 'node:test';
import { runDraftTool, withDrawingDraft } from '../src/chat/drafts';
import { emptyDoc } from '../src/engine/doc';
import { readDxfSketch } from '../src/sketch/dxfRead';
import { readUnderlay } from '../src/sketch/dxfUnderlay';

type Groups = (string | number)[];
type Vertex = [number, number, number?];
const types = ['LWPOLYLINE', 'POLYLINE'] as const;
function polyline(type: typeof types[number], vertices: Vertex[], closed = false): Groups {
  if (type === 'LWPOLYLINE') {
    return [0, type, 90, vertices.length, 70, +closed, ...vertices.flatMap(([x, y, g = 0]) => [10, x, 20, y, 42, g])];
  }
  return [0, type, 66, 1, 70, +closed, ...vertices.flatMap(([x, y, g = 0]) => [0, 'VERTEX', 10, x, 20, y, 42, g]), 0, 'SEQEND'];
}
const outline = polyline('LWPOLYLINE', [[0, 0], [20, 0], [20, 0], [20, 10], [0, 10]], true);
function drawing(entities: Groups, block?: Groups, transform: Groups = [10, 0, 20, 0], units = 4): string {
  const blocks = block ? [0, 'SECTION', 2, 'BLOCKS', 0, 'BLOCK', 2, 'DETAIL', 70, 0, 10, 0, 20, 0, ...block, 0, 'ENDBLK', 0, 'ENDSEC'] : [];
  const insert = block ? [0, 'INSERT', 2, 'DETAIL', ...transform] : [];
  return [0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, units, 0, 'ENDSEC', ...blocks,
    0, 'SECTION', 2, 'ENTITIES', ...entities, ...insert, 0, 'ENDSEC', 0, 'EOF', ''].join('\n');
}
const near = (actual: number, expected: number, epsilon = 1e-10) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('coincident endpoints are malformed for either polyline type, in profiles and blocks', () => {
  for (const type of types) for (const g of [1, -1, 1e-13]) {
    const malformed = polyline(type, [[30, 5, g], [30, 5]]);
    const wrap = polyline(type, [[30, 5], [32, 5], [30, 5, g]], true);
    for (const entity of [malformed, wrap]) {
      const message = `[DXF_MALFORMED] a ${type} bulge has coincident endpoints`;
      for (const entities of [[], outline]) {
        assert.throws(() => readDxfSketch(drawing([...entities, ...entity])), { message });
        assert.throws(() => readDxfSketch(drawing(entities, entity)), { message });
      }
      assert.throws(() => readUnderlay(drawing([], entity), 1), { message });
    }
  }
});

test('typed refusal leaves an accepted draft and underlay untouched', () => {
  const host = withDrawingDraft(emptyDoc(), drawing(outline, [0, 'LINE', 10, 0, 20, 0, 11, 4, 21, 0]), 'Accepted').doc;
  const before = JSON.stringify(host);
  for (const type of types) {
    const invalid = polyline(type, [[30, 5, 1], [30, 5]]);
    const error = `[DXF_MALFORMED] a ${type} bulge has coincident endpoints`;
    for (const input of [drawing([...outline, ...invalid]), drawing([], invalid)]) {
      assert.throws(() => withDrawingDraft(host, input, 'Invalid'), { message: error });
      assert.deepEqual(runDraftTool(host, 'import_drawing', { dxf: input, name: 'Invalid' }), { error });
      assert.equal(JSON.stringify(host), before);
    }
  }
});

test('ordinary and tiny positive chords retain signed semicircles across declared units', () => {
  for (const type of types) for (const g of [-1, 1]) for (const [units, radius, scale] of [[4, 3, 1], [4, 1e-6, 1], [1, 3, 25.4], [6, 3, 1000]]) {
    const profile = polyline(type, [[-radius, 0, g], [radius, 0]], true);
    const result = readDxfSketch(drawing(profile, undefined, undefined, units)).regions[0];
    const r = radius * scale, area = Math.PI * r ** 2 / 2;
    near(result.area, area, area * 1e-12);
    const arc = result.segments[0];
    assert.equal(arc.kind, 'arc');
    assert.equal(arc.direction, g > 0 ? 'ccw' : 'cw');
    near(Number(arc.center[0]), 0, r * 1e-12);
    near(Number(arc.center[1]), 0, r * 1e-12);
    const expected = g > 0 ? [-r, -r, r, 0] : [-r, 0, r, r];
    result.box.forEach((value, i) => near(value, expected[i], r * 1e-12));
  }
});

test('quarter circle, two-bulge hole and existing straight segment policy are retained', () => {
  for (const type of types) {
    const quarter = polyline(type, [[3, 0, Math.SQRT2 - 1], [0, 3]], true);
    near(readDxfSketch(drawing(quarter)).regions[0].area, 9 * (Math.PI / 4 - 1 / 2));
    for (const sign of [1, -1]) {
      const hole = polyline(type, [[12, 5, sign], [8, 5, sign]], true);
      const result = readDxfSketch(drawing([...outline, ...hole]));
      assert.equal(result.regions[0].area, 200);
      near(result.holes[0].area, 4 * Math.PI);
      near(result.holes[0].circle!.radius, 2);
    }
    const straight = polyline(type, [[0, 0, 1e-13], [20, 0], [20, 10], [0, 10]], true);
    assert.equal(readDxfSketch(drawing(straight)).regions[0].area, 200);
    const duplicate = polyline(type, [[0, 0], [0, 0]]);
    assert.throws(() => readDxfSketch(drawing(duplicate)), { message: /^\[DXF_EMPTY\]/ });
  }
});

test('transformed underlay retains signed shape and a below-gap positive chord', () => {
  for (const type of types) for (const sign of [-1, 1]) {
    const arc = polyline(type, [[0, 0, sign], [4, 0]]);
    const insert = [10, 10, 20, 20, 41, -2, 42, 3, 50, 90];
    const [points] = readDxfSketch(drawing([], arc, insert)).underlay.polylines;
    const [firstX, firstY] = points[0], [lastX, lastY] = points.at(-1)!;
    near(firstX, 10); near(firstY, 20); near(lastX, 10); near(lastY, 12);
    assert.ok(points.some(([x, y]) => Math.abs(x - (10 + 6 * sign)) < 1e-10 && Math.abs(y - 16) < 1e-10));
    for (const [x, y] of points) {
      const localX = (20 - y) / 2, localY = (10 - x) / 3;
      near((localX - 2) ** 2 + localY ** 2, 4);
      assert.ok(sign * localY <= 1e-10);
    }
    const tiny = polyline(type, [[-1e-9, 0, sign], [1e-9, 0]]);
    const [small] = readUnderlay(drawing([], tiny), 1).polylines;
    assert.ok(small.some(([x, y]) => Math.abs(x) < 1e-19 && Math.abs(y + sign * 1e-9) < 1e-19));
  }
});

test('nonfinite derived values and radius underflow are refused before returning a bulged result', () => {
  const type = 'LWPOLYLINE';
  const fixtures: [Vertex[], RegExp][] = [
    [[[-1e308, 0, 1], [1e308, 0]], /nonfinite chord/],
    [[[-1e300, 0, 1e-10], [1e300, 0]], /finite arc with positive radius/],
    [[[1.6e308, 0, -0.1], [1.6e308, 1e307]], /finite arc with positive radius/],
    [[[0, 0, 1], [Number.MIN_VALUE, 0]], /finite arc with positive radius/],
  ];
  for (const [vertices, reason] of fixtures) {
    const entity = polyline(type, vertices, true);
    assert.throws(() => readDxfSketch(drawing(entity)), reason);
    assert.throws(() => readUnderlay(drawing([], entity), 1), reason);
  }
  const enormous = polyline(type, [[-1e155, 0, 1], [1e155, 0]], true);
  assert.throws(() => readDxfSketch(drawing(enormous)), /\[DXF_MALFORMED\].*nonfinite area or bounds/);
  const finiteLocal = polyline(type, [[-4e307, 0, -1], [4e307, 0]]);
  assert.throws(() => readUnderlay(drawing([], finiteLocal, [10, 0, 20, 1.6e308]), 1), /\[DXF_MALFORMED\].*nonfinite underlay point/);
  const normal = polyline(type, [[-2, 0, 1], [2, 0]]);
  assert.throws(() => readUnderlay(drawing([], normal, [10, 0, 20, 0, 41, 1e155, 42, 1e155]), 1), /\[DXF_MALFORMED\].*invalid underlay scale/);
});
