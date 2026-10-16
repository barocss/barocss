import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMarkdown, createAffectedPlan, validatePlan, validateAggregate, resolveComparison, buildOutputDirectory } from './affected-ci-plan.mjs';
import { validateArtifactManifest, packageCheckCommands, fullCheckCommands, docsValidationScripts, selectAppLintFiles, allAppLintRequired } from './affected-ci-run.mjs';

const head = 'a'.repeat(40);
const runId = '12345';
const docPath = 'apps/library-docs/docs/concepts/coordinates.md';
const releaseNames = ['@barocss/browser', '@barocss/kit', '@barocss/render', '@barocss/server'];
const checkScripts = { 'type-check': 'tsc --noEmit', lint: 'eslint src', test: 'node --test tests/*.mjs' };

function pkg(name, directory, fields = {}) {
  return {
    directory,
    manifest: {
      name,
      scripts: { ...checkScripts, 'build:library': 'node build.mjs' },
      ...fields,
    },
  };
}

function fixtures() {
  return [
    pkg('@barocss/kit', 'packages/barocss'),
    pkg('@barocss/browser', 'packages/barocss-browser', { dependencies: { '@barocss/kit': 'workspace:*' } }),
    pkg('@barocss/server', 'packages/barocss-server', { dependencies: { '@barocss/kit': 'workspace:*' } }),
    pkg('@barocss/render', 'packages/barocss-render', { devDependencies: { '@barocss/release-helper': 'workspace:*' } }),
    pkg('@barocss/release-helper', 'packages/release-helper'),
    pkg('@barocss/prerequisite', 'packages/prerequisite'),
    pkg('@barocss/feature', 'packages/feature', { dependencies: { '@barocss/prerequisite': 'workspace:*' } }),
    pkg('@barocss/unrelated', 'packages/unrelated'),
    pkg('@barocss/library-docs', 'apps/library-docs', {
      scripts: { build: 'node scripts/build-examples.mjs && vitepress build docs', 'check:docs': 'node scripts/check-docs.mjs', 'check:cad-impact': 'node --test scripts/cad-impact-map.test.mjs' },
    }),
  ];
}

function input(overrides = {}) {
  const packages = overrides.packages ?? fixtures();
  return {
    packages,
    basePackages: structuredClone(packages),
    changes: [{ status: 'M', path: 'packages/feature/src/feature.ts' }],
    head,
    runId,
    ...overrides,
  };
}

function names(rows) {
  return rows.map(({ name }) => name).sort();
}

function docsInput(overrides = {}) {
  return input({
    changes: [{ status: 'M', path: docPath }],
    contents: { [docPath]: { before: '# Coordinates\n\nOld explanation.\n', after: '# Coordinates\n\nUpdated explanation.\n' } },
    ...overrides,
  });
}

function successfulNeeds(plan) {
  return Object.fromEntries(['plan', 'full', 'build', 'checks', 'docs', 'root'].map((name) => {
    const required = name === 'plan'
      || (plan.mode === 'full' ? name === 'full' : name === 'build' || name === 'root'
        || (name === 'checks' && plan.mode === 'packages') || (name === 'docs' && plan.docsNeeded));
    return [name, { result: required ? 'success' : 'skipped' }];
  }));
}

function artifact(plan) {
  const directories = plan.builds.map(({ outputDirectory }) => outputDirectory);
  return {
    version: 1,
    head: plan.head,
    runId: plan.runId,
    planId: plan.planId,
    directories,
    files: directories.map((directory) => ({ path: `${directory}/index.js`, sha256: 'b'.repeat(64), bytes: 1 })),
  };
}

test('package plan selects the owner and preserves its exact standalone scripts', () => {
  const plan = createAffectedPlan(input());
  assert.equal(plan.mode, 'packages');
  assert.deepEqual(names(plan.packages), ['@barocss/feature']);
  assert.equal(plan.packages[0].directory, 'packages/feature');
  assert.deepEqual(plan.packages[0].scripts, checkScripts);
  assert.equal(plan.docsNeeded, false);
  assert.ok(plan.reasons.length > 0);
});

test('reverse closure covers dependencies, dev, peer, optional and transitive consumers', () => {
  const packages = fixtures();
  for (const [suffix, category] of Object.entries({ runtime: 'dependencies', development: 'devDependencies', peer: 'peerDependencies', optional: 'optionalDependencies' })) {
    packages.push(pkg(`@barocss/${suffix}`, `packages/${suffix}`, { [category]: { '@barocss/feature': 'workspace:*' } }));
  }
  packages.push(pkg('@barocss/transitive', 'packages/transitive', { dependencies: { '@barocss/peer': 'workspace:*' } }));
  const plan = createAffectedPlan(input({ packages }));
  assert.equal(plan.mode, 'packages');
  assert.deepEqual(names(plan.packages), ['@barocss/development', '@barocss/feature', '@barocss/optional', '@barocss/peer', '@barocss/runtime', '@barocss/transitive']);
});

