// A sketch's closed shapes as one profile: each shape a closed loop; loops inside another are holes, the
// rest are separate regions of material (the first drawn is the main profile).
import type { SketchShape } from './types';
import type { LoopSegment as DocSegment, SketchNode, SketchOutline } from '../engine/doc';
import { outlineSegments, sampleOutline, sampleSlot, slotSegments, type P2 } from './profile';
import { segmentDistance as segDist, insideRing as inside } from '../engine/geom2';
import { sideTagsFor, withIds } from './entityIds';
import { splineMatches } from './spline';

export function isConvex(points: [number, number][]) {
  let sign = 0; const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n], c = points[(i + 2) % n];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cr !== 0) { if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false; }
  }
  return true;
}

/** The sketch node of a closed shape (null while it is open or degenerate). */
export function shapeNode(s: SketchShape): SketchNode | null {
  if (s.kind === 'rectangle') return Math.abs(s.a[0] - s.b[0]) < 1 || Math.abs(s.a[1] - s.b[1]) < 1 ? null
    : { kind: 'sketch', profile: 'rectangle', min: [Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1])], max: [Math.max(s.a[0], s.b[0]), Math.max(s.a[1], s.b[1])] };
  if (s.kind === 'circle') return { kind: 'sketch', profile: 'circle', center: s.c, radius: s.r };
  if (s.kind === 'slot') return s.r > 0 && (s.a[0] !== s.b[0] || s.a[1] !== s.b[1]) ? { kind: 'sketch', profile: 'loop', segments: slotSegments(s.a, s.b, s.r) } : null;
  if (!s.closed || s.pending) return null;
  const rect = rectangleNode(s); if (rect) return rect;
  // Straight convex outlines keep the polygon path (all features); concave or curved ones become a line + arc loop.
  const node: SketchNode = !(s.bulges ?? []).some(Boolean) && s.points.length >= 3 && s.points.length <= 8 && isConvex(s.points)
    ? { kind: 'sketch', profile: 'polygon', points: s.points }
    : { kind: 'sketch', profile: 'loop', segments: outlineSegments(s.points as P2[], s.bulges) };
  const outline = outlineOf(s);
  return outline ? { ...node, outline } : node;
}

/**
 * A Rectangle-tool outline that is still exactly a rectangle (four straight edges kept horizontal and
 * vertical, nothing else but edge lengths, which its width and depth carry) is saved as a rectangle, so the
 * feature editor offers its width, depth and corner; null otherwise.
 */
export function rectangleNode(s: Extract<SketchShape, { kind: 'polygon' }>): SketchNode | null {
  if (!s.fromRectangle || s.points.length !== 4 || s.bulges?.some(Boolean)) return null;
  if ([s.radii, s.tangents, s.equalRadii, s.concentric, s.rules].some(v => v && (Array.isArray(v) ? v.length : Object.keys(v).length))) return null;
  const hv = s.hv, p = s.points, eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  if (!hv || hv.h.length + hv.v.length !== 4 || ![0, 1, 2, 3].every(i => hv.h.includes(i) || hv.v.includes(i))) return null;
  const aligned = hv.h.includes(0)
    ? eq(p[0][1], p[1][1]) && eq(p[1][0], p[2][0]) && eq(p[2][1], p[3][1]) && eq(p[3][0], p[0][0])
    : eq(p[0][0], p[1][0]) && eq(p[1][1], p[2][1]) && eq(p[2][0], p[3][0]) && eq(p[3][1], p[0][1]);
  if (!aligned) return null;
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  return { kind: 'sketch', profile: 'rectangle', min: [Math.min(...xs), Math.min(...ys)], max: [Math.max(...xs), Math.max(...ys)] };
}

