import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene } from '../../../dist/index.js';
import { validateScene } from '../../../dist/schema.js';
import { tessellatePath } from '../../../dist/path.js';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const color = [0, 0, 1, 1];
const line = [{ kind: 'M', x: 0, y: 20 }, { kind: 'L', x: 50, y: 20 }];
const corners = [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 },
  { kind: 'L', x: 10, y: 10 }, { kind: 'L', x: 0, y: 10 }, { kind: 'Z' }];
const dash = (lengths = [10, 10], offset = 0) => ({ lengths, offset });
const stroke = (pattern = dash()) => ({ color, width: 4, cap: 'butt', join: 'bevel', dash: pattern });
const scene = (version, paint, commands = line) => ({ version, unit: 'logical-px', contextId: 'DashProbe',
  nodes: [{ kind: 'path', id: 'P', layer: 0, transform: pose, visible: true, alpha: 1,
    hitMode: 'auto', commands, stroke: paint }] });
const code = (fn, expected) => assert.throws(fn, error => error?.code === expected);
const mesh = (paint, commands = line) => tessellatePath(validateScene(scene(20, paint, commands)).nodes[0],
  [1, 0, 0, 1, 0, 0], { panX: 0, panY: 0, zoom: 1 }, 2, 0.25);
const xs = geometry => [...new Set(Array.from(geometry.vertices).filter((_, index) => index % 2 === 0))].sort((a, b) => a - b);

assert.equal(validateScene(scene(19, { color, width: 4, cap: 'butt', join: 'bevel' })).version, 19);
code(() => validateScene(scene(19, stroke())), 'INVALID_SCENE');
code(() => validateScene(scene(20, { color, width: 4, cap: 'butt', join: 'bevel' })), 'INVALID_SCENE');
for (const pattern of [dash([10], 0), dash([0.1, 10], 0), dash([1000, 1000, 1000, 1000, 1000, 1000], 0),
  dash([10, 10], -0), dash([], 1), dash([10, 10], 4097), { ...dash(), extra: true },
  { lengths: [10, , 10, 10], offset: 0 }, Object.assign(Object.create({}), dash())]) {
  code(() => validateScene(scene(20, stroke(pattern))), 'INVALID_SCENE');
}
assert.deepEqual(xs(mesh(stroke())), [0, 10, 20, 30, 40, 50]);
assert.equal(mesh(stroke()).observation.vertices, 18);
assert.deepEqual(xs(mesh(stroke(dash([10, 10], 5)))), [0, 5, 15, 25, 35, 45]);
assert.deepEqual(xs(mesh(stroke(dash([10, 10], -5)))), [5, 15, 25, 35, 45, 50]);
assert.equal(mesh(stroke(), [{ kind: 'M', x: 0, y: 20 }, { kind: 'L', x: 10, y: 20 },
  { kind: 'L', x: 20, y: 20 }]).observation.vertices, 6);
const rounded = pattern => ({ ...stroke(pattern), cap: 'round', join: 'round' });
const seamCrossing = [{ kind: 'M', x: 5, y: 10 }, { kind: 'L', x: 0, y: 10 },
  { kind: 'L', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 }, { kind: 'L', x: 10, y: 7 }];
assert.deepEqual(mesh(rounded(dash([17, 8])), corners).vertices,
  mesh(rounded(dash([], 0)), seamCrossing).vertices);
const seamCut = [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 },
  { kind: 'L', x: 10, y: 6 }, { kind: 'M', x: 6, y: 10 },
  { kind: 'L', x: 0, y: 10 }, { kind: 'L', x: 0, y: 0 }];
assert.deepEqual(mesh(rounded(dash([16, 8])), corners).vertices,
  mesh(rounded(dash([], 0)), seamCut).vertices);
assert.deepEqual(mesh(rounded(dash([100, 1])), corners).vertices,
  mesh(rounded(dash([], 0)), corners).vertices);
assert.equal(mesh(stroke(dash([1, 100], 1)), corners).vertices.length, 0);
assert.equal(mesh(stroke(), [...line, { kind: 'M', x: 0, y: 40 },
  { kind: 'L', x: 50, y: 40 }]).observation.vertices, 36);
code(() => mesh(stroke(dash([0.25, 0.25])), [{ kind: 'M', x: 0, y: 20 },
  { kind: 'L', x: 2000, y: 20 }]), 'SCENE_LIMIT');

const tree = createDisplayTree('DashProbe');
const lengths = [10, 10];
const handle = tree.createPath({ id: 'P', layer: 0, transform: pose, commands: line,
  stroke: stroke(dash(lengths)) });
tree.stage.addChild(handle);
lengths[0] = 5;
assert.deepEqual(handle.data.stroke.dash.lengths, [10, 10]);
assert.equal(tree.snapshot().version, 20);
const prior = JSON.stringify(tree.snapshot());
code(() => handle.setPath({ commands: line, stroke: stroke(dash([10], 0)) }), 'INVALID_SCENE');
assert.equal(JSON.stringify(tree.snapshot()), prior);
code(() => handle.setPath({ commands: [{ kind: 'M', x: 0, y: 20 },
  { kind: 'L', x: 2000, y: 20 }], stroke: stroke(dash([0.25, 0.25])) }), 'SCENE_LIMIT');
assert.equal(JSON.stringify(tree.snapshot()), prior);
const restored = createDisplayTreeFromScene(tree.snapshot());
assert.deepEqual(restored.get('P').data.stroke.dash, dash());
const older = createDisplayTreeFromScene(validateScene(scene(19, { color, width: 4, cap: 'butt', join: 'bevel' })));
assert.deepEqual(older.get('P').data.stroke.dash, dash([], 0));
console.log(JSON.stringify({ version: 20, solidDefault: older.get('P').data.stroke.dash,
  onVertices: mesh(stroke()).observation.vertices, cutAtVertexVertices: 6,
  copiedPattern: handle.data.stroke.dash, closedSeam: 'joined/capped',
  refusal: 'INVALID_SCENE/SCENE_LIMIT' }));
