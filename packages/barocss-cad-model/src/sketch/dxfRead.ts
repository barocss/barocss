// A DXF drawing read as a sketch draft (A6.4, O28): our own reader of the 2D geometry a profile needs — LINE, ARC,
// CIRCLE, LWPOLYLINE (bulges as arcs) and POLYLINE/VERTEX (what AC1009 files, ours included, write) — in the file's
// unit ($INSUNITS) scaled to mm. Edges join within 1e-6 mm of one another. The largest loop and the loops beside it
// are the regions, a loop inside one a hole. Splines, ellipses, blocks
// and text are the underlay's (dxfUnderlay.ts, O68): shown to trace over, never regions. Dimensions, hatches and points
// are annotation: left out, and listed. Other geometry (3D entities) is refused, typed, as are an edge left open, a loop
// inside a hole and a file that is not DXF.
// What it gives is a draft: its dimensions read from the drawing are the user's to confirm (drafts.ts).
import { CadNumericPolicy } from '@barocss/cad';
import type { LoopSegment } from '../engine/doc';
import { dxfBulge } from './dxfBulge';
import { readUnderlay, UNDERLAY_TOP, type Underlay } from './dxfUnderlay';
import { createDxfVisibility } from './dxfVisibility';
import { MM_PER_FOOT, MM_PER_INCH } from '../util/units';
import { refusal, type BarocssError } from '../engine/refusal';

export type DxfReadCode = 'DXF_MALFORMED' | 'DXF_UNSUPPORTED' | 'DXF_OPEN' | 'DXF_NESTED' | 'DXF_EMPTY' | 'DWG_NOT_READ';
/** The codes a DXF read refuses with (a caller that turns them into its own answer). */
export const DXF_READ_CODES: readonly DxfReadCode[] = ['DXF_MALFORMED', 'DXF_UNSUPPORTED', 'DXF_OPEN', 'DXF_NESTED', 'DXF_EMPTY', 'DWG_NOT_READ'];
/** AutoCAD's DWG version tags (the file's first six bytes) and their releases. */
const DWG_RELEASES: Record<string, string> = { AC1009: 'R11/R12', AC1012: 'R13', AC1014: 'R14', AC1015: '2000', AC1018: '2004', AC1021: '2007', AC1024: '2010', AC1027: '2013', AC1032: '2018' };
/** The release of a DWG file from its first bytes (`AC10xx`), or null when it is not one. */
export function dwgRelease(head: string): string | null {
  const m = /^AC10\d\d/.exec(head); return m ? DWG_RELEASES[m[0]] ?? `version ${m[0]}` : null;
}
/** What to do with a DWG (O61: DWG is not read; every producer saves DXF). */
export const DWG_ROUTES = 'Save it as DXF from the program that made it (AutoCAD and its family: Save As → DXF), or convert it with the free ODA File Converter (DWG to DXF, one file or a folder at once), then add the DXF.';
/** The refusal for a DWG file, typed (O61). */
export function dwgRefusal(head: string): BarocssError | null {
  const r = dwgRelease(head); return r ? refusal('DWG_NOT_READ', `this is a DWG file (AutoCAD ${r}), and the studio reads DXF, not DWG. ${DWG_ROUTES}`) : null;
}
type P = [number, number];
/** An edge: a line, or an arc from a to b about c, counter-clockwise when ccw. */
type Edge = { a: P; b: P } & ({ c?: undefined; bulged?: undefined } | { c: P; r: number; ccw: boolean; bulged?: true });
export interface DxfLoop { segments: LoopSegment[]; area: number; box: [number, number, number, number]; circle?: { center: P; radius: number } }
export interface DxfSketch {
  /** The regions (each a closed loop) and the holes (each inside a region), in mm. */
  regions: DxfLoop[]; holes: DxfLoop[];
  unit: { declared: boolean; name: string; to: number };
  /** Entities left out as annotation, counted by type. */
  ignored: Record<string, number>;
  /** What the drawing shows beyond its profile, to trace over (O68): never regions, holes or dimensions. */
  underlay: Underlay;
  entities: number;
}

