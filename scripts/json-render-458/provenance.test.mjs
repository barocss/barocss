import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { capture } from './capture.mjs';
import { stubTransport } from './stub.mjs';
import { verifyFrozen } from './freeze.mjs';
import { verifyCapture } from './provenance.mjs';

test('saved capture provenance binds reservation, raw final and event log', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-provenance-'));
  const outputDir = path.join(parent, 'capture');
  try {
    await capture({ outputDir, transport: stubTransport(), planHash: verifyFrozen(), synthetic: true });
    const verified = verifyCapture(outputDir);
    assert.equal(verified.rows.length, 24);
    assert.match(verified.evidenceSha256, /^[a-f0-9]{64}$/);
    const raw = path.join(outputDir, 'attempt-00/raw-final.txt');
    fs.chmodSync(raw, 0o600);
    fs.appendFileSync(raw, 'tampered');
    assert.throws(() => verifyCapture(outputDir), /Raw final hash mismatch/);
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});

test('transport exception still produces replayable failed-attempt evidence', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-throw-'));
  const outputDir = path.join(parent, 'capture');
  try {
    const rows = await capture({ outputDir, transport: async () => { throw new Error('stub failure'); }, planHash: verifyFrozen(), synthetic: true });
    assert.equal(rows.filter((row) => row.attempted).length, 1);
    assert.equal(fs.readFileSync(path.join(outputDir, 'attempt-00/events.jsonl'), 'utf8'), '');
    assert.equal(verifyCapture(outputDir).rows.length, 24);
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});

test('capture cannot substitute output-owned requirements or support claims', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-plan-tamper-'));
  const outputDir = path.join(parent, 'capture');
  try {
    await capture({ outputDir, transport: stubTransport(), planHash: verifyFrozen(), synthetic: true });
    const rowsPath = path.join(outputDir, 'rows.json');
    const original = fs.readFileSync(rowsPath, 'utf8');
    const rows = JSON.parse(original);
    rows[0].required = { paddingPx: 999 };
    rows[0].support = { supported: false, reason: 'modified' };
    fs.writeFileSync(rowsPath, JSON.stringify(rows));
    assert.throws(() => verifyCapture(outputDir), /Capture plan or schedule mismatch/);
    fs.writeFileSync(rowsPath, original);
    assert.equal(verifyCapture(outputDir).rows.length, 24);
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});
