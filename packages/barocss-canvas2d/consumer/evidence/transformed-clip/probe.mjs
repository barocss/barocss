import assert from 'node:assert/strict';
import { Canvas2DRenderer, createDisplayTree, createDisplayTreeFromScene,
  parseSceneJSON, stringifySceneJSON } from '../../../dist/index.js';
import { validateScene } from '../../../dist/schema.js';

const pose = (x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1) =>
  ({ x, y, rotation, scaleX, scaleY });
const refuses = (fn, code) => assert.throws(fn, error => error?.code === code);
const tree = createDisplayTree('TransformedClipProbe');
tree.stage.addChild(tree.createRect({ id: 'Back', layer: -1, transform: pose(),
  width: 240, height: 180, fill: [0.25, 0.25, 0.25, 1] }));
const frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose(65, 55, Math.PI / 6),
  pivot: { x: 40, y: 28 }, width: 80, height: 56, fill: [0, 0, 0, 0], clip: true });
frame.addChild(tree.createRect({ id: 'Child', layer: 0, transform: pose(-30, -30),
  width: 140, height: 116, fill: [1, 0, 0, 1] }));
frame.addChild(tree.createContainer({ id: 'Area', layer: 1, transform: pose(),
  hitArea: { x: -20, y: -20, width: 40, height: 32 } }));
tree.stage.addChild(frame);
tree.stage.addChild(tree.createRect({ id: 'Following', layer: 1, transform: pose(125, 12),
  width: 30, height: 22, fill: [1, 0.5, 0, 1] }));
const accepted = tree.snapshot();
assert.equal(accepted.version, 25);
assert.equal(validateScene({...accepted,version:24}).version,24);
const legacyTurned = structuredClone(accepted); legacyTurned.version = 23;
refuses(() => validateScene(legacyTurned), 'INVALID_SCENE');
const legacyAxes = structuredClone(legacyTurned); legacyAxes.nodes[1].transform.rotation = 0;
assert.equal(validateScene(legacyAxes).version, 23);
assert.equal(createDisplayTreeFromScene(legacyAxes).snapshot().version, 25);

// Older schemas refuse a rotated ancestor even when the descendant cancels it.
const cancellation = createDisplayTree('LegacyCancellation');
const parent = cancellation.createContainer({ id: 'Parent', layer: 0, transform: pose(0, 0, 0.5) });
const canceled = cancellation.createFrame({ id: 'Canceled', layer: 0, transform: pose(0, 0, -0.5),
  width: 20, height: 20, fill: [1, 0, 0, 1], clip: true });
cancellation.stage.addChild(parent); parent.addChild(canceled);
const v24Cancel = cancellation.snapshot(); validateScene(v24Cancel);
const v23Cancel = structuredClone(v24Cancel); v23Cancel.version = 23;
refuses(() => validateScene(v23Cancel), 'INVALID_SCENE');

const before = stringifySceneJSON(tree.snapshot());
for (const bad of [0, NaN, Infinity, -1]) {
  refuses(() => frame.setFrame({ width: bad, height: 56, fill: [0, 0, 0, 0], clip: true }), 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), before);
}
refuses(() => frame.setTransform({ ...frame.data.transform, scaleX: 0 }), 'INVALID_SCENE');
assert.equal(stringifySceneJSON(tree.snapshot()), before);
const extra = structuredClone(accepted); extra.nodes[1].mask = 'Unknown';
refuses(() => validateScene(extra), 'INVALID_SCENE');
const missing = structuredClone(accepted); delete missing.nodes[1].clip;
refuses(() => validateScene(missing), 'INVALID_SCENE');

// A JSON round trip constructs new public handles. Returned data remains copied.
const restored = createDisplayTreeFromScene(parseSceneJSON(before));
assert.equal(stringifySceneJSON(restored.snapshot()), before);
assert.notEqual(restored.get('Frame'), frame);
const copy = restored.get('Frame').data; copy.transform.rotation = 0; copy.pivot.x = 0;
assert.equal(restored.get('Frame').data.transform.rotation, Math.PI / 6);
assert.deepEqual(restored.get('Frame').data.pivot, { x: 40, y: 28 });
accepted.nodes[1].transform.rotation = 0;
assert.equal(frame.data.transform.rotation, Math.PI / 6);
restored.get('Frame').setRotation(Math.PI / 4);
assert.equal(restored.snapshot().nodes[1].transform.rotation, Math.PI / 4);
for (let version = 6; version <= 25; version++) {
  assert.equal(createDisplayTreeFromScene({ version, unit: 'logical-px', contextId: 'Empty', nodes: [] })
    .snapshot().version, 25);
}

// Reuse the focused renderer-state technique from renderer-point-conversion-probe.
// This checks CPU compile/admission/hits. It does not create or test a GPU context.
function cpuRenderer() {
  const renderer = Object.create(Canvas2DRenderer.prototype);
  Object.assign(renderer, { disposed: false, lost: false, stencilBits: 8,
    scene: { version: 0, unit: 'logical-px', contextId: 'Empty', nodes: [] }, draws: [],
    view: { panX: 0, panY: 0, zoom: 1 }, size: { width: 240, height: 180 },
    dpr: 2, tolerance: 0.25, assets: new Map() });
  return renderer;
}
const renderer = cpuRenderer(); renderer.updateScene(tree.snapshot());
assert.equal(renderer.hitTest(frame.toWorld({ x: 25, y: 20 }))?.id, 'Child');
assert.equal(renderer.hitTest(frame.toWorld({ x: 8, y: 8 }))?.id, 'Area');
assert.equal(renderer.hitTest({ x: 25, y: 25 })?.id, 'Back');
assert.equal(renderer.hitTest({ x: 140, y: 22 })?.id, 'Following');
const bounds = frame.getWorldBounds(); assert(bounds);
assert(25 >= bounds.x && 25 <= bounds.x + bounds.width && 25 >= bounds.y && 25 <= bounds.y + bounds.height);
const outside = frame.toLocal({ x: 25, y: 25 }); assert(outside.x < 0 || outside.y < 0);

