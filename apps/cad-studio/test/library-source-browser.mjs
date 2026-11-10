// D572 / #2361. Run under the heavy gate from apps/cad-studio.
// D572_SOURCE_FROZEN=1 node test/library-source-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { isAbsolute, relative } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(isAbsolute(output) && relative(new URL('../../..', import.meta.url).pathname, output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=fixed'].includes(mode));
const repro = mode === '--expect=repro';
const id = 'fixture-spacers';
const storeKey = 'barocss-cad-user-libraries';
const payload = (name, json) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) });
const manifest = (name, libraryVersion, height, variants) => ({
  format: 'barocss-cad-library', version: 1, id, name, libraryVersion, units: 'mm',
  license: height === 8 ? 'CC0-1.0' : 'MIT',
  parts: [{
    id: 'spacer', name: 'Spacer',
    parameters: { h: { value: height, unit: 'mm', source: 'D572 test fixture' } },
    variants,
    recipe: [
      { id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 },
      { id: 'blank', kind: 'extrude', sketch: 's', height: { expr: 'h' } },
      { id: 'bore', kind: 'hole', target: 'blank', center: [0, 0], radius: 2.65 },
    ],
    outputs: ['bore'],
  }],
});
const a = manifest('D572 Spacers A', '1.0.0', 8, [{ id: 'standard', name: 'Standard 8 mm', values: {} }]);
const b = manifest('D572 Spacers B', '2.0.0', 12, [{ id: 'standard', name: 'Standard 12 mm', values: {} }]);
const c = manifest(a.name, a.libraryVersion, 14, [{ id: 'new-only', name: 'New 14 mm', values: {} }]);
const original = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0,
  libraries: [{ library: a, authoredBy: 'agent', confirmed: false }],
};
const nativeA = payload('D572-embedded-A.bcad', original);
const inspectorSource = `
import { readFileSync } from 'node:fs';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { placedDoc } from '@barocss/cad-model/engine/doc';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const instance = doc.instances?.[0];
const evaluated = evaluateDoc(instance ? placedDoc(instance, doc) : doc, 1);
if (!evaluated.ok) throw new Error(JSON.stringify(evaluated.error));
console.log(JSON.stringify(evaluated.bodies.map(b => ({volume: b.volume, centroid: b.centroid}))));
`;
const oracleSource = String.raw`
import json, math, sys
d = json.load(sys.stdin)
h = d['height']
expected = math.pi * (5**2 - 2.65**2) * h
tol = 1e-6
assert len(d['bodies']) == 1
body = d['bodies'][0]
assert math.isclose(body['volume'], expected, abs_tol=tol, rel_tol=0), (body, expected)
assert len(body['centroid']) == 3
assert all(math.isclose(x, y, abs_tol=tol, rel_tol=0) for x, y in zip(body['centroid'], [0, 0, h/2]))
if d.get('bounds'):
    assert math.isclose(d['bounds']['max'][2] - d['bounds']['min'][2], h, abs_tol=tol, rel_tol=0), d
print(json.dumps({'status': 'PASS', 'height': h, 'expectedVolume': expected, 'volume': body['volume'], 'tolerance': tol}))
`;
const pins = ['apps/cad-studio/test/library-source-browser.mjs', 'apps/cad-studio/src/ui/LibraryPanel.tsx',
  'packages/barocss-cad-model/src/library/libraries.ts'];
const f = await createFlow({
  name: 'library-source', envFrozen: 'D572_SOURCE_FROZEN', output, qualification: 'D572 #2361 desktop',
  initialFiles: pins, requiredFrozen: pins, inspectorSource, oracleSource,
  limits: ['Local library files and exact annular spacer volumes. No team data or external dependencies.'],
});
const button = name => f.page.getByRole('button', { name, exact: true });
const row = () => f.page.getByLabel('Library ' + id, { exact: true });
const variant = () => row().getByLabel('Variant of spacer', { exact: true });
const fromStore = () => f.page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]'), storeKey);

