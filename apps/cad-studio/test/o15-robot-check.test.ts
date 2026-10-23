import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { starterDoc } from '@barocss/cad-model/engine/doc';
import { GROUPS } from '@barocss/cad-model/chat/groups';
import { serveMcp } from '../server/cadMcp';
import { claudeArgs } from '../server/chatServer';
import { keepsBrief } from '../server/robotL3/main';

// O15: robot_check is RD10's L3 run's tool only — listed, allowed and callable when the run sets CAD_ROBOT_L3=1, and not
// otherwise, so every other turn's tools and per-turn text are as they were; the run's own budget cap goes to the CLI.

async function listedTools(env: Record<string, string>): Promise<{ names: string[]; call: { isError?: boolean; content?: { text: string }[] } | undefined; error?: string }> {
  const was = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  try {
    const dir = mkdtempSync(join(tmpdir(), 'cad-o15-')), statePath = join(dir, 'state.json');
    writeFileSync(statePath, JSON.stringify({ doc: starterDoc(), changed: false }));
    const input = new PassThrough(), output = new PassThrough(), served = serveMcp(statePath, input, output);
    const waiting = new Map<number, (m: { result?: any; error?: { message: string } }) => void>(); let buf = '', id = 0;
    output.on('data', d => { buf += d; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, nl)); buf = buf.slice(nl + 1); waiting.get(m.id)?.(m); } });
    const request = (method: string, params?: unknown) => new Promise<{ result?: any; error?: { message: string } }>(res => { const n = ++id; waiting.set(n, res); input.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
    await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    const names = ((await request('tools/list')).result!.tools as { name: string }[]).map(t => t.name);
    const r = await request('tools/call', { name: 'robot_check', arguments: {} });
    input.end(); await served;
    return { names, call: r.result, ...(r.error ? { error: r.error.message } : {}) };
  } finally { for (const [k, v] of Object.entries(was)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}

test('O15: robot_check is not listed, allowed or callable without CAD_ROBOT_L3; with it, listed, allowed and run (no duty yet: said so); the budget cap passed on', async () => {
  const off = await listedTools({});
  assert.deepEqual(off.names, Object.keys(GROUPS)); assert.match(off.error ?? '', /Unknown tool: robot_check/);
  assert.ok(!claudeArgs({ mcpConfig: '{}', model: 'm' }).join(' ').includes('robot_check'));
  assert.ok(!claudeArgs({ mcpConfig: '{}', model: 'm' }).includes('--max-budget-usd'));
  const on = await listedTools({ CAD_ROBOT_L3: '1', CAD_MAX_BUDGET_USD: '8' });
  assert.deepEqual(on.names, [...Object.keys(GROUPS), 'robot_check']);
  assert.equal(on.call?.isError, true); assert.match(on.call!.content![0].text, /No duty yet/);
  Object.assign(process.env, { CAD_ROBOT_L3: '1', CAD_MAX_BUDGET_USD: '8' });
  try {
    const args = claudeArgs({ mcpConfig: '{}', model: 'm' });
    assert.ok(args[args.indexOf('--allowedTools') + 1].split(',').includes('mcp__cad__robot_check'));
    assert.equal(args[args.indexOf('--max-budget-usd') + 1], '8');
  } finally { delete process.env.CAD_ROBOT_L3; delete process.env.CAD_MAX_BUDGET_USD; }
});

test('O15: a run that changed the brief\'s own terms (the life, a pose, a dwell) is no pass', () => {
  const brief = { moves: [{ from: {}, to: { a: 1 }, profile: 'trapezoid' as const, limits: { velocity: 6, acceleration: 60 }, dwell_s: 0.5 }], life_h: 20000 };
  assert.equal(keepsBrief({ ...brief, moves: [{ ...brief.moves[0], limits: { velocity: 3, acceleration: 30 } }] }, brief), null, 'a slower profile is the model\'s to choose');
  assert.match(keepsBrief({ ...brief, life_h: 10 }, brief) ?? '', /the life changed/);
  assert.match(keepsBrief({ ...brief, moves: [{ ...brief.moves[0], to: { a: 0.5 } }] }, brief) ?? '', /poses or dwell changed/);
  assert.match(keepsBrief({ ...brief, moves: [{ ...brief.moves[0], dwell_s: 0 }] }, brief) ?? '', /poses or dwell changed/);
});
