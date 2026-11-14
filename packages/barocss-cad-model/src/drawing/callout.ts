// A hole's callout on the drawing, from its feature: how many (a pattern), its size or thread, through
// or how deep, and its counterbore or countersink — "4× Ø6.6 THRU", "M6×1 × 10 DEEP",
// "Ø6.6 THRU  CBORE Ø11 × 6.5 DEEP", "Ø6.6 THRU  CSK Ø13 × 90°". Characters the PDF's fonts show.
import type { ProjectedEdge } from '@barocss/cad';
import { placedDoc, type ModelNode, type StudioDoc } from '../engine/doc';
import { nodeIndexOf } from '../engine/ids';
import { holeCalloutGroups, holeCalloutKey, holesOf } from './holeCircles';
import type { DrawingViews, ViewId } from './types';
import type { LengthFormat } from './standard';
import { faceOriginOf, flatFaceOf } from '../engine/occurrences';

/** A length as before units existed: mm, to 3 places, trimmed. */
const plain: LengthFormat = (mm, places = 3) => String(+mm.toFixed(places));
const n = (v: unknown) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : NaN;
const same = (a: readonly unknown[], b: readonly unknown[]) => n(a[0]) === n(b[0]) && n(a[1]) === n(b[1]);

function lengthOf(value: unknown, parameters: Readonly<Record<string, number>>): number | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const key = (value as { parameter?: unknown }).parameter;
    if (typeof key !== 'string' || !Object.hasOwn(parameters, key)) return null;
    value = parameters[key];
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
}
const holeSide = /^(.*?)(n\d+)(_p\d+)?\.side\d+/;
const holeBottom = /^(.*?)(n\d+)(_p\d+)?\.bottom$/;
type BorePairs = { inner: ReadonlyMap<string, string>; outer: ReadonlyMap<string, string> };

/** A native shoulder joins the pilot's cylindrical side to the dependent recess floor. */
function borePairsOf(doc: StudioDoc, views: DrawingViews): BorePairs {
  const inner = new Map<string, string>(), outer = new Map<string, string>();
  const circles = [views.top, views.front, views.right].flatMap(view => {
    const groups = new Map<string, { edge: ProjectedEdge; sweep: number }>();
    for (const edge of view.edges) {
      if (!edge.circle) continue;
      const c = edge.circle, center = c.center.map(x => Math.round(x * 1e6)).join(',');
      const key = `${edge.name.replace(/#\d+/g, '')}:${center}:${Math.round(c.radius * 1e6)}`;
      const prior = groups.get(key);
      const sweep = c.full ? 2 * Math.PI : c.sweep;
      if (prior) prior.sweep += sweep;
      else groups.set(key, { edge, sweep });
    }
    return [...groups.values()].filter(group => Math.abs(group.sweep - 2 * Math.PI) <= 1e-6).map(group => group.edge);
  });
  const floors = new Map<string, NonNullable<ProjectedEdge['circle']>[]>();
  for (const edge of circles) {
    if (!edge.circle) continue;
    const faces = edge.name.split('|');
    const side = faces.map(face => holeSide.exec(face)).find(hit => hit && !hit[1]);
    const bottom = faces.map(face => holeBottom.exec(face)).find(hit => hit && !hit[1]);
    if (!side || !bottom || side[2] !== bottom[2] || side[3] !== bottom[3]) continue;
    const id = bottom[2] + (bottom[3] ?? ''), rings = floors.get(id);
    if (rings) rings.push(edge.circle);
    else floors.set(id, [edge.circle]);
  }
  const ambiguous = new Set<string>();
  for (const edge of circles) {
    const shoulder = edge.circle;
    if (!shoulder) continue;
    const faces = edge.name.split('|');
    if (faces.length !== 2) continue;
    const side = faces.map(face => holeSide.exec(face)).find(hit => hit && !hit[1]);
    const bottom = faces.map(face => holeBottom.exec(face)).find(hit => hit && !hit[1]);
    if (!side || !bottom) continue;
    const index = nodeIndexOf(doc.nodes, side[2]), next = nodeIndexOf(doc.nodes, bottom[2]);
    const pilot = doc.nodes[index], recess = doc.nodes[next];
    if (pilot?.kind !== 'hole' || recess?.kind !== 'hole' || next !== index + 1 || recess.parent.node !== index
      || (pilot.axis ?? 'z') !== (recess.axis ?? 'z') || (pilot.side ?? 'max') !== (recess.side ?? 'max')
      || pilot.face !== recess.face || (!pilot.pattern && !recess.pattern)) continue;
    const r = lengthOf(pilot.radius, doc.parameters), R = lengthOf(recess.radius, doc.parameters);
    if (r === null || R === null || R <= r || lengthOf(recess.depth, doc.parameters) === null) continue;
    const a = side[2] + (side[3] ?? ''), b = bottom[2] + (bottom[3] ?? '');
    if (Math.abs(shoulder.radius - r) > 1e-6 || !floors.get(b)?.some(floor => Math.abs(floor.radius - R) <= 1e-6
      && Math.hypot(...floor.center.map((x, i) => x - shoulder.center[i])) <= 1e-6
      && Math.abs(floor.normal.reduce((sum, axis, i) => sum + axis * shoulder.normal[i], 0)) >= 1 - 1e-6)) continue;
    if ((inner.has(a) && inner.get(a) !== b) || (outer.has(b) && outer.get(b) !== a)) {
      ambiguous.add(a); ambiguous.add(b);
    }
    inner.set(a, b); outer.set(b, a);
  }
  for (const [a, b] of inner) if (ambiguous.has(a) || ambiguous.has(b) || outer.get(b) !== a) inner.delete(a);
  for (const [b, a] of outer) if (inner.get(a) !== b) outer.delete(b);
  return { inner, outer };
}

