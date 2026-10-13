import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, lstatSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest, safePath, validatePlan, validateAggregate } from './affected-ci-plan.mjs';

function run(command, args) {
  const start = Date.now();
  console.log(`::group::${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  console.log(`::endgroup::\n${JSON.stringify({ command, args, seconds: (Date.now() - start) / 1000, status: result.status, signal: result.signal })}`);
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.signal ?? result.status}`);
}
function filesUnder(root) {
  const paths = [];
  const walk = (path) => {
    if (!safePath(path)) throw new Error('unsafe artifact path');
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`symlink in output: ${path}`);
    if (stat.isDirectory()) readdirSync(path).sort().forEach((name) => walk(`${path}/${name}`));
    else if (stat.isFile()) paths.push(path);
    else throw new Error('unsupported output type');
  };
  walk(root); return paths;
}
export function validateArtifactManifest(manifest, plan) {
  validatePlan(plan);
  if (!manifest || manifest.version !== 1 || ['head', 'runId', 'planId'].some((key) => manifest[key] !== plan[key])) throw new Error('artifact identity mismatch');
  const expected = plan.builds.map(({ directory }) => `${directory}/dist`).sort();
  if (!expected.length || !Array.isArray(manifest.directories) || JSON.stringify([...manifest.directories].sort()) !== JSON.stringify(expected) || new Set(expected).size !== expected.length || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('artifact directories mismatch');
  const seen = new Set(); const found = new Set();
  for (const file of manifest.files) {
    const directory = expected.find((dir) => file.path?.startsWith(`${dir}/`));
    if (!directory || !safePath(file.path) || seen.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0) throw new Error('invalid artifact file');
    seen.add(file.path); found.add(directory);
  }
  if (found.size !== expected.length) throw new Error('missing or empty output');
  return true;
}
function checkCurrent(plan) {
  validatePlan(plan);
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (head.status || head.stdout.trim() !== plan.head || process.env.GITHUB_RUN_ID !== plan.runId) throw new Error('plan checkout/run mismatch');
}
function packageScript(name, directory, command, expected) {
  if (!/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/.test(name) || !safePath(directory) || !['type-check', 'lint', 'test', 'build', 'build:library'].includes(command)) throw new Error('invalid package command');
  const manifest = JSON.parse(readFileSync(`${directory}/package.json`, 'utf8'));
  if (manifest.name !== name || typeof manifest.scripts?.[command] !== 'string' || (expected !== undefined && manifest.scripts[command] !== expected)) throw new Error('selected script missing or changed');
  run('pnpm', ['--filter', name, 'run', command]);
}
function viewer() {
  for (const name of ['native-directional-light-webgpu', 'native-surface-uv01-webgpu', 'native-point-light-webgpu']) run(process.execPath, ['--test', '--test-concurrency=1', `packages/barocss-viewer/tests/${name}.test.mjs`]);
}
function rootChecks() {
  const tests = readdirSync('.github/scripts').filter((name) => name.endsWith('.test.mjs')).sort().map((name) => `.github/scripts/${name}`);
  if (!tests.length) throw new Error('missing release tests');
  run(process.execPath, ['--test', ...tests]);
  run(process.execPath, ['.github/scripts/check-packages.mjs']);
}
export const docsValidationScripts = ['build', 'check:docs', 'check:api'];
export function packageCheckCommands(row) {
  return Object.entries(row.scripts).filter(([command, expected]) => expected !== null
    && !(command === 'test' && row.directory.startsWith('apps/')));
}
export function fullCheckCommands(rootManifest) {
  // Refuse a future root-check contract change rather than silently drop its obligations.
  if (rootManifest.scripts?.check !== 'pnpm type-check && pnpm lint && pnpm build:library && pnpm test'
    || rootManifest.scripts?.test !== 'pnpm run -r test') throw new Error('root check/test contract changed; update CI policy explicitly');
  return [
    ['type-check'], ['lint'], ['build:library'],
    ['--recursive', '--filter', '!./apps/**', 'run', 'test'],
  ];
}
function docs() {
  // Keep generated examples and all current docs validators; no deploy action.
  for (const script of docsValidationScripts) run('pnpm', ['--filter', '@barocss/library-docs', 'run', script]);
}
function build(plan) {
  // One topological build process at a time, separate from the max-two check runners.
  for (const row of plan.builds) packageScript(row.name, row.directory, row.command);
  const directories = plan.builds.map(({ directory }) => `${directory}/dist`);
  const files = directories.flatMap((directory) => filesUnder(directory).map((path) => {
    const bytes = readFileSync(path); const destination = `.ci-dist/${path}`;
    mkdirSync(dirname(destination), { recursive: true }); copyFileSync(path, destination);
    return { path, bytes: bytes.length, sha256: digest(bytes) };
  }));
  const manifest = { version: 1, head: plan.head, runId: plan.runId, planId: plan.planId, directories, files };
  validateArtifactManifest(manifest, plan);
  writeFileSync('.ci-dist/manifest.json', JSON.stringify(manifest, null, 2));
}
function restore(plan) {
  const manifest = JSON.parse(readFileSync('.ci-dist/manifest.json', 'utf8'));
  validateArtifactManifest(manifest, plan);
  const actual = filesUnder('.ci-dist').filter((path) => path !== '.ci-dist/manifest.json').map((path) => path.slice('.ci-dist/'.length)).sort();
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files.map(({ path }) => path).sort())) throw new Error('extra/missing artifact files');
  for (const file of manifest.files) {
    const bytes = readFileSync(`.ci-dist/${file.path}`);
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`corrupt artifact: ${file.path}`);
  }
  for (const file of manifest.files) { mkdirSync(dirname(file.path), { recursive: true }); copyFileSync(`.ci-dist/${file.path}`, file.path); }
}
function main() {
  const plan = JSON.parse(readFileSync('affected-ci-plan.json', 'utf8')); checkCurrent(plan);
  const action = process.argv[2];
  console.log('Application tests are external: run locally or on Execute Tester. This CI does not claim they passed.');
  if (action === 'aggregate') { const needs = JSON.parse(process.env.CI_NEEDS); validateAggregate(plan, { ...needs, build: needs.prerequisites }); console.log('Selected CI coverage succeeded', plan.planId); return; }
  if (action === 'full') {
    const concurrency = spawnSync('pnpm', ['config', 'get', 'workspace-concurrency'], { encoding: 'utf8' });
    if (concurrency.status !== 0 || concurrency.stdout.trim() !== '2') throw new Error('full workspace concurrency must be 2');
    if (plan.mode !== 'full') throw new Error('wrong route'); viewer();
    for (const args of fullCheckCommands(JSON.parse(readFileSync('package.json', 'utf8')))) run('pnpm', args);
    rootChecks(); if (plan.docsNeeded) docs(); return; }
  if (plan.mode === 'full') throw new Error('partial action on full plan');
  if (action === 'build') { build(plan); return; }
  restore(plan);
  if (action === 'root') { rootChecks(); return; }
  if (action === 'docs' && plan.docsNeeded) { docs(); return; }
  if (action === 'package') {
    const row = plan.packages.find(({ name }) => name === process.env.CI_PACKAGE);
    if (!row) throw new Error('unselected package');
    for (const [command, expected] of Object.entries(row.scripts)) {
      const current = JSON.parse(readFileSync(`${row.directory}/package.json`, 'utf8')).scripts?.[command] ?? null;
      if (current !== expected) throw new Error('selected optional script changed');
      if (packageCheckCommands(row).some(([selected]) => selected === command)) packageScript(row.name, row.directory, command, expected);
      else if (expected !== null) console.log(`External application test: ${row.name} ${command} (not run in CI)`);
    }
    if (row.name === '@barocss/viewer') viewer();
    return;
  }
  throw new Error('unknown CI action');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
