// D406: actual Studio Open of the exact fresh STEP bytes qualified by native OCCT.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

assert.ok(process.argv[3] && process.argv[4], 'fresh producer folder and native readback required');
const input = resolve(process.argv[3]), nativeFile = resolve(process.argv[4]);
const native = JSON.parse(await readFile(nativeFile, 'utf8')); assert.equal(native.status, 'PASS');
const metadata = JSON.parse(await readFile(join(input, 'producer-inputs.json'), 'utf8'));
const files = ['box', 'assembly'].map(name => join(input, name + '.step'));
const productInputs = Object.keys(metadata.inputs).filter(path => path !== 'apps/cad-studio/exchange-profile-producer.ts');
const f = await createFlow({ name: 'step-native', envFrozen: 'STEP_NATIVE_SOURCE_FROZEN', output: process.argv[2], qualification: 'D406_NATIVE_QUALIFIED_STEP_OPEN',
  initialFiles: ['apps/cad-studio/test/step-native-browser.mjs', 'apps/cad-studio/test/step-native-reader.cxx', 'apps/cad-studio/test/build-step-native-reader.py', 'apps/cad-studio/test/qualify-step-native.py', 'packages/barocss-cad/test/step-validation.test.mjs', nativeFile, ...files],
  extraFrozen: productInputs,
  requiredFrozen: ['packages/barocss-cad/src/io/step.ts', 'apps/cad-studio/src/files/importedFile.ts'],
  limits: ['Two selected prismatic STEP fixtures; not general STEP/AP242/PMI/datum acceptance.', 'Native reader disables automatic ShapeProcess postprocessing; not every built-in STEP translation adjustment.', 'No outbound Export, Save or download.'] });
await f.run(async () => {
  await f.newPage();
  for (const [name, count, volume] of [['box', 1, 40000], ['assembly', 3, 3000]]) {
    f.phase = `Open native-qualified ${name}`;
    const file = join(input, name + '.step'), bytes = await readFile(file), text = bytes.toString('utf8'), read = native.cases[name];
    assert.equal(sha256(bytes), read.inputSha256); assert.equal(read.comparison.pass, true);
    await f.page.setInputFiles('input[aria-label="Model file"]', file);
    const toast = await f.waitToast(new RegExp(`STEP opened.*${count} solid`), 60000);
    await f.page.waitForFunction(([text, count]) => window.__studioDoc?.nodes?.length === 1 && window.__studioDoc.nodes[0].kind === 'import' && window.__studioDoc.nodes[0].step === text && window.__studioBodies?.()?.bodies.length === count, [text, count], { timeout: 60000 }); await f.ready();
    const doc = await f.doc(), bodies = await f.bodies();
    const actual = bodies.bodies.reduce((sum, body) => sum + body.volume, 0);
    assert.ok(Math.abs(actual - volume) <= 1e-5); assert.ok(Math.abs(actual - read.raw.volume) <= 1e-5);
    assert.equal(doc.instances?.length ?? 0, 0); assert.ok(toast.includes(volume.toLocaleString('en-US') + ' mm³')); assert.ok(toast.includes('millimetres'));
    await f.page.getByRole('button', { name: 'Iso', exact: true }).click(); await f.page.getByTitle('Frame all (F)', { exact: true }).click();
    f.report.observations.push({ name, inputSha256: sha256(bytes), exactNativeCheckedBytes: true, nativeVolume: read.raw.volume, studioVolume: actual, bodies: count, toast });
    await f.snapshot(`0${count === 1 ? 1 : 2}-${name}-opened`);
  }
  assert.deepEqual(f.report.downloads, []);
});
