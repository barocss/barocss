import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/ui/DirectPanel.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/engine/errors.ts', 'packages/barocss-cad-model/src/app/sewCommand.ts',
  'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad/src/brep/sew-solid.ts'];
const f = await createFlow({
  name: 'sew-gap-diagnostics', output: process.argv[2], envFrozen: 'D1191_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Use consistent automatic Sew tolerance and name unmatched surfaces in the original gap fixture.',
  limits: ['Exact local moved dome fixture; one selected order; actual desktop WebGPU.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, evaluateSurface, massPropertiesOf, surfaceDomain } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const { outputs: [output] } = partSnapshot(JSON.parse(readFileSync(process.argv[2], 'utf8')));
const check = checkBrep(output.brep, { strict: true });
const roof = Math.max(...output.brep.faces.map(face => {
  const { u, v } = surfaceDomain(face.surface);
  return evaluateSurface(face.surface, (u[0] + u[1]) / 2, (v[0] + v[1]) / 2)[2];
}));
console.log(JSON.stringify({ valid: check.valid, volume: massPropertiesOf(output).volume,
  gap: check.maximumEdgeSurfaceGap, faces: output.brep.faces.length, solids: output.bodyCount,
  edges: output.brep.edges.length, vertices: output.brep.vertices.length,
  roof }));
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const direct = () => f.page.getByRole('complementary', { name: 'Direct geometry', exact: true });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);

async function readNotice(panel) {
  const notice = panel.locator('.hud-error').or(panel.getByRole('alert'));
  await notice.first().waitFor();
  const detail = notice.locator('details');
  await detail.waitFor();
  assert.equal(await detail.getAttribute('open'), null);
  const raw = await detail.locator('code').textContent();
  assert.match(raw, /8 edges.*surfaces 1, 3, 4, 5, 6/);
  return { copy: await notice.locator(':scope > div').evaluateAll(nodes => nodes.slice(0, 2).map(node => node.textContent)), raw };
}

await f.run(async () => {
  const bytes = await readFile(process.argv[3]);
  const hash = sha256(bytes);
  assert.equal(hash, 'fa52cc2f0413a6440606be2ca7ffc2862ce691c348f434bccc606870c908aeac');
  f.report.files.push({ name: 'gapped-lid.bcad', bytes: bytes.length, sha256: hash });
  const source = JSON.parse(bytes.toString());
  await f.newPage();
  await f.openFile(process.argv[3], 0);
  await f.same(source);

  f.phase = 'Select the six direct source surfaces in historical order';
  for (const [index, object] of source.direct.objects.entries()) {
    const row = f.page.locator('.ol.direct').filter({ hasText: object.name });
    assert.equal(await row.count(), 1);
    await row.click({ modifiers: index ? ['Shift'] : [] });
  }
  const start = button('Sew into a body', direct());
  const tooltip = await start.getAttribute('title');
  await direct().getByLabel(/^(?:Gap|Tolerance \(0: automatic\))$/).fill('0.019');
  await start.click();
  const hud = f.page.getByRole('dialog', { name: 'Sew', exact: true });
  const tolerance = hud.getByLabel('Tolerance (0: automatic)', { exact: true });
  const apply = button('Apply', hud);
  await hud.locator('.status.error').waitFor();
  const previewNotice = await readNotice(hud);
  assert.equal(await apply.isEnabled(), false);
  await f.same(source);
  await f.snapshot('below-gap-refused');

  f.phase = 'Verify automatic tolerance permits 0.02 mm and explicit 0.021 applies';
  await tolerance.fill('0');
  await hud.locator('.status.ok').waitFor();
  await f.same(source);
  await f.snapshot('automatic-preview');
  await tolerance.fill('0.019');
  await hud.locator('.status.error').waitFor();
  await tolerance.fill('0.021');
  await hud.locator('.status.ok').waitFor();
  await apply.click();
  await f.changed(source);
  const accepted = (await f.snapshot('explicit-sew-applied')).doc;
  assert.equal(accepted.nodes.length, 1);
  const feature = accepted.nodes[0];
  assert.equal(feature.kind, 'sew');
  assert.equal(feature.tolerance, 0.021);
  assert.deepEqual(feature.names, source.direct.objects.map(object => object.name));
  assert.ok(accepted.direct.objects.every(object => object.hidden));
  const native = await f.inspect('sew-native', accepted);
  assert.ok(native.valid && native.faces === 6 && native.edges === 12 && native.vertices === 8 && native.solids === 1);
  close(native.volume, 1200);
  close(native.gap, 0.02);
  close(native.roof, 13.02);

  f.phase = 'Reject 0.019 in History and recover with the automatic value';
  await f.openFeatureEditor(0, 'Sew tolerance History');
  const editor = f.editor();
  const field = editor.getByLabel(/^Tolerance(?: \(0: automatic\))?$/);
  const historyLabel = await field.getAttribute('aria-label');
  await field.fill('0.019');
  await button('Apply', editor).click();
  const historyNotice = await readNotice(editor);
  await f.same(accepted);
  await f.snapshot('history-below-gap-refused');

  f.report.observations.push({ tooltip, historyLabel, previewNotice, historyNotice, native });
  await f.persist();
  assert.match(tooltip, /0.*automatic/i);
  assert.match(historyLabel ?? '', /0: automatic/i);
  for (const { copy } of [previewNotice, historyNotice]) {
    assert.equal(copy[0], 'Sew leaves unmatched edges');
    assert.match(copy[1], /8 edges.*surfaces 1, 3, 4, 5, 6/i);
    assert.match(copy[1], /gap.*tolerance/i);
  }

  await field.fill('0');
  await button('Apply', editor).click();
  await f.changed(accepted);
  const automatic = (await f.snapshot('history-automatic-applied')).doc;
  assert.equal(automatic.nodes[0].tolerance, undefined);
  assert.deepEqual(automatic.nodes[0].names, feature.names);
  const autoNative = await f.inspect('automatic-native', automatic);
  assert.ok(autoNative.valid && autoNative.solids === 1);
  close(autoNative.volume, 1200);
  close(autoNative.gap, 0.02);
  await f.undo();
  await f.same(accepted);
  await f.redo();
  await f.same(automatic);
});
