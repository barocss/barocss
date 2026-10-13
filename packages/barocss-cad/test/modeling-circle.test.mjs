import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { authoredDocument, CASES, signedData } from './modeling-circle-fixture.mjs';
const entry = process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js';
const { cad, CadModelError, CadModelLimits } = await import(entry);
// Every load in this file either rejects malformed admission or reaches the
// intentionally invalid output side. No test admits a native evaluation.
const refuses = (action, code, operation) => assert.throws(action, error => {
  assert.ok(error instanceof CadModelError); assert.notEqual(error.code, 'NATIVE');
  assert.ok((Array.isArray(code) ? code : [code]).includes(error.code), error.message);
  if (operation) assert.equal(error.operation, operation); return true;
});
const circle = m => m.sketch.circle({ center: [2, -3], radius: 4 });
const pair = () => { const m = cad.model(), post = circle(m).extrude(6), box = m.sketch.rectangle({ width: 32, height: 24 }).extrude(8); return { m, post, box }; };
const twoRemainingNodes = box => {
  const first = box.chamfer(box.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), 1);
  const second = first.chamfer(first.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), 1);
  assert.ok(Object.isFrozen(second));
};

test('circle requires exact own options and dense owned two-coordinate arrays without invoking getters', () => {
  const m = cad.model(); let reads = 0;
  const getter = { get center() { reads++; return [0, 0]; }, radius: 1 };
  const hidden = Object.defineProperty({ center: [0, 0], radius: 1 }, 'extra', { value: true });
  const symbol = { center: [0, 0], radius: 1, [Symbol('extra')]: true };
  for (const options of [undefined, null, [], {}, { center: [0, 0] }, { radius: 1 }, { center: [0, 0], radius: 1, width: 2 },
    Object.create({ center: [0, 0], radius: 1 }), getter, hidden, symbol]) refuses(() => m.sketch.circle(options), 'INPUT');
  const sparse = new Array(2); sparse[0] = 0;
  const accessor = [0, 0]; Object.defineProperty(accessor, '1', { get() { reads++; return 0; }, enumerable: true });
  const extra = [0, 0]; extra.extra = 1;
  for (const center of [null, {}, sparse, accessor, extra, Object.assign(Object.create(Array.prototype), { 0: 0, 1: 0, length: 2 })])
    refuses(() => m.sketch.circle({ center, radius: 1 }), 'INPUT');
  for (const center of [[], [0], [0, 0, 0]]) refuses(() => m.sketch.circle({ center, radius: 1 }), 'BUDGET');
  assert.equal(reads, 0);
  const own = Object.assign(Object.create(null), { center: [0, 0], radius: 1 });
  assert.ok(Object.isFrozen(m.sketch.circle(own))); assert.ok(Object.isFrozen(circle(m)));
  refuses(() => circle(m), 'CAPABILITY', 'sketch');
});

test('all center, radius and height slots reject copied or foreign dimensions without spending nodes', () => {
  for (const slot of ['centerX', 'centerY', 'radius', 'height']) {
    const m = cad.model(), own = m.parameter('size', 2), expression = m.dimension.scale(own, .5), foreign = cad.model();
    const foreignParameter = foreign.parameter('size', 2), foreignExpression = foreign.dimension.scale(foreignParameter, .5);
    const sketch = slot === 'height' ? circle(m) : null;
    for (const bad of [foreignParameter, foreignExpression, { ...own }, { ...expression }, { parameter: 'size' }, { op: 'scale', value: own, factor: .5 }, null, undefined]) {
      const options = { center: [own, expression], radius: expression };
      if (slot === 'height') refuses(() => sketch.extrude(bad), 'OWNERSHIP');
      else {
        if (slot === 'radius') options.radius = bad; else options.center[slot === 'centerX' ? 0 : 1] = bad;
        refuses(() => m.sketch.circle(options), 'OWNERSHIP');
      }
    }
    if (slot === 'height') { assert.ok(Object.isFrozen(sketch.extrude(own))); assert.ok(Object.isFrozen(sketch.extrude(expression))); refuses(() => sketch.extrude(1), 'CAPABILITY'); }
    else { assert.ok(Object.isFrozen(circle(m))); assert.ok(Object.isFrozen(circle(m))); refuses(() => circle(m), 'CAPABILITY'); }
  }
});

