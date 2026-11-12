import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const baseline = process.argv[3] === '--baseline', create = process.argv[3] === '--create', detach = process.argv[3] === '--detach';
const pins = [
  'apps/cad-studio/test/face-end-extrude-browser.mjs',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  ...(create ? ['apps/cad-studio/src/app/extrudeEndFace.ts', 'packages/barocss-cad-model/src/app/extrudeEndFacePick.ts', 'packages/barocss-cad-model/src/app/profileCommands.ts'] : []),
  ...(detach ? ['apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/engine/engine.worker.ts'] : []),
  'packages/barocss-cad-model/src/engine/doc.ts',
  ...(baseline ? [] : ['packages/barocss-cad-model/src/engine/faceEndExtrude.ts']),
  'packages/barocss-cad-model/src/engine/migrate.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
];
const decision = detach ? 'D842' : create ? 'D841' : 'D840';
const f = await createFlow({
  name: 'face-end-extrude', output: process.argv[2], envFrozen: decision + '_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Verify legacy fixed distance and unsupported-kind Open in the pre-feature reader.'
    : create ? 'Author Extrude to face from the actual HUD and the original body face, then verify history and project reopen.'
    : detach ? 'Detach a saved end face at the exact current distance, preserve History and verify independence after project Open.'
    : 'Resolve a fixed XY rectangle to a preceding native cap and retain its two output bodies through target edits and Open.',
  limits: ['Two rectangular prisms in the same desktop document. Positive Z. One native rectangle cap.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const part = toPartDocument(doc), result = evaluateCadPart(part);
console.log(JSON.stringify({
  features: part.features,
  outputs: result.outputs.map(body => ({
    id: body.id, count: body.bodyCount, valid: checkOutput(body).valid, mass: massPropertiesOf(body),
    corners: body.brep.vertices.map(vertex => vertex.point),
    faces: body.brep.faces.map(face => ({ name: face.name, level: face.surface.kind === 'surface' ? face.surface.controlPoints.flat().map(point => point[2]) : [] })),
  })),
}));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});
const recipe = {
  id: 'n3', kind: 'face-end-extrude', sketch: 2,
  target: { body: { node: 1, side: 'solid' }, feature: 'n1', face: 'n1.bottom' },
};
const documentAt = (from, fixed, distance = 20) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-5, -5], max: [15, 15] },
    { id: 'n1', kind: 'extrude', sketch: 0, from, height: 5 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    fixed ? recipe : { id: 'n3', kind: 'extrude', sketch: 2, height: distance },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
});
const name = decision + '-face-end.bcad', project = decision + ' face end ' + randomUUID();
const near = (a, b) => Math.abs(a - b) < 1e-8;
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const field = (panel, name) => panel.getByLabel(name, { exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });

async function open(file, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}

async function geometry(label, from, cap, fixed) {
  const doc = documentAt(from, fixed, cap);
  assert.deepEqual(await f.doc(), doc);
  await f.ready();
  const native = await f.inspect(label, doc);
  const extrude = native.features.find(feature => feature.id === 'n3');
  assert.deepEqual(extrude, { id: 'n3', kind: 'extrude', sketch: 'n2', height: cap });
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b1', 'b3']);
  assert.equal(native.outputs.length, 2);
  for (const [key, range, lo, hi, volume, center, face, faceZ] of [
    ['n1', [-5, 15], from, from + 5, 2000, [5, 5, from + 2.5], 'n1.bottom', from],
    ['n3', [0, 10], 0, cap, 100 * cap, [5, 5, cap / 2], 'n3.top', cap],
  ]) {
    const output = native.outputs.find(output => output.id === key);
    assert.ok(output?.valid && output.count === 1);
    assert.equal(output.corners.length, 8);
    const corners = range.flatMap(x => range.flatMap(y => [lo, hi].map(z => [x, y, z])));
    assert.ok(corners.every(point => output.corners.some(actual => actual.every((value, i) => near(value, point[i])))));
    const selected = output.faces.filter(f => f.name === face);
    assert.equal(selected.length, 1);
    assert.ok(selected[0].level.length >= 4 && selected[0].level.every(value => near(value, faceZ)));
    for (const result of [output.mass, bodies.find(body => body.key === 'b' + key.slice(1))]) {
      assert.ok(near(result.volume, volume));
      assert.ok(result.centroid.every((v, i) => near(v, center[i])));
    }
  }
  f.report.observations.push({ label, targetCap: from, extrudeCap: cap, volume: 100 * cap, corners: 16, outputs: ['b1', 'b3'] });
}

