import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { preparePacket, digest, validatePacket, DECLARATION_DIGEST } from './launch-packet.mjs';
import { runExperiment, variation, executionCommand } from './run-packet.mjs';
import { fakeCodex, CODEX_ID } from './fake-codex.mjs';
import { requestScreen } from './scenario.mjs';
const id = '11111111-2222-4333-8444-555555555555';
function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'private-494-test-'));
  const packet = preparePacket({ candidateSha: '1'.repeat(40), cliPath: '/authored/codex', nodeBin: '/authored/bin', root });
  const scenario = {
    request: 'Use a single-column Layout without a Card. Give the name and topic fields concise labels and the review button the label Review details. Keep the permitted host fields and summaries.',
    input: { draft: { name: '민지', topic: '커피' } }, edits: ['Tea 차 두 잔', 'Hot tea 따뜻한 차'], actions: ['review', 'edit', 'review', 'confirm'],
  };
  const experiment = { version: 'browser-packet-v1', candidateSha: packet.candidateSha, packet, packetDigest: validatePacket(packet),
    declarationsDigest: DECLARATION_DIGEST, runId: id, runnerDigest: digest(fs.readFileSync(new URL('./run-packet.mjs', import.meta.url), 'utf8')), command: executionCommand(root), scenario };
  const approval = { kind: 'fake-test', candidateSha: packet.candidateSha, packetDigest: experiment.packetDigest,
    declarationsDigest: DECLARATION_DIGEST, experimentDigest: digest(experiment), runId: id };
  return { root, experiment, approval, fake: fakeCodex(options), cleanup() { fs.rmSync(root, { recursive: true, force: true }); } };
}
const read = (f, name) => JSON.parse(fs.readFileSync(path.join(f.root, name), 'utf8'));
function variant(spec) {
  spec.elements.layout.children = [...spec.elements.card.children]; delete spec.elements.card;
  const names = { layout: 'root-renamed', name: 'person-field', topic: 'subject-field', review: 'next-button', edit: 'change-button', confirm: 'finish-button' };
  const elements = {};
  for (const [id, node] of Object.entries(spec.elements)) {
    node.props.id = names[id] ?? id; node.children = node.children.map((id) => names[id] ?? id);
    if (node.type === 'Input') node.props.label = 'Permitted field';
    if (node.type === 'Button') node.props.label = 'Permitted action';
    elements[node.props.id] = node;
  }
  spec.root = 'root-renamed'; spec.elements = elements;
}
test('exact authority fails closed before any injected/native dispatch; CLI has no fake override', async () => {
  const f = fixture();
  try {
    for (const changes of [null, { ...f.approval, experimentDigest: 'other' }, { ...f.approval, declarationsDigest: 'other' },
      { ...f.approval, runId: 'old' }, { ...f.approval, candidateSha: '2'.repeat(40) }])
      await assert.rejects(runExperiment(f.experiment, { approval: changes, spawnProcess: f.fake.spawnProcess }), /authority/);
    await assert.rejects(runExperiment(f.experiment, { approval: f.approval }), /authority/);
    assert.equal(f.fake.calls.length, 0);
    const file = path.join(f.root, 'experiment.json'), authority = path.join(f.root, 'fake-authority.json');
    fs.writeFileSync(file, JSON.stringify(f.experiment), { mode: 0o600 }); fs.writeFileSync(authority, JSON.stringify(f.approval), { mode: 0o600 });
    assert.throws(() => execFileSync(process.execPath, ['examples/ai-ui/run-packet.mjs', '--run', file, '--approval', authority], { stdio: 'pipe' }));
    assert.equal(fs.existsSync(path.join(f.root, 'run-lock.json')), false);
  } finally { f.cleanup(); }
});
test('actual browser runner collects all five displays, both edits, variant structure and correlated timings', async () => {
  const f = fixture({ mutateSpec: variant });
  try {
    const result = await runExperiment(f.experiment, { approval: f.approval, spawnProcess: f.fake.spawnProcess });
    assert.equal(result.status, 'completed'); assert.equal(result.mode, 'codex-cli-fake');
    assert.deepEqual(result.counts, { reserved: 5, attempted: 5, completed: 5, accepted: 5, useful: 5 });
    assert.equal(f.fake.calls.length, 5); assert(f.fake.calls.slice(1).every((call) => call.argv.at(-2) === CODEX_ID));
    const report = read(f, 'report.json');
    assert.deepEqual(report.errors, []); assert.deepEqual(report.csp, []); assert.deepEqual(report.external, []);
    assert.equal(report.displays[0].state.input.draft.topic, '커피');
    assert.equal(report.displays[1].state.input.draft.topic, 'Tea 차 두 잔');
    assert.equal(report.displays[3].state.input.draft.topic, 'Hot tea 따뜻한 차');
    assert.equal(report.displays[4].state.stage, 'confirmed'); assert.equal(report.terminalHostState.displays, 5);
    assert(report.displays.every((record) => record.variation.structure));
    assert(report.displays.slice(0, 4).every((record) => record.variation.labels));
    assert.equal(report.displays[4].variation.labels, false);
    assert.equal(report.latency.n, 4); assert.equal(report.latency.liveModelEvidence, false);
    for (const record of report.displays) {
      assert.equal(record.browser.observation.requestId, record.state.observation.requestId);
      for (const field of ['requestAccepted', 'firstByteReceived', 'firstValidCandidate', 'firstUsefulPresentation', 'committed', 'actionReleased'])
        assert(Object.hasOwn(record.browser.observation, field));
      assert.equal(record.browser.observation.firstUsefulPresentation.clock, 'browser-navigation-monotonic-ms');
      if (record.index === 1) { assert.equal(record.actionToUsefulMs, null); assert.equal(record.browser.observation.actionReleased, null); }
      else { assert(record.actionToUsefulMs >= 0); assert.equal(record.browser.observation.actionReleased.clock, 'server-process-monotonic-ms'); }
      assert.equal(fs.statSync(path.join(f.root, `display-${record.index}.png`)).mode & 0o777, 0o600);
    }
    assert.equal(report.displays[0].rendered.find((node) => node.id === 'root-renamed').display, 'grid');
    assert.equal(report.displays[0].rendered.find((node) => node.id === 'root-renamed').gap, '14px');
    assert.equal(report.displays[0].acceptedSpec.root, 'root-renamed'); assert(!report.displays[0].acceptedSpec.elements.card);
    assert(JSON.parse(f.fake.calls[4].stdin).currentInput.draft.topic === 'Hot tea 따뜻한 차');
    if (process.env.UI_RESULT_ROOT) {
      fs.mkdirSync(process.env.UI_RESULT_ROOT, { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(process.env.UI_RESULT_ROOT, 'runner-fake-result.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
    }
  } finally { f.cleanup(); }
});
test('invalid second candidate is terminal and preserves the first screen with a partial report and no retry', async () => {
  const f = fixture({ mutateSpec(spec, number) { if (number === 2) spec.elements.card.props.className = 'forbidden'; } });
  try {
    const result = await runExperiment(f.experiment, { approval: f.approval, spawnProcess: f.fake.spawnProcess });
    assert.equal(result.status, 'partial-failure'); assert.equal(f.fake.calls.length, 2);
    assert.deepEqual(result.counts, { reserved: 2, attempted: 2, completed: 2, accepted: 1, useful: 1 });
    const report = read(f, 'report.json'); assert.equal(report.terminalHostState.phase, 'failed');
    assert.equal(report.terminalHostState.stage, 'form'); assert(report.terminalHostState.spec);
    assert.equal(report.latency.n, 0); assert.equal(report.displays.length, 1);
    assert.equal(fs.existsSync(path.join(f.root, 'display-2.png')), false);
    await assert.rejects(runExperiment(f.experiment, { approval: f.approval, spawnProcess: f.fake.spawnProcess }));
    assert.equal(f.fake.calls.length, 2);
  } finally { f.cleanup(); }
});
test('variation truthfully reports absence without requiring positive visual change', () => {
  const input = { draft: { name: 'Ada', topic: 'Tea' } };
  for (const stage of ['form', 'review', 'confirmed'])
    assert.deepEqual(variation(requestScreen(stage, input), stage, input), { structure: false, styles: false, labels: false, identity: false });
});

test('host cancellation stops the owned pending fake child and records a terminal partial result', async () => {
  const f = fixture({ hang: true }); const signal = new AbortController();
  try {
    const run = runExperiment(f.experiment, { approval: f.approval, spawnProcess: f.fake.spawnProcess, signal: signal.signal });
    while (!f.fake.calls.length) await new Promise((resolve) => setTimeout(resolve, 20));
    signal.abort(); const result = await run;
    assert.equal(result.status, 'partial-failure'); assert.equal(f.fake.calls.length, 1);
    assert(f.fake.kills.includes('SIGTERM'));
    assert.deepEqual(result.counts, { reserved: 1, attempted: 1, completed: 0, accepted: 0, useful: 0 });
    assert.equal(read(f, 'report.json').terminalHostState.phase, 'cancelled');
  } finally { f.cleanup(); }
});

test('variation ignores object insertion order and separates ID-only renames from semantic layout changes', () => {
  const input = { draft: { name: 'Ada', topic: 'Tea' } };
  const spec = requestScreen('form', input);
  spec.elements = Object.fromEntries(Object.entries(spec.elements).reverse());
  assert.deepEqual(variation(spec, 'form', input), { structure: false, styles: false, labels: false, identity: false });
  const names = { layout: 'renamed-root', card: 'renamed-container', name: 'person-input', topic: 'subject-input', review: 'next' };
  const elements = {};
  for (const [id, node] of Object.entries(spec.elements)) {
    node.props.id = names[id] ?? id; node.children = node.children.map((child) => names[child] ?? child); elements[node.props.id] = node;
  }
  spec.root = names[spec.root]; spec.elements = elements;
  assert.deepEqual(variation(spec, 'form', input), { structure: false, styles: false, labels: false, identity: true });
  const card = spec.elements['renamed-container'];
  [card.children[1], card.children[2]] = [card.children[2], card.children[1]];
  assert.equal(variation(spec, 'form', input).structure, true);
  spec.elements['renamed-root'].props.gap = 'fractional';
  spec.elements['person-input'].props.label = 'Changed label';
  assert.equal(variation(spec, 'form', input).styles, true);
  assert.equal(variation(spec, 'form', input).labels, true);
});
