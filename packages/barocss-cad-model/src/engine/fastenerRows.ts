// The person's fastener rows (A9's F9): a bought screw, bolt, nut or washer as its supplier lists it — its kind, its
// thread size and length, its designation — each row citing its source or marked an estimate, none built in. A
// fastener placed in the assembly whose kind, size and length match a row is that row's bought line; one matching no row
// is a bought line too, its item an estimate, said so. The fastener's shape still comes from the command's own sizes
// (app/fasteners' FASTENER_SIZES, the owner's open item): a row names what is bought, not how it is drawn.
import type { StudioDoc } from './doc';
import { editRows } from './rowEdits';

export type FastenerRowKind = 'hex-bolt' | 'socket-screw' | 'csk-screw' | 'hex-nut' | 'washer';
export interface StudioFastenerRow {
  id: string; kind: FastenerRowKind;
  /** The thread size as the command names it ("M6"). */
  size: string;
  /** Length under the head (overall for a countersunk screw), mm; none for a nut or a washer. */
  lengthMM?: number;
  designation?: string; partNumber?: string; supplier?: string;
  source?: string; estimate?: true;
}
const KINDS: ReadonlySet<string> = new Set(['hex-bolt', 'socket-screw', 'csk-screw', 'hex-nut', 'washer']);
const FIELDS = new Set(['id', 'kind', 'size', 'lengthMM', 'designation', 'partNumber', 'supplier', 'source', 'estimate']);
const threadedKind = (k: string) => k !== 'hex-nut' && k !== 'washer';

/** What is wrong with a fastener row, or null. */
export function fastenerRowProblem(r: unknown): string | null {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 'a fastener row is an object { id, kind, size, lengthMM (a screw or bolt), source | estimate: true }';
  const o = r as Record<string, unknown>, at = typeof o.id === 'string' && o.id.trim() ? `fastener row ${o.id}` : 'a fastener row';
  if (typeof o.id !== 'string' || !o.id.trim()) return 'a fastener row needs an id';
  for (const k of Object.keys(o)) if (!FIELDS.has(k)) return `${at}: unknown field ${k}`;
  if (typeof o.kind !== 'string' || !KINDS.has(o.kind)) return `${at}: kind is one of ${[...KINDS].join(', ')}`;
  if (typeof o.size !== 'string' || !/^M\d+(\.\d+)?$/.test(o.size)) return `${at}: size is the thread's, as "M6"`;
  if (threadedKind(o.kind)) { if (!(typeof o.lengthMM === 'number' && Number.isFinite(o.lengthMM) && o.lengthMM > 0)) return `${at}: a ${o.kind}'s lengthMM is a number of mm above 0`; }
  else if (o.lengthMM !== undefined) return `${at}: a ${o.kind} has no lengthMM`;
  for (const k of ['designation', 'partNumber', 'supplier'] as const) if (o[k] !== undefined && typeof o[k] !== 'string') return `${at}: ${k} is text`;
  if (o.estimate !== undefined && o.estimate !== true) return `${at}: estimate is true or left out`;
  if (o.source !== undefined && typeof o.source !== 'string') return `${at}: source is text (where the row is from)`;
  const src = typeof o.source === 'string' && o.source.trim() !== '', est = o.estimate === true;
  if (src === est) return `${at}: cite its source or say estimate: true — ${src ? 'not both' : 'never neither'}`;
  return null;
}
/** Rows added (each checked; one with an id held already replaces it) and removed by id. */
export function editFastenerRows(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  const r = editRows<StudioFastenerRow>(doc.fasteners?.rows ?? [], add, remove, { problem: fastenerRowProblem, noun: 'fastener row' });
  return 'error' in r ? r : { doc: { ...doc, fasteners: { version: 1, rows: r.rows } } };
}
/** The row a placed fastener is (its kind, size and length to 1e-6 mm), or null; two rows matching: the first. */
export function fastenerRowFor(doc: Pick<StudioDoc, 'fasteners'>, kind: string, size: string, lengthMM?: number): StudioFastenerRow | null {
  return (doc.fasteners?.rows ?? []).find(r => r.kind === kind && r.size === size && (!threadedKind(kind) || (lengthMM !== undefined && r.lengthMM !== undefined && Math.abs(r.lengthMM - lengthMM) <= 1e-6))) ?? null;
}
