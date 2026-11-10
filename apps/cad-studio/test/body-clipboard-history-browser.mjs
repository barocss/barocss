// D556 / #2310. Root runs under the heavy gate from apps/cad-studio.
// D556_SOURCE_FROZEN=1 node test/body-clipboard-history-browser.mjs NEW_ABSOLUTE_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const [output, option] = process.argv.slice(2);
const mode = option?.match(/^--expect=(repro|fixed)$/)?.[1];
assert.ok(mode, 'Pass --expect=repro or --expect=fixed');
assert.equal(process.env.D556_SOURCE_FROZEN, '1');
assert.ok(output && isAbsolute(output) && relative(repo, resolve(output)).startsWith('../'));
await mkdir(output);

const fixtureDir = 'apps/cad-studio/handover/notes/project-open-ownership-2026-10-29/consumers/final-first/project-to-B';
const fixtureHashes = {
  A: '7dddcf338c7594c8122c6d41c2fe6457cf937104f8b6b8a0217f5f1d26eb1604',
  B: 'e619317078bab4c90637ee14ed7abbee602a9033c95cd156b700026f71698772',
};
const fixtures = {};
for (const [key, sha] of Object.entries(fixtureHashes)) {
  const path = resolve(repo, fixtureDir, `normal-B-control-native${key}.bcad`);
  const bytes = await readFile(path);
  assert.equal(sha256(bytes), sha, path);
  fixtures[key] = { path, sha256: sha, doc: JSON.parse(bytes) };
  assert.deepEqual(Object.keys(fixtures[key].doc.outputs), ['b1']);
}

const oracleSource = String.raw`
import json, math, sys

# Independent rectangular-solid arithmetic. Dimensions come from the frozen case.
sizes = {'A': (10, 10, 10), 'B': (12, 13, 14)}
x = json.load(sys.stdin)
w, d, h = sizes[x['box']]
tolerance = 1e-9
actual = sorted(x['bodies'], key=lambda b: b['centroid'][0])
assert len(actual) == len(x['offsets']), (x['box'], actual, x['offsets'])
assert len({b['key'] for b in actual}) == len(actual), actual
assert actual[0]['key'] == 'b1', actual
expected = []
for body, dx in zip(actual, x['offsets']):
    volume = w * d * h
    centroid = [w / 2 + dx, d / 2, h / 2]
    assert math.isclose(body['volume'], volume, abs_tol=tolerance, rel_tol=0), (body, volume)
    assert len(body['centroid']) == 3, body
    assert all(math.isclose(v, c, abs_tol=tolerance, rel_tol=0) for v, c in zip(body['centroid'], centroid)), (body, centroid)
    expected.append({'key': body['key'], 'offsetX': dx, 'volumeMM3': volume, 'centroidMM': centroid})
print(json.dumps({'status': 'PASS', 'box': x['box'], 'expected': expected, 'actual': actual,
                  'absoluteTolerance': tolerance, 'productImports': 0}))
`;

function readUI() {
  const worker = window.__studioBodies();
  const selection = window.__studioSelection;
  const focus = document.activeElement;
  return {
    documentJSON: JSON.stringify(window.__studioDoc),
    rootFresh: window.__studioFresh,
    fileName: document.querySelector('.doc-tab input')?.value,
    selectedKeys: (selection?.selection.bodies ?? []).map(index => worker.bodies[index]?.key ?? null),
    focus: {
      tag: focus?.tagName, label: focus?.getAttribute('aria-label'), text: focus?.textContent?.trim().slice(0, 100),
      typing: !!focus?.matches('input, select, textarea, [contenteditable="true"]'),
    },
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    undoEnabled: document.querySelector('button[aria-label="Undo"]')?.disabled === false,
    redoEnabled: document.querySelector('button[aria-label="Redo"]')?.disabled === false,
  };
}

