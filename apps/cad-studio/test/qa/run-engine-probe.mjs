// Bundles test/qa/engine-probe.ts with the workspace sources (as scripts/test.mjs does) and runs it.
//   node test/qa/run-engine-probe.mjs [probe.ts] > out.jsonl   (default engine-probe.ts)
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const out = mkdtempSync(join(tmpdir(), 'cad-studio-qa-'));
await build({ entryPoints: [join(root, 'test/qa', process.argv[2] ?? 'engine-probe.ts')], outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const result = spawnSync(process.execPath, [join(out, (process.argv[2] ?? 'engine-probe.ts').replace(/\.ts$/, '.mjs'))], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
process.exit(result.status ?? 1);
