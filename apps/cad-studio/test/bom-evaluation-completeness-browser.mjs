// D581 / #2420. Run under the heavy gate from apps/cad-studio.
// D581_SOURCE_FROZEN=1 node test/bom-evaluation-completeness-browser.mjs EXTERNAL_OUTPUT --expect=repro|drawing-repro|sheet-repro|fixed
import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=drawing-repro', '--expect=sheet-repro', '--expect=fixed'].includes(mode));
const repro = mode === '--expect=repro';
const blank = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const box = (height, material) => ({
  ...blank,
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2, bodies: { b1: { material } },
});
const instance = (id, name, doc, x) => ({ id, name, doc, position: [x, 0, 0], rotation: [0, 0, 0] });
const fixture = height => ({ ...blank, instances: [
  instance('good', 'Steel box', box(10, 'steel'), 0),
  instance('second', 'Aluminium box', box(height, 'al6061'), 30),
] });
const good = fixture(10), invalid = fixture(0);
const drawingFixture = {
  ...box(10, 'steel'),
  instances: [{ ...instance('second', 'Hidden aluminium box', box(0, 'al6061'), 30), hidden: true }],
  drawing: { sheet: 'A4', scope: { kind: 'assembly' }, projection: 'third', hidden: true, balloons: true, dimensions: [] },
};
const legacySheetSet = height => ({
  ...drawingFixture,
  instances: [{ ...drawingFixture.instances[0], doc: box(height, 'al6061') }],
  drawing: {
    sheet: 'A4', projection: 'third', hidden: true, dimensions: [],
    sheets: [{ id: 'second', name: 'Continuation', views: ['top'] }],
    tables: [{ id: 'bom', from: 'bom' }],
  },
});
const oracleSource = String.raw`
import csv, io, json, math, re, sys
data = json.load(sys.stdin)
rows = list(csv.DictReader(io.StringIO(data['csv'])))
assert list(rows[0]) == ['item no.', 'item', 'qty', 'kind', 'size', 'row', 'catalogue', 'source', 'estimate'], rows
assert [(r['item'], r['qty'], r['kind']) for r in rows] == [('Steel box','1','part'),('Aluminium box','1','part')], rows
mass = float(re.search(r'([\d.]+) g',data['totals'])[1])
expected = 10*10*10*(7.85 + (0 if data['partial'] else 2.7))/1000
assert math.isclose(mass,expected,rel_tol=0,abs_tol=0.050000001),(mass,expected)
print(json.dumps({'status':'PASS','displayedGrams':mass,'expectedGrams':expected,'displayToleranceG':0.050000001,
                  'rows':len(rows),'partial':data['partial']}))
`;
const pins = ['apps/cad-studio/test/bom-evaluation-completeness-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/BomPanel.tsx', 'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
  'apps/cad-studio/src/ui/useDrawingSheet.ts', 'apps/cad-studio/src/ui/drawing/ExportActions.tsx',
  'apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
  ...['bom/bom', 'bom/core', 'assembly/instances', 'chat/outputs', 'chat/drawing', 'engine/errors',
    'engine/refusal', 'team/freshness'].map(p => 'packages/barocss-cad-model/src/' + p + '.ts')];
