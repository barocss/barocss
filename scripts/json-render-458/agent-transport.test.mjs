import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runAgentCodex } from './agent-transport.mjs';
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
