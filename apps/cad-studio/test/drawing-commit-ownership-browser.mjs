// D576 / #2359. Run under the heavy gate from apps/cad-studio.
// D576_SOURCE_FROZEN=1 node test/drawing-commit-ownership-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=fixed'].includes(mode));
const repro = mode === '--expect=repro';
const pathFor = name => `packages/barocss-cad/conformance/r14/orient-${name}/case.json`;
const [platePath, crossPath] = ['plate-x-plus', 'cross-hole-y-plus'].map(pathFor);
const [plateBytes, crossBytes] = await Promise.all([platePath, crossPath].map(path => readFile(resolve(repo, path))));
const plate = JSON.parse(plateBytes), cross = JSON.parse(crossBytes);
const cases = [
  { label: 'front', input: { ...plate.input.document, drawing: plate.input.drawing }, success: /Front now seen from/ },
  { label: 'auto', input: { ...cross.input.document, drawing: { sheet: 'A4', projection: 'third', hidden: true, dimensions: [] } },
    success: /\d+ dimensions? placed/ },
];
const pins = [
  'apps/cad-studio/test/drawing-commit-ownership-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'apps/cad-studio/src/ui/useDrawingSheet.ts',
  'apps/cad-studio/src/ui/drawing/SheetSettings.tsx', 'apps/cad-studio/src/engine/client.ts',
  'packages/barocss-cad-model/src/drawing/reorient.ts', 'packages/barocss-cad-model/src/drawing/layout.ts',
  platePath, crossPath,
];
const f = await createFlow({
  name: 'drawing-commit-ownership', envFrozen: 'D576_SOURCE_FROZEN', output, qualification: 'D576 #2359 desktop',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['Retained R14 fixtures. Actual successful projection reply delayed while a newer Drawing title is committed.'],
  snapshotExtra: () => ({
    drawingRead: window.__studioDrawing?.(),
    historyControls: ['Undo', 'Redo'].map(name => {
      const button = document.querySelector(`button[aria-label="${name}"]`);
      return { disabled: button.disabled, tip: button.getAttribute('data-tip') };
    }),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const front = () => f.page.getByLabel('Front view side', { exact: true });
const title = () => f.page.getByLabel('Drawing title', { exact: true });
const sheet = () => f.page.locator('svg[aria-label="Drawing sheet"]');
const drawingReady = () => f.page.waitForFunction(() => !!window.__studioDrawing?.() && !!document.querySelector('svg[aria-label="Drawing sheet"]'));

function installProjectionHold() {
  const worker = Worker.prototype;
  const onMessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!onMessage?.set) throw new Error('Worker onmessage setter required');
  const post = worker.postMessage;
  let armed = false, target, held, deliver;
  worker.postMessage = function (request, ...args) {
    if (armed && request?.type === 'drawing' && request.options?.orientation === 'x+') {
      armed = false;
      target = { worker: this, id: request.id, orientation: request.options.orientation };
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onMessage.get,
    set(callback) {
      onMessage.set.call(this, callback && function (event) {
        if (!held && target?.worker === this && event.data?.id === target.id && event.data.drawing) {
          held = { id: target.id, orientation: target.orientation, ok: event.data.drawing.ok };
          deliver = () => callback.call(this, event);
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__d576Hold = {
    arm() { if (armed || target) throw new Error('One projection may be held'); armed = true; },
    read: () => held,
    release() { if (!deliver) throw new Error('A real projection reply must be held'); deliver(); deliver = null; },
  };
}

async function open(doc, label) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: `D576-${label}.bcad`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.page.waitForFunction(n => window.__studioDoc?.nodes?.length === n, doc.nodes.length);
  await f.ready();
  await f.page.locator('.mode').getByRole('button', { name: 'Drawing', exact: true }).click();
  await drawingReady();
}
async function request(label) {
  if (label === 'front') await front().selectOption('x+');
  else await button('Auto-dimension').click();
}
const read = () => f.page.evaluate(() => window.__studioDrawing());
function dimensionsByView(doc, readout) {
  return readout.dimensions.map(item => {
    assert.equal(typeof item.value, 'number', JSON.stringify(item));
    const dim = doc.drawing.dimensions.find(dim => dim.id === item.id);
    assert.ok(dim);
    return `${dim.view} ${item.text}`;
  }).sort();
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
  f.report.fixtureHashes = { plate: sha256(plateBytes), cross: sha256(crossBytes) };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(installProjectionHold);
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

  for (const { label, input, success } of cases) {
    f.phase = label + ' original sheet and pending projection';
    await f.newPage();
    await open(input, label);
    const original = await f.doc();
    assert.deepEqual(original.nodes, input.nodes);
    assert.equal(await front().inputValue(), 'y-');
    await f.page.evaluate(() => window.__d576Hold.arm());
    await request(label);
    await f.page.waitForFunction(() => window.__d576Hold.read());
    const held = await f.page.evaluate(() => window.__d576Hold.read());
    assert.deepEqual({ orientation: held.orientation, ok: held.ok }, { orientation: 'x+', ok: true });

    const editedTitle = 'Newer title ' + label;
    await title().fill(editedTitle);
    await title().press('Enter');
    await f.page.waitForFunction(value => window.__studioDoc?.drawing?.title === value, editedTitle);
    const before = await f.snapshot(label + '-newer-title');
    assert.equal(before.doc.drawing.orientation, undefined);
    assert.deepEqual(before.doc.drawing.dimensions, original.drawing.dimensions);
    assert.deepEqual(before.doc.nodes, original.nodes);

    f.phase = label + ' stale projection arrives';
    await f.page.evaluate(() => window.__d576Hold.release());
    const notice = await f.waitToast(repro ? success : /Change not applied/);
    const after = await f.snapshot(label + '-after-stale-projection');
    for (const field of ['doc', 'drawingRead', 'history', 'historyControls', 'dirty']) assert.deepEqual(after[field], before[field], field);
    assert.equal(await title().inputValue(), editedTitle);
    assert.equal(await front().inputValue(), 'y-');
    if (!repro) assert.ok(after.notices.every(text => !success.test(text)));
    f.report.observations.push({ label, held, notice, title: editedTitle, orientation: await front().inputValue() });

    if (!repro) {
      f.phase = label + ' normal current action';
      await f.dismissToasts();
      await request(label);
      await f.changed(before.doc);
      await drawingReady();
      assert.equal(await sheet().count(), 1);
      const current = await f.doc();
      assert.equal(current.drawing.orientation, 'x+');
      assert.equal(current.drawing.title, editedTitle);
      assert.deepEqual(current.nodes, original.nodes);
      await f.waitToast(success);
      const observed = dimensionsByView(current, await read());
      // The current Studio adds THRU to through-hole callouts. The retained Model fixture records the nominal diameter.
      const nominal = observed.map(text => text.replace(/ THRU$/, '')).sort();
      if (label === 'front') assert.deepEqual(nominal, [...plate.expect.dimensions].sort());
      else assert.ok(nominal.includes('front Ø8'), JSON.stringify(observed));
      await f.snapshot(label + '-current-success');
      await button('Undo').click();
      await f.same(before.doc);
      await drawingReady();
      assert.equal(await front().inputValue(), 'y-');
      await button('Redo').click();
      await f.same(current);
      await drawingReady();
      assert.deepEqual(dimensionsByView(current, await read()), observed);
      f.report.observations.push({ label: label + '-current', title: editedTitle, orientation: 'x+', dimensions: observed });
    }
  }
  f.report.productResult = repro ? 'FAIL' : 'PASS';
  assert.deepEqual(f.report.downloads, []);
});
