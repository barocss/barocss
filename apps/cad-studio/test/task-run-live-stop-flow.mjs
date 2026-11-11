import assert from 'node:assert/strict';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';

const base = '/api/chat/task-runs/';
const matches = action => response => new URL(response.url()).pathname === base + action && response.request().method() === 'POST';
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const phases = status => status.tasks.map(task => task.phase);

export async function taskRunLiveStopFlow({ f, row, start, source, saved, bytes, workerBarrier, runRoot, openFile, open }) {
  f.phase = 'show two running tasks and a queued task before Stop';
  let admitted, stopped, durable, writer, markers;
  const release = join(workerBarrier, 'release');
  try {
    const [startResponse] = await Promise.all([f.page.waitForResponse(matches('start')), start.click()]);
    assert.equal(startResponse.status(), 200);
    admitted = JSON.parse(decodeURIComponent(startResponse.headers()['x-barocss-task-run-admitted']));
    assert.deepEqual(phases(admitted), ['ready', 'ready', 'ready']);
    const runFile = join(admitted.directory, 'run.json');
    const locator = { runKey: admitted.runKey, runId: admitted.runId }, origin = new URL(f.page.url()).origin;
    const requestStop = data => f.page.request.post(origin + base + 'stop', {
      headers: { origin, 'x-barocss-task-run': 'stop', 'content-type': 'application/json' }, data,
    });
    for (const text of ['p1 · running', 'p2 · running', 'p3 · ready']) await row.getByText(text, { exact: true }).waitFor();
    const running = JSON.parse(await readFile(runFile)).record;
    const ownerFile = join(admitted.directory, 'writer-' + running.epoch + '.json');
    writer = JSON.parse(await readFile(ownerFile));
    const readMarkers = async () => (await readdir(workerBarrier)).filter(name => /^worker-/.test(name)).sort();
    const workerFiles = await readMarkers();
    markers = await Promise.all(workerFiles.map(name => readFile(join(workerBarrier, name), 'utf8').then(JSON.parse)));
    assert.deepEqual(markers.map(marker => marker.task).sort(), ['p1', 'p2']);
    assert.ok(markers.every(marker => marker.pid === writer.pid && marker.runId === admitted.runId));
    assert.deepEqual(await readdir(runRoot), [locator.runKey]);
    assert.deepEqual(running.commits, []);
    assert.equal((await requestStop({ ...locator, runId: 'other-run' })).status(), 409);
    assert.equal((await requestStop({ ...locator, directory: admitted.directory })).status(), 400);
    assert.deepEqual(JSON.parse(await readFile(runFile)).record, running);
    await f.snapshot('07-live-stop-workers-running');

    f.phase = 'stop through Studio while the original writer owns both workers';
    const [stopResponse] = await Promise.all([f.page.waitForResponse(matches('stop')), button(row, 'Stop local run').click()]);
    assert.equal(stopResponse.status(), 200);
    assert.deepEqual(stopResponse.request().postDataJSON(), locator);
    stopped = await stopResponse.json();
    assert.deepEqual([stopped.runKey, stopped.runId, stopped.phase], [locator.runKey, locator.runId, 'stopped']);
    assert.deepEqual(phases(stopped), ['cancelled', 'cancelled', 'cancelled']);
    assert.ok(stopped.tasks.every(task => task.reason === 'RUN_STOPPED' && !task.review && !task.rebuild));
    assert.equal(stopped.baselineDigest, admitted.baselineDigest);
    assert.equal(stopped.revision, running.revision + 1);
    const launched = await startResponse.json();
    assert.deepEqual([launched.runKey, launched.runId, launched.phase, launched.revision], [stopped.runKey, stopped.runId, 'stopped', stopped.revision]);
    await row.getByText('Local run started · stopped', { exact: true }).waitFor();
    assert.equal(await button(row, 'Stop local run').count(), 0);
    assert.equal(await button(row, 'Open approved checkpoint').count(), 0);
    assert.ok(!(await row.innerText()).includes(admitted.directory));
    await assert.rejects(access(release), { code: 'ENOENT' });
    assert.deepEqual(await readMarkers(), workerFiles);
    durable = await readFile(runFile);
    const { record } = JSON.parse(durable);
    assert.deepEqual(record.commits, []);
    assert.equal(record.pending, undefined);
    assert.deepEqual(record.accepted, running.accepted);
    assert.equal(record.epoch, running.epoch);
    assert.deepEqual(JSON.parse(await readFile(ownerFile)), writer);
    assert.equal(JSON.parse(await readFile(join(admitted.directory, 'released-' + record.epoch + '.json'))), writer.id);
    assert.deepEqual(record.state.budget, { ...running.state.budget, unknown: 4 });
    assert.deepEqual(record.state.tasks.map(task => task.attempts), [1, 1, 0]);
    assert.deepEqual(record.state.operations.map(op => [op.id, op.phase, op.code ?? null]), [
      ['initial:p1', 'interrupted', 'RUN_STOPPED'], ['initial:p2', 'interrupted', 'RUN_STOPPED'], ['studio:stop', 'completed', null],
    ]);
    const repeated = await requestStop(locator);
    assert.equal(repeated.status(), 200);
    assert.deepEqual(await repeated.json(), stopped);
    assert.deepEqual(await readFile(runFile), durable);
    await f.same(source);
    await f.snapshot('08-live-stop-cancelled');
  } finally {
    await writeFile(release, '');
  }

  f.phase = 'reopen the stopped run and explicitly open its exact native baseline';
  await f.newPage();
  const working = structuredClone(source);
  working.instances[0].doc.nodes[1].height = 8;
  await open('unrelated-working-model.bcad', working);
  const [reopened] = await Promise.all([f.page.waitForResponse(matches('reopen')), openFile('housing.bcad-task', bytes)]);
  assert.equal(reopened.status(), 200);
  const launch = await reopened.json();
  assert.deepEqual([launch.runKey, launch.runId, launch.revision, launch.phase], [stopped.runKey, stopped.runId, stopped.revision, stopped.phase]);
  const card = f.page.getByRole('region', { name: 'Reopened task run', exact: true });
  await card.getByText('Reopened local run · stopped', { exact: true }).waitFor();
  assert.ok(!(await card.innerText()).includes(admitted.directory));
  assert.equal(await button(card, 'Stop local run').count(), 0);
  await f.same(working);
  const [baseline] = await Promise.all([f.page.waitForResponse(matches('baseline')), button(card, 'Open run baseline').click()]);
  assert.equal(baseline.status(), 200);
  assert.equal(baseline.headers()['x-barocss-native-sha256'], sha256(saved));
  assert.deepEqual(await baseline.body(), saved);
  await f.same(source);
  assert.deepEqual(await readFile(join(admitted.directory, 'run.json')), durable);
  await f.snapshot('09-live-stop-baseline-opened');
  await writeFile(join(f.output, 'd641-stop.json'), JSON.stringify({ admitted, stopped, writer, markers }));
  await writeFile(join(f.output, 'd641-baseline.bcad'), await baseline.body());
  f.report.observations.push({ sameRun: true, sameWriterEpoch: true, activeWorkers: markers.length, queuedWorkerStarts: 0, stopOperations: 1,
    stoppedRevision: stopped.revision, unknownUsage: 4, publications: 0, baselineSHA256: sha256(saved), runRecordSHA256: sha256(durable),
    wrongIdRefused: true, pathFieldRefused: true, duplicateStopChangedRecord: false, localPathInChat: false });
}
