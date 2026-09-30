// High-risk live entry point. Never run before exact-commit pre-launch Review ACCEPT.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCliGenerator } from '../barocss-render-loop/cli-transport.mjs';
import { CLI_VERSION, PRIVATE_ROOT, PROMPT_VERSION, PROMPT_CONTRACT_SHA256 } from '../barocss-render-loop/cli-profile.mjs';
import { collectRows, inspectTurn, sha256 } from './collector.mjs';
import { verifyFrozenPlan } from './freeze.mjs';
import { CONTRACT, SCENARIOS } from './plan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const cliPath = '/Users/user/Library/pnpm/nodejs/22.19.0/bin/codex';
const nodeBin = '/Users/user/Library/pnpm/nodejs/22.19.0/bin';
const authPath = '/Users/user/.codex/auth.json';
const claimFile = path.join(PRIVATE_ROOT, 'private-458-corpus-claim.json');
const issueRef = /^https:\/\/github\.com\/barocss\/barocss\/issues\/458(?:#issuecomment-[0-9]+)?$/;
const prior = [
  {
    "dir": "private-460-run-Y9ch1k",
    "turns": [
      "initial"
    ],
    "stop": "unexpected-cli-tool",
    "files": [
      "initial-dispatch.json",
      "initial-result.json"
    ]
  },
  {
    "dir": "private-460-run-eS95yj",
    "turns": [
      "initial"
    ],
    "stop": null,
    "files": [
      "initial-dispatch.json",
      "initial-result.json",
      "initial-final.txt"
    ]
  },
  {
    "dir": "private-460-run-f6gsoX",
    "turns": [
      "initial",
      "next"
    ],
    "stop": null,
    "files": [
      "initial-dispatch.json",
      "initial-result.json",
      "initial-final.txt",
      "next-dispatch.json",
      "next-result.json",
      "next-final.txt"
    ]
  }
];

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

export function verifyPriorDispatches(root = PRIVATE_ROOT) {
  // Actual response and dispatch digests stay in private retained provenance.
  // Missing or altered provenance fails closed; the historical frozen verifier stays on its baseline.
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'private-471-prior-provenance.json'), 'utf8'));
  if (!exactKeys(provenance, ['kind', 'baselineCommit', 'attempts'])
    || provenance.kind !== 'barocss-471-private-prior-provenance-v1'
    || provenance.baselineCommit !== '3d325f146a92a263b78bd0864ef489c44664cadd'
    || !Array.isArray(provenance.attempts) || provenance.attempts.length !== prior.length) {
    throw new Error('Private prior provenance does not match the retained baseline');
  }
  let count = 0;
  for (const attempt of prior) {
    const dir = path.join(root, attempt.dir);
    if (!fs.statSync(dir).isDirectory()) throw new Error('Prior #460 evidence missing');
    const retained = provenance.attempts[prior.indexOf(attempt)];
    if (!exactKeys(retained, ['dir', 'turns', 'stop', 'hashes']) || retained.dir !== attempt.dir
      || JSON.stringify(retained.turns) !== JSON.stringify(attempt.turns) || retained.stop !== attempt.stop
      || !exactKeys(retained.hashes, attempt.files)
      || !Object.values(retained.hashes).every((value) => /^[a-f0-9]{64}$/.test(value))) {
      throw new Error('Private prior provenance shape changed');
    }
    for (const [name, hash] of Object.entries(retained.hashes)) {
      if (sha256(fs.readFileSync(path.join(dir, name))) !== hash) {
        throw new Error('Accepted #460 evidence digest changed');
      }
    }
    for (const [turnIndex, kind] of attempt.turns.entries()) {
      const dispatch = JSON.parse(fs.readFileSync(path.join(dir, `${kind}-dispatch.json`), 'utf8'));
      const result = JSON.parse(fs.readFileSync(path.join(dir, `${kind}-result.json`), 'utf8'));
      if (dispatch.kind !== kind || dispatch.dispatchNumber !== turnIndex + 1
        || result.stopReason !== attempt.stop) throw new Error('Prior #460 accounting drift');
      if (attempt === prior[2] && (dispatch.promptVersion !== PROMPT_VERSION
        || dispatch.promptContractSha256 !== PROMPT_CONTRACT_SHA256 || result.validationFailure)) {
        throw new Error('Accepted #460 prompt or result changed');
      }
      count++;
    }
    if (attempt.turns.length === 1 && fs.existsSync(path.join(dir, 'next-dispatch.json'))) {
      throw new Error('Uncharged #460 next dispatch exists');
    }
  }
  if (count !== CONTRACT.priorDispatches) throw new Error('Prior #460 count changed');
  for (const name of ['private-460-live-claim.json', 'private-460-live-claim-continuation-1.json',
    'private-460-live-claim-continuation-2.json']) {
    if (!fs.statSync(path.join(root, name)).isFile()) throw new Error('Prior #460 claim missing');
  }
  const dir = path.join(root, prior[2].dir);
  const initial = JSON.parse(fs.readFileSync(path.join(dir, 'initial-final.txt'), 'utf8'));
  const next = JSON.parse(fs.readFileSync(path.join(dir, 'next-final.txt'), 'utf8'));
  const firstSession = JSON.parse(fs.readFileSync(path.join(dir, 'initial-result.json'), 'utf8')).threadId;
  const secondSession = JSON.parse(fs.readFileSync(path.join(dir, 'next-result.json'), 'utf8')).threadId;
  if (firstSession !== secondSession || !firstSession) throw new Error('Calibration session changed');
  for (const [kind, envelope] of [['initial', initial], ['next', next]]) {
    const checked = inspectTurn({ threadId: firstSession, specJson: envelope.specJson }, kind, SCENARIOS[0].name);
    if (checked.status !== 'valid') throw new Error('Accepted calibration is no longer valid');
  }
  return { count, calibration: {
    id: '01', initial: { status: 'valid', reason: null, outputDir: dir,
      rawSha256: sha256(fs.readFileSync(path.join(dir, 'initial-final.txt'))), threadId: firstSession },
    next: { status: 'valid', reason: null, outputDir: dir,
      rawSha256: sha256(fs.readFileSync(path.join(dir, 'next-final.txt'))), threadId: firstSession },
  } };
}

