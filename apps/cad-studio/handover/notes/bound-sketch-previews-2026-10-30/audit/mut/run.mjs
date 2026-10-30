import { build } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
import { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const T = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20', S = process.argv[2], srcRoot = process.argv[3], muts = JSON.parse(readFileSync(process.argv[4], 'utf8'));
const pkg = 'packages/barocss-cad-model';
for (const m of muts) {
  const dir = `${S}/work`; rmSync(dir, { recursive: true, force: true }); mkdirSync(`${dir}/${pkg}/test`, { recursive: true });
  cpSync(`${srcRoot}/${pkg}/src`, `${dir}/${pkg}/src`, { recursive: true });
  cpSync(`${T}/${pkg}/test/profiles-parameters.test.ts`, `${dir}/${pkg}/test/profiles-parameters.test.ts`);
  if (m.file) { const f = `${dir}/${pkg}/src/${m.file}`, s = readFileSync(f, 'utf8'), n = s.split(m.from).length - 1; if (n !== 1) { console.log(`${m.id}\tBAD-MUTANT occurrences=${n}`); continue; } writeFileSync(f, s.replace(m.from, m.to)); }
  const out = `${dir}/t.mjs`;
  await build({ entryPoints: [`${dir}/${pkg}/test/profiles-parameters.test.ts`], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'error', nodePaths: [T + '/node_modules', T + '/' + pkg + '/node_modules'] });
  const r = spawnSync(process.execPath, ['--test', out], { encoding: 'utf8' });
  const pass = /# pass (\d+)/.exec(r.stdout)?.[1], fail = /# fail (\d+)/.exec(r.stdout)?.[1], failed = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map(x => x[1]);
  console.log(`${m.id}\tpass=${pass} fail=${fail}\t${failed.join(' | ')}`);
}
