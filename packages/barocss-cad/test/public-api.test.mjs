import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Default: emitted package. A separately bundled source barrel can be selected
// for the identical checks without invoking geometry or rebuilding the package.
const entry = process.env.CAD_PUBLIC_API_TEST_MODULE;
const api = await import(entry ? pathToFileURL(resolve(entry)).href : '../dist/index.js');
const aliases = {
  sketch: {
    affineXY: {
      solve: 'solveXYAffineSketch', build: 'buildXYAffineSketch', validate: 'validateXYAffineSketch',
    },
  },
  solid: {
    prismXY: {
      build: 'buildXYAffineSketchPrism', validate: 'validateXYAffineSketchPrism', wall: 'resolveXYAffineSketchPrismWall',
    },
    convex: {
      split: 'splitConvexPlanarSolid', intersect: 'intersectConvexPlanarSolids',
      subtractSlab: 'subtractConvexPlanarSlab', chamferCardinal: 'chamferConvexPlanarSolid',
      mass: 'measureConvexPlanarSolidMass', validate: 'validateConvexPlanarSolid',
      validateSplit: 'validateConvexPlanarSolidSplit', validateIntersection: 'validateConvexPlanarSolidIntersection',
      validateSlab: 'validateConvexPlanarSlabSubtraction', validateChamfer: 'validateConvexPlanarSolidChamfer',
      validateMass: 'validateConvexPlanarSolidMass',
    },
  },
  document: {
    sourceV1: {
      create: 'createCadDocument', parse: 'parseCadDocument', serialize: 'serializeCadDocument', validate: 'validateCadDocumentResult',
    },
    prismV1: {
      evaluate: 'evaluateXYAffinePrismFeatureDocumentV1', update: 'updateXYAffinePrismFeatureDocumentV1',
      parse: 'parseXYAffinePrismFeatureDocumentV1', serialize: 'serializeXYAffinePrismFeatureDocumentV1',
      validate: 'validateXYAffinePrismFeatureDocumentV1', validateUpdate: 'validateXYAffinePrismFeatureDocumentUpdateV1',
    },
    prismV2: {
      evaluate: 'evaluateXYAffinePrismFeatureDocumentV2', update: 'updateXYAffinePrismFeatureDocumentV2',
      parse: 'parseXYAffinePrismFeatureDocumentV2', serialize: 'serializeXYAffinePrismFeatureDocumentV2',
      validate: 'validateXYAffinePrismFeatureDocumentV2', validateUpdate: 'validateXYAffinePrismFeatureDocumentUpdateV2',
    },
  },
};

test('all 33 concise leaves are the exact named functions, with no wrappers', () => {
  let leaves = 0;
  function check(actual, expected, path) {
    assert.deepEqual(Reflect.ownKeys(actual).sort(), Object.keys(expected).sort(), path);
    assert.equal(Object.getPrototypeOf(actual), Object.prototype, path);
    for (const [key, value] of Object.entries(expected)) {
      if (typeof value === 'string') {
        assert.equal(typeof api[value], 'function', value + ' remains publicly exported');
        assert.equal(actual[key], api[value], path + '.' + key);
        leaves++;
      } else check(actual[key], value, path + '.' + key);
    }
  }
  check(api.cad, aliases, 'cad');
  assert.equal(leaves, 33);
});

test('every namespace is frozen; replacement, extension and deletion refuse', () => {
  let records = 0;
  function check(actual, expected) {
    assert.equal(Object.isFrozen(actual), true);
    const key = Object.keys(expected)[0], before = actual[key];
    assert.throws(() => { actual[key] = null; }, TypeError);
    assert.throws(() => { actual.unsupported = null; }, TypeError);
    assert.throws(() => { delete actual[key]; }, TypeError);
    assert.equal(actual[key], before);
    records++;
    for (const [key, value] of Object.entries(expected)) if (typeof value !== 'string') check(actual[key], value);
  }
  check(api.cad, aliases);
  assert.equal(records, 10);
});

test('destructured operations and their validators retain the original pairing', () => {
  const { affineXY } = api.cad.sketch;
  const { prismXY, convex } = api.cad.solid;
  const { sourceV1, prismV1, prismV2 } = api.cad.document;
  assert.equal(affineXY.build, api.buildXYAffineSketch);
  assert.equal(prismXY.build, api.buildXYAffineSketchPrism);
  assert.equal(convex.subtractSlab, api.subtractConvexPlanarSlab);
  assert.equal(convex.validateSlab, api.validateConvexPlanarSlabSubtraction);
  assert.equal(sourceV1.parse, api.parseCadDocument);
  assert.equal(prismV1.parse, api.parseXYAffinePrismFeatureDocumentV1);
  assert.notEqual(sourceV1.parse, prismV1.parse);
  assert.equal(prismV2.parse, api.parseXYAffinePrismFeatureDocumentV2);
  assert.notEqual(sourceV1.parse, prismV2.parse);
  for (const operation of Object.keys(aliases.document.prismV2)) {
    assert.notEqual(prismV1[operation], prismV2[operation], operation + ' remains version-specific');
  }
});
