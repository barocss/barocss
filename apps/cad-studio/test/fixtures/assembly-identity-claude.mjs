#!/usr/bin/env node
// The controlled Studio client and the external stdio client run the same discovery/use chain.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

export async function discover({ command, args, env }, kind, emit = () => {}) {
  const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'inherit'] });
  const closed = once(child, 'close');
  const lines = createInterface({ input: child.stdout });
  const replies = lines[Symbol.asyncIterator]();
  let id = 0;
  const rpc = async (method, params) => {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) + '\n');
    const reply = await replies.next();
    assert.equal(reply.done, false, method);
    const data = JSON.parse(reply.value);
    assert.equal(data.id, id, method);
    return data;
  };
  const calls = {};
  const call = async (label, name, args) => {
    emit({ type: 'assistant', message: { content: [{ type: 'tool_use', id: label, name: 'mcp__cad__' + name, input: args }] } });
    const wire = await rpc('tools/call', { name, arguments: args });
    const result = wire.result ?? { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: wire.error.message }) }] };
    emit({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: label, is_error: result.isError, content: result.content }] } });
    return (calls[label] = { args, error: wire.error ?? null, isError: result.isError,
      text: JSON.parse(result.content[0].text), structured: result.structuredContent });
  };
  try {
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'D705', version: '0' } });
    const list = await rpc('tools/list');
    await call('describe-assembly', 'describe', { tool: 'assembly', action: 'get' });
    await call('describe-plan', 'describe', { tool: 'requirements', action: 'plan_tasks' });
    const assembly = await call('assembly', 'assembly', { action: 'get' });
    const ids = assembly.text.instances.map(part => part.id);
    if (kind === 'substitution') {
      await call('base-plan', 'requirements', { action: 'plan_tasks', occurrences: [ids[0]] });
      await call('literal-plan', 'requirements', { action: 'plan_tasks', occurrences: [ids[2]] });
    } else {
      await call('base-plan', 'requirements', { action: 'plan_tasks', occurrences: [ids[0], ids[1]] });
    }
    if (kind === 'collision') {
      await call('literal-plan', 'requirements', { action: 'plan_tasks', occurrences: [ids[2], ids[1]] });
      await call('all-plan', 'requirements', { action: 'plan_tasks', occurrences: ids.slice(0, 3) });
      const faces_of = assembly.text.instances[3].parts_inside[0].path;
      await call('nested-faces', 'assembly', { action: 'get', faces_of });
      await call('missing-faces', 'assembly', { action: 'get', faces_of: 'sub/missing' });
      await call('nested-plan', 'requirements', { action: 'plan_tasks', occurrences: [faces_of, ids[1]] });
    }
    await call('old-tool', 'get_assembly', {});
    return { init: init.result, tools: list.result.tools, calls };
  } finally {
    child.stdin.end();
    lines.close();
    let timer;
    try {
      const [code] = await Promise.race([closed, new Promise((_, reject) => {
        timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('The owned MCP process did not exit')); }, 5000);
      })]);
      assert.equal(code, 0);
    } finally { clearTimeout(timer); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args[0] === '--version') process.stdout.write('0.0.0 (scripted)\n');
  else {
    const mcp = JSON.parse(args[args.indexOf('--mcp-config') + 1]).mcpServers.cad;
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const prompt = JSON.parse(input).message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
    const kind = /D705 (single|collision|substitution)/.exec(prompt)?.[1];
    assert.ok(kind, 'Expected a fixture prompt');
    const say = event => process.stdout.write(JSON.stringify({ ...event, session_id: 'd705' }) + '\n');
    say({ type: 'system', subtype: 'init' });
    const trace = await discover(mcp, kind, say);
    appendFileSync(process.env.CAD_D705_TRACE, JSON.stringify(trace) + '\n');
    say({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Assembly discovery complete.' } }, parent_tool_use_id: null });
    say({ type: 'result', subtype: 'success', is_error: false, result: 'done' });
  }
}
