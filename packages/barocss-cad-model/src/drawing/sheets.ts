// 11 ④: drawing sets — a drawing of several sheets.
//
// `settings.sheets` lists the sheets after the first, each with the views drawn on it (standard view names, removed
// sections `section:B`, details `detail:C`). The first sheet holds every view no other sheet lists. A section that is not
// removed is drawn in projection with its view, so it is always on its view's sheet; a section or detail nobody lists is on
// its parent's sheet. A drawing with no `sheets` is the one sheet it always was: nothing here touches it.
//
// A sheet is laid out and built as a drawing of its own: `forSheet` gives the settings of one sheet (its views, and what
// belongs to them: dimensions, datums, targets, frames, notes with a leader, sections, details), carrying a `sheetContext`
// for what only a drawing set shows (SHEET n OF N, the sheet index, the cross-references). `mergeSheet` writes an edit made
// on those settings back into the whole drawing's.
import { problem, type Problem } from '../engine/refusal';
import { VIEW_IDS, isDetailRef, isSectionRef, isViewId, nextSectionId, reservedDetailLetters, sectionLetter, sectionsOf, withSections, type DrawingDimension, type DrawingNote, type DrawingSection, type DrawingSettings, type DrawingTable, type ViewId } from './types';
import type { DrawingDetail } from './detail';

/** A sheet after the first: its id (kept when it is renamed), an optional name, size and scale (absent: the drawing's `sheet`; the largest that fits), and the view ids drawn on it. */
export interface DrawingSheet { id: string; name?: string; size?: 'A4' | 'A3'; scale?: number; views: string[] }
/** What the settings of one sheet of a drawing set carry beyond the sheet's own views and annotations. Numbers are the sheets', counted from 1. */
export interface SheetContext {
  n: number; of: number;
  /** Every sheet's name and size, the first included. */
  sheets: { name: string; size: 'A4' | 'A3' }[];
  /** The sheet each view, section and detail is drawn on. */
  where: Record<string, number>;
  /** Every shown standard view, on whatever sheet. */
  allViews: ViewId[];
  /** Details whose circle is on this sheet but whose view is on another; details drawn here whose circle is on another. */
  circleOnly: string[]; viewOnly: string[];
  /** The same for removed sections: the cutting line is here, the section on another; the section is here, its line on another. */
  lineOnly: string[]; sectionViewOnly: string[];
  /** The views the file lists that this drawing does not have (first sheet only; plain words). */
  stale: string[];
  /** Whether balloons (a drawing-level setting) are drawn on this sheet: where the first view they can sit on is. (Weld symbols follow each joint's own view.) */
  balloonsHere: boolean;
  /** The datum letters the whole drawing has (features and targets), and the first datum feature of each letter: a frame on this sheet may name a datum on another, and a repeated letter is reported once. */
  datumLetters: string[]; datumFirst: Record<string, string>;
}

export const MAX_SHEETS = 12;
const idOk = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,16}$/.test(x);
const nameOk = (x: unknown): x is string => typeof x === 'string' && !!x.trim() && x.length <= 40 && !/[\r\n\t]/.test(x);
const scaleOk = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 1000;
/** A view id by its spelling: a standard view, a section's `section:B` or a detail's `detail:C`. */
export const refOk = (v: unknown): v is string => typeof v === 'string' && (isViewId(v) || isSectionRef(v) || isDetailRef(v));

/** The sheets of a saved file, keeping what is valid: unique ids, known sizes, a view on the first sheet that lists it (stale ones too: they are reported). */
export function readSheets(raw: unknown): DrawingSheet[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>(), seen = new Set<string>(), out: DrawingSheet[] = [];
  for (const x of raw as Partial<DrawingSheet>[]) {
    if (!x || typeof x !== 'object' || !idOk(x.id) || ids.has(x.id) || out.length >= MAX_SHEETS - 1) continue;
    ids.add(x.id);
    const views: string[] = [];
    if (Array.isArray(x.views)) for (const v of x.views) if (refOk(v) && !seen.has(v)) { seen.add(v); views.push(v); }
    out.push({ id: x.id, ...(nameOk(x.name) ? { name: x.name } : {}), ...(x.size === 'A4' || x.size === 'A3' ? { size: x.size } : {}), ...(scaleOk(x.scale) ? { scale: x.scale } : {}), views });
  }
  return out;
}

