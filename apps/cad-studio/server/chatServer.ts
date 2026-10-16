// The chat's small local server: each turn runs the `claude` CLI (print mode, streaming JSON) with
// the studio's tools as its only tools (an MCP server, server/cadMcp.ts, working on a state file), and
// streams what happens back to the browser as server-sent events:
//   text {delta} · tool {name, input, summary, isError} · state {doc} · done {doc?, selection?, session, end, error?}
// The CLI uses its own sign-in; nothing secret reaches the browser. Start it with `pnpm chat`.
import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { StudioDoc } from '../src/engine/doc';
import { SYSTEM_PROMPT, TOOLS, type NameSelection } from '../src/chat/tools';
import type { StateFile } from './cadMcp';

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
}

export type ChatServerEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string; input: unknown; summary: string; isError: boolean }
  | { type: 'state'; doc: StudioDoc }
  | { type: 'done'; doc?: StudioDoc; selection?: NameSelection; session?: string; end: 'done' | 'aborted' | 'error'; error?: string };

/** The CLI arguments for one turn (the message itself goes in on stdin, see `userMessage`). */
export function claudeArgs(o: { mcpConfig: string; model: string; session?: string }): string[] {
  return [
    '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--model', o.model, '--max-turns', String(MAX_TURNS),
    // Only the studio's tools: no built-in tools, no other MCP servers, settings or skills.
    '--tools', '', '--mcp-config', o.mcpConfig, '--strict-mcp-config', '--allowedTools', TOOLS.map(t => `mcp__cad__${t.name}`).join(','),
    '--permission-prompts', 'none', '--setting-sources', '', '--disable-slash-commands',
    '--system-prompt', SYSTEM_PROMPT,
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

const r0 = (v: number) => Math.round(v);
/** One line for a tool result in the transcript. */
export function summarize(name: string, text: string, isError: boolean): string {
  let j: Record<string, any>;
  try { j = JSON.parse(text); } catch { return text.slice(0, 160); }
  if (isError || j.ok === false) return String(j.error ?? text);
  if (name === 'get_part_summary') return `${j.feature_count} features, ${j.bodies?.length ?? 0} bodies`;
  if (name === 'select') return `selected ${[...(j.selected?.faces ?? []), ...(j.selected?.edges ?? []), ...(j.selected?.bodies ?? [])].length}`;
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

  return async (req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '').split('?')[0].replace(/^\/api\/chat/, '') || '/';
    if (req.method === 'GET' && path === '/status') {
      const v = await claudeVersion();
      return sendJson(res, 200, v ? { enabled: true, model, via: v } : { enabled: false, model, reason: `The \`${claude}\` command was not found. Install Claude Code and sign in (claude auth login), then restart the chat server.` });
    }
    if (req.method !== 'POST' || path !== '/turn') return sendJson(res, 404, { error: 'Not found.' });
    let body: { text?: unknown; doc?: unknown; session?: unknown; images?: unknown };
    try { body = JSON.parse(await readBody(req)); } catch (e) { return sendJson(res, 400, { error: e instanceof Error ? e.message : 'Invalid JSON.' }); }
    if (typeof body.text !== 'string' || !body.text.trim() || typeof body.doc !== 'object' || !body.doc) return sendJson(res, 400, { error: 'Expected {text, doc, session?, images?}.' });
    const imageError = checkImages(body.images);
    if (imageError) return sendJson(res, 400, { error: imageError });
    const images = (body.images ?? []) as TurnImage[];

    const dir = mkdtempSync(join(workDir, 'turn-'));
    const statePath = join(dir, 'state.json');
    writeFileSync(statePath, JSON.stringify({ doc: body.doc as StudioDoc, changed: false } satisfies StateFile));
    const mcpConfig = JSON.stringify({ mcpServers: { cad: { type: 'stdio', command: process.execPath, args: [options.mcpScript], env: { CAD_CHAT_STATE: statePath } } } });
    const prompt = `${stateNote(body.doc as StudioDoc)}\n\n${body.text}`;
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
          emit({ type: 'tool', name: call.name, input: call.input, summary: summarize(call.name, text, !!b.is_error), isError: !!b.is_error || /"ok":false/.test(text) });
          const s = read(); if (s?.changed) emit({ type: 'state', doc: s.doc });
        }
      } else if (m.type === 'result' && (m.is_error || m.subtype !== 'success')) failure = m.subtype === 'error_max_turns' ? `Stopped after ${MAX_TURNS} steps.` : String(m.result ?? m.subtype ?? 'The turn failed.');
    });
    const code = await new Promise<number | null>(resolve => { child.on('error', e => { failure = e.message; resolve(null); }); child.on('close', resolve); });
    const s = read();
    if (!aborted && code !== 0 && !failure) failure = stderr.trim().split('\n').slice(-3).join(' ') || `claude exited with ${code}`;
    emit({ type: 'done', ...(s?.changed ? { doc: s.doc } : {}), ...(s?.selection ? { selection: s.selection } : {}), ...(session ? { session } : {}), end: aborted ? 'aborted' : failure ? 'error' : 'done', ...(failure ? { error: failure } : {}) });
    res.end();
    rmSync(dir, { recursive: true, force: true });
  };
}

/** A short line of the part's state for the model, sent with each user message. */
export function stateNote(doc: StudioDoc): string {
  return `[Current part: ${doc.nodes.length} feature${doc.nodes.length === 1 ? '' : 's'}. The user may have edited it since your last turn; call get_part_summary when you need its faces and edges.]`;
}
