// The studio's chat tools as an MCP server (stdio, newline-delimited JSON-RPC) for the `claude` CLI.
// The part lives in a state file the chat server writes before the turn and reads after each tool call:
// {doc, selection?, changed}. Tools run in Node on the same engine as the studio (src/chat/tools.ts).
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerLibrary } from '../src/library/libraries';
import { createInterface } from 'node:readline';
import { evaluateDoc } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import type { ImageTrace } from '../src/chat/trace';
import { runTool, TOOLS, type ChatState } from '../src/chat/tools';
import { TOOL_CONTRACT_VERSION, annotationsOf, outputSchemaOf } from '../src/chat/contract';
import { arrayOf, putKnownBlob, type BlobType } from '../src/engine/blobs';

/** `images`: the traces of the conversation's attached images (read only). */
/** `blobFiles`: the document's mesh blobs (M1, D45), files the chat server checked and kept for the conversation, read into the store before the first call. */
export interface StateFile { doc: StudioDoc; selection?: ChatState['selection']; changed: boolean; /** Bumped by each tool call that changed the part (PERF3 A3: the server re-emits a state only when it rose). */ version?: number; images?: ImageTrace[]; blobFiles?: { hash: string; dtype: BlobType; path: string }[] }

/** The tools as MCP lists them (A5.1): title, annotations and, for read tools, the output schema. */
export const TOOLS_LISTED = TOOLS.map(t => { const a = annotationsOf(t.name), out = outputSchemaOf(t.name); return { name: t.name, title: a.title, description: t.description, inputSchema: t.input_schema, ...(out ? { outputSchema: out } : {}), annotations: a }; });
const structuredOf = (text: string): Record<string, unknown> | undefined => { try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined; } catch { return undefined; } };

let revision = 1;
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, revision++);

export async function serveMcp(statePath: string, input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout) {
  const saved = JSON.parse(readFileSync(statePath, 'utf8')) as StateFile;
  for (const b of saved.blobFiles ?? []) { const bytes = readFileSync(b.path); putKnownBlob(b.hash, arrayOf(b.dtype, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))); }
  const first = await evaluate(saved.doc);
  let state: ChatState = { doc: saved.doc, turnBase: saved.doc, bodies: first.ok ? first.bodies : [], ...(saved.selection ? { selection: saved.selection } : {}), ...(saved.images ? { images: saved.images } : {}) };
  let changed = saved.changed, version = saved.version ?? 0;
  const save = () => {
    const tmp = `${statePath}.tmp`;
    writeFileSync(tmp, JSON.stringify({ doc: state.doc, ...(state.selection ? { selection: state.selection } : {}), changed, version } satisfies StateFile));
    renameSync(tmp, statePath);
  };
  const reply = (id: unknown, result: unknown) => void output.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
  const error = (id: unknown, code: number, message: string) => void output.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');

  // Calls run one at a time, in order: each one sees the part the previous one left.
  let queue = Promise.resolve();
  const handle = async (msg: { id?: unknown; method?: string; params?: Record<string, any> }) => {
    if (msg.id === undefined) return; // notifications
    switch (msg.method) {
      // (The tool contract's version, A5.1: names, input and output schemas and annotations frozen in src/chat/tools-v1.json.)
      case 'initialize': return reply(msg.id, { protocolVersion: msg.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'barocss-cad', title: 'BaroCSS CAD', version: TOOL_CONTRACT_VERSION } });
      case 'ping': return reply(msg.id, {});
      case 'tools/list': return reply(msg.id, { tools: TOOLS_LISTED });
      case 'tools/call': {
        const out = await runTool(state, String(msg.params?.name), msg.params?.arguments ?? {}, evaluate);
        state = out.state; changed ||= out.changed; if (out.changed) version++;
        if (out.changed || msg.params?.name === 'select') save();
        // (A read tool's result also as structured content, its output schema's shape; the text keeps the same JSON.)
        const structured = !out.isError && outputSchemaOf(String(msg.params?.name)) ? structuredOf(out.content) : undefined;
        return reply(msg.id, { content: [{ type: 'text', text: out.content }, ...(out.images ?? []).map(i => ({ type: 'image', data: i.data, mimeType: i.mediaType }))], ...(structured ? { structuredContent: structured } : {}), isError: out.isError });
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
