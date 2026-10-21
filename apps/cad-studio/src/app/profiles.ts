// Finished sketches as profiles the feature commands take (Extrude, Revolve, Pipe, Loft): which sketches no
// feature uses yet, the picked ones, where they lie (outlines in world space, to draw and pick), and the
// sketches of a loft brought onto its first section's plane (the kernel lofts sections of one plane).
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { parentsOf, type LoopSegment, type ModelNode, type SketchNode } from '../engine/doc';
import { toLocal, toWorld, xyPlane, type SketchPlane } from '@barocss/cad-model/sketch/plane';
import { loopOf } from '../sketch/loops';

type XY = [number, number];
const num = (v: unknown) => Number(v);

/** Sketch nodes no later node uses: the profiles waiting for a feature. */
export function unusedSketches(nodes: readonly ModelNode[]): number[] {
  const used = new Set(nodes.flatMap(parentsOf));
  return nodes.flatMap((n, i) => n.kind === 'sketch' && !used.has(i) ? [i] : []);
}
/** The sketches a profile command works on: the picked ones, else the newest unused one. */
export function pickedSketches(nodes: readonly ModelNode[], picked: readonly number[] | undefined): number[] {
  const free = unusedSketches(nodes);
  if (picked?.length) return picked.filter(i => nodes[i]?.kind === 'sketch');
  return free.length ? [free[free.length - 1]] : [];
}

export const planeOf = (n: SketchNode): SketchPlane => n.plane ? { origin: [...n.plane.origin] as Vec3, normal: [...n.plane.normal] as Vec3, xAxis: [...n.plane.xAxis] as Vec3 } : xyPlane();

/** A loop of line and arc segments as points in the plane (arcs sampled about every 6°). */
export function sampleLoop(loop: readonly LoopSegment[]): XY[] {
  const out: XY[] = [];
  loop.forEach((s, i) => {
    const a: XY = [num(s.start[0]), num(s.start[1])], next = loop[(i + 1) % loop.length], b: XY = [num(next.start[0]), num(next.start[1])];
    out.push(a);
    if (s.kind !== 'arc') return;
    const c: XY = [num(s.center[0]), num(s.center[1])], r = Math.hypot(a[0] - c[0], a[1] - c[1]), a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
    let sweep = Math.atan2(b[1] - c[1], b[0] - c[0]) - a0;
    if (s.direction === 'ccw') { while (sweep <= 1e-12) sweep += 2 * Math.PI; } else { while (sweep >= -1e-12) sweep -= 2 * Math.PI; }
    const n = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 30)));
    for (let k = 1; k < n; k++) out.push([c[0] + r * Math.cos(a0 + sweep * k / n), c[1] + r * Math.sin(a0 + sweep * k / n)]);
  });
  return out;
}
/** Every loop of a sketch (main, regions, holes) as closed world polylines. */
export function profileRings(n: SketchNode): Vec3[][] {
  const plane = planeOf(n);
  return [loopOf(n), ...(n.regions ?? []), ...(n.holes ?? [])].map(loop => sampleLoop(loop).map(p => toWorld(plane, p)));
}
/** The middle of a sketch's main loop (plane coordinates). */
export function profileMiddle(n: SketchNode): XY {
  const pts = sampleLoop(loopOf(n));
  return [pts.reduce((s, p) => s + p[0], 0) / (pts.length || 1), pts.reduce((s, p) => s + p[1], 0) / (pts.length || 1)];
}

/**
 * Loft sections: the picked sketches ordered along the first one's normal, each as a loop sketch on the
 * first one's plane (its points carried across) with its distance along the normal. Null with a reason
 * when they do not lie on parallel planes facing one way, or two share a height.
 */
export function loftSections(nodes: readonly ModelNode[], picked: readonly number[]): { plane: SketchPlane; sections: { node: SketchNode; z: number; source: number }[] } | { error: string } {
  if (picked.length < 2) return { error: 'Pick two or more sketches (Shift-click) to loft through.' };
  const sketches = picked.map(i => ({ i, n: nodes[i] as SketchNode })), base = planeOf(sketches[0].n);
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const out: { node: SketchNode; z: number; source: number }[] = [];
  for (const { i, n } of sketches) {
    if (n.regions?.length || n.holes?.length) return { error: `Sketch ${i + 1} has holes or several shapes: a loft section is one closed shape.` };
    const p = planeOf(n);
    if (dot(p.normal, base.normal) < 1 - 1e-9) return { error: `Sketch ${i + 1} is not on a plane parallel to the first section's (facing the same way).` };
    const z = dot([p.origin[0] - base.origin[0], p.origin[1] - base.origin[1], p.origin[2] - base.origin[2]], base.normal);
    const carry = (q: readonly unknown[]): [number, number] => { const l = toLocal(base, toWorld(p, [num(q[0]), num(q[1])])); return [Math.round(l[0] * 1e9) / 1e9, Math.round(l[1] * 1e9) / 1e9]; };
    const segments: LoopSegment[] = loopOf(n).map(s => s.kind === 'arc' ? { kind: 'arc', start: carry(s.start), center: carry(s.center), direction: s.direction } : { kind: 'line', start: carry(s.start) });
    out.push({ node: { kind: 'sketch', profile: 'loop', segments, ...(sketches[0].n.plane ? { plane: { origin: [...base.origin] as [number, number, number], normal: [...base.normal] as [number, number, number], xAxis: [...base.xAxis] as [number, number, number] } } : {}) }, z: Math.round(z * 1e9) / 1e9, source: i });
  }
  out.sort((a, b) => a.z - b.z);
  // Measured from the lowest section's plane (the first height 0).
  if (out[0].z !== 0 && out[0].source !== picked[0]) return loftSections(nodes, [out[0].source, ...picked.filter(i => i !== out[0].source)]);
  for (let k = 1; k < out.length; k++) if (!(out[k].z > out[k - 1].z + 1e-9)) return { error: 'Two sections lie at the same height: put each on its own offset plane.' };
  return { plane: base, sections: out };
}
