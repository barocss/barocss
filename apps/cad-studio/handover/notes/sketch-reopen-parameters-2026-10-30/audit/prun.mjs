import { build } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
const T = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20';
const f = process.argv[2], out = f.replace(/\.ts$/, '.out.mjs');
await build({ entryPoints: [f], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'error', nodePaths: [T + '/node_modules', T + '/packages/barocss-cad-model/node_modules'] });
const r = spawnSync(process.execPath, [out], { stdio: 'inherit' }); process.exit(r.status ?? 1);