/** The authored inner-hole feature used by both the formatter and its companion location identity. */
function calloutSource(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>>, pairs?: BorePairs): { index: number; prefix: string; copy: string; paired: boolean; patterned: boolean } | null {
  let i = -1, prefix = '', copy = '', id = '';
  for (const face of edge.split('|')) {
    const match = holeSide.exec(face);
    if (!match) continue;
    const index = nodeIndexOf(nodes, match[2]);
    if (nodes[index]?.kind === 'hole') { i = index; prefix = match[1]; id = match[2]; copy = match[3] ?? ''; break; }
  }
  if (i < 0) return null;
  const prev = nodes[i - 1], cur = nodes[i], next = nodes[i + 1];
  if (cur.kind !== 'hole') return null;
  const patterned = !!(!prefix && pairs && (cur.pattern
    || (prev?.kind === 'hole' && cur.parent.node === i - 1 && prev.pattern)
    || (next?.kind === 'hole' && next.parent.node === i && next.pattern)));
  if (patterned && pairs) {
    const pilot = pairs.outer.get(id + copy);
    if (pilot) return { index: i - 1, prefix, copy: /_p\d+$/.exec(pilot)?.[0] ?? '', paired: true, patterned };
    return { index: i, prefix, copy, paired: pairs.inner.has(id + copy), patterned };
  }
  if (prev?.kind === 'hole' && cur.parent.node === i - 1 && same(cur.center, prev.center)) {
    const radius = lengthOf(cur.radius, parameters), previousRadius = lengthOf(prev.radius, parameters);
    if (radius === null || previousRadius === null) return null;
    if (radius > previousRadius) {
      if (lengthOf(cur.depth, parameters) === null) return null;
      return { index: i - 1, prefix, copy, paired: true, patterned };
    }
  }
  return { index: i, prefix, copy, paired: false, patterned };
}

/** The callout's authored location owner, preserving an assembly path and a pattern-copy suffix. */
export function holeCalloutOwner(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>> = {}): string | null {
  return ownerOf(nodes, edge, parameters);
}
function ownerOf(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>>, pairs?: BorePairs): string | null {
  const source = calloutSource(nodes, edge, parameters, pairs); if (!source) return null;
  const h = nodes[source.index];
  if (h.kind !== 'hole' || lengthOf(h.radius, parameters) === null || (h.depth !== undefined && lengthOf(h.depth, parameters) === null)) return null;
  return `${source.prefix}${h.id ?? `n${source.index}`}${source.copy}`;
}

