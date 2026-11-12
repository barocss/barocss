import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/test/material-footprint-browser.mjs',
  'apps/cad-studio/test/model-rail-helper.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/materialFootprint.ts',
  'apps/cad-studio/src/engine/client.ts',
  'apps/cad-studio/src/engine/engine.worker.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/engine/materialFootprint.ts',
  'packages/barocss-cad/src/brep/planar-arrangement.ts',
];
const f = await createFlow({
  name: 'material-footprint', output: process.argv[2], envFrozen: 'D853_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Make an editable XY sketch from the material footprint of an exact native solid with two pocket depths.',
  limits: ['One closed, straight, orthogonal source body. A circular solid is the negative control.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(output => ({
  id: output.id, valid: checkOutput(output).valid, count: output.bodyCount, mass: massPropertiesOf(output),
  points: output.brep.vertices.map(vertex => vertex.point),
}))));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});

const solid = node => ({ node, side: 'solid' });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', id: 'n0', profile: 'rectangle', min: [0, 0], max: [32, 20] },
    { kind: 'extrude', id: 'n1', sketch: 0, height: 4 },
    { kind: 'sketch', id: 'n2', profile: 'rectangle', min: [4, 6], max: [8, 12] },
    { kind: 'extrude', id: 'n3', sketch: 2, height: 6, from: -1 },
    { kind: 'difference', id: 'n4', parent: solid(1), tool: solid(3) },
    { kind: 'sketch', id: 'n5', profile: 'rectangle', min: [20, 6], max: [24, 10] },
    { kind: 'extrude', id: 'n6', sketch: 5, height: 3, from: 2 },
    { kind: 'difference', id: 'n7', parent: solid(4), tool: solid(6) },
    { kind: 'sketch', id: 'n8', profile: 'circle', center: [42, 8], radius: 4 },
    { kind: 'extrude', id: 'n9', sketch: 8, height: 4 },
  ],
  outputs: { b7: solid(7), b9: solid(9) }, nextId: 10,
};
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const corners = points => points.map(point => point.join(',')).sort();
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-7, `${actual} != ${expected}`);
const name = 'D853-footprint.bcad';
const project = 'D853-' + randomUUID();

function observeFootprintReply() {
  const prototype = Worker.prototype;
  const send = prototype.postMessage, onmessage = Object.getOwnPropertyDescriptor(prototype, 'onmessage');
  let armed = false, target, held, deliver;
  prototype.postMessage = function (request, ...args) {
    if (armed && request.type === 'projectFootprint') {
      target = { worker: this, id: request.id, key: request.key };
      armed = false;
    }
    return Reflect.apply(send, this, [request, ...args]);
  };
  Object.defineProperty(prototype, 'onmessage', {
    configurable: true, get: onmessage.get,
    set(callback) {
      onmessage.set.call(this, callback && function (event) {
        if (target?.worker === this && event.data?.id === target.id) {
          held = { key: target.key, ok: event.data.sketch?.kind === 'sketch' };
          deliver = () => callback.call(this, event);
          target = undefined;
        } else callback.call(this, event);
      });
    },
  });
  window.__d853Footprint = {
    arm() { armed = true; held = undefined; },
    held: () => held,
    release() { deliver(); deliver = undefined; },
  };
}

async function openBytes(buffer) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer });
}
const open = doc => openBytes(Buffer.from(JSON.stringify(doc)));
async function pickBody(key) {
  const bodies = (await f.bodies()).bodies;
  const index = bodies.findIndex(body => body.key === key);
  assert.ok(index >= 0);
  await f.page.locator('.outliner .ol-row > button.ol').nth(index).click();
  await f.page.waitForFunction(index => JSON.stringify(window.__studioSelection?.selection.bodies) === JSON.stringify([index]), index);
}
const projectSketch = () => clickModelCommand(f.page, 'Create', 'Project to sketch');
const finish = () => f.page.locator('.topbar button.finish').click();

function assertExact(after, before) {
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty']) assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(after.selection.selection, before.selection.selection);
}
function checkProfile(profile) {
  assert.equal(profile.id, 'n10');
  assert.equal(profile.profile, 'polygon');
  assert.deepEqual(corners(profile.points), corners([[0, 0], [32, 0], [32, 20], [0, 20]]));
  assert.equal(profile.holes?.length, 1);
  assert.ok(profile.holes[0].every(segment => segment.kind === 'line'));
  assert.deepEqual(corners(profile.holes[0].map(segment => segment.start)), corners([[4, 6], [8, 6], [8, 12], [4, 12]]));
  assert.deepEqual(profile.plane, { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] });
  assert.equal(profile.association, undefined);
  assert.equal(profile.on, undefined);
}

async function checkNative(label, doc, sourceWidth, dependent) {
  const outputs = await f.inspect(label, doc);
  assert.deepEqual(outputs.map(output => output.id), dependent ? ['n7', 'n9', 'n11'] : ['n7', 'n9']);
  assert.ok(outputs.every(output => output.valid && output.count === 1));
  near(outputs[0].mass.volume, sourceWidth * 20 * 4 - 4 * 6 * 4 - 4 * 4 * 2);
  near(outputs[1].mass.volume, 64 * Math.PI);
  if (dependent) {
    const footprint = [[0, 0], [32, 0], [32, 20], [0, 20], [4, 6], [8, 6], [8, 12], [4, 12]];
    assert.deepEqual(corners(outputs[2].points), corners([10, 12].flatMap(z => footprint.map(([x, y]) => [x, y, z]))));
    near(outputs[2].mass.volume, 2 * (32 * 20 - 4 * 6));
    near(outputs[2].mass.centroid[0], 10096 / 616);
    near(outputs[2].mass.centroid[1], 6184 / 616);
    near(outputs[2].mass.centroid[2], 11);
  }
  f.report.observations.push({ label, sourceWidth, sourceVolume: outputs[0].mass.volume, copiedVolume: outputs[2]?.mass.volume });
}

