import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/src/ui/FeatureFailureNotice.tsx',
  'apps/cad-studio/src/state/useCommandPreview.ts',
  'apps/cad-studio/src/app/failedFeature.ts',
  'packages/barocss-cad-model/src/engine/errors.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
  'packages/barocss-cad/src/part/part-finish.ts',
];
const f = await createFlow({
  name: 'step-edge-finish-refusal', output: process.argv[2], envFrozen: 'D1184_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Report the operation-specific reason for refusing the selected STEP lid edge.',
  limits: ['Exact local lid-no-gap STEP from the historical desktop QA receipt. Desktop WebGPU.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { bodyMesh } from '@barocss/cad-model/engine/mesh';
import { partSnapshot } from '@barocss/cad-model/engine/part';

const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { outputs } = partSnapshot(doc);
console.log(JSON.stringify(outputs.map(output => ({
  mass: massPropertiesOf(output),
  strict: checkBrep(output.brep, { strict: true }).valid,
  solids: output.bodyCount,
  edges: bodyMesh(output.brep, 0).edges.map(({ index, names }) => ({ index, names })),
  faces: output.brep.faces.map(face => face.name),
}))));
`,
});
const button = (name, root = f.page) => root.getByRole('button', { name, exact: true });
const inTolerance = (actual, expected) => Math.abs(actual - expected) < 1e-7;

async function openStep(bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'lid-no-gap.step', mimeType: 'application/step', buffer: bytes });
  await f.waitToast(/STEP opened.*1 solid.*millimetres/);
  await f.ready();
  const doc = await f.doc();
  assert.equal(doc.nodes.length, 1);
  assert.equal(doc.nodes[0].kind, 'import');
  assert.equal(doc.nodes[0].step, bytes.toString());
  return doc;
}

async function isoEdges() {
  await button('Iso', f.page.getByRole('group', { name: 'Views', exact: true })).click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const filter = button('Selection filter');
  for (let i = 0; i < 4 && !(await filter.innerText()).trim().endsWith('Edges'); i++) await filter.click();
  assert.match((await filter.innerText()).trim(), /Edges$/);
}

async function pick(world, edges) {
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), world);
  assert.ok(pixel?.length === 2);
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.edges.length === 1);
  const [selected] = await f.page.evaluate(() => window.__studioSelection.selection.edges);
  assert.equal(selected.body, 0);
  const edge = edges.find(edge => edge.index === selected.edge);
  assert.ok(edge);
  f.report.observations.push({ world, pixel, ...edge });
  return edge.names;
}

await f.run(async () => {
  const bytes = await readFile(process.argv[3]);
  assert.equal(sha256(bytes), '417d7aa9e430ae1d9ce134b8878f1d53f917695982b9a8a9f0ade1d20c452e03');
  f.report.files.push({ name: 'lid-no-gap.step', bytes: bytes.length, sha256: sha256(bytes) });
  await f.newPage();
  const source = await openStep(bytes);
  const [imported] = await f.inspect('imported-native', source);
  assert.ok(imported.strict && imported.solids === 1 && inTolerance(imported.mass.volume, 1200));
  await isoEdges();

  const observed = [];
  for (const [command, field] of [['Fillet', 'Radius'], ['Chamfer', 'Distance']]) {
    f.phase = `Select imported dome boundary for ${command}`;
    const names = await pick([45, 0, 11.5], imported.edges);
    assert.deepEqual(names, ['n0.n0.surface0|n0.n0.surface4']);
    await clickModelCommand(f.page, 'Modify', command);
    const hud = f.page.getByRole('dialog', { name: command, exact: true });
    const notice = hud.getByRole('status');
    for (const size of ['1', '2']) {
      f.phase = `Read collapsed ${command} refusal at ${size} mm`;
      const input = hud.getByLabel(field, { exact: true });
      await input.fill('');
      await notice.locator('details').waitFor({ state: 'hidden' });
      await input.fill(size);
      await hud.locator('.status.error').waitFor();
      await notice.locator('details').waitFor();
      assert.equal(await button('Apply', hud).isEnabled(), false);
      await f.same(source);
      assert.equal(await notice.locator('details').getAttribute('open'), null);
      const visible = await notice.locator(':scope > div').evaluateAll(nodes => nodes.slice(0, 2).map(node => node.textContent));
      const detail = await notice.locator('code').textContent();
      observed.push({ command, size, visible, detail });
      await f.snapshot(`refused-${command.toLowerCase()}-${size}`);
    }
    await button('Cancel', hud).click();
    await hud.waitFor({ state: 'hidden' });
    await f.same(source);
  }
  f.report.observations.push(...observed);
  await f.persist();
  for (const { command, visible, detail } of observed) {
    assert.match(visible[0], new RegExp(`The ${command.toLowerCase()} (?:could not make a solid|does not support these faces)`));
    assert.match(visible[1], /pick (?:another edge|an edge)/i);
    assert.doesNotMatch(visible.join(' '), /overlap them|undo the last change/i);
    assert.match(detail, command === 'Fillet' ? /not a manifold solid/ : /chamfers between general faces/);
  }

  f.phase = 'Fillet the sharp bottom edge on the same STEP body';
  await f.page.mouse.click(270, 140);
  await f.page.waitForFunction(() => window.__studioSelection.selection.edges.length === 0);
  const bottom = await pick([45, 0, 0], imported.edges);
  assert.deepEqual(bottom, ['n0.n0.surface1|n0.n0.surface4']);
  await clickModelCommand(f.page, 'Modify', 'Fillet');
  const fillet = f.page.getByRole('dialog', { name: 'Fillet', exact: true });
  await fillet.getByLabel('Radius', { exact: true }).fill('1');
  await fillet.locator('.status.ok').waitFor();
  await f.same(source);
  await button('Apply', fillet).click();
  await fillet.waitFor({ state: 'hidden' });
  await f.changed(source);
  const accepted = (await f.snapshot('sharp-edge-fillet-applied')).doc;
  assert.equal(accepted.nodes.length, 2);
  assert.equal(accepted.nodes[1].kind, 'fillet');
  assert.equal(accepted.nodes[1].radius, 1);
  assert.deepEqual(accepted.nodes[1].edges, bottom);
  const [result] = await f.inspect('sharp-edge-fillet-native', accepted);
  const expectedVolume = 1200 - 10 * (1 - Math.PI / 4);
  assert.ok(result.strict && result.solids === 1 && inTolerance(result.mass.volume, expectedVolume));
  const removedMoment = 10 * (5 / 6 - Math.PI / 4);
  const expectedCentroid = [45, (6000 - removedMoment) / expectedVolume, (7220 - removedMoment) / expectedVolume];
  assert.ok(result.mass.centroid.every((value, axis) => inTolerance(value, expectedCentroid[axis])));
  assert.ok(result.faces.some(name => name.startsWith(accepted.nodes[1].id + '.face')));
  f.report.observations.push({ expectedVolume, volume: result.mass.volume, expectedCentroid, centroid: result.mass.centroid });
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(accepted);
});
