import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed'].includes(mode));
const invalid = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [64, 32] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 0 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const files = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/ui/BodyBrowserRows.tsx',
  'apps/cad-studio/src/files/stepExportPreparation.ts',
  'apps/cad-studio/test/stale-model-consumers-browser.mjs',
];
const f = await createFlow({
  name: 'stale-model-consumers', output, envFrozen: 'D992_SOURCE_FROZEN', initialFiles: files, requiredFrozen: files,
  qualification: 'Keep failed model geometry out of selection, Hole, Sketch, Measure and STEP.',
  snapshotExtra: () => ({
    fresh: window.__studioFresh,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    browser: document.querySelector('.outliner .card-title')?.textContent,
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const open = async (name, doc) => {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.page.waitForFunction(n => document.querySelector('.doc-tab input')?.value === n, name);
};
const chosen = async () => {
  const { selection } = await f.page.evaluate(() => window.__studioSelection);
  return [...selection.faces, ...selection.edges, ...selection.bodies, ...(selection.vertices ?? [])];
};
const runCommand = async name => {
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('Space');
  const palette = f.page.getByRole('dialog', { name: 'Command palette' });
  await palette.waitFor();
  await palette.locator('input').fill(name);
  await palette.locator('.pl-item').filter({ has: f.page.locator('.pl-label', { hasText: new RegExp('^' + name + '$') }) }).click();
  await palette.waitFor({ state: 'hidden' });
};

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
  const face = [16, 10, 8];
  const first = await f.snapshot('current-plate');
  await f.worldClick(face);
  assert.equal((await chosen()).length, 1, 'the pointer hits a current face before failure');

  f.phase = 'open a native zero-height Extrude over the current plate';
  await open('failed-extrude', invalid);
  await f.page.getByText('Base part · not up to date', { exact: true }).waitFor();
  const failure = await f.snapshot('failed-model');
  assert.equal(failure.fresh, false);
  assert.deepEqual(failure.bodies.bodies, first.bodies.bodies);
  assert.equal(failure.doc.nodes[1].height, 0);
  assert.ok(failure.notices.some(text => /extrud|height/i.test(text)));

  f.phase = 'try to select and use the previous plate';
  await f.worldClick(face);
  const clicked = await f.snapshot('click-after-failure');
  if (mode === '--baseline') {
    assert.equal(clicked.selection.selection.faces.length, 1);
    assert.fail('A click selected a face from the prior document after native evaluation failed');
  }
  assert.deepEqual(await chosen(), []);
  await f.page.getByText('Previous result · model evaluation failed', { exact: true }).waitFor();
  const pixel = await f.screenOf(face);
  await f.page.mouse.click(pixel[0], pixel[1], { button: 'right' });
  assert.deepEqual(await chosen(), []);
  assert.equal(await f.page.getByRole('menuitem', { name: 'Measure from here' }).count(), 0);
  await f.page.mouse.dblclick(pixel[0], pixel[1]);
  assert.deepEqual(await chosen(), []);
  await f.page.keyboard.press('Escape');

  for (const name of ['Hole', 'Sketch', 'Measure']) {
    f.phase = 'try ' + name + ' after failure';
    await runCommand(name);
    await f.page.getByRole('alert').filter({ hasText: name + ' not started' }).waitFor();
    const selection = await f.page.evaluate(() => window.__studioSelection);
    assert.equal(selection.active, null, name);
    assert.equal(selection.sketch, false, name);
    assert.equal(selection.measure, false, name);
    assert.deepEqual(await chosen(), [], name);
  }

  f.phase = 'refuse STEP without preparing an output';
  await button('Export STEP').click();
  await f.page.getByRole('alert').filter({ hasText: 'STEP not prepared' }).waitFor();
  assert.deepEqual(await f.doc(), failure.doc);
  assert.deepEqual(f.report.downloads, []);

  f.phase = 'open and select the corrected current plate';
  const corrected = { ...invalid, nodes: [invalid.nodes[0], { ...invalid.nodes[1], height: 8 }] };
  await open('corrected-extrude', corrected);
  await f.same(corrected);
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('f');
  await f.worldClick(face);
  assert.equal((await chosen()).length, 1);
  const recovered = await f.snapshot('current-selection-restored');
  assert.ok(Math.abs(recovered.bodies.bodies[0].volume - 16384) < 1e-7);
});