export function validateLaunchApproval(value, taskCommit, frozenSha256) {
  if (!exactKeys(value, ['kind', 'issue', 'taskCommit', 'frozenPlanSha256', 'ownerDecisionRef',
    'reviewUrl', 'priorDispatches', 'newDispatchCeiling', 'aggregateCeiling'])
    || value.kind !== 'barocss-458-corpus-launch' || value.issue !== 458
    || value.taskCommit !== taskCommit || value.frozenPlanSha256 !== frozenSha256
    || !issueRef.test(value.ownerDecisionRef) || !/^https:\/\/github\.com\/barocss\/barocss\/issues\/458#issuecomment-[0-9]+$/.test(value.reviewUrl)
    || value.priorDispatches !== CONTRACT.priorDispatches
    || value.newDispatchCeiling !== CONTRACT.newDispatchCeiling
    || value.aggregateCeiling !== CONTRACT.aggregateCeiling) {
    throw new Error('Approval does not match the exact frozen corpus launch');
  }
  return value;
}

export function readLaunchApproval(file, taskCommit, frozenSha256) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || path.dirname(file) !== PRIVATE_ROOT
    || !/^private-458-corpus-approval-[a-z0-9-]+\.json$/.test(path.basename(file))
    || !fs.lstatSync(file).isFile()) throw new Error('Use one private #458 approval file');
  return validateLaunchApproval(JSON.parse(fs.readFileSync(file, 'utf8')), taskCommit, frozenSha256);
}

export function atomicClaim(approval, outputDir, file = claimFile) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeSync(fd, JSON.stringify({ ...approval, outputDir, claimedAt: new Date().toISOString() }) + '\n');
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
}

export function reserveIn(dir, item) {
  const file = path.join(dir, `reservation-${String(item.ordinal).padStart(2, '0')}.json`);
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeSync(fd, JSON.stringify({ ...item, reservedAt: new Date().toISOString() }) + '\n');
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
}

function createSession(_row, outputDir) {
  const cwd = fs.mkdtempSync(path.join(PRIVATE_ROOT, 'agent-scratch-460-corpus-'));
  const codexHome = fs.mkdtempSync(path.join(PRIVATE_ROOT, '.codex-home-458-corpus-'));
  const home = path.join(cwd, 'home');
  const schemaPath = path.join(cwd, 'schema.json');
  try {
    fs.mkdirSync(home, { mode: 0o700 });
    fs.copyFileSync(path.join(here, '../barocss-render-loop/output.schema.json'), schemaPath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(schemaPath, 0o400);
    fs.symlinkSync(authPath, path.join(codexHome, 'auth.json'));
    const generate = createCliGenerator({ cliPath, cwd, home, codexHome, nodeBin, schemaPath, outputDir });
    generate.close = () => {
      fs.rmSync(codexHome, { recursive: true, force: true });
      fs.rmSync(cwd, { recursive: true, force: true });
    };
    return generate;
  } catch (error) {
    fs.rmSync(codexHome, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
    throw error;
  }
}

export async function launch(file) {
  const taskCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  if (execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim()) {
    throw new Error('Exact reviewed task commit must be clean');
  }
  const frozen = verifyFrozenPlan();
  const approval = readLaunchApproval(file, taskCommit, frozen.sha256);
  const { calibration } = verifyPriorDispatches();
  if (!fs.statSync(authPath).isFile()) throw new Error('Existing Codex CLI login is unavailable');
  const version = execFileSync(cliPath, ['--version'], { encoding: 'utf8' }).trim();
  if (version !== `codex-cli ${CLI_VERSION}`) throw new Error('Installed Codex CLI version changed');
  if (fs.existsSync(claimFile)) throw new Error('The #458 corpus allowance is already claimed');
  const outputDir = fs.mkdtempSync(path.join(PRIVATE_ROOT, 'private-458-corpus-run-'));
  atomicClaim(approval, outputDir);
  const manifestFile = path.join(outputDir, 'corpus.json');
  const manifest = await collectRows({ manifestFile, calibration, requireSavedFinal: true,
    reserve: (item) => reserveIn(outputDir, item),
    outputDirectory: (id) => fs.mkdtempSync(path.join(PRIVATE_ROOT, `private-460-corpus-row-${id}-`)),
    sessionFactory: createSession });
  console.log(JSON.stringify({ privateCorpus: outputDir, priorDispatches: manifest.priorDispatches,
    newReservations: manifest.newReservations, stopReason: manifest.stopReason }));
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== '--approval') {
    throw new Error('Usage: node launch.mjs --approval /Users/user/.barocss-ai/v3/private-458-corpus-approval-ID.json');
  }
  await launch(process.argv[3]);
}
