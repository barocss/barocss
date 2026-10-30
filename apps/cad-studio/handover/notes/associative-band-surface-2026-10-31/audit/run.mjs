// node run.mjs <entry.ts> [--test] ; SWAP=<target-suffix>=<file>[,<suffix>=<file>] swaps sources at bundle time.
import { build } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
const T = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20';
const f = process.argv[2], asTest = process.argv.includes('--test'), out = '/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/auditB2/out/' + f.split('/').pop().replace(/\.ts$/, '') + '.' + process.pid + '.out.mjs';
const swaps = (process.env.SWAP ?? '').split(',').filter(Boolean).map(x => x.split('='));
const swap = { name: 'swap', setup(b) { for (const [suf, file] of swaps) b.onLoad({ filter: new RegExp(suf.replace(/[.\/]/g, m => '\\' + m) + '$') }, a => ({ contents: readFileSync(file, 'utf8'), loader: a.path.endsWith('x') ? 'tsx' : 'ts', resolveDir: dirname(a.path) })); } };
await build({ entryPoints: [f], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'error', plugins: [swap], jsx: 'automatic', define: { 'import.meta.dirname': JSON.stringify(process.env.DIRNAME ?? T + '/packages/barocss-cad-model/test') }, nodePaths: [T + '/node_modules', T + '/packages/barocss-cad-model/node_modules', T + '/apps/cad-studio/node_modules'] });
const r = spawnSync(process.execPath, asTest ? ['--test', out] : [out], { stdio: 'inherit' }); rmSync(out); process.exit(r.status ?? 1);
