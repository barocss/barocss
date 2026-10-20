// A DXF drawing read as a sketch draft (A6.4, O28): our own reader of the 2D geometry a profile needs — LINE, ARC,
// CIRCLE, LWPOLYLINE (bulges as arcs) and POLYLINE/VERTEX (what AC1009 files, ours included, write) — in the file's
// unit ($INSUNITS) scaled to mm. The edges are chained into closed loops end to end (within 1e-6 of the drawing's
// size); the largest loop and the loops beside it are the regions, a loop inside one a hole. Splines, ellipses, blocks
// and text are the underlay's (dxfUnderlay.ts, O68): shown to trace over, never regions. Dimensions, hatches and points
// are annotation: left out, and listed. Other geometry (3D entities) is refused, typed, as are an edge left open, a loop
// inside a hole and a file that is not DXF.
// What it gives is a draft: its dimensions read from the drawing are the user's to confirm (drafts.ts).
import type { LoopSegment } from '../engine/doc';
import { readUnderlay, UNDERLAY_TOP, type Underlay } from './dxfUnderlay';

export type DxfReadCode = 'DXF_MALFORMED' | 'DXF_UNSUPPORTED' | 'DXF_OPEN' | 'DXF_NESTED' | 'DXF_EMPTY' | 'DWG_NOT_READ';
/** AutoCAD's DWG version tags (the file's first six bytes) and their releases. */
const DWG_RELEASES: Record<string, string> = { AC1009: 'R11/R12', AC1012: 'R13', AC1014: 'R14', AC1015: '2000', AC1018: '2004', AC1021: '2007', AC1024: '2010', AC1027: '2013', AC1032: '2018' };
/** The release of a DWG file from its first bytes (`AC10xx`), or null when it is not one. */
export function dwgRelease(head: string): string | null {
  const m = /^AC10\d\d/.exec(head); return m ? DWG_RELEASES[m[0]] ?? `version ${m[0]}` : null;
}
/** What to do with a DWG (O61: DWG is not read; every producer saves DXF). */
export const DWG_ROUTES = 'Save it as DXF from the program that made it (AutoCAD and its family: Save As → DXF), or convert it with the free ODA File Converter (DWG to DXF, one file or a folder at once), then add the DXF.';
/** The refusal for a DWG file, typed (O61). */
export function dwgRefusal(head: string): DxfReadError | null {
  const r = dwgRelease(head); return r ? new DxfReadError('DWG_NOT_READ', `this is a DWG file (AutoCAD ${r}), and the studio reads DXF, not DWG. ${DWG_ROUTES}`) : null;
}
export class DxfReadError extends Error { constructor(public code: DxfReadCode, message: string) { super(`[${code}] ${message}`); this.name = 'DxfReadError'; } }
type P = [number, number];
/** An edge: a line, or an arc from a to b about c, counter-clockwise when ccw. */
type Edge = { a: P; b: P; c?: P; ccw?: boolean };
export interface DxfLoop { segments: LoopSegment[]; area: number; box: [number, number, number, number]; circle?: { center: P; radius: number } }
export interface DxfSketch {
  /** The regions (each a closed loop) and the holes (each inside a region), in mm. */
  regions: DxfLoop[]; holes: DxfLoop[];
  unit: { declared: boolean; name: string; toMM: number };
  /** Entities left out as annotation, counted by type. */
  ignored: Record<string, number>;
  /** What the drawing shows beyond its profile, to trace over (O68): never regions, holes or dimensions. */
  underlay: Underlay;
  entities: number;
}

