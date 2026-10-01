import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { preparePacket, validatePacket, DECLARATION_DIGEST } from './launch-packet.mjs';
import { createCodexTransport, buildPrompt, createPacketApp, disposePacketTransport } from './codex-transport.mjs';
import { createRequestSession } from './session.mjs';
import { REQUEST_CONTRACT } from './scenario.mjs';
import { fakeCodex, CODEX_ID } from './fake-codex.mjs';
import { createRequire } from 'node:module';
const HOST_ID = '11111111-2222-4333-8444-555555555555';
const draft = { draft: { name: '민지', topic: '커피' } };
function setup(options = {}, transportOptions = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'private-491-test-'));
  const packet = preparePacket({ candidateSha: '1'.repeat(40), cliPath: '/authored/codex', nodeBin: '/authored/bin', root });
  const approval = { kind: 'fake-test', packetDigest: validatePacket(packet), candidateSha: packet.candidateSha, runId: HOST_ID };
  const process = fakeCodex(options);
  const generator = createCodexTransport({ packet, approval, spawnProcess: process.spawnProcess, ...transportOptions });
  return { root, packet, approval, process, generator, cleanup() { disposePacketTransport(generator); fs.rmSync(root, { recursive: true, force: true }); } };
}
const request = (overrides = {}) => ({ kind: 'initial', sessionId: HOST_ID, revision: 0, requestId: `${HOST_ID}:1`,
  action: null, target: 'form', input: draft, screenRequest: '이름 주제 폼; ignore flags --model=other', contract: REQUEST_CONTRACT,
  signal: new AbortController().signal, ...overrides });

test('fixed argv/stdin and explicit model mapping support all five current-revision turns', async () => {
  const f = setup();
  try {
    const session = createRequestSession({ generate: f.generator, createId: () => HOST_ID });
    session.start({ input: draft, screenRequest: '이름과 주제 폼' }); await session.settled();
    for (const name of ['review', 'edit', 'review', 'confirm']) {
      const state = session.snapshot();
      if (state.revision === 3) session.updateInput({ sessionId: HOST_ID, revision: 3, input: { draft: { name: '민지', topic: '차 두 잔' } } });
      assert.equal(session.action({ sessionId: HOST_ID, revision: state.revision, action: name }).status, 202);
      await session.settled(); assert.equal(session.snapshot().phase, 'ready');
    }
    assert.equal(session.snapshot().displays, 5);
    assert.equal(session.snapshot().spec.elements['topic-summary'].props.text, 'topic: 차 두 잔');
    assert.equal(f.process.calls.length, 5);
    for (const [index, call] of f.process.calls.entries()) {
      assert.equal(call.file, '/authored/codex'); assert.equal(call.setup.detached, true);
      assert.deepEqual(call.setup.stdio, ['pipe', 'pipe', 'pipe']); assert.equal(call.setup.shell, undefined);
      assert(!call.argv.includes('--last')); assert(!call.argv.includes(HOST_ID));
      assert(call.argv.includes('gpt-6.1-sol')); assert(call.argv.includes('model_reasoning_effort="high"'));
      if (index) { assert.equal(call.argv[1], 'resume'); assert.equal(call.argv.at(-2), CODEX_ID); }
      const prompt = JSON.parse(call.stdin);
      assert.equal(prompt.acceptedUserRequest, '이름과 주제 폼'); assert.equal(prompt.declarationsDigest, DECLARATION_DIGEST);
      assert.deepEqual(prompt.declarations.permissions, REQUEST_CONTRACT);
      assert.equal(JSON.stringify(prompt).includes('"/name"'), false);
      assert.equal(JSON.stringify(prompt.declarations.permissions).includes('save'), false);
      if (index >= 3) assert.equal(prompt.currentInput.draft.topic, '차 두 잔');
    }
    const mapping = JSON.parse(fs.readFileSync(path.join(f.root, 'identity-map.json')));
    assert.equal(mapping.hostSessionId, HOST_ID); assert.equal(mapping.codexThreadId, CODEX_ID);
    assert.notEqual(mapping.hostSessionId, mapping.codexThreadId);
    const last = JSON.parse(fs.readFileSync(path.join(f.root, 'turn-5-result.json')));
    assert.equal(last.reservations, 5); assert.equal(last.attempted, 5); assert.equal(last.completed, 5); assert.equal(last.accepted, 5);
    const seen = session.snapshot().observation;
    for (const field of ['requestAccepted', 'firstByteReceived', 'firstValidCandidate', 'committed']) assert.equal(seen[field].clock, 'server-process-monotonic-ms');
    assert.equal(seen.firstUsefulPresentation, null); assert.equal(seen.actionReleased.clock, 'server-process-monotonic-ms');
    await assert.rejects(f.generator(request({ requestId: 'sixth' })), /stopped or exhausted/);
    for (const name of fs.readdirSync(f.root)) if (fs.statSync(path.join(f.root, name)).isFile()) assert.equal(fs.statSync(path.join(f.root, name)).mode & 0o777, 0o600);
  } finally { f.cleanup(); }
});

