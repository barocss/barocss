import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/secondary-outline-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/app/sketchControls.ts',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'packages/barocss-cad-model/src/sketch/loops.ts',
  'packages/barocss-cad-model/src/sketch/reopen.ts',
  'packages/barocss-cad-model/src/sketch/internal/regionLengths.ts',
  'packages/barocss-cad-model/src/sketch/driven.ts',
  'packages/barocss-cad-model/src/engine/doc.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
];
const f = await createFlow({
  name: 'secondary-outline', output: process.argv[2], envFrozen: 'D1096_SOURCE_FROZEN',
  qualification: 'Persist and re-edit a Length on a second material outline.',
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const outputs = partSnapshot(doc).outputs;
assert.ok(outputs.length);
console.log(JSON.stringify(outputs.map(body => ({ valid: checkBrep(body.brep, { strict: true }).valid,
  volume: massPropertiesOf(body).volume, faces: body.brep.faces.map(face => face.name) }))));
`,
});
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const file = 'Untitled.bcad', project = 'D1096 two outlines';

async function save(expected) {
  await button(f.page, 'Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(panel, 'Project in this browser').click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, file]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, [project, file]));
  assert.deepEqual(JSON.parse(bytes), expected);
  f.report.files.push({ bytes: bytes.length, sha256: sha256(bytes) });
  return bytes;
}
async function open(bytes, expected) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
  await f.same(expected);
}
function expectOutlines(sketch, width) {
  assert.deepEqual(sketch.min, [12, 12]);
  assert.deepEqual(sketch.max, [32, 26]);
  assert.deepEqual(sketch.regions[0].map(s => s.start), [[45, 15], [45 + width, 15], [45 + width, 30], [45, 30]]);
}
async function checkSolid(label, doc, total) {
  const native = await f.inspect(label, doc);
  assert.ok(native.every(body => body.valid));
  const volume = native.reduce((sum, body) => sum + body.volume, 0);
  assert.ok(Math.abs(volume - total) < 1e-7, JSON.stringify(native));
  f.report.observations.push({ label, volume, bodies: native.length, faces: native.flatMap(body => body.faces) });
  return native;
}

await f.run(async () => {
  await f.newPage();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await button(f.page.getByLabel('Mode', { exact: true }), 'Sketch').click();
  await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
  const points = [[12, 12], [32, 26], [45, 15], [65, 30]];
  await f.frame(points);
  for (const point of points) await f.worldClick(point);
  await f.tool('Select', 's');
  const length = () => f.sketchPanel().getByLabel('Edge 1 length', { exact: true });
  await length().fill('24');
  assert.equal(await length().inputValue(), '24');
  assert.equal(await length().evaluate(el => el.classList.contains('locked')), true);
  await f.same(empty);
  const authored = (await f.finishSketch('01-two-outlines')).doc;
  expectOutlines(authored.nodes[0], 24);
  await f.openExtrudeHud();
  const solid = (await f.applyExtrude({ distance: 2, previous: authored, label: '02-two-outlines' })).doc;
  const before = await checkSolid('before-native', solid, 1280);
  await open(await save(solid), solid);
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  f.phase = 'restore the second authored length and its editing target after Save and Open';
  await f.snapshot('03-reopened');
  const outline = f.sketchPanel().getByLabel('Active outline', { exact: true });
  assert.equal(await outline.count(), 1);
  await outline.selectOption('1');
  assert.equal(await length().inputValue(), '24');
  assert.equal(await length().evaluate(el => el.classList.contains('locked')), true);
  await length().fill('26');
  assert.equal(await length().inputValue(), '26');
  f.phase = 'undo and redo the parked outline while the main outline is active';
  await outline.selectOption('0');
  await f.undo();
  assert.equal(await outline.inputValue(), '0');
  await outline.selectOption('1');
  assert.equal(await length().inputValue(), '24');
  await outline.selectOption('0');
  await f.redo();
  assert.equal(await outline.inputValue(), '0');
  await outline.selectOption('1');
  assert.equal(await length().inputValue(), '26');
  const edited = (await f.finishSketch('04-second-length-edited')).doc;
  expectOutlines(edited.nodes[0], 26);
  assert.deepEqual(edited.nodes[0].sideTags, solid.nodes[0].sideTags);
  assert.deepEqual(edited.nodes[1], solid.nodes[1]);
  const after = await checkSolid('after-native', edited, 1340);
  assert.deepEqual(after.map(body => body.faces), before.map(body => body.faces));
  await f.undo();
  await f.same(solid);
  await f.redo();
  await f.same(edited);
  await open(await save(edited), edited);
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().getByLabel('Active outline', { exact: true }).selectOption('1');
  assert.equal(await length().inputValue(), '26');
  assert.equal(await length().evaluate(el => el.classList.contains('locked')), true);
  await f.snapshot('05-reopened-edited-length');
});
