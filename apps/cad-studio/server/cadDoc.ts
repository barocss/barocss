// The external MCP server (A5.4, O12): `cad-mcp --doc part.bcad` serves the studio's tools over stdio to any MCP
// client (Claude Code, Claude Desktop), for as long as the client keeps it, on a .bcad file of its own. Each change is
// saved at once, atomically (a temporary file renamed over it), mesh blobs and all (engine/container.ts); a file that
// does not exist yet is a new, empty part, written on the first change. Local files only. The same tool layer as the
// studio's chat: its gates, its proposals (kept in the file for the user to accept in the studio).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { registerTeamLibraries, serveMcp, type McpStore } from './cadMcp';

/** Why a path is not a local .bcad (or .json) file the tools may use, or null. */
export function notLocalModel(path: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path)) return `"${path}" is not a local file (local files only).`;
  if (!/\.(bcad|json)$/i.test(path)) return `"${path}" is not a .bcad model file.`;
  return null;
}

/** Bytes written so that a reader sees the old file or the new one, never part of one: a temporary file renamed over it. */
export function writeAtomic(path: string, bytes: Uint8Array | string): void {
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  writeFileSync(tmp, bytes);
  renameSync(tmp, path);
}

/** A .bcad file read: its document (its blobs into the store), a missing file as a new part, or the reason it cannot be read. */
export async function openModel(path: string, missing: 'new' | 'refuse' = 'refuse'): Promise<{ doc: StudioDoc; isNew: boolean } | { error: string }> {
  const why = notLocalModel(path);
  if (why) return { error: why };
  if (!existsSync(path)) return missing === 'new' ? { doc: emptyDoc(), isNew: true } : { error: `There is no file "${path}".` };
  const read = await readStudioFile(new Uint8Array(readFileSync(path)));
  return 'error' in read ? read : { doc: read.doc, isNew: false };
}

/** The part as a .bcad file: each change saved at once, atomically; the selection is the studio's, not saved. */
export function docStore(path: string): McpStore {
  return {
    async open() {
      const r = await openModel(path, 'new');
      if ('error' in r) throw new Error(r.error);
      return { doc: r.doc, changed: false, version: 0 };
    },
    save(s, why) {
      if (why !== 'change') return null;
      try { writeAtomic(path, encodeStudioFile(s.doc)); return null; } catch (e) { return e instanceof Error ? e.message : String(e); }
    },
  };
}

const USAGE = `cad-mcp --doc part.bcad [--toolset v1|v2] [--autonomy 1|2|3|4] [--libraries dir]
  Serves the studio's CAD tools over stdio (MCP) on one local .bcad file, saving each change to it.
  --toolset    the tool list: v1 (58 tools, the default) or v2 (13 consolidated tools)
  --autonomy   as in the studio (default 2): 1 proposes everything; 2 builds an empty part and edits values, and
               proposes the rest; 3 and 4 may also accept proposals. Proposals stay in the file for the studio.
  --libraries  a folder of team library files (.json) the library tools can use`;

/** Parses `cad-mcp`'s arguments: the options, or the usage text and why. */
export function mcpOptions(argv: readonly string[]): { doc: string; toolset?: 'v1' | 'v2'; autonomy?: string; libraries?: string } | { usage: string; error?: string } {
  const o: { doc?: string; toolset?: 'v1' | 'v2'; autonomy?: string; libraries?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--help' || a === '-h') return { usage: USAGE };
    if (a === '--doc' && v) { o.doc = resolve(v); i++; }
    else if (a === '--toolset' && (v === 'v1' || v === 'v2')) { o.toolset = v; i++; }
    else if (a === '--autonomy' && /^[1-4]$/.test(v ?? '')) { o.autonomy = v; i++; }
    else if (a === '--libraries' && v) { o.libraries = resolve(v); i++; }
    else return { usage: USAGE, error: `cad-mcp: unknown or incomplete option "${a}"` };
  }
  if (!o.doc) return { usage: USAGE, error: 'cad-mcp: --doc part.bcad is required' };
  const why = notLocalModel(o.doc);
  return why ? { usage: USAGE, error: `cad-mcp: ${why}` } : { ...o, doc: o.doc };
}

/** `cad-mcp`: serves until the client closes stdin; the exit code. */
export async function mcpMain(argv: readonly string[], stderr: NodeJS.WritableStream = process.stderr): Promise<number> {
  const o = mcpOptions(argv);
  if ('usage' in o) { stderr.write(`${o.error ? `${o.error}\n` : ''}${o.usage}\n`); return o.error ? 2 : 0; }
  // (The tool layer reads these from the environment, as under the chat server.)
  if (o.autonomy) process.env.CAD_AUTONOMY = o.autonomy;
  if (o.toolset) process.env.CAD_TOOLSET = o.toolset;
  registerTeamLibraries(o.libraries);
  try { await serveMcp(docStore(o.doc), process.stdin, process.stdout, o.toolset); return 0; }
  catch (e) { stderr.write(`cad-mcp: ${e instanceof Error ? e.message : String(e)}\n`); return 1; }
}
