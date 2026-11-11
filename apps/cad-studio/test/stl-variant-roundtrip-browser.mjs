import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, evidence] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
for (const path of [output, evidence]) {
  assert.ok(path && isAbsolute(path) && relative(repo, path).startsWith('../'), 'Use external evidence directories');
}
const receiptFile = join(evidence, 'receipt.json');
const inputFile = join(evidence, '02-unsaved-variant-oracle-input.json');
const receiptBytes = await readFile(receiptFile);
assert.equal(sha256(receiptBytes), '061d079afcdd89e6905ec721fc433ef1f8a694020eb0d1773b0339943c81a28a');
const prior = JSON.parse(receiptBytes);
assert.equal(prior.status, 'PASS');
const inputBytes = await readFile(inputFile);
const observation = prior.oracles.find(row => row.label === '02-unsaved-variant');
assert.equal(sha256(inputBytes), observation.inputSHA256);
const { height, blobs: [stl, record] } = JSON.parse(inputBytes);
const bytes = Buffer.from(stl.encoded, 'base64');
assert.equal(height, 9);
assert.equal(stl.name, 'stl-source-variant-b1.stl');
assert.equal(sha256(bytes), '34bc8e0a7055567b8e793475a08ba62055494c9bc4458919b0056ea58b49fad1');
assert.equal(sha256(Buffer.from(record.encoded, 'base64')), '06899a6e6ac116715ebff3586e8cf2abffd11ec603f8f8cf9a7b2ceae6116fcd');
const master = prior.states[0].doc;
assert.equal(sha256(JSON.stringify(master)), prior.seedSHA256);

const oracleSource = String.raw`
import base64
import hashlib
from itertools import product
import json
import math
import struct
import sys

d = json.load(sys.stdin)
data = base64.b64decode(d['stl'], validate=True)
triangle_count, = struct.unpack_from('<I', data, 80)
assert triangle_count == 12 and len(data) == 84 + 50 * triangle_count
scale = {'mm': 1, 'cm': 10}[d['unit']]
corners = {}
indices = []
for i in range(triangle_count):
    values = struct.unpack_from('<9f', data, 96 + i * 50)
    for start in (0, 3, 6):
        corner = tuple(x * scale for x in values[start:start + 3])
        indices.append(corners.setdefault(corner, len(corners)))
dimensions = [30 * scale, 12 * scale, 9 * scale]
assert set(corners) == set(product(*[(0, length) for length in dimensions]))
coordinates = [axis for corner in corners for axis in corner]
positions_hash = hashlib.sha256(struct.pack('<' + 'f' * len(coordinates), *coordinates)).hexdigest()
indices_hash = hashlib.sha256(struct.pack('<' + 'I' * len(indices), *indices)).hexdigest()
assert d['blob'] == {'positions': positions_hash, 'indices': indices_hash}, d['blob']
volume = math.prod(dimensions)
assert math.isclose(d['volume'], volume, rel_tol=1e-12)
assert all(math.isclose(v, size / 2, abs_tol=1e-9, rel_tol=0) for v, size in zip(d['centroid'], dimensions))
print(json.dumps(dict(status='PASS', unit=d['unit'], dimensions=dimensions, volume=volume, triangles=triangle_count)))
`;

const f = await createFlow({
  name: 'stl-variant-roundtrip', envFrozen: 'D680_SOURCE_FROZEN', output, oracleSource,
  qualification: 'D680 Studio Open of exact D679 STL, with unit selection and cancellation',
  initialFiles: [
    'apps/cad-studio/test/stl-variant-roundtrip-browser.mjs', receiptFile, inputFile,
    'packages/barocss-cad-model/src/engine/meshImport.ts', 'packages/barocss-cad-model/src/engine/blobs.ts',
  ],
  limits: ['The retained 12-triangle box STL from D679. One cancellation and two accepted unit interpretations.'],
});

const button = name => f.page.getByRole('button', { name, exact: true });
const units = () => f.page.getByRole('dialog', { name: 'Mesh units', exact: true });
const unitSelect = () => units().getByLabel('Mesh unit', { exact: true });
const variants = () => f.page.getByRole('complementary', { name: 'Variants panel', exact: true });
const importedName = stl.name.replace(/\.stl$/, '');

async function open(name, mimeType, buffer) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType, buffer });
}