test('build closure includes prerequisites and all four release packages exactly once', () => {
  const plan = createAffectedPlan(input());
  assert.deepEqual(names(plan.builds), [...releaseNames, '@barocss/feature', '@barocss/prerequisite', '@barocss/release-helper'].sort());
  assert.equal(new Set(plan.builds.map(({ directory }) => directory)).size, plan.builds.length);
  assert.ok(!names(plan.builds).includes('@barocss/unrelated'));
});

test('absent optional check scripts remain explicit nulls', () => {
  const packages = fixtures();
  packages.find(({ manifest }) => manifest.name === '@barocss/feature').manifest.scripts = {
    'type-check': 'tsc --noEmit', 'build:library': 'node build.mjs',
  };
  const plan = createAffectedPlan(input({ packages }));
  assert.equal(plan.mode, 'packages');
  assert.deepEqual(plan.packages[0].scripts, { 'type-check': 'tsc --noEmit', lint: null, test: null });
});

test('selection and plan identity are deterministic and do not mutate inputs', () => {
  const original = input({ changes: [
    { status: 'M', path: 'packages/feature/src/feature.ts' },
    { status: 'A', path: 'packages/prerequisite/tests/new.test.mjs' },
  ] });
  const saved = structuredClone(original);
  const first = createAffectedPlan(original);
  const reordered = structuredClone(original);
  reordered.packages.reverse();
  reordered.basePackages.reverse();
  reordered.changes.reverse();
  assert.deepEqual(createAffectedPlan(reordered), first);
  assert.deepEqual(original, saved);
  assert.equal(first.head, head);
  assert.equal(first.runId, runId);
  assert.equal(typeof first.planId, 'string');
  assert.ok(first.planId.length > 0);
  assert.deepEqual(first.changedPaths, ['packages/feature/src/feature.ts', 'packages/prerequisite/tests/new.test.mjs']);
});

test('missing comparison base, explicit full request and an empty diff fall back to full', () => {
  for (const overrides of [{ validBase: false }, { fullReason: 'release-target' }, { changes: [] }]) {
    const plan = createAffectedPlan(input(overrides));
    assert.equal(plan.mode, 'full');
    assert.ok(plan.reasons.length > 0);
  }
});

test('root configuration, workflows, build scripts, public types and codecs require full', () => {
  for (const path of [
    'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'eslint.config.mjs',
    '.github/workflows/ci.yml', 'scripts/build.mjs', 'packages/feature/build.mjs',
    'packages/feature/tsconfig.json', 'packages/feature/src/index.ts',
    'packages/feature/src/types.ts', 'packages/feature/src/codec.ts',
  ]) {
    assert.equal(createAffectedPlan(input({ changes: [{ status: 'M', path }] })).mode, 'full', path);
  }
});

test('unowned paths and unsupported or unsafe diff entries cannot produce a partial plan', () => {
  for (const change of [
    { status: 'M', path: 'unknown/file.ts' },
    { status: 'M', path: 'packages/missing/src/file.ts' },
    { status: 'U', path: 'packages/feature/src/feature.ts' },
    { status: 'R100', path: 'packages/feature/src/moved.ts' },
    { status: 'M', path: '../packages/feature/src/feature.ts' },
  ]) {
    assert.equal(createAffectedPlan(input({ changes: [change] })).mode, 'full', JSON.stringify(change));
  }
});

test('renames inspect both paths and deletion of a workspace manifest requires full', () => {
  for (const change of [
    { status: 'R100', oldPath: 'unknown/source.ts', path: 'packages/feature/src/moved.ts' },
    { status: 'R100', oldPath: 'packages/feature/src/feature.ts', path: 'unknown/moved.ts' },
    { status: 'R100', oldPath: 'packages/feature/src/types.ts', path: 'packages/feature/src/moved.ts' },
    { status: 'D', path: 'packages/feature/package.json' },
  ]) {
    assert.equal(createAffectedPlan(input({ changes: [change] })).mode, 'full', JSON.stringify(change));
  }
});

test('changed dependency manifests are detected from both sides even without a manifest diff entry', () => {
  for (const category of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const args = input();
    args.packages.find(({ manifest }) => manifest.name === '@barocss/feature').manifest[category] = { '@barocss/unrelated': 'workspace:*' };
    assert.equal(createAffectedPlan(args).mode, 'full', category);
  }
  const args = input();
  args.basePackages.pop();
  assert.equal(createAffectedPlan(args).mode, 'full', 'removed workspace');
});

