import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/saved-region-extrude-browser.mjs',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/files/documentFile.ts',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/regionExtrude.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
];
const f = await createFlow({
  name: 'saved-region-extrude', output: process.argv[2], envFrozen: 'D1132_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Open and edit a saved extrusion of one tagged region with a partial shared edge.',
  limits: ['Straight rectangles without holes or face attachment. Region creation through the viewport is outside this flow.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(output => ({
  id: output.id, valid: checkOutput(output).valid, ...massPropertiesOf(output),
  sides: output.brep.faces.map(face => face.name),
}))));
`,
});
const lines = points => points.map(start => ({ kind: 'line', start }));
const sketch = { kind: 'sketch', id: 'n0', profile: 'rectangle', min: [4, 6], max: [14, 16],
  regions: [lines([[14, 6], [24, 6], [24, 18], [14, 18]]), lines([[28, 6], [38, 6], [38, 18], [28, 18]])],
  sideTags: { outer: ['e1', 'e2', 'e3', 'e4'], regions: [['e5', 'e6', 'e7', 'e8'], ['e9', 'e10', 'e11', 'e12']] } };
const extrusion = { kind: 'region-extrude', id: 'n1', sketch: 0, sourceFeature: 'n0', height: 2,
  plane: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] },
  boundary: [{ side: 'e5', ends: [[14, 6], [24, 6]] }, { side: 'e6', ends: [[24, 6], [24, 18]] },
    { side: 'e7', ends: [[14, 18], [24, 18]] }, { side: 'e8', ends: [[14, 6], [14, 18]] }] };
const source = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [sketch, extrusion],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
const changed = { ...source, nodes: [sketch, { ...extrusion, height: 3 }] };
const bad = { ...source, nodes: [{ ...sketch, regions: [lines([[14, 6], [25, 6], [25, 18], [14, 18]]), sketch.regions[1]] }, extrusion] };
const zeroNormal = { ...extrusion.plane, normal: [0, 0, 0] };
const invalid = { ...source, nodes: [{ ...sketch, plane: zeroNormal }, { ...extrusion, plane: zeroNormal }] };
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const history = () => f.page.getByRole('group', { name: 'History', exact: true });
const filename = 'D1132-region-extrude.bcad';

async function open(doc, name = filename) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}

async function checkNative(label, doc, distance) {
  const results = await f.inspect(label, doc);
  assert.equal(results.length, 1);
  const [body] = results;
  assert.equal(body.id, 'n1');
  assert.equal(body.valid, true);
  assert.ok(Math.abs(body.volume - 120 * distance) < 1e-9);
  assert.ok(Math.hypot(body.centroid[0] - 19, body.centroid[1] - 12, body.centroid[2] - distance / 2) < 1e-9);
  assert.ok(body.sides.includes('n1.side[e8]'));
  return body;
}

await f.run(async () => {
  await f.newPage();
  f.phase = 'open the saved region extrusion';
  await open(source);
  await f.same(source);
  await f.snapshot('01-opened-region-extrusion');
  await checkNative('opened-native', source, 2);

  f.phase = 'refuse a stale saved boundary and preserve the current document';
  await open(bad, 'D1132-stale-source.bcad');
  await f.waitToast(/selected boundary changed/i);
  await f.same(source);
  await f.snapshot('02-stale-file-refusal');
  await f.dismissToasts();

  f.phase = 'refuse a matching boundary on an invalid native plane';
  await open(invalid, 'D1132-invalid-plane.bcad');
  await f.waitToast(/plane normal must not be zero/i);
  await f.same(source);
  await f.snapshot('03-native-refusal-preserves-source');
  await f.dismissToasts();

  f.phase = 'edit only the region distance';
  await button(history(), 'Extrude region 2').click();
  const field = f.editor().getByLabel('Distance', { exact: true });
  await field.fill('3');
  await f.applyEditor(source, '04-region-distance-3');
  await f.same(changed);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(changed);
  const native = await checkNative('edited-native', changed, 3);

  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const project = 'D1132 individual region ' + randomUUID();
  await button(f.page, 'Project and versions').click();
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions, 'Project in this browser').click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(filename, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, filename]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const root = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await root.getFileHandle(filename)).getFile()).arrayBuffer()));
  }, [project, filename]));
  assert.deepEqual(JSON.parse(bytes), changed);
  const saved = join(f.output, 'saved-region-extrude.bcad');
  await writeFile(saved, bytes);
  f.report.files.push({ name: filename, bytes: bytes.length, sha256: sha256(bytes) });
  await f.freshOpen(saved, changed, '05-fresh-open');
  assert.deepEqual(await checkNative('fresh-native', changed, 3), native);
  f.report.observations.push({ label: 'saved-region', fromHeightMM: 2, toHeightMM: 3, volumeMM3: native.volume, centroidMM: native.centroid });
  assert.deepEqual(f.report.downloads, []);
});
