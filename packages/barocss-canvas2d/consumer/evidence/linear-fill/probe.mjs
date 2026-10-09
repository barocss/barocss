import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene } from '../../../dist/index.js';
import { validateScene } from '../../../dist/schema.js';
import { tessellatePath } from '../../../dist/path.js';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const commands = [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 20, y: 0 },
  { kind: 'L', x: 20, y: 20 }, { kind: 'L', x: 0, y: 20 }, { kind: 'Z' }];
const rule = 'evenodd';
const solid = { rule, color: [1, 0, 0, 1] };
const linear = { rule, linear: { from: { x: 0, y: 0 }, to: { x: 20, y: 0 },
  startColor: [1, 0, 0, 1], endColor: [0, 0, 1, 0] } };
const scene = (version, fill) => ({ version, unit: 'logical-px', contextId: 'LinearProbe',
  nodes: [{ kind: 'path', id: 'P', layer: 0, transform: pose, visible: true, alpha: 1,
    hitMode: 'auto', commands, fill }] });
const code = (fn, expected) => assert.throws(fn, error => error?.code === expected);

assert.equal(validateScene(scene(21, solid)).version, 21);
code(() => validateScene(scene(21, linear)), 'INVALID_SCENE');
assert.equal(validateScene(scene(22, solid)).version, 22);
const accepted = validateScene(scene(22, linear));
assert.deepEqual(accepted.nodes[0].fill, linear);
for (const fillRule of ['evenodd', 'nonzero']) {
  const node = validateScene(scene(22, { ...linear, rule: fillRule })).nodes[0];
  const geometry = tessellatePath(node, [1, 0, 0, 1, 0, 0],
    { panX: 0, panY: 0, zoom: 1 }, 2, 0.25);
  assert(geometry.fill && geometry.fill.coverVertices.length > 0);
}
linear.linear.startColor[0] = 0.5;
assert.equal(accepted.nodes[0].fill.linear.startColor[0], 1);
const invalid = [
  { ...linear, color: [1, 0, 0, 1] },
  { ...linear, extra: true },
  { ...linear, linear: { ...linear.linear, from: { x: 0, y: 0 }, to: { x: 0.0001, y: 0 } } },
  { ...linear, linear: { ...linear.linear, from: { x: -0, y: 0 } } },
  { ...linear, linear: { ...linear.linear, to: { x: 1e6 + 1, y: 0 } } },
  { ...linear, linear: { ...linear.linear, endColor: [0, 0, 1, 2] } },
  { ...linear, linear: { ...linear.linear, endColor: [0, 0, 1] } },
  { ...linear, linear: { ...linear.linear, to: { x: 20, y: 0, extra: 1 } } },
  { ...linear, linear: { ...linear.linear, startColor: [0, , 0, 1] } },
];
for (const fill of invalid) code(() => validateScene(scene(22, fill)), 'INVALID_SCENE');
const tree = createDisplayTree('LinearProbe');
const handle = tree.createPath({ id: 'P', layer: 0, transform: pose, commands, fill: linear });
tree.stage.addChild(handle);
assert.equal(tree.snapshot().version, 22);
const before = JSON.stringify(tree.snapshot());
code(() => handle.setPath({ commands, fill: invalid[2] }), 'INVALID_SCENE');
assert.equal(JSON.stringify(tree.snapshot()), before);
handle.setPath({ commands, fill: { ...linear, rule: 'nonzero' } });
assert.equal(tree.snapshot().nodes[0].fill.rule, 'nonzero');
assert.deepEqual(createDisplayTreeFromScene(tree.snapshot()).get('P').data.fill, handle.data.fill);
assert.deepEqual(createDisplayTreeFromScene(validateScene(scene(21, solid))).get('P').data.fill, solid);
console.log(JSON.stringify({ version: 22, refusals: invalid.length + 1,
  solidCompatibility: true, bothFillRules: true, copiedStops: true, reconstruction: true }));
