import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import M from './mutants2.mjs';
const A = import.meta.dirname, W = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20';
const test = process.argv[2] ?? W + '/apps/cad-studio/test/command-drag-wall.test.ts';
const only = process.argv[3]?.split(',');
const all = { BASELINE: [], ...M };
for (const [name, muts] of Object.entries(all)) {
  if (only && !only.includes(name)) continue;
  const mf = `${A}/mut/${name}.json`; writeFileSync(mf, JSON.stringify(muts));
  const out = `${A}/mut/${name}.test.mjs`;
  try { execFileSync(process.execPath, [`${A}/build.mjs`, test, out, mf], { stdio: 'pipe' }); } catch (e) { console.log(name, 'BUILD-FAIL', String(e.stderr).slice(0, 200)); continue; }
  const r = spawnSync(process.execPath, ['--test', out], { encoding: 'utf8', timeout: 240000 });
  const fails = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map(m => m[1]).filter(s => !s.includes(".test.mjs")).map(s => s.slice(0, 60));
  const pass = (r.stdout.match(/^# pass (\d+)/m) || [])[1], fail = (r.stdout.match(/^# fail (\d+)/m) || [])[1];
  console.log(`${name}: ${r.error ? 'TIMEOUT/ERR' : ''} pass ${pass} fail ${fail} ${fails.length ? '=> ' + fails.join(' | ') : ''}`);
}
