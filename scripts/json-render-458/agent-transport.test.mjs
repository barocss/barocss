import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { runAgentCodex } from './agent-transport.mjs';
import { MAX_STDERR_BYTES, verifyAgentDiagnostics } from './agent-diagnostics.mjs';
import { SCRATCH_PARENT } from './agent-profile.mjs';

const fixture = () => {
  const cwd = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'agent-scratch-458-'));
  const attemptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-agent-attempt-'));
  const home = path.join(cwd, 'home');
  fs.mkdirSync(home);
  const schemaPath = path.join(cwd, 'schema.json');
  fs.writeFileSync(schemaPath, '{}');
  return { cwd, attemptDir, home, schemaPath, codexHome: path.join(os.homedir(), '.codex'), nodeBin: path.dirname(process.execPath) };
};
const script = (dir, body) => {
  const file = path.join(dir, 'fake-codex.sh');
  fs.writeFileSync(file, `#!/bin/bash\n${body}\n`, { mode: 0o700 });
  return file;
};
const jsScript = (dir, body) => {
  const file = path.join(dir, 'fake-codex.mjs');
  fs.writeFileSync(file, `#!${process.execPath}\n${body}\n`, { mode: 0o700 });
  return file;
};
const clean = (parts) => { fs.rmSync(parts.cwd, { recursive: true, force: true }); fs.rmSync(parts.attemptDir, { recursive: true, force: true }); };

test('fake CLI command is retained as observable tool evidence without output or reasoning text', async () => {
  const parts = fixture();
  try {
    const final = '{"specJson":"{}","cannotExpress":false}';
    const cliPath = script(parts.attemptDir, `out=''\nwhile [ "$#" -gt 0 ]; do if [ "$1" = '--output-last-message' ]; then out="$2"; shift 2; else shift; fi; done\nprintf '%s\\n' '{"type":"thread.started","thread_id":"stub"}' '{"type":"turn.started"}' '{"type":"item.completed","item":{"type":"command_execution","id":"one","command":"pwd","aggregated_output":"scratch output","exit_code":0,"status":"completed"}}' '{"type":"item.completed","item":{"type":"reasoning","text":"PRIVATE REASONING"}}' '{"type":"item.completed","item":{"type":"agent_message","text":"${final.replaceAll('"', '\\"')}"}}' '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}'\nprintf '%s' '${final}' > "$out"`);
    const result = await runAgentCodex({ ...parts, cliPath, prompt: 'stub prompt', timeoutMs: 3000 });
    assert.equal(result.stopReason, null);
    assert.equal(result.toolCount, 1);
    assert.equal(result.rawFinal, final);
    const events = fs.readFileSync(path.join(parts.attemptDir, 'events.jsonl'), 'utf8');
    assert.match(events, /"command":"pwd"/);
    assert.doesNotMatch(events, /scratch output|PRIVATE REASONING/);
    await assert.rejects(runAgentCodex({ ...parts, cliPath, prompt: 'stub prompt', timeoutMs: 3000 }), /Attempt output already exists/);
  } finally { clean(parts); }
});

test('unexpected tool, timeout and incomplete final fail without retry', async () => {
  for (const [body, expected, timeoutMs] of [
    [`printf '%s\\n' '{"type":"item.started","item":{"type":"file_change"}}'`, /unexpected-tool/, 3000],
    ['sleep 2', /timeout/, 100],
    [`printf '%s\\n' '{"type":"turn.started"}'`, /missing-completion-event/, 3000],
  ]) {
    const parts = fixture();
    try {
      const result = await runAgentCodex({ ...parts, cliPath: script(parts.attemptDir, body), prompt: 'stub', timeoutMs });
      assert.match(result.stopReason, expected);
    } finally { clean(parts); }
  }
});