test('unresolved workspace references, duplicate owners and dependency cycles fail closed', () => {
  const unresolved = fixtures();
  unresolved[6].manifest.dependencies = { '@barocss/missing': 'workspace:*' };
  const cyclic = fixtures();
  cyclic[5].manifest.dependencies = { '@barocss/feature': 'workspace:*' };
  const duplicateName = fixtures();
  duplicateName.push(pkg('@barocss/feature', 'packages/duplicate'));
  const duplicateDirectory = fixtures();
  duplicateDirectory.push(pkg('@barocss/duplicate', 'packages/feature'));
  for (const packages of [unresolved, cyclic, duplicateName, duplicateDirectory, []]) {
    assert.equal(createAffectedPlan(input({ packages })).mode, 'full');
  }
});

test('known undeclared core edges require conservative full regression', () => {
  const packages = fixtures();
  for (const path of [
    'packages/barocss/src/feature.ts', 'packages/barocss-browser/src/feature.ts',
    'packages/barocss-server/src/feature.ts',
  ]) {
    assert.equal(createAffectedPlan(input({ packages, changes: [{ status: 'M', path }] })).mode, 'full', path);
  }
});

test('plain documentation retains docs execution and the release build closure', () => {
  const plan = createAffectedPlan(docsInput());
  assert.equal(plan.mode, 'docs');
  assert.equal(plan.docsNeeded, true);
  assert.deepEqual(plan.packages, []);
  assert.deepEqual(names(plan.builds), [...releaseNames, '@barocss/release-helper'].sort());
});

test('static fenced code is plain Markdown even when illustrating executable syntax', () => {
  for (const text of [
    '# Guide\n\nSimple text and [a link](./next.md).\n',
    '```vue\n<script setup>import Widget from "./Widget.vue"</script>\n<Widget />\n{{ value }}\n```\n',
    '~~~html\n<div v-if="ready">Example</div>\n~~~\n',
  ]) {
    assert.equal(classifyMarkdown(text), true, text);
    assert.equal(createAffectedPlan(docsInput({ contents: { [docPath]: { before: text, after: text } } })).mode, 'docs');
  }
});

test('executable Markdown, frontmatter, imports, interpolation and include conventions require full', () => {
  for (const text of [
    '<Widget />\n', '<script setup>const value = 1</script>\n', '<div>HTML</div>\n',
    '{{ value }}\n', 'import Widget from "./Widget.vue"\n', '<!--@include: ./other.md-->\n',
    '<<< @/example.ts\n', '---\nlayout: home\n---\n# Home\n', '```vue\n<Widget />\n',
  ]) {
    assert.equal(classifyMarkdown(text), false, text);
    for (const [before, after] of [['# Plain\n', text], [text, '# Plain\n']]) {
      assert.equal(createAffectedPlan(docsInput({ contents: { [docPath]: { before, after } } })).mode, 'full', text);
    }
  }
});

test('missing document content, unknown assets and executable docs paths require full', () => {
  assert.equal(createAffectedPlan(docsInput({ contents: {} })).mode, 'full');
  for (const path of [
    'apps/library-docs/docs/assets/new.svg', 'apps/library-docs/docs/.vitepress/config.ts',
    'apps/library-docs/docs/public/example.js', 'apps/library-docs/scripts/check-docs.mjs',
    'apps/library-docs/docs/components/Widget.vue',
  ]) {
    assert.equal(createAffectedPlan(input({ changes: [{ status: 'M', path }] })).mode, 'full', path);
  }
});

test('mixed package and plain docs changes require both selected package checks and docs', () => {
  const args = docsInput();
  args.changes.push({ status: 'M', path: 'packages/feature/src/feature.ts' });
  const plan = createAffectedPlan(args);
  assert.equal(plan.mode, 'packages');
  assert.equal(plan.docsNeeded, true);
  assert.deepEqual(names(plan.packages), ['@barocss/feature']);
});

test('aggregate accepts exactly the successful selected jobs in full, package and docs plans', () => {
  for (const args of [input({ fullReason: 'manual-full' }), input(), docsInput()]) {
    const plan = createAffectedPlan(args);
    assert.doesNotThrow(() => validateAggregate(plan, successfulNeeds(plan)), plan.mode);
  }
});

test('aggregate rejects every required job failure, cancellation, skip or missing result', () => {
  for (const args of [input({ fullReason: 'manual-full' }), input(), docsInput()]) {
    const plan = createAffectedPlan(args);
    const passing = successfulNeeds(plan);
    for (const [name, { result }] of Object.entries(passing)) {
      if (result !== 'success') continue;
      for (const result of ['failure', 'cancelled', 'skipped']) {
        assert.throws(() => validateAggregate(plan, { ...passing, [name]: { result } }), `${plan.mode}/${name}/${result}`);
      }
      const missing = structuredClone(passing);
      delete missing[name];
      assert.throws(() => validateAggregate(plan, missing), `${plan.mode}/${name}/missing`);
    }
  }
});

