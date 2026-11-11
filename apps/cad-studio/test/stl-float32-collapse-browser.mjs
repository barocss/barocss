import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode, probe] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const baseline = mode === '--baseline';
assert.ok(probe === undefined || (probe === '--observe-worker' && !baseline));
const observeWorker = probe === '--observe-worker';
const thin = 1 / 4096;
const box = (index, height, from) => [
  { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 2], id: `n${index}` },
  { kind: 'extrude', sketch: index, height, from, id: `n${index + 1}` },
];
const documentOf = from => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [...box(0, 1, -4), ...box(2, thin, from)],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
});
const ordinary = documentOf(0);
const witness = documentOf(9999);

const oracleSource = String.raw`
import base64
import json
import math
import struct
import sys

d = json.load(sys.stdin)
rows = []
def cross(u, v):
    return tuple(u[(i+1)%3]*v[(i+2)%3] - u[(i+2)%3]*v[(i+1)%3] for i in range(3))
for mesh in d['meshes']:
    data = base64.b64decode(mesh['encoded'], validate=True)
    count, = struct.unpack_from('<I', data, 80)
    assert count == 12 and len(data) == 84 + count * 50
    collapsed = 0
    zs = set()
    for i in range(count):
        entry = struct.unpack_from('<12fH', data, 84 + i * 50)
        normal, a, b, c = entry[:3], entry[3:6], entry[6:9], entry[9:12]
        assert all(map(math.isfinite, entry))
        zs.update(p[2] for p in (a, b, c))
        cp = cross([x-y for x, y in zip(b, a)], [x-y for x, y in zip(c, a)])
        if cp == (0, 0, 0):
            collapsed += 1
            assert math.isclose(math.hypot(*normal), 1.0, abs_tol=1e-7), normal
        else:
            assert sum(x*y for x, y in zip(cp, normal)) > 0, (normal, cp)
    assert collapsed == mesh['collapsed'] and sorted(zs) == mesh['z'], (mesh['name'], collapsed, zs)
    rows.append(dict(name=mesh['name'], triangles=count, collapsed=collapsed, z=sorted(zs)))
print(json.dumps(dict(status='PASS', meshes=rows)))
`;

const f = await createFlow({
  name: 'stl-float32-collapse', envFrozen: observeWorker ? 'D693_SOURCE_FROZEN' : 'D681_SOURCE_FROZEN', output, oracleSource,
  qualification: observeWorker ? 'D693 native STL Worker result and Studio publication' : `D681 desktop STL Float32 collapse ${mode}`,
  initialFiles: [
    'apps/cad-studio/test/stl-float32-collapse-browser.mjs', 'packages/barocss-cad/src/io/stl.ts',
    'packages/barocss-cad/src/part/part-model.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts',
    'packages/barocss-cad-model/src/engine/stl.ts',
  ],
  limits: ['Two independent native boxes. Actual Studio bytes intercepted at the local download boundary.'],
});

