import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/revolve-axis-diameter-boundary-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/engine/migrate.ts',
  'packages/barocss-cad-model/src/engine/container.ts',
  'packages/barocss-cad-model/src/sketch/rules.ts',
  'packages/barocss-cad-model/src/sketch/terms.ts',
];
const f = await createFlow({
  name: 'revolve-axis-diameter-boundary', envFrozen: 'D866_SOURCE_FROZEN', output: process.argv[2],
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Measure the existing radial profile edit, full Revolve and native saved-rule admission.',
  limits: ['One ordinary positive local-Y meridian in actual Studio, and one synthetic unsupported outline rule.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { readStudioDoc } from '@barocss/cad-model/engine/migrate';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
import { constraintEntries, solveShape } from '@barocss/cad-model/sketch/rules';
const text = readFileSync(process.argv[2], 'utf8'), read = readStudioDoc(text);
if ('error' in read) throw Error(read.error);
const { doc } = read, outputs = evaluateCadPart(toPartDocument(doc)).outputs;
const sketch = doc.nodes[0], { shape } = sketch.kind === 'sketch' ? sketchShapes(sketch) : { shape: null };
const outline = shape?.kind === 'polygon' ? {
  rules: shape.rules ?? [], rank: solveShape(shape).rank, rows: constraintEntries(shape).map(entry => entry.label),
} : null;
console.log(JSON.stringify({
  sketch, outline, outputs: outputs.map(output => ({
    id: output.id, valid: checkOutput(output).valid, mass: massPropertiesOf(output),
    cylinders: output.brep.faces.map(face => faceGeometry(face)).filter(geometry => geometry.kind === 'cylinder'),
  })),
}));
`,
});
const blank = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const fileName = 'D866-revolve-meridian.bcad';
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const near = (a, b, tolerance = 1e-8) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
const revolver = () => f.page.getByRole('dialog', { name: 'Revolve', exact: true });

async function open(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

async function inspect(label, doc, radius) {
  await f.same(doc);
  const read = await f.inspect(label, doc);
  assert.equal(read.outputs.length, 1);
  const [solid] = read.outputs;
  assert.equal(solid.id, 'n1');
  assert.equal(solid.valid, true);
  assert.ok(solid.cylinders.length);
  for (const cylinder of solid.cylinders) {
    near(cylinder.r, radius);
    near(Math.abs(cylinder.a[1]), 1);
    near(Math.hypot(cylinder.a[0], cylinder.a[2]), 0);
  }
  near(solid.mass.volume, Math.PI * radius * radius * 20, 1e-7);
  near(solid.mass.centroid[0], 0);
  near(solid.mass.centroid[1], 10);
  near(solid.mass.centroid[2], 0);
  near((await f.bodies()).bodies[0].volume, solid.mass.volume, 1e-7);
  assert.deepEqual(doc.nodes[1], { kind: 'revolve', sketch: 0, axis: 'y', angle: 360, id: 'n1' });
  f.report.observations.push({ label, radius, independentVolume: Math.PI * radius * radius * 20, ...read });
  return read;
}

async function reopen() {
  await f.openFeatureEditor(1, 'Reopen Revolve meridian');
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  return f.sketchPanel().getByLabel('Edge 1 length', { exact: true });
}

async function editRadius(before, from, to, label) {
  const radius = await reopen();
  assert.equal(Number(await radius.inputValue()), from);
  await radius.fill(String(to));
  await radius.press('Enter');
  await f.same(before);
  const state = await f.finishSketch(label), sketch = state.doc.nodes[0];
  assert.deepEqual(sketch.sideTags, before.nodes[0].sideTags);
  assert.equal(sketch.outline.lengths[0], to);
  assert.deepEqual(sketch.outline.points, [[0, 0], [to, 0], [to, 20], [0, 20]]);
  return state.doc;
}

async function save(doc) {
  const project = 'D866 revolve ' + randomUUID();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  if (!(await versions.isVisible())) await button(f.page, 'Project and versions').click();
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions, 'Project in this browser').click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(fileName, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    const file = await (await folder.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, fileName]));
  assert.deepEqual(JSON.parse(bytes), doc);
  const path = join(f.output, 'saved-meridian.bcad');
  await writeFile(path, bytes);
  f.report.files.push({ bytes: bytes.length, sha256: sha256(bytes) });
  return path;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  await open(fileName, blank);

  f.phase = 'create an ordinary fractional meridian on the local Y axis';
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Rectangle', 'r');
  await f.frame([[0, 0], [6, 20]]);
  await f.worldClick([0, 0]);
  await f.worldClick([6, 20]);
  await f.sketchPanel().getByLabel(/Width/).fill('6.0003');
  const meridian = await f.finishSketch('01-fractional-meridian');
  assert.deepEqual(meridian.doc.nodes[0].min, [0, 0]);
  assert.deepEqual(meridian.doc.nodes[0].max, [6.0003, 20]);

  f.phase = 'run the actual full Revolve command on sketch Y';
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Revolve');
  await revolver().waitFor();
  assert.equal(await revolver().getByLabel('Axis', { exact: true }).inputValue(), 'y');
  assert.equal(Number(await revolver().getByLabel('Angle', { exact: true }).inputValue()), 360);
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  await button(revolver(), 'Apply').click();
  await f.changed(meridian.doc);
  await revolver().waitFor({ state: 'hidden' });
  const initial = (await f.snapshot('02-full-revolve')).doc;
  await inspect('fractional-radius', initial, 6.0003);

  f.phase = 'change existing radial edge length from 6.0003 to 7 mm';
  const atSeven = await editRadius(initial, 6.0003, 7, '03-radial-edge-7');
  const seven = await inspect('radius-7', atSeven, 7);
  await f.undo();
  await f.same(initial);
  await f.redo();
  await f.same(atSeven);

  const saved = await save(atSeven);
  await f.freshOpen(saved, atSeven, '04-saved-fresh-open');
  const atEight = await editRadius(atSeven, 7, 8, '05-radial-edge-8');
  await inspect('radius-8-reopened', atEight, 8);

  f.phase = 'measure current admission of a synthetic explicit axis diameter rule';
  const hypothetical = structuredClone(atSeven), rule = { kind: 'axis-diameter', axis: 'y', point: 1, side: 1, value: 18 };
  hypothetical.nodes[0].outline.rules = [...(hypothetical.nodes[0].outline.rules ?? []), rule];
  await open('D866-synthetic-axis-diameter.bcad', hypothetical);
  const admitted = await inspect('inert-axis-diameter', hypothetical, 7);
  assert.deepEqual(admitted.sketch.outline.rules.at(-1), rule);
  assert.deepEqual(admitted.outline.rows, seven.outline.rows);
  assert.equal(admitted.outline.rank, seven.outline.rank);
  assert.deepEqual(admitted.outputs, seven.outputs);
  const field = await reopen();
  assert.equal(Number(await field.inputValue()), 7);
  const unsupported = await f.snapshot('06-inert-rule-opens');
  assert.doesNotMatch(unsupported.sketchPanel, /axis diameter/i);
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(hypothetical);
  assert.deepEqual(f.report.downloads, []);
});
