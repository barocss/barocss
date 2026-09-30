import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInitializeResponse, validateThreadStartResponse,
  validateTurnStartResponse, acceptPassiveNotification,
  validateThreadStatusNotification } from './protocol-contract.mjs';

// Authored source-contract simulation (L2). These fixtures are not native app-server results.
// Pinned schema: https://github.com/openai/codex/tree/rust-v0.156.1/codex-rs/app-server-protocol/schema/json/v1
const model = 'gpt-6.1-sol';
const cwd = '/tmp/authored-protocol-fixture';
const initialized = () => ({ codexHome: '/tmp/authored-codex-home',
  platformFamily: 'unix', platformOs: 'macos', userAgent: 'codex-cli 0.156.1' });
const thread = () => ({ id: 'authored-thread-1', cliVersion: '0.156.1',
  createdAt: 0, updatedAt: 0, cwd, ephemeral: false, modelProvider: 'openai', preview: '',
  projectId: null, sessionId: 'authored-session-1', source: 'appServer',
  status: { type: 'idle' }, turns: [] });
const session = () => ({ thread: thread(), model, cwd, approvalPolicy: 'never',
  approvalsReviewer: 'auto_review', modelProvider: 'openai',
  sandbox: { type: 'readOnly', networkAccess: false }, reasoningEffort: 'high', instructionSources: [] });
const turn = () => ({ turn: { id: 'authored-turn-1', status: 'inProgress', items: [] } });
const notification = (method, params) => ({ method, params });

test('initialize response validates all pinned required fields and version', () => {
  assert.doesNotThrow(() => validateInitializeResponse(initialized(), '0.156.1'));
  assert.doesNotThrow(() => validateInitializeResponse(initialized(), '0.156.1',
    { codexHome: '/tmp/authored-codex-home' }));
  assert.throws(() => validateInitializeResponse(initialized(), '0.156.1',
    { codexHome: '/tmp/other-codex-home' }));
  for (const field of ['codexHome', 'platformFamily', 'platformOs', 'userAgent']) {
    const response = initialized();
    delete response[field];
    assert.throws(() => validateInitializeResponse(response, '0.156.1'), undefined,
      `missing ${field} was accepted`);
  }
  assert.throws(() => validateInitializeResponse({ ...initialized(), platformOs: 1 }, '0.156.1'));
  assert.throws(() => validateInitializeResponse({ ...initialized(), userAgent: 'codex-cli 0.159.0' },
    '0.156.1'));
  assert.throws(() => validateInitializeResponse({ ...initialized(), codexHome: 'relative/path' },
    '0.156.1'));
});

test('thread/start accepts schema defaults but requires observed approved settings', () => {
  assert.equal(validateThreadStartResponse(session(), { model, cwd }).reasoningEffort, 'high');
  const sparse = session();
  delete sparse.instructionSources;
  delete sparse.sandbox.networkAccess;
  assert.doesNotThrow(() => validateThreadStartResponse(sparse, { model, cwd }));
  for (const field of ['cliVersion', 'createdAt', 'cwd', 'ephemeral', 'id', 'modelProvider',
    'preview', 'projectId', 'sessionId', 'source', 'status', 'turns', 'updatedAt']) {
    const response = session();
    delete response.thread[field];
    assert.throws(() => validateThreadStartResponse(response, { model, cwd }), undefined,
      `missing Thread.${field} was accepted`);
  }
  for (const mutate of [
    (value) => { value.model = 'wrong-model'; },
    (value) => { value.cwd = '/tmp/other'; },
    (value) => { value.thread.cwd = '/tmp/other'; },
    (value) => { value.thread.id = ''; },
    (value) => { value.modelProvider = 'other'; },
    (value) => { value.thread.modelProvider = 'other'; },
    (value) => { value.approvalPolicy = 'on-request'; },
    (value) => { value.approvalsReviewer = 'user'; },
    (value) => { value.sandbox.networkAccess = true; },
    (value) => { value.sandbox.networkAccess = null; },
    (value) => { value.sandbox.type = 'workspaceWrite'; },
    (value) => { delete value.reasoningEffort; },
    (value) => { value.reasoningEffort = null; },
    (value) => { value.reasoningEffort = 'low'; },
    (value) => { value.instructionSources = null; },
    (value) => { value.instructionSources = ['/tmp/authored-instructions']; },
  ]) {
    const response = session();
    mutate(response);
    assert.throws(() => validateThreadStartResponse(response, { model, cwd }));
  }
});

