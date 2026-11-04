import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewportRecovery, viewportRecoveryToast, viewportRecoveryHost, type ViewportRecoveryNotice } from '../src/viewport/viewportRecovery';

function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function device() {
  const loss = deferred(), done = deferred(); let waits = 0;
  return { loss, done, lost: loss.promise, queue: { onSubmittedWorkDone() { waits++; return done.promise; } }, get waits() { return waits; } };
}
function rig() {
  const first = device(), frame = deferred(), notices: ViewportRecoveryNotice[] = [];
  const source = { ready: true, computeDevice: first, frame: () => frame.promise,
    recovery: null as Promise<void> | null, stats: { deviceLosses: 0 },
    onRecover: null as (() => void) | null, onRecoverError: null as ((error: { message: string }) => void) | null };
  const observer = createViewportRecovery(source as unknown as NonNullable<Parameters<typeof createViewportRecovery>[0]>);
  observer.setHost(notice => notices.push(notice));
  return { first, frame, notices, source, observer };
}
async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
async function recreate(r: ReturnType<typeof rig>) {
  r.source.ready = false; r.first.loss.resolve(); await flush();
  const next = device(); r.source.computeDevice = next; r.source.ready = true; r.source.onRecover!(); return next;
}

test('D525 recreated resources and frame resolution do not announce restoration before the same device queue completes', async () => {
  const r = rig(), next = await recreate(r); assert.deepEqual(r.notices.map(n => n.state), ['restoring']);
  r.frame.resolve(); await flush(); assert.equal(next.waits, 1); assert.deepEqual(r.notices.map(n => n.state), ['restoring']);
  next.done.resolve(); await flush(); assert.deepEqual(r.notices.map(n => n.state), ['restoring', 'restored']); r.observer.dispose();
});
test('D525 queue rejection is a visible failure even when the Viewer frame promise resolves', async () => {
  const r = rig(), next = await recreate(r); r.frame.resolve(); await flush(); next.done.reject(new Error('submission failed')); await flush();
  assert.equal(r.notices.at(-1)?.state, 'failed'); assert.equal(r.notices.at(-1)?.detail, 'submission failed'); assert.ok(!r.notices.some(n => n.state === 'restored')); r.observer.dispose();
});
test('D525 a second loss invalidates completion of the first replacement device', async () => {
  const r = rig(), next = await recreate(r); r.frame.resolve(); await flush();
  r.source.ready = false; next.loss.resolve(); await flush(); next.done.resolve(); await flush();
  assert.ok(!r.notices.some(n => n.state === 'restored')); assert.equal(r.notices.at(-1)?.state, 'restoring');
  r.source.onRecoverError!(new Error('replacement unavailable')); assert.equal(r.notices.at(-1)?.state, 'failed'); r.observer.dispose();
});
test('D525 disposed observer clears host/source callbacks and ignores later device loss or queued completion', async () => {
  const r = rig(), next = await recreate(r), count = r.notices.length; r.frame.resolve(); await flush(); r.observer.dispose();
  assert.equal(r.source.onRecover, null); assert.equal(r.source.onRecoverError, null);
  next.done.resolve(); next.loss.resolve(); await flush(); assert.equal(r.notices.length, count);
});
test('D525 a recreated device that is replaced before frame completion cannot announce restoration', async () => {
  const r = rig(); await recreate(r); r.source.computeDevice = device(); r.frame.resolve(); await flush();
  assert.ok(!r.notices.some(n => n.state === 'restored')); r.observer.dispose();
});
test('D525 recovery failure retains its actionable message and later old-frame completion cannot replace it', async () => {
  const r = rig(), next = await recreate(r); r.source.onRecoverError!(new Error('no replacement device'));
  r.frame.resolve(); next.done.resolve(); await flush(); assert.equal(r.notices.at(-1)?.state, 'failed');
  assert.match(r.notices.at(-1)?.hint ?? '', /Save your work, then reload/); assert.equal(r.notices.at(-1)?.detail, 'no replacement device'); r.observer.dispose();
});

