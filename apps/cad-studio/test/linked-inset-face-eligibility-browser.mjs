import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const oversize = process.argv.includes('--oversize');
const fieldEnter = process.argv.includes('--field-enter');
const perforated = process.argv.includes('--perforated');
const activeLink = process.argv.includes('--active-link');
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/engine/insetOutline.ts',
  'packages/barocss-cad-model/src/engine/mesh.ts', 'packages/barocss-cad-model/src/engine/part.ts'];
const f = await createFlow({
  name: 'linked-inset-face-eligibility', output: process.argv[2], envFrozen: 'D1205_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins, qualification: 'Linked Inset offers an actionable choice on rounded and straight planar faces.',
  limits: ['Desktop WebGPU, R2 rounded rectangle and straight rectangular stock.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { profileOf } from '@barocss/cad-model/sketch/loops';
const points = [[2, 0], [18, 0], [20, 2], [20, 8], [18, 10], [2, 10], [0, 8], [0, 2]];
const b = Math.tan(Math.PI / 8);
const rounded = profileOf([{ kind: 'polygon', closed: true, points, ids: points.map((_, i) => 'e' + (i + 1)), bulges: [0, b, 0, b, 0, b, 0, b] }]);
assert.ok('node' in rounded);
const first = withNode(withNode(emptyDoc(), rounded.node), { kind: 'extrude', sketch: 0, height: 10 });
const stock = withNode(first, { kind: 'sketch', profile: 'rectangle', min: [40, 0], max: [60, 10] });
const straight = withNode(stock, { kind: 'extrude', sketch: 2, height: 10 });
const mode = JSON.parse(process.argv[3] ?? 'null');
if (mode !== 'perforated') console.log(JSON.stringify(straight));
else {
  const caps = [
    { kind: 'polygon', closed: true, points: [[0, 0], [20, 0], [20, 10], [0, 10]] },
    { kind: 'circle', c: [10, 5], r: 2 },
  ] as const;
  const bored = profileOf(caps.map(shape => structuredClone(shape)) as Parameters<typeof profileOf>[0]);
  assert.ok('node' in bored);
  console.log(JSON.stringify(withNode(withNode(straight, { ...bored.node,
    plane: { origin: [80, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }), { kind: 'extrude', sketch: 4, height: 10 })));
}
`,
});

const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const linked = () => button(f.sketchPanel(), 'Link face outline + inset');
async function startSketchOnTop(x) {
  await button(f.page.getByRole('group', { name: 'Views', exact: true }), 'Top').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const pixel = await f.page.evaluate(x => window.__studioScreenOf([x, 5, 10]), x);
  assert.ok(pixel?.length === 2);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
}

await f.run(async () => {
  const seed = await f.inspect('seed', {}, perforated ? 'perforated' : 'default');
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'inset-faces.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  if (await button(f.page, 'Ortho').getAttribute('aria-pressed') !== 'true') await button(f.page, 'Ortho').click();

  if (perforated) {
    f.phase = 'a straight outer cap with one circular hole';
    await startSketchOnTop(86);
    const panel = f.sketchPanel(), copy = button(panel, 'Use the face outline');
    await copy.waitFor();
    await button(panel, 'Face outline as references').waitFor();
    assert.equal(await linked().count(), 0);
    if (baseline) {
      await panel.getByText('This outline has curved edges. Use the face outline to copy it.', { exact: true }).waitFor();
      await f.snapshot('incorrect-perforated-guidance');
      throw new Error('The planar cap has a straight outer loop, but guidance mentions only curved edges.');
    }
    await panel.getByText('Linked inset needs a face without holes.', { exact: true }).waitFor();
    await f.snapshot('perforated-guidance');
    await copy.click();
    const copied = (await f.finishSketch('perforated-copy')).doc;
    assert.equal(copied.nodes[6].holes?.length, 1);
    assert.equal(copied.nodes[6].association, undefined);
    assert.deepEqual(copied.nodes[6].on, { node: 5, side: 'solid' });
    await f.openExtrudeHud();
    const accepted = (await f.applyExtrude({ distance: 4, previous: copied, label: 'perforated-copy-consumer' })).doc;
    const key = Object.keys(accepted.outputs).find(key => accepted.outputs[key].node === 7);
    const volume = (await f.bodies()).bodies.find(body => body.key === key)?.volume;
    assert.ok(Math.abs(volume - 4 * (20 * 10 - 4 * Math.PI)) < 1e-7);
    f.report.observations.push({ label: 'perforated-copy', volume });
    await f.undo();
    await f.same(copied);
    await f.undo();
    await f.same(seed);
    return;
  }

  if (!oversize) {
    f.phase = 'rounded top face sketch';
    await startSketchOnTop(10);
    const outline = button(f.sketchPanel(), 'Use the face outline');
    await outline.waitFor();
    assert.deepEqual(await f.doc(), seed);
    assert.equal(await linked().count(), 0);
    await f.sketchPanel().getByText('Linked inset needs a straight outer boundary.', { exact: true }).waitFor();
    await f.snapshot('rounded-recovery-guidance');
    await outline.click();
    const copied = (await f.finishSketch('independent-rounded-outline')).doc;
    assert.equal(copied.nodes.length, 5);
    assert.equal(copied.nodes[4].kind, 'sketch');
    assert.equal(copied.nodes[4].association, undefined);
    assert.deepEqual(copied.nodes[4].on, { node: 1, side: 'solid' });
    await f.undo();
    await f.same(seed);
  }

  f.phase = 'straight top face sketch';
  await startSketchOnTop(50);
  const distance = f.sketchPanel().getByLabel('Offset distance', { exact: true });
  const error = f.sketchPanel().getByRole('alert').filter({ hasText: 'Enter a smaller Offset distance and try again.' });
  if (oversize) {
    f.phase = 'inset consumes opening';
    await distance.fill('6');
    const before = await f.snapshot('before-oversize');
    await linked().press('Enter');
    if (baseline && !fieldEnter) {
      await f.page.locator('.toast').getByText(/turns the outline inside out|closes the rectangle/).waitFor();
      assert.equal(await error.count(), 0);
      await f.snapshot('oversize-toast');
      throw new Error('The refusal did not identify Offset distance or keep the guidance next to it.');
    }
    await error.waitFor();
    const after = await f.snapshot('oversize-refused');
    for (const key of ['doc', 'history', 'bodies', 'selection']) assert.deepEqual(after[key], before[key], key);
    assert.equal(await distance.inputValue(), '6');
    assert.equal(await distance.getAttribute('aria-invalid'), 'true');
    assert.equal(await distance.getAttribute('aria-describedby'), await error.getAttribute('id'));
    assert.ok(await distance.evaluate(input => input === document.activeElement));
    assert.equal(await f.page.locator('.toast').getByText('Cannot link face outline', { exact: true }).count(), 0);
  }
  await distance.fill('2');
  if (oversize) {
    await error.waitFor({ state: 'hidden' });
    assert.equal(await distance.getAttribute('aria-invalid'), null);
  }
  if (fieldEnter) {
    f.phase = 'Enter in the corrected Offset distance';
    assert.ok(await distance.evaluate(element => element === document.activeElement));
    await distance.press('Enter');
    if (baseline && !activeLink) {
      await f.sketchPanel().waitFor({ state: 'hidden' });
      await f.same(seed);
      await f.snapshot('enter-closed-sketch');
      throw new Error('Enter on Offset distance closed the corrected sketch before a link was made.');
    }
  } else await linked().click();
  await f.sketchPanel().getByText(/Linked face outline and inset/).waitFor();
  if (activeLink) {
    f.phase = 'read the active linked inset and keep the ordinary Offset separate';
    const panel = f.sketchPanel();
    if (baseline) {
      assert.equal(await linked().isEnabled(), true);
      await distance.fill('3');
      await distance.press('Enter');
      await f.snapshot('ambiguous-linked-draft');
      throw new Error('The linked draft still presents an active Link button and does not show its actual distance.');
    }
    await panel.getByText('Linked face outline and inset · 2 mm', { exact: true }).waitFor();
    await panel.getByText('To change the linked distance, finish the sketch and edit it in History.', { exact: true }).waitFor();
    assert.equal(await linked().count(), 0);
    await distance.fill('3');
    await distance.press('Enter');
    await panel.getByText('Linked face outline and inset · 2 mm', { exact: true }).waitFor();
    await f.same(seed);
    await f.snapshot('linked-distance-distinct-from-offset');
  }
  const saved = (await f.finishSketch('straight-linked-outline')).doc;
  assert.deepEqual(saved.nodes[4].association, {
    kind: 'planar-face-outline-inset', version: 1, source: { node: 3, side: 'solid' }, sourceFeature: 'n3', face: 'n3.top', insetMM: 2,
  });
  await f.openExtrudeHud();
  const accepted = (await f.applyExtrude({ distance: 4, previous: saved, label: 'straight-linked-ring' })).doc;
  const key = Object.keys(accepted.outputs).find(key => accepted.outputs[key].node === 5);
  const volume = (await f.bodies()).bodies.find(body => body.key === key)?.volume;
  assert.ok(Math.abs(volume - (20 * 10 - 16 * 6) * 4) < 1e-7);
  f.report.observations.push({ label: 'straight-linked-ring', volume, association: saved.nodes[4].association });
});
