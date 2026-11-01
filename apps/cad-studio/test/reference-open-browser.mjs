// D399/D400: real Open recovery and missing-edge hint, without downloads. All native fixtures and evidence stay in output.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const hintOnly = process.env.REFERENCE_OPEN_HINT_ONLY === '1';
const inspectorSource = `import { referenceOpenFixtures } from './test/reference-open-fixture';
console.log(JSON.stringify(referenceOpenFixtures()));`;
const f = await createFlow({ name: 'reference-open', envFrozen: 'REFERENCE_OPEN_SOURCE_FROZEN', output: process.argv[2], qualification: hintOnly ? 'D400_MISSING_EDGE_HINT' : 'D399_REFERENCE_OPEN', inspectorSource,
  initialFiles: ['apps/cad-studio/test/reference-open-browser.mjs', 'apps/cad-studio/test/document-file.test.ts', 'apps/cad-studio/test/reference-open-fixture.ts', 'apps/cad-studio/src/files/documentFile.ts'],
  requiredFrozen: ['apps/cad-studio/src/files/documentFile.ts', 'packages/barocss-cad-model/src/engine/references.ts', 'packages/barocss-cad-model/src/engine/errors.ts'],
  limits: ['No Save, export, or download is run.', 'Real Open is checked for a signed band reference; broad feature compatibility is not assessed.', 'Stale completion and failed repair admission are checked by focused helper tests.'] });
await f.run(async () => {
  const docs = await f.inspect('fixtures', {}), files = {};
  for (const [name, doc] of Object.entries(docs)) { files[name] = join(f.output, `${name}.bcad`); await writeFile(files[name], JSON.stringify(doc)); }
  if (!hintOnly) {
    await f.newPage(); f.phase = 'valid Open'; await f.openFile(files.valid, 5);
    const valid = await f.doc(); assert.equal((await f.bodies()).bodies.length, 3); assert.equal(valid.nodes[4].suppressed, undefined); await f.snapshot('01-valid');
  }
  for (const name of hintOnly ? ['lost'] : ['lost', 'renamed', 'moved']) {
    f.phase = `${name} Open`; await f.newPage();
    await f.page.setInputFiles('input[aria-label="Model file"]', files[name]);
    await f.page.waitForFunction(() => window.__studioDoc?.nodes?.[4]?.suppressed === true, null, { timeout: 60000 }); await f.ready();
    const held = await f.doc(), node = held.nodes[4];
    assert.deepEqual(node.a.edges, docs[name].nodes[4].a.edges); assert.deepEqual(node.b.edges, docs[name].nodes[4].b.edges);
    assert.ok(node.held); assert.equal((await f.bodies()).bodies.length, 2);
    const references = f.page.getByRole('region', { name: 'References', exact: true }); await references.waitFor();
    assert.match(await references.textContent(), /Feature held/);
    if (hintOnly) {
      const toast = await f.waitToast(/The selected edge no longer exists/);
      assert.ok(toast.includes('Select the edge again and re-apply the feature.')); assert.ok(!toast.includes('chamfer or fillet')); assert.ok(toast.includes('[BAND_EDGE_LOST]'));
      f.report.observations.push({ label: 'missing-edge-hint', toast });
    }
    const state = await f.snapshot(`02-${name}-held`); f.report.observations.push({ name, held: node.held, referencePanel: await references.textContent(), sourceNamesUnchanged: true });
    if (hintOnly) continue;
    // Reopen the in-memory accepted document as a prewritten native fixture, in a fresh context.
    const file = join(f.output, `${name}-held.bcad`); await writeFile(file, JSON.stringify(held));
    await f.freshOpen(file, state.doc, `03-${name}-reopened`); assert.equal((await f.bodies()).bodies.length, 2);
  }
  if (!hintOnly) {
    f.phase = 'unrelated refusal'; await f.newPage(); await f.page.setInputFiles('input[aria-label="Model file"]', files.unrelated);
    const toast = await f.waitToast(/Sizes must be greater than zero/, 60000); const doc = await f.doc();
    assert.equal(doc.nodes.length, 4); assert.equal(doc.nodes[1].height, 0); assert.ok(doc.nodes.every(n => !n.suppressed && !n.held));
    f.report.observations.push({ label: 'unrelated-refusal', toast }); await f.snapshot('04-unrelated-refusal');
  }
  assert.deepEqual(f.report.downloads, []);
});
