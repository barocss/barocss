import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { buildCurrentHostArgv } from './current-host-profile.mjs';

const privateRoot = '/Users/user/.barocss-ai/v3';

// Source-contract simulation (L2), not a native CLI execution result.
// Pinned sources: https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/config/src/overrides.rs
// https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/config/src/merge.rs
// overrides.rs splits the path at literal dots; merge.rs merges tables recursively.
function recursiveMerge(target, overlay) {
  for (const [key, value] of Object.entries(overlay)) {
    if (value && typeof value === 'object' && !Array.isArray(value)
      && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      recursiveMerge(target[key], value);
    } else target[key] = structuredClone(value);
  }
  return target;
}

function applyOverride(config, raw) {
  const equal = raw.indexOf('=');
  assert(equal > 0, `missing value in ${raw}`);
  const path = raw.slice(0, equal).split('.');
  const value = raw.slice(equal + 1) === 'false' ? false
    : raw.slice(equal + 1) === '{}' ? {} : undefined;
  assert.notEqual(value, undefined, `unsupported authored override value: ${raw}`);
  let overlay = value;
  for (let index = path.length - 1; index >= 0; index--) overlay = { [path[index]]: overlay };
  return recursiveMerge(config, overlay);
}

function mcpOverrides(argv) {
  const values = [];
  for (let index = 0; index < argv.length - 1; index++) {
    if (argv[index] === '-c' && argv[index + 1].startsWith('mcp_servers')) values.push(argv[index + 1]);
  }
  return values;
}

function inheritedRegistrations() {
  return { mcp_servers: {
    'local-cli': { command: '/private/example/server', args: ['--stdio'], enabled: true },
    local_http: { url: 'http://127.0.0.1:34567/mcp', enabled: true },
  } };
}

test('generated overrides disable the original safe-name registrations without changing transport', () => {
  const scratch = `${privateRoot}/agent-scratch-462-native-${randomUUID()}`;
  fs.mkdirSync(scratch, { mode: 0o700 });
  try {
    const argv = buildCurrentHostArgv({ cwd: scratch, inspection: {
      fingerprintSha256: 'a'.repeat(64), mcpNames: ['local-cli', 'local_http'],
    } });
    const overrides = mcpOverrides(argv);
    assert.deepEqual(overrides, ['mcp_servers={}',
      'mcp_servers.local-cli.enabled=false', 'mcp_servers.local_http.enabled=false']);
    const original = inheritedRegistrations();
    const effective = structuredClone(original);
    for (const override of overrides) applyOverride(effective, override);
    assert.deepEqual(Object.keys(effective.mcp_servers).sort(), ['local-cli', 'local_http']);
    assert.deepEqual(effective.mcp_servers['local-cli'], {
      command: original.mcp_servers['local-cli'].command,
      args: original.mcp_servers['local-cli'].args,
      enabled: false,
    });
    assert.deepEqual(effective.mcp_servers.local_http, {
      url: original.mcp_servers.local_http.url,
      enabled: false,
    });
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

test('old TOML-quoted override path creates a phantom registration under literal split', () => {
  const original = inheritedRegistrations();
  const effective = structuredClone(original);
  for (const raw of ['mcp_servers={}', 'mcp_servers."local-cli".enabled=false',
    'mcp_servers."local_http".enabled=false']) applyOverride(effective, raw);
  assert.equal(effective.mcp_servers['local-cli'].enabled, true);
  assert.equal(effective.mcp_servers.local_http.enabled, true);
  assert.deepEqual(effective.mcp_servers['"local-cli"'], { enabled: false });
  assert.deepEqual(effective.mcp_servers['"local_http"'], { enabled: false });
  assert.equal(effective.mcp_servers['"local-cli"'].command, undefined);
  assert.equal(effective.mcp_servers['"local_http"'].url, undefined);
  assert.deepEqual(Object.keys(effective.mcp_servers).sort(),
    ['"local-cli"', '"local_http"', 'local-cli', 'local_http']);
});
