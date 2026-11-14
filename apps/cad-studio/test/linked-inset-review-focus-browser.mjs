import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const historySummary = process.argv.includes('--history-summary');
const narrowDock = process.argv.includes('--narrow-dock');
const automaticRefusal = process.argv.includes('--automatic-refusal');
const beforeExtrude = process.argv.includes('--before-extrude');
const sourceVia = process.argv.includes('--source-hole') ? 'hole' : process.argv.includes('--source-move') ? 'move' : null;
const sourceDimension = process.argv.includes('--source-dimension') || sourceVia !== null;
const sourceFace = sourceVia === 'move' ? 'n3.side1' : 'n3.side0';
const editInsetDistance = process.argv.includes('--edit-inset-distance');
const delayRefusal = process.argv.includes('--delay-refusal');
const collapsedHistory = process.argv.includes('--collapsed-history');
const startZ = process.argv.includes('--start-z');
const laterMove = process.argv.includes('--later-move');
const appliedDistance = process.argv.includes('--applied-distance');
const reviewNames = process.argv.includes('--review-names');
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/sketch/useInsetRelink.ts',
  'apps/cad-studio/src/ui/InsetSourceReview.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/engine/engine.worker.ts', 'apps/cad-studio/src/engine/client.ts',
  'packages/barocss-cad-model/src/app/associativeInsetRelink.ts',
  'packages/barocss-cad-model/src/engine/part.ts', 'apps/cad-studio/src/app/failedFeature.ts'];
