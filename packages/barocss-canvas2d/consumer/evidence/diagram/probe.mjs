import assert from 'node:assert/strict';

const { makeDiagram, readDiagram, atlasAsset, copyDiagramAsset, setLabel,
  updateConnector, validatePosition } = await import(new URL('../../diagram-host.mjs', import.meta.url));
const { stringifySceneJSON } = await import(new URL('../../../dist/index.js', import.meta.url));
const { serializeCanvasDocument, parseCanvasDocument } =
  await import(new URL('../../../dist/document.js', import.meta.url));
const hostRefusal = (operation, code) => assert.throws(operation, error => error?.code === code);
const pointNear = (actual, expected) => {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-10);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-10);
};

const atlas = atlasAsset();
assert.equal(atlas.width, 16); assert.equal(atlas.height, 12);
assert.ok(atlas.pixels instanceof Uint8Array); assert.equal(atlas.pixels.byteLength, 768);
const atlasBytes = new Uint8Array(atlas.pixels);
const copied = copyDiagramAsset(atlas);
assert.notEqual(copied.pixels.buffer, atlas.pixels.buffer);
assert.deepEqual(copied.pixels, atlasBytes);
atlas.pixels.fill(0);
assert.deepEqual(copied.pixels, atlasBytes);
assert.deepEqual(atlasAsset().pixels, atlasBytes);
let ink = 0, transparent = 0;
for (let index = 3; index < copied.pixels.length; index += 4) {
  if (copied.pixels[index]) {
    ink++;
    assert.deepEqual([...copied.pixels.subarray(index - 3, index)], [255, 255, 255]);
  } else transparent++;
}
assert.ok(ink > 0); assert.ok(transparent > 0);
hostRefusal(() => copyDiagramAsset({ ...copied, width: 15 }), 'HOST_DIAGRAM');
hostRefusal(() => copyDiagramAsset({ ...copied, pixels: new Uint8Array(767) }), 'HOST_DIAGRAM');
hostRefusal(() => copyDiagramAsset({ ...copied, pixels: new Uint8Array(768) }), 'HOST_DIAGRAM');
assert.deepEqual(validatePosition({ x: -500, y: 500 }), { x: -500, y: 500 });
const invalidPositions = [{ x: NaN, y: 0 }, { x: 0, y: Infinity },
  { x: -Infinity, y: 0 }, { x: 500.001, y: 0 }, { x: 0, y: -500.001 }];
for (const point of invalidPositions) hostRefusal(() => validatePosition(point), 'HOST_POSITION');

const diagram = makeDiagram();
const originalScene = diagram.tree.snapshot();
const originalText = stringifySceneJSON(originalScene);
assert.equal(originalScene.version, 24);
let nodeCount = 0;
const ids = new Set();
function inspect(nodes) {
  for (const node of nodes) {
    nodeCount++; assert.equal(ids.has(node.id), false); ids.add(node.id);
    if (node.kind === 'frame' || node.kind === 'group') inspect(node.children);
  }
}
inspect(originalScene.nodes);
assert.equal(nodeCount, 9); assert.ok(nodeCount <= 16);
assert.deepEqual(diagram.frame.data.transform,
  { x: 50, y: 30, scaleX: 1, scaleY: 1, rotation: 0.08 });
assert.equal(diagram.frame.data.width, 260); assert.equal(diagram.frame.data.height, 170);
assert.equal(diagram.frame.data.clip, true);
assert.deepEqual([diagram.nodes.A.data.transform.x, diagram.nodes.A.data.transform.y], [25, 40]);
assert.deepEqual([diagram.nodes.B.data.transform.x, diagram.nodes.B.data.transform.y], [150, 85]);
function labelMetadata(key, text) {
  const label = diagram.labels[key].data;
  assert.equal(label.text, text); assert.equal(label.atlasId, 'DiagramAtlas');
  assert.equal(label.baseline, 0); assert.equal(label.opacity, 1); assert.equal(label.sampling, 'nearest');
  assert.equal(label.transform.x, 12); assert.equal(label.transform.y, 12);
  assert.deepEqual(label.glyphs, [{ sourceRect: { x: text === 'H' ? 0 : 8, y: 0, width: 8, height: 12 },
    x: 0, y: 0, width: 16, height: 24, textStart: 0, textEnd: 1 }]);
}
labelMetadata('A', 'H'); labelMetadata('B', 'I');
const restored = readDiagram(originalScene);
assert.notEqual(restored.tree, diagram.tree);
assert.equal(stringifySceneJSON(restored.tree.snapshot()), originalText);
restored.nodes.A.setPosition(26, 40); updateConnector(restored);
assert.equal(stringifySceneJSON(diagram.tree.snapshot()), originalText);

