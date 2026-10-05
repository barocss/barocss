import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CadSyntaxError, compileConstruction, parseModel, evaluateCurve, evaluateSurface,
  surfaceDomain, tessellateSurface, validatePreviewPacket, exportIGES,
} from '../dist/index.js';

const curveBody = (id = 'arc') => `@curve #${id} {
  type: nurbs;
  degree: 2;
  knots: [0,0,0,1,1,1];
  control-points: [[10,0,0],[10,10,0],[0,10,0]];
  weights: [1,0.7071067811865476,1];
}`;
const extrudeBody = (id = 'wall', input = 'arc', vector = '[0,0,30]') => `@extrude #${id} {
  curve: #${input};
  vector: ${vector};
}`;
const modelSource = (...declarations) => `@model extrusion {
  version: 1;
  length-unit: mm;
  ${declarations.join('\n  ')}
}`;
const source = modelSource(curveBody(), extrudeBody());
const position = (text, start, end) => {
  const lines = text.slice(0, start).split('\n');
  return { start, end, line: lines.length, column: lines.at(-1).length + 1 };
};
function syntaxFailure(text) {
  let first;
  assert.throws(() => compileConstruction(text), error => {
    first = error;
    assert.ok(error instanceof CadSyntaxError);
    assert.equal(typeof error.code, 'string');
    assert.ok(error.code.length > 0);
    assert.ok(Number.isInteger(error.offset) && error.offset >= 0 && error.offset <= text.length);
    const expected = position(text, error.offset, error.offset);
    assert.equal(error.line, expected.line);
    assert.equal(error.column, expected.column);
    return true;
  });
  assert.throws(() => compileConstruction(text), error => {
    assert.equal(error.message, first.message);
    assert.equal(error.code, first.code);
    assert.equal(error.offset, first.offset);
    return true;
  });
  return first;
}
function pointClose(actual, expected) {
  assert.equal(actual.length, 3);
  assert.ok(Math.hypot(...actual.map((value, axis) => value - expected[axis])) <= 1e-9,
    `Point ${actual} differs from ${expected}`);
}

test('construction entry explicitly separates source v1, canonical v0 and unchanged legacy parser', () => {
  const compiled = compileConstruction(source);
  assert.equal(compiled.sourceVersion, 1);
  assert.equal(compiled.model.version, 0);
  assert.equal(compiled.model.name, 'extrusion');
  assert.equal(compiled.model.lengthUnit, 'mm');
  assert.deepEqual(compiled.model.objects.map(({ id, kind }) => [id, kind]), [['arc', 'curve'], ['wall', 'surface']]);
  assert.equal(compiled.constructions.length, 1);
  assert.throws(() => parseModel(source), CadSyntaxError);
  const legacy = modelSource(curveBody()).replace('version: 1', 'version: 0');
  assert.equal(parseModel(legacy).version, 0);
  syntaxFailure(legacy);
  syntaxFailure(source.replace('version: 1', 'version: 2'));
  syntaxFailure(source.replace('version: 1;', ''));
  syntaxFailure(source.replace('length-unit: mm;', ''));
  assert.throws(() => compileConstruction(null), TypeError);
}) ;

test('extrusion lineage retains independent exact declaration and reference source spans', () => {
  const compiled = compileConstruction(source);
  const item = compiled.constructions[0];
  const start = source.indexOf('@extrude');
  const reference = source.indexOf('#arc', start);
  assert.equal(item.outputId, 'wall');
  assert.equal(item.inputId, 'arc');
  assert.equal(item.operation, 'extrude');
  assert.deepEqual(item.vector, [0, 0, 30]);
  assert.deepEqual(item.span, position(source, start, source.indexOf('}', start) + 1));
  assert.deepEqual(item.referenceSpan, position(source, reference, reference + 4));
  assert.equal(source.slice(item.span.start, item.span.end), extrudeBody());
  assert.equal(source.slice(item.referenceSpan.start, item.referenceSpan.end), '#arc');
  assert.deepEqual(compileConstruction(source), compiled);
  const withComments = source.replace('@extrude', '/* feature */\n  @extrude');
  const shifted = compileConstruction(withComments).constructions[0];
  assert.equal(shifted.span.start, withComments.indexOf('@extrude'));
  assert.equal(shifted.span.line, item.span.line + 1);
});

