import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/SketchSnapControls.tsx',
  'apps/cad-studio/src/sketch/objectSnapKinds.ts',
  'apps/cad-studio/src/ui/ViewDisplayControls.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/modelSketchSnaps.ts',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/osnap.ts',
];
const f = await createFlow({
  name: 'object-snap-kinds', output: process.argv[2], envFrozen: 'D872_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Apply current session object-snap settings to the next sketch input with independent grid fallback.',
  limits: ['One XY rectangle and circle as native snap sources. Desktop Chrome WebGPU.'],
  snapshotExtra: () => ({
    cue: document.querySelector('.sk-osnap text')?.textContent ?? null,
    grid: document.querySelector('[aria-label="Grid snap"]')?.textContent ?? null,
    kinds: [...document.querySelectorAll('.sk-object-snap-kinds button')].map(button => [button.textContent, button.getAttribute('aria-pressed')]),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});
const endpoint = [14.54, 12.3457], centre = [14.84, 12.3457];
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 4,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: endpoint },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 5 },
    { id: 'n2', kind: 'sketch', profile: 'circle', center: centre, radius: 3 },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 5 },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } },
};
const names = ['Endpoint', 'Midpoint', 'Centre', 'Quadrant', 'Origin', 'Edge crossing'];
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const kind = name => button(f.sketchPanel().getByRole('group', { name: 'Object snap kinds' }), name);
const cue = () => f.page.locator('.sk-osnap text');
const details = () => f.sketchPanel().locator('details.sk-object-snaps');
const grid = () => button(f.page, 'Grid snap');

async function open(doc, file = 'D872-source.bcad', bytes = Buffer.from(JSON.stringify(doc))) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
}

async function openControls() {
  if (!(await details().evaluate(element => element.open))) await details().locator('summary').click();
}

async function expectKinds(enabled) {
  for (const name of names) assert.equal(await kind(name).getAttribute('aria-pressed'), String(enabled.includes(name)), name);
}

async function toggle(name, enabled) {
  const control = kind(name);
  if (await control.getAttribute('aria-pressed') !== String(enabled)) {
    await control.focus();
    await f.page.keyboard.press('Space');
  }
  assert.equal(await control.getAttribute('aria-pressed'), String(enabled), name);
}

async function only(enabled) {
  for (const name of names) await toggle(name, enabled.includes(name));
  await expectKinds(enabled);
}

async function setGrid(label) {
  for (let i = 0; i < 6 && await grid().innerText() !== label; i++) await grid().click();
  assert.equal(await grid().innerText(), label);
}

async function begin(tool, key, points = [endpoint, centre, [35, 5], [38, 5], [28.4, 19.35]]) {
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool(tool, key);
  await f.frame(points);
  await openControls();
}

