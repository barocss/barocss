import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { taskRunTerminal } from './task-run-status-flow.mjs';

const prefix = '/api/chat/task-runs/';
const responseFor = action => response => new URL(response.url()).pathname === prefix + action && response.request().method() === 'POST';

export async function taskRunRebuildFlow({ f, origin, row, launch, source, saved, savedBytes }) {
  const run = launch.directory, { approve } = taskRunTerminal(f, run);
  const locator = { runKey: launch.runKey, runId: launch.runId };
  const pick = id => row.getByRole('button', { name: 'Review candidate ' + id, exact: true });
  const rebuild = row.getByRole('button', { name: 'Rebuild candidate p2', exact: true });
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  const checkpoint = f.page.getByRole('region', { name: 'Worker checkpoint checks', exact: true });
  const before = launch.tasks[1].review;
  const click = async (action, button) => {
    const [response] = await Promise.all([f.page.waitForResponse(responseFor(action)), button.click()]);
    assert.equal(response.status(), 200);
    return response;
  };
  const status = async () => (await click('status', row.getByRole('button', { name: 'Refresh local run status', exact: true }))).json();
  const openApproved = async name => {
    const response = await click('checkpoint', row.getByRole('button', { name: 'Open approved checkpoint', exact: true }));
    await writeFile(join(f.output, name + '.bcad-run'), await response.body());
  };
  const disk = async () => ({
    bytes: await readFile(join(run, 'run.json')),
    entries: (await readdir(run)).sort(),
    native: (await readdir(join(run, 'native'))).sort(),
  });
  const heights = () => f.page.evaluate(() => window.__studioInstanceBounds?.().map(part => [part.id, part.max[2] - part.min[2]]));
  const request = (action, payload) => f.page.request.post(origin + prefix + action, {
    headers: { origin, 'content-type': 'application/json', 'x-barocss-task-run': action }, data: payload,
  });

  f.phase = 'retire the old preview after approving the sibling';
  await pick('p2').click();
  await review.getByText(before.attemptId, { exact: true }).waitFor();
  await f.same(source);
  await approve('p1', 'd631-approve-sibling');
  const stale = await status();
  assert.deepEqual(stale.tasks.map(task => task.phase), ['completed', 'stale']);
  assert.equal(stale.tasks[1].rebuild, before.attemptId);
  await review.waitFor({ state: 'hidden' });
  assert.equal(await pick('p2').count(), 0);
  await openApproved('sibling-approved');
  await checkpoint.getByText(/^Task p1 ·/).waitFor();
  const accepted = await f.doc();
  const committed = await disk();
  assert.deepEqual(await heights(), [['p1', 6], ['p2', 3]]);
  const pin = { ...locator, revision: stale.revision, baselineDigest: stale.baselineDigest, taskId: 'p2', attemptId: stale.tasks[1].rebuild };
  for (const patch of [{ revision: stale.revision - 1 }, { attemptId: 'other-attempt' }]) {
    const refused = await request('rebuild', { ...pin, ...patch });
    assert.equal(refused.status(), 409);
    assert.match((await refused.json()).error, /candidate changed/i);
  }
  assert.deepEqual(await disk(), committed);
  await f.snapshot('19-stale-candidate-rebuild');

  f.phase = 'rebuild one selected stale attempt from Studio';
  let posts = 0;
  f.page.on('request', req => { if (new URL(req.url()).pathname === prefix + 'rebuild') posts++; });
  const route = '**' + prefix + 'rebuild', received = Promise.withResolvers(), release = Promise.withResolvers();
  const hold = async route => {
    const response = await route.fetch({ timeout: 15000 }).catch(error => { received.reject(error); return null; });
    if (!response) return route.abort();
    received.resolve(response.status());
    await release.promise;
    await route.fulfill({ response });
  };
  let rebuilt;
  await f.page.route(route, hold);
  try {
    const returned = click('rebuild', rebuild);
    assert.equal(await received.promise, 200);
    assert.equal(await rebuild.isDisabled(), true);
    assert.equal(await pick('p2').count(), 0);
    assert.equal(posts, 1);
    await f.same(accepted);
    release.resolve();
    const response = await returned;
    assert.deepEqual(response.request().postDataJSON(), pin);
    assert.equal(response.headers()['cache-control'], 'no-store');
    rebuilt = await response.json();
  } finally { release.resolve(); await f.page.unroute(route, hold); }
  assert.deepEqual(rebuilt.tasks.map(task => task.phase), ['completed', 'awaiting-decision']);
  assert.equal(rebuilt.baselineDigest, stale.baselineDigest);
  const fresh = rebuilt.tasks[1].review;
  assert.notEqual(fresh.attemptId, before.attemptId);
  assert.notEqual(fresh.candidateDigest, before.candidateDigest);
  const held = await disk(), old = await request('review', { ...locator, taskId: 'p2', baselineDigest: stale.baselineDigest, ...before });
  assert.equal(old.status(), 409);
  const repeat = await request('rebuild', pin);
  assert.equal(repeat.status(), 409);
  assert.deepEqual(await disk(), held);
  const { record } = JSON.parse(held.bytes);
  assert.deepEqual(record.commits.map(commit => commit.taskId), ['p1']);
  assert.deepEqual(record.state.budget, { limit: 8, used: 2, unknown: 0 });
  assert.equal(record.state.tasks[1].attempts, 2);
  assert.equal(record.state.tasks[1].attempt.reservation, 0);
  assert.equal(record.state.operations.filter(op => op.id.startsWith('studio-rebuild:')).length, 1);
  assert.deepEqual(held.native, committed.native);

  f.phase = 'review the rebuilt candidate and publish it only after terminal approval';
  await pick('p2').click();
  await review.getByText(fresh.attemptId, { exact: true }).waitFor();
  await review.getByText('Height · 3 mm → 4 mm', { exact: true }).waitFor();
  assert.deepEqual(await heights(), [['p1', 6], ['p2', 4]]);
  await f.same(accepted);
  await f.snapshot('20-rebuilt-candidate-preview');
  assert.equal((await approve('p2', 'd631-approve-rebuilt')).candidateDigest, fresh.candidateDigest);
  const final = await status();
  assert.deepEqual(final.tasks.map(task => task.phase), ['completed', 'completed']);
  await openApproved('rebuilt-approved');
  await checkpoint.getByText(/^Task p2 ·/).waitFor();
  assert.deepEqual(await heights(), [['p1', 6], ['p2', 4]]);
  assert.deepEqual(await savedBytes(), saved);
  await f.snapshot('21-rebuilt-approved-checkpoint');
  f.report.observations.push({ selectedTask: 'p2', rebuildPosts: posts, oldAttemptRefused: true, staleAndDuplicateRequestsRefused: 3,
    beforeAttempt: before.attemptId, afterAttempt: fresh.attemptId, candidatePublicationDuringRebuild: 0,
    runUsageAfterRebuild: record.state.budget.used, finalHeightsMm: [6, 4] });
}
