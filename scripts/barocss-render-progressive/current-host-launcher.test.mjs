import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runExperiment } from './launcher.mjs';
import { inspectCurrentHost } from './current-host-profile.mjs';
import { verifyCurrentHostPlan } from './current-host-gate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const privateRoot = '/Users/user/.barocss-ai/v3';
const node = '/Users/user/Library/pnpm/nodejs/22.19.0/bin/node';
const candidateCommit = 'a'.repeat(40);
const sha = (value) => createHash('sha256').update(value).digest('hex');

function fixture() {
  const unique = randomUUID();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-464-launcher-'));
  fs.mkdirSync(path.join(home, '.codex'));
  const config = path.join(home, '.codex/config.toml');
  fs.writeFileSync(config, '[mcp_servers."fixture_local"]\ncommand="never executed"\n');
  const hostOptions = { env: { HOME: home }, cwd: home };
  const inspection = inspectCurrentHost(hostOptions);
  const verified = verifyCurrentHostPlan();
  const ownerApprovalReference = `authored-464-${unique}`;
  const decisionFile = path.join(privateRoot, `private-464-current-host-decision-test-${unique}.json`);
  fs.writeFileSync(decisionFile, JSON.stringify({ kind: 'barocss-464-current-host-decision-v1',
    issue: 464, mode: 'owner-approved-current-host', decision: 'GO', candidateCommit,
    planSha256: verified.planSha256, runProfileSha256: verified.runProfileSha256,
    hostFingerprintSha256: inspection.fingerprintSha256, maxNewTurns: 4,
    ownerApprovalReference, reviewAcceptReference: `authored-review-${unique}` }), { flag: 'wx', mode: 0o600 });
  const resultDir = path.join(privateRoot, `private-464-launcher-test-${unique}`);
  const scratch = path.join(privateRoot, `agent-scratch-462-${path.basename(resultDir)}`);
  const reservationDir = path.join(privateRoot, `private-464-current-host-reservations-${sha(
    `${ownerApprovalReference}\0${candidateCommit}\0${verified.planSha256}`)}`);
  const state = { decisionFile, resultDir, reservationDir, hostOptions, config, launches: 0 };
  state.options = (fakeMode, extras = {}) => ({ decisionFile, resultDir, candidateCommit,
    mode: 'owner-approved-current-host', hostOptions, source: 'authored-fake',
    timeouts: { turn: 1000, request: 1000, whole: 10000 },
    processFactory: ({ cwd, argv }) => {
      state.launches++;
      assert.equal(cwd, scratch);
      assert(argv.includes('mcp_servers.fixture_local.enabled=false'));
      assert(fs.existsSync(path.join(reservationDir, '1-01-initial.json')),
        'uncertain initialization is charged before spawn');
      return spawn(node, [path.join(here, 'fake-app-server.mjs')], {
        cwd, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, BAROCSS_FAKE_CODEX_HOME: path.join(home, '.codex'),
          BAROCSS_FAKE_MODE: fakeMode, BAROCSS_FAKE_LEDGER: reservationDir },
      });
    },
    browserFactory: async () => ({
      async start(value) { this.ids = value.ids; },
      async event() { return { ok: true }; },
      async baseline() { return { equal: true }; },
      async save({ name, revision }) { return { action: 'save', name, revision, ...this.ids }; },
      async close() {},
    }), ...extras });
  state.cleanup = () => {
    fs.rmSync(decisionFile, { force: true });
    for (const dir of [resultDir, scratch, reservationDir, home]) fs.rmSync(dir, { recursive: true, force: true });
  };
  return state;
}

test('current-host mode consumes exactly four ordered reservations with two authored sessions', async () => {
  const state = fixture();
  try {
    const report = await runExperiment(state.options('success'));
    assert.equal(report.status, 'completed');
    assert.equal(report.modelTurnsReserved, 4);
    assert.equal(report.sessions.length, 2);
    assert.equal(report.turns.length, 4);
    assert.equal(state.launches, 1);
    assert.equal(report.mode, 'owner-approved-current-host');
    assert.match(report.hostFingerprintSha256, /^[0-9a-f]{64}$/);
    assert(report.startupLimits.some((value) => value.includes('not proof')));
  } finally { state.cleanup(); }
});

test('current-host uncertainty and metadata mismatch consume one reservation without retry', async (t) => {
  for (const mode of ['wrong-model', 'missing-effort', 'tool', 'spawn-failure']) await t.test(mode, async () => {
    const state = fixture();
    try {
      const options = state.options(mode, mode === 'spawn-failure' ? { processFactory() {
        state.launches++; throw new Error('Authored uncertain start');
      } } : {});
      await assert.rejects(runExperiment(options));
      const report = JSON.parse(fs.readFileSync(path.join(state.resultDir, 'report.json')));
      assert.equal(report.status, 'failed');
      assert.equal(report.modelTurnsReserved, 1);
      assert.equal(report.turns.length, 0);
      assert.equal(state.launches, 1);
      await assert.rejects(runExperiment({ ...options,
        resultDir: `${state.resultDir}-again` }), /allowance was already used/);
      assert.equal(state.launches, 1);
    } finally { state.cleanup(); }
  });
});

