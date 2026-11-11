// D745: real Worker probe results delivered after a controlled delay.
import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/interference-ownership-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/checkInterference.ts',
  'apps/cad-studio/src/ui/MeasurementInspector.tsx',
  'apps/cad-studio/src/engine/client.ts',
  ...(baseline ? [] : ['apps/cad-studio/src/state/useInterferenceCheck.ts']),
];
const f = await createFlow({
  name: 'interference-ownership', output, envFrozen: 'D745_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce late interference publication after Close or Open' : 'Accept interference results only for their current run and input',
  limits: ['Native box results. The harness delays only delivery of actual Worker responses.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => {
      const el = document.querySelector(`button[aria-label="${name}"]`);
      return [el.disabled, el.getAttribute('data-tip')];
    }),
    interference: document.querySelector('[aria-label="Interference"]')?.textContent ?? null,
  }),
});

function fixture(prefix, positions, parameter = false) {
  const nodes = [], outputs = {}, bodies = {};
  for (const [i, x] of positions.entries()) {
    const n = nodes.length, key = 'b' + (n + 1);
    nodes.push({ kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + 10, 10], id: 'n' + n });
    nodes.push({ kind: 'extrude', sketch: n, height: parameter && i === 1 ? { parameter: 'H' } : 10, id: 'n' + (n + 1) });
    outputs[key] = { node: n + 1, side: 'solid' };
    bodies[key] = { name: prefix + ' ' + (i + 1) };
  }
  return { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: parameter ? { H: 10 } : {}, nodes, outputs, nextId: nodes.length, bodies };
}

