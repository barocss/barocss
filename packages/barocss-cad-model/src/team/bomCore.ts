// The BOM's synchronous core (O147 B2, split from team/assembly.ts): the BOM agent's view of an assembly — each placed
// part's name, material, mass, library origin and shape fingerprint, and the bought machine elements — and the
// deterministic BOM derived from it. It imports nothing of the chat's tools, so the chat's drawings (chat/drawing.ts)
// read it without a cycle through them.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import { massProperties } from '../chat/analysis';
import { materialIdOf } from '../app/bodies';
import { elementLines } from '../engine/elements';

const massOf = (doc: StudioDoc, bodies: readonly BodyResult[]) => (massProperties(doc, bodies) as { mass_g: number }[]).reduce((s, x) => s + x.mass_g, 0);
export interface BomView {
  parts: { id: string; name: string; material: string | null; massG: number; library: string | null; shape: string }[];
  /** The bought machine elements (O142): in the base part (`part: 'base'`) and in each placed part, one a body. */
  elements?: { part: string; item: string; kind: string; size: string; row: string | null; source: string | null; estimate: boolean; why: string[]; by: 'override' | 'default'; massG: number | null; catalogue?: string }[];
}
export interface BomLine {
  item: string; parts: string[]; qty: number; material: string | null; massG: number; source: string | null;
  /** A bought element's line (O142): its kind, sizes, the user's row, whether an estimate, and whether the person's override made it bought. `parts`: `part:feature` each. */
  kind?: string; size?: string; row?: string | null; estimate?: boolean; override?: boolean; /** Its catalogue number and supplier (a coupling's row). */ catalogue?: string;
}
export interface Bom { lines: BomLine[]; totalQty: number; totalMassG: number; /** The bought elements counted (their mass is their parts'). */ elementQty?: number }
const r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
/** The BOM agent's view from evaluations given at once (O147: the chat's drawings build it synchronously). */
export function bomViewOf(doc: StudioDoc, evaluate: (doc: StudioDoc) => EvalResult | null): BomView {
  const parts: BomView['parts'] = [];
  for (const inst of doc.instances ?? []) {
    const e = evaluate(inst.doc), bodies = e?.ok ? e.bodies : [];
    const lib = inst.doc.nodes.find(n => n.kind === 'library') as { library?: { library?: string; version?: string; part?: string; variant?: string } } | undefined, o = lib?.library;
    parts.push({ id: inst.id, name: inst.name, material: bodies.length ? materialIdOf(inst.doc, bodies[0]) ?? null : null, massG: r6(massOf(inst.doc, bodies)), library: o ? `${o.library}@${o.version}/${o.part}${o.variant ? `:${o.variant}` : ''}` : null, shape: JSON.stringify(inst.doc.nodes) });
  }
  // (O142: the bought elements — the base part's and each placed part's — as their own lines' material.)
  const elements: NonNullable<BomView['elements']> = [];
  const take = (part: string, d: StudioDoc, bodies: readonly BodyResult[]) => {
    for (const l of elementLines(d, bodies)) if (l.bought) elements.push({ part, item: l.item, kind: l.kind, size: l.size, row: l.row?.id ?? null, source: l.row?.source ?? null, estimate: l.estimate, why: l.why, by: l.boughtBy, massG: l.massG === null ? null : r6(l.massG), ...(l.catalogue ? { catalogue: l.catalogue } : {}) });
  };
  const base = evaluate(doc); if (base?.ok) take('base', doc, base.bodies);
  for (const inst of doc.instances ?? []) { const e = evaluate(inst.doc); if (e?.ok) take(inst.id, inst.doc, e.bodies); }
  return JSON.parse(JSON.stringify({ parts, ...(elements.length ? { elements } : {}) })) as BomView;
}
/** The deterministic BOM: identical parts (same shape and material) on one line, in first-seen order. */
export function deriveBom(view: BomView): Bom {
  const lines: BomLine[] = [];
  for (const p of view.parts) {
    const l = lines.find(x => { const q = view.parts.find(v => v.id === x.parts[0])!; return q.shape === p.shape && q.material === p.material; });
    if (l) { l.parts.push(p.id); l.qty++; l.massG = r6(l.massG + p.massG); } else lines.push({ item: p.name, parts: [p.id], qty: 1, material: p.material, massG: p.massG, source: p.library });
  }
  // (O142: each bought element merged by (kind, size, row): 2 copies of a part with 1 key — one line, ×2.)
  for (const e of view.elements ?? []) {
    const id = `${e.part}:${e.item}`, l = lines.find(x => x.kind === e.kind && x.size === e.size && (x.row ?? null) === e.row);
    if (l) { l.parts.push(id); l.qty++; l.massG = r6(l.massG + (e.massG ?? 0)); l.estimate = l.estimate || e.estimate; l.override = l.override || e.by === 'override'; }
    else lines.push({ item: `${e.kind} ${e.size}`, parts: [id], qty: 1, material: null, massG: e.massG ?? 0, source: e.source, kind: e.kind, size: e.size, row: e.row, estimate: e.estimate, override: e.by === 'override', ...(e.catalogue ? { catalogue: e.catalogue } : {}) });
  }
  return { lines, totalQty: view.parts.length, totalMassG: r6(view.parts.reduce((s, p) => s + p.massG, 0)), ...(view.elements?.length ? { elementQty: view.elements.length } : {}) };
}