/** Resolve the same instance document that the drawing projects; never borrow colliding base feature ids. */
export function holeCalloutOwnerOf(doc: StudioDoc, edge: string): string | null {
  let prefix: string | undefined;
  for (const face of edge.split('|')) {
    const match = /^(.*?)(n\d+)(?:_p\d+)?\./.exec(face); if (!match) continue;
    if (prefix !== undefined && prefix !== match[1]) return null;
    prefix = match[1];
  }
  if (prefix === undefined) return null;
  if (!prefix) return holeCalloutOwner(doc.nodes, edge, doc.parameters);
  // (A part inside a sub-assembly is named `sub1/p2/n1.side0`: its path, then its own ids. The hole is found on the
  // folded document, whose ids differ, and its owner told in the part's own ids again: stable as siblings change.)
  const path = prefix.split('/').slice(0, -1), instance = doc.instances?.find(i => i.id === path[0]);
  if (!instance || instance.hidden || `${path.join('/')}/` !== prefix) return null;
  try {
    const source = placedDoc(instance, doc);
    if (path.length === 1) return holeCalloutOwner(source.nodes, edge, source.parameters);
    const flat = edge.split('|').map(piece => flatFaceOf(instance.doc, path.slice(1), piece.slice(prefix.length)));
    if (flat.some(x => x === null)) return null;
    const owner = holeCalloutOwner(source.nodes, flat.join('|'), source.parameters);
    return owner === null ? null : `${prefix}${faceOriginOf(instance.doc, `${owner}.`).face.slice(0, -1)}`;
  } catch { return null; }
}

/** The callout of the hole whose round face an edge (by its name) bounds, or null for any other edge. */
export function holeCallout(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>> = {}, f: LengthFormat = plain): string | null {
  return formatHoleCallout(nodes, edge, parameters, f);
}

function formatHoleCallout(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>>, f: LengthFormat, pairs?: BorePairs, exact = false): string | null {
  const source = calloutSource(nodes, edge, parameters, pairs); if (!source) return null;
  const i = source.index;
  const h = nodes[i]; if (h.kind !== 'hole') return null;
  const radius = lengthOf(h.radius, parameters); if (radius === null) return null;
  const length = (mm: number) => exact ? String(mm) : f(n(mm), 3);
  const d = exact ? radius * 2 : n(radius) * 2; if (!Number.isFinite(d)) return null;
  const count = !source.patterned && h.pattern && h.pattern.count > 1 ? `${h.pattern.count}× ` : '';
  const depth = h.depth === undefined ? undefined : lengthOf(h.depth, parameters);
  if (depth === null) return null;
  const end = depth === undefined ? 'THRU' : `× ${length(depth)} DEEP`;
  let out = `${count}${h.thread ? h.thread : `Ø${length(d)}`} ${end}`;
  const next = nodes[i + 1];
  if (next?.kind === 'hole' && next.parent.node === i && (source.patterned ? source.paired : same(next.center, h.center))) {
    const nextRadius = lengthOf(next.radius, parameters);
    if (nextRadius === null) return null;
    if (nextRadius > radius) {
      const nextDepth = lengthOf(next.depth, parameters);
      if (nextDepth === null) return null;
      out += `  CBORE Ø${length((exact ? nextRadius : n(nextRadius)) * 2)} × ${length(nextDepth)} DEEP`;
    }
  }
  const csk = h.countersink ?? h.csk;
  if (csk) out += `  CSK Ø${length(csk)} × 90°`;
  return out;
}

export type DrawingCallout = ((edge: string, diameter?: number, f?: LengthFormat) => string | null) & {
  /** Current number of identical patterned-hole locations in this view, when established. */
  holeKind?: (edge: string) => string | null;
  patternQuantity?: (view: ViewId, edge: string, radius: number) => number | null | undefined;
};

/** Give the same verified patterned-hole classifications to the drawing, its issue list and Auto-dimension. */
export function drawingHoleCallouts(doc: StudioDoc, views?: DrawingViews) {
  const pairs = views ? borePairsOf(doc, views) : undefined;
  const callout = (edge: string, format: LengthFormat = plain) => formatHoleCallout(doc.nodes, edge, doc.parameters, format, pairs);
  const owner = (edge: string) => edge.includes('/') ? holeCalloutOwnerOf(doc, edge) : ownerOf(doc.nodes, edge, doc.parameters, pairs);
  const holeKind = (edge: string) => formatHoleCallout(doc.nodes, edge, doc.parameters, plain, pairs, true);
  const groups = views ? holeCalloutGroups(holesOf(views, callout, owner), owner, holeKind) : undefined;
  const patternQuantity: DrawingCallout['patternQuantity'] = (view, edge, radius) => {
    const source = calloutSource(doc.nodes, edge, doc.parameters, pairs);
    if (!source?.patterned) return undefined;
    const name = owner(edge), text = holeKind(edge);
    if (!name || text === null) return null;
    const group = groups?.get(holeCalloutKey(text, radius))?.filter(hole => hole.view === view);
    return group?.some(hole => owner(hole.edge.name) === name) ? group.length : null;
  };
  return { callout, owner, holeKind, patternQuantity };
}
