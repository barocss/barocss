// D574 / #2364. Run under the heavy gate from apps/cad-studio.
// D574_SOURCE_FROZEN=1 node test/sketch-finish-ownership-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(output && isAbsolute(output) && relative(resolve(import.meta.dirname, '../../..'), output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=fixed'].includes(mode));
const repro = mode === '--expect=repro';
const fixture = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const payload = (name, bytes) => ({ name, mimeType: 'application/json', buffer: bytes });
const input = payload('D574-box.bcad', Buffer.from(JSON.stringify(fixture)));
const oracleSource = String.raw`
import json, math, sys
d = json.load(sys.stdin)
w = d['width']
s = d['doc']['nodes'][0]
if s['profile'] == 'rectangle':
    points = [s['min'], s['max']]
else:
    assert s['profile'] == 'loop', s
    points = [seg['start'] for seg in s['segments']]
for i, extent in enumerate([w, 20]):
    coords = [p[i] for p in points]
    assert math.isclose(max(coords) - min(coords), extent, abs_tol=1e-9, rel_tol=0), points
assert len(d['bodies']) == 1
body = d['bodies'][0]
assert math.isclose(body['volume'], w * 20 * 10, abs_tol=1e-9, rel_tol=0), body
print(json.dumps({'status': 'PASS', 'width': w, 'volume': body['volume'], 'absoluteTolerance': 1e-9}))
`;
const pins = [
  'apps/cad-studio/test/sketch-finish-ownership-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts', 'apps/cad-studio/src/engine/client.ts',
  'packages/barocss-cad-model/src/engine/wireDoc.ts', 'packages/barocss-cad-model/src/sketch/reopen.ts',
];
const f = await createFlow({
  name: 'sketch-finish-ownership', envFrozen: 'D574_SOURCE_FROZEN', output, qualification: 'D574 #2364 desktop',
  initialFiles: pins, requiredFrozen: pins, oracleSource,
  limits: ['One ordinary reopened rectangle and extrusion. The test holds an actual successful evaluate reply without changing it.'],
  snapshotExtra: () => ({
    fileName: document.querySelector('.doc-tab input')?.value,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => {
      const button = document.querySelector(`button[aria-label="${name}"]`);
      return { disabled: button.disabled, tip: button.getAttribute('data-tip') };
    }),
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const widthInput = () => f.sketchPanel().getByLabel('Edge 1 length', { exact: true });
const finish = () => f.page.locator('.topbar button.finish').click();

function installReplyHold() {
  const worker = Worker.prototype;
  const onMessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!onMessage?.set) throw new Error('Worker onmessage setter required');
  const post = worker.postMessage;
  let armed = false, target, held;
  const waiting = [];
  worker.postMessage = function (request, ...args) {
    if (armed && request?.type === 'evaluate') {
      armed = false;
      const sketch = request.doc.added.map(([, node]) => node).find(node => node.id === 'n0');
      target = { worker: this, id: request.id, revision: request.revision, sketch };
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onMessage.get,
    set(callback) {
      onMessage.set.call(this, callback && function (event) {
        if (target?.worker === this) {
          const data = event.data;
          if (!held && data?.id === target.id && data.result) {
            held = { id: data.id, revision: target.revision, resultRevision: data.result.revision, ok: data.result.ok, sketch: target.sketch };
          }
          if (held) {
            waiting.push(() => callback.call(this, event));
            return;
          }
        }
        callback.call(this, event);
      });
    },
  });
  window.__d574Hold = {
    arm() { if (armed || target) throw new Error('One evaluate may be held'); armed = true; },
    read: () => held,
    async release() {
      if (!held || !waiting.length) throw new Error('One real evaluate reply must be held');
      target = null;
      for (const deliver of waiting.splice(0)) {
        deliver();
        await new Promise(done => setTimeout(done, 0));
      }
    },
  };
}

async function open(file, expected) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(file);
  await f.same(expected);
}
async function reopen() {
  await f.openFeatureEditor(1);
  await f.editor().getByRole('button', { name: 'Edit sketch', exact: true }).click();
  await widthInput().waitFor();
  assert.equal(await widthInput().inputValue(), '40');
}
async function setWidth(width) {
  await widthInput().fill(String(width));
  await widthInput().press('Enter');
  assert.equal(await widthInput().inputValue(), String(width));
}
async function physical(label, state, width) {
  await f.ready();
  const physical = await f.runOracle({ doc: state, bodies: (await f.bodies()).bodies, width }, label);
  assert.deepEqual(state.nodes[1], fixture.nodes[1]);
  assert.equal(state.nodes[0].id, 'n0');
  assert.deepEqual(state.outputs, fixture.outputs);
  return physical;
}
async function saveThenReopen(label, doc, width) {
  f.phase = 'Save and fresh Open ' + label;
  const projectName = 'D574 ' + label;
  const fileName = label + '.bcad';
  await f.page.locator('.doc-tab input').fill(label);
  await button('Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(fileName, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([projectName, fileName]) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const project = await projects.getDirectoryHandle(projectName);
    const handle = await project.getFileHandle(fileName);
    return [...new Uint8Array(await (await handle.getFile()).arrayBuffer())];
  }, [projectName, fileName]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.files.push({ label, sha256: sha256(bytes), byteLength: bytes.length });
  await f.newPage();
  await open(payload(fileName, bytes), doc);
  await physical(label + '-fresh-open', await f.doc(), width);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
  f.report.fixtureSha256 = sha256(input.buffer);
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(installReplyHold);
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

  for (const action of ['cancel', 'edit-again']) {
    f.phase = action + ' while Finish is pending';
    await f.newPage();
    await open(input, fixture);
    await reopen();
    await setWidth(50);
    await f.page.evaluate(() => window.__d574Hold.arm());
    await finish();
    await f.page.waitForFunction(() => window.__d574Hold.read());
    const held = await f.page.evaluate(() => window.__d574Hold.read());
    assert.equal(held.ok, true);
    assert.equal(held.resultRevision, held.revision);
    assert.equal(held.sketch?.id, 'n0');
    if (action === 'cancel') {
      await f.page.keyboard.press('Escape');
      await f.sketchPanel().waitFor({ state: 'hidden' });
    } else {
      await setWidth(60);
    }
    const before = await f.snapshot(action + '-before-reply');
    assert.deepEqual(before.doc, fixture);
    await f.page.evaluate(() => window.__d574Hold.release());
    if (repro) await f.changed(fixture);
    else await f.same(fixture);
    const after = await f.snapshot(action + '-after-reply');
    const measured = await physical(action + '-after-reply', after.doc, repro ? 50 : 40);
    if (repro) {
      assert.equal(await f.sketchPanel().isVisible(), false);
      assert.notDeepEqual(after.historyControls, before.historyControls);
    } else {
      for (const key of ['doc', 'bodies', 'selection', 'notices', 'history', 'historyControls', 'dirty', 'fileName']) {
        assert.deepEqual(after[key], before[key], key);
      }
      assert.equal(await f.sketchPanel().isVisible(), action !== 'cancel');
      if (action !== 'cancel') assert.equal(await widthInput().inputValue(), '60');
    }
    f.report.observations.push({ action, held, volume: measured.volume, draftOpen: await f.sketchPanel().isVisible() });

    if (!repro && action === 'cancel') await saveThenReopen('D574-cancelled-40', fixture, 40);
    if (!repro && action === 'edit-again') {
      await f.finishSketch('current-60-finish');
      const edited = await f.doc();
      await physical('current-60-finish', edited, 60);
      await button('Undo').click();
      await f.same(fixture);
      await physical('first-undo-40', await f.doc(), 40);
      await button('Redo').click();
      await f.same(edited);
      await physical('first-redo-60', await f.doc(), 60);
      await saveThenReopen('D574-finished-60', edited, 60);
    }
  }

  f.report.productResult = repro ? 'FAIL' : 'PASS';
  assert.deepEqual(f.report.downloads, []);
});