async function openQuestion() {
  await open(stl.name, 'model/stl', bytes);
  await units().waitFor();
  assert.match(await units().innerText(), /STL files carry no unit/);
}

async function retained() {
  return {
    doc: await f.doc(), body: await f.bodies(),
    ui: await f.page.evaluate(() => ({
      title: document.querySelector('.doc-tab input')?.value,
      selection: window.__studioSelection?.selection,
      dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
      undo: document.querySelector('button[aria-label="Undo"]')?.disabled,
      redo: document.querySelector('button[aria-label="Redo"]')?.disabled,
    })),
    draftHeight: await variants().getByLabel('Value of height', { exact: true }).inputValue(),
  };
}

async function confirm(unit, scale, unitName) {
  const dimensions = [30, 12, 9].map(v => v * scale);
  const label = `03-open-${unit}`;
  f.phase = label;
  await openQuestion();
  await unitSelect().selectOption(unit);
  assert.match(await units().innerText(), new RegExp(`In ${unit} it is ${dimensions.join(' × ')} mm`));
  await units().getByRole('button', { name: 'Open', exact: true }).click();
  await units().waitFor({ state: 'detached' });
  await f.page.waitForFunction(unit => window.__studioDoc?.nodes?.length === 1 && window.__studioDoc.nodes[0].unit === unit, unit);
  await f.ready();
  const volume = 3240 * scale ** 3;
  const toast = await f.waitToast(/STL opened/);
  assert.ok(toast.includes(`12 triangles read in ${unitName}; ${volume.toLocaleString('en-US')} mm³`), toast);
  assert.doesNotMatch(toast, /STL opened, repaired/);
  assert.equal(await f.page.getByRole('dialog', { name: 'Mesh repair', exact: true }).count(), 0);
  assert.equal(await f.page.locator('.doc-tab input').inputValue(), importedName);
  const state = await f.snapshot(label, () => ({ boundsText: document.querySelector('.part-summary')?.textContent }));
  assert.ok(state.boundsText?.includes(`Bounds ${dimensions.join(' × ')}`), state.boundsText);
  const [node] = state.doc.nodes;
  assert.equal(node.name, importedName);
  assert.equal(node.kind, 'mesh');
  assert.equal(node.unit, unit);
  assert.equal(node.representation, 'facets');
  assert.equal(node.repair, undefined);
  assert.equal(state.doc.variability, undefined);
  assert.equal(state.doc.bodies, undefined);
  assert.deepEqual(state.doc.parameters, {});
  assert.equal(state.bodies.bodies.length, 1);
  assert.deepEqual(state.bodies.colored, []);
  const [body] = state.bodies.bodies;
  const result = await f.runOracle({ stl: stl.encoded, unit, blob: node.blob, volume: body.volume, centroid: body.centroid }, label);
  f.report.observations.push({ label, result, toast, retainedMetadata: { name: node.name, unit } });
  await f.dismissToasts();
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
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
  f.phase = 'Open D679 Master and edit the preview';
  await open('stl-source-variant.bcad', 'application/json', Buffer.from(JSON.stringify(master)));
  await f.same(master);
  await button('Variants').click();
  await variants().getByLabel('Value of height', { exact: true }).fill('8');
  await variants().getByLabel('Variant shown', { exact: true }).getByText('Master, edited', { exact: true }).waitFor();
  await f.page.waitForFunction(() => {
    const state = window.__studioBodies?.();
    return state?.fresh && state.massReady && Math.abs(state.bodies[0]?.volume - 2880) < 1e-8;
  });
  const before = await retained();
  assert.equal(before.draftHeight, '8');

  f.phase = 'preview and cancel unit selection';
  await openQuestion();
  assert.equal(await unitSelect().inputValue(), 'mm');
  assert.match(await units().innerText(), /In mm it is 30 × 12 × 9 mm/);
  await unitSelect().selectOption('cm');
  assert.match(await units().innerText(), /In cm it is 300 × 120 × 90 mm/);
  await f.snapshot('01-centimetre-preview');
  await units().getByRole('button', { name: 'Cancel', exact: true }).click();
  await units().waitFor({ state: 'detached' });
  await f.same(master);
  assert.deepEqual(await retained(), before);
  await f.snapshot('02-cancel-retains-draft');

  await confirm('mm', 1, 'millimetres');
  await confirm('cm', 10, 'centimetres');
  assert.deepEqual(f.report.downloads, []);
  f.phase = 'complete';
});