test('forward curve references resolve with source declaration order and independent output arrays', () => {
  const forward = modelSource(extrudeBody('first'), curveBody(), extrudeBody('second', 'arc', '[1,2,3]'));
  const compiled = compileConstruction(forward);
  assert.deepEqual(compiled.model.objects.map(object => object.id), ['first', 'arc', 'second']);
  assert.deepEqual(compiled.constructions.map(item => item.outputId), ['first', 'second']);
  const [first, curve, second] = compiled.model.objects;
  assert.equal(first.kind, 'surface');
  assert.equal(curve.kind, 'curve');
  assert.deepEqual(first.knotsU, curve.knots);
  assert.notEqual(first.knotsU, curve.knots);
  assert.notEqual(first.knotsU, second.knotsU);
  for (let index = 0; index < curve.controlPoints.length; index++) {
    assert.deepEqual(first.controlPoints[index], [curve.controlPoints[index],
      [curve.controlPoints[index][0], curve.controlPoints[index][1], 30]]);
    assert.notEqual(first.controlPoints[index][0], curve.controlPoints[index]);
    assert.notEqual(first.controlPoints[index][0], first.controlPoints[index][1]);
    assert.notEqual(first.weights[index], second.weights[index]);
  }
  const original = compileConstruction(forward);
  first.controlPoints[0][0][0] = -400;
  first.weights[0][0] = 25;
  first.knotsU[0] = -10;
  compiled.constructions[0].vector[0] = 50;
  compiled.constructions[0].span.start = 0;
  assert.deepEqual(curve, original.model.objects[1]);
  assert.deepEqual(second, original.model.objects[2]);
  assert.deepEqual(compileConstruction(forward), original);
  assert.equal(forward, modelSource(extrudeBody('first'), curveBody(), extrudeBody('second', 'arc', '[1,2,3]')));
});

test('constructed rational geometry, explicit IGES selection and preview retain distinct versions/IDs', () => {
  const { model, constructions } = compileConstruction(source);
  const [curve, surface] = model.objects;
  assert.equal(surface.degreeU, 2);
  assert.equal(surface.degreeV, 1);
  assert.deepEqual(surface.knotsV, [0, 0, 1, 1]);
  assert.deepEqual(surface.weights, curve.weights.map(weight => [weight, weight]));
  assert.deepEqual(surfaceDomain(surface), { u: [0, 1], v: [0, 1] });
  for (let i = 0; i < 17; i++) for (let j = 0; j < 9; j++) {
    const u = i / 16;
    const v = j / 8;
    const point = evaluateSurface(surface, u, v);
    const curvePoint = evaluateCurve(curve, u);
    pointClose(point, [curvePoint[0], curvePoint[1], 30 * v]);
    const w = Math.sqrt(0.5);
    const denominator = (1 - u) ** 2 + 2 * w * u * (1 - u) + u ** 2;
    pointClose(point, [10 * ((1 - u) ** 2 + 2 * w * u * (1 - u)) / denominator,
      10 * (u ** 2 + 2 * w * u * (1 - u)) / denominator, 30 * v]);
  }
  const exported = exportIGES(model, [constructions[0].outputId]);
  assert.equal(exported.report.objects.length, 1);
  assert.equal(exported.report.objects[0].entity, 128);
  assert.equal(exported.report.objects[0].id, 'wall');
  assert.equal(exported.report.records.D, 2);
  assert.equal(exported.report.solid, false);
  assert.deepEqual(exportIGES(model, ['arc', 'wall']).report.objects.map(item => item.entity), [126, 128]);
  const before = structuredClone(model);
  const preview = tessellateSurface(surface, { countU: 5, countV: 4, revision: 23 });
  validatePreviewPacket(preview.packet);
  assert.equal(preview.packet.version, 0);
  assert.equal(preview.packet.surfaceId, 'wall');
  assert.equal(preview.packet.revision, 23);
  assert.equal(preview.packet.positions.length, 5 * 4 * 3);
  assert.deepEqual(model, before);
});

