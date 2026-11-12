import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/midpoint-sketch-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/midpointSketch.ts',
  'apps/cad-studio/src/sketch/useMidpointSketch.ts',
  'apps/cad-studio/src/ui/MidpointSketchReview.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/engine/client.ts',
  'apps/cad-studio/src/engine/engine.worker.ts',
  'packages/barocss-cad-model/src/engine/mesh.ts',
  'packages/barocss-cad-model/src/app/nativeMidpointPlane.ts',
];
const f = await createFlow({
  name: 'midpoint-sketch', envFrozen: 'D862_SOURCE_FROZEN', output: process.argv[2],
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Review two native face picks, then draw and extrude on their independent midpoint plane.',
  limits: ['Fractional axial desktop stock. The native model tests cover oblique and invalid support separately.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
    review: document.querySelector('[aria-label="Midpoint sketch"]')?.textContent ?? null,
    plane: document.querySelector('select[aria-label="Sketch plane"]')?.value ?? null,
  }),
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = evaluateCadPart(toPartDocument(doc));
console.log(JSON.stringify(result.outputs.map(output => ({
  id: output.id, valid: checkOutput(output).valid, volume: massPropertiesOf(output).volume,
  corners: output.brep.vertices.map(vertex => vertex.point),
}))));
`,
});
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20], id: 'n0' },
    { kind: 'extrude', sketch: 0, from: 2.0002, height: 8.0004, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const other = { ...seed, nodes: [seed.nodes[0], { ...seed.nodes[1], from: 12.0002 }] };
const midpoint = 6.0004, normal = [0, 0, 1], xAxis = [1, 0, 0];
const faces = { Top: [12, 9, 10.0006], Bottom: [24, 11, 2.0002], Front: [16, 0, midpoint] };
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const review = () => f.page.getByRole('complementary', { name: 'Midpoint sketch', exact: true });
const pickState = () => f.page.evaluate(() => window.__studioSelection.selection);
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const close = (actual, expected) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);

function holdRead() {
  const worker = Worker.prototype, send = worker.postMessage;
  const onmessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  let armed, target, held, deliver;
  worker.postMessage = function (request, ...args) {
    if (armed && request.type === 'midpointPlane') {
      armed = false;
      target = { worker: this, id: request.id };
    }
    return Reflect.apply(send, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onmessage.get,
    set(callback) {
      onmessage.set.call(this, callback && function (event) {
        if (target?.worker === this && target.id === event.data?.id) {
          held = event.data;
          deliver = () => callback.call(this, event);
          target = undefined;
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__midpointDriver = {
    arm() { armed = true; held = undefined; },
    held: () => held,
    release() { deliver(); deliver = undefined; },
  };
}

async function open(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

async function clickWorld(point, additive = false) {
  const pixel = await f.page.evaluate(point => {
    const xy = window.__studioScreenOf(point);
    return xy && document.elementFromPoint(...xy)?.closest('.vp-canvas') ? xy : null;
  }, point);
  assert.ok(pixel, JSON.stringify(point));
  if (additive) await f.page.keyboard.down('Shift');
  try {
    await f.page.mouse.move(...pixel);
    await f.page.mouse.click(...pixel);
  } finally {
    if (additive) await f.page.keyboard.up('Shift');
  }
}

async function pick(view, additive = false, point = faces[view]) {
  await button(f.page, 'View cube directions').click();
  await f.page.getByRole('menuitem', { name: view, exact: true }).click();
  await f.page.waitForFunction(name => {
    const labels = [...document.querySelectorAll('.view-cube .vc-label')];
    return labels.length === 1 && labels[0].textContent === name;
  }, view.toUpperCase());
  await clickWorld(point, additive);
  await f.page.waitForFunction(count => window.__studioSelection.selection.faces.length === count, additive ? 2 : 1);
}

async function launch() {
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Sketch at midpoint');
}

async function readyReview() {
  await launch();
  await review().getByText('Independent plane snapshot', { exact: true }).waitFor();
  assert.match(await review().innerText(), /Origin \(mm\) · 0, 0, 6\.0004/);
  assert.match(await review().innerText(), /Normal · 0, 0, 1/);
}

function unchanged(actual, previous) {
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty']) assert.deepEqual(actual[key], previous[key], key);
  assert.deepEqual(actual.selection.selection, previous.selection.selection);
}

async function pending() {
  await f.page.evaluate(() => window.__midpointDriver.arm());
  await launch();
  await review().getByRole('status').getByText('Checking the two faces…').waitFor();
  assert.equal(await button(review(), 'Start sketch').isDisabled(), true);
  await f.page.waitForFunction(() => window.__midpointDriver.held()?.plane);
}

async function releaseWithoutSketch() {
  await f.page.evaluate(async () => {
    window.__midpointDriver.release();
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  assert.equal(await review().isVisible(), false);
  assert.equal(await f.sketchPanel().isVisible(), false);
}

function checkSketch(doc, width = 6) {
  const sketch = doc.nodes[2];
  assert.equal(sketch.kind, 'sketch');
  assert.equal(sketch.association, undefined);
  assert.equal(sketch.on, undefined);
  assert.deepEqual(sketch.plane.normal, normal);
  assert.deepEqual(sketch.plane.xAxis, xAxis);
  close(sketch.plane.origin[2], midpoint);
  if (width === 6) {
    assert.deepEqual(sketch.min, [-12, 5]);
    assert.deepEqual(sketch.max, [-6, 9]);
  } else {
    assert.deepEqual(sketch.outline.lengths, { 0: width });
    const points = sketch.outline.points;
    assert.equal(points.length, 4);
    const expected = [[-12, 5], [-12 + width, 5], [-12 + width, 9], [-12, 9]];
    points.forEach(([x, y], index) => { close(x, expected[index][0]); close(y, expected[index][1]); });
  }
}

async function verify(label, doc, start = 2.0002, width = 6) {
  await f.same(doc);
  checkSketch(doc, width);
  const native = await f.inspect(label, doc);
  const stock = native.find(body => body.id === 'n1'), solid = native.find(body => body.id === 'n3');
  assert.ok(stock.valid && solid.valid && solid.corners.length === 8);
  close(Math.min(...stock.corners.map(point => point[2])), start);
  close(solid.volume, width * 4 * 3);
  for (const z of [midpoint, midpoint + 3]) {
    for (const x of [-12, -12 + width]) {
      for (const y of [5, 9]) assert.ok(solid.corners.some(point => Math.hypot(point[0] - x, point[1] - y, point[2] - z) < 1e-9));
    }
  }
  f.report.observations.push({ label, sourceMinZ: start, sketch: doc.nodes[2], solid });
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
    await context.addInitScript(holdRead);
    return context;
  };
  const name = 'D862-midpoint.bcad';
  await f.newPage();
  const starter = await f.doc();
  await open(name, seed);
  const ortho = button(f.page, 'Ortho');
  if (await ortho.getAttribute('aria-pressed') !== 'true') await ortho.click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();

  f.phase = 'one face refuses midpoint and still starts ordinary face Sketch';
  await pick('Top');
  const single = await f.snapshot('01-one-face');
  await launch();
  await f.waitToast(/select two distinct native planar faces/i);
  unchanged(await f.snapshot('02-incomplete-refusal'), single);
  await f.dismissToasts();
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().getByText(/on face/).waitFor();
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(seed);

  f.phase = 'nonparallel native pair refuses without replacing accepted state';
  await pick('Top');
  await pick('Front', true);
  const nonparallel = await f.snapshot('03-nonparallel-pair');
  await launch();
  await f.waitToast(/parallel/i);
  await review().waitFor({ state: 'hidden' });
  unchanged(await f.snapshot('04-nonparallel-refusal'), nonparallel);
  await f.dismissToasts();

  f.phase = 'hold a valid reply and cancel from the review';
  await pick('Top');
  await pick('Bottom', true);
  const forward = await f.snapshot('05-before-review');
  await pending();
  await button(review(), 'Cancel').click();
  await releaseWithoutSketch();
  unchanged(await f.snapshot('06-cancelled-pending'), forward);

  f.phase = 'hold a valid reply and change the face selection';
  await pending();
  await pick('Top');
  await releaseWithoutSketch();
  assert.equal((await pickState()).faces.length, 1);
  await f.same(seed);

  f.phase = 'hold a valid reply across Undo of Open';
  await pick('Bottom', true);
  await pending();
  await f.undo();
  await releaseWithoutSketch();
  await f.same(starter);
  await f.snapshot('08-undo-retired');
  await f.redo();
  await f.same(seed);

  f.phase = 'STEP review retires a held midpoint reply';
  await pick('Top');
  await pick('Bottom', true);
  const beforeStep = await f.snapshot('08a-before-step');
  await pending();
  await button(f.page, 'Export STEP').click();
  const step = f.page.getByRole('region', { name: 'STEP export', exact: true });
  await step.waitFor();
  await releaseWithoutSketch();
  await button(step, 'Cancel').click();
  await step.waitFor({ state: 'hidden' });
  unchanged(await f.snapshot('08b-step-retired-midpoint'), beforeStep);

  f.phase = 'hold a valid reply across same-ID replacement Open';
  await pending();
  await open(name, other);
  await releaseWithoutSketch();
  await f.same(other);
  await open(name, seed);

  f.phase = 'review both pick orders and distinct canvas click locations';
  await pick('Top', false, [28, 12, 10.0006]);
  await pick('Bottom', true);
  await readyReview();
  const forwardReview = await f.snapshot('09-forward-review');
  assert.match(forwardReview.review, /n1.top · n1.bottom/);
  await f.page.keyboard.down('Escape');
  await f.page.keyboard.down('Escape');
  await f.page.keyboard.up('Escape');
  await review().waitFor({ state: 'hidden' });
  assert.equal((await pickState()).faces.length, 2);
  await pick('Bottom', false, [15, 8, 2.0002]);
  await pick('Top', true);
  await readyReview();
  const reversed = await f.snapshot('10-reversed-review');
  assert.match(reversed.review, /n1.bottom · n1.top/);
  assert.deepEqual(reversed.doc, seed);
  await button(review(), 'Start sketch').click();
  await f.sketchPanel().waitFor();
  assert.equal(await f.page.getByLabel('Sketch plane', { exact: true }).inputValue(), 'midpoint');
  await f.same(seed);
  await f.snapshot('11-independent-active-sketch');

  f.phase = 'finish 6 by 4 profile and extrude along positive Z';
  await clickWorld([-12, 5, midpoint]);
  await clickWorld([-6, 9, midpoint]);
  const finished = await f.finishSketch('12-finished');
  checkSketch(finished.doc);
  await f.openExtrudeHud();
  const extruded = await f.applyExtrude({ distance: 3, previous: finished.doc, label: '13-extruded' });
  assert.deepEqual(extruded.doc.nodes[3], { kind: 'extrude', sketch: 2, height: 3, id: 'n3' });
  await verify('independent-72mm3', extruded.doc);
  await f.undo();
  await f.same(finished.doc);
  await f.redo();
  await f.same(extruded.doc);

  f.phase = 'move the source caps and keep the original sketch plane';
  await f.openFeatureEditor(1, 'Edit source depth');
  await f.editor().getByLabel('Start Z', { exact: true }).fill('12.0002');
  await button(f.editor(), 'Apply').click();
  await f.changed(extruded.doc);
  await f.closeEditor();
  const changed = await f.doc();
  assert.deepEqual(changed.nodes.slice(2), extruded.doc.nodes.slice(2));
  await verify('source-caps-moved', changed, 12.0002);

  f.phase = 'save the current snapshot to project and read the native file';
  const project = 'D862 midpoint ' + randomUUID();
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    const saved = await (await folder.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await saved.arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), changed);
  const saved = join(f.output, 'saved-midpoint.bcad');
  await writeFile(saved, bytes);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });

  await f.freshOpen(saved, changed, '14-fresh-open');
  await verify('fresh-open', changed, 12.0002);
  await f.openFeatureEditor(3, 'Reopen midpoint rectangle from Extrude');
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  const edge = f.sketchPanel().getByLabel('Edge 1 length', { exact: true });
  assert.equal(Number(await edge.inputValue()), 6);
  await edge.fill('7');
  await edge.press('Enter');
  const reedited = await f.finishSketch('15-reedited');
  assert.deepEqual(reedited.doc.nodes[2].sideTags, changed.nodes[2].sideTags);
  assert.deepEqual(reedited.doc.nodes[3], changed.nodes[3]);
  await verify('reopened-width-7', reedited.doc, 12.0002, 7);
  await f.undo();
  await f.same(changed);
  await f.redo();
  await f.same(reedited.doc);
  assert.deepEqual(f.report.downloads, []);
});