const UNITS: Record<number, [string, number]> = { 1: ['inches', 25.4], 2: ['feet', 304.8], 4: ['millimetres', 1], 5: ['centimetres', 10], 6: ['metres', 1000] };
// (TEXT and MTEXT are shown in the underlay, O68; the rest of the annotation is left out and listed.)
const ANNOTATION = new Set(['DIMENSION', 'HATCH', 'POINT', 'LEADER', 'MLEADER', 'ATTDEF', 'ATTRIB', 'VIEWPORT', 'SOLID', 'WIPEOUT', 'IMAGE']);
const GEOMETRY = new Set(['LINE', 'ARC', 'CIRCLE', 'LWPOLYLINE', 'POLYLINE']);

/** The file as (code, value) pairs. */
export function pairsOf(text: string): [number, string][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (lines.length % 2) throw new DxfReadError('DXF_MALFORMED', 'an odd number of lines: a group code without its value');
  const out: [number, string][] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (!Number.isInteger(code)) throw new DxfReadError('DXF_MALFORMED', `line ${i + 1}: "${lines[i].trim().slice(0, 20)}" is not a group code`);
    out.push([code, lines[i + 1].trim()]);
  }
  return out;
}
const num = (v: string, what: string): number => { const x = Number(v); if (!Number.isFinite(x)) throw new DxfReadError('DXF_MALFORMED', `${what}: "${v.slice(0, 20)}" is not a number`); return x; };
/** A bulge's arc between two points (bulge = tan(θ/4), positive counter-clockwise). */
function bulgeEdge(a: P, b: P, bulge: number): Edge {
  if (Math.abs(bulge) < 1e-12) return { a, b };
  const dx = b[0] - a[0], dy = b[1] - a[1], chord = Math.hypot(dx, dy), theta = 4 * Math.atan(bulge), r = chord / (2 * Math.sin(theta / 2));
  // (The centre is on the chord's perpendicular, at r cos(θ/2) from its middle, to the bulge's left for a positive one.)
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, h = r * Math.cos(theta / 2), nx = -dy / chord, ny = dx / chord;
  return { a, b, c: [mx + nx * h, my + ny * h], ccw: bulge > 0 };
}
const arcPoint = (c: P, r: number, deg: number): P => [c[0] + r * Math.cos(deg * Math.PI / 180), c[1] + r * Math.sin(deg * Math.PI / 180)];