test('IDs are unique across declarations and references target curves only', () => {
  for (const text of [
    modelSource(curveBody(), curveBody()),
    modelSource(curveBody(), extrudeBody('arc')),
    modelSource(curveBody(), extrudeBody(), extrudeBody()),
    modelSource(curveBody(), extrudeBody('wall', 'missing')),
    modelSource(curveBody(), extrudeBody(), extrudeBody('second', 'wall')),
    modelSource(curveBody(), extrudeBody('wall', 'wall')),
    source.replace('@curve #arc', '@curve #1arc'),
    source.replace('@extrude #wall', '@extrude #bad.id'),
    source.replace('curve: #arc', 'curve: arc'),
    source.replace('curve: #arc', 'curve: #1arc'),
  ]) syntaxFailure(text);
});

test('unknown syntax, fields, duplicate fields and executable expressions reject deterministically', () => {
  for (const text of [
    source.replace('version: 1;', 'version: 1; version: 1;'),
    source.replace('length-unit: mm', 'length-unit: cm'),
    source.replace('curve: #arc;', 'curve: #arc; curve: #arc;'),
    source.replace('vector: [0,0,30];', 'vector: [0,0,30]; vector: [0,0,30];'),
    source.replace('curve: #arc;', ''), source.replace('vector: [0,0,30];', ''),
    source.replace('vector:', 'shader:'),
    source.replace('@extrude', '@revolve'), source.replace('@curve', '@surface'),
    source.replace('vector: [0,0,30]', 'vector: calc(30)'),
    source.replace('vector: [0,0,30]', 'vector: url(file)'),
    source.replace('vector: [0,0,30]', 'vector: [0,0,30,]'),
    source.replace('vector: [0,0,30]', 'vector: [0,0,3e1]'),
    source.replace('vector: [0,0,30]', 'vector: [[0],0,30]'),
    source + '@model extra {}', source + '/*',
  ]) syntaxFailure(text);
  const fieldError = source.replace('vector:', 'shader:');
  assert.equal(syntaxFailure(fieldError).offset, fieldError.indexOf('shader:'));
});

test('invalid curve or construction geometry returns no partial accepted result', () => {
  for (const text of [
    source.replace('degree: 2', 'degree: 0'), source.replace('degree: 2', 'degree: 6'),
    source.replace('type: nurbs', 'type: polyline'),
    source.replace('[0,0,0,1,1,1]', '[0,0,0,1,0,1]'),
    source.replace('[1,0.7071067811865476,1]', '[1,0,1]'),
    source.replace('[1,0.7071067811865476,1]', '[1,Infinity,1]'),
    source.replace('[[10,0,0]', '[[1000001,0,0]'),
    source.replace('[0,0,30]', '[0,0,0]'), source.replace('[0,0,30]', '[0,0]'),
    source.replace('[0,0,30]', '[0,0,30,40]'),
    source.replace('[0,0,30]', '[0,0,Infinity]'), source.replace('[0,0,30]', '[0,0,NaN]'),
    source.replace('[0,0,30]', '[1000001,0,30]'),
    modelSource(curveBody(), extrudeBody(), extrudeBody('bad', 'missing')),
  ]) syntaxFailure(text);
  const overflow = source.replace('[[10,0,0]', '[[999999,0,0]').replace('[0,0,30]', '[2,0,30]');
  syntaxFailure(overflow);
  assert.deepEqual(compileConstruction(source).model.objects.map(object => object.id), ['arc', 'wall']);
});

