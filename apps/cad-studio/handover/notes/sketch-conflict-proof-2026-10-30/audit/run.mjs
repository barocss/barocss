// usage: node run.mjs probe.ts  — bundles with esbuild resolved from the audited worktree and runs it
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const W = '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041';
const req = createRequire(W + '/packages/barocss-cad-model/scripts/test.mjs');
const { build } = await import(req.resolve('esbuild'));
const entry = resolve(process.argv[2]), out = entry.replace(/\.ts$/, '.bundle.mjs');
await build({ entryPoints: [entry], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning',
  nodePaths: [W + '/packages/barocss-cad-model/node_modules', W + '/node_modules'] });
const r = spawnSync(process.execPath, [out, ...process.argv.slice(3)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
