import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, twinFile, baseFile] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok([output, twinFile, baseFile].every(path => path && isAbsolute(path) && relative(repo, path).startsWith('../')));
const pins = ['apps/cad-studio/test/placed-proposal-preview-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/state/useProposalPreview.ts',
  'apps/cad-studio/src/ui/ProposalBrowser.tsx', 'apps/cad-studio/src/viewport/instanceEvaluation.ts',
  'apps/cad-studio/src/viewport/SceneViewport.tsx'];
const f = await createFlow({
  name: 'placed-proposal-preview', envFrozen: 'D593_SOURCE_FROZEN', output,
  qualification: 'One placed parameter preview and an independent base-part preview control', initialFiles: pins, requiredFrozen: pins,
  limits: ['Two top-level static occurrences. No placement or visibility edit. One named parameter.'],
  snapshotExtra: () => ({
    placed: window.__studioInstanceBounds?.(),
    volume: document.querySelector('[aria-label="Volume change"]')?.textContent,
  }),
  oracleSource: `
import json, sys
states = json.load(sys.stdin)
for name, heights in [('after', [10, 11]), ('before', [11, 11]), ('hidden', [11, 11]), ('accepted', [10, 11])]:
    snapshot = states[name]
    for index, (box, h) in enumerate(zip(snapshot['placed'], heights, strict=True), 1):
        x = 40 * (index - 1)
        assert box['id'] == f'p{index}'
        expected = [x, 0, 0, x + 20, 10, h]
        assert all(abs(a - b) <= 1e-6 for a, b in zip(box['min'] + box['max'], expected, strict=True))
assert states['after']['volume'] == '−200 mm³'
assert states['base']['volume'] == '−200 mm³ (−9.09%)'
print(json.dumps({'status':'PASS','placedStateCount':4,'volumeDelta':20 * 10 * (10 - 11)}))
`,
});
const button = name => f.page.getByRole('button', { name, exact: true });
const card = () => f.page.getByRole('listitem', { name: 'Proposal P1', exact: true });
const volume = () => card().getByLabel('Volume change');
async function open(bytes) {
  const doc = JSON.parse(bytes);
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D593-preview.bcad', mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
  await button('Chat').first().click();
  return doc;
}
const heights = expected => f.page.waitForFunction(values => {
  const placed = window.__studioInstanceBounds?.();
  return placed?.length === values.length && placed.every((p, i) => Math.abs(p.max[2] - p.min[2] - values[i]) <= 1e-6);
}, expected, { timeout: 12000 });
await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  f.phase = 'compare placed candidate and accepted geometry';
  await f.newPage();
  const pending = await open(await readFile(twinFile));
  await heights([11, 11]);
  await card().getByRole('button', { name: 'Preview', exact: true }).click();
  await card().getByRole('button', { name: 'Hide', exact: true }).waitFor();
  await volume().waitFor();
  await f.same(pending);
  const after = await f.snapshot('01-proposal-after');
  assert.equal(after.volume, '−200 mm³');
  await heights([10, 11]);
  await card().getByRole('button', { name: 'Before or after', exact: true }).click();
  await heights([11, 11]);
  await f.same(pending);
  const before = await f.snapshot('02-proposal-before');
  await card().getByRole('button', { name: 'Before or after', exact: true }).click();
  await heights([10, 11]);
  await card().getByRole('button', { name: 'Hide', exact: true }).click();
  await heights([11, 11]);
  await f.same(pending);
  const hidden = await f.snapshot('03-preview-hidden');
  assert.deepEqual(after.selection, before.selection);
  assert.deepEqual(before.selection, hidden.selection);
  await card().getByRole('button', { name: 'Accept', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.proposals?.[0]?.status === 'accepted');
  await heights([10, 11]);
  const accepted = await f.snapshot('04-accepted');
  assert.deepEqual(accepted.doc.instances.map(inst => inst.doc.parameters.H), [10, 11]);
  assert.equal(accepted.doc.history.at(-1).kind, 'accept');

  f.phase = 'verify the legacy base-only preview control';
  await f.newPage();
  const legacy = await open(await readFile(baseFile));
  await card().getByRole('button', { name: 'Rebase & preview', exact: true }).click();
  await card().getByRole('button', { name: 'Hide', exact: true }).waitFor();
  await f.page.waitForFunction(() => /−200/.test(document.querySelector('[aria-label="Volume change"]')?.textContent ?? ''));
  const base = await f.snapshot('05-base-only');
  assert.deepEqual(base.doc.nodes, legacy.nodes);
  assert.deepEqual(base.doc.parameters, legacy.parameters);
  assert.equal(base.doc.proposals[0].status, 'open');

  f.phase = 'refuse an unsupported placement preview without displaying a zero delta';
  const placement = { ...pending, proposals: pending.proposals.map(p => ({
    ...p, title: 'Move target plate', ops: [{ tool: 'place_part', args: { part: 'p1', position: [5, 0, 0] } }],
  })) };
  await f.newPage();
  await open(Buffer.from(JSON.stringify(placement)));
  await heights([11, 11]);
  await card().getByRole('button', { name: 'Preview', exact: true }).click();
  await card().getByText('Placement changes are outside this preview.', { exact: true }).waitFor();
  assert.equal(await volume().count(), 0);
  await f.same(placement);
  const refused = await f.snapshot('06-placement-unavailable');
  assert.deepEqual(refused.placed, before.placed);
  await f.runOracle({ after, before, hidden, accepted, base }, 'preview-placement-and-volume');
  assert.deepEqual(f.report.downloads, []);
});
