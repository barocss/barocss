import assert from 'node:assert/strict';
import test from 'node:test';
import { replaySavedStartup } from './saved-startup-replay.mjs';

// Authored source-contract cases. Actual native startup is replayed separately in private storage.
const initialized = { id: 1, result: { codexHome: '/tmp/authored-home', platformFamily: 'unix',
  platformOs: 'macos', userAgent: 'codex-cli 0.156.1' } };
const account = { method: 'account/updated', params: { authMode: 'chatgpt', planType: null } };
const remote = { method: 'remoteControl/status/changed', params: { installationId: 'authored-id',
  serverName: 'authored-server', status: 'disabled', environmentId: null } };
const bytes = (frames) => Buffer.from(frames.map((frame) => JSON.stringify(frame)).join('\n') + '\n');

test('saved metadata ordering and duplicates do not create sessions or UI evidence', () => {
  for (const frames of [[initialized, remote, account], [account, initialized, remote],
    [remote, account, initialized, account]]) {
    const result = replaySavedStartup(bytes(frames));
    assert.equal(result.frames, frames.length);
    assert.equal(result.nativeLaunches, 0);
    assert.equal(result.modelCalls, 0);
    assert.equal(result.uiSamples, 0);
    assert.equal(result.acceptedSessions, 0);
  }
});

test('saved replay rejects malformed, unknown, active, RPC-request, and unowned frames', () => {
  for (const frames of [[account], [initialized, initialized], [initialized, { id: 777, ...account }],
    [initialized, { ...remote, params: { ...remote.params, status: 'connected' } }],
    [initialized, { method: 'thread/status/changed', params: { threadId: 'unowned', status: { type: 'idle' } } }],
    [initialized, { method: 'turn/started', params: { threadId: 'unowned' } }],
    [initialized, { method: 'unknown/startup', params: {} }]]) {
    assert.throws(() => replaySavedStartup(bytes(frames)));
  }
  assert.throws(() => replaySavedStartup(Buffer.from('{malformed')));
});
