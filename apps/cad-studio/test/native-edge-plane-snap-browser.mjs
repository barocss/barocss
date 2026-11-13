import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const anchorTools = process.argv[3] === '--anchor-tools';
const centreArc = process.argv[3] === '--centre-arc';
const circleEndRadius = process.argv[3] === '--circle-end-radius';
const slotEndWidth = process.argv[3] === '--slot-end-width';
const constructionCircleRadius = process.argv[3] === '--construction-circle-radius';
const pins = [
  'apps/cad-studio/test/native-edge-plane-snap-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/modelSketchSnaps.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/osnap.ts',
  'packages/barocss-cad-model/src/sketch/plane.ts',
  'packages/barocss-cad-model/src/engine/mesh.ts',
  'packages/barocss-cad-model/src/engine/nativeStraightEdge.ts',
  'packages/barocss-cad-model/src/sketch/edgePlaneCrossing.ts',
];
const f = await createFlow({
  name: 'native-edge-plane-snap', output: process.argv[2],
  envFrozen: constructionCircleRadius ? 'D1117_SOURCE_FROZEN' : slotEndWidth ? 'D1111_SOURCE_FROZEN'
    : circleEndRadius ? 'D1110_SOURCE_FROZEN' : centreArc ? 'D1109_SOURCE_FROZEN' : anchorTools ? 'D1108_SOURCE_FROZEN' : 'D864_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Use an original native straight edge crossing in desktop Studio and preserve the authored snapshot.',
  limits: ['One original top-level native prism on the desktop WebGPU viewport, with XY and tilted sketch planes.'],
  snapshotExtra: () => ({ cue: document.querySelector('.sk-osnap text')?.textContent ?? null }),
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { evaluatePart, partBreps } from '@barocss/cad-model/engine/evaluate';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { modelCrossingSnaps, modelSnaps } from '@barocss/cad-model/sketch/osnap';
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
    return { quality: mesh.quality, display, snaps: [0, 3, 10, 11].map(z => [z, modelSnaps([mesh], xyPlane(z)), modelCrossingSnaps([mesh], xyPlane(z))]) };
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
const fileName = 'D864-edge-plane-crossing.bcad';
const deviceScaleFactor = process.env.D864_DPR2 === '1' ? 2 : 1;
const target = [4.234567, 6.345678], endpoint = [4.2346, 6.3457], other = [1, 2];
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
    assert.equal(display.nativeLine, true);
    for (const [z, points, crossings] of snaps) {
      if (z === 3) {
        assert.equal(crossings.length, 4);
        assert.ok(crossings.some(point => point.kind === 'crossing' && point.at.every((value, axis) => value === endpoint[axis])));
      } else assert.deepEqual(crossings, []);
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

async function pixel([x, y, z]) {
  const xy = await f.page.evaluate(point => {
    const p = window.__studioScreenOf(point);
    return p && document.elementFromPoint(...p)?.closest('.vp-canvas') ? p : null;
  }, [x, y, z]);
  assert.ok(xy, `world point ${[x, y, z]} must project on the canvas`);
  return xy;
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

async function draw(z, label, expectedCue, accepted) {
  await begin(z);
  let first = await hover([...target, z], expectedCue);
  if (deviceScaleFactor === 2 && z === 3) {
    const before = first;
    const canvas = await f.page.locator('.vp-canvas').boundingBox();
    assert.ok(canvas);
    await f.page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await f.page.mouse.wheel(0, 240);
    await f.page.waitForFunction(([world, before]) => {
      const after = window.__studioScreenOf(world);
      return after && Math.hypot(after[0] - before[0], after[1] - before[1]) > 1;
    }, [[...target, z], before]);
    first = await hover([...target, z], expectedCue);
    f.report.observations.push({ label: 'crossing-after-zoom', before, after: first });
  }
  const state = await f.snapshot(label + '-hover');
  assert.deepEqual(state.doc, source);
  assert.equal(state.cue, expectedCue);
  await f.page.mouse.click(...first);
  const second = await hover([...other, z], null);
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


async function saveInProject(doc, artifact = 'saved-crossing.bcad') {
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const project = 'D864 crossing ' + randomUUID();
  if (!(await versions.isVisible())) await button(f.page, 'Project and versions').click();
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions, 'Project in this browser').click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(fileName, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    const file = await (await folder.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, fileName]));
  assert.deepEqual(JSON.parse(bytes), doc);
  const path = join(f.output, artifact);
  await writeFile(path, bytes);
  f.report.files.push({ bytes: bytes.length, sha256: sha256(bytes) });
  return path;
}

async function tilt() {
  const panel = f.sketchPanel();
  await panel.getByLabel('Plane angle', { exact: true }).fill(String(Math.atan2(3, 4) * 180 / Math.PI));
  await panel.getByLabel('Plane offset', { exact: true }).fill('6');
}

async function tiltedControl() {
  f.phase = 'retire the old candidate on plane change and place from the tilted plane';
  await begin(3);
  await hover([...target, 3], 'Crossing');
  await tilt();
  await cue().waitFor({ state: 'hidden' });
  const crossingZ = (6 - 0.6 * target[1]) / 0.8;
  const first = await hover([...target, crossingZ], 'Crossing');
  await f.snapshot('05-tilted-crossing');
  await f.page.mouse.click(...first);
  const second = await hover([1, 5.2, 3.6], null);
  await f.page.mouse.click(...second);
  const state = await f.finishSketch('06-tilted-finish');
  const sketch = state.doc.nodes[2];
  assert.deepEqual(sketch.min, other);
  assert.deepEqual(sketch.max, [4.2346, 3.4321]);
  const plane = sketch.plane;
  plane.origin.forEach((value, axis) => near(value, [0, 3.6, 4.8][axis]));
  plane.normal.forEach((value, axis) => near(value, [0, 0.6, 0.8][axis]));
  assert.deepEqual(plane.xAxis, [1, 0, 0]);
  assert.deepEqual(state.doc.nodes.slice(0, 2), source.nodes);
  f.report.observations.push({ label: 'tilted-crossing', crossingZ, expectedLocal: [target[0], 1.25 * target[1] - 4.5], sketch });
  await f.undo();
  await f.same(source);
}

async function tiltedAnchorTools() {
  const y = 1.25 * target[1] - 4.5, z = (6 - 0.6 * target[1]) / 0.8;
  const first = [target[0], target[1], z], second = [source.nodes[0].max[0], target[1], z];
  const localToWorld = ([x, y]) => [x, 3.6 + 0.8 * y, 4.8 - 0.6 * y];
  const expectA = [4.2346, 3.4321], expectB = [24.2346, 3.4321];
  const caseLabels = [['Line', 'l'], ['Arc', 'a'], ['Circle', 'c']];
  for (const [tool, key] of caseLabels) {
    f.phase = tool + ' tilted native crossing';
    await begin(0);
    await tilt();
    if (tool !== 'Circle') {
      await f.page.mouse.click(...await hover(localToWorld([1, 8]), null));
      await f.page.mouse.click(...await hover(localToWorld([8, 12]), null));
      await f.tool(tool, key);
      await button(f.page, 'Construction').click();
    } else await f.tool(tool, key);
    const [x, py] = await pixel(first);
    await f.page.mouse.move(x + 2, py);
    await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const state = await f.snapshot(tool + '-anchor-hover');
    assert.equal(state.cue, 'Crossing', tool + ' first point');
    assert.deepEqual(state.doc, source);
    await f.page.mouse.click(x + 2, py);
    if (tool === 'Circle') {
      await cue().waitFor({ state: 'hidden' });
      await hover(second, null);
      await f.page.mouse.click(...await hover(localToWorld([12, y]), null));
    } else {
      await f.page.mouse.click(...await hover(second, 'Crossing'));
      if (tool === 'Arc') {
        await cue().waitFor({ state: 'hidden' });
        // A distinct crossing on the bottom edge would otherwise be eligible.
        await hover([source.nodes[0].max[0], 10, 0], null);
        const bend = await pixel(localToWorld([14, 6]));
        await f.page.mouse.move(...bend);
        await f.page.mouse.click(...bend);
      }
    }
    const finished = (await f.finishSketch(tool + '-finish')).doc;
    const sketch = finished.nodes[2];
    assert.deepEqual(finished.nodes.slice(0, 2), source.nodes);
    assert.deepEqual(finished.outputs, source.outputs);
    sketch.plane.normal.forEach((value, axis) => near(value, [0, 0.6, 0.8][axis]));
    if (tool === 'Circle') {
      assert.equal(sketch.profile, 'circle');
      assert.deepEqual(sketch.center, expectA);
      assert.equal(sketch.radius, 8);
    } else {
      assert.equal(sketch.construction.length, 1);
      const [reference] = sketch.construction;
      assert.deepEqual(reference.points, [expectA, expectB]);
      assert.equal(reference.closed, false);
      assert.equal(reference.construction, true);
      if (tool === 'Arc') assert.ok(Math.abs(reference.bulges[0]) > 0.01);
      else assert.ok(reference.bulges.every(bulge => bulge === 0));
    }
    f.report.observations.push({ label: tool, expectedLocal: [target[0], y], sketch });
    await f.undo();
    await f.same(source);
    await f.redo();
    await f.same(finished);
    const saved = await saveInProject(finished, `saved-crossing-${tool.toLowerCase()}.bcad`);
    await f.freshOpen(saved, finished, tool + '-reopened');
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
    await chooser.setFiles({ name: fileName, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
    await f.same(source);
  }
}

async function visibilityControl() {
  f.phase = 'retire the crossing cue when the drawing tool changes';
  await begin(3);
  await hover([...target, 3], 'Crossing');
  await f.tool('Slot', 'o');
  await cue().waitFor({ state: 'hidden' });
  await hover([...target, 3], null);
  await f.tool('Rectangle', 'r');
  await hover([...target, 3], 'Crossing');

  f.phase = 'retire a held cue when the original body is hidden';
  const browser = f.page.getByRole('complementary', { name: 'Browser', exact: true });
  await button(browser, 'Hide body').press('Space');
  await cue().waitFor({ state: 'hidden' });
  await f.ready();
  const first = await hover([...target, 3], null);
  const hidden = await f.snapshot('07-hidden-crossing');
  await f.page.mouse.click(...first);
  await f.page.mouse.click(...await hover([...other, 3], null));
  const grid = await f.finishSketch('08-hidden-grid');
  assert.deepEqual(grid.doc.nodes[2].max, [4, 6]);
  await f.undo();
  await f.same(hidden.doc);

  await begin(3);
  await button(browser, 'Show body').press('Space');
  await f.ready();
  await hover([...target, 3], 'Crossing');
  const shown = await f.snapshot('09-shown-crossing');
  assert.deepEqual(shown.doc.nodes, source.nodes);
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await cue().waitFor({ state: 'hidden' });
}

async function tiltedCentreArc() {
  f.phase = 'Centre arc first anchor on a tilted plane';
  await begin(0);
  await tilt();
  const toWorld = ([x, y]) => [x, 3.6 + 0.8 * y, 4.8 - 0.6 * y];
  const z = (6 - 0.6 * target[1]) / 0.8;
  await f.page.mouse.click(...await hover(toWorld([1, 8]), null));
  await f.page.mouse.click(...await hover(toWorld([8, 12]), null));
  await f.tool('Centre arc', 'q');
  await button(f.page, 'Construction').click();
  const [x, y] = await pixel([...target, z]);
  await f.page.mouse.move(x + 2, y);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const anchor = await f.snapshot('centre-arc-anchor');
  assert.equal(anchor.cue, 'Crossing', 'Centre arc centre');
  assert.deepEqual(anchor.doc, source);
  await f.page.mouse.click(x + 2, y);
  await cue().waitFor({ state: 'hidden' });
  await f.tool('Line', 'l');
  await f.tool('Centre arc', 'q');
  await hover([...target, z], 'Crossing');
  await f.page.mouse.click(x + 2, y);
  await cue().waitFor({ state: 'hidden' });
  const anotherCrossing = [source.nodes[0].max[0], target[1], z];
  await hover(anotherCrossing, null);
  await f.page.mouse.click(...await hover(toWorld([10, 3]), null));
  await hover(anotherCrossing, null);
  const sweepEnd = await hover(toWorld([4, 9]), null);
  await f.snapshot('centre-arc-sweep');
  await f.page.mouse.click(...sweepEnd);
  const finished = (await f.finishSketch('centre-arc-finish')).doc;
  assert.deepEqual(finished.nodes.slice(0, 2), source.nodes);
  assert.deepEqual(finished.outputs, source.outputs);
  const sketch = finished.nodes[2];
  sketch.plane.origin.forEach((value, axis) => near(value, [0, 3.6, 4.8][axis]));
  assert.deepEqual(sketch.plane.normal, [0, 0.6, 0.8]);
  assert.deepEqual(sketch.plane.xAxis, [1, 0, 0]);
  assert.equal(sketch.construction.length, 1);
  const [arc] = sketch.construction;
  assert.equal(arc.construction, true);
  assert.equal(arc.closed, false);
  const [a, b] = arc.points;
  assert.deepEqual(a, [10, 3]);
  const bulge = arc.bulges[0];
  assert.ok(bulge > 0 && bulge < 1);
  // Recover the centre from the persisted chord and the signed sweep.
  const sweep = 4 * Math.atan(bulge);
  assert.ok(Math.abs(sweep - 1.6877130385506605) < 1e-8);
  const scale = 0.5 / Math.tan(sweep / 2);
  const recovered = [(a[0] + b[0]) / 2 - (b[1] - a[1]) * scale, (a[1] + b[1]) / 2 + (b[0] - a[0]) * scale];
  const error = Math.hypot(recovered[0] - 4.2346, recovered[1] - 3.4321);
  assert.ok(error < 1e-6, `centre error ${error} mm`);
  f.report.observations.push({ label: 'centre-arc', sketch, recovered, error, sweep });
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(finished);
  const saved = await saveInProject(finished, 'saved-crossing-centre-arc.bcad');
  await f.freshOpen(saved, finished, 'centre-arc-reopened');
}

async function replacementControl() {
  f.phase = 'replace the part with the same body identity while a crossing is shown';
  const move = 5;
  const shift = ([x, y]) => [x + move, y];
  const replacement = { ...source, nodes: [
    { ...source.nodes[0], min: shift(source.nodes[0].min), max: shift(source.nodes[0].max) },
    source.nodes[1],
  ] };
  await begin(3);
  await hover([...target, 3], 'Crossing');
  const [open] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await open.setFiles({ name: fileName, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
  await f.same(replacement);
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await cue().waitFor({ state: 'hidden' });
  await begin(3);
  await hover([...target, 3], null);
  await hover([...shift(target), 3], 'Crossing');
  await f.snapshot('10-replacement-crossing');
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await cue().waitFor({ state: 'hidden' });
  await f.same(replacement);
}

async function snappedCircleRadius() {
  f.phase = 'preview the Circle radius at a native End with the grid off';
  await begin(10);
  await f.tool('Circle', 'c');
  const grid = button(f.page, 'Grid snap');
  for (let i = 0; i < 5; i++) await grid.click();
  assert.match(await grid.textContent(), /Grid off/);
  const centre = await hover([0, 0, 10], 'Origin');
  await f.page.mouse.click(...centre);
  await cue().waitFor({ state: 'hidden' });
  await f.page.mouse.move(centre[0] + 2, centre[1]);
  await hover([0, 0, 10], null);
  const [x, y] = await pixel([...target, 10]);
  await f.page.mouse.move(x + 2, y);
  await cue().waitFor();
  assert.equal(await cue().textContent(), 'End');
  const radius = Math.hypot(...endpoint);
  const readDiameter = async () => Number((await f.page.locator('.dim-text').getByText(/^Ø/).textContent()).slice(1));
  const preview = await f.snapshot('circle-end-preview');
  assert.deepEqual(preview.doc, source);
  assert.ok(Math.abs(await readDiameter() - 2 * radius) <= 5e-5, 'preview diameter must reach End');
  await f.page.mouse.click(x + 2, y);
  assert.ok(Math.abs(await readDiameter() - 2 * radius) <= 5e-5, 'accepted diameter must reach End');
  const finished = (await f.finishSketch('circle-end-finish')).doc;
  assert.deepEqual(finished.nodes.slice(0, 2), source.nodes);
  assert.deepEqual(finished.outputs, source.outputs);
  const sketch = finished.nodes[2];
  assert.equal(sketch.profile, 'circle');
  assert.deepEqual(sketch.center, [0, 0]);
  near(sketch.radius, radius);
  f.report.observations.push({ label: 'circle-end-radius', sketch, snapPoint: endpoint, radius });
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(finished);
  const saved = await saveInProject(finished, 'saved-circle-end-radius.bcad');
  await f.freshOpen(saved, finished, 'circle-end-reopened');
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · circle').click();
  await f.openExtrudeHud();
  const applied = await f.applyExtrude({ distance: 2, previous: finished, label: 'circle-end-solid' });
  const [stock, cylinder] = await f.inspect('circle-end-native', applied.doc, 'extrude');
  assert.ok(stock.valid && cylinder.valid);
  near(stock.volume, 2800);
  const expectedVolume = Math.PI * radius ** 2 * 2;
  near(cylinder.volume, expectedVolume);
  f.report.observations.push({ label: 'circle-end-extrude', expectedVolume, volume: cylinder.volume });
}

async function snappedSlotWidth() {
  f.phase = 'preview a fractional Slot width at a native End';
  await begin(10);
  await f.tool('Slot', 'o');
  const grid = button(f.page, 'Grid snap');
  for (let i = 0; i < 5; i++) await grid.click();
  assert.match(await grid.textContent(), /Grid off/);
  const [, maxY] = source.nodes[0].max, [maxX] = source.nodes[0].max;
  const a = endpoint, b = [24.2346, 20.3457];
  const length = Math.hypot(20, 14), radius = 280 / length;
  await f.page.mouse.click(...await hover([...target, 10], 'End'));
  await f.page.mouse.click(...await hover([maxX, maxY, 10], 'End'));
  await cue().waitFor({ state: 'hidden' });
  const secondCentre = await pixel([maxX, maxY, 10]);
  await f.page.mouse.move(secondCentre[0] + 2, secondCentre[1]);
  await hover([maxX, maxY, 10], null);
  const [x, y] = await pixel([target[0], maxY, 10]);
  await f.page.mouse.move(x + 2, y);
  await cue().waitFor();
  assert.equal(await cue().textContent(), 'End');
  const readWidth = async () => Number(await f.sketchPanel().locator('#sk-slot-width').inputValue());
  const preview = await f.snapshot('slot-end-preview');
  assert.deepEqual(preview.doc, source);
  assert.ok(Math.abs(await readWidth() - 2 * radius) <= 5e-5, 'preview width must reach End');
  await f.page.mouse.click(x + 2, y);
  assert.ok(Math.abs(await readWidth() - 2 * radius) <= 5e-5, 'accepted width must reach End');
  const finished = (await f.finishSketch('slot-end-finish')).doc;
  assert.deepEqual(finished.nodes.slice(0, 2), source.nodes);
  assert.deepEqual(finished.outputs, source.outputs);
  const sketch = finished.nodes[2];
  assert.equal(sketch.profile, 'loop');
  const arcs = sketch.segments.filter(segment => segment.kind === 'arc');
  assert.deepEqual(arcs.map(arc => arc.center), [b, a]);
  for (const arc of arcs) near(Math.hypot(arc.start[0] - arc.center[0], arc.start[1] - arc.center[1]), radius);
  f.report.observations.push({ label: 'slot-end-width', sketch, length, radius, width: 2 * radius });
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(finished);
  const saved = await saveInProject(finished, 'saved-slot-end-width.bcad');
  await f.freshOpen(saved, finished, 'slot-end-reopened');
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · outline').click();
  await f.openExtrudeHud();
  const applied = await f.applyExtrude({ distance: 2, previous: finished, label: 'slot-end-solid' });
  const [stock, slot] = await f.inspect('slot-end-native', applied.doc, 'extrude');
  assert.ok(stock.valid && slot.valid);
  near(stock.volume, 2800);
  const expectedVolume = 2 * (2 * radius * length + Math.PI * radius ** 2);
  near(slot.volume, expectedVolume);
  f.report.observations.push({ label: 'slot-end-extrude', expectedVolume, volume: slot.volume });
}

async function circleAtConstructionEndpoint() {
  f.phase = 'author a Circle through a construction endpoint on a tilted plane';
  await begin(0);
  await tilt();
  const toWorld = ([x, y]) => [x, 3.6 + 0.8 * y, 4.8 - 0.6 * y];
  const a = [12.5, 16.5], b = [21.5, 28.5], middle = [17, 22.5], radius = 7.5;
  const grid = button(f.page, 'Grid snap');
  await grid.click();
  assert.match(await grid.textContent(), /Grid 0.5 mm/);
  await f.tool('Line', 'l');
  await button(f.page, 'Construction').click();
  await f.page.mouse.click(...await hover(toWorld(a), null));
  await f.page.mouse.click(...await hover(toWorld(b), null));
  await f.tool('Circle', 'c');
  await button(f.page, 'Construction').click();
  for (let i = 0; i < 4; i++) await grid.click();
  assert.match(await grid.textContent(), /Grid off/);
  await f.page.mouse.click(...await hover(toWorld(middle), 'Middle'));
  const [x, y] = await pixel(toWorld(a));
  await f.page.mouse.move(x + 2, y);
  await cue().waitFor();
  assert.equal(await cue().textContent(), 'End');
  await f.page.locator('.dim-text').getByText('Ø15', { exact: true }).waitFor();
  await f.snapshot('construction-end-circle-preview');
  await f.page.mouse.click(x + 2, y);
  const finished = (await f.finishSketch('construction-end-circle-finish')).doc;
  assert.deepEqual(finished.nodes.slice(0, 2), source.nodes);
  assert.deepEqual(finished.outputs, source.outputs);
  const sketch = finished.nodes[2];
  assert.equal(sketch.profile, 'circle');
  assert.deepEqual(sketch.center, middle);
  assert.equal(sketch.radius, radius);
  assert.deepEqual(sketch.plane.normal, [0, 0.6, 0.8]);
  assert.deepEqual(sketch.construction[0].points, [a, b]);
  for (const [x, y] of sketch.construction[0].points) near(Math.hypot(x - middle[0], y - middle[1]), radius);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(finished);
  const saved = await saveInProject(finished, 'saved-construction-end-circle.bcad');
  await f.freshOpen(saved, finished, 'construction-end-circle-reopened');
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · circle').click();
  await f.openExtrudeHud();
  const applied = await f.applyExtrude({ distance: 2, previous: finished, label: 'construction-end-circle-solid' });
  const [stock, cylinder] = await f.inspect('construction-end-circle-native', applied.doc, 'extrude');
  assert.ok(stock.valid && cylinder.valid);
  near(stock.volume, 2800);
  const expectedVolume = Math.PI * radius ** 2 * 2;
  near(cylinder.volume, expectedVolume);
  f.report.observations.push({ label: 'construction-end-circle', sketch, expectedVolume, volume: cylinder.volume });
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin, newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, deviceScaleFactor, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  assert.equal(await f.page.evaluate(() => window.devicePixelRatio), deviceScaleFactor);
  f.report.observations.push({ label: 'viewport', deviceScaleFactor });
  const bytes = Buffer.from(JSON.stringify(source));
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: fileName, mimeType: 'application/json', buffer: bytes });
  await f.same(source);
  f.report.observations.push({ label: 'source', bytes: bytes.length, sha256: sha256(bytes) });
  checkNative(await f.inspect('source-edge', source));
  if (constructionCircleRadius) {
    await circleAtConstructionEndpoint();
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (slotEndWidth) {
    await snappedSlotWidth();
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (circleEndRadius) {
    await snappedCircleRadius();
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (centreArc) {
    await tiltedCentreArc();
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (anchorTools) {
    await tiltedAnchorTools();
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  f.phase = 'certified interior crossing wins over the grid';
  const accepted = endpoint;
  const finished = await draw(3, '01-interior', 'Crossing', accepted);
  await f.openExtrudeHud();
  const applied = await f.applyExtrude({ distance: 2, previous: finished, label: '02-profile-solid' });
  const [stock, solid] = await f.inspect('profile-native', applied.doc, 'extrude');
  assert.ok(stock.valid && solid.valid);
  assert.equal(solid.id, 'n3');
  near(stock.volume, 2800);
  near(solid.volume, (accepted[0] - other[0]) * (accepted[1] - other[1]) * 2);
  assert.equal(solid.corners.length, 8);
  for (const x of [other[0], accepted[0]]) for (const y of [other[1], accepted[1]]) for (const z of [3, 5]) {
    assert.ok(solid.corners.some(point => Math.hypot(point[0] - x, point[1] - y, point[2] - z) <= 1e-9));
  }
  const residual = Math.hypot(accepted[0] - target[0], accepted[1] - target[1]);
  f.report.observations.push({ label: 'native-extrude', residual, solid });
  await f.undo();
  await f.same(finished);
  await f.redo();
  await f.same(applied.doc);
  const saved = await saveInProject(applied.doc);
  await f.freshOpen(saved, applied.doc, '02a-fresh-open');
  assert.deepEqual(await f.inspect('reopened-native', applied.doc, 'extrude'), [stock, solid]);
  const [reopen] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await reopen.setFiles({ name: fileName, mimeType: 'application/json', buffer: bytes });
  await f.same(source);

  f.phase = 'regular endpoint remains available at the original cap';
  await draw(0, '03-endpoint', 'End', endpoint);
  await f.undo();
  await f.same(source);

  f.phase = 'the infinite line above the native edge remains without a cue';
  await begin(11);
  await hover([...target, 11], null);
  await f.snapshot('04-outside-finite-edge');
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(source);
  await tiltedControl();
  await visibilityControl();
  await replacementControl();
  assert.deepEqual(f.report.downloads, []);
});