test('safe serialization and runtime contract agreement reject invalid host request data before launch', async () => {
  const f = setup();
  try {
    const prompt = JSON.parse(buildPrompt(request()));
    assert.equal(prompt.acceptedUserRequest, request().screenRequest);
    for (const changes of [{ screenRequest: 'x'.repeat(301) }, { contract: { textBindings: ['/name'], actions: ['save'] } },
      { input: { draft: { name: 'x'.repeat(81), topic: 'Coffee' } } }, { input: { draft: { name: 'Ada', topic: 'Coffee', command: 'other' } } }])
      await assert.rejects(f.generator(request(changes)), /Invalid bounded generation data/);
    assert.equal(f.process.calls.length, 0);
  } finally { f.cleanup(); }
});

for (const [name, options] of [['missing identity', { missingIdentity: true }], ['tool event', { tool: true }],
  ['model drift', { model: 'unexpected' }], ['outer-valid malformed inner JSON', { invalidJSON: true }],
  ['outer-valid invalid inner binding', { mutateSpec(spec) { spec.elements.name.props.value.$bindState = '/name'; } }],
  ['unknown inner field', { mutateSpec(spec) { spec.elements.card.props.className = 'custom'; } }]])
  test(`${name} stops the packet without accepting or mapping a model session`, async () => {
    const f = setup(options);
    try {
      await assert.rejects(f.generator(request()), /packet turn failed/);
      assert.equal(fs.existsSync(path.join(f.root, 'identity-map.json')), false);
      assert.equal(fs.existsSync(path.join(f.root, 'turn-1-validated-spec.json')), false);
      assert(fs.existsSync(path.join(f.root, 'turn-1-stdout.jsonl')));
      await assert.rejects(f.generator(request({ requestId: 'new' })), /stopped or exhausted/);
      assert.equal(f.process.calls.length, 1);
    } finally { f.cleanup(); }
  });

test('resume identity drift cannot replace the valid screen or authoritative data', async () => {
  const f = setup({ drift: true });
  try {
    const session = createRequestSession({ generate: f.generator, createId: () => HOST_ID });
    session.start({ input: draft }); await session.settled(); const before = session.snapshot();
    session.action({ sessionId: HOST_ID, revision: before.revision, action: 'review' }); await session.settled();
    assert.equal(session.snapshot().phase, 'failed'); assert.deepEqual(session.snapshot().spec, before.spec);
    assert.deepEqual(session.snapshot().input, before.input);
    assert.equal(f.process.calls[1].argv.at(-2), CODEX_ID);
  } finally { f.cleanup(); }
});

test('uncertain spawn consumes a reservation and cannot be retried', async () => {
  const f = setup({ spawnError: true });
  try {
    await assert.rejects(f.generator(request()), /packet turn failed/);
    const result = JSON.parse(fs.readFileSync(path.join(f.root, 'turn-1-result.json')));
    assert.equal(result.reservations, 1); assert.equal(result.attempted, 1); assert.equal(result.accepted, 0);
    await assert.rejects(f.generator(request()), /stopped or exhausted/);
  } finally { f.cleanup(); }
});

