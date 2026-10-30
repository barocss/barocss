// node mutrun.mjs <mutant.ts> <entry.ts> [args] — bundles entry with every import of sketch/conflict(.ts) redirected to the mutant
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const W = '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041';
const req = createRequire(W + '/packages/barocss-cad-model/scripts/test.mjs');
const { build } = await import(req.resolve('esbuild'));
const mutant = resolve(process.argv[2]), entry = resolve(process.argv[3]), test = entry.endsWith('.test.ts');
const out = resolve('mut', process.argv[2].split('/').pop().replace('.ts', '') + '__' + entry.split('/').pop().replace('.ts', '.mjs'));
const redirect = { name: 'redirect', setup(b) { b.onResolve({ filter: /(^|\/)conflict(\.ts)?$/ }, a => a.importer === mutant ? undefined : ({ path: mutant })); } };
await build({ entryPoints: [entry], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'error', plugins: [redirect],
  nodePaths: [W + '/packages/barocss-cad-model/node_modules', W + '/node_modules'] });
const r = spawnSync(process.execPath, test ? ['--test', '--test-reporter=dot', out] : [out, ...process.argv.slice(4)], { encoding: 'utf8' });
const text = (r.stdout + r.stderr);
console.log(test ? (text.match(/# (pass|fail) \d+/g) ?? text.split('\n').filter(l => /pass|fail/.test(l)).slice(-2)).join(' ') + ' ' + (text.match(/✖ .*/g) ?? []).slice(0, 4).join(' | ') : text.trim().split('\n').slice(0, 1).join(''));
