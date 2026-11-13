import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const controlBaseline = process.argv[3] === '--controls-baseline';
const planeMode = process.argv[3] === '--planes';
const draftHistory = process.argv[3] === '--draft-history';
const pins = [
  'apps/cad-studio/test/circle-from-chord-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/circleFromChord.ts',
  'apps/cad-studio/src/sketch/CircleChordControls.tsx',
  'apps/cad-studio/src/sketch/useCircleFromChord.ts',
  'apps/cad-studio/src/viewport/CircleChordMarks.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'apps/cad-studio/src/ui/ConstraintTools.tsx',
  'apps/cad-studio/src/viewport/dragTrimStroke.ts',
  'packages/barocss-cad-model/src/sketch/loops.ts',
  ...(planeMode ? ['packages/barocss-cad-model/src/sketch/plane.ts', 'apps/cad-studio/src/sketch/useSketchActions.ts'] : []),
];
const f = await createFlow({
  name: 'circle-from-chord', output: process.argv[2], envFrozen: draftHistory ? 'D1075_SOURCE_FROZEN' : planeMode ? 'D879_SOURCE_FROZEN' : 'D878_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: draftHistory ? 'Replay the confirmed circle and its subsequent diameter edit before Finish.'
    : planeMode ? 'Consume circles drawn from chord points on three non-default working planes.'
    : 'Use two actual sketch clicks and a typed radius to choose an ordinary circle and extrude it.',
  limits: planeMode ? ['One cylinder each on XZ, YZ and a translated 30 degree XY plane.']
    : ['Default XY plane, existing desktop snap and one ordinary circle per source.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { toPartDocument } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [output] = evaluateCadPart(toPartDocument(doc)).outputs;
const { volume, centroid } = massPropertiesOf(output);
console.log(JSON.stringify({ id: output.id, valid: checkOutput(output).valid, volume, centroid,
  corners: output.brep.vertices.map(vertex => vertex.point), faces: output.brep.faces.map(face => faceGeometry(face)) }));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    canFinish: !document.querySelector('.topbar button.finish')?.disabled,
    historyDisabled: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
    candidates: document.querySelectorAll('.sk-circle-chord-candidate').length,
  }),
});
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const controls = () => f.page.getByRole('group', { name: 'Circle from two points', exact: true });
const radiusField = () => controls().getByRole('textbox', { name: 'Circle radius', exact: true });
const centers = () => f.page.locator('.sk-circle-chord-center');
const endpoints = () => f.page.locator('.sk-circle-chord-end');
const finish = () => f.page.locator('.topbar button.finish');
const a = [20, 20], b = [26, 20], low = [23, 16], high = [23, 24];
const mmTolerance = 1e-7, pxTolerance = 0.02;

const xy = { normal: [0, 0, 1], world: ([x, y]) => [x, y, 0] };

async function newPart(deviceScaleFactor = 1) {
  await f.newPage({ deviceScaleFactor });
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
}

async function enterCircle() {
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Circle', 'c');
  await f.frame([[16, 12], [32, 28], a, b]);
}

function screenOf(point, basis = xy) {
  return f.page.evaluate(world => window.__studioScreenOf(world), basis.world(point));
}

async function pixel(point, basis) {
  const p = await screenOf(point, basis);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), p), point);
  return p;
}

async function previewMarks(marks, expected, basis) {
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const actual = await marks.evaluateAll(list => list.map(mark => {
    const r = mark.closest('svg').getBoundingClientRect();
    return [mark.cx.baseVal.value + r.left, mark.cy.baseVal.value + r.top];
  }));
  const positions = await Promise.all(expected.map(point => screenOf(point, basis)));
  assert.equal(actual.length, positions.length);
  assert.ok(actual.every((p, i) => Math.hypot(p[0] - positions[i][0], p[1] - positions[i][1]) < pxTolerance), { actual, positions });
}

async function begin() {
  await button(f.sketchPanel(), 'Circle from two points').click();
  await controls().getByRole('status').getByText(/first point/).waitFor();
  assert.equal(await finish().isDisabled(), true);
}

