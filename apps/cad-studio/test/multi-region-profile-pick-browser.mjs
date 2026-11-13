import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const chooseRegion = process.argv[3] === '--choose-region';
const pins = [
  'apps/cad-studio/test/multi-region-profile-pick-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/engine/regionExtrude.ts',
];
const f = await createFlow({
  name: 'multi-region-profile-pick', output: process.argv[2], envFrozen: chooseRegion ? 'D1133_SOURCE_FROZEN' : 'D1129_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Pick a finished sketch from either filled region and verify its full Extrude scope.',
  limits: ['Two rectangles with a shared segment, a hole, and an isolated rectangle. Finished sketch selection remains at sketch scope.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(output => ({
  valid: checkOutput(output).valid, bodies: output.brep.bodies.length, ...massPropertiesOf(output),
}))));
`,
});
const rectangle = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  .map(start => ({ kind: 'line', start }));
const whole = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [4, 6], max: [14, 16], id: 'n0',
    regions: [rectangle(14, 6, 24, 18), rectangle(28, 6, 38, 18)],
    holes: [rectangle(7, 9, 11, 13)] }],
  outputs: {}, nextId: 1,
};
const { holes: _holes, ...material } = whole.nodes[0];
const supported = { ...whole, nodes: [{ ...material, sideTags: {
  outer: ['e1', 'e2', 'e3', 'e4'],
  regions: [['e5', 'e6', 'e7', 'e8'], ['e9', 'e10', 'e11', 'e12']],
} }] };
const source = chooseRegion ? supported : whole;

const button = name => f.page.getByRole('button', { name, exact: true });
const route = async (label, point, expected) => {
  f.phase = 'pick ' + label;
  await f.worldClick(point);
  const state = await f.snapshot(label);
  assert.deepEqual(state.selection.selection.sketches ?? [], expected, label);
  await f.same(source);
};

await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1129-regions.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await button('Top').click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  const main = [5, 7], sharedRegion = [19, 12], isolatedRegion = [33, 12], hole = [9, 11], outside = [26, 12];
  await f.frame([main, sharedRegion, isolatedRegion, hole, outside]);
  await route('01-main-region', main, [0]);
  await route('02-clear-in-gap', outside, []);
  await route('03-shared-region-interior', sharedRegion, [0]);
  if (!chooseRegion) await route('04-hole-interior', hole, []);
  await route('05-isolated-region-interior', isolatedRegion, [0]);
  f.phase = 'verify the whole-sketch scope in the preview';
  await f.openExtrudeHud();
  await f.hud().getByText('Sketch 1 · all 3 regions', { exact: true }).waitFor();
  await f.same(source);
  await f.snapshot('06-all-regions-preview');
  if (chooseRegion) {
    const region = f.hud().getByLabel('Region', { exact: true });
    for (const [value, label] of [['2', 'isolated'], ['1', 'shared']]) {
      await region.selectOption(value);
      await f.hud().getByText(`Sketch 1 · Region ${Number(value) + 1}`, { exact: true }).waitFor();
      await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
      assert.equal(await f.hud().getByLabel('Draft', { exact: true }).count(), 0);
      await f.same(source);
      await f.snapshot('07-' + label + '-preview');
    }
    const { doc } = await f.applyExtrude({ distance: 2, previous: source, label: '08-apply-shared' });
    const recipe = doc.nodes[1];
    assert.equal(recipe.kind, 'region-extrude');
    assert.equal(recipe.sourceFeature, 'n0');
    assert.deepEqual(recipe.boundary.map(edge => edge.side), supported.nodes[0].sideTags.regions[0]);
    const [body] = await f.inspect('selected-native-output', doc);
    assert.equal(body.valid, true);
    assert.equal(body.bodies, 1);
    assert.ok(Math.abs(body.volume - 240) < 1e-9);
    assert.ok(Math.hypot(body.centroid[0] - 19, body.centroid[1] - 12, body.centroid[2] - 1) < 1e-9);
    await f.undo();
    await f.same(source);
    await f.redo();
    await f.same(doc);
    f.report.observations.push({ label: 'individual-region', ...body, boundary: recipe.boundary });

    f.phase = 'reselect the same source and extrude a second region explicitly';
    const profile = f.page.getByRole('button', { name: 'Sketch 1', exact: true });
    await profile.click();
    await f.openExtrudeHud();
    const secondRegion = f.hud().getByLabel('Region', { exact: true });
    assert.equal(await secondRegion.inputValue(), '');
    assert.equal(await f.hud().getByRole('button', { name: 'Apply', exact: true }).isDisabled(), true);
    await secondRegion.selectOption('2');
    await f.hud().getByText('Sketch 1 · Region 3', { exact: true }).waitFor();
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
    await f.same(doc);
    const second = (await f.applyExtrude({ distance: 2, previous: doc, label: '09-two-individual-regions' })).doc;
    assert.equal(second.nodes[2].sourceFeature, 'n0');
    assert.deepEqual(second.nodes[2].boundary.map(edge => edge.side).sort(), ['e9', 'e10', 'e11', 'e12'].sort());
    const output = await f.inspect('two-native-regions', second);
    assert.equal(output.length, 2);
    assert.ok(output.every(body => body.valid && Math.abs(body.volume - 240) < 1e-9));
    const centers = output.map(body => body.centroid[0]).sort((a, b) => a - b);
    assert.ok(Math.abs(centers[0] - 19) < 1e-9 && Math.abs(centers[1] - 33) < 1e-9, JSON.stringify(centers));
    f.report.observations.push({ label: 'two-individual-regions', centersX: centers, volumesMM3: output.map(body => body.volume) });
    await f.newPage();
    const [badChooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await badChooser.setFiles({ name: 'D1133-regions-with-hole.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(whole)) });
    await f.same(whole);
    await f.openExtrudeHud();
    await f.hud().getByLabel('Region', { exact: true }).selectOption('1');
    await f.hud().getByText(/selected region needs four tagged straight sides/i).first().waitFor();
    assert.equal(await f.hud().getByRole('button', { name: 'Apply', exact: true }).isDisabled(), true);
    await f.same(whole);
    await f.snapshot('10-unsupported-individual-region');
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  const { doc } = await f.applyExtrude({ distance: 2, previous: source, label: '07-apply-extrude' });
  assert.equal(doc.nodes[1].sketch, 0);
  const native = await f.inspect('native-regions', doc);
  assert.equal(native.length, 1);
  const [output] = native;
  assert.equal(output.valid, true);
  assert.equal(output.bodies, 2);
  const expectedVolume = (100 + 120 + 120 - 16) * 2;
  assert.ok(Math.abs(output.volume - expectedVolume) < 1e-9, JSON.stringify(output));
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(doc);
  f.report.observations.push({ label: 'native-output', ...output, sourceSketch: doc.nodes[1].sketch });
  assert.deepEqual(f.report.downloads, []);
});
