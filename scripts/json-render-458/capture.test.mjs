import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { capture } from './capture.mjs';
import { stubTransport } from './stub.mjs';

const hash = 'a'.repeat(64);
const fresh = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-test-')), 'run');
test('valid stub accounts for all 24 slots and six complete histories', async () => {
  const dir = fresh();
  const rows = await capture({ outputDir: dir, transport: stubTransport('valid'), planHash: hash, synthetic: true });
  assert.equal(rows.length, 24);
  assert.equal(rows.filter((row) => row.attempted).length, 24);
  assert.equal(rows.filter((row) => row.status === 'valid').length, 21);
  assert.equal(rows.filter((row) => row.status === 'declared-unexpressible').length, 3);
  const last = JSON.parse(fs.readFileSync(path.join(dir, 'attempt-03/request.json')));
  assert.equal(JSON.parse(last.prompt).transcript.length, 7);
  assert.equal(fs.readdirSync(dir).filter((name) => name.startsWith('attempt-')).length, 24);
  await assert.rejects(capture({ outputDir: dir, transport: stubTransport(), planHash: hash, synthetic: true }), /already exists/);
});
test('malformed/truncated/schema responses block only their own later session stages', async () => {
  for (const mode of ['malformed', 'truncated', 'schema']) {
    const rows = await capture({ outputDir: fresh(), transport: stubTransport(mode), planHash: hash, synthetic: true });
    assert.equal(rows[0].status, mode === 'schema' ? 'schema' : 'parse');
    assert.deepEqual(rows.slice(1, 4).map((row) => row.status), ['skipped-session', 'skipped-session', 'skipped-session']);
    assert.equal(rows.filter((row) => row.attempted).length, 21);
    assert.equal(rows.length, 24);
  }
});
test('timeout, quota and missing usage consume one reservation then stop globally', async () => {
  for (const mode of ['timeout', 'quota', 'missing-usage']) {
    const dir = fresh();
    const rows = await capture({ outputDir: dir, transport: stubTransport(mode), planHash: hash, synthetic: true });
    assert.equal(rows[0].status, mode);
    assert.equal(rows.filter((row) => row.attempted).length, 1);
    assert.equal(rows.filter((row) => row.status === 'skipped-global').length, 23);
    assert.ok(fs.existsSync(path.join(dir, 'attempt-00/reservation.json')));
    assert.equal(rows.length, 24);
  }
});