test('configuration drift before spawn stops without a native process or reservation', async () => {
  const state = fixture();
  try {
    await assert.rejects(runExperiment(state.options('success', { browserFactory: async () => {
      fs.appendFileSync(state.config, '\n# authored drift\n');
      return { async close() {} };
    } })), /inventory drift/);
    const report = JSON.parse(fs.readFileSync(path.join(state.resultDir, 'report.json')));
    assert.equal(report.modelTurnsReserved, 0);
    assert.equal(state.launches, 0);
  } finally { state.cleanup(); }
});

test('configuration drift between turns preserves the first result and prevents the second dispatch', async () => {
  const state = fixture();
  try {
    const options = state.options('success');
    const makeBrowser = options.browserFactory;
    options.browserFactory = async () => {
      const browser = await makeBrowser();
      browser.baseline = async () => {
        fs.appendFileSync(state.config, '\n# authored drift after turn\n');
        return { equal: true };
      };
      return browser;
    };
    await assert.rejects(runExperiment(options), /inventory drift/);
    const report = JSON.parse(fs.readFileSync(path.join(state.resultDir, 'report.json')));
    assert.equal(report.modelTurnsReserved, 1);
    assert.equal(report.turns.length, 1);
    assert.equal(state.launches, 1);
  } finally { state.cleanup(); }
});

test('second-session RPC, timeout and metadata failures retain the third reservation', async (t) => {
  for (const mode of ['second-session-rpc-error', 'second-session-timeout', 'second-session-wrong-model']) {
    await t.test(mode, async () => {
      const state = fixture();
      try {
        await assert.rejects(runExperiment(state.options(mode)));
        const report = JSON.parse(fs.readFileSync(path.join(state.resultDir, 'report.json')));
        assert.equal(report.status, 'failed');
        assert.equal(report.modelTurnsReserved, 3);
        assert.equal(report.turns.length, 2);
        assert.equal(state.launches, 1);
        assert.deepEqual(fs.readdirSync(state.reservationDir).filter((name) => /^[1-4]-/.test(name)).sort(),
          ['1-01-initial.json', '2-01-next.json', '3-03-initial.json']);
        const requests = fs.readFileSync(path.join(state.resultDir, 'requests.jsonl'), 'utf8')
          .trim().split('\n').map(JSON.parse);
        assert.equal(requests.filter((request) => request.method === 'turn/start').length, 2,
          'third turn must not be dispatched after failed session start');
        assert.equal(requests.filter((request) => request.method === 'thread/start').length, 2);
        await assert.rejects(runExperiment({ ...state.options(mode),
          resultDir: `${state.resultDir}-again` }), /allowance was already used/);
        assert.equal(state.launches, 1);
      } finally { state.cleanup(); }
    });
  }
});

test('unsupported native key names stop before launch claim, reservation or process', async () => {
  const state = fixture();
  try {
    fs.writeFileSync(state.config, '[mcp_servers."unsupported.name"]\ncommand="never executed"\n');
    await assert.rejects(runExperiment(state.options('success')), /pinned CLI key syntax/);
    assert.equal(state.launches, 0);
    assert.equal(fs.existsSync(state.reservationDir), false);
    assert.equal(fs.existsSync(state.resultDir), false);
  } finally { state.cleanup(); }
});

// Source-shaped authored rate notices; no account read, Codex process or model request.
test('rate metadata around model events/completion is inert and preserves four reservations', async () => {
  const state = fixture();
  try {
    const options = state.options('rate-metadata');
    const factory = options.browserFactory;
    const delivered = [];
    options.browserFactory = async () => {
      const browser = await factory();
      browser.event = async ({ line }) => { delivered.push(JSON.parse(line).method); return { ok: true }; };
      return browser;
    };
    const report = await runExperiment(options);
    assert.equal(report.status, 'completed');
    assert.equal(report.modelTurnsReserved, 4);
    assert.equal(report.sessions.length, 2);
    assert.equal(report.turns.length, 4);
    assert.equal(state.launches, 1);
    assert.equal(delivered.includes('account/rateLimits/updated'), false);
    assert.equal(delivered.filter((method) => method === 'turn/completed').length, 4);
    const events = fs.readFileSync(path.join(state.resultDir, 'events.jsonl'), 'utf8')
      .trim().split('\n').map(JSON.parse);
    assert.equal(events.filter((record) => record.event.method === 'account/rateLimits/updated').length, 16);
  } finally { state.cleanup(); }
});

test('invalid, identity-bearing, server-request and excessive rate updates stop after one fake reservation', async (t) => {
  for (const mode of ['rate-malformed', 'rate-unowned', 'rate-request', 'rate-overflow',
    'rate-tool', 'rate-wrong-id', 'rate-unknown']) {
    await t.test(mode, async () => {
      const state = fixture();
      try {
        await assert.rejects(runExperiment(state.options(mode)));
        const report = JSON.parse(fs.readFileSync(path.join(state.resultDir, 'report.json')));
        assert.equal(report.modelTurnsReserved, 1);
        assert.equal(report.turns.length, 0);
        assert.equal(state.launches, 1);
        const requests = fs.readFileSync(path.join(state.resultDir, 'requests.jsonl'), 'utf8')
          .trim().split('\n').map(JSON.parse);
        assert.equal(requests.filter((request) => request.method === 'turn/start').length, 1);
      } finally { state.cleanup(); }
    });
  }
});
