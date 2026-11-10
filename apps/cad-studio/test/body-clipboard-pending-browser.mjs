// D558 / #2310. Run under the heavy gate from apps/cad-studio.
// D558_SOURCE_FROZEN=1 node test/body-clipboard-pending-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const [output, option] = process.argv.slice(2);
const mode = option?.match(/^--expect=(repro|fixed)$/)?.[1];
assert.ok(mode && output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.equal(process.env.D558_SOURCE_FROZEN, '1');
await mkdir(output);

const fixture = 'apps/cad-studio/handover/notes/project-open-ownership-2026-10-29/consumers/final-first/project-to-B/normal-B-control-nativeB.bcad';
const fixtureHash = 'e619317078bab4c90637ee14ed7abbee602a9033c95cd156b700026f71698772';
const fixtureBytes = await readFile(resolve(repo, fixture));
assert.equal(sha256(fixtureBytes), fixtureHash);
const original = JSON.parse(fixtureBytes);

const oracleSource = String.raw`
import json, math, sys
data = json.load(sys.stdin)
expected = [[6 + x, 6.5, 7] for x in data['offsets']]
bodies = sorted(data['bodies'], key=lambda body: body['centroid'][0])
assert len(bodies) == len(expected)
assert len({body['key'] for body in bodies}) == len(bodies)
for body, point in zip(bodies, expected):
    assert math.isclose(body['volume'], 12*13*14, rel_tol=0, abs_tol=1e-9), body
    assert len(body['centroid']) == len(point)
    assert all(math.isclose(a, b, rel_tol=0, abs_tol=1e-9) for a, b in zip(body['centroid'], point)), (body, point)
print(json.dumps({'status': 'PASS', 'expectedCentroids': expected, 'expectedVolume': 2184, 'absoluteTolerance': 1e-9}))
`;

function installEvaluateReplyHold() {
  const worker = Worker.prototype;
  let owner = worker;
  while (owner && !Object.hasOwn(owner, 'onmessage')) owner = Object.getPrototypeOf(owner);
  const descriptor = owner && Object.getOwnPropertyDescriptor(owner, 'onmessage');
  if (!descriptor?.set) throw new Error('Worker onmessage setter required');
  const post = worker.postMessage;
  let armed = false, target, held, evaluateDelivered = false, released = false;
  const callbacks = [];
  worker.postMessage = function (...args) {
    const request = args[0];
    if (armed && request?.type === 'evaluate') {
      armed = false;
      target = { worker: this, id: request.id, revision: request.revision };
    }
    return Reflect.apply(post, this, args);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: descriptor.get,
    set(callback) {
      if (!callback) return descriptor.set.call(this, callback);
      descriptor.set.call(this, function (event) {
        if (!released && target?.worker === this) {
          if (!held && event.data?.id === target.id && event.data.result) {
            held = { id: target.id, revision: target.revision, resultRevision: event.data.result.revision, ok: event.data.result.ok };
          }
          if (held) {
            callbacks.push(() => callback.call(this, event));
            return;
          }
        }
        callback.call(this, event);
      });
    },
  });
  window.__d558Hold = {
    arm() { if (armed || target) throw new Error('One evaluate may be held'); armed = true; },
    deliverEvaluate() {
      if (!held || evaluateDelivered) throw new Error('One real evaluate reply must be held');
      evaluateDelivered = true;
      callbacks.shift()();
    },
    async deliverRemaining() {
      if (!evaluateDelivered || released) throw new Error('Deliver the held evaluation first');
      // Preserve task turns. In particular, the App must install the evaluation before a mass patch arrives.
      while (callbacks.length) {
        callbacks.shift()();
        await new Promise(done => setTimeout(done, 0));
      }
      released = true;
    },
    read: () => ({ held, evaluateDelivered, released, queued: callbacks.length }),
  };
}

function readBoundary() {
  const current = window.__studioSelection;
  const bodies = window.__studioBodies().bodies;
  const historyAction = name => {
    const button = document.querySelector(`button[aria-label="${name}"]`);
    return { disabled: button.disabled, tip: button.getAttribute('data-tip') };
  };
  return {
    selectedKeys: current.selection.bodies.map(index => bodies[index]?.key),
    history: {
      undo: historyAction('Undo'),
      redo: historyAction('Redo'),
      rows: [...document.querySelectorAll('.history button.hs')].map(row => [row.dataset.nodeIndex, row.getAttribute('aria-label')]),
    },
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    rootFresh: window.__studioFresh,
    hold: window.__d558Hold.read(),
  };
}

const requiredFrozen = [
  fixture, relative(repo, import.meta.filename), 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/workOwnership.ts', 'apps/cad-studio/src/engine/client.ts',
  'apps/cad-studio/src/engine/engine.worker.ts', 'packages/barocss-cad-model/src/chat/features.ts',
];
const f = await createFlow({
  name: 'body-clipboard-pending', envFrozen: 'D558_SOURCE_FROZEN', output,
  qualification: `D558 #2310 pending body Paste (${mode})`,
  initialFiles: requiredFrozen, requiredFrozen, snapshotExtra: readBoundary, oracleSource,
  limits: [
    'One desktop WebGPU context and one retained native box. Public Open, keyboard, Undo and Redo.',
    'Hold one unmodified, successful main Worker reply. Queue later replies from that Worker and release them in order.',
    'The oracle uses independent box arithmetic. The test does not alter the product document or clipboard.',
  ],
});
f.report.productResult = 'NOT_ADJUDICATED';
f.report.mode = mode;

