import type { Head3, ModelAnnotation, Vec3 } from '@barocss/cad-model/drawing/annotations3d';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { OverlayDrawing } from './overlayDrawing';
import type { EdgeRef, FaceRef, OverlayLabels } from './renderer';

// G24 (G-R9): the drawing's annotations on the model (MBD/PMI), from the outer lane's model-annotations-v1. Their lines,
// arcs and heads become display drawings for both renderers' overlay passes; their texts lie in their planes (WebGPU's
// labels), facing the eye when a plane is seen nearly edge-on. A pick finds the annotation under the pointer by its
// texts and lines on screen, and selects what it points at by the targets' persistent names. Display only: no native
// face or edge identity, nothing stored.

export const PMI_COLOR: [number, number, number] = [0.13, 0.52, 0.86];
export const PMI_SELECTED: [number, number, number] = [1, 0.58, 0.12];
/** An arc's chord step (radians), and the dot head's sides. */
const ARC_STEP = Math.PI / 24, DOT_SIDES = 12;
/** Nearer edge-on than this (the sine of 10°), a plane's text faces the eye instead. */
export const PMI_EDGE_ON = Math.sin(10 * Math.PI / 180);

const sub = (a: readonly number[], b: readonly number[]): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: readonly number[], b: readonly number[]): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** A head's strokes (open, tick) as segments, its filled shapes (filled, dot) as triangles. */
function pushHead(h: Head3, normal: Vec3, lines: number[], tris: number[]): void {
  const side = unit(cross(normal, h.dir)), t = h.tip, l = h.length, w = h.width / 2;
  const bx = t[0] - h.dir[0] * l, by = t[1] - h.dir[1] * l, bz = t[2] - h.dir[2] * l;
  if (h.style === 'filled') { tris.push(t[0], t[1], t[2], bx + side[0] * w, by + side[1] * w, bz + side[2] * w, bx - side[0] * w, by - side[1] * w, bz - side[2] * w); return; }
  if (h.style === 'open') {
    lines.push(t[0], t[1], t[2], bx + side[0] * w, by + side[1] * w, bz + side[2] * w, t[0], t[1], t[2], bx - side[0] * w, by - side[1] * w, bz - side[2] * w);
    return;
  }
  if (h.style === 'tick') {
    const ox = (h.dir[0] + side[0]) * l / 2, oy = (h.dir[1] + side[1]) * l / 2, oz = (h.dir[2] + side[2]) * l / 2;
    lines.push(t[0] - ox, t[1] - oy, t[2] - oz, t[0] + ox, t[1] + oy, t[2] + oz);
    return;
  }
  // (A dot: a disc of the head's width about the tip, in the plane.)
  const r = w, u = side, v = cross(normal, u);
  for (let k = 0; k < DOT_SIDES; k++) {
    const a0 = k * 2 * Math.PI / DOT_SIDES, a1 = (k + 1) * 2 * Math.PI / DOT_SIDES;
    tris.push(t[0], t[1], t[2],
      t[0] + r * (u[0] * Math.cos(a0) + v[0] * Math.sin(a0)), t[1] + r * (u[1] * Math.cos(a0) + v[1] * Math.sin(a0)), t[2] + r * (u[2] * Math.cos(a0) + v[2] * Math.sin(a0)),
      t[0] + r * (u[0] * Math.cos(a1) + v[0] * Math.sin(a1)), t[1] + r * (u[1] * Math.cos(a1) + v[1] * Math.sin(a1)), t[2] + r * (u[2] * Math.cos(a1) + v[2] * Math.sin(a1)));
  }
}

/** One annotation's lines (its arcs in chords) and heads, appended. */
function pushAnnotation(a: ModelAnnotation, lines: number[], tris: number[]): void {
  for (const l of a.lines) lines.push(l.a[0], l.a[1], l.a[2], l.b[0], l.b[1], l.b[2]);
  for (const c of a.arcs) {
    const n = Math.max(4, Math.ceil(Math.abs(c.t1 - c.t0) / ARC_STEP));
    for (let k = 0; k < n; k++) {
      const s = c.t0 + (c.t1 - c.t0) * k / n, e = c.t0 + (c.t1 - c.t0) * (k + 1) / n;
      lines.push(c.center[0] + c.u[0] * Math.cos(s) + c.v[0] * Math.sin(s), c.center[1] + c.u[1] * Math.cos(s) + c.v[1] * Math.sin(s), c.center[2] + c.u[2] * Math.cos(s) + c.v[2] * Math.sin(s),
        c.center[0] + c.u[0] * Math.cos(e) + c.v[0] * Math.sin(e), c.center[1] + c.u[1] * Math.cos(e) + c.v[1] * Math.sin(e), c.center[2] + c.u[2] * Math.cos(e) + c.v[2] * Math.sin(e));
    }
  }
  for (const h of a.arrows) pushHead(h, a.plane.normal, lines, tris);
}

/** The annotations' lines and heads: the selected one apart, in the accent colour. */
export function pmiDrawings(items: readonly ModelAnnotation[], selected: string | null = null): OverlayDrawing[] {
  const lines: number[] = [], tris: number[] = [], selLines: number[] = [], selTris: number[] = [];
  for (const a of items) if (a.id === selected) pushAnnotation(a, selLines, selTris); else pushAnnotation(a, lines, tris);
  const out: OverlayDrawing[] = [];
  if (lines.length) out.push({ name: 'pmi:lines', positions: Float32Array.from(lines), topology: 'lines', color: PMI_COLOR, opacity: 1, width: 1.2 });
  if (tris.length) out.push({ name: 'pmi:heads', positions: Float32Array.from(tris), topology: 'triangles', color: PMI_COLOR, opacity: 1 });
  if (selLines.length) out.push({ name: 'pmi:selected', positions: Float32Array.from(selLines), topology: 'lines', color: PMI_SELECTED, opacity: 1, width: 2 });
  if (selTris.length) out.push({ name: 'pmi:selected-heads', positions: Float32Array.from(selTris), topology: 'triangles', color: PMI_SELECTED, opacity: 1 });
  return out;
}

