import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentArgv, DISABLED_AGENT_FEATURES, PROFILE, PROFILE_RULES, summarizeAgentEvent } from './agent-profile.mjs';

test('agent argv uses only the native restricted permission profile', () => {
  const args = buildAgentArgv({ cwd: '/Users/user/.barocss-ai/v3/agent-scratch-458-test', schemaPath: '/Users/user/.barocss-ai/v3/agent-scratch-458-test/schema.json', finalPath: '/Users/user/.barocss-ai/v3/private-458/raw.txt' });
  assert.equal(args[0], 'exec');
  assert.ok(args.includes('--ignore-user-config'));
  assert.ok(!args.includes('--ignore-rules'));
  assert.ok(args.includes('skip_host_skill_discovery'));
  assert.ok(args.includes('--strict-config'));
  assert.ok(args.includes(`default_permissions="${PROFILE}"`));
  assert.ok(args.includes(PROFILE_RULES));
  assert.ok(args.includes('approval_policy="on-request"'));
  assert.ok(args.includes('web_search="disabled"'));
  assert.match(PROFILE_RULES, /:tmpdir.*deny/);
  assert.match(PROFILE_RULES, /:slash_tmp.*deny/);
  assert.ok(args.includes(`permissions.${PROFILE}.network.enabled=false`));
  assert.ok(!args.includes('--sandbox'));
  assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
  assert.ok(!args.includes('--approve-for-me'));
  assert.ok(!DISABLED_AGENT_FEATURES.includes('shell_tool'));
  assert.ok(!DISABLED_AGENT_FEATURES.includes('unified_exec'));
  assert.ok(!DISABLED_AGENT_FEATURES.includes('web_search_request'));
  assert.ok(DISABLED_AGENT_FEATURES.includes('standalone_web_search'));
  assert.ok(!args.includes('--search'));
  assert.equal(args.at(-1), '-');
  assert.throws(() => buildAgentArgv({ cwd: '/Users/user/.barocss-ai/v3/agent-scratch-458-test', schemaPath: '/tmp/schema.json', finalPath: '/tmp/final' }), /Schema must be inside/);
  assert.throws(() => buildAgentArgv({ cwd: '/Users/user/.barocss-ai/v3/agent-scratch-458-test', schemaPath: '/Users/user/.barocss-ai/v3/agent-scratch-458-test/schema.json', finalPath: '/Users/user/.barocss-ai/v3/agent-scratch-458-test/final' }), /outside the agent workspace/);
});

test('event summary records observable command use without reasoning or command output text', () => {
  const command = summarizeAgentEvent(JSON.stringify({ type: 'item.completed', item: { id: 'one', type: 'command_execution', command: 'pwd', aggregated_output: '/scratch\n', exit_code: 0, status: 'completed' } }));
  assert.equal(command.command, 'pwd');
  assert.equal(command.exitCode, 0);
  assert.equal(command.outputBytes, 9);
  assert.ok(command.outputSha256);
  assert.ok(!JSON.stringify(command).includes('/scratch'));
  assert.deepEqual(summarizeAgentEvent(JSON.stringify({ type: 'item.completed', item: { type: 'reasoning', text: 'PRIVATE' } })), { type: 'item.completed', itemType: 'reasoning' });
  assert.throws(() => summarizeAgentEvent(JSON.stringify({ type: 'item.started', item: { type: 'file_change' } })), /unexpected-tool/);
  assert.throws(() => summarizeAgentEvent('{bad'), /malformed-event/);
  const error = summarizeAgentEvent(JSON.stringify({ type: 'item.completed', item: { type: 'error', message: 'safe diagnostic marker' } }));
  assert.deepEqual(error, { type: 'item.completed', itemType: 'error', errorClass: 'other' });
  assert.doesNotMatch(JSON.stringify(error), /safe diagnostic marker/);
});
