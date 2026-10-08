import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exportSceneSVG, parseSceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { vectorScene } from './export-vector-v5.mjs';

const result = exportSceneSVG(vectorScene, { width: 260, height: 180 });
assert.equal(result.ok, true);
assert.deepEqual(result.diagnostics, []);
assert.deepEqual(result.sourceIdMap.map(entry => entry.sourceId),
  ['VectorBoard', 'Artwork', 'Shape', 'Curve']);
assert.match(result.svg, /viewBox="0 0 260 180"/);
assert.match(result.svg, /fill="#3366cc"/);
assert.match(result.svg, /fill-rule="nonzero"/);
assert.match(result.svg, /stroke-linejoin="bevel"/);
assert.equal(exportSceneSVG(vectorScene, { width: 260, height: 180 }).svg, result.svg);

const document = JSON.parse(readFileSync('examples/canvas2d-scene/evidence/document-v1/scene-and-assets.json', 'utf8'));
const v4 = parseSceneJSON(document.scene);
const refused = exportSceneSVG(v4, { width: 800, height: 480 });
assert.equal(refused.ok, false);
assert.ok(refused.diagnostics.some(item => item.nodeId === 'CroppedChecker' && item.feature.includes('image')));
assert.ok(refused.diagnostics.some(item => item.nodeId === 'GlyphHI' && item.feature.includes('glyphRun')));
assert.equal('svg' in refused, false);
const changed = structuredClone(vectorScene);
changed.nodes[0].children[0].fill.color[0] = 0.201;
const paintRefusal = exportSceneSVG(changed, { width: 260, height: 180 });
assert.equal(paintRefusal.ok, false);
assert.ok(paintRefusal.diagnostics.some(item => item.nodeId === 'Shape' && item.feature.includes('8-bit')));
const rootCollision = structuredClone(vectorScene);
rootCollision.nodes[0].id = rootCollision.contextId;
const collisionRefusal = exportSceneSVG(rootCollision, { width: 260, height: 180 });
assert.equal(collisionRefusal.ok, false);
assert.ok(collisionRefusal.diagnostics.some(item => item.feature.includes('root ID')));
console.log('export: vector subset, IDs, refusal diagnostics OK');