const f = await createFlow({
  name: 'body-clipboard-history', envFrozen: 'D556_SOURCE_FROZEN', output,
  qualification: `D556 #2310 body clipboard across Open history (${mode})`,
  oracleSource, snapshotExtra: readUI,
  initialFiles: [
    import.meta.filename, ...Object.values(fixtures).map(fixture => fixture.path),
    'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/BodyBrowserRows.tsx',
    'apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
    'packages/barocss-cad-model/src/chat/features.ts', 'packages/barocss-cad-model/src/engine/doc.ts',
    'packages/barocss-cad-model/src/engine/evaluate.ts', 'packages/barocss-cad-model/src/engine/part.ts',
  ],
  requiredFrozen: ['apps/cad-studio/src/App.tsx', 'packages/barocss-cad-model/src/chat/features.ts'],
  limits: [
    'One desktop context and two exact D326 native files. Both files use b1.',
    'Independent arithmetic checks reported Worker volume and centroid for the two boxes and the admitted X offsets.',
    'Public Open, Undo, Redo and body clipboard actions. No downloads, OS clipboard, other replacement routes or general geometry claim.',
  ],
});
f.report.mode = mode;
f.report.productResult = 'NOT_ADJUDICATED';
f.report.fixtures = fixtures;
f.report.networkEvents = [];
f.report.keyActions = [];

function button(name) {
  return f.page.getByRole('button', { name, exact: true });
}

async function capture(label) {
  f.phase = label;
  // Public key handlers dispatch synchronously. Let React paint that dispatch before checking Worker readiness.
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await f.ready();
  const state = await f.snapshot(label);
  assert.equal(state.rootFresh, true);
  assert.equal(state.bodies.fresh, true);
  assert.equal(state.bodies.massReady, true);
  assert.deepEqual(JSON.parse(state.documentJSON), state.doc);
  return state;
}

async function press(key) {
  const state = await f.page.evaluate(readUI);
  f.report.keyActions.push({ phase: f.phase, key, focus: state.focus, selectedKeys: state.selectedKeys });
  await f.persist();
  assert.equal(state.focus.typing, false, `${key} must reach the Studio body shortcut`);
  await f.page.keyboard.press(key);
}

async function open(key, label) {
  f.phase = label;
  const file = fixtures[key].path;
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(file);
  await f.page.waitForFunction(name => document.querySelector('.doc-tab input')?.value === name, basename(file, '.bcad'), { timeout: 60000 });
  const actual = await capture(label);
  assert.deepEqual(actual.doc, fixtures[key].doc);
  assert.equal(actual.dirty, false);
  await qualify(actual, key, [0]);
  return actual;
}

async function qualify(state, box, offsets) {
  return f.runOracle({ box, offsets, bodies: state.bodies.bodies }, state.label);
}

async function copyB1(label, before) {
  f.phase = label;
  const priorCopied = f.page.locator('.toast[role="alert"]').filter({ has: f.page.getByText('Copied', { exact: true }) });
  if (await priorCopied.isVisible()) await priorCopied.getByRole('button', { name: 'Dismiss', exact: true }).click();
  const row = f.page.getByRole('complementary', { name: 'Browser', exact: true })
    .locator('.ol-row > button.ol[title="Double-click to rename"]');
  await row.click();
  await f.page.waitForFunction(() => {
    const selected = window.__studioSelection?.selection.bodies;
    return selected?.length === 1 && window.__studioBodies()?.bodies[selected[0]]?.key === 'b1';
  });
  await press('Meta+c');
  await f.page.locator('.toast-title').filter({ hasText: /^Copied$/ }).waitFor();
  const copied = await capture(label);
  assert.equal(copied.documentJSON, before.documentJSON);
  assert.deepEqual(copied.selectedKeys, ['b1']);
  assert.equal(copied.dirty, before.dirty);
  return copied;
}

function requireCopies(state, box, count) {
  const original = fixtures[box].doc;
  assert.deepEqual(state.doc.nodes.slice(0, original.nodes.length), original.nodes);
  assert.deepEqual(state.doc.outputs.b1, original.outputs.b1);
  assert.equal(Object.keys(state.doc.outputs).length, count + 1);
  assert.deepEqual(Object.keys(state.doc.outputs).sort(), state.bodies.bodies.map(body => body.key).sort());
  assert.equal(state.dirty, true);
}

async function installOfflineContext() {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block' });
    try {
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const type = request.resourceType();
        if (type === 'font' || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
          f.report.networkEvents.push({ url: url.href, action: 'FONT_FULFILLED_EMPTY' });
          await route.fulfill({ status: 200, contentType: type === 'font' ? 'font/woff2' : 'text/css', body: '' });
        } else if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
          f.report.networkEvents.push({ url: url.href, action: 'NONLOCAL_HTTP_ABORTED' });
          await route.abort();
        } else {
          await route.continue();
        }
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };
}

