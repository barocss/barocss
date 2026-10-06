import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileCadModel } from '../dist/index.js';
const source = readFileSync(new URL('../../../examples/cad-nurbs/quarter-circle.css', import.meta.url), 'utf8');
const accepted = text => {const result=compileCadModel(text,{sourceVersion:0});assert.equal(result.ok,true,JSON.stringify(result.diagnostics));return result;};
const rejected = text => {const result=compileCadModel(text,{sourceVersion:0});assert.equal(result.ok,false);assert.ok(result.diagnostics.length);assert.deepEqual(compileCadModel(text,{sourceVersion:0}),result);return result.diagnostics[0];};
test('versioned model and source ranges use the unified compiler', () => {
  const compiled=accepted(source),model=compiled.model;assert.equal(model.lengthUnit,'mm');assert.equal(model.objects[0].id,'arc');
  assert.equal(compiled.ir.nodes[0].span.line,4);assert.equal(compiled.ir.nodes[0].span.column,3);
  assert.deepEqual(accepted(source),compiled);
  assert.equal(accepted(source.replace('@model','/* comment */ @model')).model.objects.length,1);
});
test('unsupported syntax and geometric invalid inputs have deterministic structured diagnostics', () => {
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
  for(const text of invalid){const first=rejected(text);assert.equal(first.severity,'error');assert.ok(first.range.line>=1);assert.ok(first.range.column>=1);}
  const body=source.slice(source.indexOf('  @curve'),source.lastIndexOf('}'));
  assert.equal(rejected(source.replace(body,body+body)).code,'DUPLICATE');
});
test('compiler source/declaration ceilings accept boundaries and reject excess', () => {
  assert.equal(accepted(source+' '.repeat(262144-Buffer.byteLength(source))).model.objects.length,1);
  assert.equal(rejected(source+' '.repeat(262145-Buffer.byteLength(source))).code,'LIMIT');
  assert.equal(rejected(source+'😀'.repeat(65536)).code,'LIMIT');
  const body=source.slice(source.indexOf('  @curve'),source.lastIndexOf('}'));
  const withCount=n=>source.slice(0,source.indexOf('  @curve'))+Array.from({length:n},(_,i)=>body.replace('#arc',`#arc${i}`)).join('')+'}';
  assert.equal(accepted(withCount(16)).model.objects.length,16);
  assert.equal(rejected(withCount(17)).code,'LIMIT');
  rejected(source.replace('[0,0,0,1,1,1]',`[${Array(71).fill(0)}]`));
});
