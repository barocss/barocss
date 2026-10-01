// Deterministic test process. This module never spawns an executable or invokes a model.
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { writeFileSync } from 'node:fs';
export const CODEX_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
export function fakeCodex(options = {}) {
  const calls = [], kills = [];
  const spawnProcess = (file, argv, setup) => {
    if (options.spawnError) throw new Error('authored uncertain start');
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = (signal) => { kills.push(signal); queueMicrotask(() => child.emit('close', null)); return true; };
    const call = { file, argv, setup, child, stdin: '' }; calls.push(call);
    child.stdin = new Writable({ write(chunk, encoding, done) { call.stdin += chunk.toString(); done(); }, final(done) {
      done(); queueMicrotask(() => {
        if (options.hang) return;
        const prompt = JSON.parse(call.stdin);
        let spec = structuredClone(prompt.requiredStageTemplate);
        options.mutateSpec?.(spec, calls.length);
        const outer = { specJson: options.invalidJSON ? '{' : JSON.stringify(spec) };
        const text = JSON.stringify(outer);
        writeFileSync(argv[argv.indexOf('--output-last-message') + 1], text+'\n', { flag: 'wx', mode: 0o600 });
        const events = [];
        if (!options.missingIdentity) events.push({ type: 'thread.started', ...(options.model ? { model: options.model } : {}), thread_id: options.drift && calls.length > 1
          ? 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee' : CODEX_ID });
        events.push({ type: 'turn.started' });
        if (options.tool) events.push({ type: 'item.started', item: { type: 'command_execution', command: 'authored-not-executed' } });
        events.push({ type: 'item.completed', item: { type: 'agent_message', text } }, { type: 'turn.completed' });
        const bytes = Buffer.from(events.map((event) => JSON.stringify(event)).join('\n')+'\n');
        // Preserve original bytes even when a multibyte character is split across chunks.
        const split = bytes.indexOf(Buffer.from('민')) + 1;
        child.stdout.write(bytes.subarray(0, split)); child.stdout.write(bytes.subarray(split));
        child.stdout.end(); child.stderr.end(); child.emit('close', 0);
      });
    } });
    return child;
  };
  return { calls, kills, spawnProcess };
}