/** The edges of the ENTITIES section, the unit, the left-out entities. */
function readEntities(pairs: [number, string][]): { edges: Edge[]; circles: { c: P; r: number }[]; unit: DxfSketch['unit']; ignored: Record<string, number>; entities: number } {
  let units = 0, declared = false;
  for (let i = 0; i + 1 < pairs.length; i++) if (pairs[i][0] === 9 && pairs[i][1] === '$INSUNITS' && pairs[i + 1][0] === 70) { units = num(pairs[i + 1][1], '$INSUNITS'); declared = true; }
  const u = UNITS[units];
  if (declared && units !== 0 && !u) throw new DxfReadError('DXF_UNSUPPORTED', `$INSUNITS ${units}: only inches, feet, millimetres, centimetres and metres are read`);
  const unit = { declared: declared && units !== 0, name: u ? u[0] : 'millimetres (none declared)', toMM: u ? u[1] : 1 };
  const start = pairs.findIndex((p, i) => p[0] === 2 && p[1] === 'ENTITIES' && pairs[i - 1]?.[0] === 0 && pairs[i - 1]?.[1] === 'SECTION');
  if (start < 0) throw new DxfReadError('DXF_MALFORMED', 'no ENTITIES section: not a DXF drawing');
  const edges: Edge[] = [], circles: { c: P; r: number }[] = [], ignored: Record<string, number> = {};
  let i = start + 1, entities = 0;
  const k = unit.toMM;
  while (i < pairs.length && !(pairs[i][0] === 0 && pairs[i][1] === 'ENDSEC')) {
    if (pairs[i][0] !== 0) { i++; continue; }
    const type = pairs[i][1]; i++;
    const body: [number, string][] = [];
    while (i < pairs.length && pairs[i][0] !== 0) body.push(pairs[i++]);
    entities++;
    if (type === 'VERTEX' || type === 'SEQEND') continue;
    if (ANNOTATION.has(type)) { ignored[type] = (ignored[type] ?? 0) + 1; continue; }
    // (Splines, ellipses, blocks and text: the underlay's, never the profile's, O68.)
    if (UNDERLAY_TOP.has(type)) continue;
    if (!GEOMETRY.has(type)) throw new DxfReadError('DXF_UNSUPPORTED', `a ${type} entity: the drawing reader takes LINE, ARC, CIRCLE, LWPOLYLINE and POLYLINE as the profile, and SPLINE, ELLIPSE, INSERT, TEXT and MTEXT as an underlay to trace over`);
    const g = (code: number, d?: number) => { const v = body.find(p => p[0] === code); if (!v) { if (d !== undefined) return d; throw new DxfReadError('DXF_MALFORMED', `a ${type} without its group ${code}`); } return num(v[1], `${type} group ${code}`); };
    if (body.some(p => p[0] === 30 && Math.abs(Number(p[1])) > 1e-9) || body.some(p => p[0] === 230 && Math.abs(Number(p[1]) - 1) > 1e-9)) throw new DxfReadError('DXF_UNSUPPORTED', `a ${type} off the XY plane (a Z, or an extrusion other than +Z): the drawing reader is 2D`);
    if (type === 'LINE') edges.push({ a: [g(10) * k, g(20) * k], b: [g(11) * k, g(21) * k] });
    else if (type === 'CIRCLE') circles.push({ c: [g(10) * k, g(20) * k], r: g(40) * k });
    else if (type === 'ARC') { const c: P = [g(10) * k, g(20) * k], r = g(40) * k; edges.push({ a: arcPoint(c, r, g(50)), b: arcPoint(c, r, g(51)), c, ccw: true }); }
    else if (type === 'LWPOLYLINE') {
      const closed = (g(70, 0) & 1) === 1, pts: P[] = [], bulges: number[] = [];
      for (const [code, v] of body) { if (code === 10) { pts.push([num(v, 'LWPOLYLINE x') * k, 0]); bulges.push(0); } else if (code === 20 && pts.length) pts[pts.length - 1][1] = num(v, 'LWPOLYLINE y') * k; else if (code === 42 && pts.length) bulges[bulges.length - 1] = num(v, 'LWPOLYLINE bulge'); }
      if (pts.length < 2) throw new DxfReadError('DXF_MALFORMED', 'an LWPOLYLINE of fewer than two vertices');
      for (let j = 0; j + 1 < pts.length; j++) edges.push(bulgeEdge(pts[j], pts[j + 1], bulges[j]));
      if (closed) edges.push(bulgeEdge(pts[pts.length - 1], pts[0], bulges[pts.length - 1]));
    } else {
      // POLYLINE: its VERTEX entities follow, up to SEQEND.
      const closed = (g(70, 0) & 1) === 1, pts: P[] = [], bulges: number[] = [];
      if ((g(70, 0) & (8 | 16 | 64)) !== 0) throw new DxfReadError('DXF_UNSUPPORTED', 'a 3D polyline or polygon mesh: the drawing reader is 2D');
      while (i < pairs.length && pairs[i][0] === 0 && pairs[i][1] === 'VERTEX') {
        i++; const v: [number, string][] = [];
        while (i < pairs.length && pairs[i][0] !== 0) v.push(pairs[i++]);
        const x = v.find(p => p[0] === 10), y = v.find(p => p[0] === 20), b = v.find(p => p[0] === 42);
        if (!x || !y) throw new DxfReadError('DXF_MALFORMED', 'a VERTEX without its position');
        pts.push([num(x[1], 'VERTEX x') * k, num(y[1], 'VERTEX y') * k]); bulges.push(b ? num(b[1], 'VERTEX bulge') : 0);
      }
      if (pts.length < 2) throw new DxfReadError('DXF_MALFORMED', 'a POLYLINE of fewer than two vertices');
      for (let j = 0; j + 1 < pts.length; j++) edges.push(bulgeEdge(pts[j], pts[j + 1], bulges[j]));
      if (closed) edges.push(bulgeEdge(pts[pts.length - 1], pts[0], bulges[pts.length - 1]));
    }
  }
  return { edges: edges.filter(e => Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]) > 0 || e.c), circles, unit, ignored, entities };
}

