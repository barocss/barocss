// One actual-browser terminal flow and bounded injected controls. No executable or model.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { preparePacket, validatePacket, digest, DECLARATION_DIGEST } from './launch-packet.mjs';
import { createCodexTransport, disposePacketTransport } from './codex-transport.mjs';
import { runExperiment, executionCommand } from './run-packet.mjs';
import { REQUEST_CONTRACT } from './scenario.mjs';

const runId = '11111111-2222-4333-8444-555555555555';
const codexId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const reported = { input_tokens: 100, cached_input_tokens: 80, output_tokens: 20 };
const line = (event) => Buffer.from(JSON.stringify(event) + '\n');
const completion = (usage) => line({ type: 'turn.completed', ...(usage === undefined ? {} : { usage }) });
const start = Buffer.concat([line({ type: 'thread.started', thread_id: codexId }), line({ type: 'turn.started' })]);
const forbidden = line({ type: 'item.started', item: { type: 'command_execution', command: 'authored-never-executed' } });
const scenario = {
  request: 'Use a single-column Layout without a Card. Give the name and topic fields concise labels and the review button the label Review details. Keep the permitted host fields and summaries.',
  input: { draft: { name: '민지', topic: '커피' } }, edits: ['Tea 차 두 잔', 'Hot tea 따뜻한 차'], actions: ['review', 'edit', 'review', 'confirm'],
};
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'private-render-terminal-usage-'));
  const packet = preparePacket({ candidateSha, cliPath: '/authored/never-executed', nodeBin: '/authored/bin', root });
  const experiment = { version: 'browser-packet-v1', candidateSha, packet, packetDigest: validatePacket(packet),
    declarationsDigest: DECLARATION_DIGEST, runId, command: executionCommand(root), scenario,
    runnerDigest: digest(fs.readFileSync(new URL('./run-packet.mjs', import.meta.url), 'utf8')) };
  const approval = { kind: 'fake-test', candidateSha, packetDigest: experiment.packetDigest, declarationsDigest: DECLARATION_DIGEST,
    experimentDigest: digest(experiment), runId };
  return { root, packet, experiment, approval };
}
function injected(chunks) {
  let calls = 0; const kills = [];
  const spawnProcess = () => {
    calls++;
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    // Simulate bytes already in flight at termination; no new turn or process is started.
    child.kill = (signal) => { kills.push(signal); return true; };
    child.stdin = new Writable({ write(chunk, encoding, done) { done(); }, final(done) {
      done(); queueMicrotask(async () => {
        for (const chunk of chunks) {
          child.stdout.write(chunk);
          await new Promise((resolve) => setImmediate(resolve));
        }
        child.stdout.end(); child.stderr.end(); child.emit('close', 0);
      });
    } });
    return child;
  };
  return { spawnProcess, kills, get calls() { return calls; } };
}
const read = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const request = { kind: 'initial', sessionId: runId, revision: 0, requestId: 'authored:1', action: null, target: 'form',
  input: scenario.input, screenRequest: scenario.request, contract: REQUEST_CONTRACT };
function assertStopped(f, fake, status, count, expectedBytes, reason = 'tool-or-diagnostic') {
  const result = read(f.root, 'turn-1-result.json');
  assert.equal(result.reason, reason); assert.equal(result.attempted, 1);
  assert.equal(result.completed, 0); assert.equal(result.accepted, 0); assert.equal(result.reservations, 1);
  assert.equal(result.usage.status, status); assert.equal(result.usage.completionEventCount, count);
  assert.equal(result.usage.source, 'injected-process'); assert.equal(result.usage.counterScope, 'unverified');
  assert.equal(result.usage.runId, runId); assert.equal(result.usage.codexThreadId, codexId);
  assert.equal(result.usage.hostSessionId, runId); assert.equal(result.usage.requestId, request.requestId);
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'turn-1-stdout.jsonl')), expectedBytes);
  if (status === 'reported') assert.deepEqual(result.usage.reportedCounters, { ...reported, reasoning_output_tokens: null });
  else assert.equal(result.usage.reportedCounters, null);
  assert.equal(fs.existsSync(path.join(f.root, 'turn-1-validated-spec.json')), false);
  assert.equal(fake.calls, 1); assert(fake.kills.includes('SIGTERM'));
  return result;
}

