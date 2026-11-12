import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/native-centre-snap-browser.mjs',
  'apps/cad-studio/src/viewport/modelSketchSnaps.ts',
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'packages/barocss-cad-model/src/sketch/osnap.ts',
  'packages/barocss-cad-model/src/engine/mesh.ts',
  'packages/barocss-cad-model/src/engine/meshWire.ts',
  ...(!baseline ? ['packages/barocss-cad-model/src/engine/nativeCircle.ts'] : []),
];
const f = await createFlow({
  name: 'native-centre-snap', output, envFrozen: 'D855_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce a false Centre snap from an actual polynomial Loft edge'
    : 'Use only native circular edge centres in the actual XZ sketch input',
  limits: ['One polynomial Loft guide and one separate native circular control.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { faceGeometry } from '@barocss/cad';
import { evaluateDoc, partBreps } from '@barocss/cad-model/engine/evaluate';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = evaluateDoc(doc, 0);
if (!result.ok) throw Error(result.error.detail);
const brep = partBreps(doc)[0].brep, mesh = result.bodies[0].mesh;
if (JSON.parse(process.argv[3] ?? 'null') === 'circle') {
  console.log(JSON.stringify({
    cylinders: brep.faces.map(face => faceGeometry(face)).filter(face => face.kind === 'cylinder'),
    support: mesh.edges.map(edge => edge.nativeCircle).filter(Boolean),
    volume: result.bodies[0].volume,
  }));
  process.exit(0);
}
const edge = mesh.edges.find(edge => !edge.straight && edge.names.includes('n1.side0|n1.side3'));
const native = brep.edges.find(edge => edge.name === 'n1.side0|n1.side3');
if (!edge || !native) throw Error('The declared polynomial Loft edge is missing.');
const points = [];
for (let i = 0; i < mesh.edgeOfSegment.length; i += 2) {
  if (mesh.edgeOfSegment[i] === edge.index) points.push(Array.from(mesh.edgeLines.slice(i * 3, i * 3 + 3)));
}
console.log(JSON.stringify({ edge, native: native.curve, points }));
`,
  snapshotExtra: () => ({
    cue: document.querySelector('.sk-osnap text')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});
const xz = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
const loft = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    { id: 'n1', kind: 'loft', from: [0, 0], sections: [{ sketch: 0, z: 0 }, { sketch: 0, z: 20 }],
      guide: { kind: 'nurbs', degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [[0, 0, 0], [10, 0, 10], [0, 0, 20]] } },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
};
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const snapCue = () => f.page.locator('.sk-osnap text');
const fakeCentre = [-8.59375, 10.3515625], grid = [-9, 10], opposite = [-3, 16];
const loftName = 'D855-polynomial-loft', owned = 'D855-' + randomUUID(), circleCentre = [30.375, 8.625];
const circle = { ...loft, nodes: [
  { kind: 'sketch', id: 'n0', profile: 'circle', plane: xz, center: circleCentre, radius: 3 },
  { kind: 'extrude', id: 'n1', sketch: 0, height: 4 },
] };
const round = x => Math.round(x * 1e4) / 1e4;
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

async function openBytes(buffer, name) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer });
}
async function open(doc, name = loftName) {
  await openBytes(Buffer.from(JSON.stringify(doc)), name);
  await f.same(doc);
}
async function project([x, z]) {
  return f.page.evaluate(point => {
    const pixel = window.__studioScreenOf(point);
    return pixel && document.elementFromPoint(...pixel)?.closest('.vp-canvas') ? pixel : null;
  }, [x, 0, z]);
}
async function begin(points) {
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xz');
  await f.tool('Rectangle', 'r');
  for (let i = 0; i < 8; i++) {
    const positions = await Promise.all(points.map(project));
    if (positions.every(Boolean)) return;
    const box = await f.page.locator('.vp-canvas').boundingBox();
    await f.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await f.page.mouse.wheel(0, 300);
    await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  assert.fail('Could not frame the declared XZ points.');
}
async function hover(point, cue) {
  const pixel = await project(point);
  assert.ok(pixel, 'The XZ point is on the canvas.');
  await f.page.mouse.move(...pixel);
  await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (cue) {
    await snapCue().waitFor();
    assert.equal(await snapCue().textContent(), cue);
  } else await snapCue().waitFor({ state: 'hidden' });
  return pixel;
}
async function cancel(label, before) {
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  const after = await f.snapshot(label);
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty']) assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(after.selection.selection, before.selection.selection);
}
async function nativeLoft(doc, label) {
  const data = await f.inspect(label, doc);
  assert.equal(data.native.degree, 2);
  assert.ok(data.native.weights.every(weight => weight === 1));
  assert.equal(data.points.length, 8);
  for (const [index, [x, y, z]] of data.points.entries()) {
    const t = index / 8;
    near(x, 20 * t * (1 - t)); near(y, 0); near(z, 20 * t);
  }
  const [x, z] = fakeCentre, radius = Math.hypot(x, z);
  for (const index of [0, 2, 5]) near(Math.hypot(data.points[index][0] - x, data.points[index][2] - z), radius);
  const otherRadius = Math.hypot(data.points[4][0] - x, data.points[4][2] - z);
  assert.ok(Math.abs(otherRadius - radius) > 0.1);
  if (!baseline) assert.equal(data.edge.nativeCircle, undefined);
  f.report.observations.push({ label, nativeEdge: data.edge.names, points: data.points,
    falseCentre: fakeCentre, thirdPointCircleRadius: radius, otherRadius });
}
function rectangle(doc, a, b, source) {
  const node = doc.nodes.at(-1);
  assert.equal(node.kind, 'sketch');
  assert.equal(node.profile, 'rectangle');
  assert.deepEqual(node.plane, xz);
  assert.deepEqual(node.min, a);
  assert.deepEqual(node.max, b);
  assert.deepEqual(doc.nodes.slice(0, -1), source.nodes);
  assert.deepEqual(doc.outputs, source.outputs);
}

async function saveOwned(doc) {
  const name = loftName + '.bcad', versions = f.page.getByLabel('Versions panel', { exact: true });
  if (!(await versions.isVisible())) await button(f.page, 'Project and versions').click();
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(owned);
  await button(versions, 'Project in this browser').click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const root = await navigator.storage.getDirectory(), projects = await root.getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project), file = await (await directory.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [owned, name]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  await button(versions, 'Close project').click();
  await versions.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.evaluate(async project => {
    const root = await navigator.storage.getDirectory(), projects = await root.getDirectoryHandle('projects');
    await projects.removeEntry(project, { recursive: true });
  }, owned);
  return bytes;
}

await f.run(async () => {
  await f.newPage();
  f.phase = 'open and independently inspect the exact polynomial Loft';
  await open(loft);
  await nativeLoft(loft, 'native-polynomial-loft');
  const before = await f.snapshot('01-loft-before-sketch');
  f.phase = 'hover the old false centre in the XZ sketch';
  await begin([fakeCentre, opposite, [0, 20], [5, 20]]);
  await hover(fakeCentre, baseline ? 'Centre' : null);
  await f.snapshot('02-loft-centre-cue');
  if (!baseline) {
    await hover([0, 20], 'End');
    await hover([5, 20], 'Middle');
  }
  await cancel('03-loft-sketch-cancelled', before);

  f.phase = 'commit a rectangle from the same real pointer';
  await begin([fakeCentre, opposite]);
  await f.page.mouse.click(...await hover(fakeCentre, baseline ? 'Centre' : null));
  await f.page.mouse.click(...await hover(opposite, null));
  const after = (await f.finishSketch('04-loft-authored-sketch')).doc;
  rectangle(after, baseline ? fakeCentre.map(round) : grid, opposite, loft);
  await f.undo();
  await f.same(loft);
  await f.redo();
  await f.same(after);
  f.report.observations.push({ label: 'authored-loft-sketch', selectedCorner: after.nodes.at(-1).min, sourceUnchanged: true });
  if (!baseline) {
    f.phase = 'reopen the exact saved Loft and authored sketch';
    const bytes = await saveOwned(after);
    await f.newPage();
    await openBytes(bytes, loftName);
    await f.same(after);
    rectangle(await f.doc(), grid, opposite, loft);
    await nativeLoft(after, 'native-reopened-loft');

    f.phase = 'keep Centre on an actual native circle in the same XZ plane';
    await open(circle, 'D855-native-circle');
    const native = await f.inspect('native-circular-control', circle, 'circle');
    assert.ok(native.cylinders.length >= 1 && native.cylinders.every(cylinder => Math.abs(cylinder.r - 3) < 1e-7));
    near(native.volume, 36 * Math.PI);
    const [x, z] = circleCentre;
    assert.ok(native.support.some(arc => Math.hypot(arc.centre[0] - x, arc.centre[1], arc.centre[2] - z) < 1e-7));
    const to = [36, 16];
    await begin([circleCentre, to]);
    const aimed = [x + 0.05, z + 0.04];
    await f.page.mouse.click(...await hover(aimed, 'Centre'));
    await f.snapshot('05-native-circle-centre');
    await f.page.mouse.click(...await hover(to, null));
    const positive = (await f.finishSketch('06-circle-authored-sketch')).doc;
    rectangle(positive, circleCentre, to, circle);
    f.report.observations.push({ label: 'authored-circle-sketch', selectedCorner: positive.nodes.at(-1).min, radius: 3 });
  }
  assert.deepEqual(f.report.downloads, []);
});