const UNITS: Record<number, [string, number]> = { 1: ['inches', MM_PER_INCH], 2: ['feet', MM_PER_FOOT], 4: ['millimetres', 1], 5: ['centimetres', 10], 6: ['metres', 1000] };
// (TEXT and MTEXT are shown in the underlay, O68; the rest of the annotation is left out and listed.)
const ANNOTATION = new Set(['DIMENSION', 'HATCH', 'POINT', 'LEADER', 'MLEADER', 'ATTDEF', 'ATTRIB', 'VIEWPORT', 'SOLID', 'WIPEOUT', 'IMAGE']);
const GEOMETRY = new Set(['LINE', 'ARC', 'CIRCLE', 'LWPOLYLINE', 'POLYLINE']);
const PROFILE_PLANE_TOLERANCE = 1e-9;
const DXF_REAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

function requireProfilePlane(type: string, groups: readonly [number, string][]): void {
  const additionalZ = type === 'LINE' ? 31 : type === 'LWPOLYLINE' ? 38 : null;
  for (const [group, raw] of groups) {
    if (group !== 30 && group !== 230 && group !== additionalZ) continue;
    const value = DXF_REAL.test(raw) ? Number(raw) : NaN;
    if (!Number.isFinite(value)) throw refusal('DXF_MALFORMED', `${type} group ${group} needs a finite DXF real value`);
    const expected = group === 230 ? 1 : 0;
    if (Math.abs(value - expected) > PROFILE_PLANE_TOLERANCE) {
      throw refusal('DXF_UNSUPPORTED', `a ${type} off the XY plane (group ${group} is ${value}, expected ${expected})`);
    }
  }
}

/** The file as (code, value) pairs. */
export function pairsOf(text: string): [number, string][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (lines.length % 2) throw refusal('DXF_MALFORMED', 'an odd number of lines: a group code without its value');
  const out: [number, string][] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (!Number.isInteger(code)) throw refusal('DXF_MALFORMED', `line ${i + 1}: "${lines[i].trim().slice(0, 20)}" is not a group code`);
    out.push([code, lines[i + 1].trim()]);
  }
  return out;
}
const num = (v: string, what: string): number => { const x = Number(v); if (!Number.isFinite(x)) throw refusal('DXF_MALFORMED', `${what}: "${v.slice(0, 20)}" is not a number`); return x; };
function bulgeEdge(a: P, b: P, bulge: number, type: string): Edge {
  const arc = dxfBulge(a, b, bulge, type);
  return arc ? { a, b, c: arc.center, r: arc.radius, ccw: arc.sweep > 0, bulged: true } : { a, b };
}
const arcPoint = (c: P, r: number, deg: number): P => [c[0] + r * Math.cos(deg * Math.PI / 180), c[1] + r * Math.sin(deg * Math.PI / 180)];

