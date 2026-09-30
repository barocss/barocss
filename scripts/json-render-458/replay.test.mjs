import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { capture } from './capture.mjs';
import { stubTransport } from './stub.mjs';
import { verifyFrozen } from './freeze.mjs';
import { replaySaved } from './replay.mjs';

const installed = ['JR_ROOT', 'PW_DIR', 'CHROME'].every((name) => process.env[name] && fs.existsSync(process.env[name]));
test('saved stub replay detects lost focus and poisons later browser session stages', { skip: !installed && 'Installed browser/renderer env not provided' }, async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-browser-test-'));
  const captureDir = path.join(parent, 'capture');
  try {
    await capture({ outputDir: captureDir, transport: stubTransport(), planHash: verifyFrozen(), synthetic: true });
    const normal = await replaySaved({ captureDir, outputDir: path.join(parent, 'normal') });
    assert.equal(normal.replay.filter((row) => row.status === 'replayed').length, 24);
    assert.equal(normal.replay.filter((row) => row.sessionSuccess).length, 23);
    assert.deepEqual(normal.replay.filter((row) => !row.overflowFree).map((row) => row.id), ['dashboard--utility--absent']);
    assert.ok(normal.replay.filter((row) => row.session.endsWith('--variable')).every((row) => row.typedVariablePass));
    const faulty = await replaySaved({ captureDir, outputDir: path.join(parent, 'faulty'), faultInjection: 'blur-settings-variable-scalar' });
    const affected = faulty.replay.filter((row) => row.session === 'settings--variable');
    assert.equal(affected[0].sessionSuccess, true);
    assert.equal(affected[1].focusPreserved, false);
    assert.equal(affected[1].sessionSuccess, false);
    assert.ok(affected.slice(2).every((row) => row.sessionSuccess === false));
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});