async function resizeWhilePicking() {
  await begin();
  const canvas = f.page.locator('canvas.vp-canvas');
  const width = await canvas.evaluate(node => node.getBoundingClientRect().width);
  await f.page.mouse.move(...await pixel(a));
  await f.page.mouse.down();
  await f.page.setViewportSize({ width: 1520, height: 1000 });
  await f.page.waitForFunction(old => document.querySelector('canvas.vp-canvas').getBoundingClientRect().width !== old, width);
  await f.page.mouse.up();
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const count = await endpoints().count();
  await f.page.setViewportSize({ width: 1440, height: 1000 });
  await button(controls(), 'Cancel circle').click();
  return count;
}

async function cancelWithHeldEnter() {
  await f.tool('Trim', 't');
  await f.tool('Circle', 'c');
  await begin();
  await button(controls(), 'Cancel circle').focus();
  await f.page.keyboard.down('Enter');
  await controls().waitFor({ state: 'hidden' });
  await f.page.keyboard.down('Enter');
  await f.page.keyboard.up('Enter');
}

async function pickPoints(first, second, basis, inputs = [first, second]) {
  await f.page.mouse.click(...await pixel(inputs[0], basis));
  await controls().getByRole('status').getByText(/second point/).waitFor();
  await f.page.mouse.click(...await pixel(inputs[1], basis));
  await radiusField().waitFor();
  await previewMarks(endpoints(), [first, second], basis);
}

function unchanged(after, before) {
  for (const key of ['doc', 'bodies', 'selection', 'history', 'dirty', 'historyDisabled']) assert.deepEqual(after[key], before[key], key);
}

const norm = vector => Math.hypot(...vector);
const difference = (p, q) => p.map((value, i) => value - q[i]);
const dot = (p, q) => p.reduce((value, component, i) => value + component * q[i], 0);

async function native(label, doc, center, radius, basis = xy) {
  const { id, valid, volume, centroid, corners, faces } = await f.inspect(label, doc);
  const expectedVolume = 2 * Math.PI * radius ** 2;
  const axis = basis.normal, bottom = basis.world(center), mid = bottom.map((x, i) => x + axis[i]);
  const heightAt = point => dot(difference(point, bottom), axis);
  const radial = point => {
    const height = heightAt(point);
    return difference(point, bottom).map((v, i) => v - height * axis[i]);
  };
  assert.equal(id, 'n1');
  assert.equal(valid, true);
  assert.ok(Math.abs(volume - expectedVolume) < mmTolerance);
  assert.ok(norm(difference(centroid, mid)) < mmTolerance, JSON.stringify({ centroid, mid }));
  assert.ok(corners.length >= 4);
  const caps = faces.filter(face => face.kind === 'plane');
  const sideFaces = faces.filter(face => face.kind === 'cylinder');
  assert.equal(caps.length, 2);
  assert.ok(sideFaces.length > 0, JSON.stringify(faces));
  for (const h of [0, 2]) {
    assert.ok(caps.some(face => Math.abs(dot(face.n, axis) - (h === 0 ? -1 : 1)) < mmTolerance
      && Math.abs(heightAt(face.o) - h) < mmTolerance));
    assert.ok(corners.filter(point => Math.abs(heightAt(point) - h) < mmTolerance).length >= 2);
  }
  for (const side of sideFaces) {
    assert.ok(Math.abs(side.r - radius) < mmTolerance);
    assert.ok(norm(radial(side.c)) < mmTolerance);
    assert.ok(Math.abs(Math.abs(dot(side.a, axis)) - 1) < mmTolerance);
  }
  for (const point of corners) {
    assert.ok(Math.min(Math.abs(heightAt(point)), Math.abs(heightAt(point) - 2)) < mmTolerance);
    assert.ok(Math.abs(norm(radial(point)) - radius) < mmTolerance);
  }
  const [body] = (await f.bodies()).bodies;
  assert.equal(body.key, 'b1');
  assert.ok(Math.abs(body.volume - expectedVolume) < mmTolerance);
  f.report.observations.push({ label, id, valid, volume, centroid, expectedCentroid: mid, corners: corners.length, cylindricalFaces: sideFaces.length, expectedVolumeMm3: expectedVolume });
}

