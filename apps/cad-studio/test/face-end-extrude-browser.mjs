import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const baseline = process.argv[3] === '--baseline';
const pins = [
  'apps/cad-studio/test/face-end-extrude-browser.mjs',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/engine/doc.ts',
  ...(baseline ? [] : ['packages/barocss-cad-model/src/engine/faceEndExtrude.ts']),
  'packages/barocss-cad-model/src/engine/migrate.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
];
const f = await createFlow({
  name: 'face-end-extrude', output: process.argv[2], envFrozen: 'D840_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Verify legacy fixed distance and unsupported-kind Open in the pre-feature reader.'
    : 'Resolve a fixed XY rectangle to a preceding native cap and retain its two output bodies through target edits and Open.',
  limits: ['Two rectangular prisms in the same desktop document. Positive Z. One native rectangle cap.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const part = toPartDocument(doc), result = evaluateCadPart(part);
console.log(JSON.stringify({
  features: part.features,
  outputs: result.outputs.map(body => ({
    id: body.id, count: body.bodyCount, valid: checkOutput(body).valid, mass: massPropertiesOf(body),
    corners: body.brep.vertices.map(vertex => vertex.point),
    faces: body.brep.faces.map(face => ({ name: face.name, level: face.surface.kind === 'surface' ? face.surface.controlPoints.flat().map(point => point[2]) : [] })),
  })),
}));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});
const recipe = {
  id: 'n3', kind: 'face-end-extrude', sketch: 2,
  target: { body: { node: 1, side: 'solid' }, feature: 'n1', face: 'n1.bottom' },
};
const documentAt = (from, fixed) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-5, -5], max: [15, 15] },
    { id: 'n1', kind: 'extrude', sketch: 0, from, height: 5 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    fixed ? recipe : { id: 'n3', kind: 'extrude', sketch: 2, height: 20 },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
});
const name = 'D840-face-end.bcad', project = 'D840 face end ' + randomUUID();
const near = (a, b) => Math.abs(a - b) < 1e-8;
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const field = (panel, name) => panel.getByLabel(name, { exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });

async function open(file, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}

async function geometry(label, from, cap, fixed) {
  const doc = documentAt(from, fixed);
  assert.deepEqual(await f.doc(), doc);
  await f.ready();
  const native = await f.inspect(label, doc);
  const extrude = native.features.find(feature => feature.id === 'n3');
  assert.deepEqual(extrude, { id: 'n3', kind: 'extrude', sketch: 'n2', height: cap });
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b1', 'b3']);
  assert.equal(native.outputs.length, 2);
  for (const [key, range, lo, hi, volume, center, face, faceZ] of [
    ['n1', [-5, 15], from, from + 5, 2000, [5, 5, from + 2.5], 'n1.bottom', from],
    ['n3', [0, 10], 0, cap, 100 * cap, [5, 5, cap / 2], 'n3.top', cap],
  ]) {
    const output = native.outputs.find(output => output.id === key);
    assert.ok(output?.valid && output.count === 1);
    assert.equal(output.corners.length, 8);
    const corners = range.flatMap(x => range.flatMap(y => [lo, hi].map(z => [x, y, z])));
    assert.ok(corners.every(point => output.corners.some(actual => actual.every((value, i) => near(value, point[i])))));
    const selected = output.faces.filter(f => f.name === face);
    assert.equal(selected.length, 1);
    assert.ok(selected[0].level.length >= 4 && selected[0].level.every(value => near(value, faceZ)));
    for (const result of [output.mass, bodies.find(body => body.key === 'b' + key.slice(1))]) {
      assert.ok(near(result.volume, volume));
      assert.ok(result.centroid.every((v, i) => near(v, center[i])));
    }
  }
  f.report.observations.push({ label, targetCap: from, extrudeCap: cap, volume: 100 * cap, corners: 16, outputs: ['b1', 'b3'] });
}

async function editTargetStart(value) {
  await f.openFeatureEditor(1, 'target start Z');
  const before = await f.doc();
  await field(f.editor(), 'Start Z').fill(String(value));
  await button(f.editor(), 'Apply').click();
  await f.changed(before);
  await f.editor().waitFor({ state: 'hidden' });
}

async function attachProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await field(versions(), 'Project').waitFor();
}

await f.run(async () => {
  await f.newPage();
  const initial = documentAt(20, !baseline);
  await open(name, initial);
  await f.same(initial);
  await geometry('opened', 20, 20, !baseline);
  await editTargetStart(30);
  await geometry('target-moved', 30, baseline ? 20 : 30, !baseline);
  const accepted = await f.doc();
  await f.snapshot('01-target-moved');
  if (baseline) {
    f.phase = 'explicit refusal of the new kind in the pre-feature reader';
    await open('D840-candidate.bcad', documentAt(30, true));
    const notice = await f.waitToast(/does not know: face-end-extrude/);
    assert.deepEqual(await f.doc(), accepted);
    await f.snapshot('02-candidate-refused');
    f.report.observations.push({ label: 'pre-feature-reader', notice });
    return;
  }

  f.phase = 'refuse a target face that no longer contains the projected profile';
  await f.openFeatureEditor(1, 'target width');
  const before = await f.snapshot('accepted-before-shrink');
  await field(f.editor(), 'Width').fill('8');
  await button(f.editor(), 'Apply').click();
  const error = f.editor().locator('.hud-error');
  await error.waitFor();
  assert.match(await error.textContent(), /target face.*contain|profile.*outside/i);
  const refused = await f.snapshot('02-shrink-refused');
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(refused[key], before[key], key);
  await f.closeEditor();
  await f.undo();
  await geometry('first-undo', 20, 20, true);
  await f.redo();
  await geometry('first-redo', 30, 30, true);

  f.phase = 'save and reopen the bound feature and move the target again';
  await attachProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await directory.getFileHandle(name)).getFile().then(file => file.arrayBuffer())));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), accepted);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  await button(versions(), 'Close project').click();
  await field(versions(), 'Project').waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await attachProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(accepted);
  await geometry('reopened', 30, 30, true);
  await editTargetStart(40);
  await geometry('post-open-target-moved', 40, 40, true);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot('03-post-open-target-moved');
  assert.deepEqual(f.report.downloads, []);
});
