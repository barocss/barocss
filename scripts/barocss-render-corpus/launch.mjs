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
  { dir: 'private-460-run-Y9ch1k', turns: ['initial'], stop: 'unexpected-cli-tool',
    hashes: { 'initial-dispatch.json': '973fd1eee847f49e6f60dd44a6ade943ec0380e3c34221e8aacc921379d20b95',
      'initial-result.json': '58a9fdd7d8757401919e00b90a38e358b81a9034bf7b78f40b2f9a51667e07b5' } },
  { dir: 'private-460-run-eS95yj', turns: ['initial'], stop: null,
    hashes: { 'initial-dispatch.json': '3b71f0e6dd49a6a62beaccb3f1d8076a8d1f3e87973013bee2067b6f603d04a4',
      'initial-result.json': 'a82bbfd436ad918beed2a4312162050aa248b6c44ad8f2abbf66290833aeb539',
      'initial-final.txt': '0994bf26f6368d5afb4d281166b34078874bea77c948a5166d8b9b99b5d643f1' } },
  { dir: 'private-460-run-f6gsoX', turns: ['initial', 'next'], stop: null,
    hashes: { 'initial-dispatch.json': 'da4c9dc2e653d0dc9966556bbbe099e849b991f2e017453a8d76d8325c9056df',
      'initial-result.json': 'd9835eb0ab141df7bee6d5663f5415884cbd0413f2fea48ca75c8fcbc5f1f391',
      'initial-final.txt': 'd541652a1030eb8a66ea238159042564f33b1b5b00d61db34592ad28ddbb5708',
      'next-dispatch.json': '9e28e41eef57e4e6e54f6901e429194d577a4ae822c25f8dd971b496b8d6e454',
      'next-result.json': '7125b18ae3df634bfc47dd8ecec02dd719026a4f41539cc544ee2a240da817d3',
      'next-final.txt': 'feb374c3f7e9a55788a3d468a5ec4aa60c1b6d0b5db3168d357cea9e685a60fe' } },
];

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

export function verifyPriorDispatches(root = PRIVATE_ROOT) {
  let count = 0;
  for (const attempt of prior) {
    const dir = path.join(root, attempt.dir);
    if (!fs.statSync(dir).isDirectory()) throw new Error('Prior #460 evidence missing');
    for (const [name, hash] of Object.entries(attempt.hashes)) {
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