/** Strict input (set_drawing, the Studio): no partial acceptance, no unknown keys. */
export function checkSheetsInput(x: unknown): Problem[] {
  const bad = (why: string) => [problem('DRAWING_OPTIONS', `sheets: ${why}`)];
  if (!Array.isArray(x)) return bad('give a list of the sheets after the first, [] for one sheet.');
  if (x.length > MAX_SHEETS - 1) return bad(`at most ${MAX_SHEETS} sheets in all.`);
  const ids = new Set<string>(), listed = new Map<string, string>();
  for (const [k, s] of x.entries()) {
    const at = `sheets[${k}]`;
    if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).some(key => !['id', 'name', 'size', 'scale', 'views'].includes(key))) return bad(`${at} needs id, views and optionally name, size, scale. No other keys.`);
    const sh = s as Record<string, unknown>;
    if (!idOk(sh.id)) return bad(`${at}.id is 1 to 16 letters, digits, - or _.`);
    if (ids.has(sh.id)) return bad(`two sheets are called ${sh.id}; ids are unique.`);
    ids.add(sh.id);
    if (sh.name !== undefined && !nameOk(sh.name)) return bad(`${at}.name is text up to 40 characters.`);
    if (sh.size !== undefined && sh.size !== 'A4' && sh.size !== 'A3') return bad(`${at}.size is A4 or A3.`);
    if (sh.scale !== undefined && !scaleOk(sh.scale)) return bad(`${at}.scale is a number above 0 (2 is 2:1, 0.5 is 1:2).`);
    if (!Array.isArray(sh.views)) return bad(`${at}.views is a list of view ids (front, top, right, iso, section:B, detail:C).`);
    for (const v of sh.views) {
      if (!refOk(v)) return bad(`${at} lists ${JSON.stringify(v)}, which is not a view id. Use front, top, right, iso, section:B or detail:C.`);
      const was = listed.get(v);
      if (was !== undefined) return bad(`${v} is listed on ${was === sh.id ? `${was} twice` : `sheets ${was} and ${sh.id}`}. A view lives on exactly one sheet.`);
      listed.set(v, sh.id);
    }
  }
  return [];
}

/** The refusal for sheets against the drawing they are set on, in plain words, or null: every section and detail listed must exist, and only a removed section can be on another sheet. */
export function sheetsProblem(s: DrawingSettings, sheets: readonly DrawingSheet[] = s.sheets ?? []): string | null {
  const sections = sectionsOf(s), details = s.details ?? [];
  for (const sh of sheets) for (const v of sh.views) {
    const name = sh.name ?? sh.id;
    if (isSectionRef(v)) {
      const sec = sections.find(x => x.id === sectionLetter(v));
      if (!sec) return `Sheet ${name} lists section ${sectionLetter(v)}, which the drawing does not have.`;
      if (!sec.removed) return `Section ${sec.id}–${sec.id} is drawn in projection with its ${sec.view} view, so it stays on that view's sheet. Move the view, or make it a removed section.`;
    } else if (isDetailRef(v) && !details.some(x => x.id === v.slice(7))) return `Sheet ${name} lists detail ${v.slice(7)}, which the drawing does not have.`;
  }
  return null;
}

/** What a file lists that the drawing does not have or cannot move alone: sheet number (from 2), the id, and why. Open keeps these and the issue list says so. */
export function staleSheetViews(s: DrawingSettings): { sheet: number; ref: string; why: string }[] {
  const out: { sheet: number; ref: string; why: string }[] = [];
  const sections = sectionsOf(s), details = s.details ?? [];
  (s.sheets ?? []).forEach((sh, k) => {
    const label = `Sheet ${k + 2}${sh.name ? ` (${sh.name})` : ''}`;
    for (const v of sh.views) {
      if (isSectionRef(v)) {
        const sec = sections.find(x => x.id === sectionLetter(v));
        if (!sec) out.push({ sheet: k + 2, ref: v, why: `${label} lists section ${sectionLetter(v)}, which the drawing does not have; it is ignored.` });
        else if (!sec.removed) out.push({ sheet: k + 2, ref: v, why: `${label} lists section ${sec.id}–${sec.id}, which is drawn with its ${sec.view} view and cannot be on another sheet; it stays with the view.` });
      } else if (isDetailRef(v) && !details.some(x => x.id === v.slice(7))) out.push({ sheet: k + 2, ref: v, why: `${label} lists detail ${v.slice(7)}, which the drawing does not have; it is ignored.` });
    }
  });
  return out;
}

