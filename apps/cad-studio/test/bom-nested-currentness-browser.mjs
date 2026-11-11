// D707 / #2356. Run under the heavy gate with D707_SOURCE_FROZEN=1.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const blank = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const instance = (id, name, x, doc) => ({ id, name, doc, position: [x, 0, 0], rotation: [0, 0, 0] });
const shaft = (diameter, length, bought, parameters = {}) => ({
  ...blank, parameters,
  nodes: [{ kind: 'shaft', steps: [{ diameter, length }], center: [0, 0], generator: 'shaft@0', id: 'n0', ...(bought ? { bought: true } : {}) }],
  outputs: { b0: { node: 0, side: 'solid' } }, nextId: 1,
});
const invalidLeaf = {
  ...blank, parameters: { D707Failure: 1 },
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 0, id: 'n1' }],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const assembly = (label, target, extra = []) => ({ ...blank, instances: [
  instance('sub', label + ' module', 0, { ...blank, instances: [
    instance('shaft', label + ' target', 0, target),
    instance('spare', label + ' spare', 30, shaft(8, 14, true)),
    ...extra,
  ] }),
] });
const a = assembly('A', shaft(10, 20, true));
const b = assembly('B', shaft(11, 22, false), [instance('fault', 'B invalid part', 55, invalidLeaf)]);
const c = assembly('C', shaft(12, 25, false, { D707Current: 1 }));
const bought = structuredClone(c);
bought.instances[0].doc.instances[0].doc.nodes[0].bought = true;
const output = process.argv[2];
const pins = [
  'apps/cad-studio/test/bom-nested-currentness-browser.mjs', 'apps/cad-studio/test/model-rail-helper.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/BomPanel.tsx', 'apps/cad-studio/src/ui/files.ts',
  'apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
  ...['bom/bom', 'bom/core', 'assembly/instances', 'engine/evaluate', 'engine/container'].map(path => 'packages/barocss-cad-model/src/' + path + '.ts'),
];
const f = await createFlow({
  name: 'bom-nested-currentness', envFrozen: 'D707_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins,
  qualification: 'D707 #2356 same nested occurrence and feature identity',
  limits: ['Ordinary nested shafts, one natural zero-height failure, and two held real Worker replies. The driver saves the exact generated local CSV bytes.'],
  oracleSource: String.raw`
import csv, hashlib, json, sys
from pathlib import Path
d = json.load(sys.stdin)
actual = Path(d['csv']).read_bytes()
assert hashlib.sha256(actual).hexdigest() == d['sha256']
doc = json.loads(Path(d['model']).read_bytes())
sub, = doc['instances']
assert sub['id'] == 'sub'
parts = sub['doc']['instances']
assert [p['id'] for p in parts] == ['shaft', 'spare']
assert all(len(p['doc']['nodes']) == 1 and p['doc']['nodes'][0]['id'] == 'n0' for p in parts)
def item(p):
    s, = p['doc']['nodes'][0]['steps']
    return f"shaft 1 steps Ø{s['diameter']}–Ø{s['diameter']} × {s['length']}"
expected = [(item(p), '1', 'shaft') for p in parts if p['doc']['nodes'][0].get('bought')]
if d['withMade']:
    expected += [(p['name'], '1', 'part') for p in [sub, *parts]]
reader = csv.DictReader(actual.decode('utf-8').splitlines())
assert reader.fieldnames == ['item no.', 'item', 'qty', 'kind', 'size', 'row', 'catalogue', 'source', 'estimate']
rows = list(reader)
assert [(r['item'], r['qty'], r['kind']) for r in rows] == expected, (rows, expected)
assert all(not r['row'] and not r['catalogue'] for r in rows)
assert d['name'] == d['modelName'] + ' purchase list.csv'
print(json.dumps({'status': 'PASS', 'items': expected, 'withMade': d['withMade']}))
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`)?.disabled),
    panel: document.querySelector('[aria-label="BOM panel"]')?.textContent,
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'BOM panel', exact: true });
const exportButton = () => panel().getByRole('button', { name: 'Export purchase list', exact: true });
const shaftChoice = size => panel().getByLabel(new RegExp('^Bought or made: shaft .*' + size + '$'));
const choices = () => panel().getByLabel(/^Bought or made:/);
const bomToast = () => f.page.locator('.toast-title').getByText('Could not work out the BOM', { exact: true });

function observeBoundaries() {
  const worker = Worker.prototype, onMessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!onMessage?.set) throw new Error('Worker onmessage setter required');
  const post = worker.postMessage;
  let armed, target, held, deliver;
  worker.postMessage = function (request, ...args) {
    if (armed && request?.type === 'part' && request.slot === 'read' && request.doc?.doc?.parameters?.[armed] === 1) {
      target = { worker: this, id: request.id, revision: request.revision, marker: armed };
      armed = null;
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onMessage.get,
    set(callback) {
      onMessage.set.call(this, callback && function (event) {
        const result = event.data?.result;
        if (target?.worker === this && event.data?.id === target.id && result) {
          held = { id: target.id, revision: target.revision, marker: target.marker, resultRevision: result.revision, ok: result.ok, error: result.error };
          deliver = () => callback.call(this, event);
          target = null;
          return;
        }
        callback.call(this, event);
      });
    },
  });
  const urls = new Map(), create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
  const csv = [];
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    if (blob.type === 'text/csv') urls.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = urls.get(this.href);
    if (!blob || !this.download.endsWith(' purchase list.csv')) return click.call(this);
    const name = this.download;
    csv.push(blob.arrayBuffer().then(bytes => ({ name, bytes: [...new Uint8Array(bytes)] })));
    urls.delete(this.href);
  };
  window.__d707 = {
    csv, arm(marker) { if (armed || target || deliver) throw new Error('Already holding a reply'); armed = marker; held = null; },
    read: () => held,
    release() { if (!deliver) throw new Error('No reply held'); const forward = deliver; deliver = null; forward(); },
  };
}