async function acceptAndExtrude(label, center, radius, first, second, basis) {
  const profile = (await f.finishSketch(label + '-circle')).doc;
  assert.equal(profile.nodes.length, 1);
  const [circle] = profile.nodes;
  assert.equal(circle.profile, 'circle');
  assert.ok(Math.hypot(circle.center[0] - center[0], circle.center[1] - center[1]) < mmTolerance);
  assert.equal(circle.radius, radius);
  assert.equal(circle.sideTags?.outer.length, 1);
  if (!circle.construction?.length) assert.deepEqual(circle.sideTags, { outer: ['e1'] });
  if (basis?.plane) {
    for (const field of ['origin', 'normal', 'xAxis']) {
      assert.ok(norm(difference(circle.plane[field], basis.plane[field])) < mmTolerance);
    }
  }
  for (const point of [first, second]) {
    assert.ok(Math.abs(Math.hypot(circle.center[0] - point[0], circle.center[1] - point[1]) - radius) < mmTolerance);
  }
  await f.openExtrudeHud();
  const solid = (await f.applyExtrude({ distance: 2, previous: profile, label })).doc;
  assert.deepEqual(solid.nodes[0], circle);
  await native(label + '-native', solid, center, radius, basis);
  return { profile, solid };
}

async function save(doc) {
  const name = planeMode ? 'D879-circle-plane' : 'D878-circle-from-chord', file = name + '.bcad', project = 'Circle from chord';
  await f.page.locator('.doc-tab input').fill(name);
  await button(f.page, 'Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions, 'Project in this browser').click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await versions.getByRole('list', { name: 'Project documents' }).getByText(file, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, file]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, [project, file]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.observations.push({ label: 'project-save', bytes: bytes.length, sha256: sha256(bytes) });
  return { file, bytes };
}

async function open(doc, { file, bytes }) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
}

async function setPlane(kind, offset, angle = 0) {
  await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption(kind);
  await f.sketchPanel().getByLabel('Plane offset', { exact: true }).fill(String(offset));
  if (angle) await f.sketchPanel().getByLabel('Plane angle', { exact: true }).fill(String(angle));
}

