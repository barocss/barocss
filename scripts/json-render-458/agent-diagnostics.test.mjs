import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAgentDiagnostics, MAX_ERROR_ITEM_BYTES, verifyAgentDiagnostics } from './agent-diagnostics.mjs';

test('private CLI error item retention is bounded and rejects hidden reasoning', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-diagnostics-'));
  try {
    const diagnostics = createAgentDiagnostics(dir);
    assert.throws(() => diagnostics.errorItem(JSON.stringify({ type: 'item.completed',
      item: { type: 'error', message: 'safe message', reasoning: 'PRIVATE' } })), /hidden reasoning/);
    assert.throws(() => diagnostics.errorItem(JSON.stringify({ type: 'item.completed',
      hidden_reasoning: 'PRIVATE', item: { type: 'error', message: 'safe message' } })), /hidden reasoning/);
    const error = JSON.stringify({ type: 'item.completed',
      item: { type: 'error', message: 'x'.repeat(MAX_ERROR_ITEM_BYTES) } });
    assert.equal(diagnostics.errorItem(error), 'other');
    diagnostics.close();
    const verified = verifyAgentDiagnostics(dir);
    assert.equal(verified.summary.errorItemBytes, MAX_ERROR_ITEM_BYTES);
    assert.equal(verified.summary.errorItemTruncated, true);
    assert.equal(fs.readFileSync(path.join(dir, 'error-item.jsonl')).length, MAX_ERROR_ITEM_BYTES);
    assert.equal(fs.readFileSync(path.join(dir, 'stderr.txt')).length, 0);
    assert.equal(fs.statSync(path.join(dir, 'error-item.jsonl')).mode & 0o777, 0o400);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('structured reasoning on stderr is omitted before private persistence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-diagnostics-'));
  try {
    const diagnostics = createAgentDiagnostics(dir);
    assert.equal(diagnostics.stderr('{"type":"reason'), null);
    assert.equal(diagnostics.stderr('ing","text":"ARTIFICIAL CANARY"}\n'), 'stderr-hidden-reasoning');
    assert.equal(diagnostics.stderr('later ordinary text'), 'stderr-hidden-reasoning');
    diagnostics.close();
    const verified = verifyAgentDiagnostics(dir);
    assert.equal(verified.summary.stderrOmittedReasoning, true);
    assert.equal(verified.summary.stderrBytes, 0);
    assert.equal(fs.readFileSync(path.join(dir, 'stderr.txt'), 'utf8'), '');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
