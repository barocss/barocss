// A finished sketch node back as sketcher shapes, to edit it in place: the main profile as the current
// shape (its kept outline with all constraints when it has one), more regions and holes beside it.
import type { LoopSegment, SketchNode, SketchOutline } from '../engine/doc';
import type { SketchShape } from './types';
import type { P2 } from './profile';
import type { Polygon } from './rules';
import { loopOf } from './loops';
import { wellFormedBezier } from './bezier';
import type { SplineDef } from './spline';
import { refusal } from '../engine/refusal';

type Params = Readonly<Record<string, number>>;
const isRef = (v: unknown): v is { parameter: string } => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof (v as { parameter?: unknown }).parameter === 'string';

/** The sketch node with every `{ parameter }` reference replaced by its value now; a missing or non-finite parameter is refused. */
export function resolveSketchDims(node: SketchNode, params: Params = {}): SketchNode {
  const walk = (v: unknown): unknown => {
    if (isRef(v)) {
      const x = Object.hasOwn(params, v.parameter) ? params[v.parameter] : undefined;
      if (typeof x !== 'number') throw refusal('PARAMETER_UNKNOWN', `the sketch uses parameter ${v.parameter}, which this document does not have`);
      if (!Number.isFinite(x)) throw refusal('PARAMETER_UNKNOWN', `the sketch uses parameter ${v.parameter}, which has no finite value`);
      return x;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(node) as SketchNode;
}

const SAME = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** One closed loop of a sketch: its representation, its dimension values (numbers or references) in order, and how a rebound copy of `value` is written into a node. */
interface Slot { slot: string; sig: string; value: unknown; leaves: unknown[]; put(out: Record<string, unknown>, v: unknown): void }
const segmentsSig = (l: readonly LoopSegment[]) => 'loop:' + l.map(s => s.kind === 'arc' ? 'a' + s.direction : 'l').join(',');
const segmentLeaves = (l: readonly LoopSegment[]) => l.flatMap(s => s.kind === 'arc' ? [...s.start, ...s.center] : [...s.start]);
function slotsOf(node: SketchNode): Slot[] {
  const into = (out: Record<string, unknown>, v: unknown) => Object.assign(out, v);
  const main: Slot = node.profile === 'rectangle' ? { slot: 'main', sig: 'rectangle', value: { min: node.min, max: node.max }, leaves: [...node.min, ...node.max], put: into }
    : node.profile === 'circle' ? { slot: 'main', sig: 'circle', value: { center: node.center, radius: node.radius }, leaves: [...node.center, node.radius], put: into }
    : node.profile === 'polygon' ? { slot: 'main', sig: 'polygon:' + node.points.length, value: { points: node.points }, leaves: node.points.flat(), put: into }
    : { slot: 'main', sig: segmentsSig(node.segments), value: node.segments, leaves: segmentLeaves(node.segments), put: (out, v) => { out.segments = v; } };
  const more = (ls: LoopSegment[][] | undefined, key: 'regions' | 'holes'): Slot[] => (ls ?? []).map((l, i) => ({ slot: key + i, sig: segmentsSig(l), value: l, leaves: segmentLeaves(l),
    put: (out, v) => { out[key] = (out[key] as unknown[]).map((x, k) => k === i ? v : x); } }));
  return [main, ...more(node.regions, 'regions'), ...more(node.holes, 'holes')];
}
/** The same loop with only its bound values possibly changed: every unbound value of `a` is the value of `b` at the same place. */
const named = (s: Slot) => s.sig === 'rectangle' || s.sig === 'circle';
const sameLoop = (a: Slot, b: Slot) => a.sig === b.sig && a.leaves.every((x, i) => isRef(x) || (typeof x === 'number' && typeof b.leaves[i] === 'number' && SAME(x, b.leaves[i] as number)));
const hasRef = (v: unknown): boolean => isRef(v) || (Array.isArray(v) ? v.some(hasRef) : !!v && typeof v === 'object' && Object.values(v).some(hasRef));
/** Every reference in `v`, deep (the stored node's, wherever it is kept). */
const refsIn = (v: unknown): { parameter: string }[] => isRef(v) ? [v] : Array.isArray(v) ? v.flatMap(refsIn) : v && typeof v === 'object' ? Object.values(v).flatMap(refsIn) : [];

/**
 * The new node with `{ parameter }` restored where a loop of the stored node is still the same loop (same form and size,
 * every unbound value unchanged — only its bound values may differ) and the parameter's value equals the new value there.
 * A rectangle or circle (same slot, same form) needs no more: each bound value is restored on its own, whatever else changed;
 * a changed bound value stays a number. Loops pair by slot first, then by any slot of the same form that matches.
 * `dropped`: the parameters that had a binding which could not be restored (changed value, or the loop changed form),
 * each once, so the caller can say they are numbers now.
 */
export function rebindDims(stored: SketchNode, next: SketchNode, params: Params = {}): { node: SketchNode; dropped: string[] } {
  const kept = new Set<unknown>();
  const walk = (a: unknown, b: unknown): unknown => {
    if (isRef(a)) { const ok = typeof b === 'number' && Object.hasOwn(params, a.parameter) && SAME(params[a.parameter], b); if (ok) kept.add(a); return ok ? a : b; }
    // (Paired loops have the same form and size, so `a` has a value wherever `b` does.)
    if (Array.isArray(b)) return Array.isArray(a) ? b.map((x, i) => walk(a[i], x)) : b;
    if (b && typeof b === 'object' && a && typeof a === 'object' && !Array.isArray(a)) return Object.fromEntries(Object.entries(b).map(([k, x]) => [k, walk((a as Record<string, unknown>)[k], x)]));
    return b;
  };
  // Only loops holding a binding are candidates; each is used once.
  const old = slotsOf(stored).filter(s => hasRef(s.value)), out: Record<string, unknown> = { ...next };
  for (const n of slotsOf(next)) {
    // A rectangle's or circle's positions are independent named values: paired by form in the same slot, each bound one is restored on its own.
    const at = old.findIndex(o => o.slot === n.slot && (named(n) ? o.sig === n.sig : sameLoop(o, n))), i = at >= 0 ? at : named(n) ? -1 : old.findIndex(o => sameLoop(o, n));
    if (i < 0) continue;
    const [o] = old.splice(i, 1);
    n.put(out, walk(o.value, n.value));
  }
  const dropped = [...new Set(refsIn(stored).filter(r => !kept.has(r)).map(r => r.parameter))];
  return { node: out as unknown as SketchNode, dropped };
}

const pt = (p: readonly unknown[]): P2 => [Number(p[0]), Number(p[1])];

/** A stored spline definition only when well-formed (else ignored). */
function wellFormedSpline(x: unknown): SplineDef | null {
  const d = x as Partial<SplineDef> | null | undefined, num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (!d || typeof d !== 'object' || !Array.isArray(d.fit) || d.fit.length < 2 || typeof d.closed !== 'boolean') return null;
  if (!d.fit.every(p => Array.isArray(p) && p.length === 2 && num(p[0]) && num(p[1]))) return null;
  if (d.handles !== undefined && !(Array.isArray(d.handles) && d.handles.length === d.fit.length && d.handles.every(h => h === null || num(h)))) return null;
  return { fit: d.fit.map(p => [p[0], p[1]] as [number, number]), closed: d.closed, ...(d.handles ? { handles: [...d.handles] } : {}) };
}
/** A kept outline as the sketcher's closed polygon. */
export const outlinePolygon = (o: SketchOutline): Polygon => ({
  kind: 'polygon', closed: true, points: o.points.map(p => [p[0], p[1]] as [number, number]), bulges: o.bulges ? [...o.bulges] : o.points.map(() => 0),
  ...(o.lengths ? { lengths: o.lengths } : {}), ...(o.radii ? { radii: o.radii } : {}), ...(o.tangents ? { tangents: o.tangents } : {}),
  ...(o.equalRadii ? { equalRadii: o.equalRadii } : {}), ...(o.concentric ? { concentric: o.concentric } : {}), ...(o.hv ? { hv: o.hv } : {}), ...(o.rules ? { rules: o.rules } : {}),
  ...(wellFormedSpline(o.spline) ? { spline: wellFormedSpline(o.spline)!, fromSpline: true as const } : {}),
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

/**
 * The shapes of a sketch node: the main profile, then its other regions and holes — each with its sides' ids (R10a,
 * D86): the node's `sideTags`, or, for a node from before them, new ones in the order its loops run, with `positional`
 * saying which positional wall name (`side<k>`, `region<r>.side<k>`, `hole<h>.side<k>`) each id takes over.
 */
export function sketchShapes(stored: SketchNode, params: Params = {}): { shape: SketchShape | null; done: SketchShape[]; positional?: Record<string, string> } {
  const node = resolveSketchDims(stored, params);
  // Circles the outline keeps come back on it, not beside it.
  const attached = node.outline?.circles ?? [], sameCircle = (s: SketchShape | null, c: { c: [number, number]; r: number }) => !!s && s.kind === 'circle' && Math.hypot(c.c[0] - s.c[0], c.c[1] - s.c[1]) < 1e-6 && Math.abs(c.r - s.r) < 1e-6;
  const tags = node.sideTags, positional: Record<string, string> = {};
  let k = 1;
  for (const t of [...(tags?.outer ?? []), ...(tags?.regions ?? []).flat(), ...(tags?.holes ?? []).flat()]) { const m = /^e(\d+)$/.exec(t); if (m) k = Math.max(k, Number(m[1]) + 1); }
  const idsFor = (n: number, given: string[] | undefined, name: (i: number) => string) => {
    if (given?.length === n) return [...given];
    const out = Array.from({ length: n }, () => `e${k++}`);
    out.forEach((t, i) => { positional[name(i)] = `side[${t}]`; });
    return out;
  };
  const main = mainShape(node), outer = idsFor(loopOf(node).length, tags?.outer, i => `side${i}`);
  const regions = (node.regions ?? []).map((l, r) => ({ s: loopShape(l), ids: idsFor(l.length, tags?.regions?.[r], i => `region${r}.side${i}`) }));
  const holes = (node.holes ?? []).map((l, h) => ({ s: loopShape(l), ids: idsFor(l.length, tags?.holes?.[h], i => `hole${h}.side${i}`) }));
  const loops = [...regions, ...holes];
  let shape: SketchShape | null = main && { ...main, ids: outer };
  if (shape?.kind === 'polygon' && attached.length) shape = { ...shape, circleIds: attached.map(c => loops.find(x => sameCircle(x.s, c))?.ids[0] ?? `e${k++}`) };
  const done = loops.filter(x => !!x.s && !attached.some(c => sameCircle(x.s, c))).map(x => ({ ...x.s!, ids: x.ids }) as SketchShape);
  return { shape, done: [...done, ...((node.construction ?? []) as SketchShape[]).filter(x => x?.kind !== 'bezier' || wellFormedBezier(x))], ...(Object.keys(positional).length && !tags ? { positional } : {}) };
}
