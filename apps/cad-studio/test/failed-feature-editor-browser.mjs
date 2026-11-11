// D750: Apply from the Feature Editor owns the evaluated draft and the native refusal.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/failed-feature-editor-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/ui/FeatureFailureNotice.tsx',
  'apps/cad-studio/src/app/failedFeature.ts',
  'apps/cad-studio/src/engine/client.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
];
const f = await createFlow({
  name: 'failed-feature-editor', output, envFrozen: 'D750_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce missing failure attribution and stale acceptance in Feature Editor' : 'Verify current Feature Editor Apply and refusal ownership',
  limits: ['Ordinary desktop Feature Editor and local native part. Worker instrumentation delays existing replies without rewriting them.'],
  inspectorSource: `
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
const profile = withNode(emptyDoc(), { kind:'sketch', id:'n11', profile:'rectangle', min:[0,0], max:[40,30] });
const extrude = withNode(profile, { kind:'extrude', id:'n23', sketch:0, height:20 });
const doc = withNode(extrude, { kind:'fillet', id:'n41', parent:{node:1, side:'solid'}, edges:['n23.side1|n23.top'], radius:8 });
console.log(JSON.stringify({doc}));
`,
  snapshotExtra: () => ({
    location: document.querySelector('.node-editor .hud-error-feature')?.textContent ?? null,
    editorValue: document.querySelector('.node-editor input[aria-label="Distance"]')?.value ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});

function observeApplies() {
  const worker = Worker.prototype, post = worker.postMessage;
  const handler = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!handler?.set) throw new Error('Worker onmessage setter required');
  let armed = false, target = null, deferred = null;
  worker.postMessage = function (request, ...args) {
    if (armed && request?.type === 'evaluate') {
      armed = false;
      const node = request.doc?.added?.map(([, item]) => item).find(item => item.id === 'n23');
      target = { worker: this, id: request.id, revision: request.revision, height: node?.height };
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: handler.get,
    set(callback) {
      handler.set.call(this, callback && function (event) {
        const data = event.data;
        if (target?.worker === this && data?.id === target.id && data.result) {
          deferred = { reply: { id: data.id, request: target.revision, revision: data.result.revision, height: target.height, ok: data.result.ok, error: data.result.error },
            deliver: () => callback.call(this, event) };
          return;
        }
        callback.call(this, event);
      });
    },
  });
  const notices = [];
  const observe = () => new MutationObserver(() => {
    const text = document.querySelector('.node-editor .hud-error-feature')?.textContent;
    if (text) notices.push(text);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  if (document.body) observe(); else document.addEventListener('DOMContentLoaded', observe, { once: true });
  window.__d750 = {
    arm() { if (armed || target || deferred) throw new Error('One evaluate may be held'); armed = true; },
    held: () => deferred?.reply ?? null,
    release() {
      if (!deferred) throw new Error('A real evaluate reply must be held');
      const { deliver } = deferred;
      target = deferred = null;
      deliver();
    },
    notices: () => notices,
    clearNotices() { notices.length = 0; },
  };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.addInitScript(observeApplies);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  const page = f.page, button = name => page.getByRole('button', { name, exact: true });
  const { doc: source } = await f.inspect('d750-fillet-source', {}, {});
  const file = 'feature-editor-apply.bcad';
  const open = async (doc, name = file) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await f.same(doc);
  };
  const distance = () => f.editor().getByLabel('Distance', { exact: true });
  const apply = () => f.editor().getByRole('button', { name: 'Apply', exact: true });
  const failure = () => f.editor().locator('.hud-error-feature');
  const arm = () => page.evaluate(() => window.__d750.arm());
  const held = async () => (await page.waitForFunction(() => window.__d750.held())).jsonValue();
  const release = async () => {
    await page.evaluate(() => window.__d750.release());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const clearNotices = () => page.evaluate(() => window.__d750.clearNotices());
  const notices = () => page.evaluate(() => window.__d750.notices());
  const assertHeld = (reply, height, ok) => {
    assert.equal(reply.height, height);
    assert.equal(reply.request, reply.revision);
    assert.equal(reply.ok, ok);
    if (!ok) {
      assert.equal(reply.error.feature, 'n41');
      assert.equal(reply.error.code, 'RADIUS_EXCEEDS_FACE');
    }
  };
  const compareAccepted = (actual, before) => {
    for (const field of ['doc', 'history', 'selection', 'dirty']) assert.deepEqual(actual[field], before[field], field);
    assert.deepEqual(actual.bodies.bodies, before.bodies.bodies);
  };
  const volume = height => 1200 * height - 30 * 8 ** 2 * (1 - Math.PI / 4);
  const expectedAt = height => ({ ...source, nodes: source.nodes.map(node => node.id === 'n23' ? { ...node, height } : node) });

  f.phase = 'Current genuine Apply refusal identifies the downstream feature';
  await open(source);
  await f.openFeatureEditor(1);
  const before = await f.snapshot('feature-editor-ready');
  assert.equal(before.editorValue, '20');
  assert.ok(Math.abs(before.bodies.bodies[0].volume - volume(20)) < 1e-7);
  await distance().fill('4');
  await arm();
  await apply().click();
  const current = await held();
  assertHeld(current, 4, false);
  await release();
  if (baseline) {
    const notice = await f.waitToast(/The chamfer or fillet is too large/);
    assert.doesNotMatch(notice, /n41|Fillet R8/);
  } else {
    await failure().waitFor();
    assert.match(await failure().textContent(), /Fillet R8.*n41/);
    assert.match(await f.editor().locator('.hud-error').textContent(), /RADIUS_EXCEEDS_FACE/);
    assert.equal(await page.locator('.toast').count(), 0);
  }
  const refusal = await f.snapshot('current-apply-refusal');
  compareAccepted(refusal, before);
  assert.equal(refusal.editorValue, '4');
  if (baseline) await f.dismissToasts();
  f.report.observations.push({ sourceSHA256: sha256(JSON.stringify(source)), native: current });

  f.phase = 'A late success belongs to the submitted values, not a revised draft';
  await distance().fill('12');
  await arm();
  await apply().click();
  const success = await held();
  assertHeld(success, 12, true);
  await distance().fill('14');
  assert.equal(await distance().inputValue(), '14');
  await release();
  if (baseline) {
    await f.same(expectedAt(12));
    await f.snapshot('stale-apply-accepted-on-parent');
    return;
  }
  const discarded = await f.snapshot('stale-success-retired');
  compareAccepted(discarded, before);
  assert.equal(discarded.editorValue, '14');

  f.phase = 'A held failure stays retired after an A to B to A draft edit';
  await clearNotices();
  await distance().fill('4');
  await arm();
  await apply().click();
  const older = await held();
  assertHeld(older, 4, false);
  assert.ok(await apply().isDisabled());
  await distance().fill('12');
  await distance().fill('4');
  assert.ok(await apply().isEnabled());
  await release();
  await f.same(source);
  assert.equal(await failure().count(), 0);
  assert.deepEqual(await notices(), []);
  await f.snapshot('late-failure-retired-after-repeated-value');
  await distance().press('Enter');
  await failure().waitFor();
  assert.match(await failure().textContent(), /Fillet R8.*n41/);
  await f.snapshot('repeated-value-fails-only-after-new-apply');

  f.phase = 'Closing the editor and opening a same-ID file retire its pending refusal';
  await clearNotices();
  await distance().fill('5');
  await arm();
  await apply().click();
  const superseded = await held();
  assertHeld(superseded, 5, false);
  await f.closeEditor();
  const replacement = { ...source, nodes: source.nodes.map(node => node.id === 'n41' ? { ...node, radius: 6 } : node) };
  await open(replacement, 'same-ids-editor.bcad');
  await f.openFeatureEditor(1);
  await release();
  await f.same(replacement);
  assert.equal(await failure().count(), 0);
  assert.deepEqual(await notices(), []);
  await distance().fill('4');
  await apply().click();
  await failure().waitFor();
  assert.match(await failure().textContent(), /Fillet R6.*n41/);
  await f.snapshot('same-id-editor-own-refusal');
  await f.closeEditor();

  f.phase = 'A valid retry applies and saves only the accepted document';
  await open(source);
  await f.openFeatureEditor(1);
  await distance().fill('4');
  await apply().click();
  await failure().waitFor();
  await distance().fill('14');
  assert.equal(await failure().count(), 0);
  await apply().click();
  await f.same(expectedAt(14));
  await f.closeEditor();
  const accepted = await f.snapshot('valid-editor-retry-applied');
  assert.ok(Math.abs(accepted.bodies.bodies[0].volume - volume(14)) < 1e-7);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(accepted.doc);

  const project = 'D750 Feature Editor';
  const panel = () => page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const attach = async () => {
    if (!(await panel().isVisible())) await button('Project and versions').click();
    await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await panel().getByLabel('Project', { exact: true }).waitFor();
  };
  await attach();
  await button('Save').click();
  await panel().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await page.evaluate(async ([project, file]) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await dir.getFileHandle(file)).getFile()).text();
  }, [project, file]);
  assert.deepEqual(JSON.parse(saved), accepted.doc);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await panel().getByRole('button', { name: 'Close project', exact: true }).click();
  await panel().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await panel().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(accepted.doc);
  await f.openFeatureEditor(1);
  assert.equal(await failure().count(), 0);
  assert.equal(await distance().inputValue(), '14');
  await f.snapshot('native-reopen-editor-current');
  assert.deepEqual(f.report.downloads, []);
});
