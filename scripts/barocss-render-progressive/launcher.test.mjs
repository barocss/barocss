import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runExperiment } from './launcher.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = '/Users/user/.barocss-ai/v3';
const planFile = path.join(here, 'frozen-plan.json');
const fakeFile = path.join(here, 'fake-app-server.mjs');
const node = '/Users/user/Library/pnpm/nodejs/22.19.0/bin/node';
const candidateCommit = 'a'.repeat(40);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const timeouts = { turn: 1_000, request: 1_000, whole: 10_000 };
const shortTimeouts = { turn: 100, request: 2_000, whole: 5_000 };
const assetRoots = {
  repoDepsRoot: process.env.REPO_DEPS_ROOT ?? '/Users/user/.barocss-ai/v3/integration',
  jrRoot: process.env.JR_ROOT ?? '/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr',
  pwDir: process.env.PW_DIR ?? '/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core',
};

function setup() {
  const unique = randomUUID();
  const ownerApprovalReference = `test-only-462-${unique}`;
  const planSha256 = sha(fs.readFileSync(planFile));
  const decisionFile = path.join(root, `private-461-live-decision-test-${unique}.json`);
  const copiedDecisionFile = path.join(root, `private-461-live-decision-test-copy-${unique}.json`);
  const resultDir = path.join(root, `private-462-test-${unique}`);
  const scratch = path.join(root, `agent-scratch-462-${path.basename(resultDir)}`);
  const reservationDir = path.join(root, `private-461-live-reservations-${sha(
    `${ownerApprovalReference}\0${candidateCommit}\0${planSha256}`)}`);
  const decision = { kind: 'barocss-461-live-decision-v1', issue: 461,
    launcherIssue: 462, decision: 'GO', candidateCommit, planSha256,
    maxNewTurns: 4, ownerApprovalReference, reviewAcceptReference: `test-only-${unique}` };
  fs.writeFileSync(decisionFile, JSON.stringify(decision), { flag: 'wx', mode: 0o600 });
  return {
    decisionFile, copiedDecisionFile, resultDir, scratch, reservationDir,
    cleanup() {
      for (const file of [decisionFile, copiedDecisionFile]) fs.rmSync(file, { force: true });
      for (const dir of [resultDir, scratch, reservationDir]) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

function fakeBrowserFactory(records) {
  return async () => {
    const browser = {
      started: null,
      async start(value) { this.started = value; records.starts.push(value); },
      async event({ line, processId, elapsedMs }) {
        const event = JSON.parse(line);
        assert.equal(processId, this.started.ids.processId);
        records.events.push({ method: event.method, elapsedMs });
        return { ok: true };
      },
      async baseline(value) { records.baselines.push(value); return { ok: true, name: value.name }; },
      async save({ name, revision }) {
        const value = { action: 'save', name, revision,
          threadId: this.started.ids.threadId, turnId: this.started.ids.turnId };
        records.saves.push(value);
        return value;
      },
      async close() { records.closes++; },
    };
    return browser;
  };
}

function fakeProcessFactory(setupState, mode, records) {
  return ({ cwd, argv }) => {
    assert.equal(cwd, setupState.scratch);
    assert.deepEqual(argv.slice(0, 3), ['app-server', '--stdio', '--strict-config']);
    assert.equal(fs.existsSync(path.join(setupState.reservationDir, 'launch.json')), true,
      'launch claim must precede the child process');
    records.launches++;
    return spawn(node, [fakeFile], { cwd, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, BAROCSS_FAKE_MODE: mode,
        BAROCSS_FAKE_LEDGER: setupState.reservationDir } });
  };
}

function runOptions(state, mode, records, extras = {}) {
  return { decisionFile: state.decisionFile, candidateCommit, resultDir: state.resultDir,
    processFactory: fakeProcessFactory(state, mode, records),
    browserFactory: fakeBrowserFactory(records), source: 'authored-fake', timeouts, ...extras };
}

const records = () => ({ launches: 0, starts: [], events: [], baselines: [], saves: [], closes: 0 });

test('authored fake completes two independent threads and four reserved turns', async () => {
  const state = setup();
  const seen = records();
  try {
    const report = await runExperiment(runOptions(state, 'success', seen));
    assert.equal(report.status, 'completed');
    assert.equal(report.source, 'authored-fake');
    assert.equal(report.turns.length, 4);
    assert.equal(report.sessions.length, 2);
    assert.notEqual(report.sessions[0].threadId, report.sessions[1].threadId);
    assert.deepEqual(report.turns.map((turn) => [turn.rowId, turn.kind]),
      [['01', 'initial'], ['01', 'next'], ['03', 'initial'], ['03', 'next']]);
    assert.equal(report.turns[0].threadId, report.turns[1].threadId);
    assert.equal(report.turns[2].threadId, report.turns[3].threadId);
    assert.equal(report.turns.every((turn) => turn.final.status === 'completed'), true);
    assert.equal(seen.launches, 1);
    assert.equal(seen.starts.length, 4);
    assert.equal(seen.baselines.length, 4);
    assert.deepEqual(seen.baselines.map((entry) => entry.name), ['Bea', 'Bea', 'Zoë', 'Zoë']);
    assert.deepEqual(seen.saves.map((entry) => entry.name), ['Bea', 'Zoë']);
    assert.equal(seen.events.filter((entry) => entry.method === 'turn/completed').length, 4);
    assert.deepEqual(fs.readdirSync(state.reservationDir).filter((name) => /^[1-4]-/.test(name)).sort(),
      ['1-01-initial.json', '2-01-next.json', '3-03-initial.json', '4-03-next.json']);
    assert.equal(fs.existsSync(path.join(state.resultDir, 'report.json')), true);
    fs.copyFileSync(state.decisionFile, state.copiedDecisionFile);
    await assert.rejects(runExperiment({ ...runOptions(state, 'success', seen),
      decisionFile: state.copiedDecisionFile,
      resultDir: path.join(root, `private-462-test-copy-${path.basename(state.resultDir)}`) }),
    /Allowance was already used/);
    assert.equal(seen.launches, 1, 'copied approval must not spawn a second child');
  } finally { state.cleanup(); }
});

test('authored app-server stream reaches the installed Chromium observer for both rows', async () => {
  const state = setup();
  const seen = records();
  try {
    const report = await runExperiment(runOptions(state, 'success', seen, {
      browserFactory: undefined, assetRoots,
      timeouts: { turn: 10_000, request: 1_000, whole: 60_000 },
    }));
    assert.equal(report.status, 'completed');
    assert.equal(report.source, 'authored-fake');
    assert.equal(report.sessions.length, 2);
    assert.equal(report.turns.length, 4);
    assert.equal(report.turns.every((turn) => turn.baseline.equal === true), true);
    assert.equal(report.turns.every((turn) => turn.earlyUsefulPaint === false), true,
      'coalesced fake notifications are not evidence of an early paint');
    for (const folder of ['browser', 'browser-row-03']) {
      const browserDir = path.join(state.resultDir, folder);
      const browserReport = JSON.parse(fs.readFileSync(path.join(browserDir, 'report.json')));
      assert.equal(browserReport.modelCallsByHarness, 0);
      assert.equal(browserReport.baselines.length, 2);
      assert.equal(browserReport.baselines.every((baseline) => baseline.equal === true), true);
      assert.deepEqual(browserReport.networkErrors, []);
      assert.equal(browserReport.observations.length >= 4, true);
      for (const observation of browserReport.observations) {
        for (const screen of Object.values(observation.screens)) {
          assert.equal(screen.measurementComplete, true);
          assert.equal(fs.existsSync(path.join(browserDir, screen.screenshot)), true);
        }
      }
    }
  } finally { state.cleanup(); }
});

test('wrong model, identity drift, tool item, and malformed RPC fail without retry', async (t) => {
  const cases = [
    ['wrong-model', /Effective session settings/],
    ['wrong-id', /Notification identity drift/],
    ['tool', /Tool or invalid item/],
    ['malformed', /Malformed RPC JSON/],
  ];
  for (const [mode, error] of cases) await t.test(mode, async () => {
    const state = setup();
    const seen = records();
    try {
      await assert.rejects(runExperiment(runOptions(state, mode, seen)), error);
      assert.equal(seen.launches, 1);
      assert.equal(fs.existsSync(path.join(state.reservationDir, '1-01-initial.json')),
        mode !== 'wrong-model');
      assert.equal(JSON.parse(fs.readFileSync(path.join(state.resultDir, 'report.json'))).status, 'failed');
      if (mode === 'wrong-model') {
        fs.copyFileSync(state.decisionFile, state.copiedDecisionFile);
        await assert.rejects(runExperiment({ ...runOptions(state, mode, seen),
          decisionFile: state.copiedDecisionFile,
          resultDir: path.join(root, `private-462-test-copy-${path.basename(state.resultDir)}`) }),
        /EEXIST/);
        assert.equal(seen.launches, 1, 'one initialization claim cannot be retried');
        assert.equal(fs.existsSync(path.join(state.reservationDir, 'launch.json')), true);
      }
    } finally { state.cleanup(); }
  });
});

test('missing or changed effective thread metadata fails before any turn reservation', async (t) => {
  const modes = ['missing-effort', 'null-effort', 'wrong-effort',
    'missing-provider', 'wrong-provider', 'nested-wrong-provider',
    'missing-reviewer', 'wrong-reviewer',
    'null-sources', 'instruction-sources'];
  for (const mode of modes) await t.test(mode, async () => {
    const state = setup();
    const seen = records();
    try {
      await assert.rejects(runExperiment(runOptions(state, mode, seen)),
        /Effective session settings or identity differ/);
      assert.equal(seen.launches, 1);
      assert.equal(fs.existsSync(path.join(state.reservationDir, 'launch.json')), true);
      assert.deepEqual(fs.readdirSync(state.reservationDir).filter((name) => /^[1-4]-/.test(name)), []);
      const requests = fs.readFileSync(path.join(state.resultDir, 'requests.jsonl'), 'utf8')
        .trim().split('\n').map((line) => JSON.parse(line));
      assert.deepEqual(requests.map((request) => request.method), ['initialize', 'thread/start']);
      assert.equal(JSON.parse(fs.readFileSync(path.join(state.resultDir, 'report.json'))).status, 'failed');
      fs.copyFileSync(state.decisionFile, state.copiedDecisionFile);
      await assert.rejects(runExperiment({ ...runOptions(state, mode, seen),
        decisionFile: state.copiedDecisionFile,
        resultDir: path.join(root, `private-462-test-copy-${path.basename(state.resultDir)}`) }),
      /EEXIST/);
      assert.equal(seen.launches, 1, 'copied decision must not launch a second child');
    } finally { state.cleanup(); }
  });
});

test('missing decision and mismatched candidate never start a child', async (t) => {
  await t.test('missing decision', async () => {
    const state = setup();
    const seen = records();
    try {
      fs.rmSync(state.decisionFile);
      await assert.rejects(runExperiment(runOptions(state, 'success', seen)), /ENOENT/);
      assert.equal(seen.launches, 0);
      assert.equal(fs.existsSync(state.resultDir), false);
    } finally { state.cleanup(); }
  });
  await t.test('mismatched candidate', async () => {
    const state = setup();
    const seen = records();
    try {
      await assert.rejects(runExperiment(runOptions(state, 'success', seen,
        { candidateCommit: 'b'.repeat(40) })), /does not match/);
      assert.equal(seen.launches, 0);
      assert.equal(fs.existsSync(state.resultDir), false);
    } finally { state.cleanup(); }
  });
});

test('timeout and cancellation stop the authored fake without retry', async (t) => {
  for (const mode of ['timeout', 'cancel']) await t.test(mode, async () => {
    const state = setup();
    const seen = records();
    const controller = new AbortController();
    const timer = mode === 'cancel' ? setInterval(() => {
      if (fs.existsSync(path.join(state.reservationDir, '1-01-initial.json'))) controller.abort();
    }, 5) : null;
    try {
      await assert.rejects(runExperiment(runOptions(state, mode, seen,
        { signal: controller.signal, timeouts: mode === 'timeout' ? shortTimeouts : timeouts })),
      mode === 'timeout' ? /timeout/i : /cancel/i);
      assert.equal(seen.launches, 1);
      assert.equal(fs.existsSync(path.join(state.reservationDir, '1-01-initial.json')), true);
    } finally { clearInterval(timer); state.cleanup(); }
  });
});

test('known-turn timeout sends one interrupt after the reserved turn starts', async () => {
  const state = setup();
  const seen = records();
  try {
    await assert.rejects(runExperiment(runOptions(state, 'after-start-timeout', seen,
      { timeouts: shortTimeouts })),
      /Turn timeout; no retry/);
    const requests = fs.readFileSync(path.join(state.resultDir, 'requests.jsonl'), 'utf8')
      .trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(requests.map((request) => request.method),
      ['initialize', 'thread/start', 'turn/start', 'turn/interrupt']);
    assert.equal(seen.launches, 1);
    assert.equal(fs.existsSync(path.join(state.reservationDir, '1-01-initial.json')), true);
    assert.equal(fs.existsSync(path.join(state.resultDir, 'turn-1.json')), false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(state.resultDir, 'report.json'))).status, 'failed');
  } finally { state.cleanup(); }
});

