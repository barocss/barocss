import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Run from any working directory. This exercises the actual TypeScript
// projection -> persistent reference contract, not native geometry itself.
const repo = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
test('Split evolution to persistent Face reference contract', { timeout: 120000 }, () => {
  const script = resolve(repo, 'packages/barocss-cad/scripts/split-persistent-reference-chain-test.mjs');
  const result = execFileSync(process.execPath, [script], {
    cwd: repo, encoding: 'utf8', timeout: 120000,
  });
  if (!result.includes('PASS: projected Split lineage -> authored Face resolution'))
    throw new Error('Expected Split reference contract receipt missing');
});
