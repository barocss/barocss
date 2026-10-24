#!/usr/bin/env node
// The AI evaluation (scripts/ai-eval/main.ts): bundles the harness and the MCP tool server from the sources, then runs
// the bundle in a child process (the judge re-runs the same bundle in a fresh process of its own).
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const out = mkdtempSync(join(tmpdir(), 'cad-ai-eval-build-'));
await build({ entryPoints: { cli: join(root, 'scripts/ai-eval/main.ts'), cadMcp: join(root, 'server/cadMcp.ts') }, outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
// (The harness's version for the records: its commit, "+dirty" when its folder has uncommitted changes.)
const git = (...a) => spawnSync('git', ['-C', root, ...a], { encoding: 'utf8' }).stdout.trim();
const harness = `${git('rev-parse', '--short', 'HEAD')}${git('status', '--porcelain', '--', 'scripts/ai-eval') ? '+dirty' : ''}`;
const r = spawnSync(process.execPath, [join(out, 'cli.mjs'), ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, AI_EVAL_REPO: resolve(root, '../..'), AI_EVAL_HARNESS: harness } });
rmSync(out, { recursive: true, force: true });
process.exit(r.status ?? 1);