export const sheetCount = (s: Pick<DrawingSettings, 'sheets'>): number => 1 + (s.sheets?.length ?? 0);
/** The sheet's name: the one it was given, else Sheet n (k from 0). */
export const sheetName = (s: Pick<DrawingSettings, 'sheets'>, k: number): string => (k > 0 ? s.sheets?.[k - 1]?.name : undefined) ?? `Sheet ${k + 1}`;
export const sheetSize = (s: Pick<DrawingSettings, 'sheet' | 'sheets'>, k: number): 'A4' | 'A3' => (k > 0 ? s.sheets?.[k - 1]?.size : undefined) ?? s.sheet;
/** The views a drawing shows, front and top always. */
export const shownViews = (s: Pick<DrawingSettings, 'views'>): ViewId[] => VIEW_IDS.filter(v => v === 'front' || v === 'top' || (s.views ?? VIEW_IDS).includes(v));

/** The sheet (from 0) of each view, section and detail: where it is listed, else — a section or detail — where its parent is, else the first sheet. */
export function sheetMap(s: DrawingSettings): Map<string, number> {
  const at = new Map<string, number>(), list = s.sheets ?? [];
  const listed = (ref: string) => list.findIndex(x => x.views.includes(ref)) + 1;
  for (const v of VIEW_IDS) at.set(v, listed(v));
  for (const x of sectionsOf(s)) { const ref = `section:${x.id}`, own = x.removed ? listed(ref) : 0; at.set(ref, own || at.get(x.view) || 0); }
  for (const d of s.details ?? []) { const own = listed(`detail:${d.id}`); at.set(`detail:${d.id}`, own || at.get(d.view) || 0); }
  return at;
}

/** The sheet balloons are drawn on: that of the first shown view of iso, front, top, right (the views a balloon can sit on). */
const balloonSheet = (s: DrawingSettings, at: ReadonlyMap<string, number>): number => at.get((['iso', 'front', 'top', 'right'] as const).find(v => shownViews(s).includes(v))!) ?? 0;

/**
 * The settings of sheet `k` (from 0): the drawing as if it were this sheet alone. The views on it, and each annotation on
 * one of them; tables and notes without a leader on the first sheet (with the sheet index when there are several); the
 * continuation title block (basic) after the first; balloons and weld symbols where their view is. No `sheets`: the same
 * object back.
 */
