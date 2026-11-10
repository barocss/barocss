import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { taskRunTerminal } from './task-run-status-flow.mjs';
import { sha256 } from './flow-helper.mjs';

export async function taskRunSingleRepairFlow({ f, row, launch, source, saved, savedBytes }) {
  const { approve } = taskRunTerminal(f, launch.directory);
  const byName = name => row.getByRole('button', { name, exact: true });
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  const checkpoint = f.page.getByRole('region', { name: 'Worker checkpoint checks', exact: true });
  const placed = heights => f.page.waitForFunction(heights => {
    const rows = window.__studioInstanceBounds?.();
    return rows?.length === heights.length && heights.every((height, index) => {
      const part = rows.find(row => row.id === 'p' + (index + 1));
      return part?.max[2] - part?.min[2] === height;
    });
  }, heights);
  const post = (action, name) => Promise.all([
    f.page.waitForResponse(response => new URL(response.url()).pathname === '/api/chat/task-runs/' + action
      && response.request().method() === 'POST'), byName(name).click(),
  ]).then(([response]) => response);

  f.phase = 'preview one scoped repair in the three-occurrence working model';
  await placed([6, 4, 7]);
  await byName('Review candidate p3').click();
  const pin = launch.tasks[0].review;
  await review.getByText(pin.attemptId, { exact: true }).waitFor();
  await review.getByText('Height · 7 mm → 5 mm', { exact: true }).waitFor();
  await review.getByText('Volume change · -192 mm³', { exact: true }).waitFor();
  await placed([6, 4, 5]);
  await f.same(source);
  await f.snapshot('12-single-repair-preview');

  f.phase = 'approve the single repair and open its verified checkpoint';
  assert.equal((await approve('p3', 'd627-approve-repair')).candidateDigest, pin.candidateDigest);
  const statusResponse = await post('status', 'Refresh local run status');
  assert.equal(statusResponse.status(), 200);
  const status = await statusResponse.json();
  assert.deepEqual(status.tasks.map(({ id, phase }) => [id, phase]), [['p3', 'completed']]);
  assert.deepEqual(status.approvals, [status.checkpoint]);
  await row.getByText('p3 · completed', { exact: true }).waitFor();
  await review.waitFor({ state: 'hidden' });
  await placed([6, 4, 7]);
  const file = join(launch.directory, 'run.json'), published = await readFile(file);
  const { record } = JSON.parse(published);
  assert.deepEqual(record.commits.map(commit => commit.taskId), ['p3']);
  assert.equal(record.commits[0].from.sha256, sha256(saved));
  assert.deepEqual(record.state.budget, { limit: 4, used: 1, unknown: 0 });
  assert.equal(record.state.limits.concurrent, 1);
  const response = await post('checkpoint', 'Open approved checkpoint');
  assert.equal(response.status(), 200);
  assert.deepEqual(response.request().postDataJSON(), { runKey: launch.runKey, runId: launch.runId, ...status.checkpoint });
  await writeFile(join(f.output, 'single-approved-http.bcad-run'), await response.body());
  await checkpoint.waitFor();
  await placed([6, 4, 5]);
  const adopted = await f.doc();
  assert.deepEqual(adopted.instances.slice(0, 2), source.instances.slice(0, 2));
  assert.equal(adopted.instances[2].doc.nodes[1].height, 5);
  assert.deepEqual(await checkpoint.getByRole('cell').allTextContents(), ['Fail · 7 mm', 'Pass · 5 mm']);

  f.phase = 'recheck the published repair from its approval history';
  await row.getByText('Approval history', { exact: true }).click();
  await byName('Inspect approval p3').click();
  const checks = row.getByRole('region', { name: 'Worker approval checks', exact: true });
  await checks.waitFor();
  await byName('Check working model').click();
  await checks.getByRole('columnheader', { name: 'Working model', exact: true }).waitFor();
  assert.deepEqual(await checks.getByRole('cell').allTextContents(), ['Fail · 7 mm', 'Pass · 5 mm', 'Pass · 5 mm']);
  await f.same(adopted);
  assert.deepEqual(await savedBytes(), saved);
  assert.deepEqual(await readFile(file), published);
  await f.snapshot('13-single-repair-working-check');
  f.report.observations.push({ selectedTasks: ['p3'], workingHeightsMm: [6, 4, 5], originalHeightsMm: [6, 4, 7],
    untouchedOccurrences: ['p1', 'p2'], staleWorkingPlanRefused: true, satisfiedPlanRefused: true,
    terminalApprovals: 1, workingRecheckMm: 5, budget: record.state.budget });
}
