// The chat's small local server: each turn runs the `claude` CLI (print mode, streaming JSON) with
// the studio's tools as its only tools (an MCP server, server/cadMcp.ts, working on a state file), and
// streams what happens back to the browser as server-sent events:
//   text {delta} · tool {name, input, summary, isError} · state {doc} · done {doc?, selection?, session, end, error?}
// The CLI uses its own sign-in; nothing secret reaches the browser. Start it with `pnpm chat`.
import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { loadCadLibrary } from '@barocss/cad';
import { checkLibraryForSharing, sharingRefusal } from '../src/library/sharing';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { StudioDoc } from '../src/engine/doc';
import type { NameSelection } from '../src/chat/tools';
import { toolset, toolsetOf } from '../src/chat/toolset';
import { v1Call } from '../src/chat/groups';
import { PROMPT_CHARS } from '../src/chat/proposals';
import type { StateFile } from './cadMcp';
import type { BlobType, WireBlobs } from '../src/engine/blobs';
import { createHash } from 'node:crypto';

export const DEFAULT_MODEL = 'claude-opus-5-5';
export const MAX_TURNS = 24;
const MAX_BODY = 32 * 1024 * 1024;
/** Images a turn may carry (base64; the browser scales them down first). */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_IMAGES = 4;
const MAX_IMAGE_BASE64 = 6 * 1024 * 1024;
export interface TurnImage { media_type: string; data: string }

type Spawn = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; stdin?: boolean }) => ChildProcess;
export interface ChatServerOptions {
  /** The `claude` executable (default: `claude` on PATH, or CAD_STUDIO_CLAUDE). */
  claude?: string;
  /** The bundled MCP server script run with Node. */
  mcpScript: string;
  model?: string;
  spawn?: Spawn;
  /** Where turns run (sessions resume from the same directory). */
  workDir?: string;
  /** Origins allowed to use the server (default: the studio's dev and preview servers, plus CAD_STUDIO_CHAT_ORIGINS). */
  origins?: string[];
  /** The team's library folder (LIB4, D64; default CAD_STUDIO_TEAM_LIBRARIES; none: no team libraries). */
  teamLibraries?: string;
}

/** The studio's own origins: the Vite dev server (52020) and preview server (4173), on 127.0.0.1 and localhost. */
export const DEFAULT_ORIGINS = ['52020', '4173'].flatMap(port => [`http://127.0.0.1:${port}`, `http://localhost:${port}`]);

/**
 * Whether a request comes from the studio itself. Any web page in the user's browser can reach a
 * localhost server, and a text/plain POST needs no preflight, so a turn (which runs claude on the user's
 * account) is refused unless its Origin is one of the studio's; without an Origin (same-origin GETs
 * through the dev server's proxy) the Host must be the studio's, which also defeats DNS rebinding.
 */