// Authored no-model protocol-order tests. No native Codex process is launched.
test('schema defaults and bounded passive metadata preserve all four authored turns', async (t) => {
  for (const mode of ['schema-defaults', 'missing-sources', 'startup-metadata', 'startup-metadata-before-init',
    'startup-metadata-after-response']) {
    await t.test(mode, async () => {
      const state = setup(), seen = records();
      try {
        const report = await runExperiment(runOptions(state, mode, seen));
        assert.equal(report.turns.length, 4);
        assert.equal(report.modelTurnsReserved, 4);
        assert.equal(seen.launches, 1);
        assert.equal(seen.events.some((event) => ['account/updated', 'remoteControl/status/changed',
          'thread/status/changed'].includes(event.method)), false, 'metadata must not reach UI delivery');
      } finally { state.cleanup(); }
    });
  }
});

test('unsafe startup metadata stops before any authored turn dispatch', async (t) => {
  for (const mode of ['missing-init-home', 'startup-remote-active', 'startup-remote-malformed',
    'startup-account-drift', 'startup-unknown', 'startup-request', 'startup-unowned-status',
    'startup-active-status', 'startup-remote-drift', 'startup-metadata-overflow',
    'startup-duplicate-thread']) {
    await t.test(mode, async () => {
      const state = setup(), seen = records();
      try {
        await assert.rejects(runExperiment(runOptions(state, mode, seen)));
        const requests = fs.readFileSync(path.join(state.resultDir, 'requests.jsonl'), 'utf8')
          .trim().split('\n').map(JSON.parse);
        assert.equal(requests.some((request) => request.method === 'turn/start'), false);
        assert.equal(seen.starts.length, 0);
        assert.equal(seen.launches, 1);
      } finally { state.cleanup(); }
    });
  }
});
