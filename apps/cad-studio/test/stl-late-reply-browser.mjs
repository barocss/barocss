import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const fixture = 'apps/cad-studio/test/fixtures/bracket.bcad';
const first = JSON.parse(await readFile(resolve(repo, fixture), 'utf8'));
const root = node => ({ node, side: 'solid' });
const two = {
  ...first,
  nodes: [...first.nodes,
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [40, 0], max: [50, 10] },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 4 },
  ],
  outputs: { b1: root(1), b3: root(3) }, nextId: 4,
};
const current = structuredClone(first);
current.nodes[1].height = 9;
const touching = {
  ...first,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [10, 10], max: [20, 20] },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 10 },
    { id: 'n4', kind: 'union', left: root(1), right: root(3) },
  ],
  outputs: { b4: root(4) }, nextId: 5,
};
const oracleSource = String.raw`
import base64
from itertools import product
import json
import math
import struct
import sys

d = json.load(sys.stdin)
rows = []
for mesh in d['meshes']:
    raw = base64.b64decode(mesh['encoded'], validate=True)
    count, = struct.unpack_from('<I', raw, 80)
    assert count == 12 and len(raw) == 84 + count * 50
    corners = set()
    for i in range(count):
        entry = struct.unpack_from('<12fH', raw, 84 + i * 50)
        assert all(map(math.isfinite, entry))
        n, a, b, c = entry[:3], entry[3:6], entry[6:9], entry[9:12]
        corners.update((a, b, c))
        u, v = [x-y for x, y in zip(b, a)], [x-y for x, y in zip(c, a)]
        cross = [u[(k+1)%3]*v[(k+2)%3] - u[(k+2)%3]*v[(k+1)%3] for k in range(3)]
        assert sum(x*y for x, y in zip(cross, n)) > 0, (n, cross)
    assert corners == set(product(*mesh['extents'])), (corners, mesh['extents'])
    rows.append(dict(triangles=count, extents=mesh['extents']))
print(json.dumps(dict(status='PASS', meshes=rows)))
`;
const f = await createFlow({
  name: 'stl-late-reply', envFrozen: 'D682_SOURCE_FROZEN', output, oracleSource,
  qualification: `D682 desktop real STL reply ownership ${mode}`,
  initialFiles: [
    fixture, 'apps/cad-studio/test/stl-late-reply-browser.mjs', 'apps/cad-studio/src/App.tsx',
    'apps/cad-studio/src/files/useModelExports.ts', 'apps/cad-studio/src/files/ModelExportDialogs.tsx',
    'apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
    'packages/barocss-cad/src/io/stl.ts',
  ],
  limits: ['The actual Worker returns every held reply. One separate control supplies an unavailable result after the Worker replies. Output is captured at the Blob download boundary.'],
});

function controlRepliesAndExports() {
  const post = Worker.prototype.postMessage;
  const onMessage = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
  if (!onMessage?.set) throw new Error('Expected Worker onmessage setter');
  const requests = [];
  const exports = [];
  let holding = true;
  let unavailable = false;
  Worker.prototype.postMessage = function (request, ...args) {
    if (request?.type === 'stl') requests.push({ worker: this, id: request.id, key: request.key, options: request.options });
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(Worker.prototype, 'onmessage', {
    configurable: onMessage.configurable,
    get: onMessage.get,
    set(callback) {
      onMessage.set.call(this, callback && function (event) {
        const request = requests.find(row => row.worker === this && row.id === event.data?.id);
        if (request) {
          request.reply = event.data;
          request.deliver = () => callback.call(this, event);
          if (holding) return;
          request.delivered = true;
          if (unavailable) {
            unavailable = false;
            callback.call(this, new MessageEvent('message', { data: { id: request.id, bytes: null } }));
            return;
          }
        }
        callback.call(this, event);
      });
    },
  });
  const create = URL.createObjectURL;
  const click = HTMLAnchorElement.prototype.click;
  const blobs = new Map();
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    if (blob.type === 'model/stl' || blob.type === 'application/json') blobs.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = blobs.get(this.href);
    if (!blob || !/^d682-.*(?:\.stl|\.source\.json)$/.test(this.download)) return click.call(this);
    const name = this.download;
    exports.push(blob.arrayBuffer().then(bytes => ({ name, encoded: btoa(String.fromCharCode(...new Uint8Array(bytes))) })));
    blobs.delete(this.href);
  };
  window.__d682 = {
    requests: () => requests.map(({ id, key, options, reply, delivered }) => ({
      id, key, options, ready: !!reply, length: reply?.bytes?.byteLength ?? null,
      error: reply?.error, delivered: !!delivered,
    })),
    captured: () => Promise.all(exports),
    passThrough: () => { holding = false; },
    nextUnavailable: () => { exports.length = 0; unavailable = true; },
    async release(index) {
      const row = requests[index];
      if (!row?.deliver || row.delivered) throw new Error('An undelivered STL reply is required');
      row.delivered = true;
      row.deliver();
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    },
  };
}

