// R10a (D86): every side of a sketch's shapes has an id of its own — `e<k>`, unique in the sketch — kept as the
// sketch is edited: a vertex inserted gives the new piece a new id and leaves every other id where it was, a
// segment taken away takes its id with it. The ids go to the kernel as the sketch node's `sideTags`, so the walls
// a body makes of the sketch are named `side[e<k>]` and keep their names through those edits (D31's plan). A
// polygon's id i is its point i's and so its segment i's (segment i runs from point i); the constraints, kept by
// index, are carried through an edit by these ids (`carryPolygon`).
import type { SketchShape } from './types';
import type { LoopSegment, ModelNode, SketchNode } from '../engine/doc';
import type { Polygon } from './rules';
import type { SketchRule } from './terms';

export interface SideTags { outer: string[]; regions?: string[][]; holes?: string[][] }

const ID = /^e(\d+)$/;
/** How many sides (ids) a shape has: a rectangle's four, a circle's one, a slot's four, a polygon's points. */
export function sidesOf(s: SketchShape): number {
  return s.kind === 'rectangle' ? 4 : s.kind === 'circle' ? 1 : s.kind === 'slot' ? 4 : s.points.length;
}
/** The next id number after every id in the shapes. */
export function nextIdOf(shapes: readonly SketchShape[]): number {
  let k = 0;
  const see = (id: string) => { const m = ID.exec(id); if (m) k = Math.max(k, Number(m[1])); };
  for (const s of shapes) { for (const id of s.ids ?? []) see(id); if (s.kind === 'polygon') for (const id of s.circleIds ?? []) see(id); }
  return k + 1;
}
/**
 * The shapes, each with an id a side (and a polygon's attached circles one each): the ids they have kept, new
 * ones (in order, after the highest) where a shape has none or not as many as its sides.
 */
export function withIds(shapes: readonly SketchShape[], from = 1): SketchShape[] {
  let k = Math.max(from, nextIdOf(shapes));
  const fresh = (n: number) => Array.from({ length: n }, () => `e${k++}`);
  return shapes.map(s => {
    let out = s;
    // (As many as its sides: kept, an empty one — a side an edit made — given one; else all new.)
    if (s.ids?.length !== sidesOf(s)) out = { ...out, ids: fresh(sidesOf(s)) };
    else if (s.ids.some(x => !x)) out = { ...out, ids: s.ids.map(x => x || fresh(1)[0]) };
    if (out.kind === 'polygon' && (out.circles?.length ?? 0) !== (out.circleIds?.length ?? 0)) out = { ...out, circleIds: fresh(out.circles?.length ?? 0) };
    return out;
  });
}

/**
 * The polygon's constraints carried onto its edited form `next`, whose points came from the old one's by `from`
 * (`from[j]`: the old point new point j was, or −1 for a new one). A constraint on a point or segment no longer
 * there, or on a segment that is no longer the same piece (a point inserted in it: its length, its radius), goes.
 */
