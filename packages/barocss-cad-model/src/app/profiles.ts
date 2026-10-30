// Finished sketches as profiles the feature commands take (Extrude, Revolve, Pipe, Loft): which sketches no
// feature uses yet, the picked ones, where they lie (outlines in world space, to draw and pick), and the
// sketches of a loft brought onto its first section's plane (the kernel lofts sections of one plane).
import type { LoftSectionFrame } from '@barocss/cad';
import type { Vec3 } from '../engine/mesh';
import { NODE_EXTRA_FIELDS, parentsOf, type LoopSegment, type ModelNode, type SketchNode } from '../engine/doc';
import { toLocal, toWorld, xyPlane, yAxisOf, type SketchPlane } from '../sketch/plane';
import { loopOf } from '../sketch/loops';
import { resolveSketchDims } from '../sketch/reopen';
import { isRefusal, refusal } from '../engine/refusal';

type XY = [number, number];
const num = (v: unknown) => Number(v);
type Params = Readonly<Record<string, number>>;
// A stored sketch with its `{ parameter }` sizes as numbers now; refuses a missing or non-finite parameter (as reopen does).
// With the sketch's index, a refusal names that sketch ("Sketch 2 uses parameter W, …").
const valued = (n: SketchNode, params: Params, index?: number): SketchNode => {
  try { return resolveSketchDims(n, params); } catch (e) {
    if (index === undefined || !isRefusal(e, 'PARAMETER_UNKNOWN')) throw e;
    throw refusal('PARAMETER_UNKNOWN', e.message.replace(/^\[\w+\] the sketch/, `Sketch ${index + 1}`));
  }
};

// Adds the name of every `{ parameter }` value inside v to names.
function collectParameters(v: unknown, names: Set<string>): void {
  if (Array.isArray(v)) { for (const x of v) collectParameters(x, names); return; }
  if (!v || typeof v !== 'object') return;
  if (Object.keys(v).length === 1 && typeof (v as { parameter?: unknown }).parameter === 'string') { names.add((v as { parameter: string }).parameter); return; }
  for (const x of Object.values(v)) collectParameters(x, names);
}

/** The parameters picked sketches are bound to, once each by name, with their values now (a bound size that cannot be read is left out). */
export function boundParameters(nodes: readonly ModelNode[], picked: readonly number[], params: Params = {}): [string, number][] {
  const names = new Set<string>();
  for (const i of picked) if (nodes[i]?.kind === 'sketch') collectParameters(nodes[i], names);
  return [...names].sort().flatMap(name => Object.hasOwn(params, name) && Number.isFinite(params[name]) ? [[name, params[name]] as [string, number]] : []);
}

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
/** Every loop of a sketch (main, regions, holes) as closed world polylines (parameter-bound sizes at the document's values; refuses a missing parameter). */
export function profileRings(stored: SketchNode, params: Params = {}): Vec3[][] {
  const n = valued(stored, params), plane = planeOf(n);
  return [loopOf(n), ...(n.regions ?? []), ...(n.holes ?? [])].map(loop => sampleLoop(loop).map(p => toWorld(plane, p)));
}
/** The middle of a sketch's main loop (plane coordinates; parameter-bound sizes at the document's values; refuses a missing parameter). */
export function profileMiddle(stored: SketchNode, params: Params = {}): XY {
  const pts = sampleLoop(loopOf(valued(stored, params)));
  return [pts.reduce((s, p) => s + p[0], 0) / (pts.length || 1), pts.reduce((s, p) => s + p[1], 0) / (pts.length || 1)];
}

/**
 * Loft sections: the picked sketches ordered along the first one's normal, each as a loop sketch on the
 * first one's plane (its points carried across) with its distance along the normal. Null with a reason
 * when they do not lie on parallel planes facing one way, or two share a height. The section nodes are copies
 * with parameter-bound sizes as the numbers they have now (a snapshot: later parameter changes do not reach them);
 * a missing parameter is refused.
 */
export function loftSections(nodes: readonly ModelNode[], picked: readonly number[], params: Params = {}): { plane: SketchPlane; sections: { node: SketchNode; z: number; source: number }[] } | { error: string } {
  if (picked.length < 2) return { error: 'Pick two or more sketches (Shift-click) to loft through.' };
  const sketches = picked.map(i => ({ i, n: valued(nodes[i] as SketchNode, params, i) })), base = planeOf(sketches[0].n);
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
  if (out[0].z !== 0 && out[0].source !== picked[0]) return loftSections(nodes, [out[0].source, ...picked.filter(i => i !== out[0].source)], params);
  for (let k = 1; k < out.length; k++) if (!(out[k].z > out[k - 1].z + 1e-9)) return { error: 'Two sections lie at the same height: put each on its own offset plane.' };
  return { plane: base, sections: out };
}

/** Guided loft sections: keep the picked order and authored sketches in their own world-mm frames (parameter-bound sizes as the numbers they have now, a snapshot; a missing parameter is refused). */
export function framedLoftSections(nodes: readonly ModelNode[], picked: readonly number[], params: Params = {}): { sections: { node: SketchNode; frame: LoftSectionFrame; source: number }[] } | { error: string } {
  if (picked.length !== 2) return { error: 'A guided loft needs exactly two finished sketches.' };
  if (new Set(picked).size !== picked.length) return { error: 'Pick two different sketches for the guided loft.' };
  const sections: { node: SketchNode; frame: LoftSectionFrame; source: number }[] = [];
  for (const source of picked) {
    const node = nodes[source];
    if (!Number.isInteger(source) || node?.kind !== 'sketch') return { error: 'A picked loft section is not a finished sketch.' };
    if (node.regions?.length || node.holes?.length) return { error: `Sketch ${source + 1} has holes or several shapes: a loft section is one closed shape.` };
    const plane = planeOf(node);
    const copy = structuredClone(valued(node, params, source)) as typeof node;
    for (const key of NODE_EXTRA_FIELDS) delete copy[key];
    // Use the existing SketchPlane meaning, including yAxisOf's clean behavior. Do not carry or round profiles.
    sections.push({ node: copy, frame: { origin: [...plane.origin] as Vec3, xAxis: [...plane.xAxis] as Vec3, yAxis: yAxisOf(plane) }, source });
  }
  return { sections };
}
