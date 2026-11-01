import { build } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
const [root, ...files] = process.argv.slice(2);
const T = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20';
const plugin = { name: 'alias', setup(b) { b.onResolve({ filter: /^@barocss\/cad-model\// }, a => { const rest = a.path.slice('@barocss/cad-model/'.length); const p = rest.endsWith('.json') ? join(root, 'packages/barocss-cad-model/src', rest) : join(root, 'packages/barocss-cad-model/src', rest + '.ts'); return { path: existsSync(p) ? p : join(root, 'packages/barocss-cad-model', rest) }; }); } };
const outs = [];
for (const f of files) { const out = f.replace(/\.ts$/, '.out.mjs'); outs.push(out);
  await build({ entryPoints: [f], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'error', plugins: [plugin], define: { 'import.meta.dirname': JSON.stringify(dirname(f)) }, nodePaths: [T + '/node_modules', T + '/packages/barocss-cad-model/node_modules', T + '/apps/cad-studio/node_modules'] }); }
const r = spawnSync(process.execPath, ['--test', ...outs], { stdio: 'inherit' }); process.exit(r.status ?? 1);