function holdProbeReplies() {
  const NativeWorker = window.Worker;
  let nextWorker = 0, armed = [];
  const requests = [], held = new Map();
  window.__d745 = {
    requests,
    arm: label => armed.push(label),
    held: label => held.get(label)?.trace,
    release(label) {
      const entry = held.get(label);
      held.delete(label);
      entry.deliver();
    },
    fail(label) {
      held.get(label).worker.dispatchEvent(new ErrorEvent('error', { message: 'Controlled D745 worker failure', cancelable: true }));
    },
  };
  window.Worker = class extends NativeWorker {
    identity = ++nextWorker;
    probes = new Map();
    postMessage(request, options) {
      if (request.type === 'volumes') {
        const trace = { id: request.id, worker: this.identity, label: armed.shift() ?? null };
        this.probes.set(request.id, trace);
        requests.push(trace);
      }
      return super.postMessage(request, options);
    }
    get onmessage() { return super.onmessage; }
    set onmessage(listener) {
      super.onmessage = listener ? event => {
        const { id, volumes } = event.data ?? {};
        const trace = this.probes.get(id);
        if (!trace || !volumes) return listener.call(this, event);
        this.probes.delete(id);
        trace.reply = volumes;
        if (!trace.label) return listener.call(this, event);
        held.set(trace.label, { worker: this, trace, deliver: () => listener.call(this, event) });
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
    await context.addInitScript(holdProbeReplies);
    return context;
  };
  await f.newPage();
  const page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const panel = () => page.getByRole('complementary', { name: 'Interference', exact: true });
  const begin = () => clickModelCommand(page, 'Inspect', 'Interference');
  const traces = () => page.evaluate(() => window.__d745.requests);
  const open = async (name, doc) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await f.same(doc);
  };
  const close = async () => {
    await button('Close interference').click();
    await panel().waitFor({ state: 'hidden' });
  };
  const hold = async (label, expected) => {
    await page.evaluate(label => window.__d745.arm(label), label);
    await begin();
    await panel().getByText('Checking…', { exact: true }).waitFor();
    const trace = await (await page.waitForFunction(label => window.__d745.held(label), label)).jsonValue();
    assert.equal(trace.reply.ok, true);
    if (expected === 'empty') assert.equal(trace.reply.emptyIntersection, 'b4');
    else assert.ok(Math.abs(trace.reply.volumes.at(-1).volume - expected) < 1e-7);
    return trace;
  };
  const release = async label => {
    await page.evaluate(label => window.__d745.release(label), label);
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  };
  const unchanged = (after, before) => {
    for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(after[key], before[key], key);
  };

  f.phase = 'Close while the first pair of a multi-pair run waits';
  const multi = fixture('Multi', [0, 5, 12]);
  await open('multi', multi);
  const beforeClose = await f.snapshot('before-close');
  const closed = await hold('closed', 500);
  await close();
  const count = (await traces()).length;
  await release('closed');
  if (baseline) {
    await panel().getByText(/300 mm³/).waitFor();
    assert.equal((await traces()).length, count + 1);
  } else {
    assert.equal(await panel().count(), 0);
    assert.equal((await traces()).length, count);
  }
  const afterClose = await f.snapshot('after-close-reply');
  unchanged(afterClose, beforeClose);
  if (baseline) await close();

  f.phase = 'Replace the document with different bodies under the same keys';
  const a = fixture('Source A', [0, 5]), b = fixture('Target B', [0, 8]);
  await open('source-a', a);
  const replaced = await hold('replaced', 500);
  await open('target-b', b);
  const target = await f.snapshot('target-before-old-reply');
  await release('replaced');
  if (baseline) await panel().getByRole('button', { name: /Target B 1.*Target B 2.*500 mm³/ }).waitFor();
  else assert.equal(await panel().count(), 0);
  const afterReplace = await f.snapshot('target-after-old-reply');
  unchanged(afterReplace, target);
  if (baseline) {
    await close();
    return;
  }
  await begin();
  await panel().getByRole('button', { name: /Target B 1.*Target B 2.*200 mm³/ }).waitFor();
  const latest = (await traces()).at(-1);
  assert.equal(latest.worker, replaced.worker);
  assert.equal(latest.worker, closed.worker);
  await close();

  f.phase = 'Close before a verified empty reply';
  const empty = fixture('Empty', [0, 1]);
  for (const [index, points] of [[0, [[0,0],[4,0],[0,4]]], [2, [[1,4],[4,1],[4,4]]]]) {
    empty.nodes[index] = { kind: 'sketch', profile: 'loop', segments: points.map(start => ({ kind: 'line', start })), id: 'n' + index };
  }
  await open('empty', empty);
  const emptyReply = await hold('empty-close', 'empty');
  await close();
  await release('empty-close');
  assert.equal(await panel().count(), 0);
  assert.equal(emptyReply.worker, latest.worker);
  await f.snapshot('closed-empty-reply');

  for (const first of ['old', 'new']) {
    f.phase = 'Overlap two inspection runs and deliver ' + first + ' first';
    await open('multi-' + first, multi);
    const old = await hold('old-' + first, 500);
    const rows = page.locator('.outliner .ol-row button.ol');
    await rows.nth(1).click();
    await rows.nth(2).click({ modifiers: ['Shift'] });
    await page.waitForFunction(() => window.__studioSelection.selection.bodies.join(',') === '1,2');
    const current = await hold('new-' + first, 300);
    assert.equal(current.worker, old.worker);
    const seen = (await traces()).length;
    await release(first + '-' + first);
    if (first === 'old') assert.ok(await panel().getByText('Checking…', { exact: true }).isVisible());
    else await panel().getByRole('button', { name: /Multi 2.*Multi 3.*300 mm³/ }).waitFor();
    await release((first === 'old' ? 'new' : 'old') + '-' + first);
    const row = panel().getByRole('button', { name: /Multi 2.*Multi 3.*300 mm³/ });
    await row.waitFor();
    assert.equal((await traces()).length, seen);
    assert.equal(await panel().getByText(/500 mm³/).count(), 0);
    await button('Front').click();
    await row.click();
    await page.waitForFunction(() => window.__studioSelection.selection.bodies.join(',') === '1,2');
    await f.snapshot('latest-only-' + first + '-first');
    await close();
  }

  f.phase = 'Retire a completed result after parameter, Undo, Redo and rollback input changes';
  const param = fixture('Parametric', [0, 5], true);
  await open('parameter-only', param);
  await begin();
  await panel().getByText(/500 mm³/).waitFor();
  const edited = await f.setParameter('H', 8, 'parameter-eight');
  assert.deepEqual(edited.doc.nodes, param.nodes);
  assert.equal(await panel().count(), 0);
  await begin();
  await panel().getByText(/400 mm³/).waitFor();
  await f.undo();
  await f.same(param);
  assert.equal(await panel().count(), 0);
  await begin();
  await panel().getByText(/500 mm³/).waitFor();
  await f.redo();
  await f.same(edited.doc);
  assert.equal(await panel().count(), 0);
  await begin();
  await panel().getByText(/400 mm³/).waitFor();
  await page.locator('.history [data-node-index="1"]').click({ button: 'right' });
  await page.locator('.ctx-item').filter({ hasText: 'Roll back to here' }).click();
  await page.waitForFunction(() => window.__studioBodies().bodies.length === 1);
  await f.ready();
  assert.equal(await panel().count(), 0);
  await button('Roll forward to the end').click();
  await page.waitForFunction(() => window.__studioBodies().bodies.length === 2);
  await f.same(edited.doc);
  await begin();
  await panel().getByText(/400 mm³/).waitFor();
  await f.snapshot('parameter-and-history-current');
  await close();
  const oldParam = await hold('before-parameter-change', 400);
  const shorter = await f.setParameter('H', 6, 'parameter-six');
  assert.deepEqual(shorter.doc.nodes, param.nodes);
  await release('before-parameter-change');
  assert.equal(await panel().count(), 0);
  await begin();
  await panel().getByText(/300 mm³/).waitFor();
  assert.equal((await traces()).at(-1).worker, oldParam.worker);
  await f.snapshot('late-parameter-reply-retired');
  await close();

  f.phase = 'Retire a request across Worker failure and explicit retry';
  await open('worker-retry', a);
  const failed = await hold('worker-failed', 500);
  await page.evaluate(() => window.__d745.fail('worker-failed'));
  await button('Retry engine').waitFor();
  await release('worker-failed');
  assert.equal(await panel().count(), 0);
  await button('Retry engine').click();
  await f.same(a);
  await begin();
  await panel().getByText(/500 mm³/).waitFor();
  assert.notEqual((await traces()).at(-1).worker, failed.worker);
  await f.snapshot('worker-retry-current');
  await close();

  f.phase = 'Dispose the browser host with a pending request';
  await hold('disposed', 500);
  await f.newPage();
  assert.equal(await f.page.getByRole('complementary', { name: 'Interference', exact: true }).count(), 0);
  await f.snapshot('fresh-host');
  assert.deepEqual(f.report.downloads, []);
});
