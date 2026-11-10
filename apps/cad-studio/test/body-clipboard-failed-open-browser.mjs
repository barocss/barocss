// D559 / #2310. Run under the heavy gate from apps/cad-studio.
// D559_SOURCE_FROZEN=1 node test/body-clipboard-failed-open-browser.mjs EXTERNAL_OUTPUT
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const [output] = process.argv.slice(2);
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.equal(process.env.D559_SOURCE_FROZEN, '1');
await mkdir(output);

const fixture = 'apps/cad-studio/handover/notes/project-open-ownership-2026-10-29/consumers/final-first/project-to-B/normal-B-control-nativeB.bcad';
const fixtureBytes = await readFile(resolve(repo, fixture));
assert.equal(sha256(fixtureBytes), 'e619317078bab4c90637ee14ed7abbee602a9033c95cd156b700026f71698772');
const original = JSON.parse(fixtureBytes);

const oracleSource = String.raw`
import json, math, sys
data = json.load(sys.stdin)
expected = [[6 + offset, 6.5, 7] for offset in data['offsets']]
bodies = sorted(data['bodies'], key=lambda body: body['centroid'][0])
assert len(bodies) == len(expected)
assert len({body['key'] for body in bodies}) == len(bodies)
for body, centroid in zip(bodies, expected):
    assert math.isclose(body['volume'], 12*13*14, abs_tol=1e-9, rel_tol=0), body
    assert len(body['centroid']) == 3
    assert all(math.isclose(a, b, abs_tol=1e-9, rel_tol=0) for a, b in zip(body['centroid'], centroid)), (body, centroid)
print(json.dumps({'status': 'PASS', 'centroids': expected, 'volume': 2184, 'absoluteTolerance': 1e-9}))
`;

function readBoundary() {
  const bodies = window.__studioBodies().bodies;
  const historyAction = name => {
    const button = document.querySelector(`button[aria-label="${name}"]`);
    return { enabled: !button.disabled, tip: button.getAttribute('data-tip') };
  };
  return {
    selectedKeys: window.__studioSelection.selection.bodies.map(index => bodies[index]?.key),
    undo: historyAction('Undo'),
    redo: historyAction('Redo'),
    fileName: document.querySelector('.doc-tab input')?.value,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  };
}

const requiredFrozen = [
  fixture, relative(repo, import.meta.filename),
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/state/workOwnership.ts',
  'packages/barocss-cad-model/src/chat/features.ts',
  'packages/barocss-cad-model/src/engine/container.ts',
  'packages/barocss-cad-model/src/engine/migrate.ts',
];
const f = await createFlow({
  name: 'body-clipboard-failed-open', envFrozen: 'D559_SOURCE_FROZEN', output,
  qualification: 'D559 #2310 failed native Open preserves body clipboard and both history stacks',
  initialFiles: requiredFrozen, requiredFrozen, snapshotExtra: readBoundary, oracleSource,
  limits: [
    'One desktop WebGPU context and one retained native box. Use public Open, Copy, Paste, Undo and Redo.',
    'Malformed JSON and valid JSON with an unsupported schema. Both failures use the native .bcad entry point.',
    'Clipboard state is inferred from public Paste and independently checked body geometry.',
  ],
});

const button = name => f.page.getByRole('button', { name, exact: true });
const checkBodies = (state, offsets) => f.runOracle({ offsets, bodies: state.bodies.bodies }, state.label);

async function chooseFile(file) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(file);
}

async function history(action, label, expected) {
  f.phase = label;
  assert.equal(await button(action).isEnabled(), true, `${action} is available`);
  await button(action).click();
  await f.same(expected);
  return f.snapshot(label);
}

async function refuse(name, source, reason, label, before) {
  f.phase = label;
  const buffer = Buffer.from(source);
  await chooseFile({ name, mimeType: 'application/json', buffer });
  const notice = await f.waitToast(reason);
  assert.match(notice, /Could not open this file/);
  assert.match(notice, /Your part is unchanged/);
  const after = await f.snapshot(label);
  for (const field of ['doc', 'bodies', 'selection', 'selectedKeys', 'undo', 'redo', 'history', 'fileName', 'dirty']) {
    assert.deepEqual(after[field], before[field], `${label} preserves ${field}`);
  }
  f.report.observations.push({ label, inputSha256: sha256(buffer), notice });
  return after;
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

  f.phase = '01 open retained box and copy b1';
  await f.newPage();
  await chooseFile(resolve(repo, fixture));
  await f.same(original);
  await f.page.getByRole('complementary', { name: 'Browser', exact: true })
    .locator('.ol-row > button.ol[title="Double-click to rename"]').click();
  await f.page.keyboard.press('Meta+c');
  await f.waitToast(/Copied/);
  const copied = await f.snapshot('01-copied-b1');
  assert.deepEqual(copied.selectedKeys, ['b1']);
  await checkBodies(copied, [0]);

  f.phase = '02 first accepted Paste';
  await f.page.keyboard.press('Meta+v');
  await f.changed(original);
  const first = await f.snapshot('02-first-paste');
  assert.deepEqual(first.doc.nodes.at(-1).offset, [22, 0, 0]);
  assert.deepEqual(first.selectedKeys, ['b4']);
  await checkBodies(first, [0, 22]);

  f.phase = '03 nudge the first copy to prepare a redo entry';
  const nudgedDoc = structuredClone(first.doc);
  assert.equal(nudgedDoc.nodes.at(-1).kind, 'translate');
  nudgedDoc.nodes.at(-1).offset[0] = 23;
  await f.page.keyboard.press('ArrowRight');
  await f.same(nudgedDoc);
  const nudged = await f.snapshot('03-nudged-copy');
  await checkBodies(nudged, [0, 23]);

  const before = await history('Undo', '04-before-failed-opens', first.doc);
  assert.equal(before.undo.enabled, true);
  assert.equal(before.redo.enabled, true);
  assert.deepEqual(before.selectedKeys, ['b4']);
  await refuse('Broken.bcad', '{', /it is not JSON/, '05-malformed-refused', before);
  await refuse('Newer.bcad', JSON.stringify({ ...original, schema: 5 }), /saved by a newer cad-studio \(schema 5/, '06-newer-schema-refused', before);

  await history('Redo', '07-redo-restores-nudge', nudgedDoc);
  await history('Undo', '08-undo-restores-first-paste', first.doc);
  await history('Undo', '09-undo-restores-original', original);
  const replay = await history('Redo', '10-redo-restores-first-paste', first.doc);
  assert.equal(replay.redo.enabled, true);

  f.phase = '11 next Paste retains clipboard and offset';
  await f.page.keyboard.press('Meta+v');
  await f.changed(first.doc);
  const next = await f.snapshot('11-next-paste');
  assert.deepEqual(next.doc.nodes.slice(0, first.doc.nodes.length), first.doc.nodes);
  assert.deepEqual(Object.keys(next.doc.outputs).sort(), ['b1', 'b4', 'b7']);
  assert.deepEqual(next.selectedKeys, ['b7']);
  assert.deepEqual(next.doc.nodes.at(-1).offset, [44, 0, 0]);
  assert.equal(next.redo.enabled, false);
  await checkBodies(next, [0, 22, 44]);
  await history('Undo', '12-undo-removes-next-paste', first.doc);
  await history('Redo', '13-redo-restores-next-paste', next.doc);
  assert.deepEqual(f.report.downloads, []);
});
