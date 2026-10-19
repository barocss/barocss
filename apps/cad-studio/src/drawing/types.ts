// A 2D drawing of the part: settings kept in the document (doc.drawing), the views projected from the
// part's B-rep by the kernel's hidden-line projection, and dimensions that refer to model edges by
// their persistent names (so they keep measuring the part as it changes).
import type { BrepProjection } from '@barocss/cad';
import type { Sig } from '../engine/references';

export type ViewId = 'front' | 'top' | 'right' | 'iso';
export const VIEW_IDS: readonly ViewId[] = ['front', 'top', 'right', 'iso'];
export type Vec3 = [number, number, number];
export type XY = [number, number];

/**
 * A point of a dimension: an end of an edge (the end nearest `near`, the model point it was picked
 * at) or a circle's centre.
 */
export interface DimPoint { edge: string; at: 'end' | 'center'; near: Vec3; sig?: Sig; was?: string }
/** A dimension's tolerance: ± one value, an upper and a lower deviation, or a fit (H7, h6, …). */
export type Tolerance = { kind: 'symmetric'; value: number } | { kind: 'deviation'; upper: number; lower: number } | { kind: 'fit'; code: string };
/**
 * `place`: where the dimension line (or a leader's text) goes, in the view's model coordinates (mm); `tol`: its tolerance.
 * `count` (R14.1, O2): it stands for that many — a diameter for as many equal holes (`4× Ø6.6 THRU`), a linear dimension
 * for as many equal spaces of a row (`3× 20`). `auto`: placed by Auto-dimension (which replaces only its own).
 */
export type DrawingDimension = ({ tol?: Tolerance; count?: number; auto?: true }) & (
  | { id: string; view: ViewId; kind: 'linear'; a: DimPoint; b: DimPoint; orient: 'horizontal' | 'vertical' | 'aligned'; place: XY }
  | { id: string; view: ViewId; kind: 'diameter' | 'radius'; edge: string; near: Vec3; place: XY; sig?: Sig; was?: string }
  /** Between two straight edges (each the one of its name nearest `near`), in the sector holding `place`. */
  | { id: string; view: ViewId; kind: 'angle'; a: EdgeRef; b: EdgeRef; place: XY });
/**
 * A note: lines of text with their top left at `at` (sheet mm), and optionally a leader to a point
 * of a view (`leader.at` in the view's model coordinates, so it follows the view).
 */
export interface DrawingNote { id: string; text: string; at: XY; leader?: { view: ViewId; at: XY } }
/** A straight edge by its persistent name, `near` a model point on it (names can repeat). */
export interface EdgeRef { edge: string; near: Vec3; sig?: Sig; was?: string }

