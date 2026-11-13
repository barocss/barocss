import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/test/z-pattern-lifecycle-browser.mjs',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/commands.ts',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad/src/part/part-transform.ts',
];
const f = await createFlow({
  name: 'z-pattern-lifecycle', output: process.argv[2], envFrozen: 'D821_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Keep a 120° Z pattern about its non-origin pivot across Count edit, refusal and project Open.',
  limits: ['One ordinary disjoint rectangle extrusion, one-body result and positive partial spread.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const outputs = evaluateCadPart(toPartDocument(doc)).outputs;
if (outputs.length !== 1) throw Error('Expected one output');
const [body] = outputs;
console.log(JSON.stringify({ id: body.id, count: body.bodyCount, valid: checkOutput(body).valid,
  mass: massPropertiesOf(body), points: body.brep.vertices.map(vertex => vertex.point) }));
`,
});
const ref = node => ({ node, side: 'solid' });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [50, 10], max: [54, 16] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
  ],
  outputs: { b1: ref(1) }, nextId: 2,
};
const spread = 120, pivot = [12, 4, 0], volume = 192;
const project = 'D821 partial Z pattern ' + randomUUID(), name = 'D821-partial-z.bcad';
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
function rotatePoint([x, y, z], angle) {
  const radians = angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  return [pivot[0] + c * (x - pivot[0]) - s * (y - pivot[1]), pivot[1] + s * (x - pivot[0]) + c * (y - pivot[1]), z];
}
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
async function checkPattern(label, doc, count) {
  const step = spread / (count - 1);
  assert.deepEqual(doc.nodes, [...source.nodes, { kind: 'circular-pattern', parent: ref(1), axis: 'z', angle: step, count, span: spread, pivot, id: 'n2' }]);
  assert.deepEqual(doc.outputs, { b2: ref(2) });
  const native = await f.inspect(label, doc);
  assert.equal(native.id, 'n2');
  assert.equal(native.valid, true);
  assert.equal(native.count, count);
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b2']);
  const angles = Array.from({ length: count }, (_, index) => step * index);
  const centers = angles.map(angle => rotatePoint([52, 13, 4], angle));
  const centroid = [0, 1, 2].map(axis => centers.reduce((sum, center) => sum + center[axis], 0) / count);
  for (const result of [native.mass, bodies[0]]) {
    assert.ok(Math.abs(result.volume - volume * count) <= 1e-7, JSON.stringify(result));
    assert.ok(distance(result.centroid, centroid) <= 1e-9, JSON.stringify(result));
  }
  const corners = [50, 54].flatMap(x => [10, 16].flatMap(y => [0, 8].map(z => [x, y, z])));
  const expected = angles.flatMap(angle => corners.map(corner => rotatePoint(corner, angle)));
  assert.equal(native.points.length, expected.length);
  for (const actual of native.points) {
    const match = expected.findIndex(point => distance(point, actual) <= 1e-9);
    assert.ok(match >= 0, JSON.stringify(actual));
    expected.splice(match, 1);
  }
  assert.deepEqual(expected, []);
  f.report.observations.push({ label, count, step, angles, pivot, corners: native.points.length, volume: native.mass.volume, centroid: native.mass.centroid });
}
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  if (await versions().getByLabel('Project', { exact: true }).isVisible()) return;
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}
async function editCount(from, to, label) {
  await f.openFeatureEditor(2, label);
  const count = f.editor().getByLabel('Count', { exact: true });
  assert.equal(await count.inputValue(), String(from.nodes[2].count));
  await count.fill(String(to));
  await f.applyEditor(from, label);
  return f.doc();
}

await f.run(async () => {
  f.phase = 'create a real partial Z pattern with a displaced pivot';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await f.page.locator('.outliner .ol-row > button.ol').click();
  await clickModelCommand(f.page, 'Pattern', 'Circular pattern');
  const hud = f.page.getByRole('dialog', { name: 'Circular pattern', exact: true });
  assert.equal(await hud.getByLabel('Axis', { exact: true }).inputValue(), 'z');
  assert.equal(await hud.getByLabel('Result', { exact: true }).inputValue(), 'one');
  await hud.getByLabel('Count', { exact: true }).fill('4');
  await hud.getByLabel('Spread over', { exact: true }).fill(String(spread));
  await hud.getByLabel('Axis at X', { exact: true }).fill(String(pivot[0]));
  await hud.getByLabel('Axis at Y', { exact: true }).fill(String(pivot[1]));
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  await f.snapshot('01-preview');
  await button(hud, 'Apply').click();
  await hud.waitFor({ state: 'hidden' });
  await f.changed(source);
  const four = await f.doc();
  await checkPattern('created-four', four, 4);

  const three = await editCount(four, 3, 'count-three');
  await checkPattern('edited-three', three, 3);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot('02-three-spread');

  await f.openFeatureEditor(2, 'zero count refusal');
  await f.editor().getByLabel('Count', { exact: true }).fill('0');
  assert.equal(await button(f.editor(), 'Apply').isDisabled(), true);
  await f.editor().getByText(/Count must be a whole number from 2 to 36/i).waitFor();
  await f.same(three);
  await checkPattern('retained-three', three, 3);
  await f.snapshot('03-zero-count-refused');
  await f.closeEditor();
  await f.undo();
  await f.same(four);
  await f.redo();
  await f.same(three);

  f.phase = 'save and reopen the exact edited partial pattern';
  await openProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), three);
  await button(versions(), 'Close project').click();
  await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(three);
  await checkPattern('reopened-three', three, 3);
  f.report.observations.push({ label: 'pattern-project-readback', bytes: bytes.length, sha256: sha256(bytes) });

  const five = await editCount(three, 5, 'reopened-count-five');
  await checkPattern('reopened-edited-five', five, 5);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot('04-reopened-five-spread');
  assert.deepEqual(f.report.downloads, []);
});
