import { build } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const M = '/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/audit354/mut', muts = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/audit354/muts2.json', 'utf8'));
for (const m of muts) {
  const f = M + '/' + m.file, orig = readFileSync(f, 'utf8');
  if (!orig.includes(m.from)) { console.log('NOAPPLY', m.name); continue; }
  writeFileSync(f, orig.replace(m.from, m.to));
  try {
    await build({ entryPoints: [M + '/test/sketch-bezier.test.ts'], outfile: M + '/out.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent', nodePaths: ['/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules', '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/node_modules'] });
    const r = spawnSync(process.execPath, ['--test', M + '/out.mjs'], { encoding: 'utf8' });
    const pass = /# pass (\d+)/.exec(r.stdout)?.[1], fail = /# fail (\d+)/.exec(r.stdout)?.[1];
    console.log((fail === '0' ? 'SURVIVED' : 'killed  '), m.name, 'pass', pass, 'fail', fail);
  } catch (e) { console.log('BUILDERR', m.name, e.message.slice(0, 100)); }
  writeFileSync(f, orig);
}
