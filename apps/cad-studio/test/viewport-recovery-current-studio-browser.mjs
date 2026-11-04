// D525/P0-R05. Root owns serial heavy execution, source freeze and original screenshot review.
// D525_SOURCE_FROZEN=1 node test/viewport-recovery-current-studio-browser.mjs /ABS/NEW/OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';
import { installD525DeviceRecoveryObserver, installD525ReplacementDeviceGate } from './native-device-recovery-observer.mjs';

const output = process.argv[2], expectation = process.argv.find(arg => arg.startsWith('--expect='))?.split('=')[1] ?? 'fixed';
const scenario = process.argv.find(arg => arg.startsWith('--case='))?.split('=')[1] ?? 'recovery';
assert.ok(['recovery', 'terminal'].includes(scenario)); assert.ok(scenario !== 'terminal' || expectation === 'fixed');
assert.ok(['repro', 'fixed'].includes(expectation)); assert.ok(output && isAbsolute(output));
assert.ok(relative(resolve(import.meta.dirname, '../../..'), resolve(output)).startsWith('../'));
await mkdir(output);
const f = await createFlow({ name: 'viewport-recovery-current-studio', envFrozen: 'D525_SOURCE_FROZEN', output,
  qualification: `D525/P0-R05 ${expectation === 'repro' ? 'baseline silent real GPU device recovery reproduction' : 'real GPU recovery feedback and document continuity'}`,
  initialFiles: ['apps/cad-studio/test/viewport-recovery-current-studio-browser.mjs', 'apps/cad-studio/test/native-device-recovery-observer.mjs'],
  requiredFrozen: ['apps/cad-studio/src/viewport/gpuRenderer.ts', 'apps/cad-studio/src/App.tsx'],
  extraFrozen: ['packages/barocss-gpu/src/viewer/viewer.ts'],
  snapshotExtra: () => ({ deviceRecovery: window.__d525Device?.snapshot() ?? null, dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    deviceGate: window.__d525DeviceGate?.snapshot() ?? null,
    alerts: [...document.querySelectorAll('.toast[role="alert"]')].map(toast => ({ title: toast.querySelector('.toast-title')?.textContent, hint: toast.querySelector('.toast-hint')?.textContent })) }),
  limits: ['Desktop WebGPU 1440x900 only. Root must review screenshots.', 'Real owned device.destroy via existing Viewer.loseDeviceForTesting; this is a deliberate device loss, not an organic host failure.',
    'One unsaved native box, public camera change/body selection, actual device replacement and Undo/Redo.',
    'Recovery case fixed-only tail holds a real acquired replacement device return, then tests a newer public invalid-file Open error.',
    'Terminal case uses an explicitly injected requestDevice rejection after real owned-device destruction; no organic host-failure claim.',
    'Startup races and newer Undo-action notices remain controlled-test scope; no GUI claim for those cases.',
    'Callback observation wraps getter identity only during this current-viewer flow; disposal/replacement-owner behavior is not qualified by this wrapper.',
    'No geometry/physical accuracy or GPU memory-readback claim.'],
});
f.report.expectation = expectation; f.report.scenario = scenario;
const labels = new Set();
const capture = async label => { assert.ok(!labels.has(label)); labels.add(label); return f.snapshot(label); };
const recoveryNotices = state => state.deviceRecovery.notices.filter(notice => /restor|recover|graphics|gpu|viewport/i.test(`${notice.title} ${notice.hint}`));
await f.run(async () => {
  await f.newPage(); await f.page.setViewportSize({ width: 1440, height: 900 });
  try {
    f.phase = 'public unsaved native box and camera/body selection';
    await f.page.getByRole('button', { name: 'New part', exact: true }).click(); await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    const emptyDoc = await f.doc();
    await f.page.keyboard.press('b'); const hud = f.page.getByRole('dialog', { name: 'Box', exact: true }); await hud.waitFor();
    for (const [label, value] of [['Width X', '64'], ['Depth Y', '32'], ['Height Z', '8']]) await hud.getByLabel(label, { exact: true }).fill(value);
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
    await hud.getByRole('button', { name: 'Apply', exact: true }).click(); await f.ready();
    await f.page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click(); await f.page.keyboard.press('f'); await f.page.waitForTimeout(500);
    const filter = f.page.getByRole('button', { name: 'Selection filter', exact: true });
    for (let i = 0; i < 4 && !(await filter.innerText()).includes('Bodies'); i++) await filter.click();
    assert.match(await filter.innerText(), /Bodies/);
    const point = await f.page.evaluate(() => window.__studioScreenOf([32, 16, 8])); assert.ok(point?.length === 2);
    await f.page.mouse.click(point[0], point[1]);
    await f.page.waitForFunction(() => window.__studioSelection?.selection.bodies?.length === 1);
    await f.page.evaluate(installD525DeviceRecoveryObserver);
    const before = await capture('01-unsaved-selected-before-native-loss');
    assert.equal(before.dirty, true); assert.equal(before.deviceRecovery.ready, true);
    assert.equal(before.selection.selection.bodies.length, 1);

    if (scenario === 'terminal') {
      f.phase = 'real device loss plus explicitly injected replacement requestDevice rejection';
      await f.page.evaluate(installD525ReplacementDeviceGate, { mode: 'reject' });
      await f.page.evaluate(() => window.__studioViewer.loseDeviceForTesting());
      await f.page.waitForFunction(() => window.__d525Device.snapshot().events.some(event => event.kind === 'actual-onRecoverError-called'), null, { timeout: 30000 });
      await f.waitToast(/Viewport unavailable/);
      const terminal = await capture('02-terminal-injected-replacement-failure');
      assert.deepEqual(terminal.doc, before.doc); assert.equal(terminal.dirty, true); assert.equal(terminal.deviceRecovery.ready, false);
      assert.ok(terminal.deviceGate.events.some(event => event.kind === 'injected-request-rejection'));
      assert.equal(terminal.alerts[0].title, 'Viewport unavailable'); assert.match(terminal.alerts[0].hint, /save.*reload/i);
      const sentinel = terminal.deviceGate.sentinel;
      const expected = f.report.consoleErrors.filter(message => message.startsWith('[barocss viewer] Device lost (') && message.endsWith(`and could not be recreated: ${sentinel}`));
      assert.equal(expected.length, 1, 'Exactly one native Viewer terminal diagnostic must be classified');
      f.report.expectedConsoleErrors = expected;
      f.report.consoleErrors = f.report.consoleErrors.filter(message => !expected.includes(message));
      f.report.terminalInjection = { sentinel, meaning: 'Injected requestDevice rejection after deliberate owned native device destruction; not organic host failure' };
      const saved = await f.save('terminal-unsaved-work'); assert.deepEqual(saved.doc, before.doc);
      await capture('03-terminal-work-saved');
      return;
    }

    f.phase = 'destroy only the actual Studio viewer-owned device; await native recovery';
    await f.page.evaluate(() => window.__studioViewer.loseDeviceForTesting());
    await f.page.waitForFunction(() => window.__d525Device.snapshot().events.some(event => event.kind === 'viewer-lose-entered'), null, { timeout: 15000 });
    await capture('02-native-recovery-observed');
    await f.page.waitForFunction(() => {
      const s = window.__d525Device.snapshot();
      return s.events.some(event => event.kind === 'actual-onRecover-called') && s.ready && s.replacement && !s.recoveryPending;
    }, null, { timeout: 30000 });
    await f.ready();
    if (expectation === 'fixed') {
      await f.page.waitForFunction(() => window.__d525Device.snapshot().notices.some(notice => notice.title === 'Viewport restored'), null, { timeout: 30000 });
    }
    const recovered = await capture('03-native-device-recovered');
    assert.ok(recovered.deviceRecovery.events.some(event => event.kind === 'original-native-device-lost'));
    assert.ok(recovered.deviceRecovery.events.some(event => event.kind === 'viewer-start-entered'));
    assert.equal(recovered.deviceRecovery.events.filter(event => event.kind === 'actual-onRecoverError-called').length, 0);
    assert.deepEqual(recovered.doc, before.doc); assert.equal(recovered.dirty, true);
    assert.deepEqual(recovered.selection.selection, before.selection.selection);
    assert.deepEqual(recovered.deviceRecovery.camera, before.deviceRecovery.camera);
    const notices = recoveryNotices(recovered);
    f.report.observed = { actualDeviceReplaced: true, actualSuccessCallback: true, recoveryFeedback: notices, docDirtyCameraSelectionPreserved: true };
    await f.persist();
    if (expectation === 'repro') {
      assert.deepEqual(notices, [], 'Baseline actual device replacement must have no Studio recovery feedback');
      f.report.observations.push({ label: 'BASELINE_REPRODUCED_PRODUCT_FAIL', recoveryFeedbackContract: 'FAIL' });
    } else {
      assert.ok(notices.some(notice => /restoring|recovering/i.test(notice.title)), 'Actual device recovery must show progress feedback');
      assert.ok(notices.some(notice => /restored|recovered/i.test(notice.title)), 'Actual device replacement must show completion feedback');
      await f.dismissToasts();
    }
    f.phase = 'public Undo and Redo after actual device recovery';
    await f.undo(); await f.same(emptyDoc); await capture('04-public-undo-after-recovery');
    await f.redo(); await f.same(before.doc); const redone = await capture('05-public-redo-after-recovery');
    assert.equal(redone.dirty, true); assert.equal(redone.deviceRecovery.ready, true);
    if (expectation === 'fixed') {
      await f.dismissToasts();
      f.phase = 'second real device loss; hold actual acquired replacement return';
      await f.page.evaluate(installD525ReplacementDeviceGate, { mode: 'hold-return' });
      const prior = await capture('06-before-second-native-loss');
      const recoveredCount = prior.deviceRecovery.events.filter(event => event.kind === 'actual-onRecover-called').length;
      await f.page.evaluate(() => window.__studioViewer.loseDeviceForTesting());
      await f.page.waitForFunction(() => window.__d525DeviceGate.snapshot().events.some(event => event.kind === 'native-replacement-acquired-return-held'), null, { timeout: 30000 });
      await capture('07-native-replacement-return-held');
      f.phase = 'public invalid file Open supplies a newer ordinary error while recovery waits';
      await f.page.setInputFiles('input[aria-label="Model file"]', { name: 'D525-invalid.bcad', mimeType: 'application/json', buffer: Buffer.from('{ invalid D525 JSON') });
      await f.page.waitForFunction(() => {
        const title = document.querySelector('.toast[role="alert"] .toast-title')?.textContent;
        return title && title !== 'Restoring viewport' && title !== 'Viewport restored';
      });
      const newer = await capture('08-newer-public-open-error');
      assert.equal(newer.alerts.length, 1); assert.deepEqual(newer.doc, prior.doc); assert.equal(newer.dirty, true);
      const restoreNotices = newer.deviceRecovery.notices.filter(notice => notice.title === 'Viewport restored').length;
      f.phase = 'release actual replacement device; preserve newer ordinary error';
      await f.page.evaluate(() => window.__d525DeviceGate.release());
      await f.page.waitForFunction(count => {
        const s = window.__d525Device.snapshot();
        return s.ready && !s.recoveryPending && s.events.filter(event => event.kind === 'actual-onRecover-called').length > count;
      }, recoveredCount, { timeout: 30000 });
      // Viewer callback precedes Studio's rendered-frame completion. Wait for a real completed GPU queue boundary.
      await f.page.evaluate(async () => { await window.__studioViewer.frame(); await window.__studioViewer.computeDevice.queue.onSubmittedWorkDone(); });
      const afterNewer = await capture('09-late-recovery-keeps-newer-open-error');
      assert.deepEqual(afterNewer.alerts, newer.alerts); assert.deepEqual(afterNewer.doc, newer.doc); assert.equal(afterNewer.dirty, true);
      assert.equal(afterNewer.deviceRecovery.notices.filter(notice => notice.title === 'Viewport restored').length, restoreNotices);
    }
  } finally { await f.page.evaluate(() => { window.__d525DeviceGate?.restore(); window.__d525Device?.restore(); }); }
});
