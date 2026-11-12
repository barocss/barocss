import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/test/z-pattern-separate-count-browser.mjs',
  'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/state/useCommandPreview.ts',
  'packages/barocss-cad-model/src/app/commands.ts',
];
const f = await createFlow({
  name: 'z-pattern-separate-count', output: process.argv[2], envFrozen: 'D823_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Refuse an invalid creation count before copying a solid or changing accepted history.',
  limits: ['Z Circular pattern, Separate bodies, positive 120° spread, one ordinary rectangle extrusion.'],
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [50, 10], max: [54, 16] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const pivot = [12, 4, 0];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const field = (parent, name) => parent.getByLabel(name, { exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Circular pattern', exact: true });
const waitStatus = () => f.page.waitForFunction(() => ['preview', 'refused'].includes(document.querySelector('.hud .status')?.textContent.trim()));

async function checkVolumes(keys, volume) {
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), keys);
  for (const body of bodies) assert.ok(Math.abs(body.volume - volume) < 1e-7, JSON.stringify(body));
}

await f.run(async () => {
  f.phase = 'open source and create one prior undo point';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D823-count-refusal.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await f.openFeatureEditor(1, 'source extrusion');
  await field(f.editor(), 'Distance').fill('9');
  await f.applyEditor(source, 'source-height-9');
  const accepted = await f.doc();
  await checkVolumes(['b1'], 216);

  f.phase = 'open Z Circular pattern for separate bodies';
  await f.page.locator('.outliner .ol-row > button.ol').click();
  await clickModelCommand(f.page, 'Pattern', 'Circular pattern');
  assert.equal(await field(hud(), 'Axis').inputValue(), 'z');
  await field(hud(), 'Spread over').fill('120');
  await field(hud(), 'Axis at X').fill('12');
  await field(hud(), 'Axis at Y').fill('4');
  await field(hud(), 'Result').selectOption('separate');
  const count = field(hud(), 'Count');
  const apply = button(hud(), 'Apply');
  assert.equal(await count.getAttribute('min'), '2');
  assert.equal(await count.getAttribute('max'), '36');
  for (const value of ['2.5', '0', '1', '37']) {
    f.phase = 'refuse separate Z Count ' + value;
    await count.fill(value);
    await waitStatus();
    assert.equal(await count.inputValue(), value);
    if (await apply.isEnabled()) {
      await apply.click();
      const committed = await f.doc();
      f.report.observations.push({ label: 'invalid-count-accepted', value, outputs: Object.keys(committed.outputs),
        angles: committed.nodes.filter(node => node.kind === 'rotate').map(node => node.angle) });
      assert.fail('Invalid Count ' + value + ' enabled Apply and committed ' + Object.keys(committed.outputs).length + ' outputs.');
    }
    await hud().getByText(/Z circular patterns with separate bodies use a whole-number Count from 2 to 36/i).waitFor();
    await count.press('Enter');
    assert.ok(await hud().isVisible());
    assert.ok(await apply.isDisabled());
    await f.same(accepted);
    await checkVolumes(['b1'], 216);
    f.report.observations.push({ label: 'count-refused', value, output: 'b1', volume: 216 });
    if (value === '2.5') await f.snapshot('01-fractional-count-refused');
  }
  await button(hud(), 'Cancel').click();
  await f.undo();
  await f.same(source);
  await checkVolumes(['b1'], 192);
  await f.redo();
  await f.same(accepted);
  await checkVolumes(['b1'], 216);

  f.phase = 'create a valid pattern at the lower count bound';
  await f.page.locator('.outliner .ol-row > button.ol').click();
  await clickModelCommand(f.page, 'Pattern', 'Circular pattern');
  await field(hud(), 'Spread over').fill('120');
  await field(hud(), 'Axis at X').fill('12');
  await field(hud(), 'Axis at Y').fill('4');
  await field(hud(), 'Result').selectOption('separate');
  await count.fill('2');
  await waitStatus();
  await apply.click();
  await hud().waitFor({ state: 'hidden' });
  await f.changed(accepted);
  const valid = await f.doc();
  assert.deepEqual(valid.nodes.slice(0, 2), accepted.nodes);
  assert.deepEqual(valid.nodes[4], { kind: 'rotate', parent: { node: 3, side: 'solid' }, axis: 'z', angle: 120, pivot, id: 'n4' });
  await checkVolumes(['b1', 'b4'], 216);
  f.report.observations.push({ label: 'valid-count-accepted', count: 2, outputs: ['b1', 'b4'], volumeEach: 216, angle: 120, pivot });
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot('02-valid-count-two');
  assert.deepEqual(f.report.downloads, []);
});
