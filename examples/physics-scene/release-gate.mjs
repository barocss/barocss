import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const example = dirname(fileURLToPath(import.meta.url));
const root = resolve(example, '../..');
const reportPath = process.argv[2] ? resolve(process.argv[2]) : null;
const report = { format: 'barocss-physics-release-gate', version: 1, stage: 'native-preparation',
  timestamp: new Date().toISOString(), environment: { platform: process.platform,
    arch: process.arch, node: process.version }, checks: [], packedConsumer: null,
  browser: { status: 'prior-native-proof', evidence: 'examples/physics-cad-scene/evidence/checkpoint.md',
    mergedHeadRerunRequired: true }, nativePreparationPassed: false, releaseCandidate: false };

function command(executable, args, cwd = root, env = process.env) {
  const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`${executable} ${args.join(' ')} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  }
  return result.stdout.trim();
}
const near = (value, expected, tolerance) => assert.ok(Math.abs(value - expected) <= tolerance,
  `${value} differs from ${expected} by more than ${tolerance}`);
const add = (name, output) => report.checks.push({ name, status: 'pass', output });
const probes = ['probe', 'controls-probe', 'events-queries-probe', 'rotation-probe',
  'oriented-colliders-probe', 'friction-stack-probe', 'joints-probe', 'ccd-probe',
  'broadphase-probe', 'replay-probe'];

function inspectProbe(name, output) {
  assert.ok(output && typeof output === 'object');
  if (name === 'probe') {
    assert.equal(output.firstContactStep, 62);
    near(output.restHeightM, 0.7, 0.001);
    near(output.collisionImpulseNs, 2, 1e-9);
  } else if (name === 'friction-stack-probe') {
    near(output.zeroFrictionSpeedX, 1, 1e-12);
    near(output.frictionSpeedX, 0.7142857142857143, 1e-12);
    near(output.stackY[0], 0.25, 0.001);
    near(output.stackY[1], 0.75, 0.001);
    assert.ok(output.maxPenetrationM < 0.002);
  } else if (name === 'joints-probe') {
    near(output.fixedY, 0, 1e-6);
    near(output.hingeAngleRad, 0.5, 1e-9);
    assert.equal(output.hingeStopStep, 31);
  } else if (name === 'ccd-probe') {
    near(output.toiFraction, 0.282, 1e-12);
    near(output.ccdY, 0.06, 1e-6);
    assert.ok(output.discreteY < -2);
  } else if (name === 'broadphase-probe') {
    assert.equal(output.direct.candidatePairs, 29760);
    assert.equal(output.aabb.candidatePairs, 960);
    assert.equal(output.aabb.aabbTests, 29760);
    assert.equal(output.contactStatesMatch, true);
    assert.ok(output.direct.wallMs < 1000 && output.aabb.wallMs < 1000);
  } else if (name === 'replay-probe') {
    assert.equal(output.replayedSteps, 150);
    assert.ok(output.contactSteps > 0);
    near(output.jointReactionY, 0.08175, 1e-12);
    assert.equal(output.staleAndDamagedRefused, true);
  } else if (output.result !== undefined) assert.equal(output.result, 'ok');
}

let tempDirectory;
try {
  report.environment.macos = command('sw_vers', ['-productVersion']);
  report.environment.pnpm = command('pnpm', ['--version']);
  assert.equal(process.platform, 'darwin');
  assert.equal(process.arch, 'arm64');
  assert.equal(process.version, 'v22.22.0');
  assert.equal(report.environment.macos, '15.6.1');
  assert.equal(report.environment.pnpm, '10.11.0');
  report.gitHead = command('git', ['rev-parse', 'HEAD']);
  command('pnpm', ['install', '--offline', '--frozen-lockfile']);
  add('frozen offline install', 'passed');
  for (const packageName of ['@barocss/cad', '@barocss/gpu', '@barocss/cad-interop',
    '@barocss/viewer', '@barocss/physics']) {
    command('pnpm', ['--filter', packageName, 'build:library']);
    add(`${packageName} build`, 'passed');
  }
  for (const name of probes) {
    const value = JSON.parse(command('node', [join(example, `${name}.mjs`)]).split('\n').at(-1));
    inspectProbe(name, value);
    add(name, value);
  }
  const cadProbe = JSON.parse(command('node', [join(root, 'examples/physics-cad-scene/cad-proxy-probe.mjs')]).split('\n').at(-1));
  assert.equal(cadProbe.contactStep, 21);
  assert.equal(cadProbe.staleSourceRefused, true);
  add('cad-proxy-probe', cadProbe);
  tempDirectory = mkdtempSync(join(tmpdir(), 'barocss-physics-release-'));
  const cadTarball = 'barocss-cad-0.0.0-experimental.tgz';
  const physicsTarball = 'barocss-physics-0.0.0-experimental.tgz';
  command('pnpm', ['pack', '--pack-destination', tempDirectory], join(root, 'packages/barocss-cad'));
  command('pnpm', ['pack', '--pack-destination', tempDirectory], join(root, 'packages/barocss-physics'));
  writeFileSync(join(tempDirectory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  cpSync(join(example, 'release-consumer.mjs'), join(tempDirectory, 'release-consumer.mjs'));
  cpSync(join(root, 'examples/physics-cad-scene/two-surfaces.barocad'), join(tempDirectory, 'two-surfaces.barocad'));
  command('npm', ['install', '--offline', '--no-audit', '--no-fund', '--ignore-scripts',
    join(tempDirectory, cadTarball), join(tempDirectory, physicsTarball)], tempDirectory,
  { ...process.env, npm_config_cache: join(tempDirectory, '.npm-cache') });
  const independent = JSON.parse(command('node', [join(tempDirectory, 'release-consumer.mjs')], tempDirectory).split('\n').at(-1));
  assert.equal(independent.result, 'ok');
  report.packedConsumer = { status: 'pass', tarballs: [cadTarball, physicsTarball], output: independent };
  command('git', ['diff', '--check']);
  add('git diff --check', 'passed');
  report.nativePreparationPassed = true;
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  if (tempDirectory) rmSync(tempDirectory, { recursive: true, force: true });
  if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}