const nested = createDisplayTree('NestedClipProbe');
const outer = nested.createFrame({ id: 'Outer', layer: 0, transform: pose(180, 125, -0.25, -1.2, 0.85),
  pivot: { x: 20, y: 20 }, width: 52, height: 50, fill: [0.1, 0.1, 0.1, 1], clip: true });
const inner = nested.createFrame({ id: 'Inner', layer: 0, transform: pose(12, 8, 0.6, 1, 1.2),
  pivot: { x: 10, y: 8 }, width: 64, height: 42, fill: [0, 0, 0, 0], clip: true });
const pass = nested.createFrame({ id: 'Pass', layer: 0, transform: pose(), width: 64, height: 42,
  fill: [0, 0, 0, 0], clip: false });
pass.addChild(nested.createRect({ id: 'Leaf', layer: 0, transform: pose(-10, -10),
  width: 90, height: 62, fill: [0, 1, 1, 1] }));
nested.stage.addChild(outer); outer.addChild(inner); inner.addChild(pass);
renderer.updateScene(nested.snapshot());
assert.equal(renderer.hitTest(inner.toWorld({ x: 20, y: 16 }))?.id, 'Leaf');
assert.equal(renderer.hitTest(inner.toWorld({ x: -4, y: 8 }))?.id, 'Outer');
assert.equal(renderer.hitTest(inner.toWorld({ x: 55, y: 30 })), null);
const origin = inner.toWorld({ x: 0, y: 0 }), x = inner.toWorld({ x: 1, y: 0 }), y = inner.toWorld({ x: 0, y: 1 });
assert(Math.abs((x.x - origin.x) * (y.x - origin.x) + (x.y - origin.y) * (y.y - origin.y)) > 0.01);
const worldBounds = inner.getWorldBounds(); assert(worldBounds);
assert.equal(inner.getLocalBounds().width, 64);

function frameScene(transform, width = 1, height = 1) {
  const probe = createDisplayTree('PrecisionProbe');
  probe.stage.addChild(probe.createFrame({ id: 'Precision', layer: 0, transform,
    width, height, fill: [0, 0, 0, 0], clip: true }));
  return probe.snapshot();
}
renderer.updateScene(tree.snapshot());
const priorScene = renderer.scene, priorDraws = renderer.draws;
for (const scene of [frameScene(pose(1e6, 1e6, 0.2), 0.001, 0.001),
  frameScene(pose(1e6, 0, Math.PI / 4, 0.01, 0.01))]) {
  refuses(() => renderer.updateScene(scene), 'SCENE_LIMIT');
  assert.equal(renderer.scene, priorScene); assert.equal(renderer.draws, priorDraws);
  assert.equal(renderer.hitTest({ x: 25, y: 25 })?.id, 'Back');
}
const rank = cpuRenderer(); rank.setView({ panX: -1e6, panY: 0, zoom: 1 });
refuses(() => rank.updateScene(frameScene(pose(1e6, 0, Math.PI / 4, 0.01, 0.01))), 'SCENE_LIMIT');
assert.equal(rank.scene.contextId, 'Empty');
renderer.updateScene(frameScene(pose(1e6, 1e6, 0.2)));
const priorView = renderer.view, beforeViewScene = renderer.scene, beforeViewDraws = renderer.draws;
refuses(() => renderer.setView({ panX: 1e6, panY: 1e6, zoom: 0.05 }), 'SCENE_LIMIT');
assert.equal(renderer.view, priorView); assert.equal(renderer.scene, beforeViewScene); assert.equal(renderer.draws, beforeViewDraws);
// Fifteen frame ancestors are admitted; one extra frame exceeds the existing depth limit.
const leaf = structuredClone(legacyAxes.nodes[0]);
leaf.id = 'DepthLeaf';
let depthNodes = [leaf];
for (let i = 14; i >= 0; i--) depthNodes = [{ kind: 'frame', id: `Depth${i}`, layer: 0,
  transform: pose(0, 0, 0.01), visible: true, alpha: 1, hitMode: 'auto',
  width: 240, height: 180, fill: [0, 0, 0, 0], clip: true, children: depthNodes }];
const depthScene = { version: 24, unit: 'logical-px', contextId: 'DepthProbe', nodes: depthNodes };
const depthRenderer = cpuRenderer(); depthRenderer.updateScene(depthScene);
const tooDeep = structuredClone(depthScene);
const extraFrame = structuredClone(tooDeep.nodes[0]);
extraFrame.id = 'DepthExtra'; extraFrame.children = tooDeep.nodes; tooDeep.nodes = [extraFrame];
refuses(() => depthRenderer.updateScene(tooDeep), 'SCENE_LIMIT');
console.log(JSON.stringify({ result: 'ok', version: 24, v23RotationRefusal: true,
  legacyCanceledRotationRefusal: true, copiedAndColdReconstructed: true, atomicMalformedEdits: true,
  ancestorIntersection: true, signedNonuniformPivotShear: true, followingSibling: true,
  numericSceneAndViewRetention: true, float32RankRefusal: true, maxFrameAncestors: 15, gpuContextTested: false }));