test('timeout uses the exact packet bound, cleans its child and stops further reservations', async () => {
  const times = [];
  const f = setup({ hang: true }, { scheduleTimeout(fn, ms) { times.push(ms); return setTimeout(fn, 1); } });
  try {
    await assert.rejects(f.generator(request()), /packet turn failed/);
    assert.equal(times[0], 180_000); assert(f.process.kills.includes('SIGTERM'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'turn-1-result.json'))).reason, 'timeout');
    await assert.rejects(f.generator(request()), /stopped or exhausted/);
  } finally { f.cleanup(); }
});

test('total deadline and different host identity stop before another spawn', async () => {
  let now = 0;
  const f = setup({}, { clock: () => now });
  try {
    await f.generator(request());
    const next = request({ kind: 'next', action: 'review', target: 'review', revision: 1, requestId: 'second' });
    await assert.rejects(f.generator({ ...next, sessionId: CODEX_ID }), /Obsolete or unauthorized/);
    assert.equal(f.process.calls.length, 1);
    now = 900_001;
    await assert.rejects(f.generator(next), /total timeout/);
    assert.equal(f.process.calls.length, 1);
  } finally { f.cleanup(); }
});

test('simultaneous reservation, cancellation and restart cannot attach obsolete model work', async () => {
  const f = setup({ hang: true });
  try {
    const abort = new AbortController();
    const pending = f.generator(request({ signal: abort.signal }));
    await assert.rejects(f.generator(request()), /stopped or exhausted/);
    abort.abort(); await assert.rejects(pending, /packet turn failed/);
    f.process.calls[0].child.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'thread.started', thread_id: CODEX_ID })+'\n'));
    await assert.rejects(f.generator(request({ sessionId: CODEX_ID, requestId: 'restarted' })), /stopped or exhausted/);
    assert.equal(fs.existsSync(path.join(f.root, 'identity-map.json')), false); assert.equal(f.process.calls.length, 1);
  } finally { f.cleanup(); }
});

