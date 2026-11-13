import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = ['apps/cad-studio/test/extrude-join-pieces-browser.mjs', 'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/app/commandState.ts',
  'apps/cad-studio/src/state/useCommandPreview.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts'];
const f = await createFlow({
  name: 'extrude-join-pieces', output: process.argv[2], envFrozen: 'D1155_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Report the current Join target and native piece count before Apply.',
  limits: ['One named 10 × 10 × 5 upright stock and one same-size tool in three contact cases.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [body] = evaluateCadPart(toPartDocument(doc)).outputs, display = evaluateDoc(doc, 1);
if (!display.ok) throw new Error(display.error.detail);
console.log(JSON.stringify({ valid: checkOutput(body).valid, pieces: body.bodyCount, volume: massPropertiesOf(body).volume,
  touching: display.bodies[0].lumpTouch ?? [] }));
`,
});
const ref = node => ({ node, side: 'solid' });
const seed = x => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 3,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 5 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + 10, 10], on: ref(1),
      plane: { origin: [0, 0, 5], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
  ],
  outputs: { b1: ref(1) }, bodies: { b1: { name: 'Join stock' } },
});
const button = name => f.page.getByRole('button', { name, exact: true });

await f.run(async () => {
  await f.newPage();
  for (const [label, x, expectedCount, expectedTouch] of [
    ['face-contact', 0, 1, []], ['edge-contact', 10, 2, [[0, 1]]], ['separated', 12, 2, []],
  ]) {
    f.phase = 'Extrude Join ' + label;
    const source = seed(x);
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: `D1155-${label}.bcad`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
    await f.same(source);
    await f.page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · rectangle', exact: true }).click();
    await f.editor().waitFor();
    await f.closeEditor();
    await f.openExtrudeHud();
    const hud = f.hud(), apply = hud.getByRole('button', { name: 'Apply', exact: true });
    assert.equal(await hud.getByLabel('Operation', { exact: true }).inputValue(), 'join');
    await hud.getByLabel('Distance', { exact: true }).fill('5');
    await hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
    await f.snapshot(label + '-preview');
    const labelOfCount = `${expectedCount} solid piece${expectedCount === 1 ? '' : 's'}`;
    const summary = hud.getByText(labelOfCount, { exact: true }), target = hud.getByText('Join stock', { exact: true });
    if (!baseline) {
      await summary.waitFor();
      await target.waitFor();
      if (x === 12) {
        const distance = hud.getByLabel('Distance', { exact: true });
        await distance.fill('');
        await hud.locator('.status').filter({ hasText: /^refused$/ }).waitFor();
        await summary.waitFor({ state: 'hidden' });
        assert.equal(await apply.isDisabled(), true);
        await distance.fill('5');
        await summary.waitFor();
      }
    }
    const shown = { count: await summary.count(), target: await target.count() };
    await apply.click();
    await f.changed(source);
    await hud.waitFor({ state: 'hidden' });
    const state = await f.snapshot(label + '-accepted'), native = await f.inspect(label + '-native', state.doc);
    assert.ok(native.valid);
    assert.equal(native.pieces, expectedCount);
    assert.deepEqual(native.touching, expectedTouch);
    assert.ok(Math.abs(native.volume - 1000) < 1e-7);
    assert.deepEqual(state.doc.nodes.at(-1).left, ref(1));
    f.report.observations.push({ label, shown, native });
    if (baseline && x === 12) {
      assert.deepEqual(shown, { count: 0, target: 0 });
      assert.fail('The Join preview omits the actual target and two separate solid pieces');
    }
    await f.undo();
    await f.same(source);
    await f.redo();
    await f.same(state.doc);
  }
  assert.deepEqual(f.report.downloads, []);
});
