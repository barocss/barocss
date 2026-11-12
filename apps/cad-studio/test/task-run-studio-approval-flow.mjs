import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';

const base = '/api/chat/task-runs/';
const matches = action => response => new URL(response.url()).pathname === base + action && response.request().method() === 'POST';
const button = (parent, name) => parent.getByRole('button', { name, exact: true });

export async function taskRunStudioApprovalFlow({ f, row, launch, source, saved, bytes, openFile, deliver, siblingDiameter = false, baseFootprint = false }) {
  const run = launch.directory, file = join(run, 'run.json');
  const durable = async () => ({ bytes: await readFile(file), entries: (await readdir(run)).sort() });
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  const origin = new URL(f.page.url()).origin;
  const requestApproval = data => f.page.request.post(origin + base + 'approve', {
    headers: { origin, 'x-barocss-task-run': 'approve', 'content-type': 'application/json' }, data,
  });
  async function readReview(id, before, after) {
    const [response] = await Promise.all([f.page.waitForResponse(matches('review')), button(row, 'Review candidate ' + id).click()]);
    assert.equal(response.status(), 200);
    const envelope = await response.json(), { receipt, digest } = JSON.parse(envelope.review);
    const dimension = baseFootprint && id === 'p1' ? 'Width × Depth' : siblingDiameter && id === 'p2' ? 'Diameter' : 'Height';
    await review.getByText(dimension + ' · ' + before + ' mm → ' + after + ' mm', { exact: true }).waitFor();
    assert.equal(await button(review, 'Approve candidate').isEnabled(), true);
    assert.equal(receipt.submission.taskId, id);
    return { ...response.request().postDataJSON(), reviewRevision: receipt.revision, controlRevision: envelope.controlRevision, receiptDigest: digest };
  }

  f.phase = 'review both candidates without publishing a model';
  const initial = await durable();
  const retired = await readReview('p2', ...(siblingDiameter ? [4, 6] : [3, 4]));
  await button(review, 'Show accepted model').click();
  assert.equal(await button(review, 'Approve candidate').isDisabled(), true);
  const request = baseFootprint ? await readReview('p1', '20 × 10', '24 × 14') : await readReview('p1', 5, 6);
  if (baseFootprint) {
    await review.getByText('Volume change · +680 mm³', { exact: true }).waitFor();
    await f.page.waitForFunction(() => {
      const base = window.__studioInstanceBounds?.().find(row => row.id === 'p1');
      return base && base.min.join(',') === '3,-3,0' && base.max.join(',') === '27,11,5';
    });
  }
  await f.same(source);
  await f.snapshot('07-studio-review-before-approval');
  const wrong = await requestApproval({ ...request, receiptDigest: '0'.repeat(64) });
  assert.equal(wrong.status(), 409);
  assert.equal((await wrong.json()).error, 'The reviewed candidate changed. Review it again before approving.');
  const wrongControl = await requestApproval({ ...request, controlRevision: request.controlRevision + 1 });
  assert.equal(wrongControl.status(), 409);
  assert.deepEqual(await durable(), initial);

  f.phase = 'publish only the candidate explicitly approved in Studio';
  const [approval] = await Promise.all([f.page.waitForResponse(matches('approve')), button(review, 'Approve candidate').click()]);
  assert.equal(approval.status(), 200, await approval.text());
  assert.deepEqual(approval.request().postDataJSON(), request);
  const status = await approval.json();
  assert.equal(status.phase, 'active');
  assert.equal(status.checkpoint.taskId, 'p1');
  assert.deepEqual(status.approvals, [status.checkpoint]);
  assert.deepEqual(status.tasks.map(task => task.phase), ['completed', 'stale']);
  assert.ok(!Object.hasOwn(status, 'directory'));
  await row.getByText('p1 · completed', { exact: true }).waitFor();
  await review.waitFor({ state: 'detached' });
  await f.same(source);
  const approved = await durable(), record = JSON.parse(approved.bytes).record;
  assert.equal(record.commits.length, 1);
  assert.equal(record.commits[0].candidateDigest, request.candidateDigest);
  assert.equal(record.commits[0].from.sha256, sha256(saved));
  assert.equal(record.commits[0].to.sha256, status.checkpoint.acceptedSHA256);
  assert.equal(record.pending, undefined);
  await f.snapshot('08-studio-approved-candidate');

  f.phase = 'refuse the retired review and reuse the successful approval without a second commit';
  const denied = await requestApproval(retired);
  assert.equal(denied.status(), 409);
  assert.equal((await denied.json()).error, 'The reviewed candidate is no longer awaiting approval.');
  const duplicate = await requestApproval(request);
  assert.equal(duplicate.status(), 200);
  assert.deepEqual(await duplicate.json(), status);
  assert.deepEqual(await durable(), approved);

  if (deliver) return deliver({ firstStatus: status, firstRecord: record, readReview, retired });

  f.phase = 'reopen and open the exact Studio-approved checkpoint';
  await f.newPage();
  const [reopened] = await Promise.all([f.page.waitForResponse(matches('reopen')), openFile('housing.bcad-task', bytes)]);
  assert.equal(reopened.status(), 200);
  const reopenedStatus = await reopened.json();
  assert.deepEqual(reopenedStatus.checkpoint, status.checkpoint);
  const card = f.page.getByRole('region', { name: 'Reopened task run', exact: true });
  assert.ok(!(await card.innerText()).includes(run));
  const [checkpoint] = await Promise.all([f.page.waitForResponse(matches('checkpoint')), button(card, 'Open approved checkpoint').click()]);
  assert.equal(checkpoint.status(), 200);
  const native = await checkpoint.body();
  const offset = 16 + native.readUInt32LE(8) + native.readUInt32LE(12);
  const accepted = await readFile(join(run, 'native', status.checkpoint.acceptedSHA256 + '.bcad'));
  assert.deepEqual(native.subarray(offset), accepted);
  await f.same(JSON.parse(accepted));
  assert.deepEqual((await f.doc()).instances.map(part => part.doc.nodes[1].height), [6, 3]);
  assert.deepEqual(await durable(), approved);
  await f.snapshot('09-studio-approved-checkpoint-opened');
  await writeFile(join(f.output, 'd643-checkpoint.bcad-run'), native);
  await writeFile(join(f.output, 'd643-approval.json'), JSON.stringify({ request, retired, status }));
  f.report.observations.push({ exactReceiptRequired: true, wrongControlRefused: true, retiredReviewRefused: true, duplicateChangedRecord: false,
    publications: 1, finalHeightsMm: [6, 3], acceptedSHA256: status.checkpoint.acceptedSHA256,
    acceptedRecordSHA256: sha256(approved.bytes), approvalRevision: status.revision });
}
