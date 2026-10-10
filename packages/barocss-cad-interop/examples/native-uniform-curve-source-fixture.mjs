import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel, curveDomain, sampleCurve } from '@barocss/cad';
import * as uniform from '@barocss/cad-interop/native-uniform-curve';

export const PINS = Object.freeze([
  { file: 'polynomial.actual-world.source0.css', bytes: 253, sha256: 'e81ab0a741e21c7e67fef91474fbc8af6e00bbdad55601d3637c943b58bfc0aa' },
  { file: 'polynomial.authored-request.json', bytes: 1425, sha256: 'e03e88358163c3b9dbf10644af97fd61cd3fbbb5f97be17b4dbfdbb44356332c' },
  { file: 'polynomial.owned-section.json', bytes: 29713, sha256: 'fed476d35708334073dfe85d564af4813dad144b42f212bf974201c9315cd2c0' },
  { file: 'polynomial.surface-uv.dimensionless-sidecar.json', bytes: 310, sha256: 'd303318d3f1d8597afc61891e7bfc72c92af4f28e3deb892c47d2dd1ad37d676' },
  { file: 'polynomial.plane-uv.dimensionless-sidecar.json', bytes: 290, sha256: 'cb271feaa6557dc8136e7753f1e4e9770662a6486ac6a0ad5f637dd6e98b22fc' },
]);

const resultKeys = ['format', 'version', 'mode', 'source', 'model', 'curveId', 'options',
  'domain', 'parameters', 'pointsMM', 'intervals', 'positions', 'quality'];
const expectedQuality = { approximateDisplay: true, adaptiveErrorBound: false,
  geometricValidity: 'not-certified', topologyCertified: false, solid: false };
const parse = uniform.parseBaroCadUniformCurveSource;
const ErrorClass = uniform.BaroCadUniformCurveSourceError;
const options = (count = 17, scale = 0.001) => ({ sourceVersion: 0,
  unitsPerMillimeter: scale, uniformCurveDisplay: { version: 1, count } });

// Source0 decimal literals, including signed zero and very small native components.
function decimal(value) {
  if (Object.is(value, -0)) return '-0';
  assert.ok(Number.isFinite(value));
  const token = String(value);
  if (!/[eE]/.test(token)) return token;
  const [mantissa, exponentText] = token.toLowerCase().split('e');
  const negative = mantissa.startsWith('-');
  const absolute = negative ? mantissa.slice(1) : mantissa;
  const [integer, fraction = ''] = absolute.split('.');
  const digits = integer + fraction;
  const position = integer.length + Number(exponentText);
  const expanded = position <= 0 ? '0.' + '0'.repeat(-position) + digits :
    position >= digits.length ? digits + '0'.repeat(position - digits.length) :
      digits.slice(0, position) + '.' + digits.slice(position);
  assert.ok(Object.is(Number((negative ? '-' : '') + expanded), value));
  return (negative ? '-' : '') + expanded;
}
function literal(value) {
  return Array.isArray(value) ? '[' + value.map(literal).join(',') + ']' : decimal(value);
}
function declaration(id, degree, knots, points, weights) {
  return '@curve #' + id + ' {type:nurbs;degree:' + degree + ';knots:' + literal(knots) +
    ';control-points:' + literal(points) + ';weights:' + literal(weights) + ';}';
}
function sourceFor({ degree = 1, left = 0, right = 1, points, weights, id = 'original_curve' } = {}) {
  const poles = points ?? Array.from({ length: degree + 1 }, (_, index) => [index, -0, 0]);
  const knots = [...Array(degree + 1).fill(left), ...Array(degree + 1).fill(right)];
  return '@model original_model {version:0;length-unit:mm;' +
    declaration(id, degree, knots, poles, weights ?? Array(poles.length).fill(1)) + '}\n';
}
function compile(source) {
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  return compiled.model;
}

