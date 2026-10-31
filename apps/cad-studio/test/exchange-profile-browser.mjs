// D404: Open a native nested assembly and the producer's STEP; no outbound download action.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const input = resolve(process.argv[3] ?? ''); assert.ok(process.argv[3], 'producer output directory required');
const metadata = JSON.parse(await readFile(join(input, 'producer-inputs.json'), 'utf8'));
const productInputs = Object.keys(metadata.inputs).filter(path => path !== 'apps/cad-studio/exchange-profile-producer.ts');
const f = await createFlow({ name: 'exchange-profile', envFrozen: 'EXCHANGE_PROFILE_SOURCE_FROZEN', output: process.argv[2], qualification: 'D404_EXCHANGE_PROFILE_MEASUREMENT',
  initialFiles: ['apps/cad-studio/test/exchange-profile-browser.mjs', 'apps/cad-studio/test/exchange-profile-producer.mjs', 'apps/cad-studio/test/part21-prism-check.py', join(input, 'assembly.bcad'), join(input, 'assembly.step')],
  extraFrozen: productInputs,
  requiredFrozen: ['apps/cad-studio/src/files/importedFile.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts', 'packages/barocss-cad/src/io/step.ts'],
  limits: ['Outbound Export/Save UI is NOT_RUN; STEP bytes came from current-source exportStudioStep in Node.', 'Independent checker covers references and selected prismatic vertex bounds; imported volume is SELF_READ only.', 'One nested prismatic assembly and one WebGPU browser are checked; broad STEP/AP242/other-format acceptance is NOT_RUN.'] });
await f.run(async () => {
  await f.newPage(); f.phase = 'native nested assembly Open'; await f.openFile(join(input, 'assembly.bcad'), 0);
  await f.page.waitForFunction(() => window.__studioDoc?.instances?.map(i => i.id).join(',') === 'loose,sub' && window.__studioInstanceBounds?.()?.length === 2, null, { timeout: 60000 });
  const doc = await f.doc(); assert.deepEqual(doc.instances[1].doc.instances.map(i => i.id), ['a', 'b']);
  assert.deepEqual([doc.instances[0], ...doc.instances[1].doc.instances].map(i => i.part.id), ['shared-prism', 'shared-prism', 'shared-prism']);
  await f.page.getByRole('button', { name: 'Show the parts of Named subassembly', exact: true }).click();
  await f.page.locator('.ol.instance.nested[data-path="sub/a"]').waitFor(); await f.page.locator('.ol.instance.nested[data-path="sub/b"]').waitFor();
  await f.page.getByRole('button', { name: 'Iso', exact: true }).click(); await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.evaluate(() => window.__studioFrameCost(true));
  await f.page.waitForFunction(() => window.__studioFrameCost()['shaded-with-edges']?.bodies.length === 3, null, { timeout: 30000 });
  const nativeCost = await f.page.evaluate(() => window.__studioFrameCost()['shaded-with-edges']);
  f.report.observations.push({ label: 'native-three-occurrences', paths: ['loose', 'sub/a', 'sub/b'], nativeCost }); await f.snapshot('01-native-assembly');
  f.phase = 'STEP Open and explicit loss'; await f.page.setInputFiles('input[aria-label="Model file"]', join(input, 'assembly.step'));
  const toast = await f.waitToast(/STEP opened.*3 solids.*no colours, names or assembly structure/, 60000);
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 1 && window.__studioDoc.nodes[0].kind === 'import' && window.__studioBodies?.()?.bodies.length === 3, null, { timeout: 60000 }); await f.ready();
  const imported = await f.doc(), bodies = await f.bodies();
  assert.equal(imported.instances?.length ?? 0, 0); assert.equal(imported.nodes[0].solids, 3); assert.equal(imported.bodies, undefined);
  assert.ok(Math.abs(bodies.bodies.reduce((sum, b) => sum + b.volume, 0) - 3000) < 1e-5);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  f.report.observations.push({ label: 'STEP-flattened', toast, bodies: bodies.bodies.length, nativeHistoryReplacedBy: imported.nodes.map(n => n.kind), outboundUi: 'NOT_RUN' });
  await f.snapshot('02-step-flattened'); assert.deepEqual(f.report.downloads, []);
});
