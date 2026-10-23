import { receivePersonRowFiles, type RowFileInput, type PersonRowFiles } from '@barocss/cad-model/chat/rowFiles';
// The studio's chat tools as an MCP server (stdio, newline-delimited JSON-RPC) for the `claude` CLI.
// The part lives in a state file the chat server writes before the turn and reads after each tool call:
// {doc, selection?, changed}. Tools run in Node on the same engine as the studio (src/chat/tools.ts).
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerLibrary } from '@barocss/cad-model/library/libraries';
import { createInterface } from 'node:readline';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { ImageTrace } from '@barocss/cad-model/chat/trace';
import { runTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { outputSchemaOf } from '@barocss/cad-model/chat/contract';
import { GROUPS, v1Call, v2Result } from '@barocss/cad-model/chat/groups';
import { listed, TOOLSET } from '@barocss/cad-model/chat/toolset';
import { arrayOf, putKnownBlob, type BlobType } from '@barocss/cad-model/engine/blobs';
import { captureOp, type TurnOp } from '@barocss/cad-model/chat/merge';
import { ROBOT_CHECK, robotCheckCall, robotCheckListed, robotL3 } from './robotL3/tool';

/** `images`: the traces of the conversation's attached images (read only). */
/** `blobFiles`: the document's mesh blobs (M1, D45), files the chat server checked and kept for the conversation, read into the store before the first call. */
export interface StateFile { rowFiles?: RowFileInput[]; rowConversation?: string; doc: StudioDoc; selection?: ChatState['selection']; changed: boolean; /** Bumped by each tool call that changed the part (PERF3 A3: the server re-emits a state only when it rose). */ version?: number; images?: ImageTrace[]; blobFiles?: { hash: string; dtype: BlobType; path: string }[]; /** What the user typed this conversation (A6.2): quotes are checked against it. */ turns?: string[]; /** The turn's calls that changed the part, each as it did it (O133: merged onto the person's part when they edited during the turn). */ ops?: TurnOp[] }

/** The tools as MCP lists them (A5.1): title, annotations and, for read actions, the output schema (v2, the only list, O105). */
export const TOOLS_LISTED = TOOLSET.tools.map(listed);
/** The handler a call runs (a consolidated tool's action, A5.3), for its output schema. */
const v1Name = (name: string, args: unknown) => { const v = v1Call(name, args); return v && !('error' in v) ? v.name : name; };
const structuredOf = (text: string): Record<string, unknown> | undefined => { try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined; } catch { return undefined; } };

let revision = 1;
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, revision++);

/**
 * Where the server's part lives: the chat server's per-turn state file, or a .bcad document (A5.4, `cad-mcp --doc`).
 * `save` runs after a change (and a selection, which only the state file keeps); it returns why it could not save.
 */
export interface McpStore {
  open(): Promise<{ doc: StudioDoc; selection?: ChatState['selection']; images?: ImageTrace[]; turns?: string[]; changed: boolean; version: number; rowFiles?: PersonRowFiles }>;
  save(s: { doc: StudioDoc; selection?: ChatState['selection']; changed: boolean; version: number; ops?: TurnOp[] }, why: 'change' | 'select'): string | null;
}
/** The chat server's state file: {doc, selection?, changed, version}, its blobs read from the files it names. */
export function stateFileStore(statePath: string): McpStore {
  return {
    async open() {
      const saved = JSON.parse(readFileSync(statePath, 'utf8')) as StateFile;
      for (const b of saved.blobFiles ?? []) { const bytes = readFileSync(b.path); putKnownBlob(b.hash, arrayOf(b.dtype, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))); }
      const rowFiles = saved.rowFiles ? receivePersonRowFiles(saved.rowConversation ?? '', saved.rowFiles, saved.turns?.length ?? 0) : undefined;
      return { doc: saved.doc, ...(rowFiles ? { rowFiles } : {}), ...(saved.selection ? { selection: saved.selection } : {}), ...(saved.images ? { images: saved.images } : {}), ...(Array.isArray(saved.turns) ? { turns: saved.turns } : {}), changed: saved.changed, version: saved.version ?? 0 };
    },
    save(s) {
      const previous = JSON.parse(readFileSync(statePath, 'utf8')) as StateFile;
      const tmp = `${statePath}.tmp`;
      writeFileSync(tmp, JSON.stringify({ ...(previous.rowFiles ? { rowFiles: previous.rowFiles, rowConversation: previous.rowConversation } : {}), ...(previous.turns ? { turns: previous.turns } : {}), doc: s.doc, ...(s.selection ? { selection: s.selection } : {}), changed: s.changed, version: s.version, ...(s.ops?.length ? { ops: s.ops } : {}) } satisfies StateFile));
      renameSync(tmp, statePath);
      return null;
    },
  };
}