test('turn/start accepts only a new in-progress turn with known initial item types', () => {
  assert.doesNotThrow(() => validateTurnStartResponse(turn()));
  assert.doesNotThrow(() => validateTurnStartResponse({ turn: { id: 'authored-turn-2',
    status: 'inProgress', items: [{ id: 'authored-user-1', type: 'userMessage', content: [] },
      { id: 'authored-reasoning-1', type: 'reasoning' }] } }));
  for (const mutate of [
    (value) => { delete value.turn.id; },
    (value) => { value.turn.status = 'completed'; },
    (value) => { delete value.turn.items; },
    (value) => { value.turn.items = [{ id: 'authored-tool-1', type: 'commandExecution' }]; },
    (value) => { value.turn.items = [{ id: 'authored-user-1', type: 'userMessage' }]; },
    (value) => { value.turn.items = [{ id: 'authored-user-1', type: 'userMessage', content: null }]; },
    (value) => { value.turn.items = [{ id: 'authored-user-1', type: 'userMessage',
      content: [{ type: 'text', text: 1 }] }]; },
    (value) => { value.turn.items = [{ id: 'authored-reasoning-1', type: 'reasoning', summary: null }]; },
    (value) => { value.turn.items = [{ id: 'authored-reasoning-1', type: 'reasoning', content: [1] }]; },
    (value) => { value.turn.itemsView = 'partial'; },
  ]) {
    const response = turn();
    mutate(response);
    assert.throws(() => validateTurnStartResponse(response));
  }
});

test('passive startup metadata is narrowly allowed and never becomes owned turn data', () => {
  const account = notification('account/updated', { authMode: 'chatgpt', planType: null });
  const disabledRemote = notification('remoteControl/status/changed', {
    installationId: 'authored-installation', serverName: 'authored-server', status: 'disabled' });
  assert.equal(acceptPassiveNotification(account, { phase: 'initializing' }), true);
  assert.equal(acceptPassiveNotification(notification('account/updated',
    { authMode: 'chatgpt', planType: 'free' }), { phase: 'initializing' }), true);
  assert.equal(acceptPassiveNotification(disabledRemote, { phase: 'starting-session' }), true);
  assert.equal(acceptPassiveNotification(notification('remoteControl/status/changed', {
    ...disabledRemote.params, environmentId: null }), { phase: 'starting-session' }), true);
  // Repeated passive notices can be ignored independently; they never advance the turn.
  assert.equal(acceptPassiveNotification(account, { phase: 'initializing' }), true);
  assert.equal(acceptPassiveNotification(notification('unknown/method', {}),
    { phase: 'initializing' }), false);
  assert.equal(acceptPassiveNotification(account, { phase: 'turn-active' }), true);
  assert.equal(acceptPassiveNotification(disabledRemote, { phase: 'between-turns' }), true);
  for (const event of [notification('thread/status/changed', {
    threadId: 'authored-thread-1', status: { type: 'idle' } }),
    notification('turn/started', { threadId: 'unowned', turn: turn().turn }),
    notification('item/started', { threadId: 'unowned', turnId: 'unowned',
      item: { id: 'authored-tool', type: 'commandExecution' } })]) {
    assert.equal(acceptPassiveNotification(event, { phase: 'turn-active' }), false);
  }
  assert.throws(() => acceptPassiveNotification(notification('remoteControl/status/changed', {
    installationId: 'authored-installation', serverName: 'authored-server', status: 'connected',
  }), { phase: 'initializing' }));
  assert.equal(acceptPassiveNotification(notification('turn/started', {
    threadId: 'unowned', turn: turn().turn }), { phase: 'between-turns' }), false);
});

test('malformed or identity-bearing passive metadata is rejected', () => {
  for (const event of [
    notification('account/updated', null),
    notification('account/updated', { authMode: 1 }),
    notification('account/updated', { authMode: null }),
    notification('account/updated', { planType: 'free' }),
    notification('remoteControl/status/changed', { serverName: 'authored-server', status: 'disabled' }),
    notification('remoteControl/status/changed', { installationId: 1,
      serverName: 'authored-server', status: 'disabled' }),
    notification('remoteControl/status/changed', { installationId: 'authored-installation',
      serverName: 'authored-server', status: 'mystery' }),
    notification('remoteControl/status/changed', { installationId: 'authored-installation',
      serverName: 'authored-server', status: 'disabled', environmentId: 'authored-active' }),
    notification('account/updated', { authMode: 'chatgpt', threadId: 'unowned' }),
    { ...notification('account/updated', { authMode: 'chatgpt' }), id: 7 },
    notification('remoteControl/status/changed', { installationId: 'authored-installation',
      serverName: 'authored-server', status: 'disabled', turnId: 'unowned' }),
  ]) {
    assert.throws(() => acceptPassiveNotification(event, { phase: 'initializing' }));
  }
  assert.throws(() => acceptPassiveNotification(notification('account/updated',
    { authMode: 'chatgpt' }), { phase: 'invalid-phase' }));
});

