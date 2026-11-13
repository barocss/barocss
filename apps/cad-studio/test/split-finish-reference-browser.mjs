import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed'].includes(mode));
const stored = 'n1.side0|n2.cut.side1';
const replacement = 'n1.side0|n2.cut.side3';
const model = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 30] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', normal: [-1, 0, 0], at: -30 },
  ],
  outputs: { b2_positive: { node: 2, side: 'positive' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const files = [
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/ui/ReferenceDecisions.tsx',
  'packages/barocss-cad-model/src/engine/references.ts',
  'packages/barocss-cad-model/src/engine/rematch.ts',
  'apps/cad-studio/test/split-finish-reference-browser.mjs',
];
const f = await createFlow({
  name: 'split-finish-reference', output, envFrozen: 'D995_SOURCE_FROZEN', initialFiles: files, requiredFrozen: files,
  qualification: 'Hold Fillet and Chamfer when a native Split edge changes on Open.',
});
const button = name => f.page.getByRole('button', { name, exact: true });
const refs = () => f.page.getByRole('region', { name: 'References', exact: true });
const volumeNear = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, actual + ' vs ' + expected);

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

  for (const kind of ['fillet', 'chamfer']) {
    await f.newPage();
    f.phase = 'open a rotated Split with a missing ' + kind + ' edge';
    const finish = {
      id: 'n3', kind, parent: { node: 2, side: 'negative' }, edges: [stored],
      ...(kind === 'fillet' ? { radius: 1 } : { distance: 1 }),
      sigs: { [stored]: { k: 'line', p: [24, 0, 5], d: [0, 0, 1], s: 10 } },
    };
    const doc = { ...model, nodes: [...model.nodes, finish] };
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'split-' + kind + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await refs().waitFor();
    await f.ready();
    const opened = await f.snapshot(kind + '-opened');
    const bodies = opened.bodies.bodies;
    assert.equal(bodies.length, 2);
    const removal = kind === 'fillet' ? 10 * (1 - Math.PI / 4) : 5;
    if (mode === '--baseline') {
      assert.deepEqual(opened.doc.nodes[3].rematched, { [replacement]: stored });
      assert.equal(opened.doc.nodes[3].suppressed, undefined);
      volumeNear(bodies.find(b => b.key === 'b3').volume, 9000 - removal);
      f.report.observations.push({ kind, rematchedBeforeConfirmation: true, volume: bodies.find(b => b.key === 'b3').volume });
      continue;
    }
    const held = opened.doc.nodes[3];
    assert.deepEqual(held.edges, [stored]);
    assert.deepEqual(held.sigs, finish.sigs);
    assert.equal(held.suppressed, true);
    assert.equal(held.rematched, undefined);
    assert.ok(held.held?.includes(stored));
    assert.match(await refs().textContent(), /0 matched again.*1 need a choice.*Feature held/);
    for (const body of bodies) volumeNear(body.volume, 9000);

    f.phase = 'explicitly confirm the new Split edge for ' + kind;
    await refs().getByRole('button', { name: 'Use candidate 1', exact: true }).click();
    await f.page.waitForFunction(name => window.__studioDoc?.nodes?.[3]?.edges?.[0] === name, replacement);
    await f.ready();
    const applied = await f.snapshot(kind + '-explicitly-confirmed');
    assert.equal(applied.doc.nodes[3].held, undefined);
    assert.equal(applied.doc.nodes[3].rematched, undefined);
    assert.equal(applied.doc.nodes[3].suppressed, undefined);
    assert.deepEqual(applied.doc.nodes[3].sigs[replacement].p, [30, 0, 5]);
    volumeNear(applied.bodies.bodies.find(b => b.key === 'b3').volume, 9000 - removal);
    f.phase = 'open the confirmed ' + kind + ' document in a fresh context';
    await f.newPage();
    const [reopen] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await reopen.setFiles({ name: 'confirmed-' + kind + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(applied.doc)) });
    await f.page.waitForFunction(name => document.querySelector('.doc-tab input')?.value === name, 'confirmed-' + kind);
    await f.same(applied.doc);
    const reopened = await f.snapshot(kind + '-confirmed-reopened');
    assert.equal(await refs().count(), 0);
    volumeNear(reopened.bodies.bodies.find(b => b.key === 'b3').volume, 9000 - removal);
  }
  if (mode === '--baseline') assert.fail('Open built Fillet and Chamfer on a different Split edge before confirmation');
  assert.deepEqual(f.report.downloads, []);
});
