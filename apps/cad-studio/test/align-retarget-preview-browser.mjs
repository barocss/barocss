import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const targetNames = process.argv.includes('--target-names');
const namesBaseline = process.argv.includes('--names-baseline');
const historyPreview = process.argv.includes('--history-preview');
const previewBaseline = process.argv.includes('--preview-baseline');
const delayHistoryPreview = process.argv.includes('--delay-history-preview');
const alignWaiting = process.argv.includes('--waiting-state');
const waitingBaseline = process.argv.includes('--waiting-baseline');
const gapBounds = process.argv.includes('--gap-bounds');
const gapBaseline = process.argv.includes('--gap-baseline');
const placementBounds = process.argv.includes('--placement-bounds');
const placementBaseline = process.argv.includes('--placement-baseline');
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/ui/AlignHistoryTarget.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  ...(historyPreview && !previewBaseline ? ['apps/cad-studio/src/app/useAlignHistoryPreview.ts'] : []),
  'packages/barocss-cad-model/src/app/alignCommand.ts'];
const f = await createFlow({
  name: 'align-retarget-preview', output: process.argv[2], envFrozen: process.argv.includes('--retarget') ? 'D1203_SOURCE_FROZEN' : process.argv.includes('--history') ? 'D1202_SOURCE_FROZEN' : 'D1199_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: placementBounds ? 'Distinguish the Gap field range from the native placement limit.'
    : gapBounds ? 'Align History refuses out-of-range Gap before Apply.'
    : alignWaiting ? 'Align distinguishes a missing target from a refused face and recalls a chosen face.'
    : historyPreview ? 'Align History previews valid draft changes without changing the accepted document.'
    : targetNames ? 'Align History identifies each target body and exact native face.'
    : 'Align uses the original face the pointer hits after results reorder in preview.',
  limits: ['Desktop WebGPU, top faces of three root native boxes, fixed Gap 2 mm.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { partSnapshot, bodyKeyOf } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(partSnapshot(doc).outputs.map(output => ({
  key: bodyKeyOf(output.id, doc.nodes), valid: checkBrep(output.brep, { strict: true }).valid,
  volume: massPropertiesOf(output).volume, centroid: massPropertiesOf(output).centroid,
  vertices: output.brep.vertices.map(vertex => vertex.point),
}))));
`,
});
const baseline = process.argv.includes('--baseline');
const retarget = process.argv.includes('--retarget');
const history = retarget || process.argv.includes('--history');
const ref = node => ({ node, side: 'solid' });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [12, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, from: 20, height: 6, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [40, 0], max: [60, 16], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 8, id: 'n3' },
    { kind: 'sketch', profile: 'rectangle', min: [80, 0], max: [110, 20], id: 'n4' },
    { kind: 'extrude', sketch: 4, height: 12, id: 'n5' },
  ],
  outputs: { b1: ref(1), b3: ref(3), b5: ref(5) }, nextId: 6,
};
if (targetNames) seed.bodies = { b1: { name: 'Moving block' }, b3: { name: 'Stock' }, b5: { name: 'Stock' } };
const targetLabel = face => namesBaseline ? face
  : `${targetNames ? 'Stock' : face.startsWith('n3.') ? 'Extrude 8' : 'Extrude 12'} · ${face}`;
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Align', exact: true });
async function clickAt(point) {
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(pixel?.length === 2);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), JSON.stringify(pixel));
  await f.page.mouse.click(...pixel);
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);
async function verify(label, doc, target, gap = 2, lineUp = 'centre') {
  const linked = doc.nodes.at(-1).kind === 'align';
  const top = target === 'n5.top' ? 12 : 8, [targetX, targetY] = target === 'n5.top' ? [89, 5] : [44, 3];
  const offset = [lineUp === 'centre' ? targetX : 0, lineUp === 'centre' ? targetY : 0, top + gap - 20];
  const movingKey = linked ? 'b6' : 'b7';
  if (!linked) assert.deepEqual(doc.nodes.at(-1), { kind: 'translate', parent: ref(6), offset, id: 'n7' });
  assert.deepEqual(doc.nodes.slice(0, seed.nodes.length), seed.nodes);
  const result = await f.inspect(label, doc);
  assert.deepEqual(result.map(body => body.key).sort(), ['b3', 'b5', movingKey]);
  const boxes = {
    b3: { volume: 2560, min: [40, 0, 0], max: [60, 16, 8] },
    b5: { volume: 7200, min: [80, 0, 0], max: [110, 20, 12] },
    [movingKey]: { volume: 720, min: [offset[0], offset[1], top + gap], max: [offset[0] + 12, offset[1] + 10, top + gap + 6] },
  };
  for (const { key, valid, volume, centroid, vertices } of result) {
    assert.equal(valid, true);
    const expected = boxes[key];
    near(volume, expected.volume);
    for (let axis = 0; axis < 3; axis++) {
      near(Math.min(...vertices.map(v => v[axis])), expected.min[axis]);
      near(Math.max(...vertices.map(v => v[axis])), expected.max[axis]);
      near(centroid[axis], (expected.min[axis] + expected.max[axis]) / 2);
    }
  }
  f.report.observations.push({ label, target, offset, bodies: result.map(({ key, volume, centroid }) => ({ key, volume, centroid })) });
}
await f.run(async () => {
  if (delayHistoryPreview) {
    const newContext = f.browser.newContext.bind(f.browser);
    f.browser.newContext = async options => {
      const context = await newContext(options);
      await context.addInitScript(() => {
        const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
        let deliver;
        window.__alignPreviewDelay = { armed: false, held: () => !!deliver, release: () => {
          const reply = deliver;
          deliver = undefined;
          reply?.();
        } };
        Object.defineProperty(Worker.prototype, 'onmessage', {
          ...descriptor,
          set(listener) {
            descriptor.set.call(this, listener && (event => {
              if (window.__alignPreviewDelay.armed && event.data?.result?.ok && event.data.result.bodies?.some(body => body.key === 'b6')) {
                window.__alignPreviewDelay.armed = false;
                deliver = () => listener.call(this, event);
                return;
              }
              listener.call(this, event);
            }));
          },
        });
      });
      return context;
    };
  }
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'align-targets.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  if (alignWaiting) await f.page.setViewportSize({ width: process.argv.includes('--wide') ? 1440 : 1024,
    height: process.argv.includes('--wide') ? 900 : 800 });
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await button('Top', f.page.getByRole('group', { name: 'Views', exact: true })).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await clickAt([6, 5, 26]);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces[0]?.body === 0);
  await clickModelCommand(f.page, 'Modify', 'Align');
  await hud().getByLabel('Gap', { exact: true }).fill('2');
  if (alignWaiting) {
    if (waitingBaseline) {
      await hud().getByText('Invalid input', { exact: true }).waitFor();
      assert.ok(await button('Apply', hud()).isDisabled());
      await f.snapshot('align-waiting-shows-error');
      throw new Error('Initial Align target selection is presented as an invalid input.');
    }
    assert.equal(await hud().locator('.status.input').innerText(), 'pick face');
    assert.equal(await hud().getByText('Invalid input', { exact: true }).count(), 0);
    assert.equal(await hud().getByText('click a flat face of another body', { exact: true }).count(), 1);
    assert.ok(await button('Apply', hud()).isDisabled());
    await clickAt([6, 5, 26]);
    await f.waitToast(/Pick a face of another body to put it on/);
    await hud().locator('.status.input').waitFor();
    assert.ok(await button('Apply', hud()).isDisabled());
  }
  await clickAt([50, 8, 8]);
  await hud().locator('.status.ok').waitFor();
  assert.match((await f.snapshot('b-preview')).hud, /Onto.*n3[.]top/);
  await f.page.waitForFunction(() => /^b3,b5,b[67]$/.test(window.__studioSection().shownKeys.join()));
  await f.same(seed);
  if (!baseline) {
    await clickAt([50, 8, 16]);
    await f.waitToast(/Align target not selected/);
    assert.match((await f.snapshot('generated-preview-face-refused')).hud, /Onto.*n3[.]top/);
    await f.same(seed);
  }

  await clickAt([95, 10, 12]);
  if (baseline) await f.page.waitForTimeout(350);
  else if (alignWaiting) await hud().getByLabel('Onto', { exact: true }).locator('option:checked').filter({ hasText: /^Stock · n5[.]top$/ }).waitFor({ state: 'attached' });
  else await hud().getByLabel('Onto', { exact: true }).locator('option:checked').filter({ hasText: /n5[.]top/ }).waitFor({ state: 'attached' });
  await hud().locator('.status.ok').waitFor();
  if (alignWaiting) {
    const onto = hud().getByLabel('Onto', { exact: true });
    await onto.selectOption('floor');
    await hud().locator('.status.ok').waitFor();
    assert.equal(await hud().getByText('the floor', { exact: true }).count(), 0);
    assert.equal(await onto.locator('option:checked').innerText(), 'The floor (Z 0)');
    await onto.selectOption('face');
    await hud().locator('.status.ok').waitFor();
    assert.equal(await onto.locator('option:checked').innerText(), 'Stock · n5.top');
    assert.equal(await hud().getByText('click a flat face of another body', { exact: true }).count(), 0);
    await f.snapshot('align-floor-face-restored');
  }
  const target = (await f.snapshot('c-click-during-b-preview')).hud.match(/(n[35][.]top)/)?.[1];
  assert.equal(target, baseline ? 'n3.top' : 'n5.top');
  await button('Apply', hud()).click();
  await f.changed(seed);
  const applied = (await f.snapshot('align-applied')).doc;
  await verify('accepted-native', applied, target);
  if (baseline) throw new Error('Clicking C during Align B preview still applied B.');
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(applied);
  if (!history) return;
  assert.deepEqual(applied.nodes.at(-1), {
    kind: 'align', version: 1, parent: ref(1), id: 'n6',
    source: { feature: 'n1', face: 'n1.top', axis: 'z', sign: 1 },
    target: { body: ref(5), feature: 'n5', face: 'n5.top', axis: 'z', sign: 1 },
    gap: 2, lineUp: 'centre',
  });
  await f.openFeatureEditor(6);
  const historyState = await f.snapshot('history-bound-faces');
  assert.match(historyState.editor, /Source facen1[.]topTarget face/);
  const targetField = f.editor().getByLabel('Target face', { exact: true });
  if (await targetField.count()) {
    await targetField.locator('option:checked').filter({ hasText: targetLabel('n5.top') }).waitFor({ state: 'attached' });
  }
  else assert.match(historyState.editor, /Target facen5[.]top/);
  const gap = f.editor().getByLabel('Gap', { exact: true }), lineup = f.editor().getByLabel('Line up', { exact: true });
  assert.equal(await gap.inputValue(), '2');
  assert.equal(await lineup.inputValue(), 'centre');
  if (placementBounds) {
    const apply = button('Apply', f.editor());
    const reset = button('Reset', f.editor());
    const outOfRange = f.editor().getByText('Gap · From 0 to 10000 mm.', { exact: true });
    await gap.fill('-1');
    await outOfRange.waitFor();
    const description = await gap.getAttribute('aria-describedby');
    assert.ok(description);
    assert.equal(await f.page.locator(`[id="${description}"]`).textContent(),
      placementBaseline ? 'From 0 to 10000 mm' : 'Gap · From 0 to 10000 mm.');
    assert.ok(await apply.isDisabled());
    await reset.click();
    const onto = f.editor().getByLabel('Target face', { exact: true });
    await onto.selectOption({ label: targetLabel('n5.side1') });
    await gap.fill('10000');
    const notice = f.editor().getByRole('status').filter({ hasText: placementBaseline
      ? 'The kernel could not build this' : 'Align exceeds the placement limit' });
    await notice.waitFor();
    assert.equal(await gap.getAttribute('aria-invalid'), null);
    if (placementBaseline) {
      await f.snapshot('in-range-gap-gets-generic-refusal');
      throw new Error('Align repeats the numeric range and hides the actual placement limit.');
    }
    await notice.getByText('This placement exceeds the coordinate range or cannot keep the requested gap. Reduce Gap or reset this edit.', { exact: true }).waitFor();
    await gap.press('Enter');
    await notice.getByText('Align exceeds the placement limit', { exact: true }).waitFor();
    await f.same(applied);
    await reset.click();
    assert.equal(await gap.inputValue(), '2');
    const fitting = structuredClone(applied);
    fitting.nodes[4].min[0] = -40;
    fitting.nodes[4].max[0] = -10;
    fitting.nodes[6].target = { body: ref(5), feature: 'n5', face: 'n5.side1', axis: 'x', sign: 1 };
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'align-fits-at-limit.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fitting)) });
    await f.same(fitting);
    await f.openFeatureEditor(6);
    await gap.fill('10000');
    await f.editor().getByText('Align preview', { exact: true }).waitFor();
    const accepted = structuredClone(fitting);
    accepted.nodes[6].gap = 10000;
    const appliedLimit = await f.applyEditor(fitting, 'align-valid-at-limit');
    assert.deepEqual(appliedLimit.doc, accepted);
    const native = (await f.inspect('align-limit-native', accepted)).find(body => body.key === 'b6');
    assert.ok(native.valid);
    near(native.volume, 720);
    native.centroid.forEach((value, i) => near(value, [9993, 10, 6][i]));
    near(Math.min(...native.vertices.map(point => point[0])), 9990);
    near(Math.max(...native.vertices.map(point => point[0])), 9996);
    f.report.observations.push({ label: 'gap-at-placement-limit', boundsX: [9990, 9996], centroid: native.centroid, volume: native.volume });
    await f.undo();
    await f.same(fitting);
    await f.redo();
    await f.same(accepted);
    const { file } = await f.save('align-valid-at-limit');
    await f.freshOpen(file, accepted, 'align-limit-reopened');
    return;
  }
  if (gapBounds) {
    const apply = button('Apply', f.editor());
    const hint = f.editor().getByRole('status').getByText('Gap · From 0 to 10000 mm.', { exact: true });
    await gap.fill('-1');
    if (gapBaseline) {
      assert.ok(await apply.isEnabled());
      assert.equal(await gap.getAttribute('aria-invalid'), null);
      await f.snapshot('align-history-gap-field-admits-invalid');
      throw new Error('Align History enables Apply and has no numeric field error for negative Gap.');
    }
    for (const value of ['-1', '10000.1']) {
      await gap.fill(value);
      await hint.waitFor();
      assert.equal(await gap.getAttribute('min'), '0');
      assert.equal(await gap.getAttribute('max'), '10000');
      assert.ok(await apply.isDisabled());
      assert.equal(await gap.getAttribute('aria-invalid'), 'true');
      const description = await gap.getAttribute('aria-describedby');
      assert.equal(await f.page.locator(`[id="${description}"]`).textContent(), 'Gap · From 0 to 10000 mm.');
      await gap.press('Enter');
      await f.same(applied);
    }
    await gap.fill('');
    await f.editor().getByText('Enter a number for Gap.', { exact: true }).waitFor();
    assert.ok(await apply.isDisabled());
    await button('Reset', f.editor()).click();
    assert.equal(await gap.inputValue(), '2');
    assert.ok(await apply.isDisabled());
    await f.same(applied);
    await gap.fill('0');
    await f.editor().getByText('Align preview', { exact: true }).waitFor();
    const zero = structuredClone(applied);
    zero.nodes.at(-1).gap = 0;
    const result = await f.applyEditor(applied, 'align-zero-gap');
    assert.deepEqual(result.doc, zero);
    await verify('zero-gap-native', zero, 'n5.top', 0);
    await f.undo();
    await f.same(applied);
    await f.redo();
    await f.same(zero);
    const { file } = await f.save('align-zero-gap');
    await f.freshOpen(file, zero, 'align-zero-gap-reopened');
    return;
  }
  const expected = structuredClone(applied);
  if (retarget) {
    const chooser = f.editor().getByLabel('Target face', { exact: true });
    await chooser.getByText(targetLabel('n3.top'), { exact: true }).waitFor({ state: 'attached' });
    assert.equal(await chooser.locator('option').filter({ hasText: /n1[.]/ }).count(), 0);
    if (namesBaseline) {
      assert.ok((await chooser.locator('option').allTextContents()).every(label => !label.includes('Stock')));
      await f.snapshot('history-target-body-names-missing');
      throw new Error('Align History target options omit the Browser body names.');
    }
    await chooser.selectOption({ label: targetLabel('n3.top') });
    assert.equal(await chooser.locator('option:checked').innerText(), targetLabel('n3.top'));
    if (targetNames) {
      assert.equal(await chooser.locator('option').filter({ hasText: /^Stock · n[35][.]top$/ }).count(), 2);
      await button('Reset', f.editor()).click();
      assert.equal(await chooser.locator('option:checked').innerText(), targetLabel('n5.top'));
      await f.same(applied);
      await chooser.selectOption({ label: targetLabel('n3.top') });
    }
    await f.same(applied);
    await f.snapshot('history-target-before-apply');
    Object.assign(expected.nodes.at(-1), { target: { feature: 'n3', face: 'n3.top', axis: 'z', sign: 1, body: ref(3) } });
    if (historyPreview) {
      const notice = f.editor().getByRole('status').filter({ hasText: 'Align preview' });
      if (previewBaseline) {
        assert.equal(await notice.count(), 0);
        await f.snapshot('history-preview-missing');
        throw new Error('Align History changes the target input but displays only the accepted shape.');
      }
      const shown = (min, max) => f.page.waitForFunction(([min, max]) => {
        const bounds = window.__studioSection().historyAlignBounds;
        return bounds && bounds.min.every((value, i) => Math.abs(value - min[i]) < 1e-7)
          && bounds.max.every((value, i) => Math.abs(value - max[i]) < 1e-7);
      }, [min, max]);
      await notice.getByText('Align preview', { exact: true }).waitFor();
      await shown([44, 3, 10], [56, 13, 16]);
      if (delayHistoryPreview) {
        await f.page.evaluate(() => { window.__alignPreviewDelay.armed = true; });
        await gap.fill('3');
        await f.page.waitForFunction(() => window.__alignPreviewDelay.held());
      }
      await gap.fill('4');
      await shown([44, 3, 12], [56, 13, 18]);
      if (delayHistoryPreview) {
        await f.page.evaluate(() => window.__alignPreviewDelay.release());
        await shown([44, 3, 12], [56, 13, 18]);
      }
      await lineup.selectOption('touch');
      await shown([0, 0, 12], [12, 10, 18]);
      await f.same(applied);
      const draft = await f.snapshot('history-align-gap-and-line-up-preview', () => ({
        bounds: window.__studioSection().historyAlignBounds,
      }));
      await clickAt([6, 5, 18]);
      assert.deepEqual(await f.page.evaluate(() => window.__studioSelection), draft.selection);
      await gap.fill('-1');
      await f.editor().getByText('Gap · From 0 to 10000 mm.', { exact: true }).waitFor();
      assert.equal(await f.page.evaluate(() => window.__studioSection().historyAlignBounds), null);
      await f.same(applied);
      if (delayHistoryPreview) {
        await f.page.evaluate(() => { window.__alignPreviewDelay.armed = true; });
        await gap.fill('7');
        await f.page.waitForFunction(() => window.__alignPreviewDelay.held());
      }
      await button('Reset', f.editor()).click();
      if (delayHistoryPreview) await f.page.evaluate(() => window.__alignPreviewDelay.release());
      await notice.waitFor({ state: 'hidden' });
      assert.equal(await f.page.evaluate(() => window.__studioSection().historyAlignBounds), null);
      assert.equal(await chooser.locator('option:checked').innerText(), targetLabel('n5.top'));
      await f.same(applied);
      await chooser.selectOption({ label: targetLabel('n3.top') });
      await shown([44, 3, 10], [56, 13, 16]);
      f.report.observations.push({ label: 'history-preview', movedBounds: draft.bounds,
        obsoleteReplyExercised: delayHistoryPreview, refusedGap: -1 });
    }
  } else {
    await gap.fill('4');
    await lineup.selectOption('touch');
    Object.assign(expected.nodes.at(-1), { gap: 4, lineUp: 'touch' });
  }
  const edited = await f.applyEditor(applied, retarget ? 'history-target-applied' : 'history-gap-and-line-up');
  assert.deepEqual(edited.doc, expected);
  await verify('history-native', expected, retarget ? 'n3.top' : 'n5.top', retarget ? 2 : 4, retarget ? 'centre' : 'touch');
  await f.undo();
  await f.same(applied);
  await f.redo();
  await f.same(expected);

  if (targetNames) {
    const { file } = await f.save('align-history-named-target');
    await f.freshOpen(file, expected, 'align-history-named-target-reopened');
  } else {
    await f.newPage();
    const [reopen] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await reopen.setFiles({ name: 'align-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(expected)) });
    await f.same(expected);
  }
  await verify('reopened-native', expected, retarget ? 'n3.top' : 'n5.top', retarget ? 2 : 4, retarget ? 'centre' : 'touch');
  await f.openFeatureEditor(6);
  assert.equal(await f.editor().getByLabel('Gap', { exact: true }).inputValue(), retarget ? '2' : '4');
  assert.equal(await f.editor().getByLabel('Line up', { exact: true }).inputValue(), retarget ? 'centre' : 'touch');
  if (retarget) {
    const selection = f.editor().getByLabel('Target face', { exact: true }).locator('option:checked');
    await selection.filter({ hasText: targetLabel('n3.top') }).waitFor({ state: 'attached' });
    assert.equal(await selection.innerText(), targetLabel('n3.top'));
  }
  await f.snapshot('reopened-align-history');
});
