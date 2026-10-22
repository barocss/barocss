// Bundles the benchmark with the workspace TypeScript sources and runs it (opt-in: not part of `test`).
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'cad-studio-bench-'));
await build({ entryPoints: [join(root, 'test/bench/node-bench.ts')], outfile: join(out, 'node-bench.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning',
  // (import.meta.dirname of the bundle is the temp directory: the fixtures are found from the source's.)
  define: { 'import.meta.dirname': JSON.stringify(join(root, 'test/bench')) } });
const result = spawnSync(process.execPath, [join(out, 'node-bench.mjs')], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
process.exit(result.status ?? 1);
