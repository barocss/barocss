// node mutrun.mjs <file-rel-to-src> <search> <replace>  : applies one mutation to a fresh copy, runs the D352 test file, restores.
import { readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const D = import.meta.dirname + '/mut', [file, search, replace] = process.argv.slice(2);
rmSync(D + '/src', { recursive: true, force: true }); cpSync(D + '/src.orig', D + '/src', { recursive: true });
if (file) { const p = D + '/src/' + file, t = readFileSync(p, 'utf8'); if (!t.includes(search)) { console.log('MUTATION NOT APPLIED'); process.exit(2); } writeFileSync(p, t.replace(search, replace)); }
const { build } = await import('/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules/esbuild/lib/main.js');
await build({ entryPoints: [D + '/test/sketch-spline-handles.test.ts'], outfile: D + '/out.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'error', nodePaths: ['/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/node_modules', '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules'] });
const r = spawnSync(process.execPath, ['--test', D + '/out.mjs'], { encoding: 'utf8' });
const fails = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map(m => m[1]);
const pass = (r.stdout.match(/^# pass (\d+)/m) ?? [])[1], fail = (r.stdout.match(/^# fail (\d+)/m) ?? [])[1];
console.log(`pass ${pass} fail ${fail}`, fails.length ? '\n  FAILED: ' + fails.join('\n  FAILED: ') : '');