const ALIGN = { start: 0, middle: 0.5, end: 1 } as const;
/** Whether a plane is seen nearly edge-on from `forward` (the eye's direction). */
export const pmiEdgeOn = (normal: readonly number[], forward: readonly number[]) => Math.abs(normal[0] * forward[0] + normal[1] * forward[1] + normal[2] * forward[2]) < PMI_EDGE_ON;
const hex = (c: readonly number[]) => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

/**
 * The texts as labels: in their planes (world mm, their own direction and up), or facing the eye at 12 px when the plane
 * is seen nearly edge-on from `forward`. The selected annotation's texts in the accent colour, a set apart.
 */
export function pmiLabels(items: readonly ModelAnnotation[], forward: readonly number[], selected: string | null = null): { plain: OverlayLabels; selected: OverlayLabels | null } {
  const plain: OverlayLabels['labels'] = [], sel: OverlayLabels['labels'] = [];
  for (const a of items) {
    const facing = pmiEdgeOn(a.plane.normal, forward), into = a.id === selected ? sel : plain;
    for (const t of a.texts) into.push(facing
      ? { text: t.text, at: t.at, size: 12, align: [ALIGN[t.align], 1] }
      : { text: t.text, at: t.at, size: t.height, align: [ALIGN[t.align], 0.74], plane: { right: t.dir, up: t.up } });
  }
  return { plain: { labels: plain, color: hex(PMI_COLOR) }, selected: sel.length ? { labels: sel, color: hex(PMI_SELECTED) } : null };
}

/** What a pick needs: a world point on screen (CSS px), or null behind the eye. */
export type Project = (p: Vec3) => [number, number] | null;
function segmentDistance(px: number, py: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
  return Math.hypot(a[0] + t * dx - px, a[1] + t * dy - py);
}
/** The annotation nearest the pointer within `radius` px: by its texts' baseline spans and its lines on screen. */
export function pmiPick(items: readonly ModelAnnotation[], project: Project, x: number, y: number, radius = 8): string | null {
  let best: string | null = null, bestD = radius;
  for (const a of items) {
    let d = Infinity;
    for (const t of a.texts) {
      // (The text's span along its direction: about 0.6 of its height a character, from where its alignment puts it.)
      const width = 0.6 * t.height * t.text.length, k = ALIGN[t.align];
      const s = [t.at[0] - t.dir[0] * width * k, t.at[1] - t.dir[1] * width * k, t.at[2] - t.dir[2] * width * k] as Vec3;
      const e = [s[0] + t.dir[0] * width, s[1] + t.dir[1] * width, s[2] + t.dir[2] * width] as Vec3;
      const mid = [(s[0] + e[0]) / 2 + t.up[0] * t.height / 2, (s[1] + e[1]) / 2 + t.up[1] * t.height / 2, (s[2] + e[2]) / 2 + t.up[2] * t.height / 2] as Vec3;
      const ps = project(s), pe = project(e), pm = project(mid);
      if (ps && pe) d = Math.min(d, segmentDistance(x, y, ps, pe));
      if (pm) d = Math.min(d, Math.hypot(pm[0] - x, pm[1] - y));
    }
    for (const l of a.lines) { const pa = project(l.a), pb = project(l.b); if (pa && pb) d = Math.min(d, segmentDistance(x, y, pa, pb)); }
    if (d < bestD) { bestD = d; best = a.id; }
  }
  return best;
}

/** What an annotation points at, by its targets' persistent names on the shown bodies (an instance's `<id>/` names are its own). */
export function pmiSelection(a: ModelAnnotation, bodies: readonly Pick<BodyResult, 'mesh'>[]): { edges: EdgeRef[]; faces: FaceRef[] } {
  const edges: EdgeRef[] = [], faces: FaceRef[] = [];
  for (const t of a.targets) {
    if (t.edge) for (let b = 0; b < bodies.length; b++) {
      const i = bodies[b].mesh.edges.findIndex(e => e.names.includes(t.edge!));
      if (i >= 0 && !edges.some(e => e.body === b && e.edge === i)) { edges.push({ body: b, edge: i }); break; }
    }
    if (t.face) for (let b = 0; b < bodies.length; b++) {
      const i = bodies[b].mesh.faces.findIndex(f => f.name.split('+').includes(t.face!));
      if (i >= 0 && !faces.some(f => f.body === b && f.face === i)) { faces.push({ body: b, face: i }); break; }
    }
  }
  return { edges, faces };
}

/** Distance helper for tests and the viewport: a world vector's length. */
export const pmiLength = (a: readonly number[], b: readonly number[]) => Math.hypot(...sub(a, b));

/** Which annotations face the eye (nearly edge-on) from `forward`, as a key: their labels are rebuilt only when it changes. */
export function pmiFacingKey(items: readonly ModelAnnotation[], forward: readonly number[]): string {
  let key = '';
  for (let i = 0; i < items.length; i++) if (pmiEdgeOn(items[i].plane.normal, forward)) key += i + ',';
  return key;
}
