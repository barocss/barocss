// D728: spatial cavity admission through normal desktop Studio Open and Add reference.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { stepCavityFixture } from '../../../packages/barocss-cad/test/step-cavity-fixture.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/step-cavity-containment-browser.mjs',
  'apps/cad-studio/src/files/importedFile.ts',
  'packages/barocss-cad/src/io/step-import.ts',
  'packages/barocss-cad/src/io/step-cavity-internal.ts',
  'packages/barocss-cad/test/step-cavity-fixture.mjs',
];
const f = await createFlow({
  name: 'step-cavity-containment', output, envFrozen: 'D728_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce admitted invalid void placement with valid shell orientation' : 'Refuse proven spatial cavity violations before adoption',
  limits: ['Independently written planar box shell fixtures.'],
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  let page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const file = async (name, text) => {
    const path = join(output, name);
    await writeFile(path, text);
    return path;
  };
  const open = async path => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(path);
  };
  const opened = async (name, voids, volume) => {
    const { text } = stepCavityFixture(voids);
    const path = await file(name + '.step', text);
    await open(path);
    await f.waitToast(/STEP opened.*1 solid/);
    await page.waitForFunction(expected => window.__studioDoc.nodes[0]?.step === expected, text);
    await f.ready();
    const state = await f.snapshot(name);
    assert.ok(Math.abs(state.bodies.bodies[0].volume - volume) < 1e-7);
    f.report.observations.push({ name, sha256: sha256(text), reportedVolume: state.bodies.bodies[0].volume });
    await f.dismissToasts();
    return { state, path };
  };
  const valid = [[[2,2,2],[4,4,4]], [[6,5,2],[9,7,3]]];
  const invalid = [
    { name: 'nested', voids: [[[2,2,2],[8,8,8]], [[4,4,4],[6,6,6]]], previous: 776, reason: /void.*(nested|overlap)/i },
    { name: 'crossing', voids: [[[2,4,4],[8,6,6]], [[4,2,4.5],[6,8,5.5]]], previous: 964, reason: /void.*(intersect|overlap)/i },
    { name: 'touching-voids', voids: [[[2,2,2],[4,4,4]], [[4,2,2],[6,4,4]]], previous: 984, reason: /void.*(touch|intersect|overlap)/i },
    { name: 'touching-outer', voids: [[[0,4,4],[2,6,6]]], previous: 992, reason: /void.*(outer|exterior)/i },
    { name: 'outside-outer', voids: [[[9,4,4],[11,6,6]]], previous: 992, reason: /void.*(outer|exterior)/i },
  ];
  f.phase = 'Open the disjoint control';
  const control = await opened('disjoint-voids', valid, 986);
  if (baseline) {
    for (const { name, voids, previous } of invalid) {
      f.phase = 'Reproduce acceptance of ' + name;
      await opened(name, voids, previous);
    }
    return;
  }

  await page.getByLabel('Add reference', { exact: true }).setInputFiles(control.path);
  await page.getByRole('listitem', { name: 'Reference ref1', exact: true }).getByText(/18 faces/).waitFor();
  const row = page.locator('.ol-row').filter({ has: page.locator('button.ol-eye') }).locator('button.ol').first();
  await row.dblclick();
  const name = page.getByRole('textbox', { name: 'Body name', exact: true });
  const withReference = await f.doc();
  await name.fill('Two disjoint voids');
  await name.press('Enter');
  await f.changed(withReference);
  await f.undo();
  await f.same(withReference);
  await row.click();
  const accepted = await f.snapshot('accepted-control-and-redo');
  const redo = await button('Redo').getAttribute('data-tip');
  assert.equal(await button('Redo').isEnabled(), true);

  const unchanged = async label => {
    const result = await f.snapshot(label);
    assert.deepEqual(result.doc, accepted.doc);
    assert.deepEqual(result.bodies.bodies, accepted.bodies.bodies);
    assert.deepEqual(result.selection.selection, accepted.selection.selection);
    assert.deepEqual(result.history, accepted.history);
    assert.equal(await button('Redo').isEnabled(), true);
    assert.equal(await button('Redo').getAttribute('data-tip'), redo);
  };
  for (const { name, voids, reason } of invalid) {
    f.phase = 'Refuse ' + name;
    const { text } = stepCavityFixture(voids), path = await file(name + '.step', text);
    await open(path);
    const notice = await f.waitToast(/Could not open this file/);
    assert.match(notice, reason);
    await unchanged(name + '-refused');
    f.report.observations.push({ name, sha256: sha256(text), notice });
    await f.dismissToasts();
    if (name === 'nested') {
      await page.getByLabel('Add reference', { exact: true }).setInputFiles(path);
      const notice = await f.waitToast(/Reference not changed/);
      assert.match(notice, reason);
      await unchanged('nested-reference-refused');
      await f.dismissToasts();
    }
  }

  f.phase = 'Redo the accepted edit and verify valid STEP still opens afterwards';
  await f.redo();
  const edited = await f.snapshot('accepted-redo');
  assert.equal(edited.doc.bodies[edited.bodies.bodies[0].key].name, 'Two disjoint voids');
  await opened('disjoint-voids-reopened', valid, 986);
  f.phase = 'Open disjoint voids with nested bounds and a real through opening';
  const tube = [[2,2,2],[8,8,8], [[4,4],[6,6]]], center = [[4.5,4.5,4.5],[5.5,5.5,5.5]];
  await opened('genus-one-cavity-control', [tube, center], 807);
  assert.deepEqual(f.report.downloads, []);
});
