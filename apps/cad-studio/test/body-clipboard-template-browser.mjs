// D561 / #2310. Run under the heavy gate from apps/cad-studio.
// D561_SOURCE_FROZEN=1 node test/body-clipboard-template-browser.mjs EXTERNAL_OUTPUT
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const [output] = process.argv.slice(2);
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.equal(process.env.D561_SOURCE_FROZEN, '1');
await mkdir(output);

const fixtures = [
  { suffix: 'A', size: [10, 10, 10], hash: '7dddcf338c7594c8122c6d41c2fe6457cf937104f8b6b8a0217f5f1d26eb1604' },
  { suffix: 'B', size: [12, 13, 14], hash: 'e619317078bab4c90637ee14ed7abbee602a9033c95cd156b700026f71698772' },
];
for (const fixture of fixtures) {
  fixture.path = `apps/cad-studio/handover/notes/project-open-ownership-2026-10-29/consumers/final-first/project-to-B/normal-B-control-native${fixture.suffix}.bcad`;
  const bytes = await readFile(resolve(repo, fixture.path));
  assert.equal(sha256(bytes), fixture.hash);
  fixture.doc = JSON.parse(bytes);
}
const [template, source] = fixtures;

const oracleSource = String.raw`
import json, math, sys
data = json.load(sys.stdin)
w, d, h = data['size']
bodies = sorted(data['bodies'], key=lambda b: b['centroid'][0])
expected = [[w/2 + offset, d/2, h/2] for offset in data['offsets']]
assert len(bodies) == len(expected)
assert len({body['key'] for body in bodies}) == len(bodies)
for body, centroid in zip(bodies, expected):
    assert math.isclose(body['volume'], w*d*h, abs_tol=1e-9, rel_tol=0), body
    assert len(body['centroid']) == 3
    assert all(math.isclose(a, b, abs_tol=1e-9, rel_tol=0) for a, b in zip(body['centroid'], centroid)), (body, centroid)
print(json.dumps({'status': 'PASS', 'centroids': expected, 'volume': w*d*h, 'absoluteTolerance': 1e-9}))
`;

function readBoundary() {
  const bodies = window.__studioBodies().bodies;
  const history = name => {
    const button = document.querySelector(`button[aria-label="${name}"]`);
    return { enabled: !button.disabled, tip: button.getAttribute('data-tip') };
  };
  return {
    selectedKeys: window.__studioSelection.selection.bodies.map(index => bodies[index]?.key),
    undo: history('Undo'),
    redo: history('Redo'),
    fileName: document.querySelector('.doc-tab input')?.value,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  };
}

const requiredFrozen = [
  ...fixtures.map(fixture => fixture.path), relative(repo, import.meta.filename),
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/TemplatePicker.tsx',
  'apps/cad-studio/src/app/templates.ts', 'apps/cad-studio/src/state/workOwnership.ts',
  'packages/barocss-cad-model/src/chat/features.ts',
];
const f = await createFlow({
  name: 'body-clipboard-template', envFrozen: 'D561_SOURCE_FROZEN', output,
  qualification: 'D561 #2310 saved template replacement with the same body key',
  initialFiles: requiredFrozen, requiredFrozen, snapshotExtra: readBoundary, oracleSource,
  limits: [
    'One desktop WebGPU page and one browser-local template created through the Studio UI.',
    'Independent box arithmetic from two retained D326 inputs. No downloads or system clipboard reads.',
  ],
});
const button = name => f.page.getByRole('button', { name, exact: true });
const bodyOracle = (state, fixture, offsets) => f.runOracle({ size: fixture.size, offsets, bodies: state.bodies.bodies }, state.label);

async function open(fixture, phase) {
  f.phase = phase;
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(resolve(repo, fixture.path));
  await f.same(fixture.doc);
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

async function history(action, label, expected) {
  f.phase = label;
  assert.equal(await button(action).isEnabled(), true);
  await button(action).click();
  await f.same(expected);
  return f.snapshot(label);
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
  await open(template, 'open the template source');
  const name = 'D561 ten millimetre box';
  f.phase = 'save the open box as a local template';
  await button('New from a template').click();
  const menu = f.page.getByRole('menu', { name: 'Templates', exact: true });
  await menu.getByRole('textbox', { name: 'Template name', exact: true }).fill(name);
  await menu.getByRole('button', { name: 'Save as a template', exact: true }).click();
  await f.waitToast(/Template saved/);
  await f.snapshot('01-template-saved');

  await open(source, 'open the independent copy source');
  const copied = await copySingle('02-other-box-copied');
  assert.deepEqual(copied.doc, source.doc);
  await bodyOracle(copied, source, [0]);

  f.phase = 'start a new part from the saved local template';
  await button('New from a template').click();
  await menu.getByRole('menuitem', { name: `New from ${name}`, exact: true }).click();
  await f.page.waitForFunction(() => document.querySelector('.doc-tab input')?.value === 'Untitled');
  await f.ready();
  const adopted = await f.snapshot('03-template-adopted');
  assert.deepEqual(adopted.doc, template.doc);
  assert.deepEqual(adopted.bodies.bodies.map(body => body.key), ['b1']);
  await bodyOracle(adopted, template, [0]);

  f.phase = 'try Paste with the previous document clipboard';
  await f.page.keyboard.press('Meta+v');
  const stale = await f.snapshot('04-stale-paste');
  for (const field of ['doc', 'bodies', 'selection', 'selectedKeys', 'history', 'undo', 'redo', 'fileName', 'dirty']) {
    assert.deepEqual(stale[field], adopted[field], `stale Paste preserves ${field}`);
  }
  await history('Undo', '05-undo-restores-copy-source', source.doc);
  await history('Redo', '06-redo-restores-template', adopted.doc);

  const fresh = await copySingle('07-current-body-copied');
  assert.deepEqual(fresh.doc, adopted.doc);
  await f.page.keyboard.press('Meta+v');
  await f.changed(adopted.doc);
  const pasted = await f.snapshot('08-fresh-paste');
  assert.deepEqual(pasted.doc.nodes.at(-1).offset, [20, 0, 0]);
  assert.deepEqual(Object.keys(pasted.doc.outputs).sort(), ['b1', 'b4']);
  assert.deepEqual(pasted.selectedKeys, ['b4']);
  await bodyOracle(pasted, template, [0, 20]);
  assert.deepEqual(f.report.downloads, []);
});
