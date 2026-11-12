import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/placed-edge-snap-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/modelSketchSnaps.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/engine/doc.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
  'packages/barocss-cad-model/src/sketch/osnap.ts',
];
const f = await createFlow({
  name: 'placed-edge-snap', output: process.argv[2], envFrozen: 'D881_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Measure placed edge snap availability and the accepted root sketch coordinates.',
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

async function pixel(point) {
  const p = await f.page.evaluate(world => {
    const at = window.__studioScreenOf(world);
    return at && document.elementFromPoint(...at)?.closest('canvas.vp-canvas') ? at : null;
  }, [...point, 0]);
  assert.ok(p, point);
  return p;
}

async function hover(point, expected) {
  const p = await pixel(point);
  await f.page.mouse.move(...p);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  if (expected) {
    await cue().waitFor();
    assert.equal(await cue().textContent(), expected);
  } else await cue().waitFor({ state: 'hidden' });
  return p;
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

  const fixture = Buffer.from(JSON.stringify(source));
  const original = await f.inspect('source-native', source);
  assert.equal(original.root.length, 1);
  checkBox(original.root[0], [-24.75, -9.5, 0], [-4.75, 2.5, 6], 1440);
  checkInstances(original.placed);
  f.report.observations.push({ label: 'fixture', bytes: fixture.length, sha256: sha256(fixture) });
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D881-placed-snap.bcad', mimeType: 'application/json', buffer: fixture });
  await f.same(source);
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().length === 2);
  const before = await f.snapshot('01-current-placed-boxes');
  assert.deepEqual(before.instanceBounds.map(item => ({ id: item.id, min: item.min, max: item.max })), [
    { id: 'left', min: [10.25, 14.25, 0], max: [30.25, 26.25, 6] },
    { id: 'right', min: [55.75, 34.25, 0], max: [75.75, 46.25, 6] },
  ]);

  f.phase = 'compare root and placed endpoints and midpoints at the current working plane';
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Rectangle', 'r');
  await f.frame([[-24.75, -9.5], [-14.75, -9.5], firstPointer, secondPointer]);
  await hover([-24.70, -9.45], 'End');
  await f.snapshot('02-root-end');
  await hover([-14.70, -9.45], 'Middle');
  await f.snapshot('03-root-middle');
  await hover([20.29, 14.30], null);
  await hover([55.80, 34.30], null);
  await f.snapshot('04-placed-controls-no-cue');
  const first = await hover(firstPointer, null);
  await f.page.mouse.click(...first);
  const second = await hover(secondPointer, null);
  await f.page.mouse.click(...second);
  const accepted = (await f.finishSketch('05-root-rectangle-falls-to-grid')).doc;
  assert.deepEqual(accepted.instances, instances);
  assert.deepEqual(accepted.nodes.slice(0, 2), root.nodes);
  const [min, max] = expectedGrid;
  assert.equal(accepted.nodes[2].profile, 'rectangle');
  assert.deepEqual(accepted.nodes[2].min, min);
  assert.deepEqual(accepted.nodes[2].max, max);

  f.phase = 'evaluate the coordinates the root Extrude actually consumed';
  await f.openExtrudeHud();
  const solid = (await f.applyExtrude({ distance: 2, previous: accepted, label: '06-grid-consumer' })).doc;
  const proof = await f.inspect('accepted-native', solid);
  assert.deepEqual(solid.instances, instances);
  assert.deepEqual(proof.placed, original.placed);
  assert.deepEqual(proof.root.find(body => body.id === 'n1'), original.root[0]);
  checkBox(proof.root.find(body => body.id === 'n3'), [...min, 0], [...max, 2], 2240);
  const body = (await f.bodies()).bodies.find(body => body.key === 'b3');
  assert.ok(Math.abs(body.volume - 2240) < 1e-8);
  await f.undo();
  await f.same(accepted);
  await f.redo();
  await f.same(solid);
  f.report.observations.push({
    label: 'placed-snap-baseline', rootEnd: 'PASS', rootMiddle: 'PASS', placedEnd: 'FAIL', placedMiddle: 'FAIL',
    wanted: [endAt, middleAt], stored: expectedGrid, wantedVolumeMm3: 2220, storedVolumeMm3: 2240,
  });
  assert.deepEqual(f.report.downloads, []);
});
