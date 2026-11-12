import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';
import { runOtherHolePresets } from './hole-presets-other-types.mjs';

const otherTypes = process.argv[3] === '--other-types';
const pins = [
  'apps/cad-studio/test/hole-presets-browser.mjs',
  'apps/cad-studio/test/hole-presets-other-types.mjs',
  'apps/cad-studio/src/app/holePresets.ts',
  'apps/cad-studio/src/ui/HolePresets.tsx',
  'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/ui/browserStore.ts',
  'apps/cad-studio/src/state/useCommandPreview.ts',
  'packages/barocss-cad-model/src/app/commands.ts',
];
const f = await createFlow({
  name: 'hole-presets', output: process.argv[2], envFrozen: otherTypes ? 'D827_SOURCE_FROZEN' : 'D826_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: otherTypes ? 'Apply through, counterbore and countersink presets to fresh right faces and recover from corrupt settings.'
    : 'Save hole options from the top of one part and explicitly apply them to the right face of another part.',
  limits: [otherTypes ? 'Two ordinary rectangular stock parts and right-face holes.'
    : 'Two ordinary rectangular stock parts, blind and counterbore presets in desktop; all four modes in codec checks.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const outputs = evaluateCadPart(toPartDocument(doc)).outputs;
if (outputs.length !== 1) throw Error('Expected one output');
const [body] = outputs;
console.log(JSON.stringify({ valid: checkOutput(body).valid, count: body.bodyCount, ...massPropertiesOf(body),
  faces: body.brep.faces.map(face => ({ name: face.name, ...faceGeometry(face) })),
  corners: body.brep.vertices.map(vertex => vertex.point), shells: body.brep.shells.map(shell => shell.closed) }));
`,
});
const key = 'barocss:cad:hole-presets:v1';
const ref = node => ({ node, side: 'solid' });
const plate = (min, max, height) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min, max }, { id: 'n1', kind: 'extrude', sketch: 0, height }],
  outputs: { b1: ref(1) }, nextId: 2,
});
const first = plate([0, 0], [40, 30], 10), second = plate([50, 10], [90, 40], 12);
const project = (otherTypes ? 'D827' : 'D826') + ' hole presets ' + randomUUID(), name = 'D826-side.bcad';
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const field = (parent, name) => parent.getByLabel(name, { exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Hole', exact: true });
const preset = () => field(hud(), 'Hole preset');
const presetName = () => field(hud(), 'Preset name');
const type = () => field(hud(), 'Type');
const copies = () => field(hud(), 'Copies');
const versionPanel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const preview = () => f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
const storage = () => f.page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const faces = () => f.page.evaluate(() => window.__studioSelection.selection.faces);
const editState = async () => ({
  faces: await faces(),
  dirty: await field(f.page, 'Unsaved changes').count(),
  undo: await button(f.page, 'Undo').isEnabled(), redo: await button(f.page, 'Redo').isEnabled(),
});

function holdNextPreview() {
  const proto = Worker.prototype, post = proto.postMessage, handler = Object.getOwnPropertyDescriptor(proto, 'onmessage');
  let armed = false, target, pending, deliver;
  proto.postMessage = function (request, ...rest) {
    if (armed && request.type === 'preview') {
      armed = false;
      target = { worker: this, id: request.id };
    }
    return Reflect.apply(post, this, [request, ...rest]);
  };
  Object.defineProperty(proto, 'onmessage', {
    configurable: true, get: handler.get,
    set(callback) {
      handler.set.call(this, callback && function (event) {
        if (target?.worker === this && target.id === event.data?.id && event.data.result) {
          pending = { id: target.id, ok: event.data.result.ok };
          deliver = () => callback.call(this, event);
          target = null;
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__holeHold = { arm() { armed = true; pending = undefined; }, read: () => pending, release() { deliver(); deliver = null; } };
}

async function open(modelName, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: modelName, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

async function pick(view, point) {
  await button(f.page, view).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const filter = button(f.page, 'Selection filter');
  for (let index = 0; index < 6 && !(await filter.innerText()).includes('Faces'); index++) await filter.click();
  assert.match(await filter.innerText(), /Faces/);
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.faces?.length === 1);
}

async function startHole() {
  await f.command('Hole');
  await hud().waitFor();
  await preview();
  await hud().getByText('Hole presets', { exact: true }).click();
}

async function savePreset(name) {
  await presetName().fill(name);
  await presetName().press('Enter');
  assert.ok(await hud().isVisible(), 'Enter in the preset name must not commit a hole');
  await button(hud(), 'Save preset').click();
}

async function openProject() {
  if (!(await versionPanel().isVisible())) await button(f.page, 'Project and versions').click();
  if (await field(versionPanel(), 'Project').isVisible()) return;
  await versionPanel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versionPanel(), 'Project in this browser').click();
  await field(versionPanel(), 'Project').waitFor();
}

async function saveAndReopen(doc, fileName, beforeReload) {
  await openProject();
  await button(f.page, 'Save').click();
  await versionPanel().getByRole('list', { name: 'Project documents', exact: true }).getByText(fileName, { exact: true }).waitFor();
  await field(f.page, 'Unsaved changes').waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, fileName]));
  assert.deepEqual(JSON.parse(bytes), doc);
  await button(versionPanel(), 'Close project').click();
  await field(versionPanel(), 'Project').waitFor({ state: 'hidden' });
  if (beforeReload) await beforeReload();
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(versionPanel(), 'Open ' + fileName).click();
  await f.same(doc);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

async function checkNative(label, doc, depth) {
  const hole = doc.nodes[2];
  assert.deepEqual(hole, { kind: 'hole', parent: ref(1), radius: 3, center: [25, 6], axis: 'x', face: 'n1.side1', depth, id: 'n2' });
  assert.deepEqual(doc.nodes.slice(0, 2), second.nodes);
  assert.deepEqual(doc.outputs, { b2: ref(2) });
  const body = await f.inspect(label, doc);
  assert.ok(body.valid);
  assert.equal(body.count, 1);
  const removed = Math.PI * 9 * depth, volume = 14400 - removed;
  const centroid = [(14400 * 70 - removed * (90 - depth / 2)) / volume, 25, 6];
  const { bodies, fresh, massReady } = await f.bodies();
  assert.ok(fresh && massReady && bodies.length === 1);
  for (const result of [body, bodies[0]]) {
    assert.ok(Math.abs(result.volume - volume) < 1e-7, JSON.stringify(result));
    assert.ok(Math.hypot(...result.centroid.map((v, i) => v - centroid[i])) < 1e-8, JSON.stringify(result));
  }
  const walls = body.faces.filter(face => face.kind === 'cylinder');
  assert.ok(walls.length > 0);
  for (const wall of walls) {
    assert.equal(wall.out, -1);
    assert.ok(Math.abs(wall.r - 3) < 1e-8);
    assert.ok(Math.abs(Math.abs(wall.a[0]) - 1) < 1e-8 && Math.hypot(...wall.a.slice(1)) < 1e-8);
    assert.ok(Math.hypot(wall.c[1] - 25, wall.c[2] - 6) < 1e-8);
  }
  assert.ok(body.faces.some(face => face.kind === 'plane' && Math.abs(face.o[0] - (90 - depth)) < 1e-8
    && Math.hypot(face.n[0] - 1, face.n[1], face.n[2]) < 1e-8));
  f.report.observations.push({ label, depth, face: hole.face, axis: hole.axis, center: hole.center, volume: body.volume, centroid: body.centroid });
}

await f.run(async () => {
  const newContext = f.browser.newContext.bind(f.browser);
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.addInitScript(holdNextPreview);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  if (otherTypes) {
    await runOtherHolePresets({ f, key, first, second, open, pick, startHole, savePreset, saveAndReopen, editState });
    return;
  }
  f.phase = 'store and manage options on the top face of the first part';
  await f.newPage();
  await open('D826-top.bcad', first);
  await pick('Top', [14, 12, 10]);
  const original = await editState();
  await startHole();
  await type().selectOption('blind');
  await field(hud(), 'Diameter').fill('6');
  await field(hud(), 'Depth').fill('4');
  await field(hud(), 'Centre X').fill('13');
  await field(hud(), 'Centre Y').fill('11');
  await savePreset('Short 6');
  await type().selectOption('counterbore');
  await field(hud(), 'Counterbore Ø').fill('10');
  await field(hud(), 'Counterbore depth').fill('2');
  await savePreset('Seat 6');
  const expectedSeat = { name: 'Seat 6', options: { type: 'counterbore', d: 6, cd: 10, ch: 2 } };
  const optionsBeforeDuplicate = await storage();
  await savePreset('seat 6');
  await hud().getByText('A hole preset already uses this name.', { exact: true }).waitFor();
  assert.deepEqual(await storage(), optionsBeforeDuplicate);
  await preset().selectOption('Short 6');
  await presetName().fill('Short hole');
  await button(hud(), 'Rename preset').click();
  await button(hud(), 'Use preset').click();
  assert.equal(await field(hud(), 'Depth').inputValue(), '4');
  await field(hud(), 'Depth').fill('5');
  await button(hud(), 'Update preset').click();
  const expectedBlind = { name: 'Short hole', options: { type: 'blind', d: 6, depth: 5 } };
  assert.deepEqual(await storage(), { version: 1, presets: [expectedBlind, expectedSeat] });
  await savePreset('Temporary');
  await button(hud(), 'Delete preset').click();
  assert.deepEqual(await storage(), { version: 1, presets: [expectedBlind, expectedSeat] });
  await f.page.evaluate(key => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Test quota', 'QuotaExceededError');
      return setItem.call(this, name, value);
    };
  }, key);
  await savePreset('Unsaved preset');
  await hud().getByText('Hole preset changes could not be saved.', { exact: true }).waitFor();
  assert.deepEqual(await storage(), { version: 1, presets: [expectedBlind, expectedSeat] });
  await preset().selectOption('Short hole');
  await copies().selectOption('row');
  assert.ok(await button(hud(), 'Use preset').isDisabled());
  assert.equal(await copies().inputValue(), 'row');
  await copies().selectOption('one');
  await type().selectOption('tapped');
  assert.ok(await button(hud(), 'Save preset').isDisabled());
  await button(hud(), 'Cancel').click();
  await f.same(first);
  assert.deepEqual(await editState(), original);

  f.phase = 'open a different document and preserve its right face and current center';
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await open(name, second);
  await pick('Right', [90, 25, 6]);
  const selected = await editState();
  await startHole();
  assert.equal(await type().inputValue(), 'through');
  assert.equal(await field(hud(), 'Diameter').inputValue(), '8');
  await field(hud(), 'Centre Y').fill('25');
  await field(hud(), 'Centre Z').fill('6');
  await preview();
  await f.page.evaluate(() => window.__holeHold.arm());
  await preset().selectOption('Seat 6');
  await button(hud(), 'Use preset').click();
  await f.page.waitForFunction(() => window.__holeHold.read()?.ok === true);
  const held = await f.page.evaluate(() => window.__holeHold.read());
  await field(hud(), 'Diameter').press('Enter');
  await preset().selectOption('Short hole');
  await button(hud(), 'Use preset').click();
  await f.page.evaluate(() => window.__holeHold.release());
  await preview();
  await f.same(second);
  assert.deepEqual(await editState(), selected);
  assert.equal(await field(hud(), 'Centre Y').inputValue(), '25');
  assert.equal(await field(hud(), 'Centre Z').inputValue(), '6');
  assert.equal(await type().inputValue(), 'blind');
  assert.equal(await field(hud(), 'Depth').inputValue(), '5');
  f.report.observations.push({ label: 'retired-success-with-queued-enter', held, sourceUnchanged: true });
  await f.snapshot('01-latest-preset-on-right');
  await button(hud(), 'Reset hole options').click();
  assert.equal(await type().inputValue(), 'through');
  assert.equal(await field(hud(), 'Diameter').inputValue(), '8');
  assert.equal(await field(hud(), 'Centre Y').inputValue(), '25');
  assert.equal(await field(hud(), 'Centre Z').inputValue(), '6');
  await button(hud(), 'Use preset').click();
  await preview();
  await button(hud(), 'Apply').click();
  await hud().waitFor({ state: 'hidden' });
  await f.changed(second);
  const committed = await f.doc();
  await checkNative('applied-right-hole', committed, 5);
  await f.undo();
  await f.same(second);
  await f.redo();
  await f.same(committed);

  f.phase = 'save and reopen the hole with no preset in browser storage';
  const saved = await saveAndReopen(committed, name, () => f.page.evaluate(key => localStorage.removeItem(key), key));
  assert.equal(await storage(), null);
  await checkNative('reopened-right-hole', committed, 5);
  await f.openFeatureEditor(2, 'reopened blind hole');
  assert.equal(await f.editor().getByText('Hole presets', { exact: true }).count(), 0);
  assert.equal(await field(f.editor(), 'Depth').inputValue(), '5');
  await field(f.editor(), 'Depth').fill('4');
  await f.applyEditor(committed, '02-reopened-depth-four');
  await checkNative('edited-right-hole', await f.doc(), 4);
  f.report.observations.push({ label: 'project-without-presets', ...saved });
  assert.deepEqual(f.report.downloads, []);
});
