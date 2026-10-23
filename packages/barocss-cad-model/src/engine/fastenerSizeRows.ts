// The person's fastener sizes (O7): how a metric thread size is drawn and holed — its pitch, heads, nut, washer,
// lengths offered, ISO 273 clearance holes and tap drill — one row per size, from a file the person supplied (rows
// rule b), none built in. samples/rows/fastener-sizes.json is an example, taken from the sources it names, to check
// against the standard and the supplier. A size no row gives is refused where a command needs it ([FASTENER_SIZE_ROW])
// and left unsized where a reading would use it (no thread drawn, no tap drill, the position tolerance an estimate).
// A row says how a size is drawn; a fastener row (engine/fastenerRows, F9) says what is bought. (Unreleased, the document
// schema tracks the latest: a document without these rows has none — owner, 2026-10-23.)
import type { StudioDoc } from './doc';
import type { FastenerSize } from '../app/fasteners';

export const SIZE_FIELDS = ['d', 'pitch', 's', 'k', 'm', 'dk', 'ks', 'socket', 'wd1', 'wd2', 'wh', 'cdk', 'ck', 'csocket', 'tap'] as const;
export const LENGTH_FIELDS = ['lengths', 'capLengths', 'cskLengths'] as const;
type SizeField = typeof SIZE_FIELDS[number] | typeof LENGTH_FIELDS[number] | 'clearance';
export interface StudioFastenerSizeRow extends Record<typeof SIZE_FIELDS[number], number>, Record<typeof LENGTH_FIELDS[number], number[]> {
  /** The thread size ("M6"); its number is `d`. */
  id: string;
  /** ISO 273 clearance holes: fine, medium, coarse (mm). */
  clearance: [number, number, number];
  source?: string; estimate?: true;
  /** Where a field's value is from, when not the row's source. */
  fieldSources?: Partial<Record<SizeField, string>>;
  /** Fields not cross-checked against a second source (to verify before manufacture). */
  unchecked?: SizeField[];
}
const ALL_FIELDS: ReadonlySet<string> = new Set<string>([...SIZE_FIELDS, ...LENGTH_FIELDS, 'clearance']);
const FIELDS: ReadonlySet<string> = new Set(['id', ...ALL_FIELDS, 'source', 'estimate', 'fieldSources', 'unchecked']);
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const rising = (v: unknown): v is number[] => Array.isArray(v) && v.every(positive) && v.every((x, i) => i === 0 || x > v[i - 1]);

/** The refusal where sizes are needed and none are loaded. */
export const NO_SIZES = '[FASTENER_SIZE_ROW] no fastener sizes loaded — load your fastener sizes (samples/rows/fastener-sizes.json is an example)';
/** The refusal where a command needs a size no row gives. */
export const noSizeRow = (size: string) => `[FASTENER_SIZE_ROW] no row for ${size} — load your fastener sizes (samples/rows/fastener-sizes.json is an example)`;

/** What is wrong with a fastener size row, or null. */
export function fastenerSizeRowProblem(r: unknown): string | null {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 'a fastener size row is an object { id (M6), d, pitch, s, k, m, dk, ks, socket, wd1, wd2, wh, cdk, ck, csocket, tap, lengths, capLengths, cskLengths, clearance, source | estimate: true }';
  const o = r as Record<string, unknown>;
  if (typeof o.id !== 'string' || !/^M\d+(\.\d+)?$/.test(o.id)) return 'a fastener size row\'s id is its thread size, as "M6"';
  const at = `fastener size row ${o.id}`;
  for (const k of Object.keys(o)) if (!FIELDS.has(k)) return `${at}: unknown field ${k}`;
  for (const k of SIZE_FIELDS) if (!positive(o[k])) return `${at}: ${k} is a number of mm above 0`;
  if (Math.abs((o.d as number) - Number(o.id.slice(1))) > 1e-9) return `${at}: d is the size's own (${o.id.slice(1)})`;
  for (const k of LENGTH_FIELDS) if (!rising(o[k])) return `${at}: ${k} is the lengths offered, mm, shortest first`;
  if (!rising(o.clearance) || (o.clearance as number[]).length !== 3) return `${at}: clearance is [fine, medium, coarse], mm, rising`;
  if (o.estimate !== undefined && o.estimate !== true) return `${at}: estimate is true or left out`;
  if (o.source !== undefined && typeof o.source !== 'string') return `${at}: source is text (where the row is from)`;
  const src = typeof o.source === 'string' && o.source.trim() !== '', est = o.estimate === true;
  if (src === est) return `${at}: cite its source or say estimate: true — ${src ? 'not both' : 'never neither'}`;
  if (o.fieldSources !== undefined && (!o.fieldSources || typeof o.fieldSources !== 'object' || Array.isArray(o.fieldSources) || Object.entries(o.fieldSources).some(([k, v]) => !ALL_FIELDS.has(k) || typeof v !== 'string'))) return `${at}: fieldSources maps a field to the text of its source`;
  if (o.unchecked !== undefined && (!Array.isArray(o.unchecked) || o.unchecked.some(k => typeof k !== 'string' || !ALL_FIELDS.has(k)))) return `${at}: unchecked lists fields`;
  return null;
}
/** Rows added (each checked; one with an id held already replaces it). */
export function editFastenerSizeRows(doc: StudioDoc, add: readonly unknown[]): { doc: StudioDoc } | { error: string } {
  for (const r of add) { const p = fastenerSizeRowProblem(r); if (p) return { error: p }; }
  const was = doc.fastenerSizes?.rows ?? [], incoming = add as StudioFastenerSizeRow[], ids = new Set(incoming.map(r => r.id));
  return { doc: { ...doc, fastenerSizes: { version: 1, rows: [...was.filter(r => !ids.has(r.id)), ...incoming] } } };
}

const sizeOf = (r: StudioFastenerSizeRow): FastenerSize => ({
  d: r.d, pitch: r.pitch, s: r.s, k: r.k, m: r.m, dk: r.dk, ks: r.ks, socket: r.socket, wd1: r.wd1, wd2: r.wd2, wh: r.wh,
  lengths: r.lengths, capLengths: r.capLengths, cdk: r.cdk, ck: r.ck, csocket: r.csocket, cskLengths: r.cskLengths,
  clearance: r.clearance, tap: r.tap, checked4017: !r.unchecked?.includes('lengths'),
});
const NONE: Readonly<Record<string, FastenerSize>> = Object.freeze({});
const memo = new WeakMap<object, Readonly<Record<string, FastenerSize>>>();
/** The sizes a document's rows give, by size ("M6"), in the rows' order; none loaded: none. */
export function fastenerSizesOf(doc: Pick<StudioDoc, 'fastenerSizes'>): Readonly<Record<string, FastenerSize>> {
  const rows = doc.fastenerSizes?.rows; if (!rows?.length) return NONE;
  let out = memo.get(rows);
  if (!out) { out = Object.fromEntries(rows.map(r => [r.id, sizeOf(r)])); memo.set(rows, out); }
  return out;
}