/** The signed area of a loop of edges (an arc's segment added), and its box. */
function areaOf(edges: readonly Edge[]): { area: number; box: [number, number, number, number] } {
  let a = 0; const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const grow = (p: P) => { box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]); box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]); };
  for (const e of edges) {
    a += (e.a[0] * e.b[1] - e.b[0] * e.a[1]) / 2; grow(e.a);
    if (e.c) {
      const r = Math.hypot(e.a[0] - e.c[0], e.a[1] - e.c[1]);
      const t0 = Math.atan2(e.a[1] - e.c[1], e.a[0] - e.c[0]); let t1 = Math.atan2(e.b[1] - e.c[1], e.b[0] - e.c[0]);
      if (e.ccw) { while (t1 <= t0) t1 += 2 * Math.PI; } else { while (t1 >= t0) t1 -= 2 * Math.PI; }
      const sweep = t1 - t0; a += (r * r / 2) * (sweep - Math.sin(sweep));
      // (The arc's extremes at the axis angles it passes.)
      for (let q = -8; q <= 8; q++) { const t = q * Math.PI / 2; if ((e.ccw ? t > t0 && t < t1 : t < t0 && t > t1)) grow([e.c[0] + r * Math.cos(t), e.c[1] + r * Math.sin(t)]); }
    }
  }
  return { area: a, box };
}
/** Whether a point is inside a loop of edges (its chords: a ray's crossings; arcs flattened finely). */
function insideLoop(p: P, edges: readonly Edge[]): boolean {
  const pts: P[] = [];
  for (const e of edges) {
    pts.push(e.a);
    if (e.c) {
      const r = Math.hypot(e.a[0] - e.c[0], e.a[1] - e.c[1]), t0 = Math.atan2(e.a[1] - e.c[1], e.a[0] - e.c[0]); let t1 = Math.atan2(e.b[1] - e.c[1], e.b[0] - e.c[0]);
      if (e.ccw) { while (t1 <= t0) t1 += 2 * Math.PI; } else { while (t1 >= t0) t1 -= 2 * Math.PI; }
      for (let s = 1; s < 32; s++) { const t = t0 + (t1 - t0) * s / 32; pts.push([e.c[0] + r * Math.cos(t), e.c[1] + r * Math.sin(t)]); }
    }
  }
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside; }
  return inside;
}
const toSegments = (edges: readonly Edge[]): LoopSegment[] => edges.map(e => (e.c ? { kind: 'arc', start: [e.a[0], e.a[1]], center: [e.c[0], e.c[1]], direction: e.ccw ? 'ccw' : 'cw' } : { kind: 'line', start: [e.a[0], e.a[1]] }));

