import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an external evidence directory');
const fixture = 'apps/cad-studio/test/fixtures/bracket.bcad';
const base = JSON.parse(await readFile(resolve(repo, fixture), 'utf8'));
const previous = { ...base, bodies: { b1: { name: 'Old appearance', color: '#ba4040' } } };
const current = structuredClone(base);
current.nodes[1].height = 9;
const partName = 'shared-step-name';

const oracleSource = String.raw`
from itertools import product
import json
import re
import sys

d = json.load(sys.stdin)
text = d['text']
assert text.startswith('ISO-10303-21;') and text.strip().endswith('END-ISO-10303-21;')
assert "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'))" in text
assert 'SI_UNIT(.MILLI.,.METRE.)' in text
assert "PRODUCT('shared-step-name','shared-step-name'," in text
assert len(re.findall(r'=MANIFOLD_SOLID_BREP\(', text)) == 1
source, = re.findall(r'source revision ([0-9a-f]{16})', text)
points = {key: tuple(map(float, coords.split(','))) for key, coords in re.findall(
    r"#(\d+)=CARTESIAN_POINT\('',\(([^()]+)\)\);", text)}
vertices = re.findall(r"=VERTEX_POINT\('',#(\d+)\);", text)
corners = set(product((0, 30), (0, 12), (0, d['height'])))
assert len(vertices) == 8 and {points[key] for key in vertices} == corners, vertices
losses = d['losses']
assert any('feature history' in loss for loss in losses), losses
assert any('labels' in loss for loss in losses) == d['decorated'], losses
assert any('colours and materials' in loss for loss in losses) == d['decorated'], losses
print(json.dumps(dict(status='PASS', source=source, vertices=len(vertices), height=d['height'], losses=losses)))
`;

const f = await createFlow({
  name: 'step-preview-late-reply',
  envFrozen: 'D677_SOURCE_FROZEN',
  qualification: 'D677 real late STEP replies across same-name document replacement',
  output,
  oracleSource,
  initialFiles: [
    'apps/cad-studio/test/step-preview-late-reply-browser.mjs', fixture,
    'apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
    'apps/cad-studio/src/files/stepExportPreparation.ts', 'apps/cad-studio/src/files/useModelExports.ts',
    'packages/barocss-cad/src/io/step.ts',
  ],
  limits: ['Two desktop timing orders. Only delivery of real STEP Worker replies is held. No file export action.'],
});

function installReplyHold() {
  const worker = Worker.prototype;
  const onMessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!onMessage?.set) throw new Error('Worker onmessage setter required');
  const post = worker.postMessage;
  const requests = [];
  const replies = new Map();
  const workerIds = new WeakMap();
  let nextWorkerId = 1;
  let observer;
  let samples = [];
  worker.postMessage = function (request, ...args) {
    if (request?.type === 'step') {
      if (!workerIds.has(this)) workerIds.set(this, nextWorkerId++);
      requests.push({ workerId: workerIds.get(this), id: request.id, name: request.name, meshes: request.meshes });
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true,
    get: onMessage.get,
    set(callback) {
      onMessage.set.call(this, callback && function (event) {
        const request = requests.find(r => r.workerId === workerIds.get(this) && r.id === event.data?.id);
        if (request && event.data.step) {
          replies.set(request, { step: event.data.step, deliver: () => callback.call(this, event), delivered: false });
          return;
        }
        callback.call(this, event);
      });
    },
  });
  const readPanel = () => {
    const panel = document.querySelector('[aria-label="STEP export"]');
    return panel && {
      ready: ![...panel.querySelectorAll('button')].find(button => button.textContent === 'Export')?.disabled,
      status: panel.querySelector('[role="status"],[role="alert"]')?.textContent ?? null,
    };
  };
  window.__stepReplyHold = {
    report: () => requests.map(r => ({ ...r, held: replies.has(r), delivered: replies.get(r)?.delivered ?? false })),
    reply: index => replies.get(requests[index])?.step,
    watch() {
      observer?.disconnect();
      samples = [readPanel()];
      observer = new MutationObserver(() => samples.push(readPanel()));
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    },
    finishWatch() {
      observer.disconnect();
      return [...samples, readPanel()];
    },
    async release(index) {
      const entry = replies.get(requests[index]);
      if (!entry || entry.delivered) throw new Error('One undelivered STEP response required');
      entry.deliver();
      entry.delivered = true;
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    },
  };
}

