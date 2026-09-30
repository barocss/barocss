import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertLocalConfiguration } from './launch-profile.mjs';
import { inspectCurrentHost, verifyCurrentHost, buildCurrentHostArgv } from './current-host-profile.mjs';

const privateRoot = '/Users/user/.barocss-ai/v3';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-current-host-'));
  const home = path.join(root, 'home');
  const configHome = path.join(home, '.codex');
  const cwd = path.join(home, 'project');
  fs.mkdirSync(configHome, { recursive: true });
  fs.mkdirSync(cwd);
  const config = path.join(configHome, 'config.toml');
  fs.writeFileSync(config, `model="gpt-6.1-sol"\nnotify=["private command"]\n
[mcp_servers.local_test]\ncommand="private command"\n
[hooks]\nSessionStart=[]\n
[marketplaces.bundled]\nsource="private source"\n
[plugins."x@bundled"]\nenabled=true\n`);
  fs.writeFileSync(path.join(configHome, 'hooks.json'), '{"private":"value"}\n');
  const pluginDir = path.join(configHome, 'plugins/cache/example');
  fs.mkdirSync(pluginDir, { recursive: true });
  const manifest = path.join(pluginDir, 'plugin.json');
  fs.writeFileSync(manifest, '{"name":"fixture"}\n');
  const env = { HOME: home, PATH: process.env.PATH };
  return { root, home, configHome, cwd, config, manifest, env,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('opt-in inventory is private, stable, and rejects ancillary drift while default guard remains strict', () => {
  const f = fixture();
  const inventoryFile = path.join(privateRoot, `private-464-test-${randomUUID()}.json`);
  const scratch = fs.mkdtempSync(path.join(privateRoot, 'agent-scratch-462-current-host-'));
  try {
    assert.throws(() => assertLocalConfiguration({ env: f.env, cwd: f.cwd }), /prohibited settings/);
    const inspected = inspectCurrentHost({ env: f.env, cwd: f.cwd, inventoryFile });
    assert.match(inspected.fingerprintSha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(inspected.mcpNames, ['local_test']);
    assert(inspected.inspected.registrationCount >= 4);
    assert.equal(fs.statSync(inventoryFile).mode & 0o077, 0);
    const inventory = fs.readFileSync(inventoryFile, 'utf8');
    assert.equal(inventory.includes('private command'), false);
    assert.equal(inventory.includes('private source'), false);
    assert.equal(inventory.includes('private":"value'), false);
    assert.equal(verifyCurrentHost({ expectedFingerprintSha256: inspected.fingerprintSha256,
      env: f.env, cwd: f.cwd }).fingerprintSha256, inspected.fingerprintSha256);
    fs.writeFileSync(path.join(scratch, 'schema.json'), '{}\n');
    const argv = buildCurrentHostArgv({ cwd: scratch, inspection: inspected });
    assert(argv.includes('mcp_servers.local_test.enabled=false'));
    assert(argv.includes('mcp_servers={}'));
    assert(argv.includes('notify=[]'));
    for (const feature of ['hooks', 'plugins', 'remote_plugin']) {
      const index = argv.indexOf(feature);
      assert(index > 0 && argv[index - 1] === '--disable');
    }
    fs.writeFileSync(f.manifest, '{"name":"changed"}\n');
    assert.throws(() => verifyCurrentHost({ expectedFingerprintSha256: inspected.fingerprintSha256,
      env: f.env, cwd: f.cwd }), /inventory drift/);
    fs.writeFileSync(f.manifest, '{"name":"fixture"}\n');
    fs.writeFileSync(path.join(f.configHome, 'hooks.json'), '{"private":"changed"}\n');
    assert.throws(() => verifyCurrentHost({ expectedFingerprintSha256: inspected.fingerprintSha256,
      env: f.env, cwd: f.cwd }), /inventory drift/);
  } finally {
    fs.rmSync(inventoryFile, { force: true });
    fs.rmSync(scratch, { recursive: true, force: true });
    f.cleanup();
  }
});

test('opt-in rejects unapproved provider, instructions, features, credentials, and ancestor config', () => {
  const f = fixture();
  try {
    for (const [extra, expected] of [
      ['\nmodel_provider="custom"\n', /Custom model provider/],
      ['\nmodel_instructions_file="private.txt"\n', /outside approval/],
      ['\n[features]\nshell_tool=true\n', /feature or tool/],
      ['\n[tools]\nupdate_plan=true\n', /feature or tool/],
    ]) {
      const base = fs.readFileSync(f.config, 'utf8');
      fs.writeFileSync(f.config, `model="gpt-6.1-sol"\n${extra}`);
      assert.throws(() => inspectCurrentHost({ env: f.env, cwd: f.cwd }), expected);
      fs.writeFileSync(f.config, base);
    }
    assert.throws(() => inspectCurrentHost({ env: { ...f.env, OPENAI_API_KEY: 'private-secret' },
      cwd: f.cwd }), (error) => /environment override/.test(error.message)
        && !error.message.includes('private-secret'));
    fs.writeFileSync(f.config, 'model="gpt-6.1-sol"\n[marketplaces.external]\nsource_type="local"\nsource="/tmp"\n');
    assert.throws(() => inspectCurrentHost({ env: f.env, cwd: f.cwd }), /Uninventoried local marketplace/);
    fs.writeFileSync(f.config, 'model="gpt-6.1-sol"\n');
    const ancestor = path.join(f.home, '.agents/plugins');
    fs.mkdirSync(ancestor, { recursive: true });
    fs.writeFileSync(path.join(ancestor, 'marketplace.json'), '{}\n');
    const inspected = inspectCurrentHost({ env: f.env, cwd: f.cwd });
    assert(inspected.inspected.registrationCount >= 5);
    const projectConfig = path.join(f.cwd, '.codex/config.toml');
    fs.mkdirSync(path.dirname(projectConfig));
    fs.writeFileSync(projectConfig, 'model="gpt-6.1-sol"\n');
    assert.throws(() => inspectCurrentHost({ env: f.env, cwd: f.cwd }), /Ancestor project/);
  } finally { f.cleanup(); }
});

test('MCP names outside the pinned CLI literal path syntax stop at inspection and argv construction', () => {
  const f = fixture();
  try {
    for (const name of ['local.test', 'quoted"name', 'white space', 'semi;colon',
      'control\nname', '']) {
      fs.writeFileSync(f.config, `model="gpt-6.1-sol"\n[mcp_servers.${JSON.stringify(name)}]\ncommand="fixture"\n`);
      assert.throws(() => inspectCurrentHost({ env: f.env, cwd: f.cwd }),
        /MCP name cannot be addressed/, `inspection accepted ${JSON.stringify(name)}`);
      assert.throws(() => buildCurrentHostArgv({ cwd: f.cwd, inspection: {
        fingerprintSha256: 'a'.repeat(64), mcpNames: [name],
      } }), /Verified current-host inspection is required/,
      `argv construction accepted ${JSON.stringify(name)}`);
    }
  } finally { f.cleanup(); }
});
