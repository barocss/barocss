// D419: bounded analytic OFFSET_SURFACE STEP Open and atomic refusal; no outbound file action.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createFlow, sha256 } from './flow-helper.mjs';
import { offsetInspectorSource } from './step-offset-producer.mjs';

assert.ok(process.argv[2] && process.argv[3], 'Output and prepared fixture folders are required');
const input = resolve(process.argv[3]);
const source = Object.fromEntries(await Promise.all(['plane-mm', 'cylinder-cm', 'mismatch'].map(async name => [name, await readFile(join(input, `${name}.step`), 'utf8')])));
const oracleInput = JSON.parse(await readFile(join(input, 'oracle-input.json'), 'utf8'));
const refusal = process.env.STEP_OFFSET_REFUSAL;
assert.ok(refusal, 'Exact expected D419 boundary refusal substring is required');
const f = await createFlow({
  name: 'step-offset', envFrozen: 'STEP_OFFSET_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'D419_BOUNDED_ANALYTIC_OFFSET_STEP_IMPORT', inspectorSource: offsetInspectorSource,
  initialFiles: [
    'apps/cad-studio/test/step-offset-browser.mjs', 'apps/cad-studio/test/step-offset-producer.mjs',
    'apps/cad-studio/test/step-offset-oracle.py', 'apps/cad-studio/test/part21-prism-check.py',
    'packages/barocss-cad/test/step-offset-fixtures.mjs',
    ...['plane-mm.step', 'cylinder-cm.step', 'mismatch.step', 'oracle-input.json', 'mismatch-result.json'].map(name => join(input, name)),
  ],
  requiredFrozen: ['apps/cad-studio/src/files/importedFile.ts', 'packages/barocss-cad/src/io/step-import.ts', 'packages/barocss-cad/src/io/step-offset-internal.ts'],
  limits: [
    'Two High-defined analytic closed-solid OFFSET profiles and one nonbinding cylinder-boundary refusal; no general offset or whole STEP acceptance.',
    'Scalar volume comparison requires both 1e-5 mm³ absolute and 1e-9 relative; selected support sampling stays 1e-7 mm. Native inspector is a product observation. Python independently samples complete selected rational support nets; untrimmed support coverage is separate from physical trimmed-body bounds. This is not an external reader or global surface/solid certificate.',
    'Plane mm and cylinder cm use the existing file-level unit adapter. Exact source remains stored; one scale node converts cylinder source coordinates to mm.',
    'No Save, outbound export/download, OCP, paid call or broad native editing/Undo acceptance.',
  ],
});
const observed = [];
async function accepted(name, kind, label) {
  await f.page.setInputFiles('input[aria-label="Model file"]', join(input, `${name}.step`));
  const success = kind === 'plane' ? /STEP opened.*1 solid.*millimetres/ : /STEP opened.*1 solid.*centimetres.*scaled ×10/;
  const toast = await f.waitToast(success, 60000);
  const count = kind === 'plane' ? 1 : 2;
  await f.page.waitForFunction(({ step, count }) => window.__studioDoc?.nodes?.length === count &&
    window.__studioDoc.nodes[0].kind === 'import' && window.__studioDoc.nodes[0].step === step &&
    window.__studioBodies?.()?.bodies.length === 1, { step: source[name], count }, { timeout: 60000 });
  await f.ready();
  const doc = await f.doc();
  assert.equal(doc.nodes[0].step, source[name]);
  if (kind === 'cylinder') {
    assert.match(toast, /centimetres.*scaled ×10/);
    assert.deepEqual(doc.nodes[1], { id: 'n1', kind: 'scale', parent: { node: 0, side: 'solid' }, factor: 10, pivot: [0, 0, 0] });
  }
  const observation = await f.inspect(label, doc, kind);
  observed.push({ ...observation, name, step: source[name], selfIntersect: 'F' });
  await f.same(doc);
  await f.page.getByRole('button', { name: 'Iso', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  f.report.observations.push({ label, exactStoredImportText: true, inputSha256: sha256(source[name]), toast, inspector: observation });
  await f.snapshot(label);
  return doc;
}
await f.run(async () => {
  const fonts = { stylesheets: 0, assets: 0 };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await context.route('https://fonts.googleapis.com/**', route => { fonts.stylesheets++; return route.fulfill({ status: 200, contentType: 'text/css', body: '' }); });
    await context.route('https://fonts.gstatic.com/**', route => { fonts.assets++; return route.fulfill({ status: 204, body: '' }); });
    return context;
  };
  try { await f.newPage(); } finally { f.browser.newContext = newContext; }
  f.phase = 'Open analytic plane offset in mm';
  await accepted('plane-mm', 'plane', '01-plane-offset-mm');
  f.phase = 'Open analytic cylinder offset in cm with existing scale node';
  const current = await accepted('cylinder-cm', 'cylinder', '02-cylinder-offset-cm');
  f.phase = 'Refuse offset cylinder whose authored rims do not bind the offset support';
  await f.page.setInputFiles('input[aria-label="Model file"]', join(input, 'mismatch.step'));
  const toast = await f.waitToast(/Could not open this file/, 60000);
  assert.ok(toast.includes(refusal), toast);
  assert.match(toast, /OFFSET_SURFACE edge.*is separated from its surface/);
  assert.doesNotMatch(toast, /unexpected kernel failure/i);
  await f.same(current);
  const bodies = await f.bodies();
  const volumeError = Math.abs(bodies.bodies[0].volume - 1440 * Math.PI);
  assert.ok(volumeError <= 1e-5 && volumeError / (1440 * Math.PI) <= 1e-9);
  f.report.observations.push({ label: '03-nonbinding-refused', refusal: toast, exactPriorDocumentRetained: true });
  await f.snapshot('03-nonbinding-refused-cylinder-retained');

  f.phase = 'Independently sample actual accepted native supports';
  const combined = { cases: oracleInput.cases.map(prepared => observed.find(actual => actual.name === prepared.name) ?? prepared) };
  await writeFile(join(f.output, 'actual-native-oracle-input.json'), JSON.stringify(combined, null, 2));
  const oracle = spawnSync('python3', ['-I', resolve(import.meta.dirname, 'step-offset-oracle.py')], { input: JSON.stringify(combined), encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 });
  await writeFile(join(f.output, 'actual-native-oracle.json'), oracle.stdout ?? '');
  await writeFile(join(f.output, 'actual-native-oracle.stderr.txt'), oracle.stderr ?? '');
  assert.equal(oracle.status, 0, oracle.stdout + oracle.stderr);
  const result = JSON.parse(oracle.stdout);
  assert.equal(result.status, 'PASS');
  f.report.oracles.push({ label: 'two actual native supports plus three prepared advisory controls', result });
  f.report.fontNetwork = fonts;
  assert.equal(fonts.assets, 0);
  assert.equal(f.report.downloads.length, 0);
});
