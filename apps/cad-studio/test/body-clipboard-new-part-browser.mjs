// D560 / #2310. Run under the heavy gate from apps/cad-studio.
// D560_SOURCE_FROZEN=1 node test/body-clipboard-new-part-browser.mjs EXTERNAL_OUTPUT
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const [output] = process.argv.slice(2);
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.equal(process.env.D560_SOURCE_FROZEN, '1');
await mkdir(output);

const fixture = 'apps/cad-studio/handover/notes/project-open-ownership-2026-10-29/consumers/final-first/project-to-B/normal-B-control-nativeB.bcad';
const bytes = await readFile(resolve(repo, fixture));
assert.equal(sha256(bytes), 'e619317078bab4c90637ee14ed7abbee602a9033c95cd156b700026f71698772');
const original = JSON.parse(bytes);

const oracleSource = String.raw`
import json, math, sys
data = json.load(sys.stdin)
w, d, h = data['size']
expected = [[w/2 + offset, d/2, h/2] for offset in data['offsets']]
bodies = sorted(data['bodies'], key=lambda body: body['centroid'][0])
assert len(bodies) == len(expected)
assert len({body['key'] for body in bodies}) == len(bodies)
for body, centroid in zip(bodies, expected):
    assert math.isclose(body['volume'], w*d*h, abs_tol=1e-9, rel_tol=0), body
    assert len(body['centroid']) == 3
    assert all(math.isclose(a, b, abs_tol=1e-9, rel_tol=0) for a, b in zip(body['centroid'], centroid)), (body, centroid)
print(json.dumps({'status': 'PASS', 'centroids': expected, 'volume': w*d*h, 'absoluteTolerance': 1e-9}))
`;

function readBoundary() {
  const selection = window.__studioSelection.selection;
  const bodies = window.__studioBodies().bodies;
  const historyAction = name => {
    const button = document.querySelector(`button[aria-label="${name}"]`);
    return { enabled: !button.disabled, tip: button.getAttribute('data-tip') };
  };
  return {
    selectedKeys: selection.bodies.map(index => bodies[index]?.key),
    undo: historyAction('Undo'),
    redo: historyAction('Redo'),
    fileName: document.querySelector('.doc-tab input')?.value,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  };
}

const requiredFrozen = [
  fixture, relative(repo, import.meta.filename), 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/workOwnership.ts', 'packages/barocss-cad-model/src/chat/features.ts',
  'packages/barocss-cad-model/src/engine/ids.ts',
];
const f = await createFlow({
  name: 'body-clipboard-new-part', envFrozen: 'D560_SOURCE_FROZEN', output,
  qualification: 'D560 #2310 New part with same body key',
  initialFiles: requiredFrozen, requiredFrozen, snapshotExtra: readBoundary, oracleSource,
  limits: [
    'One desktop WebGPU page, one retained box, and one box authored using the Studio Box command.',
    'Observe Studio clipboard behavior through real shortcuts and history. No OS clipboard reads or downloads.',
  ],
});

const button = name => f.page.getByRole('button', { name, exact: true });
const boxSize = [8, 9, 11];
const bodyOracle = (state, size, offsets) => f.runOracle({ size, offsets, bodies: state.bodies.bodies }, state.label);

async function history(action, label, expected) {
  f.phase = label;
  assert.equal(await button(action).isEnabled(), true);
  await button(action).click();
  await f.same(expected);
  return f.snapshot(label);
}

async function copySingle(label) {
  f.phase = label;
  const copied = f.page.locator('.toast[role="alert"]').filter({ has: f.page.getByText('Copied', { exact: true }) });
  if (await copied.isVisible()) await copied.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await f.page.getByRole('complementary', { name: 'Browser', exact: true })
    .locator('.ol-row > button.ol[title="Double-click to rename"]').click();
  await f.page.keyboard.press('Meta+c');
  await f.waitToast(/Copied/);
  const state = await f.snapshot(label);
  assert.deepEqual(state.selectedKeys, ['b1']);
  return state;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
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
  f.phase = 'open retained source in Studio';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(resolve(repo, fixture));
  await f.same(original);
  const copied = await copySingle('01-original-copied');
  assert.deepEqual(copied.doc, original);
  await bodyOracle(copied, [12, 13, 14], [0]);

  f.phase = '02 New part accepts empty document';
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.snapshot('02-new-empty');
  assert.deepEqual(empty.bodies.bodies, []);
  assert.equal(empty.fileName, 'Untitled');

  f.phase = '03 author distinct box with the same local body key';
  await f.page.keyboard.press('b');
  const hud = f.page.locator('.hud');
  await hud.waitFor();
  for (const [label, value] of ['Width X', 'Depth Y', 'Height Z'].map((label, axis) => [label, boxSize[axis]])) {
    await hud.locator('.field', { has: f.page.locator(`span:text-is("${label}")`) }).locator('input').fill(String(value));
  }
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview');
  await hud.getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(empty.doc);
  const created = await f.snapshot('03-new-box-b1');
  assert.deepEqual(Object.keys(created.doc.outputs), ['b1']);
  assert.equal(created.bodies.bodies[0]?.key, 'b1');
  assert.notDeepEqual(created.doc, original);
  await bodyOracle(created, boxSize, [0]);

  f.phase = '04 try stale Paste on the new b1';
  await f.page.keyboard.press('Meta+v');
  const stale = await f.snapshot('04-stale-paste');
  for (const field of ['doc', 'bodies', 'selection', 'selectedKeys', 'history', 'undo', 'redo', 'fileName', 'dirty']) {
    assert.deepEqual(stale[field], created[field], `stale Paste preserves ${field}`);
  }

  await history('Undo', '05-first-undo-removes-box', empty.doc);
  await history('Undo', '06-second-undo-restores-original', original);
  await history('Redo', '07-first-redo-restores-new-empty', empty.doc);
  await history('Redo', '08-second-redo-restores-new-box', created.doc);

  const fresh = await copySingle('09-new-body-copied');
  assert.deepEqual(fresh.doc, created.doc);
  await f.page.keyboard.press('Meta+v');
  await f.changed(created.doc);
  const pasted = await f.snapshot('10-fresh-paste');
  assert.deepEqual(pasted.doc.nodes.at(-1).offset, [18, 0, 0]);
  assert.deepEqual(Object.keys(pasted.doc.outputs).sort(), ['b1', 'b4']);
  assert.deepEqual(pasted.selectedKeys, ['b4']);
  await bodyOracle(pasted, boxSize, [0, 18]);
  await history('Undo', '11-undo-fresh-paste', created.doc);
  await history('Redo', '12-redo-fresh-paste', pasted.doc);
  assert.deepEqual(f.report.downloads, []);
});