/** A constrained outline as the sketch node keeps it (null when nothing constrains it and it is no spline); a spline's definition only while it still matches. */
export function outlineOf(s: Extract<SketchShape, { kind: 'polygon' }>): SketchOutline | null {
  const { points, bulges, lengths, radii, tangents, equalRadii, concentric, hv, rules, circles } = s;
  const has = (v: unknown) => Array.isArray(v) ? v.length > 0 : !!v && Object.keys(v).length > 0;
  const spline = s.spline && splineMatches(s) ? s.spline : undefined;
  if (!spline && ![lengths, radii, tangents, equalRadii, concentric, rules, circles].some(has) && !(hv && (hv.h.length || hv.v.length))) return null;
  const out: SketchOutline = { points: points.map(p => [p[0], p[1]] as [number, number]) };
  if (bulges?.some(Boolean)) out.bulges = [...bulges];
  if (has(lengths)) out.lengths = { ...lengths }; if (has(radii)) out.radii = { ...radii }; if (has(tangents)) out.tangents = [...tangents!];
  if (has(equalRadii)) out.equalRadii = equalRadii!.map(p => [...p] as [number, number]); if (has(concentric)) out.concentric = concentric!.map(p => [...p] as [number, number]);
  if (hv) out.hv = { h: [...hv.h], v: [...hv.v] }; if (has(rules)) out.rules = rules!.map(r => ({ ...r }));
  if (has(circles)) out.circles = circles!.map(c => ({ c: [c.c[0], c.c[1]], r: c.r }));
  if (spline) out.spline = { fit: spline.fit.map(p => [p[0], p[1]] as [number, number]), closed: spline.closed, ...(spline.handles ? { handles: [...spline.handles] } : {}) };
  return out;
}