async function frameCompetingSnaps() {
  await f.frame([endpoint, centre]);
  for (let i = 0; i < 5; i++) {
    const [a, b] = await Promise.all([f.screenOf(endpoint), f.screenOf(centre)]);
    const gap = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (gap > 0 && gap < 7) return gap;
    const box = await f.page.locator('.vp-canvas').boundingBox();
    await f.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await f.page.mouse.wheel(0, 400);
    await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  assert.fail('The two native candidates did not fit within a common screen snap radius.');
}

async function expectCue(text) {
  if (text) await cue().filter({ hasText: new RegExp('^' + text + '$') }).waitFor();
  else await cue().waitFor({ state: 'hidden' });
}

async function hover(point, text, z = 0) {
  const canvasPixel = () => f.page.evaluate(world => {
    const pixel = window.__studioScreenOf(world);
    return pixel && document.elementFromPoint(...pixel)?.closest('.vp-canvas') ? pixel : null;
  }, [...point, z]);
  let pixel = await canvasPixel();
  if (!pixel) {
    await f.frame([point]);
    pixel = await canvasPixel();
  }
  assert.ok(pixel, JSON.stringify(point));
  await f.page.mouse.move(...pixel);
  await expectCue(text);
  return pixel;
}

async function clickAtPointer() {
  await f.page.mouse.down();
  await f.page.mouse.up();
}

async function number(name, expected) {
  const field = f.sketchPanel().getByRole('spinbutton', { name: new RegExp('^' + name + '(?:\\s*mm)?$') });
  await field.waitFor();
  assert.equal(Number(await field.inputValue()), expected, name);
}

async function cancel() {
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await expectCue(null);
}

async function save(doc) {
  const file = 'D872-authored.bcad', project = 'D872 object snap kinds';
  await f.page.locator('.doc-tab input').fill('D872-authored');
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
    const directory = await projects.getDirectoryHandle(project);
    return (await (await directory.getFileHandle(file)).getFile()).text();
  }, [project, file]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.observations.push({ label: 'project-save', bytes: bytes.length, sha256: sha256(bytes) });
  await button(f.page, 'Project and versions').click();
  await versions.waitFor({ state: 'hidden' });
  return bytes;
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
  await f.newPage();
  await open(source);

  f.phase = 'keep the completed circle and filter a nearer disabled endpoint';
  await begin('Circle', 'c');
  await expectKinds(names);
  await f.worldClick([35, 5]);
  await f.worldClick([38, 5]);
  await number('Diameter', 6);
  await f.tool('Rectangle', 'r');
  await openControls();
  await only(['Endpoint', 'Centre']);
  await setGrid('Grid off');
  await f.frame([endpoint, centre, [28.4, 19.35]]);
  const gap = await frameCompetingSnaps();
  await hover(endpoint, 'End');
  f.report.observations.push({ label: 'competing-native-candidates', gapCssPixels: gap, endpoint, centre });
  const before = await f.snapshot('01-nearer-endpoint');
  await toggle('Endpoint', false);
  await expectCue(null);
  await expectKinds(['Centre']);
  const after = await f.snapshot('02-keyboard-clears-old-cue');
  for (const key of ['doc', 'history', 'controls', 'dirty', 'selection']) assert.deepEqual(after[key], before[key], key);
  await clickAtPointer();
  await number('Corner X', 14.84);
  await number('Corner Y', 12.3457);
  await hover(centre, 'Centre');
  await f.snapshot('03-centre-with-grid-off');

  f.phase = 'disable the last object snap during Rectangle and consume grid fallback';
  await toggle('Centre', false);
  await expectCue(null);
  await expectKinds([]);
  await setGrid('Grid 1 mm');
  await hover([28.4, 19.35], null);
  await clickAtPointer();
  const authored = (await f.finishSketch('04-circle-and-rectangle')).doc;
  assert.deepEqual(authored.nodes.slice(0, 4), source.nodes);
  const sketch = authored.nodes[4];
  assert.equal(sketch.profile, 'circle');
  assert.deepEqual(sketch.center, [35, 5]);
  assert.equal(sketch.radius, 3);
  assert.deepEqual(sketch.regions, [[centre, [28, centre[1]], [28, 19], [centre[0], 19]].map(start => ({ kind: 'line', start }))]);
  assert.ok(sketch.sideTags);
  assert.ok(!JSON.stringify(authored).includes('objectSnap'));
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(authored);
  const saved = await save(authored);

  f.phase = 'preserve session switches across New and File Open';
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await begin('Rectangle', 'r', [[0, 0], [6, 6]]);
  await expectKinds([]);
  await cancel();
  await open(authored, 'D872-authored.bcad', saved);
  await begin('Rectangle', 'r');
  await expectKinds([]);
  await cancel();

  f.phase = 'commit the current Circle radius without a pointer move';
  await open(source);
  await begin('Circle', 'c', [[8, 12], endpoint, [14.42, 12.35]]);
  await only(['Endpoint']);
  await f.worldClick([8, 12]);
  await hover([14.42, 12.35], 'End');
  const snappedDiameter = 2 * Math.hypot(endpoint[0] - 8, endpoint[1] - 12);
  await number('Diameter', Math.round(snappedDiameter * 1e4) / 1e4);
  await toggle('Endpoint', false);
  await expectCue(null);
  await clickAtPointer();
  await number('Diameter', 12);
  const circle = (await f.finishSketch('05-current-circle-radius')).doc.nodes[4];
  assert.deepEqual(circle.center, [8, 12]);
  assert.equal(circle.radius, 6);

  f.phase = 'commit the current Slot width without a pointer move';
  await open(source);
  await begin('Slot', 'o', [[4, 10], [8, 10], endpoint, [14.42, 12.35]]);
  await only(['Endpoint']);
  await f.worldClick([4, 10]);
  await f.worldClick([8, 10]);
  await hover([14.42, 12.35], 'End');
  await number('Width', 5);
  await toggle('Endpoint', false);
  await expectCue(null);
  await clickAtPointer();
  await number('Width', 4);
  const slot = (await f.finishSketch('06-current-slot-width')).doc.nodes[4];
  assert.equal(slot.profile, 'loop');
  const ends = slot.segments.filter(segment => segment.kind === 'arc');
  assert.equal(ends.length, 2);
  for (const arc of ends) assert.equal(Math.hypot(arc.start[0] - arc.center[0], arc.start[1] - arc.center[1]), 2);

  f.phase = 'place ordinary points with object and grid snapping both off';
  await open(source);
  await begin('Rectangle', 'r', [[23.25, 15.75], [32.25, 22.75]]);
  await setGrid('Grid off');
  await expectKinds([]);
  await hover([23.25, 15.75], null);
  await clickAtPointer();
  await hover([32.25, 22.75], null);
  await clickAtPointer();
  const free = (await f.finishSketch('07-both-off')).doc.nodes[4];
  for (const [actual, expected] of [[free.min, [23.25, 15.75]], [free.max, [32.25, 22.75]]]) {
    assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 0.12, JSON.stringify(actual));
    assert.ok(actual.some(value => value % 1 !== 0));
  }

  f.phase = 'use the current session filter for Line and Spline points';
  await open(source);
  await begin('Line', 'l', [endpoint, centre]);
  await setGrid('Grid 1 mm');
  await only(['Endpoint', 'Centre']);
  await frameCompetingSnaps();
  await hover(endpoint, 'End');
  await clickAtPointer();
  await number('Point 1 X', 14.54);
  await toggle('Endpoint', false);
  await expectCue(null);
  await clickAtPointer();
  await number('Point 1 X', 14.54);
  await number('Point 2 X', 14.84);
  await cancel();
  await f.same(source);
  await begin('Spline', 'p', [endpoint, centre, [22, 17]]);
  await expectKinds(['Centre']);
  await frameCompetingSnaps();
  await hover(endpoint, 'Centre');
  await clickAtPointer();
  await f.worldClick([22, 17]);
  await number('Point 1 X', 14.84);
  await cancel();
  await f.same(source);

  await f.openFeatureEditor(1);
  f.phase = 'object snap keyboard controls retain the current inline dimension draft';
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Select', 's');
  await f.frame([[0, 6], endpoint]);
  await openControls();
  await f.worldClick([0, 6]);
  await button(f.sketchPanel(), 'Dimension the selection').click();
  const draft = f.page.locator('.dim-edit');
  await draft.fill('11.8');
  await toggle('Centre', false);
  assert.equal(await draft.inputValue(), '11.8');
  await draft.focus();
  await f.page.keyboard.press('Escape');
  await draft.waitFor({ state: 'hidden' });
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().getByText(/Pick points and edges with Select/).waitFor();
  await cancel();
  await f.same(source);

  f.phase = 'change the sketch plane and disable its native edge crossing at the click';
  await begin('Rectangle', 'r', [endpoint, [23, 19]]);
  await only(['Endpoint', 'Edge crossing']);
  await hover(endpoint, 'End');
  await f.sketchPanel().getByLabel('Plane offset', { exact: true }).fill('2');
  await f.sketchPanel().getByText(/SKETCH · Rectangle · Z 2/).waitFor();
  await expectCue(null);
  await expectKinds(['Endpoint', 'Edge crossing']);
  await hover(endpoint, 'Crossing', 2);
  await toggle('Edge crossing', false);
  await expectCue(null);
  await clickAtPointer();
  await number('Corner X', 15);
  await number('Corner Y', 12);
  await hover([23, 19], null, 2);
  await clickAtPointer();
  const changedPlane = (await f.finishSketch('08-plane-with-crossing-disabled')).doc.nodes[4];
  assert.deepEqual(changedPlane.plane.origin, [0, 0, 2]);
  assert.deepEqual(changedPlane.min, [15, 12]);
  assert.deepEqual(changedPlane.max, [23, 19]);

  f.phase = 'fresh desktop context restores all types and opens exact accepted bytes';
  await f.newPage();
  await open(authored, 'D872-authored.bcad', saved);
  await begin('Rectangle', 'r');
  await expectKinds(names);
  await f.snapshot('09-fresh-open-default-kinds');
  await cancel();
  assert.deepEqual(await f.doc(), authored);
  assert.deepEqual(f.report.downloads, []);
});
