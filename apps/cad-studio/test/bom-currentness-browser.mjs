// D575 / #2356. Run under the heavy gate from apps/cad-studio.
// D575_SOURCE_FROZEN=1 node test/bom-currentness-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(output && isAbsolute(output) && relative(resolve(import.meta.dirname, '../../..'), output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=fixed', '--expect=project'].includes(mode));
const repro = mode === '--expect=repro', projectMode = mode === '--expect=project';
function shaft(marker, diameter, length, bought) {
  return {
    format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { [marker]: 1 },
    nodes: [{ kind: 'shaft', steps: [{ diameter, length }], center: [0, 0], generator: 'shaft@0', id: 'n0', ...(bought ? { bought: true } : {}) }],
    outputs: { b0: { node: 0, side: 'solid' } }, nextId: 1,
  };
}
const a = shaft('ProofA', 10, 20, true);
const b = shaft('ProofB', 12, 25, false);
const bytes = doc => Buffer.from(JSON.stringify(doc));
const payload = (name, doc) => ({ name: name + '.bcad', mimeType: 'application/json', buffer: bytes(doc) });
const oracleSource = String.raw`
import csv, hashlib, io, json, sys
from pathlib import Path
d = json.load(sys.stdin)
if 'file' in d:
    actual = Path(d['file']).read_bytes()
    assert hashlib.sha256(actual).hexdigest() == d['sha256']
    native = json.loads(Path(d['nativeFile']).read_bytes())
    node, = native['nodes']
    step, = node['steps']
    assert node['id'] == 'n0' and node['kind'] == 'shaft' and node['bought'] is True
    diameter, length = step['diameter'], step['length']
    assert d['size'] == f'1 steps Ø{diameter}–Ø{diameter} × {length}'
    text = actual.decode('utf-8')
else:
    text = d['text']
rows = list(csv.DictReader(io.StringIO(text)))
assert rows and list(rows[0]) == ['item no.', 'item', 'qty', 'kind', 'size', 'row', 'catalogue', 'source', 'estimate'], rows
shaft = [r for r in rows if r['kind'] == 'shaft']
assert len(shaft) == 1 and shaft[0]['qty'] == '1', rows
assert shaft[0]['size'] == d['size'] and shaft[0]['item'] == 'shaft ' + d['size'], rows
parts = [r['item'] for r in rows if r['kind'] == 'part']
assert parts == d['parts'], rows
assert d['name'] == d['fileName'] + ' purchase list.csv', d
if 'file' in d:
    assert [r['kind'] for r in rows] == ['shaft'] + ['part'] * len(parts)
    assert all(r['qty'] == '1' and not r['row'] and not r['catalogue'] for r in rows)
print(json.dumps({'status': 'PASS', 'size': d['size'], 'parts': parts, 'rowCount': len(rows)}))
`;
const pins = [
  'apps/cad-studio/test/bom-currentness-browser.mjs', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/BomPanel.tsx',
  'apps/cad-studio/src/ui/files.ts', 'apps/cad-studio/src/engine/client.ts',
  'packages/barocss-cad-model/src/bom/bom.ts', 'packages/barocss-cad-model/src/assembly/instances.ts',
  ...(projectMode ? ['apps/cad-studio/src/storage/project.ts', 'apps/cad-studio/src/storage/useProject.ts',
    'apps/cad-studio/src/storage/VersionsPanel.tsx', 'packages/barocss-cad-model/src/engine/container.ts'] : []),
];
const f = await createFlow({
  name: 'bom-currentness', envFrozen: projectMode ? 'D706_SOURCE_FROZEN' : 'D575_SOURCE_FROZEN', output,
  qualification: projectMode ? 'D706 #2356 project reopen and CSV file readback' : 'D575 #2356 desktop',
  initialFiles: [...pins, 'apps/cad-studio/test/model-rail-helper.mjs'], requiredFrozen: pins, oracleSource,
  limits: ['Ordinary root shafts with the same feature ID. Real Worker reply delayed. CSV Blob and anchor captured before browser download.'],
  snapshotExtra: () => ({
    historyControls: ['Undo', 'Redo'].map(name => {
      const button = document.querySelector(`button[aria-label="${name}"]`);
      return { disabled: button.disabled, tip: button.getAttribute('data-tip') };
    }),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'BOM panel', exact: true });
const csvButton = () => panel().getByRole('button', { name: 'Export purchase list', exact: true });
const select = () => panel().getByLabel(/^Bought or made: shaft /);
const captures = () => f.page.evaluate(() => Promise.all(window.__d575Captures));

function installBoundaryObservers() {
  const worker = Worker.prototype;
  const onMessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!onMessage?.set) throw new Error('Worker onmessage setter required');
  const post = worker.postMessage;
  let armed = false, target, held, deliver;
  worker.postMessage = function (request, ...args) {
    if (armed && request?.type === 'part' && request.slot === 'read' && request.doc?.doc?.parameters?.ProofB === 1) {
      armed = false;
      target = { worker: this, id: request.id, revision: request.revision };
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onMessage.get,
    set(callback) {
      onMessage.set.call(this, callback && function (event) {
        if (!held && target?.worker === this && event.data?.id === target.id && event.data.result) {
          held = { id: target.id, revision: target.revision, ok: event.data.result.ok, resultRevision: event.data.result.revision };
          deliver = () => callback.call(this, event);
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__d575Hold = {
    arm() { if (armed || target) throw new Error('One BOM reply may be held'); armed = true; },
    read: () => held,
    release() { if (!deliver) throw new Error('A real BOM reply must be held'); deliver(); deliver = null; },
  };

  const urls = new Map();
  const createUrl = URL.createObjectURL;
  URL.createObjectURL = function (blob) {
    const url = createUrl.call(this, blob);
    if (blob.type === 'text/csv') urls.set(url, blob);
    return url;
  };
  const click = HTMLAnchorElement.prototype.click;
  window.__d575Captures = [];
  HTMLAnchorElement.prototype.click = function () {
    const blob = urls.get(this.href);
    if (blob && this.download.endsWith(' purchase list.csv')) {
      const name = this.download;
      window.__d575Captures.push(blob.arrayBuffer().then(buffer => {
        const bytes = [...new Uint8Array(buffer)];
        return { name, bytes, text: new TextDecoder().decode(buffer) };
      }));
      urls.delete(this.href);
      return;
    }
    return click.call(this);
  };
}

async function open(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(payload(name, doc));
  await f.same(doc);
}
async function csv(label, fileName, size, parts) {
  const before = (await captures()).length;
  await csvButton().click();
  const exports = await captures();
  assert.equal(exports.length, before + 1);
  const output = exports.at(-1);
  await f.runOracle({ ...output, fileName, size, parts }, label);
  return { label, sha256: sha256(output.text), file: output.name };
}
async function currentRow(size) {
  const row = select();
  await row.waitFor();
  assert.match(await row.getAttribute('aria-label'), new RegExp(size));
  assert.equal(await row.isEnabled(), true);
  assert.equal(await csvButton().isEnabled(), true);
  return row;
}

async function verifyProjectRoundTrip() {
  const project = 'D706 BOM project', aName = 'D706-A', bName = 'D706-B';
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const projectOpen = async () => {
    if (!(await versions.isVisible())) await button('Project and versions').click();
    await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await versions.getByLabel('Project', { exact: true }).waitFor();
  };
  const stored = async name => Buffer.from(await f.page.evaluate(async ({ project, name }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return [...new Uint8Array(await (await (await dir.getFileHandle(name + '.bcad')).getFile()).arrayBuffer())];
  }, { project, name }));
  const save = async (name, doc) => {
    await button('Save').click();
    await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(name + '.bcad', { exact: true }).waitFor();
    await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'detached' });
    const saved = await stored(name);
    assert.deepEqual(JSON.parse(saved.toString()), doc);
    return saved;
  };
  const openStored = async (name, doc) => {
    await versions.getByRole('button', { name: 'Open ' + name + '.bcad', exact: true }).click();
    await f.same(doc);
  };

  f.phase = 'Save two native documents with the same shaft feature ID';
  await open(aName, a);
  await projectOpen();
  const savedA = await save(aName, a);
  await open(bName, b);
  await clickModelCommand(f.page, 'Inspect', 'BOM');
  await currentRow('Ø12–Ø12 × 25');
  await select().selectOption('bought');
  const bought = { ...b, nodes: [{ ...b.nodes[0], bought: true }] };
  await f.same(bought);
  await currentRow('Ø12–Ø12 × 25');
  await panel().getByRole('button', { name: 'Close BOM', exact: true }).click();
  const savedB = await save(bName, bought);
  await clickModelCommand(f.page, 'Inspect', 'BOM');
  await currentRow('Ø12–Ø12 × 25');
  const nativeFile = join(output, bName + '.bcad');
  await writeFile(nativeFile, savedB, { flag: 'wx' });
  f.report.files.push({ file: bName + '.bcad', sha256: sha256(savedB), bytes: savedB.length });

  async function persistCsv(label, withMade) {
    const toggle = panel().getByLabel('Purchase list with made parts');
    await toggle.setChecked(withMade);
    const before = (await captures()).length;
    await csvButton().click();
    const exports = await captures();
    assert.equal(exports.length, before + 1);
    const captured = exports.at(-1), raw = Buffer.from(captured.bytes);
    const file = join(output, label + '.csv');
    await writeFile(file, raw, { flag: 'wx' });
    assert.deepEqual(await readFile(file), raw);
    await f.runOracle({ file, nativeFile, name: captured.name, fileName: bName, size: '1 steps Ø12–Ø12 × 25',
      parts: withMade ? [bName] : [], sha256: sha256(raw) }, label);
    f.report.files.push({ label, sha256: sha256(raw), bytes: raw.length, file: captured.name });
    return raw;
  }
  const beforeReload = await persistCsv('B-before-reload-bought', false);
  await f.snapshot('B-project-saved');

  f.phase = 'Close the project, reload Studio, and open A from the saved project';
  await panel().getByRole('button', { name: 'Close BOM', exact: true }).click();
  await versions.getByRole('button', { name: 'Close project', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor({ state: 'detached' });
  const context = f.context;
  await f.page.reload();
  assert.equal(f.page.context(), context);
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await projectOpen();
  await openStored(aName, a);
  await clickModelCommand(f.page, 'Inspect', 'BOM');
  await currentRow('Ø10–Ø10 × 20');
  await f.snapshot('A-project-current');

  f.phase = 'Reopen B and hold the real current BOM reply';
  // Versions and BOM share the dock. Project Open is available after closing BOM.
  await panel().getByRole('button', { name: 'Close BOM', exact: true }).click();
  await versions.waitFor();
  await openStored(bName, bought);
  await f.page.evaluate(() => window.__d575Hold.arm());
  await clickModelCommand(f.page, 'Inspect', 'BOM');
  await panel().waitFor();
  await f.page.waitForFunction(() => window.__d575Hold.read());
  const held = await f.page.evaluate(() => window.__d575Hold.read());
  assert.equal(held.ok, true);
  assert.equal(held.revision, held.resultRevision);
  const pending = await f.snapshot('B-project-pending');
  assert.equal(await select().count(), 0);
  assert.equal(await panel().getByLabel('BOM lines', { exact: true }).count(), 0);
  assert.match(await panel().getByRole('status').textContent(), /Working out the BOM/);
  assert.equal(await csvButton().isDisabled(), true);
  await csvButton().evaluate(element => element.click());
  assert.equal((await captures()).length, 0);
  const blocked = await f.snapshot('B-project-blocked');
  for (const field of ['doc', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(blocked[field], pending[field], field);
  assert.deepEqual(await stored(aName), savedA);
  assert.deepEqual(await stored(bName), savedB);

  f.phase = 'Read the current saved purchase list after project reopen';
  await f.page.evaluate(() => window.__d575Hold.release());
  await currentRow('Ø12–Ø12 × 25');
  assert.equal(await select().inputValue(), 'bought');
  const reopened = await persistCsv('B-reopened-bought', false);
  assert.deepEqual(reopened, beforeReload);
  await persistCsv('B-reopened-with-made', true);
  await f.snapshot('B-project-current');
  await select().selectOption('made');
  const made = { ...b, nodes: [{ ...b.nodes[0], bought: false }] };
  await f.same(made);
  await currentRow('Ø12–Ø12 × 25');
  await button('Undo').click();
  await f.same(bought);
  await button('Redo').click();
  await f.same(made);
  await button('Undo').click();
  await f.same(bought);
  assert.deepEqual(await stored(aName), savedA);
  assert.deepEqual(await stored(bName), savedB);
  f.report.observations.push({ held, staleCsv: false, staleEdit: false, reopenedByteMatch: true, postOpenUndoRedo: true });
  await f.snapshot('B-project-restored');
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
  f.report.fixtureHashes = { a: sha256(bytes(a)), b: sha256(bytes(b)) };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(installBoundaryObservers);
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
        if (url.origin !== origin) return route.abort();
        return route.continue();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };

  await f.newPage();
  if (projectMode) {
    await verifyProjectRoundTrip();
    assert.deepEqual(f.report.downloads, []);
    f.report.productResult = 'PASS';
    return;
  }
  f.phase = 'seed current BOM A';
  await open('D575-A', a);
  await clickModelCommand(f.page, 'Inspect', 'BOM');
  await currentRow('Ø10–Ø10 × 20');
  await panel().getByLabel('Purchase list with made parts').check();
  f.report.files.push(await csv('current-A-csv', 'D575-A', '1 steps Ø10–Ø10 × 20', ['D575-A']));
  await f.snapshot('A-current');

  f.phase = 'keep the BOM panel mounted and hold the B reply';
  await f.page.evaluate(() => window.__d575Hold.arm());
  await open('D575-B', b);
  assert.equal(await panel().isVisible(), true);
  await f.page.waitForFunction(() => window.__d575Hold.read());
  const held = await f.page.evaluate(() => window.__d575Hold.read());
  assert.equal(held.ok, true);
  assert.equal(held.revision, held.resultRevision);
  const pending = await f.snapshot('B-pending');

  if (repro) {
    assert.equal(await panel().getByLabel('Purchase list with made parts').isChecked(), true);
    const staleRow = await currentRow('Ø10–Ø10 × 20');
    f.report.files.push(await csv('stale-csv-named-B', 'D575-B', '1 steps Ø10–Ø10 × 20', ['D575-A']));
    await staleRow.selectOption('made');
    await f.changed(b);
    const after = await f.snapshot('stale-row-writes-B');
    assert.deepEqual(after.doc, { ...b, nodes: [{ ...b.nodes[0], bought: false }] });
    assert.equal(after.dirty, true);
    await button('Undo').click();
    await f.same(b);
    await f.page.evaluate(() => window.__d575Hold.release());
    f.report.observations.push({ held, staleCsv: true, staleEdit: true });
  } else {
    assert.equal(await select().count(), 0);
    assert.equal(await panel().getByLabel('BOM lines', { exact: true }).count(), 0);
    assert.match(await panel().getByRole('status').textContent(), /Working out the BOM/);
    assert.equal(await csvButton().isDisabled(), true);
    await csvButton().evaluate(element => element.click());
    assert.equal((await captures()).length, 1);
    const after = await f.snapshot('B-blocked');
    for (const field of ['doc', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(after[field], pending[field], field);

    f.phase = 'current B reply and current actions';
    await f.page.evaluate(() => window.__d575Hold.release());
    await currentRow('Ø12–Ø12 × 25');
    f.report.files.push(await csv('current-B-with-made', 'D575-B', '1 steps Ø12–Ø12 × 25', ['D575-B']));
    await panel().getByLabel('Purchase list with made parts').uncheck();
    await csvButton().click();
    const withoutMade = (await captures()).at(-1);
    assert.equal(withoutMade.text.trim().split('\n').length, 1, 'made shaft and part are excluded');
    await select().selectOption('bought');
    await f.changed(b);
    const bought = await f.doc();
    assert.deepEqual(bought, { ...b, nodes: [{ ...b.nodes[0], bought: true }] });
    await currentRow('Ø12–Ø12 × 25');
    f.report.files.push(await csv('current-B-bought', 'D575-B', '1 steps Ø12–Ø12 × 25', []));
    await button('Undo').click();
    await f.same(b);
    await button('Redo').click();
    await f.same(bought);
    await currentRow('Ø12–Ø12 × 25');
    await f.snapshot('B-current-bought');
    f.report.observations.push({ held, staleCsv: false, staleEdit: false, currentOverride: true });
  }

  f.report.productResult = repro ? 'FAIL' : 'PASS';
  assert.deepEqual(f.report.downloads, []);
});