export function forSheet(s: DrawingSettings, k: number): DrawingSettings {
  if (!s.sheets?.length) return s;
  const n = sheetCount(s);
  k = Math.max(0, Math.min(n - 1, Math.floor(k)));
  const at = sheetMap(s), here = (ref: string) => (at.get(ref) ?? 0) === k, shown = shownViews(s), viewsHere = shown.filter(here);
  const sections = sectionsOf(s), details = s.details ?? [];
  const drawnSections = sections.filter(x => here(`section:${x.id}`)), lineOnly = sections.filter(x => x.removed && !here(`section:${x.id}`) && here(x.view));
  const drawnDetails = details.filter(d => here(`detail:${d.id}`)), circleOnly = details.filter(d => !here(`detail:${d.id}`) && (at.get(d.view) ?? 0) === k);
  const dimView = new Map(s.dimensions.map(d => [d.id, d.view as string]));
  const rest = { ...s }; delete rest.sheets; delete rest.section; delete rest.sections; delete rest.details;
  const out: DrawingSettings = {
    ...withSections({ ...rest, dimensions: s.dimensions.filter(d => here(d.view)) }, sections.filter(x => drawnSections.includes(x) || lineOnly.includes(x))),
    sheet: sheetSize(s, k), views: viewsHere,
  };
  delete out.scale; if (k === 0 ? s.scale !== undefined : s.sheets[k - 1].scale !== undefined) out.scale = k === 0 ? s.scale! : s.sheets[k - 1].scale!;
  const keep = [...drawnDetails, ...circleOnly];
  if (keep.length) out.details = details.filter(d => keep.includes(d)); else delete out.details;
  const list = <T,>(key: 'notes' | 'datums' | 'datumTargets' | 'frames', pick: (x: T) => boolean) => { const v = ((s[key] ?? []) as T[]).filter(pick); if (v.length) (out as unknown as Record<string, unknown>)[key] = v; else delete out[key]; };
  const noteHere = (x: DrawingNote) => x.leader ? here(x.leader.view) : noteSheet(s, x) === k;
  list<DrawingNote>('notes', noteHere);
  list<{ view: string }>('datums', x => here(x.view));
  list<{ view: string }>('datumTargets', x => here(x.view));
  list<{ view: string; dim?: string }>('frames', x => here(x.dim !== undefined ? dimView.get(x.dim) ?? 'front' : x.view));
  if (s.room) { const room: NonNullable<DrawingSettings['room']> = {}; for (const v of viewsHere) if (s.room[v]) room[v] = s.room[v]; if (Object.keys(room).length) out.room = room; else delete out.room; }
  if (k > 0) delete out.titleBlock;
  const index: DrawingTable[] = k === 0 ? [{ id: SHEET_INDEX, title: 'SHEET INDEX', columns: [{ key: 'sheet', label: 'SHEET' }, { key: 'name', label: 'NAME' }, { key: 'size', label: 'SIZE' }], rows: Array.from({ length: n }, (_, j) => [String(j + 1), sheetName(s, j), sheetSize(s, j)]), whole: true }] : [];
  const tables = k === 0 ? [...(s.tables ?? []), ...index] : [];
  if (tables.length) out.tables = tables; else delete out.tables;
  const where: Record<string, number> = {}; for (const [ref, j] of at) where[ref] = j + 1;
  out.sheetContext = {
    n: k + 1, of: n, sheets: Array.from({ length: n }, (_, j) => ({ name: sheetName(s, j), size: sheetSize(s, j) })), where, allViews: shown,
    circleOnly: circleOnly.map(d => d.id), viewOnly: drawnDetails.filter(d => (at.get(d.view) ?? 0) !== k).map(d => d.id),
    lineOnly: lineOnly.map(x => x.id), sectionViewOnly: drawnSections.filter(x => x.removed && (at.get(x.view) ?? 0) !== k).map(x => x.id),
    stale: k === 0 ? staleSheetViews(s).map(x => x.why) : [],
    balloonsHere: balloonSheet(s, at) === k,
    datumLetters: [...new Set([...(s.datums ?? []).map(d => d.letter), ...(s.datumTargets ?? []).map(t => t.letter)])],
    datumFirst: Object.fromEntries((s.datums ?? []).filter((d, j, all) => all.findIndex(o => o.letter === d.letter) === j).map(d => [d.letter, d.id])),
  };
  return out;
}
/** The sheet index table's id on the first sheet: made from the sheets, never stored. */
export const SHEET_INDEX = 'sheet-index';

/** Items of the whole drawing's list: those not on this sheet kept where they are, this sheet's replaced by `next`'s (a deleted one gone, a new one last). */
function splice<T>(whole: readonly T[], next: readonly T[], belongs: (x: T) => boolean, id: (x: T) => string): T[] {
  const by = new Map(next.map(x => [id(x), x])), used = new Set<string>(), out: T[] = [];
  for (const x of whole) {
    if (!belongs(x)) { out.push(x); continue; }
    const y = by.get(id(x)); if (y) { out.push(y); used.add(id(x)); }
  }
  for (const y of next) if (!used.has(id(y))) out.push(y);
  return out;
}

