import assert from 'node:assert/strict';
import { initialSceneV4 } from './scene.mjs';
import { findSceneNode, listSceneNodes, removeSelected, translateSelected } from './scene-interaction.mjs';

const scene = structuredClone(initialSceneV4);
assert.equal(listSceneNodes(scene.nodes).some(node => node.id === 'GlyphHI'), true);
translateSelected(scene, new Set(['MintCard', 'VioletCard']), 13, 7, false);
assert.deepEqual([findSceneNode('MintCard', scene.nodes).node.transform.x,
  findSceneNode('MintCard', scene.nodes).node.transform.y], [113, 102]);
assert.deepEqual([findSceneNode('VioletCard', scene.nodes).node.transform.x,
  findSceneNode('VioletCard', scene.nodes).node.transform.y], [33, 32]);

const snapped = structuredClone(initialSceneV4);
translateSelected(snapped, new Set(['MintCard', 'VioletCard']), 13, 7, true);
assert.deepEqual([findSceneNode('MintCard', snapped.nodes).node.transform.x,
  findSceneNode('MintCard', snapped.nodes).node.transform.y], [110, 105]);
assert.deepEqual([findSceneNode('VioletCard', snapped.nodes).node.transform.x,
  findSceneNode('VioletCard', snapped.nodes).node.transform.y], [30, 35]);

const nested = structuredClone(initialSceneV4);
translateSelected(nested, new Set(['GroupB', 'MintCard']), 10, 0, false);
assert.equal(findSceneNode('GroupB', nested.nodes).node.transform.x, 30);
assert.equal(findSceneNode('MintCard', nested.nodes).node.transform.x, 100);

const affine = structuredClone(initialSceneV4);
const group = findSceneNode('GroupB', affine.nodes).node;
group.transform.rotation = 0.5; group.transform.scaleX = 2; group.transform.scaleY = 1.5;
function worldOrigin() {
  const { node, parentMatrix: m } = findSceneNode('MintCard', affine.nodes);
  return [m[0] * node.transform.x + m[2] * node.transform.y + m[4],
    m[1] * node.transform.x + m[3] * node.transform.y + m[5]];
}
const before = worldOrigin();
translateSelected(affine, new Set(['MintCard']), 10, -5, false);
const after = worldOrigin();
assert.ok(Math.abs(after[0] - before[0] - 10) < 1e-9);
assert.ok(Math.abs(after[1] - before[1] + 5) < 1e-9);

const removed = { ...scene, nodes: removeSelected(scene.nodes, new Set(['MintCard'])) };
assert.equal(findSceneNode('MintCard', removed.nodes), null);
assert.ok(findSceneNode('MintCard', scene.nodes));

console.log(JSON.stringify({ result: 'ok', multiTranslate: true, snap: true,
  ancestorOnce: true, parentAffine: true, removeCopy: true }));
