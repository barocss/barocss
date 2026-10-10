import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export function observer(path) {
  const child = spawn('python3', [path], { stdio: ['pipe', 'pipe', 'pipe'] });
  let pending = null, stderr = '';
  child.stderr.on('data', data => stderr += data);
  createInterface({ input: child.stdout }).on('line', line => {
    if (!pending) throw new Error('unsolicited geometry output');
    const request = pending; pending = null;
    try { request.resolve(JSON.parse(line)); } catch (error) { request.reject(error); }
  });
  child.on('error', error => pending?.reject(error));
  child.on('exit', code => { if (pending) { pending.reject(new Error(`geometry exit ${code}: ${stderr}`)); pending = null; } });
  return {
    ask(data) { assert.equal(pending, null); return new Promise((resolve, reject) => { pending = { resolve, reject }; child.stdin.write(JSON.stringify(data) + '\n'); }); },
    close() { child.stdin.end(); },
    stderr() { return stderr; },
  };
}