test('aggregate rejects invalid or empty plans and failed supposedly unselected jobs', () => {
  const plan = createAffectedPlan(input());
  const needs = successfulNeeds(plan);
  for (const invalid of [null, {}, { ...plan, mode: 'unknown' }, { ...plan, packages: [] }, { ...plan, planId: '' }]) {
    assert.throws(() => validateAggregate(invalid, needs));
  }
  assert.throws(() => validateAggregate(plan, { ...needs, full: { result: 'failure' } }));
  assert.throws(() => validateAggregate(plan, { ...needs, docs: { result: 'cancelled' } }));
});

test('artifact manifest accepts nonempty expected dist trees for the exact run, head and plan', () => {
  const plan = createAffectedPlan(input());
  const manifest = artifact(plan);
  assert.equal(validateArtifactManifest(manifest, plan), true);
  manifest.files[0].bytes = 0;
  assert.equal(validateArtifactManifest(manifest, plan), true, 'an empty file is allowed inside a nonempty dist tree');
});

test('artifact manifest rejects stale or missing identity and unexpected versions', () => {
  const plan = createAffectedPlan(input());
  for (const [key, value] of Object.entries({ version: 2, head: 'c'.repeat(40), runId: '98765', planId: 'another-plan' })) {
    assert.throws(() => validateArtifactManifest({ ...artifact(plan), [key]: value }, plan), key);
    const missing = artifact(plan);
    delete missing[key];
    assert.throws(() => validateArtifactManifest(missing, plan), `missing ${key}`);
  }
});

test('artifact manifest rejects missing, duplicate, unowned or empty output directories', () => {
  const plan = createAffectedPlan(input());
  const manifest = artifact(plan);
  for (const directories of [
    [], manifest.directories.slice(1), [...manifest.directories, manifest.directories[0]],
    [...manifest.directories, 'packages/unrelated/dist'],
  ]) {
    assert.throws(() => validateArtifactManifest({ ...manifest, directories }, plan));
  }
  assert.throws(() => validateArtifactManifest({ ...manifest, files: [] }, plan));
  assert.throws(() => validateArtifactManifest({ ...manifest, files: manifest.files.slice(1) }, plan));
});

test('artifact manifest rejects duplicate files, traversal, unsafe ownership and invalid file metadata', () => {
  const plan = createAffectedPlan(input());
  const manifest = artifact(plan);
  assert.throws(() => validateArtifactManifest({ ...manifest, files: [...manifest.files, manifest.files[0]] }, plan));
  for (const change of [
    { path: '../outside.js' }, { path: '/tmp/outside.js' },
    { path: `${manifest.directories[0]}/../../outside.js` },
    { path: `${manifest.directories[0]}\\outside.js` },
    { path: 'packages/unrelated/dist/index.js' }, { path: 'packages/feature/src/index.ts' },
    { sha256: 'not-a-hash' }, { sha256: 'a'.repeat(63) },
    { bytes: -1 }, { bytes: 1.5 }, { bytes: '1' },
  ]) {
    const files = [{ ...manifest.files[0], ...change }, ...manifest.files.slice(1)];
    assert.throws(() => validateArtifactManifest({ ...manifest, files }, plan), JSON.stringify(change));
  }
});


test('event comparison uses PR merge base and verifies both event parents against checkout', () => {
  const base = 'b'.repeat(40), pullHead = 'c'.repeat(40), ancestor = 'd'.repeat(40);
  const calls = [];
  const result = resolveComparison('pull_request', { pull_request: { base: { sha: base, ref: 'develop' }, head: { sha: pullHead } } }, head, (args) => {
    calls.push(args); return args.includes('--is-ancestor') ? '' : ancestor + '\n';
  });
  assert.deepEqual(result, { base: ancestor, target: pullHead, fullReason: null });
  assert.deepEqual(calls, [['merge-base', '--is-ancestor', pullHead, head], ['merge-base', '--is-ancestor', base, head], ['merge-base', base, pullHead]]);
  assert.throws(() => resolveComparison('pull_request', { pull_request: { base: { sha: base }, head: { sha: pullHead } } }, head, () => { throw new Error('not ancestor'); }));
});

test('push comparison rejects missing, zero, non-ancestor, forced and wrong-checkout SHAs', () => {
  const before = 'b'.repeat(40);
  const event = { before, after: head, ref: 'refs/heads/develop' };
  assert.deepEqual(resolveComparison('push', event, head, () => ''), { base: before, target: head, fullReason: null });
  for (const change of [{ before: '0'.repeat(40) }, { before: 'bad; echo injected' }, { after: before }, { forced: true }]) assert.throws(() => resolveComparison('push', { ...event, ...change }, head, () => ''));
  assert.throws(() => resolveComparison('push', event, head, () => { throw new Error('not ancestor'); }));
  assert.ok(resolveComparison('push', { ...event, ref: 'refs/heads/release' }, head, () => '').fullReason);
  assert.ok(resolveComparison('workflow_dispatch', {}, head).fullReason);
});


