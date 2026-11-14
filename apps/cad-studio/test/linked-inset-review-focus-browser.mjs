import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const historySummary = process.argv.includes('--history-summary');
const narrowDock = process.argv.includes('--narrow-dock');
const automaticRefusal = process.argv.includes('--automatic-refusal');
const beforeExtrude = process.argv.includes('--before-extrude');
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/sketch/useInsetRelink.ts',
  'apps/cad-studio/src/ui/InsetSourceReview.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/engine/engine.worker.ts', 'apps/cad-studio/src/engine/client.ts',
  'packages/barocss-cad-model/src/app/associativeInsetRelink.ts',
  'packages/barocss-cad-model/src/engine/part.ts'];
const f = await createFlow({
  name: 'linked-inset-review-focus', output: process.argv[2], envFrozen: 'D1204_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins, qualification: 'Linked Inset returns keyboard focus on Cancel and Apply.',
  limits: ['Desktop WebGPU, replacement with an axis-aligned native side face.'],
});
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 24], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [100, 0], max: [160, 24], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: automaticRefusal ? 3 : 8, id: 'n3' },
    { kind: 'sketch', profile: 'polygon', points: [[0, 24], [0, 0], [40, 0], [40, 24]],
      holes: [[[2, 22], [2, 2], [38, 2], [38, 22]].map(start => ({ kind: 'line', start }))],
      sideTags: { outer: ['e1', 'e2', 'e3', 'e4'], holes: [['e5', 'e6', 'e7', 'e8']] },
      plane: { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      association: { kind: 'planar-face-outline-inset', version: 1, source: { node: 1, side: 'solid' }, sourceFeature: 'n1', face: 'n1.top', insetMM: 2 },
      on: { node: 1, side: 'solid' }, id: 'n4' },
    { kind: 'extrude', sketch: 4, height: 4, id: 'n5' },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' }, b5: { node: 5, side: 'solid' } }, nextId: 6,
};
if (beforeExtrude) {
  seed.nodes.pop();
  delete seed.outputs.b5;
  seed.nextId = 5;
}
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const review = () => f.page.getByRole('complementary', { name: 'Inset source replacement', exact: true });
const replace = () => button('Replace inset source', f.editor());
const historyStep = index => f.page.locator(`.history .hs[data-node-index="${index}"]`);
const focused = () => f.page.evaluate(() => [document.activeElement.tagName, document.activeElement.getAttribute('aria-label'), document.activeElement.textContent?.trim().slice(0, 40)]);
async function waitFocus(locator) {
  const element = await locator.elementHandle();
  assert.ok(element);
  await f.page.waitForFunction(el => el === document.activeElement, element, { timeout: 5000 });
}
async function buttonVisibility(locator) {
  return locator.evaluate(element => {
    const rect = element.getBoundingClientRect(), dock = element.closest('.dock-scroll').getBoundingClientRect();
    const center = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { y: rect.top, bottom: rect.bottom, dockTop: dock.top, dockBottom: dock.bottom,
      visible: rect.top >= dock.top && rect.bottom <= dock.bottom && element.contains(center) };
  });
}
async function checkHistorySummary(face) {
  const summary = f.editor().getByRole('group', { name: 'Linked inset', exact: true });
  if (baseline) {
    await replace().waitFor();
    assert.equal(await summary.count(), 0);
    await f.snapshot('source-missing-from-editor');
    throw new Error('History exposes replacement without showing the current Linked Inset binding.');
  }
  await summary.getByText(face, { exact: true }).waitFor();
  await summary.getByText('Extrude 8 (n1)', { exact: true }).waitFor();
  await summary.getByText('2 mm', { exact: true }).waitFor();
  await summary.getByText('Replace the source with an earlier planar face. Shape edits in Edit sketch detach the link.', { exact: true }).waitFor();
}
await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'inset-focus.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  if (narrowDock) {
    await f.page.setViewportSize({ width: 1024, height: 800 });
    await f.page.getByRole('button', { name: 'Chat', exact: true }).first().click();
    await f.page.locator('.chat-col.open').waitFor();
    if (await button('Close the dock').isVisible()) await button('Close the dock').click();
  }
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await button('Front', f.page.getByRole('group', { name: 'Views', exact: true })).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  if (beforeExtrude) {
    f.phase = 'open free Linked Inset in History';
    await button('Sketch · polygon', f.page.getByRole('group', { name: 'History', exact: true })).click();
    await f.editor().waitFor();
    if (baseline) {
      await replace().waitFor();
      assert.equal(await replace().isEnabled(), true);
      await f.snapshot('premature-source-replacement');
      throw new Error('History offered source replacement before the linked sketch had an extrusion.');
    }
    const summary = f.editor().getByRole('group', { name: 'Linked inset', exact: true });
    await summary.getByText('Make a straight Extrude as a new body before replacing the source.', { exact: true }).waitFor();
    assert.equal(await replace().count(), 0);
    await f.snapshot('free-sketch-next-action');
    await f.openExtrudeHud();
    const accepted = (await f.applyExtrude({ distance: 4, previous: seed, label: 'source-replacement-ready' })).doc;
    assert.deepEqual(accepted.nodes[4], seed.nodes[4]);
    await f.openFeatureEditor(5);
    await replace().waitFor();
    assert.equal(await replace().isEnabled(), true);
    const volume = (await f.bodies()).bodies.find(body => body.key === 'b5').volume;
    assert.ok(Math.abs(volume - 960) < 1e-7);
    f.report.observations.push({ label: 'terminal-extrusion', volume });
    await f.undo();
    await f.same(seed);
    return;
  }
  if (narrowDock) await historyStep(5).click();
  else await f.openFeatureEditor(5);
  if (historySummary) {
    f.phase = 'read original Linked Inset binding';
    await checkHistorySummary('n1.top');
    await f.snapshot('linked-history-original');
  }
  const pixel = await f.page.evaluate(z => window.__studioScreenOf([130, 0, z]), automaticRefusal ? 1.5 : 4);
  assert.ok(pixel?.length === 2);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces[0]?.body === 1);
  if (narrowDock) {
    if (await button('Open the dock').isVisible()) await button('Open the dock').click();
    await f.page.locator('.dock.sheet').waitFor();
    await f.editor().waitFor();
    f.phase = 'visible first focus in the scrolled desktop Dock';
    await replace().scrollIntoViewIfNeeded();
    const scrollTop = await f.page.locator('.dock-scroll').evaluate(dock => dock.scrollTop);
    assert.ok(scrollTop > 0);
    assert.ok((await buttonVisibility(replace())).visible);
    if (automaticRefusal) {
      f.phase = 'automatic refusal on a 3 mm candidate face';
      const before = await f.snapshot('before-automatic-refusal');
      await replace().press('Enter');
      const notice = f.page.getByRole('alert').filter({ hasText: 'Inset source not replaced' });
      await notice.waitFor();
      await review().waitFor({ state: 'hidden' });
      if (!baseline) await waitFocus(replace());
      const after = await f.snapshot('automatic-refusal');
      for (const key of ['doc', 'history', 'bodies', 'selection']) assert.deepEqual(after[key], before[key], key);
      const current = await focused();
      f.report.observations.push({ label: 'automatic-refusal', focused: current[0] === 'BODY' ? ['BODY'] : current,
        volume: after.bodies.bodies.find(body => body.key === 'b5').volume, hint: await notice.locator('.toast-hint').innerText() });
      if (baseline) {
        assert.equal(current[0], 'BODY');
        throw new Error('Automatic replacement refusal lost focus to the document body.');
      }
      assert.ok((await buttonVisibility(replace())).visible);
      await notice.getByText('The inset closes on this face. Select a wider planar face and retry.', { exact: true }).waitFor();
      return;
    }
    await replace().press('Enter');
    const cancel = button('Cancel', review());
    await waitFocus(cancel);
    const visibility = await buttonVisibility(cancel);
    f.report.observations.push({ label: 'initial-focus', scrollTop, ...visibility });
    await f.snapshot('narrow-review-first-focus');
    if (baseline) {
      assert.equal(visibility.visible, false);
      throw new Error('Cancel was focused beyond the visible Dock.');
    }
    assert.equal(visibility.visible, true);
    await f.page.keyboard.press('Escape');
    await review().waitFor({ state: 'hidden' });
    await waitFocus(replace());
    const returned = await buttonVisibility(replace());
    f.report.observations.push({ label: 'focus-return', ...returned });
    assert.equal(returned.visible, true);
    await f.same(seed);
    await f.snapshot('narrow-review-cancelled');
    return;
  }
  const before = await f.snapshot('source-picked');
  for (const key of ['Enter', 'Escape']) {
    f.phase = 'keyboard Cancel with ' + key;
    await replace().press('Enter');
    await review().getByText('Extrude · 1024 mm³', { exact: true }).waitFor();
    if (baseline) await button('Cancel', review()).focus();
    else await waitFocus(button('Cancel', review()));
    await f.page.keyboard.press(key);
    await review().waitFor({ state: 'hidden' });
    if (!baseline) await waitFocus(replace());
    await f.same(seed);
    assert.deepEqual((await f.snapshot('cancel-' + key)).selection.selection, before.selection.selection);
    const actual = await focused();
    f.report.observations.push({ label: 'cancel-' + key, focused: actual[0] === 'BODY' ? ['BODY'] : actual });
    if (baseline) {
      assert.equal(actual[0], 'BODY');
      throw new Error('Keyboard Cancel moved focus to the document body.');
    }
  }
  f.phase = 'another History step takes focus';
  await replace().press('Enter');
  await review().getByText('Extrude · 1024 mm³', { exact: true }).waitFor();
  await historyStep(3).click();
  await review().waitFor({ state: 'hidden' });
  await waitFocus(historyStep(3));
  await f.same(seed);
  await f.openFeatureEditor(5);

  f.phase = 'keyboard Apply';
  await replace().press('Enter');
  await review().getByText('Extrude · 1024 mm³', { exact: true }).waitFor();
  await waitFocus(button('Cancel', review()));
  await f.page.keyboard.press('Tab');
  await waitFocus(button('Apply source', review()));
  await f.page.keyboard.press('Enter');
  await review().waitFor({ state: 'hidden' });
  await f.changed(seed);
  const accepted = (await f.snapshot('applied-source')).doc, expected = structuredClone(seed);
  Object.assign(expected.nodes[4].association, { source: { node: 3, side: 'solid' }, sourceFeature: 'n3', face: 'n3.side0' });
  assert.deepEqual(accepted, expected);
  await waitFocus(historyStep(5));
  const ring = (await f.bodies()).bodies.find(body => body.key === 'b5');
  assert.ok(Math.abs(ring.volume - 1024) < 1e-7);
  f.report.observations.push({ label: 'apply', focused: await focused(), volume: ring.volume });
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(accepted);
  if (historySummary) {
    await f.openFeatureEditor(5);
    await checkHistorySummary('n3.side0');
    await f.snapshot('linked-history-replacement');
    await f.undo();
    await f.same(seed);
    await f.openFeatureEditor(5);
    await checkHistorySummary('n1.top');
    await f.snapshot('linked-history-restored');
  }
});
