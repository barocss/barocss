// D521/P0-R01. Root runs this desktop driver under the heavy gate with all writers frozen.
// Usage: node test/project-version-ownership-browser.mjs /absolute/new/artifact-dir --case=branch-to-B --expect=fixed
// --expect=repro checks the same public actions for the original stale completion. It is not a safety PASS.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';
import { installD322NativeSaveScheduler } from './late-save-native-scheduler.mjs';

const output = process.argv[2];
const args = new Map(process.argv.slice(3).map(arg => { const [key, value] = arg.split('='); return [key, value]; }));
const scenario = args.get('--case') ?? 'branch-to-B', expectation = args.get('--expect') ?? 'fixed';
assert.ok(['branch-to-B'].includes(scenario), 'This first driver covers only branch-to-B');
assert.ok(['fixed', 'repro'].includes(expectation), 'Use --expect=fixed or --expect=repro');
assert.ok(output && isAbsolute(output), 'An absolute, unused artifact directory is required');
const repo = resolve(import.meta.dirname, '../../..'), relation = relative(repo, resolve(output));
assert.ok(relation.startsWith('../'), 'Raw artifacts must stay outside this Git worktree');
await mkdir(output); // Refuse reuse: failed receipts and screenshots must remain intact.
const projectName = `d521-${randomUUID()}`, namespace = `projects/${projectName}/`;
const target = `${namespace}.barocss/versions/A.bcad.json`;

// Read-only: native file reads use the scheduler's inspection scope. No product action is called here.
async function snapshotExtra() {
  const scheduler = window.__d322Save, trace = scheduler.snapshot();
  const root = await scheduler.inspectRoot(), nativeFiles = [];
  const readDirectory = async (directory, prefix) => {
    for await (const [name, handle] of directory.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === 'directory') await readDirectory(handle, path);
      else {
        const file = await handle.getFile();
        nativeFiles.push({ path, size: file.size, tag: `${file.size}-${file.lastModified}`, text: await file.text() });
      }
    }
  };
  const projectName = trace.namespace.split('/')[1];
  await readDirectory(await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName), trace.namespace.slice(0, -1));
  nativeFiles.sort((a, b) => a.path.localeCompare(b.path));
  return {
    project: document.querySelector('[aria-label="Project"]')?.textContent ?? null,
    activePath: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
    fileName: document.querySelector('.doc-tab input')?.value ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    recovery: localStorage.getItem('studio.recovery'),
    versions: [...document.querySelectorAll('[aria-label="Versions"] > li')].map(row => row.getAttribute('aria-label')),
    branch: document.querySelector('select[aria-label="Branch"]')?.value ?? null,
    branchOptions: [...(document.querySelector('select[aria-label="Branch"]')?.options ?? [])].map(option => option.value),
    offered: document.querySelector('[aria-label="Autosaved work"]')?.textContent ?? null,
    versionsPanel: document.querySelector('[aria-label="Versions panel"]')?.textContent ?? null,
    nativeFiles, scheduler: scheduler.snapshot(),
  };
}

const f = await createFlow({
  name: 'project-version-ownership', envFrozen: 'D521_SOURCE_FROZEN', output,
  qualification: `D521/P0-R01 ${scenario}: ${expectation === 'fixed' ? 'current-owner safety contract' : 'baseline stale-completion reproduction only'}`,
  initialFiles: ['apps/cad-studio/test/project-version-ownership-browser.mjs', 'apps/cad-studio/test/late-save-native-scheduler.mjs'],
  requiredFrozen: ['apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/storage/VersionsPanel.tsx', 'apps/cad-studio/src/App.tsx'],
  extraFrozen: ['packages/barocss-cad-model/src/versions/log.ts', 'packages/barocss-cad-model/src/versions/merge.ts'],
  snapshotExtra,
  limits: ['Desktop 1440x900 only; no mobile.', 'Only public branch switch A followed by public Open B in one browser project.',
    'Close/detach, intervening edits, merge, storage conflicts and other-project cases are NOT_RUN by this first driver.',
    'Native close is held after actual commit; storage writes are not cancelled or rolled back.',
    'Document/log ownership proof only; no new geometric or physical accuracy claim.', 'Root must review the screenshots.'],
});
f.report.scenario = scenario; f.report.expectation = expectation; f.report.projectName = projectName; f.report.target = target;
const labels = new Set();
const capture = async label => { assert.ok(!labels.has(label), 'Snapshot labels must be unique'); labels.add(label); return f.snapshot(label); };
const native = (state, suffix) => state.nativeFiles.find(file => file.path === `${namespace}${suffix}`);

