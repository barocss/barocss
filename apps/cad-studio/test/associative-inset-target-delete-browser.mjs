import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(mode === '--baseline' || mode === '--fixed');
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/associative-inset-target-delete-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useFeatureHistory.ts',
  'packages/barocss-cad-model/src/chat/features.ts',
  'packages/barocss-cad-model/src/engine/doc.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
];
const f = await createFlow({
  name: 'associative-inset-target-delete', output, envFrozen: 'D869_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce deleting a linked inset’s independent target and silently reusing its index.'
    : 'Refuse deleting the explicit independent target while its linked inset remains.',
  limits: ['One axial v1 linked inset with a different earlier source and explicit on target.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
    confirm: document.querySelector('[aria-label="Delete with dependents"]')?.textContent ?? null,
  }),
});
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 24], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [100, 0], max: [160, 24], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 8, id: 'n3' },
    { kind: 'sketch', profile: 'polygon', points: [[0, 24], [0, 0], [40, 0], [40, 24]],
      holes: [[[2, 22], [2, 2], [38, 2], [38, 22]].map(start => ({ kind: 'line', start }))],
      sideTags: { outer: ['e1', 'e2', 'e3', 'e4'], holes: [['e5', 'e6', 'e7', 'e8']] },
      plane: { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      association: { kind: 'planar-face-outline-inset', version: 1, source: { node: 3, side: 'solid' },
        sourceFeature: 'n3', face: 'n3.top', insetMM: 2 },
      on: { node: 1, side: 'solid' }, id: 'n4' },
    { kind: 'extrude', sketch: 4, height: 4, id: 'n5' },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' }, b5: { node: 5, side: 'solid' } }, nextId: 6,
};
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= 1e-8, `${a} vs ${b}`);

function preserved(after, before) {
  for (const key of ['doc', 'bodies', 'history', 'selection', 'dirty', 'controls']) assert.deepEqual(after[key], before[key], key);
}

async function verifySeed() {
  await f.same(seed);
  const bodies = (await f.bodies()).bodies;
  assert.deepEqual(bodies.map(body => body.key), ['b1', 'b3', 'b5']);
  bodies.forEach((body, index) => near(body.volume, [7680, 11520, 1280][index]));
  assert.equal(seed.nodes[seed.nodes[4].on.node].id, 'n1');
  assert.equal(seed.nodes[seed.nodes[4].association.source.node].id, 'n3');
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  const bytes = Buffer.from(JSON.stringify(seed));
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D869-linked-target-delete.bcad', mimeType: 'application/json', buffer: bytes });
  f.report.observations.push({ label: 'fixture', bytes: bytes.length, sha256: sha256(bytes) });
  await verifySeed();
  await f.openFeatureEditor(1, 'independent target A');
  const before = await f.snapshot('01-before-target-delete');

  f.phase = 'delete the explicit independent target from History';
  await button(f.editor(), 'Delete feature').click();
  if (baseline) {
    await f.changed(seed);
    const after = await f.snapshot('02-target-aliased-without-confirmation');
    assert.equal(after.confirm, null);
    assert.deepEqual(after.doc.nodes.map(node => node.id), ['n2', 'n3', 'n4', 'n5']);
    const linked = after.doc.nodes[2];
    assert.equal(linked.association.sourceFeature, 'n3');
    assert.equal(after.doc.nodes[linked.association.source.node].id, 'n3');
    assert.equal(after.doc.nodes[linked.on.node].id, 'n3');
    near(after.bodies.bodies.find(body => body.key === 'b5').volume, 1280);
    await f.undo();
    await verifySeed();
    return;
  }

  await f.waitToast(/linked sketch.*separate target/i);
  const refused = await f.snapshot('02-target-delete-refused');
  preserved(refused, before);
  assert.equal(refused.confirm, null);
  await verifySeed();
  await f.dismissToasts();

  f.phase = 'explicitly delete the independent extrusion and its private linked sketch';
  await f.openFeatureEditor(5, 'linked ring');
  await button(f.editor(), 'Delete feature').click();
  await f.changed(seed);
  const noRing = await f.snapshot('03-linked-consumer-removed');
  assert.deepEqual(noRing.doc.nodes.map(node => node.id), ['n0', 'n1', 'n2', 'n3']);
  assert.deepEqual(noRing.bodies.bodies.map(body => body.key), ['b1', 'b3']);

  f.phase = 'remove the former target after the linked consumer is gone';
  await f.openFeatureEditor(1, 'former target A');
  await button(f.editor(), 'Delete feature').click();
  await f.changed(noRing.doc);
  const deleted = await f.snapshot('04-target-removed-explicitly');
  assert.deepEqual(deleted.doc.nodes.map(node => node.id), ['n2', 'n3']);
  assert.deepEqual(deleted.doc.outputs, { b3: { node: 1, side: 'solid' } });
  assert.deepEqual(deleted.bodies.bodies.map(body => body.key), ['b3']);
  near(deleted.bodies.bodies[0].volume, 11520);
  await f.undo();
  await f.same(noRing.doc);
  await f.undo();
  await verifySeed();
  await f.redo();
  await f.same(noRing.doc);
  await f.redo();
  await f.same(deleted.doc);
  assert.deepEqual(f.report.downloads, []);
});
