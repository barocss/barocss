import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const baseline = process.argv[3] === '--baseline';
const pins = [
  'apps/cad-studio/test/translated-extrude-end-face-browser.mjs',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/engine/faceEndExtrude.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
];
const f = await createFlow({
  name: 'translated-extrude-end-face', output: process.argv[2], envFrozen: 'D843_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Measure the pre-extension command and Open behavior on a translated XY source.'
    : 'Qualify a common XYZ translation of a literal XY profile and its native lower cap, including negative world Z.',
  limits: ['One translated XY rectangle, positive travel, one current downward native rectangular cap, desktop WebGPU.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const part = toPartDocument(doc), result = evaluateCadPart(part);
console.log(JSON.stringify({
  extrusion: part.features.find(feature => feature.id === 'n3'),
  outputs: result.outputs.map(output => ({
    id: output.id, valid: checkOutput(output).valid, count: output.bodyCount, mass: massPropertiesOf(output),
    corners: output.brep.vertices.map(vertex => vertex.point),
    faces: output.brep.faces.filter(face => face.name === output.id + (output.id === 'n1' ? '.bottom' : '.top'))
      .map(face => {
        const plane = faceGeometry(face);
        return { name: face.name, normal: plane.kind === 'plane' ? plane.n : null, levels: face.surface.controlPoints.flat().map(point => point[2]) };
      }),
  })),
}));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});
const offset = [12, -7, -100];
const world = ([x, y, z]) => [x + offset[0], y + offset[1], z + offset[2]];
const recipe = {
  id: 'n3', kind: 'face-end-extrude', sketch: 2,
  target: { body: { node: 1, side: 'solid' }, feature: 'n1', face: 'n1.bottom' },
};
const sourceAt = (localZ, bound) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: world([-5, -5, 0]).slice(0, 2), max: world([15, 15, 0]).slice(0, 2) },
    { id: 'n1', kind: 'extrude', sketch: 0, from: world([0, 0, localZ])[2], height: 5 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10], plane: { origin: offset, normal: [0, 0, 1], xAxis: [1, 0, 0] } },
    ...(bound ? [recipe] : []),
  ],
  outputs: { b1: { node: 1, side: 'solid' }, ...(bound ? { b3: { node: 3, side: 'solid' } } : {}) }, nextId: bound ? 4 : 3,
});
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const field = (panel, name) => panel.getByLabel(name, { exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-8;
const name = 'D843-translated-face-end.bcad', project = 'D843 translated face end ' + randomUUID();
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });

async function open(file, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}

async function geometry(label, travel) {
  const expected = sourceAt(travel, true);
  assert.deepEqual(await f.doc(), expected);
  await f.ready();
  const native = await f.inspect(label, expected);
  assert.deepEqual(native.extrusion, { id: 'n3', kind: 'extrude', sketch: 'n2', height: travel });
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b1', 'b3']);
  assert.equal(native.outputs.length, 2);
  const targetZ = world([0, 0, travel])[2];
  for (const [id, square, lo, hi, volume, centroid] of [
    ['n1', [-5, 15], travel, travel + 5, 2000, world([5, 5, travel + 2.5])],
    ['n3', [0, 10], 0, travel, 100 * travel, world([5, 5, travel / 2])],
  ]) {
    const exact = native.outputs.find(output => output.id === id);
    assert.ok(exact?.valid && exact.count === 1);
    assert.equal(exact.corners.length, 8);
    const corners = square.flatMap(x => square.flatMap(y => [lo, hi].map(z => world([x, y, z]))));
    assert.ok(corners.every(point => exact.corners.some(corner => corner.every((value, i) => near(value, point[i])))));
    assert.equal(exact.faces.length, 1);
    assert.ok(exact.faces[0].normal?.every((value, i) => near(value, [0, 0, id === 'n1' ? -1 : 1][i])));
    assert.ok(exact.faces[0].levels.length >= 4 && exact.faces[0].levels.every(z => near(z, targetZ)));
    for (const measured of [exact.mass, bodies.find(body => body.key === 'b' + id.slice(1))]) {
      assert.ok(near(measured.volume, volume));
      assert.ok(measured.centroid.every((value, i) => near(value, centroid[i])));
    }
  }
  f.report.observations.push({ label, offset, sourceZ: offset[2], targetAndEndZ: targetZ, travel, extrusionVolumeMm3: 100 * travel, nativeCorners: 16 });
}

