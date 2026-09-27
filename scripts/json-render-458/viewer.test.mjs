import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { capture } from './capture.mjs';
import { stubTransport } from './stub.mjs';
import { scoreSaved } from './score.mjs';
import { verifyFrozen } from './freeze.mjs';
import { createViewer, escapeHtml } from './viewer.mjs';
import { verifyCapture } from './provenance.mjs';

test('viewer serves only tokenized read-only saved artifacts on loopback', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-viewer-'));
  const captureDir = path.join(parent, 'capture'), replayDir = path.join(parent, 'replay');
  let server;
  try {
    const rows = await capture({ outputDir: captureDir, transport: stubTransport(), planHash: verifyFrozen(), synthetic: true });
    fs.mkdirSync(replayDir);
    const verified = verifyCapture(captureDir);
    const report = { captureManifestSha256: verified.manifestSha256, captureEvidenceSha256: verified.evidenceSha256,
      scoring: scoreSaved(rows, captureDir), replay: rows.map((row) => ({ id: row.id, status: 'not-run', screen: {}, errors: [] })) };
    fs.writeFileSync(path.join(replayDir, 'report.json'), JSON.stringify(report));
    ({ server } = createViewer({ captureDir, replayDir, token: 'a'.repeat(48) }));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const good = await fetch(`${base}/v/${'a'.repeat(48)}/`);
    assert.equal(good.status, 200);
    const html = await good.text();
    assert.match(html, /Issue 458 saved pilot \(synthetic\)/);
    assert.match(html, /settings--variable--initial/);
    assert.doesNotMatch(html, /<script>/);
    assert.equal((await fetch(`${base}/v/${'b'.repeat(48)}/`)).status, 404);
    assert.equal((await fetch(`${base}/v/${'a'.repeat(48)}/`, { method: 'POST' })).status, 405);
    const spoofedHostStatus = await new Promise((resolve, reject) => http.get(`${base}/v/${'a'.repeat(48)}/`, { headers: { Host: 'evil.example' } }, (response) => { response.resume(); response.on('end', () => resolve(response.statusCode)); }).on('error', reject));
    assert.equal(spoofedHostStatus, 403);
    assert.equal((await fetch(`${base}/v/${'a'.repeat(48)}/../../etc/passwd`)).status, 404);
    assert.equal(escapeHtml('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