// ONE browser flow: the admission parser stops inside a received chunk, while telemetry observes its remaining bytes.
const browserFixture = fixture();
try {
  const bytes = Buffer.concat([start, forbidden, completion(reported)]), fake = injected([bytes]);
  const result = await runExperiment(browserFixture.experiment, { approval: browserFixture.approval, spawnProcess: fake.spawnProcess });
  assert.equal(result.status, 'partial-failure');
  assert.deepEqual(result.counts, { reserved: 1, attempted: 1, completed: 0, accepted: 0, useful: 0 });
  const report = read(browserFixture.root, 'report.json');
  assert.equal(report.terminalHostState.phase, 'failed'); assert.equal(report.terminalHostState.spec, null);
  assert.equal(report.displays.length, 0); assert.equal(report.latency.n, 0); assert.equal(report.latency.liveModelEvidence, false);
  for (const field of ['errors', 'csp', 'external']) assert.deepEqual(report[field], []);
  assert.equal(report.usage.turns[0].status, 'reported'); assert.equal(report.usage.turns[0].completionEventCount, 1);
  assert.equal(report.usage.tokenTotals, null); assert.equal(report.usage.billedCost.amount, null);
  assert.equal(Object.hasOwn(result, 'usage'), false);
  // The runner uses its own request ID; all other stop/raw assertions are identical.
  const turn = read(browserFixture.root, 'turn-1-result.json');
  assert.equal(turn.reason, 'tool-or-diagnostic'); assert.equal(turn.accepted, 0); assert.equal(fake.calls, 1);
  assert.deepEqual(fs.readFileSync(path.join(browserFixture.root, 'turn-1-stdout.jsonl')), bytes);
  await assert.rejects(runExperiment(browserFixture.experiment, { approval: browserFixture.approval, spawnProcess: fake.spawnProcess }));
  assert.equal(fake.calls, 1);
} finally { fs.rmSync(browserFixture.root, { recursive: true, force: true }); }

const withUnicode = completion({ ...reported, unknown: '민지' });
const split = withUnicode.indexOf(Buffer.from('민')) + 1;
const cases = [
  { name: 'late received chunks and split UTF8', chunks: [Buffer.concat([start, forbidden]), withUnicode.subarray(0, split), withUnicode.subarray(split)], status: 'reported', count: 1 },
  { name: 'missing usage', chunks: [Buffer.concat([start, forbidden, completion()])], status: 'missing', count: 1 },
  { name: 'malformed counters', chunks: [Buffer.concat([start, forbidden, completion({ ...reported, output_tokens: -1 })])], status: 'malformed', count: 1 },
  { name: 'duplicate completions', chunks: [Buffer.concat([start, forbidden, completion(reported), completion(reported)])], status: 'ambiguous', count: 2 },
  { name: 'no received completion', chunks: [Buffer.concat([start, forbidden])], status: 'no-completion', count: 0 },
  { name: 'truncated JSON', chunks: [Buffer.concat([start, forbidden, Buffer.from('{"type":"turn.completed","usage":')])], status: 'no-completion', count: 0 },
  { name: 'complete JSON without line ending', chunks: [Buffer.concat([start, forbidden, completion(reported).subarray(0, -1)])], status: 'no-completion', count: 0 },
  { name: 'invalid UTF8', chunks: [Buffer.concat([start, forbidden, Buffer.from('{"type":"turn.completed","extra":"'), Buffer.from([0xff]), Buffer.from('"}\n')])], status: 'no-completion', count: 0 },
  { name: 'malformed complete line then valid completion', chunks: [Buffer.concat([start, forbidden, Buffer.from('{\n'), completion(reported)])], status: 'reported', count: 1 },
];
for (const item of cases) {
  const f = fixture(), fake = injected(item.chunks); let generate;
  try {
    generate = createCodexTransport({ packet: f.packet, approval: f.approval, spawnProcess: fake.spawnProcess });
    await assert.rejects(generate(request), /turn failed/);
    assertStopped(f, fake, item.status, item.count, Buffer.concat(item.chunks));
    await assert.rejects(generate(request), /stopped/); assert.equal(fake.calls, 1);
  } finally { disposePacketTransport(generate); fs.rmSync(f.root, { recursive: true, force: true }); }
}
const ceiling = fixture(); let generate;
try {
  const refused = Buffer.concat([Buffer.alloc(ceiling.packet.maxEventBytes, 32), completion(reported)]);
  const fake = injected([start, refused]);
  generate = createCodexTransport({ packet: ceiling.packet, approval: ceiling.approval, spawnProcess: fake.spawnProcess });
  await assert.rejects(generate(request), /turn failed/);
  assertStopped(ceiling, fake, 'no-completion', 0, start, 'event-limit');
  await assert.rejects(generate(request), /stopped/); assert.equal(fake.calls, 1);
} finally { disposePacketTransport(generate); fs.rmSync(ceiling.root, { recursive: true, force: true }); }
console.log(JSON.stringify({ status: 'passed', evidence: 'one actual-browser terminal flow and injected controls; zero model calls',
  browserDisplays: 0, browserAttempts: 1, retainedCompletionCount: 1, terminalPreserved: true, rawBytesPreserved: true,
  lateChunks: 'received bytes only', telemetryControls: cases.length + 1, tokenTotals: null, billedCost: null }));
