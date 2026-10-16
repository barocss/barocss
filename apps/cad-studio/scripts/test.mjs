// Bundles each test with the workspace TypeScript sources and runs it with node --test.
import { build } from 'esbuild';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'cad-studio-test-'));
const tests = readdirSync(join(root, 'test')).filter(name => name.endsWith('.test.ts'));
await build({ entryPoints: tests.map(name => join(root, 'test', name)), outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const result = spawnSync(process.execPath, ['--test', ...tests.map(name => join(out, name.replace(/\.ts$/, '.mjs')))], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
process.exit(result.status ?? 1);
