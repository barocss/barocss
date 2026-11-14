import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const historySummary = process.argv.includes('--history-summary');
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/sketch/useInsetRelink.ts',
  'apps/cad-studio/src/ui/InsetSourceReview.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx'];
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
    { kind: 'extrude', sketch: 2, height: 8, id: 'n3' },
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
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await button('Front', f.page.getByRole('group', { name: 'Views', exact: true })).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.openFeatureEditor(5);
  if (historySummary) {
    f.phase = 'read original Linked Inset binding';
    await checkHistorySummary('n1.top');
    await f.snapshot('linked-history-original');
  }
  const pixel = await f.page.evaluate(() => window.__studioScreenOf([130, 0, 4]));
  assert.ok(pixel?.length === 2);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces[0]?.body === 1);
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
