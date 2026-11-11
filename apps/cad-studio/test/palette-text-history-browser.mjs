// D751: trusted text Undo/Redo in the command search must leave both CAD history stacks intact.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const pins = [
  'apps/cad-studio/test/palette-text-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/Palette.tsx',
  'apps/cad-studio/src/components/ui/command.tsx',
];
const f = await createFlow({
  name: 'palette-text-history', output, envFrozen: 'D751_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Native command-search text history with current Model Undo and Redo',
  limits: ['One desktop Chromium native text editor and an ordinary edited Extrude.'],
  inspectorSource: `
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
const profile = withNode(emptyDoc(), { kind:'sketch', profile:'rectangle', min:[0,0], max:[40,30] });
console.log(JSON.stringify({ doc: withNode(profile, { kind:'extrude', sketch:0, height:20 }) }));
`,
  snapshotExtra: () => {
    const input = document.querySelector('.palette input');
    const historyActions = ['Undo', 'Redo'].map(name => {
      const control = document.querySelector(`button[aria-label="${name}"]`);
      return { disabled: control.disabled, next: control.dataset.tip };
    });
    return {
      text: input?.value ?? null, focus: !!input && input === document.activeElement,
      dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
      marker: document.querySelector('.history .marker')?.parentElement?.textContent ?? null,
      commands: window.__d751Work.length, historyActions,
    };
  },
});