const f = await createFlow({
  name: 'bom-evaluation-completeness', envFrozen: 'D581_SOURCE_FROZEN', output, qualification: 'D581 #2420 desktop',
  initialFiles: [...pins, 'apps/cad-studio/test/model-rail-helper.mjs'], requiredFrozen: pins, oracleSource,
  limits: ['Real Worker evaluates an ordinary zero-height child. Observe its reply without replacing it. Capture local CSV before any browser download.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`)?.disabled),
    bom: document.querySelector('[aria-label="BOM panel"]')?.textContent,
    totals: document.querySelector('[aria-label="BOM totals"]')?.textContent,
    workerFailures: window.__d581Failures,
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'BOM panel', exact: true });
const exportCsv = () => panel().getByRole('button', { name: 'Export purchase list', exact: true });

function documentBoundary() {
  return {
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    history: ['Undo', 'Redo'].map(name => {
      const button = document.querySelector(`button[aria-label="${name}"]`);
      return { disabled: button.disabled, tip: button.getAttribute('data-tip') };
    }),
  };
}

function observeBoundaries() {
  const worker = Worker.prototype, descriptor = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!descriptor?.set) throw new Error('Worker onmessage setter required');
  const requests = new WeakMap(), post = worker.postMessage;
  window.__d581Failures = [];
  worker.postMessage = function (request, ...args) {
    if (request?.type === 'part' && request.slot === 'read') {
      if (!requests.has(this)) requests.set(this, new Map());
      requests.get(this).set(request.id, request.revision);
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: descriptor.get,
    set(callback) {
      descriptor.set.call(this, callback && function (event) {
        const messages = requests.get(this), revision = messages?.get(event.data?.id);
        const result = event.data?.result;
        if (revision !== undefined && result) {
          messages.delete(event.data.id);
          if (result.ok === false) window.__d581Failures.push({ id: event.data.id, revision, resultRevision: result.revision, error: result.error });
        }
        callback.call(this, event);
      });
    },
  });
  const urls = new Map(), createUrl = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
  window.__d581Csv = [];
  URL.createObjectURL = function (blob) {
    const url = createUrl.call(this, blob);
    if (blob.type === 'text/csv') urls.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = urls.get(this.href);
    if (blob && this.download.endsWith(' purchase list.csv')) {
      window.__d581Csv.push(blob.text());
      return;
    }
    return click.call(this);
  };
}

async function open(name, doc, bytes = Buffer.from(JSON.stringify(doc)), { ready = true } = {}) {
  f.phase = 'public Open ' + name;
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/octet-stream', buffer: bytes });
  if (ready) await f.same(doc);
  else {
    await f.page.waitForFunction(expected => JSON.stringify(window.__studioDoc) === expected, JSON.stringify(doc));
    assert.deepEqual(await f.doc(), doc);
  }
}