test('thread status metadata requires an owned identity and phase-compatible status', () => {
  const threadId = 'authored-thread-1';
  const status = (type, activeFlags) => notification('thread/status/changed', {
    threadId, status: activeFlags === undefined ? { type } : { type, activeFlags },
  });
  assert.equal(validateThreadStatusNotification(status('idle'),
    { phase: 'starting-session', threadId }), threadId);
  assert.equal(validateThreadStatusNotification(status('notLoaded'),
    { phase: 'between-turns', threadId }), threadId);
  assert.equal(validateThreadStatusNotification(status('idle'),
    { phase: 'turn-active', threadId }), threadId);
  assert.equal(validateThreadStatusNotification(status('notLoaded'),
    { phase: 'turn-active', threadId }), threadId);
  assert.equal(validateThreadStatusNotification(status('active', []),
    { phase: 'turn-active', threadId }), threadId);
  for (const [event, context] of [
    [status('active', []), { phase: 'starting-session', threadId }],
    [status('active', ['remote-control']), { phase: 'turn-active', threadId }],
    [status('active'), { phase: 'turn-active', threadId }],
    [status('idle'), { phase: 'starting-session', threadId: 'other-thread' }],
    [status('idle'), { phase: 'invalid-phase', threadId }],
    [notification('thread/status/changed', { threadId }), { phase: 'starting-session', threadId }],
    [notification('turn/started', { threadId, status: { type: 'idle' } }),
      { phase: 'starting-session', threadId }],
  ]) assert.throws(() => validateThreadStatusNotification(event, context), undefined,
    `${event.params?.status?.type ?? event.method} accepted in ${context.phase}`);
});

// Pinned v2 RateLimitSnapshot schema; authored values, not captured account data.
const rateNotice = (rateLimits) => notification('account/rateLimits/updated', { rateLimits });
test('sparse rate metadata accepts source-shaped optional/null values in bounded phases', () => {
  const snapshots = [{}, { primary: { usedPercent: 25 }, secondary: null },
    { credits: { hasCredits: true, unlimited: false, balance: null },
      individualLimit: { limit: '100.00', used: '25.00', remainingPercent: 75, resetsAt: 12345 },
      limitId: 'authored-quota', limitName: 'Authored quota', normalModelSlug: 'authored-display-model',
      planType: 'free', primary: { usedPercent: 125, windowDurationMins: 60, resetsAt: 12345 },
      secondary: { usedPercent: 0, windowDurationMins: null, resetsAt: null },
      rateLimitReachedType: 'rate_limit_reached', spendControlReached: true },
    { credits: null, individualLimit: null, limitId: null, limitName: null, normalModelSlug: null,
      planType: null, primary: null, secondary: null, rateLimitReachedType: null, spendControlReached: null }];
  for (const phase of ['initializing', 'starting-session', 'turn-active', 'between-turns']) {
    for (const value of snapshots) {
      const event = rateNotice(value), before = structuredClone(event);
      assert.equal(acceptPassiveNotification(event, { phase }), true);
      assert.equal(acceptPassiveNotification(event, { phase }), true, 'duplicates remain inert');
      assert.deepEqual(event, before, 'metadata must not mutate producer data');
    }
  }
});

test('rate metadata rejects malformed snapshots, nested required fields, identities and RPC requests', () => {
  for (const snapshot of [undefined, null, [], 'quota', { primary: {} },
    { primary: { usedPercent: 1.5 } }, { primary: { usedPercent: 2147483648 } },
    { primary: { usedPercent: 1, resetsAt: Number.MAX_SAFE_INTEGER + 1 } },
    { primary: { usedPercent: 1, windowDurationMins: '60' } },
    { primary: { usedPercent: 1, threadId: 'unowned' } },
    { credits: { hasCredits: true } }, { credits: { hasCredits: 1, unlimited: false } },
    { credits: { hasCredits: true, unlimited: false, balance: 10 } },
    { individualLimit: { limit: '100', used: '0', remainingPercent: 100 } },
    { individualLimit: { limit: 100, used: '0', remainingPercent: 100, resetsAt: 1 } },
    { planType: 'unsupported' }, { rateLimitReachedType: 'unsupported' },
    { spendControlReached: 1 }, { normalModelSlug: 1 }, { threadId: 'unowned' }]) {
    assert.throws(() => acceptPassiveNotification(rateNotice(snapshot), { phase: 'turn-active' }));
  }
  for (const event of [{ ...rateNotice({}), id: 7 },
    notification('account/rateLimits/updated', { rateLimits: {}, threadId: 'unowned' }),
    notification('account/rateLimits/updated', { rateLimits: {}, turnId: 'unowned' })]) {
    assert.throws(() => acceptPassiveNotification(event, { phase: 'turn-active' }));
  }
  assert.throws(() => acceptPassiveNotification(rateNotice({}), { phase: 'stopped' }));
});
