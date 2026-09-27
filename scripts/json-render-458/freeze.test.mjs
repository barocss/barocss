import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyFrozen } from './freeze.mjs';
import { liveTransport } from './live.mjs';

test('frozen manifest matches the exact local contract files', () => {
  assert.match(verifyFrozen(), /^[a-f0-9]{64}$/);
});

test('live transport rejects before any Codex process can start', () => {
  assert.throws(() => liveTransport({ approvalPath: '/nonexistent', outputDir: '/private/tmp/unused', planHash: verifyFrozen() }),
    /Live pilot blocked: no verified pre-dispatch tool isolation/);
});