test('source UTF8 and total declaration ceilings accept boundaries and reject excess', () => {
  const curves = Array.from({ length: 8 }, (_, i) => curveBody(`arc${i}`));
  const extrusions = curves.map((_, i) => extrudeBody(`wall${i}`, `arc${i}`));
  const sixteen = modelSource(...curves, ...extrusions);
  assert.equal(compileConstruction(sixteen).model.objects.length, 16);
  assert.equal(compileConstruction(sixteen).constructions.length, 8);
  syntaxFailure(modelSource(...curves, ...extrusions, curveBody('extra')));
  const limit = 262144;
  assert.equal(compileConstruction(source + ' '.repeat(limit - Buffer.byteLength(source))).model.objects.length, 2);
  assert.equal(syntaxFailure(source + ' '.repeat(limit + 1 - Buffer.byteLength(source))).code, 'LIMIT');
  assert.equal(syntaxFailure(source + `/*${'😀'.repeat(65536)}*/`).code, 'LIMIT');
  const manyKnots = source.replace('[0,0,0,1,1,1]', `[${Array(71).fill(0).join(',')}]`);
  syntaxFailure(manyKnots);
});

test('compiler respects 16-pole constructed-surface ceiling and rejects wholly collapsed extrusion', () => {
  const line = n => `@curve #line { type: nurbs; degree: 1;
    knots: [${[0, 0, ...Array.from({ length: n - 2 }, (_, i) => i + 1), n - 1, n - 1]}];
    control-points: [${Array.from({ length: n }, (_, i) => `[${i},0,0]`).join(',')}];
    weights: [${Array(n).fill(1)}]; }`;
  const accepted = compileConstruction(modelSource(line(16), extrudeBody('plane', 'line')));
  assert.equal(accepted.model.objects[1].controlPoints.length, 16);
  assert.equal(accepted.model.objects[1].controlPoints.flat().length, 32);
  syntaxFailure(modelSource(line(17), extrudeBody('plane', 'line')));
  const collapsed = line(2).replace('[[0,0,0],[1,0,0]]', '[[0,0,0],[0,0,1]]');
  syntaxFailure(modelSource(collapsed, extrudeBody('collapsed', 'line')));
});

test('authoring retains rational controls, weight-scaling equivalence and asymmetric nonuniform geometry', () => {
  const scaled = compileConstruction(source.replace('[1,0.7071067811865476,1]', '[10,7.071067811865476,10]')).model.objects[1];
  const original = compileConstruction(source).model.objects[1];
  const unit = compileConstruction(source.replace('[1,0.7071067811865476,1]', '[1,1,1]')).model.objects[1];
  for (const u of [0, 0.03125, 0.25, 0.5, 0.71, 1]) for (const v of [0, 0.23, 0.5, 1]) {
    pointClose(evaluateSurface(scaled, u, v), evaluateSurface(original, u, v));
  }
  const [x, y] = evaluateSurface(unit, 0.5, 0.5);
  assert.ok(Math.abs(Math.hypot(x, y) - 10) > 0.1, 'Unit-weight control must fail the circle oracle');
  const nonuniform = `@curve #path {type: nurbs; degree: 1; knots: [2,2,3,7,7];
    control-points: [[0,0,0],[2,4,1],[10,0,2]]; weights: [1,2,1];}`;
  const result = compileConstruction(modelSource(nonuniform, extrudeBody('slant', 'path', '[3,-2,5]')));
  const surface = result.model.objects[1];
  assert.deepEqual(surfaceDomain(surface), { u: [2, 7], v: [0, 1] });
  const poles = [[0, 0, 0], [2, 4, 1], [10, 0, 2]];
  const weights = [1, 2, 1];
  for (const u of [2, 2.03125, 2.5, 3, 3.23, 5, 6.7, 7]) for (const v of [0, 0.13, 0.5, 0.91, 1]) {
    const span = u <= 3 ? 0 : 1;
    const t = span === 0 ? u - 2 : (u - 3) / 4;
    const factors = [(1 - t) * weights[span], t * weights[span + 1]];
    const expected = [0, 1, 2].map(axis =>
      (factors[0] * poles[span][axis] + factors[1] * poles[span + 1][axis]) / (factors[0] + factors[1])
      + v * [3, -2, 5][axis]);
    pointClose(evaluateSurface(surface, u, v), expected);
  }
});
