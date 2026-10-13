import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

const directory = process.env.BARO_CAD_WORLD_FIXTURE_DIR;
assert.ok(directory, 'BARO_CAD_WORLD_FIXTURE_DIR must point to the original four fixtures');
const here = dirname(fileURLToPath(import.meta.url));
// Authenticity and saved-data invariants must pass before loading the CAD provider.
const preflight = spawnSync(process.execPath, [join(here, 'paired-surface-material-body-world-points-fixture-preflight.mjs')], {
  env: process.env,
  stdio: 'inherit',
  timeout: 60000,
});
if (preflight.error) throw preflight.error;
assert.equal(preflight.signal, null, 'Original fixture preflight terminated by signal');
assert.equal(preflight.status, 0, 'Original fixture preflight failed');
const temp = await mkdtemp(join(tmpdir(), 'barocss-world-native-'));
const outfile = join(temp, 'world-result-native.mjs');
try {
  // Build only the Loader verifier and its actual CAD dependency graph.
  // Bundle resolves the CAD package's TypeScript source .js specifiers for Node.
  // No GPU, browser or renderer acceptance is implied.
  console.log('World XYZ: preflight PASS; bundling actual CAD Native provider');
  await build({
    entryPoints: [join(here, 'paired-surface-material-body-world-points-result-verify.mjs')],
    outfile,
    bundle: true,
    packages: 'bundle',
    platform: 'node',
    format: 'esm',
    target: 'node22',
    logLevel: 'warning',
  });
  console.log('World XYZ: launching actual Native whole-result validation');
  const result = spawnSync(process.execPath, [outfile], {
    env: process.env,
    stdio: 'inherit',
    timeout: 180000,
  });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, 'Native verifier was terminated by signal');
  assert.equal(result.status, 0, 'Native verifier failed');
  console.log('World XYZ: Native whole-result verifier PASS');
} finally {
  await rm(temp, {recursive: true, force: true});
}
