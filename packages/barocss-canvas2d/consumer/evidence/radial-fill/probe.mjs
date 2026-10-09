import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene } from '../../../dist/index.js';
import { validateScene } from '../../../dist/schema.js';
import { tessellatePath } from '../../../dist/path.js';

const transform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const commands = [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 20, y: 0 },
  { kind: 'L', x: 20, y: 20 }, { kind: 'L', x: 0, y: 20 }, { kind: 'Z' }];
const solid = { rule: 'evenodd', color: [1, 0, 0, 1] };
const linear = { rule: 'evenodd', linear: { from: { x: 0, y: 0 }, to: { x: 20, y: 0 },
  startColor: [1, 0, 0, 1], endColor: [0, 0, 1, 0] } };
const radial = { rule: 'evenodd', radial: { center: { x: 10, y: 10 }, radius: 10,
  startColor: [1, 0, 0, 0], endColor: [0, 0, 1, 1] } };
const scene = (version, fill) => ({ version, unit: 'logical-px', contextId: 'RadialProbe',
  nodes: [{ kind: 'path', id: 'P', layer: 0, transform, visible: true, alpha: 1,
    hitMode: 'auto', commands, fill }] });
const rejects = (fn, expected) => assert.throws(fn, error => error?.code === expected);
assert.equal(validateScene(scene(22, solid)).version, 22);
assert.equal(validateScene(scene(22, linear)).version, 22);
rejects(() => validateScene(scene(22, radial)), 'INVALID_SCENE');
const accepted = validateScene(scene(23, radial));
assert.deepEqual(accepted.nodes[0].fill, radial);
for (const rule of ['evenodd', 'nonzero']) {
  const node = validateScene(scene(23, { ...radial, rule })).nodes[0];
  const geometry = tessellatePath(node, [1, 0, 0, 1, 0, 0],
    { panX: 0, panY: 0, zoom: 1 }, 2, 0.25);
  assert(geometry.fill && geometry.fill.coverVertices.length > 0);
}
radial.radial.startColor[0] = 0.5;
assert.equal(accepted.nodes[0].fill.radial.startColor[0], 1);
const invalid = [
  { ...radial, color: solid.color },
  { ...radial, linear: linear.linear },
  { ...radial, extra: true },
  { ...radial, radial: { ...radial.radial, radius: 0 } },
  { ...radial, radial: { ...radial.radial, radius: 0.0009 } },
  { ...radial, radial: { ...radial.radial, radius: -0 } },
  { ...radial, radial: { ...radial.radial, center: { x: -0, y: 10 } } },
  { ...radial, radial: { ...radial.radial, center: { x: 1e6 + 1, y: 10 } } },
  { ...radial, radial: { ...radial.radial, endColor: [0, 0, 1, 2] } },
  { ...radial, radial: { ...radial.radial, endColor: [0, , 1, 1] } },
  { ...radial, radial: { ...radial.radial, center: { x: 10, y: 10, z: 0 } } },
];
for (const fill of invalid) rejects(() => validateScene(scene(23, fill)), 'INVALID_SCENE');
const cyclic = { ...radial, radial: { ...radial.radial } };
cyclic.radial.center = cyclic.radial;
rejects(() => validateScene(scene(23, cyclic)), 'INVALID_SCENE');
const tree = createDisplayTree('RadialProbe');
const path = tree.createPath({ id: 'P', layer: 0, transform, commands, fill: radial });
tree.stage.addChild(path);
assert.equal(tree.snapshot().version, 23);
const before = JSON.stringify(tree.snapshot());
rejects(() => path.setPath({ commands, fill: invalid[3] }), 'INVALID_SCENE');
assert.equal(JSON.stringify(tree.snapshot()), before);
path.setPath({ commands, fill: { ...radial, rule: 'nonzero' } });
assert.equal(tree.snapshot().nodes[0].fill.rule, 'nonzero');
assert.deepEqual(createDisplayTreeFromScene(tree.snapshot()).get('P').data.fill, path.data.fill);
assert.deepEqual(createDisplayTreeFromScene(validateScene(scene(22, linear))).get('P').data.fill, linear);
console.log(JSON.stringify({ version: 23, refusals: invalid.length + 3,
  priorFills: true, bothFillRules: true, copiedStops: true, reconstruction: true }));
