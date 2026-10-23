// Bundles each test with the package's TypeScript sources and runs it with node --test (as the studio's runner does).
// The tests all live in test/: `import.meta.dirname` is that folder in every bundle, so a test's paths are its own
// (`join(import.meta.dirname, 'fixtures/…')`), not the shell's working directory. `pnpm test [name …]` runs those only;
// TEST_CONCURRENCY=n runs n test files at a time (the R checkpoints' suites at 4).
import { build } from 'esbuild';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..'), dir = join(root, 'test'), only = process.argv.slice(2);
const out = mkdtempSync(join(tmpdir(), 'cad-model-test-'));
const tests = readdirSync(dir).filter(name => name.endsWith('.test.ts') && (!only.length || only.some(o => name.includes(o))));
await build({ entryPoints: tests.map(name => join(dir, name)), outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning', define: { 'import.meta.dirname': JSON.stringify(dir) } });
const result = spawnSync(process.execPath, ['--test', ...(process.env.TEST_CONCURRENCY ? [`--test-concurrency=${process.env.TEST_CONCURRENCY}`] : []), ...tests.map(name => join(out, name.replace(/\.ts$/, '.mjs')))], { stdio: 'inherit', cwd: root });
rmSync(out, { recursive: true, force: true });
process.exit(result.status ?? 1);