await f.run(async () => {
  await f.newPage();
  await f.page.setViewportSize({ width: 1440, height: 900 });
  await f.context.addInitScript(installD322NativeSaveScheduler, { projectName });
  await f.page.reload(); await f.ready();
  const card = f.page.locator('[aria-label="Versions panel"]');
  const newBox = async (name, dimensions) => {
    await f.page.getByRole('button', { name: 'New part', exact: true }).click();
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.page.keyboard.press('b'); await f.page.locator('.hud').waitFor();
    for (const [label, value] of [['Width X', dimensions[0]], ['Depth Y', dimensions[1]], ['Height Z', dimensions[2]]]) {
      await f.page.locator('.hud .field', { has: f.page.locator(`span:text-is("${label}")`) }).locator('input').fill(String(value));
    }
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
    await f.page.locator('.hud button', { hasText: 'Apply' }).click(); await f.ready();
    await f.page.locator('.doc-tab input').fill(name);
  };
  const makeVersion = async name => {
    await card.getByLabel('Version name', { exact: true }).fill(name);
    await card.getByRole('button', { name: 'Make version', exact: true }).click();
    await card.getByLabel(`Version ${name}`, { exact: true }).waitFor();
  };
  try {
    f.phase = 'public UI author A and B with separate version logs';
    await newBox('A', [10, 10, 10]);
    await f.page.getByRole('button', { name: 'Project and versions', exact: true }).click(); await card.waitFor();
    await card.getByLabel('Browser project name', { exact: true }).fill(projectName);
    await card.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await card.getByLabel('Project', { exact: true }).waitFor(); await makeVersion('A-version');
    await card.getByLabel('Branch name', { exact: true }).fill('A-other');
    await card.getByRole('button', { name: 'Make branch', exact: true }).click();
    await f.page.waitForFunction(() => [...document.querySelector('select[aria-label="Branch"]').options].some(option => option.value === 'A-other'));
    await capture('01-A-authored');
    await newBox('B', [12, 13, 14]); await makeVersion('B-version');
    const controlB = await capture('02-B-control');
    assert.equal(controlB.activePath, 'B.bcad'); assert.ok(controlB.versions.includes('Version B-version'));
    await card.getByRole('button', { name: 'Open A.bcad', exact: true }).click(); await f.ready();
    await card.getByLabel('Version A-version', { exact: true }).waitFor();
    const controlA = await capture('03-A-current');
    assert.notDeepEqual(controlA.doc, controlB.doc, 'Publicly authored parts must differ');
    assert.equal(controlA.branchOptions.includes('A-other'), true);

    f.phase = 'hold original A branch log close after native commit';
    await f.page.evaluate(path => window.__d322Save.arm(path), target);
    await card.getByLabel('Branch', { exact: true }).selectOption('A-other');
    await f.page.waitForFunction(() => window.__d322Save.snapshot().claimed?.closedNative === true, null, { timeout: 15000 });
    const held = await capture('04-A-close-held');
    assert.equal(held.scheduler.claimed.path, target); assert.equal(held.scheduler.claimed.returnedToCaller, false);
    assert.equal(JSON.parse(native(held, '.barocss/versions/A.bcad.json').text).current, 'A-other');

    f.phase = 'complete newer public Open B before releasing old A';
    await card.getByRole('button', { name: 'Open B.bcad', exact: true }).click();
    await card.getByLabel('Version B-version', { exact: true }).waitFor(); await f.same(controlB.doc);
    const before = await capture('05-B-before-release');
    assert.deepEqual(before.doc, controlB.doc); assert.equal(before.activePath, 'B.bcad');
    assert.equal(before.scheduler.claimed.returnedToCaller, false);
    f.report.acceptedBeforeRelease = { doc: before.doc, versions: before.versions, activePath: before.activePath, branch: before.branch };
    await f.persist();

    f.phase = 'release original native close and observe its real continuation';
    await f.page.evaluate(() => window.__d322Save.release());
    await f.page.waitForFunction(() => window.__d322Save.snapshot().claimed?.returnedToCaller === true);
    // The native adapter performs a tag read after close. Wait for that read, then drain its JSON-only continuation.
    await f.page.waitForFunction(path => {
      const events = window.__d322Save.snapshot().events, released = events.find(event => event.kind === 'native-close-return-released');
      return released && events.some(event => event.path === path && event.kind === 'native-getFile-return' && event.scope === 'production' && event.sequence > released.sequence);
    }, target, { timeout: 15000 });
    await f.page.evaluate(() => new Promise(resolve => { const channel = new MessageChannel(); channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); }; channel.port2.postMessage(null); }));
    await f.ready();
    const after = await capture('06-after-old-release');
    f.report.observed = { docRetained: JSON.stringify(after.doc) === JSON.stringify(before.doc), logRetained: JSON.stringify(after.versions) === JSON.stringify(before.versions), activePartRetained: after.activePath === before.activePath };
    await f.persist();
    assert.equal(native(after, 'B.bcad').text, native(before, 'B.bcad').text, 'A log completion must not change native B bytes');
    assert.equal(native(after, '.barocss/versions/B.bcad.json').text, native(before, '.barocss/versions/B.bcad.json').text);
    if (expectation === 'repro') {
      assert.equal(f.report.observed.docRetained, false, 'Baseline must actually replace B with stale A');
      assert.deepEqual(after.doc, controlA.doc);
      f.report.observations.push({ label: 'BASELINE_REPRODUCED_PRODUCT_FAIL', safetyContract: 'FAIL' });
      return;
    }
    assert.deepEqual(after.doc, before.doc, 'Late A branch completion must preserve accepted B document');
    for (const key of ['versions', 'history', 'branchOptions']) assert.deepEqual(after[key], before[key], `B ${key} owner`);
    for (const key of ['activePath', 'fileName', 'project', 'branch', 'dirty', 'offered']) assert.equal(after[key], before[key], `B ${key} owner`);
    assert.equal(after.bodies.fresh, true); assert.equal(after.bodies.massReady, true);

    f.phase = 'newer public Save retains B bytes and ownership';
    const count = after.scheduler.events.length;
    await f.page.getByRole('button', { name: 'Save', exact: true }).click();
    await f.page.waitForFunction(({ path, count }) => window.__d322Save.snapshot().events.some(event => event.sequence >= count && event.kind === 'native-close-committed' && event.path === path), { path: `${namespace}B.bcad`, count });
    await f.page.waitForFunction(() => !document.querySelector('[aria-label="Unsaved changes"]'));
    const saved = await capture('07-newer-B-save');
    assert.deepEqual(saved.doc, before.doc); assert.equal(saved.activePath, 'B.bcad');
    assert.equal(native(saved, 'B.bcad').text, native(before, 'B.bcad').text);
    assert.deepEqual(saved.versions, before.versions); assert.equal(saved.dirty, false);
  } finally {
    await f.page.evaluate(() => window.__d322Save?.release());
  }
});