/** The whole drawing's settings after an edit `next` of sheet `k`'s (from `forSheet(whole, k)`). With no `sheets` the edit is the whole. */
export function mergeSheet(whole: DrawingSettings, k: number, next: DrawingSettings): DrawingSettings {
  if (!whole.sheets?.length) return next;
  const n = sheetCount(whole);
  k = Math.max(0, Math.min(n - 1, Math.floor(k)));
  const at = sheetMap(whole), here = (ref: string) => (at.get(ref) ?? 0) === k, shown = shownViews(whole), viewsHere = shown.filter(here);
  const dimView = new Map(whole.dimensions.map(d => [d.id, d.view as string]));
  const out: DrawingSettings = { ...next }; delete out.sheetContext;
  const set = (key: string, v: unknown) => { if (Array.isArray(v) ? v.length : v !== undefined) (out as unknown as Record<string, unknown>)[key] = v; else delete (out as unknown as Record<string, unknown>)[key]; };
  // Sheet size and scale: the first sheet's are the drawing's own; a later sheet's are its entry's.
  const sheets = whole.sheets.map(x => ({ ...x, views: [...x.views] }));
  if (k === 0) { out.sheet = next.sheet; set('scale', next.scale); }
  else {
    out.sheet = whole.sheet; set('scale', whole.scale);
    const e = sheets[k - 1];
    if (next.sheet !== whole.sheet || e.size !== undefined) e.size = next.sheet;
    if (next.scale !== undefined) e.scale = next.scale; else delete e.scale;
  }
  // A view ticked on this sheet that was on another is moved here (listed here, off the others' lists).
  const moved = (next.views ?? []).filter(v => !viewsHere.includes(v));
  for (const e of sheets) e.views = e.views.filter(v => !moved.includes(v as ViewId));
  // A view unticked here is gone from the drawing's views: it leaves every sheet's list too, so ticking it again starts clean.
  const unticked = viewsHere.filter(v => !(next.views ?? []).includes(v));
  for (const e of sheets) e.views = e.views.filter(v => !unticked.includes(v as ViewId));
  if (k > 0) sheets[k - 1].views.push(...moved);
  set('sheets', sheets);
  // The views shown: this sheet's as `next` has them (a dropped right view is gone), the others' as they were. Front and top stay.
  const views = VIEW_IDS.filter(v => v === 'front' || v === 'top' || (shown.includes(v) && !viewsHere.includes(v)) || (next.views ?? []).includes(v));
  if (whole.views !== undefined || views.length < VIEW_IDS.length) set('views', views); else delete out.views;
  if (whole.room || next.room) { const room: NonNullable<DrawingSettings['room']> = {}; for (const v of VIEW_IDS) { const r = viewsHere.includes(v) ? next.room?.[v] : whole.room?.[v]; if (r) room[v] = r; } set('room', Object.keys(room).length ? room : undefined); }
  // Sections and details: those the sheet drew or held a line or circle of; the rest as they were.
  const inSheet = (x: DrawingSection) => here(`section:${x.id}`) || (!!x.removed && here(x.view));
  const detailHere = (d: DrawingDetail) => here(`detail:${d.id}`) || (at.get(d.view) ?? 0) === k;
  // (A letter is one for sections and details of all the sheets: one made here with a letter another sheet has is given the next free one,
  // and what was made in this edit on it — its dimensions and frames, a detail of it — follows the new letter.)
  const wholeIds = new Set([...sectionsOf(whole).map(x => x.id), ...(whole.details ?? []).map(d => d.id)]);
  const mine = new Set([...sectionsOf(whole).filter(inSheet).map(x => `section:${x.id}`), ...(whole.details ?? []).filter(detailHere).map(d => `detail:${d.id}`)]);
  const reserved = reservedDetailLetters(whole);
  const used = new Set([...wholeIds, ...reserved, ...sectionsOf(next).map(x => x.id), ...(next.details ?? []).map(d => d.id)]);
  const renamed = new Map<string, string>();
  const fresh = (kind: 'section' | 'detail', id: string) => {
    const ref = `${kind}:${id}`;
    if (mine.has(ref) || (!wholeIds.has(id) && !(kind === 'detail' && reserved.has(id)))) return id;
    const to = nextSectionId([], used);
    used.add(to);
    renamed.set(ref, to);
    return to;
  };
  const nextSections = sectionsOf(next).map(x => { const id = fresh('section', x.id); return id === x.id ? x : { ...x, id }; });
  const nextDetails = (next.details ?? []).map(d => { const id = fresh('detail', d.id), view = renamed.has(d.view) ? `section:${renamed.get(d.view)}` as DrawingDetail['view'] : d.view; return id === d.id && view === d.view ? d : { ...d, id, view }; });
  const follow = <T extends { view: string }>(x: T, isNew: boolean): T => isNew && renamed.has(x.view) ? { ...x, view: `${x.view.slice(0, x.view.indexOf(':') + 1)}${renamed.get(x.view)}` } : x;
  const dimIds = new Set(whole.dimensions.map(d => d.id)), frameIds = new Set((whole.frames ?? []).map(f => f.id));
  const nextDims = next.dimensions.map(d => follow(d, !dimIds.has(d.id)));
  const nextFrames = (next.frames ?? []).map(f => f.dim === undefined ? follow(f, !frameIds.has(f.id)) : f);
  out.dimensions = splice<DrawingDimension>(whole.dimensions, nextDims, d => here(d.view), d => d.id);
  // (A note without a leader made on a later sheet is kept on it: it names the sheet.)
  const noteHere = (x: DrawingNote) => x.leader ? here(x.leader.view) : noteSheet(whole, x) === k;
  const known = new Set((whole.notes ?? []).map(x => x.id));
  set('notes', splice<DrawingNote>(whole.notes ?? [], (next.notes ?? []).map(x => { if (x.leader || known.has(x.id) || k === 0 || x.sheet) return x; return { ...x, sheet: whole.sheets![k - 1].id }; }), noteHere, x => x.id));
  set('datums', splice(whole.datums ?? [], next.datums ?? [], x => here(x.view), x => x.id));
  set('datumTargets', splice(whole.datumTargets ?? [], next.datumTargets ?? [], x => here(x.view), x => x.id));
  set('frames', splice(whole.frames ?? [], nextFrames, x => here(x.dim !== undefined ? dimView.get(x.dim) ?? 'front' : x.view), x => x.id));
  const sections = splice<DrawingSection>(sectionsOf(whole), nextSections, inSheet, x => x.id);
  set('details', splice<DrawingDetail>(whole.details ?? [], nextDetails, detailHere, d => d.id));
  // Only the first sheet carries the tables (less the index made for it), the title block's fields and the notes without a leader.
  if (k === 0) set('tables', (next.tables ?? []).filter(t => t.id !== SHEET_INDEX)); else { set('tables', whole.tables); set('titleBlock', whole.titleBlock); }
  return withSections(out, sections);
}

