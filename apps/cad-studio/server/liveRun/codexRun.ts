// P1-L3: a live AI run of a product brief on Codex (owner, 2026-10-24: "AI 실행하는건 codex 로 해줘도 돼", "codex 는 토큰
// 상관 없이 쓸 수 있어"). Each run is independent: a fresh folder, the same start document and the byte-identical brief,
// `codex exec` on it with cad-mcp (server/cadDoc.ts, the v2 tools on that folder's part.bcad) as its only MCP server —
// the user's config ignored, Codex's own shell, browser, plugins and other built-ins disabled — and no session kept.
// Every event is logged; any item that is not a cad tool call or the model's own text is off-contract and fails the
// run. Guards: a cap on tool calls and a wall clock, either of which ends the run (its process group killed). Success
// is decided only by a fresh run of the brief's own oracle command on the part the run saved — never by the model's
// word. A failed run is recorded as it is: the brief is never edited and run again.
//   node scripts/live-run.mjs --brief brief.md --check '["node","check.mjs","{doc}"]' [--start start.bcad] --scripted|--live
import { spawn, execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** The model and its reasoning effort, as the owner's Codex config sets them (named here: the user config is ignored). */
export const CODEX_MODEL = 'gpt-6.1-sol', CODEX_EFFORT = 'high';
export const DEFAULT_MAX_TOOL_CALLS = 400, DEFAULT_WALL_MS = 60 * 60 * 1000;
/** Codex's built-ins a run must not reach: the v2 tools are its only way to the part. */
export const DISABLED_FEATURES = ['shell_tool', 'unified_exec', 'plugins', 'apps', 'browser_use', 'browser_use_external', 'computer_use', 'in_app_browser', 'image_generation', 'memories', 'skill_search', 'tool_suggest', 'code_mode_host', 'goals'];

const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const toml = (v: unknown) => JSON.stringify(v);

/** The `codex exec` arguments of one run (the prompt on stdin). */
export function codexArgs(o: { dir: string; mcpCommand: string; mcpArgs: readonly string[]; model: string; effort: string }): string[] {
  return [
    'exec', '--json', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '--color', 'never',
    '-C', o.dir, '-s', 'read-only', '-m', o.model, '-c', `model_reasoning_effort=${toml(o.effort)}`, '-c', 'web_search="disabled"',
    '-c', `mcp_servers.cad.command=${toml(o.mcpCommand)}`, '-c', `mcp_servers.cad.args=${toml(o.mcpArgs)}`, '-c', 'mcp_servers.cad.tool_timeout_sec=900', '-c', 'mcp_servers.cad.startup_timeout_sec=120',
    ...DISABLED_FEATURES.flatMap(f => ['--disable', f]), '-o', join(o.dir, 'last-message.txt'), '-',
  ];
}

export interface ToolCall { tool: string; isError: boolean; ms: number | null }
export interface RunRecord {
  run: number; model: string; effort: string; briefSha256: string; startSha256: string;
  /** completed (the model stopped), tool-cap, wall-clock, failed (Codex reported the turn failed), error (it did not run). */
  end: 'completed' | 'tool-cap' | 'wall-clock' | 'failed' | 'error'; error?: string; wallMs: number;
  /** Codex's turn usage, summed (tokens); turns: the turns it reported. */
  usage: Record<string, number>; turns: number;
  toolCalls: ToolCall[]; offContract: { type: string; detail: string }[];
  eventsSha256: string; lastMessage: string;
  check: { exit: number | null; report: unknown };
  result: { pass: boolean; why: string };
}

/** What a run's events say: its tool calls, off-contract items, usage and how it ended (Codex's `exec --json` events). */
export function readEvents(lines: readonly string[]): { toolCalls: ToolCall[]; offContract: RunRecord['offContract']; usage: Record<string, number>; turns: number; failed?: string; completed: boolean } {
  const toolCalls: ToolCall[] = [], offContract: RunRecord['offContract'] = [], usage: Record<string, number> = {}, started = new Map<string, number>();
  let turns = 0, failed: string | undefined, completed = false;
  for (const line of lines) {
    let e: { type?: string; item?: Record<string, unknown>; usage?: Record<string, unknown>; error?: { message?: string } | string; t?: number };
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === 'turn.completed') { turns++; completed = true; for (const [k, v] of Object.entries(e.usage ?? {})) if (typeof v === 'number') usage[k] = (usage[k] ?? 0) + v; }
    if (e.type === 'turn.failed') { turns++; failed = typeof e.error === 'string' ? e.error : e.error?.message ?? 'turn failed'; }
    if (e.type === 'error') failed = typeof e.error === 'string' ? e.error : (e as { message?: string }).message ?? 'error';
    const item = e.item; if (!item) continue;
    const kind = String(item.type ?? item.item_type ?? '');
    if (e.type === 'item.started' && kind === 'mcp_tool_call') started.set(String(item.id), typeof e.t === 'number' ? e.t : Date.now());
    if (e.type !== 'item.completed') continue;
    if (kind === 'mcp_tool_call') {
      if (item.server !== 'cad') { offContract.push({ type: kind, detail: `${String(item.server)}.${String(item.tool)}` }); continue; }
      const t0 = started.get(String(item.id)), result = item.result as { is_error?: boolean; isError?: boolean } | undefined;
      toolCalls.push({ tool: String(item.tool), isError: item.status === 'failed' || !!item.error || !!(result?.is_error ?? result?.isError), ms: t0 !== undefined && typeof e.t === 'number' ? e.t - t0 : null });
    } else if (kind !== 'agent_message' && kind !== 'reasoning' && kind !== 'todo_list' && kind !== 'error') offContract.push({ type: kind, detail: JSON.stringify(item).slice(0, 300) });
  }
  return { toolCalls, offContract, usage, turns, ...(failed ? { failed } : {}), completed };
}

