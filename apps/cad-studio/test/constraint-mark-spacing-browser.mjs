import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed'].includes(mode));
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/constraint-mark-spacing-browser.mjs',
  'apps/cad-studio/src/ui/SketchMarks.tsx', 'apps/cad-studio/src/ui/constraints.css',
  'apps/cad-studio/src/ui/ConstraintTools.tsx', 'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/rules.ts',
];
const f = await createFlow({
  name: 'constraint-mark-spacing', output, envFrozen: 'D926_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Measure two adjacent Fixed point marks during desktop sketch editing.',
  limits: ['One closed planar outline, two adjacent fixed points, one driving length, one straight Extrude.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { solveShape, type Polygon } from '@barocss/cad-model/sketch/rules';
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (input.nodes) {
  console.log(JSON.stringify(evaluateCadPart(toPartDocument(input)).outputs.map(body => ({
    valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume,
  }))));
} else {
  const shape: Polygon = { kind: 'polygon', closed: true, points: [[0,0],[20,0],[22,2],[22,25],[0,25]],
    hv: { h: [], v: [] }, lengths: { 3: 22 },
    rules: [{ kind: 'fix', point: 1, at: [20,0] }, { kind: 'fix', point: 2, at: [22,2] }] };
  assert.ok(solveShape(shape).ok);
  const built = profileOf([shape]);
  assert.ok('node' in built);
  console.log(JSON.stringify(withNode(emptyDoc(), built.node)));
}
`,
  snapshotExtra: () => ({
    glyphs: [...document.querySelectorAll('.vp-overlay .cons-glyph')].map(glyph => {
      const { left, top, right, bottom } = glyph.querySelector('.cons-chip').getBoundingClientRect();
      return { title: glyph.querySelector('title').textContent, left, top, right, bottom };
    }),
    dimensions: [...document.querySelectorAll('.vp-overlay .dim:not(.live) .dim-chip')].map(chip => {
      const { left, top, right, bottom } = chip.getBoundingClientRect();
      return { left, top, right, bottom };
    }),
    leaders: [...document.querySelectorAll('.vp-overlay .cons-leader')].map(line => {
      const { left, top } = line.closest('svg').getBoundingClientRect();
      return [Number(line.getAttribute('x1')) + left, Number(line.getAttribute('y1')) + top];
    }),
    solver: document.querySelector('.sk-panel .solver')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const marks = () => f.page.locator('.vp-overlay .cons-glyph .cons-chip');
const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

async function edit() {
  await button('Sketch · polygon', f.page.getByRole('group', { name: 'History', exact: true })).click();
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
}
async function measure(label) {
  const snapshot = await f.snapshot(label);
  assert.deepEqual(snapshot.glyphs.map(g => g.title), ['Point 2 fixed', 'Point 3 fixed']);
  const area = overlap(...snapshot.glyphs);
  f.report.observations.push({ label, overlapPx2: area, glyphs: snapshot.glyphs });
  if (baseline) assert.ok(area > 0, 'the two original marks must overlap');
  else {
    assert.equal(area, 0, 'the two fixed points must have separate marks');
    for (const mark of snapshot.glyphs) {
      for (const dimension of snapshot.dimensions) assert.equal(overlap(mark, dimension), 0, mark.title);
    }
    const points = await Promise.all([[20, 0], [22, 2]].map(p => f.screenOf(p)));
    assert.ok(snapshot.leaders.length > 0);
    for (const leader of snapshot.leaders) assert.ok(points.some(point =>
      Math.hypot(...leader.map((value, axis) => value - point[axis])) < 0.02));
    for (const [i, mark] of snapshot.glyphs.entries()) {
      const preferred = [points[i][0] - 16, points[i][1] + 16];
      const centre = [(mark.left + mark.right) / 2, (mark.top + mark.bottom) / 2];
      const moved = Math.hypot(...preferred.map((value, axis) => value - centre[axis])) > 0.02;
      if (moved) assert.ok(snapshot.leaders.some(leader =>
        Math.hypot(...leader.map((value, axis) => value - points[i][axis])) < 0.02), mark.title);
    }
  }
  return snapshot;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const doc = await f.inspect('fixture', {});
  const seed = Buffer.from(JSON.stringify(doc));
  f.report.observations.push({ label: 'fixture', sha256: sha256(seed) });
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D926-constraints.bcad', mimeType: 'application/json', buffer: seed });
  await f.same(doc);
  f.phase = 'open the constrained sketch and reproduce overlapping marks';
  await edit();
  await f.frame([[0, 0], [20, 0], [22, 2], [22, 25]]);
  await marks().last().waitFor();
  const first = await measure(baseline ? '01-parent-overlap' : '01-separated');
  assert.deepEqual(first.doc, doc);
  assert.equal(first.dirty, false);
  for (const point of [2, 3]) await button('Remove Fixed point ' + point, f.sketchPanel()).waitFor();
  if (!baseline && process.argv.includes('--individual-fixed')) {
    f.phase = 'Read and remove each Fixed constraint through its own point';
    const pickedOnly = f.sketchPanel().getByRole('checkbox', { name: 'Picked only' });
    await pickedOnly.check();
    for (const [point, coordinate] of [[2, [20, 0]], [3, [22, 2]]]) {
      const other = point === 2 ? 3 : 2;
      await f.page.mouse.click(...await f.screenOf(coordinate));
      const remove = button('Remove Fixed point ' + point, f.sketchPanel());
      await remove.waitFor();
      assert.equal(await button('Remove Fixed point ' + other, f.sketchPanel()).count(), 0);
      await remove.click();
      await remove.waitFor({ state: 'detached' });
      await f.page.keyboard.press('Meta+z');
      await pickedOnly.uncheck();
      await remove.waitFor();
      await button('Remove Fixed point ' + other, f.sketchPanel()).waitFor();
      await pickedOnly.check();
      await f.same(doc);
      await f.snapshot('fixed-point-' + point + '-restored');
    }
    await pickedOnly.uncheck();
  }
  f.phase = 'the existing driving dimension remains editable';
  await f.page.locator('.vp-overlay [data-dim="len3"] .dim-text').dblclick();
  const dimension = f.page.locator('.dim-edit');
  assert.equal(await dimension.inputValue(), '22');
  await dimension.fill('23');
  await dimension.press('Escape');
  await dimension.waitFor({ state: 'hidden' });
  await f.same(doc);
  if (baseline) return;

  f.phase = 'zoom and resize without changing the accepted sketch';
  await f.page.mouse.move(...await f.screenOf([12, 10]));
  await f.page.mouse.wheel(0, 280);
  await f.page.setViewportSize({ width: 1320, height: 940 });
  const resized = await measure('02-zoom-resize');
  assert.notDeepEqual(resized.glyphs, first.glyphs);
  for (const field of ['doc', 'history', 'selection', 'solver', 'dirty']) assert.deepEqual(resized[field], first[field], field);
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(doc);
  await edit();
  await measure('03-reopened');
  const finished = await f.finishSketch('04-finished');
  assert.deepEqual(finished.doc.nodes[0], doc.nodes[0]);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: finished.doc, label: '05-extruded' });
  const [body] = await f.inspect('native-extrude', solid.doc);
  // Area is a 22 x 25 rectangle less a 2 x 2 right triangle.
  assert.equal(body.valid, true);
  assert.ok(Math.abs(body.volume - 1096) < 1e-8, body.volume);
  f.report.observations.push({ label: 'native-extrude', expectedVolumeMM3: 1096, volumeMM3: body.volume });
  assert.deepEqual(f.report.downloads, []);
});
