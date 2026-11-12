import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { digestOf, sha256Hex } from '@barocss/cad-model/util/digest';
import { encodeCandidateReview, readCandidateReview, verifyCandidateReview, type CandidateReviewReceipt } from '../src/files/taskCandidateReview';
import { encodeTaskCheckpoint, readTaskCheckpoint, verifyTaskCheckpoint, type TaskCheckpoint } from '../src/files/taskCheckpoint';
import { planWorkingApprovalRepair, readWorkingApprovalChecks } from '../src/files/workingApprovalChecks';
import { fixtureDoc, fixtureLimits, fixturePlan } from './task-run-fixture';

const terminal = (challenge: string, args: string[], options = {}) => spawnSync('python3', [
  '-I', 'test/fixtures/task-run-terminal.py', challenge, JSON.stringify(options),
  process.execPath, 'scripts/cad-cli.mjs', 'task-run', ...args,
], { cwd: process.cwd(), encoding: 'utf8', timeout: 90000 });

test('D586 the existing CAD CLI runs real local workers and holds terminal authority', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'barocss-run-cli-'));
  try {
    const source = join(dir, 'source.bcad'), config = join(dir, 'config.json'), run = join(dir, 'run'), saved = join(dir, 'exported.bcad');
    const checkpoint = join(dir, 'exported.bcad-run');
    const original = encodeStudioFile(fixtureDoc());
    writeFileSync(source, original);
    writeFileSync(config, JSON.stringify({ name: 'cli-housing', source, plan: fixturePlan, limits: fixtureLimits, budget: 8, heightsMm: { base: 6, lid: 4 } }));
    const launch = (...args: string[]) => spawnSync(process.execPath, ['scripts/cad-cli.mjs', 'task-run', ...args], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30000,
    });
    const started = launch('start', run, config);
    assert.equal(started.status, 0, started.stderr);
    const status = JSON.parse(started.stdout);
    assert.deepEqual(status.tasks.map((task: { phase: string }) => task.phase), ['awaiting-decision', 'awaiting-decision']);
    assert.deepEqual(status.tasks.map((task: { geometry: { volumeMm3: number } }) => task.geometry.volumeMm3), [1200, 384]);
    assert.deepEqual(status.budget, { limit: 8, used: 2, unknown: 0 });
    const candidateFile = join(dir, 'base.bcad-candidate');
    const pendingRecord = readFileSync(join(run, 'run.json')), pendingEntries = readdirSync(run).sort();
    const reviewed = launch('review', run, 'base', candidateFile);
    assert.equal(reviewed.status, 0, reviewed.stderr);
    const candidateReceipt = JSON.parse(reviewed.stdout).candidateReview as CandidateReviewReceipt;
    const candidateText = readFileSync(candidateFile, 'utf8');
    assert.deepEqual(readFileSync(join(run, 'run.json')), pendingRecord);
    assert.deepEqual(readdirSync(run).sort(), pendingEntries);
    assert.equal(candidateReceipt.candidateDigest, status.tasks[0].candidateDigest);
    const deniedReview = launch('decide', run, 'review-notty', 'base', 'approve', '--review', candidateFile);
    assert.equal(deniedReview.status, 1);
    assert.match(deniedReview.stderr, /requires a terminal operator/);
    const mismatchFile = join(dir, 'mismatch.bcad-candidate');
    for (const mismatch of [
      { ...candidateReceipt, runId: 'another-run' },
      { ...candidateReceipt, attemptId: 'old-attempt' },
      { ...candidateReceipt, baseline: { ...candidateReceipt.baseline, sha256: '0'.repeat(64) } },
      { ...candidateReceipt, submission: { ...candidateReceipt.submission, specRevision: '0'.repeat(64) } },
      { ...candidateReceipt, scope: { ...candidateReceipt.scope, occurrence: 'p2' } },
      { ...candidateReceipt, candidateDigest: '0'.repeat(64) },
    ]) {
      writeFileSync(mismatchFile, encodeCandidateReview(mismatch));
      const stale = launch('decide', run, 'wrong-review', 'base', 'approve', '--review', mismatchFile);
      assert.equal(stale.status, 1, stale.stderr);
      assert.match(stale.stderr, /reviewed candidate differs from the current attempt/);
    }
    writeFileSync(mismatchFile, Buffer.alloc(128 * 1024 + 1));
    const oversized = launch('decide', run, 'oversized-review', 'base', 'approve', '--review', mismatchFile);
    assert.equal(oversized.status, 1, oversized.stderr);
    assert.match(oversized.stderr, /within the supported size/);
    const noConsent = terminal('approve ' + candidateReceipt.candidateDigest.slice(0, 12),
      ['decide', run, 'review-denied', 'base', 'approve', '--review', candidateFile],
      { answer: 'no', unchangedRecord: join(run, 'run.json') });
    assert.equal(noConsent.status, 1, noConsent.stderr);
    assert.match(noConsent.stderr, /terminal action was not confirmed/);
    const invalidId = launch('decide', run, 'x'.repeat(161), 'base', 'approve', '--review', candidateFile);
    assert.equal(invalidId.status, 1);
    assert.match(invalidId.stderr, /Invalid operation ID/);
    const reusedId = terminal('approve ' + candidateReceipt.candidateDigest.slice(0, 12),
      ['decide', run, 'initial:base', 'base', 'approve', '--review', candidateFile],
      { unchangedRecord: join(run, 'run.json') });
    assert.equal(reusedId.status, 1, reusedId.stderr);
    assert.match(reusedId.stderr, /operation ID is already in use/);
    assert.deepEqual(readFileSync(join(run, 'run.json')), pendingRecord);
    assert.deepEqual(readdirSync(run).sort(), pendingEntries);
    symlinkSync(join(run, 'native'), join(dir, 'run-native-link'));
    const alias = launch('review', run, 'base', dir + '/run-native-link/../escaped.bcad-candidate');
    assert.equal(alias.status, 1, alias.stderr);
    assert.match(alias.stderr, /outside the run store/);
    assert.equal(existsSync(join(run, 'escaped.bcad-candidate')), false);
    mkdirSync(join(dir, 'other', 'inner'), { recursive: true });
    mkdirSync(join(dir, 'other', 'run'));
    symlinkSync(join(dir, 'other', 'inner'), join(dir, 'run-directory-link'));
    const wrongGuard = launch('review', dir + '/run-directory-link/../run', 'base', join(run, 'alias.bcad-candidate'));
    assert.equal(wrongGuard.status, 1, wrongGuard.stderr);
    assert.match(wrongGuard.stderr, /outside the run store/);
    assert.equal(existsSync(join(run, 'alias.bcad-candidate')), false);
    const mixedCase = join(dir, 'RUN');
    if (existsSync(mixedCase)) {
      const wrongCase = launch('review', mixedCase, 'base', join(run, 'case.bcad-candidate'));
      assert.equal(wrongCase.status, 1, wrongCase.stderr);
      assert.match(wrongCase.stderr, /outside the run store/);
      assert.equal(existsSync(join(run, 'case.bcad-candidate')), false);
    }
    const longFile = join(dir, 'r'.repeat(225) + '.bcad-candidate');
    const longExport = launch('review', run, 'base', longFile);
    assert.equal(longExport.status, 0, longExport.stderr);
    assert.equal(readFileSync(longFile, 'utf8'), candidateText);
    const admitted = readCandidateReview(candidateText, fixtureDoc());
    assert.ok(!('error' in admitted), JSON.stringify(admitted));
    const verifiedCandidate = await verifyCandidateReview(admitted, async doc => evaluatePart(doc, 1));
    assert.ok(!('error' in verifiedCandidate), JSON.stringify(verifiedCandidate));
    assert.deepEqual([admitted.beforeMm, verifiedCandidate.geometry.sizeMm[2], verifiedCandidate.geometry.volumeMm3], [5, 6, 1200]);
    assert.ok('error' in await verifyCandidateReview(admitted, async () => null));
    assert.match((readCandidateReview(candidateText, admitted.doc) as { error: string }).error, /exact native baseline/);
    for (const [forged, reason] of [
      [{ ...candidateReceipt, scope: { ...candidateReceipt.scope, occurrence: 'p2' } }, /task or occurrence/],
      [{ ...candidateReceipt, submission: { ...candidateReceipt.submission, taskId: 'lid' } }, /task or occurrence/],
      [{ ...candidateReceipt, submission: { ...candidateReceipt.submission, specRevision: '0'.repeat(64) } }, /specification/],
      [{ ...candidateReceipt, candidateDigest: '0'.repeat(64) }, /candidate digest/],
    ] as const) {
      const result = readCandidateReview(encodeCandidateReview(forged), fixtureDoc());
      assert.ok('error' in result, JSON.stringify(result));
      assert.match(result.error, reason);
    }
    const repeated = launch('work', run, 'initial:base', 'base', '6');
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal(JSON.parse(repeated.stdout).outcome.duplicate, true);
    const conflict = launch('work', run, 'initial:base', 'base', '7');
    assert.equal(conflict.status, 1, conflict.stderr);
    assert.equal(JSON.parse(conflict.stdout).outcome.code, 'RUN_OPERATION_CONFLICT');
    const denied = launch('decide', run, 'external-approve', 'base', 'approve');
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /requires a terminal operator/);
    const unapproved = launch('export', run, checkpoint);
    assert.equal(unapproved.status, 1, unapproved.stderr);
    assert.match(unapproved.stderr, /requires a committed task/);
    assert.equal(existsSync(checkpoint), false);
    const exported = launch('export', run, saved);
    assert.equal(exported.status, 0, exported.stderr);
    assert.deepEqual(readFileSync(saved), Buffer.from(original));

    const digest = status.tasks[0].candidateDigest;
    const approved = terminal('approve base ' + digest.slice(0, 12), ['decide', run, 'terminal-approve', 'base', 'approve']);
    assert.equal(approved.status, 0, approved.stderr);
    assert.equal(JSON.parse(approved.stdout.trim().split('\n').at(-1)!).outcome.code, 'RUN_ACCEPTED');
    for (const task of ['base', 'lid']) {
      const retired = launch('review', run, task, join(dir, task + '-retired.bcad-candidate'));
      assert.equal(retired.status, 1, retired.stderr);
      assert.match(retired.stderr, /No current candidate/);
    }
    const accepted = launch('export', run, saved);
    assert.equal(accepted.status, 0, accepted.stderr);
    const doc = await readStudioFile(readFileSync(saved));
    assert.ok(!('error' in doc));
    assert.deepEqual(doc.doc.instances?.map(instance => 'height' in instance.doc.nodes[1] ? instance.doc.nodes[1].height : null), [6, 3]);
    const retiredBase = launch('decide', run, 'repeat-review', 'base', 'approve', '--review', candidateFile);
    assert.equal(retiredBase.status, 1);
    assert.match(retiredBase.stderr, /No current candidate/);
    const rebuilt = launch('refresh', run, 'refresh-lid', 'lid');
    assert.equal(rebuilt.status, 0, rebuilt.stderr);
    const lidFile = join(dir, 'lid.bcad-candidate'), lidExport = launch('review', run, 'lid', lidFile);
    assert.equal(lidExport.status, 0, lidExport.stderr);
    const lid = JSON.parse(lidExport.stdout).candidateReview as CandidateReviewReceipt;
    const rejection = terminal('reject ' + lid.candidateDigest.slice(0, 12),
      ['decide', run, 'terminal-reject-lid', 'lid', 'reject', '--review', lidFile]);
    assert.equal(rejection.status, 0, rejection.stderr);
    assert.equal(JSON.parse(rejection.stdout.trim().split('\n').at(-1)!).outcome.code, 'RUN_REJECTED');
    const rejected = JSON.parse(readFileSync(join(run, 'run.json'), 'utf8')).record;
    assert.deepEqual(rejected.accepted, lid.baseline);
    assert.deepEqual(rejected.commits.map((commit: { taskId: string }) => commit.taskId), ['base']);

    const record = readFileSync(join(run, 'run.json')), entries = readdirSync(run).sort();
    const bundle = launch('export', run, checkpoint);
    assert.equal(bundle.status, 0, bundle.stderr);
    assert.deepEqual(readFileSync(join(run, 'run.json')), record);
    assert.deepEqual(readdirSync(run).sort(), entries);
    const receipt = JSON.parse(bundle.stdout).checkpoint as TaskCheckpoint;
    assert.deepEqual([receipt.taskId, receipt.operationId, receipt.scope.occurrence], ['base', 'terminal-approve', 'p1']);
    const decoded = await readTaskCheckpoint(readFileSync(checkpoint));
    assert.ok(decoded && !('error' in decoded), JSON.stringify(decoded));
    assert.deepEqual(decoded.receipt, receipt);
    assert.deepEqual(decoded.doc, doc.doc);
    const native = await verifyTaskCheckpoint(decoded, async input => evaluatePart(input, 1), () => true);
    assert.ok(native && !('error' in native) && native.checks === 1, JSON.stringify(native));
    const { review } = native;
    const revisions = native.comparison.revisions;
    assert.deepEqual([review.taskId, review.proposalId, review.before.part, review.approved.part], ['base', receipt.proposalId, 'p1', 'p1']);
    assert.deepEqual([review.before.revision, review.approved.revision], [revisions.before, revisions.after]);
    assert.deepEqual([review.before, review.approved].map(report => {
      const row = report.evidence.find(item => item.requirement?.id === 'height')!;
      return [row.result.number, row.result.verdict, row.freshness.state];
    }), [[5, 'fail', 'current'], [6, 'pass', 'current']]);
    const failed = await verifyTaskCheckpoint(decoded, async () => null, () => true);
    assert.match(failed && 'error' in failed ? failed.error : '', /did not pass/);
    assert.equal(await readTaskCheckpoint(readFileSync(checkpoint), () => false), null);

    const after = readFileSync(saved);
    const reformatted = Buffer.concat([after, Buffer.from('\n')]);
    for (const [pin, a, b, error] of [
      [receipt, after, original, /native files do not match/],
      [{ ...receipt, accepted: { ...receipt.accepted, modelDigest: '0'.repeat(64) } }, original, after, /document digests/],
      [{ ...receipt, accepted: { ...receipt.accepted, sha256: sha256Hex(reformatted) } }, original, reformatted, /would change its recorded native bytes/],
      [{ ...receipt, specRevision: '0'.repeat(64) }, original, after, /original specification/],
      [{ ...receipt, plan: { ...receipt.plan, policyRevision: 'new-policy' } }, original, after, /original specification/],
      [{ ...receipt, proposalId: 'P999' }, original, after, /saved approval does not match/],
      [{ ...receipt, candidateDigest: '0'.repeat(64) }, original, after, /candidate or approval/],
      [{ ...receipt, scope: { ...receipt.scope, occurrence: 'p2' } }, original, after, /checkpoint scope/],
    ] as const) {
      const tampered = await readTaskCheckpoint(encodeTaskCheckpoint(pin, a, b));
      assert.match(tampered && 'error' in tampered ? tampered.error : '', error);
    }

    const currentSpec = JSON.parse(launch('status', run).stdout).specRevision;
    const policy = terminal('policy new-policy ' + currentSpec.slice(0, 12), ['policy', run, 'terminal-policy', 'new-policy', '1']);
    assert.equal(policy.status, 0, policy.stderr);
    const policyRecord = readFileSync(join(run, 'run.json'));
    const afterPolicy = launch('export', run, checkpoint);
    assert.equal(afterPolicy.status, 0, afterPolicy.stderr);
    const carried = JSON.parse(afterPolicy.stdout).checkpoint as TaskCheckpoint;
    assert.deepEqual([carried.plan, carried.specRevision, carried.accepted], [receipt.plan, receipt.specRevision, receipt.accepted]);
    assert.ok(carried.revision > receipt.revision);
    assert.deepEqual(readFileSync(join(run, 'run.json')), policyRecord);

    // An older store lacks the commit-time plan. A different current policy cannot vouch for it.
    const legacy = JSON.parse(policyRecord.toString('utf8'));
    delete legacy.record.commits.at(-1).plan;
    legacy.digest = digestOf(legacy.record);
    writeFileSync(join(run, 'run.json'), JSON.stringify(legacy));
    const legacyFile = join(dir, 'legacy.bcad-run'), missingPlan = launch('export', run, legacyFile);
    assert.equal(missingPlan.status, 1);
    assert.match(missingPlan.stderr, /original specification/);
    assert.equal(existsSync(legacyFile), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('D777 an explicit CLI depth config publishes the exact local Y edit and can plan a working repair', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'barocss-depth-cli-'));
  try {
    const source = join(dir, 'source.bcad'), config = join(dir, 'config.json'), run = join(dir, 'run');
    const checkpoint = join(dir, 'depth.bcad-run');
    const original = fixtureDoc();
    const base = original.instances![0];
    const sketch = base.doc.nodes[0];
    assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle');
    sketch.min = [0, -3];
    sketch.max = [20, 7];
    const requirement = base.doc.requirements![0];
    requirement.id = 'depth';
    requirement.check.query = { fn: 'bbox', axis: 'y' };
    requirement.check.value = 14;
    const sourceBytes = encodeStudioFile(original);
    writeFileSync(source, sourceBytes);
    const plan = { ...fixturePlan, tasks: [
      { ...fixturePlan.tasks[0], feature: 'n0', capability: 'rectangle-depth', frame: 'part-local-y' },
      fixturePlan.tasks[1],
    ] };
    const settings = { name: 'cli-depth', source, plan, limits: fixtureLimits, budget: 8, heightsMm: { lid: 4 }, depthsMm: { base: 14 } };
    const launch = (...args: string[]) => spawnSync(process.execPath, ['scripts/cad-cli.mjs', 'task-run', ...args], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30000,
    });
    writeFileSync(config, JSON.stringify({ ...settings, plan: { ...plan, tasks: [
      { ...plan.tasks[0], capability: 'constructor' }, plan.tasks[1],
    ] } }));
    const invalid = launch('start', run, config);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Unsupported task capability/);
    assert.equal(existsSync(run), false);
    writeFileSync(config, JSON.stringify({ ...settings, depthsMm: undefined, widthsMm: { base: 14 } }));
    const wrongField = launch('start', run, config);
    assert.equal(wrongField.status, 1);
    assert.match(wrongField.stderr, /Expected a positive depth/);
    assert.equal(existsSync(run), false);
    writeFileSync(config, JSON.stringify(settings));
    const started = launch('start', run, config);
    assert.equal(started.status, 0, started.stderr);
    const { tasks: [candidate] } = JSON.parse(started.stdout);
    assert.deepEqual(candidate.geometry, { sizeMm: [20, 14, 5], volumeMm3: 1400, centroidMm: [10, 4, 2.5] });
    const candidateFile = join(dir, 'depth.bcad-candidate');
    const review = launch('review', run, 'base', candidateFile);
    assert.equal(review.status, 0, review.stderr);
    const receipt = JSON.parse(review.stdout).candidateReview as CandidateReviewReceipt;
    const { taskId, specRevision, inputDigest } = receipt.submission;
    const wrongScope = readCandidateReview(encodeCandidateReview({
      ...receipt, scope: { ...receipt.scope, field: 'width' }, submission: { taskId, specRevision, inputDigest, widthMm: 14 },
    }), original);
    assert.match('error' in wrongScope ? wrongScope.error : '', /task or occurrence differs/);
    const approval = terminal('approve base ' + candidate.candidateDigest.slice(0, 12), ['decide', run, 'accept-depth', 'base', 'approve']);
    assert.equal(approval.status, 0, approval.stderr);
    const exported = launch('export', run, checkpoint);
    assert.equal(exported.status, 0, exported.stderr);
    const decoded = await readTaskCheckpoint(readFileSync(checkpoint));
    assert.ok(decoded && !('error' in decoded), JSON.stringify(decoded));
    assert.deepEqual(decoded.receipt.scope, { occurrence: 'p1', feature: 'n0', field: 'depth' });
    assert.deepEqual(decoded.doc.instances![0].doc.nodes, [{ ...sketch, max: [20, 11] }, base.doc.nodes[1]]);
    assert.deepEqual(decoded.doc.instances![1], original.instances![1]);
    assert.deepEqual(readFileSync(source), Buffer.from(sourceBytes));
    const widthPin = { ...decoded.receipt, scope: { ...decoded.receipt.scope, field: 'width' as const } };
    const wrongCheckpoint = await readTaskCheckpoint(encodeTaskCheckpoint(widthPin, sourceBytes, encodeStudioFile(decoded.doc)));
    assert.match(wrongCheckpoint && 'error' in wrongCheckpoint ? wrongCheckpoint.error : '', /plan does not match the checkpoint scope/);

    const evaluate = async (doc: typeof original) => evaluatePart(doc, 1);
    const verified = await verifyTaskCheckpoint(decoded, evaluate, () => true);
    assert.ok(verified && !('error' in verified), JSON.stringify(verified));
    const working = structuredClone(decoded.doc);
    const edited = working.instances![0].doc.nodes[0];
    assert.ok(edited.kind === 'sketch' && edited.profile === 'rectangle');
    edited.max[1] = 8;
    const incompleteChecks = await readWorkingApprovalChecks(working, verified.review, evaluate);
    assert.ok(!('error' in incompleteChecks), JSON.stringify(incompleteChecks));
    assert.throws(() => planWorkingApprovalRepair(working, verified.review, incompleteChecks), /p2 needs passing/);
    const siblingExtrude = working.instances![1].doc.nodes[1];
    assert.ok(siblingExtrude.kind === 'extrude');
    siblingExtrude.height = 4;
    const checks = await readWorkingApprovalChecks(working, verified.review, evaluate);
    assert.ok(!('error' in checks), JSON.stringify(checks));
    assert.deepEqual(planWorkingApprovalRepair(working, verified.review, checks).targets, [
      { id: 'p1', requirementId: 'depth', currentDepthMm: 11, depthMm: 14, toleranceMm: 0.001 },
    ]);

    edited.max = [21, 11];
    siblingExtrude.height = 3;
    const alteredBytes = encodeStudioFile(working);
    const forged = { ...decoded.receipt, accepted: { modelDigest: digestOf(working), sha256: sha256Hex(alteredBytes) } };
    const rejected = await readTaskCheckpoint(encodeTaskCheckpoint(forged, sourceBytes, alteredBytes));
    assert.ok(rejected && 'error' in rejected, JSON.stringify(rejected));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