interface RunOptions { /** The command that runs Codex (and any arguments before its own). */ codex: readonly string[]; mcpCommand: string; mcpScript: string; brief: string; start: Uint8Array; check: readonly string[]; dir: string; maxToolCalls: number; wallMs: number; model: string; effort: string }

/** One run in its own folder: Codex on the brief, then the oracle afresh on what it saved. */
export async function oneRun(k: number, o: RunOptions): Promise<RunRecord> {
  const part = join(o.dir, 'part.bcad'); writeFileSync(part, o.start);
  writeFileSync(join(o.dir, 'brief.md'), o.brief);
  const args = codexArgs({ dir: o.dir, mcpCommand: o.mcpCommand, mcpArgs: [o.mcpScript, '--doc', part, '--autonomy', '4'], model: o.model, effort: o.effort });
  writeFileSync(join(o.dir, 'codex-args.json'), JSON.stringify(args, null, 1) + '\n');
  const t0 = Date.now(), lines: string[] = [];
  let buf = '', stderr = '', end: RunRecord['end'] = 'error', error: string | undefined, calls = 0;
  // (Its own process group, so a cap ends Codex and the MCP server it started — this run's processes only.)
  const child = spawn(o.codex[0], [...o.codex.slice(1), ...args], { cwd: o.dir, stdio: ['pipe', 'pipe', 'pipe'], detached: true, env: { ...process.env } });
  const kill = (why: RunRecord['end']) => { if (end === 'error' && child.pid) { end = why; try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ } } };
  const timer = setTimeout(() => kill('wall-clock'), o.wallMs);
  child.stdout.on('data', (d: Buffer) => {
    buf += d.toString('utf8'); let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1); if (!line.trim()) continue;
      // (Each event stamped with the harness's clock as it arrived: a tool call's time.)
      let stamped = line; try { stamped = JSON.stringify({ ...JSON.parse(line), t: Date.now() }); } catch { /* kept as it came */ }
      lines.push(stamped);
      if (/"type":"item\.completed"/.test(line) && /"mcp_tool_call"/.test(line) && ++calls > o.maxToolCalls) kill('tool-cap');
    }
  });
  child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });
  const exit = await new Promise<number | null>(res => { child.on('close', code => res(code)); child.on('error', e => { error = e.message; res(null); }); child.stdin.end(o.brief); });
  clearTimeout(timer);
  const wallMs = Date.now() - t0, events = readEvents(lines);
  if (end === 'error' && !error) { if (events.failed) { end = 'failed'; error = events.failed; } else if (events.completed && exit === 0) end = 'completed'; else error = `codex exited ${exit}${stderr ? `: ${stderr.trim().split('\n').slice(-3).join(' | ')}` : ''}`; }
  const raw = lines.join('\n') + '\n';
  writeFileSync(join(o.dir, 'events.jsonl'), raw); writeFileSync(join(o.dir, 'stderr.txt'), stderr);
  const lastMessage = existsSync(join(o.dir, 'last-message.txt')) ? readFileSync(join(o.dir, 'last-message.txt'), 'utf8') : '';
  // (The oracle afresh, on the part the run saved: its exit decides; its stdout kept, as JSON when it is.)
  const cmd = o.check.map(a => a.replaceAll('{doc}', part));
  const fresh = await new Promise<{ status: number | null; stdout: string }>(res => execFile(cmd[0], cmd.slice(1), { encoding: 'utf8', maxBuffer: 64 << 20, cwd: o.dir }, (e, stdout) => res({ status: e ? (typeof e.code === 'number' ? e.code : null) : 0, stdout })));
  let report: unknown = fresh.stdout.slice(-4000); try { report = JSON.parse(fresh.stdout); } catch { /* text */ }
  writeFileSync(join(o.dir, 'check.json'), JSON.stringify({ command: cmd, exit: fresh.status, report }, null, 1) + '\n');
  const why = events.offContract.length ? `off-contract: ${events.offContract.map(x => x.type).join(', ')} (the v2 tools are the only way to the part)`
    : fresh.status === 0 ? `the oracle passed afresh${end !== 'completed' ? ` (the run ended: ${end})` : ''}` : `the oracle failed afresh (exit ${fresh.status})${end !== 'completed' ? `; the run ended: ${end}` : ''}`;
  return {
    run: k, model: o.model, effort: o.effort, briefSha256: sha(o.brief), startSha256: sha(o.start), end, ...(error ? { error } : {}), wallMs,
    usage: events.usage, turns: events.turns, toolCalls: events.toolCalls, offContract: events.offContract, eventsSha256: sha(raw), lastMessage,
    check: { exit: fresh.status, report }, result: { pass: !events.offContract.length && fresh.status === 0, why },
  };
}

