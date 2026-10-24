// One AI evaluation run on Codex (`codex exec`): a studio chat conversation as the chat server makes it — its system
// prompt (TOOLSET.prompt), the state note, the brief and the person's files — with the repo's cad-mcp server
// (server/cadMcp.ts, on a state file) as Codex's only tool source. Codex's own tools are switched off (shell, patch, web,
// images, apps, agents) and the user's Codex config is not read (--ignore-user-config).
//
// The person's part is played by the harness, as the studio's Accept button: an assembly, a mate or a drawing change is
// always the person's to accept (proposals.accept refuses the agent), so after each turn every open proposal is accepted
// in the order made, and the conversation goes on (`codex exec resume`) with what was accepted or why one could not be,
// until a turn leaves no open proposal, the turn cap, the call cap (the harness stops it) or the wall clock.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import type { RowFileInput } from '@barocss/cad-model/engine/rowFiles';
import { acceptProposal, type ChatState } from '@barocss/cad-model/chat/tools';
import { TOOLSET } from '@barocss/cad-model/chat/toolset';
import { stateNote } from '../../server/chatServer';

/** Codex's own features this run switches off: the agent has the cad tools only. */
const OFF = ['shell_tool', 'unified_exec', 'apps', 'plugins', 'memories', 'browser_use', 'browser_use_external', 'computer_use', 'image_generation', 'multi_agent', 'view_image', 'goals', 'hooks', 'skill_search', 'tool_suggest', 'in_app_browser', 'sleep_tool', 'remote_plugin'];
/** The studio's autonomy for a run with no person at the keyboard: L4 (as O15's run). */
export const AUTONOMY = 4;

export interface CallRecord { turn: number; tool: string; args: unknown; ok: boolean; error?: string; text: string; ms: number }
export interface Usage { input_tokens: number; cached_input_tokens: number; output_tokens: number; reasoning_output_tokens: number }
export interface Accepted { turn: number; id: string; title: string; ok: boolean; error?: string }
export interface CodexRun {
  end: 'done' | 'turn-cap' | 'call-cap' | 'wall-clock' | 'error'; error?: string; wallMs: number; turns: number;
  calls: CallRecord[]; messages: string[]; usage: Usage; accepted: Accepted[];
  doc: StudioDoc; thread?: string;
}
export interface CodexOptions {
  dir: string; node: string; mcpScript: string; model?: string; effort?: string;
  doc: StudioDoc; brief: string; rowFiles?: RowFileInput[]; rowNote: string; conversation: string;
  maxCalls: number; maxTurns: number; wallMs: number;
}

