import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv[3] === '--baseline';
const pins = ['apps/cad-studio/test/sketch-arc-zoom-browser.mjs', 'apps/cad-studio/src/ui/InlineSketchDimension.tsx',
  'apps/cad-studio/src/ui/SketchMarks.tsx', 'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts', 'apps/cad-studio/src/viewport/sketchOutlinePick.ts',
  'packages/barocss-cad-model/src/sketch/select.ts'];
const f = await createFlow({
  name: 'sketch-arc-zoom', output: process.argv[2], envFrozen: 'D1143_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'A zoomed Sketch arc uses one screen path for outline, hover, selection and pick.',
  limits: ['One closed planar sketch with a known 10 mm semicircle in desktop Ortho.'],
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, 0] },
      { kind: 'arc', start: [40, 0], center: [40, 10], direction: 'ccw' },
      { kind: 'line', start: [40, 20] }, { kind: 'line', start: [0, 20] }] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 2 },
  ], outputs: { b1: { node: 1, side: 'solid' } },
};
const button = name => f.page.getByRole('button', { name, exact: true });
const path = locator => locator.getAttribute('points').then(value => value.trim().split(/\s+/).map(point => point.split(',').map(Number)));
const draw = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const world = (x, y) => f.page.evaluate(([x, y]) => window.__studioScreenOf([x, y, 0]), [x, y]);

function errorOnSemicircle(polyline, center, right, top) {
  const nearest = (p, a, b) => {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  let max = 0;
  for (let i = 1; i < 720; i++) {
    const angle = Math.PI * (i / 720 - 0.5);
    const p = center.map((value, k) => value + (right[k] - value) * Math.cos(angle) + (top[k] - value) * Math.sin(angle));
    max = Math.max(max, Math.min(...polyline.slice(1).map((end, k) => nearest(p, polyline[k], end))));
  }
  return max;
}

await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1143-semicircle.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await f.openFeatureEditor(1);
  await button('Edit sketch').click();
  await f.sketchPanel().waitFor();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.tool('Select', 's');
  const canvas = f.page.locator('.vp-canvas');
  const box = await canvas.boundingBox();
  const outline = f.page.locator('.vp-overlay polygon.sk-shape').first();
  const hover = f.page.locator('.vp-overlay .sk-pick-edge.hover[data-sketch-entity="edge:1"]');
  const selected = f.page.locator('.vp-overlay .sk-pick-edge.on[data-sketch-entity="edge:1"]');
  async function measure() {
    const at = await world(50, 10);
    await f.page.mouse.move(at[0] - 15, at[1] - 4);
    await f.page.mouse.move(...at);
    await hover.waitFor();
    const points = await path(outline), mark = await path(hover);
    const projected = (await Promise.all([[40, 10], [50, 10], [40, 20]].map(([x, y]) => world(x, y))))
      .map(([x, y]) => [x - box.x, y - box.y]);
    // The first edge is straight. The arc occupies the rest of the ring through the third authored vertex.
    const end = points.findIndex((point, i) => i > 1 && Math.hypot(point[0] - projected[2][0], point[1] - projected[2][1]) < 1e-7);
    assert.ok(end > 1);
    const arc = points.slice(1, end + 1);
    return { at, radiusCSS: Math.hypot(at[0] - projected[0][0] - box.x, at[1] - projected[0][1] - box.y),
      arc, mark, segments: arc.length - 1, maxErrorCSS: errorOnSemicircle(arc, ...projected) };
  }
  f.phase = 'compare the same arc across two wheel zoom levels';
  await f.frame([[25, 10], [50, 10]]);
  const base = await measure();
  await f.snapshot('01-base');
  await f.page.mouse.wheel(0, -1050);
  await draw();
  const zoom = await measure();
  await f.snapshot('02-zoom');
  f.report.observations.push(...[base, zoom].map(({ radiusCSS, segments, mark, maxErrorCSS }) =>
    ({ radiusCSS, segments, hoverSegments: mark.length - 1, maxErrorCSS })));
  assert.ok(zoom.radiusCSS > base.radiusCSS * 2);
  if (baseline) {
    assert.equal(zoom.segments, base.segments);
    assert.notDeepEqual(zoom.arc, zoom.mark);
    assert.fail('Zoom keeps fixed arc sampling and the displayed outline differs from the hover path');
  }
  for (const state of [base, zoom]) {
    assert.deepEqual(state.arc, state.mark);
    assert.ok(state.maxErrorCSS <= 0.25, JSON.stringify(state.maxErrorCSS));
  }
  assert.ok(zoom.segments > base.segments);
  await f.page.mouse.click(...zoom.at);
  await selected.waitFor();
  assert.deepEqual(await path(selected), zoom.arc);
  await f.same(source);
  assert.deepEqual(f.report.downloads, []);
});
