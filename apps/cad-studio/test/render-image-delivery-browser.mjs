// D711 / #2419. Deliver real image and Worker outcomes in a controlled order.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow, sha256 } from './flow-helper.mjs';
import { imagePixels, installDecodeHold } from './render-image-test-helpers.mjs';

const names = ['checker.png', 'holes.png', 'sky.png'];
const [imageA, imageB, imageC] = await Promise.all(names.map(name => readFile(new URL('./fixtures/' + name, import.meta.url))));
const invalid = Buffer.from('This is not a PNG.');
const png = buffer => 'data:image/png;base64,' + buffer.toString('base64');
const fixture = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 5, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const twoBodies = {
  ...fixture,
  nodes: [...fixture.nodes,
    { kind: 'sketch', profile: 'rectangle', min: [30, 0], max: [42, 9], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 8, id: 'n3' },
  ],
  outputs: { ...fixture.outputs, b3: { node: 3, side: 'solid' } }, nextId: 4,
  bodies: { b1: { name: 'Target plate' }, b3: { name: 'Sibling plate' } },
};
const pins = [
  'apps/cad-studio/test/render-image-delivery-browser.mjs', 'apps/cad-studio/test/render-image-test-helpers.mjs',
  ...names.map(name => 'apps/cad-studio/test/fixtures/' + name),
  ...['App.tsx', 'ui/RenderPanel.tsx', 'state/workOwnership.ts', 'state/useFeatureHistory.ts',
    'engine/client.ts', 'engine/engine.worker.ts'].map(name => 'apps/cad-studio/src/' + name),
];
const f = await createFlow({
  name: 'render-image-delivery', envFrozen: 'D711_SOURCE_FROZEN', output: process.argv[2], initialFiles: pins, requiredFrozen: pins,
  qualification: 'D711 #2419 delivery order, panel lifecycle and accepted modeling work',
  limits: ['Actual desktop Studio. Deliver original browser bitmap outcomes and one original Worker evaluation stream at selected times.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`)?.disabled),
  }),
});

