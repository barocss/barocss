import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const changeSaved = process.argv[3] === '--change-saved';
const pins = [
  'apps/cad-studio/test/extrude-end-face-preview-ownership-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/extrudeEndFace.ts',
  'apps/cad-studio/src/state/useCommandPreview.ts',
  'apps/cad-studio/src/state/previewLifetime.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
  ...(changeSaved ? ['packages/barocss-cad-model/src/app/extrudeEndFaceEdit.ts', 'apps/cad-studio/src/ui/NodeEditor.tsx'] : []),
  'packages/barocss-cad-model/src/engine/faceEndExtrude.ts',
];
const f = await createFlow({
  name: 'extrude-end-face-preview-ownership', output: process.argv[2], envFrozen: changeSaved ? 'D849_SOURCE_FROZEN' : 'D845_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: changeSaved ? 'Replace one saved bound end with another original earlier target and verify both dependencies through History and Open.'
    : 'Deliver real held Worker results after an unchanged Enter, a target re-pick, Cancel and same-ID Open.',
  limits: ['Desktop WebGPU with two separately selectable native XY target caps and one literal rectangle.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const part = toPartDocument(doc), result = evaluateCadPart(part);
console.log(JSON.stringify({
  feature: part.features.find(feature => feature.id === 'n5'),
  outputs: result.outputs.map(output => ({
    id: output.id, valid: checkOutput(output).valid, count: output.bodyCount, mass: massPropertiesOf(output),
    corners: output.brep.vertices.map(vertex => vertex.point),
  })),
}));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
    shown: (() => { const state = window.__studioSection(); return { keys: state.shownKeys, volume: state.shownVolume }; })(),
  }),
});
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-5, -5], max: [15, 15] },
    { id: 'n1', kind: 'extrude', sketch: 0, from: 20, height: 5 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [-10, -10], max: [20, 20] },
    { id: 'n3', kind: 'extrude', sketch: 2, from: 30, height: 5 },
    { id: 'n4', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 5,
};
const targetsAt = (a, b) => ({
  ...seed,
  nodes: seed.nodes.map(node => node.id === 'n1' ? { ...node, from: a } : node.id === 'n3' ? { ...node, from: b } : node),
});
const boundTo = (source, index) => ({
  ...source,
  nodes: [...source.nodes, { id: 'n5', kind: 'face-end-extrude', sketch: 4,
    target: { body: { node: index, side: 'solid' }, feature: 'n' + index, face: 'n' + index + '.bottom' } }],
  outputs: { ...source.outputs, b5: { node: 5, side: 'solid' } }, nextId: 6,
});
const replacement = {
  ...seed,
  nodes: seed.nodes.map(node => node.id === 'n1' ? { ...node, from: 42 } : node.id === 'n3' ? { ...node, from: 55 } : node),
};
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const hud = () => f.hud();
const status = value => hud().locator('.status').filter({ hasText: new RegExp('^' + value + '$') }).waitFor();
const near = (a, b) => Math.abs(a - b) < 1e-8;

