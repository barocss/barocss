import assert from 'node:assert/strict';
import { Canvas2DRenderer } from '../../packages/barocss-canvas2d/dist/index.js';

// Only the public conversion and admission behavior needs renderer state here.
const renderer = Object.create(Canvas2DRenderer.prototype);
renderer.disposed = false;
renderer.view = { panX: 10, panY: 5, zoom: 2 };
renderer.scene = { version: 0, unit: 'logical-px', contextId: 'Empty', nodes: [] };
renderer.draws = [];
renderer.dpr = 2;
renderer.tolerance = 1;
renderer.assets = new Map();
const source = { x: 20, y: 15 };
const viewport = renderer.worldToViewport(source);
assert.deepEqual(viewport, { x: 50, y: 35 });
assert.deepEqual(renderer.viewportToWorld(viewport), source);
assert.notEqual(viewport, source);
viewport.x = 99;
assert.deepEqual(source, { x: 20, y: 15 });
assert.deepEqual(renderer.viewportToWorld({ x: -50, y: -35 }), { x: -30, y: -20 });
renderer.setView({ panX: 20, panY: 10, zoom: 4 });
assert.deepEqual(renderer.worldToViewport(source), { x: 100, y: 70 });
assert.deepEqual(renderer.viewportToWorld({ x: 100, y: 70 }), source);
assert.throws(() => renderer.setView({ panX: 0, panY: 0, zoom: 0 }), error => error.code === 'INVALID_VIEW');
assert.deepEqual(renderer.worldToViewport(source), { x: 100, y: 70 });
for (const bad of [null, { x: -0, y: 1 }, { x: NaN, y: 0 }, { x: 1e6 + 1, y: 0 },
  { x: 0, y: 0, z: 0 }, Object.assign(Object.create({ foreign: true }), { x: 0, y: 0 }),
  Object.defineProperty({ y: 0 }, 'x', { enumerable: true, get() { throw new Error('getter ran'); } })]) {
  for (const method of ['worldToViewport', 'viewportToWorld']) {
    assert.throws(() => renderer[method](bad), error => error.code === 'INVALID_SCENE');
  }
}
renderer.setView({ panX: 1e6, panY: -1e6, zoom: 0.05 });
assert.deepEqual(renderer.viewportToWorld({ x: -1e6, y: 1e6 }), { x: -4e7, y: 4e7 });
renderer.setView({ panX: -1e6, panY: 1e6, zoom: 64 });
assert.deepEqual(renderer.worldToViewport({ x: 1e6, y: -1e6 }), { x: 63e6, y: -63e6 });
renderer.disposed = true;
assert.throws(() => renderer.worldToViewport(source), error => error.code === 'DISPOSED');
assert.throws(() => renderer.viewportToWorld(source), error => error.code === 'DISPOSED');
console.log(JSON.stringify({ result: 'ok', invalidPoints: 7, emptyScene: true, extremeViews: true }));
