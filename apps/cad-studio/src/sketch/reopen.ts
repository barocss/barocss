// A finished sketch node back as sketcher shapes, to edit it in place: the main profile as the current
// shape (its kept outline with all constraints when it has one), more regions and holes beside it.
import type { LoopSegment, SketchNode } from '../engine/doc';
import type { SketchShape } from '../viewport/Viewport';
import type { P2 } from './profile';
import { outlinePolygon } from './outlineFields';

const pt = (p: readonly unknown[]): P2 => [Number(p[0]), Number(p[1])];

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
  const done = [...(node.regions ?? []), ...(node.holes ?? [])].map(loopShape).filter((s): s is SketchShape => !!s);
  return { shape: mainShape(node), done };
}
