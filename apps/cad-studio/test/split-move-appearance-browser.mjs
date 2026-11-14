import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/RenderPanel.tsx',
  'apps/cad-studio/src/viewport/gpuRenderer.ts', 'packages/barocss-cad-model/src/engine/render.ts'];
const f = await createFlow({
  name: 'split-move-appearance', output: process.argv[2], envFrozen: 'D1198_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Moving either Split half keeps its individual Render appearance.',
  limits: ['Desktop WebGPU and one Move on the negative Split half.'],
});
const baseline = process.argv.includes('--baseline');
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 30], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
    { kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', at: 24, id: 'n2' },
  ],
  outputs: { b2_negative: { node: 2, side: 'negative' }, b2_positive: { node: 2, side: 'positive' } }, nextId: 3,
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const render = () => f.page.getByRole('complementary', { name: 'Render', exact: true });
async function mode(name) {
  await button(name, f.page.locator('.mode')).click();
  await render().waitFor({ state: name === 'Render' ? 'visible' : 'hidden' });
}
async function pickBody(key) {
  const bodies = (await f.bodies()).bodies, index = bodies.findIndex(body => body.key === key);
  assert.ok(index >= 0, key);
  const rows = f.page.getByRole('complementary', { name: 'Browser', exact: true })
    .locator('.ol-row:has(> button.ol-eye) > button.ol');
  await rows.nth(index).click();
  await f.page.waitForFunction(i => window.__studioSelection.selection.bodies[0] === i, index);
}
async function appearance(key) {
  await pickBody(key);
  const color = await render().getByLabel('Colour', { exact: true }).inputValue();
  const roughness = Number(await render().getByLabel('Roughness', { exact: true }).inputValue());
  return { color, roughness };
}
await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'split-look.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await mode('Render');
  for (const [key, preset] of [['b2_negative', 'look-painted-red'], ['b2_positive', 'look-plastic-black']]) {
    await pickBody(key);
    const previous = await f.doc();
    await render().getByLabel('Appearance preset', { exact: true }).selectOption(preset);
    await f.changed(previous);
  }
  const original = (await f.snapshot('distinct-split-looks')).doc;
  const negative = await appearance('b2_negative'), positive = await appearance('b2_positive');
  assert.equal(negative.color, '#a8161a');
  assert.equal(positive.color, '#26272a');
  await mode('Model');
  await pickBody('b2_negative');
  await clickModelCommand(f.page, 'Modify', 'Move');
  const move = f.page.getByRole('dialog', { name: 'Move', exact: true });
  await move.getByLabel('ΔY', { exact: true }).fill('40');
  await move.locator('.status.ok').waitFor();
  await button('Apply', move).click();
  await f.changed(original);
  const moved = await f.doc();
  assert.deepEqual(moved.nodes.at(-1), { kind: 'translate', parent: { node: 2, side: 'negative' }, offset: [0, 40, 0], id: 'n3' });
  const body = (await f.bodies()).bodies.find(body => body.key === 'b3');
  assert.ok(Math.abs(body.volume - 7200) < 1e-7);
  [12, 55, 5].forEach((value, axis) => assert.ok(Math.abs(body.centroid[axis] - value) < 1e-7));
  await mode('Render');
  const after = await appearance('b3'), untouched = await appearance('b2_positive');
  assert.deepEqual(untouched, positive);
  f.report.observations.push({ negative, positive, moved: after, untouched });
  await f.snapshot('render-after-move');
  if (baseline) {
    assert.notDeepEqual(after, negative, 'The parent loses the appearance on a new output key.');
    throw new Error('The moved Split half falls back to the default Render appearance.');
  }
  assert.deepEqual(after, negative);
  assert.deepEqual(moved.render.appearances.b3, original.render.appearances.b2_negative);
  assert.deepEqual(moved.render.appearances.b2_positive, original.render.appearances.b2_positive);
  assert.deepEqual(moved.render.appearances.b2_negative, original.render.appearances.b2_negative);
  await mode('Model');
  await f.undo();
  await f.same(original);
  await mode('Render');
  assert.deepEqual(await appearance('b2_negative'), negative);
  await mode('Model');
  await f.redo();
  await f.same(moved);
  await mode('Render');
  assert.deepEqual(await appearance('b3'), negative);
  assert.deepEqual(await appearance('b2_positive'), positive);
  await f.snapshot('render-after-redo');
  await f.newPage();
  const [reopen] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await reopen.setFiles({ name: 'moved-split.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(moved)) });
  await f.page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'translate');
  await f.ready();
  assert.deepEqual(await f.doc(), moved);
  await mode('Render');
  assert.deepEqual(await appearance('b3'), negative);
  assert.deepEqual(await appearance('b2_positive'), positive);
  await f.snapshot('render-after-open');
});
