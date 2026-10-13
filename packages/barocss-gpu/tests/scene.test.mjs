import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScene, SceneError } from '../dist/index.js';

const source = (body = 'sphere #ball; box #brick;', rules = '') => `@scene demo { version: 0; ${body} } ${rules}`;
const rejects = (input, pattern) => {
  assert.throws(() => parseScene(input), (error) => {
    assert.ok(error instanceof SceneError);
    assert.match(error.message, pattern);
    const [diagnostic] = error.diagnostics;
    assert.ok(diagnostic.start >= 0 && diagnostic.end >= diagnostic.start);
    assert.ok(diagnostic.line >= 1 && diagnostic.column >= 1);
    return true;
  });
};

test('version 0 parser applies independent defaults and full box extents', () => {
  const scene = parseScene(source());
  assert.equal(scene.name, 'demo');
  assert.equal(scene.version, 0);
  assert.deepEqual(scene.background, [16 / 255, 24 / 255, 32 / 255]);
  assert.deepEqual(scene.objects.map(({ id, type, radius, size }) => ({ id, type, radius, size })), [
    { id: 'ball', type: 'sphere', radius: 1, size: [2, 2, 2] },
    { id: 'brick', type: 'box', radius: 1, size: [2, 2, 2] },
  ]);
  assert.deepEqual(scene.objects[0].color, [224 / 255, 128 / 255, 64 / 255]);
});

test('empty scene and opaque hexadecimal background are valid', () => {
  assert.deepEqual(parseScene(source('background: #abc;')).background, [170 / 255, 187 / 255, 204 / 255]);
  assert.deepEqual(parseScene(source('background: #1234AB;')).objects, []);
});

test('ID specificity wins regardless of source order; equal specificity uses last declaration', () => {
  const scene = parseScene(source(undefined, '#ball { color: #f00; radius: 2; radius: 3; } sphere { color: #0f0; radius: 4; } #ball { translate: 1 -2 3; } box { size: 2 4 6; }'));
  assert.deepEqual(scene.objects[0].color, [1, 0, 0]);
  assert.equal(scene.objects[0].radius, 3);
  assert.deepEqual(scene.objects[0].translate, [1, -2, 3]);
  assert.deepEqual(scene.objects[1].size, [2, 4, 6]);
  assert.equal(parseScene(source('sphere #ball;', 'sphere { radius: 2; } sphere { radius: 3; }')).objects[0].radius, 3);
});

test('whitespace and bounded comments preserve source positions', () => {
  const scene = parseScene('/* start */\n@scene demo {\n version: 0; /* object */ sphere #ball;\n}\n#ball { translate: -0 +1e2 .5; }');
  assert.deepEqual(scene.objects[0].translate, [0, 100, 0.5]);
  try { parseScene('@scene demo {\n version: 0;\n invalid;\n}'); } catch (error) {
    assert.deepEqual(error.diagnostics[0], { message: 'Unsupported scene declaration', line: 3, column: 2, start: 28, end: 35 });
    return;
  }
  assert.fail('Expected diagnostic');
});

test('result is deterministic and frozen through nested scene data', () => {
  const first = parseScene(source());
  assert.deepEqual(first, parseScene(source()));
  for (const value of [first, first.background, first.objects, first.objects[0], first.objects[0].color, first.objects[0].size, first.objects[0].translate]) assert.ok(Object.isFrozen(value));
  assert.throws(() => { first.objects[0].radius = 900; }, TypeError);
});

test('duplicate IDs and scene metadata reject explicitly', () => {
  rejects(source('sphere #a; box #a;'), /Duplicate object ID/);
  rejects(source('version: 0;'), /Duplicate scene version/);
  rejects(source('background: #000; background: #fff;'), /Duplicate scene background/);
});

test('missing/nonzero versions and multiple scenes reject', () => {
  rejects('@scene demo { sphere #a; }', /requires version/);
  rejects('@scene demo { version: 1; }', /Only scene version 0|Expected scene version 0/);
  rejects('@scene demo { version: 0.0; }', /Only scene version 0|Expected scene version 0/);
  rejects(`${source('')} ${source('')}`, /selectors/);
});

