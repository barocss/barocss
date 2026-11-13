import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed', '--history-baseline', '--history-fixed', '--live', '--repick-baseline', '--repick-fixed', '--non-split'].includes(mode));
const nonSplit = mode === '--non-split';
const historyMode = mode.startsWith('--history-') || nonSplit;
const liveMode = mode === '--live';
const repickMode = mode.startsWith('--repick-');
const stored = nonSplit ? 'n1.side1|n1.side2' : 'n1.side0|n2.cut.side1';
const replacement = nonSplit ? 'n1.side2|n1.side3' : 'n1.side0|n2.cut.side3';
const nonSplitModel = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'polygon', points: [[0, 0], [5, -2], [10, 0], [10, 9.5], [0, 9.5]] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 6 },
  ],
  outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
};
const model = nonSplit ? nonSplitModel : {
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
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  ...(mode === '--repick-fixed' ? ['apps/cad-studio/src/state/useHeldFinishEdge.ts'] : []),
  ...(nonSplit ? ['packages/barocss-cad-model/src/engine/part.ts'] : []),
  'packages/barocss-cad-model/src/engine/references.ts',
  'packages/barocss-cad-model/src/engine/rematch.ts',
  'apps/cad-studio/test/split-finish-reference-browser.mjs',
];
const f = await createFlow({
  name: 'split-finish-reference', output, envFrozen: nonSplit ? 'D1004_SOURCE_FROZEN' : repickMode ? 'D998_SOURCE_FROZEN' : liveMode ? 'D997_SOURCE_FROZEN' : historyMode ? 'D996_SOURCE_FROZEN' : 'D995_SOURCE_FROZEN', initialFiles: files, requiredFrozen: files,
  qualification: nonSplit ? 'Hold Fillet and Chamfer on a unique changed edge until an explicit candidate choice.' : 'Hold Fillet and Chamfer when a native Split edge changes on Open.',
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

  if (nonSplit) {
    for (const kind of ['fillet', 'chamfer']) {
      await f.newPage();
      const finish = {
        id: 'n2', kind, parent: { node: 1, side: 'solid' }, edges: [stored],
        ...(kind === 'fillet' ? { radius: 2 } : { distance: 2 }),
        sigs: { [stored]: { k: 'line', p: [10, 10, 3], d: [0, 0, 1], s: 6 } },
      };
      f.phase = 'Open a renamed ordinary ' + kind + ' edge';
      const name = 'split-' + kind + '.bcad';
      const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
      await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...model, nodes: [...model.nodes, finish] })) });
      await refs().waitFor();
      await f.ready();
      const opened = await f.snapshot(kind + '-ordinary-open');
      assert.match(await refs().textContent(), /0 matched again.*1 need a choice.*Feature held/);
      assert.deepEqual(opened.doc.nodes[2].edges, [stored]);
      assert.deepEqual(opened.doc.nodes[2].sigs, finish.sigs);
      assert.equal(opened.doc.nodes[2].suppressed, true);
      volumeNear(opened.bodies.bodies[0].volume, 630);
      const details = refs().locator('details');
      await details.locator('summary').click();
      assert.ok((await details.textContent()).includes(stored));
      assert.ok((await details.textContent()).includes('Candidate 1: ' + replacement));
      f.report.observations.push({ kind, referenceDetails: await referenceDetails() });
      await refs().getByRole('button', { name: 'Use candidate 1', exact: true }).click();
      await refs().waitFor({ state: 'hidden' });
      await f.ready();
      const applied = await f.snapshot(kind + '-ordinary-confirmed');
      assert.deepEqual(applied.doc.nodes[2].edges, [replacement]);
      assert.deepEqual(applied.doc.nodes[2].sigs[replacement].p, [10, 9.5, 3]);
      volumeNear(applied.bodies.bodies[0].volume, kind === 'fillet' ? 630 - 6 * (4 - Math.PI) : 618);
      await proveHistoryAndSave(kind, opened, applied);
    }
    await f.newPage();
    f.phase = 'confirm an ordinary candidate whose incident wall is too short';
    const badEdge = 'n1.side3|n1.side4';
    const narrow = { ...model, nodes: [
      { ...model.nodes[0], points: [[0, 0], [5, -2], [10, 0], [10, 9], [10, 9.5], [0, 9.5]] },
      model.nodes[1],
      { id: 'n2', kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [stored], radius: 2,
        sigs: { [stored]: { k: 'line', p: [10, 10, 3], d: [0, 0, 1], s: 6 } } },
    ] };
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'narrow-corner.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(narrow)) });
    await refs().waitFor();
    await f.ready();
    const before = await f.snapshot('narrow-corner-held');
    const details = refs().locator('details');
    await details.locator('summary').click();
    assert.ok((await details.textContent()).includes('Candidate 1: ' + badEdge));
    const choices = await referenceDetails();
    const history = () => Promise.all(['Undo', 'Redo'].map(name => button(name).isEnabled()));
    const beforeHistory = await history();
    await refs().getByRole('button', { name: 'Use candidate 1', exact: true }).click();
    const refusal = await f.waitToast(/too large|Reference not applied/);
    assert.ok(refusal.includes(badEdge));
    const after = await f.snapshot('narrow-corner-refused');
    for (const key of ['doc', 'bodies', 'selection', 'history']) assert.deepEqual(after[key], before[key], key);
    assert.deepEqual(await history(), beforeHistory);
    assert.deepEqual(await referenceDetails(), choices);
    volumeNear(after.bodies.bodies[0].volume, 630);
    assert.deepEqual(f.report.downloads, []);
    return;
  }

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
    const otherEdge = 'n1.side2|n2.cut.side9';
    if (mode === '--repick-fixed' && kind === 'chamfer') {
      doc.nodes[3] = { ...finish, suppressed: true, held: 'Missing Split edge: ' + stored };
      doc.nodes.push({
        id: 'n4', kind: 'fillet', parent: { node: 2, side: 'positive' }, edges: [otherEdge], radius: 1,
        sigs: { [otherEdge]: { k: 'line', p: [24, 30, 5], d: [0, 0, 1], s: 10 } },
      });
      doc.outputs = { b3: model.outputs.b3, b4: { node: 4, side: 'solid' } };
      doc.nextId = 5;
    }
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
    const twoHeld = doc.nodes.length === 5;
    assert.match(await refs().textContent(), twoHeld ? /0 matched again.*2 need a choice.*Feature held/ : /0 matched again.*1 need a choice.*Feature held/);
    for (const body of bodies) volumeNear(body.volume, 9000);
    if (historyMode) f.report.observations.push({ kind, referenceDetails: await referenceDetails() });

    if (repickMode) {
      f.phase = 'use History to replace the held ' + kind + ' edge';
      await f.openFeatureEditor(3, kind);
      const repick = f.editor().getByRole('button', { name: 'Replace edge', exact: true });
      if (mode === '--repick-baseline') {
        assert.equal(await repick.count(), 0);
        assert.fail('History has no direct edge replacement for a held finish');
      }
      await repick.click();
      assert.equal(await f.editor().getByRole('spinbutton', { name: kind === 'fillet' ? 'Radius' : 'Distance', exact: true }).isEnabled(), false);
      assert.equal(await f.editor().getByRole('button', { name: 'Delete feature', exact: true }).isEnabled(), false);
      await f.worldClick([0, 0, 5]);
      await f.page.getByRole('alert').filter({ hasText: 'Edge not selected' }).waitFor();
      assert.equal(await f.editor().getByRole('button', { name: 'Apply edge replacement', exact: true }).isEnabled(), false);
      await f.same(opened.doc);
      await f.worldClick([60, 0, 5]);
      await f.editor().getByText('n1.side0|n1.side1', { exact: true }).waitFor();
      await f.same(opened.doc);
      await f.snapshot(kind + '-history-edge-draft');
      await f.editor().getByRole('button', { name: 'Cancel edge replacement', exact: true }).click();
      await f.same(opened.doc);
      await repick.click();
      await f.worldClick([60, 0, 5]);
      await f.editor().getByRole('button', { name: 'Apply edge replacement', exact: true }).click();
      const target = 'n1.side0|n1.side1';
      await f.page.waitForFunction(name => window.__studioDoc?.nodes?.[3]?.edges?.[0] === name, target);
      await f.ready();
      const replaced = await f.snapshot(kind + '-history-replaced');
      assert.deepEqual(replaced.doc.nodes[3].sigs[target].p, [60, 0, 5]);
      assert.equal(replaced.doc.nodes[3].suppressed, undefined);
      assert.equal(replaced.doc.nodes[3].held, undefined);
      volumeNear(replaced.bodies.bodies.find(body => body.key === 'b3').volume, 9000 - removal);
      await f.undo();
      await f.same(opened.doc);
      await refs().waitFor();
      await f.redo();
      await f.same(replaced.doc);
      if (twoHeld) {
        await refs().waitFor();
        assert.match(await refs().textContent(), /0 matched again.*1 need a choice.*Feature held/);
        assert.deepEqual(replaced.doc.nodes[4], opened.doc.nodes[4]);
        volumeNear(replaced.bodies.bodies.find(body => body.key === 'b4').volume, 9000);
      } else assert.equal(await refs().count(), 0);
      continue;
    }
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
