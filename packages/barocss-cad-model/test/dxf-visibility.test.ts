import assert from 'node:assert/strict';
import test from 'node:test';
import { runDraftTool } from '../src/chat/drafts';
import { emptyDoc, withNode } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import { readDxfSketch } from '../src/sketch/dxfRead';
import { readUnderlay } from '../src/sketch/dxfUnderlay';

type Groups = (number | string)[];
const outline = [0, 'LWPOLYLINE', 8, '0', 90, 4, 70, 1, 10, 0, 20, 0, 10, 20, 20, 0, 10, 20, 20, 10, 10, 0, 20, 10];
const circle = (x = 10, layer = 'Detail', ...visibility: Groups) => [0, 'CIRCLE', 8, layer, 10, x, 20, 5, 40, 2, ...visibility];
const layer = (name: string, flags: number | string, color = 7, plot = 1) =>
  [0, 'LAYER', 2, name, 70, flags, 62, color, 6, 'CONTINUOUS', 290, plot];
const block = (name: string, children: Groups, flags = 0, path = '') =>
  [0, 'BLOCK', 8, '0', 2, name, 70, flags, 10, 0, 20, 0, 1, path, ...children, 0, 'ENDBLK'];
const insert = (name: string, nameLayer = '0', x = 0) => [0, 'INSERT', 8, nameLayer, 2, name, 10, x, 20, 0];
const line = (nameLayer: string, ...visibility: Groups) => [0, 'LINE', 8, nameLayer, 10, 0, 20, 1, 11, 2, 21, 1, ...visibility];

function drawing(entities: Groups, layers?: Groups, blocks?: Groups): string {
  const tables = layers ? [0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, 4, ...layer('0', 0), ...layers, 0, 'ENDTAB', 0, 'ENDSEC'] : [];
  const blockSection = blocks ? [0, 'SECTION', 2, 'BLOCKS', ...blocks, 0, 'ENDSEC'] : [];
  return [...tables, ...blockSection, 0, 'SECTION', 2, 'ENTITIES', ...entities, 0, 'ENDSEC', 0, 'EOF', ''].join('\n');
}

test('off and frozen layers refuse affected entities and report exact counts', () => {
  for (const [flags, color, reason] of [[0, -7, 'layer is off'], [1, 7, 'layer is frozen'], [1, -7, 'layer is off, layer is frozen']] as const) {
    const text = drawing([...outline, ...circle(5), ...circle(15, 'DETAIL')], layer('Detail', flags, color));
    assert.throws(() => readDxfSketch(text), { message: `[DXF_UNSUPPORTED] drawing visibility cannot be preserved. 2 CIRCLE on layer "Detail" (${reason})` });
  }
});

test('entity invisibility and negative entity color reach the same typed draft refusal', () => {
  const accepted = runDraftTool(emptyDoc(), 'import_drawing', { dxf: drawing(outline), name: 'Existing drawing' });
  assert.ok('doc' in accepted);
  const doc = accepted.doc;
  const original = JSON.stringify(doc);
  for (const [visibility, reason] of [[[60, 1], 'entity is invisible'], [[62, -7], 'layer is off']] as const) {
    const text = drawing([...outline, ...circle(10, 'Detail', ...visibility)], layer('Detail', 0));
    const result = runDraftTool(doc, 'import_drawing', { dxf: text, name: 'Visibility' });
    assert.deepEqual(result, { error: `[DXF_UNSUPPORTED] drawing visibility cannot be preserved. 1 CIRCLE on layer "Detail" (${reason})` });
    assert.equal(JSON.stringify(doc), original);
  }
});

test('lock, new viewport defaults, nonplot, unused off layers and legacy input preserve profile geometry', () => {
  for (const layers of [layer('HIDDEN', 4), layer('HIDDEN', 2), layer('HIDDEN', 0, 7, 0), [...layer('HIDDEN', 0), ...layer('UNUSED', 1, -7)], undefined]) {
    const text = drawing([...outline, ...circle(10, 'HIDDEN', 60, 0, 102, '{APP', 60, 1, 102, '}')], layers);
    const sketch = readDxfSketch(text);
    assert.equal(sketch.regions[0].area, 200);
    assert.ok(Math.abs(sketch.holes[0].area - 4 * Math.PI) < 1e-9);
    const result = runDraftTool(emptyDoc(), 'import_drawing', { dxf: text, name: 'Visible' });
    assert.ok('doc' in result);
    const part = evaluatePart(withNode(result.doc, { kind: 'extrude', sketch: 0, height: 3 }), 1);
    assert.ok(part.ok);
    assert.ok(Math.abs((part.bodies[0].volume ?? 0) - (600 - 12 * Math.PI)) < 1e-7);
  }
});

