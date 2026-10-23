// A 2D drawing of the part: settings kept in the document (doc.drawing), the views projected from the
// part's B-rep by the kernel's hidden-line projection, and dimensions that refer to model edges by
// their persistent names (so they keep measuring the part as it changes).
import type { BrepProjection } from '@barocss/cad';
import type { DrawingScope } from './scope';
import type { Sig } from '../engine/references';

export type ViewId = 'front' | 'top' | 'right' | 'iso';
export const VIEW_IDS: readonly ViewId[] = ['front', 'top', 'right', 'iso'];
/** O148 X2: where a dimension sits — a view, or a section by its letter (`section:A`). */
export type SectionRef = `section:${string}`;
export type DimView = ViewId | SectionRef;
export const isSectionRef = (v: string): v is SectionRef => /^section:[A-Z]{1,2}$/.test(v);
export const sectionLetter = (v: SectionRef) => v.slice(8);
/** A dimension's view read from a file: a view, or a section's letter. */
export const isDimView = (v: unknown): v is DimView => typeof v === 'string' && ((VIEW_IDS as readonly string[]).includes(v) || isSectionRef(v));
export type Vec3 = [number, number, number];
export type XY = [number, number];

/**
 * A point of a dimension: an end of an edge (the end nearest `near`, the model point it was picked
 * at) or a circle's centre.
 */
/** A hole's centre by an edge of its circle (R14.5, O6): a member of a pitch circle. */
export interface CentreRef { edge: string; near: Vec3; sig?: Sig; was?: string }
/**
 * `at: 'pcd'` (R14.5, O6): the centre of the circle through the centres of `ring`'s holes (a bolt circle's centre, which
 * no edge has); `edge`/`near` are then its first member's.
 */
export interface DimPoint { edge: string; at: 'end' | 'center' | 'pcd'; near: Vec3; sig?: Sig; was?: string; ring?: CentreRef[] }
/** A dimension's tolerance: ± one value, an upper and a lower deviation, or a fit (H7, h6, …). */
export type Tolerance = { kind: 'symmetric'; value: number } | { kind: 'deviation'; upper: number; lower: number } | { kind: 'fit'; code: string };
/**
 * `place`: where the dimension line (or a leader's text) goes, in the view's model coordinates (mm); `tol`: its tolerance.
 * `count` (R14.1, O2): it stands for that many — a diameter for as many equal holes (`4× Ø6.6 THRU`), a linear dimension
 * for as many equal spaces of a row (`3× 20`). `auto`: placed by Auto-dimension (which replaces only its own).
 * `basic` (R14.4, O5): a theoretically exact dimension, its text boxed (a position tolerance's frame holds the tolerance).
 */
export type DrawingDimension = ({ tol?: Tolerance; count?: number; auto?: true; basic?: true }) & (
  | { id: string; view: DimView; kind: 'linear'; a: DimPoint; b: DimPoint; orient: 'horizontal' | 'vertical' | 'aligned'; place: XY }
  | { id: string; view: DimView; kind: 'diameter' | 'radius'; edge: string; near: Vec3; place: XY; sig?: Sig; was?: string }
  /** A pitch circle (R14.5, O6): the circle through the centres of three or more holes, its diameter as `Ø40 PCD`. */
  | { id: string; view: DimView; kind: 'pcd'; ring: CentreRef[]; place: XY }
  /** Between two straight edges (each the one of its name nearest `near`), in the sector holding `place`. */
  | { id: string; view: DimView; kind: 'angle'; a: EdgeRef; b: EdgeRef; place: XY });
/**
 * A note: lines of text with their top left at `at` (sheet mm), and optionally a leader to a point
 * of a view (`leader.at` in the view's model coordinates, so it follows the view).
 */
/**
 * A datum feature (R14.4, O5): its letter in a box at `place` (the view's model coordinates), a leader to a filled triangle
 * on a straight edge of the view (the face seen edge-on).
 */
