// Owner-approved, current-Mac opt-in inventory. This never changes inherited config or auth.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { buildAppServerArgv } from './launch-profile.mjs';

const PRIVATE_ROOT = '/Users/user/.barocss-ai/v3';
const PYTHON = '/opt/homebrew/bin/python3.11';
const CODEX_SHIM = '/Users/user/Library/pnpm/nodejs/22.19.0/lib/node_modules/@openai/codex/bin/codex.js';
const CODEX_NATIVE = '/Users/user/Library/pnpm/nodejs/22.19.0/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex';
const MCP_NAME = /^[A-Za-z0-9_-]+$/;
const APPROVED = Object.freeze(['hooks', 'marketplaces', 'mcp_servers', 'notify', 'plugins']);
const BENIGN = new Set(['model', 'model_reasoning_effort', 'projects', 'tui', 'desktop', 'notice']);
const CREDENTIAL_ENV = /(?:^|_)(?:API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|AUTH_TOKEN|CLIENT_SECRET|IDENTITY_TOKEN(?:_FILE)?|CREDENTIALS_FILE)$/i;
const OVERRIDE_ENV = new Set(['OPENAI_BASE_URL', 'OPENAI_ORGANIZATION', 'OPENAI_PROJECT',
  'CODEX_AUTH_FILE', 'CODEX_PROFILE', 'CODEX_CONFIG', 'CODEX_CONFIG_FILE',
  'CODEX_MODEL_PROVIDER', 'CODEX_MODEL', 'CODEX_BASE_URL']);
const LIMITS = Object.freeze([
  'Local files only; managed and cloud policy remain authoritative and uninspected.',
  'Remote catalogs are not fetched or proven complete.',
  'Global disables and per-entry MCP controls are candidates, not proof of a tool-free startup.',
  'Unexpected runtime tool, server, hook, or external request must stop the live run.',
]);

const sha = (value) => createHash('sha256').update(value).digest('hex');
function fileSha(file) {
  const hash = createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(256 * 1024);
  try {
    let length;
    while ((length = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, length));
  } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}

const PARSE_CONFIG = String.raw`
import json, pathlib, sys, tomllib
try:
    data = tomllib.loads(sys.stdin.read())
except Exception:
    print(json.dumps({"parseError": True}))
    raise SystemExit(0)
if not isinstance(data, dict):
    print(json.dumps({"parseError": True}))
    raise SystemExit(0)
home = pathlib.Path(sys.argv[1]).resolve()
runtime_plugins = pathlib.Path(sys.argv[2]).resolve()
allowed_roots = [home / "plugins", home / ".tmp/plugins", home / ".tmp/marketplaces",
                 home / ".tmp/bundled-marketplaces", home / "cache/remote_plugin_catalog",
                 runtime_plugins]
unknown_local_source = False
bad_approved_shape = any(key in data and not isinstance(data[key], expected)
                         for key, expected in (("hooks", dict), ("marketplaces", dict),
                                               ("mcp_servers", dict), ("plugins", dict),
                                               ("notify", list)))
for marketplace in (data.get("marketplaces", {}) if isinstance(data.get("marketplaces", {}), dict) else {}).values():
    if not isinstance(marketplace, dict):
        unknown_local_source = True
        continue
    if marketplace.get("source_type") == "local":
        source = marketplace.get("source")
        if not isinstance(source, str) or not pathlib.Path(source).is_absolute():
            unknown_local_source = True
            continue
        resolved = pathlib.Path(source).resolve()
        if not resolved.exists() or not any(resolved == root or root in resolved.parents for root in allowed_roots):
            unknown_local_source = True
print(json.dumps({"parseError": False, "keys": sorted(data),
                  "mcpNames": sorted(data.get("mcp_servers", {})) if isinstance(data.get("mcp_servers", {}), dict) else None,
                  "customModelProvider": data.get("model_provider") not in (None, "openai"),
                  "badApprovedShape": bad_approved_shape,
                  "unknownLocalMarketplaceSource": unknown_local_source,
                  "featuresPresent": bool(data.get("features")),
                  "toolsPresent": bool(data.get("tools"))}))
`;

function parseConfig(file, configHome, runtimeRoot) {
  const source = fs.readFileSync(file, 'utf8');
  const parsed = spawnSync(PYTHON, ['-I', '-c', PARSE_CONFIG, configHome, runtimeRoot], {
    input: source, encoding: 'utf8', maxBuffer: 1_000_000, timeout: 5_000,
  });
  if (parsed.error || parsed.status !== 0 || !parsed.stdout) throw new Error('Pinned Python TOML parser unavailable');
  let result;
  try { result = JSON.parse(parsed.stdout); } catch { throw new Error('TOML inspection failed'); }
  if (result.parseError) throw new Error('Inherited config TOML cannot be parsed');
  return result;
}

