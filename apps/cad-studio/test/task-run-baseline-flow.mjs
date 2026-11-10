import assert from 'node:assert/strict';
import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';
import { taskRunTerminal } from './task-run-status-flow.mjs';

const prefix = '/api/chat/task-runs/';
const responseFor = action => response => new URL(response.url()).pathname === prefix + action && response.request().method() === 'POST';

export async function taskRunBaselineFlow({ f, openFile, open, bytes, source, saved, launch }) {
  const run = launch.directory;
  const durable = async () => ({
    bytes: await readFile(join(run, 'run.json')),
    entries: (await readdir(run)).sort(),
    native: (await readdir(join(run, 'native'))).sort(),
  });
  const standalone = join(f.output, 'housing.bcad');
  await rename(standalone, join(f.output, 'standalone-source-evidence.bcad'));
  await assert.rejects(readFile(standalone), { code: 'ENOENT' });

  f.phase = 'reopen a held run without the original standalone model';
  await f.newPage();
  let starts = 0;
  f.page.on('request', request => { if (new URL(request.url()).pathname === prefix + 'start') starts++; });
  const unrelated = structuredClone(source);
  unrelated.instances[0].doc.nodes[1].height = 8;
  await open('different-working.bcad', unrelated);
  await f.addParameter('baselineCheck', 9, '16-working-before-baseline');
  const edited = await f.doc();
  const before = await durable();
  const [reopened] = await Promise.all([f.page.waitForResponse(responseFor('reopen')), openFile('housing.bcad-task', bytes)]);
  assert.equal(reopened.status(), 200);
  const reopenedStatus = await reopened.json();
  assert.deepEqual([reopenedStatus.runId, reopenedStatus.runKey], [launch.runId, launch.runKey]);
  const card = f.page.getByRole('region', { name: 'Reopened task run', exact: true });
  const baseline = card.getByRole('button', { name: 'Open run baseline', exact: true });
  const idle = () => baseline.filter({ hasText: /^Open run baseline$/ }).waitFor();
  const clickOpen = async () => {
    const [response] = await Promise.all([f.page.waitForResponse(responseFor('baseline')), baseline.click()]);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['cache-control'], 'no-store');
    assert.equal(response.headers()['content-type'], 'application/octet-stream');
    assert.equal((await response.request().allHeaders())['x-barocss-task-run'], 'baseline');
    return response;
  };
  await idle();
  await f.same(edited);

  f.phase = 'refuse a damaged baseline response without changing the model';
  const route = '**' + prefix + 'baseline';
  const corrupt = async request => {
    const response = await request.fetch({ timeout: 10000 });
    const content = await response.body();
    content[0] ^= 1;
    await request.fulfill({ response, body: content });
  };
  await f.page.route(route, corrupt, { times: 1 });
  await clickOpen();
  await card.getByText('The local baseline response does not match its native checksum.', { exact: true }).waitFor();
  await f.same(edited);
  assert.equal(await f.page.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), true);
  assert.deepEqual(await durable(), before);

  async function duringHeldRead(change) {
    const received = Promise.withResolvers(), release = Promise.withResolvers();
    const delay = async request => {
      const response = await request.fetch({ timeout: 10000 }).catch(error => { received.reject(error); return null; });
      if (!response) return request.abort();
      received.resolve(response);
      await release.promise;
      await request.fulfill({ response });
    };
    await f.page.route(route, delay);
    try {
      await Promise.all([f.page.waitForRequest(request => new URL(request.url()).pathname === prefix + 'baseline'), baseline.click()]);
      assert.equal((await received.promise).status(), 200);
      await change();
      const finished = f.page.waitForResponse(responseFor('baseline'));
      release.resolve();
      assert.equal((await finished).status(), 200);
      await idle();
    } finally { release.resolve(); await f.page.unroute(route, delay); }
  }

  f.phase = 'ignore a valid baseline response after a newer file Open';
  const newer = structuredClone(unrelated);
  newer.instances[0].doc.nodes[1].height = 9;
  await duringHeldRead(() => open('newer-working-model.bcad', newer));
  await f.same(newer);
  assert.deepEqual(await durable(), before);

  f.phase = 'open the exact run baseline and review the held candidate';
  const original = await clickOpen();
  assert.deepEqual(original.request().postDataJSON(), {
    runKey: launch.runKey, runId: launch.runId, baselineDigest: launch.baselineDigest,
  });
  assert.equal(original.headers()['x-barocss-native-sha256'], sha256(saved));
  assert.deepEqual(await original.body(), saved);
  await f.same(source);
  await idle();
  await card.getByRole('button', { name: 'Review candidate p1', exact: true }).click();
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  await review.getByText('Height · 5 mm → 6 mm', { exact: true }).waitFor();
  await review.getByText(launch.tasks[0].review.attemptId, { exact: true }).waitFor();
  await f.same(source);
  assert.deepEqual(await durable(), before);
  await f.snapshot('17-opened-baseline-candidate-reviewed');

  f.phase = 'refuse the held baseline after a terminal publication';
  await open('working-during-publication.bcad', newer);
  const { approve } = taskRunTerminal(f, run);
  await duringHeldRead(() => approve('p1', 'd630-approve-during-baseline-open'));
  await card.getByText('The run baseline changed during Open. Refresh the local run status.', { exact: true }).waitFor();
  await f.same(newer);
  const afterApproval = await durable();

  f.phase = 'refresh and open the newly accepted baseline';
  const [statusReply] = await Promise.all([
    f.page.waitForResponse(responseFor('status')), card.getByRole('button', { name: 'Refresh local run status', exact: true }).click(),
  ]);
  const refreshed = await statusReply.json();
  assert.notEqual(refreshed.baselineDigest, launch.baselineDigest);
  await card.getByText('p1 · completed', { exact: true }).waitFor();
  const next = await clickOpen();
  const finalBytes = await next.body();
  assert.equal(sha256(finalBytes), refreshed.checkpoint.acceptedSHA256);
  await writeFile(join(f.output, 'new-run-baseline.bcad'), finalBytes);
  await f.same(JSON.parse(finalBytes));
  assert.deepEqual((await f.doc()).instances.map(part => part.doc.nodes[1].height), [6, 3]);
  assert.deepEqual(await durable(), afterApproval);
  assert.equal(starts, 0);
  await f.snapshot('18-opened-newly-accepted-baseline');
  f.report.observations.push({ originalNativeSHA256: sha256(saved), acceptedNativeSHA256: sha256(finalBytes),
    damagedReplyRefused: true, newerFileOpenPreserved: true, obsoleteRunReplyRefused: true, nativeRunWrites: 0,
    startsAfterReopen: starts, reviewedHeldAttempt: true, finalHeightsMm: [6, 3] });
}
