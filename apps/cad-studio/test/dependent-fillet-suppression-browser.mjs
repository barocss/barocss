import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed'].includes(mode));
const nodes = [
  { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
  { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
  { id: 'n2', kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 4 },
  { id: 'n3', kind: 'fillet', parent: { node: 2, side: 'solid' }, edges: ['n1.side1|n2.face'], radius: 0.5 },
];
const model = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes, outputs: { b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const files = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useFeatureHistory.ts',
  'apps/cad-studio/src/ui/FeatureHistoryBar.tsx',
  'apps/cad-studio/src/ui/FeatureHistoryMenu.tsx',
  'apps/cad-studio/test/dependent-fillet-suppression-browser.mjs',
];
const f = await createFlow({
  name: 'dependent-fillet-suppression', output, envFrozen: 'D991_SOURCE_FROZEN', initialFiles: files, requiredFrozen: files,
  qualification: 'Protect a dependent Fillet when suppressing its source while History is rolled back.',
  snapshotExtra: () => ({
    fresh: window.__studioFresh,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    rolled: [...document.querySelectorAll('.history .hs.rolled')].map(row => row.dataset.nodeIndex),
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const row = index => f.page.locator('.history .hs[data-node-index="' + index + '"]');
const history = () => Promise.all(['Undo', 'Redo'].map(name => button(name).isEnabled()));
const suppress = async index => {
  await row(index).click({ button: 'right' });
  await f.page.getByRole('menuitem', { name: 'Suppress', exact: true }).click();
};
const rollBack = async index => {
  await row(index).click({ button: 'right' });
  await f.page.getByRole('menuitem', { name: 'Roll back to here', exact: true }).click();
  await row(index + 1).and(f.page.locator('.rolled')).waitFor();
  await f.ready();
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
  f.phase = 'open a box with two valid dependent Fillets';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'dependent-fillets.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(model)) });
  await f.page.waitForFunction(() => document.querySelector('.doc-tab input')?.value === 'dependent-fillets');
  await f.same(model);
  const full = await f.snapshot('full-history');
  assert.equal(full.bodies.bodies[0].key, 'b3');

  f.phase = 'roll back before the dependent Fillet and suppress its source';
  await rollBack(2);
  const before = await f.snapshot('rolled-back');
  assert.deepEqual(before.rolled, ['3']);
  assert.ok(Math.abs(before.bodies.bodies[0].volume - (40 * 30 * 20 - 40 * (16 - 4 * Math.PI))) < 1e-7);
  const historyBefore = await history();
  await suppress(2);
  const error = f.page.getByRole('alert').filter({ hasText: 'The selected edge no longer exists' });
  await error.waitFor();
  assert.match(await error.textContent(), /n1\.side1\|n2\.face/);
  if (mode === '--baseline') {
    const failed = await f.snapshot('invalid-suppressed-fillets');
    assert.equal(failed.doc.nodes[2].suppressed, true);
    assert.equal(failed.doc.nodes[3].suppressed, undefined);
    assert.deepEqual(failed.rolled, []);
    assert.equal(failed.fresh, false);
    assert.deepEqual(failed.bodies.bodies, before.bodies.bodies);
    assert.fail('Suppress committed a valid prefix over a failing full history');
  }
  assert.match(await error.textContent(), /break Fillet R0\.5 \(n3\).*suppress that feature first/);
  const refused = await f.snapshot('suppression-refused');
  for (const key of ['doc', 'bodies', 'selection', 'history', 'dirty', 'fresh', 'rolled']) {
    assert.deepEqual(refused[key], before[key], key);
  }
  assert.deepEqual(await history(), historyBefore);

  f.phase = 'suppress the dependent first, then the source, and verify history';
  await button('Roll forward to the end').click();
  await f.same(model);
  await suppress(3);
  const one = { ...model, nodes: model.nodes.map((node, i) => i === 3 ? { ...node, suppressed: true } : node) };
  await f.same(one);
  await rollBack(2);
  await suppress(2);
  const both = { ...one, nodes: one.nodes.map((node, i) => i === 2 ? { ...node, suppressed: true } : node) };
  await f.same(both);
  const final = await f.snapshot('both-fillets-suppressed');
  assert.deepEqual(final.rolled, []);
  assert.equal(final.bodies.bodies.length, 1);
  assert.ok(Math.abs(final.bodies.bodies[0].volume - 24000) < 1e-7);
  await f.undo();
  await f.same(one);
  assert.deepEqual((await f.snapshot('suppression-undone')).rolled, ['3']);
  await f.redo();
  await f.same(both);
  assert.deepEqual((await f.snapshot('suppression-redone')).rolled, []);
  assert.deepEqual(f.report.downloads, []);
});