export interface SeriesOptions { codex: readonly string[]; mcpCommand: string; mcpScript: string; brief: string; start: Uint8Array; check: readonly string[]; out: string; runs: number; maxToolCalls?: number; wallMs?: number; model?: string; effort?: string; /** The scripted dry run: what each run's brief gets appended (the fixture's script). */ scripts?: readonly string[] }

/** The series: `runs` independent runs, each recorded to records.json as it ends; a run Codex never started stops it. */
export async function runSeries(o: SeriesOptions): Promise<{ records: RunRecord[]; stopped: string | null }> {
  mkdirSync(o.out, { recursive: true });
  const records: RunRecord[] = []; let stopped: string | null = null;
  for (let k = 1; k <= o.runs; k++) {
    const dir = mkdtempSync(join(o.out, `run${k}-`)), brief = o.scripts ? `${o.brief}\n\n${o.scripts[(k - 1) % o.scripts.length]}` : o.brief;
    const r = await oneRun(k, { codex: o.codex, mcpCommand: o.mcpCommand, mcpScript: o.mcpScript, brief, start: o.start, check: o.check, dir, maxToolCalls: o.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS, wallMs: o.wallMs ?? DEFAULT_WALL_MS, model: o.model ?? CODEX_MODEL, effort: o.effort ?? CODEX_EFFORT });
    records.push(r);
    writeFileSync(join(o.out, 'records.json'), JSON.stringify({ records, stopped }, null, 1) + '\n');
    // (Codex never ran the model — it refused at once, as at an account's limit: not a model's failure; the series stops.)
    if (r.end === 'error' && !r.turns && !r.toolCalls.length) { stopped = `run ${k}: Codex did not run (${r.error ?? 'no reason given'}): the series stops`; break; }
  }
  writeFileSync(join(o.out, 'records.json'), JSON.stringify({ records, stopped }, null, 1) + '\n');
  return { records, stopped };
}

