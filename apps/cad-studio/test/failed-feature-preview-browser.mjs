// D749: the current failed native feature remains identifiable in a real Studio preview.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/failed-feature-preview-browser.mjs',
  'apps/cad-studio/src/state/useCommandPreview.ts',
  'apps/cad-studio/src/app/failedFeature.ts',
  'apps/cad-studio/src/app/commandState.ts',
  'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/engine/client.ts',
  'packages/barocss-cad-model/src/engine/errors.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
];
const f = await createFlow({
  name: 'failed-feature-preview', output, envFrozen: 'D749_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce a missing failed feature in the current Studio HUD' : 'Verify the failed feature in the current Studio HUD',
  limits: ['Desktop ordinary box and horizontal circular edge fillet. Reply holds alter delivery time only.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { CadPartError, evaluateCadPart } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, evaluatePreview } from '@barocss/cad-model/engine/evaluate';
import { toPartDocument } from '@barocss/cad-model/engine/part';
const sketch = withNode(emptyDoc(), { kind:'sketch', id:'n11', profile:'rectangle', min:[0,0], max:[40,30] });
const plate = withNode(sketch, { kind:'extrude', id:'n23', sketch:0, height:20 });
const doc = withNode(plate, { kind:'fillet', id:'n41', parent:{node:1, side:'solid'}, edges:['n23.side1|n23.top'], radius:8 });
const candidate = { ...doc, nodes: doc.nodes.map((n,i) => i===1 ? {...n, height:4} : n) };
const prefix = { ...plate, nodes: candidate.nodes.slice(0,2) };
const initial = evaluateDoc(doc, 10), validPrefix = evaluateDoc(prefix, 11);
assert.ok(initial.ok, JSON.stringify(initial.ok ? null : initial.error));
assert.ok(validPrefix.ok);
assert.ok(Math.abs(validPrefix.bodies[0].volume-4800)<1e-8);
assert.ok(Math.abs(initial.bodies[0].volume-(22080+480*Math.PI))<1e-7);
let cause;
try { evaluateCadPart(toPartDocument(candidate)); } catch (error) { cause=error; }
assert.ok(cause instanceof CadPartError);
assert.equal(cause.feature, 'n41');
assert.equal(cause.code, 'RADIUS_EXCEEDS_FACE');
const evaluated = evaluateDoc(candidate, 12), preview = evaluatePreview(candidate, 13);
assert.ok(!evaluated.ok && !preview.ok);
for (const result of [evaluated, preview]) {
  assert.equal(result.error.feature, cause.feature);
  assert.equal(result.error.code, cause.code);
}
console.log(JSON.stringify({ doc, plate, native:{ feature:cause.feature, code:cause.code, detail:cause.message }, model:evaluated.error, preview:preview.error }));
`,
  snapshotExtra: () => ({
    failedFeature: document.querySelector('.hud-error-feature')?.textContent ?? null,
    status: document.querySelector('.hud .status')?.textContent ?? null,
    applyDisabled: document.querySelector('.hud-actions button:last-child')?.disabled ?? null,
    historyDisabled: document.querySelector('.history')?.getAttribute('aria-disabled') ?? null,
  }),
});

function observePreviews() {
  const worker = Worker.prototype, post = worker.postMessage;
  const handler = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!handler?.set) throw new Error('Worker onmessage setter required');
  const pending = new Map(), records = [];
  let nextHold = false, held = null;
  worker.postMessage = function (request, ...args) {
    if (request?.type === 'preview') {
      const record = { id: request.id, revision: request.revision,
        nodes: (request.doc?.added ?? []).map(([, node]) => ({ id: node.id, kind: node.kind, height: node.height, radius: node.radius })) };
      pending.set(request.id, { worker: this, record, hold: nextHold });
      records.push(record);
      nextHold = false;
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: handler.get,
    set(callback) {
      handler.set.call(this, callback && function (event) {
        const data = event.data, entry = pending.get(data?.id);
        if (entry?.worker === this && data.result) {
          pending.delete(data.id);
          Object.assign(entry.record, { ok: data.result.ok, resultRevision: data.result.revision, error: data.result.error });
          if (entry.hold) {
            held = { record: entry.record, deliver: () => callback.call(this, event) };
            return;
          }
        }
        callback.call(this, event);
      });
    },
  });
  const notices = [];
  const observe = () => new MutationObserver(() => {
    const text = document.querySelector('.hud-error-feature')?.textContent;
    if (text) notices.push(text);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  if (document.body) observe(); else document.addEventListener('DOMContentLoaded', observe, { once: true });
  window.__d749 = {
    records: () => records,
    arm() { if (nextHold || held) throw new Error('One preview reply may be held'); nextHold = true; },
    held: () => held?.record ?? null,
    release() { if (!held) throw new Error('A real preview must be held'); const { deliver } = held; held = null; deliver(); },
    notices: () => notices,
    clearNotices() { notices.length = 0; },
  };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.addInitScript(observePreviews);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  const page = f.page, button = name => page.getByRole('button', { name, exact: true });
  const fixture = await f.inspect('native-fillet-source', {}, {});
  const file = 'failed-feature.bcad';
  const open = async (doc, name = file) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await f.same(doc);
  };
  const status = text => page.waitForFunction(value => document.querySelector('.hud .status')?.textContent === value, text);
  const hud = () => page.locator('.hud');
  const distance = () => hud().getByLabel('Distance', { exact: true });
  const apply = () => hud().getByRole('button', { name: 'Apply', exact: true });
  const failure = () => page.locator('.hud-error-feature');
  const showEdit = async () => {
    await button('Iso').click();
    await page.getByTitle('Frame all (F)', { exact: true }).click();
    await f.openFeatureEditor(1);
    const handle = page.locator('g.gizmo-handle[data-handle="h"]');
    await handle.waitFor({ state: 'visible' });
    const [root, head] = await handle.evaluate(g => [g.querySelector('circle'), g.querySelector('polygon')].map(node => {
      const r = node.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    }));
    const delta = [head[0] - root[0], head[1] - root[1]], len = Math.hypot(...delta);
    assert.ok(len > 0);
    await page.mouse.move(...head);
    await page.mouse.down();
    await page.mouse.move(head[0] + 10 * delta[0] / len, head[1] + 10 * delta[1] / len, { steps: 4 });
    await page.mouse.up();
    await distance().waitFor();
    await status('preview');
  };
  const setDistance = async (n, expected) => {
    await distance().fill(String(n));
    await status(expected);
    assert.equal(await distance().inputValue(), String(n));
  };
  const arm = () => page.evaluate(() => window.__d749.arm());
  const held = async () => (await page.waitForFunction(() => window.__d749.held())).jsonValue();
  const release = () => page.evaluate(() => window.__d749.release());
  const notices = () => page.evaluate(() => window.__d749.notices());
  const clearNotices = () => page.evaluate(() => window.__d749.clearNotices());
  const compareAccepted = (actual, before) => {
    for (const field of ['doc', 'history', 'selection']) assert.deepEqual(actual[field], before[field], field);
    assert.deepEqual(actual.bodies.bodies, before.bodies.bodies);
  };

  f.phase = 'Open supported native fillet and edit its upstream Extrude';
  await open(fixture.doc);
  await showEdit();
  const before = await f.snapshot('upstream-edit-ready');
  assert.match(before.hud, /Edit Extrude 20/);
  assert.equal(before.historyDisabled, 'true');
  await setDistance(4, 'refused');
  const first = await f.snapshot('downstream-native-refusal');
  compareAccepted(first, before);
  assert.equal(first.applyDisabled, true);
  assert.equal(first.historyDisabled, 'true');
  assert.match(first.hud, /RADIUS_EXCEEDS_FACE/);
  const wire = (await page.evaluate(() => window.__d749.records())).findLast(record => record.error?.feature === 'n41');
  assert.ok(wire && wire.ok === false);
  assert.equal(wire.revision, wire.resultRevision);
  assert.deepEqual(wire.error, fixture.preview);
  f.report.observations.push({ fixtureSHA256: sha256(JSON.stringify(fixture.doc)), native: fixture.native, worker: wire });
  if (baseline) {
    assert.equal(first.failedFeature, null);
    assert.doesNotMatch(first.hud, /n41|Fillet R8/);
    return;
  }
  assert.match(first.failedFeature, /Fillet R8.*n41/);
  assert.doesNotMatch(first.failedFeature, /n23|Extrude/);

  f.phase = 'A held failed preview retires when the input changes';
  await setDistance(12, 'preview');
  assert.equal(await failure().count(), 0);
  await clearNotices();
  await arm();
  await distance().fill('4');
  const stale = await held();
  assert.equal(stale.error.feature, 'n41');
  await distance().fill('14');
  await status('evaluating…');
  assert.ok(await apply().isDisabled());
  await release();
  await status('preview');
  assert.deepEqual(await notices(), []);
  await f.snapshot('late-failure-retired-after-value-change');

  f.phase = 'A to B to A creates a new refusal for the same value';
  await clearNotices();
  await arm();
  await distance().fill('4');
  const firstA = await held();
  await distance().fill('12');
  await distance().fill('4');
  assert.equal(await failure().count(), 0);
  await release();
  await status('refused');
  const lastA = (await page.evaluate(() => window.__d749.records())).at(-1);
  assert.ok(lastA.revision > firstA.revision && lastA.error.feature === 'n41');
  assert.match(await failure().textContent(), /Fillet R8.*n41/);
  await f.snapshot('new-refusal-for-repeated-value');

  f.phase = 'Cancel retires the held failure before a same-ID Open';
  await setDistance(12, 'preview');
  await clearNotices();
  await arm();
  await distance().fill('4');
  await held();
  await hud().getByRole('button', { name: 'Cancel', exact: true }).click();
  await hud().waitFor({ state: 'hidden' });
  const replacement = { ...fixture.doc, nodes: fixture.doc.nodes.map(node => node.id === 'n41' ? { ...node, radius: 6 } : node) };
  await open(replacement, 'same-id.bcad');
  await release();
  await f.same(replacement);
  assert.deepEqual(await notices(), []);
  await showEdit();
  await setDistance(4, 'refused');
  assert.match(await failure().textContent(), /Fillet R6.*n41/);
  await f.snapshot('same-id-replacement-own-refusal');
  await hud().getByRole('button', { name: 'Cancel', exact: true }).click();

  f.phase = 'New part and a different command retire a held refusal';
  await showEdit();
  await clearNotices();
  await arm();
  await distance().fill('4');
  assert.equal((await held()).error.feature, 'n41');
  await button('New part').click();
  await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await hud().waitFor({ state: 'hidden' });
  await f.ready();
  const empty = await f.doc();
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('b');
  await page.getByRole('dialog', { name: 'Box', exact: true }).waitFor();
  await release();
  await f.same(empty);
  assert.equal(await failure().count(), 0);
  assert.deepEqual(await notices(), []);
  await f.snapshot('new-part-new-command-retires-refusal');
  await hud().getByRole('button', { name: 'Cancel', exact: true }).click();

  f.phase = 'The new Fillet candidate has no accepted history owner';
  await open({ ...fixture.plate, nextId: 42 }, 'base-plate.bcad');
  const plate = await f.doc();
  await button('Iso').click();
  await page.getByTitle('Frame all (F)', { exact: true }).click();
  await clickModelCommand(page, 'Modify', 'Fillet');
  await hud().waitFor();
  const edge = await page.evaluate(() => window.__studioScreenOf([20, 0, 20]));
  await page.mouse.click(...edge);
  await hud().getByLabel('Radius', { exact: true }).fill('100');
  await status('refused');
  const newFeature = (await page.evaluate(() => window.__d749.records())).findLast(record => record.error?.code === 'RADIUS_EXCEEDS_FACE');
  assert.equal(newFeature.error.feature, 'n42');
  assert.match(await failure().textContent(), /n42.*no matching history step/);
  assert.doesNotMatch(await failure().textContent(), /Extrude 20/);
  assert.ok(await apply().isDisabled());
  await f.same(plate);
  await f.snapshot('new-fillet-no-history-owner');
  await hud().getByRole('button', { name: 'Cancel', exact: true }).click();

  f.phase = 'Successful retry, Undo/Redo and exact local native Save/Open';
  await open(fixture.doc);
  await showEdit();
  await setDistance(4, 'refused');
  await setDistance(12, 'preview');
  assert.equal(await failure().count(), 0);
  await apply().click();
  await hud().waitFor({ state: 'hidden' });
  await f.changed(fixture.doc);
  const accepted = await f.snapshot('valid-extrude-retry-applied');
  assert.equal(accepted.doc.nodes[1].height, 12);
  assert.deepEqual(accepted.doc.nodes[2], fixture.doc.nodes[2]);
  assert.ok(Math.abs(accepted.bodies.bodies[0].volume - (12480 + 480 * Math.PI)) < 1e-7);
  await f.undo();
  await f.same(fixture.doc);
  await f.redo();
  await f.same(accepted.doc);

  const project = 'D749 failed feature';
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
  assert.equal(await failure().count(), 0);
  await f.snapshot('fresh-open-valid-retry');
  assert.deepEqual(f.report.downloads, []);
});
