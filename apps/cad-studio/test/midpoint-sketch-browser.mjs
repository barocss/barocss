import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const oblique = process.argv[3] === '--oblique';
const admission = process.argv[3] === '--admission';
const ownership = process.argv[3] === '--selection-ownership';
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
  name: 'midpoint-sketch', envFrozen: ownership ? 'D889_SOURCE_FROZEN'
    : admission ? 'D888_SOURCE_FROZEN' : oblique ? 'D887_SOURCE_FROZEN' : 'D862_SOURCE_FROZEN', output: process.argv[2],
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Review two native face picks, then draw and extrude on their independent midpoint plane.',
  limits: [ownership ? 'Native, hidden, mixed, assembly and raw STL face selection on desktop.'
    : admission ? 'Two native stocks and a stored faceted mesh, with physical face selection on desktop.'
    : oblique ? 'Exact oblique native caps and a near-parallel refusal on desktop.'
    : 'Fractional axial desktop stock. The native model tests cover oblique and invalid support separately.'],
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

async function pick(view, additive = false, point = faces[view], count = additive ? 2 : 1) {
  await button(f.page, 'View cube directions').click();
  await f.page.getByRole('menuitem', { name: view, exact: true }).click();
  await f.page.waitForFunction(name => {
    const labels = [...document.querySelectorAll('.view-cube .vc-label')];
    return labels.length === 1 && labels[0].textContent === name;
  }, view.toUpperCase());
  await clickWorld(point, additive);
  await f.page.waitForFunction(count => window.__studioSelection.selection.faces.length === count, count);
}

async function launch() {
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Sketch at midpoint');
}

async function readyReview(origin = [0, 0, midpoint], direction = normal) {
  await launch();
  await review().getByText('Independent plane snapshot', { exact: true }).waitFor();
  await review().getByText('Origin (mm) · ' + origin.join(', '), { exact: true }).waitFor();
  await review().getByText('Normal · ' + direction.join(', '), { exact: true }).waitFor();
}

function unchanged(actual, previous) {
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty']) assert.deepEqual(actual[key], previous[key], key);
  assert.deepEqual(actual.selection.selection, previous.selection.selection);
}

