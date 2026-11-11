// D741: actual STEP Open and recovery through the desktop Worker.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { cylinderStep } from '../../../packages/barocss-cad/test/step-fixtures.mjs';
import { curveWrapperStep, verifyWrapperGraph } from '../../../packages/barocss-cad/test/step-curve-wrapper-fixtures.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/step-curve-wrapper-browser.mjs',
  'apps/cad-studio/src/files/importedFile.ts',
  'apps/cad-studio/src/engine/engine.worker.ts',
  'packages/barocss-cad/test/step-curve-wrapper-fixtures.mjs',
  'packages/barocss-cad/src/io/step-import.ts',
  'packages/barocss-cad/src/part/part-mesh.ts',
];
const f = await createFlow({
  name: 'step-curve-wrapper', output, envFrozen: 'D741_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce unexpected wrapper traversal failures' : 'Refuse cyclic wrappers without replacing the accepted part',
  limits: ['Controlled STEP curve-reference graphs. Actual desktop Open and unmodified Worker results.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => {
      const el = document.querySelector(`button[aria-label="${name}"]`);
      return [el.disabled, el.getAttribute('data-tip')];
    }),
    camera: [[0, 0, 0], [2, 0, 0], [0, 2, 0], [0, 0, 2]].map(point => window.__studioScreenOf(point)),
  }),
});

function observeReads() {
  const NativeWorker = window.Worker;
  const reads = [];
  window.__d741Reads = reads;
  window.Worker = class extends NativeWorker {
    pending = new Set();
    postMessage(request, options) {
      if (request.type === 'part' && request.slot === 'read') this.pending.add(request.id);
      return super.postMessage(request, options);
    }
    get onmessage() { return super.onmessage; }
    set onmessage(listener) {
      super.onmessage = listener ? event => {
        const { id, result } = event.data ?? {};
        if (result && this.pending.delete(id)) reads.push({ id, ok: result.ok, detail: result.error?.detail });
        listener.call(this, event);
      } : null;
    }
  };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(observeReads);
    return context;
  };
  await f.newPage();
  const page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const row = () => page.locator('.ol-row').filter({ has: page.locator('button.ol-eye') }).locator('button.ol');
  const readTrace = () => page.evaluate(() => window.__d741Reads.at(-1));
  const open = async (name, text) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: name + '.step', mimeType: 'application/step', buffer: Buffer.from(text) });
  };
  const opened = async text => {
    await f.waitToast(/STEP opened.*1 solid/);
    await page.waitForFunction(expected => window.__studioDoc.nodes[0]?.step === expected, text);
    await f.ready();
    assert.equal((await readTrace()).ok, true);
  };
  const rename = async next => {
    const previous = await f.doc();
    await row().dblclick();
    const input = page.getByRole('textbox', { name: 'Body name', exact: true });
    await input.fill(next);
    await input.press('Enter');
    await f.changed(previous);
    const accepted = await f.doc();
    assert.ok(Object.values(accepted.bodies).some(body => body.name === next));
    return accepted;
  };
  const checkVolume = (snapshot, expected) => {
    const [body] = snapshot.bodies.bodies;
    assert.equal(snapshot.bodies.bodies.length, 1);
    assert.ok(Math.abs(body.volume - expected) < 1e-7, `${body.volume} vs ${expected}`);
  };

  f.phase = 'Open a known cylinder and create both history directions';
  const cylinder = cylinderStep();
  await open('analytic-cylinder', cylinder);
  await opened(cylinder);
  await f.dismissToasts();
  const firstRename = await rename('Retained cylinder');
  const secondRename = await rename('Redo cylinder');
  await f.undo();
  await f.same(firstRename);
  await button('Front').click();
  await row().click();
  const prior = await f.snapshot('before-refusal');
  assert.deepEqual(prior.selection.selection.bodies, [0]);
  assert.ok(prior.dirty);
  assert.ok(prior.historyControls.every(([disabled]) => !disabled));
  assert.ok(prior.camera.every(point => point?.length === 2 && point.every(Number.isFinite)));
  checkVolume(prior, 250 * Math.PI);

  for (const [path, length] of [['edge', 1], ['extrusion', 2], ['revolution', 3]]) {
    f.phase = 'Open a cyclic STEP ' + path;
    const fixture = curveWrapperStep(path, { length, end: 'cycle' });
    verifyWrapperGraph(fixture, 'cycle', length);
    await f.dismissToasts();
    const before = await readTrace();
    await open('cyclic-' + path, fixture.text);
    const reason = baseline ? /unexpected kernel failure/i : /cyclic curve wrapper #1000 \(SURFACE_CURVE\)/i;
    const notice = await f.waitToast(reason);
    assert.match(notice, /Your part is unchanged/);
    await f.same(prior.doc);
    const after = await f.snapshot('refused-' + path);
    for (const key of ['doc', 'bodies', 'selection', 'history', 'historyControls', 'dirty']) assert.deepEqual(after[key], prior[key], key);
    after.camera.forEach((point, i) => point.forEach((coordinate, j) => assert.ok(Math.abs(coordinate - prior.camera[i][j]) < 1e-6)));
    const trace = await readTrace();
    assert.notEqual(trace.id, before.id);
    assert.equal(trace.ok, false);
    assert.match(trace.detail, reason);
    f.report.observations.push({ path, target: fixture.target, length, sha256: sha256(fixture.text), trace });
  }
  if (baseline) return;

  f.phase = 'Exercise retained history and open a wrapped sweep on the same Worker';
  await f.dismissToasts();
  await f.redo();
  await f.same(secondRename);
  await f.undo();
  await f.same(firstRename);
  const next = curveWrapperStep('extrusion', { shared: true });
  verifyWrapperGraph(next, 'basis', 3, true);
  const readBefore = await readTrace();
  await open('wrapped-extrusion', next.text);
  await opened(next.text);
  assert.notEqual((await readTrace()).id, readBefore.id);
  const replacement = await f.snapshot('opened-wrapped-extrusion');
  assert.equal(replacement.doc.nodes[0].step, next.text);
  checkVolume(replacement, 1400 / 3);
  const edited = await rename('Recovered extrusion');
  const renamed = await f.snapshot('edited-wrapped-extrusion');
  checkVolume(renamed, 1400 / 3);
  await f.undo();
  await f.same(replacement.doc);
  await f.redo();
  await f.same(edited);
  assert.deepEqual(f.report.downloads, []);
});
