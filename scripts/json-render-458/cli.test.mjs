import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildArgv, cleanEnv, runCodex, sanitizeEvent } from './cli.mjs';

const fixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-cli-'));
  const cwd = path.join(root, 'empty'), attemptDir = path.join(root, 'attempt'), home = path.join(root, 'home');
  for (const dir of [cwd, attemptDir, home]) fs.mkdirSync(dir);
  const schemaPath = path.join(root, 'schema.json'); fs.writeFileSync(schemaPath, '{}');
  return { root, cwd, attemptDir, home, schemaPath, codexHome: home, nodeBin: path.dirname(process.execPath) };
};
const script = (root, body) => {
  const file = path.join(root, 'fake-codex.sh');
  fs.writeFileSync(file, `#!/bin/bash\n${body}\n`, { mode: 0o700 });
  return file;
};
const invoke = (parts, cliPath) => runCodex({ ...parts, cliPath, prompt: 'stub prompt', timeoutMs: 3000 });

test('CLI args and clean environment keep the requested model and no inherited environment', () => {
  const args = buildArgv({ cwd: '/private/tmp/empty', schemaPath: '/private/tmp/schema', finalPath: '/private/tmp/final' });
  assert.ok(args.includes('--ignore-user-config'));
  assert.ok(args.includes('gpt-6-sol'));
  assert.ok(args.includes('model_reasoning_effort="high"'));
  assert.ok(args.includes('shell_tool'));
  assert.deepEqual(Object.keys(cleanEnv({ home: '/private/tmp/home', codexHome: '/private/tmp/codex', nodeBin: '/usr/bin' })).sort(),
    ['CODEX_HOME', 'HOME', 'LANG', 'NO_COLOR', 'PATH', 'TERM']);
});

test('event sanitizer drops hidden reasoning and rejects tool items', () => {
  assert.deepEqual(sanitizeEvent(JSON.stringify({ type: 'item.completed', item: { type: 'reasoning', text: 'hidden reasoning' } })),
    { type: 'item.completed', itemType: 'reasoning' });
  assert.throws(() => sanitizeEvent(JSON.stringify({ type: 'item.started', item: { type: 'command_execution', command: 'pwd' } })), /tool-or-unknown-item/);
  assert.throws(() => sanitizeEvent('{broken'), /malformed-event/);
});

test('fake CLI response retains only final/usage provenance and refuses duplicate output', async () => {
  const parts = fixture();
  try {
    const final = '{"specJson":"{}","cannotExpress":false}';
    const cliPath = script(parts.root, `out=''\nwhile [ "$#" -gt 0 ]; do if [ "$1" = '--output-last-message' ]; then out="$2"; shift 2; else shift; fi; done\nprintf '%s\\n' '{"type":"thread.started","thread_id":"stub"}' '{"type":"turn.started"}' '{"type":"item.completed","item":{"type":"reasoning","text":"PRIVATE REASONING"}}' '{"type":"item.completed","item":{"type":"agent_message","text":"${final.replaceAll('"', '\\"')}"}}' '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}'\nprintf '%s' '${final}' > "$out"`);
    const result = await invoke(parts, cliPath);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stopReason, null);
    assert.equal(result.rawFinal, final);
    assert.deepEqual(result.usage, { input_tokens: 10, output_tokens: 5 });
    const eventLog = fs.readFileSync(path.join(parts.attemptDir, 'events.jsonl'), 'utf8');
    assert.doesNotMatch(eventLog, /PRIVATE REASONING/);
    await assert.rejects(invoke(parts, cliPath), /Attempt output already exists/);
  } finally { fs.rmSync(parts.root, { recursive: true, force: true }); }
});

test('fake CLI tool event and absent completion fail closed', async () => {
  for (const body of [
    `printf '%s\\n' '{"type":"item.started","item":{"type":"command_execution","command":"pwd"}}'`,
    `printf '%s\\n' '{"type":"thread.started","thread_id":"stub"}'`,
  ]) {
    const parts = fixture();
    try {
      const result = await invoke(parts, script(parts.root, body));
      assert.match(result.stopReason, /tool-or-unknown-item|missing-completion-event/);
    } finally { fs.rmSync(parts.root, { recursive: true, force: true }); }
  }
});
