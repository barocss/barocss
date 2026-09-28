import path from 'node:path';
import { createHash } from 'node:crypto';

export const CLI_VERSION = '0.156.1';
export const MODEL = 'gpt-6-sol';
export const REASONING = 'high';
export const MAX_DISPATCHES = 2;
export const PER_CALL_TIMEOUT_MS = 180_000;
export const TOTAL_TIMEOUT_MS = 360_000;
export const PROMPT_VERSION = 'profile-form-v2';
export const PRIVATE_ROOT = '/Users/user/.barocss-ai/v3';
const PROFILE = 'baro-460-isolated';
const PROFILE_RULES = `permissions.${PROFILE}.filesystem={":root"="deny", ":minimal"="read", ":tmpdir"="deny", ":slash_tmp"="deny", ":workspace_roots"={"."="read"}}`;
const DISABLED = Object.freeze([
  'apps', 'plugins', 'remote_plugin', 'browser_use', 'browser_use_external',
  'browser_use_full_cdp_access', 'computer_use', 'in_app_browser',
  'code_mode_host', 'code_mode', 'multi_agent', 'worktrees', 'hooks',
  'skill_search', 'view_image', 'image_generation', 'standalone_web_search',
  'tool_suggest', 'goals', 'sleep_tool', 'deferred_executor',
]);
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildCliArgv({ kind, cwd, schemaPath, finalPath, threadId }) {
  if (!['initial', 'next'].includes(kind)) throw new Error('Invalid CLI turn');
  for (const value of [cwd, schemaPath, finalPath]) {
    if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('Absolute CLI paths required');
  }
  if (path.dirname(cwd) !== PRIVATE_ROOT || !path.basename(cwd).startsWith('agent-scratch-460-')) {
    throw new Error('Invalid private scratch location');
  }
  if (schemaPath !== path.join(cwd, 'schema.json')) throw new Error('Schema must be fixed inside scratch');
  const outputDir = path.dirname(finalPath);
  if (path.dirname(outputDir) !== PRIVATE_ROOT || !path.basename(outputDir).startsWith('private-460-')
    || !['initial-final.txt', 'next-final.txt'].includes(path.basename(finalPath))) {
    throw new Error('Final output must be a private V3 file');
  }
  if (kind === 'next' && (typeof threadId !== 'string' || !sessionIdPattern.test(threadId))) {
    throw new Error('A reviewed session ID is required for resume');
  }
  if (kind === 'initial' && threadId !== undefined) throw new Error('Initial turn cannot resume');
  const common = ['--ignore-user-config', '--strict-config', '--skip-git-repo-check',
    '--model', MODEL, '-c', `model_reasoning_effort="${REASONING}"`,
    '-c', 'mcp_servers={}', '-c', 'shell_environment_policy.inherit=none',
    '-c', 'suppress_unstable_features_warning=true',
    '-c', 'web_search="disabled"', '-c', 'approval_policy="on-request"',
    '-c', `default_permissions="${PROFILE}"`, '-c', PROFILE_RULES,
    '-c', `permissions.${PROFILE}.network.enabled=false`,
    '--enable', 'skip_host_skill_discovery'];
  for (const feature of DISABLED) common.push('--disable', feature);
  const output = ['--json', '--output-schema', schemaPath, '--output-last-message', finalPath];
  return kind === 'initial'
    ? ['exec', ...common, '--cd', cwd, ...output, '-']
    : ['exec', 'resume', ...common, ...output, threadId, '-'];
}

export const BUTTON_EXAMPLE = Object.freeze({ type: 'Button', props: { id: 'save', label: 'Save' },
  children: [], on: { press: { action: 'save' } } });
const contract = `Return only one JSON object with a specJson string containing one complete screen JSON object. The screen object has exactly root and elements. Use 2 to 32 nodes keyed by lowercase IDs. Each node has top-level type, props and children; only a Button also has top-level on. Its props.id equals the node key. Root is a Layout. Allowed props by type: Layout(id, columns responsive|single, gap fractional|wide); Card(id, padding fractional|spacious, tone light|dark); Text(id, text); Input(id, label, value {"$bindState":"/name"}); Button(id, label). Button.on is a sibling of props and children, never inside props. Example valid Button node: ${JSON.stringify(BUTTON_EXAMPLE)}. Every leaf has children []. Containers reference existing child IDs. No arbitrary fields, class names, HTML, CSS, JavaScript, URLs, other bindings or actions. Return a complete response, never patches or partial JSON. Do not use tools.`;
export const PROMPT_CONTRACT_SHA256 = createHash('sha256').update(contract).digest('hex');

export function buildCliPrompt(request) {
  if (request.kind === 'initial' && typeof request.prompt === 'string'
    && request.prompt.length >= 1 && request.prompt.length <= 300) {
    return JSON.stringify({ contractVersion: PROMPT_VERSION, contract, request: request.prompt,
      task: 'Create a profile form with exactly one name Input and one save Button. Use stable IDs layout, card, heading, name, save. The host owns state and executes save.' });
  }
  if (request.kind === 'next' && request.action === 'save'
    && Number.isSafeInteger(request.revision) && typeof request.input?.name === 'string'
    && request.input.name.length >= 1 && request.input.name.length <= 80) {
    return JSON.stringify({ contractVersion: PROMPT_VERSION, contract, action: 'save', previousRevision: request.revision,
      input: { name: request.input.name },
      task: 'Return a new complete confirmation screen. Show the exact supplied name as Text. Use Layout, Card and Text nodes; no Input or Button is needed. Do not claim that a remote save or payment happened.' });
  }
  throw new Error('Invalid CLI prompt input');
}
