import assert from 'node:assert/strict';
import { Canvas2DRenderer } from '../../packages/barocss-canvas2d/dist/index.js';

// The renderer has no DOM in Node. Give the public query accepted draw records;
// the separate browser consumer exercises compilation, assets and actual WebGL2.
const renderer = Object.create(Canvas2DRenderer.prototype);
renderer.disposed = false;
renderer.size = { width: 80, height: 80 };
renderer.view = { panX: 0, panY: 0, zoom: 1 };
renderer.scene = { version: 11, unit: 'logical-px', contextId: 'HitStackProbe', nodes: [] };
const draw = (id, options = {}) => ({ id, kind: 'rect',
  node: { kind: 'rect', width: 50, height: 50 },
  inverse: [1, 0, 0, 1, 0, 0], color: [1, 0, 0, options.alpha ?? 1],
  clip: options.clip ?? null, visible: options.visible ?? true,
  hitEnabled: options.hitEnabled ?? true });
renderer.draws = [draw('Back'), draw('Middle'), draw('Middle'), draw('Top')];
const point = { x: 20, y: 20 };
assert.deepEqual(renderer.hitTestAll(point).map(hit => hit.id), ['Top', 'Middle', 'Back']);
assert.deepEqual(renderer.hitTestAll(point, 1), [renderer.hitTest(point)]);
assert.deepEqual(renderer.hitTestAll(point, undefined).map(hit => hit.id), ['Top', 'Middle', 'Back']);
assert.deepEqual(renderer.hitTestAll(point, 16).map(hit => hit.id), ['Top', 'Middle', 'Back']);
assert.deepEqual(renderer.hitTestAll({ x: 80, y: 20 }), []);
assert.deepEqual(renderer.hitTestAll({ x: -1, y: 20 }), []);
const copied = renderer.hitTestAll(point);
copied[0].id = 'Changed'; copied.pop();
assert.deepEqual(renderer.hitTestAll(point).map(hit => hit.id), ['Top', 'Middle', 'Back']);
renderer.draws[3].hitEnabled = false;
renderer.draws[2].visible = false;
assert.deepEqual(renderer.hitTestAll(point).map(hit => hit.id), ['Middle', 'Back']);
renderer.draws[1].color[3] = 0;
assert.deepEqual(renderer.hitTestAll(point).map(hit => hit.id), ['Back']);
renderer.draws[0].clip = { left: 30, top: 30, right: 50, bottom: 50 };
assert.deepEqual(renderer.hitTestAll(point), []);
renderer.draws[0].clip = null;
renderer.view = { panX: 10, panY: 10, zoom: 2 };
assert.deepEqual(renderer.hitTestAll({ x: 20, y: 20 }).map(hit => hit.id), ['Back']);

for (const bad of [null, 0, -0, -1, 1.5, '1', new Number(1), NaN,
  Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(() => renderer.hitTestAll(point, bad), error => error.code === 'INVALID_SCENE');
}
assert.throws(() => renderer.hitTestAll(point, 17), error => error.code === 'SCENE_LIMIT');
assert.throws(() => renderer.hitTestAll({ x: NaN, y: 0 }), error => error.code === 'INVALID_SCENE');
assert.deepEqual(renderer.scene, { version: 11, unit: 'logical-px', contextId: 'HitStackProbe', nodes: [] });
renderer.disposed = true;
assert.throws(() => renderer.hitTestAll(point), error => error.code === 'DISPOSED');
console.log(JSON.stringify({ result: 'ok', uniqueHits: 3, refusalCases: 12 }));
