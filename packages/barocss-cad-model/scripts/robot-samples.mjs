// The sample robots (RS1): bundles scripts/robot-samples.ts with the package's sources and writes
// samples/robots/<id>.bcad and samples/robots/index.json — `node scripts/robot-samples.mjs`.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..'), out = mkdtempSync(join(tmpdir(), 'cad-model-samples-'));
await build({ entryPoints: [join(root, 'scripts/robot-samples.ts')], outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning', define: { 'import.meta.dirname': JSON.stringify(join(root, 'scripts')) } });
const result = spawnSync(process.execPath, [join(out, 'robot-samples.mjs'), 'write'], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
process.exit(result.status ?? 1);
