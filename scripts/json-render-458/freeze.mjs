// Compare every execution-contract file with the frozen, reviewed manifest.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { schedule, MODEL, REASONING, CLI_VERSION, MAX_ATTEMPTS } from './plan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const CONTRACT_FILES = Object.freeze([
  'capture.mjs', 'cli.mjs', 'freeze.mjs', 'live.mjs', 'output.schema.json',
  'plan.mjs', 'stub.mjs', 'validate.mjs',
]);
export function currentFrozenPlan() {
  const files = Object.fromEntries(CONTRACT_FILES.map((name) => [name, sha(fs.readFileSync(path.join(here, name)))]));
  return { issue: 458, model: MODEL, reasoning: REASONING, cliVersion: CLI_VERSION,
    maxAttempts: MAX_ATTEMPTS, schedule: schedule(), files };
}
export function verifyFrozen() {
  const file = path.join(here, 'frozen-plan.json');
  const expected = fs.readFileSync(file, 'utf8');
  const current = JSON.stringify(currentFrozenPlan(), null, 2) + '\n';
  if (expected !== current) throw new Error('Frozen pilot plan or source files changed');
  return sha(expected);
}