function holdPreview() {
  const worker = Worker.prototype, send = worker.postMessage;
  const onmessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  let armed = false, target, held, deliver;
  let frames = null;
  worker.postMessage = function (request, ...args) {
    if (armed && request.type === 'preview') {
      armed = false;
      target = { worker: this, id: request.id, revision: request.revision };
    }
    return Reflect.apply(send, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onmessage.get,
    set(callback) {
      onmessage.set.call(this, callback && function (event) {
        if (target?.worker === this && event.data?.id === target.id && event.data.result) {
          held = { id: target.id, revision: target.revision, ok: event.data.result.ok };
          deliver = () => callback.call(this, event);
          target = undefined;
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__d845Preview = {
    arm() { held = undefined; armed = true; },
    read: () => held,
    release() { deliver(); deliver = undefined; },
    observe() {
      frames = [];
      const sample = () => {
        if (!frames) return;
        const shown = window.__studioSection?.();
        if (shown) frames.push({ keys: shown.shownKeys, volume: shown.shownVolume });
        requestAnimationFrame(sample);
      };
      sample();
    },
    finish() { const result = frames; frames = null; return result; },
  };
}

async function open(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

async function bottomView() {
  await button(f.page, 'View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Bottom', exact: true }).click();
  await f.page.waitForFunction(() => {
    const labels = [...document.querySelectorAll('.view-cube .vc-label')];
    return labels.length === 1 && labels[0].textContent === 'BOTTOM';
  });
}

async function begin() {
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await f.editor().waitFor();
  await f.closeEditor();
  await f.openExtrudeHud();
  await hud().getByLabel('Depth', { exact: true }).selectOption('to-face');
  await status('pick face');
  await bottomView();
}

async function pick(point) {
  const pixel = await f.page.evaluate(point => {
    const xy = window.__studioScreenOf(point);
    return xy && document.elementFromPoint(...xy)?.closest('.vp-canvas') ? xy : null;
  }, point);
  assert.ok(pixel, 'click reaches the original model viewport');
  await f.page.mouse.click(...pixel);
}

const targetA = [13, 13, 20], targetB = [-8, -8, 30];
async function holdA() {
  await f.page.evaluate(() => window.__d845Preview.arm());
  await pick(targetA);
  await hud().getByText('n1.bottom', { exact: true }).waitFor();
  const held = await f.page.waitForFunction(() => window.__d845Preview.read()).then(handle => handle.jsonValue());
  assert.equal(held.ok, true);
  await status('evaluating…');
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('Enter');
  assert.deepEqual(await f.doc(), seed);
  return held;
}

function sameAccepted(after, before) {
  for (const key of ['doc', 'history', 'historyControls', 'dirty']) assert.deepEqual(after[key], before[key], key);
  for (const key of ['bodies', 'fresh', 'massReady']) assert.deepEqual(after.bodies[key], before.bodies[key], key);
  assert.deepEqual(after.selection.selection, before.selection.selection);
}

async function checkFrames(permitted) {
  const frames = await f.page.evaluate(() => window.__d845Preview.finish());
  assert.ok(frames.length >= 2);
  assert.ok(frames.every(frame => {
    const keys = near(frame.volume, 6500) ? 'b1,b3' : 'b1,b3,b5';
    return permitted.some(volume => near(volume, frame.volume)) && frame.keys.join() === keys;
  }), JSON.stringify(frames));
  return { frames: frames.length, volumes: [...new Set(frames.map(frame => Math.round(frame.volume)))] };
}

async function verify(label, index, height, source = seed) {
  await f.ready();
  const doc = await f.doc(), feature = 'n' + index;
  assert.deepEqual(doc, boundTo(source, index));
  const native = await f.inspect(label, doc);
  assert.deepEqual(native.feature, { id: 'n5', kind: 'extrude', sketch: 'n4', height });
  assert.deepEqual(native.outputs.map(output => output.id), ['n1', 'n3', 'n5']);
  const firstZ = source.nodes[1].from, secondZ = source.nodes[3].from;
  for (const [i, bounds, z, top, volume, centroid] of [
    [0, [-5, 15], firstZ, firstZ + 5, 2000, [5, 5, firstZ + 2.5]],
    [1, [-10, 20], secondZ, secondZ + 5, 4500, [5, 5, secondZ + 2.5]],
    [2, [0, 10], 0, height, 100 * height, [5, 5, height / 2]],
  ]) {
    const output = native.outputs[i];
    assert.ok(output.valid && output.count === 1);
    assert.equal(output.corners.length, 8);
    const corners = bounds.flatMap(x => bounds.flatMap(y => [z, top].map(z => [x, y, z])));
    assert.ok(corners.every(point => output.corners.some(corner => corner.every((value, j) => near(value, point[j])))));
    assert.ok(near(output.mass.volume, volume));
    assert.ok(output.mass.centroid.every((value, j) => near(value, centroid[j])));
  }
  return { label, target: feature + '.bottom', height, extrusionVolumeMm3: 100 * height, nativeCorners: 24 };
}

async function changeSavedTarget() {
  const original = boundTo(seed, 1), name = 'D849-change-end-face.bcad';
  const project = 'D849 change end face ' + randomUUID();
  const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const hud = f.page.getByRole('dialog', { name: 'Change end face', exact: true });
  const editor = f.editor();
  const status = value => hud.locator('.status').filter({ hasText: new RegExp('^' + value + '$') }).waitFor();
  await open(name, original);
  f.report.observations.push(await verify('original-bound-target', 1, 20));
  const ortho = button(f.page, 'Ortho');
  if (await ortho.getAttribute('aria-pressed') !== 'true') await ortho.click();
  assert.equal(await ortho.getAttribute('aria-pressed'), 'true');
  const begin = async () => {
    await f.page.getByTitle('Frame all (F)', { exact: true }).click();
    await f.openFeatureEditor(5, 'saved bound target');
    await editor.getByText('n1.bottom', { exact: true }).waitFor();
    await button(editor, 'Change end face').click();
    await status('pick face');
    await bottomView();
  };

  f.phase = 'refuse the identical target and cancel a valid change';
  await begin();
  const before = await f.snapshot('01-saved-before-change');
  await pick(targetA);
  await f.waitToast(/already the end face/);
  await status('pick face');
  assert.equal(await button(hud, 'Apply').isDisabled(), true);
  await pick(targetB);
  await status('preview');
  await hud.getByText('n3.bottom', { exact: true }).waitFor();
  assert.deepEqual(await f.doc(), original);
  await button(hud, 'Cancel').click();
  await hud.waitFor({ state: 'hidden' });
  sameAccepted(await f.snapshot('02-saved-cancelled'), before);

  f.phase = 'apply the different end face once with stable history and outputs';
  await begin();
  await pick(targetB);
  await status('preview');
  await button(hud, 'Apply').click();
  await f.changed(original);
  await hud.waitFor({ state: 'hidden' });
  f.report.observations.push(await verify('changed-bound-target', 3, 30));
  await f.undo();
  f.report.observations.push(await verify('first-undo-old-target', 1, 20));
  await f.redo();
  f.report.observations.push(await verify('first-redo-new-target', 3, 30));

  async function moveTarget(index, from) {
    await f.openFeatureEditor(index, 'move target ' + index);
    const before = await f.doc();
    await editor.getByLabel('Start Z', { exact: true }).fill(String(from));
    await button(editor, 'Apply').click();
    await f.changed(before);
    await editor.waitFor({ state: 'hidden' });
  }
  await moveTarget(1, 24);
  f.report.observations.push(await verify('old-target-moved-independent', 3, 30, targetsAt(24, 30)));
  await moveTarget(3, 40);
  f.report.observations.push(await verify('new-target-moved-associative', 3, 40, targetsAt(24, 40)));

  async function attachProject() {
    if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
    await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await button(versions(), 'Project in this browser').click();
    await versions().getByLabel('Project', { exact: true }).waitFor();
  }
  f.phase = 'save the new target, reopen and verify both edited bodies';
  await attachProject();
  const accepted = await f.doc();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const root = await navigator.storage.getDirectory(), projects = await root.getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project), file = await (await directory.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), accepted);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  await button(versions(), 'Close project').click();
  await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await attachProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(accepted);
  await moveTarget(1, 22);
  f.report.observations.push(await verify('reopened-old-target-independent', 3, 40, targetsAt(22, 40)));
  await moveTarget(3, 45);
  f.report.observations.push(await verify('reopened-new-target-associative', 3, 45, targetsAt(22, 45)));
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot('03-saved-new-target-after-open');
  assert.deepEqual(f.report.downloads, []);
}

await f.run(async () => {
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext(options);
    await context.addInitScript(holdPreview);
    return context;
  };
  await f.newPage();
  if (changeSaved) { await changeSavedTarget(); return; }
  await open('D845-seed.bcad', seed);

  f.phase = 'control: a held preview with an unchanged target commits exactly once on queued Enter';
  await begin();
  const control = await holdA();
  await f.page.evaluate(() => window.__d845Preview.release());
  await f.changed(seed);
  await hud().waitFor({ state: 'hidden' });
  f.report.observations.push({ ...control, ...await verify('queued-enter-control', 1, 20) });
  await f.undo();
  await f.same(seed);

  f.phase = 'a new target retires the queued Enter and old native preview';
  await begin();
  const beforeRepick = await f.snapshot('01-before-repick');
  const repick = await holdA();
  await pick(targetB);
  await hud().getByText('n3.bottom', { exact: true }).waitFor();
  await status('evaluating…');
  await f.page.evaluate(() => { window.__d845Preview.observe(); window.__d845Preview.release(); });
  await status('preview');
  const currentPreview = await f.snapshot('02-current-repick-preview');
  const repickFrames = await checkFrames([6500, 9500]);
  sameAccepted(currentPreview, beforeRepick);
  assert.deepEqual(currentPreview.shown.keys, ['b1', 'b3', 'b5']);
  assert.deepEqual(currentPreview.bodies.colored, ['b5']);
  assert.ok(near(currentPreview.shown.volume, 9500));
  await button(hud(), 'Apply').click();
  await f.changed(seed);
  await hud().waitFor({ state: 'hidden' });
  f.report.observations.push({ ...repick, ...repickFrames, ...await verify('explicit-repick-apply', 3, 30) });
  await f.undo();
  await f.same(seed);

  f.phase = 'Cancel retires a real success with a queued Enter';
  await begin();
  const beforeCancel = await f.snapshot('03-before-cancel');
  const cancelled = await holdA();
  await button(hud(), 'Cancel').click();
  await hud().waitFor({ state: 'hidden' });
  await f.page.evaluate(() => { window.__d845Preview.observe(); window.__d845Preview.release(); });
  const afterCancel = await f.snapshot('04-after-cancel');
  sameAccepted(afterCancel, beforeCancel);
  assert.deepEqual(afterCancel.shown.keys, ['b1', 'b3']);
  assert.deepEqual(afterCancel.bodies.colored, beforeCancel.bodies.colored);
  f.report.observations.push({ label: 'cancelled-success', ...cancelled, ...await checkFrames([6500]), acceptedExact: true });

  f.phase = 'Open replaces the document with the same feature IDs before a queued success is delivered';
  await begin();
  const replaced = await holdA();
  await open('D845-replacement.bcad', replacement);
  await hud().waitFor({ state: 'hidden' });
  const beforeRelease = await f.snapshot('05-replacement-before-old-reply');
  assert.deepEqual(beforeRelease.bodies.bodies.map(body => body.key), ['b1', 'b3']);
  assert.ok(beforeRelease.bodies.bodies.every((body, i) => body.centroid.every((value, j) => near(value, [5, 5, i ? 57.5 : 44.5][j]))));
  await f.page.evaluate(() => { window.__d845Preview.observe(); window.__d845Preview.release(); });
  const afterRelease = await f.snapshot('06-replacement-after-old-reply');
  sameAccepted(afterRelease, beforeRelease);
  assert.deepEqual(afterRelease.shown.keys, ['b1', 'b3']);
  assert.deepEqual(afterRelease.bodies.colored, beforeRelease.bodies.colored);
  const replacementFrames = await checkFrames([6500]);
  await f.undo();
  await f.same(seed);
  f.report.observations.push({ label: 'replaced-same-ids-success', ...replaced, ...replacementFrames, acceptedExact: true, replacementCapZ: [42, 55] });
  assert.deepEqual(f.report.downloads, []);
});