function observeStlReplies() {
  const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
  if (!descriptor?.set) throw new Error('Expected Worker onmessage setter');
  const post = Worker.prototype.postMessage;
  const requests = new WeakMap();
  window.__d693StlReplies = [];
  Worker.prototype.postMessage = function (request, ...args) {
    if (request?.type === 'stl') {
      if (!requests.has(this)) requests.set(this, new Map());
      requests.get(this).set(request.id, { id: request.id, key: request.key, quality: request.options?.segmentsPerQuarter ?? null });
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(Worker.prototype, 'onmessage', {
    configurable: descriptor.configurable, get: descriptor.get,
    set(callback) {
      descriptor.set.call(this, callback && function (event) {
        const request = requests.get(this)?.get(event.data?.id);
        if (request) {
          requests.get(this).delete(event.data.id);
          window.__d693StlReplies.push({
            ...request,
            bytes: event.data.bytes ? Array.from(event.data.bytes) : event.data.bytes,
            error: event.data.error ?? null,
          });
        }
        callback.call(this, event);
      });
    },
  });
}

function captureExport() {
  const create = URL.createObjectURL;
  const click = HTMLAnchorElement.prototype.click;
  const urls = new Map();
  window.__d681Exports = [];
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    if (blob.type === 'model/stl' || blob.type === 'application/json') urls.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = urls.get(this.href);
    if (blob && /^d681-(?:ordinary|thin)(?:-b[13]\.stl|\.source\.json)$/.test(this.download)) {
      const name = this.download;
      window.__d681Exports.push(blob.arrayBuffer().then(bytes => ({
        name, type: blob.type, encoded: btoa(String.fromCharCode(...new Uint8Array(bytes))),
      })));
      urls.delete(this.href);
      return;
    }
    return click.call(this);
  };
}

const button = name => f.page.getByRole('button', { name, exact: true });
async function open(name, doc, raw = JSON.stringify(doc)) {
  f.phase = `open ${name}`;
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await f.same(doc);
  const bodies = (await f.bodies()).bodies;
  assert.deepEqual(bodies.map(body => body.key), ['b1', 'b3']);
  assert.ok(Math.abs(bodies[0].volume - 4) < 1e-10);
  assert.ok(Math.abs(bodies[1].volume - 4 * thin) < 1e-10);
  const expected = [1, 1, doc.nodes[3].from + thin / 2];
  expected.forEach((value, index) => assert.ok(Math.abs(bodies[1].centroid[index] - value) < 1e-9));
}

const artifacts = () => f.page.evaluate(() => Promise.all(window.__d681Exports));
async function exportStl(label, name, doc, quality, collapse) {
  f.phase = label;
  const before = await artifacts();
  const replyStart = observeWorker ? await f.page.evaluate(() => window.__d693StlReplies.length) : 0;
  await button('Export STL').click();
  const dialog = f.page.getByRole('dialog', { name: 'STL export', exact: true });
  await dialog.getByLabel('STL export quality', { exact: true }).selectOption(quality);
  await dialog.getByRole('button', { name: 'Export', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  const toast = await f.waitToast(/STL written|Could not write STL/);
  const after = (await artifacts()).slice(before.length);
  await f.snapshot(label);
  if (collapse && !baseline) {
    assert.match(toast, /Could not write STL/);
    assert.match(toast, /Float32.*collapse|collapse.*Float32/i);
    assert.deepEqual(after, []);
    const notice = f.page.locator('.toast[role="alert"]').filter({ hasText: 'Could not write STL' });
    await notice.getByText('Details', { exact: true }).click();
    assert.match(await notice.locator('details[open] code').innerText(), /STL_FLOAT32_COLLAPSE/);
    await f.snapshot(label + '-details');
  } else {
    assert.match(toast, /STL written: 2 files/);
    assert.deepEqual(after.map(file => file.name), [`${name}-b1.stl`, `${name}-b3.stl`, `${name}.source.json`]);
    const sidecar = JSON.parse(Buffer.from(after[2].encoded, 'base64'));
    assert.deepEqual(sidecar.files, after.slice(0, 2).map(file => file.name));
    const meshes = [
      { ...after[0], z: [-4, -3], collapsed: 0 },
      { ...after[1], z: collapse ? [9999] : [0, thin], collapsed: collapse ? 8 : 0 },
    ];
    await f.runOracle({ meshes }, label);
  }
  let worker;
  if (observeWorker) {
    const replies = await f.page.evaluate(start => window.__d693StlReplies.slice(start), replyStart);
    assert.deepEqual(replies.map(r => r.key), ['b1', 'b3']);
    assert.deepEqual(replies.map(r => r.quality), Array(2).fill(quality === 'automatic' ? null : Number(quality)));
    assert.equal(replies[0].error, null);
    assert.equal(replies[0].bytes.length, 684);
    if (collapse) {
      assert.equal(replies[1].bytes, null);
      assert.match(replies[1].error, /STL_FLOAT32_COLLAPSE/);
    } else for (const [i, reply] of replies.entries()) {
      assert.equal(reply.error, null);
      assert.deepEqual(Buffer.from(reply.bytes), Buffer.from(after[i].encoded, 'base64'));
    }
    worker = replies.map(({ bytes, ...reply }) => ({ ...reply, length: bytes?.length ?? null, sha256: bytes ? sha256(Buffer.from(bytes)) : null }));
  }
  f.report.observations.push({ label, quality, toast, worker, artifacts: after.map(file => ({ name: file.name, sha256: sha256(Buffer.from(file.encoded, 'base64')) })) });
  await f.same(doc);
  await f.dismissToasts();
}

async function saveAndReopenNative() {
  f.phase = 'save and fresh Open of the refused native part';
  const project = 'D681-STL-precision';
  await button('Project and versions').click();
  await f.page.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button('Project in this browser').click();
  await f.page.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await f.page.waitForFunction(async project => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const dir = await projects.getDirectoryHandle(project);
    try { return (await (await dir.getFileHandle('d681-thin.bcad')).getFile()).size > 0; }
    catch (error) { if (error.name === 'NotFoundError') return false; throw error; }
  }, project);
  const saved = await f.page.evaluate(async project => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const dir = await projects.getDirectoryHandle(project);
    return (await (await dir.getFileHandle('d681-thin.bcad')).getFile()).text();
  }, project);
  assert.deepEqual(JSON.parse(saved), witness);
  await f.page.evaluate(async project => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    await projects.removeEntry(project, { recursive: true });
  }, project);
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await open('d681-thin', witness, saved);
  f.report.observations.push({ label: 'native-save-fresh-open', sha256: sha256(saved) });
  await f.snapshot('native-save-fresh-open');
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(captureExport);
      if (observeWorker) await context.addInitScript(observeStlReplies);
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
  await f.newPage();
  await f.page.setViewportSize({ width: 1440, height: 900 });
  f.report.fixtureHashes = { ordinary: sha256(JSON.stringify(ordinary)), witness: sha256(JSON.stringify(witness)) };
  await open('d681-ordinary', ordinary);
  await exportStl('ordinary-automatic', 'd681-ordinary', ordinary, 'automatic', false);
  await open('d681-thin', witness);
  await exportStl('thin-automatic', 'd681-thin', witness, 'automatic', true);
  await exportStl('thin-fine', 'd681-thin', witness, '32', true);
  if (!baseline) await saveAndReopenNative();
  assert.deepEqual(f.report.downloads, []);
  f.phase = 'complete';
});
