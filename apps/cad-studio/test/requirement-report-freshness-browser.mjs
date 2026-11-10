import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=fixed'].includes(mode));
const repro = mode === '--expect=repro';
const requirement = (id, source, axis, op, value) => ({
  id, source, hard: true, basis: 'stated', check: { query: { fn: 'bbox', axis }, op, value, unit: 'mm' },
});
const base = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { H: 10 },
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: { parameter: 'H' }, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
  requirements: [
    requirement('W20', '20 mm width', 'x', '==', 20),
    requirement('H-CAP', 'At most 10 mm height', 'z', '<=', 10),
  ],
};
const taller = { ...base, parameters: { H: 11 } };
const bytes = doc => Buffer.from(JSON.stringify(doc));
const pins = [
  'apps/cad-studio/test/requirement-report-freshness-browser.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/state/useModelChecks.ts',
  'apps/cad-studio/src/ui/RequirementsBrowser.tsx', 'apps/cad-studio/src/engine/client.ts',
  'packages/barocss-cad-model/src/chat/spec.ts', 'packages/barocss-cad-model/src/team/freshness.ts',
];

const f = await createFlow({
  name: 'requirement-report-freshness', envFrozen: 'D589_SOURCE_FROZEN', output,
  qualification: 'One current Studio requirement report across real accepted revisions',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['One native rectangular plate with two root checks. One successful worker reply is held before browser delivery.'],
  snapshotExtra: () => ({
    summary: document.querySelector('.req-head .muted')?.textContent,
    rows: Object.fromEntries([...document.querySelectorAll('.req[aria-label]')].map(row => [
      row.getAttribute('aria-label').replace('Requirement ', ''),
      { status: row.classList[1], text: row.textContent },
    ])),
    held: window.__d589Hold.read(),
  }),
  oracleSource: `
import json, sys
states = json.load(sys.stdin)
for state in states:
    h = state['doc']['parameters']['H']
    body, = state['bodies']['bodies']
    assert abs(body['volume'] - 20*10*h) <= 1e-8
    assert all(abs(v-w) <= 1e-8 for v,w in zip(body['centroid'], [10,5,h/2], strict=True))
    assert state['rows']['W20']['status'] == 'pass'
    assert state['rows']['H-CAP']['status'] == ('pass' if h <= 10 else 'fail')
print(json.dumps({'status':'PASS','states':len(states)}))
`,
});

function installHold() {
  const worker = Worker.prototype, handler = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  if (!handler?.set) throw new Error('Worker onmessage setter required');
  const post = worker.postMessage;
  let armed = false, target, held, deliver;
  worker.postMessage = function (request, ...args) {
    if (armed && request.type === 'evaluate' && request.doc?.doc?.parameters?.H === 11) {
      armed = false;
      target = { worker: this, id: request.id, revision: request.revision };
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: handler.get,
    set(callback) {
      handler.set.call(this, callback && function (event) {
        if (!held && target?.worker === this && target.id === event.data?.id && event.data.result) {
          held = { id: target.id, revision: target.revision, resultRevision: event.data.result.revision, ok: event.data.result.ok };
          deliver = () => callback.call(this, event);
        } else callback.call(this, event);
      });
    },
  });
  window.__d589Hold = {
    arm() { if (armed || target) throw new Error('Only one reply may be held'); armed = true; },
    read: () => held,
    release() { if (!deliver) throw new Error('Expected a held reply'); deliver(); deliver = null; },
  };
}

const button = name => f.page.getByRole('button', { name, exact: true });
async function open(doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D589-plate.bcad', mimeType: 'application/json', buffer: bytes(doc) });
}
async function capture(label, height) {
  await f.ready();
  const summary = height === 10 ? '2 ✓ · 0 ✗ · 0 ?' : '1 ✓ · 1 ✗ · 0 ?';
  await f.page.waitForFunction(text => document.querySelector('.req-head .muted')?.textContent === text, summary);
  const state = await f.snapshot(label);
  assert.equal(state.doc.parameters.H, height);
  assert.deepEqual(state.doc.requirements, base.requirements);
  assert.equal(state.rows.W20.status, 'pass');
  assert.equal(state.rows['H-CAP'].status, height === 10 ? 'pass' : 'fail');
  if (height === 11) assert.match(state.rows['H-CAP'].text, /11 \(want <= 10 mm\)/);
  return state;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
  f.report.fixtures = { first: sha256(bytes(base)), next: sha256(bytes(taller)) };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.addInitScript(installHold);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };

  f.phase = 'current report on the first accepted file';
  await f.newPage();
  await open(base);
  await f.same(base);
  const first = await capture('01-current-pass', 10);

  f.phase = 'old report while the new accepted file waits for native evaluation';
  await f.page.evaluate(() => window.__d589Hold.arm());
  await open(taller);
  await f.page.waitForFunction(() => window.__studioDoc?.parameters.H === 11 && window.__d589Hold.read()?.ok);
  const pending = await f.snapshot('02-pending-revision');
  assert.deepEqual(pending.doc, taller);
  assert.equal(pending.held.revision, pending.held.resultRevision);
  assert.match(pending.summary, /stale|checking/);
  if (repro) {
    assert.match(pending.summary, /2 ✓/);
    assert.deepEqual(Object.values(pending.rows).map(row => row.status), ['pass', 'pass']);
    f.report.finding = { status: 'FAIL', reason: 'An old pass count and green requirement rows remain visible on a new accepted file.' };
  } else {
    assert.doesNotMatch(pending.summary, /[✓✗]/);
    assert.deepEqual(Object.values(pending.rows).map(row => row.status), ['unknown', 'unknown']);
  }
  await f.page.evaluate(() => window.__d589Hold.release());
  const failed = await capture('03-current-height-failure', 11);

  f.phase = 'actual correction, first Undo and Redo';
  const corrected = await f.setParameter('H', 10, '04-corrected-height');
  const current = await capture('05-corrected-pass', 10);
  assert.deepEqual(current.doc, corrected.doc);
  await f.undo();
  await f.same(failed.doc);
  const undone = await capture('06-first-undo-failure', 11);
  await f.redo();
  await f.same(corrected.doc);
  const redone = await capture('07-redo-pass', 10);
  await f.runOracle([first, failed, current, undone, redone], 'current-requirement-results');
  assert.deepEqual(f.report.downloads, []);
});