function observeInputs() {
  const post = Worker.prototype.postMessage;
  window.__d751Work = [];
  Worker.prototype.postMessage = function (request, ...args) {
    if (request?.type === 'evaluate' || request?.type === 'preview') window.__d751Work.push(request.type);
    return Reflect.apply(post, this, [request, ...args]);
  };
  const focus = new WeakMap();
  window.__d751Keys = [];
  window.addEventListener('keydown', event => focus.set(event, document.activeElement === event.target), true);
  window.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') window.__d751Keys.push({
      trusted: event.isTrusted, focused: focus.get(event), search: event.target?.matches?.('.palette input') ?? false,
      prevented: event.defaultPrevented, redo: event.shiftKey, repeat: event.repeat,
    });
  });
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.addInitScript(observeInputs);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  const page = f.page, button = name => page.getByRole('button', { name, exact: true });
  const canvas = page.locator('canvas.vp-canvas');
  const palette = () => page.getByRole('dialog', { name: 'Command palette', exact: true });
  const search = () => palette().getByRole('combobox');
  const modifier = await page.evaluate(() => navigator.platform.startsWith('Mac') ? 'Meta' : 'Control');
  const undo = modifier + '+z', redo = modifier + '+Shift+z';
  const keys = () => page.evaluate(() => window.__d751Keys);
  const compareCad = (before, after) => {
    for (const field of ['doc', 'history', 'selection', 'dirty', 'marker', 'historyActions', 'commands']) {
      assert.deepEqual(after[field], before[field], field);
    }
    assert.deepEqual(after.bodies.bodies, before.bodies.bodies);
  };
  const activateCanvas = () => canvas.click({ position: { x: 780, y: 150 } });
  const openPalette = async () => {
    await page.keyboard.press('Space');
    await palette().waitFor();
    assert.ok(await search().evaluate(node => node === document.activeElement));
  };
  const closePalette = async () => {
    await page.keyboard.press('Escape');
    await palette().waitFor({ state: 'detached' });
  };
  const nativeHistory = async (label, expectedDoc) => {
    await openPalette();
    const initial = await f.snapshot(label + '-empty-search');
    assert.equal(initial.text, '');
    assert.equal(initial.focus, true);

    const start = (await keys()).length;
    await page.keyboard.down(modifier);
    try {
      await page.keyboard.down('z');
      await page.keyboard.down('z');
      await page.keyboard.up('z');
    } finally { await page.keyboard.up(modifier); }
    assert.equal(await search().inputValue(), '');
    assert.ok((await keys()).slice(start).some(key => key.repeat));

    await page.keyboard.type('x');
    assert.equal(await search().inputValue(), 'x');
    await page.keyboard.press(undo);
    assert.equal(await search().inputValue(), '');
    await page.keyboard.press(redo);
    assert.equal(await search().inputValue(), 'x');
    await page.keyboard.press(undo);
    assert.equal(await search().inputValue(), '');
    await page.keyboard.press(undo);
    assert.equal(await search().inputValue(), '');
    await page.keyboard.press(redo);
    assert.equal(await search().inputValue(), 'x');

    const owned = (await keys()).slice(start);
    assert.equal(owned.length, 7);
    for (const key of owned) assert.deepEqual({ ...key, redo: undefined, repeat: undefined },
      { trusted: true, focused: true, search: true, prevented: false, redo: undefined, repeat: undefined });
    assert.equal(owned.filter(key => key.redo).length, 2);
    const final = await f.snapshot(label + '-native-text-restored');
    assert.equal(final.text, 'x');
    assert.equal(final.focus, true);
    compareCad(initial, final);
    await f.same(expectedDoc);
    await closePalette();
    f.report.observations.push({ label, modifier, keys: owned, history: final.historyActions });
    return final;
  };

  f.phase = 'Keep native text edits local with both CAD stacks empty';
  const starter = await f.doc();
  await activateCanvas();
  const emptyCadHistory = await nativeHistory('empty-cad-history', starter);
  assert.deepEqual(emptyCadHistory.historyActions.map(action => action.disabled), [true, true]);

  f.phase = 'Build an accepted document edit and preserve its CAD Undo entry';
  const { doc: source } = await f.inspect('palette-history-source', {}, {});
  const file = 'palette-history.bcad';
  const sourceBytes = Buffer.from(JSON.stringify(source));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: sourceBytes });
  await f.same(source);
  await f.openFeatureEditor(1);
  await f.editor().getByLabel('Distance', { exact: true }).fill('24');
  await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(source);
  await f.closeEditor();
  const edited = await f.doc();
  assert.equal(edited.nodes[1].height, 24);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 28800) < 1e-8);
  f.report.observations.push({ sourceSHA256: sha256(sourceBytes) });
  await activateCanvas();
  const hasUndo = await nativeHistory('cad-undo-available', edited);
  assert.equal(hasUndo.historyActions[0].disabled, false);
  assert.equal(hasUndo.historyActions[1].disabled, true);

  f.phase = 'Use the viewport to Undo, then preserve both CAD stacks';
  await activateCanvas();
  await page.keyboard.press(undo);
  await f.same(source);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 24000) < 1e-8);
  const hasRedo = await nativeHistory('cad-redo-available', source);
  assert.equal(hasRedo.historyActions[1].disabled, false);
  await activateCanvas();
  await page.keyboard.press(redo);
  await f.same(edited);
  await f.snapshot('canvas-redo-restored-exact-edit');

  f.phase = 'Retain palette search, navigation and one command activation';
  await openPalette();
  const row = () => palette().getByRole('option', { selected: true }).getAttribute('data-value');
  const first = await row();
  assert.ok(first);
  await page.keyboard.press('ArrowDown');
  assert.notEqual(await row(), first);
  await page.keyboard.press('ArrowUp');
  assert.equal(await row(), first);
  await page.keyboard.type('shell');
  assert.ok(await palette().locator('.pl-item.off .pl-reason').count() > 0);
  await search().fill('Box');
  await page.keyboard.press('Enter');
  await palette().waitFor({ state: 'detached' });
  const box = page.getByRole('dialog', { name: 'Box', exact: true });
  await box.waitFor();
  assert.equal(await box.count(), 1);
  await box.getByRole('button', { name: 'Cancel', exact: true }).click();
  await f.same(edited);
  await f.snapshot('palette-command-cancel-keeps-model');

  f.phase = 'Read back the exact saved CAD document after search edits';
  const project = 'D751 command text history';
  const panel = () => page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const attach = async () => {
    if (!(await panel().isVisible())) await button('Project and versions').click();
    await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await panel().getByLabel('Project', { exact: true }).waitFor();
  };
  await attach();
  await button('Save').click();
  await panel().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await page.evaluate(async ([project, file]) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await dir.getFileHandle(file)).getFile()).text();
  }, [project, file]);
  assert.deepEqual(JSON.parse(saved), edited);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await panel().getByRole('button', { name: 'Close project', exact: true }).click();
  await panel().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await panel().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(edited);
  await f.snapshot('native-reopen-accepted-edit');
  assert.deepEqual(f.report.downloads, []);
});
