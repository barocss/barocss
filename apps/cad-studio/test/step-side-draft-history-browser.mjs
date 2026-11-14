import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/files/importedFile.ts',
  'apps/cad-studio/src/ui/NodeEditor.tsx', 'packages/barocss-cad-model/src/app/commands.ts',
  'packages/barocss-cad-model/src/app/draftEdit.ts', 'packages/barocss-cad-model/src/app/draftInputs.ts',
  'packages/barocss-cad/src/part/part-face-finish.ts'];
const f = await createFlow({
  name: 'step-side-draft-history', output: process.argv[2], envFrozen: 'D1175_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Reproduce signed Draft pull and neutral position on an imported STEP side through History.',
  limits: ['One locally generated STEP box. One planar side picked in the desktop viewport.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, evaluateCadPart, exportStep, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
if (process.argv[3] === '"step"') {
  const { outputs: [{ brep }] } = evaluateCadPart({
    format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
      { id: 'sketch', kind: 'sketch', profile: 'rectangle', min: [4, -3], max: [24, 7] },
      { id: 'box', kind: 'extrude', sketch: 'sketch', from: 6, height: 5 },
    ],
  });
  console.log(JSON.stringify(exportStep(brep, { timestamp: '2026-11-14T00:00:00Z' })));
} else {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const { outputs: [body], outputs } = partSnapshot(doc);
  console.log(JSON.stringify({ outputs: outputs.length, solids: body.bodyCount,
    valid: checkBrep(body.brep, { strict: true }).valid,
    faces: body.brep.faces.map(face => face.name),
    volume: massPropertiesOf(body).volume, points: body.brep.vertices.map(vertex => vertex.point) }));
}
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const status = (hud, meaning) => hud.locator('.status').filter({ hasText: new RegExp('^' + meaning + '$') }).waitFor();
const near = (actual, expected) => Math.abs(actual - expected) <= 1e-6;
const neutralText = hud => hud.locator('.hud-step').filter({ hasText: 'Neutral' }).innerText();
async function editor(index) {
  await f.openFeatureEditor(index, 'selected Draft');
  await button('Edit draft', f.editor()).click();
  const hud = f.page.getByRole('dialog', { name: 'Edit Draft', exact: true });
  await status(hud, 'preview');
  return hud;
}

async function verify(label, doc, dir, neutral, angle) {
  const native = await f.inspect(label, doc);
  const tangent = Math.tan(angle * Math.PI / 180);
  const sideAt = x => -3 + dir * (x - neutral) * tangent;
  const expected = 20 * 5 * (7 - sideAt(14));
  assert.ok(native.outputs === 1 && native.solids === 1 && native.valid, JSON.stringify(native));
  assert.ok(near(native.volume, expected), JSON.stringify({ actual: native.volume, expected, label }));
  for (const x of [4, 24]) for (const y of [sideAt(x), 7]) for (const z of [6, 11]) {
    assert.ok(native.points.some(point => point.every((value, axis) => near(value, [x, y, z][axis]))),
      JSON.stringify({ expected: [x, y, z], points: native.points }));
  }
  f.report.observations.push({ label, dir, neutral, angle, cornersY: [sideAt(4), sideAt(24)], volume: native.volume, expected });
}

await f.run(async () => {
  const step = await f.inspect('step-fixture', {}, 'step');
  f.report.observations.push({ label: 'step-source', hash: sha256(step) });
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1175-draft-box.step', mimeType: 'application/step', buffer: Buffer.from(step) });
  await f.waitToast(/STEP opened.*1 solid.*millimetres/);
  await f.ready();
  const source = await f.doc();
  assert.equal(source.nodes.length, 1);
  assert.equal(source.nodes[0].kind, 'import');
  assert.equal(source.nodes[0].step, step);

  f.phase = 'Pick the imported Y− side and verify +X Draft';
  await button('View cube directions', f.page.getByRole('group', { name: 'View cube' })).click();
  await f.page.getByRole('menuitem', { name: 'Front', exact: true }).click();
  await f.page.waitForFunction(() => document.querySelector('.view-cube .vc-label')?.textContent === 'FRONT');
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  const pixel = await f.page.evaluate(() => window.__studioScreenOf([14, -3, 8.5]));
  assert.ok(pixel?.length === 2);
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Draft');
  const creation = f.page.getByRole('dialog', { name: 'Draft', exact: true });
  await creation.getByLabel('Pull', { exact: true }).selectOption('x');
  await status(creation, 'preview');
  assert.equal(await creation.getByLabel('Neutral plane', { exact: true }).inputValue(), 'auto');
  assert.match(await neutralText(creation), /X = 4 mm/);
  await f.same(source);
  await f.snapshot('draft-positive-preview');
  await button('Apply', creation).click();
  await f.changed(source);
  const positive = (await f.snapshot('draft-positive')).doc;
  const index = positive.nodes.length - 1, node = positive.nodes[index];
  assert.equal(node.kind, 'draft');
  assert.equal(node.pull, 'x');
  assert.deepEqual(node.faces, ['n0.box.side0']);
  assert.equal(node.neutral, undefined);
  await verify('draft-positive', positive, 1, 4, 5);
  const hud = await editor(index);
  const pull = hud.getByLabel('Pull', { exact: true }), mode = hud.getByLabel('Neutral plane', { exact: true });
  const neutral = hud.getByLabel('Neutral coordinate', { exact: true });
  assert.equal(await pull.inputValue(), 'x');
  assert.equal(await mode.inputValue(), 'auto');
  assert.match(await neutralText(hud), /X = 4 mm/);
  await pull.selectOption('y');
  await status(hud, 'refused');
  assert.match(await hud.innerText(), /choose a pull axis parallel to the selected face/i);
  assert.equal(await button('Apply', hud).isEnabled(), false);
  await f.same(positive);
  await f.snapshot('draft-parallel-refused');
  await pull.selectOption('-x');
  await status(hud, 'preview');
  assert.match(await neutralText(hud), /X = 24 mm/);
  await f.same(positive);
  await f.snapshot('draft-negative-preview');
  await button('Apply', hud).click();
  await f.changed(positive);
  const negative = (await f.snapshot('draft-negative')).doc;
  assert.equal(negative.nodes[index].pull, '-x');
  assert.equal(negative.nodes[index].neutral, undefined);
  await verify('draft-negative', negative, -1, 24, 5);
  await f.undo();
  await f.same(positive);
  await f.redo();
  await f.same(negative);

  const fixed = await editor(index);
  await fixed.getByLabel('Neutral plane', { exact: true }).selectOption('fixed');
  assert.equal(await neutral.inputValue(), '24');
  await neutral.fill('23');
  await status(fixed, 'refused');
  assert.match(await fixed.innerText(), /use body end or move the fixed coordinate/i);
  await fixed.getByText('Kernel detail', { exact: true }).click();
  assert.match(await fixed.innerText(), /neutral plane x = 23 must be at or above/i);
  assert.equal(await button('Apply', fixed).isEnabled(), false);
  await f.same(negative);
  await f.snapshot('draft-neutral-refused');
  await neutral.fill('26');
  await status(fixed, 'preview');
  assert.match(await neutralText(fixed), /X = 26 mm/);
  await button('Apply', fixed).click();
  await f.changed(negative);
  const explicit = (await f.snapshot('draft-explicit')).doc;
  assert.deepEqual(explicit.nodes[0], source.nodes[0]);
  assert.deepEqual(explicit.outputs, positive.outputs);
  assert.deepEqual(explicit.nodes[index], { ...node, pull: '-x', neutral: 26 });
  await verify('draft-explicit', explicit, -1, 26, 5);
  await f.undo();
  await f.same(negative);
  await f.redo();
  await f.same(explicit);
  const saved = await f.save('step-side-draft-history');
  const reopened = await f.freshOpen(saved.file, explicit, 'draft-reopened');
  await verify('draft-reopened', reopened.doc, -1, 26, 5);
  const replay = await editor(index);
  assert.equal(await replay.getByLabel('Pull', { exact: true }).inputValue(), '-x');
  assert.equal(await replay.getByLabel('Neutral coordinate', { exact: true }).inputValue(), '26');
  await button('Cancel', replay).click();
  await f.same(explicit);
});
