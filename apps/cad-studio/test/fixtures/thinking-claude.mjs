#!/usr/bin/env node
// O17c: a stand-in for the `claude` CLI whose turn streams thinking, as stream-json with partial messages reports a
// model's extended thinking (content_block_delta / thinking_delta), then a line of text — the synthetic recording the
// reasoning event is tested on. No tools, no model. Unverified against the live CLI (the owner's call).
const args = process.argv.slice(2);
if (args[0] === '--version') { process.stdout.write('0.0.0 (thinking)\n'); process.exit(0); }
await new Promise(resolve => { process.stdin.resume(); process.stdin.on('end', resolve); }); // (the user message: not read)
const say = o => process.stdout.write(JSON.stringify({ ...o, session_id: 'thinking' }) + '\n');
say({ type: 'system', subtype: 'init' });
say({ type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } } });
say({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'The part is a plate; ' } } });
say({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'a box will do.' } } });
say({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig' } } });
say({ type: 'stream_event', event: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'A box, then.' } } });
say({ type: 'result', subtype: 'success', is_error: false, result: 'done' });