test('finite and circle-specific range checks happen before append, including resolved expression values', () => {
  const m = cad.model();
  for (const radius of [NaN, Infinity, -Infinity, -1, -0, 0, .000999, 10000.001]) refuses(() => m.sketch.circle({ center: [0, 0], radius }), 'PARAMETER');
  for (const axis of [0, 1]) for (const coordinate of [NaN, Infinity, -Infinity, 10001, -10001, 10000, -10000]) {
    const center = [0, 0]; center[axis] = coordinate; refuses(() => m.sketch.circle({ center, radius: 1 }), 'PARAMETER');
  }
  const tooSmall = m.dimension.scale(m.parameter('small', .001), .5);
  refuses(() => m.sketch.circle({ center: [0, 0], radius: tooSmall }), 'PARAMETER');
  const overflowingPole = m.dimension.add(m.parameter('edge', 9999), 1);
  refuses(() => m.sketch.circle({ center: [overflowingPole, 0], radius: 1 }), 'PARAMETER');
  const sketch = m.sketch.circle({ center: [-0, 0], radius: .001 });
  for (const height of [NaN, Infinity, -Infinity, -1, -0, 0, .000999, 10000.001, tooSmall]) refuses(() => sketch.extrude(height), 'PARAMETER');
  assert.ok(Object.isFrozen(sketch.extrude(.001))); assert.ok(Object.isFrozen(sketch.extrude(10000)));
  refuses(() => sketch.extrude(1), 'CAPABILITY');
  assert.ok(Object.isFrozen(m.sketch.circle({ center: [0, 0], radius: 10000 })));
  refuses(() => circle(m), 'CAPABILITY');
  assert.equal(CadModelLimits.nodes, 6); assert.equal(CadModelLimits.sketches, 2); assert.equal(CadModelLimits.extrusions, 2);
});

test('circle handles and copied body tags cannot cross the private ownership boundary', () => {
  const { m, post, box } = pair(), other = pair();
  for (const bad of [{ ...post }, { family: 'stored-rational-circle-prism', native: {} }, other.post, null]) {
    refuses(() => m.build({ post: bad }), 'OWNERSHIP');
    refuses(() => box.intersect(bad), 'OWNERSHIP'); refuses(() => box.cut(bad), 'OWNERSHIP');
    refuses(() => box.cut(bad, { axis: 'x' }), 'OWNERSHIP'); refuses(() => box.union(bad), 'OWNERSHIP');
  }
  twoRemainingNodes(box);
});

test('every unsupported circle operand order refuses before geometry and leaves both spare node slots usable', () => {
  const actions = [
    ({ post, box }) => post.cut(box), ({ post, box }) => box.cut(post),
    ({ post, box }) => post.cut(box, { axis: 'x' }), ({ post, box }) => box.cut(post, { axis: 'x' }),
    ({ post, box }) => post.intersect(box), ({ post, box }) => box.intersect(post),
    ({ post, box }) => post.union(box), ({ post, box }) => box.union(post),
    ({ post }) => post.hole({ center: [2, -3], radius: 1 }),
    ({ post }) => post.split({ axis: 'z', at: 3 }), ({ post }) => post.split({ plane: 'x+y', at: 1 }),
    ({ post }) => post.edges({ parallelTo: 'x' }), ({ post }) => post.edges({}),
    ({ post, box }) => post.chamfer(box.edges({ parallelTo: 'x' }).one(), 1),
    ({ post }) => post.chamfer({ kind: 'edge-selection' }, 1),
  ];
  for (const action of actions) { const p = pair(); refuses(() => action(p), 'CAPABILITY'); twoRemainingNodes(p.box); }
});

