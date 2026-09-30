import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const PRIVATE_ROOT = '/Users/user/.barocss-ai/v3';

// A later live launcher must call this before each turn. This preparation does not launch one.
export function reserveApprovedTurn({ decisionFile, reservationDir, planFile, candidateCommit,
  ordinal, rowId, kind }) {
  if (typeof decisionFile !== 'string' || path.dirname(decisionFile) !== PRIVATE_ROOT
    || !path.basename(decisionFile).startsWith('private-461-live-decision-')
    || typeof reservationDir !== 'string' || path.dirname(reservationDir) !== PRIVATE_ROOT
    || !path.basename(reservationDir).startsWith('private-461-live-reservations-')
    || typeof planFile !== 'string' || !path.isAbsolute(planFile)
    || !/^[0-9a-f]{40}$/.test(candidateCommit)
    || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 4
    || !['01', '03'].includes(rowId) || !['initial', 'next'].includes(kind)) {
    throw new Error('Invalid live reservation request');
  }
  const decision = JSON.parse(fs.readFileSync(decisionFile, 'utf8'));
  const planSha256 = sha(fs.readFileSync(planFile));
  if (decision.kind !== 'barocss-461-live-decision-v1' || decision.issue !== 461
    || decision.decision !== 'GO' || decision.candidateCommit !== candidateCommit
    || decision.planSha256 !== planSha256 || decision.maxNewTurns !== 4
    || typeof decision.ownerApprovalReference !== 'string' || !decision.ownerApprovalReference
    || typeof decision.reviewAcceptReference !== 'string' || !decision.reviewAcceptReference) {
    throw new Error('Fresh scoped launch decision is missing or does not match');
  }
  const expected = [['01', 'initial'], ['01', 'next'], ['03', 'initial'], ['03', 'next']][ordinal - 1];
  if (rowId !== expected[0] || kind !== expected[1]) throw new Error('Turn order differs from frozen plan');
  fs.mkdirSync(reservationDir, { recursive: true, mode: 0o700 });
  const existing = fs.readdirSync(reservationDir).filter((name) => /^[1-4]-/.test(name));
  if (existing.length !== ordinal - 1) throw new Error('Reservation count is inconsistent');
  const reservation = { issue: 461, ordinal, rowId, kind, candidateCommit, planSha256,
    decisionSha256: sha(fs.readFileSync(decisionFile)), reservedAt: new Date().toISOString() };
  const file = path.join(reservationDir, `${ordinal}-${rowId}-${kind}.json`);
  fs.writeFileSync(file, JSON.stringify(reservation) + '\n', { flag: 'wx', mode: 0o600 });
  return reservation;
}
