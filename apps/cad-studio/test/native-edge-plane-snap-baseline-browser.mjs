import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/native-edge-plane-snap-baseline-browser.mjs',
  'apps/cad-studio/src/viewport/modelSketchSnaps.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/osnap.ts',
  'packages/barocss-cad-model/src/sketch/plane.ts',
  'packages/barocss-cad-model/src/engine/mesh.ts',
];
const f = await createFlow({
  name: 'native-edge-plane-snap-baseline', output: process.argv[2], envFrozen: 'D863_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Measure current Studio input at a finite native straight edge crossing, with endpoint and disjoint controls.',
  limits: ['One original top-level native prism, an XY sketch plane and the desktop WebGPU viewport.'],
  snapshotExtra: () => ({ cue: document.querySelector('.sk-osnap text')?.textContent ?? null }),
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { evaluatePart, partBreps } from '@barocss/cad-model/engine/evaluate';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { modelSnaps } from '@barocss/cad-model/sketch/osnap';
import { xyPlane } from '@barocss/cad-model/sketch/plane';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (process.argv[3] === '"extrude"') {
  console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(output => ({
    id: output.id, valid: checkOutput(output).valid, volume: massPropertiesOf(output).volume,
    corners: output.brep.vertices.map(vertex => vertex.point),
  }))));
} else {
  const [{ brep }] = partBreps(doc);
  const edge = brep.edges.find(edge => edge.name === 'n1.side0|n1.side3');
  if (!edge) throw Error('The fixture has no declared native straight edge.');
  const native = { name: edge.name, vertices: edge.vertices, curve: edge.curve,
    points: edge.vertices.map(id => brep.vertices.find(vertex => vertex.id === id)?.point) };
  const qualityReads = [4, 8, 12].map(quality => {
    const result = evaluatePart(doc, 1, quality);
    if (!result.ok) throw Error(result.error.detail);
    const mesh = result.bodies[0].mesh, display = mesh.edges.find(candidate => candidate.names.includes(edge.name!));
    return { quality: mesh.quality, display, snaps: [0, 3, 10, 11].map(z => [z, modelSnaps([mesh], xyPlane(z))]) };
  });
  console.log(JSON.stringify({ valid: checkBrep(brep, { strict: true }).valid, native, qualityReads }));
}
`,
});

const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [4.234567, 6.345678], max: [24.234567, 20.345678] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
};
const target = [4.234567, 6.345678], endpoint = [4.2346, 6.3457], grid = [4, 6], other = [1, 2];
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const cue = () => f.page.locator('.sk-osnap text');
const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= 1e-9, `${a} vs ${b}`);

function checkNative(read) {
  const { native, qualityReads } = read;
  assert.ok(read.valid);
  assert.equal(native.curve.degree, 1);
  assert.equal(native.curve.controlPoints.length, 2);
  assert.ok(native.curve.weights.every(weight => weight > 0));
  assert.deepEqual(native.points, native.curve.controlPoints);
  const [a, b] = native.points;
  for (const point of [a, b]) target.forEach((value, axis) => near(point[axis], value));
  assert.deepEqual([a[2], b[2]].sort((x, y) => x - y), [0, 10]);
  const t = (3 - a[2]) / (b[2] - a[2]);
  const crossing = a.map((value, index) => value + t * (b[index] - value));
  assert.deepEqual(crossing, [...target, 3]);
  assert.ok(t > 0 && t < 1);
  assert.deepEqual(qualityReads.map(item => item.quality), [4, 8, 12]);
  for (const { display, snaps } of qualityReads) {
    assert.equal(display.straight, true);
    assert.deepEqual(display.names, [native.name]);
    assert.deepEqual(display.nativeVertices, native.vertices);
    assert.deepEqual([display.a, display.b], native.points);
    for (const [z, points] of snaps) {
      if (z === 0 || z === 10) assert.ok(points.some(point => point.kind === 'end' && point.at.every((value, axis) => value === endpoint[axis])));
      else assert.deepEqual(points, [], 'the current model supplies no candidates away from either cap');
    }
  }
  f.report.observations.push({ label: 'native-oracle', crossing, t, ...read });
}

async function begin(z) {
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  if (z !== 0) await f.sketchPanel().getByLabel('Plane offset', { exact: true }).fill(String(z));
  await f.tool('Rectangle', 'r');
}

async function pixel([x, y], z) {
  const xy = await f.page.evaluate(point => {
    const p = window.__studioScreenOf(point);
    return p && document.elementFromPoint(...p)?.closest('.vp-canvas') ? p : null;
  }, [x, y, z]);
  assert.ok(xy, `world point ${[x, y, z]} must project on the canvas`);
  return xy;
}

async function hover(point, z, expected) {
  const p = await pixel(point, z);
  await f.page.mouse.move(...p);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  if (expected) {
    await cue().waitFor();
    assert.equal(await cue().textContent(), expected);
  } else await cue().waitFor({ state: 'hidden' });
  return p;
}

async function draw(z, label, expectedCue, accepted) {
  await begin(z);
  const first = await hover(target, z, expectedCue);
  const state = await f.snapshot(label + '-hover');
  assert.deepEqual(state.doc, source);
  assert.equal(state.cue, expectedCue);
  await f.page.mouse.click(...first);
  const second = await hover(other, z, null);
  await f.page.mouse.click(...second);
  const finished = (await f.finishSketch(label + '-finish')).doc;
  const sketch = finished.nodes[2];
  assert.deepEqual(finished.nodes.slice(0, 2), source.nodes);
  assert.deepEqual(finished.outputs, source.outputs);
  assert.equal(sketch.kind, 'sketch');
  assert.equal(sketch.profile, 'rectangle');
  assert.equal(sketch.on, undefined);
  assert.equal(sketch.association, undefined);
  assert.deepEqual(sketch.min, other);
  assert.deepEqual(sketch.max, accepted);
  assert.deepEqual(sketch.plane, z ? { origin: [0, 0, z], normal: [0, 0, 1], xAxis: [1, 0, 0] } : undefined);
  f.report.observations.push({ label, pixel: first, cue: expectedCue, accepted, sketch });
  return finished;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin, newContext = f.browser.newContext.bind(f.browser);
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
  const bytes = Buffer.from(JSON.stringify(source));
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D863-edge-plane-baseline.bcad', mimeType: 'application/json', buffer: bytes });
  await f.same(source);
  f.report.observations.push({ label: 'source', bytes: bytes.length, sha256: sha256(bytes) });
  checkNative(await f.inspect('source-edge', source));

  f.phase = 'interior crossing currently falls through to the grid';
  const finished = await draw(3, '01-interior', null, grid);
  await f.openExtrudeHud();
  const applied = await f.applyExtrude({ distance: 2, previous: finished, label: '02-grid-profile-solid' });
  const [stock, solid] = await f.inspect('grid-profile-native', applied.doc, 'extrude');
  assert.ok(stock.valid && solid.valid);
  assert.equal(solid.id, 'n3');
  near(stock.volume, 2800);
  near(solid.volume, 24);
  assert.equal(solid.corners.length, 8);
  for (const x of [1, 4]) for (const y of [2, 6]) for (const z of [3, 5]) {
    assert.ok(solid.corners.some(point => Math.hypot(point[0] - x, point[1] - y, point[2] - z) <= 1e-9));
  }
  const residual = Math.hypot(grid[0] - target[0], grid[1] - target[1]);
  f.report.observations.push({ label: 'native-grid-extrude', residual, solid });
  await f.undo();
  await f.same(finished);
  await f.undo();
  await f.same(source);

  f.phase = 'regular endpoint remains available at the original cap';
  await draw(0, '03-endpoint', 'End', endpoint);
  await f.undo();
  await f.same(source);

  f.phase = 'the infinite line above the native edge remains without a cue';
  await begin(11);
  await hover(target, 11, null);
  await f.snapshot('04-outside-finite-edge');
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(source);
  assert.deepEqual(f.report.downloads, []);
});