test('full CI keeps type/lint/build phases and excludes every apps workspace from test execution', () => {
  const rootManifest = { scripts: { check: 'pnpm type-check && pnpm lint && pnpm build:library && pnpm test', test: 'pnpm run -r test' } };
  assert.deepEqual(fullCheckCommands(rootManifest), [
    ['type-check'], ['lint'], ['build:library'], ['--recursive', '--filter', './apps/**', '--if-present', 'run', 'build'],
  ]);
  assert.throws(() => fullCheckCommands({ scripts: { ...rootManifest.scripts, check: rootManifest.scripts.check + ' && extra-gate' } }));
  assert.throws(() => fullCheckCommands({ scripts: { ...rootManifest.scripts, test: 'pnpm run -r test && extra-gate' } }));
});

test('affected apps retain compile/lint/build coverage while test commands stay external', () => {
  const packages = fixtures();
  packages.push({ ...pkg('@barocss/application', 'apps/application'), outputDirectory: 'apps/application/dist' });
  const plan = createAffectedPlan(input({ packages, changes: [{status:'M', path:'apps/application/src/app.ts'}] }));
  assert.equal(plan.mode, 'packages');
  assert.equal(plan.appTests, 'external');
  assert.deepEqual(packageCheckCommands(plan.packages[0]).map(([name]) => name), ['type-check', 'lint']);
  assert(plan.builds.some(({name}) => name === '@barocss/application'));
  for (const directory of ['apps/cad-studio', 'apps/library-docs', 'apps/future-app']) {
    assert(!packageCheckCommands({directory, scripts: checkScripts}).some(([name]) => name === 'test'));
  }
});

test('package and non-app example tests stay out of required CI and docs static checks remain', () => {
  for (const directory of ['packages/feature', 'packages/barocss-cad']) {
    assert.deepEqual(packageCheckCommands({directory, scripts:checkScripts}).map(([name]) => name), ['type-check', 'lint']);
  }
  assert.deepEqual(docsValidationScripts, ['build', 'check:docs', 'check:api']);
  for (const script of ['check:cad-impact', 'check:cad-evidence', 'test']) assert(!docsValidationScripts.includes(script));
});


test('source-derived output directories cover a Vite outDir and both VitePress apps', () => {
  assert.equal(buildOutputDirectory('apps/cad-studio', "build:{outDir:'studio-dist'}"), 'apps/cad-studio/studio-dist');
  for (const directory of ['apps/library-docs', 'apps/barocss-docs']) assert.equal(buildOutputDirectory(directory), `${directory}/docs/.vitepress/dist`);
  assert.equal(buildOutputDirectory('apps/barocss-site', 'export default {}'), 'apps/barocss-site/dist');
  for (const config of ["outDir: '../escape'", 'outDir: computed', "outDir:'a',outDir:'b'"]) assert.throws(() => buildOutputDirectory('apps/cad-studio', config));
  assert.throws(() => buildOutputDirectory('apps/unknown'));
  const packages = fixtures();
  packages.push({ ...pkg('@barocss/cad-studio-app', 'apps/cad-studio'), outputDirectory: 'apps/cad-studio/studio-dist' });
  const plan = createAffectedPlan(input({ packages, changes: [{ status: 'M', path: 'apps/cad-studio/src/entry.ts' }] }));
  assert.equal(plan.mode, 'packages');
  const manifest = artifact(plan);
  assert(manifest.directories.includes('apps/cad-studio/studio-dist'));
  assert.equal(validateArtifactManifest(manifest, plan), true);
  const wrong = structuredClone(manifest);
  wrong.directories = wrong.directories.map((p) => p.replace('studio-dist', 'dist'));
  assert.throws(() => validateArtifactManifest(wrong, plan));
});

test('manual regression retains package tests while required full mode has no test command', () => {
  const root = { scripts: { check: 'pnpm type-check && pnpm lint && pnpm build:library && pnpm test', test: 'pnpm run -r test' } };
  assert(!fullCheckCommands(root).some((args) => args.includes('test')));
  assert.deepEqual(fullCheckCommands(root, true).at(-1), ['--recursive', '--filter', '!./apps/**', 'run', 'test']);
});