const button = name => f.page.getByRole('button', { name, exact: true });
const checkBodies = (state, offsets) => f.runOracle({ offsets, bodies: state.bodies.bodies }, state.label);
async function settled(label, expected) {
  f.phase = label;
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  if (expected) await f.same(expected);
  else await f.ready();
  const state = await f.snapshot(label);
  assert.equal(state.rootFresh, true);
  assert.equal(state.bodies.massReady, true);
  return state;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(installEvaluateReplyHold);
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
        if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) return route.abort();
        return route.continue();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };

  await f.newPage();
  f.phase = 'open and copy retained box';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(resolve(repo, fixture));
  await f.same(original);
  await f.page.getByRole('complementary', { name: 'Browser', exact: true }).locator('.ol-row > button.ol[title="Double-click to rename"]').click();
  await f.page.keyboard.press('Meta+c');
  await f.page.locator('.toast-title').filter({ hasText: /^Copied$/ }).waitFor();
  const copied = await settled('01-copied-b1', original);
  assert.deepEqual(copied.selectedKeys, ['b1']);

  await f.page.keyboard.press('Meta+v');
  await f.changed(original);
  const first = await settled('02-first-paste');
  const [copyKey] = first.selectedKeys;
  assert.ok(copyKey && copyKey !== 'b1');
  assert.deepEqual(Object.keys(first.doc.outputs).sort(), ['b1', copyKey].sort());
  await checkBodies(first, [0, 22]);
  const nudgedDoc = structuredClone(first.doc);
  const move = nudgedDoc.nodes.at(-1);
  assert.equal(move.kind, 'translate');
  assert.deepEqual(move.offset, [22, 0, 0]);
  move.offset[0] = 23;

  f.phase = 'hold the next actual evaluate reply';
  await f.page.evaluate(() => window.__d558Hold.arm());
  await f.page.keyboard.press('ArrowRight');
  await f.page.waitForFunction(() => window.__d558Hold.read().held && window.__studioFresh === false);
  const pending = await f.snapshot('03-nudge-pending');
  assert.deepEqual(pending.doc, nudgedDoc);
  assert.deepEqual(pending.selectedKeys, [copyKey]);
  assert.equal(pending.bodies.fresh, false);
  assert.equal(pending.hold.held.ok, true);
  assert.equal(pending.hold.held.resultRevision, pending.hold.held.revision);
  assert.equal(pending.hold.released, false);

  f.phase = 'refuse Paste while the owned evaluation waits';
  await f.page.keyboard.press('Meta+v');
  await f.waitToast(/Wait for the computation to finish/);
  const refused = await f.snapshot('04-paste-refused');
  for (const key of ['doc', 'selection', 'selectedKeys', 'bodies', 'history', 'dirty', 'rootFresh']) {
    assert.deepEqual(refused[key], pending[key], `refusal must preserve ${key}`);
  }
  assert.equal(refused.hold.released, false);

  await f.page.evaluate(() => window.__d558Hold.deliverEvaluate());
  await f.page.waitForFunction(() => window.__studioFresh === true && window.__studioBodies().fresh);
  await f.page.evaluate(() => window.__d558Hold.deliverRemaining());
  const nudged = await settled('05-nudge-settled', nudgedDoc);
  assert.equal(nudged.hold.released, true);
  assert.equal(nudged.hold.queued, 0);
  await checkBodies(nudged, [0, 23]);

  await f.page.keyboard.press('Meta+v');
  await f.changed(nudgedDoc);
  const next = await settled('06-next-admitted-paste');
  const newKeys = Object.keys(next.doc.outputs).filter(key => !Object.hasOwn(nudgedDoc.outputs, key));
  assert.equal(newKeys.length, 1);
  assert.deepEqual(next.selectedKeys, newKeys);
  const nextOffset = next.doc.nodes.at(-1).offset;
  const expectedOffset = mode === 'repro' ? 66 : 44;
  f.report.observations.push({ label: 'refused-paste-side-effects', expectedSelectedKeys: [copyKey], actualSelectedKeys: nudged.selectedKeys, expectedNextOffset: 44, actualNextOffset: nextOffset });
  assert.deepEqual(nudged.selectedKeys, mode === 'repro' ? [] : [copyKey]);
  assert.deepEqual(nextOffset, [expectedOffset, 0, 0]);
  await checkBodies(next, [0, 23, expectedOffset]);

  await button('Undo').click();
  await settled('07-first-undo-removes-admitted-paste', nudgedDoc);
  await button('Undo').click();
  await settled('08-second-undo-removes-nudge', first.doc);
  await button('Redo').click();
  await settled('09-first-redo-restores-nudge', nudgedDoc);
  await button('Redo').click();
  await settled('10-second-redo-restores-admitted-paste', next.doc);
  assert.deepEqual(f.report.downloads, []);
  f.report.productResult = mode === 'repro' ? 'FAIL' : 'PASS';
});