export interface DrawingDatum { id: string; letter: string; view: ViewId; edge: EdgeRef; place: XY }
/**
 * A feature control frame (R14.4, O5) under a dimension's text: a position tolerance of `value` mm in a cylindrical zone
 * (Ø) to the datums in order. Only position for now.
 */
export interface DrawingFrame { id: string; dim: string; characteristic: 'position'; value: number; datums: string[] }
export interface DrawingNote { id: string; text: string; at: XY; leader?: { view: ViewId; at: XY } }
/** A table's column (O49): its header `label [unit]`, numbers shown to `digits` places (absent: up to 2) and aligned right by default. */
export interface TableColumn { key: string; label: string; unit?: string; align?: 'start' | 'middle' | 'end'; digits?: number }
/** A cell: text, a number (formatted by its column), or null (shown as '—'). */
export type TableCell = string | number | null;
export type TableCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
/**
 * A table on the sheet (O49): its content given (`columns`, `rows`) or filled from the part at each build by a named
 * source (`from`: 'bends', R12's bend table; the kernel lane's cut list). `at`: a sheet point (mm, y down) that its
 * `corner` (default top-left) is on; absent, it is laid out above the title block, right-aligned, stacked upward.
 */
export interface DrawingTable { id: string; title?: string; columns?: TableColumn[]; rows?: TableCell[][]; from?: string; at?: XY; corner?: TableCorner; /** FRa (O115): kept whole — never split into blocks (the issue list's sheet and scale fixes then apply). */ whole?: boolean }
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
  /** Drawing-only geometry scope. Absent: base part, or legacy BOM/balloon assembly. */
  scope?: DrawingScope;
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
  /** FRd2 (O119): the frame's weld symbols in the views (not shown by default). */
  weldSymbols?: boolean;
  /** O147 B2: item balloons on the iso view (the front view without it), numbered as the BOM's lines (not shown by default). */
  balloons?: boolean;
  /** Section A–A: the part cut by the plane square to the front view's depth at `y` along it (Y = y from −Y), seen like the front view, under it (none: no section). */
  section?: { y: number };
  /**
   * O148 X1: the sections, each the part cut by the plane square to its view's depth at `at` along it, seen as that view
   * (front, top or right) with the material in front taken away. A file with only `section` reads as `[{ A, front, y }]`
   * (`sectionsOf`); one section A on the front is written back as `section`, so such files stay as they were.
   */
  sections?: DrawingSection[];
  /** The title block's part name (default: the file name). */
  title?: string;
  /** The drawing's revision (A, B, … or 01), shown in the title block's REV cell (default: -). */
  revision?: string;
  /** The model's fingerprint when the revision was set (to tell when the model changed since). */
  revisedModel?: string;
  dimensions: DrawingDimension[];
  notes?: DrawingNote[];
  /** Tables (O49): given content or a named source's (the bend table, a cut list). */
  tables?: DrawingTable[];
  /** The views shown (R14.3, O4): the front and top views always; none: all four. */
  views?: ViewId[];
  /** Extra sheet room (mm) beside a view's sides for its dimensions (R14.3, O4): the layout spaces the views by it. */
  room?: ViewRoom;
  /**
   * The side the front view looks from (R14.3b, O7): none is `y-` (from −Y), as every drawing saved before. Changing it
   * re-maps the annotations to the views that show the same model axes, or is refused (reorient.ts).
   */
  orientation?: 'x+' | 'y+' | 'x-';
  /** How the drawing is toleranced (R14.4, O5): by ± values (default) or geometrically (datums and position). */
  tolerancing?: 'plus-minus' | 'geometric';
  datums?: DrawingDatum[];
  frames?: DrawingFrame[];
}
/**
 * O148 X1: a section — its letter, the view whose depth its plane is square to, and where along that depth (mm).
 * O178, an aligned section: `dir`, the plane's own normal (model axes, any length; the section's depth, away from its
 * viewer) — square to an off-axis feature's axis — with `at` along it (the plane dot(p, dir/|dir|) = at). It is laid out
 * as `view`'s sections are and drawn with `view`'s up (made square to `dir`); its cutting plane shows edge-on in a view
 * whose depth is square to `dir`.
 */