async function editTargetStart(value) {
  await f.openFeatureEditor(1, 'target start Z');
  const before = await f.doc();
  await field(f.editor(), 'Start Z').fill(String(value));
  await button(f.editor(), 'Apply').click();
  await f.changed(before);
  await f.editor().waitFor({ state: 'hidden' });
}

async function attachProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await field(versions(), 'Project').waitFor();
}

async function pickCap(view, point) {
  await button(f.page, 'View cube directions').click();
  await f.page.getByRole('menuitem', { name: view, exact: true }).click();
  await f.page.waitForFunction(name => {
    const faces = [...document.querySelectorAll('.view-cube .vc-label')];
    return faces.length === 1 && faces[0].textContent === name;
  }, view.toUpperCase());
  const pixel = await f.page.evaluate(point => {
    const xy = window.__studioScreenOf(point);
    return xy && document.elementFromPoint(...xy)?.closest('.vp-canvas') ? xy : null;
  }, point);
  assert.ok(pixel, `${view} cap click reaches the canvas`);
  await f.page.mouse.click(...pixel);
}

async function authorFaceEnd() {
  f.phase = 'select a finished sketch and switch to To face';
  const full = documentAt(20, true);
  const initial = { ...full, nodes: full.nodes.slice(0, 3), outputs: { b1: full.outputs.b1 }, nextId: 3 };
  await open(name, initial);
  await f.same(initial);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await f.editor().waitFor();
  await f.closeEditor();
  await f.page.waitForFunction(() => window.__studioSelection?.selection?.sketches?.includes(2));
  await f.openExtrudeHud();
  const hud = f.hud(), depth = field(hud, 'Depth'), distance = field(hud, 'Distance'), apply = button(hud, 'Apply');
  const status = value => hud.locator('.status').filter({ hasText: new RegExp('^' + value + '$') }).waitFor();
  assert.equal(await depth.inputValue(), 'distance');
  assert.equal(await distance.inputValue(), '8');
  await depth.selectOption('to-face');
  await status('pick face');
  assert.equal(await distance.count(), 0);
  assert.equal(await field(hud, 'Draft').count(), 0);
  assert.equal(await apply.isDisabled(), true);
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('Enter');
  assert.deepEqual(await f.doc(), initial);
  await f.snapshot('00-awaiting-target');

  f.phase = 'refuse the upper cap in Studio and select the original lower cap';
  await pickCap('Top', [13, 13, 25]);
  await status('refused');
  assert.match(await hud.locator('.hud-error').textContent(), /must face down along Z/i);
  assert.deepEqual(await f.doc(), initial);
  await pickCap('Bottom', [13, 13, 20]);
  await status('preview');
  await hud.getByText('n1.bottom', { exact: true }).waitFor();
  assert.deepEqual(await f.doc(), initial);
  await f.snapshot('01-picked-target');

  f.phase = 'return to Distance then require a fresh pick';
  await depth.selectOption('distance');
  await status('preview');
  assert.equal(await distance.inputValue(), '8');
  await depth.selectOption('to-face');
  await status('pick face');
  assert.equal(await apply.isDisabled(), true);
  await pickCap('Bottom', [13, 13, 20]);
  await status('preview');
  f.phase = 'refuse the generated preview face, then pick the retained original cap again';
  await pickCap('Bottom', [5, 5, 0]);
  await f.waitToast(/End face not selected/);
  await status('preview');
  await pickCap('Bottom', [-3, -3, 20]);
  await status('preview');
  await hud.getByText('n1.bottom', { exact: true }).waitFor();
  assert.deepEqual(await f.doc(), initial);
  await apply.click();
  await f.changed(initial);
  await hud.waitFor({ state: 'hidden' });
  await geometry('authored-original-lower-cap', 20, 20, true);
  await f.undo();
  assert.deepEqual(await f.doc(), initial);
  await f.redo();
  await geometry('authored-first-redo', 20, 20, true);
  f.report.observations.push({ label: 'authored-control', wrongCap: 'n1.top', acceptedCap: 'n1.bottom', defaultDistanceMm: 8, outputsBefore: ['b1'], outputsAfter: ['b1', 'b3'] });
}

