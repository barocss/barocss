import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyFrozenPlan } from './freeze.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const here = path.dirname(fileURLToPath(import.meta.url));
const PRIVATE_ROOT = '/Users/user/.barocss-ai/v3';
const CURRENT_PLAN = path.join(here, 'current-host-plan.json');
const BASE_PLAN = path.join(here, 'frozen-plan.json');
const RUN_PROFILE = path.join(here, 'current-host-run-profile.json');
const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_40 = /^[0-9a-f]{40}$/;
const ORDER = Object.freeze([['01', 'initial'], ['01', 'next'], ['03', 'initial'], ['03', 'next']]);

export function verifyCurrentHostPlan({ planFile = CURRENT_PLAN } = {}) {
  if (typeof planFile !== 'string' || !path.isAbsolute(planFile)
    || fs.realpathSync(planFile) !== planFile) throw new Error('Current-host plan path is not canonical');
  const frozen = verifyFrozenPlan();
  const base = JSON.parse(fs.readFileSync(BASE_PLAN, 'utf8'));
  const profileBytes = fs.readFileSync(RUN_PROFILE);
  const profile = JSON.parse(profileBytes);
  if (profile.kind !== 'barocss-464-current-host-run-profile-v1'
    || profile.issue !== 464 || profile.mode !== 'owner-approved-current-host'
    || profile.model !== 'gpt-6.1-sol' || profile.reasoningEffort !== 'high'
    || profile.sandboxPolicy !== 'readOnly' || profile.approvalPolicy !== 'never'
    || profile.reserveFirstBeforeInitialization !== true
    || profile.preparationIssue !== 468 || profile.mcpKeyEncoding !== 'literal-safe-segment-v1'
    || profile.protocolContract !== 'startup-rate-metadata-468-v1'
    || profile.protocolContractSha256 !== sha(fs.readFileSync(path.join(here, 'protocol-contract.mjs')))
    || JSON.stringify(profile.passiveMetadataPolicy) !== JSON.stringify({ accountAuthMode: 'chatgpt',
      remoteStatus: 'disabled', remoteEnvironment: 'absent-or-null', stableRemoteIdentity: true,
      maxGlobalNotifications: 64, maxPendingThreadStatuses: 16, bindPendingStatusToOwnedResponse: true,
      rateLimits: 'schema-shaped-sparse-ignore-v1' })
    || profile.mcpNamePattern !== '^[A-Za-z0-9_-]+$'
    || profile.perEntryMcpDisablePolicy?.rejectUnsupportedNamesBeforeClaim !== true
    || profile.perEntryMcpDisablePolicy?.cliOverrideTemplate !== 'mcp_servers.<SAFE_NAME>.enabled=false'
    || JSON.stringify(profile.allowedConfigCategories)
      !== JSON.stringify(['hooks', 'marketplaces', 'mcp_servers', 'notify', 'plugins'])
    || profile.perEntryMcpDisablePolicy?.setEnabledFalseForEveryRegisteredServer !== true) {
    throw new Error('Current-host run profile differs from the approved boundary');
  }
  const planBytes = fs.readFileSync(planFile);
  const plan = JSON.parse(planBytes);
  const frozenFields = Object.fromEntries(Object.entries(base)
    .filter(([key]) => !['kind', 'issue', 'phase'].includes(key)));
  const expected = {
    kind: 'barocss-464-current-host-plan-v1', issue: 464, mode: 'owner-approved-current-host',
    basePlanSha256: frozen.planSha256, runProfileSha256: sha(profileBytes),
    ...frozenFields, reserveFirstBeforeInitialization: true,
    preparationIssue: 468, prior464LaunchConsumed: true, prior466LaunchConsumed: true,
  };
  try { assert.deepStrictEqual(plan, expected); }
  catch { throw new Error('Current-host plan differs from frozen bounds, model, prompts, or hashes'); }
  return { planSha256: sha(planBytes), basePlanSha256: frozen.planSha256,
    runProfileSha256: sha(profileBytes), turns: 4, scenarios: ['01', '03'] };
}

