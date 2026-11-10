import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';
import { taskRunTerminal } from './task-run-status-flow.mjs';

export async function taskRunThreeFlow({ f, origin, row, launch, source, saved, savedBytes }) {
  const run = launch.directory, { callCli, approve } = taskRunTerminal(f, run);
  const locator = { runKey: launch.runKey, runId: launch.runId };
  const byName = name => row.getByRole('button', { name, exact: true });
  const pick = id => byName('Review candidate ' + id);
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  const checkpoint = f.page.getByRole('region', { name: 'Worker checkpoint checks', exact: true });
  const initialPins = launch.tasks.map(task => task.review);
  assert.ok(initialPins.every(Boolean));
  const placed = expected => f.page.waitForFunction(expected => {
    const rows = window.__studioInstanceBounds?.();
    return rows?.length === expected.length && expected.every(({ id, size }) => {
      const row = rows.find(value => value.id === id);
      return row?.max.every((value, axis) => value - row.min[axis] === size[axis]);
    });
  }, ['p1', 'p2', 'p3'].map((id, index) => ({ id, size: expected[index] })));
  const state = async () => ({
    bytes: await readFile(join(run, 'run.json')), files: (await readdir(run)).sort(),
  });
  const clickRequest = (endpoint, button) => Promise.all([
    f.page.waitForResponse(response => new URL(response.url()).pathname === '/api/chat/task-runs/' + endpoint
      && response.request().method() === 'POST'), button.click(),
  ]).then(([response]) => response);
  const statuses = [];
  const readStatus = async phases => {
    const refresh = byName('Refresh local run status');
    const response = await clickRequest('status', refresh);
    assert.equal(response.status(), 200, response.ok() ? undefined : await response.text());
    assert.deepEqual(response.request().postDataJSON(), locator);
    const status = await response.json();
    assert.deepEqual(status.tasks.map(task => task.phase), phases);
    await refresh.filter({ hasText: /^Refresh status$/ }).waitFor();
    for (const [index, task] of status.tasks.entries()) {
      assert.equal(task.id, 'p' + (index + 1));
      assert.equal(Boolean(task.review), task.phase === 'awaiting-decision');
      await pick(task.id).waitFor({ state: task.review ? 'visible' : 'detached' });
    }
    statuses.push({ revision: status.revision, phases });
    return status;
  };
  const refuseRetired = async (taskId, pin, status) => {
    const response = await f.page.request.post(origin + '/api/chat/task-runs/review', {
      headers: { origin, 'content-type': 'application/json', 'x-barocss-task-run': 'review' },
      data: { ...locator, taskId, ...pin, baselineDigest: status.baselineDigest }, maxRedirects: 0,
    });
    assert.equal(response.status(), 409, await response.text());
    assert.match((await response.json()).error, /no longer awaiting review|worker candidate changed/);
  };
  const sizes = (width, lid, back) => [[width, 10, 5], [12, 8, lid], [12, 8, back]];
  const openApproved = async (status, id, expected) => {
    const before = await state(), pin = status.checkpoint;
    assert.equal(pin?.taskId, id);
    const open = byName('Open approved checkpoint');
    const response = await clickRequest('checkpoint', open);
    assert.equal(response.status(), 200, response.ok() ? undefined : await response.text());
    assert.deepEqual(response.request().postDataJSON(), { ...locator, ...pin });
    const bytes = await response.body();
    assert.equal(bytes.subarray(0, 8).toString(), 'BCADRUN1');
    await writeFile(join(f.output, id + '-http.bcad-run'), bytes);
    await open.filter({ hasText: /^Open approved checkpoint$/ }).waitFor();
    await checkpoint.waitFor();
    await placed(expected);
    assert.deepEqual(await state(), before);
  };

  f.phase = 'review the third held task without changing the accepted assembly';
  const initial = await state();
  await pick('p3').click();
  await review.getByText(initialPins[2].attemptId, { exact: true }).waitFor();
  await review.getByText('Volume change · +192 mm³', { exact: true }).waitFor();
  await placed(sizes(20, 3, 5));
  await f.same(source);
  assert.deepEqual(await state(), initial);
  await f.snapshot('12-third-candidate-preview');

  f.phase = 'approve the first task and retire both sibling pins';
  assert.equal((await approve('p1', 'd624-approve-p1')).candidateDigest, initialPins[0].candidateDigest);
  const first = await readStatus(['completed', 'stale', 'stale']);
  await review.waitFor({ state: 'hidden' });
  await placed(sizes(20, 3, 3));
  await refuseRetired('p2', initialPins[1], first);
  await refuseRetired('p3', initialPins[2], first);
  await openApproved(first, 'p1', sizes(24, 3, 3));

  f.phase = 'rebuild both siblings and publish the second task';
  for (const id of ['p2', 'p3']) {
    const result = await callCli('rebuild-' + id, 'refresh', run, 'd624-rebuild-' + id, id);
    assert.equal(result.outcome.phase, 'completed');
  }
  const rebuilt = await readStatus(['completed', 'awaiting-decision', 'awaiting-decision']);
  assert.equal((await approve('p2', 'd624-approve-p2')).candidateDigest, rebuilt.tasks[1].review.candidateDigest);
  const second = await readStatus(['completed', 'completed', 'stale']);
  await refuseRetired('p3', rebuilt.tasks[2].review, second);
  await openApproved(second, 'p2', sizes(24, 4, 3));

  f.phase = 'rebuild the third task and open the final approved checkpoint from Studio';
  const result = await callCli('rebuild-p3-final', 'refresh', run, 'd624-rebuild-p3-final', 'p3');
  assert.equal(result.outcome.phase, 'completed');
  const fresh = await readStatus(['completed', 'completed', 'awaiting-decision']);
  const pin = fresh.tasks[2].review;
  assert.equal(new Set([initialPins[2].attemptId, rebuilt.tasks[2].review.attemptId, pin.attemptId]).size, 3);
  await pick('p3').click();
  await review.getByText(pin.attemptId, { exact: true }).waitFor();
  await placed(sizes(24, 4, 5));
  const previewDoc = await f.doc();
  assert.equal(previewDoc.instances[2].doc.nodes[1].height, 3);
  assert.equal((await approve('p3', 'd624-approve-p3')).candidateDigest, pin.candidateDigest);
  const final = await readStatus(['completed', 'completed', 'completed']);
  await review.waitFor({ state: 'hidden' });
  await openApproved(final, 'p3', sizes(24, 4, 5));
  const accepted = await f.doc();
  assert.deepEqual(accepted.instances.map(part => part.doc.nodes[1].height), [5, 4, 5]);
  assert.equal(accepted.instances[0].doc.nodes[0].max[0] - accepted.instances[0].doc.nodes[0].min[0], 24);
  const { record } = JSON.parse((await state()).bytes);
  assert.equal(record.pending, undefined);
  assert.deepEqual(record.commits.map(commit => commit.taskId), ['p1', 'p2', 'p3']);
  assert.deepEqual(record.commits.map(commit => commit.from.sha256), [sha256(saved), ...record.commits.slice(0, 2).map(commit => commit.to.sha256)]);
  assert.equal(record.accepted.sha256, final.checkpoint.acceptedSHA256);
  assert.equal(record.state.budget.used, 3);
  assert.deepEqual(await savedBytes(), saved);
  await f.snapshot('13-three-task-approved-checkpoint');
  f.report.observations.push({ statuses, stalePinsRefused: 3, approvalChain: record.commits.map(commit => commit.taskId),
    finalPlacedSizesMm: sizes(24, 4, 5), budget: record.state.budget, checkpointSHA256: record.accepted.sha256 });
}
