import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const PRIVATE_ROOT = '/Users/user/.barocss-ai/v3';

function approvedLedger({ decisionFile, planFile, candidateCommit }) {
  if (typeof decisionFile !== 'string' || path.dirname(decisionFile) !== PRIVATE_ROOT
    || !path.basename(decisionFile).startsWith('private-461-live-decision-')
    || typeof planFile !== 'string' || !path.isAbsolute(planFile)
    || typeof candidateCommit !== 'string' || !/^[0-9a-f]{40}$/.test(candidateCommit)) {
    throw new Error('Invalid live reservation request');
  }
  const bytes = fs.readFileSync(decisionFile);
  const decision = JSON.parse(bytes);
  const planSha256 = sha(fs.readFileSync(planFile));
  if (decision.kind !== 'barocss-461-live-decision-v1' || decision.issue !== 461
    || decision.decision !== 'GO' || decision.candidateCommit !== candidateCommit
    || decision.planSha256 !== planSha256 || decision.maxNewTurns !== 4
    || typeof decision.ownerApprovalReference !== 'string' || !decision.ownerApprovalReference
    || typeof decision.reviewAcceptReference !== 'string' || !decision.reviewAcceptReference) {
    throw new Error('Fresh scoped launch decision is missing or does not match');
  }
  const ledgerKey = sha(`${decision.ownerApprovalReference}\0${candidateCommit}\0${planSha256}`);
  const reservationDir = path.join(PRIVATE_ROOT, `private-461-live-reservations-${ledgerKey}`);
  fs.mkdirSync(reservationDir, { recursive: true, mode: 0o700 });
  if (fs.realpathSync(reservationDir) !== reservationDir) throw new Error('Reservation ledger is not canonical');
  return { decision, decisionSha256: sha(bytes), planSha256, reservationDir };
}

// Initialization itself is one-use: an uncertain start cannot be retried with a copied decision.
export function claimApprovedLaunch({ decisionFile, planFile, candidateCommit, ...unexpected }) {
  if (Object.keys(unexpected).length) throw new Error('Invalid launch claim');
  const ledger = approvedLedger({ decisionFile, planFile, candidateCommit });
  if (ledger.decision.launcherIssue !== 462) throw new Error('Exact launcher approval is required');
  if (fs.readdirSync(ledger.reservationDir).some((name) => /^[1-4]-/.test(name))) {
    throw new Error('Allowance was already used');
  }
  fs.writeFileSync(path.join(ledger.reservationDir, 'launch.json'), JSON.stringify({
    launcherIssue: 462, candidateCommit, planSha256: ledger.planSha256,
    decisionSha256: ledger.decisionSha256, claimedAt: new Date().toISOString(),
  }) + '\n', { flag: 'wx', mode: 0o600 });
  return ledger;
}

// A later live launcher must call this before each turn. This preparation does not launch one.
export function reserveApprovedTurn({ decisionFile, planFile, candidateCommit,
  ordinal, rowId, kind, ...unexpected }) {
  if (typeof decisionFile !== 'string' || path.dirname(decisionFile) !== PRIVATE_ROOT
    || !path.basename(decisionFile).startsWith('private-461-live-decision-')
    || Object.keys(unexpected).length > 0
    || typeof planFile !== 'string' || !path.isAbsolute(planFile)
    || !/^[0-9a-f]{40}$/.test(candidateCommit)
    || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 4
    || !['01', '03'].includes(rowId) || !['initial', 'next'].includes(kind)) {
    throw new Error('Invalid live reservation request');
  }
  const { planSha256, reservationDir, decisionSha256 } = approvedLedger({ decisionFile, planFile, candidateCommit });
  const expected = [['01', 'initial'], ['01', 'next'], ['03', 'initial'], ['03', 'next']][ordinal - 1];
  if (rowId !== expected[0] || kind !== expected[1]) throw new Error('Turn order differs from frozen plan');
  // A copied decision or a caller-selected directory cannot reset the same approval's ceiling.
  const existing = fs.readdirSync(reservationDir).filter((name) => /^[1-4]-/.test(name));
  if (existing.length !== ordinal - 1) throw new Error('Reservation count is inconsistent');
  const reservation = { issue: 461, ordinal, rowId, kind, candidateCommit, planSha256,
    decisionSha256, reservedAt: new Date().toISOString() };
  const file = path.join(reservationDir, `${ordinal}-${rowId}-${kind}.json`);
  fs.writeFileSync(file, JSON.stringify(reservation) + '\n', { flag: 'wx', mode: 0o600 });
  return { ...reservation, reservationDir };
}
