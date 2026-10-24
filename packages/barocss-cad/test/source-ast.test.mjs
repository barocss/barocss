import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCadAst, CadAstError, CAD_AST_LIMITS } from '../dist/language/source-ast.js';
import { compileCadModel } from '../dist/model-compiler.js';

const curve = '@curve #arc { type:nurbs; degree:2; knots:[0,0,0,1,1,1]; control-points:[[10,-0,0],[10,10,0],[0,10,0]]; weights:[1,.7071067811865476,1]; }';
const source0 = `/*😀*/\n@model example {\n  length-unit: mm;\n  ${curve}\n  version: 0;\n}`;
function coordinates(source, offset) { const rows = source.slice(0, offset).split('\n'); return { line: rows.length, column: rows.at(-1).length + 1 }; }
function assertRange(source, range, text) {
  assert.equal(source.slice(range.start, range.end), text);
  assert.deepEqual({ line: range.line, column: range.column }, coordinates(source, range.start));
  assert.deepEqual({ line: range.endLine, column: range.endColumn }, coordinates(source, range.end));
}
function plain(value) {
  if (value?.kind === 'array') return value.items.map(plain);
  if (value?.kind === 'reference') return value.id;
  return value.value;
}
test('actual UTF16 token/field/header/declaration ranges and binary64 negative zero survive parsing', () => {
  const ast = parseCadAst(source0, 0);
  assert.equal(ast.kind, 'model'); assert.equal(ast.name, 'example');
  assertRange(source0, ast.nameRange, 'example'); assertRange(source0, ast.range, source0.slice(source0.indexOf('@model')));
  assert.deepEqual(ast.fields.map((field) => field.name), ['length-unit', 'version']);
  const declaration = ast.declarations[0]; assertRange(source0, declaration.range, curve); assertRange(source0, declaration.idRange, '#arc');
  const fields = Object.fromEntries(declaration.fields.map((field) => [field.name, field]));
  assertRange(source0, fields.degree.nameRange, 'degree'); assertRange(source0, fields.degree.range, 'degree:2;'); assertRange(source0, fields.degree.value.range, '2');
  assertRange(source0, fields['control-points'].value.range, '[[10,-0,0],[10,10,0],[0,10,0]]');
  const negativeZero = fields['control-points'].value.items[0].items[1]; assert.ok(Object.is(negativeZero.value, -0)); assertRange(source0, negativeZero.range, '-0');
  assert.equal(fields.weights.value.items[1].value, 0.7071067811865476); assertRange(source0, fields.weights.value.items[1].range, '.7071067811865476');
  const compiled = compileCadModel(source0, { sourceVersion: 0 }); assert.equal(compiled.ok, true);
  assert.deepEqual(plain(fields.knots.value), compiled.model.objects[0].knots); assert.deepEqual(plain(fields['control-points'].value), compiled.model.objects[0].controlPoints);
});