test('startup observer buffers diagnostics before attach without classifying an otherwise ready viewer as failed', () => {
  const source = rig(); source.observer.dispose();
  const observer = createViewportRecovery(), notices: ViewportRecoveryNotice[] = [];
  observer.report('An unrelated GPU validation message'); observer.setHost(notice => notices.push(notice));
  observer.attach(source.source as unknown as NonNullable<Parameters<typeof createViewportRecovery>[0]>);
  assert.deepEqual(notices, []); observer.dispose();
});
test('startup recovery pending at attach verifies a frame and the same queue before restored', async () => {
  const r = rig(); r.observer.dispose(); r.source.ready = false;
  const pending = deferred(); r.source.recovery = pending.promise;
  const observer = createViewportRecovery(), notices: ViewportRecoveryNotice[] = [];
  observer.setHost(notice => notices.push(notice)); observer.attach(r.source as unknown as NonNullable<Parameters<typeof createViewportRecovery>[0]>);
  assert.deepEqual(notices.map(n => n.state), ['restoring']);
  r.source.ready = true; r.source.recovery = null; pending.resolve(); await flush();
  r.frame.resolve(); await flush(); assert.equal(r.first.waits, 1);
  assert.deepEqual(notices.map(n => n.state), ['restoring']);
  r.first.done.resolve(); await flush(); assert.equal(notices.at(-1)?.state, 'restored'); observer.dispose();
});
test('startup completed loss uses existing deviceLosses history and replays latest verified status to a later host', async () => {
  const r = rig(); r.observer.dispose(); r.source.stats.deviceLosses = 1;
  const observer = createViewportRecovery(); observer.attach(r.source as unknown as NonNullable<Parameters<typeof createViewportRecovery>[0]>);
  const notices: ViewportRecoveryNotice[] = []; observer.setHost(notice => notices.push(notice));
  assert.equal(notices.at(-1)?.state, 'restoring');
  r.frame.resolve(); await flush(); r.first.done.resolve(); await flush();
  assert.equal(notices.at(-1)?.state, 'restored');
  const replay: ViewportRecoveryNotice[] = []; observer.setHost(notice => replay.push(notice));
  assert.equal(replay[0], notices.at(-1)); observer.dispose();
});
test('startup terminal state replays its buffered reason but never attempts to restore a frame', () => {
  const r = rig(); r.observer.dispose(); r.source.ready = false;
  const observer = createViewportRecovery(); observer.report('Startup replacement device refused');
  observer.attach(r.source as unknown as NonNullable<Parameters<typeof createViewportRecovery>[0]>);
  const notices: ViewportRecoveryNotice[] = []; observer.setHost(notice => notices.push(notice));
  assert.equal(notices.at(-1)?.state, 'failed'); assert.equal(notices.at(-1)?.detail, 'Startup replacement device refused');
  assert.equal(r.first.waits, 0); observer.dispose();
});
test('abandoned GPU initialization cannot replay an old failure after disposal and CPU fallback', async () => {
  const r = rig(); r.observer.dispose(); const observer = createViewportRecovery();
  observer.report('Abandoned GPU attempt'); observer.dispose();
  observer.attach(r.source as unknown as NonNullable<Parameters<typeof createViewportRecovery>[0]>);
  const notices: ViewportRecoveryNotice[] = []; observer.setHost(notice => notices.push(notice));
  r.first.loss.resolve(); r.frame.resolve(); r.first.done.resolve(); await flush(); assert.deepEqual(notices, []);
});
test('source replacement ignores old typed callbacks and queued completion without erasing the new host state', async () => {
  const r = rig(), next = await recreate(r); const oldRecover = r.source.onRecover!, oldFailure = r.source.onRecoverError!;
  const replacement = rig(); replacement.observer.dispose();
  r.observer.attach(replacement.source as unknown as NonNullable<Parameters<typeof createViewportRecovery>[0]>);
  const count = r.notices.length;
  oldFailure(new Error('Old renderer failed')); oldRecover(); r.frame.resolve(); next.done.resolve(); await flush();
  assert.equal(r.notices.length, count);
  replacement.source.onRecoverError!(new Error('Current renderer failed'));
  assert.equal(r.notices.at(-1)?.detail, 'Current renderer failed'); r.observer.dispose();
});
test('a rejection from an old replacement queue cannot overwrite a newer recovery cycle', async () => {
  const r = rig(), next = await recreate(r); r.frame.resolve(); await flush();
  r.source.ready = false; next.loss.resolve(); await flush();
  const count = r.notices.length; next.done.reject(new Error('Old queue rejected')); await flush();
  assert.equal(r.notices.length, count); assert.equal(r.notices.at(-1)?.state, 'restoring'); r.observer.dispose();
});
test('a replaced host receives replay while the previous host receives no new recovery state', async () => {
  const r = rig(), next = await recreate(r), previous = r.notices.length;
  const current: ViewportRecoveryNotice[] = []; r.observer.setHost(notice => current.push(notice));
  assert.equal(current[0].state, 'restoring');
  r.frame.resolve(); await flush(); next.done.resolve(); await flush();
  assert.equal(r.notices.length, previous); assert.equal(current.at(-1)?.state, 'restored'); r.observer.dispose();
});
const restoring = (): ViewportRecoveryNotice => ({ state: 'restoring', title: 'Restoring viewport', hint: '', detail: '' });
const restored = (): ViewportRecoveryNotice => ({ state: 'restored', title: 'Viewport restored', hint: '', detail: '' });