function assertRegular(file) {
  if (!fs.lstatSync(file).isFile()) throw new Error('Local registration source is not a regular file');
}

function ancestors(cwd) {
  const result = [];
  let current = cwd;
  while (true) {
    result.push(current);
    const parent = path.dirname(current);
    if (parent === current) return result;
    current = parent;
  }
}

function registrationSources(configHome, runtimeRoot, cwd, userConfig) {
  const sources = [];
  const addFile = (file, kind) => {
    if (!fs.existsSync(file)) return;
    assertRegular(file);
    sources.push({ path: file, kind, sha256: fileSha(file) });
  };
  const roots = [
    path.join(configHome, 'plugins'),
    path.join(configHome, '.tmp/plugins'),
    path.join(configHome, '.tmp/marketplaces'),
    path.join(configHome, '.tmp/bundled-marketplaces'),
    path.join(configHome, 'cache/remote_plugin_catalog'),
    path.join(configHome, 'cache/bundled_plugin_exclusions'),
    path.join(runtimeRoot, 'plugins'),
  ];
  const registrationFile = (name) => /\.(json|toml|ya?ml|sha)$/i.test(name)
    || ['plugin.json', 'marketplace.json', 'mcp.json', 'hooks.json'].includes(name);
  const walk = (root, current) => {
    for (const name of fs.readdirSync(current).sort()) {
      const file = path.join(current, name);
      const entry = fs.lstatSync(file);
      if (entry.isSymbolicLink()) {
        const target = fs.readlinkSync(file);
        const resolved = path.resolve(path.dirname(file), target);
        if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
          throw new Error('Registration symlink escapes its inventory root');
        }
        sources.push({ path: file, kind: 'symlink', sha256: sha(target) });
      } else if (entry.isDirectory()) {
        sources.push({ path: file, kind: 'directory', sha256: null });
        walk(root, file);
      } else if (entry.isFile()) {
        const sensitiveName = /^(?:\.npmrc|\.env(?:\..*)?|auth\.json|credentials\.json|token\.json)$/i.test(name);
        // Never read credential-shaped files. Their metadata still causes ordinary drift to stop.
        sources.push({ path: file, kind: sensitiveName ? 'unread-sensitive-name'
          : registrationFile(name) ? 'registration' : 'asset',
        sha256: sensitiveName ? sha(JSON.stringify({ size: entry.size, mtimeMs: entry.mtimeMs,
          ctimeMs: entry.ctimeMs })) : fileSha(file) });
      } else throw new Error('Unknown registration filesystem entry');
    }
  };
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    if (!fs.lstatSync(root).isDirectory()) throw new Error('Registration root is not a directory');
    sources.push({ path: root, kind: 'root', sha256: null });
    walk(root, root);
  }
  for (const file of [path.join(configHome, 'hooks.json'), path.join(configHome, 'browser/config.toml'),
    path.join(configHome, '.tmp/plugins.sha'), path.join(configHome, '.tmp/app-server-remote-plugin-sync-v1')]) {
    addFile(file, 'ancillary');
  }
  for (const parent of ancestors(cwd)) {
    const projectConfig = path.join(parent, '.codex/config.toml');
    if (projectConfig !== userConfig && fs.existsSync(projectConfig)) {
      throw new Error('Ancestor project Codex config requires separate review');
    }
    addFile(path.join(parent, '.codex/hooks.json'), 'ancestor-hooks');
    addFile(path.join(parent, '.agents/plugins/marketplace.json'), 'ancestor-marketplace');
  }
  return sources.sort((a, b) => a.path.localeCompare(b.path));
}

