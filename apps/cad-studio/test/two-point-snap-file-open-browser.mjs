import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/two-point-snap-file-open-browser.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/sketch/useTwoPointSnap.ts',
  'apps/cad-studio/src/sketch/TwoPointSnapControls.tsx',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/sketch/osnap.ts',
];
const f = await createFlow({
  name: 'two-point-snap-file-open', output: process.argv[2], envFrozen: 'D925_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Preserve a calculated rectangle point after a refused File Open and retire it after a successful File Open.',
  limits: ['One uncommitted XY construction in the source. One fresh XY sketch, one ordinary midpoint and one extrusion in the replacement.'],
  snapshotExtra: () => ({
    form: document.querySelector('form[aria-label="Two-point snap"]')?.textContent ?? null,
    marker: [...document.querySelectorAll('.vp-overlay .sk-osnap')].map(el => el.textContent),
    rectangle: ['x', 'y', 'width', 'height'].map(id => document.getElementById('sk-' + id)?.value ?? null),
    name: document.querySelector('.doc-tab input')?.value ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { toPartDocument } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(body => ({
  valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume,
  corners: body.brep.vertices.map(vertex => vertex.point),
}))));
`,
});
const button = (name, root = f.page) => root.getByRole('button', { name, exact: true });
const form = () => f.page.getByRole('form', { name: 'Two-point snap', exact: true });
const marker = () => f.page.locator('.vp-overlay .sk-osnap').filter({ hasText: 'Calculated' });
const doc = parameters => ({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters, nodes: [], outputs: {}, nextId: 0 });
const source = doc({ Source: 11 });
const replacement = doc({ Replacement: 22 });

async function open(name, text) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  const buffer = Buffer.from(text);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer });
  f.report.observations.push({ label: name, sha256: sha256(buffer) });
}
async function sketchLine(a, b, frame = [a, b]) {
  await button('Sketch', f.page.locator('.mode')).click();
  await f.sketchPanel().waitFor();
  await f.frame(frame);
  await f.tool('Line', 'l');
  await f.page.keyboard.press('x');
  await f.worldClick(a);
  await f.worldClick(b);
  await f.page.keyboard.press('x');
  await f.tool('Rectangle', 'r');
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
  await open('D925-source', JSON.stringify(source));
  await f.same(source);
  f.phase = 'calculate a source point without committing a sketch';
  await sketchLine([0, 0], [31, 13]);
  await button('Two-point snap', f.sketchPanel()).click();
  await f.worldClick([0, 0]);
  await f.worldClick([31, 13]);
  await form().getByLabel('Snap value', { exact: true }).fill('0.25');
  const point = form().getByRole('status').getByText('Point 7.75, 3.25 mm', { exact: true });
  await point.waitFor();
  await marker().waitFor();
  const pending = await f.snapshot('01-pending-source');
  assert.deepEqual(pending.doc, source);
  assert.equal(pending.name, 'D925-source');
  assert.equal(pending.dirty, false);
  assert.deepEqual(pending.rectangle, [null, null, null, null]);

  f.phase = 'malformed Open preserves the pending input';
  await open('D925-bad', '{');
  await f.waitToast(/Could not open this file.*Your part is unchanged/);
  await point.waitFor();
  await marker().waitFor();
  const refused = await f.snapshot('02-refused-retains-source');
  for (const field of ['doc', 'history', 'selection', 'name', 'dirty', 'form', 'marker', 'rectangle'])
    assert.deepEqual(refused[field], pending[field], field);
  await f.dismissToasts();

  f.phase = 'accepted Open retires the source snap and sketch';
  await open('D925-replacement', JSON.stringify(replacement));
  await f.same(replacement);
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await form().waitFor({ state: 'hidden' });
  await marker().waitFor({ state: 'hidden' });
  const opened = await f.snapshot('03-open-replacement');
  assert.equal(opened.name, 'D925-replacement');
  assert.equal(opened.dirty, false);
  assert.deepEqual(opened.history, []);
  assert.deepEqual(opened.rectangle, [null, null, null, null]);

  f.phase = 'new sketch consumes an ordinary midpoint and a separate second corner';
  await sketchLine([0, 0], [22, 10], [[0, 0], [22, 10], [18, 9]]);
  assert.equal(await form().count(), 0);
  assert.equal(await marker().count(), 0);
  const snapMarker = f.page.locator('.vp-overlay .sk-osnap').filter({ hasText: 'Middle' });
  await f.page.mouse.move(...await f.screenOf([11.06, 5.04]));
  await snapMarker.waitFor();
  await f.worldClick([11.06, 5.04]);
  const first = await f.snapshot('04-ordinary-midpoint');
  assert.deepEqual(first.doc, replacement);
  assert.deepEqual(first.rectangle.map(Number), [11, 5, 0, 0]);
  await f.worldClick([18, 9]);
  const finished = await f.finishSketch('05-new-sketch');
  assert.equal(finished.doc.nodes.length, 1);
  const sketch = finished.doc.nodes[0];
  assert.deepEqual([sketch.min, sketch.max], [[11, 5], [18, 9]]);
  assert.deepEqual(sketch.construction.map(shape => shape.points), [[[0, 0], [22, 10]]]);
  assert.equal(sketch.association, undefined);

  f.phase = 'extrude the new rectangle and verify its native corners and volume';
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: finished.doc, label: '06-extruded' });
  const expectedCorners = [11, 18].flatMap(x => [5, 9].flatMap(y => [0, 2].map(z => [x, y, z])));
  const native = await f.inspect('replacement-native', solid.doc);
  assert.equal(native.length, 1);
  assert.equal(native[0].valid, true);
  assert.equal(native[0].corners.length, 8);
  for (const p of expectedCorners) assert.equal(native[0].corners.filter(q => Math.hypot(...q.map((v, i) => v - p[i])) < 1e-8).length, 1, p);
  assert.ok(Math.abs(native[0].volume - 56) < 1e-8, native[0].volume);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 56) < 1e-8);
  f.report.observations.push({ label: 'native-geometry', actualVolumeMM3: native[0].volume, expectedVolumeMM3: 56, corners: 8 });

  f.phase = 'Undo and Redo keep the new document and ordinary sketch';
  await f.undo();
  await f.same(finished.doc);
  await f.undo();
  await f.same(replacement);
  await f.redo();
  await f.same(finished.doc);
  await f.redo();
  await f.same(solid.doc);
  assert.deepEqual(f.report.downloads, []);
});
