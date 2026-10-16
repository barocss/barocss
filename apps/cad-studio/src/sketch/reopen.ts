// A finished sketch node back as sketcher shapes, to edit it in place: the main profile as the current
// shape (its kept outline with all constraints when it has one), more regions and holes beside it.
import type { LoopSegment, SketchNode, SketchOutline } from '../engine/doc';
import type { SketchShape } from '../viewport/Viewport';
import type { P2 } from './profile';
import type { Polygon } from './rules';

const pt = (p: readonly unknown[]): P2 => [Number(p[0]), Number(p[1])];

/** A kept outline as the sketcher's closed polygon. */
export const outlinePolygon = (o: SketchOutline): Polygon => ({
  kind: 'polygon', closed: true, points: o.points.map(p => [p[0], p[1]] as [number, number]), bulges: o.bulges ? [...o.bulges] : o.points.map(() => 0),
  ...(o.lengths ? { lengths: o.lengths } : {}), ...(o.radii ? { radii: o.radii } : {}), ...(o.tangents ? { tangents: o.tangents } : {}),
  ...(o.equalRadii ? { equalRadii: o.equalRadii } : {}), ...(o.concentric ? { concentric: o.concentric } : {}), ...(o.hv ? { hv: o.hv } : {}), ...(o.rules ? { rules: o.rules } : {}),
  ...(o.circles ? { circles: o.circles.map(c => ({ c: [c.c[0], c.c[1]] as [number, number], r: c.r })) } : {}),
});


/** A line + arc loop as a closed outline (bulges from each arc's centre and turning direction); one full arc is a circle. */
export function loopShape(segments: readonly LoopSegment[]): SketchShape | null {
  if (!segments.length) return null;
  if (segments.length === 1) {
    const s = segments[0]; if (s.kind !== 'arc') return null;
    const c = pt(s.center), a = pt(s.start);
    return { kind: 'circle', c, r: Math.hypot(a[0] - c[0], a[1] - c[1]) };
  }
  const points = segments.map(s => pt(s.start)), n = points.length;
  const bulges = segments.map((s, i) => {
    if (s.kind !== 'arc') return 0;
    const c = pt(s.center), a = points[i], b = points[(i + 1) % n];
    const u = [a[0] - c[0], a[1] - c[1]], w = [b[0] - c[0], b[1] - c[1]];
    let sweep = Math.atan2(u[0] * w[1] - u[1] * w[0], u[0] * w[0] + u[1] * w[1]);
    if (s.direction === 'ccw' && sweep <= 0) sweep += 2 * Math.PI;
    if (s.direction === 'cw' && sweep >= 0) sweep -= 2 * Math.PI;
    return Math.tan(sweep / 4);
  });
  return { kind: 'polygon', points, closed: true, bulges };
}

/** The node's main profile as a shape. */
export function mainShape(node: SketchNode): SketchShape | null {
  if (node.outline) return outlinePolygon(node.outline);
  switch (node.profile) {
    case 'rectangle': return { kind: 'rectangle', a: pt(node.min), b: pt(node.max) };
    case 'circle': return { kind: 'circle', c: pt(node.center), r: Number(node.radius) };
    case 'polygon': return { kind: 'polygon', points: node.points.map(pt), closed: true, bulges: node.points.map(() => 0) };
    case 'loop': return loopShape(node.segments);
  }
}

/** The shapes of a sketch node: the main profile, then its other regions and holes. */
export function sketchShapes(node: SketchNode): { shape: SketchShape | null; done: SketchShape[] } {
  // Circles the outline keeps come back on it, not beside it.
  const attached = node.outline?.circles ?? [], same = (s: SketchShape) => s.kind === 'circle' && attached.some(c => Math.hypot(c.c[0] - s.c[0], c.c[1] - s.c[1]) < 1e-6 && Math.abs(c.r - s.r) < 1e-6);
  const done = [...(node.regions ?? []), ...(node.holes ?? [])].map(loopShape).filter((s): s is SketchShape => !!s && !same(s));
  return { shape: mainShape(node), done };
}