export function inspectCurrentHost({ env = process.env, cwd = process.cwd(), inventoryFile } = {}) {
  if (!env || typeof env !== 'object' || typeof env.HOME !== 'string' || !path.isAbsolute(env.HOME)
    || typeof cwd !== 'string' || !path.isAbsolute(cwd)
    || (env.CODEX_HOME !== undefined && (typeof env.CODEX_HOME !== 'string'
      || !path.isAbsolute(env.CODEX_HOME)))) throw new Error('Inherited HOME, CODEX_HOME and cwd must be absolute');
  const credentialKeys = Object.keys(env).filter((key) => typeof env[key] === 'string' && env[key]
    && (CREDENTIAL_ENV.test(key) || OVERRIDE_ENV.has(key)));
  if (credentialKeys.length) throw new Error(`Credential or routing environment override: ${credentialKeys.sort().join(', ')}`);
  for (const file of ['/etc/codex/config.toml', '/etc/codex/requirements.toml']) {
    if (fs.existsSync(file)) throw new Error('System Codex config requires separate review');
  }
  const configHome = env.CODEX_HOME ?? path.join(env.HOME, '.codex');
  const runtimeRoot = path.join(env.HOME, '.cache/codex-runtimes/codex-primary-runtime');
  const userConfig = path.join(configHome, 'config.toml');
  const configPresent = fs.existsSync(userConfig);
  if (configPresent) assertRegular(userConfig);
  const parsed = configPresent ? parseConfig(userConfig, configHome, path.join(runtimeRoot, 'plugins'))
    : { keys: [], mcpNames: [], customModelProvider: false, featuresPresent: false, toolsPresent: false };
  if (!Array.isArray(parsed.mcpNames)) throw new Error('MCP registration shape is unknown');
  // The pinned CLI splits the key at literal dots; it does not parse TOML quoted segments.
  // Reject unsupported names during inspection, before any claim or reservation.
  if (parsed.mcpNames.some((name) => typeof name !== 'string' || !MCP_NAME.test(name))) {
    throw new Error('MCP name cannot be addressed by the pinned CLI key syntax');
  }
  if (parsed.badApprovedShape) throw new Error('Approved inherited category has unknown shape');
  if (parsed.customModelProvider) throw new Error('Custom model provider is outside approval');
  if (parsed.unknownLocalMarketplaceSource) throw new Error('Uninventoried local marketplace source');
  if (parsed.featuresPresent || parsed.toolsPresent) throw new Error('Inherited feature or tool config is outside approval');
  const unknown = parsed.keys.filter((key) => !APPROVED.includes(key) && !BENIGN.has(key)
    && key !== 'model_provider');
  if (unknown.length) throw new Error(`Inherited config categories outside approval: ${unknown.join(', ')}`);
  const sources = registrationSources(configHome, runtimeRoot, cwd, userConfig);
  if (configPresent) sources.push({ path: userConfig, kind: 'user-config', sha256: fileSha(userConfig) });
  for (const file of [CODEX_SHIM, CODEX_NATIVE]) { assertRegular(file); sources.push({ path: file,
    kind: 'binary', sha256: fileSha(file) }); }
  sources.sort((a, b) => a.path.localeCompare(b.path));
  const fingerprintSha256 = sha(JSON.stringify({ cwd, home: env.HOME, codexHome: configHome,
    categories: parsed.keys, mcpNames: parsed.mcpNames, sources }));
  const result = { fingerprintSha256, mcpNames: parsed.mcpNames,
    inspected: { cwd, configHome, categories: parsed.keys,
      sourceCount: sources.length, registrationCount: sources.filter((item) =>
        ['registration', 'ancillary', 'ancestor-hooks', 'ancestor-marketplace', 'user-config'].includes(item.kind)).length,
      binarySha256: sources.find((item) => item.path === CODEX_NATIVE).sha256 },
    limits: [...LIMITS] };
  if (inventoryFile !== undefined) {
    if (typeof inventoryFile !== 'string' || !path.isAbsolute(inventoryFile)
      || path.dirname(inventoryFile) !== PRIVATE_ROOT
      || !/^private-464-[A-Za-z0-9_-]+\.json$/.test(path.basename(inventoryFile))) {
      throw new Error('Inventory file must be a fresh private #464 JSON path');
    }
    fs.writeFileSync(inventoryFile, JSON.stringify({ kind: 'barocss-current-host-inventory-v1',
      ...result, sources }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  return result;
}

export function verifyCurrentHost({ expectedFingerprintSha256, inventoryFile, ...options } = {}) {
  if (typeof expectedFingerprintSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(expectedFingerprintSha256)) {
    throw new Error('Expected current-host fingerprint is required');
  }
  if (inventoryFile !== undefined) throw new Error('Verification does not write an inventory file');
  const current = inspectCurrentHost(options);
  if (current.fingerprintSha256 !== expectedFingerprintSha256) throw new Error('Current-host inventory drift');
  return current;
}

export function buildCurrentHostArgv({ cwd, inspection } = {}) {
  if (!inspection || !/^[0-9a-f]{64}$/.test(inspection.fingerprintSha256)
    || !Array.isArray(inspection.mcpNames)
    || inspection.mcpNames.some((name) => typeof name !== 'string' || !MCP_NAME.test(name))
    || new Set(inspection.mcpNames).size !== inspection.mcpNames.length) {
    throw new Error('Verified current-host inspection is required');
  }
  const args = buildAppServerArgv({ cwd });
  for (const name of [...inspection.mcpNames].sort()) args.push('-c', `mcp_servers.${name}.enabled=false`);
  return args;
}