export async function liveRunMain(argv: readonly string[], paths: { mcpScript: string; scripted: string }): Promise<number> {
  const get = (key: string) => { const i = argv.indexOf(key); return i >= 0 ? argv[i + 1] : undefined; };
  const live = argv.includes('--live'), scripted = argv.includes('--scripted'), usage = 'live-run: --brief file --check \'["cmd", …, "{doc}"]\' [--start part.bcad] [--runs 3] [--max-tool-calls 400] [--wall-min 60] [--out dir] (--scripted --script file | --live)\n';
  if (live === scripted) { process.stderr.write(`live-run: pass --scripted (the dry run) or --live\n${usage}`); return 2; }
  if (live && process.env.CAD_LIVE_RUN !== '1') { process.stderr.write('live-run: a live run calls the model: set CAD_LIVE_RUN=1 as well as --live\n'); return 2; }
  const briefPath = get('--brief'), checkRaw = get('--check');
  if (!briefPath || !checkRaw) { process.stderr.write(usage); return 2; }
  let check: unknown; try { check = JSON.parse(checkRaw); } catch { /* below */ }
  if (!Array.isArray(check) || !check.length || check.some(a => typeof a !== 'string') || !check.some(a => a.includes('{doc}'))) { process.stderr.write('live-run: --check is a JSON array of strings, one naming {doc}\n'); return 2; }
  const runs = Number(get('--runs') ?? 3), maxToolCalls = Number(get('--max-tool-calls') ?? DEFAULT_MAX_TOOL_CALLS), wallMs = Number(get('--wall-min') ?? DEFAULT_WALL_MS / 60000) * 60000;
  if (![runs, maxToolCalls].every(n => Number.isInteger(n) && n >= 1) || !(wallMs > 0)) { process.stderr.write('live-run: --runs and --max-tool-calls are whole numbers ≥ 1, --wall-min above 0\n'); return 2; }
  const startPath = get('--start'), start = startPath ? readFileSync(startPath) : (await import('@barocss/cad-model/engine/container')).encodeStudioFile((await import('@barocss/cad-model/engine/doc')).emptyDoc());
  const scriptPath = get('--script');
  if (scripted && !scriptPath) { process.stderr.write('live-run: --scripted takes --script file (one script line per run)\n'); return 2; }
  const out = resolve(get('--out') ?? 'live-run-out');
  const { records, stopped } = await runSeries({
    codex: live ? [process.env.CAD_CODEX ?? 'codex'] : [process.execPath, paths.scripted], mcpCommand: process.execPath, mcpScript: paths.mcpScript, brief: readFileSync(briefPath, 'utf8'), start, check: check as string[], out, runs, maxToolCalls, wallMs,
    ...(scriptPath ? { scripts: readFileSync(scriptPath, 'utf8').split('\n').filter(l => l.trim()) } : {}),
  });
  for (const r of records) process.stdout.write(`run ${r.run}: ${r.result.pass ? 'PASS' : 'FAIL'} — ${r.result.why}; end ${r.end}; ${r.turns} turns, ${r.toolCalls.length} tool calls (${r.toolCalls.filter(c => c.isError).length} refused), tokens ${JSON.stringify(r.usage)}, ${Math.round(r.wallMs / 1000)} s\n`);
  process.stdout.write(`${stopped ? `stopped: ${stopped}\n` : ''}written: ${join(out, 'records.json')}\n`);
  return 0;
}
