import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCadModel } from '../../packages/barocss-cad/dist/index.js';
import { canonicalConstruction, parameterState, decimal } from './parameters.mjs';

const source = `@model original_name {
 version: 1; length-unit: mm;
 @extrude #first {curve:#input; vector:[-0,4,0];}
 @curve #unused {type:nurbs;degree:1;knots:[-2,-2,7,7];control-points:[[-0,0.00000000000000000000001,2],[999999.9999999999,0,3]];weights:[0.000001,1000000];}
 @curve #input {type:nurbs;degree:2;knots:[2,2,2,3.125,7,7,7];control-points:[[1,-0,0],[2,0,1],[3,0,1],[4,0,0]];weights:[1,0.7071067811865476,2,1];}
 @extrude #second {curve:#input; vector:[0,3,1];}
}`;
function accepted(text = source, selectedId = 'first') {
  const result = compileCadModel(text, {sourceVersion:1});
  assert(result.ok, JSON.stringify(result.diagnostics));
  return { source: text, sourceVersion:1, model:result.model, constructions:result.constructions, selectedConstruction: result.constructions.find(f => f.outputId === selectedId), packet: { surfaceId: selectedId } };
}
function semantics(result) { return { model: result.model, constructions: result.constructions.map(({ span, referenceSpan, ...feature }) => feature) }; }
function assertRoundtrip(value) {
  const generated = canonicalConstruction(value);
  assert.deepStrictEqual(semantics(compileCadModel(generated, {sourceVersion:1})), semantics(value));
  assert.ok(!generated.includes('e+')); assert.ok(!generated.includes('e-'));
  return generated;
}
test('canonical no-edit source preserves native values, order, forward references, unused curves and shared inputs', () => {
  const value = accepted(), original = structuredClone(value);
  const generated = assertRoundtrip(value);
  assert.deepStrictEqual(value, original);
  assert.deepStrictEqual(value.model.objects.map(o => o.id), ['first', 'unused', 'input', 'second']);
  assert.ok(generated.indexOf('@extrude #first') < generated.indexOf('@curve #input'));
  const rebuilt = compileCadModel(generated, {sourceVersion:1});
  for (const feature of rebuilt.constructions) {
    assert.match(generated.slice(feature.span.start, feature.span.end), new RegExp('@extrude #' + feature.outputId));
    assert.equal(generated.slice(feature.referenceSpan.start, feature.referenceSpan.end), '#' + feature.inputId);
  }
  const state = parameterState(value);
  assert.deepStrictEqual(state, { surfaceId: 'first', inputId: 'input', vector: [-0, 4, 0], weights: [1, 0.7071067811865476, 2, 1], indexCount: 4, sharedOutputs: ['first', 'second'] });
  state.weights[0] = 99; state.vector[1] = 99; state.sharedOutputs.push('foreign');
  assert.deepStrictEqual(value, original);
});
test('typed vector and weight modify only intended fields, preserving shared feature relationships', () => {
  const value = accepted(), original = structuredClone(value);
  const request = { vector: [-0, 5.25, -2], weight: { index: 1, value: 0.875 } };
  const generated = canonicalConstruction(value, request), rebuilt = compileCadModel(generated, {sourceVersion:1});
  const expected = structuredClone(value);
  expected.model.objects.find(o => o.id === 'input').weights[1] = 0.875;
  expected.constructions[0].vector = [-0, 5.25, -2];
  assert.deepStrictEqual(rebuilt.model.objects.find(o => o.id === 'unused'), value.model.objects.find(o => o.id === 'unused'));
  assert.deepStrictEqual(rebuilt.constructions.map(f => [f.outputId, f.inputId, f.vector]), expected.constructions.map(f => [f.outputId, f.inputId, f.vector]));
  for (const surface of rebuilt.model.objects.filter(o => o.kind === 'surface')) assert.deepStrictEqual(surface.weights[1], [0.875, 0.875]);
  assert.deepStrictEqual(rebuilt.model.objects.find(o => o.id === 'input'), expected.model.objects.find(o => o.id === 'input'));
  request.vector[1] = 99; request.weight.value = 99;
  assert.equal(compileCadModel(generated, {sourceVersion:1}).constructions[0].vector[1], 5.25);
  assert.deepStrictEqual(value, original);
  assertRoundtrip(accepted(generated));
});
test('decimal expansion preserves signed zero and all finite binary64 magnitudes without exponents', () => {
  const values = [-0, 0, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, 1e-300, -1e-300, 1e21, -1e21, 0.10000000000000002, 999999.9999999999];
  for (const value of values) {
    const text = decimal(value);
    assert.match(text, /^-?\d+(?:\.\d+)?$/);
    assert.ok(Object.is(Number(text), value), text);
  }
  for (const value of [NaN, Infinity, -Infinity, '1', null]) assert.throws(() => decimal(value));
  // Maximum finite values are legal original knot endpoints. Tiny coordinates
  // remain native data even when a preview cannot distinguish them.
  const text = `@model extreme {version:1;length-unit:mm;@curve #c {type:nurbs;degree:1;knots:[-17976931348623157${'0'.repeat(292)},-17976931348623157${'0'.repeat(292)},17976931348623157${'0'.repeat(292)},17976931348623157${'0'.repeat(292)}];control-points:[[-0,${decimal(Number.MIN_VALUE)},0],[1,0,-0]];weights:[0.000001,1000000];}@extrude #s {curve:#c;vector:[0,1,-0];}}`;
  assertRoundtrip(accepted(text, 's'));
});
test('strict typed data rejects foreign/accessor/symbol/sparse requests without getter reads', () => {
  const value = accepted(); let reads = 0;
  const getter = () => { reads++; return 1; };
  const malformed = [{ foreign: 1 }, { vector: undefined }, { vector: [1, 2] }, { vector: [1, NaN, 2] }, { vector: [1, Infinity, 2] }, { weight: { index: -1, value: 1 } }, { weight: { index: 4, value: 1 } }, { weight: { index: 1.5, value: 1 } }, { weight: { index: 0, value: '1' } }, { weight: { index: 0, value: 0.0000009 } }, { weight: { index: 0, value: 1000001 } }, { weight: { index: 0, value: 1, extra: 0 } }, Object.create({ vector: [0,1,0] }), { [Symbol('x')]: 1 }, Object.defineProperty({}, 'vector', { get: getter }), { weight: Object.defineProperty({ index: 0 }, 'value', { get: getter }) }];
  const vector = [0, 1, 0]; Object.defineProperty(vector, '1', { get: getter }); malformed.push({ vector });
  malformed.push({ vector: [0, , 1] });
  const decorated = [0, 1, 0]; decorated.extra = 1; malformed.push({ vector: decorated });
  for (const request of malformed) assert.throws(() => canonicalConstruction(value, request));
  assert.equal(reads, 0);
  for (const weight of [1e-6, 1e6]) assert.equal(compileCadModel(canonicalConstruction(value, { weight: { index: 0, value: weight } }), {sourceVersion:1}).model.objects.find(o => o.id === 'input').weights[0], weight);
});
test('malformed native/provenance records cannot be silently discarded', () => {
  const mutators = [
    a => a.model.foreign = 1,
    a => a.model.objects[1].foreign = 1,
    a => a.constructions[0].foreign = 1,
    a => a.constructions[0].span.foreign = 1,
    a => a.model.objects.push(structuredClone(a.model.objects[1])),
    a => a.model.objects[0].kind = 'solid',
    a => a.constructions.pop(),
    a => a.constructions.push(structuredClone(a.constructions[0])),
    a => a.constructions.reverse(),
    a => a.constructions[0].inputId = 'unknown',
    a => a.constructions[0].outputId = 'unknown',
    a => a.constructions[0].operation = 'sweep',
    a => a.constructions[0].span.end = a.source.length + 1,
    a => a.constructions[0].referenceSpan.start = 0,
    a => a.selectedConstruction = structuredClone(a.constructions[1]),
    a => a.model.objects[0].controlPoints[0][1][1] += 1,
    a => a.model.objects[0].weights[0][1] += 1,
    a => a.model.objects[0].knotsU[0] += 1,
    a => a.model.objects[0].degreeV = 2,
  ];
  for (const mutate of mutators) { const a = accepted(); mutate(a); assert.throws(() => canonicalConstruction(a)); }
  let reads = 0; const a = accepted(); Object.defineProperty(a.model.objects[1], 'weights', { get() { reads++; return []; } });
  assert.throws(() => canonicalConstruction(a)); assert.equal(reads, 0);
});
test('unsupported panel and canonical UTF-8 size limit are explicit', () => {
  assert.equal(parameterState(undefined), undefined); assert.equal(parameterState({ sourceVersion: 0 }), undefined);
  assert.equal(parameterState({ sourceVersion: 1 }), undefined);
  assert.throws(() => canonicalConstruction({ sourceVersion: 0 }));
  const compact = '@model NAME {version:1;length-unit:mm;@curve #c {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[1,0,0]];weights:[1,1];}@extrude #s {curve:#c;vector:[0,1,0];}}';
  const nearLimit = compact.replace('NAME', 'a'.repeat(262144 - compact.length + 4));
  assert.equal(new TextEncoder().encode(nearLimit).length, 262144);
  assert.throws(() => canonicalConstruction(accepted(nearLimit, 's')), /256 KiB/);
  const oversized = accepted(); oversized.source = 'a'.repeat(262145);
  assert.throws(() => canonicalConstruction(oversized), /accepted construction/);
});
