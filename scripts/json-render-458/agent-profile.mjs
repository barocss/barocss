// CLI agent launch contract. This module never starts a model invocation.
import path from 'node:path';
import { createHash } from 'node:crypto';
import { CLI_VERSION, MODEL, REASONING } from './plan.mjs';
import { classifyDiagnostic } from './agent-diagnostics.mjs';

export const PROFILE = 'baro-458-isolated';
export const SCRATCH_PARENT = '/Users/user/.barocss-ai/v3';
export const PROFILE_RULES = 'permissions.baro-458-isolated.filesystem={":root"="deny", ":minimal"="read", ":tmpdir"="deny", ":slash_tmp"="deny", ":workspace_roots"={"."="read"}}';
export const DISABLED_AGENT_FEATURES = Object.freeze([
  'apps', 'plugins', 'remote_plugin', 'browser_use', 'browser_use_external',
  'browser_use_full_cdp_access', 'computer_use', 'in_app_browser',
  'code_mode_host', 'code_mode', 'multi_agent', 'worktrees', 'hooks',
  'skill_search', 'view_image', 'image_generation',
  'standalone_web_search', 'tool_suggest', 'goals', 'sleep_tool',
  'deferred_executor',
]);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const events = new Set(['thread.started', 'turn.started', 'turn.completed', 'turn.failed', 'item.started', 'item.updated', 'item.completed', 'error']);
const items = new Set(['agent_message', 'reasoning', 'command_execution', 'error']);

export function buildAgentArgv({ cwd, schemaPath, finalPath }) {
  for (const value of [cwd, schemaPath, finalPath]) if (!path.isAbsolute(value)) throw new Error('Absolute launch paths required');
  if (path.dirname(cwd) !== SCRATCH_PARENT || !path.basename(cwd).startsWith('agent-scratch-458-')) throw new Error('Scratch must be a unique direct child of the private V3 root');
  if (path.dirname(schemaPath) !== cwd) throw new Error('Schema must be inside the scratch workspace');
  if (finalPath === cwd || finalPath.startsWith(`${cwd}${path.sep}`)) throw new Error('Final evidence must be outside the agent workspace');
  const args = ['exec', '--ignore-user-config', '--strict-config', '--ephemeral', '--skip-git-repo-check',
    '--model', MODEL, '-c', `model_reasoning_effort="${REASONING}"`,
    '-c', 'mcp_servers={}', '-c', 'shell_environment_policy.inherit=none',
    '-c', 'web_search="disabled"',
    '-c', 'approval_policy="on-request"',
    '-c', `default_permissions="${PROFILE}"`, '-c', PROFILE_RULES,
    '-c', `permissions.${PROFILE}.network.enabled=false`,
    '--enable', 'skip_host_skill_discovery'];
  for (const feature of DISABLED_AGENT_FEATURES) args.push('--disable', feature);
  return [...args, '--cd', cwd, '--json', '--output-schema', schemaPath,
    '--output-last-message', finalPath, '-'];
}

export function summarizeAgentEvent(line) {
  let event;
  try { event = JSON.parse(line); } catch { throw new Error('malformed-event'); }
  if (!event || !events.has(event.type)) throw new Error('unknown-event');
  const summary = { type: event.type };
  if (event.type === 'thread.started' && typeof event.thread_id === 'string') summary.threadId = event.thread_id;
  if (event.type.startsWith('item.')) {
    const item = event.item;
    if (!item || !items.has(item.type)) throw new Error(`unexpected-tool:${String(item?.type)}`);
    summary.itemType = item.type;
    if (typeof item.id === 'string') summary.itemId = item.id;
    if (item.type === 'agent_message' && typeof item.text === 'string') {
      summary.textBytes = Buffer.byteLength(item.text);
      summary.textSha256 = sha(item.text);
    }
    if (item.type === 'command_execution') {
      if (typeof item.command !== 'string' || Buffer.byteLength(item.command) > 8192) throw new Error('invalid-command-event');
      summary.command = item.command;
      if (typeof item.status === 'string') summary.status = item.status;
      if (Number.isSafeInteger(item.exit_code)) summary.exitCode = item.exit_code;
      if (typeof item.aggregated_output === 'string') {
        summary.outputBytes = Buffer.byteLength(item.aggregated_output);
        summary.outputSha256 = sha(item.aggregated_output);
      }
    }
    if (item.type === 'error') summary.errorClass = classifyDiagnostic(JSON.stringify(item));
    // Reasoning content is never retained.
  }
  if (event.type === 'turn.completed' || event.type === 'turn.failed') {
    if (event.usage && typeof event.usage === 'object') {
      summary.usage = Object.fromEntries(Object.entries(event.usage)
        .filter(([, value]) => Number.isFinite(value) && value >= 0));
    }
  }
  if (event.type === 'error' || event.type === 'turn.failed') {
    const message = String(event.message ?? event.error?.message ?? '');
    summary.errorClass = classifyDiagnostic(message);
  }
  if (typeof event.model === 'string') summary.model = event.model;
  return summary;
}

export const agentCliVersion = CLI_VERSION;
