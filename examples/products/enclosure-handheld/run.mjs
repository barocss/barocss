// P2, the handheld enclosure, built end to end: bundles build.ts with the facade and the cad-model core
// (as cad-model's own test runner bundles its tests) and runs it. Deterministic and rerunnable:
//   node examples/products/enclosure-handheld/run.mjs <out-dir>
// writes <out-dir>/report.json (each part's volume, mass and evaluation time, the checks' report) and the documents;
// enclosure.bcad is written under out-dir. No generated files are written into this example. The checks alone, over any saved document:
//   node examples/products/enclosure-handheld/run.mjs --check <doc.bcad>
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

if (process.argv[2] === '--check' && !process.argv[3]) throw new Error('Usage: run.mjs --check <doc.bcad>');
const here = import.meta.dirname, checking = process.argv[2] === '--check', entry = checking ? 'check' : 'build';
const args = checking ? [resolve(process.argv[3]), ...process.argv.slice(4)] : [resolve(process.argv[2] ?? join(tmpdir(), 'barocss-p2-output'))];
const dir = mkdtempSync(join(tmpdir(), 'enclosure-handheld-'));
try {
  await build({ entryPoints: [join(here, `${entry}.ts`)], outfile: join(dir, `${entry}.mjs`), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning', define: { 'import.meta.dirname': JSON.stringify(here) }, nodePaths: [join(here, '../../../packages/barocss-cad-model/node_modules')] });
  const r = spawnSync(process.execPath, [join(dir, `${entry}.mjs`), ...args], { stdio: 'inherit' });
  process.exitCode = r.status ?? 1;
} finally { rmSync(dir, { recursive: true, force: true }); }