export function carryPolygon(old: Polygon, next: Polygon, from: readonly number[]): Polygon {
  const n0 = old.points.length, n1 = next.points.length, to = new Array<number>(n0).fill(-1);
  from.forEach((o, j) => { if (o >= 0) to[o] = j; });
  const pt = (i: number) => to[i] ?? -1;
  // Segment i (point i to point i + 1) is the same piece when both its ends follow, still neighbours.
  const seg = (i: number) => { const a = pt(i), b = pt((i + 1) % n0); return a >= 0 && b >= 0 && b === (a + 1) % n1 ? a : -1; };
  const byKey = (r: Record<number, number> | undefined) => r && Object.fromEntries(Object.entries(r).flatMap(([i, v]) => { const j = seg(Number(i)); return j >= 0 ? [[j, v]] : []; }));
  const pairs = (list: [number, number][] | undefined) => list?.flatMap(([a, b]) => { const x = seg(a), y = seg(b); return x >= 0 && y >= 0 ? [[Math.min(x, y), Math.max(x, y)] as [number, number]] : []; });
  const rules = old.rules?.flatMap((r): SketchRule[] => {
    const R = r as Record<string, unknown>, o: Record<string, unknown> = { ...r };
    for (const [key, kind] of ruleFields(r)) { const i = R[key] as number, j = kind === 'seg' ? seg(i) : pt(i); if (j < 0) return []; o[key] = j; }
    return [o as SketchRule];
  });
  const out: Polygon = { ...next };
  const set = <K extends keyof Polygon>(k: K, v: Polygon[K] | undefined) => { if (v && (Array.isArray(v) ? v.length : Object.keys(v as object).length)) out[k] = v; else delete out[k]; };
  set('lengths', byKey(old.lengths)); set('radii', byKey(old.radii));
  set('tangents', old.tangents?.map(pt).filter(j => j >= 0));
  set('equalRadii', pairs(old.equalRadii)); set('concentric', pairs(old.concentric));
  if (old.hv) set('hv', { h: old.hv.h.map(seg).filter(j => j >= 0), v: old.hv.v.map(seg).filter(j => j >= 0) });
  set('rules', rules);
  if (old.circles) { out.circles = old.circles.map(c => ({ c: [c.c[0], c.c[1]], r: c.r })); if (old.circleIds) out.circleIds = [...old.circleIds]; }
  if (old.fromRectangle && n1 === 4) out.fromRectangle = true; else delete out.fromRectangle;
  // (A point inserted or removed makes a spline an ordinary outline.)
  delete out.fromSpline;
  return out;
}
/** A rule's fields that name points or segments (circles keep their numbers through an outline edit). */
function ruleFields(r: SketchRule): [string, 'pt' | 'seg'][] {
  switch (r.kind) {
    case 'parallel': case 'perpendicular': case 'equal': case 'angle': return [['a', 'seg'], ['b', 'seg']];
    case 'fix': return [['point', 'pt']];
    case 'coincident': return [['point', 'pt'], ['arc', 'seg']];
    case 'distance': case 'dx': case 'dy': return [['a', 'pt'], ['b', 'pt']];
    case 'cdist': case 'cdx': case 'cdy': return [['a', 'pt']];
    case 'cedge': case 'ctan': return [['edge', 'seg']];
    case 'symmetric': return [['a', 'pt'], ['b', 'pt'], ['line', 'seg']];
    default: return [];
  }
}

/**
 * The tags of a shape's sides in the order its sketch node's loop runs them (`loop`: that loop): its ids, matched
 * by their segments' ends — a polygon saved as a rectangle runs from its lowest corner, whichever it was drawn from.
 */
export function tagsOf(s: SketchShape, loop: readonly LoopSegment[]): string[] | null {
  const ids = s.ids; if (!ids || ids.length !== sidesOf(s)) return null;
  const P = cornersOf(s);
  if (!P || loop.length !== P.length) return loop.length === ids.length ? [...ids] : null;
  const n = P.length, key = (p: readonly unknown[]) => `${Number(p[0]).toFixed(6)},${Number(p[1]).toFixed(6)}`;
  const at = new Map(P.map((p, i) => [key(p), i]));
  const out: string[] = [];
  for (let k = 0; k < loop.length; k++) {
    const a = at.get(key(loop[k].start)), b = at.get(key(loop[(k + 1) % loop.length].start));
    if (a === undefined || b === undefined) return null;
    // (The segment from a to b, or the one from b to a when the loop runs the other way round.)
    const i = (a + 1) % n === b ? a : (b + 1) % n === a ? b : -1;
    if (i < 0) return null;
    out.push(ids[i]);
  }
  return out;
}

/**
 * A shape's corners in the order its ids run (a rectangle from `a` round by `(b.x, a.y)`, a slot as its loop, a
 * polygon's points); null for a circle (one side, no corners).
 */
export function cornersOf(s: SketchShape): [number, number][] | null {
  switch (s.kind) {
    case 'rectangle': return [s.a, [s.b[0], s.a[1]], s.b, [s.a[0], s.b[1]]];
    case 'circle': return null;
    case 'slot': {
      const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1, n: [number, number] = [-(s.b[1] - s.a[1]) / l * s.r, (s.b[0] - s.a[0]) / l * s.r];
      return [[s.a[0] - n[0], s.a[1] - n[1]], [s.b[0] - n[0], s.b[1] - n[1]], [s.b[0] + n[0], s.b[1] + n[1]], [s.a[0] + n[0], s.a[1] + n[1]]];
    }
    case 'polygon': return s.points;
  }
}
/**
 * After an edit that made new shapes of old ones (a trim, an extension, a join): each new polygon's points take the
 * ids of old shapes' corners at the same place (a segment's id is its start point's), each at most once; the rest
 * new ones (withIds).
 */
