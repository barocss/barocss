import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reserveApprovedTurn } from './gate.mjs';
import { verifyFrozenPlan } from './freeze.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const planFile = path.join(here, 'frozen-plan.json');
const candidateCommit = 'a'.repeat(40);
const root = '/Users/user/.barocss-ai/v3';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('frozen plan binds installed schema, prompt bytes, and four fresh turns', () => {
  const result = verifyFrozenPlan();
  assert.equal(result.turns, 4);
  assert.deepEqual(result.scenarios, ['01', '03']);
  assert.match(result.planSha256, /^[0-9a-f]{64}$/);
});

test('live reservation requires a separate matching decision record', () => {
  const suffix = randomUUID();
  const decisionFile = path.join(root, `private-461-live-decision-test-${suffix}.json`);
  const copiedFile = path.join(root, `private-461-live-decision-copy-${suffix}.json`);
  let reservationDir;
  const base = { decisionFile, planFile, candidateCommit,
    ordinal: 1, rowId: '01', kind: 'initial' };
  try {
    assert.throws(() => reserveApprovedTurn(base), /ENOENT/);
    fs.writeFileSync(decisionFile, JSON.stringify({ kind: 'barocss-461-live-decision-v1', issue: 461,
      decision: 'GO', candidateCommit, planSha256: '0'.repeat(64), maxNewTurns: 4,
      ownerApprovalReference: `test-only-${suffix}`, reviewAcceptReference: 'test-only' }), { mode: 0o600, flag: 'wx' });
    assert.throws(() => reserveApprovedTurn(base), /does not match/);
    fs.writeFileSync(decisionFile, JSON.stringify({ kind: 'barocss-461-live-decision-v1', issue: 461,
      decision: 'GO', candidateCommit, planSha256: sha(fs.readFileSync(planFile)), maxNewTurns: 4,
      ownerApprovalReference: `test-only-${suffix}`, reviewAcceptReference: 'test-only' }), { mode: 0o600 });
    reservationDir = reserveApprovedTurn(base).reservationDir;
    assert.throws(() => reserveApprovedTurn(base), /count is inconsistent/);
    assert.throws(() => reserveApprovedTurn({ ...base,
      reservationDir: path.join(root, `private-461-live-reservations-test-${suffix}`) }),
    /Invalid live reservation request/);
    assert.throws(() => reserveApprovedTurn({ ...base, ordinal: 3, rowId: '03' }), /count is inconsistent/);
    assert.throws(() => reserveApprovedTurn({ ...base, ordinal: 2, rowId: '03' }), /Turn order differs/);
    assert.equal(reserveApprovedTurn({ ...base, ordinal: 2, kind: 'next' }).ordinal, 2);
    assert.equal(reserveApprovedTurn({ ...base, ordinal: 3, rowId: '03' }).ordinal, 3);
    assert.equal(reserveApprovedTurn({ ...base, ordinal: 4, rowId: '03', kind: 'next' }).ordinal, 4);
    fs.copyFileSync(decisionFile, copiedFile);
    assert.throws(() => reserveApprovedTurn({ ...base, decisionFile: copiedFile }), /count is inconsistent/);
    assert.throws(() => reserveApprovedTurn({ ...base, ordinal: 5 }), /Invalid live reservation request/);
  } finally {
    fs.rmSync(decisionFile, { force: true });
    fs.rmSync(copiedFile, { force: true });
    if (reservationDir) fs.rmSync(reservationDir, { recursive: true, force: true });
  }
});