/** Whether two closed rings (sampled outlines) cross: a segment of one properly intersects a segment of the other. */
export function ringsCross(a: P2[], b: P2[]): boolean {
  const side = (p: P2, q: P2, r: P2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  for (let i = 0; i < a.length; i++) {
    const p = a[i], q = a[(i + 1) % a.length];
    const lo = [Math.min(p[0], q[0]), Math.min(p[1], q[1])], hi = [Math.max(p[0], q[0]), Math.max(p[1], q[1])];
    for (let j = 0; j < b.length; j++) {
      const r = b[j], t = b[(j + 1) % b.length];
      if (Math.max(r[0], t[0]) < lo[0] || Math.min(r[0], t[0]) > hi[0] || Math.max(r[1], t[1]) < lo[1] || Math.min(r[1], t[1]) > hi[1]) continue;
      const d1 = side(p, q, r), d2 = side(p, q, t), d3 = side(r, t, p), d4 = side(r, t, q);
      if (((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))) return true;
    }
  }
  return false;
}

/** The distance from a point to a closed ring's boundary. */
export const ringDistance = (p: P2, ring: P2[]) => ring.reduce((d, a, i) => Math.min(d, segDist(p, a, ring[(i + 1) % ring.length])), Infinity);

/**
 * Whether two closed rings overlap: their edges cross, or one has corners clearly inside and clearly
 * outside the other (a corner landing exactly on the other's edge is not a proper crossing, so the
 * crossing test alone misses it). Rings that only touch, or nest, do not overlap.
 */
export function ringsOverlap(a: P2[], b: P2[]): boolean {
  if (ringsCross(a, b)) return true;
  const mixed = (ring: P2[], of: P2[]) => {
    let sides = 0;
    for (const p of of) if (ringDistance(p, ring) > 1e-6) { sides |= inside(p, ring) ? 1 : 2; if (sides === 3) return true; }
    return false;
  };
  return mixed(a, b) || mixed(b, a);
}

/** Where an attached circle lies against its outline: inside it, outside it, or across its edge. */
export function circleRelation(s: Extract<SketchShape, { kind: 'polygon' }>, c: { c: [number, number]; r: number }): 'inside' | 'outside' | 'crossing' {
  const ring = shapeOutline(s);
  if (ringDistance(c.c, ring) < c.r - 1e-6) return 'crossing';
  return inside(c.c, ring) ? 'inside' : 'outside';
}

/** A closed shape's outline, sampled (for drawing and for telling holes from regions). */
export function shapeOutline(s: SketchShape): P2[] {
  if (s.kind === 'rectangle') return [s.a, [s.b[0], s.a[1]], s.b, [s.a[0], s.b[1]]];
  if (s.kind === 'circle') return Array.from({ length: 48 }, (_, i) => [s.c[0] + s.r * Math.cos(i * Math.PI / 24), s.c[1] + s.r * Math.sin(i * Math.PI / 24)] as P2);
  if (s.kind === 'slot') return sampleSlot(s.a, s.b, s.r);
  return sampleOutline(s.points as P2[], s.bulges, true);
}

/** A sketch node's outline as line and arc segments (a circle: one full arc). */
export function loopOf(n: SketchNode): DocSegment[] {
  const num = (p: readonly unknown[]) => [Number(p[0]), Number(p[1])] as [number, number];
  switch (n.profile) {
    case 'rectangle': { const a = num(n.min), b = num(n.max); return [a, [b[0], a[1]], b, [a[0], b[1]]].map(start => ({ kind: 'line', start: start as [number, number] })); }
    case 'circle': { const c = num(n.center), r = Number(n.radius); return [{ kind: 'arc', start: [c[0] + r, c[1]], center: c, direction: 'ccw' }]; }
    case 'polygon': return n.points.map(p => ({ kind: 'line', start: num(p) }));
    case 'loop': return n.segments;
  }
}


/**
 * One sketch node of the closed shapes: a shape inside another is a hole of it, the others are regions;
 * the first region is the main profile. A shape inside a hole (an island) is refused for now.
 */
export function profileOf(all: SketchShape[]): { node: SketchNode } | { error: string } {
  // (Construction shapes are references: they make no part of the profile. Every side has its id, R10a.)
  let shapes = withIds(all).filter(s => !s.construction);
  // An outline's attached circles are shapes of the profile beside it (holes inside it, regions outside).
  shapes = shapes.flatMap(s => s.kind === 'polygon' && s.closed && s.circles?.length ? [s, ...s.circles.map((c, i): SketchShape => ({ kind: 'circle', c: c.c, r: c.r, ...(s.circleIds?.[i] ? { ids: [s.circleIds[i]] } : {}) }))] : [s]);
  const closed = shapes.map(s => ({ s, node: shapeNode(s) })).filter((x): x is { s: SketchShape; node: SketchNode } => !!x.node);
  if (!closed.length) return { error: 'Draw a closed rectangle, circle, slot or outline on the sketch plane.' };
  if (closed.length === 1) return { node: tagged(closed[0].node, closed[0].s, [], []) };
  const rings = closed.map(x => shapeOutline(x.s));
  // Overlapping shapes would silently become a cut or a bump depending on where each starts: refuse them.
  for (let i = 0; i < rings.length; i++) for (let j = i + 1; j < rings.length; j++)
    if (ringsOverlap(rings[i], rings[j])) return { error: `Shapes ${i + 1} and ${j + 1} overlap: draw them as one outline, or put one in its own sketch.` };
  // (Tested at a point of the ring off the other's boundary: a hole touching the outline's edge from inside
  // has its first sample on that edge.)
  const within = (ring: P2[], other: P2[]) => inside(ring.find(p => ringDistance(p, other) > 1e-6) ?? ring[0], other);
  const depth = rings.map((ring, i) => rings.filter((other, j) => j !== i && within(ring, other)).length);
  if (depth.some(d => d > 1)) return { error: 'A shape inside a hole is not supported yet: draw it as its own sketch.' };
  const outers = closed.filter((_, i) => depth[i] === 0), holes = closed.filter((_, i) => depth[i] === 1);
  if (!outers.length) return { error: 'Every shape lies inside another: draw the outer shape so it encloses the others.' };
  const [main, ...rest] = outers;
  const node = { ...main.node, ...(rest.length ? { regions: rest.map(x => loopOf(x.node)) } : {}), ...(holes.length ? { holes: holes.map(x => loopOf(x.node)) } : {}) } as SketchNode;
  return { node: tagged(node, main.s, rest.map(x => x.s), holes.map(x => x.s)) };
}
/** The node with its sides' tags (R10a, D86), from the shapes that make it. */
function tagged(node: SketchNode, main: SketchShape, regions: SketchShape[], holes: SketchShape[]): SketchNode {
  const tags = sideTagsFor(node, main, regions, holes, loopOf);
  return tags ? { ...node, sideTags: tags } : node;
}
