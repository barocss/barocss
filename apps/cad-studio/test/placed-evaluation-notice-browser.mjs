import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { installD523PlacedReplyScheduler } from './placed-worker-reply-scheduler.mjs';

const baseline = process.argv[3] === '--baseline';
const pins = [
  'apps/cad-studio/test/placed-evaluation-notice-browser.mjs',
  'apps/cad-studio/test/placed-worker-reply-scheduler.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/instanceEvaluation.ts',
  'packages/barocss-cad-model/src/assembly/definitions.ts',
];
const f = await createFlow({
  name: 'placed-evaluation-notice', output: process.argv[2], envFrozen: 'D886_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Display the current native placed failure and retire its notice with the source.',
  limits: ['One zero-height revision, a healthy sibling and local desktop document replacement.'],
  snapshotExtra: () => ({
    instanceBounds: window.__studioInstanceBounds?.() ?? [],
  }),
});

const part = (min, max) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min, max, id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 6, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
});
const source = part([0, 0], [20, 12]);
const broken = { ...source, nodes: [source.nodes[0], { ...source.nodes[1], height: 0 }] };
const left = { id: 'left', name: 'Left box', doc: source, position: [10.25, 14.25, 0], rotation: [0, 0, 0], part: { id: 'left-definition', rev: 'A' } };
const right = { id: 'right', name: 'Right box', doc: source, position: [55.75, 34.25, 0], rotation: [0, 0, 0] };
const original = { ...part([-24.75, -9.5], [-4.75, 2.5]), instances: [left, right] };
const replacement = { ...original, instances: [{ ...left, position: [35.25, 14.25, 0] }, right] };
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const notice = () => f.page.locator('.toast[role="alert"]').filter({ hasText: 'height must not be zero' });

async function open(doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D886-same-name.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

async function readyLeft(x) {
  await f.page.waitForFunction(x => window.__studioInstanceBounds?.().some(item => item.id === 'left' && item.min[0] === x), x);
}

async function selectLeft() {
  await f.page.locator('.ol.instance').filter({ hasText: 'Left box' }).first().click();
  const panel = f.page.getByRole('complementary', { name: 'Instance', exact: true });
  await panel.waitFor();
  return panel;
}

async function offerBroken() {
  const panel = await selectLeft();
  await panel.getByLabel('New revision file', { exact: true }).setInputFiles({
    name: 'D886-broken.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)),
  });
  const accept = button(panel.getByRole('status', { name: 'Revision waiting', exact: true }), 'Accept Rev B');
  await accept.waitFor();
  const offered = await f.doc();
  assert.deepEqual(offered.instances, original.instances);
  assert.deepEqual(offered.pendingParts['left-definition'].doc, broken);
  return { offered, accept };
}

async function holdFailure() {
  const { offered, accept } = await offerBroken();
  await f.page.evaluate(() => window.__d523Placed.arm({ onlyPlaced: true }));
  await accept.click();
  await f.page.waitForFunction(() => window.__studioDoc.instances[0].part.rev === 'B');
  const handle = await f.page.waitForFunction(() => {
    const { claimed, events } = window.__d523Placed.snapshot();
    return claimed && events.find(event => event.kind === 'native-event-held' && event.key === claimed.key && event.id === claimed.id);
  });
  const held = await handle.jsonValue();
  assert.equal(held.resultOK, false);
  assert.equal(held.errorDetail, 'height must not be zero');
  const failed = await f.doc();
  assert.deepEqual(failed.instances[0].doc, broken);
  assert.deepEqual(failed.instances[1], right);
  assert.equal(await notice().count(), 0);
  return { offered, failed, held };
}

async function release({ held }) {
  await f.page.evaluate(() => window.__d523Placed.release());
  assert.ok(await f.page.evaluate(({ id, key }) => window.__d523Placed.snapshot().events.some(event =>
    event.kind === 'client-callback-reached' && event.delivery === 'held-original-event' && event.id === id && event.key === key), held));
}

async function retire(kind, offered) {
  if (kind === 'undo') {
    await f.undo();
    await f.same(offered);
    await readyLeft(left.position[0]);
  } else if (kind === 'remove') {
    await button(await selectLeft(), 'Remove').click();
    await f.page.waitForFunction(() => window.__studioDoc.instances.map(item => item.id).join(',') === 'right');
  } else if (kind === 'new') {
    await button(f.page, 'New part').click();
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0 && !window.__studioDoc.instances?.length);
    await f.ready();
  } else {
    await open(replacement);
    await readyLeft(35.25);
  }
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(installD523PlacedReplyScheduler);
    return context;
  };

  for (const kind of ['undo', 'remove', 'new', 'open']) {
    f.phase = kind + ' with a currently visible placed failure';
    await f.newPage();
    await open(original);
    await readyLeft(left.position[0]);
    const failed = await holdFailure();
    await release(failed);
    await notice().waitFor();
    await f.same(failed.failed);
    const current = await f.snapshot(kind + '-failure-current');
    assert.deepEqual(current.instanceBounds.map(item => item.id), ['right']);
    await retire(kind, failed.offered);
    const retired = await f.snapshot(kind + '-after-source-changed');
    assert.equal(retired.notices.filter(text => text.includes('height must not be zero')).length, baseline ? 1 : 0, kind);
  }

  f.phase = 'deliver a failed original response after a direct same-ID Open';
  await f.newPage();
  await open(original);
  await readyLeft(left.position[0]);
  const late = await holdFailure();
  await open(replacement);
  await f.snapshot('late-failure-replacement-before-release');
  await release(late);
  await readyLeft(35.25);
  await f.same(replacement);
  const after = await f.snapshot('late-failure-replacement-after-release');
  assert.equal(after.notices.filter(text => text.includes('height must not be zero')).length, 0);
  assert.deepEqual(after.instanceBounds.map(item => item.id), ['left', 'right']);
  f.report.observations.push({ label: 'placed-notice', baseline, retirements: ['undo', 'remove', 'new', 'open'],
    lateReply: late.held, originalSHA256: sha256(Buffer.from(JSON.stringify(original))), replacementSHA256: sha256(Buffer.from(JSON.stringify(replacement))) });
  assert.deepEqual(f.report.downloads, []);
});
