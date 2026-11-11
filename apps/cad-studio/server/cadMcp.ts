import { receivePersonRowFiles, type RowFileInput, type PersonRowFiles } from '@barocss/cad-model/engine/rowFiles';
// The studio's chat tools as an MCP server (stdio, newline-delimited JSON-RPC) for the `claude` CLI.
// The part lives in a state file the chat server writes before the turn and reads after each tool call:
// {doc, selection?, changed}. Tools run in Node on the same engine as the studio (src/chat/tools.ts).
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerLibrary } from '@barocss/cad-model/library/libraries';
import { createInterface } from 'node:readline';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { VersionLog } from '@barocss/cad-model/versions/log';
import { wantedOf } from '@barocss/cad-model/versions/tools';
import type { ImageTrace } from '@barocss/cad-model/chat/trace';
import { runTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { outputSchemaOf } from '@barocss/cad-model/chat/contract';
import { GROUPS, v1Call, v2Result } from '@barocss/cad-model/chat/groups';
import { listed, TOOLSET } from '@barocss/cad-model/chat/toolset';
import { arrayOf, putKnownBlob, type BlobType } from '@barocss/cad-model/engine/blobs';
import { captureOp, type TurnOp } from '@barocss/cad-model/chat/merge';
import { readSelectedNativeCheck, selectedNativeCheckTool, SELECTED_NATIVE_CHECK } from './taskRun/nativeEvidence';
import { isTaskRunFindingSelection, type TaskRunFindingSelection } from '../src/chat/taskRunOffer';
import { ROBOT_CHECK, robotCheckCall, robotCheckListed, robotL3 } from './robotL3/tool';
import type { ApprovalAttachmentPayload } from '../src/storage/faceRepairEvidence';
import { isObj } from '@barocss/cad-model/util/guards';
import { requiresTurnApproval } from './turnAutonomy';
import { faceDiagnosisMatchesDocument, isFaceDiagnosisSelection, type FaceDiagnosisSelection } from '../src/chat/faceDiagnosis';
import { SELECTED_FACE_DIAGNOSIS, readSelectedFaceDiagnosis, selectedFaceDiagnosisTool } from './selectedFaceDiagnosis';
import { SELECTED_APPROVAL_EVIDENCE, SELECTED_FOLLOW_UP_REPAIR, readSelectedApprovalForTurn,
  selectedApprovalEvidenceTool, selectedFollowUpRepairTool } from './selectedApprovalEvidence';

/** `images`: the traces of the conversation's attached images (read only). */
/** `blobFiles`: the document's mesh blobs (M1, D45), files the chat server checked and kept for the conversation, read into the store before the first call. */
export interface StateFile { taskFinding?: TaskRunFindingSelection; rowFiles?: RowFileInput[]; rowConversation?: string; doc: StudioDoc; selection?: ChatState['selection']; changed: boolean; /** Bumped by each tool call that changed the part (PERF3 A3: the server re-emits a state only when it rose). */ version?: number; images?: ImageTrace[]; blobFiles?: { hash: string; dtype: BlobType; path: string }[]; /** What the user typed this conversation (A6.2): quotes are checked against it. */ turns?: string[]; /** The turn's calls that changed the part, each as it did it (O133: merged onto the person's part when they edited during the turn). */ ops?: TurnOp[];
  /** CG6 (DA-9): the project's version log as the turn carries it (versions/log.ts turnLog: the index, the documents it needs); `versionsChanged` when a call moved it, `versionsWanted` the versions whose documents a call asked for. */
  versions?: VersionLog; versionsChanged?: boolean; versionsWanted?: string[]; selectedApproval?: ApprovalAttachmentPayload; selectedFaceDiagnosis?: FaceDiagnosisSelection }

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
  open(): Promise<{ doc: StudioDoc; approvalRequired?: true; taskFinding?: TaskRunFindingSelection; selection?: ChatState['selection']; images?: ImageTrace[]; turns?: string[]; changed: boolean; version: number; rowFiles?: PersonRowFiles; versions?: VersionLog; selectedApproval?: ApprovalAttachmentPayload; selectedFaceDiagnosis?: FaceDiagnosisSelection }>;
  save(s: { doc: StudioDoc; selection?: ChatState['selection']; changed: boolean; version: number; ops?: TurnOp[]; versions?: VersionLog; versionsChanged?: boolean; versionsWanted?: string[] }, why: 'change' | 'select' | 'versions'): string | null;
  unsavedNotice?(): string | null;
}
/** The chat server's state file: {doc, selection?, changed, version}, its blobs read from the files it names. */
export function stateFileStore(statePath: string): McpStore {
  return {
    async open() {
      const saved = JSON.parse(readFileSync(statePath, 'utf8')) as StateFile;
      const lastTurn = Array.isArray(saved.turns) ? saved.turns.at(-1) : undefined;
      // The turn file carries the latest authored message. Hosts without that history can provide the current prompt.
      const approvalRequired = requiresTurnApproval(typeof lastTurn === 'string' ? lastTurn : process.env.CAD_PROMPT ?? '');
      for (const b of saved.blobFiles ?? []) { const bytes = readFileSync(b.path); putKnownBlob(b.hash, arrayOf(b.dtype, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))); }
      const rowFiles = saved.rowFiles ? receivePersonRowFiles(saved.rowConversation ?? '', saved.rowFiles, saved.turns?.length ?? 0) : undefined;
      return { doc: saved.doc, ...(approvalRequired ? { approvalRequired: true } : {}), ...(saved.taskFinding ? { taskFinding: saved.taskFinding } : {}), ...(saved.selectedApproval ? { selectedApproval: saved.selectedApproval } : {}), selectedFaceDiagnosis: saved.selectedFaceDiagnosis, ...(rowFiles ? { rowFiles } : {}), ...(saved.selection ? { selection: saved.selection } : {}), ...(saved.images ? { images: saved.images } : {}), ...(Array.isArray(saved.turns) ? { turns: saved.turns } : {}), ...(saved.versions ? { versions: saved.versions } : {}), changed: saved.changed, version: saved.version ?? 0 };
    },
    save(s) {
      const previous = JSON.parse(readFileSync(statePath, 'utf8')) as StateFile;
      const tmp = `${statePath}.tmp`;
      writeFileSync(tmp, JSON.stringify({ ...(previous.taskFinding ? { taskFinding: previous.taskFinding } : {}), ...(previous.selectedApproval ? { selectedApproval: previous.selectedApproval } : {}), selectedFaceDiagnosis: previous.selectedFaceDiagnosis, ...(previous.rowFiles ? { rowFiles: previous.rowFiles, rowConversation: previous.rowConversation } : {}), ...(previous.turns ? { turns: previous.turns } : {}), doc: s.doc, ...(s.selection ? { selection: s.selection } : {}), changed: s.changed, version: s.version, ...(s.ops?.length ? { ops: s.ops } : {}), ...(s.versions ? { versions: s.versions } : {}), ...(s.versionsChanged ? { versionsChanged: true } : {}), ...(s.versionsWanted?.length ? { versionsWanted: s.versionsWanted } : {}) } satisfies StateFile));
      renameSync(tmp, statePath);
      return null;
    },
  };
}

