import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = ['apps/cad-studio/test/extrude-empty-cut-browser.mjs', 'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/state/useCommandPreview.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
  'apps/cad-studio/src/engine/client.ts', 'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts'];
const f = await createFlow({
  name: 'extrude-empty-cut', output: process.argv[2], envFrozen: 'D1154_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Check a Cut that misses the native target and the matching material-removing control.',
  limits: ['Upright rectangular tool, upright plate and one existing through bore.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const [body] = evaluateCadPart(toPartDocument(JSON.parse(readFileSync(process.argv[2], 'utf8')))).outputs;
const floors = body.brep.faces.map(faceGeometry).filter(face => face.kind === 'plane' && face.n[2] > 0.999999).map(face => face.o[2]);
console.log(JSON.stringify({ valid: checkOutput(body).valid, pieces: body.bodyCount, volume: massPropertiesOf(body).volume, floors }));
`,
});
const ref = node => ({ node, side: 'solid' });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 3,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [50, 10], max: [58, 18], on: ref(1),
      plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
  ],
  outputs: { b1: ref(1) },
};
const button = name => f.page.getByRole('button', { name, exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-7;
const waitStatus = value => f.hud().locator('.status').filter({ hasText: new RegExp(`^${value}$`) }).waitFor();

await f.run(async () => {
  await f.newPage();
  const open = async doc => {
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'D1154-cut.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await f.same(doc);
  };
  const cut = async () => {
    await f.page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · rectangle', exact: true }).click();
    await f.editor().waitFor();
    await f.closeEditor();
    await f.openExtrudeHud();
    const hud = f.hud();
    await hud.getByLabel('Operation', { exact: true }).selectOption('cut');
    const distance = hud.getByLabel('Distance', { exact: true });
    await distance.fill('2');
  };
  const apply = () => f.hud().getByRole('button', { name: 'Apply', exact: true });
  const volume = async () => (await f.bodies()).bodies[0].volume;
  const refusals = async (doc, label, expectedVolume) => {
    await waitStatus('refused');
    await f.hud().getByText(/does not remove any material/i).waitFor();
    assert.equal(await apply().isDisabled(), true);
    const history = await f.page.getByRole('button', { name: 'Undo', exact: true }).isEnabled();
    await f.page.keyboard.press('Enter');
    const refused = await f.snapshot(label);
    assert.deepEqual(refused.doc, doc);
    assert.equal(await f.page.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), history);
    assert.ok(near(await volume(), expectedVolume));
    await f.hud().getByRole('button', { name: 'Cancel', exact: true }).click();
  };
  await open(source);
  f.phase = 'attempt an Extrude Cut entirely outside the attached plate';
  await cut();
  if (baseline) {
    await waitStatus('preview');
    await apply().click();
    await f.changed(source);
    const after = await f.snapshot('empty-cut-applied');
    assert.ok(near(await volume(), 12000));
    assert.equal(after.doc.nodes.at(-1).kind, 'difference');
    assert.fail('Studio applied a Cut with zero material removed');
  }
  await refusals(source, 'empty-cut-blocked', 12000);

  f.phase = 'refuse a Cut sharing only one wall with the plate';
  const tangent = structuredClone(source);
  tangent.nodes[2].min = [40, 10];
  tangent.nodes[2].max = [48, 18];
  await open(tangent);
  await cut();
  await refusals(tangent, 'tangent-cut-blocked', 12000);

  f.phase = 'refuse a Cut inside the existing bore despite overlapping bounding boxes';
  const voided = structuredClone(source);
  voided.nodes.splice(2, 0, { id: 'n2', kind: 'hole', parent: ref(1), center: [20, 15], radius: 4 });
  Object.assign(voided.nodes[3], { id: 'n3', min: [18, 13], max: [22, 17], on: ref(2) });
  voided.outputs = { b2: ref(2) };
  voided.nextId = 4;
  await open(voided);
  await cut();
  await refusals(voided, 'bore-cut-blocked', 12000 - 160 * Math.PI);

  f.phase = 'apply the same Cut across the actual target';
  const crossing = structuredClone(source);
  crossing.nodes[2].min = [36, 10];
  crossing.nodes[2].max = [44, 18];
  await open(crossing);
  await cut();
  await waitStatus('preview');
  await apply().click();
  await f.changed(crossing);
  await f.hud().waitFor({ state: 'hidden' });
  const after = await f.snapshot('crossing-applied');
  const native = await f.inspect('crossing-native', after.doc);
  assert.deepEqual(after.doc.nodes.at(-1).parent, ref(1));
  assert.ok(native.valid && native.pieces === 1 && native.floors.some(z => near(z, 8)));
  assert.ok(near(await volume(), 11936) && near(native.volume, 11936));
  f.report.observations.push({ label: 'crossing-native', native, removedVolume: 64 });
  await f.undo();
  await f.same(crossing);
  await f.redo();
  await f.same(after.doc);
  assert.deepEqual(f.report.downloads, []);
});
