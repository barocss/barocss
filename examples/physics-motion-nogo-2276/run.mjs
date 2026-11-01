// Run one fixed diagnostic stage. Never overwrite a prior attempt.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '../..');
const [mode, runId] = process.argv.slice(2);
if (!['hinge-unit', 'hinge', 'stack-unit', 'stack', 'stack-equilibrium-unit', 'stack-equilibrium'].includes(mode) || !/^[a-z0-9-]+$/.test(runId ?? '')) {
  throw Error('usage: node run.mjs <stage> <unique-run-id>; see README.md');
}
const out = join(here, 'evidence', runId);
if (existsSync(out)) throw Error(`prior attempt must be preserved: ${out}`);
mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr);
  return result.stdout.trim();
};
const baseline = '031f66c3ea572c3a496cfa319a4c542e7b19fc3a';
const sourceFiles = readdirSync(here).filter(n => /\.(py|mjs|md)$/.test(n)).sort().map(name => {
  const p = join(here, name), bytes = readFileSync(p);
  return { path: relative(root, p), bytes: bytes.length, sha256: sha(bytes) };
});
writeFileSync(join(out, 'source.json'), JSON.stringify({ baseline, head: git(['rev-parse', 'HEAD']),
  branch: git(['branch', '--show-current']), sourceFiles }, null, 2) + '\n');
const programs = {
  'hinge-unit': ['hinge-unit.test.py'],
  hinge: ['hinge-study.py', '--output', join(out, 'result.json'),
    '--node', '/Users/user/.volta/tools/image/node/22.19.0/bin/node',
    '--node', '/Users/user/.volta/tools/image/node/24.22.1/bin/node'],
  'stack-unit': ['stack-unit.test.py'],
  stack: ['stack-study.py', '--output', join(out, 'result.json')],
  'stack-equilibrium-unit': ['stack-equilibrium-unit.test.py'],
  'stack-equilibrium': ['stack-equilibrium.py', '--output', join(out, 'result.json')],
};
const args = programs[mode].map((value, index) => index === 0 ? join(here, value) : value);
const started = new Date().toISOString();
const result = spawnSync('python3', args, { cwd: root, encoding: 'utf8', timeout: 180000,
  maxBuffer: 2 * 1024 * 1024, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
writeFileSync(join(out, 'stdout.raw'), result.stdout ?? '');
writeFileSync(join(out, 'stderr.raw'), result.stderr ?? '');
const receipt = { mode, command: ['python3', ...args], cwd: root, started,
  finished: new Date().toISOString(), exit: result.status, signal: result.signal,
  error: result.error?.message ?? null, stdoutSha256: sha(result.stdout ?? ''), stderrSha256: sha(result.stderr ?? ''),
  numericalWorldCalls: 0, oldSolverCalls: 0 };
writeFileSync(join(out, 'command.json'), JSON.stringify(receipt, null, 2) + '\n');
process.stdout.write(JSON.stringify(receipt) + '\n');
if (result.status !== 0) process.exitCode = 1;
