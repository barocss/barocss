import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertLocalConfiguration, buildAppServerArgv } from './launch-profile.mjs';

const privateRoot = '/Users/user/.barocss-ai/v3';

test('fixed app-server argv accepts only a private scratch with an optional copied schema', () => {
  const cwd = fs.mkdtempSync(path.join(privateRoot, 'agent-scratch-462-profile-'));
  try {
    const args = buildAppServerArgv({ cwd });
    assert.deepEqual(args.slice(0, 3), ['app-server', '--stdio', '--strict-config']);
    assert.equal(args.includes('--ignore-user-config'), false);
    assert.equal(args.includes('--enable'), true);
    assert.equal(args.includes('skip_host_skill_discovery'), true);
    for (const value of ['model="gpt-6.1-sol"', 'model_provider="openai"', 'model_reasoning_effort="high"',
      'approval_policy="never"', 'approvals_reviewer="auto_review"', 'sandbox_mode="read-only"', 'notify=[]',
      'web_search="disabled"', 'mcp_servers={}', 'tools.update_plan.enabled=false',
      'tools.experimental_request_user_input.enabled=false', 'project_doc_max_bytes=0',
      'shell_environment_policy.inherit="none"']) assert(args.includes(value), value);
    for (const feature of ['shell_tool', 'unified_exec', 'apps', 'plugins', 'remote_plugin',
      'hooks', 'browser_use', 'computer_use', 'code_mode', 'multi_agent', 'worktrees',
      'skill_search', 'view_image', 'image_generation', 'standalone_web_search',
      'tool_suggest', 'goals', 'sleep_tool', 'deferred_executor',
      'skill_mcp_dependency_install', 'workspace_dependencies']) {
      const index = args.indexOf(feature);
      assert(index > 0 && args[index - 1] === '--disable', feature);
    }
    fs.writeFileSync(path.join(cwd, 'schema.json'), '{}\n');
    assert.deepEqual(buildAppServerArgv({ cwd }), args);
    fs.writeFileSync(path.join(cwd, 'unexpected.txt'), 'x');
    assert.throws(() => buildAppServerArgv({ cwd }), /only the copied schema/);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  assert.throws(() => buildAppServerArgv({ cwd: os.tmpdir() }), /private #462 scratch/);
});

test('TOML preflight accepts a simple inherited config and rejects hazardous settings without values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-launch-profile-'));
  try {
    const home = path.join(dir, 'home');
    const cwd = path.join(home, 'project', 'scratch');
    const configDir = path.join(home, '.codex');
    fs.mkdirSync(cwd, { recursive: true });
    fs.mkdirSync(configDir);
    const config = path.join(configDir, 'config.toml');
    const env = { HOME: home, PATH: process.env.PATH };
    fs.writeFileSync(config, 'model = "gpt-6.1-sol"\nmodel_reasoning_effort = "high"\n');
    const clean = assertLocalConfiguration({ env, cwd });
    assert.equal(clean.ok, true);
    assert.equal(clean.cloudManagedDefaultsInspected, false);
    for (const [source, expected] of [
      ['[mcp_servers.docs]\nurl="https://example.invalid"\n', 'mcp_servers'],
      ['notify=["secret-command"]\n', 'notify'],
      ['[hooks.SessionStart]\ncommand="secret-command"\n', 'hooks'],
      ['model_instructions_file="private.txt"\n', 'model_instructions_file'],
      ['profile="custom"\n', 'profile'],
      ['model_provider="custom"\n', 'model_provider'],
      ['[model_providers.custom]\nenv_key="SECRET_VALUE"\n', 'model_providers'],
      ['api_key="SECRET_VALUE"\n', 'api_key'],
      ['this is not toml\n', 'cannot be parsed'],
    ]) {
      fs.writeFileSync(config, source);
      assert.throws(() => assertLocalConfiguration({ env, cwd }), (error) =>
        error.message.includes(expected) && !error.message.includes('SECRET_VALUE'));
    }
    fs.writeFileSync(config, 'model="gpt-6.1-sol"\n');
    assert.throws(() => assertLocalConfiguration({ env: { ...env, OPENAI_API_KEY: 'SECRET_VALUE' }, cwd }),
      (error) => /Credential environment overrides/.test(error.message)
        && !error.message.includes('SECRET_VALUE'));
    assert.throws(() => assertLocalConfiguration({ env: { ...env, CODEX_PROFILE: 'custom' }, cwd }),
      /Credential environment overrides/);
    const ancestor = path.join(home, 'project', '.codex');
    fs.mkdirSync(ancestor);
    fs.writeFileSync(path.join(ancestor, 'config.toml'), 'model="gpt-6.1-sol"\n');
    assert.throws(() => assertLocalConfiguration({ env, cwd }), /Ancestor project Codex configuration/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