export function inheritIds(old: readonly SketchShape[], next: readonly SketchShape[]): SketchShape[] {
  const key = (p: readonly number[]) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`, pool = new Map<string, string[]>();
  for (const s of withIds(old)) { const C = cornersOf(s); if (C) C.forEach((p, i) => { const k = key(p); pool.set(k, [...(pool.get(k) ?? []), s.ids![i]]); }); }
  const used = new Set<string>();
  const taken = next.map(s => {
    if (s.kind !== 'polygon' || (s.ids?.length === s.points.length)) return s;
    const ids = s.points.map(p => { const id = (pool.get(key(p)) ?? []).find(x => !used.has(x)); if (id) used.add(id); return id ?? ''; });
    return ids.some(Boolean) ? { ...s, ids } : s;
  });
  // (Points with no old id: new ones, after the highest — the old shapes' ids counted too, gone or not.)
  return withIds(taken, nextIdOf(old));
}
/** The node's sides' tags as the shapes that make it give them (null when one has none: the node stays positional). */
export function sideTagsFor(node: SketchNode, main: SketchShape, regions: readonly SketchShape[], holes: readonly SketchShape[], loopOf: (n: SketchNode) => LoopSegment[]): SideTags | null {
  const outer = tagsOf(main, loopOf(node)); if (!outer) return null;
  const many = (shapes: readonly SketchShape[], loops: readonly LoopSegment[][] | undefined) => {
    const out: string[][] = [];
    for (const [i, s] of shapes.entries()) { const t = tagsOf(s, loops?.[i] ?? []); if (!t) return null; out.push(t); }
    return out;
  };
  const r = many(regions, node.regions), h = many(holes, node.holes);
  if (!r || !h) return null;
  const all = [...outer, ...r.flat(), ...h.flat()];
  if (new Set(all).size !== all.length) return null;
  return { outer, ...(r.length ? { regions: r } : {}), ...(h.length ? { holes: h } : {}) };
}

/**
 * Old positional wall names to the node's tagged ones (`<feature>.side<k>`, `.region<r>.side<k>`, `.hole<h>.side<k>`
 * → `<feature>.side[t]`), for the features built on a sketch that first gets its tags (a sketch drawn before R10a,
 * edited): its walls were named by position, the shapes reopened took ids in that order.
 */
export function positionalToTagged(tags: SideTags): Map<string, string> {
  const m = new Map<string, string>();
  tags.outer.forEach((t, k) => m.set(`side${k}`, `side[${t}]`));
  tags.regions?.forEach((list, r) => list.forEach((t, k) => m.set(`region${r}.side${k}`, `side[${t}]`)));
  tags.holes?.forEach((list, h) => list.forEach((t, k) => m.set(`hole${h}.side${k}`, `side[${t}]`)));
  return m;
}

/**
 * The document with the walls of the features built straight on sketch `at` (extrude, revolve) renamed from their
 * positional names to the tagged ones (`positional`: `side2` → `side[e3]`, only those whose id the sketch still has)
 * wherever a later feature, a look or a mate names them — as a string or an object key, alone or in an edge
 * (`a|b`) or a merged name (`a+b`), with any `#k`. Run once, when a sketch from before R10a first gets its ids (D86).
 */
export function renameToTagged<D extends { nodes: readonly ModelNode[] }>(doc: D, at: number, positional: Record<string, string>, tags: SideTags, featureId: (nodes: readonly ModelNode[], i: number) => string): D {
  const kept = new Set([...tags.outer, ...(tags.regions ?? []).flat(), ...(tags.holes ?? []).flat()].map(t => `side[${t}]`));
  const map = new Map<string, string>();
  doc.nodes.forEach((n, i) => {
    if (i <= at || (n.kind !== 'extrude' && n.kind !== 'revolve') || n.sketch !== at) return;
    const fid = featureId(doc.nodes, i);
    for (const [old, tag] of Object.entries(positional)) if (kept.has(tag)) map.set(`${fid}.${old}`, `${fid}.${tag}`);
  });
  if (!map.size) return doc;
  const name = (s: string) => s.split(/([|+])/).map(part => { const m = /^(.*?)(#\d+)?$/.exec(part)!; const to = map.get(m[1]); return to ? to + (m[2] ?? '') : part; }).join('');
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return name(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [name(k), walk(x)]));
    return v;
  };
  const rest = { ...doc } as Record<string, unknown>; delete rest.nodes;
  return { ...(walk(rest) as object), nodes: doc.nodes.map((n, i) => i <= at ? n : walk(n) as ModelNode) } as unknown as D;
}
