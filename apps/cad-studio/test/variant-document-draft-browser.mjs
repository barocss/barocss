// D573 / #2362. Run under the heavy gate from apps/cad-studio.
// D573_SOURCE_FROZEN=1 node test/variant-document-draft-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(output && isAbsolute(output) && relative(resolve(import.meta.dirname, '../../..'), output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=fixed'].includes(mode));
const repro = mode === '--expect=repro';

function box(parameter, height, width = 10) {
  return {
    format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { [parameter]: height },
    nodes: [
      { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [width, 5], id: 'n0' },
      { kind: 'extrude', sketch: 0, height: { parameter }, id: 'n1' },
    ],
    outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
    variability: { version: 1, inputs: [
      { name: 'size', type: 'number', min: 1, max: 100, unit: 'mm', default: height,
        bindings: [{ to: 'parameter', part: 'base', parameter }] },
    ] },
  };
}
const a = box('HeightA', 20, 6);
const b = box('HeightB', 10);
const noInputs = { ...box('HeightOther', 7) };
delete noInputs.variability;
const file = doc => ({ name: 'D573-box.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
const oracleSource = String.raw`
import json, math, sys
d = json.load(sys.stdin)
assert len(d['bodies']) == 1
body = d['bodies'][0]
w, h = d['width'], d['height']
v = w * 5 * h
tol = 1e-9
assert math.isclose(body['volume'], v, abs_tol=tol, rel_tol=0), body
assert len(body['centroid']) == 3
assert all(math.isclose(x, y, abs_tol=tol, rel_tol=0) for x, y in zip(body['centroid'], [w/2, 2.5, h/2])), body
print(json.dumps({'status': 'PASS', 'height': h, 'volume': body['volume'], 'tolerance': tol}))
`;
const pins = [
  'apps/cad-studio/test/variant-document-draft-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/VariantsPanel.tsx', 'apps/cad-studio/src/state/useVariants.ts',
  'apps/cad-studio/src/engine/client.ts', 'packages/barocss-cad-model/src/engine/wireDoc.ts',
  'packages/barocss-cad-model/src/assembly/variability.ts', 'packages/barocss-cad-model/src/chat/variability.ts',
];
const f = await createFlow({
  name: 'variant-document-draft', envFrozen: 'D573_SOURCE_FROZEN', output, qualification: 'D573 #2362 desktop',
  initialFiles: [...pins, 'apps/cad-studio/test/model-rail-helper.mjs'], requiredFrozen: pins, oracleSource,
  limits: ['Synthetic boxes, actual native Open and Variants controls, passive outgoing evaluation observer and independent box arithmetic.'],
});
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Variants panel', exact: true });
const value = () => panel().getByLabel('Value of size', { exact: true });
const banner = () => panel().getByLabel('Variant shown', { exact: true });
const requests = () => f.page.evaluate(() => window.__d573Requests);
const panelButton = name => panel().getByRole('button', { name, exact: true });

async function load(input) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(input);
}
async function open(doc) {
  await load(file(doc));
  const parameter = Object.keys(doc.parameters)[0];
  await f.page.waitForFunction(p => Object.hasOwn(window.__studioDoc?.parameters ?? {}, p), parameter);
  await f.ready();
  assert.deepEqual(await f.doc(), doc);
}
async function geometry(label, width, height, snap = false) {
  const expected = width * 5 * height;
  await f.page.waitForFunction(v => {
    const s = window.__studioBodies?.();
    return window.__studioFresh === true && s?.massReady && s.bodies.length === 1 && Math.abs(s.bodies[0].volume - v) < 1e-9;
  }, expected, { timeout: 20000 });
  if (snap) await f.snapshot(label);
  return f.runOracle({ width, height, bodies: (await f.bodies()).bodies }, label);
}
async function history(action, doc) {
  await button(action).click();
  await f.same(doc);
}
async function showPanel() {
  await clickModelCommand(f.page, 'Inspect', 'Variants');
  await panel().waitFor();
}
async function viewIs(expected, showing = null) {
  assert.equal(await value().inputValue(), String(expected));
  if (showing) assert.match(await banner().innerText(), showing);
  else assert.equal(await banner().count(), 0);
  assert.equal(await panel().getByRole('alert').count(), 0);
}
async function workingA(label) {
  await open(a);
  await showPanel();
  await value().fill('40');
  await geometry(label + '-preview-A', 6, 40, true);
  await viewIs(40, /Master, edited/);
  assert.deepEqual(await f.doc(), a);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
  f.report.fixtureHashes = { a: sha256(file(a).buffer), b: sha256(file(b).buffer), noInputs: sha256(file(noInputs).buffer) };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(() => {
        const original = Worker.prototype.postMessage;
        window.__d573Requests = [];
        Worker.prototype.postMessage = function (message, ...args) {
          const parameters = message?.doc?.doc?.parameters;
          if (message?.type === 'evaluate' && parameters && Object.keys(parameters).some(k => /^Height(A|B|Other)$/.test(k))) {
            window.__d573Requests.push({ id: message.id, revision: message.revision, parameters: { ...parameters } });
          }
          return original.call(this, message, ...args);
        };
      });
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

  for (const keepPanelOpen of [true, false]) {
    f.phase = keepPanelOpen ? 'open B with the Variants panel open' : 'open B with the Variants panel closed';
    const label = keepPanelOpen ? 'panel-open' : 'panel-closed';
    await f.newPage();
    await workingA(label);
    if (!keepPanelOpen) {
      await panelButton('Close Variants').click();
      if (!repro) {
        await geometry('A-panel-closed', 6, 40);
        await showPanel();
        await viewIs(40, /Master, edited/);
        await panelButton('Close Variants').click();
        await open(noInputs);
        await geometry('intermediate-no-inputs', 10, 7);
      }
    }
    const start = (await requests()).length;
    await open(b);
    const expected = repro ? 40 : 10;
    const measured = await geometry(label + '-B', 10, expected, true);
    const bRequests = (await requests()).slice(start).filter(r => Object.hasOwn(r.parameters, 'HeightB'));
    assert.ok(bRequests.length > 0);
    assert.ok(bRequests.every(r => r.parameters.HeightB === expected));
    if (!keepPanelOpen) await showPanel();
    await viewIs(expected, repro ? /Master, edited/ : null);
    f.report.observations.push({ label, firstHeight: bRequests[0].parameters.HeightB, requests: bRequests, volume: measured.volume });
  }

  if (!repro) {
    f.phase = 'ordinary Variants edits on B';
    await value().fill('16');
    await geometry('B-unsaved', 10, 16, true);
    assert.deepEqual(await f.doc(), b);
    await load({ name: 'D573-invalid.bcad', mimeType: 'application/json', buffer: Buffer.from('invalid JSON') });
    await f.waitToast(/not JSON/i);
    await viewIs(16, /Master, edited/);
    assert.deepEqual(await f.doc(), b);
    await f.dismissToasts();

    await f.page.getByLabel('Model file', { exact: true }).evaluate(input => {
      input.addEventListener('cancel', event => { window.__d573TrustedCancel = event.isTrusted && !input.files.length; }, { once: true });
    });
    const cdp = await f.context.newCDPSession(f.page);
    try {
      await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true, cancel: true });
      await button('Open').click();
      await f.page.waitForFunction(() => window.__d573TrustedCancel === true, null, { timeout: 10000 });
    } finally {
      await cdp.send('Page.setInterceptFileChooserDialog', { enabled: false });
      await cdp.detach();
    }
    await viewIs(16, /Master, edited/);
    await geometry('B-after-open-refusals', 10, 16);
    assert.deepEqual(await f.doc(), b);
    await panelButton('Reset to Master').click();
    await viewIs(10);
    await geometry('B-reset', 10, 10);

    await value().fill('18');
    await geometry('B-unsaved-for-save', 10, 18);
    await panel().getByLabel('Variant name', { exact: true }).fill('Tall');
    await panelButton('Save variant').click();
    await f.changed(b);
    const saved = await f.doc();
    assert.deepEqual(saved.parameters, b.parameters);
    assert.deepEqual(saved.nodes, b.nodes);
    assert.deepEqual(saved.variability.variants, [{ name: 'Tall', values: { size: 18 } }]);
    assert.equal(saved.variability.active, 'Tall');
    await viewIs(18, /Showing Tall, regenerated/);
    await history('Undo', b);
    await viewIs(10);
    await geometry('B-undo-save', 10, 10);
    await history('Redo', saved);
    await viewIs(18, /Showing Tall, regenerated/);

    await value().fill('22');
    await geometry('B-before-update', 10, 22);
    await panelButton('Update Tall').click();
    await f.changed(saved);
    assert.deepEqual((await f.doc()).variability.variants, [{ name: 'Tall', values: { size: 22 } }]);
    await viewIs(22, /Showing Tall, regenerated/);
    await panelButton('Show the master').click();
    await geometry('B-master', 10, 10);
    await viewIs(10);
    await panelButton('Show Tall').click();
    await geometry('B-saved-variant', 10, 22, true);
    await viewIs(22, /Showing Tall, regenerated/);
    await panelButton('Show the master').click();
    await viewIs(10);

    f.phase = 'Undo and Redo across a document replacement';
    await open(a);
    await value().fill('40');
    await geometry('A-before-cross-boundary-undo', 6, 40);
    await button('Undo').click();
    await f.page.waitForFunction(() => window.__studioDoc?.parameters?.HeightB === 10);
    await geometry('B-after-cross-boundary-undo', 10, 10);
    await viewIs(10);
    await value().fill('16');
    await geometry('B-before-cross-boundary-redo', 10, 16);
    await history('Redo', a);
    await geometry('A-after-cross-boundary-redo', 6, 20);
    await viewIs(20);
  }

  f.report.productResult = repro ? 'FAIL' : 'PASS';
  assert.deepEqual(f.report.downloads, []);
});
