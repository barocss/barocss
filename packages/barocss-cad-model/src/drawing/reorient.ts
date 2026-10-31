// Turning a drawing to another front side (R14.3b, O7). The rule for what is on it, typed:
// - every annotation goes to the view of the new orientation that looks along the same model axis as its own (one
//   always does: the top view stays, the front and right views swap or turn round), its places and leader points
//   carried through the model; a horizontal or vertical dimension turns with the axes; the views shown turn with them;
// - every dimension must then read what it read before (the same edges, the same value): if one does not, or no
//   longer resolves, the change is refused (ORIENTATION_REMAP_FAILED) and nothing changes;
// - a section is cut square to its view's depth (A–A: the front's): when the new depth lies along the old one the plane
//   is kept (its position turned with it), its dimensions turned as that view's are; across it the change is refused
//   (SECTION_ACROSS) — turn the section off first.
import { resolveDimension, type Resolved } from './dimensions';
import { baseViewOf, detailLetter, isDetailRef, isSectionRef, isViewId, sectionLetter, sectionsOf, withSections, type DimView, type SectionRef, type DrawingSection, type DrawingSettings, type DrawingViews, type ViewId, type XY } from './types';
import { sectionDepth, type Orientation } from './views';

export const REORIENT_VERSION = 'cad-studio-reorient-v1';

export type ReorientResult =
  | { ok: true; settings: DrawingSettings; moved: { from: ViewId; to: ViewId }[] }
  | { ok: false; code: 'ORIENTATION_REMAP_FAILED'; message: string; failed: { dim: string; was: string; now: string }[] }
  | { ok: false; code: 'SECTION_ACROSS'; message: string }
  /** DR-3: a half or offset section is not turned (its centreline and steps are in its view's own coordinates). */
  | { ok: false; code: 'SECTION_KIND'; message: string };

const ORTHO: readonly ViewId[] = ['front', 'top', 'right'];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const orientationOf = (s: DrawingSettings): Orientation => s.orientation ?? 'y-';

/** For each old orthographic view, the new view looking along the same axis, and how its points map. */
function viewMap(from: DrawingViews, to: DrawingViews): Map<ViewId, { view: ViewId; point: (p: XY) => XY; swaps: boolean }> {
  const out = new Map<ViewId, { view: ViewId; point: (p: XY) => XY; swaps: boolean }>();
  for (const id of ORTHO) {
    const a = from[id], target = ORTHO.find(v => Math.abs(Math.abs(dot(to[v].toward, a.toward)) - 1) < 1e-9)!, b = to[target];
    // A view point is u·right + v·up (any depth): its new coordinates are its dot products with the new axes.
    const point = (p: XY): XY => { const q = [0, 1, 2].map(k => p[0] * a.right[k] + p[1] * a.up[k]); return [dot(q, b.right), dot(q, b.up)]; };
    out.set(id, { view: target, point, swaps: Math.abs(dot(a.right, b.right)) < 0.5 });
  }
  return out;
}

const readOf = (r: Resolved) => r.ok ? `${r.text} (${r.value})` : `lost: ${r.reason}`;

