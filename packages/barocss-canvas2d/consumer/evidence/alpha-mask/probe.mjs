import assert from 'node:assert/strict';
const { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON, stringifySceneJSON, Canvas2DError } =
  await import(process.env.BAROCSS_SCENE_MODULE ?? '../../../dist/index.js');
const { sampledAlpha, renderImage } = await import(process.env.BAROCSS_IMAGE_MODULE ?? '../../../dist/image.js');
const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const base = { id: 'Sprite', layer: 0, transform: pose, imageId: 'RGBA', width: 2, height: 1,
  opacity: 0.5, sampling: 'nearest', anchorX: 0, anchorY: 0 };
const tree = createDisplayTree('AlphaMaskProbe');
const factoryMask = [1, 0, 0, 0];
const sprite = tree.createSprite({ ...base, alphaMask: factoryMask }); tree.stage.addChild(sprite);
assert.equal(tree.snapshot().version, 29); factoryMask[0] = 0; assert.deepEqual(sprite.data.alphaMask, [1, 0, 0, 0]);
const read = sprite.data; read.alphaMask[0] = 3; assert.deepEqual(sprite.data.alphaMask, [1, 0, 0, 0]);
const snapshot = tree.snapshot(); snapshot.nodes[0].alphaMask[0] = 4; assert.deepEqual(sprite.data.alphaMask, [1, 0, 0, 0]);
const setterMask = [0, 1, 0, 0]; sprite.setAlphaMask(setterMask); setterMask[1] = 0; assert.deepEqual(sprite.data.alphaMask, [0, 1, 0, 0]);
const restored = createDisplayTreeFromScene(tree.snapshot()); assert.deepEqual(restored.get('Sprite').data.alphaMask, [0, 1, 0, 0]);
const json = stringifySceneJSON(tree.snapshot()); assert.equal(parseSceneJSON(json).version, 29); assert.equal(stringifySceneJSON(parseSceneJSON(json)), json);
let refusals = 0, getters = 0;
function refuse(fn) { assert.throws(fn, error => error.code === 'INVALID_SCENE'); refusals++; }
const badMasks = [undefined, null, [], [1, 0, 0], [1, 0, 0, 0, 0], [NaN, 0, 0, 0], [Infinity, 0, 0, 0],
  [4.01, 0, 0, 0], [-4.01, 0, 0, 0], [0, 4.01, 0, 0], [0, 0, -4.01, 0], [0, 0, 0, 1.01], [0, 0, 0, -1.01], ['1', 0, 0, 0], new Float32Array([1, 0, 0, 0])];
const sparse = [1, 0, 0, 0]; delete sparse[2]; badMasks.push(sparse);
const extra = [1, 0, 0, 0]; extra.extra = 1; badMasks.push(extra);
const symbol = [1, 0, 0, 0]; symbol[Symbol('field')] = 1; badMasks.push(symbol);
const subclass = new (class extends Array {})(1, 0, 0, 0); badMasks.push(subclass);
const accessorElement = [1, 0, 0, 0]; Object.defineProperty(accessorElement, '0', { enumerable: true, get() { getters++; return 1; } }); badMasks.push(accessorElement);
const hiddenElement = [1, 0, 0, 0]; Object.defineProperty(hiddenElement, '0', { enumerable: false, value: 1 }); badMasks.push(hiddenElement);
const before = stringifySceneJSON(tree.snapshot());
for (const mask of badMasks) {
  refuse(() => tree.createSprite({ ...base, id: 'Rejected', alphaMask: mask }));
  const scene = tree.snapshot();
  refuse(() => stringifySceneJSON({ ...scene, nodes: [{ ...scene.nodes[0], alphaMask: mask }] }));
  if (mask !== null) { refuse(() => sprite.setAlphaMask(mask)); assert.equal(stringifySceneJSON(tree.snapshot()), before); }
}
for (const enumerable of [true, false]) {
  const input = { ...base, id: 'Rejected' };
  Object.defineProperty(input, 'alphaMask', { enumerable, get() { getters++; return [1, 0, 0, 0]; } });
  refuse(() => tree.createSprite(input));
}
const hiddenField = { ...base, id: 'Rejected' }; Object.defineProperty(hiddenField, 'alphaMask', { enumerable: false, value: [1, 0, 0, 0] }); refuse(() => tree.createSprite(hiddenField));
for (const enumerable of [true, false]) {
  const scene = tree.snapshot(), image = { ...scene.nodes[0] };
  Object.defineProperty(image, 'alphaMask', { enumerable, get() { getters++; return [1, 0, 0, 0]; } });
  refuse(() => stringifySceneJSON({ ...scene, nodes: [image] }));
}
assert.equal(getters, 0);
sprite.setAlphaMask([-4, 4, -4, -1]); assert.deepEqual(sprite.data.alphaMask, [-4, 4, -4, -1]);
sprite.setAlphaMask(null); assert.equal(Object.hasOwn(sprite.data, 'alphaMask'), false);
assert.equal(Object.hasOwn(tree.snapshot().nodes[0], 'alphaMask'), false);

