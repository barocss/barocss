// Authored test child. It only speaks line-delimited app-server-shaped JSON-RPC.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { INITIAL } from '../barocss-render-prototype/fixture.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(fs.readFileSync(path.join(here, 'frozen-plan.json')));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const mode = process.env.BAROCSS_FAKE_MODE ?? 'success';
const ledger = process.env.BAROCSS_FAKE_LEDGER;
if (!ledger || !path.isAbsolute(ledger)) throw new Error('Test ledger is required');

let buffer = '';
let session = 0;
let ordinal = 0;
let initializedRequest = false;
let initializedNotice = false;
const send = (value) => process.stdout.write(JSON.stringify(value) + '\n');
const notify = (method, params) => send({ method, params });
const threadId = () => `fake-thread-${session}`;
const turnId = () => `fake-turn-${ordinal}`;
const messageId = () => `fake-message-${ordinal}`;

function confirmation(name) {
  return { root: 'layout', elements: {
    layout: { type: 'Layout', props: { id: 'layout', columns: 'single', gap: 'fractional' }, children: ['card'] },
    card: { type: 'Card', props: { id: 'card', padding: 'spacious', tone: 'light' }, children: ['heading', 'summary'] },
    heading: { type: 'Text', props: { id: 'heading', text: 'Profile saved' }, children: [] },
    summary: { type: 'Text', props: { id: 'summary', text: `Name: ${name}` }, children: [] },
  } };
}

function completedTurn(spec) {
  const text = JSON.stringify({ specJson: JSON.stringify(spec) });
  const base = { threadId: threadId(), turnId: turnId() };
  const item = { id: messageId(), type: 'agentMessage', phase: 'final_answer', text };
  notify('thread/tokenUsage/updated', { ...base, tokenUsage: { total: {} } });
  notify('turn/started', { threadId: base.threadId,
    turn: { id: base.turnId, status: 'inProgress', items: [] } });
  if (mode === 'tool') {
    notify('item/started', { ...base, startedAtMs: 1,
      item: { id: 'fake-tool', type: 'commandExecution', command: 'false',
        commandActions: [], cwd: process.cwd(), status: 'inProgress' } });
    return;
  }
  notify('item/started', { ...base, startedAtMs: 2,
    item: { id: item.id, type: 'agentMessage', text: '' } });
  if (mode === 'malformed') {
    process.stdout.write('{invalid-json\n');
    return;
  }
  notify('item/agentMessage/delta', { ...base,
    turnId: mode === 'wrong-id' ? 'other-turn' : base.turnId,
    itemId: item.id, delta: text });
  notify('item/completed', { ...base, completedAtMs: 3, item });
  notify('turn/completed', { threadId: base.threadId,
    turn: { id: base.turnId, status: 'completed', itemsView: 'full', items: [item] } });
}

function handle(request) {
  if (!request || typeof request !== 'object') throw new Error('Invalid fake request');
  if (request.method === 'initialize') {
    if (initializedRequest || request.params?.clientInfo?.name !== 'barocss_462'
      || request.params.clientInfo.version !== '1') throw new Error('Invalid initialize request');
    initializedRequest = true;
    send({ id: request.id, result: { userAgent: 'codex-cli 0.156.1 authored fake' } });
    return;
  }
  if (request.method === 'initialized') {
    if (!initializedRequest || initializedNotice) throw new Error('Invalid initialized order');
    initializedNotice = true;
    return;
  }
  if (request.method === 'thread/start') {
    if (!initializedNotice || request.params?.model !== 'gpt-6.1-sol'
      || request.params.modelProvider !== 'openai'
      || request.params.approvalsReviewer !== 'auto_review'
      || request.params.sandbox !== 'read-only' || request.params.approvalPolicy !== 'never') {
      throw new Error('Invalid thread start settings');
    }
    session++;
    const thread = { id: threadId(), cliVersion: '0.156.1', createdAt: 0, updatedAt: 0,
      cwd: request.params.cwd, ephemeral: false, modelProvider: 'openai', preview: '',
      projectId: null, sessionId: 'fake-id', source: 'appServer',
      status: { type: 'idle' }, turns: [] };
    const result = { thread,
      model: mode === 'wrong-model' ? 'wrong-model' : 'gpt-6.1-sol', cwd: request.params.cwd,
      approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false },
      approvalsReviewer: 'auto_review', modelProvider: 'openai', reasoningEffort: 'high',
      instructionSources: [] };
    if (mode === 'missing-effort') delete result.reasoningEffort;
    if (mode === 'null-effort') result.reasoningEffort = null;
    if (mode === 'wrong-effort') result.reasoningEffort = 'low';
    if (mode === 'missing-provider') delete result.modelProvider;
    if (mode === 'wrong-provider') result.modelProvider = 'local';
    if (mode === 'nested-wrong-provider') result.thread.modelProvider = 'local';
    if (mode === 'missing-reviewer') delete result.approvalsReviewer;
    if (mode === 'wrong-reviewer') result.approvalsReviewer = 'user';
    if (mode === 'missing-sources') delete result.instructionSources;
    if (mode === 'null-sources') result.instructionSources = null;
    if (mode === 'instruction-sources') result.instructionSources = ['/tmp/test-instructions'];
    notify('thread/started', { thread });
    send({ id: request.id, result });
    return;
  }
  if (request.method === 'turn/interrupt') {
    send({ id: request.id, result: {} });
    return;
  }
  if (request.method !== 'turn/start') throw new Error('Unexpected fake method');
  if (!initializedNotice) throw new Error('Turn before initialization');
  ordinal++;
  const [row, kind] = [['01', 'initial'], ['01', 'next'], ['03', 'initial'], ['03', 'next']][ordinal - 1] ?? [];
  if (!row || !fs.existsSync(path.join(ledger, `${ordinal}-${row}-${kind}.json`))) {
    throw new Error('Turn started before matching reservation');
  }
  if (request.params.threadId !== threadId()) throw new Error('Thread was not reused for second turn');
  const expectedPromptSha256 = plan.scenarios[row === '01' ? 0 : 1][
    kind === 'initial' ? 'initialPromptSha256' : 'nextPromptSha256'];
  const input = request.params.input;
  const expectedSchema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'schema.json')));
  if (request.params.model !== 'gpt-6.1-sol' || request.params.effort !== 'high'
    || request.params.approvalPolicy !== 'never'
    || request.params.approvalsReviewer !== 'auto_review'
    || request.params.sandboxPolicy?.type !== 'readOnly'
    || request.params.sandboxPolicy.networkAccess !== false
    || !Array.isArray(input) || input.length !== 1 || input[0].type !== 'text'
    || typeof input[0].text !== 'string' || sha(input[0].text) !== expectedPromptSha256
    || JSON.stringify(request.params.outputSchema) !== JSON.stringify(expectedSchema)) {
    throw new Error('Turn settings, output schema, or frozen prompt differ');
  }
  if (mode === 'timeout' || mode === 'cancel') return;
  send({ id: request.id, result: { turn: { id: turnId(), status: 'inProgress', items: [] } } });
  if (mode === 'after-start-timeout') return;
  completedTurn(kind === 'initial' ? structuredClone(INITIAL)
    : confirmation(row === '01' ? 'Bea' : 'Zoë'));
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  if (Buffer.byteLength(buffer) > 1_000_000) throw new Error('Fake request limit');
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (line.trim()) handle(JSON.parse(line));
  }
});
process.stdin.on('end', () => { process.exitCode = 0; });
