import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseModel, CadSyntaxError } from '../dist/index.js';
const source = readFileSync(new URL('../../../examples/cad-nurbs/quarter-circle.css', import.meta.url), 'utf8');
test('versioned model and source spans', () => {
  const model = parseModel(source); assert.equal(model.lengthUnit, 'mm'); assert.equal(model.objects[0].id, 'arc');
  assert.equal(model.spans.arc.line, 4); assert.equal(model.spans.arc.column, 3);
  assert.deepEqual(parseModel(source), model);
  assert.equal(parseModel(source.replace('@model', '/* comment */ @model')).objects.length, 1);
});
test('unsupported syntax and geometric invalid inputs have stable diagnostics', () => {
  const invalid = [
    source.replace('version: 0', 'version: 1'), source.replace('length-unit: mm', 'length-unit: cm'),
    source.replace('degree: 2', 'degree: 0'), source.replace('degree: 2', 'degree: 6'),
    source.replace('knots: [0,0,0,1,1,1]', 'knots: [0,0,0,1,0,1]'),
    source.replace('weights: [1,0.7071067811865476,1]', 'weights: [1,0,1]'),
    source.replace('weights: [1,0.7071067811865476,1]', 'weights: [1,Infinity,1]'),
    source.replace('degree: 2', 'degree: NaN'), source.replace('degree: 2', 'degree: 2; degree: 2'),
    source.replace('type: nurbs', 'type: trimmed'), source.replace('degree: 2', 'import: url(x)'),
    source.replace('#arc', '#1bad'), source.replace('[[10,0,0]', '[[1000001,0,0]'),
    source.replace('degree: 2', 'degree: calc(1+1)'), source + '@model extra {}',
    source.replace('knots: [0,0,0,1,1,1]', 'knots: [[0],0,0,1,1,1]'),
    source.replace('degree: 2', 'degree: 2e0'), source + '/*',
  ];
  for (const text of invalid) {
    assert.throws(() => parseModel(text), CadSyntaxError);
    let first; try { parseModel(text); } catch(e) { first = e; }
    try { parseModel(text); } catch(e) { assert.equal(e.message, first.message); assert.ok(e.line >= 1); assert.ok(e.column >= 1); }
  }
  const body = source.slice(source.indexOf('  @curve'), source.lastIndexOf('}'));
  assert.throws(() => parseModel(source.replace(body, body + body)), /Duplicate ID/);
});
test('parser ceilings are checked at boundaries', () => {
  assert.equal(parseModel(source + ' '.repeat(262144 - Buffer.byteLength(source))).objects.length, 1);
  assert.throws(() => parseModel(source + ' '.repeat(262145 - Buffer.byteLength(source))), /LIMIT/);
  assert.throws(() => parseModel(source + '😀'.repeat(65536)), /LIMIT/);
  const body = source.slice(source.indexOf('  @curve'), source.lastIndexOf('}'));
  const withCount = n => source.slice(0, source.indexOf('  @curve')) + Array.from({length:n},(_,i)=>body.replace('#arc',`#arc${i}`)).join('') + '}';
  assert.equal(parseModel(withCount(16)).objects.length, 16);
  assert.throws(() => parseModel(withCount(17)), /LIMIT/);
  assert.throws(() => parseModel(source.replace('[0,0,0,1,1,1]', `[${Array(71).fill(0)}]`)), /LIMIT/);
});
