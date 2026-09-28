import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './collector.mjs';
import { SCENARIOS, CONTRACT } from './plan.mjs';
import { CONTENT_CHECKS, RUBRIC_VERSION } from './rubric.mjs';
import { CLI_VERSION, MODEL, REASONING, PROMPT_VERSION, PROMPT_CONTRACT_SHA256,
  PER_CALL_TIMEOUT_MS, TOTAL_TIMEOUT_MS } from '../barocss-render-loop/cli-profile.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const frozenFile = path.join(here, 'frozen-plan.json');
export const SOURCE_PATHS = Object.freeze([
  'scripts/barocss-render-corpus/plan.mjs',
  'scripts/barocss-render-corpus/collector.mjs',
  'scripts/barocss-render-corpus/freeze.mjs',
  'scripts/barocss-render-corpus/launch.mjs',
  'scripts/barocss-render-corpus/verify.mjs',
  'scripts/barocss-render-corpus/rubric.mjs',
  'scripts/barocss-render-corpus/LAUNCH-PACKET.md',
  'scripts/barocss-render-corpus/replay.mjs',
  'scripts/barocss-render-corpus/browser-app.jsx',
  'scripts/barocss-render-corpus/base.css',
  'scripts/barocss-render-loop/cli-profile.mjs',
  'scripts/barocss-render-loop/cli-transport.mjs',
  'scripts/barocss-render-loop/output.schema.json',
  'packages/barocss-render/src/contract.mjs',
  'packages/barocss-render/src/index.jsx',
  'scripts/barocss-render-prototype/json-adapter.jsx',
  'scripts/barocss-render-prototype/prototype-adapter.jsx',
  'scripts/barocss-render-prototype/visual.jsx',
  'packages/barocss-render/README.md',
  'scripts/barocss-render-loop/README.md',
  'pnpm-lock.yaml',
]);

export function frozenPlan() {
  const sourceSha256 = Object.fromEntries(SOURCE_PATHS.map((relative) =>
    [relative, sha256(fs.readFileSync(path.join(repo, relative)))]));
  return { kind: CONTRACT.kind, contract: CONTRACT, scenarios: SCENARIOS,
    rubric: { version: RUBRIC_VERSION, contentChecks: CONTENT_CHECKS },
    cli: { version: CLI_VERSION, model: MODEL, reasoning: REASONING,
      promptVersion: PROMPT_VERSION, promptContractSha256: PROMPT_CONTRACT_SHA256,
      perCallTimeoutMs: PER_CALL_TIMEOUT_MS, perSessionTimeoutMs: TOTAL_TIMEOUT_MS },
    calibration: { issue: 460, acceptedTaskCommit: 'a2cdd935f884f9a592d9b651e4827ffda23841d7',
      proofOutputDir: '/Users/user/.barocss-ai/v3/private-460-run-f6gsoX',
      priorAttemptOutputDirs: ['/Users/user/.barocss-ai/v3/private-460-run-Y9ch1k',
        '/Users/user/.barocss-ai/v3/private-460-run-eS95yj'],
      chargedDispatches: 4, promptV1SeparateCohort: true },
    boundaries: { cliOnly: true, noApiFallback: true, noAutomaticRetry: true,
      noNewDownloads: true, serialSessions: true, strictSharedSpec: true,
      invalidOutputRetained: true, generatedCodeExecution: false,
      row10CanBeSkippedAtCeiling: true },
    sourceSha256 };
}

export function verifyFrozenPlan(file = frozenFile) {
  const bytes = fs.readFileSync(file);
  const expected = Buffer.from(JSON.stringify(frozenPlan(), null, 2) + '\n');
  if (!bytes.equals(expected)) throw new Error('Frozen plan or source hash changed');
  return { file, sha256: sha256(bytes), plan: JSON.parse(bytes) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--write' && process.argv.length === 3) {
    fs.writeFileSync(frozenFile, JSON.stringify(frozenPlan(), null, 2) + '\n', { flag: 'w' });
    console.log(`Frozen ${frozenFile}`);
  } else if (process.argv[2] === '--verify' && process.argv.length === 3) {
    console.log(JSON.stringify({ sha256: verifyFrozenPlan().sha256 }));
  } else throw new Error('Usage: node freeze.mjs --write|--verify');
}