function installModelReplyHold() {
  const worker = Worker.prototype;
  const onMessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!onMessage?.set) throw new Error('Worker onmessage setter required');
  const post = worker.postMessage;
  let skip = null, target = null, result = null, queued = [];
  const sent = [];
  worker.postMessage = function (request, ...args) {
    if (skip !== null && request?.type === 'evaluate') {
      const info = { id: request.id, revision: request.revision, nodeCount: request.doc.ids.length };
      sent.push(info);
      if (skip === 0) { target = { worker: this, info }; skip = null; }
      else skip--;
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onMessage.get,
    set(callback) {
      onMessage.set.call(this, callback && function (event) {
        const data = event.data;
        if (target?.worker === this && (data.id === target.info.id || (result && data.masses))) {
          queued.push(() => callback.call(this, event));
          if (data.result) result = { ...target.info, replyRevision: data.result.revision, ok: data.result.ok, bodies: data.result.bodies?.length };
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__d711ModelHold = {
    arm() {
      if (skip !== null || target) throw new Error('Already holding a model evaluation');
      skip = 1;
    },
    read: () => result,
    sent: () => [...sent],
    release() {
      if (!result) throw new Error('No held model evaluation');
      const deliveries = queued;
      queued = []; target = null; result = null;
      for (const deliver of deliveries) deliver();
    },
  };
}

const button = name => f.page.getByRole('button', { name, exact: true });
const mode = name => f.page.locator('.mode').getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Render', exact: true });
const imageOf = (doc, kind) => (kind === 'texture' ? doc.render?.defaultAppearance.texture : doc.render?.environment.map)?.image;
const imageInput = { texture: 'Texture image', environment: 'Environment image' };
const fields = ['doc', 'bodies', 'history', 'dirty', 'controls', 'selection', 'notices'];

async function open(doc = fixture) {
  await f.newPage();
  await f.page.locator('input[aria-label="Model file"]').setInputFiles({
    name: 'D711-fixture.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)),
  });
  await f.same(doc);
  await mode('Render').click();
  await panel().waitFor();
}
async function tab(kind) {
  await panel().getByRole('tab', { name: kind === 'texture' ? 'Appearance' : 'Scene', exact: true }).click();
}
async function load(kind, name, bytes, ok = true) {
  await tab(kind);
  await panel().getByLabel(imageInput[kind], { exact: true }).setInputFiles({ name, mimeType: 'image/png', buffer: bytes });
  await f.page.waitForFunction(([name, ok]) => window.__renderDecodeHold.read(name) === ok, [name, ok]);
}
async function deliver(name, ok = true) {
  await f.page.evaluate(name => window.__renderDecodeHold.release(name), name);
  if (ok) await f.page.waitForFunction(name => window.__renderDecodeHold.closed().includes(name), name);
}
async function unchanged(previous, label, ignored = []) {
  const after = await f.snapshot(label);
  for (const field of fields.filter(field => !ignored.includes(field))) assert.deepEqual(after[field], previous[field], label + ' ' + field);
  return after;
}
async function accepted(kind, previous, expected) {
  await f.changed(previous);
  const next = await f.doc();
  assert.deepEqual(await imagePixels(f.page, imageOf(next, kind)), expected);
  for (const field of ['nodes', 'outputs', 'bodies']) assert.deepEqual(next[field], previous[field]);
  await button('Undo').click();
  await f.same(previous);
  await button('Redo').click();
  await f.same(next);
  return next;
}
const closed = () => f.page.evaluate(() => window.__renderDecodeHold.closed());

async function order(kind) {
  f.phase = kind + ' reverse and mixed decode outcomes';
  await open();
  const [aPixels, bPixels, cPixels] = await Promise.all([imageA, imageB, imageC].map(image => imagePixels(f.page, png(image))));
  assert.equal(new Set([aPixels.hash, bPixels.hash, cPixels.hash]).size, 3);
  await load(kind, 'D711-reverse-A.png', imageA);
  await load(kind, 'D711-reverse-B.png', imageB);
  await deliver('D711-reverse-B.png');
  const newer = await accepted(kind, fixture, bPixels);
  await tab(kind);
  const reverse = await f.snapshot(kind + '-reverse-B');
  await deliver('D711-reverse-A.png');
  await unchanged(reverse, kind + '-reverse-A-ignored');

  await load(kind, 'D711-old-error.png', invalid, false);
  await load(kind, 'D711-new-good.png', imageA);
  const beforeOldError = await f.snapshot(kind + '-old-error-held');
  await deliver('D711-old-error.png', false);
  await unchanged(beforeOldError, kind + '-old-error-ignored');
  await deliver('D711-new-good.png');
  const original = await accepted(kind, newer, aPixels);

  await load(kind, 'D711-old-good.png', imageB);
  await load(kind, 'D711-new-error.png', invalid, false);
  const beforeNewError = await f.snapshot(kind + '-new-error-held');
  await deliver('D711-new-error.png', false);
  await f.waitToast(/Could not use that image/);
  const failed = await unchanged(beforeNewError, kind + '-new-error-current', ['notices']);
  assert.equal(failed.notices.length, 1);
  assert.deepEqual(await imagePixels(f.page, imageOf(failed.doc, kind)), aPixels);
  await deliver('D711-old-good.png');
  await unchanged(failed, kind + '-no-fallback');
  await f.dismissToasts();

  f.phase = kind + ' three inputs and same-name reselection';
  await load(kind, 'D711-three-A.png', imageA);
  await load(kind, 'D711-three-B.png', imageB);
  await load(kind, 'D711-three-C.png', imageC);
  await deliver('D711-three-C.png');
  const newest = await accepted(kind, original, cPixels);
  const afterC = await f.snapshot(kind + '-C-accepted');
  await deliver('D711-three-B.png');
  await deliver('D711-three-A.png');
  await unchanged(afterC, kind + '-A-and-B-ignored');

  // The file input clears its value after each selection, so the same name can be selected again.
  const repeated = 'D711-repeat.png';
  await load(kind, repeated, imageA);
  await deliver(repeated);
  const firstRepeat = await accepted(kind, newest, aPixels);
  await load(kind, repeated, imageB);
  await deliver(repeated);
  await accepted(kind, firstRepeat, bPixels);
  assert.equal((await closed()).filter(name => name === repeated).length, 2);
  f.report.observations.push({ kind, cases: ['reverse', 'older-error', 'latest-error-with-original', 'three-files', 'same-name'], aPixels, bPixels, cPixels, closed: await closed() });
}

async function drawingExit(kind) {
  f.phase = kind + ' Drawing exit and Render remount';
  await open();
  const other = kind === 'texture' ? 'environment' : 'texture';
  const good = 'D711-exit-good.png', bad = 'D711-exit-bad.png', fresh = 'D711-remount.png';
  await load(kind, good, imageA);
  await load(other, bad, invalid, false);
  const previousPanel = await panel().elementHandle();
  await mode('Drawing').click();
  await panel().waitFor({ state: 'detached' });
  assert.equal(await f.page.evaluate(element => element.isConnected, previousPanel), false);
  await mode('Render').click();
  await panel().waitFor();
  await load(kind, fresh, imageB);
  const before = await f.snapshot(kind + '-remount-with-old-outcomes');
  await deliver(good);
  await deliver(bad, false);
  await unchanged(before, kind + '-remount-old-outcomes-ignored');
  await deliver(fresh);
  const acceptedImage = await accepted(kind, fixture, await imagePixels(f.page, png(imageB)));
  await f.snapshot(kind + '-remount-fresh-accepted');

  const pending = 'D711-before-render-edit.png';
  await load(kind, pending, imageC);
  await tab('environment');
  const grid = panel().getByRole('checkbox', { name: 'Grid', exact: true });
  const expectedGrid = !(await grid.isChecked());
  await grid.setChecked(expectedGrid);
  await f.changed(acceptedImage);
  const expected = structuredClone(acceptedImage);
  expected.render.environment.grid = expectedGrid;
  await f.same(expected);
  const changed = await f.snapshot(kind + '-render-edit-before-delivery');
  await deliver(pending);
  await unchanged(changed, kind + '-render-edit-kept');
  await button('Undo').click();
  await f.same(acceptedImage);
  assert.deepEqual(await closed(), [good, fresh, pending]);
  f.report.observations.push({ kind, cases: ['Drawing-exit-and-remount', 'render-setting-edit'], closed: await closed() });
}

async function startDeletion() {
  await f.page.getByRole('button', { name: 'Target plate', exact: true }).click();
  await f.page.evaluate(() => window.__d711ModelHold.arm());
  await f.page.keyboard.press('Delete');
  await f.page.waitForFunction(() => window.__d711ModelHold.read() && window.__studioFresh === false);
  const trace = await f.page.evaluate(() => ({ held: window.__d711ModelHold.read(), sent: window.__d711ModelHold.sent() }));
  assert.equal(trace.sent.length, 2);
  assert.equal(trace.held.id, trace.sent[1].id);
  assert.equal(trace.held.ok, true);
  assert.equal(trace.held.replyRevision, trace.held.revision);
  assert.equal(trace.held.bodies, 1);
  assert.equal(Object.hasOwn((await f.doc()).outputs, 'b1'), false);
  return trace;
}

async function modeling() {
  f.phase = 'Retire imports begun before a real modeling evaluation';
  await open(twoBodies);
  const oldTexture = 'D711-pre-work.png', oldEnvironment = 'D711-pre-work-error.png';
  await load('texture', oldTexture, imageA);
  await load('environment', oldEnvironment, invalid, false);
  const trace = await startDeletion();
  const pending = await f.snapshot('prior-requests-model-pending');
  await deliver(oldTexture);
  await unchanged(pending, 'prior-texture-ignored-during-work');
  await f.page.evaluate(() => window.__d711ModelHold.release());
  await f.ready();
  const complete = await f.snapshot('prior-requests-model-complete');
  assert.deepEqual(complete.bodies.bodies.map(body => body.key), ['b3']);
  await deliver(oldEnvironment, false);
  await unchanged(complete, 'prior-environment-error-ignored-after-work');
  f.report.observations.push({ case: 'older-images-across-model-work', ...trace, closed: await closed() });

  f.phase = 'Refuse current image imports while model evaluation is pending';
  await open(twoBodies);
  const current = await startDeletion();
  const before = await f.snapshot('current-requests-model-pending');
  for (const kind of ['texture', 'environment']) {
    const name = 'D711-during-work-' + kind + '.png';
    await load(kind, name, imageA);
    await deliver(name);
    await f.waitToast(/Change not applied.*Wait for the computation/);
    await unchanged(before, kind + '-blocked-during-model-work', ['notices']);
    await f.dismissToasts();
  }
  await f.page.evaluate(() => window.__d711ModelHold.release());
  await f.ready();
  const settled = await f.doc();
  assert.deepEqual(settled, before.doc);
  const fresh = 'D711-after-work.png';
  await load('environment', fresh, imageB);
  await deliver(fresh);
  await accepted('environment', settled, await imagePixels(f.page, png(imageB)));
  assert.deepEqual(await closed(), ['D711-during-work-texture.png', 'D711-during-work-environment.png', fresh]);
  await f.snapshot('fresh-environment-after-model-work');
  f.report.observations.push({ case: 'current-images-blocked-during-model-work', ...current, closed: await closed() });
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.addInitScript(installDecodeHold, 'D711-');
    await context.addInitScript(installModelReplyHold);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  f.report.fixtureHashes = [imageA, imageB, imageC].map(sha256);
  for (const kind of ['texture', 'environment']) await order(kind);
  for (const kind of ['texture', 'environment']) await drawingExit(kind);
  await modeling();
  assert.deepEqual(f.report.downloads, []);
});
