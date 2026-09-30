// No model launch: exercise only the saved-evidence verifier with authored inputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyPriorDispatches } from './launch.mjs';

test('public-head prior verification fails closed without private retained provenance', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-provenance-'));
  try {
    assert.throws(() => verifyPriorDispatches(root), /ENOENT/);
    fs.writeFileSync(path.join(root, 'private-471-prior-provenance.json'), JSON.stringify({
      kind: 'barocss-471-private-prior-provenance-v1', baselineCommit: 'incorrect', attempts: [],
    }));
    assert.throws(() => verifyPriorDispatches(root), /retained baseline/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
