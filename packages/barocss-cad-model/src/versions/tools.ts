// CG6 VA-1 (DA-8): the agent's version actions — the history tool's version, versions, restore_version, compare,
// branch, switch and merge — over the version log the host hands the turn (`ChatState.versions`: the studio's open
// project; without one, a log kept for the session, as checkpoints are). Each is the version model's verb
// (versions/*.ts); a document it gives is taken as any change is (accept: evaluated, hard requirements kept). A merge's
// conflicts come back as data, for the agent to merge again with an answer for each.
import type { StudioDoc } from '../engine/doc';
import { accept, fail, json, type ChatState, type PartHandler, type ToolOutcome } from '../chat/toolKit';
import { BarocssError } from '@barocss/cad/api';
import { changesOf } from './compare';
import { applyBranch, headOf, makeBranch, makeVersion, makeVersions, readVersion, versionNamed, versionsOf, type Version, type VersionLog } from './log';
import { applyMerge, type Conflict, type Side } from './merge';

const now = () => new Date().toISOString();
/**
 * A refusal of the version model as the tool's failure, its "[CODE] …" text as it is. A version whose document is not
 * with this turn (VERSION_NOT_LOADED) is named in the result (`wanted`): a failed call changes nothing, so the host
 * reads it there (`wantedOf`) and sends that document with the next turn.
 */
const refused = (state: ChatState, e: unknown): ToolOutcome => {
  if (!(e instanceof BarocssError)) throw e;
  const ids = e.code === 'VERSION_NOT_LOADED' && Array.isArray(e.details?.ids) ? e.details.ids as string[] : [];
  return fail(state, e.message, { code: e.code, ...(ids.length ? { wanted: ids } : {}) });
};
/** The versions a failed call's result asked for (VERSION_NOT_LOADED), for the host to send with the next turn. */
export function wantedOf(content: string): string[] {
  try { const r = JSON.parse(content) as { code?: unknown; wanted?: unknown }; return r.code === 'VERSION_NOT_LOADED' && Array.isArray(r.wanted) ? r.wanted.filter((x): x is string => typeof x === 'string') : []; }
  catch { return []; }
}
const NO_LOG = 'No versions yet: history.version makes the first.';
const brief = (v: Version) => ({ id: v.id, ...(v.name ? { name: v.name } : {}), ...(v.note ? { note: v.note } : {}), branch: v.branch, at: v.at, ...(v.by ? { by: v.by } : {}), ...(v.parents.length > 1 ? { merge: true } : {}) });
/** A conflict's side as the agent reads it: a short value whole, a long one as its kind. */
const shortValue = (v: unknown): unknown => { if (v === undefined) return '(deleted)'; const t = JSON.stringify(v); return t.length <= 240 ? v : typeof v === 'object' && v && 'kind' in v ? `(${String((v as { kind: unknown }).kind)}, ${t.length} characters)` : `(${t.length} characters)`; };
const conflictOf = (c: Conflict) => ({ code: c.code, where: c.where, message: c.message, ours: shortValue(c.ours), theirs: shortValue(c.theirs) });