async function refuseSelection(label, verifySelection) {
  const before = await f.snapshot(label + '-input');
  verifySelection(before.selection.selection);
  await launch();
  await f.waitToast(/select two distinct native planar faces on one visible solid/i);
  await review().waitFor({ state: 'hidden' });
  assert.equal(await f.sketchPanel().isVisible(), false);
  unchanged(await f.snapshot(label + '-refused'), before);
  await f.dismissToasts();
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

async function saveProject(name, project, doc) {
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
  assert.deepEqual(JSON.parse(bytes), doc);
  const saved = join(f.output, 'saved-midpoint.bcad');
  await writeFile(saved, bytes);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  return saved;
}

async function frameStock() {
  const ortho = button(f.page, 'Ortho');
  if (await ortho.getAttribute('aria-pressed') !== 'true') await ortho.click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
}

async function checkOblique() {
  const frame = { origin: [0, 4.5, 6], normal: [0, 0.6, 0.8], xAxis: [1, 0, 0] };
  const world = (x, v, s) => [x, 0.8 * v + 0.6 * s, -0.6 * v + 0.8 * s];
  const stockSketch = { ...seed.nodes[0], min: [0, 0], max: [20, 5], plane: { ...frame, origin: [0, 0, 0] } };
  const exact = { ...seed, nodes: [stockSketch, { ...seed.nodes[1], from: 5, height: 5 }] };
  const nearly = { ...seed, nodes: [stockSketch, seed.nodes[1]] };
  const name = 'D887-oblique-midpoint.bcad';
  const min = [24, 1], max = [30, 5];
  const station = ([, y, z]) => 0.6 * y + 0.8 * z;
  const savedFrameStation = station(frame.origin);
  const expectStock = native => {
    const stock = native.find(body => body.id === 'n1');
    assert.ok(stock?.valid && stock.corners.length === 8);
    const stations = stock.corners.map(station).sort((a, b) => a - b);
    stations.forEach((value, index) => close(value, index < 4 ? 5 : 10));
    close(stock.volume, 500);
    close(savedFrameStation - stations[3], 2.5);
    close(stations[4] - savedFrameStation, 2.5);
    return stock;
  };

  await f.newPage();
  f.phase = 'reject near-parallel oblique native caps without changing the document';
  await open(name, nearly);
  await frameStock();
  await pick('Top', false, world(10, 2, 10.0006));
  await pick('Bottom', true, world(10, 2, 2.0002));
  const before = await f.snapshot('01-oblique-near-parallel-input');
  await launch();
  await f.waitToast(/exactly parallel native faces/i);
  await review().waitFor({ state: 'hidden' });
  unchanged(await f.snapshot('02-oblique-near-parallel-refusal'), before);
  await f.dismissToasts();

  f.phase = 'verify the canonical oblique frame in both physical pick orders';
  await open(name, exact);
  await frameStock();
  const stock = expectStock(await f.inspect('oblique-stock-native', exact));
  await pick('Top', false, world(8, 2, 10));
  await pick('Bottom', true, world(13, 2, 5));
  await readyReview(frame.origin, frame.normal);
  assert.match((await f.snapshot('03-oblique-top-bottom-review')).review, /n1.top · n1.bottom/);
  await button(review(), 'Cancel').click();
  await review().waitFor({ state: 'hidden' });
  await f.same(exact);
  await pick('Bottom', false, world(5, 1.5, 5));
  await pick('Top', true, world(15, 3.5, 10));
  await readyReview(frame.origin, frame.normal);
  assert.match((await f.snapshot('04-oblique-bottom-top-review')).review, /n1.bottom · n1.top/);
  await button(review(), 'Start sketch').click();
  await f.sketchPanel().waitFor();
  assert.equal(await f.page.getByLabel('Sketch plane', { exact: true }).inputValue(), 'midpoint');
  await f.same(exact);

  f.phase = 'make and verify an independent solid in the positive oblique direction';
  await f.tool('Rectangle', 'r');
  await clickWorld(world(...min, 7.5));
  await clickWorld(world(...max, 7.5));
  f.phase = 'return to the actual midpoint plane with a rectangle draft';
  const dimensions = () => Promise.all(['width', 'height'].map(key =>
    f.sketchPanel().locator('#sk-' + key).inputValue().then(Number)));
  const basis = [min, max, [min[0], max[1]]].map(([x, y]) => world(x, y, 7.5));
  const projection = async () => {
    const [a, b, c] = await f.page.evaluate(points => points.map(point => window.__studioScreenOf(point)), basis);
    return { width: Math.hypot(b[0] - c[0], b[1] - c[1]), height: Math.hypot(c[0] - a[0], c[1] - a[1]) };
  };
  assert.deepEqual(await dimensions(), [6, 4]);
  await button(f.page, 'Top').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const top = await projection();
  assert.ok(Math.abs(top.width / top.height - 1.5) > 0.05, JSON.stringify(top));
  await f.snapshot('05-midpoint-top-draft');
  await button(f.page, 'Normal to sketch').click();
  const restored = await projection();
  assert.ok(Math.abs(restored.width / restored.height - 1.5) < 1e-6, JSON.stringify(restored));
  assert.deepEqual(await dimensions(), [6, 4]);
  await f.same(exact);
  await f.snapshot('06-midpoint-restored-draft');
  f.report.observations.push({ label: 'midpoint-normal-view', top, restored });
  const finished = (await f.finishSketch('07-oblique-finished')).doc;
  const sketch = finished.nodes[2];
  assert.deepEqual(sketch.plane, frame);
  assert.deepEqual(sketch.min, min);
  assert.deepEqual(sketch.max, max);
  assert.equal(sketch.association, undefined);
  assert.equal(sketch.on, undefined);
  assert.deepEqual(finished.nodes.slice(0, 2), exact.nodes);
  await f.openExtrudeHud();
  const solid = (await f.applyExtrude({ distance: 3, previous: finished, label: '08-oblique-extruded' })).doc;
  assert.deepEqual(solid.nodes[3], { kind: 'extrude', sketch: 2, height: 3, id: 'n3' });
  const native = await f.inspect('oblique-consumer-native', solid);
  assert.deepEqual(expectStock(native), stock);
  const consumer = native.find(body => body.id === 'n3');
  assert.ok(consumer?.valid && consumer.corners.length === 8);
  close(consumer.volume, 72);
  const corners = [7.5, 10.5].flatMap(s => [min[0], max[0]].flatMap(x => [min[1], max[1]].map(y => world(x, y, s))));
  for (const expected of corners) assert.ok(consumer.corners.some(point =>
    Math.hypot(...point.map((value, axis) => value - expected[axis])) < 1e-9), expected);
  await f.undo();
  await f.same(finished);
  await f.redo();
  await f.same(solid);

  const saved = await saveProject(name, 'D887 oblique midpoint ' + randomUUID(), solid);
  await f.freshOpen(saved, solid, '09-oblique-fresh-open');
  assert.deepEqual(await f.inspect('oblique-fresh-open-native', solid), native);
  f.report.observations.push({ label: 'oblique-midpoint-solid', frame, capStationsMm: [5, 10], profileStationsMm: [7.5, 10.5],
    profileCornersMm: [min, max], volumeMm3: consumer.volume, worldCornersMm: corners,
    sourceSHA256: sha256(Buffer.from(JSON.stringify(exact))), refusalSourceSHA256: sha256(Buffer.from(JSON.stringify(nearly))) });
  assert.deepEqual(f.report.downloads, []);
}

async function checkAdmission() {
  const mesh = {
    id: 'n4', kind: 'mesh', name: 'Faceted tetrahedron', unit: 'mm', representation: 'facets',
    positions: [-20, 0, 0, -10, 0, 0, -20, 10, 0, -20, 0, 10],
    indices: [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3],
  };
  const doc = { ...seed, nextId: 5, nodes: [
    ...seed.nodes,
    { kind: 'sketch', profile: 'rectangle', min: [52, 0], max: [62, 14], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 4, id: 'n3' },
    mesh,
  ], outputs: { ...seed.outputs, b3: { node: 3, side: 'solid' }, b4: { node: 4, side: 'solid' } } };
  const originals = await f.inspect('admission-original-bodies', doc);
  assert.equal(originals.length, 3);
  assert.ok(originals.every(body => body.valid));
  await f.newPage();
  await open('D888-face-admission.bcad', doc);
  await frameStock();
  const filter = button(f.page, 'Selection filter');
  await filter.click();
  await filter.getByText('Faces', { exact: true }).waitFor();

  f.phase = 'refuse the same face toggled twice';
  await pick('Top');
  await pick('Top', true, faces.Top, 0);
  await refuseSelection('01-same-face', selection => assert.equal(selection.faces.length, 0));

  f.phase = 'refuse three faces on one body';
  await pick('Top');
  await pick('Bottom', true);
  await pick('Front', true, faces.Front, 3);
  await refuseSelection('02-three-faces', selection => assert.deepEqual(selection.faces.map(face => face.body), [0, 0, 0]));

  f.phase = 'refuse a face pair from different native bodies';
  await pick('Top');
  await pick('Top', true, [57, 7, 4]);
  await refuseSelection('03-two-native-bodies', selection => assert.deepEqual(selection.faces.map(face => face.body), [0, 1]));

  f.phase = 'refuse two actual faceted mesh picks';
  await pick('Top', false, [-17, 3, 4]);
  await pick('Bottom', true, [-16, 2, 0]);
  await refuseSelection('04-faceted-faces', selection => assert.deepEqual(selection.faces.map(face => face.body), [2, 2]));

  f.phase = 'refuse a native face and a faceted face';
  await pick('Top');
  await pick('Top', true, [-17, 3, 4]);
  await refuseSelection('05-native-and-facet', selection => assert.deepEqual(selection.faces.map(face => face.body), [0, 2]));

  f.phase = 'recover with the same-body native pair and verify the separate result';
  await pick('Top');
  await pick('Bottom', true);
  await readyReview();
  await button(review(), 'Start sketch').click();
  await f.sketchPanel().waitFor();
  assert.equal(await f.page.getByLabel('Sketch plane', { exact: true }).inputValue(), 'midpoint');
  await f.tool('Rectangle', 'r');
  await clickWorld([44, 4, midpoint]);
  await clickWorld([50, 8, midpoint]);
  const finished = (await f.finishSketch('06-native-pair-finished')).doc;
  assert.deepEqual(finished.nodes.slice(0, 5), doc.nodes);
  const sketch = finished.nodes[5];
  assert.deepEqual(sketch.plane, { origin: [0, 0, midpoint], normal, xAxis });
  assert.deepEqual(sketch.min, [44, 4]);
  assert.deepEqual(sketch.max, [50, 8]);
  assert.equal(sketch.association, undefined);
  assert.equal(sketch.on, undefined);
  await f.openExtrudeHud();
  const solid = (await f.applyExtrude({ distance: 3, previous: finished, label: '07-admission-consumer' })).doc;
  const result = await f.inspect('admission-consumer-native', solid);
  assert.deepEqual(result.slice(0, 3), originals);
  const made = result.find(body => body.id === 'n6');
  assert.ok(made?.valid && made.corners.length === 8);
  close(made.volume, 72);
  for (const x of [44, 50]) for (const y of [4, 8]) for (const z of [midpoint, midpoint + 3]) {
    assert.ok(made.corners.some(point => Math.hypot(point[0] - x, point[1] - y, point[2] - z) < 1e-9));
  }
  await f.undo();
  await f.same(finished);
  await f.redo();
  await f.same(solid);
  f.report.observations.push({ label: 'midpoint-admission', fixtureSHA256: sha256(Buffer.from(JSON.stringify(doc))),
    refusals: ['same-face', 'three-faces', 'two-native-bodies', 'faceted-faces', 'native-and-facet'],
    acceptedBody: 'b1', outputVolumeMm3: made.volume, nativeCornersMm: made.corners });
  assert.deepEqual(f.report.downloads, []);
}

async function checkSelectionOwnership() {
  const native = { ...seed, nextId: 4, nodes: [
    ...seed.nodes,
    { kind: 'sketch', profile: 'circle', center: [54, 7], radius: 7, id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 8, id: 'n3' },
  ], outputs: { ...seed.outputs, b3: { node: 3, side: 'solid' } } };
  const assembly = { ...native, instances: [
    { id: 'placed', name: 'Placed stock', doc: seed, position: [70, 5, 0], rotation: [0, 0, 0] },
  ] };
  const name = 'D889-face-ownership.bcad';
  const original = await f.inspect('ownership-source-native', native);
  await f.newPage();
  await open(name, native);
  await frameStock();

  f.phase = 'refuse a planar cap and curved side from the same native cylinder';
  await pick('Top', false, [54, 7, 8]);
  await pick('Front', true, [54, 0, 4]);
  await refuseSelection('01-curve-and-cap', selection => assert.deepEqual(selection.faces.map(face => face.body), [1, 1]));

  f.phase = 'refuse the selection made by mixing a face click and a Shift-edge click';
  await pick('Top', false, [51, 5, 8]);
  assert.deepEqual((await pickState()).faces.map(face => face.body), [1]);
  const filter = button(f.page, 'Selection filter');
  await filter.click();
  await filter.click();
  await filter.getByText('Edges', { exact: true }).waitFor();
  await clickWorld([0, 10, 10.0006], true);
  await f.page.waitForFunction(() => window.__studioSelection.selection.bodies.length === 2);
  await refuseSelection('02-face-plus-edge', selection => {
    assert.deepEqual([...selection.bodies].sort(), [0, 1]);
    assert.deepEqual(selection.faces, []);
  });
  await filter.click();
  await filter.click();
  await filter.getByText('Pick all', { exact: true }).waitFor();

  f.phase = 'hide the selected native body and refuse its old face pair';
  await pick('Top');
  await pick('Bottom', true);
  await f.page.getByRole('checkbox', { name: 'Visible', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc.bodies?.b1?.hidden && !window.__studioSelection.selection.faces.length);
  await clickWorld(faces.Bottom);
  await refuseSelection('03-hidden-original-faces', selection => assert.deepEqual(selection.faces, []));
  await f.undo();
  await f.same(native);

  f.phase = 'refuse the two root caps in an assembly document';
  await open(name, assembly);
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().length === 1);
  await frameStock();
  await pick('Top', false, [82, 14, 10.0006], 0);
  const placed = f.page.locator('.ol.instance.sel').filter({ hasText: 'Placed stock' });
  await placed.waitFor();
  await refuseSelection('04a-assembly-occurrence', selection => assert.deepEqual(selection.faces, []));
  assert.equal(await placed.count(), 1);
  await pick('Top');
  await pick('Bottom', true);
  await refuseSelection('04-assembly-context', selection => assert.deepEqual(selection.faces.map(face => face.body), [0, 0]));

  f.phase = 'open real STL bytes and refuse the two selected facets';
  const vertices = [[0, 0, 0], [10, 0, 0], [0, 10, 0], [0, 0, 10]];
  const facesStl = [[0, 2, 1], [0, 1, 3], [1, 2, 3], [2, 0, 3]];
  const facets = facesStl.map(triangle => 'facet normal 0 0 0\n outer loop\n'
    + triangle.map(index => '  vertex ' + vertices[index].join(' ')).join('\n') + '\n endloop\nendfacet').join('\n');
  const stl = Buffer.from('solid tetrahedron\n' + facets + '\nendsolid tetrahedron\n');
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D889-native-refusal.stl', mimeType: 'model/stl', buffer: stl });
  const units = f.page.getByRole('dialog', { name: 'Mesh units', exact: true });
  await units.getByLabel('Mesh unit', { exact: true }).selectOption('mm');
  await button(units, 'Open').click();
  await f.waitToast(/STL opened/);
  await f.ready();
  const imported = await f.doc();
  assert.deepEqual(imported.nodes.map(node => [node.kind, node.representation]), [['mesh', 'facets']]);
  await f.dismissToasts();
  await frameStock();
  await pick('Top', false, [3, 3, 4]);
  await pick('Bottom', true, [4, 2, 0]);
  await refuseSelection('05-raw-stl-facets', selection => assert.deepEqual(selection.faces.map(face => face.body), [0, 0]));

  f.phase = 'recover after a camera zoom and preserve the exact native frame';
  await open(name, native);
  await frameStock();
  await pick('Top');
  await pick('Bottom', true);
  await readyReview();
  const first = await f.snapshot('06-native-before-zoom');
  await button(review(), 'Cancel').click();
  const beforeZoom = await f.page.evaluate(() => {
    const pixel = window.__studioScreenOf([20, 10, 2.0002]);
    const other = window.__studioScreenOf([30, 10, 2.0002]);
    return { pixel, span: Math.hypot(pixel[0] - other[0], pixel[1] - other[1]),
      onCanvas: !!document.elementFromPoint(...pixel)?.closest('canvas.vp-canvas') };
  });
  assert.ok(beforeZoom.onCanvas);
  await f.page.mouse.move(...beforeZoom.pixel);
  await f.page.mouse.wheel(0, 245);
  const afterZoom = await (await f.page.waitForFunction(span => {
    const a = window.__studioScreenOf([20, 10, 2.0002]), b = window.__studioScreenOf([30, 10, 2.0002]);
    const distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
    return distance < span - 1 && distance;
  }, beforeZoom.span)).jsonValue();
  await pick('Top', false, [15, 11, 10.0006]);
  await pick('Bottom', true, [28, 13, 2.0002]);
  await readyReview();
  const second = await f.snapshot('07-native-after-zoom');
  assert.equal(second.review, first.review);
  await button(review(), 'Start sketch').click();
  await f.sketchPanel().waitFor();
  assert.equal(await f.page.getByLabel('Sketch plane', { exact: true }).inputValue(), 'midpoint');
  await f.same(native);
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(native);
  assert.deepEqual(await f.inspect('ownership-recovered-native', native), original);
  f.report.observations.push({ label: 'midpoint-selection-ownership', stlBytes: stl.length, stlSHA256: sha256(stl),
    refusals: ['curved-side', 'face-plus-edge', 'hidden-body', 'assembly-context', 'assembly-occurrence', 'raw-stl-facets'],
    frameZMm: midpoint, zoomSpanCssPx: [beforeZoom.span, afterZoom] });
  assert.deepEqual(f.report.downloads, []);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    if (admission || ownership) context.setDefaultNavigationTimeout(30000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(holdRead);
    return context;
  };
  if (ownership) {
    await checkSelectionOwnership();
    return;
  }
  if (admission) {
    await checkAdmission();
    return;
  }
  if (oblique) {
    await checkOblique();
    return;
  }
  const name = 'D862-midpoint.bcad';
  await f.newPage();
  const starter = await f.doc();
  await open(name, seed);
  await frameStock();

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
  const saved = await saveProject(name, 'D862 midpoint ' + randomUUID(), changed);

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
