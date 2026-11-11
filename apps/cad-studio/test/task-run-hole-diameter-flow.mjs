import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';

const base = '/api/chat/task-runs/';
const button = (parent, name) => parent.getByRole('button', { name, exact: true });

export async function taskRunHoleDiameterFlow({ f, row, launch, source, saved, bytes, openFile, turn, inch = false }) {
  const prefix = inch ? 'd648' : 'd646';
  const diameterMm = inch ? 6.35 : 6, radiusMm = diameterMm / 2;
  const volumeDelta = Math.round((4 - radiusMm ** 2) * Math.PI * 6 * 1000) / 1000;
  const capture = async (action, click) => {
    const [response] = await Promise.all([
      f.page.waitForResponse(res => new URL(res.url()).pathname === base + action && res.request().method() === 'POST'), click(),
    ]);
    assert.equal(response.status(), 200, await response.text());
    return response;
  };
  const runFile = join(launch.directory, 'run.json');
  const scope = { occurrence: 'p1', feature: 'n2', field: 'diameter' };
  const verifyRequirement = async (name, expected, verdict) => {
    const { revision, results } = await turn(name, [
      { tool: 'requirements', args: { action: 'evidence', part: 'p1' } },
      { tool: 'requirements', args: { action: 'evidence', part: 'p2' } },
    ], { requirementEvidence: true });
    for (const [index, { error, body }] of results.entries()) {
      assert.equal(error, false, JSON.stringify(body));
      const [artifact] = body.files, report = JSON.parse(artifact.text), part = 'p' + (index + 1);
      assert.equal(sha256(artifact.text), artifact.sha256);
      assert.deepEqual([report.part, report.revision], [part, revision]);
      const [item] = report.evidence.filter(row => row.result.kind === 'requirement');
      assert.deepEqual(item.requirement, source.instances[index].doc.requirements[0]);
      assert.deepEqual([item.result.status, item.result.verdict, item.result.number, item.freshness.state],
        ['ok', index === 0 ? verdict : 'pass', index === 0 ? expected : 3, 'current']);
      await writeFile(join(f.output, name + '-' + part + '.json'), artifact.text);
    }
    return revision;
  };

  f.phase = 'review the exact through-hole candidate and verify the original diameter';
  const beforeEvidence = await verifyRequirement(prefix + '-before', inch ? 0.1575 : 4, 'fail');
  const beforeNative = await f.inspect(prefix + '-before-native', source, 'hole-native-evidence');
  assert.deepEqual([beforeNative.face.kind, beforeNative.face.outer, beforeNative.face.radius], ['cylinder', false, 2]);
  const [held] = launch.tasks, durableBefore = await readFile(runFile);
  const { record: before } = JSON.parse(durableBefore);
  const task = before.state.tasks[0];
  assert.deepEqual(task.candidate.scope, scope);
  assert.equal(task.submission.diameterMm, diameterMm);
  assert.equal(task.submission.widthMm ?? task.submission.heightMm, undefined);
  const reviewed = await capture('review', () => button(row, 'Review candidate p1').click());
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  const read = await reviewed.json(), envelope = JSON.parse(read.review);
  assert.deepEqual(envelope.receipt.scope, scope);
  assert.equal(envelope.receipt.candidateDigest, held.review.candidateDigest);
  await review.getByText('Diameter · 4 mm → ' + diameterMm + ' mm', { exact: true }).waitFor();
  await review.getByText('Volume change · ' + volumeDelta + ' mm³', { exact: true }).waitFor();
  if (inch) await review.getByText('0.25 ± 0.001 in', { exact: false }).waitFor();
  await f.same(source);
  assert.deepEqual(await readFile(runFile), durableBefore);
  await f.snapshot('07-through-hole-review');

  f.phase = 'approve the native diameter without editing the protected part';
  const approved = await capture('approve', () => button(review, 'Approve candidate').click());
  const request = approved.request().postDataJSON(), status = await approved.json();
  assert.deepEqual([request.candidateDigest, request.receiptDigest, request.baselineDigest],
    [envelope.receipt.candidateDigest, envelope.digest, launch.baselineDigest]);
  assert.deepEqual(status.tasks.map(item => item.phase), ['completed']);
  await row.getByText('p1 · completed', { exact: true }).waitFor();
  await f.same(source);
  const durableAfter = await readFile(runFile), { record: after } = JSON.parse(durableAfter);
  assert.equal(after.commits.length, 1);
  assert.equal(after.commits[0].candidateDigest, held.review.candidateDigest);
  assert.deepEqual(after.commits[0].from, before.accepted);
  assert.equal(after.pending, undefined);

  f.phase = 'reopen the exact approved through-hole and measure it in Studio';
  await f.newPage();
  const reopened = await capture('reopen', () => openFile('housing.bcad-task', bytes));
  assert.deepEqual((await reopened.json()).checkpoint, status.checkpoint);
  const card = f.page.getByRole('region', { name: 'Reopened task run', exact: true });
  const checkpoint = await (await capture('checkpoint', () => button(card, 'Open approved checkpoint').click())).body();
  const headerEnd = 16 + checkpoint.readUInt32LE(8), acceptedStart = headerEnd + checkpoint.readUInt32LE(12);
  assert.deepEqual(checkpoint.subarray(headerEnd, acceptedStart), saved);
  const accepted = checkpoint.subarray(acceptedStart), actual = JSON.parse(accepted);
  assert.equal(sha256(accepted), status.checkpoint.acceptedSHA256);
  const expected = structuredClone(source.instances);
  expected[0].doc.nodes[2].radius = radiusMm;
  assert.deepEqual(actual.instances, expected);
  await f.same(actual);
  if (inch) {
    const checks = f.page.getByRole('region', { name: 'Worker checkpoint checks', exact: true });
    await checks.getByText('Fail · 0.1575 in', { exact: true }).waitFor();
    await checks.getByText('Pass · 0.25 in', { exact: true }).waitFor();
  }
  const afterEvidence = await verifyRequirement(prefix + '-approved', inch ? 0.25 : diameterMm, 'pass');
  assert.notEqual(afterEvidence, beforeEvidence);
  const afterNative = await f.inspect(prefix + '-approved-native', actual, 'hole-native-evidence');
  assert.deepEqual([afterNative.face.kind, afterNative.face.outer], ['cylinder', false]);
  assert.ok(Math.abs(afterNative.face.radius - radiusMm) < 1e-10);
  assert.ok(Math.abs(afterNative.volumeMm3 - task.candidate.geometry.volumeMm3) < 1e-8);
  assert.deepEqual(await readFile(runFile), durableAfter);
  await f.snapshot('08-approved-through-hole-opened');
  await writeFile(join(f.output, prefix + '-checkpoint.bcad-run'), checkpoint);
  await writeFile(join(f.output, prefix + '-approval.json'), JSON.stringify({ status, beforeEvidence, afterEvidence, scope, request }));
  f.report.observations.push({ sharedPatternRefused: true, feature: scope.feature, face: 'n2.side0', beforeDiameterMm: 4, afterDiameterMm: diameterMm,
    ...(inch ? { authoredDiameterIn: 0.25, authoredToleranceIn: 0.001, normalizedToleranceMm: 0.0254, measuredIn: [0.1575, 0.25] } : {}),
    finalRadiusMm: afterNative.face.radius, protectedPartUnchanged: true, publications: 1,
    acceptedSHA256: sha256(accepted), finalNativeVolumeMm3: afterNative.volumeMm3 });
}
