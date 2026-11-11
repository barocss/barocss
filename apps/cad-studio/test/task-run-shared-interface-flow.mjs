import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';
import { taskRunSharedHoleRepairFlow } from './task-run-shared-hole-repair-flow.mjs';
import { taskRunTerminal } from './task-run-status-flow.mjs';

const pathFor = action => '/api/chat/task-runs/' + action;
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const choose = async (f, action, click) => {
  const [response] = await Promise.all([
    f.page.waitForResponse(response => new URL(response.url()).pathname === pathFor(action)),
    click(),
  ]);
  assert.equal(response.status(), 200);
  return response;
};
const snapshotRun = async directory => ({
  json: await readFile(join(directory, 'run.json')),
  entries: (await readdir(directory)).sort(),
  native: await Promise.all((await readdir(join(directory, 'native'))).sort().map(async name =>
    [name, sha256(await readFile(join(directory, 'native', name)))])),
});

export async function taskRunSharedInterfaceFlow({ f, row, source, launch, open, openFile, runRoot, turn, call, readySummary,
  findingMode, agentFindingMode, sharedHoleRepairMode, sharedHoleDeliveryMode, stoppedFindingMode }) {
  const run = launch.directory, terminal = taskRunTerminal(f, run);
  const oldReceipt = join(f.output, 'shared-lid-old.bcad-candidate');
  const save = async (name, doc) => {
    await open(name, doc);
    await button(f.page, 'Save').click();
    await f.page.getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  };
  const refresh = async card => (await choose(f, 'status', () => button(card, 'Refresh local run status').click())).json();
  const checkpoint = f.page.getByRole('region', { name: 'Worker checkpoint checks', exact: true });
  f.phase = 'approve one compatible edit while retaining the shared hole contract';
  await terminal.callCli('shared-lid-old', 'review', run, 'p2', oldReceipt);
  await terminal.approve('p1', 'd634-approve-compatible-base');
  const after = await refresh(row);
  assert.deepEqual(after.tasks.map(task => [task.id, task.phase]), [['p1', 'completed'], ['p2', 'stale']]);
  const acceptedReply = await choose(f, 'checkpoint', () => button(row, 'Open approved checkpoint').click());
  const accepted = Buffer.from(await acceptedReply.body());
  await writeFile(join(f.output, 'shared-compatible-approved.bcad-run'), accepted);
  await checkpoint.getByText(/^Task p1 ·/).waitFor();
  const approved = await f.doc();
  assert.deepEqual(approved.interfaces, source.interfaces);
  assert.deepEqual(approved.instances[1], source.instances[1]);
  assert.deepEqual(approved.instances.map(part => part.doc.nodes[1].height), [6, 3]);
  await f.snapshot('26-shared-compatible-approved');
  const durable = await snapshotRun(run);
  const names = (await readdir(runRoot)).sort();

  f.phase = 'refuse replacement after the shared interface changes and reject the obsolete receipt';
  const changed = structuredClone(approved);
  changed.instances[1].doc.requirements[0].check.value = 5;
  changed.interfaces.holePatterns[0].diameter = 3;
  await save('changed-shared-interface.bcad', changed);
  await button(row, 'Prepare replacement for p2').click();
  await row.getByText('The working model does not retain the accepted run geometry and history.', { exact: true }).waitFor();
  const stale = spawnSync(process.execPath, [join(f.app, 'scripts/cad-cli.mjs'), 'task-run', 'decide', run,
    'd634-reject-obsolete-lid', 'p2', 'approve', '--review', oldReceipt], { cwd: f.app, encoding: 'utf8', timeout: 30000 });
  assert.equal(stale.status, 1, stale.error?.message ?? stale.stderr);
  assert.match(stale.stderr, /No current candidate is awaiting review/);
  assert.deepEqual((await readdir(runRoot)).sort(), names);
  assert.deepEqual(await snapshotRun(run), durable);

  f.phase = 'submit a valid scoped edit against a conflicting shared hole';
  const incompatible = structuredClone(source);
  incompatible.instances[1].doc.nodes[2].radius = 1.5;
  await save('incompatible-shared-hole.bcad', incompatible);
  const planned = await turn('incompatible-shared-hole', [call()]);
  assert.equal(planned.results[0].body.status, 'ready');
  const failureRow = f.page.locator('details.chat-tool').filter({ hasText: readySummary }).last();
  await failureRow.locator('summary').click();
  const conflictReply = await choose(f, 'start', () => button(failureRow, 'Start local run').click());
  const conflict = await conflictReply.json();
  const attemptedBytes = conflictReply.request().postDataBuffer();
  const headerEnd = 12 + attemptedBytes.readUInt32LE(8);
  const baseline = attemptedBytes.subarray(headerEnd);
  await writeFile(join(f.output, 'shared-incompatible-source.bcad'), baseline);
  const conflictState = await snapshotRun(conflict.directory);
  const record = JSON.parse(conflictState.json).record;
  assert.deepEqual(record.commits, []);
  assert.equal(record.pending, undefined);
  assert.equal(record.accepted.sha256, sha256(baseline));
  assert.equal(await button(failureRow, 'Open approved checkpoint').count(), 0);
  assert.deepEqual(await snapshotRun(run), durable);
  await f.same(incompatible);
  await f.snapshot('27-shared-interface-refused');

  f.phase = 'open the exact approved assembly after both refusals';
  const restored = await choose(f, 'checkpoint', () => button(row, 'Open approved checkpoint').click());
  assert.deepEqual(Buffer.from(await restored.body()), accepted);
  await checkpoint.getByText(/^Task p1 ·/).waitFor();
  await f.same(approved);
  await f.snapshot('28-shared-interface-restored');
  assert.deepEqual(await snapshotRun(run), durable);
  assert.deepEqual(await snapshotRun(conflict.directory), conflictState);
  assert.deepEqual(conflict.tasks.map(task => [task.id, task.phase, task.reason]), [
    ['p1', 'failed', 'TASK_NATIVE_GATE'], ['p2', 'failed', 'TASK_NATIVE_GATE'],
  ]);
  assert.deepEqual(record.state.budget, { limit: 8, used: 2, unknown: 0 });
  for (const id of ['p1', 'p2']) {
    await failureRow.getByText(id + ' · failed · TASK_NATIVE_GATE', { exact: true }).waitFor();
    assert.equal(await button(failureRow, 'Review candidate ' + id).count(), 0);
  }
  if (findingMode) {
    f.phase = 'read both native gate findings against the exact conflicting baseline';
    const expected = [
      ['p1', 'assembly', 'PATTERN_MISALIGNED', 'p2 is off H1 at (5, 5, 0)'],
      ['p2', 'contract', 'HOLE_OFF_PATTERN', 'p2 has no Ø4 hole on H1 at (5, 5, 0)'],
    ];
    const verifyFindings = async (status, card) => {
      assert.equal(status.runId, conflict.runId);
      if (stoppedFindingMode) assert.equal(status.phase, 'active');
      assert.equal(status.baselineDigest, record.accepted.modelDigest);
      for (const [id, gate, code, message] of expected) {
        const task = record.state.tasks.find(task => task.id === id);
        const detail = { gate, verdict: 'fail', code, message, attemptId: task.attempt.id,
          baselineDigest: record.accepted.modelDigest, occurrence: id, feature: 'n1' };
        assert.deepEqual(status.tasks.find(item => item.id === id).nativeFailure, detail);
        assert.deepEqual(task.nativeFailure, detail);
        const summary = card.getByText('Failed native check · ' + code, { exact: true });
        await summary.click();
        const block = summary.locator('..');
        await block.getByText(message, { exact: true }).waitFor();
        await block.getByText(id + ' / n1 · ' + gate + ' · Attempt ' + task.attempt.id, { exact: true }).waitFor();
        await block.getByText(record.accepted.modelDigest, { exact: true }).waitFor();
      }
    };
    await verifyFindings(conflict, failureRow);
    await f.snapshot('29-native-findings-with-approved-model');
    await writeFile(join(f.output, 'shared-incompatible-run.bcad-task'), attemptedBytes);

    f.phase = 'reopen the failed run in a fresh Studio context';
    await f.newPage();
    await open('accepted-assembly.bcad', approved);
    const reopened = await (await choose(f, 'reopen', () => openFile('shared-incompatible-run.bcad-task', attemptedBytes))).json();
    assert.equal(reopened.reused, true);
    const card = f.page.getByRole('region', { name: 'Reopened task run', exact: true });
    await verifyFindings(reopened, card);
    const refreshed = await refresh(card);
    assert.deepEqual(refreshed.tasks, reopened.tasks);
    await f.same(approved);
    await f.snapshot('30-reopened-native-findings');
    assert.deepEqual(await snapshotRun(run), durable);
    assert.deepEqual(await snapshotRun(conflict.directory), conflictState);
    f.report.observations.push({ checkedModelRevision: record.accepted.modelDigest, findings: expected,
      freshReopen: true, preservedApprovedWorkingModel: true });
    if (stoppedFindingMode) {
      await taskRunStoppedFindingFlow({ f, open, openFile, refresh, conflict, conflictState, record,
        baseline, attemptedBytes, approved, incompatible });
      assert.deepEqual(await snapshotRun(run), durable);
      assert.deepEqual((await readdir(runRoot)).sort(), [...names, conflict.runKey].sort());
    }
    if (agentFindingMode) {
      f.phase = 'refuse to pass failed-run evidence for the unrelated approved model';
      const attach = () => button(card, 'Use failed check for p2 in chat').click();
      const read = [{ tool: 'read_selected_native_check', args: {} }];
      const { runKey, runId, baselineDigest } = conflict;
      const selected = conflict.tasks.find(task => task.id === 'p2').nativeFailure;
      const selection = { runKey, runId, baselineDigest, taskId: 'p2', attemptId: selected.attemptId };
      await attach();
      const chip = f.page.getByLabel('Task evidence for next message', { exact: true });
      await chip.waitFor();
      assert.match(await chip.innerText(), /Failed check · p2/);
      const wrongModel = await turn('selected-finding-wrong-model', read);
      assert.deepEqual(wrongModel.taskFinding, selection);
      assert.equal(wrongModel.results[0].error, true);
      assert.match(wrongModel.results[0].body.error, /different model revision/);
      assert.equal(wrongModel.results[0].body.finding, undefined);
      await chip.waitFor({ state: 'hidden' });
      await f.same(approved);

      f.phase = 'read the exact selected check from the failed run baseline';
      const opened = await choose(f, 'baseline', () => button(card, 'Open run baseline').click());
      assert.deepEqual(Buffer.from(await opened.body()), baseline);
      await f.same(incompatible);
      await attach();
      const evidence = await turn('selected-finding-current', read);
      assert.deepEqual(evidence.taskFinding, selection);
      assert.equal(evidence.results[0].error, false);
      assert.deepEqual(evidence.results[0].body, {
        revision: baselineDigest, runId, runRevision: conflict.revision, taskId: 'p2', finding: selected,
      });
      assert.equal(evidence.events[0].summary, 'HOLE_OFF_PATTERN');
      await chip.waitFor({ state: 'hidden' });
      await f.same(incompatible);
      await f.snapshot('31-agent-read-selected-native-check');
      await writeFile(join(f.output, 'selected-native-check.json'), JSON.stringify(evidence.results[0].body));

      if (sharedHoleRepairMode) {
        const verifyPriorRuns = async () => {
          assert.deepEqual(await snapshotRun(run), durable);
          assert.deepEqual(await snapshotRun(conflict.directory), conflictState);
          assert.deepEqual(await readFile(join(f.output, 'shared-incompatible-source.bcad')), baseline);
          assert.deepEqual(await readFile(join(f.output, 'shared-incompatible-run.bcad-task')), attemptedBytes);
        };
        await taskRunSharedHoleRepairFlow({ f, openFile, turn, call, readySummary, choose, incompatible, baseline,
          conflict, attemptedBytes, selected, selection, verifyPriorRuns, sharedHoleDeliveryMode });
        return;
      }

      f.phase = 'refuse the selected check after an edit and retire the attachment after sending';
      await attach();
      await f.addParameter('findingModelChange', 7, '32-edit-after-native-check-selection');
      const edited = await f.doc();
      const stale = await turn('selected-finding-after-edit', read);
      assert.deepEqual(stale.taskFinding, selection);
      assert.equal(stale.results[0].error, true);
      assert.match(stale.results[0].body.error, /different model revision/);
      assert.equal(stale.results[0].body.finding, undefined);
      await chip.waitFor({ state: 'hidden' });
      const ordinary = await turn('selected-finding-not-carried', [call()]);
      assert.equal(ordinary.taskFinding, undefined);
      await f.same(edited);
      await f.snapshot('33-agent-refuses-stale-native-check');
      assert.deepEqual(await snapshotRun(run), durable);
      assert.deepEqual(await snapshotRun(conflict.directory), conflictState);
      f.report.observations.push({ selectedTask: 'p2', checkedRevision: baselineDigest, refusedRevisions: [wrongModel.revision, stale.revision],
        selectedFinding: selected.code, attachmentRetired: true, readOnly: true });
    }
  }
  f.report.observations.push({ interfaceId: 'H1', diameterMm: 4, conflictingDiameterMm: 3,
    retiredReviewRefused: true, changedContractRefused: true, incompatibleNativeTasks: 2,
    commits: [1, 0], finalHeightsMm: [6, 3], conflictUsage: record.state.budget });
}

