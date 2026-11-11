#!/usr/bin/env node
// Controlled Chat client. All check and evidence replies come from the real local MCP server.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

export async function readRequirements({ command, args, env }, parts, emit = () => {}) {
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
  try {
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'D712', version: '0' } });
    assert.equal(init.result.serverInfo.version, 'barocss-cad-tools-v2');
    const calls = {};
    for (const part of parts) {
      calls[part] = {};
      for (const action of ['check', 'evidence']) {
        const label = `${part}-${action}`, input = { action, part };
        emit({ type: 'assistant', message: { content: [{ type: 'tool_use', id: label, name: 'mcp__cad__requirements', input }] } });
        const { result } = await rpc('tools/call', { name: 'requirements', arguments: input });
        emit({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: label, is_error: result.isError, content: result.content }] } });
        const text = JSON.parse(result.content[0].text);
        if (!result.isError) assert.deepEqual(text, result.structuredContent);
        calls[part][action] = { isError: result.isError, text };
      }
    }
    return calls;
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
  if (args[0] === '--version') {
    process.stdout.write('0.0.0 (scripted)\n');
  } else {
    const mcp = JSON.parse(args[args.indexOf('--mcp-config') + 1]).mcpServers.cad;
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const prompt = JSON.parse(input).message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
    const label = /D712 (pair|rotated|sphere|channel|suppressed|deleted|assembly)/.exec(prompt)?.[1];
    assert.ok(label, 'Expected a fixture prompt');
    const parts = label === 'assembly' ? ['bored', 'shaft', 'missing'] : ['base'];
    const say = event => process.stdout.write(JSON.stringify({ ...event, session_id: 'd712' }) + '\n');
    say({ type: 'system', subtype: 'init' });
    appendFileSync(process.env.CAD_D712_TRACE, JSON.stringify({ label, calls: await readRequirements(mcp, parts, say) }) + '\n');
    say({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Requirement evidence read.' } }, parent_tool_use_id: null });
    say({ type: 'result', subtype: 'success', is_error: false, result: 'done' });
  }
}