test('automatic approval denial on fragmented stderr stops even after a zero exit', async () => {
  const parts = fixture();
  try {
    const cliPath = jsScript(parts.attemptDir, `
import fs from 'node:fs';
const out = process.argv[process.argv.indexOf('--output-last-message') + 1];
fs.writeFileSync(out, '{"specJson":"{}","cannotExpress":false}');
process.stderr.write('Automatic app');
setTimeout(() => { process.stderr.write('roval review denied the action\\n'); process.exit(0); }, 20);
`);
    const result = await runAgentCodex({ ...parts, cliPath, prompt: 'stub', timeoutMs: 3000 });
    assert.equal(result.stopReason, 'approval-or-sandbox');
    const diagnostics = verifyAgentDiagnostics(parts.attemptDir);
    assert.equal(diagnostics.summary.stderrTruncated, false);
    assert.equal(diagnostics.summary.errorItemBytes, 0);
    assert.equal(fs.readFileSync(path.join(parts.attemptDir, 'stderr.txt'), 'utf8'), 'Automatic approval review denied the action\n');
  } finally { clean(parts); }
});

test('fake CLI error item and stderr remain private, bounded, and bound to the filtered event', async () => {
  const parts = fixture();
  try {
    const message = 'safe diagnostic marker';
    const item = JSON.stringify({ type: 'item.completed', item: { type: 'error', message } });
    const cliPath = jsScript(parts.attemptDir, `
process.stdout.write(${JSON.stringify(item + '\n')});
process.stderr.write('safe stderr marker\\n');
setTimeout(() => process.exit(0), 20);
`);
    const result = await runAgentCodex({ ...parts, cliPath, prompt: 'stub', timeoutMs: 3000 });
    assert.equal(result.stopReason, 'error-item:other');
    assert.ok(result.signal === 'SIGTERM' || result.signal === 'SIGKILL' || result.exitCode === 0);
    const events = fs.readFileSync(path.join(parts.attemptDir, 'events.jsonl'), 'utf8');
    assert.match(events, /"itemType":"error"/);
    assert.doesNotMatch(events, /safe diagnostic marker|safe stderr marker/);
    const diagnostics = verifyAgentDiagnostics(parts.attemptDir);
    assert.equal(diagnostics.summary.errorItemClass, 'other');
    assert.equal(diagnostics.summary.errorItemTruncated, false);
    assert.equal(fs.readFileSync(path.join(parts.attemptDir, 'error-item.jsonl'), 'utf8'), item + '\n');
    assert.equal(fs.readFileSync(path.join(parts.attemptDir, 'stderr.txt'), 'utf8'), 'safe stderr marker\n');
    for (const file of ['error-item.jsonl', 'stderr.txt', 'diagnostics.json']) {
      assert.equal(fs.statSync(path.join(parts.attemptDir, file)).mode & 0o777, 0o400);
    }
    const errorPath = path.join(parts.attemptDir, 'error-item.jsonl');
    fs.chmodSync(errorPath, 0o600);
    fs.appendFileSync(errorPath, 'tamper');
    assert.throws(() => verifyAgentDiagnostics(parts.attemptDir), /binding drift/);
  } finally { clean(parts); }
});

test('a synthetic deprecated-feature notice remains a stop, never a model success', async () => {
  const parts = fixture();
  try {
    const notice = 'The features.web_search_request feature is deprecated; set web search in config if needed.';
    const events = [
      { type: 'item.completed', item: { type: 'error', message: notice } },
      { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } },
    ].map((event) => JSON.stringify(event)).join('\n') + '\n';
    const cliPath = jsScript(parts.attemptDir, `
process.stdout.write(${JSON.stringify(events)});
setTimeout(() => process.exit(0), 20);
`);
    const result = await runAgentCodex({ ...parts, cliPath, prompt: 'stub', timeoutMs: 3000 });
    assert.equal(result.stopReason, 'error-item:other');
    assert.equal(result.eventCount, 1);
    assert.equal(result.usage, null);
    assert.equal(verifyAgentDiagnostics(parts.attemptDir).summary.errorItemClass, 'other');
  } finally { clean(parts); }
});

