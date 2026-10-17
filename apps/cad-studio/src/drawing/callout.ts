// A hole's callout on the drawing, from its feature: how many (a pattern), its size or thread, through
// or how deep, and its counterbore or countersink — "4× Ø6.6 THRU", "M6×1 × 10 DEEP",
// "Ø6.6 THRU  CBORE Ø11 × 6.5 DEEP", "Ø6.6 THRU  CSK Ø13 × 90°". Characters the PDF's fonts show.
import type { ModelNode } from '../engine/doc';

const n = (v: unknown) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : NaN;
const same = (a: readonly unknown[], b: readonly unknown[]) => n(a[0]) === n(b[0]) && n(a[1]) === n(b[1]);

/** The callout of the hole whose round face an edge (by its name) bounds, or null for any other edge. */
export function holeCallout(nodes: readonly ModelNode[], edge: string): string | null {
  let i = -1;
  for (const m of edge.matchAll(/\bn(\d+)\.side\d+/g)) { const k = Number(m[1]); if (nodes[k]?.kind === 'hole') { i = k; break; } }
  if (i < 0) return null;
  // A counterbore is the second, wider hole on the first's centre: the callout is the first's.
  const prev = nodes[i - 1], cur = nodes[i];
  if (cur.kind === 'hole' && prev?.kind === 'hole' && cur.parent.node === i - 1 && same(cur.center, prev.center) && n(cur.radius) > n(prev.radius)) i--;
  const h = nodes[i]; if (h.kind !== 'hole') return null;
  const d = n(h.radius) * 2; if (!Number.isFinite(d)) return null;
  const count = h.pattern && h.pattern.count > 1 ? `${h.pattern.count}× ` : '';
  const end = h.depth === undefined ? 'THRU' : `× ${n(h.depth)} DEEP`;
  let out = `${count}${h.thread ? h.thread : `Ø${d}`} ${end}`;
  const next = nodes[i + 1];
  if (next?.kind === 'hole' && next.parent.node === i && same(next.center, h.center) && n(next.radius) > n(h.radius)) out += `  CBORE Ø${n(next.radius) * 2} × ${n(next.depth)} DEEP`;
  const csk = h.countersink ?? h.csk;
  if (csk) out += `  CSK Ø${n(csk)} × 90°`;
  return out;
}
