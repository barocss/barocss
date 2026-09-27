import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PROFILE, PROFILE_RULES, SCRATCH_PARENT } from './agent-profile.mjs';

const codex = '/Users/user/Library/pnpm/nodejs/22.19.0/bin/codex';
const repoEvaluator = path.join(path.dirname(fileURLToPath(import.meta.url)), 'plan.mjs');

test('native profile reads only scratch and blocks evaluator, temp, symlink and writes',
  { skip: process.env.BARO_458_PROBE !== '1' }, () => {
    const scratch = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'agent-scratch-458-'));
    const sibling = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'baro-458-sibling-'));
    const evidence = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'private-458-probe-'));
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-temp-'));
    const authHome = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'agent-auth-458-probe-'));
    try {
      fs.symlinkSync('/Users/user/.codex/auth.json', path.join(authHome, 'auth.json'));
      const scratchFile = path.join(scratch, 'sentinel');
      const siblingFile = path.join(sibling, 'sentinel');
      const evidenceFile = path.join(evidence, 'sentinel');
      const tempFile = path.join(temp, 'sentinel');
      for (const file of [scratchFile, siblingFile, evidenceFile, tempFile]) fs.writeFileSync(file, 'harmless probe\n');
      const escape = path.join(scratch, 'escape');
      fs.symlinkSync(siblingFile, escape);
      const probe = (...args) => spawnSync(codex, ['sandbox', '-P', PROFILE, '-c', PROFILE_RULES,
        '-c', `permissions.${PROFILE}.network.enabled=false`, '-C', scratch, ...args],
      { encoding: 'utf8', env: { ...process.env, CODEX_HOME: authHome } });
      const readable = (file) => probe('/bin/test', '-r', file);
      assert.equal(readable(scratchFile).status, 0, 'scratch must be readable');
      for (const file of [siblingFile, evidenceFile, tempFile, repoEvaluator, escape,
        path.join(authHome, 'auth.json'), '/Users/user/.codex/auth.json']) {
        const result = readable(file);
        assert.equal(result.status, 1, `outside read must be denied: ${file}; ${result.stderr}`);
      }
      for (const file of [path.join(scratch, 'new'), path.join(evidence, 'new')]) {
        const result = probe('/usr/bin/touch', file);
        assert.notEqual(result.status, 0, `write must be denied: ${file}`);
        assert.equal(fs.existsSync(file), false);
      }
    } finally {
      for (const dir of [scratch, sibling, evidence, temp, authHome]) fs.rmSync(dir, { recursive: true, force: true });
    }
  });