function requireUnchanged(actual, before) {
  assert.equal(actual.documentJSON, before.documentJSON, 'Stale Paste must retain the exact document');
  assert.deepEqual(actual.bodies, before.bodies, 'Stale Paste must retain Worker bodies and mass');
  assert.deepEqual(actual.selection, before.selection, 'Stale Paste must retain selection');
  assert.equal(actual.dirty, before.dirty, 'Stale Paste must retain dirty state');
  assert.equal(actual.undoEnabled, before.undoEnabled);
  assert.equal(actual.redoEnabled, before.redoEnabled);
}

async function history(action, label, expected) {
  f.phase = label;
  await button(action).click();
  const actual = await capture(label);
  assert.equal(actual.documentJSON, expected.documentJSON);
  return actual;
}

async function paste(label) {
  f.phase = label;
  await press('Meta+v');
  return capture(label);
}

await f.run(async () => {
  await installOfflineContext();
  for (const fixture of Object.values(fixtures)) assert.equal(f.report.sourceFrozen[relative(repo, fixture.path)], fixture.sha256);
  await f.newPage();

  const startup = await capture('00-startup-before-open');
  assert.equal(await button('Undo').isEnabled(), false);

  const a = await open('A', '01-public-open-A');
  const b = await open('B', '02-public-open-B');
  await copyB1('03-public-copy-B-b1', b);
  const aFromUndo = await history('Undo', '04-undo-B-open-to-A', a);
  await qualify(aFromUndo, 'A', [0]);

  const after = await paste('05-first-stale-paste-in-A');
  const changed = after.documentJSON !== aFromUndo.documentJSON;
  if (changed) {
    f.report.firstProductFailure = {
      phase: after.label, productResult: 'FAIL', expected: 'Exact A with one original body after stale Paste',
      before: aFromUndo.label + '.json', after: after.label + '.json',
    };
    f.report.productResult = 'FAIL';
    await f.persist();
  }

  if (mode === 'repro') {
    assert.ok(changed, 'The predicted stale Paste mutation must actually occur');
    requireCopies(after, 'A', 1);
    await qualify(after, 'A', [0, 20]);
    f.report.firstProductFailure.actual = 'Stale B clipboard duplicated the current A body, including its A volume and centroid shifted 20 mm';
    const undo = await history('Undo', '06-first-undo-after-stale-paste', aFromUndo);
    await qualify(undo, 'A', [0]);
    assert.deepEqual(f.report.downloads, []);
    f.report.characterization = 'PASS_REPRODUCED_PRODUCT_FAILURE_AND_FIRST_UNDO_RESTORED_A';
    return;
  }

  requireUnchanged(after, aFromUndo);
  await qualify(after, 'A', [0]);
  const undo = await history('Undo', '06-first-undo-after-stale-paste', startup);
  assert.deepEqual(undo.bodies, startup.bodies);
  assert.equal(await button('Undo').isEnabled(), false);

  const redoA = await history('Redo', '07-redo-A-open', a);
  await qualify(redoA, 'A', [0]);
  await copyB1('08-public-copy-A-b1', redoA);
  const redoB = await history('Redo', '09-redo-B-open-from-A', b);
  await qualify(redoB, 'B', [0]);
  const afterRedo = await paste('10-first-stale-paste-in-B');
  requireUnchanged(afterRedo, redoB);
  await qualify(afterRedo, 'B', [0]);

  await copyB1('11-fresh-copy-B-b1', afterRedo);
  const first = await paste('12-current-B-first-paste');
  requireCopies(first, 'B', 1);
  await qualify(first, 'B', [0, 22]);
  const sameDocumentUndo = await history('Undo', '13-undo-first-B-paste', redoB);
  await qualify(sameDocumentUndo, 'B', [0]);
  const sameDocumentRedo = await history('Redo', '14-redo-first-B-paste', first);
  await qualify(sameDocumentRedo, 'B', [0, 22]);
  const second = await paste('15-current-B-second-paste');
  requireCopies(second, 'B', 2);
  await qualify(second, 'B', [0, 22, 44]);

  assert.deepEqual(f.report.downloads, []);
  f.report.productResult = 'PASS';
  f.report.characterization = 'PASS_STALE_PASTE_REFUSED_ACROSS_OPEN_HISTORY_AND_REPEATED_PASTE_SURVIVES_SAME_DOCUMENT_HISTORY';
});
