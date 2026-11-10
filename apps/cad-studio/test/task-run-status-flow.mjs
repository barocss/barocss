import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const reviewUrl = '/api/chat/task-runs/review';
const statusUrl = '/api/chat/task-runs/status';

export function taskRunTerminal(f, run) {
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
  return { callCli, approve };
}

export async function taskRunStatusFlow({ f, origin, firstRow, duplicateRow, launch, source, saved, savedBytes, openFile, startRequests, directCheckpoint = false, widthMode = false }) {
  const baseHeight = widthMode ? 5 : 6;
  const run = launch.directory, locator = { runKey: launch.runKey, runId: launch.runId };
  const { callCli, approve } = taskRunTerminal(f, run);
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
  const checkpointUrl = '/api/chat/task-runs/checkpoint';
  const isCheckpoint = request => new URL(request.url()).pathname === checkpointUrl && request.method() === 'POST';
  const openApprovedButton = firstRow.getByRole('button', { name: 'Open approved checkpoint', exact: true });
  const openApproved = async (status, name) => {
    if (!directCheckpoint) {
      const file = join(f.output, name + '.bcad-run');
      await callCli(name + '-checkpoint', 'export', run, file);
      await openFile(name + '.bcad-run', await readFile(file));
      return;
    }
    const pin = status.checkpoint;
    assert.ok(pin);
    const [response] = await Promise.all([
      f.page.waitForResponse(reply => isCheckpoint(reply.request())), openApprovedButton.click(),
    ]);
    if (response.status() !== 200) assert.fail(await response.text());
    assert.equal(response.headers()['content-type'], 'application/octet-stream');
    assert.equal(response.headers()['cache-control'], 'no-store');
    assert.deepEqual(response.request().postDataJSON(), { ...locator, ...pin });
    const bytes = await response.body();
    assert.equal(Number(response.headers()['content-length']), bytes.length);
    assert.equal(bytes.subarray(0, 8).toString(), 'BCADRUN1');
    await writeFile(join(f.output, name + '-http.bcad-run'), bytes);
    await openApprovedButton.filter({ hasText: /^Open approved checkpoint$/ }).waitFor();
  };
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
    assert.deepEqual(Object.keys(data).sort(), ['approvals', 'baselineDigest', 'checkpoint', 'phase', 'revision', 'runId', 'runKey', 'tasks']);
    assert.deepEqual({ runKey: data.runKey, runId: data.runId }, locator);
    await refresh(row).filter({ hasText: /^Refresh status$/ }).waitFor();
    statuses.push({ revision: data.revision, phases: data.tasks.map(task => task.phase), bytesSent: Buffer.byteLength(request.postData()) });
    return data;
  };
  const bounds = (a, b) => f.page.waitForFunction(([a, b]) => {
    const rows = window.__studioInstanceBounds?.();
    return rows?.length === 2 && rows.find(row => row.id === 'p1')?.max[2] === a && rows.find(row => row.id === 'p2')?.max[2] === b;
  }, [a, b]);
  const placedSizes = (base, lid) => f.page.waitForFunction(([base, lid]) => {
    const rows = window.__studioInstanceBounds?.();
    const match = (id, expected) => {
      const row = rows?.find(value => value.id === id);
      return row?.max?.every((value, axis) => value - row.min[axis] === expected[axis]);
    };
    return match('p1', base) && match('p2', lid);
  }, [base, lid]);
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
  assert.equal(await openApprovedButton.count(), 0);
  const initialPosts = startRequests.length;
  assert.equal(initialPosts, 3);
  if (widthMode) {
    f.phase = 'verify the width candidate preserves the depth, height and sibling';
    await pick(firstRow, 'p1').click();
    await review.getByText('Width · 20 mm → 24 mm', { exact: true }).waitFor();
    await review.getByText('Volume change · +200 mm³', { exact: true }).waitFor();
    await placedSizes([24, 10, 5], [12, 8, 3]);
    await f.same(source);
    await f.snapshot('12-rectangle-width-preview');
  }
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
  if (directCheckpoint) {
    f.phase = 'refuse corrupt checkpoint bytes without adopting a new document';
    const route = '**' + checkpointUrl;
    const corrupt = async route => {
      const response = await route.fetch();
      const bytes = Buffer.from(await response.body());
      bytes[bytes.length - 2] ^= 1;
      await route.fulfill({ response, body: bytes });
    };
    await f.page.route(route, corrupt);
    try {
      await openApprovedButton.click();
      await firstRow.getByText('The native files do not match the worker checkpoint.', { exact: true }).waitFor();
      await f.same(source);
      assert.deepEqual(await durable(), afterBase);
    } finally { await f.page.unroute(route, corrupt); }

    f.phase = 'retire a delayed checkpoint when a newer native Open replaces the document';
    const captured = Promise.withResolvers(), resumed = Promise.withResolvers();
    const delayed = async route => {
      try {
        const response = await route.fetch({ timeout: 10000 });
        captured.resolve(response);
        await resumed.promise;
        await route.fulfill({ response });
      } catch (error) { captured.reject(error); throw error; }
    };
    await f.page.route(route, delayed);
    try {
      await Promise.all([f.page.waitForRequest(isCheckpoint), openApprovedButton.click()]);
      assert.equal((await captured.promise).status(), 200);
      const other = structuredClone(source);
      other.instances[0].doc.nodes[1].height = 7;
      await openFile('newer-working-open.bcad', Buffer.from(JSON.stringify(other)));
      await f.same(other);
      const late = f.page.waitForResponse(response => new URL(response.url()).pathname === checkpointUrl);
      resumed.resolve();
      assert.equal((await late).status(), 200);
      await openApprovedButton.filter({ hasText: /^Open approved checkpoint$/ }).waitFor();
      await f.same(other);
      await bounds(7, 3);
      assert.deepEqual(await durable(), afterBase);
    } finally { resumed.resolve(); await f.page.unroute(route, delayed); }
  }
  await openApproved(afterApproval, 'base-approved');
  await checkpoint.waitFor();
  await bounds(baseHeight, 3);
  if (widthMode) {
    await placedSizes([24, 10, 5], [12, 8, 3]);
    assert.deepEqual(await checkpoint.getByRole('cell').allTextContents(), ['Fail · 20 mm', 'Pass · 24 mm']);
  }
  const baseline = await f.doc();
  assert.deepEqual(baseline.instances.map(part => part.doc.nodes[1].height), [baseHeight, 3]);
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
  await bounds(baseHeight, 4);
  await f.same(baseline);
  assert.deepEqual(await durable(), rebuilt);
  assert.deepEqual(await savedBytes(), saved);
  await f.snapshot('10-refreshed-sibling');

  let finished;
  if (directCheckpoint) {
    f.phase = 'refuse a selected checkpoint superseded by the second terminal approval';
    await review.getByRole('button', { name: 'Show accepted model', exact: true }).click();
    await bounds(baseHeight, 3);
    const checkpointRoute = '**' + checkpointUrl, captured = Promise.withResolvers(), resumed = Promise.withResolvers();
    const delaySelectedCheckpoint = async route => {
      try {
        const response = await route.fetch({ timeout: 10000 });
        captured.resolve(response);
        await resumed.promise;
        await route.fulfill({ response });
      } catch (error) { captured.reject(error); throw error; }
    };
    await f.page.route(checkpointRoute, delaySelectedCheckpoint);
    try {
      await Promise.all([f.page.waitForRequest(isCheckpoint), openApprovedButton.click()]);
      assert.equal((await captured.promise).status(), 200);
      const reviewed = await approve('p2', 'd622-approve-lid');
      assert.equal(reviewed.candidateDigest, pin.candidateDigest);
      finished = await durable();
      resumed.resolve();
      await firstRow.getByText(/The approved checkpoint changed during Open/).waitFor();
      await f.same(baseline);
      await bounds(baseHeight, 3);
      assert.deepEqual(await durable(), finished);
    } finally { resumed.resolve(); await f.page.unroute(checkpointRoute, delaySelectedCheckpoint); }
    await readStatus(secondRow);
    const old = await f.page.request.post(origin + checkpointUrl, {
      headers: { origin, 'content-type': 'application/json', 'x-barocss-task-run': 'checkpoint' },
      data: { ...locator, ...afterApproval.checkpoint }, maxRedirects: 0,
    });
    assert.equal(old.status(), 409);
    assert.match((await old.json()).error, /approved checkpoint changed/);
  } else {
    f.phase = 'retire an in-flight preview with a newer status after the second terminal approval';
    await review.getByRole('button', { name: 'Show accepted model', exact: true }).click();
    await bounds(baseHeight, 3);
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
      await bounds(baseHeight, 3);
    } finally { resumed.resolve(); await f.page.unroute(reviewRoute, delayReviewResponse); }
  }
  assert.deepEqual(await durable(), finished);
  assert.deepEqual(JSON.parse(finished.record).record.commits.map(commit => commit.taskId), ['p1', 'p2']);
  f.phase = 'reopen the assembly after both terminal approvals';
  const latest = await readStatus(firstRow);
  assert.deepEqual(latest.tasks.map(task => [task.phase, !!task.review]), [['completed', false], ['completed', false]]);
  await rowPhases([firstRow, secondRow], ['completed', 'completed']);
  await openApproved(latest, 'both-approved');
  await bounds(baseHeight, 4);
  assert.deepEqual(await checkpoint.getByRole('cell').allTextContents(), ['Fail · 3 mm', 'Pass · 4 mm']);
  if (widthMode) await placedSizes([24, 10, 5], [12, 8, 4]);
  assert.deepEqual(await savedBytes(), saved);
  assert.equal(startRequests.length, initialPosts);
  assert.deepEqual(await durable(), finished);
  await f.snapshot('11-both-terminal-approved');
  if (widthMode) {
    f.phase = 'open the historical height-only checkpoint from D622';
    assert.ok(process.env.D623_LEGACY_CHECKPOINT);
    const legacy = await readFile(process.env.D623_LEGACY_CHECKPOINT);
    await openFile('legacy-height-checkpoint.bcad-run', legacy);
    await placedSizes([20, 10, 6], [12, 8, 4]);
    const headerEnd = 16 + legacy.readUInt32LE(8), acceptedStart = headerEnd + legacy.readUInt32LE(12);
    assert.deepEqual(await f.doc(), JSON.parse(legacy.subarray(acceptedStart).toString('utf8')));
    assert.deepEqual(await checkpoint.getByRole('cell').allTextContents(), ['Fail · 3 mm', 'Pass · 4 mm']);
    assert.deepEqual(await savedBytes(), saved);
    await f.snapshot('13-historical-height-checkpoint');
  }
  f.report.observations.push({ runStatusSnapshots: statuses, staleSiblingPinRefused: true, sharedCards: 2, lateOlderStatusIgnored: true, ...(!directCheckpoint ? { lateHeldReviewRetired: true } : {}),
    statusAndReviewDidNotWrite: true, modelUploadsAfterLaunch: 0, firstApprovedBoundsMm: [baseHeight, 3], finalBoundsMm: [baseHeight, 4],
    originalSavedProjectUnchanged: true, terminalApprovals: 2,
    ...(widthMode ? { widthMm: [20, 24], fixedDepthMm: 10, fixedHeightMm: 5, historicalHeightCheckpointOpened: true, finalPlacedSizesMm: [[24, 10, 5], [12, 8, 4]] } : {}),
    ...(directCheckpoint ? { directCheckpointOpen: 2, corruptBinaryRefused: true, supersededNativeOpenPreserved: true, supersededApprovalRefused: true, manualCheckpointExports: 0 } : {}) });
}
