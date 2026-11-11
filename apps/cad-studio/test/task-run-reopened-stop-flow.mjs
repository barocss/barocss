import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';
import { taskRunTerminal } from './task-run-status-flow.mjs';

const base = '/api/chat/task-runs/';
const matches = action => response => new URL(response.url()).pathname === base + action && response.request().method() === 'POST';
const button = (parent, name) => parent.getByRole('button', { name, exact: true });

export async function taskRunReopenedStopFlow({ f, openFile, open, bytes, source, launch }) {
  const run = launch.directory, file = join(run, 'run.json');
  const locator = { runKey: launch.runKey, runId: launch.runId };
  const { callCli, approve } = taskRunTerminal(f, run);
  const cli = join(f.app, 'scripts/cad-cli.mjs');
  const readRecord = async () => JSON.parse(await readFile(file)).record;
  const durable = async () => ({ bytes: await readFile(file), entries: (await readdir(run)).sort() });
  const card = () => f.page.getByRole('region', { name: 'Reopened task run', exact: true });
  const stop = () => Promise.all([f.page.waitForResponse(matches('stop')), button(card(), 'Stop local run').click()]).then(([response]) => response);
  const reopen = async () => {
    const [response] = await Promise.all([f.page.waitForResponse(matches('reopen')), openFile('housing.bcad-task', bytes)]);
    assert.equal(response.status(), 200);
    const value = await response.json();
    assert.deepEqual([value.runKey, value.runId], [locator.runKey, locator.runId]);
    await card().getByText('Reopened local run · ' + value.phase, { exact: true }).waitFor();
    assert.ok(!(await card().innerText()).includes(run));
    return value;
  };

  f.phase = 'approve p1 and rebuild a second candidate without publishing it';
  await approve('p1', 'd642-approve-p1');
  await callCli('d642-refresh-p2', 'refresh', run, 'd642-refresh', 'p2');
  const reviewFile = join(f.output, 'd642-p2.bcad-candidate');
  const { candidateReview: p2 } = await callCli('d642-review-p2', 'review', run, 'p2', reviewFile);
  const approved = await readRecord();
  assert.deepEqual(approved.state.tasks.map(task => task.phase), ['completed', 'awaiting-decision']);
  assert.equal(approved.commits.length, 1);
  const approvedNative = await readFile(join(run, 'native', approved.accepted.sha256 + '.bcad'));
  assert.equal(sha256(approvedNative), approved.accepted.sha256);

  await f.newPage();
  const working = structuredClone(source);
  working.instances[0].doc.nodes[1].height = 8;
  await open('unrelated-working-model.bcad', working);
  const release = join(f.output, 'release-terminal');
  const hold = "import sys,time\nfrom pathlib import Path\nend=time.monotonic()+30\nwhile not Path(sys.argv[1]).exists():\n if time.monotonic()>=end: sys.exit('Terminal test barrier timed out')\n time.sleep(0.025)";
  const terminal = spawn('python3', ['-u', '-I', join(f.app, 'test/fixtures/task-run-terminal.py'),
    'pause ' + approved.state.specRevision.slice(0, 12),
    JSON.stringify({ beforeAnswer: [['python3', '-I', '-c', hold, release]], answer: 'decline' }),
    process.execPath, cli, 'task-run', 'pause', run, 'd642-hold-writer'], { cwd: f.app, stdio: ['ignore', 'pipe', 'pipe'] });
  const exit = once(terminal, 'close');
  let stderr = '', stdout = '', onPrompt;
  const prompt = new Promise(resolve => { onPrompt = resolve; });
  terminal.stdout.on('data', chunk => { stdout += chunk; });
  terminal.stderr.on('data', chunk => { stderr += chunk; if (stderr.includes('to continue.')) onPrompt(); });
  let held, before, pin, terminalExit;
  const expectedConsole = [];
  f.page.on('console', message => {
    if (message.type() === 'error' && /409/.test(message.text())
      && new URL(message.location().url, f.page.url()).pathname === base + 'stop') expectedConsole.push(message.text());
  });
  try {
    f.phase = 'refuse Stop while the terminal owns the exact reopened run';
    await Promise.race([prompt, exit.then(() => assert.fail(stderr))]);
    const owned = await readRecord();
    assert.equal(owned.epoch, approved.epoch + 1);
    before = await durable();
    assert.ok(!before.entries.includes('released-' + owned.epoch + '.json'));
    held = await reopen();
    assert.deepEqual(held.tasks.map(task => task.phase), ['completed', 'awaiting-decision']);
    assert.equal(held.tasks[1].review.candidateDigest, p2.candidateDigest);
    assert.equal(held.checkpoint.acceptedSHA256, approved.accepted.sha256);
    pin = { ...locator, revision: held.revision, baselineDigest: held.baselineDigest };
    const refused = await stop();
    assert.equal(refused.status(), 409);
    assert.equal((await refused.json()).error, 'Another process owns this local task run.');
    await card().getByText('Another process owns this local task run.', { exact: true }).waitFor();
    assert.deepEqual(refused.request().postDataJSON(), pin);
    assert.deepEqual(await durable(), before);
    await f.same(working);
    await f.snapshot('07-reopened-stop-writer-busy');
  } finally {
    await writeFile(release, '');
    [terminalExit] = await exit;
    await writeFile(join(f.output, 'terminal-declined.txt'), stderr + stdout);
  }
  assert.equal(terminalExit, 1);
  assert.match(stderr, /terminal action was not confirmed/i);

  f.phase = 'refuse a stale card and stop the exact run after the terminal releases it';
  const origin = new URL(f.page.url()).origin;
  const requestStop = data => f.page.request.post(origin + base + 'stop', {
    headers: { origin, 'x-barocss-task-run': 'stop', 'content-type': 'application/json' }, data,
  });
  const released = await durable();
  assert.deepEqual(released.bytes, before.bytes);
  assert.deepEqual(released.entries.filter(name => !before.entries.includes(name)), ['released-' + JSON.parse(before.bytes).record.epoch + '.json']);
  const stale = await requestStop({ ...pin, revision: approved.revision });
  assert.equal(stale.status(), 409);
  assert.equal((await stale.json()).error, 'The local run changed. Refresh its status before stopping.');
  assert.deepEqual(await durable(), released);
  const response = await stop();
  assert.equal(response.status(), 200, await response.text());
  assert.deepEqual(response.request().postDataJSON(), pin);
  const stopped = await response.json();
  assert.equal(stopped.phase, 'stopped');
  assert.equal(stopped.revision, held.revision + 2);
  assert.deepEqual(stopped.tasks.map(task => task.phase), ['completed', 'cancelled']);
  assert.equal(stopped.tasks[1].reason, 'RUN_STOPPED');
  assert.deepEqual([stopped.baselineDigest, stopped.checkpoint, stopped.approvals], [held.baselineDigest, held.checkpoint, held.approvals]);
  assert.ok(!Object.hasOwn(stopped, 'directory'));
  const stoppedRecord = await readRecord(), stoppedBytes = await durable();
  assert.deepEqual(stoppedRecord.commits, approved.commits);
  assert.deepEqual(stoppedRecord.accepted, approved.accepted);
  assert.equal(stoppedRecord.state.operations.filter(op => op.id.startsWith('studio:stop:') && op.phase === 'completed').length, 1);
  assert.equal(stoppedRecord.epoch, JSON.parse(before.bytes).record.epoch + 1);
  await card().getByText('Reopened local run · stopped', { exact: true }).waitFor();
  assert.equal(await button(card(), 'Stop local run').count(), 0);
  assert.equal(await button(card(), 'Review candidate p2').count(), 0);
  await f.same(working);
  await f.snapshot('08-reopened-stopped-with-approved-checkpoint');
  const repeat = await requestStop(pin);
  assert.equal(repeat.status(), 200);
  assert.deepEqual(await repeat.json(), stopped);
  const late = spawnSync(process.execPath, [cli, 'task-run', 'decide', run, 'd642-late-approval', 'p2', 'approve', '--review', reviewFile],
    { cwd: f.app, encoding: 'utf8', timeout: 30000 });
  assert.equal(late.status, 1, late.stderr);
  assert.match(late.stderr, /No current candidate is awaiting review/);
  assert.deepEqual(await durable(), stoppedBytes);
  assert.equal(expectedConsole.length, 1);
  const expectedIndex = f.report.consoleErrors.indexOf(expectedConsole[0]);
  assert.ok(expectedIndex >= 0);
  f.report.consoleErrors.splice(expectedIndex, 1);
  f.report.expectedConsoleErrors = expectedConsole;

  f.phase = 'open the same approved checkpoint from the stopped run in a fresh Studio session';
  await f.newPage();
  await open('unrelated-working-model.bcad', working);
  const reopened = await reopen();
  assert.deepEqual([reopened.revision, reopened.phase, reopened.checkpoint], [stopped.revision, stopped.phase, stopped.checkpoint]);
  await f.same(working);
  const [checkpoint] = await Promise.all([f.page.waitForResponse(matches('checkpoint')), button(card(), 'Open approved checkpoint').click()]);
  assert.equal(checkpoint.status(), 200);
  const checkpointBytes = await checkpoint.body();
  const offset = 16 + checkpointBytes.readUInt32LE(8) + checkpointBytes.readUInt32LE(12);
  assert.deepEqual(checkpointBytes.subarray(offset), approvedNative);
  await f.same(JSON.parse(approvedNative));
  assert.deepEqual((await f.doc()).instances.map(part => part.doc.nodes[1].height), [6, 3]);
  assert.deepEqual(await durable(), stoppedBytes);
  await f.snapshot('09-reopened-stopped-checkpoint-opened');
  await writeFile(join(f.output, 'd642-checkpoint.bcad-run'), checkpointBytes);
  await writeFile(join(f.output, 'd642-record-before.json'), released.bytes);
  await writeFile(join(f.output, 'd642-stop-status.json'), JSON.stringify({ held, stopped, reopened }));
  f.report.observations.push({ busyRefused: true, staleRefused: true, retiredApprovalRefused: true, duplicateStopChangedRecord: false,
    stopOperations: 1, publicationsBeforeAndAfter: [1, 1], finalHeightsMm: [6, 3], acceptedSHA256: approved.accepted.sha256,
    revisions: [held.revision, stopped.revision], stoppedRecordSHA256: sha256(stoppedBytes.bytes) });
}
