import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { readLaunchApproval, verifyPriorAttempt, claimLiveRun, LIVE_PROMPT, LIVE_NAME } from './live.mjs';
import { MAX_DISPATCHES, PER_CALL_TIMEOUT_MS, TOTAL_TIMEOUT_MS, PRIVATE_ROOT } from './cli-profile.mjs';

test('live entry refuses unreviewed, changed or widened approval data without any dispatch', () => {
  const file = path.join(PRIVATE_ROOT, `private-460-approval-${randomBytes(6).toString('hex')}.json`);
  const commit = 'a'.repeat(40);
  const valid = { kind: 'barocss-460-reviewed-continuation', issue: 460, taskCommit: commit,
    ownerDecisionRef: 'https://github.com/barocss/barocss/issues/460#issuecomment-123',
    continuationRef: 'https://github.com/barocss/barocss/issues/460#issuecomment-234',
    reviewUrl: 'https://github.com/barocss/barocss/issues/460#issuecomment-456',
    prompt: LIVE_PROMPT, name: LIVE_NAME, priorDispatches: 1, aggregateCeiling: 20,
    maxDispatches: MAX_DISPATCHES,
    perCallTimeoutMs: PER_CALL_TIMEOUT_MS, totalTimeoutMs: TOTAL_TIMEOUT_MS };
  try {
    fs.writeFileSync(file, JSON.stringify(valid), { mode: 0o600 });
    assert.deepEqual(readLaunchApproval(file, commit), valid);
    assert.throws(() => readLaunchApproval(file, 'b'.repeat(40)), /exact reviewed/);
    fs.writeFileSync(file, JSON.stringify({ ...valid, maxDispatches: 3 }));
    assert.throws(() => readLaunchApproval(file, commit), /exact reviewed/);
    fs.writeFileSync(file, JSON.stringify({ ...valid, name: 'Other' }));
    assert.throws(() => readLaunchApproval(file, commit), /exact reviewed/);
    fs.writeFileSync(file, JSON.stringify({ ...valid, extraArgv: ['--unsafe'] }));
    assert.throws(() => readLaunchApproval(file, commit), /exact reviewed/);
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test('continuation verifies the consumed prior dispatch before a new claim', () => {
  const claim = path.join(PRIVATE_ROOT, `private-460-live-claim-test-${randomBytes(6).toString('hex')}.json`);
  const evidence = fs.mkdtempSync(path.join(PRIVATE_ROOT, 'private-460-prior-test-'));
  try {
    fs.writeFileSync(claim, '{}', { mode: 0o600 });
    fs.writeFileSync(path.join(evidence, 'initial-dispatch.json'), JSON.stringify({ kind: 'initial', dispatchNumber: 1 }));
    fs.writeFileSync(path.join(evidence, 'initial-result.json'), JSON.stringify({ stopReason: 'unexpected-cli-tool' }));
    assert.doesNotThrow(() => verifyPriorAttempt(claim, evidence));
    fs.writeFileSync(path.join(evidence, 'next-dispatch.json'), '{}');
    assert.throws(() => verifyPriorAttempt(claim, evidence), /accounting changed/);
  } finally {
    fs.rmSync(claim, { force: true });
    fs.rmSync(evidence, { recursive: true, force: true });
  }
});

test('one private claim blocks approval replay across fresh processes', () => {
  const claim = path.join(PRIVATE_ROOT, `private-460-live-claim-test-${randomBytes(6).toString('hex')}.json`);
  const approval = { taskCommit: 'a'.repeat(40), ownerDecisionRef: 'owner-record', reviewUrl: 'review-record' };
  try {
    claimLiveRun(approval, claim);
    const saved = JSON.parse(fs.readFileSync(claim, 'utf8'));
    assert.equal(saved.taskCommit, approval.taskCommit);
    assert.throws(() => claimLiveRun(approval, claim), /already claimed/);
    assert.throws(() => claimLiveRun({ ...approval, taskCommit: 'b'.repeat(40) }, claim), /already claimed/);
  } finally { fs.rmSync(claim, { force: true }); }
});
