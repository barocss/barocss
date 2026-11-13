import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/multi-region-profile-pick-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
];
const f = await createFlow({
  name: 'multi-region-profile-pick', output: process.argv[2], envFrozen: 'D1129_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Pick a finished sketch from either filled region and verify its full Extrude scope.',
  limits: ['Two rectangles with a shared segment, a hole, and an isolated rectangle. Finished sketch selection remains at sketch scope.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(output => ({
  valid: checkOutput(output).valid, bodies: output.brep.bodies.length, volume: massPropertiesOf(output).volume,
}))));
`,
});
const rectangle = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  .map(start => ({ kind: 'line', start }));
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [4, 6], max: [14, 16], id: 'n0',
    regions: [rectangle(14, 6, 24, 18), rectangle(28, 6, 38, 18)],
    holes: [rectangle(7, 9, 11, 13)] }],
  outputs: {}, nextId: 1,
};
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
  await route('04-hole-interior', hole, []);
  await route('05-isolated-region-interior', isolatedRegion, [0]);
  f.phase = 'verify the whole-sketch scope in the preview';
  await f.openExtrudeHud();
  await f.hud().getByText('Sketch 1 · all 3 regions', { exact: true }).waitFor();
  await f.same(source);
  await f.snapshot('06-all-regions-preview');
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
