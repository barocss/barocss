// A sketch's closed shapes as one profile: each shape a closed loop; loops inside another are holes, the
// rest are separate regions of material (the first drawn is the main profile).
import type { SketchShape } from '../viewport/Viewport';
import type { LoopSegment as DocSegment, SketchNode } from '../engine/doc';
import { outlineSegments, sampleOutline, sampleSlot, slotSegments, type P2 } from './profile';

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
  // Straight convex outlines keep the polygon path (all features); concave or curved ones become a line + arc loop.
  return !(s.bulges ?? []).some(Boolean) && s.points.length >= 3 && s.points.length <= 8 && isConvex(s.points)
    ? { kind: 'sketch', profile: 'polygon', points: s.points }
    : { kind: 'sketch', profile: 'loop', segments: outlineSegments(s.points as P2[], s.bulges) };
}

/** A closed shape's outline, sampled (for drawing and for telling holes from regions). */
export function shapeOutline(s: SketchShape): P2[] {
  if (s.kind === 'rectangle') return [s.a, [s.b[0], s.a[1]], s.b, [s.a[0], s.b[1]]];
  if (s.kind === 'circle') return Array.from({ length: 48 }, (_, i) => [s.c[0] + s.r * Math.cos(i * Math.PI / 24), s.c[1] + s.r * Math.sin(i * Math.PI / 24)] as P2);
  if (s.kind === 'slot') return sampleSlot(s.a, s.b, s.r);
  return sampleOutline(s.points as P2[], s.bulges, true);
}

/** A sketch node's outline as line and arc segments (a circle: one full arc). */
function loopOf(n: SketchNode): DocSegment[] {
  const num = (p: readonly unknown[]) => [Number(p[0]), Number(p[1])] as [number, number];
  switch (n.profile) {
    case 'rectangle': { const a = num(n.min), b = num(n.max); return [a, [b[0], a[1]], b, [a[0], b[1]]].map(start => ({ kind: 'line', start: start as [number, number] })); }
    case 'circle': { const c = num(n.center), r = Number(n.radius); return [{ kind: 'arc', start: [c[0] + r, c[1]], center: c, direction: 'ccw' }]; }
    case 'polygon': return n.points.map(p => ({ kind: 'line', start: num(p) }));
    case 'loop': return n.segments;
  }
}

const inside = (p: P2, ring: P2[]) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};

/**
 * One sketch node of the closed shapes: a shape inside another is a hole of it, the others are regions;
 * the first region is the main profile. A shape inside a hole (an island) is refused for now.
 */
export function profileOf(shapes: SketchShape[]): { node: SketchNode } | { error: string } {
  const closed = shapes.map(s => ({ s, node: shapeNode(s) })).filter((x): x is { s: SketchShape; node: SketchNode } => !!x.node);
  if (!closed.length) return { error: 'Draw a closed rectangle, circle, slot or outline on the sketch plane.' };
  if (closed.length === 1) return { node: closed[0].node };
  const rings = closed.map(x => shapeOutline(x.s));
  const depth = rings.map((ring, i) => rings.filter((other, j) => j !== i && inside(ring[0], other)).length);
  if (depth.some(d => d > 1)) return { error: 'A shape inside a hole is not supported yet: draw it as its own sketch.' };
  const outers = closed.filter((_, i) => depth[i] === 0), holes = closed.filter((_, i) => depth[i] === 1);
  const [main, ...rest] = outers;
  return { node: { ...main.node, ...(rest.length ? { regions: rest.map(x => loopOf(x.node)) } : {}), ...(holes.length ? { holes: holes.map(x => loopOf(x.node)) } : {}) } as SketchNode };
}
