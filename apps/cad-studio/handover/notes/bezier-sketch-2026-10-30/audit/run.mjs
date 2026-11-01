import { build } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
const f = process.argv[2], out = f.replace(/\.ts$/, '.out.mjs');
await build({ entryPoints: [f], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning', nodePaths: ['/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules', '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/node_modules', '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/node_modules'] });
const r = spawnSync(process.execPath, [out], { stdio: 'inherit' }); process.exit(r.status ?? 1);
