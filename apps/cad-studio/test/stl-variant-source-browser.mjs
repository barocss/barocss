import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an external evidence directory');
const name = 'stl-source-variant';
const master = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { Height: 6 },
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 12], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: { parameter: 'Height' }, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
  bodies: { b1: { name: 'Source plate', color: '#3377aa' } },
  variability: { version: 1, inputs: [
    { name: 'height', type: 'number', unit: 'mm', min: 1, max: 20, default: 6,
      bindings: [{ to: 'parameter', part: 'base', parameter: 'Height' }] },
  ] },
};

const oracleSource = String.raw`
import base64
from collections import Counter
import hashlib
from itertools import product
import json
import math
import struct
import sys

d = json.load(sys.stdin)
h = d['height']
stem = 'stl-source-variant'
mesh, sidecar = d['blobs']
assert (mesh['name'], mesh['type']) == (stem + '-b1.stl', 'model/stl')
assert (sidecar['name'], sidecar['type']) == (stem + '.source.json', 'application/json')
raw = base64.b64decode(mesh['encoded'], validate=True)
count, = struct.unpack_from('<I', raw, 80)
assert count == 12 and len(raw) == 84 + count * 50
edges = Counter()
corners = set()
terms = []
for i in range(count):
    row = struct.unpack_from('<12fH', raw, 84 + i * 50)
    a, b, c = row[3:6], row[6:9], row[9:12]
    assert len({a, b, c}) == 3
    corners.update((a, b, c))
    edges.update(tuple(sorted(pair)) for pair in ((a, b), (b, c), (c, a)))
    terms.append(sum(a[k] * (b[(k + 1) % 3] * c[(k + 2) % 3] - b[(k + 2) % 3] * c[(k + 1) % 3])
                     for k in range(3)))
assert corners == set(product((0, 30), (0, 12), (0, h))), corners
assert len(edges) == 18 and set(edges.values()) == {2}, edges
volume = abs(math.fsum(terms) / 6)
assert volume == 30 * 12 * h, volume

# O9 canonical revision content for this fixture. Keep the authored look in its source record.
source = {
    'bodies': {'b1': {'name': 'Source plate', 'color': '#3377aa'}},
    'nodes': [
        {'kind': 'sketch', 'profile': 'rectangle', 'min': [0, 0], 'max': [30, 12], 'id': 'n0'},
        {'kind': 'extrude', 'sketch': 0, 'height': {'parameter': 'Height'}, 'id': 'n1'},
    ],
    'outputs': {'b1': {'node': 1, 'side': 'solid'}},
    'parameters': {'Height': h},
}
canonical = json.dumps(source, sort_keys=True, separators=(',', ':')).encode('ascii')
digest = hashlib.sha256(canonical).hexdigest()
a, b = 0x811c9dc5, 0x050c5d1f
for byte in canonical:
    a = ((a ^ byte) * 0x01000193) & 0xffffffff
    b = (((b ^ byte) * 0x01000193) & 0xffffffff) ^ (a >> 7)
revision = f'{a:08x}{b:08x}'
record = json.loads(base64.b64decode(sidecar['encoded'], validate=True))
expected = dict(format='barocss-source', version=1, revision=revision, digest=digest, files=[mesh['name']])
assert record == expected, (h, volume, record, expected)
print(json.dumps(dict(status='PASS', height=h, volume=volume, triangles=count, revision=revision, digest=digest)))
`;

const f = await createFlow({
  name: 'stl-variant-source', envFrozen: 'D679_SOURCE_FROZEN', output, oracleSource,
  qualification: 'D679 Studio STL source identity with unsaved variant values',
  initialFiles: [
    'apps/cad-studio/test/stl-variant-source-browser.mjs',
    'packages/barocss-cad-model/src/team/source.ts', 'packages/barocss-cad-model/src/util/revision.ts',
    'packages/barocss-cad-model/src/engine/stl.ts',
  ],
  limits: ['One parametric box in desktop Studio. Capture generated STL and source record at the download boundary.'],
});

function captureExportBlobs() {
  const create = URL.createObjectURL;
  const click = HTMLAnchorElement.prototype.click;
  const blobs = new Map();
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    if (blob.type === 'model/stl' || blob.type === 'application/json') blobs.set(url, blob);
    return url;
  };
  window.__d679Blobs = [];
  HTMLAnchorElement.prototype.click = function () {
    const blob = blobs.get(this.href);
    if (blob && /^stl-source-variant(?:-b1\.stl|\.source\.json)$/.test(this.download)) {
      const name = this.download;
      window.__d679Blobs.push(blob.arrayBuffer().then(bytes => ({
        name, type: blob.type, encoded: btoa(String.fromCharCode(...new Uint8Array(bytes))),
      })));
      blobs.delete(this.href);
      return;
    }
    return click.call(this);
  };
}

const button = name => f.page.getByRole('button', { name, exact: true });
const variants = () => f.page.getByRole('complementary', { name: 'Variants panel', exact: true });

async function qualify(label, index, height, quality) {
  f.phase = label;
  const volume = 30 * 12 * height;
  await f.page.waitForFunction(expected => {
    const state = window.__studioBodies?.();
    return state?.fresh && state.massReady && state.bodies.length === 1 && Math.abs(state.bodies[0].volume - expected) < 1e-8;
  }, volume);
  assert.deepEqual(await f.doc(), master);
  await button('Export STL').click();
  const dialog = f.page.getByRole('dialog', { name: 'STL export', exact: true });
  await dialog.getByLabel('STL export quality', { exact: true }).selectOption(quality);
  await dialog.getByRole('button', { name: 'Export', exact: true }).click();
  await f.page.waitForFunction(count => window.__d679Blobs.length >= count, index * 2 + 2);
  await dialog.waitFor({ state: 'detached' });
  const captures = await f.page.evaluate(() => Promise.all(window.__d679Blobs));
  assert.equal(captures.length, index * 2 + 2);
  const blobs = captures.slice(index * 2);
  await f.snapshot(label);
  const result = await f.runOracle({ height, blobs }, label);
  f.report.observations.push({
    label, quality, result, artifacts: blobs.map(blob => ({ name: blob.name, sha256: sha256(Buffer.from(blob.encoded, 'base64')) })),
  });
  assert.deepEqual(await f.doc(), master);
  return result;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(captureExportBlobs);
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
  f.phase = 'Open parameterized plate';
  const seed = Buffer.from(JSON.stringify(master));
  f.report.seedSHA256 = sha256(seed);
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: seed });
  await f.same(master);
  const original = await qualify('01-master', 0, 6, 'automatic');

  await button('Variants').click();
  await variants().getByLabel('Value of height', { exact: true }).fill('9');
  await variants().getByLabel('Variant shown', { exact: true }).getByText('Master, edited', { exact: true }).waitFor();
  const shown = await qualify('02-unsaved-variant', 1, 9, '32');
  assert.notEqual(shown.revision, original.revision);
  assert.notEqual(shown.digest, original.digest);

  await variants().getByRole('button', { name: 'Show the master', exact: true }).click();
  const restored = await qualify('03-restored', 2, 6, 'automatic');
  assert.deepEqual(restored, original);
  assert.deepEqual(f.report.downloads, []);
  f.phase = 'complete';
});
