import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed', '--open-baseline', '--open-fixed', '--commands-baseline', '--commands-fixed', '--skeleton-baseline', '--skeleton-fixed', '--in-place-baseline', '--in-place-fixed', '--mate-baseline', '--mate-fixed', '--project-baseline', '--project-fixed', '--step-baseline', '--step-fixed', '--alternate-baseline', '--alternate-fixed', '--skeleton-keys-baseline', '--skeleton-keys-fixed'].includes(mode));
const step = mode.startsWith('--step');
const openFlow = mode.startsWith('--open') || step;
const stepPath = 'packages/barocss-cad/conformance/a6/references/block-keepout/block.step';
const commands = mode.startsWith('--commands');
const skeleton = mode.startsWith('--skeleton');
const skeletonKeys = mode.startsWith('--skeleton-keys');
const inPlace = mode.startsWith('--in-place');
const mate = mode.startsWith('--mate');
const project = mode.startsWith('--project');
const alternate = mode.startsWith('--alternate');
const pins = [
  ...(alternate ? ['apps/cad-studio/src/ui/BodyBrowserRows.tsx', 'apps/cad-studio/src/ui/FeatureHistoryMenu.tsx'] : []),
  ...(step ? [stepPath, 'apps/cad-studio/src/files/importedFile.ts'] : []),
  'apps/cad-studio/test/node-editor-draft-exit-browser.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/ui/useWorkspaceModeExit.tsx', 'apps/cad-studio/src/ui/FeatureHistoryBar.tsx',
  ...(project ? ['apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/storage/VersionsPanel.tsx'] : []),
  ...(mate ? ['apps/cad-studio/src/assembly/useAssembly.ts', 'apps/cad-studio/src/ui/MatePanel.tsx'] : []),
  ...(inPlace || mate ? ['apps/cad-studio/test/fixtures/edit-in-place.bcad', 'apps/cad-studio/src/app/editInPlace.ts'] : []),
  ...(skeleton ? ['apps/cad-studio/src/skeleton/useSkeletonEditor.tsx', 'apps/cad-studio/src/ui/SkeletonPanel.tsx'] : []),
  ...(openFlow ? ['apps/cad-studio/src/files/useStudioDocumentFiles.ts', 'apps/cad-studio/src/ui/Hud.tsx'] : []),
];
const f = await createFlow({
  name: 'node-editor-draft-exit', output, envFrozen: skeletonKeys ? 'D972_SOURCE_FROZEN' : alternate ? 'D971_SOURCE_FROZEN' : step ? 'D970_SOURCE_FROZEN' : project ? 'D969_SOURCE_FROZEN' : mate ? 'D968_SOURCE_FROZEN' : inPlace ? 'D967_SOURCE_FROZEN' : skeleton ? 'D966_SOURCE_FROZEN' : commands ? 'D965_SOURCE_FROZEN' : openFlow ? 'D964_SOURCE_FROZEN' : 'D963_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: skeletonKeys ? 'Preserve 3D sketch field focus and native button navigation.' : alternate ? 'Protect a feature draft from History context-menu and Browser feature actions.' : step ? 'Keep an active Box after validating a STEP Open.' : project ? 'Keep the active project document and its draft when a second file Open is canceled.' : mate ? 'Keep the Mate type and selected reference when a history feature is requested.' : inPlace ? 'Keep an unapplied feature edit at Edit part Cancel.' : skeleton ? 'Keep authored 3D sketch points after canceling the final Escape.' : commands ? 'Protect a Box draft at New part, templates and Model Undo and save only accepted geometry.' : openFlow ? 'Keep a Box draft after validating a native File Open.' : 'Keep unapplied feature inputs across canceled desktop mode and history navigation.',
  limits: ['One two-extrusion document with an unapplied Distance edit in the first feature.'],
  snapshotExtra: () => ({
    activeMode: document.querySelector('[data-workspace-mode] button.on')?.textContent,
    focused: document.activeElement?.getAttribute('aria-label'),
    value: document.querySelector('.node-editor input[aria-label="Distance"]')?.value ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [4, 6], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 2, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [12, 0], max: [16, 8], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 5, id: 'n3' },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const tab = name => f.page.getByRole('group', { name: 'Mode', exact: true }).getByRole('button', { name, exact: true });
const distance = () => f.editor().getByLabel('Distance', { exact: true });
const prompt = () => f.page.getByRole('dialog', { name: 'Discard feature changes?', exact: true });
const historyStep = index => f.page.locator(`.history .hs[data-node-index="${index}"]`);
const waitFocus = locator => locator.evaluate(element => new Promise((resolve, reject) => {
  let frames = 0;
  const check = () => {
    if (document.activeElement === element) resolve();
    else if (++frames === 120) reject(new Error('The draft field did not regain focus'));
    else requestAnimationFrame(check);
  };
  check();
}));

async function openCandidate(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}

async function checkOpenDraft() {
  const hud = f.page.getByRole('dialog', { name: 'Box', exact: true });
  const width = hud.getByRole('spinbutton', { name: 'Width X', exact: true });
  const height = hud.getByRole('spinbutton', { name: 'Height Z', exact: true });
  const replacement = structuredClone(source);
  replacement.nodes[1].height = 7;
  const stepBytes = step ? await readFile(new URL('../../../' + stepPath, import.meta.url)) : null;
  const requestOpen = async () => {
    if (!stepBytes) return openCandidate('New geometry', replacement);
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'New geometry.step', mimeType: 'application/step', buffer: stepBytes });
  };
  const checkReplacement = async () => {
    if (!stepBytes) return f.same(replacement);
    await f.page.waitForFunction(() => window.__studioDoc?.nodes?.[0]?.kind === 'import');
    await f.ready();
    const loaded = await f.doc();
    assert.equal(loaded.nodes[0].step, stepBytes.toString());
    assert.equal(loaded.nodes.length, 1);
    const bodies = (await f.bodies()).bodies;
    assert.equal(bodies.length, 1);
    assert.ok(Math.abs(bodies[0].volume - (40 * 30 * 10 - Math.PI * 4 ** 2 * 10)) < 1e-7);
  };
  const title = f.page.locator('.doc-tab input');
  let activePath;
  if (project) {
    await button('Project and versions').click();
    const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
    await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill('D969 draft project');
    await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await versions.getByLabel('Project', { exact: true }).waitFor();
    const files = versions.getByRole('list', { name: 'Project documents', exact: true });
    activePath = files.locator('[data-active="true"]');
    await button('Save').click();
    await activePath.getByText('Draft source.bcad', { exact: true }).waitFor();
    await openCandidate('New geometry', replacement);
    await f.same(replacement);
    await button('Save').click();
    await activePath.getByText('New geometry.bcad', { exact: true }).waitFor();
    await files.getByRole('button', { name: 'Open Draft source.bcad', exact: true }).click();
    await f.same(source);
    await activePath.getByText('Draft source.bcad', { exact: true }).waitFor();
    const openProject = () => files.getByRole('button', { name: 'Open New geometry.bcad', exact: true }).click();
    await f.openFeatureEditor(1);
    await distance().fill('4');
    const before = await f.snapshot('01-project-draft');
    await openProject();
    f.phase = 'request a valid project Open with an unapplied Distance';
    if (mode.endsWith('baseline')) {
      await f.same(replacement);
      assert.equal(await activePath.textContent(), 'New geometry.bcad');
      await f.snapshot('02-project-open-lost-draft');
      assert.fail('Project Open replaced the part and discarded the unapplied Distance');
    }
    await prompt().getByRole('button', { name: 'Keep editing', exact: true }).click();
    await prompt().waitFor({ state: 'hidden' });
    await waitFocus(distance());
    const kept = await f.snapshot('02-project-draft-kept');
    assert.equal(kept.value, '4');
    for (const field of ['doc', 'bodies', 'selection', 'history', 'dirty']) assert.deepEqual(kept[field], before[field], field);
    assert.equal(await title.inputValue(), 'Draft source');
    assert.equal(await activePath.textContent(), 'Draft source.bcad');
    await openProject();
    await prompt().getByRole('button', { name: 'Discard changes', exact: true }).click();
    await f.same(replacement);
    assert.equal(await activePath.textContent(), 'New geometry.bcad');
    await f.editor().waitFor({ state: 'hidden' });
    await f.snapshot('03-project-open-accepted');
    return;
  }
  await f.page.keyboard.press('b');
  await hud.waitFor();
  await width.fill('48');
  await height.fill('18');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  const before = await f.snapshot('01-box-draft');
  f.phase = 'open valid native file while a Box preview is active';
  if (mode.endsWith('baseline')) {
    await requestOpen();
    await checkReplacement();
    await hud.waitFor({ state: 'hidden' });
    await f.snapshot('02-open-lost-box');
    assert.fail('Open replaced the document and discarded the unapplied Box without confirmation');
  }
  for (const cancel of ['button', 'escape']) {
    await height.focus();
    await requestOpen();
    await prompt().waitFor();
    const keep = prompt().getByRole('button', { name: 'Keep editing', exact: true });
    await waitFocus(keep);
    if (cancel === 'button') await keep.click();
    else await f.page.keyboard.press('Escape');
    await prompt().waitFor({ state: 'hidden' });
    await waitFocus(height);
    assert.deepEqual([await width.inputValue(), await height.inputValue()], ['48', '18']);
    assert.equal(await hud.locator('.status').textContent(), 'preview');
    const kept = await f.snapshot('02-kept-' + cancel);
    assert.equal(await title.inputValue(), 'Draft source');
    if (activePath) assert.equal(await activePath.textContent(), 'Draft source.bcad');
    for (const field of ['doc', 'bodies', 'selection', 'history', 'dirty']) assert.deepEqual(kept[field], before[field], field);
  }
  f.phase = 'explicitly discard the Box and complete the previously checked Open';
  await requestOpen();
  await prompt().getByRole('button', { name: 'Discard changes', exact: true }).click();
  await checkReplacement();
  await hud.waitFor({ state: 'hidden' });
  assert.equal(await f.page.locator('.doc-tab input').inputValue(), 'New geometry');
  if (activePath) assert.equal(await activePath.textContent(), 'New geometry.bcad');
  await f.snapshot('03-open-accepted');
  assert.deepEqual(f.report.downloads, []);
}

async function checkModelCommands() {
  const hud = f.page.getByRole('dialog', { name: 'Box', exact: true });
  const height = hud.getByRole('spinbutton', { name: 'Height Z', exact: true });
  const width = hud.getByRole('spinbutton', { name: 'Width X', exact: true });
  const box = async () => {
    await f.page.keyboard.press('b');
    await hud.waitFor();
    await width.fill('48');
    await height.fill('18');
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  };
  await box();
  const before = await f.snapshot('01-box-before-commands');
  f.phase = 'request New part with a Box draft';
  if (mode === '--commands-baseline') {
    await button('New part').click();
    await hud.waitFor({ state: 'hidden' });
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.snapshot('02-new-part-lost-draft');
    assert.fail('New part discarded an unapplied Box without asking');
  }
  const keep = async (label, action) => {
    f.phase = 'keep Box during ' + label;
    await height.focus();
    await action();
    await prompt().waitFor();
    await prompt().getByRole('button', { name: 'Keep editing', exact: true }).click();
    await prompt().waitFor({ state: 'hidden' });
    await waitFocus(height);
    assert.deepEqual([await width.inputValue(), await height.inputValue()], ['48', '18']);
    assert.equal(await hud.locator('.status').textContent(), 'preview');
    const after = await f.snapshot('02-kept-' + label);
    for (const field of ['doc', 'bodies', 'history', 'selection', 'dirty']) assert.deepEqual(after[field], before[field], field);
  };
  await keep('new-part', () => button('New part').click());
  await keep('model-undo', () => button('Undo').click());
  const template = f.page.getByRole('menuitem', { name: 'New from Empty part', exact: true });
  const showTemplates = () => button('New from a template').click();
  await keep('template', async () => { await showTemplates(); await template.click(); });
  if (await template.isVisible()) await showTemplates();

  f.phase = 'Cmd+S keeps the draft and emits the accepted document';
  await height.focus();
  await f.page.keyboard.press('Meta+s');
  await f.page.waitForFunction(() => window.__d965Saves.length === 1);
  const saved = await f.page.evaluate(() => window.__d965Saves[0]);
  assert.equal(saved.name, 'Draft source.bcad');
  assert.deepEqual(JSON.parse(saved.text), source);
  await waitFocus(height);
  assert.deepEqual([await width.inputValue(), await height.inputValue()], ['48', '18']);
  assert.equal(await hud.locator('.status').textContent(), 'preview');

  f.phase = 'discard a Box explicitly and let the requested template replace the document';
  await showTemplates();
  await template.click();
  await prompt().getByRole('button', { name: 'Discard changes', exact: true }).click();
  await hud.waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  assert.equal(await f.page.locator('.doc-tab input').inputValue(), 'Untitled');
  await f.snapshot('03-template-accepted');
  assert.deepEqual(f.report.downloads, []);
}

async function checkSkeleton() {
  const page = f.page;
  const panel = page.getByRole('complementary', { name: '3D sketch', exact: true });
  const overlay = page.locator('.vp-overlay g[aria-label="3D sketch"][data-points]');
  await button('New part').click();
  await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click();
  await page.waitForFunction(() => window.__studioEye?.()?.[2] > 0 &&
    document.querySelector('.view-cube .vc-label')?.textContent === 'TOP');
  await page.mouse.click(600, 550);
  await page.keyboard.press('Space');
  await page.locator('.palette input').fill('3d sketch');
  await page.keyboard.press('Enter');
  await panel.waitFor();
  for (const [index, world] of [[0, [0, 0, 0]], [1, [skeletonKeys ? 30 : 25, 0, 0]]]) {
    const pixel = await page.evaluate(point => window.__studioScreenOf(point), world);
    assert.ok(pixel);
    await page.mouse.click(...pixel);
    await page.waitForFunction(count => Number(document.querySelector('.vp-overlay [aria-label="3D sketch"]')?.dataset.points) === count, index + 1);
  }
  assert.equal(await overlay.getAttribute('data-segments'), '1');
  if (skeletonKeys) { await checkSkeletonKeys(panel, empty); return; }
  await page.keyboard.press('Escape');
  await panel.waitFor();
  const xy = panel.getByRole('button', { name: 'XY', exact: true });
  await xy.focus();
  const before = await f.snapshot('01-chain-ended');
  const marks = await overlay.innerHTML();
  f.phase = 'request the final Escape from a changed 3D sketch';
  await page.keyboard.press('Escape');
  if (mode === '--skeleton-baseline') {
    await panel.waitFor({ state: 'hidden' });
    await f.same(empty);
    await f.snapshot('02-skeleton-lost');
    assert.fail('Final Escape silently discarded two points and their segment');
  }
  await prompt().waitFor();
  const keep = prompt().getByRole('button', { name: 'Keep editing', exact: true });
  await waitFocus(keep);
  await keep.click();
  await prompt().waitFor({ state: 'hidden' });
  await waitFocus(xy);
  const retained = await f.snapshot('02-skeleton-kept');
  for (const field of ['doc', 'selection', 'history', 'dirty']) assert.deepEqual(retained[field], before[field], field);
  assert.equal(await overlay.innerHTML(), marks);
  f.phase = 'discard the exact 3D sketch on a confirmed final Escape';
  await page.keyboard.press('Escape');
  await prompt().getByRole('button', { name: 'Discard changes', exact: true }).click();
  await panel.waitFor({ state: 'hidden' });
  await f.same(empty);
  assert.equal(await overlay.count(), 0);
  await f.snapshot('03-skeleton-discarded');
}

async function checkSkeletonKeys(panel, empty) {
  const page = f.page;
  const line = panel.getByRole('button', { name: 'Line', exact: true });
  const select = panel.getByRole('button', { name: 'Select', exact: true });
  const xy = panel.getByRole('button', { name: 'XY', exact: true });
  await select.click();
  const middle = await page.evaluate(() => window.__studioScreenOf([15, 0, 0]));
  await page.mouse.click(...middle);
  await panel.getByRole('button', { name: 'Add Length', exact: true }).click();
  const length = panel.getByLabel('Constraint 1 value', { exact: true });
  assert.equal(await length.inputValue(), '30');
  await length.fill('24');
  f.phase = 'press Enter from the Length field without applying the sketch';
  await length.press('Enter');
  await page.waitForFunction(() => document.querySelector('.skel-mark text')?.textContent.includes('24'));
  if (mode.endsWith('baseline')) {
    const lost = await f.snapshot('01-length-focus-lost');
    assert.notEqual(lost.focused, 'Constraint 1 value');
    await page.keyboard.press('Enter');
    await panel.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 1);
    await f.snapshot('02-unintended-apply');
    assert.fail('The Length input lost focus and the second Enter applied the whole sketch');
  }
  await waitFocus(length);
  await page.keyboard.press('Enter');
  await waitFocus(length);
  assert.equal(await length.inputValue(), '24');
  await f.same(empty);
  await f.snapshot('01-length-24-focused');

  f.phase = 'use Tab and Shift+Tab as native focus navigation';
  await line.focus();
  await page.keyboard.press('Tab');
  await waitFocus(select);
  assert.equal(await xy.getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Shift+Tab');
  await waitFocus(line);
  assert.equal(await xy.getAttribute('aria-pressed'), 'true');

  f.phase = 'Shift+Enter on Cancel must not apply the sketch';
  await panel.getByRole('button', { name: 'Cancel 3D sketch', exact: true }).focus();
  await page.keyboard.press('Shift+Enter');
  await panel.waitFor({ state: 'hidden' });
  await f.same(empty);
  await f.snapshot('02-cancel-without-apply');
  assert.deepEqual(f.report.downloads, []);
}

async function checkInPlace() {
  const fixture = JSON.parse(await readFile(new URL('fixtures/edit-in-place.bcad', import.meta.url), 'utf8'));
  await openCandidate('Assembly', fixture);
  await f.page.waitForFunction(() => window.__studioDoc?.instances?.length === 2);
  await f.ready();
  const original = await f.doc();
  const banner = f.page.getByRole('status', { name: 'Editing a part in place', exact: true });
  await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Cube 2' }).click();
  await f.page.getByRole('complementary', { name: 'Instance', exact: true }).getByRole('button', { name: 'Edit part', exact: true }).click();
  await banner.waitFor();
  await f.ready();
  const part = await f.doc();
  assert.equal(part.instances, undefined);
  await f.openFeatureEditor(1);
  await distance().fill('28');
  const before = await f.snapshot('01-part-draft');
  f.phase = 'cancel the in-place edit with no committed part changes';
  await banner.getByRole('button', { name: 'Cancel', exact: true }).click();
  if (mode === '--in-place-baseline') {
    await banner.waitFor({ state: 'hidden' });
    await f.same(original);
    await f.snapshot('02-part-draft-lost');
    assert.fail('Cancel left the part and silently discarded the unapplied Distance');
  }
  const confirmation = f.page.getByRole('dialog', { name: 'Discard changes to this part?', exact: true });
  await confirmation.waitFor();
  const keep = confirmation.getByRole('button', { name: 'Keep editing', exact: true });
  await keep.click();
  await confirmation.waitFor({ state: 'hidden' });
  await waitFocus(distance());
  const retained = await f.snapshot('02-part-draft-kept');
  assert.equal(retained.value, '28');
  for (const key of ['doc', 'bodies', 'history', 'selection', 'dirty']) assert.deepEqual(retained[key], before[key], key);
  await banner.getByRole('button', { name: 'Cancel', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await banner.waitFor({ state: 'hidden' });
  await f.same(original);
  await f.snapshot('03-exact-assembly-restored');
}

async function checkMate() {
  const fixture = JSON.parse(await readFile(new URL('fixtures/edit-in-place.bcad', import.meta.url), 'utf8'));
  await openCandidate('Assembly', fixture);
  await f.page.waitForFunction(() => window.__studioDoc?.instances?.length === 2);
  await f.ready();
  const original = await f.doc();
  const mates = f.page.getByRole('complementary', { name: 'Mates', exact: true });
  await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Cube 2' }).click();
  await mates.getByRole('button', { name: 'Add mate', exact: true }).click();
  const type = mates.getByLabel('Mate type', { exact: true });
  await type.selectOption('distance');
  const stays = mates.locator('.kv').filter({ hasText: '1 · Stays' }).locator('b');
  await mates.getByRole('button', { name: 'Pick XY plane', exact: true }).click();
  await f.page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Mates"] .kv')].some(
    row => row.textContent.includes('1 · Stays') && !row.textContent.includes('click a face')));
  const picked = await stays.textContent();
  assert.ok(picked);
  await type.focus();
  const before = await f.snapshot('01-mate-draft');
  f.phase = 'request history feature while Mate has a selected reference';
  await historyStep(1).click();
  if (mode === '--mate-baseline') {
    await f.editor().waitFor();
    await type.waitFor({ state: 'hidden' });
    await f.same(original);
    await f.snapshot('02-mate-draft-lost');
    assert.fail('The feature transition discarded the unapplied Mate without confirmation');
  }
  await prompt().waitFor();
  await prompt().getByRole('button', { name: 'Keep editing', exact: true }).click();
  await prompt().waitFor({ state: 'hidden' });
  await waitFocus(type);
  assert.equal(await type.inputValue(), 'distance');
  assert.equal(await stays.textContent(), picked);
  const kept = await f.snapshot('02-mate-draft-kept');
  for (const field of ['doc', 'bodies', 'selection', 'history', 'dirty']) assert.deepEqual(kept[field], before[field], field);
  await historyStep(1).click();
  await prompt().getByRole('button', { name: 'Discard changes', exact: true }).click();
  await type.waitFor({ state: 'hidden' });
  await f.editor().waitFor();
  await f.same(original);
  await f.snapshot('03-history-feature-after-discard');
  f.report.observations.push({ label: 'mate-draft', type: 'distance', stays: picked });
}

async function checkAlternateFeature() {
  const candidate = structuredClone(source);
  candidate.nodes.push({ kind: 'translate', parent: { node: 3, side: 'solid' }, offset: [4, 0, 0], id: 'n4' });
  candidate.outputs = { b1: candidate.outputs.b1, b4: { node: 4, side: 'solid' } };
  candidate.nextId = 5;
  await openCandidate('Feature routes', candidate);
  await f.same(candidate);
  await f.page.getByRole('button', { name: 'Show its features', exact: true }).filter({ visible: true }).last().click();
  const browserStep = f.page.locator('button.ol-step').filter({ hasText: 'Extrude 5' });
  await browserStep.waitFor();
  await f.openFeatureEditor(1);
  await distance().fill('4');
  const before = await f.snapshot('01-draft');
  const historyMenu = async () => {
    await historyStep(3).click({ button: 'right' });
    await f.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  };
  if (mode.endsWith('baseline')) {
    f.phase = 'switch to another feature through the History context menu';
    await historyMenu();
    await f.page.waitForFunction(() => document.querySelector('.node-editor input[aria-label="Distance"]')?.value === '5');
    await f.snapshot('02-draft-replaced');
    assert.fail('The History menu replaced the unapplied 4 mm Distance');
  }

  for (const [label, action] of [['history-menu', historyMenu], ['browser', () => browserStep.click()]]) {
    f.phase = 'keep the current Distance at ' + label;
    await distance().focus();
    await action();
    await prompt().getByRole('button', { name: 'Keep editing', exact: true }).click();
    await prompt().waitFor({ state: 'hidden' });
    await waitFocus(distance());
    const kept = await f.snapshot('02-kept-' + label);
    assert.equal(kept.value, '4');
    for (const key of ['doc', 'bodies', 'selection', 'history', 'dirty']) assert.deepEqual(kept[key], before[key], key);
  }
  await browserStep.click();
  await prompt().getByRole('button', { name: 'Discard changes', exact: true }).click();
  await f.page.waitForFunction(() => document.querySelector('.node-editor input[aria-label="Distance"]')?.value === '5');
  await f.same(candidate);
  const changed = await f.snapshot('03-other-feature');
  assert.deepEqual(changed.selection.selection.bodies, [1]);
}

function captureNativeSave() {
  const create = URL.createObjectURL;
  const click = HTMLAnchorElement.prototype.click;
  const blobs = new Map();
  window.__d965Saves = [];
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    blobs.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = blobs.get(this.href);
    if (!blob || !this.download.endsWith('.bcad')) return click.call(this);
    const name = this.download;
    void blob.text().then(text => window.__d965Saves.push({ name, text }));
  };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(60000);
    if (commands) await context.addInitScript(captureNativeSave);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  if (inPlace) { await checkInPlace(); return; }
  if (mate) { await checkMate(); return; }
  if (alternate) { await checkAlternateFeature(); return; }
  await openCandidate('Draft source', source);
  await f.same(source);
  if (openFlow || project) { await checkOpenDraft(); return; }
  if (commands) { await checkModelCommands(); return; }
  if (skeleton) { await checkSkeleton(); return; }
  await f.openFeatureEditor(1);
  await distance().fill('4');
  const before = await f.snapshot('01-dirty-node-editor');
  assert.equal(before.value, '4');

  if (mode === '--baseline') {
    f.phase = 'Render drops the unapplied Distance';
    await tab('Render').click();
    await f.editor().waitFor({ state: 'hidden' });
    await tab('Model').click();
    await distance().waitFor();
    const returned = await f.snapshot('02-render-dropped-draft');
    assert.deepEqual(returned.doc, source);
    assert.equal(returned.value, '4', 'returning from Render must preserve the unapplied Distance');
    return;
  }

  const assertDraft = async (label, value) => {
    await waitFocus(distance());
    const kept = await f.snapshot(label);
    assert.equal(kept.activeMode, 'Model');
    assert.equal(kept.value, value);
    for (const field of ['doc', 'selection', 'history', 'dirty']) assert.deepEqual(kept[field], before[field], field);
  };
  for (const [label, trigger] of [['render', tab('Render')], ['sketch', tab('Sketch')], ['feature', historyStep(3)]]) {
    f.phase = 'keep the Distance draft on ' + label;
    await distance().focus();
    await trigger.click();
    await prompt().waitFor();
    await waitFocus(prompt().getByRole('button', { name: 'Keep editing', exact: true }));
    await prompt().getByRole('button', { name: 'Keep editing', exact: true }).click();
    await prompt().waitFor({ state: 'hidden' });
    await assertDraft('02-keep-' + label, '4');
  }

  f.phase = 'keep an incomplete numeric edit on Escape';
  await distance().fill('');
  await tab('Render').click();
  await prompt().waitFor();
  await f.page.keyboard.press('Escape');
  await prompt().waitFor({ state: 'hidden' });
  await assertDraft('03-keep-blank', '');

  f.phase = 'discard only the unapplied feature draft and switch to the requested feature';
  await distance().fill('4');
  await historyStep(3).click();
  await prompt().getByRole('button', { name: 'Discard changes', exact: true }).click();
  await prompt().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => document.querySelector('.node-editor input[aria-label="Distance"]')?.value === '5');
  await f.same(source);
  await f.snapshot('04-other-feature');
  await historyStep(1).click();
  await f.page.waitForFunction(() => document.querySelector('.node-editor input[aria-label="Distance"]')?.value === '2');
  await f.snapshot('05-original-value');
  assert.deepEqual(f.report.downloads, []);
});