async function taskRunStoppedFindingFlow({ f, open, openFile, refresh, conflict, conflictState, record,
  baseline, attemptedBytes, approved, incompatible }) {
  const { directory, runId, runKey, baselineDigest } = conflict;
  const { callCli } = taskRunTerminal(f, directory);
  const specRevision = record.state.specRevision;
  const expected = [['p1', 'cancelled', 'RUN_STOPPED'], ['p2', 'cancelled', 'RUN_STOPPED']];
  const assertStopped = status => {
    assert.equal(status.phase, 'stopped');
    assert.equal(status.runId, runId);
    assert.deepEqual(status.tasks.map(task => [task.id, task.phase, task.reason]), expected);
    for (const task of status.tasks) {
      for (const key of ['nativeFailure', 'review', 'rebuild', 'replan']) assert.equal(task[key], undefined);
    }
    assert.equal(status.checkpoint, undefined);
  };

  f.phase = 'stop the failed run through the terminal and read its status';
  const stop = spawnSync('python3', ['-I', join(f.app, 'test/fixtures/task-run-terminal.py'),
    'stop ' + specRevision.slice(0, 12), '{}', process.execPath, join(f.app, 'scripts/cad-cli.mjs'),
    'task-run', 'stop', directory, 'd639-stop-native-findings'], { cwd: f.app, encoding: 'utf8', timeout: 90000 });
  await writeFile(join(f.output, 'd639-stop-native-findings.json'), stop.stdout ?? '');
  await writeFile(join(f.output, 'd639-stop-native-findings.stderr.txt'), stop.stderr ?? '');
  assert.equal(stop.status, 0, stop.error?.message ?? stop.stderr);
  assert.equal(JSON.parse(stop.stdout).outcome.phase, 'completed');
  const stopped = await snapshotRun(directory);
  const stoppedRecord = JSON.parse(stopped.json).record;
  assert.equal(stoppedRecord.epoch, record.epoch + 1);
  assert.deepEqual(stopped.entries, [...conflictState.entries,
    'writer-' + stoppedRecord.epoch + '.json', 'released-' + stoppedRecord.epoch + '.json'].sort());
  assert.deepEqual(stopped.native, conflictState.native);
  await writeFile(join(f.output, 'd639-before-stop-run.json'), conflictState.json);
  await writeFile(join(f.output, 'd639-after-stop-run.json'), stopped.json);
  assert.deepEqual(stoppedRecord.accepted, record.accepted);
  assert.deepEqual(stoppedRecord.commits, record.commits);
  assert.deepEqual(stoppedRecord.state.budget, record.state.budget);
  assert.equal(stoppedRecord.pending, undefined);
  for (const [index, task] of stoppedRecord.state.tasks.entries()) {
    const prior = record.state.tasks[index];
    assert.equal(task.id, prior.id);
    assert.deepEqual(task.attempt, prior.attempt);
    assert.deepEqual(task.nativeFailure, prior.nativeFailure);
  }
  const cliStatus = await callCli('d639-stopped-status', 'status', directory);
  assertStopped(cliStatus);
  assert.deepEqual(cliStatus.accepted, record.accepted);
  assert.deepEqual(await snapshotRun(directory), stopped);

  f.phase = 'reopen the stopped handoff with a different working model';
  await f.newPage();
  await open('accepted-assembly.bcad', approved);
  const reopened = await (await choose(f, 'reopen', () => openFile('shared-incompatible-run.bcad-task', attemptedBytes))).json();
  assertStopped(reopened);
  assert.deepEqual([reopened.runKey, reopened.baselineDigest, reopened.directory, reopened.reused],
    [runKey, baselineDigest, directory, true]);
  const card = f.page.getByRole('region', { name: 'Reopened task run', exact: true });
  await card.getByText('Reopened local run · stopped', { exact: true }).waitFor();
  assert.ok(!(await card.innerText()).includes(directory));
  assert.equal(await card.getByText(directory, { exact: true }).count(), 0);
  for (const [id, phase, reason] of expected) {
    await card.getByText(id + ' · ' + phase + ' · ' + reason, { exact: true }).waitFor();
    for (const name of ['Review candidate ', 'Rebuild candidate ', 'Prepare replacement for '])
      assert.equal(await button(card, name + id).count(), 0);
    assert.equal(await button(card, 'Use failed check for ' + id + ' in chat').count(), 0);
  }
  assert.equal(await card.getByText(/^(Failed|Unresolved) native check · /).count(), 0);
  assert.equal(await button(card, 'Open approved checkpoint').count(), 0);
  const refreshed = await refresh(card);
  assertStopped(refreshed);
  assert.deepEqual({ ...refreshed, directory, reused: true }, reopened);
  await f.same(approved);
  assert.deepEqual(await snapshotRun(directory), stopped);
  await f.snapshot('31-reopened-stopped-native-run');

  f.phase = 'open the exact stopped run baseline explicitly';
  const opened = await choose(f, 'baseline', () => button(card, 'Open run baseline').click());
  assert.deepEqual(opened.request().postDataJSON(), { runKey, runId, baselineDigest });
  assert.equal(opened.headers()['x-barocss-native-sha256'], record.accepted.sha256);
  assert.deepEqual(await opened.body(), baseline);
  await f.same(incompatible);
  const notice = await f.waitToast(/The exact local run model is open\./);
  assert.doesNotMatch(notice, /candidate review/);
  assert.deepEqual(await snapshotRun(directory), stopped);
  await f.snapshot('32-opened-stopped-run-baseline');
  f.report.observations.push({ stoppedTasks: expected, historicalFindings: stoppedRecord.state.tasks.map(task => task.nativeFailure),
    stoppedRunBaselineSHA256: sha256(baseline), stoppedReadsPreservedRun: true });
}