test('app lint fallback selects safe changed tracked code without generated or foreign files', () => {
  const files = ['apps/cad-studio/src/a.ts', 'apps/cad-studio/src/b.tsx', 'apps/cad-studio/native-flow.mjs', 'apps/cad-studio/README.md', 'apps/other/src/a.ts'];
  assert.deepEqual(selectAppLintFiles('apps/cad-studio', files, ['apps/cad-studio/src/a.ts', 'apps/cad-studio/dist/new.js', 'apps/other/src/a.ts']), ['apps/cad-studio/src/a.ts']);
  assert.deepEqual(selectAppLintFiles('apps/cad-studio', files, [], true), files.slice(0, 3).sort());
  assert.deepEqual(selectAppLintFiles('apps/cad-studio', files, ['apps/cad-studio/deleted.ts']), []);
  for (const path of ['apps/cad-studio/../secret.ts', '/tmp/secret.ts', 'apps/cad-studio/a;echo.ts']) assert.throws(() => selectAppLintFiles('apps/cad-studio', [path], []));
  assert.throws(() => selectAppLintFiles('packages/other', files, []));
});

test('app lint uses all owned code for config, dependency, unknown-base and regression changes', () => {
  const plan = { changedPaths: ['apps/cad-studio/src/a.ts'], reasons: [] };
  assert.equal(allAppLintRequired(plan, "import js from '@eslint/js'"), false);
  for (const path of ['eslint.config.mjs', 'pnpm-lock.yaml', 'packages/tool/package.json', 'tools/custom-lint.mjs']) assert.equal(allAppLintRequired({ ...plan, changedPaths: [path] }, ''), true, path);
  assert.equal(allAppLintRequired({ ...plan, changedPaths: [] }, ''), true);
  assert.equal(allAppLintRequired({ ...plan, reasons: ['unavailable comparison: missing base'] }, ''), true);
  for (const config of ["import local from './plugin.mjs'", "import './plugin.mjs'", "import('./plugin.mjs')", "require('./plugin.cjs')", "new URL('./plugin.mjs', import.meta.url)", 'import(pluginPath)', 'require(pluginPath)']) assert.equal(allAppLintRequired(plan, config), true, config);
  assert.equal(allAppLintRequired(plan, '', true), true);
  assert.equal(allAppLintRequired({ ...plan, changedPaths: ['.github/workflows/ci.yml'] }, ''), false);
});

test('verified docs check registration keeps full CI but does not widen unrelated app lint', () => {
  const args = input({ changes: [{ status: 'M', path: 'apps/library-docs/package.json' }] });
  args.packages.find(row => row.directory === 'apps/library-docs').manifest.scripts['check:docs'] = 'node scripts/new-check.mjs && node scripts/check-docs.mjs';
  const plan = createAffectedPlan(args);
  validatePlan(plan);
  assert.equal(plan.mode, 'full');
  assert.equal(plan.docsNeeded, true);
  assert.equal(plan.docsCheckScriptOnly, true);
  assert.equal(allAppLintRequired(plan, ''), false);
  const tracked = ['apps/cad-studio/src/old.ts', 'apps/library-docs/scripts/new-check.mjs', 'apps/library-docs/scripts/old-check.mjs'];
  assert.deepEqual(selectAppLintFiles('apps/cad-studio', tracked, plan.changedPaths, false), []);
  const ownAll = plan.changedPaths.includes('apps/library-docs/package.json');
  assert.deepEqual(selectAppLintFiles('apps/library-docs', tracked, plan.changedPaths, ownAll), tracked.slice(1));
});

test('docs exception rejects every additional script, lifecycle, metadata and dependency change', () => {
  for (const change of [
    ...['prepare', 'preinstall', 'install', 'postinstall', 'lint', 'type-check', 'build', 'test', 'check:other'].map(key => manifest => { manifest.scripts[key] = 'node other.mjs'; }),
    manifest => { manifest.dependencies = { eslint: '^9.0.0' }; },
    manifest => { manifest.version = '2.0.0'; },
    manifest => { delete manifest.scripts['check:docs']; },
    manifest => { manifest.scripts['check:docs'] = null; },
  ]) {
    const args = input({ changes: [{ status: 'M', path: 'apps/library-docs/package.json' }] });
    const manifest = args.packages.find(row => row.directory === 'apps/library-docs').manifest;
    manifest.scripts['check:docs'] = 'node scripts/new-check.mjs'; change(manifest);
    const plan = createAffectedPlan(args);
    assert.equal(plan.mode, 'full'); assert.equal(plan.docsCheckScriptOnly, false);
    assert.equal(allAppLintRequired(plan, ''), true);
  }
});

