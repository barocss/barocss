// A hole's callout on the drawing, from its feature: how many (a pattern), its size or thread, through
// or how deep, and its counterbore or countersink — "4× Ø6.6 THRU", "M6×1 × 10 DEEP",
// "Ø6.6 THRU  CBORE Ø11 × 6.5 DEEP", "Ø6.6 THRU  CSK Ø13 × 90°". Characters the PDF's fonts show.
import type { ModelNode } from '../engine/doc';
import { nodeIndexOf } from '../engine/ids';

const n = (v: unknown) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : NaN;
const same = (a: readonly unknown[], b: readonly unknown[]) => n(a[0]) === n(b[0]) && n(a[1]) === n(b[1]);

/** The callout of the hole whose round face an edge (by its name) bounds, or null for any other edge. */
export function holeCallout(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>> = {}): string | null {
  // Resolve lengths once here, then retain the existing three-decimal rounding order.
  const length = (v: unknown): number | null => {
    let value = v;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const key = (value as { parameter?: unknown }).parameter;
      if (typeof key !== 'string' || !Object.hasOwn(parameters, key)) return null;
      value = parameters[key];
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
    const rounded = n(value);
    return Number.isFinite(rounded) ? rounded : null;
  };
  let i = -1;
  // (A pattern's copies are named `n<k>_p<j>`: the callout is the hole's, the count its pattern's.)
  for (const m of edge.matchAll(/\b(n\d+)(?:_p\d+)?\.side\d+/g)) { const k = nodeIndexOf(nodes, m[1]); if (nodes[k]?.kind === 'hole') { i = k; break; } }
  if (i < 0) return null;
  // A counterbore is the second, wider hole on the first's centre: the callout is the first's.
  const prev = nodes[i - 1], cur = nodes[i];
  if (cur.kind === 'hole' && prev?.kind === 'hole' && cur.parent.node === i - 1 && same(cur.center, prev.center)) {
    const radius = length(cur.radius), previousRadius = length(prev.radius);
    if (radius === null || previousRadius === null) return null;
    if (radius > previousRadius) i--;
  }
  const h = nodes[i]; if (h.kind !== 'hole') return null;
  const radius = length(h.radius); if (radius === null) return null;
  const d = radius * 2; if (!Number.isFinite(d)) return null;
  const count = h.pattern && h.pattern.count > 1 ? `${h.pattern.count}× ` : '';
  const depth = h.depth === undefined ? undefined : length(h.depth);
  if (depth === null) return null;
  const end = depth === undefined ? 'THRU' : `× ${depth} DEEP`;
  let out = `${count}${h.thread ? h.thread : `Ø${d}`} ${end}`;
  const next = nodes[i + 1];
  if (next?.kind === 'hole' && next.parent.node === i && same(next.center, h.center)) {
    const nextRadius = length(next.radius);
    if (nextRadius === null) return null;
    if (nextRadius > radius) {
      const nextDepth = length(next.depth);
      if (nextDepth === null) return null;
      out += `  CBORE Ø${nextRadius * 2} × ${nextDepth} DEEP`;
    }
  }
  const csk = h.countersink ?? h.csk;
  if (csk) out += `  CSK Ø${n(csk)} × 90°`;
  return out;
}
