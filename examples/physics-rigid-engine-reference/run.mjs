import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { fixtures } from './fixtures.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const pkg = resolve(root, 'packages/barocss-physics');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const results = [];
const outputDir = resolve(process.argv[2] ?? '/tmp/physics-1179-admission');
await mkdir(outputDir, { recursive: true });
for (const graph of ['source', 'compiled']) {
  // Source is package self-resolution from the actual package manifest, with default conditions.
  const specifier = graph === 'source' ? '@barocss/physics' : resolve(pkg, manifest.publishConfig.exports['.'].import);
  const contents = `import {createPhysicsWorld, PhysicsError} from ${JSON.stringify(specifier)}; import {runAdmission} from ${JSON.stringify(resolve(here, 'admission-flow.mjs'))}; export const run = fixtures => runAdmission(createPhysicsWorld, PhysicsError, fixtures);`;
  const outfile = resolve(outputDir, `${graph}.mjs`);
  const compiled = await build({ stdin: { contents, resolveDir: pkg, sourcefile: 'consumer.mjs' }, bundle: true, write: true, outfile, format: 'esm', platform: 'node', target: 'node22', metafile: true });
  const inputs = Object.keys(compiled.metafile.inputs);
  const sourceInputs = inputs.filter(p => p.includes('packages/barocss-physics/src/'));
  const distInputs = inputs.filter(p => p.includes('packages/barocss-physics/dist/'));
  assert.ok(graph === 'source' ? sourceInputs.length > 0 && distInputs.length === 0 : distInputs.length > 0 && sourceInputs.length === 0, `${graph}: graph boundary`);
  const { run } = await import(pathToFileURL(outfile));
  const cases = run(fixtures());
  const report = { graph, sourceInputs: sourceInputs.length, distInputs: distInputs.length, inputs, cases };
  await writeFile(resolve(outputDir, `${graph}-report.json`), JSON.stringify(report, null, 2) + '\n');
  results.push(report);
}
assert.deepEqual(results[0].cases, results[1].cases, 'source/compiled public result differs');
const inputs = JSON.stringify(fixtures());
const summary = { result: 'ok', stage: 'public-admission-and-one-step-only', base: '9616f178fdf3fbc4d78d02a8e4c313fa5769e53f', measuredHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), node: process.version, fixtureSha256: createHash('sha256').update(inputs).digest('hex'), sourceCompiledEqual: true, graphs: results.map(({graph,sourceInputs,distInputs})=>({graph,sourceInputs,distInputs})), cases: results[0].cases.map(({ id, admission, error }) => ({ id, admission, ...(error ? {error} : {}), quality: 'unmeasured' })), numericalCampaignExecuted: false, viewerExecuted: false, performanceMeasured: false };
await writeFile(resolve(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