test('missing renamed or uncertain docs manifests and checkout-only drift retain global lint', () => {
  for (const change of [{ status: 'A', path: 'apps/library-docs/package.json' },
    { status: 'D', path: 'apps/library-docs/package.json' },
    { status: 'R100', oldPath: 'apps/old-docs/package.json', path: 'apps/library-docs/package.json' },
    { status: 'M', path: 'apps/library-docs/package.json', oldPath: 'apps/library-docs/package.json' }]) {
    const args = input({ changes: [change] });
    args.packages.find(row => row.directory === 'apps/library-docs').manifest.scripts['check:docs'] = 'node new.mjs';
    const plan = createAffectedPlan(args); assert.equal(plan.docsCheckScriptOnly, false); assert.equal(allAppLintRequired(plan, ''), true);
  }
  for (const alter of [args => { args.validBase = false; }, args => { args.basePackages = []; },
    args => { args.basePackages = args.basePackages.filter(row => row.directory !== 'apps/library-docs'); },
    args => { args.packages.find(row => row.directory === 'packages/feature').manifest.dependencies = { eslint: '^9.0.0' }; }]) {
    const args = input({ changes: [{ status: 'M', path: 'apps/library-docs/package.json' }] });
    args.packages.find(row => row.directory === 'apps/library-docs').manifest.scripts['check:docs'] = 'node new.mjs'; alter(args);
    const plan = createAffectedPlan(args); assert.equal(plan.docsCheckScriptOnly, false); assert.equal(allAppLintRequired(plan, ''), true);
  }
});

test('docs exception never masks concurrent root dependency lint type or build inputs', () => {
  const args = input({ changes: [{ status: 'M', path: 'apps/library-docs/package.json' }] });
  args.packages.find(row => row.directory === 'apps/library-docs').manifest.scripts['check:docs'] = 'node new.mjs';
  for (const path of ['package.json', 'pnpm-lock.yaml', 'packages/tool/package.json', 'eslint.config.mjs',
    'apps/cad-studio/eslint.config.mjs', 'apps/cad-studio/tsconfig.json', 'apps/cad-studio/vite.config.ts', 'apps/cad-studio/scripts/build.mjs']) {
    const plan = createAffectedPlan({ ...args, changes: [...args.changes, { status: 'M', path }] });
    assert.equal(allAppLintRequired(plan, ''), true, path);
  }
  const plan = createAffectedPlan({ ...args, changes: [...args.changes, { status: 'M', path: 'apps/cad-studio/src/changed.tsx' }] });
  assert.equal(allAppLintRequired(plan, ''), false);
  assert.deepEqual(selectAppLintFiles('apps/cad-studio', ['apps/cad-studio/src/changed.tsx', 'apps/cad-studio/src/old.tsx'], plan.changedPaths), ['apps/cad-studio/src/changed.tsx']);
  assert.equal(allAppLintRequired(plan, '', true), true);
});

function gpuRegistrationInput(name = 'engine-webgpu-submit-frame') {
  const packages = fixtures();
  packages.push(pkg('@barocss/gpu', 'packages/barocss-gpu', { scripts: {
    ...checkScripts,
    test: 'node --test tests/first.test.mjs ../../examples/gpu-scene/primitive-device-receipt-gate.test.mjs tests/last.test.mjs',
  } }));
  const path = `packages/barocss-gpu/tests/${name}.test.mjs`;
  const args = input({ packages, changes: [
    { status: 'M', path: 'packages/barocss-gpu/package.json' },
    { status: 'A', path },
    { status: 'A', path: `packages/barocss-gpu/src/${name}.ts` },
  ], fileModes: { [path]: '100644' } });
  packages.at(-1).manifest.scripts.test = packages.at(-1).manifest.scripts.test.replace(' tests/last', ` tests/${name}.test.mjs tests/last`);
  return args;
}

test('GPU additive test registration keeps full checks and unchanged external runtime policy', () => {
  for (const name of ['engine-webgpu-submit-frame', 'engine-webgpu-one-shot', 'engine-webgpu-canvas-config', 'engine-webgpu-present']) {
    const plan = createAffectedPlan(gpuRegistrationInput(name));
    validatePlan(plan);
    assert.equal(plan.mode, 'full');
    assert.equal(plan.gpuTestRegistrationOnly, true);
    assert.equal(plan.docsCheckScriptOnly, false);
    assert.equal(allAppLintRequired(plan, ''), false);
    assert.equal(allAppLintRequired(plan, '', true), true);
    assert.equal(plan.appTests, 'external');
    assert.equal(plan.runtimeTests, 'manual/pre-release');
    assert.deepEqual(selectAppLintFiles('apps/cad-studio', ['apps/cad-studio/src/old.ts'], plan.changedPaths), []);
  }
});

