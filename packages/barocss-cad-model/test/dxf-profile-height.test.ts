import assert from 'node:assert/strict';
import test from 'node:test';
import { runDraftTool, withDrawingDraft } from '../src/chat/drafts';
import { emptyDoc } from '../src/engine/doc';
import { readDxfSketch } from '../src/sketch/dxfRead';

type Groups = (number | string)[];
const corners = [[0, 0], [20, 0], [20, 10], [0, 10]];
function rectangle(firstLine: Groups = []): Groups {
  return corners.flatMap(([x, y], i) => {
    const [xx, yy] = corners[(i + 1) % corners.length];
    return [0, 'LINE', 10, x, 20, y, 11, xx, 21, yy, ...(i === 0 ? firstLine : [])];
  });
}
const polyline = (groups: Groups = []): Groups => [0, 'LWPOLYLINE', 90, 4, 70, 1, ...groups,
  ...corners.flatMap(([x, y]) => [10, x, 20, y])];
function drawing(entities: Groups, units = 4): string {
  return [0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, units, 0, 'ENDSEC',
    0, 'SECTION', 2, 'ENTITIES', ...entities, 0, 'ENDSEC', 0, 'EOF', ''].join('\n');
}
const near = (value: number, expected: number) => assert.ok(Math.abs(value - expected) <= 1e-11 * Math.abs(expected));

test('the XY profile refuses LINE start or end height and signed LWPOLYLINE elevation', () => {
  const cases: [Groups, string, number][] = [
    [rectangle([30, 5, 31, 0]), 'LINE', 30],
    [rectangle([30, 0, 31, 5]), 'LINE', 31],
    [rectangle([30, 5, 31, 5]), 'LINE', 30],
    [rectangle([31, -5]), 'LINE', 31],
    [polyline([38, 5]), 'LWPOLYLINE', 38],
    [polyline([38, -5]), 'LWPOLYLINE', 38],
  ];
  for (const [entities, type, group] of cases) {
    const text = drawing(entities);
    assert.throws(() => readDxfSketch(text), { message: new RegExp(`^\\[DXF_UNSUPPORTED\\] a ${type} off the XY plane .*group ${group} `) });
  }
});

test('malformed height or extrusion fields refuse as input before adopting a draft', () => {
  const accepted = withDrawingDraft(emptyDoc(), drawing(rectangle()), 'Existing').doc;
  const original = JSON.stringify(accepted);
  for (const value of ['NaN', 'Infinity', '1e309', '', '0x0', 'not a coordinate']) {
    for (const group of [30, 31, 38, 230]) {
      const text = drawing(group === 38 ? polyline([group, value]) : rectangle([group, value]));
      const error = `[DXF_MALFORMED] ${group === 38 ? 'LWPOLYLINE' : 'LINE'} group ${group} needs a finite DXF real value`;
      assert.throws(() => withDrawingDraft(accepted, text, 'Bad'), { message: error });
      assert.deepEqual(runDraftTool(accepted, 'import_drawing', { dxf: text, name: 'Bad' }), { error });
      assert.equal(JSON.stringify(accepted), original);
    }
  }
});

test('omission, zero and the inclusive source-unit height threshold retain planar geometry', () => {
  for (const [units, to] of [[4, 1], [1, 25.4], [6, 1000]]) {
    const cases = [
      rectangle(), rectangle([30, 0, 31, '-0.0', 230, '1.']),
      rectangle([30, '-1E-9', 31, '+.000000001']),
      polyline(), polyline([38, 0]), polyline([38, -1e-9]),
    ];
    for (const entities of cases) {
      const result = readDxfSketch(drawing(entities, units));
      assert.equal(result.regions.length, 1);
      assert.equal(result.holes.length, 0);
      assert.deepEqual(result.regions[0].box, [0, 0, 20 * to, 10 * to]);
      near(result.regions[0].area, 200 * to ** 2);
    }
    for (const entities of [rectangle([31, 1.0000000000000003e-9]), polyline([38, -1.0000000000000003e-9])]) {
      assert.throws(() => readDxfSketch(drawing(entities, units)), { message: /^\[DXF_UNSUPPORTED\]/ });
    }
  }
});

test('the existing profile normal check retains +Z admission and -Z refusal', () => {
  for (const geometry of [rectangle, polyline]) {
    assert.equal(readDxfSketch(drawing(geometry([230, 1]))).regions[0].area, 200);
    assert.throws(() => readDxfSketch(drawing(geometry([230, -1]))), /DXF_UNSUPPORTED.*group 230/);
  }
});