async function readCsv(label, partial) {
  const totals = panel().getByLabel('BOM totals', { exact: true });
  await totals.waitFor();
  assert.equal(await exportCsv().isEnabled(), true);
  await panel().getByLabel('Purchase list with made parts').check();
  const before = await f.page.evaluate(() => window.__d581Csv.length);
  await exportCsv().click();
  const csv = await f.page.evaluate(() => Promise.all(window.__d581Csv));
  assert.equal(csv.length, before + 1);
  await f.runOracle({ csv: csv.at(-1), totals: await totals.innerText(), partial }, label);
  f.report.files.push({ label, csvSha256: sha256(csv.at(-1)) });
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
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
  await f.newPage();
  await open('D581-healthy', good);
  await clickModelCommand(f.page, 'Inspect', 'BOM');
  await readCsv('01-healthy', false);
  await f.snapshot('01-healthy');

  await open('D581-invalid', invalid, undefined, { ready: false });
  const originalBoundary = await f.page.evaluate(documentBoundary);
  f.phase = 'real failed occurrence evaluation in current BOM';
  await panel().waitFor();
  await f.page.waitForFunction(() => window.__d581Failures.some(failure => failure.error?.detail === 'height must not be zero'));
  if (repro) {
    await readCsv('02-partial-bom', true);
    await f.snapshot('02-partial-bom');
  } else {
    const error = panel().getByRole('alert');
    await error.waitFor();
    assert.match(await error.innerText(), /second/);
    assert.match(await error.innerText(), /height must not be zero/);
    assert.equal(await panel().getByLabel('BOM totals', { exact: true }).count(), 0);
    assert.equal(await panel().getByRole('table').count(), 0);
    assert.equal(await exportCsv().isEnabled(), false);
    assert.equal(await f.page.evaluate(() => window.__d581Csv.length), 1);
    await f.snapshot('02-bom-refused');
  }
  assert.deepEqual(await f.doc(), invalid);
  assert.deepEqual(await f.page.evaluate(documentBoundary), originalBoundary);

  await open('D581-recovered', good);
  await readCsv('03-recovered', false);
  await f.snapshot('03-recovered');

  f.phase = 'Save the recovered assembly in a local project';
  const project = 'D581 BOM completeness', file = 'D581-recovered.bcad';
  await panel().getByRole('button', { name: 'Close BOM', exact: true }).click();
  await button('Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await f.page.evaluate(async ({ project, file }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, { project, file });
  assert.deepEqual(JSON.parse(saved), good);
  f.report.files.push({ file, sha256: sha256(saved), semanticEquality: true });
  await f.newPage();
  await open('D581-fresh', good, Buffer.from(saved));
  await clickModelCommand(f.page, 'Inspect', 'BOM');
  await readCsv('04-fresh-open', false);
  await f.snapshot('04-fresh-open');
  if (!repro) {
    await panel().getByRole('button', { name: 'Close BOM', exact: true }).click();
    await open('D581-drawing', drawingFixture, undefined, { ready: false });
    await f.page.locator('.mode').getByRole('button', { name: 'Drawing', exact: true }).click();
    f.phase = 'Drawing with requested balloons and a refused BOM occurrence';
    await f.page.waitForFunction(() => window.__d581Failures.some(failure => failure.error?.detail === 'height must not be zero'));
    await f.page.getByLabel('Drawing sheet', { exact: true }).waitFor();
    const outputs = ['Export SVG', 'Export PDF', 'Export DXF'];
    if (mode === '--expect=drawing-repro') {
      for (const output of outputs) assert.equal(await button(output).isEnabled(), true, output);
      assert.equal(await f.page.evaluate(() => window.__studioDrawing?.()?.balloons), undefined);
      await f.snapshot('05-drawing-output-incomplete');
    } else {
      const reason = f.page.getByText(/\[BOM_EVALUATION\] base\/second \(original\).*height must not be zero/);
      await reason.waitFor();
      const before = await f.doc();
      for (const output of outputs) assert.equal(await button(output).isEnabled(), false, output);
      assert.deepEqual(await f.doc(), before);
      await f.snapshot('05-drawing-output-blocked');
      f.phase = 'Remove the requested balloons through Drawing settings';
      await f.page.getByRole('checkbox', { name: 'Balloons', exact: true }).uncheck();
      await reason.waitFor({ state: 'hidden' });
      await f.page.waitForFunction(() => ['Export SVG', 'Export PDF', 'Export DXF'].every(label =>
        document.querySelector(`button[aria-label="${label}"]`)?.disabled === false));
      const after = await f.doc();
      assert.equal(after.drawing?.balloons, undefined);
      assert.deepEqual({ ...after, drawing: null }, { ...before, drawing: null });
      await f.snapshot('06-drawing-output-ready-without-balloons');
    }
  }
  if (mode === '--expect=sheet-repro' || mode === '--expect=fixed') {
    const legacy = legacySheetSet(0);
    await open('D581-legacy', legacy, undefined, { ready: false });
    const drawing = f.page.getByLabel('Drawing sheet', { exact: true });
    if (!(await drawing.count())) await f.page.locator('.mode').getByRole('button', { name: 'Drawing', exact: true }).click();
    const reason = f.page.getByText(/\[BOM_EVALUATION\] base\/second \(original\).*height must not be zero/);
    await reason.waitFor();
    for (const output of ['Export SVG', 'Export PDF', 'Export DXF']) assert.equal(await button(output).isEnabled(), false, output);
    f.phase = 'Legacy continuation sheet uses the whole drawing BOM for PDF';
    const tabs = f.page.getByRole('tablist', { name: 'Sheets', exact: true });
    await tabs.getByRole('tab', { name: 'Continuation', exact: true }).click();
    await drawing.waitFor();
    await f.page.waitForFunction(() => ['Export SVG', 'Export DXF'].every(label =>
      document.querySelector(`button[aria-label="${label}"]`)?.disabled === false));
    if (mode === '--expect=sheet-repro') {
      await f.page.waitForFunction(() => document.querySelector('button[aria-label="Export PDF"]')?.disabled === false);
      await f.snapshot('07-legacy-continuation-wrong-pdf');
    } else {
      await reason.waitFor();
      assert.equal(await button('Export PDF').isEnabled(), false);
      assert.deepEqual(await f.doc(), legacy);
      await f.snapshot('07-legacy-continuation-blocked-pdf');

      const healthy = legacySheetSet(10);
      await open('D581-legacy-healthy', healthy, undefined, { ready: false });
      if (!(await drawing.count())) await f.page.locator('.mode').getByRole('button', { name: 'Drawing', exact: true }).click();
      await tabs.getByRole('tab', { name: 'Continuation', exact: true }).click();
      await f.page.waitForFunction(() => document.querySelector('button[aria-label="Export PDF"]')?.disabled === false);
      assert.deepEqual(await f.doc(), healthy);
      await f.snapshot('08-legacy-continuation-healthy-pdf');
    }
  }
  assert.deepEqual(f.report.downloads, []);
});