test('fake CLI stderr is capped and stops the attempt without a retry', async () => {
  const parts = fixture();
  try {
    const cliPath = jsScript(parts.attemptDir, `
process.stderr.write('x'.repeat(${MAX_STDERR_BYTES + 4096}));
setTimeout(() => process.exit(0), 20);
`);
    const result = await runAgentCodex({ ...parts, cliPath, prompt: 'stub', timeoutMs: 3000 });
    assert.equal(result.stopReason, 'stderr-limit');
    const diagnostics = verifyAgentDiagnostics(parts.attemptDir);
    assert.equal(diagnostics.summary.stderrBytes, MAX_STDERR_BYTES);
    assert.equal(diagnostics.summary.stderrTruncated, true);
    assert.equal(diagnostics.summary.errorItemBytes, 0);
  } finally { clean(parts); }
});

test('transport drains a delayed inherited stdout pipe before judging completion', async () => {
  const parts = fixture();
  try {
    const final = '{"specJson":"{}","cannotExpress":false}';
    const lines = [
      { type: 'thread.started', thread_id: 'stub' },
      { type: 'turn.started' },
      { type: 'item.completed', item: { type: 'agent_message', text: final } },
      { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 5 } },
    ].map((event) => JSON.stringify(event)).join('\n') + '\n';
    const cliPath = jsScript(parts.attemptDir, `
import fs from 'node:fs';
import { spawn } from 'node:child_process';
const out = process.argv[process.argv.indexOf('--output-last-message') + 1];
fs.writeFileSync(out, ${JSON.stringify(final)});
spawn(process.execPath, ['-e', ${JSON.stringify(`setTimeout(() => process.stdout.write(${JSON.stringify(lines)}), 150);`)}],
  { stdio: ['ignore', 'inherit', 'inherit'] });
process.exit(0);
`);
    const result = await runAgentCodex({ ...parts, cliPath, prompt: 'stub', timeoutMs: 3000 });
    assert.equal(result.stopReason, null);
    assert.equal(result.eventCount, 4);
    assert.ok(result.elapsedMs >= 100);
  } finally { clean(parts); }
});

test('separate wrapper exits only after a SIGTERM-ignoring owned child is gone', () => {
  const parts = fixture();
  const pidPath = path.join(parts.attemptDir, 'owned-child.pid');
  let ownedPid;
  try {
    const cliPath = jsScript(parts.attemptDir, `
import fs from 'node:fs';
import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"],
  { stdio: ['ignore', 'inherit', 'inherit'] });
fs.writeFileSync(${JSON.stringify(pidPath)}, String(child.pid));
setTimeout(() => process.exit(0), 150);
`);
    const wrapper = path.join(parts.attemptDir, 'wrapper.mjs');
    const resultPath = path.join(parts.attemptDir, 'wrapper-result.json');
    fs.writeFileSync(wrapper, `
import fs from 'node:fs';
import { runAgentCodex } from ${JSON.stringify(pathToFileURL(path.join(import.meta.dirname, 'agent-transport.mjs')).href)};
const result = await runAgentCodex({ cliPath: ${JSON.stringify(cliPath)}, cwd: ${JSON.stringify(parts.cwd)},
  home: ${JSON.stringify(parts.home)}, codexHome: ${JSON.stringify(parts.codexHome)},
  nodeBin: ${JSON.stringify(parts.nodeBin)}, schemaPath: ${JSON.stringify(parts.schemaPath)},
  attemptDir: ${JSON.stringify(parts.attemptDir)}, prompt: 'stub', timeoutMs: 6000 });
fs.writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify({ stopReason: result.stopReason, elapsedMs: result.elapsedMs }));
`);
    const wrapperExit = spawnSync(process.execPath, [wrapper], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(wrapperExit.status, 0, wrapperExit.stderr);
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    assert.equal(result.stopReason, 'stdio-drain-timeout');
    assert.ok(result.elapsedMs < 5000, `bounded drain took ${result.elapsedMs}ms`);
    ownedPid = Number(fs.readFileSync(pidPath, 'utf8'));
    const state = spawnSync('/bin/ps', ['-o', 'stat=', '-p', String(ownedPid)], { encoding: 'utf8' }).stdout.trim();
    assert.ok(!state || state.startsWith('Z'), `owned child survived wrapper exit: ${state}`);
  } finally {
    if (ownedPid) { try { process.kill(ownedPid, 'SIGKILL'); } catch { /* exited */ } }
    clean(parts);
  }
});
