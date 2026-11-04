// D522/P0-R02. Root owns heavy execution, frozen writers and screenshot review.
// node test/project-autosave-feedback-browser.mjs /ABS/NEW/OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';
import { installD522AutosaveFailureScheduler } from './autosave-native-failure-scheduler.mjs';

const output = process.argv[2], expectation = process.argv.find(arg => arg.startsWith('--expect='))?.split('=')[1] ?? 'fixed';
assert.ok(['repro', 'fixed'].includes(expectation));
assert.ok(output && isAbsolute(output), 'Use an absolute, new artifact directory');
assert.ok(relative(resolve(import.meta.dirname, '../../..'), resolve(output)).startsWith('../'), 'Raw artifacts must stay outside the worktree');
await mkdir(output); // Never overwrite an earlier failed receipt.
const projectName = `d522-${randomUUID()}`, namespace = `projects/${projectName}/`, target = `${namespace}.barocss/autosave/A.bcad`;
async function snapshotExtra() {
  const schedule = window.__d522Autosave.snapshot();
  const readIfPresent = async path => {
    try { return await window.__d522Autosave.read(path); }
    catch (error) { if (error.name === 'NotFoundError') return null; throw error; }
  };
  return {
    fileName: document.querySelector('.doc-tab input')?.value ?? null,
    activePath: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
    activePathObservation: document.querySelector('[aria-label="Project documents"]') ? 'VISIBLE_PROJECT_DOCUMENTS' : document.querySelector('.render-panel') ? 'NOT_OBSERVABLE_IN_RENDER' : 'PROJECT_DOCUMENTS_NOT_VISIBLE',
    project: document.querySelector('[aria-label="Project"]')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    alerts: [...document.querySelectorAll('.toast[role="alert"]')].map(alert => ({ title: alert.querySelector('.toast-title')?.textContent, hint: alert.querySelector('.toast-hint')?.textContent })),
    nativeAutosave: await readIfPresent(schedule.target),
    nativeSaved: await readIfPresent(`${schedule.namespace}A.bcad`), scheduler: window.__d522Autosave.snapshot(),
  };
}
const f = await createFlow({
  name: 'project-autosave-feedback', envFrozen: 'D522_SOURCE_FROZEN', output,
  qualification: `D522/P0-R02: ${expectation === 'repro' ? 'baseline silent autosave failure reproduction only' : 'current autosave failure feedback and outage reset'}`,
  initialFiles: ['apps/cad-studio/test/project-autosave-feedback-browser.mjs', 'apps/cad-studio/test/autosave-native-failure-scheduler.mjs'],
  requiredFrozen: ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/storage/project.ts', 'apps/cad-studio/src/storage/handleStore.ts'],
  snapshotExtra,
  limits: ['Desktop Chrome 1440x900 only; no mobile.', 'Test-only native writable.write NotAllowedError injection; no actual host permission/quota exhaustion.',
    'One browser project and current A document only. Stale A errors after Open B and corrupt recovery Open are NOT_RUN.',
    'No new geometry accuracy claim. Root must view screenshots.'],
});
Object.assign(f.report, { expectation, projectName, target });
const labels = new Set();
const capture = async label => { assert.ok(!labels.has(label)); labels.add(label); return f.snapshot(label); };
const feedback = state => state.scheduler.notices.filter(notice => /autosav|recovery|recover|automatic.*sav/i.test(`${notice.title} ${notice.hint}`));
const drain = async () => f.page.evaluate(() => new Promise(resolve => { const channel = new MessageChannel(); channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); }; channel.port2.postMessage(null); }));