/** The edges of the ENTITIES section, the unit, the left-out entities. */
function readEntities(pairs: [number, string][]): { edges: Edge[]; circles: { c: P; r: number }[]; unit: DxfSketch['unit']; ignored: Record<string, number>; entities: number } {
  let units = 0, declared = false;
  for (let i = 0; i + 1 < pairs.length; i++) if (pairs[i][0] === 9 && pairs[i][1] === '$INSUNITS' && pairs[i + 1][0] === 70) { units = num(pairs[i + 1][1], '$INSUNITS'); declared = true; }
  const u = UNITS[units];
  if (declared && units !== 0 && !u) throw refusal('DXF_UNSUPPORTED', `$INSUNITS ${units}: only inches, feet, millimetres, centimetres and metres are read`);
  const unit = { declared: declared && units !== 0, name: u ? u[0] : 'millimetres (none declared)', to: u ? u[1] : 1 };
  const start = pairs.findIndex((p, i) => p[0] === 2 && p[1] === 'ENTITIES' && pairs[i - 1]?.[0] === 0 && pairs[i - 1]?.[1] === 'SECTION');
  if (start < 0) throw refusal('DXF_MALFORMED', 'no ENTITIES section: not a DXF drawing');
  const visibility = createDxfVisibility(pairs);
  const edges: Edge[] = [], circles: { c: P; r: number }[] = [], ignored: Record<string, number> = {};
  let i = start + 1, entities = 0;
  const k = unit.to;
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
    if (!GEOMETRY.has(type)) throw refusal('DXF_UNSUPPORTED', `a ${type} entity: the drawing reader takes LINE, ARC, CIRCLE, LWPOLYLINE and POLYLINE as the profile, and SPLINE, ELLIPSE, INSERT, TEXT and MTEXT as an underlay to trace over`);
    if (visibility.entity(type, body) === null) continue;
    const g = (code: number, d?: number) => { const v = body.find(p => p[0] === code); if (!v) { if (d !== undefined) return d; throw refusal('DXF_MALFORMED', `a ${type} without its group ${code}`); } return num(v[1], `${type} group ${code}`); };
    requireProfilePlane(type, body);
    if (type === 'LINE') edges.push({ a: [g(10) * k, g(20) * k], b: [g(11) * k, g(21) * k] });
    else if (type === 'CIRCLE') circles.push({ c: [g(10) * k, g(20) * k], r: g(40) * k });
    else if (type === 'ARC') { const c: P = [g(10) * k, g(20) * k], r = g(40) * k; edges.push({ a: arcPoint(c, r, g(50)), b: arcPoint(c, r, g(51)), c, r, ccw: true }); }
    else if (type === 'LWPOLYLINE') {
      const closed = (g(70, 0) & 1) === 1, pts: P[] = [], bulges: number[] = [];
      for (const [code, v] of body) { if (code === 10) { pts.push([num(v, 'LWPOLYLINE x') * k, 0]); bulges.push(0); } else if (code === 20 && pts.length) pts[pts.length - 1][1] = num(v, 'LWPOLYLINE y') * k; else if (code === 42 && pts.length) bulges[bulges.length - 1] = num(v, 'LWPOLYLINE bulge'); }
      if (pts.length < 2) throw refusal('DXF_MALFORMED', 'an LWPOLYLINE of fewer than two vertices');
      for (let j = 0; j + 1 < pts.length; j++) edges.push(bulgeEdge(pts[j], pts[j + 1], bulges[j], type));
      if (closed) edges.push(bulgeEdge(pts[pts.length - 1], pts[0], bulges[pts.length - 1], type));
    } else {
      // POLYLINE: its VERTEX entities follow, up to SEQEND.
      const closed = (g(70, 0) & 1) === 1, pts: P[] = [], bulges: number[] = [];
      if ((g(70, 0) & (8 | 16 | 64)) !== 0) throw refusal('DXF_UNSUPPORTED', 'a 3D polyline or polygon mesh: the drawing reader is 2D');
      while (i < pairs.length && pairs[i][0] === 0 && pairs[i][1] === 'VERTEX') {
        i++; const v: [number, string][] = [];
        while (i < pairs.length && pairs[i][0] !== 0) v.push(pairs[i++]);
        const x = v.find(p => p[0] === 10), y = v.find(p => p[0] === 20), b = v.find(p => p[0] === 42);
        if (!x || !y) throw refusal('DXF_MALFORMED', 'a VERTEX without its position');
        pts.push([num(x[1], 'VERTEX x') * k, num(y[1], 'VERTEX y') * k]); bulges.push(b ? num(b[1], 'VERTEX bulge') : 0);
      }
      if (pts.length < 2) throw refusal('DXF_MALFORMED', 'a POLYLINE of fewer than two vertices');
      for (let j = 0; j + 1 < pts.length; j++) edges.push(bulgeEdge(pts[j], pts[j + 1], bulges[j], type));
      if (closed) edges.push(bulgeEdge(pts[pts.length - 1], pts[0], bulges[pts.length - 1], type));
    }
  }
  visibility.finish();
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

// The old minimum connection allowance also matches the draft's stored coordinate resolution.
const ENDPOINT_GAP_MM = 1e-6;
function withinDistance(a: P, b: P, tolerance: number): boolean {
  const dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]);
  return dx <= tolerance && dy <= tolerance && Math.hypot(dx, dy) <= tolerance;
}

/** Recognize a full loop of arcs using their original centres and radii, before endpoint snapping. */
function circleOf(chain: readonly Edge[]): DxfLoop['circle'] {
  const first = chain[0];
  if (!first.c || !(first.r > 0)) return;
  for (const edge of chain) {
    if (!edge.c || edge.ccw !== first.ccw) return;
    const tol = Math.max(CadNumericPolicy.linearTolerance, CadNumericPolicy.relativeLinearTolerance * Math.min(first.r, edge.r));
    if (!withinDistance(edge.c, first.c, tol) || !(Math.abs(edge.r - first.r) <= tol)) return;
  }
  return { center: first.c, radius: first.r };
}