export interface DrawingSection { id: string; view: SectionViewId; at: number; dir?: [number, number, number] }
/** Whether two sections are the same cut: letter, view, place and (an aligned one's) direction. */
export const sameSection = (a: DrawingSection, b: DrawingSection): boolean => a.id === b.id && a.view === b.view && a.at === b.at && JSON.stringify(a.dir ?? null) === JSON.stringify(b.dir ?? null);
/** A direction an aligned section may have: three finite numbers, not all zero. */
export const sectionDirOk = (d: unknown): d is [number, number, number] => Array.isArray(d) && d.length === 3 && d.every(x => typeof x === 'number' && Number.isFinite(x)) && Math.hypot(d[0], d[1], d[2]) > 1e-9;
export type SectionViewId = 'front' | 'top' | 'right';
export const SECTION_VIEWS: readonly SectionViewId[] = ['front', 'top', 'right'];
/** The drawing's sections: its list, or the one `section` older files have (A on the front view). */
export const sectionsOf = (s: Pick<DrawingSettings, 'section' | 'sections'>): DrawingSection[] => s.sections ?? (s.section ? [{ id: 'A', view: 'front', at: s.section.y }] : []);
/** The settings with these sections: one A on the front as `section` (as files have always had it), more as `sections`. */
export function withSections(s: DrawingSettings, list: readonly DrawingSection[]): DrawingSettings {
  const rest = { ...s }; delete rest.section; delete rest.sections;
  if (!list.length) return rest;
  if (list.length === 1 && list[0].id === 'A' && list[0].view === 'front' && !list[0].dir) return { ...rest, section: { y: list[0].at } };
  return { ...rest, sections: list.map(x => ({ ...x })) };
}
/** The next free section letter (A, B, … Z; then AA, AB, …). */
export function nextSectionId(list: readonly DrawingSection[]): string {
  const used = new Set(list.map(x => x.id));
  for (let k = 0; ; k++) { const id = k < 26 ? String.fromCharCode(65 + k) : String.fromCharCode(64 + Math.floor(k / 26)) + String.fromCharCode(65 + k % 26); if (!used.has(id)) return id; }
}
export type RoomSide = 'above' | 'below' | 'left' | 'right';
export type ViewRoom = Partial<Record<ViewId, Partial<Record<RoomSide, number>>>>;
export const ROOM_SIDES: readonly RoomSide[] = ['above', 'below', 'left', 'right'];

export const defaultDrawing = (): DrawingSettings => ({ sheet: 'A4', projection: 'third', hidden: true, dimensions: [] });

