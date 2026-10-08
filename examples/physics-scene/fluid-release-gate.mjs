import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBareWorld, checkCadShelf, checkSourceImports,
  checkVisualProfile, MAX_RETAINED_HEAP_BYTES } from './fluid-release-criteria.mjs';

const example = dirname(fileURLToPath(import.meta.url));
const root = resolve(example, '../..');
const args = process.argv.slice(2);
if (args.length > 1 || args[0]?.startsWith('--')) {
  throw new Error('Usage: node examples/physics-scene/fluid-release-gate.mjs [report-path]');
}
const reportPath = args[0] ? resolve(args[0]) : null;
const report = { format: 'barocss-fluid-release-gate', version: 1,
  stage: 'native-numeric-resource-preparation', timestamp: new Date().toISOString(),
  gitHead: null, environment: { platform: process.platform, arch: process.arch,
    node: process.version }, profile: { particles: 256, stepSeconds: 1 / 120,
    basinM: [0.7, 1.3, 0.5], maxRetainedHeapBytes: MAX_RETAINED_HEAP_BYTES },
  checks: [], browser: { status: 'actual-merged-head-flow-required' },
  nativePreparationPassed: false, localReleaseCandidate: false,
  publicationDecision: 'separate' };

function command(executable, commandArgs) {
  const result = spawnSync(executable, commandArgs, { cwd: root, encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`${executable} ${commandArgs.join(' ')} failed: `
      + (result.error?.message ?? result.stderr ?? result.stdout));
  }
  return result.stdout.trim();
}

function probe(name, args, inspect) {
  const result = JSON.parse(command('node', args).split('\n').at(-1));
  inspect(result);
  report.checks.push({ name, status: 'pass', result });
}

try {
  report.gitHead = command('git', ['rev-parse', 'HEAD']);
  if (command('git', ['status', '--porcelain'])) {
    throw new Error('Fluid release gate requires a clean worktree');
  }
  if (process.platform === 'darwin') {
    report.environment.macos = command('sw_vers', ['-productVersion']);
    report.environment.cpu = command('sysctl', ['-n', 'machdep.cpu.brand_string']);
  }
  report.environment.pnpm = command('pnpm', ['--version']);
  command('pnpm', ['install', '--offline', '--frozen-lockfile']);
  report.checks.push({ name: 'frozen offline install', status: 'pass' });
  for (const name of ['@barocss/cad', '@barocss/gpu', '@barocss/cad-interop',
    '@barocss/viewer', '@barocss/physics']) {
    command('pnpm', ['--filter', name, 'build:library']);
    report.checks.push({ name: `${name} build`, status: 'pass' });
  }
  probe('source-import-probe', ['examples/physics-scene/source-import-probe.mjs'], checkSourceImports);
  for (let run = 1; run <= 3; run++) {
    probe(`fluid-world-probe-gc-${run}`,
      ['--expose-gc', 'examples/physics-scene/fluid-world-probe.mjs'], checkBareWorld);
  }
  probe('fluid-visual-profile-probe',
    ['examples/physics-scene/fluid-visual-profile-probe.mjs'], checkVisualProfile);
  probe('fluid-cad-shelf-probe',
    ['examples/physics-scene/fluid-cad-shelf-probe.mjs'], checkCadShelf);
  if (command('git', ['status', '--porcelain'])) {
    throw new Error('Fluid release gate changed the worktree');
  }
  report.nativePreparationPassed = true;
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}
