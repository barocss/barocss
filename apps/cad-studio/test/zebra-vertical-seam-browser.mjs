import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/zebra-vertical-seam-browser.mjs',
  'apps/cad-studio/src/viewport/analysis.ts',
  'apps/cad-studio/src/viewport/gpuRenderer.ts',
  'apps/cad-studio/src/ui/ViewDisplayControls.tsx',
];
const f = await createFlow({
  name: 'zebra-vertical-seam', output: process.argv[2], envFrozen: 'D1017_SOURCE_FROZEN',
  qualification: 'Compare a sharp vertical seam and a tangent R4 vertical Fillet in desktop WebGPU Zebra.',
  limits: ['One rectangular part, one vertical R4 edge, desktop WebGPU at Iso in orthographic and perspective projection.'],
  initialFiles: pins, requiredFrozen: pins,
});
const sharp = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 32] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 16 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const round = {
  ...sharp, nodes: [...sharp.nodes, {
    id: 'n2', kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.side1'], radius: 4,
  }], outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const views = name => f.page.locator('.views').getByRole('button', { name, exact: true });
const curve = degrees => {
  const angle = degrees * Math.PI / 180;
  return [28 + 4 * Math.cos(angle), 4 - 4 * Math.sin(angle), 8];
};
const arc = Array.from({ length: 35 }, (_, i) => curve(2.5 * (i + 1)));
const contrast = values => Math.max(...values) - Math.min(...values);

async function sample(label, points) {
  const state = await f.snapshot(label);
  const png = await readFile(join(f.output, label + '.png'));
  const luminance = await f.page.evaluate(async ([png, points]) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + png;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return points.map(point => {
      const [x, y] = window.__studioScreenOf(point);
      const { data } = ctx.getImageData(Math.round(x), Math.round(y), 1, 1);
      return (data[0] + data[1] + data[2]) / 3;
    });
  }, [png.toString('base64'), points]);
  f.report.observations.push({ label, points, luminance });
  await f.persist();
  return { state, luminance };
}

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
  async function open(name, doc) {
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await f.same(doc);
    await views('Iso').click();
    await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  }
  const analysis = button('Surface analysis');
  const ensureZebra = async () => {
    for (let i = 0; i < 4 && (await analysis.innerText()) !== 'Zebra'; i++) await analysis.click();
    assert.equal(await analysis.innerText(), 'Zebra');
  };

  f.phase = 'capture the two flat sides of a sharp vertical seam';
  await open('zebra-sharp', sharp);
  if (await views('Ortho').getAttribute('aria-pressed') === 'false') await views('Ortho').click();
  await ensureZebra();
  const box = await sample('sharp-zebra-ortho', [[30, 0, 8], [32, 2, 8]]);

  f.phase = 'capture the vertical R4 Fillet in orthographic Zebra';
  await open('zebra-round', round);
  await ensureZebra();
  const rounded = await sample('round-zebra-ortho', [[26, 0, 8], curve(87.5), [32, 6, 8], curve(2.5), ...arc]);
  assert.ok(Math.abs(rounded.state.bodies.bodies[0].volume - (32 * 32 * 16 - 16 * (16 - 4 * Math.PI))) < 1e-7);
  assert.ok(contrast(rounded.luminance.slice(4)) >= 80, 'vertical Fillet must show stripe contrast');
  assert.ok(contrast(box.luminance) >= 80, 'Zebra must distinguish the sharp seam on two vertical planes');
  for (const index of [0, 2]) assert.ok(Math.abs(rounded.luminance[index] - rounded.luminance[index + 1]) <= 32, 'stripe tone must match across the tangent join');

  f.phase = 'confirm the stripes in perspective and return to the ordinary view';
  await views('Ortho').click();
  assert.equal(await views('Ortho').getAttribute('aria-pressed'), 'false');
  const perspective = await sample('round-zebra-perspective', arc);
  assert.ok(contrast(perspective.luminance) >= 80);
  await analysis.click();
  assert.equal(await analysis.innerText(), 'Curv');
  await analysis.click();
  assert.equal(await analysis.innerText(), 'Analyse');
  const ordinary = await f.snapshot('round-ordinary');
  for (const state of [perspective.state, ordinary]) {
    assert.deepEqual(state.doc, round);
    assert.deepEqual(state.history, rounded.state.history);
  }
  assert.deepEqual(f.report.downloads, []);
});