/** A saved section list: each with a letter (A–Z, two at most), a principal view and a finite position, letters unique; none valid, none. */
function readSections(raw: unknown): DrawingSection[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DrawingSection[] = [];
  for (const x of raw) if (x && typeof x.id === 'string' && /^[A-Z]{1,2}$/.test(x.id) && SECTION_VIEWS.includes(x.view) && typeof x.at === 'number' && Number.isFinite(x.at) && !out.some(o => o.id === x.id) && (x.dir === undefined || sectionDirOk(x.dir))) out.push({ id: x.id, view: x.view, at: x.at, ...(x.dir ? { dir: [x.dir[0], x.dir[1], x.dir[2]] as [number, number, number] } : {}) });
  return out.length ? out : null;
}
/** Reads drawing settings from a saved file, keeping what is valid. */
export function readDrawing(raw: unknown): DrawingSettings {
  const d = defaultDrawing(), r = (raw ?? {}) as Partial<DrawingSettings>;
  return {
    sheet: r.sheet === 'A3' ? 'A3' : d.sheet,
    ...(r.scope !== undefined ? { scope: r.scope } : {}),
    ...(typeof r.scale === 'number' && r.scale > 0 ? { scale: r.scale } : {}),
    projection: r.projection === 'first' ? 'first' : 'third',
    hidden: r.hidden !== false,
    ...(r.centers === false ? { centers: false } : {}),
    ...(r.tangent === true ? { tangent: true } : {}),
    ...(r.weldSymbols === true ? { weldSymbols: true } : {}),
    ...(r.balloons === true ? { balloons: true } : {}),
    ...(r.section && typeof r.section.y === 'number' && Number.isFinite(r.section.y) ? { section: { y: r.section.y } } : {}),
    ...(readSections(r.sections) ? { sections: readSections(r.sections)! } : {}),
    ...(typeof r.title === 'string' && r.title ? { title: r.title } : {}),
    ...(typeof r.revision === 'string' && r.revision ? { revision: r.revision.slice(0, 6) } : {}),
    ...(typeof r.revisedModel === 'string' ? { revisedModel: r.revisedModel } : {}),
    dimensions: Array.isArray(r.dimensions) ? r.dimensions.filter(x => x && typeof x.id === 'string' && isDimView(x.view) && (x.kind !== 'pcd' || ringOk(x.ring)) && (x.kind !== 'linear' || ((x.a?.at !== 'pcd' || ringOk(x.a.ring)) && (x.b?.at !== 'pcd' || ringOk(x.b.ring))))).map(x => {
      const { tol, count, auto, basic, ...rest } = x; const t = readTolerance(tol);
      return { ...rest, ...(t ? { tol: t } : {}), ...(Number.isInteger(count) && count! >= 2 && count! <= 999 ? { count } : {}), ...(auto === true ? { auto: true } : {}), ...(basic === true ? { basic: true } : {}) } as DrawingDimension;
    }) : [],
    ...(Array.isArray(r.views) && r.views.includes('front') && r.views.includes('top') ? { views: VIEW_IDS.filter(v => r.views!.includes(v)) } : {}),
    ...(readRoom(r.room) ? { room: readRoom(r.room)! } : {}),
    ...(r.orientation === 'x+' || r.orientation === 'y+' || r.orientation === 'x-' ? { orientation: r.orientation } : {}),
    ...(r.tolerancing === 'geometric' ? { tolerancing: 'geometric' as const } : {}),
    ...(Array.isArray(r.datums) && r.datums.some(isDatum) ? { datums: r.datums.filter(isDatum).map(d => ({ id: d.id, letter: d.letter, view: d.view, edge: { ...d.edge }, place: [d.place[0], d.place[1]] as XY })) } : {}),
    ...(Array.isArray(r.frames) && r.frames.some(isFrame) ? { frames: r.frames.filter(isFrame).map(f => ({ id: f.id, dim: f.dim, characteristic: 'position' as const, value: f.value, datums: [...f.datums] })) } : {}),
    ...(Array.isArray(r.notes) && r.notes.some(isNote) ? { notes: r.notes.filter(isNote).map(n => ({ id: n.id, text: n.text, at: [n.at[0], n.at[1]] as XY, ...(n.leader && VIEW_IDS.includes(n.leader.view) && isXY(n.leader.at) ? { leader: { view: n.leader.view, at: [n.leader.at[0], n.leader.at[1]] as XY } } : {}) })) } : {}),
    ...(readTables(r.tables).length ? { tables: readTables(r.tables) } : {}),
  };
}

