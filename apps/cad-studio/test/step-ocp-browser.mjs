// D405 reverse check: locally generated OCP box STEP into actual Studio. No downloads.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

assert.ok(process.argv[3] && process.argv[4], 'OCP STEP and importer-probe output required');
const file = resolve(process.argv[3]), input = resolve(process.argv[4]), text = await readFile(file, 'utf8');
const result = JSON.parse(await readFile(join(input, 'import.stdout.json'), 'utf8')); assert.equal(result.status, 'PASS');
const metadata = JSON.parse(await readFile(join(input, 'import-inputs.json'), 'utf8'));
const productInputs = Object.keys(metadata.inputs).filter(path => path !== 'apps/cad-studio/step-ocp-import.ts');
const f = await createFlow({ name: 'step-ocp', envFrozen: 'STEP_OCP_SOURCE_FROZEN', output: process.argv[2], qualification: 'D405_REVERSE_OCP_STEP_OPEN',
  initialFiles: ['apps/cad-studio/test/step-ocp-browser.mjs', 'apps/cad-studio/test/step-ocp-import.mjs', 'apps/cad-studio/test/step-ocp-profile.py', file],
  extraFrozen: productInputs,
  requiredFrozen: ['apps/cad-studio/src/files/importedFile.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts', 'packages/barocss-cad/src/io/step-import.ts'],
  limits: ['Reverse OCP-generated prismatic STEP only; forward strict no-healing reader is CONTROL_BLOCKED.', 'Bounds are checked by the current-source importer probe on the exact STEP text; UI volume/body count are checked directly.', 'No external fixture, Export, Save, download or paid live call.'] });
await f.run(async () => {
  await f.newPage(); f.phase = 'Open OCP-generated STEP';
  await f.page.setInputFiles('input[aria-label="Model file"]', file);
  const toast = await f.waitToast(/STEP opened.*1 solid.*millimetres.*252 mm³/, 60000);
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 1 && window.__studioDoc.nodes[0].kind === 'import' && window.__studioBodies?.()?.bodies.length === 1, null, { timeout: 60000 }); await f.ready();
  const doc = await f.doc(), bodies = await f.bodies();
  assert.equal(doc.nodes[0].step, text); assert.equal(doc.instances?.length ?? 0, 0); assert.equal(bodies.bodies.length, 1);
  assert.ok(Math.abs(bodies.bodies[0].volume - 252) <= 1e-5);
  await f.page.getByRole('button', { name: 'Iso', exact: true }).click(); await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  f.report.observations.push({ toast, bodyCount: 1, volume: bodies.bodies[0].volume, exactInputTextRetained: true, importerBounds: result.bounds, importerBoundsErrors: result.boundsErrors, forwardStrict: 'CONTROL_BLOCKED', outboundUi: 'NOT_RUN' });
  await f.snapshot('01-ocp-step-opened'); assert.deepEqual(f.report.downloads, []);
});