test('unsupported scene, property, selector and unknown ID reject', () => {
  for (const [input, pattern] of [
    [source('cylinder #a;'), /Unsupported scene/],
    [source(undefined, 'sphere { opacity: 1; }'), /Unsupported style/],
    [source(undefined, '.ball { color: #fff; }'), /selectors/],
    [source(undefined, 'sphere:hover { color: #fff; }'), /selectors|Expected/],
    [source(undefined, 'sphere, box { color: #fff; }'), /selectors/],
    [source(undefined, '#absent { color: #fff; }'), /Unknown object ID/],
    [source(undefined, 'sphere box { color: #fff; }'), /Expected '\{'/],
    [source(undefined, '@import "https://example.test";'), /selectors/],
  ]) rejects(input, pattern);
});

test('shape-specific properties reject on inappropriate type and ID targets, even without instances', () => {
  for (const rule of ['box { radius: 1; }', '#brick { radius: 1; }', 'sphere { size: 1 2 3; }', '#ball { size: 1 2 3; }']) rejects(source(undefined, rule), /not supported/);
  rejects(source('', 'box { radius: 1; }'), /not supported/);
});

test('numeric boundaries accept 1000 and reject nonfinite, zero, negative and oversized geometry', () => {
  assert.equal(parseScene(source(undefined, 'sphere { radius: 1000; translate: -1000 0 1000; }')).objects[0].radius, 1000);
  for (const value of ['0', '-0', '-1', '1000.01', 'NaN', 'Infinity', '1e999', '1px', 'calc(1)']) rejects(source(undefined, `sphere { radius: ${value}; }`), /Dimension|finite numeric/);
  for (const value of ['-1000.1 0 0', '0 1001 0', 'NaN 0 0']) rejects(source(undefined, `sphere { translate: ${value}; }`), /Coordinate|finite numeric/);
  for (const value of ['1 0 1', '1 -1 1', '1 1001 1']) rejects(source(undefined, `box { size: ${value}; }`), /Dimension/);
});

test('value arity and opaque color restrictions reject unsupported syntax', () => {
  for (const rule of ['sphere { radius: 1 2; }', 'sphere { translate: 1 2; }', 'box { size: 1; }']) rejects(source(undefined, rule), /requires/);
  for (const color of ['red', '#abcd', '#12345678', 'rgb(1,2,3)', 'url(https://example.test)', '#12gggg', '#fff !important']) rejects(source(undefined, `sphere { color: ${color}; }`), /opaque/);
});

test('malformed input is never silently ignored', () => {
  for (const input of ['', '@scene demo { version: 0;', '@scene demo { version: 0 }', '@scene demo { version: 0; sphere ball; }', source(undefined, 'sphere { radius: 1 }'), source(undefined, 'sphere { radius 1; }'), `${source('')} unexpected`, '/* unterminated']) rejects(input, /Expected|selectors|Unterminated/);
  rejects(source('sphere #9bad;'), /identifier/);
  rejects('@scene 9bad { version: 0; }', /identifier/);
});

test('UTF-8 source byte limit includes comments and rejects oversized multibyte input', () => {
  const prefix = source('');
  const atLimit = prefix + ' '.repeat(65536 - new TextEncoder().encode(prefix).length);
  assert.equal(parseScene(atLimit).objects.length, 0);
  rejects(atLimit + ' ', /64 KiB/);
  rejects(`/*${'한'.repeat(22000)}*/${prefix}`, /64 KiB/);
});

test('object, rule and declaration limits have exact acceptance boundaries', () => {
  const objects = Array.from({ length: 32 }, (_, index) => `sphere #o${index};`).join(' ');
  assert.equal(parseScene(source(objects)).objects.length, 32);
  rejects(source(`${objects} box #extra;`), /32 objects/);
  const rules = 'sphere {}'.repeat(128);
  assert.equal(parseScene(source('sphere #a;', rules)).objects.length, 1);
  rejects(source('sphere #a;', rules + 'sphere {}'), /128 rules/);
  const declarations = 'radius: 1;'.repeat(512);
  assert.equal(parseScene(source('sphere #a;', `sphere {${declarations}}`)).objects[0].radius, 1);
  rejects(source('sphere #a;', `sphere {${declarations}radius: 1;}`), /512 total/);
});

test('non-string callers receive structured diagnostics', () => {
  for (const input of [null, undefined, {}, 3]) assert.throws(() => parseScene(input), SceneError);
});
