// D574 / #2364. Run under the heavy gate from apps/cad-studio.
// D574_SOURCE_FROZEN=1 node test/sketch-finish-ownership-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
// D734_SOURCE_FROZEN=1 node test/sketch-finish-ownership-browser.mjs EXTERNAL_OUTPUT --expect=transitions
// D735_SOURCE_FROZEN=1 node test/sketch-finish-ownership-browser.mjs EXTERNAL_OUTPUT --expect=refusal
// D736_SOURCE_FROZEN=1 node test/sketch-finish-ownership-browser.mjs EXTERNAL_OUTPUT --expect=associations
import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(output && isAbsolute(output) && relative(resolve(import.meta.dirname, '../../..'), output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=fixed', '--expect=transitions', '--expect=refusal', '--expect=associations'].includes(mode));
const repro = mode === '--expect=repro';
const transitions = mode === '--expect=transitions';
const refusal = mode === '--expect=refusal';
const associations = mode === '--expect=associations';
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
const drilled = {
  ...fixture,
  nodes: [...fixture.nodes, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [34, 10], radius: 2, id: 'n2' }],
  outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
};
const drilledInput = payload('D735-drilled.bcad', Buffer.from(JSON.stringify(drilled)));
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
area = w * 20
if d.get('drilled'):
    hole = d['doc']['nodes'][2]
    assert hole['id'] == 'n2' and hole['kind'] == 'hole' and hole['parent'] == {'node': 1, 'side': 'solid'}
    assert hole['center'] == [34, 10] and hole['radius'] == 2
    area -= math.pi * 2**2
assert math.isclose(body['volume'], area * 10, abs_tol=1e-9, rel_tol=0), body
if 'linked' in d:
    ring = d['doc']['nodes'][2]
    assert ring['id'] == 'n2' and ring['kind'] == 'sketch'
    assert ring['on'] == {'node': 1, 'side': 'solid'}
    assert math.isclose(ring['plane']['origin'][2], 10, abs_tol=1e-9)
    assert ring['plane']['normal'] == [0, 0, 1]
    def edges(points):
        return list(zip(points, points[1:] + points[:1]))
    def polygon_area(points):
        return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in edges(points)))/2
    if ring['profile'] == 'rectangle':
        lo, hi = ring['min'], ring['max']
        outer = [lo, [hi[0], lo[1]], hi, [lo[0], hi[1]]]
    elif ring['profile'] == 'polygon':
        outer = ring['points']
    else:
        assert ring['profile'] == 'loop' and all(s['kind']=='line' for s in ring['segments'])
        outer = [s['start'] for s in ring['segments']]
    assert len(ring['holes']) == 1 and all(s['kind']=='line' for s in ring['holes'][0])
    inner = [s['start'] for s in ring['holes'][0]]
    if d['linked']:
        a = ring['association']
        assert a['kind'] == 'planar-face-outline-inset' and a['sourceFeature'] == 'n1' and a['face'] == 'n1.top'
        assert a['source'] == ring['on'] and a['insetMM'] == 2
        assert math.isclose(polygon_area(outer), 800, abs_tol=1e-9)
        assert math.isclose(polygon_area(inner), 576, abs_tol=1e-9)
    else:
        assert 'association' not in ring
        assert polygon_area(outer) > polygon_area(inner) > 0
        assert any(math.isclose(math.dist(a,b), d['edge'], abs_tol=1e-9) for a,b in edges(outer) + edges(inner))
