// The external MCP server (A5.4, O12): `cad-mcp --doc part.bcad` serves the studio's tools over stdio to any MCP
// client (Claude Code, Claude Desktop), for as long as the client keeps it, on a .bcad file of its own. Each change is
// saved at once, atomically (a temporary file renamed over it), mesh blobs and all (engine/container.ts); a file that
// does not exist yet is a new, empty part, written on the first change. Local files only. The same tool layer as the
// studio's chat: its gates, its proposals (kept in the file for the user to accept in the studio).
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
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

function prepareWrite(path: string, bytes: Uint8Array | string, publish: (temporary: string) => void): void {
  const tmp = join(dirname(path), `.write-${randomUUID()}.tmp`);
  const fd = openSync(tmp, 'wx');
  try {
    try { writeFileSync(fd, bytes); } finally { closeSync(fd); }
    publish(tmp);
  } catch (error) {
    try { unlinkSync(tmp); } catch { /* The original write error takes precedence. */ }
    throw error;
  }
}

/** Replace a file with complete bytes from a temporary sibling. */
export function writeAtomic(path: string, bytes: Uint8Array | string): void {
  prepareWrite(path, bytes, tmp => renameSync(tmp, path));
}

interface DiskStamp { device: bigint; inode: bigint; digest: string }
const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const errorCode = (error: unknown) => (error as NodeJS.ErrnoException | null)?.code;
const stamp = ({ dev, ino }: { dev: bigint; ino: bigint }, bytes: Uint8Array): DiskStamp => ({
  device: dev, inode: ino, digest: sha256(bytes),
});
const sameStamp = (a: DiskStamp | null, b: DiskStamp | null): boolean =>
  a === null || b === null ? a === b : a.device === b.device && a.inode === b.inode && a.digest === b.digest;

function readDisk(path: string): { bytes: Buffer; stamp: DiskStamp } | null {
  let fd: number;
  try { fd = openSync(path, 'r'); } catch (error) {
    if (errorCode(error) === 'ENOENT') return null;
    throw error;
  }
  try {
    const info = fstatSync(fd, { bigint: true });
    const bytes = readFileSync(fd);
    return { bytes, stamp: stamp(info, bytes) };
  } finally { closeSync(fd); }
}

/** Read a native model and its identity from the same opened file. */
async function readModel(path: string, missing: 'new' | 'refuse'):
  Promise<{ doc: StudioDoc; isNew: boolean; stamp: DiskStamp | null } | { error: string }> {
  const why = notLocalModel(path);
  if (why) return { error: why };
  const disk = readDisk(path);
  if (!disk) return missing === 'new' ? { doc: emptyDoc(), isNew: true, stamp: null } : { error: `There is no file "${path}".` };
  const read = await readStudioFile(new Uint8Array(disk.bytes));
  return 'error' in read ? read : { doc: read.doc, isNew: false, stamp: disk.stamp };
}

/** A local .bcad file read with its native blobs, or a new part when requested. */
export async function openModel(path: string, missing: 'new' | 'refuse' = 'refuse'): Promise<{ doc: StudioDoc; isNew: boolean } | { error: string }> {
  const read = await readModel(path, missing);
  return 'error' in read ? read : { doc: read.doc, isNew: read.isNew };
}

const STORAGE_CHANGED = '[STORAGE_CHANGED] The model file changed since this session last read or saved it. Reopen the file in a new cad-mcp session.';
const STORAGE_BUSY = '[STORAGE_BUSY] A cad-mcp save lock is present for this file. Retry when the other save has finished.';

function takeSaveLock(path: string): boolean {
  try { mkdirSync(path); return true; } catch (error) {
    if (errorCode(error) === 'EEXIST') return false;
    throw error;
  }
}

/** Guard a local external session's saved source. The sibling lock serializes cooperating saves to the same path. */
export function docStore(path: string): McpStore {
  const lock = join(dirname(path), `.cad-mcp-${sha256(basename(path))}.lock`);
  let expected: DiskStamp | null = null, conflicted = false, unsaved: string | null = null;
  const refuse = (reason: string): string => unsaved = reason;
  return {
    async open() {
      const read = await readModel(path, 'new');
      if ('error' in read) throw new Error(read.error);
      expected = read.stamp;
      return { doc: read.doc, changed: false, version: 0 };
    },
    unsavedNotice: () => unsaved,
    save(s, why) {
      if (why !== 'change') return null;
      if (conflicted) return refuse(STORAGE_CHANGED);
      try {
        const bytes = encodeStudioFile(s.doc);
        if (!takeSaveLock(lock)) return refuse(STORAGE_BUSY);
        try {
          prepareWrite(path, bytes, tmp => {
            const next = stamp(statSync(tmp, { bigint: true }), bytes);
            const entry = lstatSync(path, { throwIfNoEntry: false });
            if (entry?.isSymbolicLink()) throw new Error('[STORAGE_UNAVAILABLE] Open the model at its direct path to save it.');
            if (!sameStamp(expected, readDisk(path)?.stamp ?? null)) {
              conflicted = true;
              throw new Error(STORAGE_CHANGED);
            }
            renameSync(tmp, path);
            expected = next;
            unsaved = null;
          });
          return null;
        } finally {
          try { rmdirSync(lock); } catch { /* Lock cleanup cannot change the result of the completed write. */ }
        }
      } catch (error) {
        return refuse(error instanceof Error ? error.message : String(error));
      }
    },
  };
}

const USAGE = `cad-mcp --doc part.bcad [--autonomy 1|2|3|4] [--libraries dir]
  Serves the studio's CAD tools (13, barocss-cad-tools-v2) over stdio (MCP) on one local .bcad file, saving each change to it.
  --autonomy   as in the studio (default 2): 1 proposes everything; 2 builds an empty part and edits values, and
               proposes the rest; 3 and 4 may also accept proposals. Proposals stay in the file for the studio.
  --libraries  a folder of team library files (.json) the library tools can use
  If the saved source changed, reopen it in a new session before editing again.`;

/** Parses `cad-mcp`'s arguments: the options, or the usage text and why. */
export function mcpOptions(argv: readonly string[]): { doc: string; autonomy?: string; libraries?: string } | { usage: string; error?: string } {
  const o: { doc?: string; autonomy?: string; libraries?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--help' || a === '-h') return { usage: USAGE };
    if (a === '--doc' && v) { o.doc = resolve(v); i++; }
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
  registerTeamLibraries(o.libraries);
  try { await serveMcp(docStore(o.doc), process.stdin, process.stdout); return 0; }
  catch (e) { stderr.write(`cad-mcp: ${e instanceof Error ? e.message : String(e)}\n`); return 1; }
}