function holdFaceEndDistance() {
  const worker = Worker.prototype, send = worker.postMessage;
  const onmessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  let armed = false, target, held, deliver;
  worker.postMessage = function (request, ...args) {
    if (armed && request.type === 'faceEndDistance') {
      armed = false;
      target = { worker: this, id: request.id };
    }
    return Reflect.apply(send, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onmessage.get,
    set(callback) {
      onmessage.set.call(this, callback && function (event) {
        if (target?.worker === this && event.data?.id === target.id) {
          held = { id: target.id, distance: event.data.distance, error: event.data.error };
          deliver = () => callback.call(this, event);
          target = undefined;
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__d842Distance = {
    arm() { armed = true; held = undefined; },
    read: () => held,
    release() { deliver(); deliver = undefined; },
  };
}

async function detachFaceEnd() {
  await f.openFeatureEditor(3, 'bound end face');
  const editor = f.editor(), distance = field(editor, 'Distance');
  await editor.getByText('n1.bottom', { exact: true }).waitFor();
  const before = await f.snapshot('04-bound-before-detach');
  await f.page.evaluate(() => window.__d842Distance.arm());
  await button(editor, 'Detach to Distance').click();
  await editor.getByText('Reading exact distance…', { exact: true }).waitFor();
  const held = await f.page.waitForFunction(() => window.__d842Distance.read()).then(handle => handle.jsonValue());
  assert.equal(held.distance, 30);
  await f.closeEditor();
  await f.page.evaluate(() => window.__d842Distance.release());
  await f.openFeatureEditor(3, 'bound after cancelled distance query');
  assert.equal(await distance.count(), 0);
  const after = await f.snapshot('05-bound-after-cancelled-query');
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(after[key], before[key], key);
  f.report.observations.push({ label: 'cancelled-distance-reply', distance: held.distance, acceptedSnapshotUnchanged: true });

  f.phase = 'stage the current exact distance and reset once';
  await button(editor, 'Detach to Distance').click();
  await distance.waitFor();
  assert.equal(await distance.inputValue(), '30');
  assert.deepEqual(await f.doc(), before.doc);
  await button(editor, 'Reset').click();
  await editor.getByText('n1.bottom', { exact: true }).waitFor();
  assert.equal(await distance.count(), 0);
  await button(editor, 'Detach to Distance').click();
  await distance.waitFor();
  assert.equal(await distance.inputValue(), '30');
  await f.snapshot('06-exact-distance-draft');
  await button(editor, 'Apply').click();
  await f.changed(before.doc);
  await editor.waitFor({ state: 'hidden' });
  await geometry('detached-same-native-distance', 30, 30, false);
  await f.undo();
  await geometry('detach-first-undo-bound', 30, 30, true);
  await f.redo();
  await geometry('detach-first-redo-distance', 30, 30, false);
  await editTargetStart(40);
  await geometry('target-moved-detached-distance-stays', 40, 30, false);
}

await f.run(async () => {
  if (detach) {
    const newContext = f.browser.newContext.bind(f.browser);
    f.browser.newContext = async options => {
      const context = await newContext(options);
      await context.addInitScript(holdFaceEndDistance);
      return context;
    };
  }
  await f.newPage();
  const initial = documentAt(20, !baseline);
  if (create) await authorFaceEnd();
  else { await open(name, initial); await f.same(initial); }
  await geometry('opened', 20, 20, !baseline);
  await editTargetStart(30);
  await geometry('target-moved', 30, baseline ? 20 : 30, !baseline);
  let accepted = await f.doc();
  await f.snapshot('01-target-moved');
  if (baseline) {
    f.phase = 'explicit refusal of the new kind in the pre-feature reader';
    await open('D840-candidate.bcad', documentAt(30, true));
    const notice = await f.waitToast(/does not know: face-end-extrude/);
    assert.deepEqual(await f.doc(), accepted);
    await f.snapshot('02-candidate-refused');
    f.report.observations.push({ label: 'pre-feature-reader', notice });
    return;
  }

  f.phase = 'refuse a target face that no longer contains the projected profile';
  await f.openFeatureEditor(1, 'target width');
  const before = await f.snapshot('accepted-before-shrink');
  await field(f.editor(), 'Width').fill('8');
  await button(f.editor(), 'Apply').click();
  const error = f.editor().locator('.hud-error');
  await error.waitFor();
  assert.match(await error.textContent(), /target face.*contain|profile.*outside/i);
  const refused = await f.snapshot('02-shrink-refused');
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(refused[key], before[key], key);
  await f.closeEditor();
  await f.undo();
  await geometry('first-undo', 20, 20, true);
  await f.redo();
  await geometry('first-redo', 30, 30, true);

  if (detach) {
    await detachFaceEnd();
    accepted = await f.doc();
  }
  f.phase = 'save and reopen the feature and move the target again';
  await attachProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await directory.getFileHandle(name)).getFile().then(file => file.arrayBuffer())));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), accepted);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  await button(versions(), 'Close project').click();
  await field(versions(), 'Project').waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await attachProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(accepted);
  await geometry('reopened', detach ? 40 : 30, 30, !detach);
  await editTargetStart(detach ? 50 : 40);
  await geometry('post-open-target-moved', detach ? 50 : 40, detach ? 30 : 40, !detach);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot('03-post-open-target-moved');
  assert.deepEqual(f.report.downloads, []);
});