async function open(modelName, doc, waitForBodies = true) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: modelName + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  if (waitForBodies) await f.same(doc);
  else await f.page.waitForFunction(expected => JSON.stringify(window.__studioDoc) === expected, JSON.stringify(doc));
}

async function exportCsv(label, modelName, doc, withMade) {
  await panel().getByLabel('Purchase list with made parts', { exact: true }).setChecked(withMade);
  const before = await f.page.evaluate(() => window.__d707.csv.length);
  await exportButton().click();
  const captured = await f.page.evaluate(() => Promise.all(window.__d707.csv));
  assert.equal(captured.length, before + 1);
  const { name, bytes } = captured.at(-1);
  const raw = Buffer.from(bytes), csv = join(output, label + '.csv'), model = join(output, label + '.bcad');
  await writeFile(csv, raw, { flag: 'wx' });
  await writeFile(model, JSON.stringify(doc), { flag: 'wx' });
  const hash = sha256(raw);
  await f.runOracle({ name, modelName, model, csv, withMade, sha256: hash }, label);
  f.report.files.push({ label, name, bytes: raw.length, sha256: hash });
  return raw;
}

async function expectBlocked(label, before) {
  assert.equal(await panel().getByRole('table').count(), 0);
  assert.equal(await choices().count(), 0);
  assert.equal(await exportButton().isDisabled(), true);
  await exportButton().evaluate(element => element.click());
  assert.equal(await f.page.evaluate(() => window.__d707.csv.length), 1, 'blocked export must not generate a CSV');
  const state = await f.snapshot(label);
  for (const field of ['doc', 'history', 'controls', 'dirty', 'selection']) assert.deepEqual(state[field], before[field], field);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.addInitScript(observeBoundaries);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  f.phase = 'Open A and export its two bought nested shafts';
  await open('D707-A', a);
  await clickModelCommand(f.page, 'Inspect', 'BOM');
  await shaftChoice('Ø10–Ø10 × 20').waitFor();
  const originalPanel = await panel().elementHandle();
  const samePanel = () => f.page.evaluate(element => document.querySelector('[aria-label="BOM panel"]') === element, originalPanel);
  await exportCsv('A-current', 'D707-A', a, false);
  await f.snapshot('A-current');

  f.phase = 'Open B with the same nested IDs and hold its genuine failed evaluation';
  await f.page.evaluate(() => window.__d707.arm('D707Failure'));
  await open('D707-B', b, false);
  assert.equal(await samePanel(), true);
  await f.page.waitForFunction(() => window.__d707.read());
  const failed = await f.page.evaluate(() => window.__d707.read());
  assert.equal(failed.ok, false);
  assert.equal(failed.revision, failed.resultRevision);
  assert.match(failed.error.detail, /height must not be zero/i);
  const before = await f.snapshot('B-pending');
  assert.match(await panel().getByRole('status').innerText(), /Working out the BOM/);
  await expectBlocked('B-pending-blocked', before);
  await f.page.evaluate(() => window.__d707.release());
  const error = panel().getByRole('alert');
  await error.waitFor();
  assert.match(await error.innerText(), /base\/sub\/fault/);
  assert.match(await error.innerText(), /height must not be zero/i);
  await bomToast().waitFor();
  await expectBlocked('B-failed-blocked', before);

  f.phase = 'Open C with the same nested IDs and hold its current evaluation';
  await f.page.evaluate(() => window.__d707.arm('D707Current'));
  await open('D707-C', c);
  assert.equal(await samePanel(), true);
  await f.page.waitForFunction(() => window.__d707.read());
  const current = await f.page.evaluate(() => window.__d707.read());
  assert.equal(current.ok, true);
  assert.equal(current.revision, current.resultRevision);
  await expectBlocked('C-pending-blocked', await f.snapshot('C-pending'));
  assert.equal(await bomToast().count(), 0, 'C must not show the old B failure');
  await f.page.evaluate(() => window.__d707.release());
  const target = shaftChoice('Ø12–Ø12 × 25');
  await target.waitFor();
  assert.equal(await target.inputValue(), 'default');
  assert.equal(await shaftChoice('Ø8–Ø8 × 14').inputValue(), 'bought');
  assert.equal(await error.count(), 0);
  const prior = await exportCsv('C-current-before-edit', 'D707-C', c, false);

  f.phase = 'Mark the current nested shaft bought and verify Undo and Redo';
  await target.selectOption('bought');
  await f.same(bought);
  await target.waitFor();
  assert.equal(await target.inputValue(), 'bought');
  const accepted = await exportCsv('C-current-bought', 'D707-C', bought, false);
  await exportCsv('C-current-with-made', 'D707-C', bought, true);
  await f.snapshot('C-bought');
  await button('Undo').click();
  await f.same(c);
  await target.waitFor();
  assert.deepEqual(await exportCsv('C-after-undo', 'D707-C', c, false), prior);
  await button('Redo').click();
  await f.same(bought);
  await target.waitFor();
  assert.deepEqual(await exportCsv('C-after-redo', 'D707-C', bought, false), accepted);
  assert.equal(await samePanel(), true);
  assert.equal(await bomToast().count(), 0);
  await f.snapshot('C-redone');
  f.report.observations.push({ samePanel: true, failedWorker: failed, currentWorker: current, expectedTarget: 'sub/shaft:n0', retainedSibling: 'sub/spare:n0' });
  assert.deepEqual(f.report.downloads, []);
});
