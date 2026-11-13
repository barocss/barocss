import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/section-face-position-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/ui/SectionBar.tsx',
  'apps/cad-studio/src/viewport/sectionView.ts',
];
const f = await createFlow({
  name: 'section-face-position',
  output: process.argv[2],
  envFrozen: 'D1012_SOURCE_FROZEN',
  qualification: 'Show the position and kept side of a Section from an original face.',
  limits: ['A settled desktop WebGPU exact section of two standalone rectangular bodies.'],
  snapshotExtra: () => ({ section: window.__studioSection() }),
  initialFiles: pins,
  requiredFrozen: pins,
});
const doc = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [10, 30], max: [50, 50] },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 12 },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
async function click(point) {
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
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
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'section-source.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await button('Section view').click();
  await button('Section across X').click();
  await f.page.waitForFunction(() => window.__studioSection()?.exact && window.__studioSection().sources.join() === 'b3');
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Top left', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const filter = button('Selection filter');
  for (let attempt = 0; attempt < 6 && !(await filter.innerText()).includes('Faces'); attempt++) await filter.click();
  assert.ok((await filter.innerText()).includes('Faces'));
  const top = [38, 40, 12], cap = [25, 43, 6];
  const fromFace = button('Section from a face');
  const planePosition = f.page.getByLabel('Face-derived section position', { exact: true });
  f.phase = 'do not use a generated cap as the source plane';
  await fromFace.click();
  await click(cap);
  assert.equal(await fromFace.getAttribute('aria-pressed'), 'true');
  const rejected = await f.snapshot('cap-refused');
  assert.deepEqual(rejected.section.planes[0], { normal: [1, 0, 0], offset: 25, axis: 'x' });

  f.phase = 'set the Section from the original top face';
  await click(top);
  await f.page.waitForFunction(() => {
    const s = window.__studioSection();
    return s?.exact && s.planes[0].face === 'n3.top';
  });
  const picked = await f.snapshot('original-face-plane');
  assert.deepEqual(picked.section.planes[0], { normal: [-0, -0, -1], offset: -6, face: 'n3.top', axis: 'z' });
  assert.deepEqual(picked.section.sources, ['b1', 'b3']);
  assert.ok(Math.abs(picked.section.volume - 7200) < 1e-7);
  assert.equal(await fromFace.getAttribute('aria-pressed'), 'false');
  assert.equal(await planePosition.count(), 1, 'the initial face and position must be visible in the Section bar');
  assert.equal(await planePosition.textContent(), 'Face n3.top · Z ≤ 6 mm');
  assert.deepEqual(picked.doc, doc);

  f.phase = 'flip the kept side at the same plane';
  await button('Flip the section').click();
  await f.page.waitForFunction(() => window.__studioSection()?.exact && window.__studioSection().planes[0].offset === 6);
  const flipped = await f.snapshot('original-face-flipped');
  assert.equal(await planePosition.textContent(), 'Face n3.top · Z ≥ 6 mm');
  assert.ok(Math.abs(flipped.section.volume - 10400) < 1e-7);
  assert.deepEqual(flipped.doc, doc);

  f.phase = 'select an axis plane and clear the face source';
  await button('Section across X').click();
  await f.page.waitForFunction(() => window.__studioSection()?.exact && window.__studioSection().planes[0].axis === 'x');
  const reset = await f.snapshot('axis-plane-restored');
  assert.equal(await planePosition.count(), 0);
  assert.deepEqual(reset.section.planes, rejected.section.planes);
  assert.deepEqual(reset.doc, doc);
  assert.deepEqual(f.report.downloads, []);
});