const document = () => { const d = authoredDocument(CASES.initial.parameters); d.outputs.post.side = 'negative'; return d; };
const check = (edit = () => {}, code = 'INPUT', operation) => { const d = document(); edit(d); refuses(() => cad.load(signedData(d)), code, operation); };
test('valid circle codec reaches output sentinel; exact fields, profiles and references reject before native work', () => {
  check(() => {}, 'INPUT', 'body');
  for (const name of ['kind', 'profile', 'center', 'radius']) check(d => { delete d.nodes[0][name]; }, name === 'kind' ? 'CAPABILITY' : ['INPUT', 'CAPABILITY']);
  for (const name of ['points', 'min', 'max', 'options', 'native', 'source', 'evidence']) check(d => { d.nodes[0][name] = []; });
  for (const profile of ['ellipse', 'quarter-arc', '', null, 0]) check(d => { d.nodes[0].profile = profile; }, ['INPUT', 'CAPABILITY']);
  for (const center of [[], [0], [0, 0, 0]]) check(d => { d.nodes[0].center = center; }, 'BUDGET');
  for (const center of [null, {}, 'xy']) check(d => { d.nodes[0].center = center; });
  for (const slot of ['centerX', 'centerY', 'radius', 'height']) {
    const change = (d, value) => { if (slot === 'height') d.nodes[1].height = value; else if (slot === 'radius') d.nodes[0].radius = value; else d.nodes[0].center[slot === 'centerX' ? 0 : 1] = value; };
    check(d => change(d, { parameter: 'missing' }), 'PARAMETER');
    for (const bad of [{ parameter: 'height', extra: 1 }, { op: 'scale', value: 1 }, { op: 'multiply', value: 1, factor: 2 }, null, '1']) check(d => change(d, bad), 'INPUT');
  }
  for (const ref of [-1, -0, 1, 2, .5, '0', null]) check(d => { d.nodes[1].sketch = ref; });
  for (const name of ['sketch', 'height']) check(d => { delete d.nodes[1][name]; });
  for (const name of ['profile', 'center', 'native', 'options']) check(d => { d.nodes[1][name] = 'circle'; });
  for (const ref of [-1, -0, 0, 2, .5, '1']) check(d => { d.outputs.post = { node: ref, side: 'solid' }; });
  for (const name of ['evidence', 'bodies', 'recomputation', 'cache']) check(d => { d[name] = {}; });
  check(d => { d.nodes.push({ kind: 'extrude', sketch: 1, height: 1 }); });
});

test('codec validates all used circle driver ranges before the output sentinel', () => {
  for (const name of ['centerX', 'centerY']) for (const value of [10000, -10000, 10001, -10001]) check(d => { d.parameters[name] = value; }, 'PARAMETER');
  for (const value of [-1, -0, 0, .001, 10001]) check(d => { d.parameters.diameter = value; }, 'PARAMETER');
  for (const value of [-1, -0, 0, .000999, 10001]) check(d => { d.parameters.height = value; }, 'PARAMETER');
  check(d => { d.nodes[0].radius = { op: 'add', left: 10000, right: 1 }; }, 'PARAMETER');
  check(d => { d.parameters = { centerX: -0, centerY: .25, diameter: 1, height: 1.5 }; }, 'INPUT', 'body');
  check(d => { d.parameters = { centerX: 0, centerY: 0, diameter: .002, height: .001 }; }, 'INPUT', 'body');
});

test('codec rejects every unsupported circle ancestry in both operand positions before native work', () => {
  for (const reverse of [false, true]) {
    const circleRef = { node: 1, side: 'solid' }, boxRef = { node: 3, side: 'solid' };
    const [left, right] = reverse ? [boxRef, circleRef] : [circleRef, boxRef];
    const operations = [
      { kind: 'cut', parent: left, tool: right, axis: 'x' }, { kind: 'difference', parent: left, tool: right },
      { kind: 'intersect', left, right }, { kind: 'union', left, right },
      { kind: 'hole', parent: circleRef, center: [2, -3], radius: 1 },
      { kind: 'split', parent: circleRef, axis: 'z', at: 3 }, { kind: 'split', parent: circleRef, plane: 'x+y', at: 1 },
      { kind: 'chamfer', parent: circleRef, edge: { parallelTo: 'x' }, distance: 1 },
      { kind: 'chamfer', parent: circleRef, edge: {}, distance: 1, name: 'finish', suppressed: true },
    ];
    for (const operation of operations) check(d => {
      d.nodes.push({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 24] }, { kind: 'extrude', sketch: 2, height: 8 }, operation);
      d.outputs.post = { node: 4, side: operation.kind === 'cut' || operation.kind === 'split' ? 'negative' : 'solid' };
    }, 'CAPABILITY');
  }
});
