import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREEN_DECLARATIONS } from './scenario.mjs';

export const digest = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const DECLARATION_DIGEST = digest(SCREEN_DECLARATIONS);
export const OUTER_SCHEMA = Object.freeze({ type: 'object', additionalProperties: false,
  properties: Object.freeze({ specJson: Object.freeze({ type: 'string' }) }), required: Object.freeze(['specJson']) });
export const DISABLED_FEATURES = Object.freeze(['apps', 'plugins', 'remote_plugin', 'browser_use', 'browser_use_external',
  'browser_use_full_cdp_access', 'computer_use', 'in_app_browser', 'code_mode_host', 'code_mode', 'multi_agent',
  'worktrees', 'hooks', 'skill_search', 'view_image', 'image_generation', 'standalone_web_search', 'tool_suggest',
  'goals', 'sleep_tool', 'deferred_executor']);

export function preparePacket({ candidateSha, cliPath, nodeBin, root, modelCatalogDigest }) {
  if (!/^[0-9a-f]{40}$/.test(candidateSha)) throw new Error('Candidate commit required');
  for (const value of [cliPath, nodeBin, root]) if (!path.isAbsolute(value ?? '')) throw new Error('Absolute host preparation paths required');
  if (modelCatalogDigest !== undefined && !/^[0-9a-f]{64}$/.test(modelCatalogDigest)) throw new Error('Model catalog digest required');
  return { version: modelCatalogDigest === undefined ? 'request-ui-packet-v1' : 'request-ui-packet-v2', status: 'prepared-not-approved', candidateSha,
    cli: { version: '0.156.1', model: 'gpt-6.1-sol', effort: 'high', cliPath, nodeBin },
    environment: { node: '22.19.0', pnpm: '9.15.4', react: '19.2.3', playwright: '1.60.0', chromium: '148.0.7778.96',
      auth: 'existing ChatGPT CLI auth in isolated Codex home; no API key route' },
    root, ...(modelCatalogDigest === undefined ? {} : { modelCatalogDigest }), declarationsDigest: DECLARATION_DIGEST, schemaDigest: digest(OUTER_SCHEMA),
    maxReservations: 5, perTurnTimeoutMs: 180_000, totalTimeoutMs: 900_000,
    maxEventBytes: 2_000_000, maxFinalBytes: 32_768, retries: 0,
    tools: 'none; stop any tool item', network: 'agent network disabled; only approved model service transport',
    scenario: ['initial form', 'review', 'edit form', 'corrected review', 'confirm'],
    stop: ['first failure', 'uncertain start', 'tool event', 'identity/model drift', 'invalid inner screen', 'cancel', 'timeout', 'reservation ceiling'],
  };
}

export function validatePacket(packet) {
  if (!packet || JSON.stringify(packet) !== JSON.stringify(preparePacket({ candidateSha: packet.candidateSha,
    cliPath: packet.cli?.cliPath, nodeBin: packet.cli?.nodeBin, root: packet.root, modelCatalogDigest: packet.modelCatalogDigest }))) throw new Error('Packet differs from the fixed preparation');
  return digest(packet);
}

export function buildArgv(packet, { codexId, finalPath }) {
  validatePacket(packet);
  if (codexId !== undefined && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(codexId)) throw new Error('Explicit Codex UUID required');
  const profile = 'baro-request-491';
  const common = ['--ignore-user-config', '--strict-config', '--skip-git-repo-check', '--model', packet.cli.model,
    '-c', `model_reasoning_effort="${packet.cli.effort}"`, '-c', 'mcp_servers={}',
    '-c', 'shell_environment_policy.inherit=none', '-c', 'suppress_unstable_features_warning=true',
    '-c', 'web_search="disabled"', '-c', 'approval_policy="on-request"', '-c', `default_permissions="${profile}"`,
    '-c', `permissions.${profile}.filesystem={":root"="deny", ":minimal"="read", ":tmpdir"="deny", ":slash_tmp"="deny", ":workspace_roots"={"."="read"}}`,
    '-c', `permissions.${profile}.network.enabled=false`, '--enable', 'skip_host_skill_discovery'];
  for (const feature of DISABLED_FEATURES) common.push('--disable', feature);
  const output = ['--json', '--output-schema', path.join(packet.root, 'schema.json'), '--output-last-message', finalPath];
  if (packet.modelCatalogDigest) common.push('-c', `model_catalog_json=${JSON.stringify(path.join(packet.root, 'model-catalog.json'))}`);
  return codexId ? ['exec', 'resume', ...common, ...output, codexId, '-']
    : ['exec', ...common, '--cd', path.join(packet.root, 'scratch'), ...output, '-'];
}

// Preparation only: help/version and local files. This entry cannot invoke exec without --help.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== '--dry-run') throw new Error('Use --dry-run PRIVATE_ROOT');
  const root = path.resolve(process.argv[3]);
  const cliPath = execFileSync('which', ['codex'], { encoding: 'utf8' }).trim();
  const version = execFileSync(cliPath, ['--version'], { encoding: 'utf8' }).trim();
  if (version !== 'codex-cli 0.156.1') throw new Error('CLI version changed; prepare a new packet');
  const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const packet = preparePacket({ candidateSha, cliPath, nodeBin: path.dirname(process.execPath), root });
  mkdirSync(root, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(root, 'packet.json'), JSON.stringify(packet, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
  for (const codexId of [undefined, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee']) {
    const argv = buildArgv(packet, { codexId, finalPath: path.join(root, 'final.txt') });
    execFileSync(cliPath, [...argv, '--help'], { stdio: 'pipe' });
  }
  console.log(JSON.stringify({ mode: 'preparation-only', candidateSha, packetDigest: validatePacket(packet), modelCalls: 0 }));
}
