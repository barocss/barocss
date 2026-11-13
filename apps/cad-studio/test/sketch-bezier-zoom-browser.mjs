import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv[3] === '--baseline';
const pins = ['apps/cad-studio/test/sketch-bezier-zoom-browser.mjs', 'apps/cad-studio/src/viewport/sketchOverlay.tsx'];
if (!baseline) pins.push('apps/cad-studio/src/viewport/projectedBezier.ts');
const f = await createFlow({
  name: 'sketch-bezier-zoom', output: process.argv[2], envFrozen: 'D1148_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Compare projected active and settled Bézier lines to an independent Bernstein curve.',
  limits: ['One quadratic and one cubic, authored in desktop XY Ortho.'],
});
const button = name => f.page.getByRole('button', { name, exact: true });
const poles = [[10, 10], [20, 42], [34, 42], [44, 10]];
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

function gap([x, y], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
  if (!length) return Math.hypot(x - ax, y - ay);
  const along = Math.max(0, Math.min(length, (x - ax) * dx / length + (y - ay) * dy / length));
  return Math.hypot(x - ax - along * dx / length, y - ay - along * dy / length);
}

function errorOf(points, control) {
  let error = 0;
  for (let i = 0; i <= 2048; i++) {
    const t = i / 2048, u = 1 - t;
    const basis = control.length === 3 ? [u * u, 2 * u * t, t * t] : [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3];
    const at = [0, 1].map(axis => control.reduce((sum, point, j) => sum + point[axis] * basis[j], 0));
    let nearest = Infinity;
    for (let j = 1; j < points.length; j++) nearest = Math.min(nearest, gap(at, points[j - 1], points[j]));
    error = Math.max(error, nearest);
  }
  return error;
}

async function measure(label, control, settled = false) {
  await settle();
  const line = f.page.locator(settled ? '.vp-overlay polyline.sk-shape.open.done' : '.vp-overlay polyline.sk-shape.open:not(.done)');
  const points = (await line.getAttribute('points')).trim().split(/\s+/).map(point => point.split(',').map(Number));
  const box = await f.page.locator('.vp-canvas').boundingBox();
  const projected = (await Promise.all(control.map(p => f.screenOf(p)))).map(([x, y]) => [x - box.x, y - box.y]);
  const gapStart = gap(points[0], projected[0], projected[0]);
  const gapEnd = gap(points.at(-1), projected.at(-1), projected.at(-1));
  assert.ok(gapStart < 1e-7 && gapEnd < 1e-7, JSON.stringify({ gapStart, gapEnd }));
  const spanCSS = Math.hypot(projected.at(-1)[0] - projected[0][0], projected.at(-1)[1] - projected[0][1]);
  const sample = { label, segments: points.length - 1, spanCSS, maxErrorCSS: errorOf(points, projected), gapStart, gapEnd };
  f.report.observations.push(sample);
  await f.snapshot(label);
  return { ...sample, points };
}

await f.run(async () => {
  await f.newPage();
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
  await f.ready();
  const source = await f.doc();
  await f.page.getByRole('navigation', { name: 'Tools', exact: true }).getByRole('button', { name: 'Sketch', exact: true }).click();
  await f.sketchPanel().waitFor();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.tool('Bézier', 'b');
  await f.frame(poles);
  for (const pole of poles.slice(0, 3)) await f.worldClick(pole);
  const quadratic = await measure('quadratic', poles.slice(0, 3));
  await f.worldClick(poles[3]);
  f.phase = 'measure the same cubic before and after the wheel zoom';
  const base = await measure('cubic-base', poles);
  const anchor = await f.screenOf([27, 34]);
  assert.ok(await f.page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.classList.contains('vp-canvas'), anchor));
  await f.page.mouse.move(...anchor);
  await f.page.mouse.wheel(0, -1550);
  const zoomed = await measure('cubic-zoomed', poles);
  assert.ok(zoomed.spanCSS > base.spanCSS * 3, JSON.stringify({ base: base.spanCSS, zoomed: zoomed.spanCSS }));
  await f.tool('Select', 's');
  const parked = await measure('cubic-settled', poles, true);
  assert.deepEqual(parked.points, zoomed.points);
  await f.same(source);
  assert.deepEqual(f.report.downloads, []);
  if (baseline) {
    assert.equal(base.segments, 32);
    assert.equal(zoomed.segments, 32);
    assert.ok(zoomed.maxErrorCSS > 0.25, JSON.stringify(zoomed.maxErrorCSS));
    assert.fail('The Sketch Bézier keeps 32 chords after zoom and exceeds 0.25 CSS px');
  }
  assert.ok(zoomed.segments > base.segments && zoomed.segments <= 512);
  for (const sample of [quadratic, base, zoomed, parked]) {
    assert.ok(sample.maxErrorCSS <= 0.25, JSON.stringify({ label: sample.label, error: sample.maxErrorCSS }));
  }
});