/** A DXF drawing's profile: its regions and holes, in mm. */
export function readDxfSketch(text: string): DxfSketch {
  const dwg = dwgRefusal(text.slice(0, 6)); if (dwg) throw dwg;
  const { edges, circles, unit, ignored, entities } = readEntities(pairsOf(text)), underlay = readUnderlay(text, unit.to);
  // (An underlay alone needs a curve to trace: text by itself is still nothing to read.)
  const shown = underlay.polylines.length;
  if (!edges.length && !circles.length) {
    // (Nothing for a profile: an underlay alone to trace over, when there is one.)
    if (shown) return { regions: [], holes: [], unit, ignored, entities, underlay };
    throw refusal('DXF_EMPTY', `no profile geometry (${entities} entities${Object.keys(ignored).length ? `, left out: ${Object.entries(ignored).map(([t, n]) => `${n} ${t}`).join(', ')}` : ''})`);
  }
  const sameEndpoint = (p: P, q: P) => withinDistance(p, q, ENDPOINT_GAP_MM);
  // (Chained end to start; an edge may be walked backwards — a reversed arc turns the other way.)
  const left = edges.slice(), loops: { edges: Edge[]; circle?: { center: P; radius: number } }[] = [];
  while (left.length) {
    const chain = [left.shift()!];
    for (;;) {
      const end = chain[chain.length - 1].b;
      const closes = sameEndpoint(end, chain[0].a);
      let next = -1, reverse = false;
      for (const [i, edge] of left.entries()) {
        const startsHere = sameEndpoint(end, edge.a), endsHere = sameEndpoint(end, edge.b);
        if (!startsHere && !endsHere) continue;
        if (closes || next >= 0 || (startsHere && endsHere)) {
          throw refusal('DXF_OPEN', `the profile has ambiguous connections at (${end[0].toPrecision(6)}, ${end[1].toPrecision(6)}) mm: more than one endpoint could join there`);
        }
        next = i;
        reverse = endsHere;
      }
      if (closes) break;
      if (next < 0) throw refusal('DXF_OPEN', `the profile is not closed at (${end[0].toPrecision(6)}, ${end[1].toPrecision(6)}) mm: an edge ends there with nothing joining it${underlay.counts.SPLINE || underlay.counts.ELLIPSE || underlay.left.SPLINE ? ` (the drawing's splines and ellipses are shown as underlay only: a profile takes lines, arcs and circles)` : ''}`);
      const edge = left.splice(next, 1)[0];
      chain.push(!reverse ? { ...edge, a: end } : edge.c
        ? { ...edge, a: end, b: edge.a, ccw: !edge.ccw }
        : { a: end, b: edge.a });
    }
    chain[chain.length - 1] = { ...chain[chain.length - 1], b: chain[0].a };
    // (A loop of arcs about one centre at one radius is a circle — as a polyline of bulges writes one.)
    const circle = circleOf(chain);
    loops.push({ edges: chain, ...(circle ? { circle } : {}) });
  }
  for (const { c, r } of circles) loops.push({ edges: [{ a: [c[0] + r, c[1]], b: [c[0] - r, c[1]], c, r, ccw: true }, { a: [c[0] - r, c[1]], b: [c[0] + r, c[1]], c, r, ccw: true }], circle: { center: c, radius: r } });
  const measured = loops.map(loop => {
    const measure = areaOf(loop.edges);
    if (loop.edges.some(edge => edge.bulged) && (!Number.isFinite(measure.area) || !measure.box.every(Number.isFinite))) {
      throw refusal('DXF_MALFORMED', 'a profile with a DXF bulge has nonfinite area or bounds');
    }
    return { ...loop, ...measure };
  });
  // (Nesting: a loop inside another is its hole; inside a hole, refused.)
  const depthOf = (i: number) => measured.filter((o, j) => j !== i && Math.abs(o.area) > Math.abs(measured[i].area) && insideLoop(measured[i].edges[0].a, o.edges)).length;
  const regions: DxfLoop[] = [], holes: DxfLoop[] = [];
  measured.forEach((l, i) => {
    const d = depthOf(i), loop: DxfLoop = { segments: toSegments(l.edges), area: Math.abs(l.area), box: l.box, ...(l.circle ? { circle: l.circle } : {}) };
    if (d === 0) regions.push(loop); else if (d === 1) holes.push(loop);
    else throw refusal('DXF_NESTED', `a loop inside a hole (at (${l.box[0].toPrecision(6)}, ${l.box[1].toPrecision(6)}) mm): an island in a hole is a sketch of its own`);
  });
  regions.sort((a, b) => b.area - a.area);
  return { regions, holes, unit, ignored, entities, underlay };
}
