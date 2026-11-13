import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed'].includes(mode));
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
  'apps/cad-studio/src/ui/LibraryPanel.tsx',
  'packages/barocss-cad-model/src/engine/fits.ts',
  'apps/cad-studio/test/fit-table-removal-browser.mjs',
];
const f = await createFlow({
  name: 'fit-table-removal', output, envFrozen: 'D989_SOURCE_FROZEN', initialFiles: files, requiredFrozen: files,
  qualification: 'Refuse removal of the last row that supplies a current model fit.',
  snapshotExtra: () => ({
    fresh: window.__studioFresh,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const fitTables = () => f.page.getByRole('region', { name: 'Fit tables', exact: true });
const remove = id => fitTables().getByRole('button', { name: 'Remove fit table ' + id, exact: true });
const history = () => Promise.all(['Undo', 'Redo'].map(name => button(name).isEnabled()));
const put = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
const error = () => f.page.getByRole('alert').filter({ hasText: 'A fit class has no row in your fit tables' });

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
  await chooser.setFiles(put('fit-custody.bcad', fixture));
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