export function fromStudio(req: IncomingMessage, origins: readonly string[]): boolean {
  const origin = req.headers.origin;
  if (origin !== undefined) return origins.includes(origin);
  const host = req.headers.host;
  return !!host && origins.some(o => o.replace(/^https?:\/\//, '') === host);
}

export type ChatServerEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string; input: unknown; summary: string; isError: boolean }
  | { type: 'state'; doc: StudioDoc }
  | { type: 'done'; doc?: StudioDoc; selection?: NameSelection; session?: string; end: 'done' | 'aborted' | 'error'; error?: string; usage?: TurnUsage };
/** What the CLI reports a turn used (its result message, A5.5): tokens, model turns, cost. */
export interface TurnUsage { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number; num_turns?: number; total_cost_usd?: number }

/** The CLI arguments for one turn (the message itself goes in on stdin, see `userMessage`). */
export function claudeArgs(o: { mcpConfig: string; model: string; session?: string }): string[] {
  return [
    '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--model', o.model, '--max-turns', String(MAX_TURNS),
    // Only the studio's tools: no built-in tools, no other MCP servers, settings or skills.
    '--tools', '', '--mcp-config', o.mcpConfig, '--strict-mcp-config', '--allowedTools', toolsetOf().tools.map(t => `mcp__cad__${t.name}`).join(','),
    '--permission-prompts', 'none', '--setting-sources', '', '--disable-slash-commands',
    '--system-prompt', toolsetOf().prompt,
    ...(o.session ? ['--resume', o.session] : []),
  ];
}

/** The turn's user message for the CLI's stream-json input: images first, then the text. */
export function userMessage(text: string, images: TurnImage[] = []) {
  return { type: 'user', message: { role: 'user', content: [
    ...images.map(i => ({ type: 'image', source: { type: 'base64', media_type: i.media_type, data: i.data } })),
    { type: 'text', text },
  ] } };
}

/** Why the images cannot be sent, or null. */
export function checkImages(images: unknown): string | null {
  if (images === undefined) return null;
  if (!Array.isArray(images)) return '"images" is a list of {media_type, data}.';
  if (images.length > MAX_IMAGES) return `At most ${MAX_IMAGES} images per message.`;
  for (const i of images) {
    if (typeof i !== 'object' || !i || !IMAGE_TYPES.includes((i as TurnImage).media_type)) return `Images are ${IMAGE_TYPES.map(t => t.slice(6).toUpperCase()).join(', ')}.`;
    const d = (i as TurnImage).data;
    if (typeof d !== 'string' || !d || !/^[A-Za-z0-9+/]+=*$/.test(d)) return 'Image data is base64 (no data: prefix).';
    if (d.length > MAX_IMAGE_BASE64) return 'An image is too large; send it scaled down.';
  }
  return null;
}

/** The v1 tool a call runs (a consolidated tool's action, A5.3): results are summarized by it. */
const v1NameOf = (name: string, input: unknown) => { const v = v1Call(name, input); return v && !('error' in v) ? v.name : name; };
const r0 = (v: number) => Math.round(v);
/** One line for a tool result in the transcript. */
export function summarize(name: string, text: string, isError: boolean): string {
  let j: Record<string, any>;
  try { j = JSON.parse(text); } catch { return text.slice(0, 160); }
  if (isError || j.ok === false) return String(j.error ?? text);
  if (name === 'get_part_summary') return `${j.feature_count} features, ${j.bodies?.length ?? 0} bodies`;
  if (name === 'select') return `selected ${[...(j.selected?.faces ?? []), ...(j.selected?.edges ?? []), ...(j.selected?.bodies ?? [])].length}`;
  if (name === 'get_assembly') return `${(j.instances?.length ?? 0) + 1} parts, ${j.mates?.length ?? 0} mates${j.problems?.length ? `, ${j.problems.length} unmet` : ''}`;
  if (typeof j.did === 'string' && !Array.isArray(j.bodies)) return `${j.did}${j.unmet_mates?.length ? ` (${j.unmet_mates.length} unmet mate${j.unmet_mates.length > 1 ? 's' : ''})` : ''}`;
  if (Array.isArray(j.bodies)) {
    const v = j.bodies.reduce((s: number, b: { volume_mm3: number | null }) => s + (b.volume_mm3 ?? 0), 0);
    return `${j.did} → ${j.bodies.length} bod${j.bodies.length === 1 ? 'y' : 'ies'}, ${r0(v)} mm³`;
  }
  return text.length > 160 ? text.slice(0, 157) + '…' : text;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size > MAX_BODY) { reject(new Error('Request too large.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const sendJson = (res: ServerResponse, status: number, body: unknown) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };

export function createChatServer(options: ChatServerOptions) {
  const claude = options.claude ?? process.env.CAD_STUDIO_CLAUDE ?? 'claude';
  const model = options.model ?? process.env.CAD_STUDIO_CHAT_MODEL ?? DEFAULT_MODEL;
  const spawn: Spawn = options.spawn ?? ((c, a, o) => nodeSpawn(c, a, { cwd: o.cwd, env: o.env, stdio: [o.stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'] }));
  const workDir = options.workDir ?? join(tmpdir(), 'cad-studio-chat');
  mkdirSync(workDir, { recursive: true });
  let version: Promise<string | null> | null = null;
  const claudeVersion = () => version ??= new Promise(resolve => {
    try {
      const p = spawn(claude, ['--version'], { cwd: workDir, env: process.env });
      let out = ''; p.stdout?.on('data', d => { out += d; });
      p.on('error', () => resolve(null)); p.on('close', code => resolve(code === 0 ? out.trim() : null));
    } catch { resolve(null); }
  });

  // Conversations' mesh blobs on disk (D45): the last four conversations, an hour unused at most.
  const blobSessions = new Map<string, { dir: string; at: number; have: Map<string, { dtype: BlobType; path: string }> }>();
  const blobSessionOf = (id: string) => {
    const now = Date.now();
    for (const [k, s] of blobSessions) if (now - s.at > 3600_000) { rmSync(s.dir, { recursive: true, force: true }); blobSessions.delete(k); }
    let s = blobSessions.get(id);
    if (!s) {
      while (blobSessions.size >= 4) { const [k, old] = [...blobSessions].sort((a, b) => a[1].at - b[1].at)[0]; rmSync(old.dir, { recursive: true, force: true }); blobSessions.delete(k); }
      const dir = join(workDir, `blobs-${id}`); mkdirSync(dir, { recursive: true });
      s = { dir, at: now, have: new Map() }; blobSessions.set(id, s);
    }
    s.at = now; return s;
  };
  const teamDir = options.teamLibraries ?? process.env.CAD_STUDIO_TEAM_LIBRARIES ?? null;
  const origins = options.origins ?? [...DEFAULT_ORIGINS, ...(process.env.CAD_STUDIO_CHAT_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean)];
  return async (req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '').split('?')[0].replace(/^\/api\/chat/, '') || '/';
    if (!fromStudio(req, origins)) return sendJson(res, 403, { error: 'Only the studio may use the chat server (set CAD_STUDIO_CHAT_ORIGINS to allow another origin).' });
    if (req.method === 'GET' && path === '/status') {
      const v = await claudeVersion();
      return sendJson(res, 200, v ? { enabled: true, model, via: v } : { enabled: false, model, reason: `The \`${claude}\` command was not found. Install Claude Code and sign in (claude auth login), then restart the chat server.` });
    }
    // The team's libraries (LIB4, D64): each `<id>.json` with its sharing check `<id>.check.json` beside it. Shared only
    // when this server's own run of the check passes, the library is licensed, and an agent's has been confirmed.
    if (path === '/libraries') {
      if (!teamDir) return sendJson(res, req.method === 'GET' ? 200 : 404, req.method === 'GET' ? { libraries: [], note: 'No team library folder (set CAD_STUDIO_TEAM_LIBRARIES).' } : { error: 'No team library folder (set CAD_STUDIO_TEAM_LIBRARIES).' });
      if (req.method === 'GET') {
        const out: unknown[] = [];
        for (const name of readdirSync(teamDir).filter(n => n.endsWith('.json') && !n.endsWith('.check.json')).sort()) {
          try { const library = JSON.parse(readFileSync(join(teamDir, name), 'utf8')), checkPath = join(teamDir, name.replace(/\.json$/, '.check.json')); out.push({ library, ...(existsSync(checkPath) ? { check: JSON.parse(readFileSync(checkPath, 'utf8')) } : {}) }); }
          catch { out.push({ file: name, error: 'not readable JSON' }); }
        }
        return sendJson(res, 200, { libraries: out });
      }
      if (req.method !== 'POST') return sendJson(res, 404, { error: 'Not found.' });
      if (!/^application\/json\s*(;|$)/i.test(req.headers['content-type'] ?? '')) return sendJson(res, 415, { error: 'Send the library as application/json.' });
      let body: { library?: unknown; authoredBy?: unknown; confirmed?: unknown };
      try { body = JSON.parse(await readBody(req)); } catch (e) { return sendJson(res, 400, { error: e instanceof Error ? e.message : 'Invalid JSON.' }); }
      const check = checkLibraryForSharing(body.library);
      if (check.library === '?') return sendJson(res, 400, { error: check.problems[0], check });
      const why = sharingRefusal(loadCadLibrary(body.library), { authoredBy: body.authoredBy === 'agent' ? 'agent' : 'person', confirmed: body.confirmed === true }, check);
      if (why) return sendJson(res, 422, { error: why, check });
      writeFileSync(join(teamDir, `${check.library}.json`), JSON.stringify(body.library, null, 1));
      writeFileSync(join(teamDir, `${check.library}.check.json`), JSON.stringify(check, null, 1));
      return sendJson(res, 200, { shared: check.library, check });
    }
    if (req.method !== 'POST' || path !== '/turn') return sendJson(res, 404, { error: 'Not found.' });
    // JSON only: a cross-site page cannot send it without a CORS preflight, which this server never answers.
    if (!/^application\/json\s*(;|$)/i.test(req.headers['content-type'] ?? '')) return sendJson(res, 415, { error: 'Send the turn as application/json.' });
    let body: { text?: unknown; doc?: unknown; turns?: unknown; session?: unknown; images?: unknown; traces?: unknown; autonomy?: unknown; blobs?: unknown; blobSession?: unknown; blobRefs?: unknown };
    try { body = JSON.parse(await readBody(req)); } catch (e) { return sendJson(res, 400, { error: e instanceof Error ? e.message : 'Invalid JSON.' }); }
    if (typeof body.text !== 'string' || !body.text.trim() || typeof body.doc !== 'object' || !body.doc) return sendJson(res, 400, { error: 'Expected {text, doc, session?, images?}.' });
    const imageError = checkImages(body.images);
    if (imageError) return sendJson(res, 400, { error: imageError });
    const images = (body.images ?? []) as TurnImage[];
    // (What the user typed this conversation, A6.2: the tools check a quote said to be theirs against it.)
    if (body.turns !== undefined && (!Array.isArray(body.turns) || body.turns.length > 500 || body.turns.some(t => typeof t !== 'string' || t.length > 20000))) return sendJson(res, 400, { error: '"turns" is a list of the user\'s messages (at most 500, each at most 20 000 characters).' });
    if (body.traces !== undefined && (!Array.isArray(body.traces) || body.traces.length > 16 || body.traces.some(t => typeof t !== 'object' || !t || !Array.isArray((t as { layers?: unknown }).layers)))) return sendJson(res, 400, { error: '"traces" is a list of image traces.' });

    // The document's mesh blobs (D45): kept per conversation on disk, each received once; a turn names them, and
    // one naming blobs this server does not have is answered 409 with their hashes (the studio sends them then).
    let blobFiles: StateFile['blobFiles'];
    if (body.blobRefs !== undefined) {
      const refs = body.blobRefs, session = body.blobSession;
      if (!Array.isArray(refs) || !refs.every(h => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h)) || typeof session !== 'string' || !/^[0-9a-f]{8,64}$/.test(session)) return sendJson(res, 400, { error: '"blobRefs" are SHA-256 hashes with a "blobSession".' });
      if (body.blobs !== undefined && !isBlobs(body.blobs)) return sendJson(res, 400, { error: '"blobs" are hash → {dtype, base64}.' });
      const kept = blobSessionOf(session);
      for (const [h, b] of Object.entries((body.blobs ?? {}) as WireBlobs)) {
        const bytes = Buffer.from(b.base64, 'base64');
        if (createHash('sha256').update(bytes).digest('hex') !== h) return sendJson(res, 400, { error: `A mesh blob does not match its hash (${h.slice(0, 12)}…).` });
        const path = join(kept.dir, `${h}.${b.dtype}`); writeFileSync(path, bytes); kept.have.set(h, { dtype: b.dtype, path });
      }
      const missing = (refs as string[]).filter(h => !kept.have.has(h));
      if (missing.length) return sendJson(res, 409, { error: 'The chat server does not have this mesh data yet.', missing });
      blobFiles = (refs as string[]).map(h => ({ hash: h, ...kept.have.get(h)! }));
    }
    const dir = mkdtempSync(join(workDir, 'turn-'));
    const statePath = join(dir, 'state.json');
    writeFileSync(statePath, JSON.stringify({ doc: body.doc as StudioDoc, changed: false, ...(body.traces ? { images: body.traces as StateFile['images'] } : {}), ...(blobFiles ? { blobFiles } : {}), ...(body.turns ? { turns: body.turns as string[] } : {}) } satisfies StateFile));
    // (How far the agent may go on its own, D41: 1–4, else the default 2.)
    const level = [1, 2, 3, 4].includes(Number(body.autonomy)) ? Number(body.autonomy) : 2;
    const mcpConfig = JSON.stringify({ mcpServers: { cad: { type: 'stdio', command: process.execPath, args: [options.mcpScript], env: { CAD_CHAT_STATE: statePath, CAD_MAX_TURNS: String(MAX_TURNS), CAD_MODEL: model, CAD_PROMPT: body.text.slice(0, PROMPT_CHARS), CAD_AUTONOMY: String(level), CAD_TOOLSET: toolset(), ...(teamDir ? { CAD_TEAM_LIBRARIES: teamDir } : {}) } } } });
    const prompt = `${stateNote(body.doc as StudioDoc, level)}\n\n${body.text}`;
    const args = claudeArgs({ mcpConfig, model, ...(typeof body.session === 'string' ? { session: body.session } : {}) });

    res.statusCode = 200; res.setHeader('content-type', 'text/event-stream'); res.setHeader('cache-control', 'no-cache');
    const emit = (e: ChatServerEvent) => { if (!res.writableEnded) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`); };
    const read = (): StateFile | null => { try { return JSON.parse(readFileSync(statePath, 'utf8')); } catch { return null; } };

    let child: ChildProcess;
    try {
      child = spawn(claude, args, { cwd: workDir, env: { ...process.env }, stdin: true });
      // One user message, then end of input: the CLI finishes the turn and exits.
      child.stdin?.on('error', () => { /* the CLI exited first */ });
      child.stdin?.end(JSON.stringify(userMessage(prompt, images)) + '\n');
    }
    catch (e) { emit({ type: 'done', end: 'error', error: e instanceof Error ? e.message : String(e) }); res.end(); rmSync(dir, { recursive: true, force: true }); return; }
    let aborted = false, session: string | undefined = typeof body.session === 'string' ? body.session : undefined, failure: string | undefined, stderr = '';
    res.on('close', () => { if (!res.writableFinished) { aborted = true; child.kill('SIGTERM'); } });
    child.stderr?.on('data', d => { stderr = (stderr + d).slice(-2000); });
    const calls = new Map<string, { name: string; input: unknown }>();
    let sent = 0, usage: TurnUsage | undefined;
    const lines = createInterface({ input: child.stdout! });
    lines.on('line', line => {
      let m: Record<string, any>;
      try { m = JSON.parse(line); } catch { return; }
      if (m.session_id) session = m.session_id;
      if (m.type === 'stream_event' && m.event?.type === 'content_block_delta' && m.event.delta?.type === 'text_delta' && !m.parent_tool_use_id) emit({ type: 'text', delta: m.event.delta.text });
      else if (m.type === 'assistant') {
        for (const b of m.message?.content ?? []) if (b.type === 'tool_use') calls.set(b.id, { name: String(b.name).replace(/^mcp__cad__/, ''), input: b.input });
      } else if (m.type === 'user') {
        for (const b of Array.isArray(m.message?.content) ? m.message.content : []) {
          if (b.type !== 'tool_result') continue;
          const call = calls.get(b.tool_use_id) ?? { name: 'tool', input: {} };
          const text = typeof b.content === 'string' ? b.content : (b.content ?? []).map((c: { text?: string }) => c.text ?? '').join('');
          emit({ type: 'tool', name: call.name, input: call.input, summary: summarize(v1NameOf(call.name, call.input), text, !!b.is_error), isError: !!b.is_error || /"ok":false/.test(text) });
          // (Only a part a tool changed since the last state sent: a read-only call re-sent nothing, PERF3 A3.)
          const s = read(); if (s?.changed && (s.version === undefined || s.version > sent)) { sent = s.version ?? 0; emit({ type: 'state', doc: s.doc }); }
        }
      } else if (m.type === 'result') {
        if (m.usage || m.num_turns !== undefined) usage = { ...(m.usage ?? {}), ...(m.num_turns !== undefined ? { num_turns: m.num_turns } : {}), ...(m.total_cost_usd !== undefined ? { total_cost_usd: m.total_cost_usd } : {}) };
        if (m.is_error || m.subtype !== 'success') failure = m.subtype === 'error_max_turns' ? `Stopped after ${MAX_TURNS} steps.` : String(m.result ?? m.subtype ?? 'The turn failed.');
      }
    });
    const code = await new Promise<number | null>(resolve => { child.on('error', e => { failure = e.message; resolve(null); }); child.on('close', resolve); });
    const s = read();
    if (!aborted && code !== 0 && !failure) failure = stderr.trim().split('\n').slice(-3).join(' ') || `claude exited with ${code}`;
    emit({ type: 'done', ...(s?.changed ? { doc: s.doc } : {}), ...(s?.selection ? { selection: s.selection } : {}), ...(session ? { session } : {}), end: aborted ? 'aborted' : failure ? 'error' : 'done', ...(failure ? { error: failure } : {}), ...(usage ? { usage } : {}) });
    res.end();
    rmSync(dir, { recursive: true, force: true });
  };
}

/** A short line of the part's state for the model, sent with each user message. */
/** A turn's mesh blobs (M1): hash → {dtype, base64}. */
const isBlobs = (v: unknown): v is WireBlobs => !!v && typeof v === 'object' && Object.values(v).every(b => !!b && typeof b === 'object' && (b.dtype === 'f64' || b.dtype === 'f32' || b.dtype === 'u32') && typeof b.base64 === 'string');
export function stateNote(doc: StudioDoc, level = 2): string {
  const open = (doc.proposals ?? []).filter(p => p.status === 'open').length;
  return `[Current part: ${doc.nodes.length} feature${doc.nodes.length === 1 ? '' : 's'}. The user may have edited it since your last turn; call get_part_summary when you need its faces and edges. Autonomy L${level}: ${AUTONOMY[level]}${open ? ` ${open} open proposal${open > 1 ? 's' : ''}: list_proposals.` : ''}]`;
}
/** What each autonomy level lets the agent do (D41), as told to it each turn. */
const AUTONOMY: Record<number, string> = {
  1: 'propose every change (propose); the user accepts it.',
  2: 'change values of one feature or of parameters directly (every hard requirement still passing); propose anything more in this turn (several features, adding, deleting or moving features, what a feature is built on); the user accepts proposals. On an empty part, build it directly (the first build).',
  3: 'change the part, and accept your own proposals of low or medium risk that change no hard requirement.',
  4: 'change the part, and accept proposals that break no hard requirement.',
};
