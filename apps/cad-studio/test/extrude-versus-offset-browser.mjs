import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const producers = [
  'apps/cad-studio/test/extrude-versus-offset-browser.mjs',
  'apps/cad-studio/test/model-rail-helper.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useCommandGizmos.ts',
  'apps/cad-studio/src/state/useCommandPreview.ts',
  'packages/barocss-cad-model/src/app/editCommand.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/app/nativeOffsetFace.ts',
];
const f = await createFlow({
  name: 'extrude-versus-offset', output: process.argv[2], envFrozen: 'D895_SOURCE_FROZEN',
  initialFiles: producers, requiredFrozen: producers,
  qualification: 'Compare a picked Extrude driver edit with an explicit native cap Offset face.',
  limits: ['One native 20 × 10 mm axis-aligned prism and one positive cap.', 'Real face and handle pointers, field values and UI history.',
    'Analytic box volume, centroid and support planes, independent of display bounds.', 'No export, downloads, mobile or arbitrary direct-edit admission.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import { bodyMesh } from '@barocss/cad-model/engine/mesh';
import { partSnapshot } from '@barocss/cad-model/engine/part';
if (process.argv[3] === '"seed"') {
  console.log(JSON.stringify(rectanglePart(20, 10, 5)));
  process.exit(0);
}
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { outputs } = partSnapshot(doc);
assert.equal(outputs.length, 1);
const [output] = outputs;
const { brep } = output;
assert.ok(checkBrep(brep, { strict: true }).valid);
assert.deepEqual(brep.bodies.map(b => b.kind), ['solid']);
assert.equal(brep.shells.length, 1);
assert.ok(brep.shells[0].closed);
console.log(JSON.stringify({
  mass: massPropertiesOf(output),
  faces: brep.faces.map(face => ({ name: face.name, geometry: faceGeometry(face) })),
  vertices: brep.vertices.map(vertex => vertex.point),
  displayFaces: bodyMesh(brep, 0).faces.map(({ index, name, normal }) => ({ index, name, normal })),
}));
`,
});

const filename = 'D895-edit-and-offset.bcad';
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const hud = () => f.page.locator('.hud');
const status = text => f.page.waitForFunction(value => document.querySelector('.hud .status')?.textContent === value, text);
const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);

async function open(doc, bytes = Buffer.from(JSON.stringify(doc))) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
}

async function save(doc, name) {
  await button(f.page, 'Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(name);
  await button(panel, 'Project in this browser').click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await panel.getByRole('list', { name: 'Project documents' }).getByText(filename, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, file]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, [name, filename]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  return bytes;
}

async function box(label, doc, height) {
  await f.same(doc);
  const native = await f.inspect(`${label}-native`, doc);
  near(native.mass.volume, 200 * height);
  native.mass.centroid.forEach((v, i) => near(v, [10, 5, height / 2][i]));
  const lo = [0, 1, 2].map(i => Math.min(...native.vertices.map(p => p[i])));
  const hi = [0, 1, 2].map(i => Math.max(...native.vertices.map(p => p[i])));
  lo.forEach(value => near(value, 0));
  hi.forEach((value, i) => near(value, [20, 10, height][i]));
  const support = new Set();
  for (const face of native.faces) {
    const plane = face.geometry;
    assert.equal(plane.kind, 'plane');
    const axis = plane.n.findIndex(n => Math.abs(n) > 0.999999);
    assert.ok(axis >= 0);
    plane.n.forEach((n, i) => { if (i !== axis) near(n, 0); });
    const sign = Math.sign(plane.n[axis]);
    near(plane.o[axis], sign > 0 ? hi[axis] : lo[axis]);
    support.add(`${axis}:${sign}`);
  }
  assert.equal(support.size, 6);
  const [worker] = (await f.bodies()).bodies;
  near(worker.volume, native.mass.volume);
  f.report.observations.push({ label, graph: doc.nodes.map(node => ({ id: node.id, kind: node.kind })),
    outputs: doc.outputs, volumeMm3: native.mass.volume, centroidMm: native.mass.centroid, boundsMm: [lo, hi],
    faces: native.faces.map(face => face.name) });
  return native;
}

async function pickCap(label, native, height) {
  const views = f.page.getByRole('group', { name: 'Views', exact: true });
  await button(views, 'Top').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const world = [10, 5, height];
  const point = await f.page.evaluate(world => {
    const at = window.__studioScreenOf(world);
    return at && document.elementFromPoint(...at)?.closest('canvas.vp-canvas') ? at : null;
  }, world);
  assert.ok(point);
  const caps = native.displayFaces.filter(face => face.normal[2] > 0.999999);
  assert.equal(caps.length, 1);
  const [cap] = caps;
  await f.page.mouse.click(...point);
  await f.page.waitForFunction(index => {
    const selection = window.__studioSelection?.selection;
    return selection?.faces.length === 1 && selection.faces[0].body === 0 && selection.faces[0].face === index
      && !selection.bodies.length && !selection.edges.length;
  }, cap.index);
  await f.snapshot(label);
  f.report.observations.push({ label, nativeCap: cap.name, index: cap.index, world, point });
  await button(views, 'Iso').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  return cap;
}

async function startDriverEdit() {
  const handle = f.page.locator('g.gizmo-handle[data-handle="h"]');
  await handle.waitFor();
  const [root, head] = await handle.evaluate(group => ['circle', 'polygon'].map(selector => {
    const r = group.querySelector(selector).getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  }));
  const delta = head.map((value, i) => value - root[i]), length = Math.hypot(...delta);
  assert.ok(length > 0);
  await f.page.mouse.move(...head);
  await f.page.mouse.down();
  await f.page.mouse.move(...head.map((value, i) => value + 10 * delta[i] / length), { steps: 4 });
  await f.page.mouse.up();
  await hud().getByLabel('Distance', { exact: true }).waitFor();
  await status('preview');
  assert.match(await hud().getAttribute('aria-label'), /^Edit Extrude/);
}

async function apply(previous, label) {
  const control = button(hud(), 'Apply');
  assert.ok(await control.isEnabled());
  await control.click();
  await f.changed(previous);
  await hud().waitFor({ state: 'hidden' });
  return (await f.snapshot(label)).doc;
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
  const seed = await f.inspect('seed', {}, 'seed');
  await f.newPage();
  await open(seed);
  const nativeSeed = await box('stock', seed, 5);
  f.phase = 'pick the native cap and use its original Extrude handle';
  const originalCap = await pickCap('01-original-cap', nativeSeed, 5);
  assert.equal(originalCap.name, 'n1.top');
  await startDriverEdit();
  await hud().getByLabel('Distance', { exact: true }).fill('7');
  await status('preview');
  await f.same(seed);
  await f.snapshot('02-edit-driver-preview');
  const edited = await apply(seed, '03-edited-driver');
  assert.deepEqual(edited, { ...seed, nodes: [seed.nodes[0], { ...seed.nodes[1], height: 7 }] });
  const driverNative = await box('driver-7', edited, 7);
  assert.deepEqual(driverNative.faces.map(face => face.name), nativeSeed.faces.map(face => face.name));
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(edited);
  const savedDriver = await save(edited, 'D895 original driver');
  await f.newPage();
  await open(edited, savedDriver);
  await box('driver-7-reopened', edited, 7);
  await f.snapshot('04-driver-reopened');

  f.phase = 'pick the same seed cap and start explicit Offset face';
  await open(seed);
  await pickCap('05-cap-for-offset', nativeSeed, 5);
  await clickModelCommand(f.page, 'Modify', 'Offset face');
  const offset = hud().getByLabel('Offset', { exact: true });
  await offset.fill('-5');
  await status('refused');
  assert.ok(await button(hud(), 'Apply').isDisabled());
  await f.same(seed);
  await f.snapshot('06-collapse-refused');
  await button(hud(), 'Cancel').click();
  await hud().waitFor({ state: 'hidden' });
  await f.same(seed);
  await clickModelCommand(f.page, 'Modify', 'Offset face');
  await offset.fill('2');
  await status('preview');
  await f.same(seed);
  await f.snapshot('07-offset-preview');
  const extended = await apply(seed, '08-offset-applied');
  assert.deepEqual(extended.nodes.slice(0, 2), seed.nodes);
  const [cap, extension, union] = extended.nodes.slice(2);
  assert.deepEqual(extended.nodes.slice(2).map(node => node.kind), ['sketch', 'extrude', 'union']);
  assert.deepEqual(cap.on, { node: 1, side: 'solid' });
  assert.equal(extension.sketch, 2);
  assert.equal(extension.height, 2);
  assert.deepEqual(union.left, { node: 1, side: 'solid' });
  assert.deepEqual(union.right, { node: 3, side: 'solid' });
  assert.deepEqual(extended.outputs, { b4: { node: 4, side: 'solid' } });
  await box('offset-2', extended, 7);
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(extended);
  const savedOffset = await save(extended, 'D895 appended offset');
  await f.newPage();
  await open(extended, savedOffset);
  await box('offset-2-reopened', extended, 7);
  await f.snapshot('09-offset-reopened');

  f.phase = 'edit the original Extrude after opening the Offset face recipe';
  await f.openFeatureEditor(1);
  await f.editor().getByLabel('Distance', { exact: true }).fill('6');
  const upstream = (await f.applyEditor(extended, '10-source-6-with-snapshot')).doc;
  assert.deepEqual(upstream, { ...extended, nodes: [seed.nodes[0], { ...seed.nodes[1], height: 6 }, ...extended.nodes.slice(2)] });
  await box('snapshot-stays-at-7', upstream, 7);
  await f.undo();
  await f.same(extended);
  await f.redo();
  await f.same(upstream);
});
