import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/extrude-end-face-start-cap-browser.mjs',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/engine/faceEndExtrude.ts',
  'packages/barocss-cad/src/part/part-profile-solid.ts',
  'packages/barocss-cad/src/features/prismatic-solid.ts',
];
const f = await createFlow({
  name: 'extrude-end-face-start-cap', output, envFrozen: 'D852_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce the native name changing authored cap after a signed target edit'
    : 'Keep the authored start cap as the saved target across signed edits and file Open',
  limits: ['One XY target extrusion and a 10 by 10 mm dependent profile.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = evaluateCadPart(toPartDocument(doc));
console.log(JSON.stringify(result.outputs.map(output => ({
  id: output.id, valid: checkOutput(output).valid, count: output.bodyCount,
  zLevels: [...new Set(output.brep.vertices.map(vertex => vertex.point[2]))].sort((a, b) => a - b),
  volume: massPropertiesOf(output).volume,
  faces: Object.fromEntries(output.brep.faces.map(face => [face.name, faceGeometry(face)])),
}))));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});

const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-5, -5], max: [15, 15] },
    { id: 'n1', kind: 'extrude', sketch: 0, from: 20, height: 5 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    { id: 'n3', kind: 'face-end-extrude', sketch: 2,
      target: { body: { node: 1, side: 'solid' }, feature: 'n1', face: 'n1.bottom' } },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const withTarget = (fields, doc = seed) => ({ ...doc, nodes: doc.nodes.map((node, index) => index === 1 ? { ...node, ...fields } : node) });
const reversed = withTarget({ height: -5 });
const reversedOnly = { ...reversed, nodes: reversed.nodes.slice(0, 2), outputs: { b1: reversed.outputs.b1 }, nextId: 2 };
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const near = (a, b) => Math.abs(a - b) <= 1e-7;

async function selectFile(doc, name) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}

async function assertNative(label, doc, startCap, otherCap, dependentEnd) {
  const outputs = await f.inspect(label, doc);
  assert.deepEqual(outputs.map(output => output.id), dependentEnd === undefined ? ['n1'] : ['n1', 'n3']);
  assert.ok(outputs.every(output => output.valid && output.count === 1));
  const [target, dependent] = outputs;
  const min = Math.min(startCap, otherCap), max = Math.max(startCap, otherCap);
  assert.deepEqual(target.zLevels, [min, max]);
  assert.ok(near(target.volume, 400 * (max - min)));
  for (const [name, level, normal] of [['n1.bottom', min, -1], ['n1.top', max, 1]]) {
    const face = target.faces[name];
    assert.ok(face?.kind === 'plane' && near(face.o[2], level) && near(face.n[2], normal));
  }
  if (dependentEnd !== undefined) {
    assert.deepEqual(dependent.zLevels, [0, dependentEnd]);
    assert.ok(near(dependent.volume, dependentEnd * 100));
  }
  f.report.observations.push({ label, authoredStart: startCap, nativeBottom: min, dependentEnd, targetVolume: target.volume, dependentVolume: dependent?.volume });
}

function assertExact(after, before) {
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty']) assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(after.selection.selection, before.selection.selection);
}

await f.run(async () => {
  await f.newPage();
  f.phase = 'open the valid saved binding';
  await selectFile(seed, 'D852-bound-start-cap');
  await f.same(seed);
  await assertNative('native-bound-start-z20', seed, 20, 25, 20);
  await f.openFeatureEditor(1, 'target distance');
  const before = await f.snapshot('01-bound-start-z20');
  const editor = f.editor();
  await editor.getByLabel('Distance', { exact: true }).fill('-5');
  f.phase = 'apply the target sign reversal in History';
  await button(editor, 'Apply').click();
  if (baseline) {
    await f.same(reversed);
    await assertNative('native-reversed-silently-reattached', reversed, 20, 15, 15);
    const state = await f.snapshot('02-baseline-silent-reattachment');
    assert.ok(near(state.bodies.bodies[1].volume, 1500));
    await f.undo();
    await f.same(seed);
    return;
  }

  const notice = editor.locator('.hud-error');
  await notice.getByText('Kernel detail', { exact: true }).click();
  await notice.getByText(/target extrusion must stay forward/i).waitFor();
  assertExact(await f.snapshot('02-sign-reversal-refused'), before);
  await assertNative('native-reversed-unbound-control', reversedOnly, 20, 15);

  f.phase = 'apply a valid target start edit after the refusal';
  await editor.getByLabel('Distance', { exact: true }).fill('5');
  await editor.getByLabel('Start Z', { exact: true }).fill('30');
  await button(editor, 'Apply').click();
  const moved = withTarget({ from: 30 });
  await f.same(moved);
  await assertNative('native-bound-start-z30', moved, 30, 35, 30);
  await f.closeEditor();
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(moved);

  f.phase = 'refuse a reversed saved binding through actual file Open';
  const accepted = await f.snapshot('03-valid-target-edited');
  await selectFile(reversed, 'D852-reversed-binding');
  await f.waitToast(/target extrusion must stay forward/i);
  assertExact(await f.snapshot('04-open-refusal-keeps-accepted'), accepted);
  await f.dismissToasts();

  f.phase = 'open an unbound signed ordinary extrusion';
  await selectFile(reversedOnly, 'D852-reversed-no-binding');
  await f.same(reversedOnly);
  await f.snapshot('05-unbound-reverse-opens');
  assert.deepEqual(f.report.downloads, []);
});