test('recovery notice can occupy an empty slot and replace only its own admitted message', () => {
  const first = restoring(); assert.equal(viewportRecoveryToast(null, first), first);
  const next = restored(); assert.equal(viewportRecoveryToast(first, next), next);
});
for (const state of ['existing error', 'new error', 'Undo action'] as const) {
  test(`${state} notice keeps its exact identity and action while recovery finishes`, () => {
    const first = restoring(); viewportRecoveryToast(null, first);
    const run = () => {};
    const current = { title: state, hint: 'Keep this message', detail: '', ...(state === 'Undo action' ? { action: { label: 'Undo', run } } : {}) };
    const next = restored(); assert.equal(viewportRecoveryToast(current, next), current);
    if ('action' in current) assert.equal(current.action?.run, run);
    assert.equal(viewportRecoveryToast(current, next), current, 'React updater replay preserves unrelated ownership');
  });
}
test('recovery updater replay is idempotent for its own previous notice and a dismissed slot', () => {
  const first = restoring(), next = restored(); viewportRecoveryToast(null, first);
  assert.equal(viewportRecoveryToast(first, next), next); assert.equal(viewportRecoveryToast(first, next), next);
  assert.equal(viewportRecoveryToast(null, next), next); assert.equal(viewportRecoveryToast(null, next), next);
});

for (const state of ['disposed renderer', 'new source generation', 'new recovery cycle'] as const) {
  test(`queued React recovery updater cannot apply after ${state}`, async () => {
    const r = rig(); await recreate(r);
    const queued = r.notices.at(-1)!;
    const apply = (current: Parameters<typeof viewportRecoveryToast>[0]) => viewportRecoveryToast(current, queued);
    if (state === 'disposed renderer') r.observer.dispose();
    else if (state === 'new source generation') {
      const replacement = rig(); replacement.observer.dispose();
      r.observer.attach(replacement.source as unknown as NonNullable<Parameters<typeof createViewportRecovery>[0]>);
    } else r.source.onRecoverError!(new Error('A newer recovery failure'));
    assert.equal(apply(null), null, 'a queued update must recheck ownership when React applies it');
    const newer = { title: 'New Undo notice', hint: '', detail: '', action: { label: 'Undo', run() {} } };
    assert.equal(apply(newer), newer); r.observer.dispose();
  });
}

test('queued host notice also rechecks the viewport attachment token', () => {
  let active = true;
  const queued: ViewportRecoveryNotice[] = [];
  const receive = viewportRecoveryHost(() => active, notice => queued.push(notice));
  receive(restoring()); assert.equal(queued.length, 1);
  active = false; assert.equal(viewportRecoveryToast(null, queued[0]), null);
  receive(restored()); assert.equal(queued.length, 1, 'a detached host cannot queue another update');
});

test('real Viewer computeDevice null during recovery still admits the remembered current device loss', async () => {
  const r = rig(); let active = r.first;
  Object.defineProperty(r.source, 'computeDevice', { configurable: true, get() { return r.source.ready ? active : null; }, set(value) { active = value; } });
  r.source.ready = false; r.first.loss.resolve(); await flush();
  assert.equal(r.source.computeDevice, null); assert.equal(r.notices.at(-1)?.state, 'restoring');
  const next = device(); r.source.computeDevice = next; r.source.ready = true; r.source.onRecover!();
  r.frame.resolve(); await flush(); next.done.resolve(); await flush();
  assert.equal(r.notices.at(-1)?.state, 'restored'); r.observer.dispose();
});