const button = name => f.page.getByRole('button', { name, exact: true });
const dialog = () => f.page.getByRole('dialog', { name: 'STL export', exact: true });
const requestLog = () => f.page.evaluate(() => window.__d682.requests());
const artifacts = () => f.page.evaluate(() => window.__d682.captured());
const release = index => f.page.evaluate(index => window.__d682.release(index), index);
const alerts = () => f.page.locator('.toast[role="alert"]').allTextContents();

async function open(name, buffer, mimeType = 'application/json') {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType, buffer });
}

async function openNative(doc, volumes, name = 'd682-same') {
  await open(name + '.bcad', Buffer.from(JSON.stringify(doc)));
  await f.same(doc);
  assert.equal(await f.page.locator('.doc-tab input').inputValue(), name);
  const { bodies } = await f.bodies();
  assert.equal(bodies.length, volumes.length);
  bodies.forEach((body, i) => assert.ok(Math.abs(body.volume - volumes[i]) < 1e-9));
}

async function startExport(quality = 'automatic') {
  await button('Export STL').click();
  await dialog().getByLabel('STL export quality', { exact: true }).selectOption(quality);
  await dialog().getByRole('button', { name: 'Export', exact: true }).click();
}

async function held(index, key) {
  await f.page.waitForFunction(index => window.__d682.requests()[index]?.ready, index);
  const row = (await requestLog())[index];
  assert.deepEqual([row.key, row.delivered, row.length, row.error], [key, false, 684, undefined]);
  await dialog().getByRole('button', { name: 'Preparing…', exact: true }).waitFor();
  assert.equal(await dialog().getByRole('button', { name: 'Preparing…', exact: true }).isEnabled(), false);
  return row;
}

async function accepted(label, names, extents) {
  await dialog().waitFor({ state: 'detached' });
  const toast = await f.waitToast(new RegExp(`STL written: ${extents.length} file`));
  const files = await artifacts();
  assert.deepEqual(files.map(file => file.name), names);
  const sidecar = JSON.parse(Buffer.from(files.at(-1).encoded, 'base64'));
  assert.deepEqual(sidecar.files, names.slice(0, -1));
  await f.runOracle({ meshes: files.slice(0, -1).map((file, i) => ({ ...file, extents: extents[i] })) }, label);
  f.report.observations.push({
    label, toast, files: files.map(file => ({ name: file.name, sha256: sha256(Buffer.from(file.encoded, 'base64')) })),
    requests: await requestLog(),
  });
  await f.snapshot(label);
  return files;
}

