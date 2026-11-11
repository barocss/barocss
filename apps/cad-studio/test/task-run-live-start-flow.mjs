import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';
import { taskRunTerminal } from './task-run-status-flow.mjs';

const base = '/api/chat/task-runs/';
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const phases = value => value.tasks.map(task => [task.id, task.phase]);
const matches = action => response => new URL(response.url()).pathname === base + action && response.request().method() === 'POST';

export async function taskRunLiveStartFlow({ f, row, start, source, saved, bytes, workerBarrier, runRoot }) {
  f.phase = 'show the owned local run before native workers settle';
  const startedAt = performance.now();
  let startResponse, admitted, running, entered;
  try {
    [startResponse] = await Promise.all([f.page.waitForResponse(matches('start')), start.click()]);
    const earlyMs = performance.now() - startedAt;
    assert.equal(startResponse.status(), 200);
    assert.equal((await startResponse.request().allHeaders())['x-barocss-task-run-progress'], '1');
    admitted = JSON.parse(decodeURIComponent(startResponse.headers()['x-barocss-task-run-admitted']));
    assert.equal(admitted.reused, false);
    assert.equal(admitted.phase, 'active');
    assert.deepEqual(phases(admitted), [['p1', 'ready'], ['p2', 'ready']]);
    assert.equal(admitted.checkpoint, undefined);
    await row.getByText('Local run started · active', { exact: true }).waitFor({ timeout: 4000 });
    for (const task of ['p1', 'p2']) await row.getByText(task + ' · running', { exact: true }).waitFor({ timeout: 4000 });
    assert.equal(await button(row, 'Starting local run…').isDisabled(), true);
    assert.equal(await button(row, 'Open approved checkpoint').count(), 0);
    assert.equal(await button(row, 'Review candidate p1').count(), 0);
    assert.ok(!(await row.innerText()).includes(admitted.directory));

    const locator = { runKey: admitted.runKey, runId: admitted.runId };
    const origin = new URL(f.page.url()).origin;
    const status = await f.page.request.post(origin + base + 'status', {
      headers: { origin, 'x-barocss-task-run': 'status', 'content-type': 'application/json' }, data: locator,
    });
    assert.equal(status.status(), 200);
    running = await status.json();
    assert.deepEqual(phases(running), [['p1', 'running'], ['p2', 'running']]);
    assert.equal(running.baselineDigest, admitted.baselineDigest);
    assert.ok(running.revision > admitted.revision);
    const { record } = JSON.parse(await readFile(join(admitted.directory, 'run.json')));
    assert.equal(record.revision, running.revision);
    assert.equal(record.accepted.sha256, sha256(saved));
    assert.deepEqual(await readFile(join(admitted.directory, 'native', record.accepted.sha256 + '.bcad')), saved);
    assert.deepEqual(record.commits, []);
    assert.equal(record.pending, undefined);

    f.phase = 'reuse the in-progress Start and keep one native worker host';
    const duplicate = await f.page.evaluate(async bytes => {
      const response = await fetch('/api/chat/task-runs/start', {
        method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-barocss-task-run': 'start', 'x-barocss-task-run-progress': '1' },
        body: new Blob([new Uint8Array(bytes)]),
      });
      window.__d640DuplicateResult = response.json();
      return { status: response.status, admission: response.headers.get('x-barocss-task-run-admitted') };
    }, [...bytes]);
    assert.equal(duplicate.status, 200);
    assert.deepEqual(JSON.parse(decodeURIComponent(duplicate.admission)), { ...admitted, reused: true });
    await f.page.waitForTimeout(100);
    const markers = (await readdir(workerBarrier)).filter(name => name.startsWith('worker-'));
    assert.equal(markers.length, 2);
    entered = await Promise.all(markers.map(async name => JSON.parse(await readFile(join(workerBarrier, name)))));
    assert.deepEqual(entered.map(worker => worker.task).sort(), ['p1', 'p2']);
    assert.equal(new Set(entered.map(worker => worker.pid)).size, 1);
    assert.ok(entered.every(worker => worker.runId === admitted.runId));
    assert.deepEqual(await readdir(runRoot), [admitted.runKey]);
    await f.same(source);
    await f.snapshot('07-live-start-workers-running');
    f.report.observations.push({ earlyResponseMs: earlyMs, earlyRevision: admitted.revision, runningRevision: running.revision,
      actualWorkerThreads: entered.length, actualWorkerProcesses: 1, duplicateReused: true, publicationsDuringStart: 0 });
  } finally {
    await writeFile(join(workerBarrier, 'release'), '');
  }

  f.phase = 'settle the same Start and approve a reviewed candidate explicitly';
  const held = await startResponse.json(), duplicate = await f.page.evaluate(() => window.__d640DuplicateResult);
  assert.deepEqual(duplicate, { ...held, reused: true });
  assert.deepEqual([held.runId, held.runKey, held.baselineDigest], [admitted.runId, admitted.runKey, admitted.baselineDigest]);
  assert.ok(held.revision > running.revision);
  assert.deepEqual(phases(held), [['p1', 'awaiting-decision'], ['p2', 'awaiting-decision']]);
  for (const task of ['p1', 'p2']) await row.getByText(task + ' · awaiting decision', { exact: true }).waitFor();
  assert.equal(await button(row, 'Open approved checkpoint').count(), 0);
  const { record: heldRecord } = JSON.parse(await readFile(join(held.directory, 'run.json')));
  assert.deepEqual(heldRecord.commits, []);
  assert.equal(heldRecord.accepted.sha256, sha256(saved));
  await f.same(source);
  await f.snapshot('08-live-start-candidates-held');
  await button(row, 'Review candidate p1').click();
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  await review.getByText('Height · 5 mm → 6 mm', { exact: true }).waitFor();
  await f.same(source);
  const terminal = taskRunTerminal(f, held.directory);
  const reviewed = await terminal.approve('p1', 'd640-explicit-approval');
  assert.equal(reviewed.candidateDigest, held.tasks[0].review.candidateDigest);
  const [refreshed] = await Promise.all([f.page.waitForResponse(matches('status')), button(row, 'Refresh local run status').click()]);
  assert.equal(refreshed.status(), 200);
  const after = await refreshed.json();
  assert.deepEqual(phases(after), [['p1', 'completed'], ['p2', 'stale']]);
  const [opened] = await Promise.all([f.page.waitForResponse(matches('checkpoint')), button(row, 'Open approved checkpoint').click()]);
  assert.equal(opened.status(), 200);
  const checkpoint = Buffer.from(await opened.body());
  await writeFile(join(f.output, 'd640-approved.bcad-run'), checkpoint);
  const acceptedOffset = 16 + checkpoint.readUInt32LE(8) + checkpoint.readUInt32LE(12);
  await f.same(JSON.parse(checkpoint.subarray(acceptedOffset)));
  assert.deepEqual((await f.doc()).instances.map(part => part.doc.nodes[1].height), [6, 3]);
  await f.snapshot('09-live-start-explicit-approval');
  await writeFile(join(f.output, 'd640-start-states.json'), JSON.stringify({ admitted, running, held, after }));
  f.report.observations.push({ heldRevision: held.revision, approvedRevision: after.revision, terminalApprovals: 1,
    finalHeightsMm: [6, 3], latestCheckpointSHA256: after.checkpoint.acceptedSHA256 });
}