async function pickLowerCap() {
  await button(f.page, 'View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Bottom', exact: true }).click();
  await f.page.waitForFunction(() => {
    const labels = [...document.querySelectorAll('.view-cube .vc-label')];
    return labels.length === 1 && labels[0].textContent === 'BOTTOM';
  });
  const pixel = await f.page.evaluate(point => {
    const xy = window.__studioScreenOf(point);
    return xy && document.elementFromPoint(...xy)?.closest('.vp-canvas') ? xy : null;
  }, world([13, 13, 20]));
  assert.ok(pixel);
  await f.page.mouse.click(...pixel);
}

async function setStartZ(z, expected) {
  await f.openFeatureEditor(1, 'target start Z');
  const before = await f.doc();
  await field(f.editor(), 'Start Z').fill(String(z));
  await button(f.editor(), 'Apply').click();
  if (expected) {
    await f.changed(before);
    await f.editor().waitFor({ state: 'hidden' });
  } else {
    const error = f.editor().locator('.hud-error');
    await error.waitFor();
    assert.match(await error.textContent(), /positive Z/i);
    assert.deepEqual(await f.doc(), before);
    await f.closeEditor();
  }
}

await f.run(async () => {
  await f.newPage();
  const seed = sourceAt(20, false);
  f.phase = 'open and select the translated rectangle';
  await open(name, seed);
  await f.same(seed);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await f.editor().waitFor();
  await f.closeEditor();
  await f.openExtrudeHud();
  const hud = f.hud(), depth = field(hud, 'Depth');
  assert.equal(await field(hud, 'Distance').inputValue(), '8');
  if (baseline) {
    assert.equal(await depth.count(), 0);
    await button(hud, 'Cancel').click();
    await hud.waitFor({ state: 'hidden' });
    f.phase = 'the pre-extension Studio opens the authored recipe and cannot evaluate it';
    await open('D843-translated-candidate.bcad', sourceAt(20, true));
    const notice = await f.waitToast(/literal rectangle on the default XY plane/i);
    assert.deepEqual(await f.doc(), sourceAt(20, true));
    const failed = await f.snapshot('00-pre-extension-refusal');
    assert.equal(failed.bodies.fresh, false);
    assert.deepEqual(failed.bodies.bodies.map(body => body.key), ['b1']);
    await f.undo();
    assert.deepEqual(await f.doc(), seed);
    f.report.observations.push({ label: 'pre-extension-refusal', offset, fixedDistancePreview: 8, notice, failedGeometryFresh: false, undoRestoredSeed: true });
    return;
  }
  f.phase = 'create a bound end on the translated XY rectangle';
  await depth.selectOption('to-face');
  await pickLowerCap();
  await hud.getByText('n1.bottom', { exact: true }).waitFor();
  const apply = button(hud, 'Apply');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  await f.snapshot('01-translated-preview');
  await apply.click();
  await f.changed(seed);
  await geometry('translated-applied', 20);
  const accepted = await f.snapshot('02-translated-accepted');

  f.phase = 'refuse zero and reverse travel in negative world coordinates';
  await setStartZ(-100, false);
  await setStartZ(-101, false);
  const refused = await f.snapshot('03-travel-refused');
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(refused[key], accepted[key], key);
  await setStartZ(-70, true);
  await geometry('negative-world-z-target-moved', 30);
  await f.undo();
  await geometry('translated-first-undo', 20);
  await f.redo();
  await geometry('translated-first-redo', 30);

  f.phase = 'save the translated relation and reopen it after reload';
  async function attachProject() {
    if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
    await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await button(versions(), 'Project in this browser').click();
    await field(versions(), 'Project').waitFor();
  }
  await attachProject();
  const edited = await f.doc();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const root = await navigator.storage.getDirectory(), projects = await root.getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project), file = await (await directory.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), edited);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  await button(versions(), 'Close project').click();
  await field(versions(), 'Project').waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await attachProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(edited);
  await geometry('translated-reopened', 30);
  await setStartZ(-60, true);
  await geometry('translated-post-open-target-moved', 40);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot('04-translated-post-open');
  assert.deepEqual(f.report.downloads, []);
});