/** A DXF drawing's profile: its regions and holes, in mm. */
export function readDxfSketch(text: string): DxfSketch {
  const dwg = dwgRefusal(text.slice(0, 6)); if (dwg) throw dwg;
  const { edges, circles, unit, ignored, entities } = readEntities(pairsOf(text)), underlay = readUnderlay(text, unit.toMM);
  // (An underlay alone needs a curve to trace: text by itself is still nothing to read.)
  const shown = underlay.polylines.length;
  if (!edges.length && !circles.length) {
    // (Nothing for a profile: an underlay alone to trace over, when there is one.)
    if (shown) return { regions: [], holes: [], unit, ignored, entities, underlay };
    throw new DxfReadError('DXF_EMPTY', `no profile geometry (${entities} entities${Object.keys(ignored).length ? `, left out: ${Object.entries(ignored).map(([t, n]) => `${n} ${t}`).join(', ')}` : ''})`);
  }
  let size = 0; for (const e of edges) size = Math.max(size, Math.abs(e.a[0]), Math.abs(e.a[1]), Math.abs(e.b[0]), Math.abs(e.b[1])); for (const c of circles) size = Math.max(size, Math.abs(c.c[0]) + c.r, Math.abs(c.c[1]) + c.r);
  const tol = 1e-6 * Math.max(1, size), same = (p: P, q: P) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol;
  // (Chained end to start; an edge may be walked backwards — a reversed arc turns the other way.)
  const left = edges.slice(), loops: { edges: Edge[]; circle?: { center: P; radius: number } }[] = [];
  while (left.length) {
    const chain = [left.shift()!];
    for (;;) {
      const end = chain[chain.length - 1].b;
      if (same(end, chain[0].a)) break;
      const k = left.findIndex(e => same(e.a, end) || same(e.b, end));
      if (k < 0) throw new DxfReadError('DXF_OPEN', `the profile is not closed at (${end[0].toPrecision(6)}, ${end[1].toPrecision(6)}) mm: an edge ends there with nothing joining it${underlay.counts.SPLINE || underlay.counts.ELLIPSE || underlay.left.SPLINE ? ` (the drawing's splines and ellipses are shown as underlay only: a profile takes lines, arcs and circles)` : ''}`);
      const e = left.splice(k, 1)[0];
      chain.push(same(e.a, end) ? { ...e, a: end } : { a: end, b: e.a, ...(e.c ? { c: e.c, ccw: !e.ccw } : {}) });
    }
    chain[chain.length - 1] = { ...chain[chain.length - 1], b: chain[0].a };
    // (A loop of arcs about one centre at one radius is a circle — as a polyline of bulges writes one.)
    const c0 = chain[0].c, r0 = c0 ? Math.hypot(chain[0].a[0] - c0[0], chain[0].a[1] - c0[1]) : 0;
    const round = !!c0 && chain.every(e => e.c && same(e.c, c0) && Math.abs(Math.hypot(e.a[0] - c0[0], e.a[1] - c0[1]) - r0) <= tol && e.ccw === chain[0].ccw);
    loops.push({ edges: chain, ...(round ? { circle: { center: c0!, radius: r0 } } : {}) });
  }
  for (const c of circles) loops.push({ edges: [{ a: [c.c[0] + c.r, c.c[1]], b: [c.c[0] - c.r, c.c[1]], c: c.c, ccw: true }, { a: [c.c[0] - c.r, c.c[1]], b: [c.c[0] + c.r, c.c[1]], c: c.c, ccw: true }], circle: { center: c.c, radius: c.r } });
  const measured = loops.map(l => ({ ...l, ...areaOf(l.edges) }));
  // (Nesting: a loop inside another is its hole; inside a hole, refused.)
  const depthOf = (i: number) => measured.filter((o, j) => j !== i && Math.abs(o.area) > Math.abs(measured[i].area) && insideLoop(measured[i].edges[0].a, o.edges)).length;
  const regions: DxfLoop[] = [], holes: DxfLoop[] = [];
  measured.forEach((l, i) => {
    const d = depthOf(i), loop: DxfLoop = { segments: toSegments(l.edges), area: Math.abs(l.area), box: l.box, ...(l.circle ? { circle: l.circle } : {}) };
    if (d === 0) regions.push(loop); else if (d === 1) holes.push(loop);
    else throw new DxfReadError('DXF_NESTED', `a loop inside a hole (at (${l.box[0].toPrecision(6)}, ${l.box[1].toPrecision(6)}) mm): an island in a hole is a sketch of its own`);
  });
  regions.sort((a, b) => b.area - a.area);
  return { regions, holes, unit, ignored, entities, underlay };
}