test('legacy POLYLINE flags and VERTEX records retain the parent context', () => {
  const polyline: Groups = [0, 'POLYLINE', 8, 'Detail', 70, 1];
  for (const [x, y] of [[0, 0], [20, 0], [20, 10], [0, 10]]) {
    polyline.push(0, 'VERTEX', 8, '0', 70, 0, 10, x, 20, y);
  }
  polyline.push(0, 'SEQEND', 8, '0');
  assert.equal(readDxfSketch(drawing(polyline, layer('Detail', 0))).regions[0].area, 200);
  assert.throws(() => readDxfSketch(drawing(polyline, layer('Detail', 1))), /1 POLYLINE.*Detail.*frozen/);
});

test('ambiguous or malformed relevant state refuses before any draft result', () => {
  const cases: [Groups, Groups, RegExp][] = [
    [[], [...layer('Detail', 0), ...layer('DETAIL', 1)], /duplicate layer definition/],
    [[], layer('Detail', 'frozen'), /invalid layer flags or color/],
    [[], layer('Other', 0), /layer has no definition/],
    [[60, 2], layer('Detail', 0), /invalid entity visibility or color/],
    [[60, 0, 60, 1], layer('Detail', 0), /invalid entity visibility or color/],
  ];
  for (const [visibility, layers, reason] of cases) {
    const text = drawing([...outline, ...circle(10, 'Detail', ...visibility)], layers);
    assert.throws(() => readDxfSketch(text), { message: /^\[DXF_MALFORMED\].*Detail/ });
    assert.throws(() => readDxfSketch(text), reason);
  }
  assert.equal(readDxfSketch(drawing(outline, [...layer('Unused', 0), ...layer('unused', 1)])).regions.length, 1);
});

test('underlay checks hidden top-level and nested entities before publishing any geometry', () => {
  const layers = [...layer('Parent', 0), ...layer('Detail', 1)];
  const nested = [...block('Outer', insert('Inner', '0', 3)), ...block('Inner', line('Detail'))];
  const fixtures: [Groups, Groups | undefined, RegExp][] = [
    [[0, 'TEXT', 8, 'Detail', 10, 1, 20, 1, 40, 1, 1, 'Note'], undefined, /1 TEXT.*Detail.*frozen/],
    [[0, 'ELLIPSE', 8, 'Parent', 60, 1, 10, 1, 20, 1, 11, 1, 21, 0, 40, 0.5], undefined, /1 ELLIPSE.*Parent.*invisible/],
    [insert('Outer', 'Detail'), nested, /1 INSERT.*Detail.*frozen/],
    [insert('Outer', 'Parent'), nested, /1 LINE.*Detail.*frozen/],
    [insert('Outer', 'Parent'), [...block('Outer', insert('Inner')), ...block('Inner', line('0', 60, 1))], /1 LINE.*Parent.*invisible/],
  ];
  for (const [entity, blocks, reason] of fixtures) {
    const text = drawing([...outline, ...entity], layers, blocks);
    assert.throws(() => readUnderlay(text, 1), reason);
    assert.throws(() => readDxfSketch(text), { message: /^\[DXF_UNSUPPORTED\]/ });
  }
  const accepted = drawing([...outline, ...insert('Outer', 'Parent', 5)], layers,
    [...block('Outer', insert('Inner', '0', 3)), ...block('Inner', line('0'))]);
  assert.deepEqual(readDxfSketch(accepted).underlay.polylines, [[[8, 1], [10, 1]]]);
});

test('reachable external blocks are refused without loading paths; unused ones do not change the drawing', () => {
  for (const external of [block('External', line('0'), 4), block('External', line('0'), 0, 'other-drawing.dwg')]) {
    const blocks = [...block('Outer', insert('External')), ...external];
    assert.throws(() => readDxfSketch(drawing([...outline, ...insert('Outer')], undefined, blocks)),
      { message: /^\[DXF_UNSUPPORTED\].*INSERT.*external block.*External/ });
    assert.deepEqual(readDxfSketch(drawing(outline, undefined, blocks)).underlay.polylines, []);
  }
});