export function readCurrentHostDecision({ decisionFile, planFile, candidateCommit, ...unexpected }) {
  if (typeof decisionFile !== 'string' || !path.isAbsolute(decisionFile)
    || path.dirname(decisionFile) !== PRIVATE_ROOT
    || !path.basename(decisionFile).startsWith('private-464-current-host-decision-')
    || fs.realpathSync(decisionFile) !== decisionFile
    || !HEX_40.test(candidateCommit) || Object.keys(unexpected).length) {
    throw new Error('Invalid current-host launch request');
  }
  const verified = verifyCurrentHostPlan({ planFile });
  const decisionBytes = fs.readFileSync(decisionFile);
  let decision;
  try { decision = JSON.parse(decisionBytes); }
  catch { throw new Error('Current-host decision is not valid JSON'); }
  if (decision.kind !== 'barocss-464-current-host-decision-v1' || decision.issue !== 464
    || decision.mode !== 'owner-approved-current-host' || decision.decision !== 'GO'
    || decision.candidateCommit !== candidateCommit || decision.planSha256 !== verified.planSha256
    || decision.runProfileSha256 !== verified.runProfileSha256
    || !HEX_64.test(decision.hostFingerprintSha256) || decision.maxNewTurns !== 4
    || typeof decision.ownerApprovalReference !== 'string' || !decision.ownerApprovalReference
    || typeof decision.reviewAcceptReference !== 'string' || !decision.reviewAcceptReference) {
    throw new Error('Fresh scoped current-host decision is missing or does not match');
  }
  return { decision, decisionSha256: sha(decisionBytes), ...verified };
}

function currentHostLedger({ decisionFile, planFile, candidateCommit, hostFingerprintSha256 }) {
  if (!HEX_64.test(hostFingerprintSha256)) throw new Error('Invalid current-host fingerprint');
  const verified = readCurrentHostDecision({ decisionFile, planFile, candidateCommit });
  const { decision } = verified;
  if (decision.hostFingerprintSha256 !== hostFingerprintSha256) {
    throw new Error('Current-host fingerprint differs from decision');
  }
  const ledgerKey = sha(`${decision.ownerApprovalReference}\0${candidateCommit}\0${verified.planSha256}`);
  const reservationDir = path.join(PRIVATE_ROOT, `private-464-current-host-reservations-${ledgerKey}`);
  fs.mkdirSync(reservationDir, { recursive: true, mode: 0o700 });
  if (fs.realpathSync(reservationDir) !== reservationDir) throw new Error('Reservation ledger is not canonical');
  return { ...verified, reservationDir };
}

export function claimCurrentHostLaunch({ decisionFile, planFile, candidateCommit,
  hostFingerprintSha256, ...unexpected }) {
  if (Object.keys(unexpected).length) throw new Error('Invalid current-host launch claim');
  const ledger = currentHostLedger({ decisionFile, planFile, candidateCommit, hostFingerprintSha256 });
  if (fs.readdirSync(ledger.reservationDir).length) throw new Error('Current-host allowance was already used');
  const launch = { issue: 464, candidateCommit, planSha256: ledger.planSha256,
    runProfileSha256: ledger.runProfileSha256, hostFingerprintSha256,
    decisionSha256: ledger.decisionSha256, claimedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(ledger.reservationDir, 'launch.json'), JSON.stringify(launch) + '\n',
    { flag: 'wx', mode: 0o600 });
  return ledger;
}

export function reserveCurrentHostTurn({ decisionFile, planFile, candidateCommit,
  hostFingerprintSha256, ordinal, rowId, kind, ...unexpected }) {
  if (Object.keys(unexpected).length || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 4
    || rowId !== ORDER[ordinal - 1][0] || kind !== ORDER[ordinal - 1][1]) {
    throw new Error('Turn order differs from current-host plan');
  }
  const ledger = currentHostLedger({ decisionFile, planFile, candidateCommit, hostFingerprintSha256 });
  const launchPath = path.join(ledger.reservationDir, 'launch.json');
  if (!fs.existsSync(launchPath)) throw new Error('Current-host launch must be claimed before turn reservation');
  const launch = JSON.parse(fs.readFileSync(launchPath, 'utf8'));
  if (launch.decisionSha256 !== ledger.decisionSha256 || launch.planSha256 !== ledger.planSha256
    || launch.runProfileSha256 !== ledger.runProfileSha256
    || launch.hostFingerprintSha256 !== hostFingerprintSha256 || launch.candidateCommit !== candidateCommit) {
    throw new Error('Current-host launch claim changed');
  }
  const existing = fs.readdirSync(ledger.reservationDir).filter((name) => /^[1-4]-/.test(name));
  if (existing.length !== ordinal - 1) throw new Error('Current-host reservation count is inconsistent');
  const reservation = { issue: 464, ordinal, rowId, kind, candidateCommit,
    planSha256: ledger.planSha256, runProfileSha256: ledger.runProfileSha256,
    hostFingerprintSha256, decisionSha256: ledger.decisionSha256,
    reservedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(ledger.reservationDir, `${ordinal}-${rowId}-${kind}.json`),
    JSON.stringify(reservation) + '\n', { flag: 'wx', mode: 0o600 });
  return { ...reservation, reservationDir: ledger.reservationDir };
}
