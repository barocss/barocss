import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed', '--history-baseline', '--history-fixed', '--live'].includes(mode));
const historyMode = mode.startsWith('--history-');
const liveMode = mode === '--live';
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
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/ui/ReferenceDecisions.tsx',
  'packages/barocss-cad-model/src/engine/references.ts',
  'packages/barocss-cad-model/src/engine/rematch.ts',
  'apps/cad-studio/test/split-finish-reference-browser.mjs',
];
const f = await createFlow({
  name: 'split-finish-reference', output, envFrozen: liveMode ? 'D997_SOURCE_FROZEN' : historyMode ? 'D996_SOURCE_FROZEN' : 'D995_SOURCE_FROZEN', initialFiles: files, requiredFrozen: files,
  qualification: 'Hold Fillet and Chamfer when a native Split edge changes on Open.',
});
const button = name => f.page.getByRole('button', { name, exact: true });
const refs = () => f.page.getByRole('region', { name: 'References', exact: true });
const volumeNear = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, actual + ' vs ' + expected);
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const projectName = 'D996 confirmed Split finish';
const openProject = async () => {
  await button('Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
};
const referenceDetails = async () => {
  const panel = refs();
  return { text: await panel.textContent(), buttons: await panel.getByRole('button').allTextContents() };
};
const proveHistoryAndSave = async (kind, opened, applied) => {
  f.phase = 'Undo candidate confirmation for ' + kind;
  await f.undo();
  await f.same(opened.doc);
  const undone = await f.snapshot(kind + '-choice-undone');
  assert.deepEqual(undone.bodies.bodies, opened.bodies.bodies);
  if (mode === '--history-baseline') {
    assert.equal(await refs().count(), 0);
    assert.fail('Undo restored held geometry but lost the candidate panel');
  }
  assert.deepEqual(await referenceDetails(), f.report.observations.at(-1).referenceDetails);
  f.phase = 'Redo candidate confirmation for ' + kind;
  await f.redo();
  await f.same(applied.doc);
  assert.equal(await refs().count(), 0);
  assert.deepEqual((await f.bodies()).bodies, applied.bodies.bodies);

  f.phase = 'save and reopen the confirmed ' + kind + ' project document';
  await openProject();
  await button('Save').click();
  const name = 'split-' + kind + '.bcad';
  await versions().locator('li[data-active="true"]').filter({ hasText: name }).waitFor();
  const saved = await f.page.evaluate(async ({ projectName, name }) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(projectName);
    return (await (await folder.getFileHandle(name)).getFile()).text();
  }, { projectName, name });
  assert.deepEqual(JSON.parse(saved), applied.doc);
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await versions().getByRole('button', { name: 'Open ' + name, exact: true }).click();
  await f.same(applied.doc);
  assert.equal(await refs().count(), 0);
  assert.deepEqual((await f.bodies()).bodies, applied.bodies.bodies);
  await f.snapshot(kind + '-project-reopened');
};

const liveEdit = async (kind, source, removal) => {
  const before = await f.snapshot(kind + '-accepted-x24');
  volumeNear(before.bodies.bodies.find(body => body.key === 'b3').volume, 7200 - removal);
  f.phase = 'edit the Split plane from X24 to X30 for ' + kind;
  await f.openFeatureEditor(2, 'Split');
  await f.editor().getByRole('spinbutton', { name: 'At', exact: true }).fill('30');
  await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  const shifted = { ...source, nodes: source.nodes.map((node, index) => index === 2 ? { ...node, at: 30 } : node) };
  await f.same(shifted);
  const good = await f.snapshot(kind + '-accepted-x30');
  volumeNear(good.bodies.bodies.find(body => body.key === 'b3').volume, 9000 - removal);
  volumeNear(good.bodies.bodies.find(body => body.key === 'b2_positive').volume, 9000);
  await f.closeEditor();
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(shifted);

  f.phase = 'refuse a reversal that removes the signed ' + kind + ' edge';
  await f.openFeatureEditor(2, 'Split');
  const history = () => Promise.all(['Undo', 'Redo'].map(name => button(name).isEnabled()));
  const historyBefore = await history();
  const accepted = await f.snapshot(kind + '-before-reversal');
  await f.editor().getByRole('spinbutton', { name: 'Normal X', exact: true }).fill('-1');
  await f.editor().getByRole('spinbutton', { name: 'At', exact: true }).fill('-30');
  await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  const error = f.editor().locator('.hud-error');
  await error.waitFor();
  assert.match(await error.textContent(), /The selected edge no longer exists/);
  assert.ok((await error.textContent()).includes(stored));
  const refused = await f.snapshot(kind + '-reversal-refused');
  for (const key of ['doc', 'bodies', 'selection', 'history']) assert.deepEqual(refused[key], accepted[key], key);
  assert.deepEqual(await history(), historyBefore);
  assert.equal(await refs().count(), 0);
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

  for (const kind of ['fillet', 'chamfer']) {
    await f.newPage();
    f.phase = 'open a rotated Split with a missing ' + kind + ' edge';
    const finish = {
      id: 'n3', kind, parent: { node: 2, side: 'negative' }, edges: [stored],
      ...(kind === 'fillet' ? { radius: 1 } : { distance: 1 }),
      sigs: { [stored]: { k: 'line', p: [24, 0, 5], d: [0, 0, 1], s: 10 } },
    };
    const sourceNodes = liveMode ? model.nodes.map((node, index) => index === 2 ? { ...node, normal: [1, 0, 0], at: 24 } : node) : model.nodes;
    const doc = { ...model, nodes: [...sourceNodes, finish] };
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'split-' + kind + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    const removal = kind === 'fillet' ? 10 * (1 - Math.PI / 4) : 5;
    if (liveMode) {
      await f.same(doc);
      await liveEdit(kind, doc, removal);
      continue;
    }
    await refs().waitFor();
    await f.ready();
    const opened = await f.snapshot(kind + '-opened');
    const bodies = opened.bodies.bodies;
    assert.equal(bodies.length, 2);
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
    if (historyMode) f.report.observations.push({ kind, referenceDetails: await referenceDetails() });

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
    if (historyMode) {
      await proveHistoryAndSave(kind, opened, applied);
      continue;
    }
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
