import test from 'node:test';
import assert from 'node:assert/strict';

// PKG-h (O112): engine.test's one viewport test (the camera is the studio's), kept with the studio when engine.test moved
// into @barocss/cad-model.

test('sketch framing fits the rectangle into the free band between the panels', async () => {
  const { OrbitCamera } = await import('../src/viewport/camera');
  const W = 1440, H = 900, left = 64, right = 272;
  for (const [min, max] of [[[-20, -20], [100, 60]], [[0, 0], [400, 30]], [[5, 5], [6, 6]]] as [[number, number], [number, number]][]) {
    const cam = new OrbitCamera(); cam.distance = 5000; cam.target = [999, 999, 0];
    cam.aspect = W / H; cam.setView('top'); cam.frameRect(min, max, 8, left / W, right / W);
    const corners = [[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]].map(([x, y]) => cam.project([x, y, 8], W, H));
    for (const [x, y] of corners) { assert.ok(x >= left - 1 && x <= W - right + 1, `x ${x}`); assert.ok(y >= 0 && y <= H, `y ${y}`); }
    const cx = cam.project([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, 8], W, H)[0];
    assert.ok(Math.abs(cx - (left + (W - right)) / 2) < 1, `centre ${cx}`);
  }
});