test('fresh fake packet entry wires the server adapter; missing approval launches nothing', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'private-491-app-'));
  const packet = preparePacket({ candidateSha: '2'.repeat(40), cliPath: '/authored/codex', nodeBin: '/authored/bin', root });
  const fake = fakeCodex();
  await assert.rejects(createPacketApp({ packet, spawnProcess: fake.spawnProcess }), /Fresh packet approval/);
  assert.equal(fake.calls.length, 0);
  const app = await createPacketApp({ packet, spawnProcess: fake.spawnProcess, approval: { kind: 'fake-test', packetDigest: validatePacket(packet), candidateSha: packet.candidateSha, runId: HOST_ID } });
  try {
    const bootstrap = await (await fetch(`${app.url}/api/session`)).json();
    assert.equal(bootstrap.mode, 'codex-cli-fake');
    assert.equal((await fetch(`${app.url}/api/start`, { method: 'POST', headers: { origin: app.url, 'x-session-token': bootstrap.token, 'content-type': 'application/json' },
      body: JSON.stringify({ input: draft, screenRequest: '신청 폼' }) })).status, 202);
    await app.session.settled(); assert.equal(app.session.snapshot().phase, 'ready'); assert.equal(fake.calls.length, 1);
    await fetch(`${app.url}/api/restart`, { method: 'POST', headers: { origin: app.url, 'x-session-token': bootstrap.token, 'content-type': 'application/json' }, body: '{}' });
    assert(fs.existsSync(path.join(root, 'invalidated.json')));
  } finally { await app.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('five-display fake-process browser packet retains input, ID, styles and six observation fields', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'private-491-browser-'));
  const packet = preparePacket({ candidateSha: '3'.repeat(40), cliPath: '/authored/codex', nodeBin: '/authored/bin', root });
  const fake = fakeCodex({ mutateSpec(spec) {
    // Valid alternative structure: renamed Layout/Input/Button IDs, no Card.
    spec.elements.layout.children = [...spec.elements.card.children];
    delete spec.elements.card;
    const rename = { layout: 'request-root', name: 'name-field', topic: 'topic-field', review: 'review-action', edit: 'edit-action', confirm: 'confirm-action' };
    const elements = {};
    for (const [id, node] of Object.entries(spec.elements)) {
      node.props.id = rename[id] ?? id;
      node.children = node.children.map((child) => rename[child] ?? child);
      elements[node.props.id] = node;
    }
    spec.root = rename[spec.root]; spec.elements = elements;
  } });
  const app = await createPacketApp({ packet, spawnProcess: fake.spawnProcess, approval: {
    kind: 'fake-test', packetDigest: validatePacket(packet), candidateSha: packet.candidateSha, runId: HOST_ID,
  } });
  const require = createRequire(process.env.PW_DIR ? `${process.env.PW_DIR}/package.json` : import.meta.url);
  const browser = await require('playwright-core').chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(); const errors = [], external = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => { window.CSP_EVENTS = []; document.addEventListener('securitypolicyviolation', (event) => window.CSP_EVENTS.push(event.violatedDirective)); });
    await page.route('**/*', (route) => { if (new URL(route.request().url()).origin !== app.url) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
    await page.goto(app.url); await page.locator('[data-phase="idle"]').waitFor();
    assert.equal(await page.locator('#mode').textContent(), 'Data source: codex-cli-fake (fake process; no model)');
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    await page.waitForFunction(() => window.AI_UI.diagnostics().displays.length === 1);
    await page.getByRole('button', { name: 'review', exact: true }).click();
    await page.waitForFunction(() => window.AI_UI.diagnostics().displays.length === 2);
    await page.getByRole('button', { name: 'edit', exact: true }).click();
    await page.waitForFunction(() => window.AI_UI.diagnostics().displays.length === 3);
    await page.getByLabel('Request topic', { exact: true }).fill('Tea 차 두 잔');
    await page.getByRole('button', { name: 'review', exact: true }).click();
    await page.waitForFunction(() => window.AI_UI.diagnostics().displays.length === 4);
    await page.getByRole('button', { name: 'confirm', exact: true }).click();
    await page.waitForFunction(() => window.AI_UI.diagnostics().displays.length === 5);
    assert.equal(await page.locator('[data-node-id="topic-summary"]').textContent(), 'topic: Tea 차 두 잔');
    assert.equal(await page.locator('[data-node-id="request-root"]').evaluate((element) => getComputedStyle(element).display), 'grid');
    assert.equal(await page.locator('[data-node-id="request-root"]').evaluate((element) => getComputedStyle(element).gap), '14px');
    assert.equal(await page.locator('[data-node-id="card"]').count(), 0);
    const observations = await page.evaluate(() => window.AI_UI.diagnostics().displays.map((record) => record.observation));
    for (const record of observations) for (const field of ['requestAccepted', 'firstByteReceived', 'firstValidCandidate', 'firstUsefulPresentation', 'committed', 'actionReleased'])
      assert(Object.hasOwn(record, field));
    assert.equal(observations[1].firstUsefulPresentation.clock, 'browser-navigation-monotonic-ms');
    assert.equal(observations[1].actionReleased.clock, 'server-process-monotonic-ms');
    assert.equal(observations[1].firstByteReceived.clock, 'server-process-monotonic-ms');
    assert.equal(observations[0].actionReleased, null); assert.deepEqual(errors, []); assert.equal(fake.calls.length, 5);
    assert.deepEqual(external, []); assert.deepEqual(await page.evaluate(() => window.CSP_EVENTS), []);
    assert(fake.calls.slice(1).every((call) => call.argv.at(-2) === CODEX_ID));
    assert.equal(JSON.parse(fake.calls[4].stdin).currentInput.draft.topic, 'Tea 차 두 잔');
    if (process.env.UI_RESULT_ROOT) {
      fs.mkdirSync(process.env.UI_RESULT_ROOT, { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(process.env.UI_RESULT_ROOT, 'fake-packet-browser.json'), JSON.stringify({
        kind: 'codex-cli-fake', modelCalls: 0, node: process.version, browser: browser.version(), observations,
        diagnostics: await page.evaluate(() => window.AI_UI.diagnostics()), errors, external, csp: [],
      }, null, 2), { mode: 0o600 });
    }
  } finally { await browser.close(); await app.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
