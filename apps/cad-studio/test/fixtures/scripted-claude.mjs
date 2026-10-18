#!/usr/bin/env node
// A scripted stand-in for the `claude` CLI (CAD_STUDIO_CLAUDE), for the browser flow: it runs the real chat
// server's turn against the real studio tool server (server/cadMcp.ts) with no model. The message carries the
// calls to make as `script {"calls": [{ "tool": …, "args": … }, …]}`; each is made through MCP in order and
// reported as stream-json, as the CLI reports a model's tool calls.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const args = process.argv.slice(2);
if (args[0] === '--version') { process.stdout.write('0.0.0 (scripted)\n'); process.exit(0); }
const cad = JSON.parse(args[args.indexOf('--mcp-config') + 1]).mcpServers.cad;
let input = '';
for await (const chunk of process.stdin) input += chunk;
const text = JSON.parse(input).message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
const calls = JSON.parse(/script (\{[\s\S]*\})/.exec(text)?.[1] ?? '{"calls":[]}').calls;

const server = spawn(cad.command, cad.args, { env: { ...process.env, ...cad.env }, stdio: ['pipe', 'pipe', 'inherit'] });
const waiting = new Map();
createInterface({ input: server.stdout }).on('line', line => { const m = JSON.parse(line); waiting.get(m.id)?.(m); });
let id = 0;
const request = (method, params) => new Promise(resolve => { const n = ++id; waiting.set(n, resolve); server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
const say = o => process.stdout.write(JSON.stringify({ ...o, session_id: 'scripted' }) + '\n');

say({ type: 'system', subtype: 'init' });
await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'scripted', version: '0' } });
for (const [k, call] of calls.entries()) {
  say({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `toolu_${k}`, name: `mcp__cad__${call.tool}`, input: call.args }] } });
  const r = (await request('tools/call', { name: call.tool, arguments: call.args })).result;
  say({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `toolu_${k}`, is_error: r.isError, content: r.content.filter(c => c.type === 'text') }] } });
}
say({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `Scripted: ${calls.length} call${calls.length === 1 ? '' : 's'}.` } }, parent_tool_use_id: null });
server.stdin.end();
await new Promise(resolve => server.on('close', resolve));
say({ type: 'result', subtype: 'success', is_error: false, result: 'done' });
