// Fixed app-server launch arguments and a read-only inherited-config preflight.
// The caller must still verify the exact Codex binary version before spawning it.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PRIVATE_ROOT = '/Users/user/.barocss-ai/v3';
const SCRATCH_NAME = /^agent-scratch-462-[A-Za-z0-9_-]+$/;
const DISABLED = Object.freeze([
  'shell_tool', 'unified_exec', 'apps', 'plugins', 'remote_plugin', 'hooks',
  'browser_use', 'browser_use_external', 'browser_use_full_cdp_access',
  'computer_use', 'in_app_browser', 'code_mode_host', 'code_mode',
  'multi_agent', 'worktrees', 'skill_search', 'view_image', 'image_generation',
  'standalone_web_search', 'tool_suggest', 'goals', 'sleep_tool',
  'deferred_executor', 'skill_mcp_dependency_install', 'workspace_dependencies',
]);
const OVERRIDES = Object.freeze([
  'model="gpt-6.1-sol"', 'model_provider="openai"', 'model_reasoning_effort="high"',
  'approval_policy="never"', 'approvals_reviewer="auto_review"', 'sandbox_mode="read-only"',
  'notify=[]', 'web_search="disabled"', 'mcp_servers={}',
  'tools.update_plan.enabled=false',
  'tools.experimental_request_user_input.enabled=false',
  'project_doc_max_bytes=0', 'shell_environment_policy.inherit="none"',
]);

export function buildAppServerArgv({ cwd } = {}) {
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd)
    || path.dirname(cwd) !== PRIVATE_ROOT || !SCRATCH_NAME.test(path.basename(cwd))) {
    throw new Error('App-server cwd must be a fresh private #462 scratch directory');
  }
  if (!fs.existsSync(cwd) || !fs.lstatSync(cwd).isDirectory()) {
    throw new Error('App-server scratch directory must exist');
  }
  const entries = fs.readdirSync(cwd);
  if (entries.some((entry) => entry !== 'schema.json') || entries.length > 1
    || (entries.length === 1 && !fs.lstatSync(path.join(cwd, 'schema.json')).isFile())) {
    throw new Error('App-server scratch may contain only the copied schema.json');
  }
  const args = ['app-server', '--stdio', '--strict-config'];
  for (const value of OVERRIDES) args.push('-c', value);
  args.push('--enable', 'skip_host_skill_discovery');
  for (const feature of DISABLED) args.push('--disable', feature);
  return args;
}

// Python 3.11+ tomllib is used because no TOML package is installed in the checked-in Node dependencies.
// Only names of hazardous settings leave the parser process; values are never logged.
const TOML_HAZARDS = String.raw`
import json, sys, tomllib
try:
    data = tomllib.loads(sys.stdin.read())
except Exception:
    print(json.dumps({"parseError": True}))
    raise SystemExit(0)
if not isinstance(data, dict):
    print(json.dumps({"parseError": True}))
    raise SystemExit(0)
hazards = []
def present(key):
    value = data.get(key)
    return value not in (None, {}, [])
for key in ("mcp_servers", "notify", "hooks", "model_instructions_file",
            "experimental_instructions_file", "instructions", "developer_instructions",
            "profile", "profiles", "model_providers", "plugins", "marketplaces",
            "openai_base_url", "chatgpt_base_url", "experimental_realtime_ws_base_url",
            "agents", "tools"):
    if present(key): hazards.append(key)
if data.get("model_provider") not in (None, "openai"):
    hazards.append("model_provider")
features = data.get("features")
if isinstance(features, dict) and any(value is True for value in features.values()):
    hazards.append("features")
for key in data:
    lower = key.lower()
    if any(word in lower for word in ("api_key", "access_token", "refresh_token",
                                   "credential", "auth_file", "identity_token")):
        hazards.append(key)
print(json.dumps({"parseError": False, "hazards": sorted(set(hazards))}))
`;

function inspectToml(file) {
  const entry = fs.lstatSync(file);
  if (!entry.isFile()) throw new Error('Inherited config is not a regular file');
  const source = fs.readFileSync(file, 'utf8');
  const parsed = spawnSync('/opt/homebrew/bin/python3.11', ['-I', '-c', TOML_HAZARDS], {
    input: source, encoding: 'utf8', maxBuffer: 1_000_000, timeout: 5_000,
  });
  if (parsed.error || parsed.status !== 0 || !parsed.stdout) {
    throw new Error('Python 3.11+ tomllib is required for inherited-config inspection');
  }
  let result;
  try { result = JSON.parse(parsed.stdout); }
  catch { throw new Error('Inherited-config inspection failed'); }
  if (result.parseError) throw new Error('Inherited config TOML cannot be parsed');
  if (result.hazards?.length) {
    throw new Error(`Inherited config contains prohibited settings: ${result.hazards.join(', ')}`);
  }
}

const CREDENTIAL_ENV = /(?:^|_)(?:API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|AUTH_TOKEN|CLIENT_SECRET|IDENTITY_TOKEN_FILE|CREDENTIALS_FILE)$/i;
const CREDENTIAL_ENV_EXACT = new Set([
  'OPENAI_BASE_URL', 'OPENAI_ORGANIZATION', 'OPENAI_PROJECT', 'CODEX_AUTH_FILE',
  'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN', 'OPENAI_API_KEY', 'AZURE_OPENAI_API_KEY',
  'CODEX_PROFILE', 'CODEX_CONFIG', 'CODEX_CONFIG_FILE', 'CODEX_MODEL_PROVIDER',
  'CODEX_MODEL', 'CODEX_BASE_URL',
]);

export function assertLocalConfiguration({ env = process.env, cwd = process.cwd() } = {}) {
  if (!env || typeof env !== 'object' || typeof env.HOME !== 'string'
    || !path.isAbsolute(env.HOME) || typeof cwd !== 'string' || !path.isAbsolute(cwd)) {
    throw new Error('Inherited HOME and cwd must be absolute');
  }
  if (env.CODEX_HOME !== undefined && (typeof env.CODEX_HOME !== 'string'
    || !path.isAbsolute(env.CODEX_HOME))) throw new Error('Inherited CODEX_HOME must be absolute');
  const credentialKeys = Object.keys(env).filter((key) => typeof env[key] === 'string' && env[key]
    && (CREDENTIAL_ENV.test(key) || CREDENTIAL_ENV_EXACT.has(key)));
  if (credentialKeys.length) {
    throw new Error(`Credential environment overrides are present: ${credentialKeys.sort().join(', ')}`);
  }
  const configHome = env.CODEX_HOME ?? path.join(env.HOME, '.codex');
  const userConfig = path.join(configHome, 'config.toml');
  const blockedSystem = ['/etc/codex/config.toml', '/etc/codex/requirements.toml'];
  for (const file of blockedSystem) if (fs.existsSync(file)) {
    throw new Error('System Codex configuration requires separate review');
  }
  const inspected = [];
  if (fs.existsSync(userConfig)) {
    inspectToml(userConfig);
    inspected.push(userConfig);
  }
  let current = cwd;
  while (true) {
    const projectConfig = path.join(current, '.codex/config.toml');
    if (projectConfig !== userConfig && fs.existsSync(projectConfig)) {
      throw new Error('Ancestor project Codex configuration requires separate review');
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  // Cloud-managed defaults are not exposed as local files. Fixed CLI overrides and feature disables
  // cover the listed capabilities; a claim of a globally tool-free protocol is not possible here.
  return { ok: true, inspected, cloudManagedDefaultsInspected: false,
    parser: 'pinned-python3.11-isolated-tomllib', inheritedHome: env.HOME, inheritedCodexHome: configHome };
}
