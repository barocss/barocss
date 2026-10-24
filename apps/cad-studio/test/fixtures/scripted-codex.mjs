#!/usr/bin/env node
// A scripted stand-in for `codex exec --json` (P1-L3's dry run): no model. It starts the MCP server the arguments
// configure (-c mcp_servers.cad.command / .args), and the brief on stdin carries the calls to make as
// `script {"calls": [{ "tool": …, "args": … }, …]}`; each is made through MCP in order and reported as Codex's JSONL
// events (thread.started, turn.started, item.started / item.completed of an mcp_tool_call, agent_message,
// turn.completed with usage). `{"shell": "…"}` reports a command_execution item instead (an off-contract call);
// CAD_SCRIPTED_SLEEP_MS: a run that hangs (the wall clock's check).
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const args = process.argv.slice(2);
const conf = key => { for (let i = 0; i < args.length; i++) if (args[i] === '-c' && args[i + 1].startsWith(`${key}=`)) return JSON.parse(args[i + 1].slice(key.length + 1)); return undefined; };
const lastPath = args[args.indexOf('-o') + 1];
let brief = '';
for await (const chunk of process.stdin) brief += chunk;
const calls = JSON.parse(/script (\{[\s\S]*\})/.exec(brief)?.[1] ?? '{"calls":[]}').calls;
const say = o => process.stdout.write(JSON.stringify(o) + '\n');
say({ type: 'thread.started', thread_id: 'scripted' });
say({ type: 'turn.started' });
if (process.env.CAD_SCRIPTED_SLEEP_MS) await new Promise(res => setTimeout(res, Number(process.env.CAD_SCRIPTED_SLEEP_MS)));

const server = spawn(conf('mcp_servers.cad.command'), conf('mcp_servers.cad.args'), { stdio: ['pipe', 'pipe', 'inherit'] });
const waiting = new Map();
createInterface({ input: server.stdout }).on('line', line => { const m = JSON.parse(line); waiting.get(m.id)?.(m); });
let id = 0;
const request = (method, params) => new Promise(resolve => { const n = ++id; waiting.set(n, resolve); server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'scripted-codex', version: '0' } });
for (const [k, call] of calls.entries()) {
  if (call.shell) { say({ type: 'item.completed', item: { id: `item_${k}`, type: 'command_execution', command: call.shell, status: 'completed' } }); continue; }
  const item = { id: `item_${k}`, type: 'mcp_tool_call', server: 'cad', tool: call.tool, arguments: call.args };
  say({ type: 'item.started', item: { ...item, status: 'in_progress' } });
  const r = await request('tools/call', { name: call.tool, arguments: call.args });
  say({ type: 'item.completed', item: { ...item, status: r.error ? 'failed' : 'completed', ...(r.error ? { error: { message: r.error.message } } : { result: { content: r.result.content, is_error: !!r.result.isError } }) } });
}
server.stdin.end();
const last = `scripted: ${calls.length} calls`;
say({ type: 'item.completed', item: { id: 'item_last', type: 'agent_message', text: last } });
say({ type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 10 } });
if (lastPath) writeFileSync(lastPath, last);
