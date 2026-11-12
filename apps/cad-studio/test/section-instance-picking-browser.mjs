// D772/B10-03: compare section rendering and occurrence picking on both sides.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const fixture = 'apps/cad-studio/test/fixtures/bracket.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useSectionDisplay.ts', 'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/viewport/gpuRenderer.ts', 'packages/barocss-gpu/src/viewer/viewer.ts',
];
const f = await createFlow({
  name: 'section-instance-picking', envFrozen: 'D772_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'B10-03 current WebGPU section clipping, pixels and public occurrence selection',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['One desktop WebGPU assembly with two spaced identical occurrences and a middle X plane.'],
  inspectorSource: String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
const { instances } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(instances.map(instance => {
  const result = evaluateDoc(instance.doc, 0);
  assert.equal(result.ok, true);
  assert.equal(result.bodies.length, 1);
  const body = result.bodies[0], { min, max } = body.mesh.bounds;
  return { id: instance.id, volume: body.volume,
    min: min.map((value, i) => value + instance.position[i]),
    max: max.map((value, i) => value + instance.position[i]) };
})));
`,
  oracleSource: String.raw`
import json, math, sys
x = json.load(sys.stdin)
expected = [
    {"id":"left", "min":[0,0,0], "max":[30,12,6]},
    {"id":"right", "min":[60,0,0], "max":[90,12,6]}
]
for part, ref in zip(x["native"], expected, strict=True):
    assert all(part[key] == ref[key] for key in ref)
    assert math.isclose(part["volume"], 30*12*6, rel_tol=1e-9)
assert x["plane"]["normal"] == [1,0,0] and x["plane"]["offset"] == 45
assert expected[0]["max"][0] < 45 < expected[1]["min"][0]
assert x["visible"] == [False, True] and x["flipped"] == [True, False]
print(json.dumps({"status":"PASS","planeX":45,"eachVolume":2160,"separation":30}))
`,
  snapshotExtra: () => ({
    section: window.__studioSection(),
    selectedOccurrence: document.querySelector('.outliner .ol.instance.sel')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  const page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const part = JSON.parse(await readFile(join(f.repo, fixture), 'utf8'));
  const doc = {
    ...part, nodes: [], outputs: {}, nextId: 0,
    instances: [
      { id: 'left', name: 'Left plate', doc: part, position: [0,0,0], rotation: [0,0,0] },
      { id: 'right', name: 'Right plate', doc: part, position: [60,0,0], rotation: [0,0,0] },
    ],
  };
  const points = [[15,6,6], [75,6,6]];
  const hit = point => page.evaluate(point => window.__studioInstanceAt(point), point);
  const hitIds = async () => (await Promise.all(points.map(hit))).map(pick => pick?.id ?? null);
  const expectHits = ids => page.waitForFunction(([points, ids]) => points.every((point, i) =>
    (window.__studioInstanceAt?.(point)?.id ?? null) === ids[i]), [points, ids]);
  const project = () => page.evaluate(points => points.map(point => window.__studioScreenOf(point)), points);
  const selected = page.locator('.outliner .ol.instance.sel');
  const clear = async () => {
    await page.keyboard.press('Escape');
    await selected.waitFor({ state: 'hidden' });
  };
  const click = async (index, expected) => {
    await clear();
    const coords = (await project())[index];
    assert.ok(coords?.length === 2);
    await page.mouse.click(...coords);
    if (expected) {
      await selected.filter({ hasText: expected }).waitFor();
      assert.equal(await selected.count(), 1);
    } else {
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      assert.equal(await selected.count(), 0);
    }
  };
  const checkDoc = (state, baseline) => {
    assert.deepEqual(state.doc, baseline.doc);
    assert.deepEqual(state.history, baseline.history);
    assert.equal(state.dirty, false);
  };
  const sample = async label => {
    const png = await readFile(join(f.output, label + '.png'));
    return page.evaluate(async ([base64, coords]) => {
      const image = new Image();
      image.src = 'data:image/png;base64,' + base64;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return coords.map(([x, y]) => {
        const { data } = context.getImageData(Math.round(x)-2, Math.round(y)-2, 5, 5);
        const rgb = [0,0,0];
        for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) rgb[k] += data[i+k];
        return rgb.map(total => total / 25);
      });
    }, [png.toString('base64'), await project()]);
  };
  const difference = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0);

  f.phase = 'open and frame the two occurrences before the cut';
  await page.setInputFiles('input[aria-label="Model file"]', {
    name: 'two-plates.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)),
  });
  await page.waitForFunction(() => window.__studioDoc.instances?.length === 2);
  await f.ready();
  await page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click();
  await page.keyboard.press('f');
  await expectHits(['left', 'right']);
  const baseline = await f.snapshot('uncut');
  assert.deepEqual(baseline.doc, doc);
  assert.equal(baseline.dirty, false);
  assert.equal(baseline.section.mode, null);
  const basePixels = await sample('uncut');
  const fixedProjection = await project();
  await click(0, 'Left plate');
  await click(1, 'Right plate');
  await clear();

  f.phase = 'clip the left occurrence and keep the right one';
  await button('Section view').click();
  await button('Section across X').click();
  await expectHits([null, 'right']);
  const cut = await f.snapshot('positive-x');
  assert.equal(cut.section.gpu, true);
  assert.equal(cut.section.mode, 'plane');
  assert.deepEqual(cut.section.planes, [{ normal: [1,0,0], offset: 45, axis: 'x' }]);
  checkDoc(cut, baseline);
  assert.deepEqual(await project(), fixedProjection);
  const cutPixels = await sample('positive-x');
  assert.ok(difference(basePixels[0], cutPixels[0]) > 45);
  assert.ok(difference(basePixels[1], cutPixels[1]) < 12);
  const visible = (await hitIds()).map(Boolean);
  await click(0, null);
  await click(1, 'Right plate');
  await f.snapshot('positive-x-selected');
  await clear();

  f.phase = 'flip the cut and compare pixels and occurrence picks again';
  await button('Flip the section').click();
  await expectHits(['left', null]);
  const flip = await f.snapshot('negative-x');
  assert.deepEqual(flip.section.planes, [{ normal: [-1,0,0], offset: -45, axis: 'x' }]);
  checkDoc(flip, baseline);
  assert.deepEqual(await project(), fixedProjection);
  const flipPixels = await sample('negative-x');
  assert.ok(difference(basePixels[0], flipPixels[0]) < 12);
  assert.ok(difference(basePixels[1], flipPixels[1]) > 45);
  const flipped = (await hitIds()).map(Boolean);
  await click(1, null);
  await click(0, 'Left plate');
  await clear();

  f.phase = 'remove the section and verify both original occurrences';
  await button('Section view').click();
  await expectHits(['left', 'right']);
  const restored = await f.snapshot('restored');
  assert.equal(restored.section.mode, null);
  checkDoc(restored, baseline);
  assert.deepEqual(await project(), fixedProjection);
  const restoredPixels = await sample('restored');
  for (let i = 0; i < 2; i++) assert.ok(difference(basePixels[i], restoredPixels[i]) < 12);
  await click(0, 'Left plate');
  await click(1, 'Right plate');
  const native = await f.inspect('native-placement', restored.doc);
  await f.runOracle({ native, plane: cut.section.planes[0], visible, flipped }, 'section-classification');
  f.report.observations.push({ fixedProjection, basePixels, cutPixels, flipPixels, restoredPixels });
  assert.deepEqual(f.report.downloads, []);
});