/** The revision after `rev`: A → B … Z → AA, 01 → 02, 1 → 2; none → A. */
export function nextRevision(rev: string | undefined): string {
  if (!rev || rev === '-') return 'A';
  if (/^\d+$/.test(rev)) return String(Number(rev) + 1).padStart(rev.length, '0');
  if (/^[A-Z]+$/.test(rev)) { const n = [...rev].reduce((t, c) => t * 26 + c.charCodeAt(0) - 64, 0) + 1; let s = '', k = n; while (k > 0) { const r = (k - 1) % 26; s = String.fromCharCode(65 + r) + s; k = Math.floor((k - 1) / 26); } return s; }
  return rev + '.1';
}
/** A short fingerprint of a model's features (FNV-1a over their JSON). */
export function modelPrint(nodes: unknown): string {
  let h = 0x811c9dc5; for (const ch of JSON.stringify(nodes)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export interface DrawingSettings {
  sheet: 'A4' | 'A3';
  /** Model mm per sheet mm inverted (2 = 2:1, 0.5 = 1:2); none: the largest standard scale that fits. */
  scale?: number;
  /** Third angle (US) or first angle (ISO) arrangement of the orthographic views. */
  projection: 'third' | 'first';
  /** Hidden edges dashed in the orthographic views (the isometric view shows visible edges only). */
  hidden: boolean;
  /** false: no centre marks and centrelines (shown by default). */
  centers?: boolean;
  /** Tangent edges (a fillet's boundaries) as thin lines (not shown by default). */
  tangent?: boolean;
  /** Section A–A: the part cut by the plane Y = y, seen like the front view, under it (none: no section). */
  section?: { y: number };
  /** The title block's part name (default: the file name). */
  title?: string;
  /** The drawing's revision (A, B, … or 01), shown in the title block's REV cell (default: -). */
  revision?: string;
  /** The model's fingerprint when the revision was set (to tell when the model changed since). */
  revisedModel?: string;
  dimensions: DrawingDimension[];
  notes?: DrawingNote[];
}

export const defaultDrawing = (): DrawingSettings => ({ sheet: 'A4', projection: 'third', hidden: true, dimensions: [] });

/** Reads drawing settings from a saved file, keeping what is valid. */
export function readDrawing(raw: unknown): DrawingSettings {
  const d = defaultDrawing(), r = (raw ?? {}) as Partial<DrawingSettings>;
  return {
    sheet: r.sheet === 'A3' ? 'A3' : d.sheet,
    ...(typeof r.scale === 'number' && r.scale > 0 ? { scale: r.scale } : {}),
    projection: r.projection === 'first' ? 'first' : 'third',
    hidden: r.hidden !== false,
    ...(r.centers === false ? { centers: false } : {}),
    ...(r.tangent === true ? { tangent: true } : {}),
    ...(r.section && typeof r.section.y === 'number' && Number.isFinite(r.section.y) ? { section: { y: r.section.y } } : {}),
    ...(typeof r.title === 'string' && r.title ? { title: r.title } : {}),
    ...(typeof r.revision === 'string' && r.revision ? { revision: r.revision.slice(0, 6) } : {}),
    ...(typeof r.revisedModel === 'string' ? { revisedModel: r.revisedModel } : {}),
    dimensions: Array.isArray(r.dimensions) ? r.dimensions.filter(x => x && typeof x.id === 'string' && VIEW_IDS.includes(x.view)).map(x => {
      const { tol, count, auto, ...rest } = x; const t = readTolerance(tol);
      return { ...rest, ...(t ? { tol: t } : {}), ...(Number.isInteger(count) && count! >= 2 && count! <= 999 ? { count } : {}), ...(auto === true ? { auto: true } : {}) } as DrawingDimension;
    }) : [],
    ...(Array.isArray(r.notes) && r.notes.some(isNote) ? { notes: r.notes.filter(isNote).map(n => ({ id: n.id, text: n.text, at: [n.at[0], n.at[1]] as XY, ...(n.leader && VIEW_IDS.includes(n.leader.view) && isXY(n.leader.at) ? { leader: { view: n.leader.view, at: [n.leader.at[0], n.leader.at[1]] as XY } } : {}) })) } : {}),
  };
}

const isXY = (p: unknown): p is XY => Array.isArray(p) && p.length === 2 && p.every(x => typeof x === 'number' && Number.isFinite(x));
const isNote = (n: unknown): n is DrawingNote => !!n && typeof (n as DrawingNote).id === 'string' && typeof (n as DrawingNote).text === 'string' && isXY((n as DrawingNote).at);
function readTolerance(t: unknown): Tolerance | null {
  const x = t as Tolerance | undefined, num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (x?.kind === 'symmetric' && num(x.value) && x.value > 0) return { kind: 'symmetric', value: x.value };
  if (x?.kind === 'deviation' && num(x.upper) && num(x.lower) && x.upper >= x.lower) return { kind: 'deviation', upper: x.upper, lower: x.lower };
  if (x?.kind === 'fit' && typeof x.code === 'string' && /^[A-Za-z]{1,2}\d{1,2}$/.test(x.code)) return { kind: 'fit', code: x.code };
  return null;
}

export type DrawingViews = Record<ViewId, BrepProjection>;
