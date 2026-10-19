// The brief (A6.1, O24): what the part is for and how it is made, kept in the document as `brief`, one record a field:
// its value, its basis (stated by the user, assumed by the agent, or ambiguous), the user's words it comes from, and
// who confirmed it. Purpose, process and material are required: `gaps` lists what is missing or not yet stated, which
// is what a clarifying question may be about (A6.2). A field the user stated is never overwritten by an assumption.
// A stated process the studio has rules for becomes the part's process; a stated library material is the material of
// every body that has none of its own (an assumed one is not applied: its mass stays assumed, said so).
import type { StudioDoc } from '../engine/doc';
import { MATERIALS_DATA, processProfile } from '../library/materials';

export const BRIEF_VERSION = 1;
/** The processes a brief may name: the five with rules (R6b.7), and three recorded as intent, not checked yet. */
export const PROCESSES = ['fdm', 'sla', 'sls', 'mjf', 'injection', 'cnc-milling', 'cnc-turning', 'sheet-metal'] as const;
export type Process = (typeof PROCESSES)[number];
const UNCHECKED: Partial<Record<Process, string>> = {
  'cnc-milling': 'CNC milling is recorded as intent; its checks are the kernel lane\'s CNC steps, not built yet',
  'cnc-turning': 'CNC turning is recorded as intent; its checks are the kernel lane\'s CNC steps, not built yet',
  'sheet-metal': 'sheet metal is recorded as intent; its checks are the kernel lane\'s R12 steps, not built yet',
};
export type Basis = 'stated' | 'assumed' | 'ambiguous';
export interface Field<T> {
  value: T; basis: Basis;
  /** The user's words it comes from, quoted (required when stated by the agent). */
  source?: string;
  /** Why it was assumed, or how it can be read (assumed, ambiguous). */
  why?: string;
  /** Set by the studio when the user confirms it: stated since. */
  confirmed?: { by: 'user'; at: string };
}
export interface Envelope { x: number; y: number; z: number }
export interface Brief {
  version: typeof BRIEF_VERSION;
  purpose?: Field<string>; process?: Field<Process>; material?: Field<string>;
  quantity?: Field<number>; envelope?: Field<Envelope>; interfaces?: Field<string[]>;
  loads?: Field<string>; finish?: Field<string>; notes?: Field<string>;
}
export const BRIEF_FIELDS = ['purpose', 'process', 'material', 'quantity', 'envelope', 'interfaces', 'loads', 'finish', 'notes'] as const;
export type BriefKey = (typeof BRIEF_FIELDS)[number];
export const REQUIRED: readonly BriefKey[] = ['purpose', 'process', 'material'];
export interface Gap { field: BriefKey; why: 'missing' | 'assumed' | 'ambiguous'; value?: unknown; ask: string }

const ASK: Record<BriefKey, string> = {
  purpose: 'What is the part for, and what does it attach to or hold?', process: `How will it be made (${PROCESSES.join(', ')})?`,
  material: 'What material is it made of?', quantity: 'How many will be made?', envelope: 'What is the largest size it may be (x, y, z in mm)?',
  interfaces: 'What does it mate with (parts, holes, fasteners)?', loads: 'What loads or environment does it face?', finish: 'What finish or appearance does it need?', notes: 'Anything else?',
};
const MAX_TEXT = 500;
export const isLibraryMaterial = (id: string) => MATERIALS_DATA.materials.some(m => m.id === id);
const text = (v: unknown) => (typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_TEXT ? null : `a text of 1–${MAX_TEXT} characters`);
const pos = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
/** Why a value does not fit its field (null: it fits). */
function badValue(key: BriefKey, v: unknown): string | null {
  switch (key) {
    case 'process': return (PROCESSES as readonly string[]).includes(v as string) ? null : `one of ${PROCESSES.join(', ')}`;
    case 'quantity': return Number.isInteger(v) && (v as number) > 0 ? null : 'a whole number above 0';
    case 'envelope': return v && typeof v === 'object' && pos((v as Envelope).x) && pos((v as Envelope).y) && pos((v as Envelope).z) && Object.keys(v).length === 3 ? null : '{x, y, z}: mm, each above 0';
    case 'interfaces': return Array.isArray(v) && v.length > 0 && v.length <= 20 && v.every(x => text(x) === null) ? null : 'a list of 1–20 texts';
    default: return text(v);
  }
}

/** The brief's gaps: each required field missing, assumed or ambiguous, and each other field assumed or ambiguous. */
export function briefGaps(b: Brief | undefined): Gap[] {
  const out: Gap[] = [];
  for (const key of BRIEF_FIELDS) {
    const f = b?.[key] as Field<unknown> | undefined;
    if (!f) { if (REQUIRED.includes(key)) out.push({ field: key, why: 'missing', ask: ASK[key] }); continue; }
    if (f.basis !== 'stated') out.push({ field: key, why: f.basis, value: f.value, ask: ASK[key] });
  }
  return out;
}
/** Whether a field is stated: by the user's words or confirmed by them. */
export const isStated = (f: Field<unknown> | undefined) => f?.basis === 'stated';