const f = await createFlow({
  name: 'linked-inset-review-focus', output: process.argv[2], envFrozen: 'D1204_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins, qualification: sourceDimension
    ? 'A refused source size names the Linked Inset that cannot regenerate.' : 'Linked Inset returns keyboard focus on Cancel and Apply.',
  limits: ['Desktop WebGPU, replacement with an axis-aligned native side face.'],
  inspectorSource: sourceDimension && !baseline ? `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const { outputs } = partSnapshot(JSON.parse(readFileSync(process.argv[2], 'utf8')));
console.log(JSON.stringify(outputs.map(output => {
  assert.ok(checkBrep(output.brep, { strict: true }).valid);
  assert.equal(output.brep.shells.length, 1);
  assert.ok(output.brep.shells[0].closed);
  return massPropertiesOf(output).volume;
})));
` : undefined,
});
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 24], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [100, 0], max: [160, 24], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: automaticRefusal ? 3 : sourceDimension ? 10 : 8, id: 'n3' },
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
if (sourceDimension) Object.assign(seed.nodes[4].association, {
  source: { node: 3, side: 'solid' }, sourceFeature: 'n3', face: sourceFace, insetMM: 4.5,
});
if (sourceVia) {
  seed.nodes[2].max = [140, 24];
  const parent = { node: 3, side: 'solid' };
  const carried = sourceVia === 'hole'
    ? { kind: 'hole', parent, center: [120, 12], radius: 3, face: 'n3.top', id: 'n6' }
    : { kind: 'translate', parent, offset: [0, 30, 0], id: 'n6' };
  Object.assign(seed.nodes[4].association, { source: { node: 4, side: 'solid' }, sourceFeature: 'n6' });
  seed.nodes[5].sketch = 5;
  seed.nodes.splice(4, 0, carried);
  seed.outputs = { b1: seed.outputs.b1, b6: { node: 4, side: 'solid' }, b5: { node: 6, side: 'solid' } };
  seed.nextId = 7;
}
if (beforeExtrude) {
  seed.nodes.pop();
  delete seed.outputs.b5;
  seed.nextId = 5;
}
if (collapsedHistory) {
  const earlier = Array.from({ length: 28 }, (_, i) => ({
    kind: 'extrude', id: 'n' + (i + 6), sketch: 0, height: 1, suppressed: true,
  }));
  seed.nodes.splice(2, 0, ...earlier);
  seed.nodes[31].sketch = 30;
  seed.nodes[33].sketch = 32;
  seed.outputs = { b1: seed.outputs.b1,
    ...Object.fromEntries(earlier.map((_, i) => ['b' + (i + 6), { node: i + 2, side: 'solid' }])),
    b3: { node: 31, side: 'solid' }, b5: { node: 33, side: 'solid' },
  };
  seed.nextId = 34;
}
if (startZ) seed.nodes[5].from = 1;
if (reviewNames) seed.bodies = { b1: { name: 'Original stock' }, b3: { name: 'Replacement stock' } };
if (laterMove) {
  seed.nodes.push({ kind: 'translate', parent: { node: 5, side: 'solid' }, offset: [0, 35, 0], id: 'n6' });
  delete seed.outputs.b5;
  seed.outputs.b6 = { node: 6, side: 'solid' };
  seed.nextId = 7;
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
function holdInsetReplies() {
  const worker = Worker.prototype;
  const onmessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  const post = worker.postMessage, requests = new WeakMap();
  let pending;
  worker.postMessage = function (request, ...args) {
    if (request?.type === 'insetRelink') requests.set(this, request.id);
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onmessage.get,
    set(callback) {
      onmessage.set.call(this, callback && function (event) {
        if (requests.has(this) && requests.get(this) === event.data?.id && event.data.error) {
          requests.delete(this);
          pending = { reply: event.data, deliver: () => callback.call(this, event) };
        } else callback.call(this, event);
      });
    },
  });
  window.__insetReplyHold = {
    held: () => pending?.reply ?? null,
    release() {
      if (!pending) throw new Error('No inset refusal to deliver');
      const { deliver } = pending;
      pending = undefined;
      deliver();
    },
  };
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
  assert.equal(await f.editor().getByLabel('Linked inset distance', { exact: true }).inputValue(), '2');
  await summary.getByText('Replace the source with an earlier planar face. Shape edits in Edit sketch detach the link.', { exact: true }).waitFor();
}
await f.run(async () => {
  if (delayRefusal) {
    const newContext = f.browser.newContext.bind(f.browser);
    f.browser.newContext = async options => {
      const context = await newContext(options);
      await context.addInitScript(holdInsetReplies);
      return context;
    };
  }
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'inset-focus.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  if (startZ || (laterMove && !appliedDistance)) {
    await f.openFeatureEditor(5);
    f.phase = startZ ? 'recover from nonzero Start Z' : 'recover from later Move';
    const summary = f.editor().getByRole('group', { name: 'Linked inset', exact: true });
    assert.equal(await replace().count(), 0);
    if (baseline) {
      await summary.getByText('The linked sketch must feed one final straight extrusion made as a new body.', { exact: true }).waitFor();
      await f.snapshot('generic-replacement-prerequisite');
      throw new Error('History displayed the same generic reason for Start Z and later Move.');
    }
    const guidance = startZ ? 'Set Start Z to 0 mm before replacing the source.' : 'The later Move blocks source replacement. Undo or remove it before replacing the source.';
    await summary.getByText(guidance, { exact: true }).waitFor();
    await f.same(seed);
    const before = await f.snapshot('blocked-replacement');
    const saved = structuredClone(seed);
    if (startZ) {
      await f.editor().getByLabel('Start Z', { exact: true }).fill('0');
      await button('Apply', f.editor()).click();
      saved.nodes[5].from = 0;
    } else {
      await f.openFeatureEditor(6);
      await button('Delete feature', f.editor()).click();
      saved.nodes.pop();
      delete saved.outputs.b6;
      saved.outputs.b5 = { node: 5, side: 'solid' };
    }
    await f.changed(seed);
    assert.deepEqual(await f.doc(), saved);
    await f.openFeatureEditor(5);
    await replace().waitFor();
    assert.ok(await replace().isEnabled());
    const recovered = await f.snapshot('replacement-available');
    const ring = recovered.bodies.bodies.find(body => body.key === 'b5');
    assert.ok(Math.abs(ring.volume - 960) < 1e-7);
    assert.ok(Math.abs(ring.centroid[2] - 10) < 1e-7);
    f.report.observations.push({ label: startZ ? 'start-z' : 'later-move', guidance, before: before.bodies.bodies.at(-1), recovered: ring });
    await f.undo();
    await f.same(seed);
    await f.redo();
    await f.same(saved);
    return;
  }
  if (editInsetDistance) {
    await f.openFeatureEditor(5);
    f.phase = 'edit stored linked inset distance in History';
    const inset = f.editor().getByLabel('Linked inset distance', { exact: true });
    const extrusion = f.editor().getByLabel('Distance', { exact: true });
    assert.equal(await extrusion.inputValue(), '4');
    const summary = f.editor().getByRole('group', { name: 'Linked inset', exact: true });
    if (appliedDistance && baseline) {
      await summary.getByText('Linked inset distance', { exact: true }).waitFor();
      assert.equal(await inset.inputValue(), '2');
      await f.snapshot('duplicate-distance-label');
      throw new Error('The summary and input both use the Linked inset distance label.');
    }
    if (baseline) {
      assert.equal(await inset.count(), 0);
      await f.snapshot('stored-inset-read-only');
      throw new Error('The stored linked inset distance was visible but read-only.');
    }
    assert.equal(await inset.inputValue(), '2');
    if (appliedDistance) {
      assert.equal(await summary.getByText('2 mm', { exact: true }).count(), 0);
      if (laterMove) {
        await summary.getByText(/later Move blocks source replacement/).waitFor();
        await inset.fill('3');
        await summary.getByText('Applied inset distance', { exact: true }).waitFor();
        assert.equal(await summary.getByText(/later Move blocks source replacement/).count(), 0);
        await button('Reset', f.editor()).click();
      }
    }
    const before = await f.snapshot('inset-distance-before');
    await inset.fill('0');
    assert.ok(await button('Apply', f.editor()).isDisabled());
    await inset.fill('12');
    await button('Apply', f.editor()).click();
    await f.editor().getByRole('status').filter({ hasText: 'Linked inset distance is too large' }).getByText(/Enter a smaller Linked inset distance/).waitFor();
    const rejected = await f.snapshot('inset-distance-refused');
    for (const field of ['doc', 'history', 'bodies', 'selection']) assert.deepEqual(rejected[field], before[field], field);
    await inset.fill('3');
    if (appliedDistance) {
      await summary.getByText('Applied inset distance', { exact: true }).waitFor();
      await summary.getByText('2 mm', { exact: true }).waitFor();
      await f.same(seed);
      await f.snapshot('draft-and-applied-distance');
    }
    await button('Apply', f.editor()).click();
    await f.changed(seed);
    const accepted = (await f.snapshot('inset-distance-applied')).doc;
    const expected = structuredClone(seed);
    expected.nodes[4].association.insetMM = 3;
    assert.deepEqual(accepted, expected);
    const volume = (await f.bodies()).bodies.find(body => body.key === (laterMove ? 'b6' : 'b5')).volume;
    assert.ok(Math.abs(volume - 4 * (40 * 24 - 34 * 18)) < 1e-7);
    await f.undo();
    await f.same(seed);
    await f.redo();
    await f.same(accepted);
    await f.newPage();
    const [newChooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await newChooser.setFiles({ name: 'updated-inset.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(accepted)) });
    await f.same(accepted);
    await f.openFeatureEditor(5);
    assert.equal(await f.editor().getByLabel('Linked inset distance', { exact: true }).inputValue(), '3');
    assert.equal(await f.editor().getByLabel('Distance', { exact: true }).inputValue(), '4');
    if (appliedDistance) assert.equal(await f.editor().getByRole('group', { name: 'Linked inset', exact: true }).getByText('3 mm', { exact: true }).count(), 0);
    f.report.observations.push({ label: 'inset-distance-recovered', source: 'n1.top', insetMM: 3, distance: 4, volume });
    await f.snapshot('inset-distance-reopened');
    return;
  }
  if (sourceDimension) {
    await f.page.setViewportSize({ width: 1024, height: 800 });
    f.phase = 'upstream Extrude distance closes the linked opening';
    await f.openFeatureEditor(3);
    const distance = f.editor().getByLabel('Distance', { exact: true });
    const orig = await f.snapshot('source-height-before');
    await distance.fill('9');
    await button('Apply', f.editor()).click();
    const notice = f.editor().getByRole('status').filter({ hasText: baseline ? 'The kernel could not build this' : 'The linked inset opening closes' });
    await notice.waitFor();
    const rejected = await f.snapshot('source-height-refused');
    for (const field of ['doc', 'history', 'bodies', 'selection']) assert.deepEqual(rejected[field], orig[field], field);
    if (baseline) {
      await notice.getByText(/Undo the last change/).waitFor();
      throw new Error('Upstream History dimension refusal suggested Undo and omitted the affected link.');
    }
    await notice.getByText(`The 4.5 mm inset on ${sourceFace} fails with the new source size. Increase the source dimension or reset this edit.`, { exact: true }).waitFor();
    await notice.getByText(/Failed feature · Sketch · polygon \(n4\)/).waitFor();
    assert.doesNotMatch(await notice.innerText(), /Undo the last change/);
    await button('Reset', f.editor()).click();
    assert.equal(await distance.inputValue(), '10');
    await notice.waitFor({ state: 'hidden' });
    const reset = await f.snapshot('source-height-reset');
    for (const field of ['doc', 'history', 'bodies', 'selection']) assert.deepEqual(reset[field], orig[field], field);
    await distance.fill('12');
    await button('Apply', f.editor()).click();
    await f.changed(seed);
    const accepted = await f.doc();
    const expected = structuredClone(seed);
    expected.nodes[3].height = 12;
    assert.deepEqual(accepted, expected);
    const measured = (await f.bodies()).bodies.find(body => body.key === 'b5').volume;
    const width = sourceVia === 'move' ? 24 : sourceVia === 'hole' ? 40 : 60;
    const ringVolume = height => 4 * (width * height - (width - 9) * (height - 9));
    const before = await f.inspect('before', seed);
    const after = await f.inspect('recovered', accepted);
    assert.equal(before.length, 3);
    assert.equal(after.length, 3);
    assert.ok(Math.abs(before.at(-1) - ringVolume(10)) < 1e-7);
    assert.ok(Math.abs(after.at(-1) - ringVolume(12)) < 1e-7);
    assert.ok(Math.abs(measured - ringVolume(12)) < 1e-7);
    f.report.observations.push({ label: 'source-dimension-recovered', sourceVia, sourceFace,
      heights: [10, 12], volumes: [before.at(-1), after.at(-1)], expected: [ringVolume(10), ringVolume(12)] });
    await f.undo();
    await f.same(seed);
    await f.redo();
    await f.same(accepted);
    const { file } = await f.save('recovered-source-height');
    await f.freshOpen(file, accepted, 'reopened-source-height');
    return;
  }
  if (narrowDock) {
    await f.page.setViewportSize({ width: 1024, height: 800 });
    await f.page.getByRole('button', { name: 'Chat', exact: true }).first().click();
    await f.page.locator('.chat-col.open').waitFor();
    if (await button('Close the dock').isVisible()) await button('Close the dock').click();
  }
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await button('Front', f.page.getByRole('group', { name: 'Views', exact: true })).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  if (collapsedHistory) {
    f.phase = 'return Apply focus to collapsed History';
    const step = historyStep(33);
    const more = f.page.getByRole('button', { name: /\d+ more history steps/ });
    await button('Show history step names').click();
    await more.waitFor();
    assert.equal(await step.isVisible(), false);
    await more.click();
    await step.click();
    await f.editor().waitFor();
    await button('Fewer history steps').click();
    await step.waitFor({ state: 'hidden' });
    const pixel = await f.page.evaluate(() => window.__studioScreenOf([130, 0, 4]));
    assert.ok(pixel?.length === 2);
    assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
    await f.page.mouse.click(...pixel);
    await f.page.waitForFunction(() => window.__studioSelection.selection.faces[0]?.body === 1);
    await replace().press('Enter');
    await review().getByText('Extrude volume · 1024 mm³', { exact: true }).waitFor();
    await waitFocus(button('Cancel', review()));
    await f.page.keyboard.press('Tab');
    await waitFocus(button('Apply source', review()));
    await f.page.keyboard.press('Enter');
    await review().waitFor({ state: 'hidden' });
    await waitFocus(more);
    assert.ok(await more.evaluate(element => {
      const r = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }));
    assert.equal(await step.isVisible(), false);
    const expected = structuredClone(seed);
    Object.assign(expected.nodes[32].association, { source: { node: 31, side: 'solid' }, sourceFeature: 'n3', face: 'n3.side0' });
    await f.same(expected);
    const volume = (await f.bodies()).bodies.find(body => body.key === 'b5').volume;
    assert.ok(Math.abs(volume - 1024) < 1e-7);
    f.report.observations.push({ label: 'collapsed-history-focus', focused: await focused(), volume });
    await f.snapshot('collapsed-history-return');
    await f.page.keyboard.press('Enter');
    await step.waitFor();
    await step.click();
    await checkHistorySummary('n3.side0');
    await f.undo();
    await f.same(seed);
    await f.redo();
    await f.same(expected);
    return;
  }
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
      const elsewhere = button('Close editor', f.editor());
      if (delayRefusal) {
        await waitFocus(button('Cancel', review()));
        await f.page.waitForFunction(() => window.__insetReplyHold.held()?.field === 'insetMM');
        await elsewhere.focus();
        await waitFocus(elsewhere);
        await f.snapshot('focus-moved-before-refusal');
        await f.page.evaluate(() => window.__insetReplyHold.release());
      }
      const notice = f.page.getByRole('alert').filter({ hasText: 'Inset source not replaced' });
      await notice.waitFor();
      await review().waitFor({ state: 'hidden' });
      if (!baseline) await waitFocus(delayRefusal ? elsewhere : replace());
      const after = await f.snapshot('automatic-refusal');
      for (const key of ['doc', 'history', 'bodies', 'selection']) assert.deepEqual(after[key], before[key], key);
      const current = await focused();
      f.report.observations.push({ label: 'automatic-refusal', focused: current[0] === 'BODY' ? ['BODY'] : current,
        volume: after.bodies.bodies.find(body => body.key === 'b5').volume, hint: await notice.locator('.toast-hint').innerText() });
      if (baseline) {
        assert.equal(current[0], 'BODY');
        throw new Error('Automatic replacement refusal lost focus to the document body.');
      }
      assert.ok((await buttonVisibility(delayRefusal ? elsewhere : replace())).visible);
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
  if (reviewNames) {
    f.phase = 'review identifies source, candidate and target by Browser name';
    await replace().press('Enter');
    await review().getByText(baseline ? 'Extrude · 1024 mm³' : 'Extrude volume · 1024 mm³', { exact: true }).waitFor();
    if (baseline) {
      await review().getByText('n1.top → n3.side0', { exact: true }).waitFor();
      await review().getByText('Target · n1', { exact: true }).waitFor();
      await f.snapshot('review-shows-only-native-ids');
      throw new Error('Review did not use either Browser body name.');
    }
    for (const [label, value] of [['Current source', 'Original stock · n1.top'],
      ['Candidate source', 'Replacement stock · n3.side0'], ['Target', 'Original stock · n1']]) {
      const row = review().locator('.field').filter({ has: f.page.getByText(label, { exact: true }) });
      await row.getByText(value, { exact: true }).waitFor();
    }
    const detail = review().locator('details');
    assert.equal(await detail.getAttribute('open'), null);
    await detail.getByText('Plane details', { exact: true }).click();
    await detail.getByText('Normal · 0, -1, 0', { exact: true }).waitFor();
    await detail.getByText('Plane details', { exact: true }).click();
    await button('Cancel', review()).focus();
    await f.snapshot('review-names-before-apply');
    await f.page.keyboard.press('Tab');
    await waitFocus(button('Apply source', review()));
    await f.page.keyboard.press('Enter');
    await waitFocus(historyStep(5));
    const expected = structuredClone(seed);
    Object.assign(expected.nodes[4].association, { source: { node: 3, side: 'solid' }, sourceFeature: 'n3', face: 'n3.side0' });
    await f.same(expected);
    const volume = (await f.bodies()).bodies.find(body => body.key === 'b5').volume;
    assert.ok(Math.abs(volume - 1024) < 1e-7);
    f.report.observations.push({ label: 'named-source-applied', volume });
    await f.undo();
    await f.same(seed);
    await f.redo();
    await f.same(expected);
    return;
  }
  for (const key of ['Enter', 'Escape']) {
    f.phase = 'keyboard Cancel with ' + key;
    await replace().press('Enter');
    await review().getByText('Extrude volume · 1024 mm³', { exact: true }).waitFor();
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
  await review().getByText('Extrude volume · 1024 mm³', { exact: true }).waitFor();
  await historyStep(3).click();
  await review().waitFor({ state: 'hidden' });
  await waitFocus(historyStep(3));
  await f.same(seed);
  await f.openFeatureEditor(5);

  f.phase = 'keyboard Apply';
  await replace().press('Enter');
  await review().getByText('Extrude volume · 1024 mm³', { exact: true }).waitFor();
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
