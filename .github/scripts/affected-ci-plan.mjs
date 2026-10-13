import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const categories = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const checks = ['type-check', 'lint', 'test'];
const releases = ['@barocss/kit', '@barocss/browser', '@barocss/server', '@barocss/render'];
export const safePath = (value) => typeof value === 'string' && /^[A-Za-z0-9_.@/-]+$/.test(value) && !value.startsWith('/') && value.split('/').every((part) => part && part !== '.' && part !== '..');
const namePattern = /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/;
const shaPattern = /^[a-f0-9]{40}$/;
const canonical = (value) => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export const digest = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');

export function classifyMarkdown(text) {
  if (typeof text !== 'string' || /^\uFEFF?---(?:\r?\n|$)/.test(text)) return false;
  let fence = null;
  const plain = [];
  for (const line of text.split(/\r?\n/)) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker && (!fence || (marker[0] === fence[0] && marker.length >= fence.length))) { fence = fence ? null : marker; continue; }
    if (!fence) plain.push(line);
  }
  return !fence && !/(?:<|\{\{|^\s*(?:import|export)\s|^\s*:::)/m.test(plain.join('\n'));
}

// Audited build layouts. These are outputs, never optional artifact hints.
export function buildOutputDirectory(directory, config = '') {
  if (/^packages\/[^/]+$/.test(directory)) return `${directory}/dist`;
  if (['apps/library-docs', 'apps/barocss-docs'].includes(directory)) return `${directory}/docs/.vitepress/dist`;
  if (!['apps/cad-editor', 'apps/render-editor', 'apps/barocss-site', 'examples/cad-preview'].includes(directory)) throw new Error('unaudited build output');
  const declarations = [...config.matchAll(/\boutDir\s*:\s*(['"])([^'"\r\n]+)\1/g)];
  if (declarations.length > 1 || (/\boutDir\s*:/.test(config) && declarations.length !== 1)) throw new Error('dynamic build output');
  const relative = declarations[0]?.[2] ?? 'dist';
  if (!safePath(relative)) throw new Error('unsafe build output');
  return `${directory}/${relative}`;
}

function graph(packages) {
  if (!Array.isArray(packages) || !packages.length) throw new Error('missing workspace graph');
  const rows = new Map(); const directories = new Set();
  for (const row of packages) {
    if (!safePath(row.directory) || !/^(?:packages|apps)\/[^/]+$|^examples\/cad-preview$/.test(row.directory) || !namePattern.test(row.manifest?.name) || rows.has(row.manifest.name) || directories.has(row.directory)) throw new Error('invalid workspace owner');
    rows.set(row.manifest.name, row); directories.add(row.directory);
  }
  const edges = new Map();
  for (const [name, { manifest }] of rows) {
    const dependencies = new Set();
    for (const category of categories) for (const [dependency, version] of Object.entries(manifest[category] ?? {})) {
      if (rows.has(dependency)) dependencies.add(dependency);
      else if (typeof version !== 'string' || /^(?:workspace:|link:|file:)/.test(version)) throw new Error('unresolved local dependency');
    }
    edges.set(name, [...dependencies].sort());
  }
  const visiting = new Set(); const visited = new Set();
  const visit = (name) => { if (visiting.has(name)) throw new Error('workspace dependency cycle'); if (visited.has(name)) return; visiting.add(name); edges.get(name).forEach(visit); visiting.delete(name); visited.add(name); };
  [...rows.keys()].sort().forEach(visit);
  return { rows, edges };
}

export function createAffectedPlan({ packages, basePackages, changes = [], contents = {}, validBase = true, fullReason = null, head, runId }) {
  const plan = { version: 1, head, runId, mode: 'full', docsCheckScriptOnly: false, appTests: 'external', runtimeTests: 'manual/pre-release', reasons: [], changedPaths: [...new Set(changes.flatMap((change) => [change.oldPath, change.path]).filter((path) => typeof path === 'string'))].sort(), packages: [], builds: [], docsNeeded: changes.some(({ path, oldPath }) => [path, oldPath].some((p) => p?.startsWith('apps/library-docs/'))) };
  const finish = () => ({ ...plan, planId: digest(plan) });
  try {
    if (!shaPattern.test(head) || !/^\d+$/.test(runId)) throw new Error('invalid run identity');
    if (fullReason || !validBase || !changes.length) throw new Error(fullReason || 'comparison unavailable or empty');
    const { rows, edges } = graph(packages); graph(basePackages);
    const manifests = (items) => items.map(({ directory, manifest }) => ({ directory, manifest })).sort((a, b) => a.directory.localeCompare(b.directory));
    // A docs validator command does not change another app's ESLint environment.
    // Compare the trusted base with the actual checkout, not just changed path names.
    const docsPath = 'apps/library-docs/package.json';
    const docsChanges = changes.filter(({ path, oldPath }) => path === docsPath || oldPath === docsPath);
    const docsBefore = basePackages.find(({ directory }) => directory === 'apps/library-docs')?.manifest;
    const docsAfter = packages.find(({ directory }) => directory === 'apps/library-docs')?.manifest;
    const omitDocsCheck = (items) => manifests(items).map(({ directory, manifest }) => ({ directory,
      manifest: directory === 'apps/library-docs'
        ? { ...manifest, scripts: { ...manifest.scripts, 'check:docs': '<compared separately>' } } : manifest }));
    plan.docsCheckScriptOnly = docsChanges.length === 1 && docsChanges[0].status === 'M' && !docsChanges[0].oldPath
      && typeof docsBefore?.scripts?.['check:docs'] === 'string' && !!docsBefore.scripts['check:docs']
      && typeof docsAfter?.scripts?.['check:docs'] === 'string' && !!docsAfter.scripts['check:docs']
      && docsBefore.scripts['check:docs'] !== docsAfter.scripts['check:docs']
      && canonical(omitDocsCheck(packages)) === canonical(omitDocsCheck(basePackages));
    if (canonical(manifests(packages)) !== canonical(manifests(basePackages))) throw new Error('workspace manifest changed');
    const selected = new Set(); let docs = false;
    for (const change of changes) {
      if (!/^(?:A|M|D|R\d+)$/.test(change.status) || (change.status.startsWith('R') && !change.oldPath)) throw new Error('uncertain diff entry');
      for (const path of [change.oldPath, change.path].filter(Boolean)) {
        if (!safePath(path)) throw new Error('unsafe changed path');
        if (path.startsWith('apps/library-docs/')) {
          const text = contents[path];
          if (!/^apps\/library-docs\/docs\/.+\.md$/.test(path) || !text || !classifyMarkdown(text.before) || !classifyMarkdown(text.after)) throw new Error('executable or unknown docs input');
          docs = true; continue;
        }
        // Audited undeclared cross-package imports/fixture readers; do not guess a narrower graph.
        if (/^(?:packages\/barocss(?:-browser|-server)?\/|apps\/cad-editor\/)/.test(path)) throw new Error('cross-root test input');
        const owner = [...rows.values()].find(({ directory }) => path.startsWith(`${directory}/`));
        if (!owner) throw new Error('unowned root or shared input');
        const relative = path.slice(owner.directory.length + 1);
        if (!( /^(?:src|test|tests)\//.test(relative) || relative === 'README.md' || (owner.directory.startsWith('apps/') && /^native-[a-z0-9-]+\.mjs$/.test(relative))) || /(?:^|\/)(?:index\.[cm]?[jt]sx?|[^/]*(?:types|codec|schema|exports)[^/]*)$/.test(relative) || /\.d\.ts$/.test(relative)) throw new Error('manifest, build or public contract input');
        selected.add(owner.manifest.name);
      }
    }
    let added = true;
    while (added) { added = false; for (const [name, dependencies] of edges) if (!selected.has(name) && dependencies.some((dep) => selected.has(dep))) { selected.add(name); added = true; } }
    const buildSet = new Set();
    const include = (name) => { if (buildSet.has(name)) return; if (!rows.has(name)) throw new Error('missing release prerequisite'); buildSet.add(name); edges.get(name).forEach(include); };
    [...selected, ...releases].forEach(include);
    const ordered = []; const visited = new Set();
    const order = (name) => { if (visited.has(name)) return; edges.get(name).filter((dep) => buildSet.has(dep)).forEach(order); visited.add(name); ordered.push(name); };
    [...buildSet].sort().forEach(order);
    plan.builds = ordered.flatMap((name) => {
      const row = rows.get(name); const scripts = row.manifest.scripts ?? {};
      const command = scripts['build:library'] ? 'build:library' : scripts.build ? 'build' : null;
      if (!command) { if (releases.includes(name)) throw new Error('missing release build'); return []; }
      return [{ name, directory: row.directory, command, outputDirectory: row.outputDirectory ?? buildOutputDirectory(row.directory) }];
    });
    plan.packages = [...selected].sort().map((name) => {
      const row = rows.get(name); const scripts = Object.fromEntries(checks.map((key) => [key, row.manifest.scripts?.[key] ?? null]));
      if (!Object.values(scripts).some(Boolean) && !plan.builds.some((build) => build.name === name)) throw new Error('owner has no supported checks');
      return { name, directory: row.directory, scripts };
    });
    plan.mode = selected.size ? 'packages' : 'docs'; plan.docsNeeded = docs;
    plan.reasons.push(docs ? 'audited Markdown plus dependency-selected checks' : 'workspace reverse consumers and forward build prerequisites');
  } catch (error) { plan.mode = 'full'; plan.packages = []; plan.builds = []; plan.reasons.push(error.message); }
  return finish();
}

export function validatePlan(plan) {
  if (!plan || plan.version !== 1 || !shaPattern.test(plan.head) || !/^\d+$/.test(plan.runId) || !['full', 'packages', 'docs'].includes(plan.mode) || plan.appTests !== 'external' || plan.runtimeTests !== 'manual/pre-release' || typeof plan.docsCheckScriptOnly !== 'boolean' || typeof plan.docsNeeded !== 'boolean' || !Array.isArray(plan.packages) || !Array.isArray(plan.builds)) throw new Error('invalid plan');
  const { planId, ...body } = plan;
  if (digest(body) !== planId || (plan.mode === 'packages' && !plan.packages.length) || (plan.mode === 'docs' && (!plan.docsNeeded || plan.packages.length))) throw new Error('invalid plan identity or empty selection');
  for (const row of plan.builds) {
    if (!safePath(row.directory) || !safePath(row.outputDirectory) || !row.outputDirectory.startsWith(`${row.directory}/`) || /(?:^|\/)src(?:\/|$)/.test(row.outputDirectory)) throw new Error('invalid build output ownership');
  }
  return true;
}

export function validateAggregate(plan, needs) {
  validatePlan(plan);
  for (const name of ['plan', 'full', 'build', 'checks', 'docs', 'root']) {
    const required = name === 'plan' || (plan.mode === 'full' ? name === 'full' : name === 'build' || name === 'root' || (name === 'checks' && plan.packages.length > 0) || (name === 'docs' && plan.docsNeeded));
    if (needs?.[name]?.result !== (required ? 'success' : 'skipped')) throw new Error(`required coverage ${name}: ${needs?.[name]?.result ?? 'missing'}`);
  }
  return true;
}

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed`);
  return result.stdout;
}
export function resolveComparison(eventName, event, checkoutSha, runGit = git) {
  const sha = (value) => { if (!shaPattern.test(value) || /^0+$/.test(value)) throw new Error('invalid event SHA'); return value; };
  sha(checkoutSha);
  if (eventName === 'pull_request') {
    const head = sha(event.pull_request?.head?.sha); const base = sha(event.pull_request?.base?.sha);
    runGit(['merge-base', '--is-ancestor', head, checkoutSha]);
    runGit(['merge-base', '--is-ancestor', base, checkoutSha]);
    const comparison = sha(runGit(['merge-base', base, head]).trim());
    return { base: comparison, target: head, fullReason: event.pull_request.base.ref === 'release' ? 'release full regression' : null };
  }
  if (eventName === 'push') {
    const base = sha(event.before); const target = sha(event.after);
    if (target !== checkoutSha || event.forced === true) throw new Error('push checkout mismatch or force push');
    runGit(['merge-base', '--is-ancestor', base, target]);
    return { base, target, fullReason: event.ref === 'refs/heads/release' ? 'release full regression' : null };
  }
  return { base: checkoutSha, target: checkoutSha, fullReason: 'manual or unknown event: full regression' };
}
function workspaceRows(ref) {
  const workspace = git(['show', `${ref}:pnpm-workspace.yaml`]);
  if (workspace.replace(/\s/g, '') !== "packages:-'apps/*'-'packages/*'-'examples/cad-preview'") throw new Error('unaudited workspace patterns');
  return git(['ls-tree', '-r', '--name-only', ref]).split('\n').filter((path) => /^(?:(?:apps|packages)\/[^/]+|examples\/cad-preview)\/package\.json$/.test(path)).map((path) => {
    const directory = path.slice(0, -13); const manifest = JSON.parse(git(['show', `${ref}:${path}`]));
    let outputDirectory;
    if (manifest.scripts?.build || manifest.scripts?.['build:library']) {
      const config = ['apps/cad-editor', 'apps/render-editor', 'apps/barocss-site', 'examples/cad-preview'].includes(directory) ? git(['show', `${ref}:${directory}/vite.config.ts`]) : '';
      outputDirectory = buildOutputDirectory(directory, config);
    }
    return { directory, manifest, outputDirectory };
  });
}
function main() {
  const head = git(['rev-parse', 'HEAD']).trim(); const runId = process.env.GITHUB_RUN_ID;
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  let args = { head, runId, packages: [], basePackages: [], changes: [], validBase: false };
  try {
    const comparison = resolveComparison(process.env.GITHUB_EVENT_NAME, event, head);
    const raw = git(['diff', '--name-status', '-z', '-M', comparison.base, comparison.target, '--']).split('\0'); raw.pop();
    const changes = [];
    for (let i = 0; i < raw.length;) { const status = raw[i++]; const first = raw[i++]; changes.push(status.startsWith('R') ? { status, oldPath: first, path: raw[i++] } : { status, path: first }); }
    const contents = {};
    for (const change of changes) for (const path of [change.oldPath, change.path].filter((path) => path?.endsWith('.md') && safePath(path))) {
      const read = (ref) => { try { return git(['show', `${ref}:${path}`]); } catch { return ''; } };
      contents[path] = { before: read(comparison.base), after: read(comparison.target) };
    }
    args = { head, runId, ...comparison, changes, contents, validBase: true, packages: workspaceRows(head), basePackages: workspaceRows(comparison.base) };
  } catch (error) { args.fullReason = `unavailable comparison: ${error.message}`; }
  const plan = createAffectedPlan(args); validatePlan(plan);
  writeFileSync('affected-ci-plan.json', `${JSON.stringify(plan, null, 2)}\n`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `mode=${plan.mode}\ndocs=${plan.docsNeeded}\nmatrix=${JSON.stringify({ package: plan.packages.map(({ name }) => name) })}\n`);
  const summary = `Affected CI: ${plan.mode}\nRequired CI: lint/types/build; runtime tests: manual/pre-release\nApplication tests: external (local / Execute Tester), not a CI pass claim\nReasons: ${plan.reasons.join('; ')}\nChecks: ${plan.packages.map(({ name }) => name).join(', ') || 'full/docs route'}\nBuilds: ${plan.builds.map(({ name }) => name).join(', ')}\nPlan: ${plan.planId}\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
