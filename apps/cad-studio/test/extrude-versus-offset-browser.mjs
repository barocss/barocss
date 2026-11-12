import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const capReference = process.argv[3] === '--cap-reference';
const capRematch = process.argv[3] === '--cap-rematch';
const noticeScope = process.argv[3] === '--cap-notice';
const replacementFlow = process.argv[3] === '--replacement';
const handleParity = process.argv[3] === '--handle-parity';
const producers = [
  'apps/cad-studio/test/extrude-versus-offset-browser.mjs',
  'apps/cad-studio/test/model-rail-helper.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useCommandGizmos.ts',
  'apps/cad-studio/src/state/useCommandPreview.ts',
  'packages/barocss-cad-model/src/app/editCommand.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/app/nativeOffsetFace.ts',
  ...(capReference || capRematch || noticeScope ? ['apps/cad-studio/src/files/documentFile.ts',
    'apps/cad-studio/src/ui/ReferenceDecisions.tsx', 'packages/barocss-cad-model/src/engine/rematch.ts',
    'packages/barocss-cad-model/src/engine/references.ts', 'packages/barocss-cad/src/part/part-shell.ts'] : []),
  ...(replacementFlow ? ['apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
    'apps/cad-studio/src/state/previewLifetime.ts', 'apps/cad-studio/src/files/useStudioDocumentFiles.ts'] : []),
  ...(handleParity ? ['apps/cad-studio/src/viewport/viewportPointerInput.ts', 'apps/cad-studio/src/viewport/gizmo.ts',
    'apps/cad-studio/src/ui/Hud.tsx'] : []),
];
const f = await createFlow({
  name: 'extrude-versus-offset', output: process.argv[2],
  envFrozen: noticeScope ? 'D900_SOURCE_FROZEN' : capRematch ? 'D899_SOURCE_FROZEN'
    : handleParity ? 'D898_SOURCE_FROZEN' : replacementFlow ? 'D897_SOURCE_FROZEN'
    : capReference ? 'D896_SOURCE_FROZEN' : 'D895_SOURCE_FROZEN',
  initialFiles: producers, requiredFrozen: producers,
  qualification: noticeScope ? 'Retire the superseded failure notice after a repaired Open and retain a genuine current refusal.'
    : capRematch ? 'Verify live refusal and a marked cold Shell rematch when the Offset-generated top becomes internal.'
    : handleParity ? 'Compare real Offset handle and distance field commits for the same signed values.'
    : replacementFlow ? 'Retire a real pending Offset preview and queued Apply when the source file is replaced.'
    : capReference ? 'Verify an open Shell on the native cap produced by Offset face.'
    : 'Compare a picked Extrude driver edit with an explicit native cap Offset face.',
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
  faces: brep.faces.map(face => ({
    name: face.name, geometry: faceGeometry(face),
    ...(process.argv[3] === '"face-loops"' ? { loops: face.loops.map(id => {
      const loop = brep.loops.find(loop => loop.id === id);
      return { kind: loop.kind, vertices: loop.coedges.map(id => {
        const use = brep.coedges.find(use => use.id === id);
        const edge = brep.edges.find(edge => edge.id === use.edge);
        assert.equal(edge.curve.degree, 1);
        const start = edge.vertices[use.sense === 'forward' ? 0 : 1];
        return brep.vertices.find(vertex => vertex.id === start).point;
      }) };
    }) } : {}),
  })),
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

async function choose(bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
}

async function open(doc, bytes = Buffer.from(JSON.stringify(doc))) {
  await choose(bytes);
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

async function checkCapShell(label, doc, parent, height, wall, name = 'n3.top', rematchedFrom) {
  await f.same(doc);
  const shell = doc.nodes.at(-1);
  assert.equal(shell.kind, 'shell');
  assert.deepEqual(shell.parent, { node: 4, side: 'solid' });
  assert.deepEqual(shell.open, [name]);
  assert.ok(shell.sigs?.[name]);
  assert.equal(shell.held, undefined);
  assert.equal(shell.suppressed, undefined);
  assert.deepEqual(shell.rematched, rematchedFrom ? { [name]: rematchedFrom } : undefined);
  const source = await f.inspect(`${label}-cap-native`, parent);
  const cap = source.faces.find(face => face.name === name);
  assert.equal(cap?.geometry.kind, 'plane');
  near(cap.geometry.o[2], height);
  assert.deepEqual(cap.geometry.n, [0, 0, 1]);
  const result = await f.inspect(`${label}-shell-native`, doc, 'face-loops');
  const stock = 200 * height, cavity = (20 - 2 * wall) * (10 - 2 * wall) * (height - wall);
  const volume = stock - cavity, z = (stock * height / 2 - cavity * (height + wall) / 2) / volume;
  for (const solid of [result.mass, (await f.bodies()).bodies[0]]) {
    near(solid.volume, volume);
    solid.centroid.forEach((value, i) => near(value, [10, 5, z][i]));
  }
  const rim = result.faces.find(face => face.name === name);
  assert.equal(rim?.geometry.kind, 'plane');
  assert.deepEqual(rim.loops.map(loop => loop.kind), ['outer', 'inner']);
  for (const { kind, vertices } of rim.loops) {
    const inset = kind === 'outer' ? 0 : wall;
    assert.equal(vertices.length, 4);
    vertices.forEach(([x, y, z]) => {
      assert.ok([inset, 20 - inset].some(expected => Math.abs(x - expected) <= 1e-7));
      assert.ok([inset, 10 - inset].some(expected => Math.abs(y - expected) <= 1e-7));
      near(z, height);
    });
    assert.equal(new Set(vertices.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`)).size, 4);
  }
  assert.ok(result.faces.some(face => face.geometry.kind === 'plane' && face.geometry.n[2] > 0.999999
    && Math.abs(face.geometry.o[2] - wall) <= 1e-7), 'The native cavity floor is at the wall depth.');
  f.report.observations.push({ label, sourceHeightMm: parent.nodes[1].height, storedPlane: parent.nodes[2].plane,
    nativeCap: cap, rimLoops: rim.loops, open: shell.open, parent: shell.parent, sig: shell.sigs[name], volumeMm3: result.mass.volume,
    expectedVolumeMm3: volume, centroidMm: result.mass.centroid, wallMm: wall });
  await f.snapshot(label);
}

async function authorCapShell() {
  const seed = await f.inspect('seed', {}, 'seed');
  await f.newPage();
  await open(seed);
  const initial = await box('source-5', seed, 5);
  await pickCap('01-cap-for-offset', initial, 5);
  await clickModelCommand(f.page, 'Modify', 'Offset face');
  await hud().getByLabel('Offset', { exact: true }).fill('2');
  await status('preview');
  const extended = await apply(seed, '02-appended-offset');
  const native = await box('offset-parent', extended, 7);
  f.phase = 'use a real pick on the new cap as the Shell opening';
  const cap = await pickCap('03-cap-for-shell', native, 7);
  assert.equal(cap.name, 'n3.top');
  await clickModelCommand(f.page, 'Modify', 'Shell');
  await hud().getByLabel('Wall', { exact: true }).fill('1');
  await status('preview');
  const shelled = await apply(extended, '04-shell-applied');
  assert.deepEqual(shelled.nodes.slice(0, 5), extended.nodes);
  await checkCapShell('05-shell-from-offset-cap', shelled, extended, 7, 1);
  return { extended, shelled };
}

async function checkCapReference() {
  const { extended, shelled } = await authorCapShell();
  f.phase = 'edit the original Extrude while retaining the Offset cap and Shell opening';
  await f.openFeatureEditor(1);
  await f.editor().getByLabel('Distance', { exact: true }).fill('6');
  const edited = (await f.applyEditor(shelled, '06-source-edited')).doc;
  const updatedParent = { ...extended, nodes: [extended.nodes[0], { ...extended.nodes[1], height: 6 }, ...extended.nodes.slice(2)] };
  assert.deepEqual(edited.nodes.slice(0, 5), updatedParent.nodes);
  await checkCapShell('07-shell-after-source-edit', edited, updatedParent, 7, 1);
  await f.undo();
  await f.same(shelled);
  await f.redo();
  await f.same(edited);
  const saved = await save(edited, 'D896 offset cap reference');
  await f.newPage();
  await open(edited, saved);
  await checkCapShell('08-shell-fresh-open', edited, updatedParent, 7, 1);

  f.phase = 'edit the reopened Shell wall while retaining the cap reference';
  await f.openFeatureEditor(5);
  await f.editor().getByLabel('Wall', { exact: true }).fill('2');
  const thicker = (await f.applyEditor(edited, '09-wall-edited')).doc;
  assert.deepEqual(thicker.nodes.slice(0, 5), updatedParent.nodes);
  await checkCapShell('10-shell-wall-2', thicker, updatedParent, 7, 2);
  await f.undo();
  await f.same(edited);
  await f.redo();
  await f.same(thicker);
}

async function checkCapRematch() {
  const { extended, shelled } = await authorCapShell();
  const oldName = 'n3.top', newName = 'n1.top';
  const changed = { ...extended, nodes: [extended.nodes[0], { ...extended.nodes[1], height: 8 }, ...extended.nodes.slice(2)] };
  const upstream = await f.inspect('source-8-native-offset-parent', changed);
  assert.ok(!upstream.faces.some(face => face.name === oldName));
  near(upstream.faces.find(face => face.name === newName).geometry.o[2], 8);

  const references = () => f.page.getByRole('region', { name: 'References', exact: true });
  async function marked(label, doc) {
    await references().getByText('1 matched again · 0 need a choice', { exact: true }).waitFor();
    await button(references(), 'Confirm reference').waitFor();
    await references().getByText('Technical details', { exact: true }).click();
    await references().getByText(new RegExp(`${oldName} → ${newName}`)).waitFor();
    await checkCapShell(label, doc, changed, 8, 1, newName, oldName);
  }

  f.phase = 'refuse a live edit above the saved Offset cap';
  const before = await f.snapshot('06-before-live-missing-cap');
  await f.openFeatureEditor(1);
  await f.editor().getByLabel('Distance', { exact: true }).fill('8');
  await button(f.editor(), 'Apply').click();
  const error = f.editor().locator('.hud-error');
  await error.getByText('Kernel detail', { exact: true }).click();
  await error.getByText(/no face named n3\.top to open/).waitFor();
  const refusal = await f.snapshot('07-live-missing-cap-refused');
  await f.same(shelled);
  for (const field of ['doc', 'history', 'bodies']) assert.deepEqual(refusal[field], before[field], field);
  await f.closeEditor();
  await f.undo();
  await f.same(extended);
  await f.redo();
  await f.same(shelled);

  f.phase = 'open a cold file with its old signed reference still on the missing cap';
  const stale = { ...shelled, nodes: [...changed.nodes, shelled.nodes[5]] };
  await f.newPage();
  await choose(Buffer.from(JSON.stringify(stale)));
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.[5]?.rematched?.['n1.top'] === 'n3.top',
    null, { timeout: 15000 });
  const cold = await f.doc();
  assert.deepEqual(cold.nodes.slice(0, 5), changed.nodes);
  await marked('08-cold-marked-rematch', cold);
  const kernelToast = () => f.page.locator('.toast .toast-title').getByText('The kernel could not build this', { exact: true });
  if (noticeScope) {
    assert.equal(await kernelToast().count(), 0, 'A valid repaired Open must retire the initial evaluation failure.');
    await button(references(), 'Confirm reference').waitFor();
  }
  f.phase = 'confirm the marked cap and save the updated signature';
  await button(references(), 'Confirm reference').click();
  await f.changed(cold);
  const confirmed = await f.doc();
  await checkCapShell('09-explicitly-confirmed-cap', confirmed, changed, 8, 1, newName);
  const signature = confirmed.nodes[5].sigs[newName];
  near(signature.p[2], 8);
  const saved = await save(confirmed, 'D899 confirmed offset cap');
  await f.newPage();
  await open(confirmed, saved);
  await checkCapShell('10-confirmed-cap-fresh-open', confirmed, changed, 8, 1, newName);
  if (!noticeScope) return;

  f.phase = 'keep a genuine current failure on a different same-name file';
  const broken = structuredClone(confirmed);
  delete broken.nodes[5].sigs;
  broken.nodes[5].open = ['n9.missing'];
  await choose(Buffer.from(JSON.stringify(broken)));
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.[5]?.open?.[0] === 'n9.missing');
  const toast = f.page.getByRole('alert').filter({ hasText: 'The kernel could not build this' });
  await toast.getByText('Details', { exact: true }).click();
  await toast.getByText(/no face named n9\.missing to open/).waitFor();
  await f.snapshot('11-current-kernel-failure');
  f.phase = 'replace the genuine failure and verify the prior notice is gone';
  await open(confirmed, saved);
  assert.equal(await kernelToast().count(), 0);
  await checkCapShell('12-replacement-clears-kernel-failure', confirmed, changed, 8, 1, newName);
  await choose(Buffer.from('{'));
  const invalid = f.page.getByRole('alert').filter({ hasText: 'Could not open this file' });
  await invalid.waitFor();
  await f.same(confirmed);
  await f.snapshot('13-rejected-file-retains-current-notice');
}

function holdOffsetPreview() {
  const worker = Worker.prototype;
  const post = worker.postMessage;
  const handler = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!handler?.set) throw new Error('Worker onmessage setter required');
  let armed = false, request = null, held = null;
  worker.postMessage = function (message, ...args) {
    if (armed && message?.type === 'preview') {
      armed = false;
      request = { worker: this, id: message.id, revision: message.revision,
        nodes: (message.doc?.added ?? []).map(([, node]) => ({ id: node.id, kind: node.kind, height: node.height })) };
    }
    return Reflect.apply(post, this, [message, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true,
    get: handler.get,
    set(callback) {
      handler.set.call(this, callback && function (event) {
        if (request?.worker === this && request.id === event.data?.id && event.data.result) {
          const { id, revision, nodes } = request, result = event.data.result;
          held = { read: { id, revision, nodes, ok: result.ok, resultRevision: result.revision,
            bodies: result.bodies?.map(body => ({ key: body.key, volume: body.volume, bounds: body.mesh.bounds })) },
          deliver: () => callback.call(this, event) };
          request = null;
          return;
        }
        callback.call(this, event);
      });
    },
  });
  const notices = [];
  const watch = () => new MutationObserver(() => {
    for (const toast of document.querySelectorAll('.toast')) {
      if (!notices.includes(toast.textContent)) notices.push(toast.textContent);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch, { once: true });
  window.__d897 = {
    arm() { if (armed || held || request) throw new Error('One real preview may be held'); armed = true; },
    held: () => held?.read ?? null,
    notices: () => notices,
    release() {
      if (!held) throw new Error('No real preview is held');
      const reply = held;
      held = null;
      reply.deliver();
      return reply.read.id;
    },
  };
}

async function checkReplacement() {
  const seed = await f.inspect('seed', {}, 'seed');
  const current = { ...seed, nodes: [seed.nodes[0], { ...seed.nodes[1], height: 9 }] };
  await f.newPage();
  await open(seed);
  const native = await box('old-source-5', seed, 5);
  await pickCap('01-old-cap', native, 5);
  const tab = f.page.locator('.doc-tab input');
  const tabName = await tab.inputValue();
  await f.page.evaluate(() => window.__d897.arm());
  f.phase = 'hold a real Offset +2 reply and request Apply while it is pending';
  await clickModelCommand(f.page, 'Modify', 'Offset face');
  await status('evaluating…');
  const reply = await (await f.page.waitForFunction(() => window.__d897.held())).jsonValue();
  assert.equal(reply.ok, true);
  assert.equal(reply.resultRevision, reply.revision);
  assert.deepEqual(reply.nodes.slice(-3).map(node => node.kind), ['sketch', 'extrude', 'union']);
  assert.equal(reply.nodes.at(-2).height, 2);
  assert.equal(reply.bodies.length, 1);
  near(reply.bodies[0].bounds.max[2], 7);
  const offset = hud().getByLabel('Offset', { exact: true });
  assert.equal(await offset.inputValue(), '2');
  assert.ok(await button(hud(), 'Apply').isDisabled());
  await offset.press('Enter');
  await status('evaluating…');
  await f.same(seed);
  await f.snapshot('02-queued-apply-before-replacement');

  f.phase = 'open a replacement with the same file name and feature IDs';
  await open(current);
  await hud().waitFor({ state: 'hidden' });
  assert.equal(await tab.inputValue(), tabName);
  assert.equal(await f.page.getByLabel('Unsaved changes', { exact: true }).count(), 0);
  const before = await f.snapshot('03-current-before-old-reply');
  f.phase = 'deliver the superseded Offset reply';
  assert.equal(await f.page.evaluate(() => window.__d897.release()), reply.id);
  const after = await f.snapshot('04-current-after-old-reply');
  await f.same(current);
  for (const field of ['doc', 'history', 'selection', 'bodies', 'hud', 'notices']) {
    assert.deepEqual(after[field], before[field], field);
  }
  assert.equal(await f.page.getByLabel('Unsaved changes', { exact: true }).count(), 0);
  assert.ok(!(await f.page.evaluate(() => window.__d897.notices())).some(notice => /Source changed|Offset face/.test(notice)));
  f.report.observations.push({ label: 'real-late-preview', reply, currentHeightMm: 9, history: after.history });
  const currentNative = await box('current-height-9', current, 9);

  f.phase = 'retry Offset explicitly on the current cap';
  await pickCap('05-current-cap', currentNative, 9);
  await clickModelCommand(f.page, 'Modify', 'Offset face');
  await hud().getByLabel('Offset', { exact: true }).fill('1');
  await status('preview');
  const next = await apply(current, '06-current-offset-applied');
  assert.deepEqual(next.nodes.slice(0, 2), current.nodes);
  assert.equal(next.nodes[2].plane.origin[2], 9);
  assert.equal(next.nodes[3].height, 1);
  await box('current-offset-height-10', next, 10);
  await f.undo();
  await f.same(current);
  await f.redo();
  await f.same(next);

  f.phase = 'control: pending Enter applies when the same source stays current';
  await f.undo();
  await f.same(current);
  await pickCap('07-control-current-cap', currentNative, 9);
  await f.page.evaluate(() => window.__d897.arm());
  await clickModelCommand(f.page, 'Modify', 'Offset face');
  const controlReply = await (await f.page.waitForFunction(() => window.__d897.held())).jsonValue();
  assert.equal(controlReply.ok, true);
  near(controlReply.bodies[0].bounds.max[2], 11);
  await status('evaluating…');
  assert.ok(await button(hud(), 'Apply').isDisabled());
  await hud().getByLabel('Offset', { exact: true }).press('Enter');
  await f.same(current);
  assert.equal(await f.page.evaluate(() => window.__d897.release()), controlReply.id);
  await f.changed(current);
  await hud().waitFor({ state: 'hidden' });
  const queued = (await f.snapshot('08-control-queued-apply')).doc;
  assert.deepEqual(queued.nodes.slice(0, 2), current.nodes);
  assert.equal(queued.nodes[2].plane.origin[2], 9);
  assert.equal(queued.nodes[3].height, 2);
  await box('control-queued-height-11', queued, 11);
  await f.undo();
  await f.same(current);
  f.report.observations.push({ label: 'queued-apply-control', reply: controlReply, resultHeightMm: 11 });
}

async function checkHandleParity() {
  const seed = await f.inspect('seed', {}, 'seed');
  await f.newPage();
  await open(seed);
  const native = await box('stock-height-5', seed, 5);
  const field = () => hud().getByLabel('Offset', { exact: true });
  const views = f.page.getByRole('group', { name: 'Views', exact: true });
  const ortho = button(views, 'Ortho');
  if (await ortho.getAttribute('aria-pressed') !== 'true') await ortho.click();
  assert.equal(await ortho.getAttribute('aria-pressed'), 'true');
  for (const [target, name] of [[3, 'outward'], [-1, 'inward']]) {
    const accepted = [];
    for (const input of ['handle', 'field']) {
      const label = `${name}-${input}`;
      f.phase = `${label}: start Offset on the same native cap`;
      const cap = await pickCap(`${label}-picked`, native, 5);
      assert.equal(cap.name, 'n1.top');
      await clickModelCommand(f.page, 'Modify', 'Offset face');
      await status('preview');
      assert.equal(await field().inputValue(), '2');
      if (input === 'handle') {
        f.phase = `${label}: move the real handle along the cap normal`;
        const arrow = f.page.locator('g.gizmo-handle[data-handle="d"] polygon');
        await arrow.waitFor();
        const head = await arrow.evaluate(polygon => {
          const r = polygon.getBoundingClientRect();
          return [r.x + r.width / 2, r.y + r.height / 2];
        });
        const [from, to] = await f.page.evaluate(distance => [
          window.__studioScreenOf([10, 5, 5]),
          window.__studioScreenOf([10, 5, 5 + distance]),
        ], target - 2);
        const delta = to.map((value, i) => value - from[i]);
        assert.ok(Math.hypot(...delta) > 8);
        await f.page.mouse.move(...head);
        await f.page.mouse.down();
        await f.page.mouse.move(...head.map((value, i) => value + delta[i]), { steps: 6 });
        await f.page.mouse.up();
        assert.equal(await field().inputValue(), String(target));
        f.report.observations.push({ label, targetMm: target, startMm: 2, dragCssPx: delta });
      } else {
        await field().fill(String(target));
      }
      await status('preview');
      assert.equal(await field().inputValue(), String(target));
      await f.same(seed);
      await f.snapshot(`${label}-preview`);
      const doc = await apply(seed, `${label}-applied`);
      assert.deepEqual(doc.nodes.slice(0, 2), seed.nodes);
      assert.equal(doc.nodes[2].plane.origin[2], 5);
      assert.equal(doc.nodes[3].height, Math.abs(target));
      assert.equal(doc.nodes[3].from ?? 0, target < 0 ? target : 0);
      assert.equal(doc.nodes[4].kind, target > 0 ? 'union' : 'difference');
      await box(`${label}-native`, doc, 5 + target);
      accepted.push(doc);
      await f.undo();
      await f.same(seed);
    }
    assert.deepEqual(...accepted);
    f.report.observations.push({ label: `${name}-exact-graph`, distanceMm: target,
      candidateSHA256: sha256(Buffer.from(JSON.stringify(accepted[0]))), exactEquality: true });
  }
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    if (replacementFlow) await context.addInitScript(holdOffsetPreview);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  if (capRematch || noticeScope) {
    await checkCapRematch();
    return;
  }
  if (handleParity) {
    await checkHandleParity();
    return;
  }
  if (replacementFlow) {
    await checkReplacement();
    return;
  }
  if (capReference) {
    await checkCapReference();
    return;
  }
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
