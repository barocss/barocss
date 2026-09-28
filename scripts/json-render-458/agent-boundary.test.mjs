import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PROFILE, PROFILE_RULES, SCRATCH_PARENT, buildAgentArgv } from './agent-profile.mjs';
import { checkCliLogin } from './agent-live.mjs';

const codex = '/Users/user/Library/pnpm/nodejs/22.19.0/bin/codex';
const repoEvaluator = path.join(path.dirname(fileURLToPath(import.meta.url)), 'plan.mjs');

test('isolated CLI accepts explicit disabled web search without a deprecated launch feature',
  { skip: process.env.BARO_458_PROBE !== '1' }, () => {
    const isolated = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'agent-feature-458-'));
    try {
      const env = { ...process.env, CODEX_HOME: isolated };
      const result = spawnSync(codex, ['features', 'list', '--disable', 'standalone_web_search'],
        { encoding: 'utf8', env });
      assert.equal(result.status, 0, 'installed CLI feature inspection must succeed');
      const features = new Map((result.stdout ?? '').split('\n').filter(Boolean).map((line) => {
        const [name, ...columns] = line.trim().split(/\s+/);
        return [name, columns.at(-1)];
      }));
      for (const name of ['web_search_request', 'web_search_cached', 'standalone_web_search'])
        assert.equal(features.get(name), 'false', `${name} must be off in the isolated home`);
      const parseMode = (mode) => spawnSync(codex, ['debug', 'prompt-input', '-c', `web_search="${mode}"`, 'probe'],
        { encoding: 'utf8', env, cwd: isolated, maxBuffer: 2_000_000 });
      assert.equal(parseMode('disabled').status, 0, 'installed CLI must accept disabled web search');
      assert.notEqual(parseMode('obviously-invalid').status, 0, 'mode probe must reject invalid values');
      const help = spawnSync(codex, ['--help'], { encoding: 'utf8', env });
      assert.equal(help.status, 0);
      assert.equal(/--search\s+Enable live web search/.test(help.stdout), true,
        'installed CLI must keep live web search opt-in');
      const args = buildAgentArgv({ cwd: path.join(SCRATCH_PARENT, 'agent-scratch-458-probe'),
        schemaPath: path.join(SCRATCH_PARENT, 'agent-scratch-458-probe', 'schema.json'),
        finalPath: path.join(SCRATCH_PARENT, 'private-458', 'probe-final.txt') });
      assert.ok(!args.includes('web_search_request'));
      assert.ok(!args.includes('--search'));
      assert.ok(args.includes('web_search="disabled"'));
      assert.ok(args.includes('standalone_web_search'));
      assert.ok(args.includes(`permissions.${PROFILE}.network.enabled=false`));
    } finally { fs.rmSync(isolated, { recursive: true, force: true }); }
  });

test('native profile reads only scratch and blocks evaluator, temp, symlink and writes',
  { skip: process.env.BARO_458_PROBE !== '1' }, () => {
    const scratch = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'agent-scratch-458-'));
    const sibling = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'baro-458-sibling-'));
    const evidence = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'private-458-probe-'));
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-temp-'));
    const authHome = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'agent-auth-458-probe-'));
    try {
      fs.symlinkSync('/Users/user/.codex/auth.json', path.join(authHome, 'auth.json'));
      checkCliLogin({ ...process.env, CODEX_HOME: authHome });
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
