// One authored browser packet and a failed injected turn. No model process is spawned.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { preparePacket, validatePacket, digest, DECLARATION_DIGEST } from './launch-packet.mjs';
import { runExperiment, executionCommand } from './run-packet.mjs';
import { createCodexTransport, disposePacketTransport } from './codex-transport.mjs';
import { fakeCodex, CODEX_ID } from './fake-codex.mjs';
import { REQUEST_CONTRACT } from './scenario.mjs';
import { completionUsage } from './usage.mjs';

const runId = '11111111-2222-4333-8444-555555555555';
const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const read = (root, name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const reported = { input_tokens: 100, cached_input_tokens: 80, output_tokens: 20, reasoning_output_tokens: 5 };
const completion = (usage) => ({ type: 'turn.completed', usage });
const byTurn = [
  [completion({ ...reported, future_counter: 7 })],
  [completion(reported)], // Deliberately repeated cumulative-shaped counters: no aggregation.
  [{ type: 'turn.completed' }],
  [completion({ ...reported, input_tokens: -1 })],
  [completion(reported), completion(reported)],
];
const scenario = {
  request: 'Use a single-column Layout without a Card. Give the name and topic fields concise labels and the review button the label Review details. Keep the permitted host fields and summaries.',
  input: { draft: { name: '민지', topic: '커피' } },
  edits: ['Tea 차 두 잔', 'Hot tea 따뜻한 차'], actions: ['review', 'edit', 'review', 'confirm'],
};
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'private-render-usage-'));
  const packet = preparePacket({ candidateSha, cliPath: '/authored/never-executed', nodeBin: '/authored/bin', root });
  const experiment = { version: 'browser-packet-v1', candidateSha, packet, packetDigest: validatePacket(packet),
    declarationsDigest: DECLARATION_DIGEST, runId, command: executionCommand(root), scenario,
    runnerDigest: digest(fs.readFileSync(new URL('./run-packet.mjs', import.meta.url), 'utf8')) };
  const approval = { kind: 'fake-test', candidateSha, packetDigest: experiment.packetDigest, declarationsDigest: DECLARATION_DIGEST,
    experimentDigest: digest(experiment), runId };
  return { root, packet, experiment, approval };
}
function privateModes(root) {
  assert.equal(fs.statSync(root).mode & 0o777, 0o700);
  for (const name of fs.readdirSync(root)) {
    const info = fs.statSync(path.join(root, name));
    assert.equal(info.mode & 0o777, info.isDirectory() ? 0o700 : 0o600, name);
  }
}