async function open(input) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(input);
  await f.ready();
}
async function addFile(file) {
  await f.page.getByLabel('Library file', { exact: true }).setInputFiles(file);
}
async function show(library, variantId) {
  const part = library.parts[0];
  await row().getByText(library.name, { exact: true }).waitFor();
  await row().getByText(library.libraryVersion, { exact: true }).waitFor();
  await row().getByLabel('Licence of ' + id, { exact: true }).getByText(library.license, { exact: false }).waitFor();
  assert.equal(await variant().inputValue(), variantId);
  assert.equal(await variant().locator('option:checked').textContent(), part.variants.find(v => v.id === variantId).name);
}
async function physical(state, action, height, label) {
  if (action === 'Insert') {
    await f.page.waitForFunction(() => window.__studioBodies().bodies.length === 1 && window.__studioBodies().massReady);
    return f.runOracle({ height, bodies: (await f.bodies()).bodies }, label);
  }
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().some(b => b.id === 'p1' && b.max && b.min));
  const bounds = await f.page.evaluate(() => window.__studioInstanceBounds().find(b => b.id === 'p1'));
  return f.runOracle({ height, bounds, bodies: await f.inspect(label, state) }, label);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
  f.report.fixtureHashes = { documentA: sha256(nativeA.buffer), a: sha256(JSON.stringify(a)),
    b: sha256(JSON.stringify(b)), c: sha256(JSON.stringify(c)) };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/api/chat/libraries') return route.fulfill({ json: { libraries: [] } });
        return route.continue();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };

  for (const [action, file] of [['Insert', b], ['Place', b], ...(!repro ? [['Insert', c]] : [])]) {
    const label = file === c ? 'same-version-insert' : action.toLowerCase();
    f.phase = label + ' load';
    await f.newPage();
    await open(nativeA);
    await f.page.waitForFunction(id => window.__studioDoc.libraries?.[0]?.library.id === id, id);
    const base = await f.doc();
    assert.deepEqual(base, original);
    await button('Library').click();
    await show(a, 'standard');
    await row().getByText('Written by an agent: not confirmed', { exact: true }).waitFor();
    if (file === c) await variant().selectOption('standard');
    await addFile(payload('D572-user-library.json', file));
    const selected = file.parts[0].variants[0].id;
    await show(file, selected);
    const before = await f.snapshot(label + '-selection');
    assert.deepEqual(before.doc, base);
    assert.deepEqual(await fromStore(), [{ library: file, authoredBy: 'person', confirmed: true }]);

    f.phase = label + ' apply';
    await row().getByRole('button', { name: action + ' spacer', exact: true }).click();
    await f.changed(base);
    const after = await f.doc();
    assert.deepEqual(after.libraries, base.libraries);
    const part = action === 'Insert' ? after.nodes : after.instances[0].doc.nodes;
    assert.equal(part.length, 1);
    assert.equal(action === 'Insert' ? (after.instances?.length ?? 0) : after.nodes.length, 0);
    assert.equal(action === 'Place' ? after.instances.length : after.nodes.length, 1);
    const library = part[0].library;
    const expected = repro ? a : file;
    const height = expected.parts[0].parameters.h.value;
    assert.deepEqual([library.library, library.part, library.variant, library.version, library.values.h],
      [id, 'spacer', selected, expected.libraryVersion, height]);
    assert.equal(part[0].features.find(feature => feature.kind === 'extrude').height, height);
    const stored = await fromStore();
    assert.deepEqual(stored, [{ library: expected, authoredBy: repro ? 'agent' : 'person', confirmed: !repro }]);
    const physics = await physical(after, action, height, label);
    f.report.observations.push({ action, selected: file.libraryVersion, selectedHeight: file.parts[0].parameters.h.value,
      applied: library.version, height, volume: physics.volume, storedVersion: stored[0].library.libraryVersion });
    await f.snapshot(label + '-result');

    if (!repro) {
      f.phase = label + ' first Undo and Redo';
      await button('Undo').click();
      await f.same(base);
      await button('Redo').click();
      await f.same(after);
      assert.deepEqual(await fromStore(), stored);
      if (action === 'Place') {
        f.phase = 'save the accepted instance in a browser project';
        await button('Close library').click();
        await f.page.locator('.doc-tab input').fill('D572-placed-spacer');
        await button('Project and versions').click();
        const project = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
        await project.getByRole('textbox', { name: 'Browser project name', exact: true }).fill('D572 library proof');
        await project.getByRole('button', { name: 'Project in this browser', exact: true }).click();
        await project.getByLabel('Project', { exact: true }).waitFor();
        await button('Save').click();
        await project.getByRole('list', { name: 'Project documents', exact: true })
          .getByText('D572-placed-spacer.bcad', { exact: true }).waitFor();
        await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
        const bytes = Buffer.from(await f.page.evaluate(async () => {
          const root = await navigator.storage.getDirectory();
          const projects = await root.getDirectoryHandle('projects');
          const dir = await projects.getDirectoryHandle('D572 library proof');
          const handle = await dir.getFileHandle('D572-placed-spacer.bcad');
          return Array.from(new Uint8Array(await (await handle.getFile()).arrayBuffer()));
        }));
        assert.deepEqual(JSON.parse(bytes), after);
        f.report.files.push({ label: 'placed-spacer-native', hash: sha256(bytes), length: bytes.length });
        f.phase = 'open the saved instance without B in the local store';
        await f.newPage();
        assert.deepEqual(await fromStore(), []);
        await open({ name: 'D572-placed-spacer.bcad', mimeType: 'application/json', buffer: bytes });
        await f.same(JSON.parse(bytes));
        await physical(await f.doc(), action, height, 'place-fresh-open');
        await f.snapshot('place-fresh-open');
      }
    }
  }

  f.report.productResult = repro ? 'FAIL' : 'PASS';
  assert.deepEqual(f.report.downloads, []);
});
