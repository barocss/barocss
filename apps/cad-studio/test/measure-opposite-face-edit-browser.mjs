import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const projectFlow = process.argv[3] === '--project';
const missing = process.argv[3] === '--missing';
const held = process.argv[3] === '--held';
const pin = projectFlow || missing || held || process.argv[3] === '--pin';
const pins = [
  'apps/cad-studio/test/measure-opposite-face-edit-browser.mjs',
  'apps/cad-studio/test/model-rail-helper.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/MeasurementInspector.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'packages/barocss-cad-model/src/app/measure.ts',
  ...(pin ? ['apps/cad-studio/src/app/pinnedFaceMeasure.ts'] : []),
];
const f = await createFlow({
  name: 'measure-opposite-face-edit', output: process.argv[2], envFrozen: projectFlow ? 'D931_SOURCE_FROZEN' : missing ? 'D930_SOURCE_FROZEN' : held ? 'D929_SOURCE_FROZEN' : pin ? 'D928_SOURCE_FROZEN' : 'D927_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: projectFlow ? 'Keep a measurement pin within its workspace and project session.' : missing ? 'Never transfer a pinned measurement to a surviving output after suppression or deletion.' : held ? 'Keep a pinned measurement owned by its accepted document across genuine held Worker replies.' : pin ? 'Pin one opposite native cap pair through editing, history and document replacement.' : 'Re-pick the two native planar caps after a numeric feature edit, Undo, Redo and File Open.',
  limits: ['One rectangular Extrude in default XY. Only one explicit cap pair per document session.'],
  snapshotExtra: () => ({
    fresh: window.__studioFresh,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
    pinned: document.querySelector('[aria-label="Pinned measurement"]')?.textContent ?? null,
    measure: document.querySelector('[aria-label="Measurement"]')?.textContent ?? null,
    overlay: window.__studioOverlayTexts?.()['measure:label'] ?? [],
  }),
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { toPartDocument } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [body] = evaluateCadPart(toPartDocument(doc)).outputs;
console.log(JSON.stringify({
  valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume,
  planes: body.brep.faces.filter(face => face.name === 'n1.top' || face.name === 'n1.bottom')
    .map(({ name, surface }) => ({ name, surface })),
  corners: body.brep.vertices.map(vertex => vertex.point),
}));
`,
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 12], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const withWitness = {
  ...source,
  nodes: [...source.nodes,
    { kind: 'sketch', profile: 'rectangle', min: [34, 0], max: [54, 12], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 19, id: 'n3' },
  ],
  outputs: { ...source.outputs, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Measurement', exact: true });
const pinnedPanel = () => f.page.getByRole('complementary', { name: 'Pinned measurement', exact: true });
const metric = label => panel().locator('.kv').filter({ hasText: new RegExp('^' + label + '\\b') }).locator('b');
async function open(name, doc) {
  const buffer = Buffer.from(JSON.stringify(doc));
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer });
  await f.same(doc);
  f.report.observations.push({ label: name, sha256: sha256(buffer) });
}
async function cap(side, height) {
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: side, exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.locator('.view-cube .vc-label').getByText(side.toUpperCase(), { exact: true }).waitFor();
  await f.page.waitForFunction(([side, height]) => {
    const eye = window.__studioEye?.();
    return eye && (side === 'Top' ? eye[2] > height : eye[2] < 0);
  }, [side, height]);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const world = [10, 6, side === 'Top' ? height : 0];
  const pixel = await f.page.evaluate(world => window.__studioScreenOf(world), world);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.click(...pixel);
}
async function check(label, height, reverse = false, keep = false) {
  f.phase = 'measure ' + label;
  const before = await f.snapshot(label + '-before');
  const raw = await f.inspect(label + '-native', before.doc);
  assert.equal(raw.valid, true);
  assert.deepEqual(raw.planes.map(face => face.name).sort(), ['n1.bottom', 'n1.top']);
  assert.equal(raw.corners.length, 8);
  assert.deepEqual([...new Set(raw.corners.map(point => point[2]))].sort((a, b) => a - b), [0, height]);
  assert.ok(Math.abs(raw.volume - 240 * height) < 1e-8);
  await clickModelCommand(f.page, 'Inspect', 'Measure');
  await panel().waitFor();
  assert.equal(await panel().locator('.measure-item').count(), 0);
  await cap(reverse ? 'Bottom' : 'Top', height);
  await panel().getByText('Planar face', { exact: true }).waitFor();
  await cap(reverse ? 'Top' : 'Bottom', height);
  await panel().getByText('BETWEEN', { exact: true }).waitFor();
  assert.deepEqual(await metric('Area').allTextContents(), ['240 mm²', '240 mm²']);
  assert.equal(await metric('Distance').innerText(), height + ' mm');
  assert.equal(await metric('Normal distance').innerText(), height + ' mm');
  assert.equal(await metric('Angle').innerText(), '0°');
  assert.deepEqual((await metric('ΔX ΔY ΔZ').innerText()).split(', ').map(Number), [0, 0, reverse ? height : -height]);
  await f.page.waitForFunction(height => window.__studioOverlayTexts?.()['measure:label']?.includes(height + ' mm'), height);
  const current = await f.snapshot(label);
  for (const field of ['doc', 'bodies', 'history', 'controls', 'dirty']) assert.deepEqual(current[field], before[field], field);
  f.report.observations.push({ label, heightMM: height, nativeVolumeMM3: raw.volume, measurement: current.measure, overlay: current.overlay });
  if (keep) {
    await button('Pin measurement').click();
    await panel().waitFor({ state: 'hidden' });
    const pinned = await checkPin(label + '-pinned', height);
    for (const field of ['doc', 'bodies', 'history', 'controls', 'dirty']) assert.deepEqual(pinned[field], before[field], field);
    return;
  }
  await button('Done measuring').click();
  await panel().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
}

async function checkPin(label, height) {
  await pinnedPanel().getByText(height + ' mm', { exact: true }).waitFor();
  await f.page.waitForFunction(height => window.__studioOverlayTexts?.()['measure:label']?.includes(height + ' mm'), height);
  const snapshot = await f.snapshot(label);
  assert.equal(snapshot.measure, null);
  assert.ok(Math.abs(snapshot.bodies.bodies[0].volume - 240 * height) < 1e-8);
  f.report.observations.push({ label, pinnedMM: height, volumeMM3: snapshot.bodies.bodies[0].volume });
  return snapshot;
}

async function pinFlow() {
  await check('01-original-8', 8, false, true);
  f.phase = 'select a face independently of the pinned measurement';
  await cap('Top', 8);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.faces.length === 1);
  const selected = await checkPin('03-independent-selection', 8);
  assert.equal(selected.selection.selection.faces.length, 1);
  await f.page.keyboard.press('Escape');
  await f.page.waitForFunction(() => window.__studioSelection?.selection.faces.length === 0);
  await checkPin('04-selection-cleared', 8);

  f.phase = 'edit the accepted extrusion while the measure is pinned';
  await f.openFeatureEditor(1, 'Extrude');
  const distance = f.editor().getByLabel('Distance', { exact: true });
  await distance.fill('13.25');
  const edited = await f.applyEditor(source, '05-apply-distance');
  assert.equal(edited.doc.nodes[1].height, 13.25);
  await checkPin('06-pin-after-edit', 13.25);
  await f.closeEditor();

  await f.undo();
  await f.same(source);
  await checkPin('07-pin-after-undo', 8);
  await f.redo();
  await f.same(edited.doc);
  await checkPin('08-pin-after-redo', 13.25);

  f.phase = 'hide the pinned body and restore it without a stale readout';
  await button('Hide body').click();
  await pinnedPanel().getByRole('status').getByText('Measurement unavailable.', { exact: true }).waitFor();
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  await f.snapshot('09-hidden-pin-unavailable');
  await f.undo();
  await f.same(edited.doc);
  await checkPin('10-pin-visible-after-undo', 13.25);

  f.phase = 'clear the readout without changing the working document';
  await pinnedPanel().getByRole('button', { name: 'Clear pinned measurement', exact: true }).click();
  await pinnedPanel().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  await f.same(edited.doc);
  await check('11-repick-13-25', 13.25, true, true);

  f.phase = 'replace the part by File Open with the same feature IDs';
  await open('D928-same-ids', source);
  await pinnedPanel().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  await f.snapshot('12-file-open-clears');
  await check('13-ordinary-measure-after-open', 8);
}

function delayGeometry() {
  const worker = Worker.prototype;
  const send = worker.postMessage;
  const listener = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  let armed, target, held, deliver;
  const byWorker = new WeakMap();
  worker.postMessage = function (request, ...args) {
    if (request?.doc?.ids && request.doc.added) {
      let nodes = byWorker.get(this);
      if (!nodes) { nodes = new Map(); byWorker.set(this, nodes); }
      for (const [id, node] of request.doc.added) nodes.set(id, node);
      if (armed !== undefined && request.type === 'evaluate' && nodes.get(request.doc.ids[1])?.height === armed) {
        target = { worker: this, height: armed, id: request.id, revision: request.revision };
        armed = undefined;
      }
    }
    return Reflect.apply(send, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: listener.get,
    set(callback) {
      listener.set.call(this, callback && function (event) {
        const result = event.data?.result;
        if (target?.worker === this && event.data?.id === target.id && result) {
          held = { height: target.height, id: target.id, revision: target.revision, ok: result.ok };
          deliver = () => callback.call(this, event);
          target = undefined;
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__d929Geometry = {
    arm(height) { if (deliver || target) throw new Error('Release the prior reply first.'); held = undefined; armed = height; },
    read: () => held,
    release() { deliver(); deliver = undefined; },
  };
}

async function receive(height, ok) {
  await f.page.waitForFunction(height => window.__d929Geometry.read()?.height === height, height);
  const reply = await f.page.evaluate(() => window.__d929Geometry.read());
  assert.equal(reply.ok, ok);
  f.report.observations.push({ label: 'held-worker-reply', ...reply });
}

async function heldFlow() {
  await check('01-original-8', 8, false, true);
  const arm = height => f.page.evaluate(height => window.__d929Geometry.arm(height), height);
  const release = () => f.page.evaluate(() => window.__d929Geometry.release());
  const submit = async height => {
    await f.openFeatureEditor(1, 'Extrude');
    await f.editor().getByLabel('Distance', { exact: true }).fill(String(height));
    await arm(height);
    f.phase = 'apply held height ' + height;
    await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  };
  const unchanged = async (label, before) => {
    const current = await checkPin(label, 8);
    for (const field of ['doc', 'bodies', 'history', 'controls', 'dirty']) assert.deepEqual(current[field], before[field], field);
  };

  f.phase = 'genuine refused edit leaves the accepted pin visible';
  const original = await checkPin('02-accepted-pin', 8);
  await submit(0);
  await receive(0, false);
  await unchanged('03-held-refused-edit', original);
  await release();
  await f.editor().locator('.hud-error[role=status]').waitFor();
  await unchanged('04-refused-retains-pin', original);
  await f.closeEditor();

  f.phase = 'genuine successful candidate cannot replace the accepted pin while held';
  await submit(13.25);
  await receive(13.25, true);
  await unchanged('05-held-successful-candidate', original);
  // Arm the next accepted-model evaluation immediately after releasing the candidate.
  await f.page.evaluate(() => {
    window.__d929Geometry.release();
    window.__d929Geometry.arm(13.25);
  });
  await receive(13.25, true);
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.[1]?.height === 13.25 && window.__studioFresh === false);
  await pinnedPanel().getByRole('status').getByText('Measurement unavailable.', { exact: true }).waitFor();
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  const pending = await f.snapshot('06-new-accepted-geometry-pending');
  assert.equal(pending.doc.nodes[1].height, 13.25);
  assert.equal(pending.fresh, false);
  await release();
  await f.ready();
  const accepted = await checkPin('07-current-13-25', 13.25);

  f.phase = 'replace the document before delivering a genuine held edit';
  await submit(17.5);
  await receive(17.5, true);
  const before = await checkPin('08-prior-edit-held', 13.25);
  assert.deepEqual(before.doc, accepted.doc);
  await open('D929-same-ids', source);
  await pinnedPanel().waitFor({ state: 'hidden' });
  await release();
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await f.same(source);
  assert.equal(await pinnedPanel().count(), 0);
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  await check('09-current-measure-after-late-reply', 8);
}

async function missingFlow() {
  await check('01-target-8', 8, false, true);
  const historyStep = f.page.locator('.history .hs[data-node-index="1"]');
  const suppress = async on => {
    const before = await f.doc();
    await historyStep.click({ button: 'right' });
    await f.page.getByRole('menuitem', { name: on ? 'Suppress' : 'Unsuppress', exact: true }).click();
    await f.changed(before);
    return f.doc();
  };
  const unavailable = async label => {
    await pinnedPanel().getByRole('status').getByText('Measurement unavailable.', { exact: true }).waitFor();
    await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
    const state = await f.snapshot(label);
    assert.deepEqual(state.bodies.bodies.map(body => body.key), ['b3']);
    assert.ok(Math.abs(state.bodies.bodies[0].volume - 4560) < 1e-8);
    return state;
  };

  f.phase = 'suppress the pinned owner while the other body survives at its former index';
  const suppressed = await suppress(true);
  assert.equal(suppressed.nodes[1].suppressed, true);
  await unavailable('02-suppressed-with-witness');
  await suppress(false);
  await f.same(withWitness);
  await checkPin('03-unsuppressed-original', 8);

  f.phase = 'delete the pinned owner and keep the witness without borrowing its distance';
  await f.openFeatureEditor(1, 'target Extrude');
  await f.editor().getByRole('button', { name: 'Delete feature', exact: true }).click();
  await f.changed(withWitness);
  const deleted = await unavailable('04-deleted-with-witness');
  assert.deepEqual(deleted.doc.nodes.map(node => node.id), ['n2', 'n3']);
  assert.deepEqual(deleted.doc.outputs, { b3: { node: 1, side: 'solid' } });
  await f.undo();
  await f.same(withWitness);
  await checkPin('05-undo-restores-original', 8);
  await f.redo();
  await f.same(deleted.doc);
  await unavailable('06-redo-keeps-witness-unpinned');
  await pinnedPanel().getByRole('button', { name: 'Clear pinned measurement', exact: true }).click();
  await f.undo();
  await f.same(withWitness);
  assert.equal(await pinnedPanel().count(), 0);
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  await check('07-manual-measure-after-clear', 8);
}

async function verifyProjectSession() {
  const name = 'D931 pinned measure', filename = 'D931-project.bcad';
  const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const workspace = label => f.page.locator('.mode').getByRole('button', { name: label, exact: true });
  const attach = async () => {
    if (!(await versions().isVisible())) await button('Project and versions').click();
    await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(name);
    await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await versions().getByLabel('Project', { exact: true }).waitFor();
  };
  const noPin = async () => {
    await pinnedPanel().waitFor({ state: 'hidden' });
    await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  };
  const save = async () => {
    if (!(await versions().isVisible())) await button('Project and versions').click();
    await button('Save').click();
    await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(filename, { exact: true }).waitFor();
    await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
    return Buffer.from(await f.page.evaluate(async ([name, filename]) => {
      const storage = await navigator.storage.getDirectory();
      const projects = await storage.getDirectoryHandle('projects');
      const project = await projects.getDirectoryHandle(name);
      const file = await (await project.getFileHandle(filename)).getFile();
      return Array.from(new Uint8Array(await file.arrayBuffer()));
    }, [name, filename]));
  };
  await attach();
  f.phase = 'save the same accepted document before pinning';
  const before = await save();
  assert.deepEqual(JSON.parse(before), source);
  await button('Project and versions').click();
  await versions().waitFor({ state: 'hidden' });
  await check('01-project-pin-8', 8, false, true);

  f.phase = 'hide the overlay in Drawing and Render and recheck on return';
  await workspace('Drawing').click();
  await f.page.getByRole('navigation', { name: 'Drawing tools', exact: true }).waitFor();
  await noPin();
  await workspace('Model').click();
  await checkPin('02-after-drawing', 8);
  await workspace('Render').click();
  await f.page.waitForFunction(() => document.querySelector('.mode .on')?.textContent === 'Render');
  await noPin();
  await workspace('Model').click();
  await checkPin('03-after-render', 8);
  await f.same(source);

  f.phase = 'save again while pinned and compare the exact file bytes';
  const pinnedBytes = await save();
  assert.deepEqual(pinnedBytes, before);
  assert.deepEqual(JSON.parse(pinnedBytes), source);
  f.report.observations.push({ label: 'exact-project-save', bytes: pinnedBytes.length, sha256: sha256(pinnedBytes) });
  await checkPin('04-after-project-save', 8);
  await versions().getByRole('button', { name: 'Close project', exact: true }).click();
  await noPin();
  await f.same(source);
  await f.snapshot('05-project-close-clears');

  f.phase = 'reload Studio and open the saved project document';
  await f.page.reload();
  await f.ready();
  await attach();
  await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(source);
  await noPin();
  await button('Project and versions').click();
  await versions().waitFor({ state: 'hidden' });
  await check('06-fresh-project-open-repin', 8, true, true);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    if (held) await context.addInitScript(delayGeometry);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  await open(projectFlow ? 'D931-project' : missing ? 'D930-two-bodies' : held ? 'D929-original' : pin ? 'D928-original' : 'D927-original', missing ? withWitness : source);
  if (projectFlow) { await verifyProjectSession(); assert.deepEqual(f.report.downloads, []); return; }
  if (missing) { await missingFlow(); assert.deepEqual(f.report.downloads, []); return; }
  if (held) { await heldFlow(); assert.deepEqual(f.report.downloads, []); return; }
  if (pin) { await pinFlow(); assert.deepEqual(f.report.downloads, []); return; }
  await check('01-original-8', 8);
  f.phase = 'change the existing Extrude distance through History';
  await f.openFeatureEditor(1, 'Extrude');
  await f.editor().getByLabel('Distance', { exact: true }).fill('13.25');
  const edited = await f.applyEditor(source, '02-edited');
  assert.equal(edited.doc.nodes[1].height, 13.25);
  assert.deepEqual(edited.doc.outputs, source.outputs);
  await f.closeEditor();
  await check('03-edited-13-25', 13.25, true);
  await f.undo();
  await f.same(source);
  await check('04-undo-8', 8);
  await f.redo();
  await f.same(edited.doc);
  await check('05-redo-13-25', 13.25);
  await f.newPage();
  await open('D927-replacement', edited.doc);
  await check('06-fresh-open-13-25', 13.25, true);
  assert.deepEqual(f.report.downloads, []);
});