const f = fixture();
try {
  const fake = fakeCodex({ completionEvents: (number) => byTurn[number - 1] });
  const result = await runExperiment(f.experiment, { approval: f.approval, spawnProcess: fake.spawnProcess });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.counts, { reserved: 5, attempted: 5, completed: 5, accepted: 5, useful: 5 });
  assert.equal(fake.calls.length, 5);
  const report = read(f.root, 'report.json');
  assert.equal(report.mode, 'codex-cli-fake');
  assert.equal(report.latency.liveModelEvidence, false);
  for (const field of ['errors', 'csp', 'external']) assert.deepEqual(report[field], []);
  assert.deepEqual(report.usage.turns.map((turn) => turn.status), ['reported', 'reported', 'missing', 'malformed', 'ambiguous']);
  assert.equal(report.usage.tokenTotals, null);
  assert.equal(report.usage.billedCost.amount, null);
  assert.equal(report.usage.billedCost.currency, null);
  assert.equal(report.usage.billedCost.status, 'unavailable');
  assert.equal(report.usage.counterScope, 'unverified');
  assert.equal(report.runId, runId); assert.equal(report.candidateSha, candidateSha);
  assert.equal(report.packetDigest, f.experiment.packetDigest); assert.equal(report.declarationsDigest, DECLARATION_DIGEST);
  for (const [index, row] of report.usage.turns.entries()) {
    const reservation = read(f.root, `turn-${index + 1}-reservation.json`);
    const turn = read(f.root, `turn-${index + 1}-result.json`);
    assert.deepEqual(turn.usage, row);
    assert.equal(turn.candidateSha, report.candidateSha);
    assert.equal(turn.packetDigest, report.packetDigest); assert.equal(turn.declarationsDigest, report.declarationsDigest);
    assert.equal(row.reservation, reservation.number); assert.equal(row.runId, report.runId);
    assert.equal(row.hostSessionId, reservation.request.sessionId); assert.equal(row.revision, reservation.request.revision);
    assert.equal(row.requestId, reservation.request.requestId); assert.equal(row.codexThreadId, CODEX_ID);
    assert.equal(row.source, 'injected-process'); assert.equal(row.counterScope, 'unverified');
    const display = report.displays[index];
    assert.equal(display.browser.observation.requestId, row.requestId);
    assert.equal(display.state.observation.requestId, row.requestId);
    const raw = fs.readFileSync(path.join(f.root, `turn-${index + 1}-stdout.jsonl`), 'utf8');
    const events = raw.trim().split('\n').map((line) => JSON.parse(line));
    const finalText = fs.readFileSync(path.join(f.root, `turn-${index + 1}-final.txt`), 'utf8').replace(/\r?\n$/, '');
    const expectedEvents = [{ type: 'thread.started', thread_id: CODEX_ID }, { type: 'turn.started' },
      { type: 'item.completed', item: { type: 'agent_message', text: finalText } }, ...byTurn[index]];
    assert.equal(raw, expectedEvents.map((event) => JSON.stringify(event)).join('\n') + '\n');
    assert.deepEqual(events.filter((event) => event.type === 'turn.completed'), byTurn[index]);
    assert.equal(row.completionEventCount, byTurn[index].length);
    if ([1, 3, 4].includes(index)) assert.equal(raw.includes('민지'), true);
    if (index < 2) assert.deepEqual(row.reportedCounters, reported);
    else assert.equal(row.reportedCounters, null);
    assert.equal(fake.calls[index].file, '/authored/never-executed');
  }
  assert.equal(report.terminalHostState.input.draft.name, '민지');
  assert.equal(report.terminalHostState.input.draft.topic, 'Hot tea 따뜻한 차');
  assert.equal(Object.hasOwn(result, 'usage'), false); // Public CLI result stays free of private telemetry.
  assert.equal(JSON.stringify(report.displays).includes(CODEX_ID), false);
  assert.equal(JSON.stringify(report.displays).includes('reportedCounters'), false);
  privateModes(f.root);
} finally { fs.rmSync(f.root, { recursive: true, force: true }); }

const failed = fixture();
let generate;
try {
  const fake = fakeCodex({ invalidJSON: true, completionEvents: () => [completion(reported)] });
  generate = createCodexTransport({ packet: failed.packet, approval: failed.approval, spawnProcess: fake.spawnProcess });
  await assert.rejects(generate({ kind: 'initial', sessionId: runId, revision: 0, requestId: `${runId}:1`, action: null,
    target: 'form', input: scenario.input, screenRequest: scenario.request, contract: REQUEST_CONTRACT }), /turn failed/);
  const turn = read(failed.root, 'turn-1-result.json');
  assert.equal(turn.completed, 1); assert.equal(turn.accepted, 0); assert.equal(turn.reason, 'turn-failed');
  assert.equal(turn.usage.status, 'reported'); assert.deepEqual(turn.usage.reportedCounters, reported);
  assert.equal(fake.calls.length, 1); privateModes(failed.root);
} finally { disposePacketTransport(generate); fs.rmSync(failed.root, { recursive: true, force: true }); }

assert.equal(completionUsage(0).status, 'no-completion');
assert.equal(completionUsage(1, null).status, 'missing');
for (const usage of [[], {}, { ...reported, output_tokens: 1.5 }, { ...reported, cached_input_tokens: '80' },
  { ...reported, reasoning_output_tokens: null }, { ...reported, input_tokens: Number.MAX_SAFE_INTEGER + 1 }])
  assert.equal(completionUsage(1, usage).status, 'malformed');
const { reasoning_output_tokens, ...withoutReasoning } = reported;
assert.equal(completionUsage(1, withoutReasoning).reportedCounters.reasoning_output_tokens, null);
console.log(JSON.stringify({ status: 'passed', evidence: 'authored injected processes; zero model calls', displays: 5,
  usageStatuses: ['reported', 'reported', 'missing', 'malformed', 'ambiguous'], rejectedScreenUsageRetained: true,
  tokenTotals: null, billedCost: null }));
