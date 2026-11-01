// node run.mjs <entry.ts> [--test] ; SELECT=<variant select.ts> swaps the tree's sketch/select.ts at bundle time.
import { build } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const T = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20';
const f = process.argv[2], asTest = process.argv.includes('--test'), out = f.replace(/\.ts$/, '') + '.' + process.pid + '.out.mjs';
const swap = { name: 'swap', setup(b) { if (!process.env.SELECT) return; b.onLoad({ filter: /barocss-cad-model\/src\/sketch\/select\.ts$/ }, () => ({ contents: readFileSync(process.env.SELECT, 'utf8'), loader: 'ts', resolveDir: T + '/packages/barocss-cad-model/src/sketch' })); } };
await build({ entryPoints: [f], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning', plugins: [swap], define: { 'import.meta.dirname': JSON.stringify(process.env.DIRNAME ?? T + '/packages/barocss-cad-model/test') }, nodePaths: [T + '/node_modules', T + '/packages/barocss-cad-model/node_modules', T + '/apps/cad-studio/node_modules'] });
const r = spawnSync(process.execPath, asTest ? ['--test', out] : [out], { stdio: 'inherit' }); process.exit(r.status ?? 1);
