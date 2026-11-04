// Local HTTP/build smoke for the reusable entry. No browser or World execution.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { makeCases } from './cases.mjs';

const here = import.meta.dirname, root = resolve(here, '../..'), id = process.argv[2];
assert.ok(/^[a-z0-9-]+$/.test(id ?? '') && process.argv.length === 3);
const out = join(here, 'evidence', id); mkdirSync(out);
const pin = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const frozen = Object.fromEntries(['dev.mjs', 'cases.mjs', 'dev-smoke.mjs'].map(p => [p, pin(join(here, p))]));
const child = spawn(process.execPath, [join(here, 'dev.mjs')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '', stderr = '', failure = null, exited = false;
child.stderr.on('data', data => { stderr += data; });
const completed = new Promise(resolve => child.once('exit', (code, signal) => { exited = true; resolve({ code, signal }); }));
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('developer preview ready within 10s')), 10000);
    child.stdout.on('data', data => {
      stdout += data;
      if (stdout.includes('Physics gallery developer preview:')) { clearTimeout(timeout); resolve(); }
    });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => { clearTimeout(timeout); reject(Error('preview exited before ready')); });
  });
  const origin = 'http://127.0.0.1:53050';
  const modelResponse = await fetch(origin + '/models'); assert.equal(modelResponse.status, 200);
  assert.deepEqual(await modelResponse.json(), Object.fromEntries(makeCases().map(c => [c.caseId, c])));
  for (const path of ['/', '/app.mjs', '/worker.mjs', '/style.css']) {
    const response = await fetch(origin + path); assert.equal(response.status, 200);
    assert.ok((await response.text()).length > 0);
  }
  const forbidden = await fetch(origin + '/capture/probe', { method: 'POST', body: '{}' });
  assert.equal(forbidden.status, 404); // Development mode exposes no evidence capture route.
  assert.equal(stderr, '');
} catch (error) { failure = { name: error.name, message: error.message }; process.exitCode = 1; }
finally {
  if (!exited) child.kill('SIGTERM');
  let stopTimer;
  const stop = await Promise.race([completed, new Promise(resolve => { stopTimer = setTimeout(() => resolve(null), 5000); })]);
  clearTimeout(stopTimer);
  if (!stop) { child.kill('SIGKILL'); await completed; failure ??= { message: 'graceful owned preview stop failed' }; process.exitCode = 1; }
  for (const [p, sha] of Object.entries(frozen)) assert.equal(pin(join(here, p)), sha);
  writeFileSync(join(out, 'stdout.raw'), stdout, { flag: 'wx' });
  writeFileSync(join(out, 'stderr.raw'), stderr, { flag: 'wx' });
  const result = { status: failure ? 'GALLERY_DEVELOPER_ENTRY_NO_GO' : 'GALLERY_DEVELOPER_ENTRY_BUILDS_AND_SERVES',
    failure, frozen, childStopped: exited, stop, modelCases: 6, getAssets: 4,
    captureRoute: 'NOT_EXPOSED', worldCalls: 0, browserCalls: 0, libraryCompilerCalls: 0, publication: false };
  writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
}
