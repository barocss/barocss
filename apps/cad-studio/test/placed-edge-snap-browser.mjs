import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { installD523PlacedReplyScheduler } from './placed-worker-reply-scheduler.mjs';

const fixed = process.argv[3] === '--fixed';

const pins = [
  'apps/cad-studio/test/placed-edge-snap-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/modelSketchSnaps.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/engine/doc.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
  'packages/barocss-cad-model/src/sketch/osnap.ts',
  ...(fixed ? [
    'apps/cad-studio/src/viewport/placedBoxSnap.ts',
    'apps/cad-studio/src/viewport/placedSketchSnaps.ts',
    'apps/cad-studio/src/viewport/SceneViewport.tsx',
    'apps/cad-studio/test/placed-worker-reply-scheduler.mjs',
  ] : []),
];
const f = await createFlow({
  name: 'placed-edge-snap', output: process.argv[2], envFrozen: fixed ? 'D882_SOURCE_FROZEN' : 'D881_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: fixed ? 'Consume current translated box endpoints and midpoints with stale and hidden occurrence controls.'
    : 'Measure placed edge snap availability and the accepted root sketch coordinates.',
  limits: ['Two top-level static translated native boxes with a shared source and a separate native root box in desktop Studio.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { placedDoc } from '@barocss/cad-model/engine/doc';
import { toPartDocument } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const read = (part: typeof doc) => evaluateCadPart(toPartDocument(part)).outputs.map(output => ({
  id: output.id, valid: checkOutput(output).valid, volume: massPropertiesOf(output).volume,
  corners: output.brep.vertices.map(vertex => vertex.point),
  edges: output.brep.edges.filter(edge => edge.curve.degree === 1 && edge.curve.controlPoints.length === 2)
    .map(edge => edge.vertices.map(id => output.brep.vertices.find(vertex => vertex.id === id)?.point)),
}));
console.log(JSON.stringify({ root: read(doc), placed: doc.instances.map(instance => ({
  id: instance.id, bodies: read(placedDoc(instance, doc)),
})) }));
`,
  snapshotExtra: () => ({
    snap: document.querySelector('.vp-overlay .sk-osnap text')?.textContent ?? null,
    occurrence: document.querySelector('.vp-overlay .sk-osnap')?.getAttribute('data-snap-occurrence') ?? null,
    instanceBounds: window.__studioInstanceBounds?.() ?? [],
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});

const part = (min, max) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min, max, id: 'n0', sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] } },
    { kind: 'extrude', sketch: 0, height: 6, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
});
const definition = part([0, 0], [20, 12]);
const root = part([-24.75, -9.5], [-4.75, 2.5]);
const instances = [
  { id: 'left', name: 'Left box', doc: definition, position: [10.25, 14.25, 0], rotation: [0, 0, 0] },
  { id: 'right', name: 'Right box', doc: definition, position: [55.75, 34.25, 0], rotation: [0, 0, 0] },
];
const source = { ...root, instances };
const endAt = [10.25, 14.25], middleAt = [65.75, 34.25];
const firstPointer = [10.30, 14.30], secondPointer = [65.79, 34.30];
const expectedGrid = [[10, 14], [66, 34]];
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const cue = () => f.page.locator('.vp-overlay .sk-osnap text');
const close = (p, q) => p.length === q.length && Math.hypot(...p.map((value, i) => value - q[i])) < 1e-8;

function checkBox(body, lo, hi, volume) {
  assert.equal(body.valid, true);
  assert.ok(Math.abs(body.volume - volume) < 1e-8);
  assert.equal(body.corners.length, 8);
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
    assert.ok(body.corners.some(p => close(p, [x, y, z])), [x, y, z]);
  }
}

function checkInstances(read) {
  assert.deepEqual(read.map(item => item.id), instances.map(instance => instance.id));
  for (const [i, placed] of read.entries()) {
    assert.equal(placed.bodies.length, 1);
    const [body] = placed.bodies;
    const [x, y, z] = instances[i].position;
    checkBox(body, [x, y, z], [x + 20, y + 12, z + 6], 1440);
    const witness = [[x, y, z], [x + 20, y, z]];
    assert.ok(body.edges.some(edge => witness.every(p => edge.some(q => close(p, q)))));
  }
}

async function pixel(point, height = 0) {
  const p = await f.page.evaluate(world => {
    const at = window.__studioScreenOf(world);
    return at && document.elementFromPoint(...at)?.closest('canvas.vp-canvas') ? at : null;
  }, [...point, height]);
  assert.ok(p, point);
  return p;
}

async function hover(point, expected, occurrence = null, height = 0) {
  const p = await pixel(point, height);
  await f.page.mouse.move(...p);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  if (expected) {
    await cue().waitFor();
    assert.equal(await cue().textContent(), expected);
    assert.equal(await f.page.locator('.vp-overlay .sk-osnap').getAttribute('data-snap-occurrence'), occurrence);
  } else await cue().waitFor({ state: 'hidden' });
  return p;
}

async function markAt(point) {
  const expected = await pixel(point);
  const actual = await f.page.locator('.vp-overlay .sk-osnap').evaluate(mark => {
    const symbol = mark.firstElementChild, rect = mark.closest('svg').getBoundingClientRect();
    if (symbol instanceof SVGPolygonElement) {
      const apex = symbol.points.getItem(0);
      return [rect.left + apex.x, rect.top + apex.y + 7];
    }
    const { x, y, width, height } = symbol.getBBox();
    return [rect.left + x + width / 2, rect.top + y + height / 2];
  });
  assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 0.02, JSON.stringify({ actual, expected }));
}

async function open(doc, bytes = Buffer.from(JSON.stringify(doc))) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D881-placed-snap.bcad', mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().length === 2);
}

async function begin() {
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Rectangle', 'r');
}

async function cancel() {
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
}

async function save(doc) {
  const file = 'D881-placed-snap.bcad', project = 'D882 placed snaps';
  await button(f.page, 'Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(panel, 'Project in this browser').click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await panel.getByRole('list', { name: 'Project documents' }).getByText(file, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, file]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, [project, file]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.observations.push({ label: 'project-save', bytes: bytes.length, sha256: sha256(bytes) });
  return bytes;
}

async function occurrenceControls() {
  await f.page.locator('.ol.instance').filter({ hasText: 'Left box' }).first().click();
  const panel = f.page.getByRole('complementary', { name: 'Instance', exact: true });
  await panel.waitFor();
  return panel;
}

async function movedOccurrence(solid) {
  f.phase = 'hold the genuine Worker reply after a public left placement edit';
  const panel = await occurrenceControls();
  await f.page.evaluate(() => window.__d523Placed.arm({ onlyPlaced: true }));
  const field = panel.getByLabel('Instance X', { exact: true }).first();
  await field.fill('35.25');
  await field.press('Enter');
  await f.page.waitForFunction(() => window.__studioDoc.instances[0].position[0] === 35.25);
  await f.page.waitForFunction(() => {
    const run = window.__d523Placed.snapshot();
    return run.claimed && run.events.some(event => event.kind === 'native-event-held' && event.id === run.claimed.id && event.resultOK);
  });
  const claim = await f.page.evaluate(() => {
    const run = window.__d523Placed.snapshot();
    return { id: run.claimed.id, translation: run.claimed.place.t, held: run.events.some(e => e.kind === 'native-event-held' && e.id === run.claimed.id && e.resultOK) };
  });
  assert.deepEqual(claim.translation, [35.25, 14.25, 0]);
  assert.equal(claim.held, true);
  f.report.observations.push({ label: 'held-original-placed-worker-reply', ...claim });
  const moved = await f.doc();
  assert.deepEqual(moved.instances[1], solid.instances[1]);
  assert.deepEqual(moved.nodes, solid.nodes);
  await f.ready();
  const newPointer = [35.30, 14.30];
  await begin();
  await f.frame([firstPointer, newPointer, secondPointer]);
  await hover(firstPointer, null);
  await hover(newPointer, null);
  await hover(secondPointer, 'Middle', 'right');
  const pending = await f.snapshot('08-pending-left-keeps-only-current-right');
  assert.equal(pending.instanceBounds.find(item => item.id === 'left')?.min[0], 10.25);
  await f.page.mouse.click(...await hover(firstPointer, null));
  const pendingCorner = await Promise.all(['x', 'y'].map(async axis =>
    Number(await f.sketchPanel().locator(`#sk-${axis}`).inputValue())));
  assert.deepEqual(pendingCorner, expectedGrid[0]);
  await f.same(moved);
  f.report.observations.push({ label: 'pending-left-grid-corner', at: pendingCorner });
  await cancel();
  await begin();
  await f.frame([firstPointer, newPointer, secondPointer]);
  await f.page.evaluate(() => window.__d523Placed.release());
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().find(item => item.id === 'left')?.min[0] === 35.25);
  await hover(firstPointer, null);
  await hover(newPointer, 'End', 'left');
  await hover(secondPointer, 'Middle', 'right');
  await f.snapshot('09-current-left-replaces-old-source');

  f.phase = 'consume the moved endpoint while retaining the right midpoint';
  await f.page.mouse.click(...await hover(newPointer, 'End', 'left'));
  await f.page.mouse.click(...await hover(secondPointer, 'Middle', 'right'));
  const sketched = (await f.finishSketch('10-moved-left-consumer')).doc;
  assert.deepEqual(sketched.nodes.at(-1).min, [35.25, 14.25]);
  assert.deepEqual(sketched.nodes.at(-1).max, middleAt);
  assert.deepEqual(sketched.instances, moved.instances);
  await f.openExtrudeHud();
  const extruded = (await f.applyExtrude({ distance: 2, previous: sketched, label: '11-moved-left-consumer' })).doc;
  const result = await f.inspect('moved-native', extruded);
  checkBox(result.root.find(body => body.id === 'n3'), [35.25, 14.25, 0], [...middleAt, 2], 1220);
  assert.deepEqual(extruded.instances, moved.instances);
  assert.deepEqual(extruded.nodes.slice(0, 2), solid.nodes);

  f.phase = 'hide the left occurrence through its public panel';
  await button(await occurrenceControls(), 'Hide').click();
  await f.page.waitForFunction(() => window.__studioDoc.instances[0].hidden === true);
  await f.ready();
  await begin();
  const leftMiddle = [45.30, 14.30], rightEnd = [55.80, 34.30];
  await f.frame([leftMiddle, rightEnd]);
  await hover(leftMiddle, null);
  await hover(rightEnd, 'End', 'right');
  await f.snapshot('12-hidden-left-keeps-current-right');
  await cancel();
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
    if (fixed) await context.addInitScript(installD523PlacedReplyScheduler);
    return context;
  };

  const fixture = Buffer.from(JSON.stringify(source));
  const original = await f.inspect('source-native', source);
  assert.equal(original.root.length, 1);
  checkBox(original.root[0], [-24.75, -9.5, 0], [-4.75, 2.5, 6], 1440);
  checkInstances(original.placed);
  f.report.observations.push({ label: 'fixture', bytes: fixture.length, sha256: sha256(fixture) });
  await f.newPage();
  await open(source, fixture);
  const before = await f.snapshot('01-current-placed-boxes');
  assert.deepEqual(before.instanceBounds.map(item => ({ id: item.id, min: item.min, max: item.max })), [
    { id: 'left', min: [10.25, 14.25, 0], max: [30.25, 26.25, 6] },
    { id: 'right', min: [55.75, 34.25, 0], max: [75.75, 46.25, 6] },
  ]);

  f.phase = 'compare root and placed endpoints and midpoints at the current working plane';
  await begin();
  const scenePoints = [[-24.75, -9.5], [-14.75, -9.5], firstPointer, secondPointer];
  await f.frame(scenePoints);
  await hover([-24.70, -9.45], 'End');
  await f.snapshot('02-root-end');
  await hover([-14.70, -9.45], 'Middle');
  await f.snapshot('03-root-middle');
  await hover([20.29, 14.30], fixed ? 'Middle' : null, fixed ? 'left' : null);
  await hover([55.80, 34.30], fixed ? 'End' : null, fixed ? 'right' : null);
  await f.snapshot(fixed ? '04-placed-current-sources' : '04-placed-controls-no-cue');
  if (fixed) {
    f.phase = 'exclude disabled snap kinds, off-plane edges and the exploded view';
    const options = f.sketchPanel().locator('details.sk-object-snaps');
    await options.locator('summary').click();
    const endpoint = button(options, 'Endpoint');
    await endpoint.click();
    await hover(firstPointer, null);
    await hover(secondPointer, 'Middle', 'right');
    await endpoint.click();
    await options.locator('summary').click();
    const offset = f.sketchPanel().getByLabel('Plane offset', { exact: true });
    await offset.fill('3');
    await f.frame(scenePoints);
    await hover(firstPointer, null, null, 3);
    await hover(secondPointer, null, null, 3);
    await offset.fill('0');
    await f.frame(scenePoints);
    const explode = button(f.page, 'Explode');
    await explode.click();
    await hover(firstPointer, null);
    await hover(secondPointer, null);
    await f.snapshot('04a-explode-excludes-placed-snaps');
    for (let i = 0; i < 3; i++) await explode.click();
    await hover(firstPointer, 'End', 'left');
  }
  const first = await hover(firstPointer, fixed ? 'End' : null, fixed ? 'left' : null);
  if (fixed) await markAt(endAt);
  await f.page.mouse.click(...first);
  const second = await hover(secondPointer, fixed ? 'Middle' : null, fixed ? 'right' : null);
  if (fixed) await markAt(middleAt);
  await f.page.mouse.click(...second);
  const accepted = (await f.finishSketch(fixed ? '05-root-rectangle-from-placed-snaps' : '05-root-rectangle-falls-to-grid')).doc;
  assert.deepEqual(accepted.instances, instances);
  assert.deepEqual(accepted.nodes.slice(0, 2), root.nodes);
  const [min, max] = fixed ? [endAt, middleAt] : expectedGrid;
  const expectedVolume = fixed ? 2220 : 2240;
  assert.equal(accepted.nodes[2].profile, 'rectangle');
  assert.deepEqual(accepted.nodes[2].min, min);
  assert.deepEqual(accepted.nodes[2].max, max);

  f.phase = 'evaluate the coordinates the root Extrude actually consumed';
  await f.openExtrudeHud();
  const solid = (await f.applyExtrude({ distance: 2, previous: accepted, label: fixed ? '06-placed-snap-consumer' : '06-grid-consumer' })).doc;
  const proof = await f.inspect('accepted-native', solid);
  assert.deepEqual(solid.instances, instances);
  assert.deepEqual(proof.placed, original.placed);
  assert.deepEqual(proof.root.find(body => body.id === 'n1'), original.root[0]);
  checkBox(proof.root.find(body => body.id === 'n3'), [...min, 0], [...max, 2], expectedVolume);
  const body = (await f.bodies()).bodies.find(body => body.key === 'b3');
  assert.ok(Math.abs(body.volume - expectedVolume) < 1e-8);
  await f.undo();
  await f.same(accepted);
  await f.redo();
  await f.same(solid);
  f.report.observations.push({
    label: fixed ? 'placed-snap-fixed' : 'placed-snap-baseline', rootEnd: 'PASS', rootMiddle: 'PASS',
    placedEnd: fixed ? 'PASS' : 'FAIL', placedMiddle: fixed ? 'PASS' : 'FAIL',
    wanted: [endAt, middleAt], stored: [min, max], wantedVolumeMm3: 2220, storedVolumeMm3: expectedVolume,
  });
  if (fixed) {
    const bytes = await save(solid);
    await f.newPage();
    await open(solid, bytes);
    const reopened = await f.inspect('reopened-native', solid);
    assert.deepEqual(reopened, proof);
    await f.snapshot('07-fresh-open-with-accepted-geometry');
    await open(source);
    await movedOccurrence(source);
  }
  assert.deepEqual(f.report.downloads, []);
});
