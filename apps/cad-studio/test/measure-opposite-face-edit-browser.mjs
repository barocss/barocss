import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pin = process.argv[3] === '--pin';
const pins = [
  'apps/cad-studio/test/measure-opposite-face-edit-browser.mjs',
  'apps/cad-studio/test/model-rail-helper.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/MeasurementInspector.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'packages/barocss-cad-model/src/app/measure.ts',
  ...(pin ? ['apps/cad-studio/src/app/pinnedFaceMeasure.ts'] : []),
];
const f = await createFlow({
  name: 'measure-opposite-face-edit', output: process.argv[2], envFrozen: pin ? 'D928_SOURCE_FROZEN' : 'D927_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: pin ? 'Pin one opposite native cap pair through editing, history and document replacement.' : 'Re-pick the two native planar caps after a numeric feature edit, Undo, Redo and File Open.',
  limits: ['One rectangular Extrude in default XY. Only one explicit cap pair per document session.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
    pinned: document.querySelector('[aria-label="Pinned measurement"]')?.textContent ?? null,
    measure: document.querySelector('[aria-label="Measurement"]')?.textContent ?? null,
    overlay: window.__studioOverlayTexts?.()['measure:label'] ?? [],
  }),
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { toPartDocument } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [body] = evaluateCadPart(toPartDocument(doc)).outputs;
console.log(JSON.stringify({
  valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume,
  planes: body.brep.faces.filter(face => face.name === 'n1.top' || face.name === 'n1.bottom')
    .map(({ name, surface }) => ({ name, surface })),
  corners: body.brep.vertices.map(vertex => vertex.point),
}));
`,
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 12], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Measurement', exact: true });
const pinnedPanel = () => f.page.getByRole('complementary', { name: 'Pinned measurement', exact: true });
const metric = label => panel().locator('.kv').filter({ hasText: new RegExp('^' + label + '\\b') }).locator('b');
async function open(name, doc) {
  const buffer = Buffer.from(JSON.stringify(doc));
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer });
  await f.same(doc);
  f.report.observations.push({ label: name, sha256: sha256(buffer) });
}
async function cap(side, height) {
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: side, exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.locator('.view-cube .vc-label').getByText(side.toUpperCase(), { exact: true }).waitFor();
  await f.page.waitForFunction(([side, height]) => {
    const eye = window.__studioEye?.();
    return eye && (side === 'Top' ? eye[2] > height : eye[2] < 0);
  }, [side, height]);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const world = [10, 6, side === 'Top' ? height : 0];
  const pixel = await f.page.evaluate(world => window.__studioScreenOf(world), world);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.click(...pixel);
}
async function check(label, height, reverse = false, keep = false) {
  f.phase = 'measure ' + label;
  const before = await f.snapshot(label + '-before');
  const raw = await f.inspect(label + '-native', before.doc);
  assert.equal(raw.valid, true);
  assert.deepEqual(raw.planes.map(face => face.name).sort(), ['n1.bottom', 'n1.top']);
  assert.equal(raw.corners.length, 8);
  assert.deepEqual([...new Set(raw.corners.map(point => point[2]))].sort((a, b) => a - b), [0, height]);
  assert.ok(Math.abs(raw.volume - 240 * height) < 1e-8);
  await clickModelCommand(f.page, 'Inspect', 'Measure');
  await panel().waitFor();
  assert.equal(await panel().locator('.measure-item').count(), 0);
  await cap(reverse ? 'Bottom' : 'Top', height);
  await panel().getByText('Planar face', { exact: true }).waitFor();
  await cap(reverse ? 'Top' : 'Bottom', height);
  await panel().getByText('BETWEEN', { exact: true }).waitFor();
  assert.deepEqual(await metric('Area').allTextContents(), ['240 mm²', '240 mm²']);
  assert.equal(await metric('Distance').innerText(), height + ' mm');
  assert.equal(await metric('Normal distance').innerText(), height + ' mm');
  assert.equal(await metric('Angle').innerText(), '0°');
  assert.deepEqual((await metric('ΔX ΔY ΔZ').innerText()).split(', ').map(Number), [0, 0, reverse ? height : -height]);
  await f.page.waitForFunction(height => window.__studioOverlayTexts?.()['measure:label']?.includes(height + ' mm'), height);
  const current = await f.snapshot(label);
  for (const field of ['doc', 'bodies', 'history', 'controls', 'dirty']) assert.deepEqual(current[field], before[field], field);
  f.report.observations.push({ label, heightMM: height, nativeVolumeMM3: raw.volume, measurement: current.measure, overlay: current.overlay });
  if (keep) {
    await button('Pin measurement').click();
    await panel().waitFor({ state: 'hidden' });
    const pinned = await checkPin(label + '-pinned', height);
    for (const field of ['doc', 'bodies', 'history', 'controls', 'dirty']) assert.deepEqual(pinned[field], before[field], field);
    return;
  }
  await button('Done measuring').click();
  await panel().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
}

async function checkPin(label, height) {
  await pinnedPanel().getByText(height + ' mm', { exact: true }).waitFor();
  await f.page.waitForFunction(height => window.__studioOverlayTexts?.()['measure:label']?.includes(height + ' mm'), height);
  const snapshot = await f.snapshot(label);
  assert.equal(snapshot.measure, null);
  assert.ok(Math.abs(snapshot.bodies.bodies[0].volume - 240 * height) < 1e-8);
  f.report.observations.push({ label, pinnedMM: height, volumeMM3: snapshot.bodies.bodies[0].volume });
  return snapshot;
}

async function pinFlow() {
  await check('01-original-8', 8, false, true);
  f.phase = 'select a face independently of the pinned measurement';
  await cap('Top', 8);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.faces.length === 1);
  const selected = await checkPin('03-independent-selection', 8);
  assert.equal(selected.selection.selection.faces.length, 1);
  await f.page.keyboard.press('Escape');
  await f.page.waitForFunction(() => window.__studioSelection?.selection.faces.length === 0);
  await checkPin('04-selection-cleared', 8);

  f.phase = 'edit the accepted extrusion while the measure is pinned';
  await f.openFeatureEditor(1, 'Extrude');
  const distance = f.editor().getByLabel('Distance', { exact: true });
  await distance.fill('13.25');
  const edited = await f.applyEditor(source, '05-apply-distance');
  assert.equal(edited.doc.nodes[1].height, 13.25);
  await checkPin('06-pin-after-edit', 13.25);
  await f.closeEditor();

  await f.undo();
  await f.same(source);
  await checkPin('07-pin-after-undo', 8);
  await f.redo();
  await f.same(edited.doc);
  await checkPin('08-pin-after-redo', 13.25);

  f.phase = 'hide the pinned body and restore it without a stale readout';
  await button('Hide body').click();
  await pinnedPanel().getByRole('status').getByText('Measurement unavailable.', { exact: true }).waitFor();
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  await f.snapshot('09-hidden-pin-unavailable');
  await f.undo();
  await f.same(edited.doc);
  await checkPin('10-pin-visible-after-undo', 13.25);

  f.phase = 'clear the readout without changing the working document';
  await pinnedPanel().getByRole('button', { name: 'Clear pinned measurement', exact: true }).click();
  await pinnedPanel().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  await f.same(edited.doc);
  await check('11-repick-13-25', 13.25, true, true);

  f.phase = 'replace the part by File Open with the same feature IDs';
  await open('D928-same-ids', source);
  await pinnedPanel().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  await f.snapshot('12-file-open-clears');
  await check('13-ordinary-measure-after-open', 8);
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
  await open(pin ? 'D928-original' : 'D927-original', source);
  if (pin) { await pinFlow(); assert.deepEqual(f.report.downloads, []); return; }
  await check('01-original-8', 8);
  f.phase = 'change the existing Extrude distance through History';
  await f.openFeatureEditor(1, 'Extrude');
  await f.editor().getByLabel('Distance', { exact: true }).fill('13.25');
  const edited = await f.applyEditor(source, '02-edited');
  assert.equal(edited.doc.nodes[1].height, 13.25);
  assert.deepEqual(edited.doc.outputs, source.outputs);
  await f.closeEditor();
  await check('03-edited-13-25', 13.25, true);
  await f.undo();
  await f.same(source);
  await check('04-undo-8', 8);
  await f.redo();
  await f.same(edited.doc);
  await check('05-redo-13-25', 13.25);
  await f.newPage();
  await open('D927-replacement', edited.doc);
  await check('06-fresh-open-13-25', 13.25, true);
  assert.deepEqual(f.report.downloads, []);
});