async function saveOwned(doc) {
  const versions = f.page.getByLabel('Versions panel', { exact: true });
  if (!(await versions.isVisible())) await button(f.page, 'Project and versions').click();
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions, 'Project in this browser').click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const root = await navigator.storage.getDirectory(), projects = await root.getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project), file = await (await directory.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  await button(versions, 'Close project').click();
  await versions.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.evaluate(async project => {
    const root = await navigator.storage.getDirectory(), projects = await root.getDirectoryHandle('projects');
    await projects.removeEntry(project, { recursive: true });
  }, project);
  return bytes;
}

await f.run(async () => {
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext(options);
    await context.addInitScript(observeFootprintReply);
    return context;
  };
  await f.newPage();
  await open(seed);
  await f.same(seed);
  await checkNative('native-source', seed, 32, false);

  f.phase = 'a curved body refuses without changing accepted state';
  await pickBody('b9');
  const unsupported = await f.snapshot('01-cylinder-selected');
  await projectSketch();
  await f.waitToast(/Projection not started.*straight axis-aligned native edges/);
  assertExact(await f.snapshot('02-cylinder-refused'), unsupported);
  await f.dismissToasts();

  f.phase = 'open and cancel a projected sketch draft';
  await pickBody('b7');
  const source = await f.snapshot('03-source-selected');
  await projectSketch();
  await f.sketchPanel().waitFor();
  assertExact(await f.snapshot('04-independent-draft'), source);
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  assertExact(await f.snapshot('05-draft-cancelled'), source);

  f.phase = 'finish the independent sketch on XY offset 10';
  await projectSketch();
  await f.sketchPanel().waitFor();
  await f.sketchPanel().getByLabel('Plane offset', { exact: true }).fill('10');
  await finish();
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.changed(seed);
  const sketched = await f.doc();
  assert.deepEqual(sketched.nodes.slice(0, 10), seed.nodes);
  assert.deepEqual(sketched.outputs, seed.outputs);
  checkProfile(sketched.nodes[10]);
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(sketched);

  f.phase = 'extrude the projected profile by 2 mm';
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · polygon').click();
  await f.openExtrudeHud();
  await f.hud().getByLabel('Distance', { exact: true }).fill('2');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  await button(f.hud(), 'Apply').click();
  await f.changed(sketched);
  const extruded = await f.doc();
  assert.deepEqual(extruded.nodes.slice(0, 11), sketched.nodes);
  await checkNative('native-extruded-profile', extruded, 32, true);
  await f.snapshot('06-independent-extrusion');

  f.phase = 'save exact project bytes and open them in a fresh Studio context';
  const bytes = await saveOwned(extruded);
  await f.newPage();
  await openBytes(bytes);
  await f.same(extruded);
  await checkNative('native-fresh-open', extruded, 32, true);

  f.phase = 'edit the source and preserve the copied sketch';
  await f.openFeatureEditor(1, 'source stock');
  await f.editor().getByLabel('Width', { exact: true }).fill('34');
  await button(f.editor(), 'Apply').click();
  await f.changed(extruded);
  const moved = await f.doc();
  assert.deepEqual(moved.nodes.slice(10), extruded.nodes.slice(10));
  await checkNative('native-source-width34-snapshot-unchanged', moved, 34, true);
  await f.closeEditor();

  f.phase = 'keep a new History draft when the older projection reply arrives';
  await pickBody('b7');
  await f.page.evaluate(() => window.__d853Footprint.arm());
  await projectSketch();
  await f.page.waitForFunction(() => window.__d853Footprint.held()?.ok === true);
  await f.openFeatureEditor(1, 'source after requesting projection');
  const draftWidth = f.editor().getByLabel('Width', { exact: true });
  await draftWidth.fill('35');
  const beforeEdit = await f.snapshot('07-new-history-draft-before-reply');
  await f.page.evaluate(() => window.__d853Footprint.release());
  assertExact(await f.snapshot('08-new-history-draft-after-reply'), beforeEdit);
  assert.equal(await draftWidth.inputValue(), '35');
  assert.equal(await f.sketchPanel().isVisible(), false);
  await f.closeEditor();

  f.phase = 'drop a held actual projection reply after same-ID file Open';
  await pickBody('b7');
  await f.page.evaluate(() => window.__d853Footprint.arm());
  await projectSketch();
  await f.page.waitForFunction(() => window.__d853Footprint.held()?.ok === true);
  assert.deepEqual(await f.page.evaluate(() => window.__d853Footprint.held()), { key: 'b7', ok: true });
  await open(seed);
  await f.same(seed);
  const beforeLate = await f.snapshot('09-replacement-before-late-reply');
  await f.page.evaluate(() => window.__d853Footprint.release());
  assertExact(await f.snapshot('10-replacement-after-late-reply'), beforeLate);
  assert.equal(await f.sketchPanel().isVisible(), false);
  assert.deepEqual(f.report.downloads, []);
});
