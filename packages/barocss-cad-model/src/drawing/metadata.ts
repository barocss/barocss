// DR-5: plain drawing metadata. Templates are neutral layouts, not standards claims.
import { problem, type Problem } from '../engine/refusal';
import type { TableContent } from './table';

export const TITLE_FIELDS = [
  ['organization', 'Organization'], ['number', 'Drawing number'], ['drawnBy', 'Drawn by'],
  ['checkedBy', 'Checked by'], ['material', 'Material'], ['finish', 'Finish'],
] as const;
export const TITLE_EXTRA_HEIGHT = 18;
export type TitleField = typeof TITLE_FIELDS[number][0];
export type DrawingTitleBlock = { template: 'basic' | 'extended' } & Partial<Record<TitleField, string>>;
export interface DrawingRevision { revision: string; date: string; description: string; by?: string }

const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const text = (x: unknown, max: number): x is string => typeof x === 'string' && !!x.trim() && x.length <= max && !/[\r\n\t]/.test(x);
const dateOk = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x;
const revisionOk = (x: unknown): x is DrawingRevision => record(x) && text(x.revision, 6) && dateOk(x.date) && text(x.description, 120) && (x.by === undefined || text(x.by, 60));
const titleKeys: string[] = ['template', ...TITLE_FIELDS.map(([k]) => k)];

/** File readers drop bad fields and records; they never invent a revision or an approval. */
export function readTitleBlock(x: unknown): DrawingTitleBlock | null {
  if (!record(x) || (x.template !== 'basic' && x.template !== 'extended')) return null;
  const out: DrawingTitleBlock = { template: x.template };
  for (const [k] of TITLE_FIELDS) if (text(x[k], 120)) out[k] = x[k];
  return out;
}
export function readRevisions(x: unknown): DrawingRevision[] {
  const out: DrawingRevision[] = [];
  if (Array.isArray(x)) for (const r of x) {
    if (!revisionOk(r) || out.some(old => old.revision === r.revision) || out.length >= 50) continue;
    out.push({ revision: r.revision, date: r.date, description: r.description, ...(r.by ? { by: r.by } : {}) });
  }
  return out;
}

/** Strict tool/UI input: no partial acceptance, unknown keys or duplicate revision labels. */
export function checkDrawingMetadata(args: Record<string, unknown>): Problem[] {
  if ('titleBlock' in args) {
    const x = args.titleBlock;
    if (!record(x) || !readTitleBlock(x) || Object.keys(x).some(k => !titleKeys.includes(k)) || TITLE_FIELDS.some(([k]) => k in x && !text(x[k], 120))) return [problem('DRAWING_OPTIONS', 'titleBlock needs template basic or extended; optional organization, number, drawnBy, checkedBy, material and finish are nonempty single-line strings up to 120 characters. No other keys.')];
  }
  if ('revisions' in args) {
    const x = args.revisions;
    // Authored history must contain every row; keep the saved reader's filtering separate.
    if (!Array.isArray(x) || x.length > 50 || Array.from(x).some((r, k) => !Object.hasOwn(x, k) || !revisionOk(r) || Object.keys(r).some(key => !['revision', 'date', 'description', 'by'].includes(key))) || new Set(x.map(r => r.revision)).size !== x.length) return [problem('DRAWING_OPTIONS', 'revisions needs at most 50 unique records: revision (1–6 characters), date (YYYY-MM-DD), description (1–120 characters), optional by (1–60 characters). Text must be single-line. No other keys.')];
  }
  return [];
}

/** Revision records use the same placement, issue checks and writers as other drawing tables. */
export function revisionTableContent(rows: readonly DrawingRevision[], title = 'REVISIONS'): TableContent {
  return { title, columns: [{ key: 'revision', label: 'REV' }, { key: 'date', label: 'DATE' }, { key: 'description', label: 'DESCRIPTION' }, { key: 'by', label: 'BY' }], rows: rows.map(r => [r.revision, r.date, r.description, r.by ?? null]) };
}
