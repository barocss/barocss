import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/test/z-pattern-separate-browser.mjs',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/commands.ts',
  'packages/barocss-cad-model/src/chat/features.ts',
  'packages/barocss-cad/src/part/part-transform.ts',
];
const f = await createFlow({
  name: 'z-pattern-separate', output: process.argv[2], envFrozen: 'D822_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Edit a copied extrusion independently in a displaced 120° Z pattern with four separate outputs.',
  limits: ['One ordinary rectangular extrusion and positive partial Z spread.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const outputs = evaluateCadPart(toPartDocument(doc)).outputs;
console.log(JSON.stringify(outputs.map(body => ({
  id: body.id, count: body.bodyCount, valid: checkOutput(body).valid, mass: massPropertiesOf(body),
  points: body.brep.vertices.map(vertex => vertex.point),
}))));
`,
});
const ref = node => ({ node, side: 'solid' });
const sketch = { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [50, 10], max: [54, 16] };
const extrude = { id: 'n1', kind: 'extrude', sketch: 0, height: 8 };
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [sketch, extrude], outputs: { b1: ref(1) }, nextId: 2,
};
const pivot = [12, 4, 0];
const angles = [0, 40, 80, 120];
const keys = ['b1', 'b4', 'b7', 'b10'];
const editedIndex = 6;
const project = 'D822 separate Z pattern ' + randomUUID(), name = 'D822-separate-z.bcad';
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const field = (panel, name) => panel.getByLabel(name, { exact: true });
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));

function rotate([x, y, z], angle) {
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  return [12 + cos * (x - 12) - sin * (y - 4), 4 + sin * (x - 12) + cos * (y - 4), z];
}

async function checkCopies(label, doc, middleHeight) {
  const nodes = [sketch, extrude];
  for (const [index, angle] of angles.slice(1).entries()) {
    const start = 2 + index * 3;
    nodes.push(
      { ...sketch, id: 'n' + start },
      { ...extrude, id: 'n' + (start + 1), sketch: start, height: start + 1 === editedIndex ? middleHeight : 8 },
      { id: 'n' + (start + 2), kind: 'rotate', parent: ref(start + 1), axis: 'z', angle, pivot },
    );
  }
  assert.deepEqual(doc, { ...source, nodes, nextId: 11, outputs: { b1: ref(1), b4: ref(4), b7: ref(7), b10: ref(10) } });
  const native = await f.inspect(label, doc);
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key).sort(), [...keys].sort());
  assert.deepEqual(native.map(body => body.id).sort(), keys.map(key => 'n' + key.slice(1)).sort());
  const observations = [];
  for (const [index, key] of keys.entries()) {
    const angle = angles[index];
    const height = key === 'b7' ? middleHeight : 8;
    const body = native.find(body => body.id === 'n' + key.slice(1));
    assert.equal(body.valid, true);
    assert.equal(body.count, 1);
    const center = rotate([52, 13, height / 2], angle);
    for (const result of [body.mass, bodies.find(body => body.key === key)]) {
      assert.ok(Math.abs(result.volume - 24 * height) <= 1e-7, JSON.stringify(result));
      assert.ok(distance(result.centroid, center) <= 1e-9, JSON.stringify(result));
    }
    const corners = [50, 54].flatMap(x => [10, 16].flatMap(y => [0, height].map(z => rotate([x, y, z], angle))));
    assert.equal(body.points.length, 8);
    for (const point of body.points) {
      const index = corners.findIndex(corner => distance(corner, point) <= 1e-9);
      assert.ok(index >= 0, JSON.stringify(point));
      corners.splice(index, 1);
    }
    assert.deepEqual(corners, []);
    observations.push({ key, angle, height, volume: body.mass.volume, centroid: body.mass.centroid });
  }
  f.report.observations.push({ label, bodies: observations });
}

async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  if (await field(versions(), 'Project').isVisible()) return;
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await field(versions(), 'Project').waitFor();
}

async function editCopy(before, height, label) {
  await f.openFeatureEditor(editedIndex, label);
  const input = field(f.editor(), 'Distance');
  assert.equal(await input.inputValue(), String(before.nodes[editedIndex].height));
  await input.fill(String(height));
  await f.applyEditor(before, label);
  const doc = await f.doc();
  await checkCopies(label, doc, height);
  return doc;
}

await f.run(async () => {
  f.phase = 'create four separate Z-pattern bodies';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await f.page.locator('.outliner .ol-row > button.ol').click();
  await clickModelCommand(f.page, 'Pattern', 'Circular pattern');
  const hud = f.page.getByRole('dialog', { name: 'Circular pattern', exact: true });
  assert.equal(await field(hud, 'Axis').inputValue(), 'z');
  await field(hud, 'Count').fill('4');
  await field(hud, 'Spread over').fill('120');
  await field(hud, 'Axis at X').fill('12');
  await field(hud, 'Axis at Y').fill('4');
  await field(hud, 'Result').selectOption('separate');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  await button(hud, 'Apply').click();
  await hud.waitFor({ state: 'hidden' });
  await f.changed(source);
  const created = await f.doc();
  await checkCopies('created-four', created, 8);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot('01-four-separate');

  const edited = await editCopy(created, 10, '02-middle-copy-height-10');
  await f.openFeatureEditor(editedIndex, 'zero distance refusal');
  await field(f.editor(), 'Distance').fill('0');
  await button(f.editor(), 'Apply').click();
  await f.editor().locator('summary').getByText('Kernel detail', { exact: true }).click();
  await f.editor().getByText(/height must not be zero/i).waitFor();
  await f.same(edited);
  await checkCopies('retained-four', edited, 10);
  await f.snapshot('03-zero-height-refused');
  await f.closeEditor();
  await f.undo();
  await f.same(created);
  await f.redo();
  await f.same(edited);

  f.phase = 'save and reopen four independently editable outputs';
  await openProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await field(f.page, 'Unsaved changes').waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), edited);
  await button(versions(), 'Close project').click();
  await field(versions(), 'Project').waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(edited);
  await checkCopies('reopened-four', edited, 10);
  f.report.observations.push({ label: 'pattern-project-readback', bytes: bytes.length, sha256: sha256(bytes) });
  await editCopy(edited, 12, '04-reopened-middle-copy-height-12');
  assert.deepEqual(f.report.downloads, []);
});
