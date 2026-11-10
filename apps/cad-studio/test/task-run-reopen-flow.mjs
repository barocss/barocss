import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { taskRunTerminal } from './task-run-status-flow.mjs';
import { sha256 } from './flow-helper.mjs';

const reopenPath = '/api/chat/task-runs/reopen';
const isReopen = response => new URL(response.url()).pathname === reopenPath && response.request().method() === 'POST';

export async function refuseMissingTaskRun({ f, openFile, bytes, source, runRoot }) {
  f.phase = 'refuse a missing or damaged handoff without creating a local run';
  const expected = [];
  f.page.on('console', message => {
    if (message.type() === 'error' && new URL(message.location().url, f.page.url()).pathname === reopenPath &&
        /\b(?:400|404)\b/.test(message.text())) expected.push(message.text());
  });
  for (const [status, input, reason] of [[404, bytes, 'No local task run has been started for this handoff.'],
    [400, Buffer.concat([bytes, Buffer.from(' ')]), 'The saved source does not match the handoff.']]) {
    const [response] = await Promise.all([f.page.waitForResponse(isReopen), openFile('housing.bcad-task', input)]);
    assert.equal(response.status(), status);
    const error = (await response.json()).error;
    assert.ok(error.includes(reason) || (status === 400 && /saved source does not match/i.test(error)), error);
    await f.waitToast(status === 404 ? /No local task run has been started/ : /saved source does not match/i);
    assert.equal(await f.page.getByRole('region', { name: 'Reopened task run', exact: true }).count(), 0);
    await f.same(source);
    await assert.rejects(readdir(runRoot), { code: 'ENOENT' });
  }
  assert.equal(expected.length, 2);
  for (const text of expected) {
    const index = f.report.consoleErrors.indexOf(text);
    assert.ok(index >= 0);
    f.report.consoleErrors.splice(index, 1);
  }
  f.report.expectedConsoleErrors = expected;
}

export async function taskRunReopenFlow({ f, openFile, open, bytes, source, saved, launch }) {
  const run = launch.directory;
  const file = join(run, 'run.json');
  const durable = async () => ({
    record: await readFile(file),
    entries: (await readdir(run)).sort(),
    native: (await readdir(join(run, 'native'))).sort(),
  });
  const card = () => f.page.getByRole('region', { name: 'Reopened task run', exact: true });
  const reopen = async () => {
    const [response] = await Promise.all([f.page.waitForResponse(isReopen), openFile('housing.bcad-task', bytes)]);
    assert.equal(response.status(), 200);
    assert.equal((await response.request().allHeaders())['x-barocss-task-run'], 'reopen');
    assert.equal(response.headers()['cache-control'], 'no-store');
    const value = await response.json();
    assert.deepEqual([value.runId, value.runKey, value.directory, value.reused], [launch.runId, launch.runKey, run, true]);
    await card().getByText('Reopened local run · active', { exact: true }).waitFor();
    assert.equal(await card().getByRole('button', { name: 'Start local run', exact: true }).count(), 0);
    return value;
  };
  const before = await durable();
  let startsAfterRestart = 0;
  const fresh = async () => {
    await f.newPage();
    f.page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/chat/task-runs/start') startsAfterRestart++;
    });
  };

  f.phase = 'reopen the pending run in a fresh Studio session with a working edit';
  await fresh();
  await openFile('pending-native-source.bcad', saved);
  await f.same(source);
  await f.addParameter('resumeCheck', 3, '12-reopen-working-edit');
  const edited = await f.doc(), pending = await reopen();
  assert.deepEqual(pending.tasks, launch.tasks);
  assert.deepEqual(await durable(), before);
  await f.same(edited);
  await f.page.getByRole('button', { name: 'Undo', exact: true }).click();
  await f.same(source);
  assert.equal(await f.page.getByRole('button', { name: 'Redo', exact: true }).isEnabled(), true);
  await card().getByRole('button', { name: 'Review candidate p1', exact: true }).click();
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  await review.getByText('Height · 5 mm → 6 mm', { exact: true }).waitFor();
  await review.getByText(launch.tasks[0].review.attemptId, { exact: true }).waitFor();
  await f.same(source);
  assert.deepEqual(await durable(), before);
  await f.snapshot('13-reopened-pending-candidate');

  const { approve } = taskRunTerminal(f, run);
  await approve('p1', 'd629-approve-reopened-candidate');
  const published = await durable();
  f.phase = 'reopen the published run from another fresh session and open the exact checkpoint';
  await fresh();
  const unrelated = structuredClone(source);
  unrelated.instances[0].doc.nodes[1].height = 8;
  await open('unrelated-working-model.bcad', unrelated);
  const current = await reopen();
  assert.deepEqual(current.tasks.map(t => [t.id, t.phase]), [['p1', 'completed'], ['p2', 'stale']]);
  assert.equal(current.checkpoint.taskId, 'p1');
  assert.deepEqual(await durable(), published);
  await f.same(unrelated);
  await f.snapshot('14-reopened-approved-with-working-model');
  const [response] = await Promise.all([
    f.page.waitForResponse(response => new URL(response.url()).pathname === '/api/chat/task-runs/checkpoint'),
    card().getByRole('button', { name: 'Open approved checkpoint', exact: true }).click(),
  ]);
  assert.equal(response.status(), 200);
  await writeFile(join(f.output, 'reopened-approved.bcad-run'), await response.body());
  const checkpoint = f.page.getByRole('region', { name: 'Worker checkpoint checks', exact: true });
  await checkpoint.waitFor();
  assert.deepEqual(await checkpoint.getByRole('cell').allTextContents(), ['Fail · 5 mm', 'Pass · 6 mm']);
  const model = await f.doc();
  assert.deepEqual(model.instances.map(p => p.doc.nodes[1].height), [6, 3]);
  assert.deepEqual(await durable(), published);
  assert.equal(startsAfterRestart, 0);
  await f.snapshot('15-reopened-checkpoint-opened');
  f.report.observations.push({ missingAndDamagedRefused: true, freshContexts: 2, lookupWrites: 0, startsAfterRestart,
    originalRunIdPreserved: true, handoffSHA256: sha256(bytes), preservedWorkingEdit: true,
    checkpointSHA256: current.checkpoint.acceptedSHA256, finalHeightsMm: [6, 3] });
}
