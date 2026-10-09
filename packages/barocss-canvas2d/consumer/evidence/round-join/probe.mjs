import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene } from '../../../dist/index.js';
import { validateScene } from '../../../dist/schema.js';
import { tessellatePath } from '../../../dist/path.js';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const blue = [0, 0, 1, 1];
const turn = [{ kind: 'M', x: 20, y: 20 }, { kind: 'L', x: 40, y: 20 }, { kind: 'L', x: 40, y: 40 }];
const straight = [{ kind: 'M', x: 20, y: 20 }, { kind: 'L', x: 30, y: 20 }, { kind: 'L', x: 40, y: 20 }];
const reverse = [{ kind: 'M', x: 20, y: 20 }, { kind: 'L', x: 40, y: 20 }, { kind: 'L', x: 20, y: 20 }];
const closed = [...turn, { kind: 'L', x: 20, y: 40 }, { kind: 'Z' }];
const scene = (version, stroke, commands = turn) => ({ version, unit: 'logical-px', contextId: 'JoinProbe', nodes: [{
  kind: 'path', id: 'P', layer: 0, transform: pose, visible: true, alpha: 1, hitMode: 'auto',
  commands, stroke,
}] });
const stroke = (join = 'round') => ({ color: blue, width: 10, cap: 'butt', join });
const code = (fn, expected) => {
  assert.throws(fn, error => error && error.code === expected);
};
const v18 = validateScene(scene(18, { color: blue, width: 10, cap: 'butt' }));
assert.equal(v18.version, 18);
code(() => validateScene(scene(18, stroke())), 'INVALID_SCENE');
code(() => validateScene(scene(19, { color: blue, width: 10, cap: 'butt' })), 'INVALID_SCENE');
code(() => validateScene(scene(19, { ...stroke(), join: 'miter' })), 'INVALID_SCENE');
code(() => validateScene(scene(19, { ...stroke(), extra: true })), 'INVALID_SCENE');
const accepted = validateScene(scene(19, stroke()));
const matrix = [1, 0, 0, 1, 0, 0], view = { panX: 0, panY: 0, zoom: 1 };
const mesh = (commands, join, tolerance = 0.25, currentView = view) =>
  tessellatePath(validateScene(scene(19, stroke(join), commands)).nodes[0], matrix, currentView, 2, tolerance);
assert.ok(mesh(turn, 'round').observation.vertices > mesh(turn, 'bevel').observation.vertices);
assert.equal(mesh(straight, 'round').observation.vertices, mesh(straight, 'bevel').observation.vertices);
assert.ok(mesh(reverse, 'round').observation.vertices > mesh(reverse, 'bevel').observation.vertices);
assert.ok(mesh(closed, 'round').observation.vertices > mesh(closed, 'bevel').observation.vertices);
code(() => mesh(turn, 'round', 1e-12, { ...view, zoom: 1000 }), 'SCENE_LIMIT');
const tree = createDisplayTree('JoinProbe');
const handle = tree.createPath({ id: 'P', layer: 0, transform: pose, commands: turn,
  stroke: { color: blue, width: 10 } });
tree.stage.addChild(handle);
assert.deepEqual(handle.data.stroke, stroke('bevel'));
const before = JSON.stringify(tree.snapshot());
code(() => handle.setPath({ commands: turn, stroke: { ...stroke(), join: 'miter' } }), 'INVALID_SCENE');
assert.equal(JSON.stringify(tree.snapshot()), before);
const joinOnly = tree.createPath({ id: 'Q', layer: 1, transform: pose, commands: turn,
  stroke: { color: blue, width: 10, join: 'round' } });
assert.deepEqual(joinOnly.data.stroke, stroke('round'));
const angle = Math.PI / 4;
const transformed = { x: 70, y: 20, scaleX: 1.5, scaleY: 0.75, rotation: angle };
const transformedTree = createDisplayTree('BoundsProbe');
const transformedHandle = transformedTree.createPath({ id: 'Turned', layer: 0, transform: transformed,
  commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 }, { kind: 'L', x: 10, y: 20 }],
  stroke: stroke() });
const transformedMatrix = [Math.cos(angle) * 1.5, Math.sin(angle) * 1.5,
  -Math.sin(angle) * 0.75, Math.cos(angle) * 0.75, 70, 20];
const transformedMesh = tessellatePath({ kind: 'path', ...transformedHandle.data },
  transformedMatrix, view, 2, 1);
const bounds = transformedHandle.getWorldBounds();
assert.ok(bounds);
for (let i = 0; i < transformedMesh.vertices.length; i += 2) {
  const x = transformedMesh.vertices[i], y = transformedMesh.vertices[i + 1];
  assert.ok(x >= bounds.x - 1e-6 && x <= bounds.x + bounds.width + 1e-6);
  assert.ok(y >= bounds.y - 1e-6 && y <= bounds.y + bounds.height + 1e-6);
}
const older = createDisplayTreeFromScene(v18);
assert.equal(older.snapshot().nodes[0].stroke.join, 'bevel');
assert.equal(accepted.version, 19);
console.log(JSON.stringify({ v18: 'accepted', v18Join: 'rejected', v19Required: 'checked',
  publicDefault: handle.data.stroke.join, joinOnlyCap: joinOnly.data.stroke.cap,
  transformedVerticesWithinWorldBounds: true, atomicInvalid: true,
  vertices: { bevel: mesh(turn, 'bevel').observation.vertices,
    round: mesh(turn, 'round').observation.vertices,
    reversal: mesh(reverse, 'round').observation.vertices,
    closed: mesh(closed, 'round').observation.vertices }, resourceLimit: 'SCENE_LIMIT' }));