const box = height => [[0, 30], [0, 12], [0, height]];
const secondBox = [[40, 50], [0, 10], [0, 4]];

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(controlRepliesAndExports);
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

  f.phase = 'Cancel with first body prepared and second reply held';
  await f.newPage();
  await openNative(two, [2160, 400]);
  await startExport();
  await held(0, 'b1');
  await release(0);
  await held(1, 'b3');
  assert.deepEqual(await artifacts(), []);
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog().waitFor({ state: 'detached' });
  await startExport('32');
  assert.deepEqual((await held(2, 'b1')).options, { segmentsPerQuarter: 32 });
  await release(1);
  await held(2, 'b1');
  assert.deepEqual(await artifacts(), []);
  assert.deepEqual(await alerts(), []);
  await f.same(two);
  await f.snapshot('cancel-stale-reply');
  await release(2);
  await held(3, 'b3');
  await release(3);
  await accepted('cancel-retry-current', ['d682-same-b1.stl', 'd682-same-b3.stl', 'd682-same.source.json'], [box(6), secondBox]);

  f.phase = 'Open same-name replacement with first body prepared and second reply held';
  await f.newPage();
  await openNative(two, [2160, 400]);
  await startExport('32');
  await held(0, 'b1');
  await release(0);
  await held(1, 'b3');
  await openNative(current, [3240]);
  const inheritedPanel = await dialog().count();
  await f.snapshot('replacement-before-stale');
  await release(1);
  await dialog().waitFor({ state: 'detached' });
  const lateAlerts = await alerts();
  f.report.observations.push({ label: 'replacement-old-reply', inheritedPanel, lateAlerts, requests: await requestLog() });
  assert.deepEqual(await artifacts(), []);
  await f.same(current);
  await f.snapshot('replacement-after-stale');
  if (mode === '--baseline') {
    assert.equal(inheritedPanel, 1);
    assert.match(lateAlerts.join(' '), /The design changed while the STL files were being prepared/);
    await f.dismissToasts();
  } else {
    assert.equal(inheritedPanel, 0);
    assert.deepEqual(lateAlerts, []);
  }
  await startExport();
  await held(2, 'b1');
  await release(2);
  const files = await accepted('replacement-current', ['d682-same-b1.stl', 'd682-same.source.json'], [box(9)]);

  if (mode === '--fixed') {
    f.phase = 'Redo crosses the New part history boundary with a reply held';
    await f.newPage();
    await openNative(first, [2160]);
    await button('New part').click();
    await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
    const empty = await f.doc();
    await button('Undo').click();
    await f.same(first);
    assert.equal(await f.page.locator('.doc-tab input').inputValue(), 'd682-same');
    await startExport();
    await held(0, 'b1');
    await button('Redo').click();
    await f.same(empty);
    assert.equal(await f.page.locator('.doc-tab input').inputValue(), 'Untitled');
    await dialog().waitFor({ state: 'detached' });
    await release(0);
    assert.deepEqual(await alerts(), []);
    assert.deepEqual(await artifacts(), []);
    await f.snapshot('history-redo-after-stale');
  }

  f.phase = 'Faceted import remains explicit-quality ineligible and Automatic eligible';
  await f.newPage();
  await open('d682-faceted.stl', Buffer.from(files[0].encoded, 'base64'), 'model/stl');
  const units = f.page.getByRole('dialog', { name: 'Mesh units', exact: true });
  await units.getByRole('button', { name: 'Open', exact: true }).click();
  await f.waitToast(/STL opened/);
  await f.ready();
  const faceted = await f.doc();
  assert.deepEqual(faceted.nodes.map(node => [node.kind, node.representation]), [['mesh', 'facets']]);
  await f.dismissToasts();
  await startExport('32');
  assert.match(await f.waitToast(/Could not write STL/), /selected STL quality needs a BRep body; use Automatic/);
  assert.deepEqual(await requestLog(), []);
  assert.deepEqual(await artifacts(), []);
  await f.dismissToasts();
  await f.page.evaluate(() => window.__d682.passThrough());
  await startExport();
  const [mesh] = (await f.bodies()).bodies;
  const meshFiles = [`d682-faceted-${mesh.key}.stl`, 'd682-faceted.source.json'];
  await accepted('faceted-automatic', meshFiles, [box(9)]);
  if (mode === '--fixed') {
    await f.dismissToasts();
    await f.page.evaluate(() => window.__d682.nextUnavailable());
    await startExport();
    await accepted('faceted-controlled-null', meshFiles, [box(9)]);
    assert.match(await f.waitToast(/written from the on-screen mesh/), /kernel’s tessellation refused/);
    assert.deepEqual((await requestLog()).map(row => [row.length, row.delivered]), [[684, true], [684, true]]);
  }
  await f.same(faceted);

  f.phase = 'Touching pieces retain the Automatic display-mesh split';
  await f.newPage();
  await openNative(touching, [2000], 'd682-touch');
  await startExport('32');
  assert.match(await f.waitToast(/Could not write STL/), /needs a separate STL for each touching piece/);
  assert.deepEqual(await artifacts(), []);
  await f.dismissToasts();
  await startExport();
  await accepted('touching-automatic', ['d682-touch-b4-lump1.stl', 'd682-touch-b4-lump2.stl', 'd682-touch.source.json'], [
    [[10, 20], [10, 20], [0, 10]], [[0, 10], [0, 10], [0, 10]],
  ]);
  assert.deepEqual(await requestLog(), []);
  await f.same(touching);
  assert.deepEqual(f.report.downloads, []);
  f.phase = 'complete';
});
