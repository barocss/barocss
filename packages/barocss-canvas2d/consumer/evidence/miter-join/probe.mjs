import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene } from '../../../dist/index.js';
import { validateScene } from '../../../dist/schema.js';
import { tessellatePath } from '../../../dist/path.js';

const transform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const commands = [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 }, { kind: 'L', x: 10, y: 10 }];
const base = { color: [0, 0, 1, 1], width: 4, cap: 'butt', dash: { lengths: [], offset: 0 } };
const stroke = (join = 'miter', miterLimit = 4, dash = base.dash) => ({ ...base, join, miterLimit, dash });
const scene = (version, paint, path = commands) => ({ version, unit: 'logical-px', contextId: 'MiterProbe',
  nodes: [{ kind: 'path', id: 'P', layer: 0, transform, visible: true, alpha: 1,
    hitMode: 'auto', commands: path, stroke: paint }] });
const code = (fn, expected) => assert.throws(fn, error => error?.code === expected);
const mesh = (paint, path = commands, matrix = [1, 0, 0, 1, 0, 0]) =>
  tessellatePath(validateScene(scene(21, paint, path)).nodes[0], matrix,
    { panX: 0, panY: 0, zoom: 1 }, 2, 0.25).vertices;
const points = vertices => Array.from({ length: vertices.length / 2 }, (_, index) =>
  [vertices[index * 2], vertices[index * 2 + 1]]);

assert.equal(validateScene(scene(20, { ...base, join: 'bevel' })).version, 20);
code(() => validateScene(scene(20, stroke())), 'INVALID_SCENE');
code(() => validateScene(scene(20, { ...base, join: 'miter' })), 'INVALID_SCENE');
code(() => validateScene(scene(21, { ...base, join: 'bevel' })), 'INVALID_SCENE');
for (const limit of [0.99, 16.01, -0, NaN, Infinity, '4', null]) {
  code(() => validateScene(scene(21, stroke('miter', limit))), 'INVALID_SCENE');
}
code(() => validateScene(scene(21, { ...stroke(), extra: 1 })), 'INVALID_SCENE');
code(() => validateScene(scene(21, stroke('unknown'))), 'INVALID_SCENE');
const bevel = mesh(stroke('bevel'));
const miter = mesh(stroke());
assert.equal(bevel.length, 30);
assert.equal(miter.length, 36);
assert(points(miter).some(([x, y]) => x === 12 && y === -2));
assert.deepEqual(mesh(stroke('miter', 1)), bevel);
assert.deepEqual(mesh(stroke('bevel', 16)), bevel);
const rounded = mesh(stroke('round', 4));
assert.deepEqual(mesh(stroke('round', 16)), rounded);
const shallowTurn = [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 },
  { kind: 'L', x: 20, y: 10 }];
const sharpTurn = [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 },
  { kind: 'L', x: 0, y: 10 }];
assert(mesh(stroke(), shallowTurn).length > mesh(stroke('bevel'), shallowTurn).length);
assert.deepEqual(mesh(stroke('miter', 2), sharpTurn), mesh(stroke('bevel'), sharpTurn));
assert(mesh(stroke('miter', 4), sharpTurn).length > mesh(stroke('bevel'), sharpTurn).length);
const reversal = [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 }, { kind: 'L', x: 0, y: 0 }];
assert.deepEqual(mesh(stroke('miter'), reversal), mesh(stroke('bevel'), reversal));
const closed = [...commands, { kind: 'L', x: 0, y: 10 }, { kind: 'Z' }];
assert(mesh(stroke('miter'), closed).length > mesh(stroke('bevel'), closed).length);
const cut = { lengths: [10, 10], offset: 0 };
assert.deepEqual(mesh(stroke('miter', 4, cut)), mesh(stroke('bevel', 4, cut)));
const crossing = { lengths: [11, 10], offset: 0 };
assert(mesh(stroke('miter', 4, crossing)).length > mesh(stroke('bevel', 4, crossing)).length);
code(() => mesh(stroke(), commands, [1e10, 0, 0, 1e10, 0, 0]), 'SCENE_LIMIT');

const tree = createDisplayTree('MiterProbe');
const handle = tree.createPath({ id: 'P', layer: 0, transform, commands,
  stroke: { color: base.color, width: 4 } });
tree.stage.addChild(handle);
assert.equal(tree.snapshot().version, 21);
assert.deepEqual(handle.data.stroke, { ...base, join: 'bevel', miterLimit: 4 });
const prior = JSON.stringify(tree.snapshot());
code(() => handle.setPath({ commands, stroke: stroke('miter', 17) }), 'INVALID_SCENE');
assert.equal(JSON.stringify(tree.snapshot()), prior);
handle.setPath({ commands, stroke: stroke() });
assert.equal(handle.data.stroke.join, 'miter');
assert.equal(createDisplayTreeFromScene(tree.snapshot()).get('P').data.stroke.miterLimit, 4);
const old = createDisplayTreeFromScene(validateScene(scene(20, { ...base, join: 'bevel' })));
assert.equal(old.get('P').data.stroke.miterLimit, 4);
console.log(JSON.stringify({ version: 21, bevelVertices: bevel.length / 2,
  miterVertices: miter.length / 2, miterTip: [12, -2], fallback: true,
  dashCut: true, closedSeam: true, refusal: 'INVALID_SCENE/SCENE_LIMIT' }));
