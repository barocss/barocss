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
  const expected = plan.builds.map(({ outputDirectory }) => outputDirectory).sort();
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
  run(process.execPath, ['--test', 'examples/viewer-native-scene-replacement/surface-curvature-contract.test.mjs']);
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
    && command !== 'test');
}
export function fullCheckCommands(rootManifest, regression = false) {
  // Refuse a future root-check contract change rather than silently drop its obligations.
  if (rootManifest.scripts?.check !== 'pnpm type-check && pnpm lint && pnpm build:library && pnpm test'
    || rootManifest.scripts?.test !== 'pnpm run -r test') throw new Error('root check/test contract changed; update CI policy explicitly');
  return [
    ['type-check'], ['lint'], ['build:library'],
    ['--recursive', '--filter', './apps/**', '--filter', './examples/cad-preview', '--if-present', 'run', 'build'],
    ...(regression ? [['--recursive', '--filter', '!./apps/**', 'run', 'test']] : []),
  ];
}
export function selectAppLintFiles(directory, tracked, changed, all = false) {
  if (!/^apps\/[A-Za-z0-9_.-]+$/.test(directory) || !Array.isArray(tracked) || !Array.isArray(changed)) throw new Error('invalid app lint ownership');
  for (const path of [...tracked, ...changed]) if (!safePath(path)) throw new Error('unsafe app lint path');
  const changes = new Set(changed);
  return [...new Set(tracked)].filter((path) => path.startsWith(`${directory}/`)
    && /\.[cm]?[jt]sx?$/.test(path) && (all || changes.has(path))).sort();
}
export function allAppLintRequired(plan, config, regression = false) {
  // Current root config imports only registry packages. Unknown/local plugin wiring is conservative.
  return regression || !plan.changedPaths.length || plan.reasons.some((reason) => /unavailable comparison|comparison unavailable/.test(reason))
    || /(?:['"`]\.{1,2}\/|\b(?:import|require)\s*\()/.test(config)
    || plan.changedPaths.some((path) => !((path === 'apps/library-docs/package.json' && plan.docsCheckScriptOnly === true)
        || (path === 'packages/barocss-gpu/package.json' && plan.gpuTestRegistrationOnly === true))
      && (/(?:^|\/)(?:package\.json|[^/]*\.config\.[cm]?[jt]s|\.eslintrc[^/]*|tsconfig[^/]*\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.npmrc)$/.test(path)
        || /(?:^|\/)(?:build[^/]*\.[cm]?[jt]s|build\/)/.test(path)
        || (!/^(?:apps|packages|examples|\.github|\.ai)\//.test(path) && !/\.md$/.test(path))));
}
async function appLint(plan, selectedDirectories, regression = false) {
  const result = spawnSync('git', ['ls-files', '-z', '--', 'apps'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('cannot enumerate tracked app lint inputs');
  const tracked = result.stdout.split('\0').filter(Boolean);
  const all = allAppLintRequired(plan, readFileSync('eslint.config.mjs', 'utf8'), regression);
  const directories = selectedDirectories ?? tracked.filter((path) => /^apps\/[^/]+\/package\.json$/.test(path)).map((path) => dirname(path));
  const { ESLint } = await import('eslint');
  const eslint = new ESLint({ cwd: process.cwd() });
  for (const directory of directories) {
    const manifest = JSON.parse(readFileSync(`${directory}/package.json`, 'utf8'));
    if (manifest.scripts?.lint) continue; // Existing declared command remains authoritative.
    const allOwned = all || plan.changedPaths.includes(`${directory}/package.json`);
    const candidates = selectAppLintFiles(directory, tracked, plan.changedPaths, allOwned);
    const files = []; const ignored = [];
    for (const path of candidates) {
      if (!lstatSync(path).isFile()) throw new Error(`non-regular app lint input: ${path}`);
      if (await eslint.isPathIgnored(path)) ignored.push(path); else files.push(path);
    }
    console.log(JSON.stringify({ appLint: directory, coverage: allOwned ? 'all tracked code' : 'changed tracked code', files, configuredExclusions: ignored }));
    if (files.length) run('pnpm', ['exec', 'eslint', '--no-warn-ignored', '--', ...files]);
    else console.log(`App ESLint ${directory}: no eligible files; no lint PASS claimed`);
  }
}

function docs() {
  // Keep generated examples and all current docs validators; no deploy action.
  for (const script of docsValidationScripts) run('pnpm', ['--filter', '@barocss/library-docs', 'run', script]);
}
function build(plan) {
  // One topological build process at a time, separate from the max-two check runners.
  for (const row of plan.builds) packageScript(row.name, row.directory, row.command);
  const directories = plan.builds.map(({ outputDirectory }) => outputDirectory);
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
async function main() {
  const plan = JSON.parse(readFileSync('affected-ci-plan.json', 'utf8')); checkCurrent(plan);
  const action = process.argv[2];
  console.log('Required CI runs lint/types/build. Package/runtime tests run on manual/pre-release regression. Application tests are external: run locally or on Execute Tester. This CI does not claim they passed.');
  if (action === 'aggregate') { const needs = JSON.parse(process.env.CI_NEEDS); validateAggregate(plan, { ...needs, build: needs.prerequisites }); console.log('Selected CI coverage succeeded', plan.planId); return; }
  if (action === 'full' || action === 'regression') {
    const concurrency = spawnSync('pnpm', ['config', 'get', 'workspace-concurrency'], { encoding: 'utf8' });
    if (concurrency.status !== 0 || concurrency.stdout.trim() !== '2') throw new Error('full workspace concurrency must be 2');
    if (plan.mode !== 'full') throw new Error('wrong route');
    const regression = action === 'regression';
    if (regression && !['workflow_dispatch', 'workflow_call'].includes(process.env.GITHUB_EVENT_NAME)) throw new Error('regression requires a manual/pre-release caller');
    if (regression) viewer();
    for (const args of fullCheckCommands(JSON.parse(readFileSync('package.json', 'utf8')), regression)) {
      run('pnpm', args);
      if (args.length === 1 && args[0] === 'lint') await appLint(plan, undefined, regression);
    }
    if (regression) rootChecks(); if (plan.docsNeeded) docs(); return; }
  if (plan.mode === 'full') throw new Error('partial action on full plan');
  if (action === 'build') { build(plan); return; }
  restore(plan);
  if (action === 'root') { console.log('All selected build artifacts verified'); return; }
  if (action === 'docs' && plan.docsNeeded) { docs(); return; }
  if (action === 'package') {
    const row = plan.packages.find(({ name }) => name === process.env.CI_PACKAGE);
    if (!row) throw new Error('unselected package');
    for (const [command, expected] of Object.entries(row.scripts)) {
      const current = JSON.parse(readFileSync(`${row.directory}/package.json`, 'utf8')).scripts?.[command] ?? null;
      if (current !== expected) throw new Error('selected optional script changed');
      if (packageCheckCommands(row).some(([selected]) => selected === command)) packageScript(row.name, row.directory, command, expected);
      else if (expected !== null) console.log(`External runtime test: ${row.name} ${command} (not run in CI)`);
    }
    if (row.directory.startsWith('apps/')) await appLint(plan, [row.directory]);
    return;
  }
  throw new Error('unknown CI action');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
