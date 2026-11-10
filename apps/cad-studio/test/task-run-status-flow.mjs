import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const reviewUrl = '/api/chat/task-runs/review';
const statusUrl = '/api/chat/task-runs/status';

export async function taskRunStatusFlow({ f, origin, firstRow, duplicateRow, launch, source, saved, savedBytes, openFile, startRequests }) {
  const run = launch.directory, locator = { runKey: launch.runKey, runId: launch.runId };
  const args = [process.execPath, join(f.app, 'scripts/cad-cli.mjs'), 'task-run'];
  const callCli = async (label, ...command) => {
    const result = spawnSync(args[0], [...args.slice(1), ...command], { cwd: f.app, encoding: 'utf8', timeout: 30000 });
    await writeFile(join(f.output, label + '.json'), result.stdout);
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    return JSON.parse(result.stdout);
  };
  const approve = async (task, operation) => {
    const file = join(f.output, task + '-terminal.bcad-candidate');
    const { candidateReview } = await callCli('terminal-review-' + task, 'review', run, task, file);
    const result = spawnSync('python3', ['-I', join(f.app, 'test/fixtures/task-run-terminal.py'),
      'approve ' + candidateReview.candidateDigest.slice(0, 12), '{}', ...args, 'decide', run, operation, task, 'approve', '--review', file],
    { cwd: f.app, encoding: 'utf8', timeout: 90000 });
    await writeFile(join(f.output, operation + '.jsonl'), result.stdout);
    await writeFile(join(f.output, operation + '.stderr.txt'), result.stderr);
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    assert.equal(JSON.parse(result.stdout.trim().split('\n').at(-1)).outcome.code, 'RUN_ACCEPTED');
    return candidateReview;
  };
  const durable = async () => {
    const bytes = await readFile(join(run, 'run.json')), { record } = JSON.parse(bytes);
    return {
      record: bytes, entries: (await readdir(run)).sort(), accepted: await readFile(join(run, 'native', record.accepted.sha256 + '.bcad')),
    };
  };
  const isStatus = request => new URL(request.url()).pathname === statusUrl && request.method() === 'POST';
  const refresh = row => row.getByRole('button', { name: 'Refresh local run status', exact: true });
  const pick = (row, id) => row.getByRole('button', { name: 'Review candidate ' + id, exact: true });
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  const checkpoint = f.page.getByRole('region', { name: 'Worker checkpoint checks', exact: true });
  const statuses = [];
  const readStatus = async row => {
    const [response] = await Promise.all([f.page.waitForResponse(reply => isStatus(reply.request())), refresh(row).click()]);
    const request = response.request(), headers = await request.allHeaders();
    assert.equal(headers.origin, origin);
    assert.equal(headers['content-type'], 'application/json');
    assert.equal(headers['x-barocss-task-run'], 'status');
    assert.deepEqual(request.postDataJSON(), locator);
    assert.equal(response.headers()['cache-control'], 'no-store');
    assert.equal(response.status(), 200, await response.text());
    const data = await response.json();
    assert.deepEqual(Object.keys(data).sort(), ['baselineDigest', 'phase', 'revision', 'runId', 'runKey', 'tasks']);
    assert.deepEqual({ runKey: data.runKey, runId: data.runId }, locator);
    await refresh(row).filter({ hasText: /^Refresh status$/ }).waitFor();
    statuses.push({ revision: data.revision, phases: data.tasks.map(task => task.phase), bytesSent: Buffer.byteLength(request.postData()) });
    return data;
  };
  const bounds = (a, b) => f.page.waitForFunction(([a, b]) => {
    const rows = window.__studioInstanceBounds?.();
    return rows?.length === 2 && rows.find(row => row.id === 'p1')?.max[2] === a && rows.find(row => row.id === 'p2')?.max[2] === b;
  }, [a, b]);
  const rowPhases = async (rows, values) => {
    for (const row of rows) {
      for (const [i, phase] of values.entries())
        await row.getByText(new RegExp('^p' + (i + 1) + ' · ' + phase)).waitFor();
    }
  };

  f.phase = 'start the same run from a second Studio plan card';
  const secondRow = await duplicateRow();
  const [reused] = await Promise.all([f.page.waitForResponse(response => new URL(response.url()).pathname === '/api/chat/task-runs/start'),
    secondRow.getByRole('button', { name: 'Start local run', exact: true }).click()]);
  assert.equal(reused.status(), 200, await reused.text());
  assert.deepEqual(await reused.json(), { ...launch, reused: true });
  const initialPosts = startRequests.length;
  assert.equal(initialPosts, 3);
  await pick(firstRow, 'p2').click();
  const oldPin = launch.tasks[1].review;
  await review.getByText(oldPin.attemptId, { exact: true }).waitFor();
  await bounds(5, 4);

  f.phase = 'refresh both cards after first terminal publication and discard a late older status';
  await approve('p1', 'd621-approve-base');
  const afterBase = await durable();
  const { directory: _directory, reused: _reused, ...oldStatus } = launch;
  let release, hold = true;
  const released = new Promise(resolve => { release = resolve; });
  const delayOlderStatus = async route => {
    if (!hold) return route.fallback();
    hold = false;
    await released;
    return route.fulfill({ status: 200, json: oldStatus, headers: { 'cache-control': 'no-store' } });
  };
  const route = '**' + statusUrl;
  await f.page.route(route, delayOlderStatus);
  let afterApproval;
  try {
    const [oldRequest] = await Promise.all([f.page.waitForRequest(isStatus), refresh(secondRow).click()]);
    const lateResponse = f.page.waitForResponse(response => response.request() === oldRequest);
    afterApproval = await readStatus(firstRow);
    assert.ok(afterApproval.revision > launch.revision);
    assert.deepEqual(afterApproval.tasks.map(task => task.phase), ['completed', 'stale']);
    assert.ok(afterApproval.tasks.every(task => !task.review));
    await rowPhases([firstRow, secondRow], ['completed', 'stale']);
    await review.waitFor({ state: 'hidden' });
    await bounds(5, 3);
    release();
    assert.equal((await lateResponse).status(), 200);
    await refresh(secondRow).filter({ hasText: /^Refresh status$/ }).waitFor();
    await rowPhases([firstRow, secondRow], ['completed', 'stale']);
    assert.equal(await pick(secondRow, 'p2').count(), 0);
  } finally { release(); await f.page.unroute(route, delayOlderStatus); }
  assert.deepEqual(await durable(), afterBase);
  await f.same(source);
  await f.snapshot('09-old-preview-retired');

  f.phase = 'open the approved checkpoint and rebuild the remaining candidate through the terminal';
  const first = join(f.output, 'base-approved.bcad-run');
  await callCli('base-checkpoint', 'export', run, first);
  await openFile('base-approved.bcad-run', await readFile(first));
  await checkpoint.waitFor();
  await bounds(6, 3);
  const baseline = await f.doc();
  assert.deepEqual(baseline.instances.map(part => part.doc.nodes[1].height), [6, 3]);
  const rebuild = await callCli('rebuilt-lid', 'refresh', run, 'd621-rebuild-lid', 'p2');
  assert.equal(rebuild.outcome.phase, 'completed');
  const rebuilt = await durable();
  const old = await f.page.request.post(origin + reviewUrl, {
    headers: { origin, 'content-type': 'application/json', 'x-barocss-task-run': 'review' },
    data: { ...locator, taskId: 'p2', ...oldPin, baselineDigest: afterApproval.baselineDigest },
    maxRedirects: 0,
  });
  assert.equal(old.status(), 409);
  assert.match((await old.json()).error, /worker candidate changed/);

  f.phase = 'refresh and verify the new sibling on the approved checkpoint';
  const fresh = await readStatus(secondRow);
  assert.ok(fresh.revision > afterApproval.revision);
  assert.equal(fresh.baselineDigest, afterApproval.baselineDigest);
  assert.deepEqual(fresh.tasks.map(task => task.phase), ['completed', 'awaiting-decision']);
  const pin = fresh.tasks[1].review;
  assert.ok(pin);
  assert.notEqual(pin.attemptId, oldPin.attemptId);
  assert.notEqual(pin.candidateDigest, oldPin.candidateDigest);
  await rowPhases([firstRow, secondRow], ['completed', 'awaiting decision']);
  await pick(firstRow, 'p2').click();
  await review.getByText(pin.attemptId, { exact: true }).waitFor();
  await review.getByText(pin.candidateDigest.slice(0, 12), { exact: true }).waitFor();
  await review.getByText('Volume change · +96 mm³', { exact: true }).waitFor();
  await bounds(6, 4);
  await f.same(baseline);
  assert.deepEqual(await durable(), rebuilt);
  assert.deepEqual(await savedBytes(), saved);
  await f.snapshot('10-refreshed-sibling');

  f.phase = 'retire an in-flight preview with a newer status after the second terminal approval';
  await review.getByRole('button', { name: 'Show accepted model', exact: true }).click();
  await bounds(6, 3);
  const captured = Promise.withResolvers(), resumed = Promise.withResolvers();
  const reviewRoute = '**' + reviewUrl;
  let reads = 0;
  const delayReviewResponse = async route => {
    if (++reads !== 2) return route.fallback();
    try {
      const response = await route.fetch({ timeout: 10000 });
      captured.resolve(response);
      await resumed.promise;
      await route.fulfill({ response });
    } catch (error) { captured.reject(error); throw error; }
  };
  await f.page.route(reviewRoute, delayReviewResponse);
  let finished;
  try {
    let requestsSeen = 0;
    const secondRead = f.page.waitForRequest(request => new URL(request.url()).pathname === reviewUrl && ++requestsSeen === 2);
    await review.getByRole('button', { name: 'Preview candidate', exact: true }).click();
    await secondRead;
    const response = await captured.promise;
    assert.equal(response.status(), 200, await response.text());
    const reviewed = await approve('p2', 'd621-approve-lid');
    assert.equal(reviewed.candidateDigest, pin.candidateDigest);
    finished = await durable();
    const last = await readStatus(firstRow);
    assert.ok(last.revision > fresh.revision);
    assert.deepEqual(last.tasks.map(task => [task.phase, !!task.review]), [['completed', false], ['completed', false]]);
    await rowPhases([firstRow, secondRow], ['completed', 'completed']);
    resumed.resolve();
    await f.waitToast(/The worker candidate changed during review/);
    await review.waitFor({ state: 'hidden' });
    await bounds(6, 3);
  } finally { resumed.resolve(); await f.page.unroute(reviewRoute, delayReviewResponse); }
  assert.deepEqual(await durable(), finished);
  assert.deepEqual(JSON.parse(finished.record).record.commits.map(commit => commit.taskId), ['p1', 'p2']);
  f.phase = 'reopen the assembly after both terminal approvals';
  const output = join(f.output, 'both-approved.bcad-run');
  await callCli('final-checkpoint', 'export', run, output);
  await openFile('both-approved.bcad-run', await readFile(output));
  await bounds(6, 4);
  assert.deepEqual(await checkpoint.getByRole('cell').allTextContents(), ['Fail · 3 mm', 'Pass · 4 mm']);
  assert.deepEqual(await savedBytes(), saved);
  assert.equal(startRequests.length, initialPosts);
  assert.deepEqual(await durable(), finished);
  await f.snapshot('11-both-terminal-approved');
  f.report.observations.push({ runStatusSnapshots: statuses, staleSiblingPinRefused: true, sharedCards: 2, lateOlderStatusIgnored: true, lateHeldReviewRetired: true,
    statusAndReviewDidNotWrite: true, modelUploadsAfterLaunch: 0, firstApprovedBoundsMm: [6, 3], finalBoundsMm: [6, 4],
    originalSavedProjectUnchanged: true, terminalApprovals: 2 });
}