print(json.dumps({'status': 'PASS', 'width': w, 'volume': body['volume'], 'absoluteTolerance': 1e-9}))
`;
const pins = [
  'apps/cad-studio/test/sketch-finish-ownership-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts', 'apps/cad-studio/src/engine/client.ts',
  'packages/barocss-cad-model/src/engine/wireDoc.ts', 'packages/barocss-cad-model/src/sketch/reopen.ts',
  ...(transitions ? ['apps/cad-studio/src/ui/useWorkspaceModeExit.tsx'] : []),
  ...(associations ? ['apps/cad-studio/src/ui/SketchPanel.tsx', 'packages/barocss-cad-model/src/engine/part.ts'] : []),
];
const expectation = associations ? ['D736', 'linked and detached sketch Finish']
  : refusal ? ['D735', 'actual refused Finish responses']
  : transitions ? ['D734', 'workspace transitions and reversed replies']
  : ['D574', 'desktop'];
const f = await createFlow({
  name: 'sketch-finish-ownership', envFrozen: expectation[0] + '_SOURCE_FROZEN', output,
  qualification: expectation[0] + ' #2364 ' + expectation[1],
  initialFiles: pins, requiredFrozen: pins, oracleSource,
  limits: [refusal ? 'Ordinary reopened rectangle with an extrude and downstream hole. The test holds an actual refused reply without changing it.'
    : 'One ordinary reopened rectangle and extrusion. The test holds actual successful evaluate replies without changing them.'],
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

function installSequenceHold() {
  const worker = Worker.prototype;
  const onMessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!onMessage?.set) throw new Error('Worker onmessage setter required');
  const post = worker.postMessage;
  let remaining = 0;
  const requests = [];
  worker.postMessage = function (request, ...args) {
    if (remaining && request?.type === 'evaluate') {
      remaining--;
      requests.push({ worker: this, id: request.id, revision: request.revision });
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onMessage.get,
    set(callback) {
      onMessage.set.call(this, callback && function (event) {
        const request = requests.find(request => request.worker === this && request.id === event.data?.id);
        if (request && !request.reply && event.data.result) {
          const result = event.data.result;
          request.reply = { ok: result.ok, revision: result.revision, ...(result.ok ? {} : { error: result.error }) };
          request.deliver = () => callback.call(this, event);
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__d734Hold = {
    arm(count) {
      if (remaining || requests.length) throw new Error('The sequence can be armed only once');
      remaining = count;
    },
    read: () => requests.map(({ id, revision, reply }) => ({ id, revision, reply })),
    async release(index) {
      const request = requests[index];
      if (!request?.deliver) throw new Error('The real Worker reply must be held');
      const deliver = request.deliver;
      request.deliver = null;
      deliver();
      await new Promise(done => setTimeout(done, 0));
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
async function physical(label, state, width, withHole = false, extra = {}) {
  await f.ready();
  const physical = await f.runOracle({ doc: state, bodies: (await f.bodies()).bodies, width, drilled: withHole, ...extra }, label);
  assert.deepEqual(state.nodes[1], fixture.nodes[1]);
  assert.equal(state.nodes[0].id, 'n0');
  assert.deepEqual(state.outputs, (withHole ? drilled : fixture).outputs);
  return physical;
}
async function saveThenReopen(label, doc, width, withHole = false, extra = {}) {
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
  await physical(label + '-fresh-open', await f.doc(), width, withHole, extra);
}

const arm = count => f.page.evaluate(count => window.__d734Hold.arm(count), count);
const release = index => f.page.evaluate(index => window.__d734Hold.release(index), index);
async function held(count, ok = true) {
  await f.page.waitForFunction(count => {
    const requests = window.__d734Hold.read();
    return requests.length === count && requests.every(request => request.reply);
  }, count);
  const requests = await f.page.evaluate(() => window.__d734Hold.read());
  assert.ok(requests.every(({ revision, reply }) => reply.ok === ok && revision === reply.revision));
  return requests;
}
function sameState(after, before, { noticeChanged = false } = {}) {
  for (const key of ['doc', 'bodies', 'selection', 'notices', 'history', 'historyControls', 'dirty', 'fileName']) {
    if (noticeChanged && key === 'notices') continue;
    assert.deepEqual(after[key], before[key], key);
  }
}

async function verifyPendingTransitions() {
  const tab = name => f.page.getByRole('group', { name: 'Mode', exact: true }).getByRole('button', { name, exact: true });
  const dialog = () => f.page.getByRole('dialog', { name: 'Discard sketch changes?', exact: true });
  const begin = async count => {
    await f.newPage();
    await open(input, fixture);
    await reopen();
    await setWidth(50);
    await arm(count);
    await finish();
  };

  for (const name of ['Model', 'Drawing', 'Render']) {
    const label = 'discard-to-' + name.toLowerCase();
    f.phase = label;
    await begin(1);
    const requests = await held(1);
    await tab(name).click();
    await dialog().getByRole('button', { name: 'Discard changes', exact: true }).click();
    await dialog().waitFor({ state: 'hidden' });
    await f.sketchPanel().waitFor({ state: 'hidden' });
    await f.same(fixture);
    assert.match(await tab(name).getAttribute('class'), /\bon\b/);
    const before = await f.snapshot(label + '-before-reply');
    await release(0);
    await f.same(fixture);
    const after = await f.snapshot(label + '-after-reply');
    sameState(after, before);
    assert.match(await tab(name).getAttribute('class'), /\bon\b/);
    await physical(label, after.doc, 40);
    f.report.observations.push({ mode: name, requests, volume: 8000 });
  }

  f.phase = 'Keep the current draft during a pending Drawing exit';
  await begin(1);
  const current = await held(1);
  await tab('Drawing').click();
  await dialog().getByRole('button', { name: 'Keep editing', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  assert.equal(await widthInput().inputValue(), '50');
  await release(0);
  await f.changed(fixture);
  await f.sketchPanel().waitFor({ state: 'hidden' });
  const kept = await f.snapshot('keep-editing-and-finish');
  await physical('keep-editing-and-finish', kept.doc, 50);
  await f.undo();
  await f.same(fixture);
  f.report.observations.push({ mode: 'Drawing', kept: true, requests: current, volume: 10000 });

  for (const reverse of [false, true]) {
    const label = reverse ? 'newer-then-older' : 'older-then-newer';
    f.phase = label;
    await begin(2);
    await held(1);
    await setWidth(60);
    await finish();
    const requests = await held(2);
    assert.ok(requests[0].id < requests[1].id && requests[0].revision < requests[1].revision);
    const before = await f.snapshot(label + '-both-held');
    if (!reverse) {
      await release(0);
      await f.same(fixture);
      sameState(await f.snapshot(label + '-after-older'), before);
      assert.equal(await widthInput().inputValue(), '60');
    }
    await release(1);
    await f.changed(fixture);
    await f.sketchPanel().waitFor({ state: 'hidden' });
    const newest = await f.snapshot(label + '-after-newer');
    await physical(label, newest.doc, 60);
    if (reverse) {
      await release(0);
      await f.same(newest.doc);
      sameState(await f.snapshot(label + '-after-older'), newest);
    }
    await f.undo();
    await f.same(fixture);
    await f.redo();
    await f.same(newest.doc);
    f.report.observations.push({ order: reverse ? [1, 0] : [0, 1], requests, volume: 12000 });
  }
  await saveThenReopen('D734-current-60', await f.doc(), 60);
}

async function verifyRefusedFinish() {
  for (const action of ['cancel', 'supersede', 'current']) {
    f.phase = 'A genuine refused Finish is ' + action;
    await f.newPage();
    await open(drilledInput, drilled);
    await reopen();
    await setWidth(30);
    await arm(1);
    await finish();
    const [request] = await held(1, false);
    assert.equal(request.reply.error.code, 'SELECTION');
    assert.equal(request.reply.error.feature, 'n2');
    assert.match(request.reply.error.title, /hole misses the body/i);

    if (action === 'cancel') {
      await f.page.keyboard.press('Escape');
      await f.sketchPanel().waitFor({ state: 'hidden' });
    } else if (action === 'supersede') {
      await setWidth(50);
    }
    const before = await f.snapshot(action + '-before-error');
    await release(0);
    await f.same(drilled);
    if (action === 'current') await f.waitToast(/The hole misses the body/);
    const after = await f.snapshot(action + '-after-error');
    sameState(after, before, { noticeChanged: action === 'current' });
    await physical(action + '-retained', after.doc, 40, true);
    assert.equal(await f.sketchPanel().isVisible(), action !== 'cancel');
    if (action !== 'cancel') assert.equal(await widthInput().inputValue(), action === 'current' ? '30' : '50');
    f.report.observations.push({ action, request, retainedVolume: 8000 - 40 * Math.PI });

    if (action === 'current') {
      await f.dismissToasts();
      await setWidth(50);
      await finish();
      await f.changed(drilled);
      await f.sketchPanel().waitFor({ state: 'hidden' });
      const accepted = await f.snapshot('valid-retry-50');
      await physical('valid-retry-50', accepted.doc, 50, true);
      await f.undo();
      await f.same(drilled);
      await f.redo();
      await f.same(accepted.doc);
      await saveThenReopen('D735-valid-retry', accepted.doc, 50, true);
    }
  }
}

async function verifyAssociationFinish() {
  const panel = () => f.sketchPanel();
  const linkedStatus = () => panel().getByText(/Linked face outline and inset/);
  const detachedStatus = () => panel().getByText(/Link detached by a geometry or plane edit/);
  const newLinked = async () => {
    await f.newPage();
    await open(input, fixture);
    await button('Top').click();
    await f.frame([[0, 0], [40, 20]]);
    const [x, y] = await f.page.evaluate(() => window.__studioScreenOf([10, 10, 10]));
    await f.page.mouse.click(x, y);
    await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
    await f.page.getByRole('group', { name: 'Mode', exact: true }).getByRole('button', { name: 'Sketch', exact: true }).click();
    await panel().getByLabel('Sketch plane', { exact: true }).selectOption('face');
    await panel().getByLabel('Offset distance', { exact: true }).fill('2');
    await panel().getByRole('button', { name: 'Link face outline + inset', exact: true }).click();
    await linkedStatus().waitFor();
  };
  const reopenLinked = async doc => {
    await f.newPage();
    await open(payload('D736-linked.bcad', Buffer.from(JSON.stringify(doc))), doc);
    await f.page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · polygon', exact: true }).click();
    await f.editor().waitFor();
    await f.editor().getByRole('button', { name: 'Edit sketch', exact: true }).click();
    await linkedStatus().waitFor();
  };
  const finishHeld = async () => {
    await arm(1);
    await finish();
    return (await held(1))[0];
  };
  const cancelHeld = async (label, doc) => {
    await f.page.keyboard.press('Escape');
    await panel().waitFor({ state: 'hidden' });
    const before = await f.snapshot(label + '-before-reply');
    await release(0);
    await f.same(doc);
    const after = await f.snapshot(label + '-after-reply');
    sameState(after, before);
    assert.equal(await panel().isVisible(), false);
  };

  f.phase = 'Cancel a linked inset before the original reply';
  await newLinked();
  const linkedCancelled = await finishHeld();
  await cancelHeld('linked-cancelled', fixture);

  f.phase = 'Apply the current linked inset';
  await newLinked();
  const linkedCurrent = await finishHeld();
  await release(0);
  await f.changed(fixture);
  await panel().waitFor({ state: 'hidden' });
  const linked = await f.snapshot('linked-current');
  await physical('linked-current', linked.doc, 40, false, { linked: true });
  await f.undo();
  await f.same(fixture);
  await f.redo();
  await f.same(linked.doc);
  await saveThenReopen('D736-linked', linked.doc, 40, false, { linked: true });

  f.phase = 'Unchanged linked reopen keeps the exact source';
  await reopenLinked(linked.doc);
  await arm(1);
  await finish();
  await panel().waitFor({ state: 'hidden' });
  await f.same(linked.doc);
  assert.deepEqual(await f.page.evaluate(() => window.__d734Hold.read()), []);
  await f.snapshot('linked-reopen-unchanged');

  const detach = async () => {
    await reopenLinked(linked.doc);
    await widthInput().waitFor();
    const next = Number(await widthInput().inputValue()) + 0.5;
    await setWidth(next);
    await detachedStatus().waitFor();
    return next;
  };
  f.phase = 'Cancel an association-detached edit before the original reply';
  const cancelledEdge = await detach();
  const detachedCancelled = await finishHeld();
  await cancelHeld('detached-cancelled', linked.doc);
  await physical('detached-retains-link', linked.doc, 40, false, { linked: true });

  f.phase = 'Apply the current association-detached edit';
  const edge = await detach();
  assert.equal(edge, cancelledEdge);
  const detachedCurrent = await finishHeld();
  await release(0);
  await f.changed(linked.doc);
  await panel().waitFor({ state: 'hidden' });
  const detached = await f.snapshot('detached-current');
  await physical('detached-current', detached.doc, 40, false, { linked: false, edge });
  await f.undo();
  await f.same(linked.doc);
  await f.redo();
  await f.same(detached.doc);
  await saveThenReopen('D736-detached', detached.doc, 40, false, { linked: false, edge });
  f.report.observations.push({ linkedCancelled, linkedCurrent, detachedCancelled, detachedCurrent, edge });
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
  f.report.fixtureSha256 = sha256((refusal ? drilledInput : input).buffer);
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(transitions || refusal || associations ? installSequenceHold : installReplyHold);
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

  if (transitions || refusal || associations) {
    if (associations) await verifyAssociationFinish();
    else if (refusal) await verifyRefusedFinish();
    else await verifyPendingTransitions();
    f.report.productResult = 'PASS';
    assert.deepEqual(f.report.downloads, []);
    return;
  }

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
