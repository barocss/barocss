import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectProbe, physicsProbeNames } from './release-gate-criteria.mjs';
import { runPackedConsumer } from './release-gate-packed-consumer.mjs';

const example = dirname(fileURLToPath(import.meta.url));
const root = resolve(example, '../..');
const args = process.argv.slice(2);
const full = args[0] === '--full';
const reportArgument = args[full ? 1 : 0];
if (args.length > (full ? 2 : 1) || (!full && reportArgument?.startsWith('--')))
  throw new Error('Usage: node release-gate.mjs [--full] [report-path]');
const reportPath = reportArgument ? resolve(reportArgument) : null;
const report = { format: 'barocss-physics-release-gate', version: 1,
  stage: full ? 'full-native-preparation' : 'prototype-checkpoint',
  timestamp: new Date().toISOString(), environment: { platform: process.platform,
    arch: process.arch, node: process.version }, checks: [], packedConsumer: null,
  browser: { status: full ? 'prior-native-proof' : 'manual-flow-required',
    evidence: 'examples/physics-cad-scene/evidence/checkpoint.md',
    mergedHeadRerunRequired: true }, prototypeCheckpointPassed: false,
  nativePreparationPassed: false, releaseCandidate: false };

function command(executable, args, cwd = root, env = process.env) {
  const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`${executable} ${args.join(' ')} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  }
  return result.stdout.trim();
}
const add = (name, output) => report.checks.push({ name, status: 'pass', output });

function probe(name, path) {
  const output = JSON.parse(command('node', [path]).split('\n').at(-1));
  inspectProbe(name, output);
  add(name, output);
}

try {
  if (process.platform === 'darwin') report.environment.macos = command('sw_vers', ['-productVersion']);
  report.environment.pnpm = command('pnpm', ['--version']);
  if (full) {
    assert.equal(process.platform, 'darwin');
    assert.equal(process.arch, 'arm64');
    assert.equal(process.version, 'v22.22.0');
    assert.equal(report.environment.macos, '15.6.1');
    assert.equal(report.environment.pnpm, '10.11.0');
  }
  report.gitHead = command('git', ['rev-parse', 'HEAD']);
  command('pnpm', ['install', '--offline', '--frozen-lockfile']);
  add('frozen offline install', 'passed');
  const packages = full ? ['@barocss/cad', '@barocss/gpu', '@barocss/cad-interop',
    '@barocss/viewer', '@barocss/physics'] : ['@barocss/cad', '@barocss/physics'];
  for (const packageName of packages) {
    command('pnpm', ['--filter', packageName, 'build:library']);
    add(`${packageName} build`, 'passed');
  }
  const sourceImports = JSON.parse(command('node', [join(example, 'source-import-probe.mjs')]).split('\n').at(-1));
  assert.equal(sourceImports.result, 'ok');
  add('source-import-probe', sourceImports);
  if (full) for (const name of physicsProbeNames) probe(name, join(example, `${name}.mjs`));
  probe('cad-proxy-probe', join(root, 'examples/physics-cad-scene/cad-proxy-probe.mjs'));
  if (full) report.packedConsumer = runPackedConsumer(command, root, example);
  command('git', ['diff', '--check']);
  add('git diff --check', 'passed');
  report.prototypeCheckpointPassed = true;
  if (full) report.nativePreparationPassed = true;
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}
