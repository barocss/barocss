import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';
import { taskRunTerminal } from './task-run-status-flow.mjs';

const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const model = ({ proposals, history, ...doc }) => doc;
const delivery = 'shared-hole-delivered';
const gates = ['lease', 'validity', 'contract', 'assembly'];

export async function taskRunSharedHoleDeliveryFlow({ f, row, recheck, repaired, accepted, after, baselineView,
  openProject, files, save, readSaved, readHeights, choose, verifyPreserved }) {
  const run = recheck.directory, terminalOutput = join(f.output, 'delivery-terminal');
  await mkdir(terminalOutput);
  const { callCli, approve } = taskRunTerminal({ app: f.app, output: terminalOutput }, run);
  const locator = { runKey: recheck.runKey, runId: recheck.runId };
  const origin = new URL(f.page.url()).origin;
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  const checkpoint = f.page.getByRole('region', { name: 'Worker checkpoint checks', exact: true });
  const oldReceipt = join(f.output, 'shared-hole-old-p2.bcad-candidate');
  const oldPin = recheck.tasks[1].review;
  const refresh = async () => {
    const response = await choose(f, 'status', () => button(row, 'Refresh local run status').click());
    assert.deepEqual(response.request().postDataJSON(), locator);
    return response.json();
  };
  const disk = async () => {
    const bytes = await readFile(join(run, 'run.json'));
    const entries = (await readdir(run)).sort();
    const native = await Promise.all((await readdir(join(run, 'native'))).sort().map(async name =>
      [name, sha256(await readFile(join(run, 'native', name)))]));
    return { bytes, entries, native };
  };
  const bounds = heights => baselineView.placed.map((part, index) => ({
    ...part, max: [...part.max.slice(0, 2), part.min[2] + heights[index]],
  }));
  const waitBounds = expected => f.page.waitForFunction(expected => {
    const placed = window.__studioInstanceBounds?.();
    return placed?.length === expected.length && placed.every(({ id, min, max }, i) =>
      id === expected[i].id && min.every((value, j) => Math.abs(value - expected[i].min[j]) < 1e-8) &&
      max.every((value, j) => Math.abs(value - expected[i].max[j]) < 1e-8));
  }, expected);
  const placedState = () => ({ placed: window.__studioInstanceBounds?.() ?? [] });
  const refuseReceipt = async (name, message) => {
    const result = spawnSync(process.execPath, [join(f.app, 'scripts/cad-cli.mjs'), 'task-run', 'decide',
      run, name, 'p2', 'approve', '--review', oldReceipt], { cwd: f.app, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 1, result.error?.message ?? result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, message);
    await writeFile(join(f.output, name + '.stderr.txt'), result.stderr);
  };
  const openApproved = async ({ checkpoint: pin, baselineDigest }, name, prior, fromHeight, toHeight) => {
    const response = await choose(f, 'checkpoint', () => button(row, 'Open approved checkpoint').click());
    assert.deepEqual(response.request().postDataJSON(), { ...locator, ...pin });
    assert.equal(response.headers()['content-type'], 'application/octet-stream');
    assert.equal(response.headers()['cache-control'], 'no-store');
    const bytes = Buffer.from(await response.body());
    assert.equal(Number(response.headers()['content-length']), bytes.length);
    assert.equal(bytes.subarray(0, 8).toString(), 'BCADRUN1');
    const headerEnd = 16 + bytes.readUInt32LE(8), acceptedStart = headerEnd + bytes.readUInt32LE(12);
    const { receipt } = JSON.parse(bytes.subarray(16, headerEnd));
    assert.deepEqual([receipt.runId, receipt.taskId, receipt.operationId, receipt.accepted.sha256, receipt.accepted.modelDigest],
      [locator.runId, pin.taskId, pin.operationId, pin.acceptedSHA256, baselineDigest]);
    assert.deepEqual(bytes.subarray(headerEnd, acceptedStart), prior);
    const native = bytes.subarray(acceptedStart);
    assert.equal(sha256(native), pin.acceptedSHA256);
    assert.deepEqual(native, await readFile(join(run, 'native', pin.acceptedSHA256 + '.bcad')));
    await f.same(JSON.parse(native));
    await checkpoint.getByText('Task ' + pin.taskId + ' · ' + pin.taskId + ' · ' + receipt.proposalId +
      ' · Revision ' + receipt.revision, { exact: true }).waitFor();
    assert.deepEqual(await checkpoint.getByRole('cell').allTextContents(), [
      'Fail · ' + fromHeight + ' mm', 'Pass · ' + toHeight + ' mm',
    ]);
    await writeFile(join(f.output, name + '.bcad-run'), bytes);
    return native;
  };

  f.phase = 'publish p1 from the repaired run and refuse its retired p2 receipt';
  const initial = await disk();
  const { candidateReview: old } = await callCli('shared-hole-old-p2-review', 'review', run, 'p2', oldReceipt);
  assert.deepEqual([old.attemptId, old.candidateDigest, old.baseline.sha256],
    [oldPin.attemptId, oldPin.candidateDigest, sha256(repaired)]);
  assert.deepEqual(await disk(), initial);
  const firstReview = await approve('p1', 'd638-approve-p1');
  assert.equal(firstReview.candidateDigest, recheck.tasks[0].review.candidateDigest);
  const stale = await refresh();
  assert.ok(stale.revision > recheck.revision);
  assert.deepEqual(stale.tasks.map(task => [task.id, task.phase]), [['p1', 'completed'], ['p2', 'stale']]);
  assert.equal(stale.tasks[1].rebuild, oldPin.attemptId);
  await row.getByText(/^p2 · stale/).waitFor();
  assert.equal(await button(row, 'Review candidate p2').count(), 0);
  const firstDisk = await disk();
  assert.deepEqual(JSON.parse(firstDisk.bytes).record.commits.map(commit => commit.taskId), ['p1']);
  await refuseReceipt('d638-refuse-stale-p2', /No current candidate is awaiting review/);
  assert.deepEqual(await disk(), firstDisk);
  await f.same(accepted);
  const firstNative = await openApproved(stale, 'shared-hole-p1-approved', repaired, 5, 6);
  const first = JSON.parse(firstNative), firstExpected = structuredClone(accepted);
  firstExpected.instances[0].doc.nodes[1].height = 6;
  assert.deepEqual(model(first), model(firstExpected));
  assert.deepEqual(first.proposals.slice(0, -1), accepted.proposals);
  assert.deepEqual(first.history.slice(0, accepted.history.length), accepted.history);
  await waitBounds(bounds([6, 3]));
  await f.snapshot('39-shared-hole-p1-approved', placedState);
  await verifyPreserved();

  f.phase = 'rebuild p2 against the exact p1 checkpoint from the Studio run card';
  const rebuildPin = { ...locator, revision: stale.revision, baselineDigest: stale.baselineDigest,
    taskId: 'p2', attemptId: oldPin.attemptId };
  const reply = await choose(f, 'rebuild', () => button(row, 'Rebuild candidate p2').click());
  assert.deepEqual(reply.request().postDataJSON(), rebuildPin);
  const rebuilt = await reply.json(), freshPin = rebuilt.tasks[1].review;
  assert.deepEqual([rebuilt.runId, rebuilt.runKey, rebuilt.baselineDigest, rebuilt.checkpoint],
    [locator.runId, locator.runKey, stale.baselineDigest, stale.checkpoint]);
  assert.ok(rebuilt.revision > stale.revision);
  assert.deepEqual(rebuilt.tasks.map(task => [task.id, task.phase]), [['p1', 'completed'], ['p2', 'awaiting-decision']]);
  assert.notEqual(freshPin.attemptId, oldPin.attemptId);
  assert.notEqual(freshPin.candidateDigest, oldPin.candidateDigest);
  const held = await disk(), { record: heldRecord } = JSON.parse(held.bytes);
  const rebuiltTask = heldRecord.state.tasks[1];
  assert.deepEqual(held.native, firstDisk.native);
  assert.deepEqual(heldRecord.commits, JSON.parse(firstDisk.bytes).record.commits);
  assert.equal(heldRecord.pending, undefined);
  assert.equal(heldRecord.accepted.sha256, sha256(firstNative));
  assert.deepEqual([rebuiltTask.attempt.id, rebuiltTask.attempt.base, rebuiltTask.candidate.gates],
    [freshPin.attemptId, heldRecord.accepted, gates]);
  assert.ok(Math.abs(rebuiltTask.candidate.geometry.volumeMm3 - (96 - 4 * Math.PI) * 4) < 1e-8);
  assert.equal(heldRecord.state.operations.filter(op => op.id.startsWith('studio-rebuild:')).length, 1);
  await refuseReceipt('d638-refuse-old-p2-after-rebuild', /The reviewed candidate differs from the current attempt/);
  const reviewPath = '/api/chat/task-runs/review';
  const staleReview = await f.page.request.post(origin + reviewPath, {
    headers: { origin, 'content-type': 'application/json', 'x-barocss-task-run': 'review' },
    data: { ...locator, taskId: 'p2', baselineDigest: stale.baselineDigest, ...oldPin },
  });
  assert.equal(staleReview.status(), 409);
  const staleError = await staleReview.json();
  assert.match(staleError.error, /The worker candidate changed/);
  await writeFile(join(f.output, 'shared-hole-old-p2-review-refused.json'), JSON.stringify(staleError));
  assert.deepEqual(await disk(), held);
  await f.same(first);

  f.phase = 'inspect the rebuilt p2 candidate and keep the p1 checkpoint as the working model';
  const reviewed = await choose(f, 'review', () => button(row, 'Review candidate p2').click());
  const { review: reviewText } = await reviewed.json();
  const { receipt: reviewReceipt } = JSON.parse(reviewText);
  assert.deepEqual(reviewed.request().postDataJSON(), { ...locator, taskId: 'p2', baselineDigest: rebuilt.baselineDigest, ...freshPin });
  assert.deepEqual([reviewReceipt.baseline, reviewReceipt.scope, reviewReceipt.candidateDigest, reviewReceipt.attemptId],
    [heldRecord.accepted, { occurrence: 'p2', feature: 'n1', field: 'height' }, freshPin.candidateDigest, freshPin.attemptId]);
  await writeFile(join(f.output, 'shared-hole-rebuilt-p2.bcad-candidate'), reviewText);
  await review.getByText(freshPin.attemptId, { exact: true }).waitFor();
  await review.getByText(freshPin.candidateDigest.slice(0, 12), { exact: true }).waitFor();
  await review.getByText('Height · 3 mm → 4 mm', { exact: true }).waitFor();
  const volume = 'Volume change · +83.434 mm³';
  await review.getByText(volume, { exact: true }).waitFor();
  await review.getByRole('listitem').filter({ hasText: /^check_spec · Pass · 4 ± 0.001 mm$/ }).waitFor();
  await waitBounds(bounds([6, 4]));
  await f.same(first);
  await f.snapshot('40-shared-hole-p2-rebuilt-preview', placedState);
  assert.deepEqual(await disk(), held);
  await verifyPreserved();

  f.phase = 'publish the rebuilt p2 candidate and open the second exact Studio checkpoint';
  const secondReview = await approve('p2', 'd638-approve-rebuilt-p2');
  assert.deepEqual([secondReview.attemptId, secondReview.candidateDigest, secondReview.baseline], [
    freshPin.attemptId, freshPin.candidateDigest, heldRecord.accepted,
  ]);
  const finished = await refresh();
  assert.ok(finished.revision > rebuilt.revision);
  assert.deepEqual(finished.tasks.map(task => [task.id, task.phase, task.review]), [
    ['p1', 'completed', undefined], ['p2', 'completed', undefined],
  ]);
  await review.waitFor({ state: 'hidden' });
  await f.same(first);
  const finalDisk = await disk(), { record: finalRecord } = JSON.parse(finalDisk.bytes);
  assert.deepEqual(finalRecord.commits.map(commit => commit.taskId), ['p1', 'p2']);
  assert.deepEqual(finalRecord.commits[0], heldRecord.commits[0]);
  assert.deepEqual(finalRecord.commits[1].from, finalRecord.commits[0].to);
  assert.deepEqual(finalRecord.commits[1].to, finalRecord.accepted);
  assert.equal(finalRecord.pending, undefined);
  const finalNative = await openApproved(finished, 'shared-hole-both-approved', firstNative, 3, 4);
  const final = JSON.parse(finalNative), finalExpected = structuredClone(first);
  finalExpected.instances[1].doc.nodes[1].height = 4;
  assert.deepEqual(model(final), model(finalExpected));
  assert.deepEqual(final.proposals.slice(0, -1), first.proposals);
  assert.deepEqual(final.history.slice(0, first.history.length), first.history);
  await waitBounds(bounds([6, 4]));
  await f.snapshot('41-shared-hole-both-approved', placedState);

  f.phase = 'save a separate native project document and open it in a fresh Studio page';
  await f.page.getByRole('textbox', { name: 'File name', exact: true }).fill(delivery);
  await save(delivery + '.bcad');
  const saved = await readSaved(delivery + '.bcad');
  assert.deepEqual(saved, finalNative);
  await writeFile(join(f.output, delivery + '.bcad'), saved);
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 });
  await f.ready();
  assert.notDeepEqual(await f.doc(), final);
  await openProject();
  await button(files(), 'Open ' + delivery + '.bcad').click();
  await f.same(final);
  await waitBounds(bounds([6, 4]));
  const opened = await f.snapshot('42-shared-hole-delivery-fresh-project-open', placedState);
  const freshNative = Buffer.from(JSON.stringify(opened.doc, null, 2));
  assert.deepEqual(freshNative, saved);
  await writeFile(join(f.output, 'shared-hole-fresh-open.bcad'), freshNative);
  const evidence = await readHeights('delivered', final, [6, 4], 'pass');
  assert.notEqual(evidence.revision, after.revision);
  for (const [index, report] of evidence.reports.entries()) {
    assert.notEqual(report.definitionRevision, after.reports[index].definitionRevision);
  }
  await verifyPreserved();
  assert.deepEqual(await readSaved(delivery + '.bcad'), saved);
  assert.deepEqual(await disk(), finalDisk);
  await writeFile(join(f.output, 'shared-hole-delivery-run.json'), finalDisk.bytes);
  f.report.observations.push({ runId: locator.runId, initialP2Attempt: oldPin.attemptId, rebuiltP2Attempt: freshPin.attemptId,
    retiredTerminalReceiptsRefused: 2, retiredStudioReviewRefused: true, studioRebuilds: 1, terminalApprovals: ['p1', 'p2'],
    finalNativeSHA256: sha256(saved), finalEvidenceRevision: evidence.revision, currentHardHeightVerdicts: ['pass', 'pass'],
    finalHeightsMm: [6, 4], p2PreviewVolume: volume, freshProjectOpen: true, priorRunsAndProjectFilesUnchanged: true });
}