export type BriefCode = 'BAD_FIELD' | 'STATED_KEPT' | 'NO_SOURCE' | 'CONFIRM_IS_THE_USERS';
export interface BriefError { code: BriefCode; message: string }
/**
 * A patch to the brief, all or nothing: each field {value, basis, source?, why?} or null to clear it. Refused, typed:
 * an unknown field or a value that does not fit (BAD_FIELD); a stated field overwritten or cleared by an assumption
 * (STATED_KEPT, naming the user's words); a stated field without the user's words (NO_SOURCE); `confirmed` set by the
 * agent (CONFIRM_IS_THE_USERS: only the user confirms, in the studio).
 */
export function patchBrief(was: Brief | undefined, patch: unknown): { brief: Brief | undefined; changed: BriefKey[] } | { error: BriefError } {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { error: { code: 'BAD_FIELD', message: `"fields" is {field: {value, basis, source?, why?} | null}; fields: ${BRIEF_FIELDS.join(', ')}.` } };
  const next: Brief = { ...(was ?? { version: BRIEF_VERSION }) }, changed: BriefKey[] = [];
  for (const [key, raw] of Object.entries(patch as Record<string, unknown>)) {
    if (!(BRIEF_FIELDS as readonly string[]).includes(key)) return { error: { code: 'BAD_FIELD', message: `No field "${key}"; fields: ${BRIEF_FIELDS.join(', ')}.` } };
    const k = key as BriefKey, old = was?.[k] as Field<unknown> | undefined;
    if (raw === null) {
      if (isStated(old)) return { error: { code: 'STATED_KEPT', message: `${k} was stated by the user${old!.source ? ` ("${old!.source}")` : ''}: it is not cleared without their words.` } };
      if (old) { delete next[k]; changed.push(k); }
      continue;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: { code: 'BAD_FIELD', message: `${k} is {value, basis, source?, why?} or null.` } };
    const f = raw as Record<string, unknown>, extra = Object.keys(f).filter(x => !['value', 'basis', 'source', 'why', 'confirmed'].includes(x));
    if (extra.length) return { error: { code: 'BAD_FIELD', message: `${k}: no ${extra.join(', ')}; a field is {value, basis, source?, why?}.` } };
    if (f.confirmed !== undefined) return { error: { code: 'CONFIRM_IS_THE_USERS', message: `${k}: only the user confirms a field, in the studio; say it is assumed and why.` } };
    if (f.basis !== 'stated' && f.basis !== 'assumed' && f.basis !== 'ambiguous') return { error: { code: 'BAD_FIELD', message: `${k}.basis is stated, assumed or ambiguous.` } };
    const bad = badValue(k, f.value); if (bad) return { error: { code: 'BAD_FIELD', message: `${k}.value is ${bad}.` } };
    for (const t of ['source', 'why'] as const) if (f[t] !== undefined && text(f[t])) return { error: { code: 'BAD_FIELD', message: `${k}.${t} is ${text(f[t])}.` } };
    if (f.basis === 'stated' && f.source === undefined) return { error: { code: 'NO_SOURCE', message: `${k} is stated: quote the user's words in "source", or say it is assumed.` } };
    if (f.basis !== 'stated' && isStated(old)) return { error: { code: 'STATED_KEPT', message: `${k} was stated by the user${old!.source ? ` ("${old!.source}")` : ''}: an assumption does not replace it.` } };
    const field: Field<unknown> = { value: f.value, basis: f.basis, ...(f.source !== undefined ? { source: f.source as string } : {}), ...(f.why !== undefined ? { why: f.why as string } : {}) };
    if (JSON.stringify(field) !== JSON.stringify(old)) { (next as unknown as Record<string, unknown>)[k] = field; changed.push(k); }
  }
  const empty = BRIEF_FIELDS.every(k => next[k] === undefined);
  return { brief: empty ? undefined : next, changed };
}

/** The user confirms a field in the studio: stated since, with who and when. */
export function confirmField(b: Brief, key: BriefKey, at: string, value?: unknown): Brief | { error: string } {
  const f = b[key] as Field<unknown> | undefined;
  if (!f) return { error: `${key} is not in the brief` };
  const v = value === undefined ? f.value : value, bad = badValue(key, v);
  if (bad) return { error: `${key} is ${bad}` };
  return { ...b, [key]: { ...f, value: v, basis: 'stated', confirmed: { by: 'user', at } } };
}

/** The material a stated brief gives the bodies that have none (a library id), else none. */
export function briefMaterial(doc: StudioDoc): string | undefined {
  const f = doc.brief?.material;
  return f && isStated(f) && isLibraryMaterial(f.value) ? f.value : undefined;
}
/** What the brief does to the document: a stated process with rules becomes the part's process (a printer of another
 * process cleared, as the studio's own picker does). */
