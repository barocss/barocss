// The studio's chat tools as an MCP server (stdio, newline-delimited JSON-RPC) for the `claude` CLI.
// The part lives in a state file the chat server writes before the turn and reads after each tool call:
// {doc, selection?, changed}. Tools run in Node on the same engine as the studio (src/chat/tools.ts).
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { evaluateDoc } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import type { ImageTrace } from '../src/chat/trace';
import { runTool, TOOLS, type ChatState } from '../src/chat/tools';
import { blobsFromBase64, type WireBlobs } from '../src/engine/blobs';

/** `images`: the traces of the conversation's attached images (read only). */
/** `blobs`: the document's mesh blobs (M1), read into the store before the first call. */
export interface StateFile { doc: StudioDoc; selection?: ChatState['selection']; changed: boolean; images?: ImageTrace[]; blobs?: WireBlobs }

let revision = 1;
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, revision++);

export async function serveMcp(statePath: string, input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout) {
  const saved = JSON.parse(readFileSync(statePath, 'utf8')) as StateFile;
  if (saved.blobs) await blobsFromBase64(saved.blobs);
  const first = await evaluate(saved.doc);
  let state: ChatState = { doc: saved.doc, bodies: first.ok ? first.bodies : [], ...(saved.selection ? { selection: saved.selection } : {}), ...(saved.images ? { images: saved.images } : {}) };
  let changed = saved.changed;
  const save = () => {
    const tmp = `${statePath}.tmp`;
    writeFileSync(tmp, JSON.stringify({ doc: state.doc, ...(state.selection ? { selection: state.selection } : {}), changed } satisfies StateFile));
    renameSync(tmp, statePath);
  };
  const reply = (id: unknown, result: unknown) => void output.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
  const error = (id: unknown, code: number, message: string) => void output.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');

  // Calls run one at a time, in order: each one sees the part the previous one left.
  let queue = Promise.resolve();
  const handle = async (msg: { id?: unknown; method?: string; params?: Record<string, any> }) => {
    if (msg.id === undefined) return; // notifications
    switch (msg.method) {
      case 'initialize': return reply(msg.id, { protocolVersion: msg.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'barocss-cad', version: '0.0.0' } });
      case 'ping': return reply(msg.id, {});
      case 'tools/list': return reply(msg.id, { tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.input_schema })) });
      case 'tools/call': {
        const out = await runTool(state, String(msg.params?.name), msg.params?.arguments ?? {}, evaluate);
        state = out.state; changed ||= out.changed;
        if (out.changed || msg.params?.name === 'select') save();
        return reply(msg.id, { content: [{ type: 'text', text: out.content }, ...(out.images ?? []).map(i => ({ type: 'image', data: i.data, mimeType: i.mediaType }))], isError: out.isError });
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

if (process.env.CAD_CHAT_STATE) void serveMcp(process.env.CAD_CHAT_STATE);