async function versionTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  const o = { at: now(), ...(typeof args.name === 'string' ? { name: args.name } : {}), ...(typeof args.note === 'string' ? { note: args.note } : {}), by: 'agent' };
  try {
    const r = state.versions ? makeVersion(state.versions, state.doc, o) : (log => ({ log, version: log.versions[0] }))(makeVersions(state.doc, o));
    return { state: { ...state, versions: r.log }, content: json({ ok: true, version: brief(r.version), branch: r.log.current, count: r.log.versions.length }), isError: false, changed: false, summary: `version ${r.version.name ?? r.version.id}` };
  } catch (e) { return refused(state, e); }
}
async function versionsTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  const log = state.versions;
  if (!log) return { state, content: json({ current: null, branches: [], versions: [], note: NO_LOG }), isError: false, changed: false, summary: 'no versions' };
  try {
    const branch = typeof args.branch === 'string' ? args.branch : log.current;
    const body = { current: log.current, branches: log.branches.map(b => ({ name: b.name, head: b.head, from: b.from })), versions: versionsOf(log, { branch }).map(brief) };
    return { state, content: json(body), isError: false, changed: false, summary: `${body.versions.length} versions on ${branch}` };
  } catch (e) { return refused(state, e); }
}
/** A version (id or name), "current" (the part as it is) or the head of the current branch ("latest"). */
function docAt(state: ChatState, log: VersionLog | undefined, at: unknown): StudioDoc {
  if (at === undefined || at === 'current') return state.doc;
  if (!log) throw new BarocssError('VERSION_UNKNOWN', `[VERSION_UNKNOWN] ${NO_LOG}`);
  return readVersion(log, at === 'latest' ? headOf(log).id : String(at));
}
async function compareTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  try {
    const from = args.from ?? 'latest', to = args.to ?? 'current', c = changesOf(docAt(state, state.versions, from), docAt(state, state.versions, to));
    return { state, content: json({ from, to, ...c }), isError: false, changed: false, summary: `compare ${String(from)} → ${String(to)}` };
  } catch (e) { return refused(state, e); }
}
async function restoreVersionTool(state: ChatState, args: Record<string, unknown>, evaluate: Parameters<PartHandler>[2]): Promise<ToolOutcome> {
  if (!state.versions) return fail(state, NO_LOG);
  try {
    const v = versionNamed(state.versions, String(args.id ?? '')), doc = readVersion(state.versions, v.id);
    return accept(state, doc, evaluate, `restored version ${v.name ?? v.id}`, { version: brief(v), changes: changesOf(state.doc, doc).features.length });
  } catch (e) { return refused(state, e); }
}
async function branchTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  if (!state.versions) return fail(state, NO_LOG);
  try {
    const log = makeBranch(state.versions, String(args.name ?? ''), { ...(typeof args.from === 'string' ? { from: args.from } : {}) });
    const b = log.branches[log.branches.length - 1];
    return { state: { ...state, versions: log }, content: json({ ok: true, branch: b.name, from: b.from, current: log.current }), isError: false, changed: false, summary: `branch ${b.name}` };
  } catch (e) { return refused(state, e); }
}
async function switchTool(state: ChatState, args: Record<string, unknown>, evaluate: Parameters<PartHandler>[2]): Promise<ToolOutcome> {
  if (!state.versions) return fail(state, NO_LOG);
  try {
    const r = applyBranch(state.versions, String(args.branch ?? ''), state.doc, { discard: args.discard === true });
    return accept({ ...state, versions: r.log }, r.doc, evaluate, `switched to ${r.log.current}`, { branch: r.log.current, version: brief(headOf(r.log)) });
  } catch (e) { return refused(state, e); }
}
async function mergeTool(state: ChatState, args: Record<string, unknown>, evaluate: Parameters<PartHandler>[2]): Promise<ToolOutcome> {
  if (!state.versions) return fail(state, NO_LOG);
  const resolve = args.resolve;
  if (resolve !== undefined && (!resolve || typeof resolve !== 'object' || Array.isArray(resolve) || Object.values(resolve).some(v => v !== 'ours' && v !== 'theirs'))) return fail(state, 'resolve: {where: "ours" | "theirs"} for each conflict.');
  try {
    const from = String(args.from ?? ''), r = applyMerge(state.versions, { from, working: state.doc, at: now(), by: 'agent', note: `merged from ${from}`, ...(resolve ? { resolve: resolve as Record<string, Side> } : {}) });
    if ('conflicts' in r) return { state, content: json({ ok: false, conflicts: r.conflicts.map(conflictOf), note: 'Nothing merged. Merge again with resolve: {where: "ours" | "theirs"} for each conflict ("ours": the current branch).' }), isError: false, changed: false, summary: `${r.conflicts.length} conflicts` };
    return accept({ ...state, versions: r.log }, r.doc, evaluate, `merged ${from} into ${r.log.current}`, { fast_forward: r.fastForward, ...(r.version ? { version: brief(r.version) } : {}), ...(r.dropped.length ? { dropped: r.dropped } : {}) });
  } catch (e) { return refused(state, e); }
}

/** The version actions' handlers, by handler name. */
export const VERSION_HANDLERS: Readonly<Record<string, PartHandler>> = {
  make_version: versionTool, list_versions: versionsTool, restore_version: restoreVersionTool, compare_versions: compareTool,
  make_branch: branchTool, switch_branch: switchTool, merge_branch: mergeTool,
};