const toml = (s: string) => JSON.stringify(s);
const resultText = (r: { content?: { type: string; text?: string }[] } | null) => (r?.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('\n');
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const add = (a: Usage, b: Partial<Usage> | undefined) => { for (const k of Object.keys(a) as (keyof Usage)[]) a[k] += b?.[k] ?? 0; };

interface Turn { thread?: string; end: CodexRun['end']; error?: string }
/** One `codex exec` (or `exec resume`) turn: its events appended to events.jsonl, calls and messages to the run's. */
async function turn(o: CodexOptions, k: number, input: string, thread: string | undefined, run: CodexRun, deadline: number): Promise<Turn> {
  const state = join(o.dir, 'state.json'), instructions = join(o.dir, 'instructions.md');
  const env = `{CAD_CHAT_STATE=${toml(state)},CAD_AUTONOMY=${toml(String(AUTONOMY))},CAD_PROMPT=${toml(o.brief.slice(0, 4000))}}`;
  const common = ['--json', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules',
    ...(o.model ? ['-m', o.model] : []), '-c', `model_reasoning_effort=${toml(o.effort ?? 'high')}`,
    '-c', `model_instructions_file=${toml(instructions)}`, '-c', 'web_search="disabled"', '-c', 'sandbox_mode="read-only"', ...OFF.flatMap(f => ['--disable', f]),
    '-c', `mcp_servers.cad.command=${toml(o.node)}`, '-c', `mcp_servers.cad.args=[${toml(o.mcpScript)}]`, '-c', `mcp_servers.cad.env=${env}`,
    '-c', 'mcp_servers.cad.default_tools_approval_mode="approve"', '-c', 'mcp_servers.cad.tool_timeout_sec=600', '-c', 'mcp_servers.cad.startup_timeout_sec=120'];
  const args = thread ? ['exec', 'resume', ...common, thread, '-'] : ['exec', ...common, '-C', o.dir, '-'];
  const child = spawn('codex', args, { cwd: o.dir, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.end(input);
  const events = join(o.dir, 'events.jsonl'), started = new Map<string, number>();
  let end: Turn['end'] = 'done', error: string | undefined, stderr = '', id = thread;
  const stop = (why: Turn['end']) => { if (end === 'done') end = why; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000).unref(); };
  const timer = setTimeout(() => stop('wall-clock'), Math.max(1000, deadline - Date.now()));
  child.stderr.on('data', d => { stderr = (stderr + d).slice(-4000); });
  createInterface({ input: child.stdout }).on('line', line => {
    writeFileSync(events, `{"turn":${k},"event":${line}}\n`, { flag: 'a' });
    let m: { type?: string; thread_id?: string; item?: Record<string, any>; usage?: Usage; error?: unknown; message?: string };
    try { m = JSON.parse(line); } catch { return; }
    const it = m.item;
    if (m.type === 'thread.started' && m.thread_id) id = m.thread_id;
    if (m.type === 'item.started' && it?.type === 'mcp_tool_call') started.set(it.id, Date.now());
    if (m.type === 'item.completed' && it?.type === 'mcp_tool_call') {
      const text = resultText(it.result) || String(it.error?.message ?? '');
      const ok = !it.error && !it.result?.isError && !/^\{"ok":false/.test(text);
      run.calls.push({ turn: k, tool: String(it.tool), args: it.arguments, ok, ...(ok ? {} : { error: String(it.error?.message ?? text).slice(0, 800) }), text: text.slice(0, 3000), ms: Date.now() - (started.get(it.id) ?? Date.now()) });
      if (run.calls.length >= o.maxCalls) stop('call-cap');
    }
    if (m.type === 'item.completed' && it?.type === 'agent_message') run.messages.push(String(it.text ?? ''));
    if (m.type === 'turn.completed') add(run.usage, m.usage);
    if (m.type === 'turn.failed' || m.type === 'error') { error = JSON.stringify(m.error ?? m.message ?? m).slice(0, 800); if (end === 'done') end = 'error'; }
  });
  const code = await new Promise<number | null>(res => { child.on('error', e => { error = e.message; res(null); }); child.on('close', res); });
  clearTimeout(timer);
  if (end === 'done' && code !== 0) { end = 'error'; error ??= stderr.trim().split('\n').slice(-3).join(' ') || `codex exited with ${code}`; }
  return { ...(id ? { thread: id } : {}), end, ...(error ? { error } : {}) };
}

/** The person's part between turns: every open proposal accepted in the order made (a refusal said, not retried). */
async function acceptAll(doc: StudioDoc, k: number): Promise<{ doc: StudioDoc; accepted: Accepted[] }> {
  const accepted: Accepted[] = [];
  for (const p of (doc.proposals ?? []).filter(q => q.status === 'open')) {
    const r = await evaluate(doc), state = { doc, bodies: r && r.ok ? r.bodies : [], turnBase: doc } as unknown as ChatState;
    const a = await acceptProposal(state, p.id, evaluate);
    if ('error' in a) accepted.push({ turn: k, id: p.id, title: p.title, ok: false, error: a.error });
    else { doc = a.state.doc; accepted.push({ turn: k, id: p.id, title: p.title, ok: true }); }
  }
  return { doc, accepted };
}

/** The person's message after accepting (A6.2's turns list gets it too). */
const followUp = (doc: StudioDoc, done: Accepted[]) => `${stateNote(doc, AUTONOMY)}\n\n${[
  ...done.filter(a => a.ok).map(a => `I accepted your proposal ${a.id} ("${a.title}").`),
  ...done.filter(a => !a.ok).map(a => `Your proposal ${a.id} ("${a.title}") could not be accepted: ${a.error}`),
  'Continue with the brief. When everything it asks for is done, say so.',
].join('\n')}`;

export async function runCodex(o: CodexOptions): Promise<CodexRun> {
  const state = join(o.dir, 'state.json'), t0 = Date.now(), deadline = t0 + o.wallMs;
  const first = `${stateNote(o.doc, AUTONOMY)}\n\n${o.brief}${o.rowNote}`, turns = [o.brief];
  const write = (doc: StudioDoc) => writeFileSync(state, JSON.stringify({ doc, changed: false, turns, ...(o.rowFiles ? { rowFiles: o.rowFiles, rowConversation: o.conversation } : {}) }));
  write(o.doc);
  writeFileSync(join(o.dir, 'instructions.md'), TOOLSET.prompt);
  writeFileSync(join(o.dir, 'prompt.txt'), first);
  writeFileSync(join(o.dir, 'events.jsonl'), '');
  const run: CodexRun = { end: 'done', wallMs: 0, turns: 0, calls: [], messages: [], usage: { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 }, accepted: [], doc: o.doc };
  let input = first, thread: string | undefined;
  for (let k = 1; ; k++) {
    const t = await turn(o, k, input, thread, run, deadline);
    run.turns = k; thread = t.thread ?? thread;
    run.doc = (JSON.parse(readFileSync(state, 'utf8')) as { doc: StudioDoc }).doc;
    if (t.end !== 'done') { run.end = t.end; if (t.error) run.error = t.error; break; }
    if (!(run.doc.proposals ?? []).some(p => p.status === 'open')) break;
    const a = await acceptAll(run.doc, k);
    run.accepted.push(...a.accepted); run.doc = a.doc;
    if (k >= o.maxTurns) { run.end = 'turn-cap'; break; }
    if (!thread) { run.end = 'error'; run.error = 'no thread id to resume'; break; }
    input = followUp(run.doc, a.accepted); turns.push(input);
    write(run.doc);
  }
  run.wallMs = Date.now() - t0; if (thread) run.thread = thread;
  return run;
}
