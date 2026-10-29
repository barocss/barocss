// A hole's callout on the drawing, from its feature: how many (a pattern), its size or thread, through
// or how deep, and its counterbore or countersink — "4× Ø6.6 THRU", "M6×1 × 10 DEEP",
// "Ø6.6 THRU  CBORE Ø11 × 6.5 DEEP", "Ø6.6 THRU  CSK Ø13 × 90°". Characters the PDF's fonts show.
import { placedDoc, type ModelNode, type StudioDoc } from '../engine/doc';
import { nodeIndexOf } from '../engine/ids';

const n = (v: unknown) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : NaN;
const same = (a: readonly unknown[], b: readonly unknown[]) => n(a[0]) === n(b[0]) && n(a[1]) === n(b[1]);

function lengthOf(value: unknown, parameters: Readonly<Record<string, number>>): number | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const key = (value as { parameter?: unknown }).parameter;
    if (typeof key !== 'string' || !Object.hasOwn(parameters, key)) return null;
    value = parameters[key];
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const rounded = n(value);
  return Number.isFinite(rounded) ? rounded : null;
}
/** The authored inner-hole feature used by both the formatter and its companion location identity. */
function calloutSource(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>>): { index: number; prefix: string; copy: string } | null {
  let i = -1, prefix = '', copy = '';
  for (const face of edge.split('|')) {
    const match = /^(.*?)(n\d+)(_p\d+)?\.side\d+/.exec(face);
    if (!match) continue;
    const index = nodeIndexOf(nodes, match[2]);
    if (nodes[index]?.kind === 'hole') { i = index; prefix = match[1]; copy = match[3] ?? ''; break; }
  }
  if (i < 0) return null;
  const prev = nodes[i - 1], cur = nodes[i];
  if (cur.kind === 'hole' && prev?.kind === 'hole' && cur.parent.node === i - 1 && same(cur.center, prev.center)) {
    const radius = lengthOf(cur.radius, parameters), previousRadius = lengthOf(prev.radius, parameters);
    if (radius === null || previousRadius === null) return null;
    // The wider dependent cut is a compound location only when its depth also defines a valid callout.
    if (radius > previousRadius) { if (lengthOf(cur.depth, parameters) === null) return null; i--; }
  }
  return { index: i, prefix, copy };
}

/** The callout's authored location owner, preserving an assembly path and a pattern-copy suffix. */
export function holeCalloutOwner(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>> = {}): string | null {
  const source = calloutSource(nodes, edge, parameters); if (!source) return null;
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
  for (const instance of doc.instances ?? []) if (`${instance.id}/` === prefix) {
    if (instance.hidden) return null;
    try { const source = placedDoc(instance, doc); return holeCalloutOwner(source.nodes, edge, source.parameters); } catch { return null; }
  }
  return null;
}

/** The callout of the hole whose round face an edge (by its name) bounds, or null for any other edge. */
export function holeCallout(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>> = {}): string | null {
  const source = calloutSource(nodes, edge, parameters); if (!source) return null;
  const i = source.index;
  const h = nodes[i]; if (h.kind !== 'hole') return null;
  const radius = lengthOf(h.radius, parameters); if (radius === null) return null;
  const d = radius * 2; if (!Number.isFinite(d)) return null;
  const count = h.pattern && h.pattern.count > 1 ? `${h.pattern.count}× ` : '';
  const depth = h.depth === undefined ? undefined : lengthOf(h.depth, parameters);
  if (depth === null) return null;
  const end = depth === undefined ? 'THRU' : `× ${depth} DEEP`;
  let out = `${count}${h.thread ? h.thread : `Ø${d}`} ${end}`;
  const next = nodes[i + 1];
  if (next?.kind === 'hole' && next.parent.node === i && same(next.center, h.center)) {
    const nextRadius = lengthOf(next.radius, parameters);
    if (nextRadius === null) return null;
    if (nextRadius > radius) {
      const nextDepth = lengthOf(next.depth, parameters);
      if (nextDepth === null) return null;
      out += `  CBORE Ø${nextRadius * 2} × ${nextDepth} DEEP`;
    }
  }
  const csk = h.countersink ?? h.csk;
  if (csk) out += `  CSK Ø${n(csk)} × 90°`;
  return out;
}