/** The sections turned to `next` (each kept along its view's new depth, its place turned with it), or the first cut across it. */
export function turnSections(settings: DrawingSettings, next: Orientation): DrawingSection[] | { across: DrawingSection } {
  const was = orientationOf(settings), kept: DrawingSection[] = [];
  for (const x of sectionsOf(settings)) {
    // (O178: an aligned section's plane is the model's own — its normal and place in model axes — whatever the front.)
    if (x.dir) { kept.push({ ...x }); continue; }
    const along = dot(sectionDepth(x.view, was).d, sectionDepth(x.view, next).d);
    if (Math.abs(along) < 0.5) return { across: x };
    kept.push({ ...x, at: along * x.at });
  }
  return kept;
}
/** The settings turned to `next` (its views projected for it), or why not. */
export function reorient(from: DrawingViews, to: DrawingViews, settings: DrawingSettings, next: Orientation): ReorientResult {
  const map = viewMap(from, to), was = orientationOf(settings);
  const base: DrawingSettings = { ...settings }; delete base.orientation;
  const turned: DrawingSettings = next === 'y-' ? base : { ...base, orientation: next };
  if (was === next) return { ok: true, settings, moved: [] };
  // Sections (A–A, and O148 X1's on any principal view): each kept where its view's new depth runs along the old (its
  // position along it turned), refused across it.
  // (DR-3/DR-4: a half, offset, removed or revolved section is refused — their placing is in the view's own coordinates.)
  const kind = sectionsOf(settings).find(x => x.half || x.steps || x.removed || x.revolved);
  if (kind) return { ok: false, code: 'SECTION_KIND', message: `Section ${kind.id}–${kind.id} is a ${kind.half ? 'half' : kind.steps ? 'offset' : kind.removed ? 'removed' : 'revolved'} section: make it a full one first, then turn the drawing.` };
  if (sectionsOf(settings).length) {
    const kept = turnSections(settings, next);
    if ('across' in kept) return { ok: false, code: 'SECTION_ACROSS', message: `Section ${kept.across.id}–${kept.across.id} is cut across the present ${kept.across.view} view: turn it off first, then turn the drawing.` };
    const w = withSections(turned, kept); delete turned.section; delete turned.sections; Object.assign(turned, w);
  }
  const moved: { from: ViewId; to: ViewId }[] = [];
  for (const [f, m] of map) if (m.view !== f) moved.push({ from: f, to: m.view });
  // The views shown turn too: a view shown before keeps its annotations shown (the front and top always are).
  if (settings.views) {
    const shown = new Set<ViewId>(['front', 'top']);
    for (const v of settings.views) shown.add(map.get(v)?.view ?? v);
    const all: ViewId[] = ['front', 'top', 'right', 'iso'];
    if (all.every(v => shown.has(v))) delete turned.views; else turned.views = all.filter(v => shown.has(v));
  }
  const mapPlace = (view: ViewId, p: XY): [ViewId, XY] => { const m = map.get(view); return m ? [m.view, m.point(p)] : [view, p]; };
  // (DR-1: a detail turns with its parent — on a view, to the view showing the same axes, its circle's centre carried
  // through the model; on a section, as that section's view turns — and its dimensions with it.)
  const baseOf = (v: DimView) => baseViewOf(v, sectionsOf(settings), settings.details);
  if (settings.details) turned.details = settings.details.map(x => {
    if (isViewId(x.view)) { const [view, center] = mapPlace(x.view, x.center); return { ...x, view: view as typeof x.view, center }; }
    const m = map.get(baseOf(x.view)); return m ? { ...x, center: m.point(x.center) } : x;
  });
  turned.dimensions = settings.dimensions.map(d => {
    if (isDetailRef(d.view)) {
      const m = map.get(baseOf(d.view)); if (!m) return d;
      const place = m.point(d.place);
      return d.kind === 'linear' && d.orient !== 'aligned' && m.swaps ? { ...d, place, orient: d.orient === 'horizontal' ? 'vertical' : 'horizontal' } : { ...d, place };
    }
    // (Queue 3: a dimension on a section turns as its section's view does — the section is kept only where that view's
    // new depth runs along the old, so its view turns within its own plane or is seen from the other side, as R14.3b
    // maps the view's own annotations. It stays on its section.)
    if (isSectionRef(d.view)) {
      const x = sectionsOf(settings).find(y => y.id === sectionLetter(d.view as SectionRef)), m = x && map.get(x.view);
      if (!m) return d;
      const place = m.point(d.place);
      return d.kind === 'linear' && d.orient !== 'aligned' && m.swaps ? { ...d, place, orient: d.orient === 'horizontal' ? 'vertical' : 'horizontal' } : { ...d, place };
    }
    const [view, place] = mapPlace(d.view as ViewId, d.place);
    if (d.kind === 'linear' && d.orient !== 'aligned' && map.get(d.view as ViewId)?.swaps) return { ...d, view, place, orient: d.orient === 'horizontal' ? 'vertical' : 'horizontal' };
    return { ...d, view, place };
  });
  if (settings.notes) turned.notes = settings.notes.map(n => n.leader ? { ...n, leader: (([view, at]) => ({ view, at }))(mapPlace(n.leader.view, n.leader.at)) } : n);
  if (settings.datums) turned.datums = settings.datums.map(d => { const [view, place] = mapPlace(d.view, d.place); return { ...d, view, place }; });
  if (settings.datumTargets) turned.datumTargets = settings.datumTargets.map((d): typeof d => {
    const [view, place] = mapPlace(d.view, d.place), m = map.get(d.view);
    // A line's ends and an area's centre are view points: they turn as the symbol's place does; a rectangle's width and height swap with the axes.
    if (d.kind === 'line') return { ...d, view, place, line: { from: mapPlace(d.view, d.line.from)[1], to: mapPlace(d.view, d.line.to)[1] } };
    if (d.kind === 'area') {
      const at = mapPlace(d.view, d.area.at)[1];
      return { ...d, view, place, area: d.area.shape === 'circle' ? { ...d.area, at } : m?.swaps ? { shape: 'rect' as const, at, w: d.area.h, h: d.area.w } : { ...d.area, at } };
    }
    return { ...d, view, place };
  });
  if (settings.frames) turned.frames = settings.frames.map(f => {
    if (f.dim !== undefined) return f;
    const ownView = f.view;
    if (isViewId(ownView)) { const [view, place] = mapPlace(ownView, f.place); return { ...f, view, place }; }
    // Keep derived-view identity. A missing parent stays unresolved; never use baseViewOf's front fallback.
    const parent = isDetailRef(ownView) ? settings.details?.find(d => d.id === detailLetter(ownView))?.view : ownView;
    const base = parent && (isViewId(parent) ? parent : isSectionRef(parent) ? sectionsOf(settings).find(s => s.id === sectionLetter(parent))?.view : undefined);
    const m = base && map.get(base);
    return m ? { ...f, place: m.point(f.place) } : f;
  });
  // Every dimension reads as it did.
  const failed: { dim: string; was: string; now: string }[] = [];
  settings.dimensions.forEach((d, k) => {
    // (A detail's dimension on a view reads as its parent's would: the detail only clips what it shows.)
    const own = isDetailRef(d.view) && settings.details?.find(x => x.id === detailLetter(d.view as `detail:${string}`));
    const parentWas = own && isViewId(own.view) ? own.view : null, parentNow = parentWas ? map.get(parentWas)?.view ?? parentWas : null;
    const before = resolveDimension(parentWas ? { [d.view]: from[parentWas] } : from, d), after = resolveDimension(parentNow ? { [d.view]: to[parentNow] } : to, turned.dimensions[k]);
    if (!before.ok) return;
    if (!after.ok || after.kind !== before.kind || Math.abs(after.value - before.value) > 1e-9 * Math.max(1, Math.abs(before.value))) failed.push({ dim: d.id, was: readOf(before), now: readOf(after) });
  });
  if (failed.length) return { ok: false, code: 'ORIENTATION_REMAP_FAILED', message: `${failed.length} dimension${failed.length > 1 ? 's' : ''} would not read the same from the new front: nothing was turned.`, failed };
  return { ok: true, settings: turned, moved };
}