const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByLabel('STEP export', { exact: true });
const exportButton = () => panel().getByRole('button', { name: 'Export', exact: true });

async function open(doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: partName + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  assert.equal(await f.page.locator('.doc-tab input').inputValue(), partName);
}

async function hold(index, label, height, decorated) {
  await button('Export STEP').click();
  await panel().getByText('Preparing geometry and loss report…', { exact: true }).waitFor();
  assert.equal(await exportButton().isEnabled(), false);
  await f.page.waitForFunction(index => window.__stepReplyHold.report()[index]?.held, index);
  const reply = await f.page.evaluate(index => window.__stepReplyHold.reply(index), index);
  assert.ok(typeof reply.text === 'string', reply.error);
  const losses = reply.omitted ?? [];
  const result = await f.runOracle({ text: reply.text, losses, height, decorated }, label);
  f.report.observations.push({ label, result, replySHA256: sha256(reply.text) });
  return result;
}

async function checkCurrent() {
  assert.deepEqual(await f.doc(), current);
  const state = await f.bodies();
  assert.ok(state.fresh && state.massReady);
  assert.equal(state.bodies.length, 1);
  assert.ok(Math.abs(state.bodies[0].volume - 30 * 12 * 9) < 1e-8, state.bodies[0].volume);
  assert.equal(await f.page.getByLabel('Unsaved changes', { exact: true }).count(), 0);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(installReplyHold);
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
        return url.origin === origin ? route.continue() : route.abort();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };
  f.report.inputHashes = { previous: sha256(JSON.stringify(previous)), current: sha256(JSON.stringify(current)) };
  for (const ordering of ['closed', 'pending']) {
    f.phase = `${ordering}: hold previous reply`;
    await f.newPage();
    await f.page.setViewportSize({ width: 1440, height: 900 });
    await open(previous);
    const oldReply = await hold(0, `${ordering}-old-worker`, 6, true);
    await f.snapshot(`${ordering}-old-pending`);
    const old = (await f.page.evaluate(() => window.__stepReplyHold.report()))[0];
    assert.deepEqual([old.name, old.held, old.delivered], [partName, true, false]);

    f.phase = `${ordering}: Open current document`;
    await open(current);
    await panel().waitFor({ state: 'detached' });
    await checkCurrent();
    const newReply = ordering === 'pending' ? await hold(1, `${ordering}-current-worker`, 9, false) : null;
    f.phase = `${ordering}: release previous reply`;
    await f.page.evaluate(() => window.__stepReplyHold.watch());
    await f.page.evaluate(() => window.__stepReplyHold.release(0));
    const samples = await f.page.evaluate(() => window.__stepReplyHold.finishWatch());
    if (ordering === 'closed') {
      assert.ok(samples.every(sample => sample === null), samples);
      assert.equal(await panel().count(), 0);
    } else {
      assert.ok(samples.every(sample => sample?.ready === false && /Preparing geometry/.test(sample.status)), samples);
      assert.equal(await exportButton().isEnabled(), false);
    }
    await checkCurrent();
    await f.snapshot(`${ordering}-after-stale-delivery`);

    f.phase = `${ordering}: release current reply`;
    const ready = newReply ?? await hold(1, `${ordering}-current-worker`, 9, false);
    assert.notEqual(ready.source, oldReply.source);
    await f.page.evaluate(() => window.__stepReplyHold.release(1));
    const lossList = panel().getByLabel('STEP loss report', { exact: true });
    await lossList.waitFor();
    assert.equal(await exportButton().isEnabled(), true);
    assert.deepEqual(await lossList.getByRole('listitem').allTextContents(), ready.losses);
    assert.match(await panel().innerText(), /STEP AP214 · B-rep geometry · mm/);
    await checkCurrent();
    const delivery = await f.page.evaluate(() => window.__stepReplyHold.report());
    assert.equal(delivery.length, 2);
    assert.notEqual(delivery[0].id, delivery[1].id);
    assert.ok(delivery.every(reply => reply.name === partName && reply.held && reply.delivered));
    f.report.observations.push({ ordering, samples, delivery });
    await f.snapshot(`${ordering}-current-ready`);
    await panel().getByRole('button', { name: 'Cancel', exact: true }).click();
    await panel().waitFor({ state: 'detached' });
  }
  assert.deepEqual(f.report.downloads, []);
  f.phase = 'complete';
});
