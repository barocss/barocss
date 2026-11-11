import assert from 'node:assert/strict';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an external evidence directory');
const fixture = join(import.meta.dirname, 'fixtures/instance-pattern.bcad');

const oracleSource = String.raw`
from itertools import product
import json
import math
import re
import struct
import sys

d = json.load(sys.stdin)
mesh, sidecar = d['blobs']
assert (mesh['name'], mesh['type']) == ('instance-pattern-b1.stl', 'model/stl')
assert (sidecar['name'], sidecar['type']) == ('instance-pattern.source.json', 'application/json')
raw = bytes(mesh['bytes'])
count, = struct.unpack_from('<I', raw, 80)
assert count == 12 and len(raw) == 84 + 50 * count
corners = set()
terms = []
for i in range(count):
    row = struct.unpack_from('<12fH', raw, 84 + 50 * i)
    assert row[-1] == 0
    a, b, c = row[3:6], row[6:9], row[9:12]
    corners.update((a, b, c))
    terms.append(sum(a[k] * (b[(k+1)%3] * c[(k+2)%3] - b[(k+2)%3] * c[(k+1)%3]) for k in range(3)))
assert corners == set(product((-20, 140), (-20, 40), (-4, 0))), corners
volume = abs(math.fsum(terms) / 6)
assert volume == 38400, volume
record = json.loads(bytes(sidecar['bytes']))
assert set(record) == {'format', 'version', 'revision', 'digest', 'files'}
assert record['format'] == 'barocss-source' and record['version'] == 1
assert record['files'] == [mesh['name']]
assert re.fullmatch('[0-9a-f]{16}', record['revision']) and re.fullmatch('[0-9a-f]{64}', record['digest'])
print(json.dumps(dict(status='PASS', triangles=count, volume=volume, bounds=[[-20,-20,-4],[140,40,0]], revision=record['revision'])))
`;

const f = await createFlow({
  name: 'stl-assembly-loss', envFrozen: 'D689_SOURCE_FROZEN', output, oracleSource,
  qualification: 'D689 desktop STL disclosure of omitted placed parts and unitless mesh data',
  initialFiles: ['apps/cad-studio/test/fixtures/instance-pattern.bcad'],
  requiredFrozen: ['apps/cad-studio/src/files/useModelExports.ts', 'apps/cad-studio/src/files/ModelExportDialogs.tsx'],
  extraFrozen: ['packages/barocss-cad/src/io/stl.ts', 'packages/barocss-cad-model/src/team/source.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits: ['One rectangular base plate and one placed cube. Capture the original export Blobs locally. No third-party slicer.'],
});

function captureStl() {
  const create = URL.createObjectURL;
  const click = HTMLAnchorElement.prototype.click;
  const blobs = new Map();
  window.__d689Blobs = [];
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    if (blob.type === 'model/stl' || blob.type === 'application/json') blobs.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = blobs.get(this.href);
    if (!blob || !/^instance-pattern(?:-.*\.stl|\.source\.json)$/.test(this.download)) return click.call(this);
    blobs.delete(this.href);
    const name = this.download;
    window.__d689Blobs.push(blob.arrayBuffer().then(bytes => ({
      name, type: blob.type, bytes: Array.from(new Uint8Array(bytes)),
    })));
  };
}

const button = name => f.page.getByRole('button', { name, exact: true });
const dialog = () => f.page.getByRole('dialog', { name: 'STL export', exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Instance', exact: true });
const placedLoss = /Visible placed parts are omitted/;
const meshLoss = /Coordinates use millimetres\. STL leaves out the unit setting, colours, body names and editable CAD data\./;

async function prepare(quality) {
  await button('Export STL').click();
  await dialog().getByLabel('STL export quality').selectOption(quality);
  return dialog().innerText();
}

async function exportPlate(label, index) {
  const accepted = await f.doc();
  await dialog().getByRole('button', { name: 'Export', exact: true }).click();
  await dialog().waitFor({ state: 'detached' });
  const notice = await f.waitToast(/STL written: 1 file/);
  const blobs = await f.page.evaluate(() => Promise.all(window.__d689Blobs));
  assert.equal(blobs.length, index + 2);
  const files = blobs.slice(index);
  const result = await f.runOracle({ blobs: files }, label);
  f.report.observations.push({ label, notice, result, files: files.map(file => ({ name: file.name, sha256: sha256(Buffer.from(file.bytes)) })) });
  await f.snapshot(label);
  assert.deepEqual(await f.doc(), accepted);
  return { notice, mesh: files[0] };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(captureStl);
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
  f.phase = 'Open assembly with the Cube displayed';
  await f.openFile(fixture, 2);
  await f.page.locator('.ol.instance').filter({ hasText: 'Cube' }).click();
  await panel().waitFor();
  await f.page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Instance"] .kv')]
    .some(row => row.firstChild?.textContent?.trim() === 'Bodies' && row.querySelector('b')?.textContent?.trim() === '1'));
  const assembly = await f.doc();
  assert.equal(assembly.instances[0].name, 'Cube');
  assert.equal(assembly.instances[0].hidden, undefined);

  f.phase = 'Check Automatic STL against the shown assembly';
  const before = await prepare('automatic');
  f.report.observations.push({ label: '01-automatic-dialog', text: before });
  await f.snapshot('01-automatic-dialog');
  const automatic = await exportPlate('02-automatic-result', 0);
  assert.deepEqual([placedLoss.test(before), placedLoss.test(automatic.notice)], [true, true], 'The root-only STL must disclose the omission both before and after writing');
  assert.match(before, meshLoss);
  assert.match(automatic.notice, meshLoss);
  await f.dismissToasts();

  f.phase = 'Fine STL refuses the visible placed part';
  assert.match(await prepare('32'), /Draft, Standard and Fine require no visible placed parts/);
  await dialog().getByRole('button', { name: 'Export', exact: true }).click();
  await f.waitToast(/Could not write STL.*quality cannot export a document with visible placed instances/);
  assert.equal(await f.page.evaluate(() => window.__d689Blobs.length), 2);
  assert.deepEqual(await f.doc(), assembly);
  await f.snapshot('03-fine-refusal');
  await f.dismissToasts();

  f.phase = 'Hide Cube and export Fine STL';
  await panel().getByRole('button', { name: 'Hide', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc.instances[0].hidden === true);
  await f.ready();
  const hidden = await prepare('32');
  assert.doesNotMatch(hidden, placedLoss);
  assert.match(hidden, meshLoss);
  const fine = await exportPlate('04-fine-hidden-control', 2);
  assert.doesNotMatch(fine.notice, placedLoss);
  assert.match(fine.notice, meshLoss);
  assert.deepEqual(fine.mesh, automatic.mesh);
  assert.deepEqual(f.report.downloads, []);
  f.phase = 'complete';
});
