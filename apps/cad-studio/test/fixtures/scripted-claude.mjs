#!/usr/bin/env node
// A scripted stand-in for the `claude` CLI (CAD_STUDIO_CLAUDE), for the browser flow: it runs the real chat
// server's turn against the real studio tool server (server/cadMcp.ts) with no model. The message carries the
// calls to make as `script {"calls": [{ "tool": …, "args": … }, …]}`; each is made through MCP in order and
// reported as stream-json, as the CLI reports a model's tool calls.
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const args = process.argv.slice(2);
if (args[0] === '--version') { process.stdout.write('0.0.0 (scripted)\n'); process.exit(0); }
const cad = JSON.parse(args[args.indexOf('--mcp-config') + 1]).mcpServers.cad;
let input = '';
for await (const chunk of process.stdin) input += chunk;
const text = JSON.parse(input).message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
// (Rows rule b: a call names a file the person attached as "$file:<its name>"; the id is read off the chat server's note
// of the turn's files — "rows-…: "name" (user turn …)" — as a model reads it there. An unknown name is left as it is,
// and the tool refuses it.)
const fileId = name => new RegExp(`(rows-[0-9a-f]+): ${JSON.stringify(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).exec(text)?.[1];
const withFiles = v => typeof v === 'string' && v.startsWith('$file:') ? fileId(v.slice(6)) ?? v : Array.isArray(v) ? v.map(withFiles) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withFiles(x)])) : v;
const calls = withFiles(JSON.parse(/script (\{[\s\S]*\})/.exec(text)?.[1] ?? '{"calls":[]}').calls);

const server = spawn(cad.command, cad.args, { env: { ...process.env, ...cad.env }, stdio: ['pipe', 'pipe', 'inherit'] });
const waiting = new Map();
createInterface({ input: server.stdout }).on('line', line => { const m = JSON.parse(line); waiting.get(m.id)?.(m); });
let id = 0;
const request = (method, params) => new Promise(resolve => { const n = ++id; waiting.set(n, resolve); server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
const say = o => process.stdout.write(JSON.stringify({ ...o, session_id: 'scripted' }) + '\n');

say({ type: 'system', subtype: 'init' });
await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'scripted', version: '0' } });
for (const [k, call] of calls.entries()) {
  // (A pause, `{"pause": ms}`: a slow turn, so the flow can edit the part while it runs, O133.)
  if (typeof call.pause === 'number') { await new Promise(resolve => setTimeout(resolve, call.pause)); continue; }
  say({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `toolu_${k}`, name: `mcp__cad__${call.tool}`, input: call.args }] } });
  // (A JSON-RPC error — an unknown tool, O105 — comes back to the model as a failed call, as the CLI reports it.)
  const m = await request('tools/call', { name: call.tool, arguments: call.args });
  const r = m.result ?? { isError: true, content: [{ type: 'text', text: JSON.stringify({ ok: false, error: m.error?.message ?? 'no result' }) }] };
  // (The A/B harness, A5.5: each call's size, to estimate what a model would read and write.)
  if (process.env.CAD_AB_LOG) appendFileSync(process.env.CAD_AB_LOG, JSON.stringify({ tool: call.tool, args: JSON.stringify(call.args ?? {}).length, result: r.content.filter(c => c.type === 'text').map(c => c.text).join('').length, isError: r.isError }) + '\n');
  say({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `toolu_${k}`, is_error: r.isError, content: r.content.filter(c => c.type === 'text') }] } });
}
say({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `Scripted: ${calls.filter(c => typeof c.pause !== 'number').length} call${calls.filter(c => typeof c.pause !== 'number').length === 1 ? '' : 's'}.` } }, parent_tool_use_id: null });
server.stdin.end();
await new Promise(resolve => server.on('close', resolve));
// (O15's dry run: a cost as the live CLI reports it, to test the run's guards.)
say({ type: 'result', subtype: 'success', is_error: false, result: 'done', ...(process.env.CAD_SCRIPTED_COST_USD ? { total_cost_usd: Number(process.env.CAD_SCRIPTED_COST_USD), num_turns: calls.length + 1 } : {}) });