await f.run(async () => {
  await f.newPage(); await f.page.setViewportSize({ width: 1440, height: 900 });
  await f.context.addInitScript(installD522AutosaveFailureScheduler, { projectName });
  await f.page.reload(); await f.ready();
  const card = f.page.locator('[aria-label="Versions panel"]');
  const gridEdit = async () => {
    const previous = await f.doc(), grid = f.page.getByRole('checkbox', { name: 'Grid', exact: true });
    await grid.setChecked(!(await grid.isChecked())); await f.changed(previous);
    return f.doc();
  };
  const waitEvent = async (kind, since) => {
    await f.page.waitForFunction(({ kind, since, target }) => window.__d522Autosave.snapshot().events.some(event => event.sequence >= since && event.path === target && event.kind === kind), { kind, since, target }, { timeout: 15000 });
    await drain();
  };
  const eventCount = () => f.page.evaluate(() => window.__d522Autosave.snapshot().events.length);
  try {
    f.phase = 'public UI create and save A box into browser project';
    await f.page.getByRole('button', { name: 'New part', exact: true }).click();
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.page.keyboard.press('b'); await f.page.locator('.hud').waitFor();
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
    await f.page.locator('.hud button', { hasText: 'Apply' }).click(); await f.ready();
    await f.page.locator('.doc-tab input').fill('A');
    await f.page.getByRole('button', { name: 'Project and versions', exact: true }).click(); await card.waitFor();
    await card.getByLabel('Browser project name', { exact: true }).fill(projectName);
    await card.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await card.getByLabel('Project', { exact: true }).waitFor();
    await f.page.getByRole('button', { name: 'Save', exact: true }).click();
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent === 'A.bcad' && !document.querySelector('[aria-label="Unsaved changes"]'));
    f.phase = 'public Render workspace and Scene tab before Grid edit';
    await capture('00-A-saved-before-render');
    await f.page.getByRole('button', { name: 'Render', exact: true }).click();
    await f.page.getByRole('tab', { name: 'Scene', exact: true }).waitFor();
    await capture('00-render-before-scene');
    await f.page.getByRole('tab', { name: 'Scene', exact: true }).click();
    await f.page.getByRole('checkbox', { name: 'Grid', exact: true }).waitFor();

    f.phase = 'legitimate public edit and native successful autosave before injection';
    let since = await eventCount(); await gridEdit(); await waitEvent('native-close-committed', since);
    const seed = await capture('01-genuine-autosave');
    assert.ok(seed.nativeAutosave?.size > 0); assert.equal(seed.dirty, true);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(new Uint8Array(seed.nativeAutosave.bytes))), seed.doc);
    await f.dismissToasts();

    f.phase = 'inject native write denial after a genuine copy; public Grid edit';
    await f.page.evaluate(() => window.__d522Autosave.fail());
    since = await eventCount(); const edited = await gridEdit(); await waitEvent('native-abort-return', since);
    const failed = await capture('02-first-autosave-rejected');
    assert.ok(failed.scheduler.events.some(event => event.sequence >= since && event.kind === 'injected-native-write-rejection' && event.path === target));
    assert.deepEqual(failed.doc, edited); assert.equal(failed.dirty, true); assert.equal(failed.fileName, 'A');
    assert.equal(failed.activePathObservation, 'NOT_OBSERVABLE_IN_RENDER');
    assert.equal(failed.nativeAutosave.path, target); assert.equal(failed.nativeSaved.path, `${namespace}A.bcad`);
    assert.deepEqual(failed.nativeAutosave.bytes, seed.nativeAutosave.bytes, 'The previous legitimate autosave copy must survive the aborted write');
    assert.deepEqual(failed.nativeSaved.bytes, seed.nativeSaved.bytes, 'Autosave failure must not change the explicit saved file');
    f.report.observed = { rejected: true, dirty: failed.dirty, feedbackCount: feedback(failed).length, previousCopyPreserved: true };
    await f.persist();
    if (expectation === 'repro') {
      assert.equal(feedback(failed).length, 0, 'Baseline must actually omit autosave failure feedback');
      assert.deepEqual(failed.alerts, []);
      f.report.observations.push({ label: 'BASELINE_REPRODUCED_PRODUCT_FAIL', feedbackContract: 'FAIL' });
      return;
    }
    assert.equal(feedback(failed).length, 1, 'Current outage must produce one visible autosave/recovery warning');
    assert.equal(failed.alerts.length, 1);
    assert.match(`${failed.alerts[0].title} ${failed.alerts[0].hint}`, /autosav|recovery|recover|automatic.*sav/i);
    await f.dismissToasts();

    f.phase = 'second rejected public edit must not repeat the same outage warning';
    since = await eventCount(); await gridEdit(); await waitEvent('native-abort-return', since);
    const repeat = await capture('03-same-outage-rejected-again');
    assert.equal(feedback(repeat).length, 1); assert.deepEqual(repeat.alerts, []);
    assert.deepEqual(repeat.nativeAutosave.bytes, seed.nativeAutosave.bytes); assert.equal(repeat.dirty, true);

    f.phase = 'successful native autosave after a public edit resets the outage';
    await f.page.evaluate(() => window.__d522Autosave.recover());
    since = await eventCount(); const recoveredDoc = await gridEdit(); await waitEvent('native-close-committed', since);
    const recovered = await capture('04-autosave-recovered');
    assert.deepEqual(recovered.doc, recoveredDoc); assert.equal(recovered.dirty, true);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(new Uint8Array(recovered.nativeAutosave.bytes))), recoveredDoc);
    assert.equal(feedback(recovered).length, 1);

    f.phase = 'new outage after success must show one new warning';
    await f.page.evaluate(() => window.__d522Autosave.fail());
    since = await eventCount(); await gridEdit(); await waitEvent('native-abort-return', since);
    const second = await capture('05-new-outage-warning');
    assert.equal(feedback(second).length, 2); assert.equal(second.alerts.length, 1);
    assert.equal(second.dirty, true); assert.deepEqual(second.nativeAutosave.bytes, recovered.nativeAutosave.bytes);
  } finally {
    await f.page.evaluate(() => window.__d522Autosave?.recover());
  }
});