/** Room kept where it is a number of sheet mm from 0 to 200, by a known view and side. */
function readRoom(raw: unknown): ViewRoom | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: ViewRoom = {};
  for (const v of VIEW_IDS) {
    const sides = (raw as Record<string, unknown>)[v];
    if (!sides || typeof sides !== 'object') continue;
    for (const k of ROOM_SIDES) { const x = (sides as Record<string, unknown>)[k]; if (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 200) (out[v] ??= {})[k] = x; }
  }
  return Object.keys(out).length ? out : null;
}
const isDatum = (d: unknown): d is DrawingDatum => { const x = d as DrawingDatum; return !!x && typeof x.id === 'string' && typeof x.letter === 'string' && /^[A-HJ-NPR-Z]$/.test(x.letter) && VIEW_IDS.includes(x.view) && !!x.edge && typeof x.edge.edge === 'string' && Array.isArray(x.edge.near) && x.edge.near.length === 3 && isXY(x.place); };
const isFrame = (f: unknown): f is DrawingFrame => { const x = f as DrawingFrame; return !!x && typeof x.id === 'string' && typeof x.dim === 'string' && x.characteristic === 'position' && typeof x.value === 'number' && x.value > 0 && x.value < 100 && Array.isArray(x.datums) && x.datums.length <= 3 && x.datums.every(l => typeof l === 'string' && /^[A-HJ-NPR-Z]$/.test(l)); };
/** A pitch circle's members: three or more holes, each by an edge name and a point. */
const ringOk = (ring: unknown): boolean => Array.isArray(ring) && ring.length >= 3 && ring.length <= 360 && ring.every(m => m && typeof m.edge === 'string' && Array.isArray(m.near) && m.near.length === 3);
const isXY = (p: unknown): p is XY => Array.isArray(p) && p.length === 2 && p.every(x => typeof x === 'number' && Number.isFinite(x));
const CORNERS: readonly TableCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const cellOk = (c: unknown) => c === null || (typeof c === 'number' && Number.isFinite(c)) || (typeof c === 'string' && c.length <= 120);
const columnOk = (c: unknown) => { const x = c as TableColumn; return !!x && typeof x.key === 'string' && typeof x.label === 'string' && x.label.length <= 120 && (x.unit === undefined || (typeof x.unit === 'string' && x.unit.length <= 20)) && (x.align === undefined || ['start', 'middle', 'end'].includes(x.align)) && (x.digits === undefined || (Number.isInteger(x.digits) && x.digits >= 0 && x.digits <= 6)); };
/** A table kept when whole: 1–20 columns and at most 200 rows each as long (given content), or a source's name. */
const isTable = (v: unknown): v is DrawingTable => {
  const x = v as DrawingTable;
  if (!x || typeof x.id !== 'string' || !x.id || (x.title !== undefined && (typeof x.title !== 'string' || x.title.length > 120)) || (x.at !== undefined && !isXY(x.at)) || (x.corner !== undefined && !CORNERS.includes(x.corner)) || (x.whole !== undefined && typeof x.whole !== 'boolean')) return false;
  if (x.from !== undefined) return typeof x.from === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(x.from) && x.columns === undefined && x.rows === undefined;
  return Array.isArray(x.columns) && x.columns.length >= 1 && x.columns.length <= 20 && x.columns.every(columnOk) && Array.isArray(x.rows) && x.rows.length <= 200 && x.rows.every(r => Array.isArray(r) && r.length === x.columns!.length && r.every(cellOk));
};
function readTables(raw: unknown): DrawingTable[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(), out: DrawingTable[] = [];
  for (const v of raw) if (isTable(v) && !seen.has(v.id)) { seen.add(v.id); out.push(JSON.parse(JSON.stringify({ id: v.id, ...(v.title ? { title: v.title } : {}), ...(v.from ? { from: v.from } : { columns: v.columns, rows: v.rows }), ...(v.whole ? { whole: true } : {}), ...(v.at ? { at: v.at } : {}), ...(v.corner ? { corner: v.corner } : {}) })) as DrawingTable); }
  return out;
}
const isNote = (n: unknown): n is DrawingNote => !!n && typeof (n as DrawingNote).id === 'string' && typeof (n as DrawingNote).text === 'string' && isXY((n as DrawingNote).at);
function readTolerance(t: unknown): Tolerance | null {
  const x = t as Tolerance | undefined, num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (x?.kind === 'symmetric' && num(x.value) && x.value > 0) return { kind: 'symmetric', value: x.value };
  if (x?.kind === 'deviation' && num(x.upper) && num(x.lower) && x.upper >= x.lower) return { kind: 'deviation', upper: x.upper, lower: x.lower };
  if (x?.kind === 'fit' && typeof x.code === 'string' && /^[A-Za-z]{1,2}\d{1,2}$/.test(x.code)) return { kind: 'fit', code: x.code };
  return null;
}

export type DrawingViews = Record<ViewId, BrepProjection>;