test('GPU registration rejects removals reordering duplicate args options and shell syntax', () => {
  for (const mutate of [
    text => text.replace('tests/first.test.mjs ', ''),
    text => text.replace('tests/first.test.mjs', 'tests/last.test.mjs').replace(/tests\/last.test.mjs$/, 'tests/first.test.mjs'),
    text => text + ' tests/first.test.mjs',
    text => text + ' --test-concurrency=2',
    text => text + ' && node other.mjs',
    text => text.replace('node --test', 'node --import hook.mjs --test'),
    text => text.replace('node --test', 'NODE_OPTIONS=x node --test'),
    text => text.replace('node --test ', 'node --test\t'),
    text => text.replace('tests/engine-webgpu-submit-frame.test.mjs', 'tests/../escape.test.mjs'),
    text => text.replace('tests/engine-webgpu-submit-frame.test.mjs', 'tests/*.test.mjs'),
    text => text.replace('tests/engine-webgpu-submit-frame.test.mjs', '"tests/engine-webgpu-submit-frame.test.mjs"'),
    text => text.replace('tests/engine-webgpu-submit-frame.test.mjs', 'tests/$(command).test.mjs'),
  ]) {
    const args = gpuRegistrationInput(); args.packages.at(-1).manifest.scripts.test = mutate(args.packages.at(-1).manifest.scripts.test);
    const plan = createAffectedPlan(args);
    assert.equal(plan.gpuTestRegistrationOnly, false); assert.equal(allAppLintRequired(plan, ''), true);
  }
});

test('GPU registration requires added regular tracked files and trusted unchanged manifest ownership', () => {
  for (const mutate of [
    args => { args.fileModes = {}; },
    ...['120000', '160000', '040000'].map(mode => args => { args.fileModes[args.changes[1].path] = mode; }),
    ...['M', 'D', 'R100'].map(status => args => { args.changes[1].status = status; }),
    args => { args.changes[1].oldPath = 'packages/barocss-gpu/tests/old.test.mjs'; },
    args => { args.changes.push({ ...args.changes[1] }); },
    ...['A', 'D', 'R100'].map(status => args => { args.changes[0].status = status; }),
    args => { args.changes[0].oldPath = 'packages/old/package.json'; },
    args => { args.validBase = false; },
    args => { args.basePackages = []; },
    args => { args.basePackages.pop(); },
    args => { args.fullReason = 'manual or unknown event'; },
  ]) {
    const args = gpuRegistrationInput(); mutate(args);
    const plan = createAffectedPlan(args);
    assert.equal(plan.gpuTestRegistrationOnly, false); assert.equal(allAppLintRequired(plan, ''), true);
  }
  const executable = gpuRegistrationInput(); executable.fileModes[executable.changes[1].path] = '100755';
  assert.equal(createAffectedPlan(executable).gpuTestRegistrationOnly, true);
});

test('GPU registration rejects every other manifest field and lifecycle script change', () => {
  for (const mutate of [
    ...['prepare', 'preinstall', 'install', 'postinstall', 'lint', 'type-check', 'build', 'test:consumer'].map(key => manifest => { manifest.scripts[key] = 'node changed.mjs'; }),
    manifest => { manifest.dependencies = { eslint: '^9.0.0' }; },
    manifest => { manifest.exports = { '.': './other.js' }; },
    manifest => { manifest.version = '9.0.0'; },
    manifest => { delete manifest.scripts.test; },
  ]) {
    const args = gpuRegistrationInput(); mutate(args.packages.at(-1).manifest);
    const plan = createAffectedPlan(args);
    assert.equal(plan.gpuTestRegistrationOnly, false); assert.equal(allAppLintRequired(plan, ''), true);
  }
  const drift = gpuRegistrationInput(); drift.packages[0].manifest.scripts.prepare = 'node other.mjs';
  assert.equal(createAffectedPlan(drift).gpuTestRegistrationOnly, false);
  const combined = gpuRegistrationInput(); combined.packages.find(row => row.directory === 'apps/library-docs').manifest.scripts['check:docs'] = 'node extra.mjs';
  combined.changes.push({ status: 'M', path: 'apps/library-docs/package.json' });
  const plan = createAffectedPlan(combined);
  assert.equal(plan.gpuTestRegistrationOnly, false); assert.equal(plan.docsCheckScriptOnly, false); assert.equal(allAppLintRequired(plan, ''), true);
});

test('GPU registration cannot hide concurrent root config or app ownership changes', () => {
  for (const path of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', 'eslint.config.mjs',
    'apps/cad-studio/package.json', 'apps/cad-studio/tsconfig.json', 'apps/cad-studio/vite.config.ts',
    'apps/cad-studio/scripts/build.mjs', 'packages/barocss-gpu/tsconfig.json', 'tools/lint-plugin.mjs']) {
    const args = gpuRegistrationInput(); args.changes.push({ status: 'M', path });
    assert.equal(allAppLintRequired(createAffectedPlan(args), ''), true, path);
  }
  const args = gpuRegistrationInput(); args.changes.push({ status: 'M', path: 'apps/cad-studio/src/changed.tsx' });
  const plan = createAffectedPlan(args);
  assert.equal(allAppLintRequired(plan, ''), false);
  assert.deepEqual(selectAppLintFiles('apps/cad-studio', ['apps/cad-studio/src/changed.tsx', 'apps/cad-studio/src/old.tsx'], plan.changedPaths), ['apps/cad-studio/src/changed.tsx']);
  assert.equal(allAppLintRequired(plan, "import './local-lint-plugin.mjs'"), true);
});