// Older empty scene records remain valid; each rejects a new field on any node.
for (let version = 0; version <= 28; version++) {
  assert.equal(parseSceneJSON(JSON.stringify({ version, unit: 'logical-px', contextId: 'History', nodes: [] })).version, version);
  const oldNode = version < 3
    ? { kind: 'rect', id: 'HistoricalRect', layer: 0, transform: pose, width: 2, height: 1, fill: [1, 0, 0, 1], alphaMask: [0, 0, 0, 1] }
    : { ...structuredClone(tree.snapshot().nodes[0]), alphaMask: [0, 0, 0, 1] };
  if (version < 9) delete oldNode.visible; if (version < 10) delete oldNode.alpha; if (version < 11) delete oldNode.hitMode;
  if (version < 8) delete oldNode.blendMode; if (version < 7) delete oldNode.tint;
  if (version < 6) { delete oldNode.anchorX; delete oldNode.anchorY; }
  refuse(() => parseSceneJSON(JSON.stringify({ version, unit: 'logical-px', contextId: 'History', nodes: [oldNode] })));
  delete oldNode.alphaMask;
  assert.equal(parseSceneJSON(JSON.stringify({ version, unit: 'logical-px', contextId: 'History', nodes: [oldNode] })).version, version);
  if (version >= 6) assert.equal(createDisplayTreeFromScene({ version, unit: 'logical-px', contextId: 'History', nodes: [oldNode] }).snapshot().version, 29);
}
refuse(() => parseSceneJSON(JSON.stringify({ ...tree.snapshot(), version: 30 })));

const asset = { width: 2, height: 1, pixels: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]), texture: {} };
const node = { kind: 'image', ...base, tint: [1, 1, 1], blendMode: 'normal' };
function near(actual, expected, name) { assert.ok(Math.abs(actual - expected) <= 1e-12, `${name}: ${actual} != ${expected}`); return actual; }
const cpu = {};
cpu.identityRed = near(sampledAlpha(node, asset, { x: 0.25, y: 0.5 }), 0.5, 'identity red');
cpu.identityGreen = near(sampledAlpha(node, asset, { x: 1.25, y: 0.5 }), 64 / 255, 'identity green');
cpu.maskRed = near(sampledAlpha({ ...node, alphaMask: [1, 0, 0, 0] }, asset, { x: 0.25, y: 0.5 }), 0.5, 'red mask');
cpu.maskGreenRejected = near(sampledAlpha({ ...node, alphaMask: [1, 0, 0, 0] }, asset, { x: 1.25, y: 0.5 }), 0, 'green rejection');
cpu.greenRow = near(sampledAlpha({ ...node, alphaMask: [0, 1, 0, 0] }, asset, { x: 1.25, y: 0.5 }), 64 / 255, 'green row');
cpu.clampHigh = near(sampledAlpha({ ...node, alphaMask: [4, 0, 0, 1] }, asset, { x: 0.25, y: 0.5 }), 0.5, 'high clamp');
cpu.clampLow = near(sampledAlpha({ ...node, alphaMask: [-4, 0, 0, -1] }, asset, { x: 0.25, y: 0.5 }), 0, 'low clamp');
const matrix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
cpu.preColorMask = near(sampledAlpha({ ...node, rgbMatrix: matrix, tint: [0, 0, 0], alphaMask: [1, 0, 0, 0] }, asset, { x: 0.25, y: 0.5 }), 0.5, 'original RGB before matrix/tint');
const linear = { ...node, sampling: 'linear', alphaMask: [2, 0, 0, -0.5] };
cpu.linearAfterSample = near(sampledAlpha(linear, asset, { x: 1, y: 0.5 }), 383 / 2040, 'interpolate RGBA then mask');
assert.notEqual(cpu.linearAfterSample, 0.25, 'masking texels before interpolation gives 0.25 and must differ');
const transparent = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 0]), texture: {} };
cpu.transparent = near(sampledAlpha({ ...node, width: 1, alphaMask: [4, 0, 0, 1] }, transparent, { x: 0.5, y: 0.5 }), 0, 'source alpha zero');
const gray = { width: 1, height: 1, pixels: new Uint8Array([128, 0, 0, 255]), texture: {} };
cpu.float32Rows = near(sampledAlpha({ ...node, width: 1, opacity: 1, alphaMask: [0.1, 0, 0, 0.2] }, gray, { x: 0.5, y: 0.5 }), 0.25019608215958467, 'Float32 coefficients');
assert.equal(sampledAlpha(linear, asset, { x: -0.01, y: 0.5 }), 0);
assert.equal(sampledAlpha(linear, asset, { x: 2.01, y: 0.5 }), 0);

let gpuCalls = 0;
const noGPU = new Proxy({}, { get() { return () => { gpuCalls++; throw Error('GPU called before admission'); }; } });
for (const alphaMask of [[NaN, 0, 0, 0], accessorElement, hiddenElement]) {
  const invalid = { ...node, alphaMask };
  refuse(() => renderImage(noGPU, {}, new Float32Array(12), invalid, asset, 1, { width: 2, height: 1 }, { panX: 0, panY: 0, zoom: 1 }));
}
const accessorNode = { ...node };
Object.defineProperty(accessorNode, 'alphaMask', { enumerable: true, get() { getters++; return [1, 0, 0, 0]; } });
refuse(() => renderImage(noGPU, {}, new Float32Array(12), accessorNode, asset, 1, { width: 2, height: 1 }, { panX: 0, panY: 0, zoom: 1 }));
assert.equal(gpuCalls, 0); assert.equal(getters, 0);
console.log(JSON.stringify({ runtime: process.version, module: process.env.BAROCSS_SCENE_MODULE ? 'source-bundle' : 'compiled-root',
  refusals, getters, currentVersion: 29, historicalVersionsAccepted: 29, historicalAlphaMaskRejected: 29, reconstruct6through29: true,
  factoryCopies: true, setterCopies: true, dataCopies: true, snapshotCopies: true, atomicInvalidSetter: true,
  nullClears: true, cpu, linearPostSampleMask: true, sourceRGBBeforeColorEffects: true, float32Coefficients: true,
  renderAdmissionGPUCalls: gpuCalls }, null, 2));
