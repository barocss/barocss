import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed', '--open-baseline', '--open-fixed'].includes(mode));
const openMode = mode.startsWith('--open-');
const table = { id: 'shop-fits', rows: [{ class: 'g6', over: 10, upTo: 18, upper: -0.006, lower: -0.017, estimate: true }] };
const fixture = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 6, id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 24, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
  fits: { version: 1, tables: [table], faces: [{ face: 'n1.side0', class: 'g6' }] },
};
const files = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/FitTables.tsx',
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'apps/cad-studio/src/ui/LibraryPanel.tsx',
  'packages/barocss-cad-model/src/engine/fits.ts',
  'apps/cad-studio/test/fit-table-removal-browser.mjs',
];
const f = await createFlow({
  name: openMode ? 'fit-table-open' : 'fit-table-removal', output, envFrozen: openMode ? 'D990_SOURCE_FROZEN' : 'D989_SOURCE_FROZEN', initialFiles: files, requiredFrozen: files,
  qualification: openMode ? 'Refuse a native file missing a current fit row before changing the accepted document.'
    : 'Refuse removal of the last row that supplies a current model fit.',
  snapshotExtra: () => ({
    fresh: window.__studioFresh,
    fileName: document.querySelector('.doc-tab input')?.value,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const fitTables = () => f.page.getByRole('region', { name: 'Fit tables', exact: true });
const remove = id => fitTables().getByRole('button', { name: 'Remove fit table ' + id, exact: true });
const history = () => Promise.all(['Undo', 'Redo'].map(name => button(name).isEnabled()));
const put = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
const error = () => f.page.getByRole('alert').filter({ hasText: 'A fit class has no row in your fit tables' });

const openFile = async (name, doc) => {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(put(name + '.bcad', doc));
};
const openWithoutFit = async (label, withBody) => {
  const invalid = { ...fixture, fits: { ...fixture.fits, tables: [] } };
  f.phase = 'refuse a missing-fit file in ' + label;
  if (withBody) {
    await f.page.locator('.outliner .ol-row button.ol').click();
    await f.page.waitForFunction(() => window.__studioSelection?.selection?.bodies?.[0] === 0);
  }
  const before = await f.snapshot(label + '-before');
  assert.equal(before.bodies.bodies.length, withBody ? 1 : 0);
  const historyBefore = await history();
  await openFile('invalid-fit', invalid);
  if (mode === '--open-baseline') {
    await error().waitFor();
    const failed = await f.snapshot('open-installed-invalid-fit');
    assert.equal(failed.fileName, 'invalid-fit');
    assert.deepEqual(failed.doc.fits.tables, []);
    assert.equal(failed.fresh, false);
    assert.deepEqual(failed.bodies.bodies, before.bodies.bodies);
    assert.fail('Native Open installed the invalid file name and document over the previous body');
  }
  const refused = f.page.getByRole('alert').filter({ hasText: 'Could not open this file' });
  await refused.waitFor();
  assert.match(await refused.textContent(), /g6.*12 mm.*unchanged/i);
  const after = await f.snapshot(label + '-refused');
  for (const field of ['doc', 'bodies', 'selection', 'history', 'fresh', 'fileName', 'dirty']) {
    assert.deepEqual(after[field], before[field], field);
  }
  assert.deepEqual(await history(), historyBefore);

  f.phase = 'open the corrected file with the covering table restored';
  await openFile('recovered-fit', fixture);
  await f.page.waitForFunction(() => document.querySelector('.doc-tab input')?.value === 'recovered-fit');
  await f.ready();
  const repaired = await f.snapshot(label + '-recovered');
  assert.deepEqual(repaired.doc, fixture);
  assert.equal(repaired.bodies.bodies.length, 1);
  assert.ok(Math.abs(repaired.bodies.bodies[0].volume - Math.PI * 36 * 24) < 1e-7);
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
  if (openMode) {
    await openWithoutFit('selected-model', true);
    await f.newPage();
    await button('New part').click();
    await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 0);
    await f.ready();
    await openWithoutFit('fresh-empty-part', false);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  await openFile('fit-custody', fixture);
  await f.page.waitForFunction(() => window.__studioDoc?.fits?.tables?.[0]?.id === 'shop-fits');
  await f.ready();
  const accepted = await f.doc();
  assert.equal(accepted.fits.faces[0].class, 'g6');
  const bodies = await f.bodies();
  assert.equal(bodies.bodies.length, 1);
  assert.ok(Math.abs(bodies.bodies[0].volume - Math.PI * 36 * 24) < 1e-7);
  const row = f.page.locator('.outliner .ol-row button.ol');
  await row.click();
  await f.page.waitForFunction(() => window.__studioSelection?.selection?.bodies?.[0] === 0);
  await button('Library').click();
  await remove('shop-fits').waitFor();
  const before = await f.snapshot('accepted-fit-table');
  const historyBefore = await history();

  f.phase = 'remove the only table for the current Ø12 g6 fit';
  await remove('shop-fits').click();
  await error().waitFor();
  if (mode === '--baseline') {
    const failed = await f.snapshot('fit-table-removal-broke-evaluation');
    assert.deepEqual(failed.doc.fits.tables, []);
    assert.equal(failed.fresh, false);
    assert.deepEqual(failed.bodies.bodies, bodies.bodies);
    assert.fail('Removing the only fit table installed a failed document and left the old body displayed');
  }
  await f.same(accepted);
  const refused = await f.snapshot('fit-table-removal-refused');
  for (const field of ['doc', 'selection', 'history', 'bodies', 'dirty', 'fresh']) {
    assert.deepEqual(refused[field], before[field], field);
  }
  assert.deepEqual(await history(), historyBefore);
  await remove('shop-fits').waitFor();
  assert.match(await error().textContent(), /g6.*12 mm/);

  f.phase = 'allow removal once another table supplies the same fit';
  const add = (name, value) => fitTables().getByLabel('Fit table file', { exact: true }).setInputFiles(put(name, value));
  const edited = { ...table, rows: [{ ...table.rows[0], lower: -0.016 }] };
  await add('same-id.json', edited);
  await f.page.waitForFunction(() => window.__studioDoc?.fits?.tables?.[0]?.rows?.[0]?.lower === -0.016);
  await f.ready();
  const sameId = await f.doc();
  assert.deepEqual(sameId, { ...accepted, fits: { ...accepted.fits, tables: [edited] } });
  const replacement = { ...table, id: 'replacement-fits' };
  await add('replacement-fits.json', replacement);
  await f.page.waitForFunction(() => window.__studioDoc?.fits?.tables?.length === 2);
  await f.ready();
  const both = await f.doc();
  await remove('shop-fits').click();
  await f.page.waitForFunction(() => JSON.stringify(window.__studioDoc?.fits?.tables?.map(t => t.id)) === '["replacement-fits"]');
  await f.ready();
  const replaced = await f.doc();
  assert.deepEqual(replaced, { ...both, fits: { ...both.fits, tables: [replacement] } });
  assert.deepEqual((await f.bodies()).bodies.map(({ key, volume, centroid }) => ({ key, volume, centroid })),
    bodies.bodies.map(({ key, volume, centroid }) => ({ key, volume, centroid })));
  await f.undo();
  await f.same(both);
  await f.redo();
  await f.same(replaced);
  await f.snapshot('replacement-fit-table-redone');
  assert.deepEqual(f.report.downloads, []);
});
