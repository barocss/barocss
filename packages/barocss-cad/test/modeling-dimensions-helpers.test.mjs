import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
if (process.env.CAD_MODEL_TEST_MODULE) {
  assert.ok(process.env.CAD_MODEL_DIMENSION_HELPER_MODULE); assert.ok(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE);
}
const module = variable => process.env[variable] ? pathToFileURL(resolve(process.env[variable])).href : null;
const { resolveModelDimension: evaluate, ModelDimensionError } = await import(module('CAD_MODEL_DIMENSION_HELPER_MODULE') ?? '../dist/modeling-dimension-internal.js');
const { modelingGraphKey: key, modelingNodeParameters: refs, modelingReusablePrefix: prefix } = await import(module('CAD_MODEL_REGENERATION_HELPER_MODULE') ?? '../dist/modeling-regeneration-internal.js');
const add = (left, right) => ({ op: 'add', left, right }), scale = (value, factor) => ({ op: 'scale', value, factor }), p = parameter => ({ parameter });
const refuses = (value, code) => assert.throws(() => evaluate(value, { width: 32 }), e => e instanceof ModelDimensionError && e.code === code);

test('actual private resolver preserves postorder binary64, finite intermediates and signed zero', () => {
  assert.equal(evaluate(add(scale(p('width'), .5), p('offset')), { width: 32, offset: 4 }), 20);
  const tiny = 2 ** -53;
  assert.equal(evaluate(add(add(8192,-8192), tiny), {}), tiny);
  assert.equal(evaluate(add(8192, add(-8192,tiny)), {}), 0);
  for (const value of [scale(-0, 2), scale(0,-1), add(-0,-0), scale(-Number.MIN_VALUE,.5)]) assert.ok(Object.is(evaluate(value, {}), -0));
  assert.ok(Object.is(evaluate(add(-0,0), {}), 0)); assert.ok(Object.is(evaluate(scale(-0,-1), {}), 0));
  assert.equal(evaluate(scale(0, Number.MAX_VALUE), {}), 0);
  refuses(add(scale(10000,2),-10000), 'PARAMETER'); refuses(scale(32,Number.MAX_VALUE), 'PARAMETER');
  refuses(scale(1,Infinity), 'PARAMETER'); refuses(scale(1,p('width')), 'PARAMETER'); refuses(scale(1,'2'), 'PARAMETER');
  refuses({ op: 'divide', value: 1, factor: 0 }, 'INPUT');
});

test('actual private resolver validates occurrence/depth and own fields without executing getters', () => {
  let depth = 1; for (let i = 0; i < 5; i++) depth = scale(depth, 1);
  assert.equal(evaluate(depth, {}), 1); refuses(scale(depth,1), 'BUDGET');
  let tree = 1; for (let i = 0; i < 4; i++) tree = add(tree, tree);
  assert.equal(evaluate(scale(tree,1), {}), 16); refuses(add(tree,tree), 'BUDGET');
  let calls = 0; refuses({ get op() { calls++; return 'add'; }, left: 1, right: 2 }, 'INPUT');
  refuses({ op: 'scale', get value() { calls++; return 1; }, factor: 2 }, 'INPUT'); assert.equal(calls, 0);
  refuses({ op: 'add', left: 1, right: 2, [Symbol('extra')]: 0 }, 'INPUT');
  refuses({ parameter: 'width', op: 'scale' }, 'INPUT'); refuses({ op: 'scale', value: 1 }, 'INPUT');
  refuses(p('missing'), 'PARAMETER');
});

test('unchanged cache helper reaches nested references in every dimension slot and exact formula keys', () => {
  const formula = () => add(scale(p('width'), .5), p('offset'));
  for (const node of [
    { kind: 'sketch', profile: 'polygon', points: [[formula(),0],[32,0],[0,24]] },
    { kind: 'sketch', profile: 'rectangle', min: [formula(),0], max: [32,24] },
    { kind: 'extrude', sketch: 0, height: formula() },
    { kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', at: formula() },
    { kind: 'chamfer', parent: { node: 1, side: 'solid' }, distance: formula(), edge: { at: { y: formula() } } },
  ]) assert.deepEqual(refs(node), ['offset','width']);
  const graph = () => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { width: 32, offset: 0 }, nodes: [{ kind: 'split', at: formula() }], outputs: { negative: { node: 4, side: 'negative' } } });
  const a = graph(), b = graph(); b.nodes[0].at.left.factor = -0; const c = graph(); c.nodes[0].at.left.factor = 0;
  assert.notEqual(key(a), key(b)); assert.notEqual(key(b), key(c));
  const literalPositive = graph(), literalNegative = graph();
  literalPositive.nodes[0].at.right = 0; literalNegative.nodes[0].at.right = -0;
  assert.notEqual(key(literalPositive), key(literalNegative)); assert.ok(key(literalNegative).includes('"right":-0'));
  const d = graph(); d.nodes[0].at = scale(p('width'), .5); assert.notEqual(key(a), key(d));
  const names = [['width'],[],['front'],['back'],refs({ at: formula() })];
  const parameters = { width: 32, offset: 0, front: 1, back: 2, unused: 0 };
  assert.equal(prefix(true, key(a), key(a), { ...parameters, offset: -0 }, parameters, names), 4);
  assert.equal(prefix(true, key(a), key(a), { ...parameters, width: 40 }, parameters, names), 0);
  assert.equal(prefix(true, key(a), key(a), { ...parameters, unused: -0 }, parameters, names), 5);
  assert.equal(prefix(true, key(b), key(c), parameters, parameters, names), 0);
});