const position = validatePosition({ x: 70, y: 55 });
diagram.nodes.A.setPosition(position.x, position.y);
updateConnector(diagram);
const endpoints = diagram.connector.data.commands;
assert.equal(endpoints.length, 2); assert.equal(endpoints[0].kind, 'M'); assert.equal(endpoints[1].kind, 'L');
for (const [key, index] of [['A', 0], ['B', 1]]) {
  const box = diagram.boxes[key];
  const world = box.toWorld({ x: box.data.width / 2, y: box.data.height / 2 });
  pointNear(endpoints[index], diagram.frame.toLocal(world));
  pointNear(diagram.frame.toWorld({ x: endpoints[index].x, y: endpoints[index].y }), world);
}
setLabel(diagram, 'A', 'I'); setLabel(diagram, 'B', 'H');
labelMetadata('A', 'I'); labelMetadata('B', 'H');
const accepted = diagram.tree.snapshot();
const acceptedText = stringifySceneJSON(accepted);
const movedRoundtrip = readDiagram(accepted);
assert.equal(stringifySceneJSON(movedRoundtrip.tree.snapshot()), acceptedText);
const priorLayout = diagram.labels.A.data;
const { atlasId, text, baseline, opacity, sampling, glyphs } = priorLayout;
assert.throws(() => diagram.labels.A.setLayout({ atlasId, text, baseline, opacity, sampling,
  glyphs: [{ ...glyphs[0], textEnd: 2 }] }), error => error?.code === 'INVALID_SCENE');
assert.equal(stringifySceneJSON(diagram.tree.snapshot()), acceptedText);
assert.deepEqual(copied.pixels, atlasBytes);

function find(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.kind === 'frame' || node.kind === 'group') {
      const found = find(node.children, id); if (found) return found;
    }
  }
  return null;
}
const topologyRefusals = [];
function incompatible(label, change) {
  const candidate = structuredClone(accepted); change(candidate);
  stringifySceneJSON(candidate);
  hostRefusal(() => readDiagram(candidate), 'HOST_DIAGRAM');
  assert.equal(stringifySceneJSON(diagram.tree.snapshot()), acceptedText);
  topologyRefusals.push(label);
}
incompatible('missing box ID', candidate => { find(candidate.nodes, diagram.boxes.A.id).id = 'OtherBox'; });
incompatible('disabled frame clip', candidate => { find(candidate.nodes, diagram.frame.id).clip = false; });
incompatible('changed box paint', candidate => { find(candidate.nodes, diagram.boxes.A.id).fill = [0, 1, 0, 1]; });
incompatible('unsupported label', candidate => { find(candidate.nodes, diagram.labels.A.id).text = 'X'; });
incompatible('wrong glyph dimensions', candidate => { find(candidate.nodes, diagram.labels.A.id).glyphs[0].width = 17; });
incompatible('wrong connector endpoint', candidate => { find(candidate.nodes, diagram.connector.id).commands[0].x += 1; });

assert.ok(globalThis.crypto?.subtle, 'Node 22 WebCrypto is required for the public document API');
const requestedAssets = [];
const documentText = await serializeCanvasDocument(accepted, id => {
  requestedAssets.push(id); return id === 'DiagramAtlas' ? copied : null;
});
assert.deepEqual(requestedAssets, ['DiagramAtlas']);
const parsed = await parseCanvasDocument(documentText);
assert.equal(stringifySceneJSON(parsed.scene), acceptedText);
assert.equal(parsed.assets.size, 1);
assert.deepEqual(parsed.assets.get('DiagramAtlas').pixels, atlasBytes);
assert.notEqual(parsed.assets.get('DiagramAtlas').pixels.buffer, copied.pixels.buffer);
assert.equal(stringifySceneJSON(readDiagram(parsed.scene).tree.snapshot()), acceptedText);
const corrupt = JSON.parse(documentText);
corrupt.assets[0].sha256 = corrupt.assets[0].sha256 === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64);
await assert.rejects(() => parseCanvasDocument(JSON.stringify(corrupt)), error => error?.code === 'INVALID_ASSET');
assert.equal(stringifySceneJSON(diagram.tree.snapshot()), acceptedText);
assert.deepEqual(copied.pixels, atlasBytes);

console.log(JSON.stringify({ scope: 'pure diagram policy, compiled public metadata and document bytes',
  sceneVersion: accepted.version, nodeCount, atlasBytes: atlasBytes.byteLength, inkPixels: ink,
  transparentPixels: transparent, assetCopied: true, originalAtlasUnchanged: true,
  invalidPositionCount: invalidPositions.length, savedTreeRoundtrip: true,
  movedConnectorCentersMatch: true, restoredLabels: { A: diagram.labels.A.data.text, B: diagram.labels.B.data.text },
  invalidLayoutRetained: true, topologyRefusals, documentBytes: new TextEncoder().encode(documentText).length,
  allAssetBytesRestored: true, digestRefusalCode: 'INVALID_ASSET',
  rendererTested: false, listenerTested: false, gpuTested: false, browserTested: false }));
