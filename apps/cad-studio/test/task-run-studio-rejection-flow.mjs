import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';

const base = '/api/chat/task-runs/';
const responseFor = action => response => new URL(response.url()).pathname === base + action && response.request().method() === 'POST';
const button = (parent, name) => parent.getByRole('button', { name, exact: true });

export async function taskRunStudioRejectionFlow({ f, row, launch, source, saved, bytes, openFile }) {
  const run = launch.directory, recordFile = join(run, 'run.json');
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  const initial = JSON.parse(await readFile(recordFile)).record;
  const disk = async () => ({ record: await readFile(recordFile), entries: (await readdir(run)).sort(), native: (await readdir(join(run, 'native'))).sort() });
  const capture = async (action, control) => {
    const [response] = await Promise.all([f.page.waitForResponse(responseFor(action)), control.click()]);
    assert.equal(response.status(), 200, await response.text());
    return response;
  };
  const readReview = async (task, value) => {
    const response = await capture('review', button(row, 'Review candidate ' + task));
    const result = await response.json(), { receipt, digest } = JSON.parse(result.review);
    await review.getByText(value, { exact: true }).waitFor();
    assert.equal(receipt.submission.taskId, task);
    return { ...response.request().postDataJSON(), reviewRevision: receipt.revision, controlRevision: result.controlRevision, receiptDigest: digest };
  };
  const origin = new URL(f.page.url()).origin;
  const request = (action, data) => f.page.request.post(origin + base + action, {
    headers: { origin, 'x-barocss-task-run': action, 'content-type': 'application/json' }, data,
  });

  f.phase = 'review both candidates and refuse a mismatched rejection';
  const before = await disk(), firstP1 = await readReview('p1', 'Height · 5 mm → 6 mm');
  const p2 = await readReview('p2', 'Height · 3 mm → 4 mm');
  assert.equal(await button(review, 'Reject candidate').isEnabled(), true);
  await button(review, 'Show accepted model').click();
  assert.equal(await button(review, 'Reject candidate').isDisabled(), true);
  const restored = await capture('review', button(review, 'Preview candidate'));
  assert.equal(JSON.parse((await restored.json()).review).digest, p2.receiptDigest);
  await review.getByText('Candidate preview', { exact: true }).waitFor();
  const wrong = await request('reject', { ...p2, receiptDigest: '0'.repeat(64) });
  assert.equal(wrong.status(), 409);
  assert.match((await wrong.json()).error, /reviewed candidate changed/i);
  assert.deepEqual(await disk(), before);
  await f.same(source);
  await f.snapshot('07-review-before-studio-rejection');

  f.phase = 'reject p2 from its preview and preserve the original native model and p1 receipt';
  const refused = await capture('reject', button(review, 'Reject candidate'));
  assert.deepEqual(refused.request().postDataJSON(), p2);
  const rejected = await refused.json();
  assert.equal(rejected.phase, 'active');
  assert.deepEqual(rejected.tasks.map(task => [task.phase, task.reason]), [['awaiting-decision', undefined], ['cancelled', 'RUN_REJECTED']]);
  assert.deepEqual(rejected.tasks[0].review, launch.tasks[0].review);
  assert.equal(rejected.baselineDigest, launch.baselineDigest);
  assert.equal(rejected.checkpoint, undefined);
  assert.ok(!Object.hasOwn(rejected, 'directory'));
  await row.getByText('p2 · cancelled · RUN_REJECTED', { exact: true }).waitFor();
  await review.waitFor({ state: 'detached' });
  assert.equal(await button(row, 'Review candidate p2').count(), 0);
  assert.equal(await button(row, 'Open approved checkpoint').count(), 0);
  await f.same(source);
  const rejectedDisk = await disk(), rejectedRecord = JSON.parse(rejectedDisk.record).record;
  assert.deepEqual(rejectedRecord.accepted, initial.accepted);
  assert.deepEqual(rejectedRecord.commits, []);
  assert.deepEqual(rejectedDisk.native, before.native);
  assert.deepEqual(rejectedRecord.state.budget, initial.state.budget);
  assert.deepEqual(rejectedRecord.state.tasks[0], initial.state.tasks[0]);
  const repeat = await request('reject', p2);
  assert.equal(repeat.status(), 200);
  assert.deepEqual(await repeat.json(), rejected);
  assert.equal((await request('approve', p2)).status(), 409);
  assert.deepEqual(await disk(), rejectedDisk);
  await f.snapshot('08-studio-rejected-one-candidate');

  f.phase = 'approve the original sibling review and reopen the resulting checkpoint';
  const p1 = await readReview('p1', 'Height · 5 mm → 6 mm');
  assert.deepEqual([p1.attemptId, p1.candidateDigest, p1.baselineDigest], [firstP1.attemptId, firstP1.candidateDigest, firstP1.baselineDigest]);
  const approval = await capture('approve', button(review, 'Approve candidate'));
  assert.deepEqual(approval.request().postDataJSON(), p1);
  const approved = await approval.json();
  assert.deepEqual(approved.tasks.map(task => [task.phase, task.reason]), [['completed', undefined], ['cancelled', 'RUN_REJECTED']]);
  assert.equal(approved.checkpoint.taskId, 'p1');
  await row.getByText('p1 · completed', { exact: true }).waitFor();
  await f.same(source);
  const approvedDisk = await disk(), approvedRecord = JSON.parse(approvedDisk.record).record;
  assert.deepEqual(approvedRecord.commits.map(commit => commit.taskId), ['p1']);
  assert.equal(approvedRecord.commits[0].from.sha256, sha256(saved));
  assert.equal(approvedRecord.pending, undefined);
  assert.equal((await request('reject', p1)).status(), 409);
  const repeatedAfterApproval = await request('reject', p2);
  assert.equal(repeatedAfterApproval.status(), 200);
  assert.deepEqual(await repeatedAfterApproval.json(), approved);
  assert.deepEqual(await disk(), approvedDisk);

  await f.newPage();
  const [reopened] = await Promise.all([f.page.waitForResponse(responseFor('reopen')), openFile('housing.bcad-task', bytes)]);
  assert.equal(reopened.status(), 200);
  const fresh = await reopened.json();
  assert.deepEqual([fresh.tasks, fresh.checkpoint], [approved.tasks, approved.checkpoint]);
  const card = f.page.getByRole('region', { name: 'Reopened task run', exact: true });
  await card.getByText('p2 · cancelled · RUN_REJECTED', { exact: true }).waitFor();
  const checkpoint = await (await capture('checkpoint', button(card, 'Open approved checkpoint'))).body();
  const headerEnd = 16 + checkpoint.readUInt32LE(8), acceptedStart = headerEnd + checkpoint.readUInt32LE(12);
  assert.deepEqual(checkpoint.subarray(headerEnd, acceptedStart), saved);
  const accepted = checkpoint.subarray(acceptedStart);
  assert.equal(sha256(accepted), approved.checkpoint.acceptedSHA256);
  await f.same(JSON.parse(accepted));
  assert.deepEqual((await f.doc()).instances.map(part => part.doc.nodes[1].height), [6, 3]);
  assert.deepEqual(await disk(), approvedDisk);
  await f.snapshot('09-reopened-after-studio-rejection');
  await writeFile(join(f.output, 'd645-checkpoint.bcad-run'), checkpoint);
  await writeFile(join(f.output, 'd645-rejected-record.json'), rejectedDisk.record);
  await writeFile(join(f.output, 'd645-decisions.json'), JSON.stringify({ p1, p2, rejected, approved }));
  f.report.observations.push({ rejected: 'p2', approved: 'p1', publicationsAtRejection: 0, finalPublications: 1, finalHeightsMm: [6, 3],
    repeatedRejectionChangedRecord: false, staleDecisionsRefused: 2, originalSHA256: sha256(saved), acceptedSHA256: sha256(accepted) });
}