export function readPinnedFiles(dataDirectory) {
  const files = PINS.map(pin => {
    const bytes = readFileSync(resolve(dataDirectory, pin.file));
    assert.equal(bytes.length, pin.bytes, pin.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256, pin.file);
    // Context JSON is validated as unchanged bytes and JSON syntax only.
    if (pin.file.endsWith('.json')) JSON.parse(bytes.toString('utf8'));
    return { ...pin, bytes };
  });
  return { source: files[0].bytes.toString('utf8'),
    pins: files.map(({ bytes, ...pin }) => pin) };
}

export function runUniformCurveSourceChecks(dataDirectory) {
  assert.deepEqual(Object.keys(uniform).sort(),
    ['BaroCadUniformCurveSourceError', 'parseBaroCadUniformCurveSource', 'validateBaroCadUniformCurveSourceOptions']);
  const pinned = readPinnedFiles(dataDirectory);
  const primaryModel = compile(pinned.source);
  assert.equal(primaryModel.name, 'profile');
  assert.equal(primaryModel.objects[0].id, 'poly_world');
  assert.equal(primaryModel.objects[0].degree, 4);
  assert.deepEqual(primaryModel.objects[0].weights, Array(5).fill(24000));
  const accepted = [];
  function checkResult(name, source, inputOptions) {
    const optionPrototype = Object.getPrototypeOf(inputOptions);
    const displayPrototype = Object.getPrototypeOf(inputOptions.uniformCurveDisplay);
    const beforeOptions = { ...inputOptions, uniformCurveDisplay: { ...inputOptions.uniformCurveDisplay } };
    const originalModel = compile(source);
    const originalCurve = originalModel.objects[0];
    const direct = sampleCurve(originalCurve, inputOptions.uniformCurveDisplay.count);
    const domain = curveDomain(originalCurve);
    const result = parse(source, inputOptions);
    assert.deepEqual(Object.keys(result).sort(), [...resultKeys].sort());
    assert.equal(result.format, 'barocad-uniform-curve-preview');
    assert.equal(result.version, 1);
    assert.equal(result.mode, 'uniform-original-parameter');
    assert.equal(result.source, source);
    assert.deepEqual(result.model, originalModel);
    assert.equal(result.model.objects.length, 1);
    assert.equal(result.curveId, originalCurve.id);
    assert.deepEqual(result.domain, domain);
    assert.deepEqual(result.parameters, direct.map(sample => sample.parameter));
    assert.deepEqual(result.pointsMM, direct.map(sample => sample.point));
    assert.deepEqual(result.intervals, direct.slice(1).map((sample, index) =>
      [direct[index].parameter, sample.parameter]));
    assert.ok(Object.is(result.parameters[0], domain[0]));
    assert.ok(Object.is(result.parameters.at(-1), domain[1]));
    assert.ok(result.parameters.slice(1).every((value, index) => value > result.parameters[index]));
    assert.ok(result.positions instanceof Float32Array);
    assert.equal(result.positions.length, direct.length * 3);
    for (const [index, sample] of direct.entries()) for (let axis = 0; axis < 3; axis++) {
      assert.ok(Object.is(result.positions[index * 3 + axis],
        Math.fround(sample.point[axis] * inputOptions.unitsPerMillimeter)));
    }
    assert.deepEqual(result.quality, expectedQuality);
    assert.deepEqual({ ...inputOptions, uniformCurveDisplay: { ...inputOptions.uniformCurveDisplay } }, beforeOptions);
    assert.equal(Object.getPrototypeOf(inputOptions), optionPrototype);
    assert.equal(Object.getPrototypeOf(inputOptions.uniformCurveDisplay), displayPrototype);
    assert.notEqual(result.options, inputOptions);
    assert.notEqual(result.options.uniformCurveDisplay, inputOptions.uniformCurveDisplay);
    assert.deepEqual(result.options, beforeOptions);
    assert.notEqual(result.pointsMM, direct);
    for (const [index, point] of result.pointsMM.entries()) {
      assert.notEqual(point, direct[index].point);
      if (index) assert.notEqual(point, result.pointsMM[index - 1]);
    }
    for (const [index, interval] of result.intervals.entries()) {
      assert.notEqual(interval, result.domain);
      if (index) assert.notEqual(interval, result.intervals[index - 1]);
    }
    accepted.push({ name, degree: originalCurve.degree, poleCount: originalCurve.controlPoints.length,
      count: direct.length, intervals: result.intervals.length, positionBytes: result.positions.byteLength,
      domain, unitsPerMillimeter: inputOptions.unitsPerMillimeter });
    return result;
  }
  for (const count of [2, 17, 129]) checkResult('producer-degree4-count' + count, pinned.source, options(count));
  for (const degree of [1, 2, 3, 4, 5]) {
    checkResult('authored-degree' + degree, sourceFor({ degree }), options());
  }
  checkResult('authored-nonunit-domain', sourceFor({ degree: 3, left: -3, right: 7 }), options());
  const signedSource = sourceFor({ left: -0, right: 1, points: [[-0, -0, 0], [1, -0, 0]] });
  const signed = checkResult('authored-signed-zero', signedSource, options());
  assert.ok(Object.is(signed.domain[0], -0));
  assert.ok(Object.is(signed.model.objects[0].controlPoints[0][0], -0));
  assert.ok(Object.is(signed.model.objects[0].controlPoints[0][1], -0));
  // Evaluated point zero signs follow the genuine sampler, not the authored poles.
  const subnormal = checkResult('authored-safe-F32-subnormal',
    sourceFor({ points: [[0, 2 ** -149, 0], [1, 2 ** -149, 0]] }), options(2, 1));
  assert.equal(subnormal.positions[1], 2 ** -149);
  const nullOptions = Object.assign(Object.create(null), options(2));
  nullOptions.uniformCurveDisplay = Object.assign(Object.create(null), nullOptions.uniformCurveDisplay);
  checkResult('null-prototype-own-options', pinned.source, nullOptions);

  const independentOptions = options(2);
  const independent = parse(pinned.source, independentOptions);
  independentOptions.uniformCurveDisplay.count = 129;
  independentOptions.unitsPerMillimeter = 1;
  assert.equal(independent.options.uniformCurveDisplay.count, 2);
  assert.equal(independent.options.unitsPerMillimeter, 0.001);
  const coldAgain = parse(pinned.source, options(2));
  independent.pointsMM[0][0] = 123;
  independent.parameters[0] = 123;
  independent.intervals[0][0] = 123;
  independent.model.objects[0].controlPoints[0][0] = 123;
  assert.deepEqual(coldAgain.model, primaryModel);
  assert.equal(coldAgain.pointsMM[0][0], 0);
  assert.equal(coldAgain.parameters[0], 0);
  assert.equal(coldAgain.intervals[0][0], 0);
  assert.equal(independent.domain[0], 0);
  assert.equal(independent.positions[0], 0);

  const retained = parse(pinned.source, options(17));
  const retainedBefore = structuredClone(retained);
  const refusals = [];
  function refuse(name, source, inputOptions, expectedCode, expectedDiagnostics) {
    const copy = structuredClone(inputOptions);
    assert.throws(() => parse(source, inputOptions), error => {
      assert.ok(error instanceof ErrorClass, name);
      assert.equal(error.name, 'BaroCadUniformCurveSourceError');
      assert.equal(error.code, expectedCode, name);
      assert.ok(Array.isArray(error.diagnostics));
      assert.ok(Object.hasOwn(error, 'cause'));
      if (expectedDiagnostics) assert.deepEqual(error.diagnostics, expectedDiagnostics);
      refusals.push({ name, code: error.code, errorName: error.name, message: error.message,
        diagnostics: error.diagnostics, causeName: error.cause?.name ?? null });
      return true;
    });
    assert.deepEqual(inputOptions, copy);
    assert.deepEqual(retained, retainedBefore);
    assert.equal(retained.source, pinned.source);
    assert.deepEqual(retained.model, primaryModel);
  }
  for (const count of [1, 130, 2.5, NaN, Infinity]) {
    refuse('invalid-count-' + String(count), pinned.source, options(count), 'OPTIONS');
  }
  for (const scale of [0, -0, -1, NaN, Infinity]) {
    refuse('invalid-scale-' + String(scale), pinned.source, options(2, scale), 'OPTIONS');
  }
  refuse('uniform-version2', pinned.source, { ...options(), uniformCurveDisplay: { version: 2, count: 17 } }, 'OPTIONS');
  refuse('source-version1', pinned.source, { ...options(), sourceVersion: 1 }, 'OPTIONS');
  refuse('legacy-adaptive-field', pinned.source, { ...options(), curveDisplay: { version: 1 } }, 'OPTIONS');
  refuse('capacity-field', pinned.source, { ...options(), nativeCapacity: { version: 1, maximumObjects: 16 } }, 'OPTIONS');
  refuse('missing-count', pinned.source, { ...options(), uniformCurveDisplay: { version: 1 } }, 'OPTIONS');
  refuse('extra-profile-field', pinned.source, { ...options(), uniformCurveDisplay: { version: 1, count: 17, tolerance: 1 } }, 'OPTIONS');
  for (const [name, source] of [['source-type', 7], ['source-syntax', '@model invalid {}'],
    ['compiler-byte-limit', pinned.source + ' '.repeat(262144)]]) {
    const refused = compileCadModel(source, { sourceVersion: 0 });
    assert.equal(refused.ok, false);
    refuse(name, source, options(), 'SOURCE', refused.diagnostics);
  }
  const twoCurves = sourceFor().replace(/}\s*$/, '') +
    declaration('second_curve', 1, [0, 0, 1, 1], [[0, 1, 0], [1, 1, 0]], [1, 1]) + '}\n';
  assert.equal(compile(twoCurves).objects.length, 2);
  refuse('two-curves-profile', twoCurves, options(), 'PROFILE');
  const surface = '@model surface_input {version:0;length-unit:mm;@surface #surface_original {' +
    'type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[0,0,1,1];' +
    'control-points:[[[0,0,0],[0,1,0]],[[1,0,0],[1,1,0]]];weights:[[1,1],[1,1]];}}\n';
  assert.equal(compile(surface).objects[0].kind, 'surface');
  refuse('surface-profile', surface, options(), 'PROFILE');
  const narrow = sourceFor({ left: 1, right: 1 + Number.EPSILON });
  const narrowSamples = sampleCurve(compile(narrow).objects[0], 17);
  assert.ok(narrowSamples.some((sample, index) => index &&
    sample.parameter === narrowSamples[index - 1].parameter));
  refuse('narrow-domain-duplicate-parameters', narrow, options(), 'PARAMETERS');
  refuse('constant-zero-segment', sourceFor({ points: [[0, 0, 0], [0, 0, 0]] }), options(2, 1), 'SEGMENTS');
  refuse('constant-nonzero-segment', sourceFor({ points: [[1, 0, 0], [1, 0, 0]] }), options(2, 1), 'SEGMENTS');
  const collapsed = sourceFor({ points: [[900000, 0, 0], [900000.0001, 0, 0]] });
  const collapsedSamples = sampleCurve(compile(collapsed).objects[0], 2);
  assert.notEqual(collapsedSamples[0].point[0], collapsedSamples[1].point[0]);
  assert.equal(Math.fround(collapsedSamples[0].point[0] * 0.001),
    Math.fround(collapsedSamples[1].point[0] * 0.001));
  refuse('distinct-native-F32-collapse', collapsed, options(2), 'SEGMENTS');
  const underflowSource = sourceFor({ points: [[0.5, 0, 0], [1, 0, 0]] });
  assert.equal(0.5 * Number.MIN_VALUE, 0);
  refuse('binary64-product-underflow', underflowSource, options(2, Number.MIN_VALUE), 'POSITIONS');
  const unitSource = sourceFor({ points: [[1, 0, 0], [2, 0, 0]] });
  assert.ok(1e-50 !== 0 && Math.fround(1e-50) === 0);
  refuse('F32-underflow', unitSource, options(2, 1e-50), 'POSITIONS');
  const overflowSource = sourceFor({ points: [[2, 0, 0], [3, 0, 0]] });
  refuse('binary64-overflow', overflowSource, options(2, Number.MAX_VALUE), 'POSITIONS');
  refuse('F32-overflow', overflowSource, options(2, 1e39), 'POSITIONS');

  let getterCalls = 0;
  function descriptors(value) {
    return value !== null && typeof value === 'object' ?
      { prototype: Object.getPrototypeOf(value), fields: Object.getOwnPropertyDescriptors(value) } : { value };
  }
  function rejectStructure(name, candidate) {
    const before = descriptors(candidate);
    const profile = before.fields?.uniformCurveDisplay?.value;
    const profileBefore = descriptors(profile);
    assert.throws(() => parse('@model invalid {}', candidate), error => {
      assert.ok(error instanceof ErrorClass);
      assert.equal(error.code, 'OPTIONS', name);
      refusals.push({ name, code: error.code, errorName: error.name, message: error.message,
        diagnostics: error.diagnostics, causeName: error.cause?.name ?? null });
      return true;
    });
    assert.equal(getterCalls, 0);
    assert.deepEqual(descriptors(candidate), before);
    assert.deepEqual(descriptors(profile), profileBefore);
    assert.deepEqual(retained, retainedBefore);
  }
  const rootGetter = options();
  Object.defineProperty(rootGetter, 'unitsPerMillimeter', { enumerable: true,
    get() { getterCalls++; return 0.001; } });
  rejectStructure('root-getter-options-first', rootGetter);
  const nestedGetter = options();
  Object.defineProperty(nestedGetter.uniformCurveDisplay, 'count', { enumerable: true,
    get() { getterCalls++; return 17; } });
  rejectStructure('profile-getter-options-first', nestedGetter);
  const hidden = options(); Object.defineProperty(hidden, 'hidden', { value: 1 });
  rejectStructure('hidden-root-field', hidden);
  const hiddenProfile = options(); Object.defineProperty(hiddenProfile.uniformCurveDisplay, 'hidden', { value: 1 });
  rejectStructure('hidden-profile-field', hiddenProfile);
  const symbol = options(); symbol[Symbol('field')] = 1;
  rejectStructure('symbol-root-field', symbol);
  const nestedSymbol = options(); nestedSymbol.uniformCurveDisplay[Symbol('field')] = 1;
  rejectStructure('symbol-profile-field', nestedSymbol);
  const inherited = Object.assign(Object.create({ inherited: true }), options());
  rejectStructure('inherited-prototype', inherited);
  class ForeignOptions { constructor() { Object.assign(this, options()); } }
  rejectStructure('foreign-class-options', new ForeignOptions());
  rejectStructure('null-options', null);
  rejectStructure('array-options', []);
  rejectStructure('missing-profile', { sourceVersion: 0, unitsPerMillimeter: 0.001 });
  rejectStructure('array-profile', { ...options(), uniformCurveDisplay: [] });
  const coercion = options();
  coercion.unitsPerMillimeter = { valueOf() { getterCalls++; return 0.001; } };
  rejectStructure('no-number-coercion', coercion);
  const cause = new Error('real constructor cause');
  const constructed = new ErrorClass('SAMPLING', 'constructor contract', [], cause);
  assert.equal(constructed.code, 'SAMPLING');
  assert.equal(constructed.cause, cause);
  assert.deepEqual(constructed.diagnostics, []);
  assert.deepEqual(retained, retainedBefore);
  return { ok: true, pins: pinned.pins, accepted, refusals, getterCalls,
    primaryModel, optionsSnapshotsIndependent: true, nativeDataIndependent: true,
    originalSourceAndNativeRetainedAcrossRefusal: true,
    samplingCauseConstructorChecked: true, realSamplerExceptionInjected: false,
    contextFiles: 'Four exact opaque JSON inputs; no section-builder or whole-section semantic acceptance',
    scope: 'Public uniform CPU source/real CAD math/result/refusal checks; no engines/browser/packed registry' };
}
