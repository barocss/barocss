// D746: a real XY sketch must use the visibility of its model snap candidates.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/sketch-snap-visibility-browser.mjs',
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/useModelAppearance.ts',
  'packages/barocss-cad-model/src/sketch/osnap.ts',
  ...(baseline ? [] : ['apps/cad-studio/src/viewport/modelSketchSnaps.ts']),
];
const f = await createFlow({
  name: 'sketch-snap-visibility', output, envFrozen: 'D746_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce a hidden-body snap in an authored sketch' : 'Filter hidden bodies from current sketch snap input',
  limits: ['Explicit top-level visibility in the ordinary XY sketch flow.'],
  snapshotExtra: () => ({
    cue: document.querySelector('.sk-osnap text')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => {
      const el = document.querySelector(`button[aria-label="${name}"]`);
      return [el.disabled, el.getAttribute('data-tip')];
    }),
  }),
});

const target = [10.25, 12.25], opposite = [18, 19];
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [-9, -5], max: [-5, -1], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 4, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: target, max: [14.25, 16.25], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 4, id: 'n3' },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } },
  nextId: 4, bodies: { b1: { name: 'Visible A' }, b3: { name: 'Snap B' } },
};

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
  const page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const outliner = () => page.getByRole('complementary', { name: 'Browser', exact: true });
  const body = name => outliner().locator('.ol-row').filter({ has: button(name) });
  const cue = () => page.locator('.sk-osnap text');
  const open = async (name, doc) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await f.same(doc);
  };
  const visibility = async shown => {
    const row = body('Snap B');
    await row.getByRole('button', { name: shown ? 'Show body' : 'Hide body', exact: true }).click();
    await row.getByRole('button', { name: shown ? 'Hide body' : 'Show body', exact: true }).waitFor();
    await f.ready();
    const doc = await f.doc();
    assert.equal(doc.bodies.b3.hidden === true, !shown);
    assert.deepEqual(doc.nodes, source.nodes);
    return doc;
  };
  const begin = async () => {
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Space');
    await page.locator('.palette input').fill('Sketch');
    await page.keyboard.press('Enter');
    await f.sketchPanel().waitFor();
    await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
    await f.tool('Rectangle', 'r');
    await f.frame([[-9, -5], [0, 0], target, opposite]);
  };
  const hover = async point => {
    const pixel = await page.evaluate(p => window.__studioScreenOf([...p, 0]), point);
    await page.mouse.move(...pixel);
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  };
  const expectCue = async name => {
    if (name === null) await cue().waitFor({ state: 'hidden' });
    else {
      await cue().waitFor();
      assert.equal(await cue().textContent(), name);
    }
  };
  const commitRectangle = async (label, before, minimum) => {
    const beforeBodies = await f.bodies();
    await f.worldClick(target);
    await f.worldClick(opposite);
    assert.deepEqual(await f.doc(), before);
    const after = await f.finishSketch(label);
    const node = after.doc.nodes.at(-1);
    assert.equal(node.kind, 'sketch');
    assert.equal(node.profile, 'rectangle');
    assert.deepEqual(node.min, minimum);
    assert.deepEqual(node.max, opposite);
    assert.deepEqual(after.doc.nodes.slice(0, 4), source.nodes);
    assert.deepEqual(after.doc.bodies, before.bodies);
    assert.deepEqual(after.bodies.bodies, beforeBodies.bodies);
    return after.doc;
  };

  f.phase = 'Verify visibility during actual rectangle input';
  await open('snap-visibility', source);
  if (baseline) {
    const hidden = await visibility(false);
    await begin();
    await hover(target);
    await expectCue('End');
    await f.snapshot('hidden-body-end-cue');
    await commitRectangle('hidden-body-authored-end', hidden, target);
    return;
  }

  await begin();
  await hover(target);
  await expectCue('End');
  await f.snapshot('visible-body-end-cue');
  const hidden = await visibility(false);
  await expectCue(null);
  await hover(target);
  await expectCue(null);
  await hover([-7, -5]);
  await expectCue('Middle');
  await hover([0, 0]);
  await expectCue('Origin');
  await visibility(true);
  await hover(target);
  await expectCue('End');
  await f.snapshot('restored-body-end-cue');
  const hiddenAgain = await visibility(false);
  assert.deepEqual(hiddenAgain, hidden);
  await hover(target);
  await expectCue(null);
  const authored = await commitRectangle('hidden-body-grid-coordinate', hiddenAgain, [10, 12]);
  await f.undo();
  await f.same(hiddenAgain);
  await f.redo();
  await f.same(authored);

  const project = 'D746 sketch fixture', file = 'snap-visibility.bcad';
  const versions = () => page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const attach = async () => {
    if (!(await versions().isVisible())) await button('Project and versions').click();
    await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await versions().getByLabel('Project', { exact: true }).waitFor();
  };
  await attach();
  await button('Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await page.evaluate(async ([name, file]) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(name);
    return (await (await dir.getFileHandle(file)).getFile()).text();
  }, [project, file]);
  assert.deepEqual(JSON.parse(saved), authored);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await versions().getByRole('button', { name: 'Close project', exact: true }).click();
  await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await versions().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(authored);
  await body('Snap B').getByRole('button', { name: 'Show body', exact: true }).waitFor();
  await f.snapshot('reopened-hidden-grid-profile');
  await begin();
  await hover(target);
  await expectCue(null);
  f.phase = 'Check current sketch construction visibility and Cancel';
  await f.frame([[20, 22], [24, 22]]);
  await button('Construction').click();
  await f.tool('Line', 'l');
  await f.worldClick([20, 22]);
  await f.worldClick([24, 22]);
  await button('Construction').click();
  await f.tool('Rectangle', 'r');
  await button('Hide construction').waitFor();
  await hover([22, 22]);
  await expectCue('Middle');
  await f.snapshot('visible-construction-midpoint');
  await button('Hide construction').click();
  await hover([22, 22]);
  await expectCue(null);
  await f.snapshot('hidden-construction-without-cue');
  await button('Show construction').click();
  await hover([22, 22]);
  await expectCue('Middle');
  await page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(authored);

  f.phase = 'Open a visible replacement with the same body keys';
  await open('visible-replacement', source);
  await begin();
  await hover(target);
  await expectCue('End');
  await commitRectangle('visible-body-authored-end', source, target);
  assert.deepEqual(f.report.downloads, []);
});