export async function serveMcp(source: string | McpStore, input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout) {
  const store = typeof source === 'string' ? stateFileStore(source) : source, saved = await store.open();
  const first = await evaluate(saved.doc);
  let state: ChatState = { doc: saved.doc, turnBase: saved.doc, bodies: first.ok ? first.bodies : [], ...(saved.rowFiles ? { rowFiles: saved.rowFiles } : {}), ...(saved.selection ? { selection: saved.selection } : {}), ...(saved.images ? { images: saved.images } : {}), ...(saved.turns ? { turns: saved.turns } : {}) };
  let changed = saved.changed, version = saved.version;
  // (O133: each call that changed the part, captured as what it did — the studio merges them onto the part as the person has it.)
  const ops: TurnOp[] = [];
  const save = (why: 'change' | 'select') => store.save({ doc: state.doc, ...(state.selection ? { selection: state.selection } : {}), changed, version, ops }, why);
  const reply = (id: unknown, result: unknown) => void output.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
  const error = (id: unknown, code: number, message: string) => void output.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');

  // Calls run one at a time, in order: each one sees the part the previous one left.
  let queue = Promise.resolve();
  const handle = async (msg: { id?: unknown; method?: string; params?: Record<string, any> }) => {
    if (msg.id === undefined) return; // notifications
    switch (msg.method) {
      // (The tool contract's version, A5.1: names, input and output schemas and annotations frozen in packages/barocss-cad-model/src/chat/tools-v2.json.)
      case 'initialize': return reply(msg.id, { protocolVersion: msg.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'barocss-cad', title: 'BaroCSS CAD', version: TOOLSET.version } });
      case 'ping': return reply(msg.id, {});
      // (O15: robot_check only in RD10's L3 run, CAD_ROBOT_L3=1.)
      case 'tools/list': return reply(msg.id, { tools: robotL3() ? [...TOOLS_LISTED, robotCheckListed()] : TOOLS_LISTED });
      case 'tools/call': {
        // (Only the listed tools: a handler's own name (`run_command`) is not one, O105. Ops inside a batch or a proposal
        // name tools as before; saved proposals replay.)
        if (robotL3() && msg.params?.name === ROBOT_CHECK) { const r = await robotCheckCall(state.doc, state.bodies, evaluate, msg.params?.arguments ?? {}); return reply(msg.id, { content: [{ type: 'text', text: r.text }], ...(r.isError ? { isError: true } : {}) }); }
        if (!(String(msg.params?.name) in GROUPS)) return error(msg.id, -32602, `Unknown tool: ${String(msg.params?.name)}. The tools are ${Object.keys(GROUPS).join(', ')}.`);
        const before = state.doc, out = await runTool(state, String(msg.params?.name), msg.params?.arguments ?? {}, evaluate);
        if (out.changed) { const v1 = v1Call(String(msg.params?.name), msg.params?.arguments ?? {}); ops.push(captureOp(before, out.state.doc, v1 && !('error' in v1) ? v1.name : String(msg.params?.name), v1 && !('error' in v1) ? v1.args : {})); }
        state = out.state; changed ||= out.changed; if (out.changed) version++;
        const unsaved = out.changed ? save('change') : v1Name(String(msg.params?.name), msg.params?.arguments) === 'select' ? save('select') : null;
        // (A read tool's result also as structured content, its output schema's shape; the text keeps the same JSON.)
        // (What the caller reads names v2 tools only, O105b: a handler's hint or refusal as its tool.action, a stored op as its v2 call.)
        const text = v2Result(out.content);
        const structured = !out.isError && !unsaved && outputSchemaOf(v1Name(String(msg.params?.name), msg.params?.arguments)) ? structuredOf(text) : undefined;
        // (A change the store could not keep is said so, as an error: the part changed here but not on disk.)
        return reply(msg.id, { content: [{ type: 'text', text }, ...(unsaved ? [{ type: 'text', text: `Not saved: ${unsaved}` }] : []), ...(out.images ?? []).map(i => ({ type: 'image', data: i.data, mimeType: i.mediaType }))], ...(structured ? { structuredContent: structured } : {}), isError: out.isError || !!unsaved });
      }
      default: return error(msg.id, -32601, `Unknown method ${msg.method}`);
    }
  };
  const lines = createInterface({ input });
  lines.on('line', line => {
    if (!line.trim()) return;
    let msg; try { msg = JSON.parse(line); } catch { return error(null, -32700, 'Parse error'); }
    queue = queue.then(() => handle(msg)).catch(e => error(msg.id, -32603, e instanceof Error ? e.message : String(e)));
  });
  await new Promise<void>(resolve => lines.on('close', resolve));
  await queue;
}

/** The team's libraries (LIB4, D64) from its folder, so the agent's insert_part finds them too; one that does not load is skipped. */
export function registerTeamLibraries(dir: string | undefined): number {
  if (!dir) return 0;
  let n = 0;
  try { for (const name of readdirSync(dir).filter(x => x.endsWith('.json') && !x.endsWith('.check.json'))) { try { registerLibrary(JSON.parse(readFileSync(join(dir, name), 'utf8')), 'team'); n++; } catch { /* skipped */ } } } catch { /* no folder */ }
  return n;
}
if (process.env.CAD_CHAT_STATE) { registerTeamLibraries(process.env.CAD_TEAM_LIBRARIES); void serveMcp(process.env.CAD_CHAT_STATE); }