test('forward v1 references, comment braces and actual source version fields remain AST data', () => {
  const source = '@model construction { version:1; length-unit:mm; @extrude #wall { vector:[3,-0,7]; curve: /* offset */ #arc; } ' + curve.replace('type:nurbs;', '/* { } */type:nurbs;') + '}';
  const ast = parseCadAst(source, 1); assert.deepEqual(ast.declarations.map((node) => node.kind), ['extrude', 'curve']);
  const field = ast.declarations[0].fields.find((field) => field.name === 'curve');
  assert.deepEqual({ kind: field.value.kind, id: field.value.id }, { kind: 'reference', id: 'arc' }); assertRange(source, field.value.range, '#arc');
  const vector = ast.declarations[0].fields[0].value; assert.ok(Object.is(vector.items[1].value, -0));
  assert.equal(ast.fields[0].value.value, 1);
  assert.equal(parseCadAst('@model x{version:9;length-unit:wrong;@curve #bad{degree:broken;}}', 0).fields[0].value.value, 9);
  assert.doesNotThrow(() => parseCadAst('@model x{version:1;length-unit:mm;@extrude #a{curve:#missing;vector:[0,0,0];}}', 1));
  const compiled = compileCadModel(source, { sourceVersion: 1 }); assert.equal(compiled.ok, true); const metadata = compiled.constructions[0]; assert.equal(field.value.range.start, metadata.referenceSpan.start); assert.equal(field.value.range.end, metadata.referenceSpan.end);
  const implementation = readFileSync(new URL('../src/language/source-ast.ts', import.meta.url), 'utf8'); const imports = [...implementation.matchAll(/^import(?! type).*from ['\"]([^'\"]+)['\"]/gm)].map(match => match[1]); assert.deepEqual(imports, ['./expression-parser.js', '../core/barocss-error.js'], 'AST parsing may import only its bounded expression parser (and the kernel\'s one error shape, R7.3a)');
});

test('direct v1 curve errors refer only to actual source and expose no partial model', () => {
  for (const [body, code, marker] of [
    ['type:nurbs;unsupported:0;', 'FIELD', 'unsupported'],
    ['type:nurbs;knots:[1,];', 'SYNTAX', ']'],
    ['type:nurbs;degree:1e2;', 'SYNTAX', 'e2'],
    ['type:nurbs;weights:[[1]];', 'DIMENSION', '[1]'],
    ['type:nurbs;degree:1;degree:2;', 'DUPLICATE', 'degree:2'],
  ]) {
    const source = '/*😀*/\n@model actual{version:1;length-unit:mm;@curve #bad {' + body + '}}';
    assert.throws(() => parseCadAst(source, 1), (error) => {
      assert.ok(error instanceof CadAstError); assert.equal(error.code, code); assert.equal(error.objectId, 'bad');
      assert.equal(error.range.start, source.indexOf(marker));
      assert.deepEqual({ line: error.range.line, column: error.range.column }, coordinates(source, source.indexOf(marker)));
      assert.deepEqual(Object.keys(error).sort(), ['code', 'detail', 'name', 'objectId', 'range'].sort());
      return true;
    });
  }
  const source = '@model x{version:1;@curve #a{bad:';
  assert.throws(() => parseCadAst(source, 1), (error) => error.code === 'FIELD' && error.range.start === source.indexOf('bad'));
  const earlierInvalid = `@model x{version:0;length-unit:mm;@curve #a{}@curve #b{unknown:0;}}`;
  assert.throws(() => parseCadAst(earlierInvalid, 0), (error) => error.code === 'FIELD' && error.objectId === 'b');
});

test('current grammar rejects exponents, commas, dimensions, foreign fields and duplicate IDs', () => {
  const cases = [
    ['@model x{version:0;degree:0;}', 'FIELD', 'degree'],
    ['@model x{version:0;version:0;}', 'DUPLICATE', 'version', true],
    ['@model x{version:0;@surface #s{weights:[[[1]]];}}', 'DIMENSION', '[1]'],
    ['@model x{version:0;@curve #a{knots:[0,];}}', 'SYNTAX', ']'],
    ['@model x{version:0;@curve #a{degree:1e3;}}', 'SYNTAX', 'e3'],
    ['@model x{version:0;@import #a{}}', 'KIND', '@import'],
    ['@model x{version:0;@curve #a{degree:1;degree:2;}}', 'DUPLICATE', 'degree:2'],
    ['@model x{/*unfinished', 'SYNTAX', '/*'],
    [`@model x{version:0;length-unit:mm;${curve}${curve}}`, 'DUPLICATE', '@curve', true],
  ];
  for (const [source, code, marker, last] of cases) {
    assert.throws(() => parseCadAst(source, 0), (error) => {
      assert.equal(error.code, code); assert.equal(error.range.start, last ? source.lastIndexOf(marker) : source.indexOf(marker)); return true;
    });
  }
});

test('maximum sixteen 16x16 surfaces fit source and explicitly proven AST/token/node limits', () => {
  const knots = [0, 0, 0, 0, 0, 0, ...Array.from({ length: 10 }, (_, i) => (i + 1) / 11), 1, 1, 1, 1, 1, 1];
  const points = Array.from({ length: 16 }, (_, u) => Array.from({ length: 16 }, (_, v) => [u, v, 0]));
  const weights = Array.from({ length: 16 }, () => Array(16).fill(1));
  const source = '@model maximum{version:0;length-unit:mm;' + Array.from({ length: 16 }, (_, i) => `@surface #s${i}{type:nurbs;degree-u:5;degree-v:5;knots-u:${JSON.stringify(knots)};knots-v:${JSON.stringify(knots)};control-points:${JSON.stringify(points)};weights:${JSON.stringify(weights)};}`).join('') + '}';
  // JSON emits exponent-free decimals for these specific bounded fixtures.
  assert.ok(Buffer.byteLength(source) <= 262144); const compiled = compileCadModel(source, { sourceVersion: 0 }); assert.equal(compiled.ok, true); assert.equal(compiled.model.objects.length, 16);
  const ast = parseCadAst(source, 0); let values = 0, records = 1 + ast.fields.length + ast.declarations.length;
  const count = (value) => { values++; if (value.kind === 'array') value.items.forEach(count); };
  ast.fields.forEach((f) => count(f.value)); for (const d of ast.declarations) { records += d.fields.length; d.fields.forEach((f) => count(f.value)); }
  assert.equal(values, 21810); assert.ok(values + records <= CAD_AST_LIMITS.nodes); assert.equal(CAD_AST_LIMITS.values, 65536); assert.equal(CAD_AST_LIMITS.tokens, 131072);
  const tokens = [...source.matchAll(/[A-Za-z_][A-Za-z0-9_-]*|[+-]?(?:\d+(?:\.\d*)?|\.\d+)|[@#{}\[\],:;]/g)].length;
  assert.equal(tokens, 43949); assert.ok(tokens < CAD_AST_LIMITS.tokens);
  console.log(JSON.stringify({ worstLegalSurfaceDeclarations: 16, valueNodes: values, records, totalNodes: values + records, tokens, sourceBytes: Buffer.byteLength(source), limits: CAD_AST_LIMITS }));
});

test('malicious allocation, declaration growth, byte overflow and deep arrays fail within bounds', () => {
  assert.throws(() => parseCadAst('@model x{version:0;@curve #a{knots:[' + Array(71).fill(0).join(',') + '];}}', 0), (e) => e.code === 'LIMIT');
  assert.throws(() => parseCadAst('@model x{version:0;@surface #a{control-points:' + '['.repeat(10000) + '0' + ']'.repeat(10000) + ';}}', 0), (e) => e.code === 'DIMENSION');
  assert.throws(() => parseCadAst('@model x{' + Array.from({ length: 17 }, (_, i) => `@curve #a${i}{}`).join('') + '}', 0), (e) => e.code === 'LIMIT');
  assert.throws(() => parseCadAst(' '.repeat(262145), 0), (e) => e.code === 'LIMIT' && e.range.start === 0);
  assert.throws(() => parseCadAst('/*' + '😀'.repeat(65536) + '*/', 0), (e) => e.code === 'LIMIT');
  assert.throws(() => parseCadAst(null, 0), TypeError); assert.throws(() => parseCadAst('', 4), TypeError);
});

test('fresh ASTs own source ranges and nested values independently', () => {
  const first = parseCadAst(source0, 0), second = parseCadAst(source0, 0); assert.deepEqual(first, second);
  const seen = new Set();
  function own(value) { if (value && typeof value === 'object') { assert.ok(!seen.has(value), 'AST nested occurrences must not alias'); seen.add(value); for (const item of Object.values(value)) own(item); } }
  own(first); first.declarations[0].fields[0].value.value = 'changed'; first.fields[0].range.start = 999; first.declarations[0].range.end = 999;
  assert.deepEqual(parseCadAst(source0, 0), second);
});

test('only actual UTF8 source bytes bound ASCII, astral and lone-surrogate comments', () => {
  const curveHead = '@curve #a{type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[1,0,0]];weights:[1,1];/*';
  const ending = '*/}}';
  function fullSource(header, comment) {
    const minimum = header + curveHead + comment + ending;
    return header + curveHead + comment + ' '.repeat(262144 - Buffer.byteLength(minimum)) + ending;
  }
  for (const comment of ['', '😀'.repeat(60000), '\ud800'.repeat(60000)]) {
    const missingMetadata = fullSource('@model x{', comment); assert.equal(Buffer.byteLength(missingMetadata), 262144);
    assert.equal(parseCadAst(missingMetadata, 1).declarations.length, 1);
    const missing = compileCadModel(missingMetadata, { sourceVersion: 1 }); assert.equal(missing.ok, false); assert.equal(missing.diagnostics[0].code, 'VERSION');
    const valid = fullSource('@model x{version:1;length-unit:mm;', comment); assert.equal(Buffer.byteLength(valid), 262144);
    assert.equal(parseCadAst(valid, 1).declarations.length, 1); assert.equal(compileCadModel(valid, { sourceVersion: 1 }).ok, true);
    assert.throws(() => parseCadAst(valid + ' ', 1), (error) => error.code === 'LIMIT' && error.range.start === 0);
  }
});