export function applyBrief(doc: StudioDoc, brief: Brief | undefined): StudioDoc {
  const out: StudioDoc = { ...doc };
  if (brief) out.brief = brief; else delete out.brief;
  const p = brief?.process;
  if (p && isStated(p) && processProfile(p.value) && doc.process !== p.value) {
    out.process = p.value;
    if (out.printer && MATERIALS_DATA.printers.find(x => x.id === out.printer)?.process !== p.value) delete out.printer;
  }
  return out;
}
/** The brief as the tools report it: its fields, its gaps, and what the studio does with process and material. */
export function briefReport(doc: StudioDoc) {
  const b = doc.brief, p = b?.process, m = b?.material;
  return {
    brief: b ?? null, gaps: briefGaps(b), complete: !briefGaps(b).some(g => REQUIRED.includes(g.field)),
    process: p ? { value: p.value, checked: !!processProfile(p.value), ...(UNCHECKED[p.value] ? { note: UNCHECKED[p.value] } : {}), applied: isStated(p) && doc.process === p.value } : null,
    material: m ? { value: m.value, library: isLibraryMaterial(m.value), applied: briefMaterial(doc) === m.value, ...(!isLibraryMaterial(m.value) ? { note: `not in the material library (${MATERIALS_DATA.materials.map(x => x.id).join(', ')}): kept as written, its density unknown, so a mass stays assumed` } : !isStated(m) ? { note: 'assumed: not applied to the bodies until the user states or confirms it' } : {}) } : null,
  };
}
/** Reads a stored brief (opening a file): version 1, the fields that fit; anything else dropped. */
export function readBrief(raw: unknown): Brief | undefined {
  if (!raw || typeof raw !== 'object' || (raw as Brief).version !== BRIEF_VERSION) return undefined;
  const out: Brief = { version: BRIEF_VERSION };
  for (const k of BRIEF_FIELDS) {
    const f = (raw as Record<string, unknown>)[k] as Field<unknown> | undefined;
    if (f && typeof f === 'object' && (f.basis === 'stated' || f.basis === 'assumed' || f.basis === 'ambiguous') && !badValue(k, f.value)) (out as unknown as Record<string, unknown>)[k] = f;
  }
  return BRIEF_FIELDS.some(k => out[k]) ? out : undefined;
}

// ——— The tools (A6.1): set_brief and get_brief.
export const BRIEF_TOOL_NAMES = new Set(['set_brief', 'get_brief']);
const FIELD_SCHEMA = { type: ['object', 'null'], properties: { value: {}, basis: { type: 'string', enum: ['stated', 'assumed', 'ambiguous'] }, source: { type: 'string' }, why: { type: 'string' } } };
export const BRIEF_TOOLS = [
  {
    name: 'set_brief',
    description: `Writes the brief, the part's intent, before modelling: fields ${BRIEF_FIELDS.join(', ')}, each {value, basis, source?, why?} or null to clear. Purpose, process and material are required. basis "stated" quotes the user's words in "source"; what the user did not say is "assumed" (say why) or "ambiguous" (say the readings) — never stated. A field the user stated is not replaced or cleared by an assumption (refused: STATED_KEPT). Only the user confirms a field, in the studio. process: ${PROCESSES.join(', ')} (CNC and sheet metal recorded as intent, not checked yet); a stated process with rules becomes the part's process. material: a library id (${MATERIALS_DATA.materials.map(m => m.id).join(', ')}) or a name; a stated library material is every body's without its own. quantity: a whole number; envelope: {x, y, z} mm, the largest size; interfaces: a list of texts. All or nothing. Returns the brief and its gaps.`,
    input_schema: { type: 'object', properties: { fields: { type: 'object', properties: Object.fromEntries(BRIEF_FIELDS.map(k => [k, FIELD_SCHEMA])), additionalProperties: false } }, required: ['fields'], additionalProperties: false },
  },
  {
    name: 'get_brief',
    description: 'The brief: its fields with their basis and the user\'s words, its gaps (a required field missing, or any field assumed or ambiguous, each with a question that would settle it), whether it is complete (purpose, process and material stated), and what the studio does with its process (checked or intent only; applied to the part) and material (in the library; applied to the bodies). Changes nothing.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];
/** Runs a brief tool on the document. */
export function runBriefTool(doc: StudioDoc, name: string, args: Record<string, unknown>): { doc: StudioDoc; content: unknown; changed: boolean; summary: string } | { error: string } {
  if (name === 'get_brief') { const r = briefReport(doc); return { doc, content: r, changed: false, summary: `${r.gaps.length} gap${r.gaps.length === 1 ? '' : 's'}${r.complete ? '' : ', incomplete'}` }; }
  const p = patchBrief(readBrief(doc.brief), args.fields);
  if ('error' in p) return { error: `[${p.error.code}] ${p.error.message}` };
  const next = applyBrief(doc, p.brief), r = briefReport(next), changed = p.changed.length > 0 || next.process !== doc.process;
  return { doc: changed ? next : doc, content: { ok: true, did: p.changed.length ? `set ${p.changed.join(', ')}` : 'no change', ...(next.process !== doc.process ? { process_set: next.process } : {}), ...r }, changed, summary: p.changed.length ? `brief: ${p.changed.join(', ')}` : 'brief: no change' };
}
