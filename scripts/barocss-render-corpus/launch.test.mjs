import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { atomicClaim, reserveIn, validateLaunchApproval } from './launch.mjs';

const approval = { kind: 'barocss-458-corpus-launch', issue: 458, taskCommit: 'a'.repeat(40),
  frozenPlanSha256: 'b'.repeat(64), ownerDecisionRef: 'https://github.com/barocss/barocss/issues/458',
  reviewUrl: 'https://github.com/barocss/barocss/issues/458#issuecomment-12345',
  priorDispatches: 4, newDispatchCeiling: 16, aggregateCeiling: 20 };

test('approval binds the exact reviewed commit, plan, and 4+16 ceiling', () => {
  assert.deepEqual(validateLaunchApproval(approval, approval.taskCommit, approval.frozenPlanSha256), approval);
  assert.throws(() => validateLaunchApproval(approval, 'c'.repeat(40), approval.frozenPlanSha256), /does not match/);
  assert.throws(() => validateLaunchApproval(approval, approval.taskCommit, 'd'.repeat(64)), /does not match/);
  assert.throws(() => validateLaunchApproval({ ...approval, newDispatchCeiling: 17 },
    approval.taskCommit, approval.frozenPlanSha256), /does not match/);
  assert.throws(() => validateLaunchApproval({ ...approval, extra: true },
    approval.taskCommit, approval.frozenPlanSha256), /does not match/);
});

test('one-use claim and each reservation reject a duplicate before another dispatch', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-corpus-claim-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const claim = path.join(dir, 'claim.json');
  atomicClaim(approval, dir, claim);
  assert.throws(() => atomicClaim(approval, dir, claim), /EEXIST/);
  reserveIn(dir, { ordinal: 5, rowId: '02', kind: 'initial', outputDir: dir });
  assert.throws(() => reserveIn(dir, { ordinal: 5, rowId: '02', kind: 'initial', outputDir: dir }), /EEXIST/);
  assert.equal(fs.statSync(claim).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.join(dir, 'reservation-05.json')).mode & 0o777, 0o600);
});
