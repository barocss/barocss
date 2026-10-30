// node run.mjs <entry.ts> [--test] ; SWAPS="real.ts=mutant.ts;..." replaces files at bundle time. Output bundles under auditEll/out.
import { build } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { basename, dirname } from 'node:path';
const T = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20';
const S = '/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/auditEll';
const f = process.argv[2], asTest = process.argv.includes('--test'), out = S + '/out/' + basename(f).replace(/\.ts$/, '') + '.' + process.pid + '.mjs';
const swaps = new Map((process.env.SWAPS ?? '').split(';').filter(Boolean).map(s => { const [a, b] = s.split('='); return [realpathSync(a), b]; }));
const swap = { name: 'swap', setup(b) { if (!swaps.size) return; b.onLoad({ filter: /\.tsx?$/ }, args => { let p; try { p = realpathSync(args.path); } catch { return; } const m = swaps.get(p); if (!m) return; return { contents: readFileSync(m, 'utf8'), loader: p.endsWith('x') ? 'tsx' : 'ts', resolveDir: dirname(p) }; }); } };
await build({ entryPoints: [f], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'error', plugins: [swap], define: { 'import.meta.dirname': JSON.stringify(process.env.DIRNAME ?? T + '/packages/barocss-cad-model/test') }, nodePaths: [T + '/node_modules', T + '/packages/barocss-cad-model/node_modules', T + '/apps/cad-studio/node_modules'] });
const r = spawnSync(process.execPath, asTest ? ['--test', '--test-reporter=tap', out] : [out], { stdio: 'inherit' }); process.exit(r.status ?? 1);
