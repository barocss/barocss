import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/section-visible-copy-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useSectionEvaluation.ts',
  'apps/cad-studio/src/ui/SectionBar.tsx',
];
const f = await createFlow({
  name: 'section-visible-copy',
  output: process.argv[2],
  envFrozen: 'D1011_SOURCE_FROZEN',
  qualification: 'Copy a settled Section with only the visible original bodies.',
  limits: ['A settled desktop WebGPU exact section of two standalone rectangular bodies.'],
  snapshotExtra: () => ({ section: window.__studioSection() }),
  initialFiles: pins,
  requiredFrozen: pins,
});
const doc = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 12 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [10, 30], max: [50, 50] },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 12 },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
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
  f.phase = 'settle the cut through both bodies';
  const hatch = button('Hatch the cut');
  if (await hatch.getAttribute('aria-pressed') === 'false') await hatch.click();
  await f.page.waitForFunction(() => window.__studioSection()?.exact && window.__studioSection()?.hatch?.lines?.length === 2);
  const both = await f.snapshot('both-cut');
  assert.deepEqual(both.section.sources, ['b1', 'b3']);
  assert.ok(Math.abs(both.section.volume - 9600) < 1e-7);

  f.phase = 'hide the second original body in Section';
  await button('Hide body').nth(1).click();
  await f.page.waitForFunction(() => window.__studioDoc.bodies?.b3?.hidden && window.__studioSection()?.exact);
  const hidden = await f.snapshot('second-hidden');
  assert.deepEqual(hidden.section.sources, ['b1'], 'a hidden source must not contribute to the section');
  assert.equal(hidden.section.bodies, 1);
  assert.equal(hidden.section.hatch.lines.length, 1);
  assert.ok(hidden.section.hatch.lines[0].segments > 0);
  assert.ok(Math.abs(hidden.section.volume - 3600) < 1e-7);
  assert.ok(Math.abs(hidden.section.shownVolume - 3600) < 1e-7);

  f.phase = 'copy the visible cut into an independent sketch';
  const copy = button('Sketch the section');
  assert.equal(await copy.getAttribute('data-tip-desc'), 'Copy the visible cut outlines into an independent sketch');
  await copy.click();
  await f.sketchPanel().waitFor();
  const finished = await f.finishSketch('visible-section-copied');
  const sketch = finished.doc.nodes.at(-1);
  assert.equal(sketch.kind, 'sketch');
  assert.equal(sketch.profile, 'polygon');
  assert.equal(sketch.regions, undefined);
  assert.equal(sketch.holes, undefined);
  assert.deepEqual(sketch.points.map(([y, z]) => [Math.abs(y), z]).sort(), [[0, 0], [0, 12], [20, 0], [20, 12]]);
  assert.equal(sketch.on, undefined);
  assert.equal(sketch.association, undefined);
  assert.ok(Math.abs(sketch.plane.origin[0] - 25) < 1e-9);
  assert.deepEqual(sketch.plane.normal.map(Math.abs), [1, 0, 0]);
  assert.deepEqual(finished.doc.nodes.slice(0, -1), doc.nodes);
  assert.deepEqual(finished.doc.outputs, doc.outputs);

  f.phase = 'show the second body after the sketch copy';
  await button('Show body').click();
  const restored = await f.snapshot('second-restored');
  assert.deepEqual(restored.doc.nodes.at(-1), sketch);
  assert.deepEqual(f.report.downloads, []);
});