/** The sheet (from 0) a note without a leader is on: the one it names, else the first. */
function noteSheet(s: DrawingSettings, n: DrawingNote): number { const k = n.sheet === undefined ? -1 : (s.sheets ?? []).findIndex(x => x.id === n.sheet); return k + 1; }

/** The sheet a view, section or detail is drawn on (from 0). */
export const sheetOf = (s: DrawingSettings, ref: string): number => sheetMap(s).get(ref) ?? 0;

/** The sheets as listed after `ref` is put on sheet `to` (from 0; 0 is the first sheet, which lists nothing): it leaves every other sheet's list. */
export function moveToSheet(s: DrawingSettings, ref: string, to: number): DrawingSheet[] {
  const sheets = (s.sheets ?? []).map((x, k) => ({ ...x, views: x.views.filter(v => v !== ref).concat(k + 1 === to ? [ref] : []) }));
  return sheets;
}
/** A new empty sheet's id: S2, S3, … the first that no sheet and no note names (a note of a deleted sheet is not handed to a new one). */
export function nextSheetId(s: Pick<DrawingSettings, 'sheets' | 'notes'>): string {
  for (let k = 2; ; k++) { const id = `S${k}`; if (!(s.sheets ?? []).some(x => x.id === id) && !(s.notes ?? []).some(n => n.sheet === id)) return id; }
}
/** The sheets and notes after sheet `k` (from 1; not the first) is deleted: its views go back (a detail or section to its parent's sheet), its notes to the first sheet. */
export function removeSheet(s: DrawingSettings, k: number): Pick<DrawingSettings, 'sheets' | 'notes'> {
  const gone = s.sheets?.[k - 1];
  if (!gone || k < 1) return { ...(s.sheets ? { sheets: s.sheets } : {}), ...(s.notes ? { notes: s.notes } : {}) };
  const sheets = s.sheets!.filter((_, j) => j !== k - 1);
  const notes = s.notes?.map(n => { if (n.sheet !== gone.id) return n; const { sheet: _s, ...rest } = n; void _s; return rest; });
  return { ...(sheets.length ? { sheets } : {}), ...(notes ? { notes } : {}) };
}

/** What is wrong with the sheets of a drawing set as a whole, sheet by sheet (the sheet's number from 1, then the words): a sheet with no view. (What a file lists that the drawing lacks is on the first sheet's issue list.) */
export function sheetSetIssues(s: DrawingSettings): { sheet: number; message: string }[] {
  if (!s.sheets?.length) return [];
  const out: { sheet: number; message: string }[] = [];
  const at = sheetMap(s), shown = shownViews(s);
  for (let k = 1; k < sheetCount(s); k++) {
    const any = shown.some(v => at.get(v) === k) || [...at].some(([ref, j]) => j === k && !isViewId(ref));
    if (!any) out.push({ sheet: k + 1, message: `${sheetName(s, k)} has no view on it. Move a view to it or delete the sheet.` });
  }
  const first = shown.some(v => at.get(v) === 0) || [...at].some(([ref, j]) => j === 0 && !isViewId(ref));
  if (!first) out.push({ sheet: 1, message: `${sheetName(s, 0)} has no view on it.` });
  return out;
}