async function qualifyPlanes() {
  const c = Math.sqrt(3) / 2;
  const xz = { normal: [0, -1, 0], world: ([u, v]) => [u, -7, v],
    plane: { origin: [0, -7, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } };
  const yz = { normal: [1, 0, 0], world: ([u, v]) => [3, u, v],
    plane: { origin: [3, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } };
  const tilt = { normal: [0, 0.5, c], world: ([u, v]) => [u, 3.5 + c * v, 7 * c - 0.5 * v],
    plane: { origin: [0, 3.5, 7 * c], normal: [0, 0.5, c], xAxis: [1, 0, 0] } };

  f.phase = 'retire candidates on plane change and accept an exact XZ diameter';
  await newPart();
  const empty = await f.doc();
  await enterCircle();
  await begin();
  await pickPoints(a, b);
  await radiusField().fill('5');
  await button(controls(), 'Use circle 2').waitFor();
  await setPlane('xz', 7);
  await controls().waitFor({ state: 'hidden' });
  assert.equal(await centers().count(), 0);
  await f.same(empty);
  await begin();
  await pickPoints(a, b, xz);
  await radiusField().fill('3');
  await button(controls(), 'Use circle 1').waitFor();
  await previewMarks(centers(), [[23, 20]], xz);
  await button(controls(), 'Use circle 1').click();
  await acceptAndExtrude('01-xz-diameter', [23, 20], 3, a, b, xz);

  f.phase = 'accept the upper candidate on the YZ plane';
  await newPart();
  await enterCircle();
  await setPlane('yz', 3);
  await begin();
  await pickPoints(b, a, yz);
  await radiusField().fill('5');
  await button(controls(), 'Use circle 2').waitFor();
  await previewMarks(centers(), [low, high], yz);
  await button(controls(), 'Use circle 2').click();
  await acceptAndExtrude('02-yz-upper', high, 5, b, a, yz);

  const first = [20.25, 20.25], second = [25.25, 20.25];
  const inputs = [[20.29, 20.27], [25.29, 20.27]];
  const dy = Math.sqrt(39) / 2, chosen = [22.75, 20.25 + dy];
  const tiltedCenters = [[22.75, 20.25 - dy], chosen];
  async function drawTilted(dpr) {
    f.phase = 'draw off-grid construction endpoints at DPR ' + dpr;
    await newPart(dpr);
    assert.equal(await f.page.evaluate(() => devicePixelRatio), dpr);
    await enterCircle();
    await setPlane('xy', 7, 30);
    await f.tool('Rectangle', 'r');
    await button(f.page, 'Construction').click();
    await f.page.mouse.click(...await pixel([20, 20], tilt));
    await f.page.mouse.click(...await pixel([25, 26], tilt));
    await f.sketchPanel().locator('input#sk-x').fill('20.25');
    await f.sketchPanel().locator('input#sk-y').fill('20.25');
    await f.tool('Circle', 'c');
    await button(f.page, 'Construction').click();

    if (dpr === 2) {
      f.phase = 'use the grid while the off-grid source is hidden';
      await button(f.page, 'Hide construction').click();
      await begin();
      await pickPoints([20, 20], [25, 20], tilt, inputs);
      await button(controls(), 'Cancel circle').click();
      await button(f.page, 'Show construction').click();
    }
    await begin();
    await f.page.mouse.move(...await pixel(inputs[0], tilt));
    await f.page.locator('.vp-overlay .sk-osnap').getByText('End', { exact: true }).waitFor();
    await pickPoints(first, second, tilt, inputs);
    await f.page.locator('.vp-overlay .sk-osnap').waitFor({ state: 'hidden' });
    await radiusField().fill('4');
    await button(controls(), 'Use circle 2').waitFor();
    await previewMarks(centers(), tiltedCenters, tilt);
    if (dpr === 2) {
      const beforeZoom = await screenOf(chosen, tilt);
      await f.page.mouse.move(...await pixel([24, 23], tilt));
      await f.page.mouse.wheel(0, -180);
      await previewMarks(centers(), tiltedCenters, tilt);
      assert.ok(norm(difference(await screenOf(chosen, tilt), beforeZoom)) > 1);
      assert.equal(await f.page.locator('.vp-overlay .sk-osnap').count(), 0);
      await f.snapshot('03-tilted-off-grid-after-zoom');
    }
    await button(controls(), 'Use circle 2').click();
    const result = await acceptAndExtrude('04-tilted-off-grid-dpr' + dpr, chosen, 4, first, second, tilt);
    const refs = result.profile.nodes[0].construction;
    assert.equal(refs.length, 1);
    assert.equal(refs[0].kind, 'rectangle');
    assert.equal(refs[0].construction, true);
    assert.deepEqual(refs[0].a, first);
    assert.deepEqual(refs[0].b, [25.25, 26.25]);
    assert.equal(new Set([...result.profile.nodes[0].sideTags.outer, ...refs[0].ids]).size, 5);
    return result.solid;
  }
  const tilted = await drawTilted(2);
  assert.deepEqual(await drawTilted(1), tilted);
  const saved = await save(tilted);
  await f.newPage();
  await open(tilted, saved);
  await native('05-tilted-fresh-native', tilted, chosen, 4, tilt);
  await f.snapshot('05-tilted-fresh-open');

  f.phase = 'New part retires pending circles from the prior document';
  await enterCircle();
  await begin();
  const other = [[45, 10], [51, 10]];
  await f.frame(other);
  await pickPoints(...other);
  await radiusField().fill('5');
  await button(controls(), 'Use circle 2').waitFor();
  await button(f.page, 'New part').click();
  await f.same(empty);
  await controls().waitFor({ state: 'hidden' });
  await f.sketchPanel().waitFor({ state: 'hidden' });
  assert.equal(await centers().count(), 0);
  await f.snapshot('06-new-part-retires-candidates');
  assert.deepEqual(f.report.downloads, []);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  if (planeMode) { await qualifyPlanes(); return; }
  if (draftHistory) {
    await newPart();
    const blank = await f.doc();
    await enterCircle();
    await begin();
    await pickPoints(a, b);
    await radiusField().fill('5');
    await previewMarks(centers(), [low, high]);
    assert.equal(await button(f.page, 'Undo').isEnabled(), false);
    await button(controls(), 'Use circle 1').click();
    const diameter = f.sketchPanel().locator('input#sk-diameter');
    assert.equal(await diameter.inputValue(), '10');
    const outline = () => f.page.locator('.vp-overlay .sk-shape').evaluateAll(nodes => nodes.map(node => node.outerHTML));
    const original = await outline();
    assert.equal(original.length, 1);
    await f.same(blank);

    f.phase = 'Undo the confirmed candidate';
    await finish().focus();
    await f.page.keyboard.press('Meta+z');
    const undone = await f.snapshot('01-after-confirmation-undo');
    assert.equal(await diameter.count(), 0);
    assert.deepEqual(await outline(), []);
    assert.equal(undone.candidates, 0);
    assert.equal(await controls().count(), 0);
    await f.same(blank);
    await button(f.page, 'Redo').click();
    assert.deepEqual(await outline(), original);

    f.phase = 'Replay the confirmation and diameter edit in order';
    await diameter.fill('12');
    await finish().focus();
    assert.equal(await diameter.inputValue(), '12');
    await button(f.page, 'Undo').click();
    assert.deepEqual(await outline(), original);
    await button(f.page, 'Undo').click();
    assert.deepEqual(await outline(), []);
    await finish().focus();
    await f.page.keyboard.press('Meta+Shift+z');
    assert.deepEqual(await outline(), original);
    await f.page.keyboard.press('Meta+Shift+z');
    assert.equal(await diameter.inputValue(), '12');
    await button(f.page, 'Undo').click();
    assert.deepEqual(await outline(), original);
    await f.snapshot('02-restored-candidate');

    const lower = await acceptAndExtrude('03-draft-history', low, 5, a, b);
    await f.undo();
    await f.same(lower.profile);
    await f.redo();
    await f.same(lower.solid);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  await newPart();
  const empty = await f.doc();
  assert.equal(empty.nodes.length, 0);
  await enterCircle();
  const before = await f.snapshot('01-empty-circle-tool');

  f.phase = 'resize the desktop viewport with a circumference point held';
  const resizePicked = await resizeWhilePicking();
  assert.equal(resizePicked, controlBaseline ? 1 : 0);
  unchanged(await f.snapshot('01a-resized-point-press'), before);
  if (controlBaseline) {
    f.phase = 'hold Enter on Cancel with an ordinary circle available to Finish';
    await f.page.mouse.click(...await pixel([20, 20]));
    await f.page.mouse.click(...await pixel([24, 20]));
    await cancelWithHeldEnter();
    await f.sketchPanel().waitFor({ state: 'hidden' });
    const wronglyFinished = await f.snapshot('02-baseline-cancel-finished');
    assert.equal(wronglyFinished.doc.nodes[0]?.profile, 'circle');
    assert.equal(wronglyFinished.doc.nodes[0]?.radius, 4);
    f.report.observations.push({ label: 'controls-baseline', resizedPress: 'FAIL', heldEnterCancel: 'FAIL' });
    assert.deepEqual(f.report.downloads, []);
    return;
  }


  f.phase = 'discard a held click after Escape and its repeated key event';
  await begin();
  await f.page.mouse.move(...await pixel(a));
  await f.page.mouse.down();
  await f.page.keyboard.down('Escape');
  await f.page.keyboard.down('Escape');
  await f.page.keyboard.up('Escape');
  await controls().waitFor({ state: 'hidden' });
  await f.page.mouse.up();
  assert.equal(await f.sketchPanel().isVisible(), true);
  assert.equal(await f.sketchPanel().locator('input#sk-diameter').count(), 0);
  unchanged(await f.snapshot('02-cancelled-before-pick'), before);

  f.phase = 'refuse duplicate and impossible input, then preview a unique diameter and two centers';
  await begin();
  await f.page.mouse.click(...await pixel(a));
  await f.page.mouse.click(...await pixel(a));
  await controls().getByRole('alert').getByText('Pick a different point.').waitFor();
  await f.page.mouse.click(...await pixel(b));
  await previewMarks(endpoints(), [a, b]);
  await radiusField().fill('2');
  await controls().getByRole('alert').getByText(/longer than the entered diameter/).waitFor();
  assert.equal(await centers().count(), 0);
  unchanged(await f.snapshot('03-impossible-chord'), before);
  await radiusField().fill('Infinity');
  await controls().getByRole('alert').getByText('Enter a finite radius.').waitFor();
  await radiusField().fill('3');
  await button(controls(), 'Use circle 1').waitFor();
  await previewMarks(centers(), [[23, 20]]);
  assert.equal(await button(controls(), 'Use circle 2').count(), 0);
  await radiusField().press('Enter');
  assert.equal(await controls().isVisible(), true);
  unchanged(await f.snapshot('04-one-diameter-candidate'), before);
  await radiusField().fill('5');
  await button(controls(), 'Use circle 2').waitFor();
  await previewMarks(centers(), [low, high]);
  unchanged(await f.snapshot('05-two-candidates'), before);

  f.phase = 'choose the lower circle by keyboard without repeated Enter finishing the sketch';
  await button(controls(), 'Use circle 1').focus();
  await f.page.keyboard.down('Enter');
  await controls().waitFor({ state: 'hidden' });
  await f.page.keyboard.down('Enter');
  await f.page.keyboard.up('Enter');
  assert.equal(await f.sketchPanel().isVisible(), true);
  assert.equal(await finish().isEnabled(), true);
  await f.same(empty);
  const lower = await acceptAndExtrude('06-lower', low, 5, a, b);
  await f.undo();
  await f.same(lower.profile);
  await f.redo();
  await f.same(lower.solid);
  const saved = await save(lower.solid);

  await f.newPage();
  await open(lower.solid, saved);
  await native('07-reopened-native', lower.solid, low, 5);
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  assert.equal(await f.sketchPanel().locator('input#sk-diameter').inputValue(), '10');
  assert.equal(await controls().count(), 0);
  await f.snapshot('07-reopened-ordinary-circle');
  const cx = f.sketchPanel().locator('input#sk-cx');
  await cx.fill('24');
  const edited = (await f.finishSketch('07-reopened-center-edited')).doc;
  assert.deepEqual(edited.nodes[0].center, [24, 16]);
  assert.deepEqual(edited.nodes[0].sideTags, lower.solid.nodes[0].sideTags);
  assert.deepEqual(edited.nodes[1], lower.solid.nodes[1]);
  await native('07-reopened-center-edited-native', edited, [24, 16], 5);
  await f.undo();
  await f.same(lower.solid);


  f.phase = 'choose the opposite circle after reversing endpoint order';
  await newPart();
  await enterCircle();
  await begin();
  await pickPoints(b, a);
  await radiusField().fill('5');
  await button(controls(), 'Use circle 2').waitFor();
  await previewMarks(centers(), [low, high]);
  await button(controls(), 'Use circle 2').click();
  await acceptAndExtrude('08-upper-reversed', high, 5, b, a);

  f.phase = 'retire a decimal preview after a tool change and preserve ordinary Circle input';
  await newPart();
  await enterCircle();
  await begin();
  const short = [25, 20];
  await pickPoints(a, short);
  await radiusField().fill('4');
  await button(controls(), 'Use circle 2').waitFor();
  const offset = Math.sqrt(39) / 2;
  await previewMarks(centers(), [[22.5, 20 - offset], [22.5, 20 + offset]]);
  await f.snapshot('09-unrounded-candidates');
  await button(controls(), 'Use circle 2').click();
  await acceptAndExtrude('09-unrounded', [22.5, 20 + offset], 4, a, short);
  await newPart();
  await enterCircle();
  await begin();
  await pickPoints(a, short);
  await radiusField().fill('4');
  await button(controls(), 'Use circle 2').waitFor();
  await f.tool('Trim', 't');
  await controls().waitFor({ state: 'hidden' });
  assert.equal(await centers().count(), 0);
  await f.tool('Circle', 'c');
  await f.page.mouse.click(...await pixel([20, 20]));
  await f.page.mouse.click(...await pixel([24, 20]));
  await cancelWithHeldEnter();
  assert.equal(await f.sketchPanel().isVisible(), true);
  await f.same(empty);
  await f.snapshot('10-held-cancel-kept-ordinary-draft');
  const ordinary = await acceptAndExtrude('10-ordinary-circle', [20, 20], 4, [16, 20], [24, 20]);
  assert.equal(ordinary.profile.nodes[0].radius, 4);

  f.phase = 'replace the document with two pending candidates';
  await newPart();
  await enterCircle();
  await begin();
  await pickPoints(a, b);
  await radiusField().fill('5');
  await button(controls(), 'Use circle 2').waitFor();
  await open(lower.solid, saved);
  await controls().waitFor({ state: 'hidden' });
  assert.equal(await centers().count(), 0);
  await native('11-replacement-native', lower.solid, low, 5);
  await f.snapshot('11-candidate-owner-replaced');
  assert.deepEqual(f.report.downloads, []);
});