export async function serveMcp(source: string | McpStore, input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout, taskRunRoot?: string) {
  const store = typeof source === 'string' ? stateFileStore(source) : source, saved = await store.open();
  const selection = taskRunRoot && isTaskRunFindingSelection(saved.taskFinding) ? saved.taskFinding : undefined;
  const faceDiagnosis = isFaceDiagnosisSelection(saved.selectedFaceDiagnosis) && faceDiagnosisMatchesDocument(saved.doc, saved.selectedFaceDiagnosis)
    ? saved.selectedFaceDiagnosis : undefined;
  const approval = await readSelectedApprovalForTurn(saved.selectedApproval, saved.versions);
  const tools = [...TOOLS_LISTED, ...(robotL3() ? [robotCheckListed()] : []), ...(selection ? [selectedNativeCheckTool] : []),
    ...(approval ? [selectedApprovalEvidenceTool] : []), ...(approval?.repair ? [selectedFollowUpRepairTool] : []),
    ...(faceDiagnosis ? [selectedFaceDiagnosisTool] : [])];
  const first = await evaluate(saved.doc);
  let state: ChatState = { doc: saved.doc, turnBase: saved.doc, bodies: first.ok ? first.bodies : [], ...(saved.rowFiles ? { rowFiles: saved.rowFiles } : {}), ...(saved.selection ? { selection: saved.selection } : {}), ...(saved.images ? { images: saved.images } : {}), ...(saved.turns ? { turns: saved.turns } : {}), ...(saved.versions ? { versions: saved.versions } : {}) };
  let changed = saved.changed, version = saved.version, versionsChanged = false;
  // (O133: each call that changed the part, captured as what it did — the studio merges them onto the part as the person has it.)
  const ops: TurnOp[] = [];
  const save = (why: 'change' | 'select' | 'versions') => store.save({ doc: state.doc, ...(state.selection ? { selection: state.selection } : {}), changed, version, ops, ...(state.versions ? { versions: state.versions } : {}), versionsChanged, ...(state.versionsWanted?.length ? { versionsWanted: state.versionsWanted } : {}) }, why);
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
      case 'tools/list': return reply(msg.id, { tools });
      case 'tools/call': {
        // (Only the listed tools: a handler's own name (`run_command`) is not one, O105. Ops inside a batch or a proposal
        // name tools as before; saved proposals replay.)
        if (robotL3() && msg.params?.name === ROBOT_CHECK) { const r = await robotCheckCall(state.doc, state.bodies, evaluate, msg.params?.arguments ?? {}); return reply(msg.id, { content: [{ type: 'text', text: r.text }], ...(r.isError ? { isError: true } : {}) }); }
        if (selection && taskRunRoot && msg.params?.name === SELECTED_NATIVE_CHECK) {
          const result = readSelectedNativeCheck(taskRunRoot, selection, state.doc, msg.params.arguments);
          return reply(msg.id, { content: [{ type: 'text', text: JSON.stringify(result) }],
            ...('error' in result ? { isError: true } : { isError: false, structuredContent: result }) });
        }
        if (approval && msg.params?.name === SELECTED_APPROVAL_EVIDENCE) {
          const args: unknown = msg.params.arguments === undefined ? {} : msg.params.arguments;
          if (!isObj(args) || Object.keys(args).length) return error(msg.id, -32602, 'The selected approval evidence tool takes no arguments.');
          const result = { file: approval.file };
          return reply(msg.id, { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false, structuredContent: result });
        }
        if (faceDiagnosis && msg.params?.name === SELECTED_FACE_DIAGNOSIS) {
          const result = await readSelectedFaceDiagnosis(faceDiagnosis, state.doc, evaluate, msg.params.arguments);
          return reply(msg.id, { content: [{ type: 'text', text: JSON.stringify(result) }],
            ...('error' in result ? { isError: true } : { isError: false, structuredContent: result }) });
        }
        const before = state.doc, name = String(msg.params?.name), args = msg.params?.arguments;
        const repair = name === SELECTED_FOLLOW_UP_REPAIR ? approval?.repair : undefined;
        if (!repair && !(name in GROUPS)) return error(msg.id, -32602, `Unknown tool: ${name}. The tools are ${Object.keys(GROUPS).join(', ')}.`);
        const handler = v1Name(name, args);
        const out = repair
          ? await (await import('./selectedFollowUpRepair')).prepareSelectedFollowUpRepair(state, args, repair, evaluate)
          : await runTool(saved.approvalRequired ? { ...state, approvalRequired: true } : state, name, args ?? {}, evaluate);
        if (out.changed) {
          const v1 = v1Call(name, args ?? {});
          ops.push(captureOp(before, out.state.doc, v1 && !('error' in v1) ? v1.name : name, v1 && !('error' in v1) ? v1.args : repair && isObj(args) ? args : {}));
        }
        // (CG6: a call that moved the version log — a version, a branch, a document asked for — is kept even when the part is not.)
        const asked = out.isError ? wantedOf(out.content) : [], next = asked.length ? { ...out.state, versionsWanted: [...new Set([...(out.state.versionsWanted ?? []), ...asked])] } : out.state;
        const logMoved = next.versions !== state.versions, wantedMoved = next.versionsWanted !== state.versionsWanted;
        state = next; changed ||= out.changed; if (out.changed) version++; versionsChanged ||= logMoved;
        const unsaved = out.changed ? save('change') : logMoved || wantedMoved ? save('versions') : handler === 'select' ? save('select') : null;
        // (A read tool's result also as structured content, its output schema's shape; the text keeps the same JSON.)
        // (What the caller reads names v2 tools only, O105b: a handler's hint or refusal as its tool.action, a stored op as its v2 call.)
        const exactRead = handler === 'approved_requirement_evidence' || handler === 'inspect_local_task_plan';
        const text = exactRead && !out.isError ? out.content : v2Result(out.content, handler);
        const pending = store.unsavedNotice?.();
        const structured = !out.isError && !unsaved && !pending && outputSchemaOf(handler) ? structuredOf(text) : undefined;
        // A read can inspect the session after a failed save, with its unsaved state made explicit.
        const persistence = unsaved ? `Not saved: ${unsaved}` : pending ? `Unsaved session model: ${pending}` : null;
        return reply(msg.id, { content: [{ type: 'text', text }, ...(persistence ? [{ type: 'text', text: persistence }] : []), ...(out.images ?? []).map(i => ({ type: 'image', data: i.data, mimeType: i.mediaType }))], ...(structured ? { structuredContent: structured } : {}), isError: out.isError || !!unsaved });
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
if (process.env.CAD_CHAT_STATE) { registerTeamLibraries(process.env.CAD_TEAM_LIBRARIES); void serveMcp(process.env.CAD_CHAT_STATE, process.stdin, process.stdout, process.env.CAD_CHAT_TASK_RUN_ROOT); }
