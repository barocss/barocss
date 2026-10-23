import { resolveShopTree } from '../engine/shopRows';
import { toPartDocument } from '../engine/part';
// The BOM's synchronous core (O147 B2, split from team/assembly.ts): the BOM agent's view of an assembly — each placed
// part's name, material, mass, library origin and shape fingerprint, and the bought machine elements — and the
// deterministic BOM derived from it. It imports nothing of the chat's tools, so the chat's drawings (chat/drawing.ts)
// read it without a cycle through them.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import { massBoundOf, massProperties } from '../chat/analysis';
import { materialIdOf } from '../app/bodies';
import { elementLines, madeBodies } from '../engine/elements';
import { partCutList } from '../app/cutList';
import { MATERIALS } from '../library/materials';
import { beadAccounting, combineBeadAccounting, type BeadAccounting } from '../frames/beadAccounting';
import { fastenerRowFor } from '../engine/fastenerRows';
import { r6 } from '../util/round';

// Equal feature text can resolve different local/parent rows. Compare the converted geometry for row-backed parts.
function shapeOf(doc: StudioDoc, evaluated: boolean): string {
  const backed = doc.nodes.some(n => ['bearing', 'oring-gland', 'oring', 'retaining-ring', 'sprocket', 'pulley', 'belt', 'coupling', 'connector-opening'].includes(n.kind) || ((n.kind === 'frame' || n.kind === 'frame-member') && (n.section.kind === 'library' || (n.kind === 'frame' && n.overrides?.some(o => o.section?.kind === 'library')))));
  return JSON.stringify(backed && evaluated ? toPartDocument(doc) : doc.nodes);
}
/**
 * A body's mass from its exact volume and its material's density (O169): its own massG is the default material's.
 * (V · ρ · 1e-3, not app/mass's massGOf V · ρ / 1000: the two round differently, and the BOM keeps its own.)
 */
const exactMass = (doc: StudioDoc, b: BodyResult): number | null => { const m = MATERIALS.find(x => x.id === materialIdOf(doc, b)); return b.volumeMM3 === null || !m ? b.massG : r6(b.volumeMM3 * m.gPerCm3 * 1e-3); };
const massOf = (doc: StudioDoc, bodies: readonly BodyResult[]) => (massProperties(doc, bodies) as { mass_g: number }[]).reduce((s, x) => s + x.mass_g, 0);
/** O179: a mass found partly from the mesh — its bound (g; null when a tessellated body has none) — or nothing when exact. */
/** O8: how many solids a part comes as, when a body of it is in several (lumps touching or apart): nothing otherwise. */
export const lumpsField = (bodies: readonly BodyResult[]): { lumps?: number } => bodies.some(b => (b.pieces ?? 1) > 1) ? { lumps: bodies.reduce((n, b) => n + (b.pieces ?? 1), 0) } : {};
export const massBoundField = (doc: StudioDoc, bodies: readonly BodyResult[]): { massBoundG?: number | null } => {
  if (!bodies.some(b => b.volumeBasis)) return {};
  const g = massBoundOf(doc, bodies);
  return { massBoundG: g === null ? null : r6(g) };
};
/** A placed fastener's bought line (F9): its kind, size and length as placed, and the person's row it is, if one is. */
export interface BomFastener { kind: string; size: string; row: string | null; source: string | null; estimate: boolean; why: string[]; catalogue?: string }
/** The fastener a placed part is (the fastener command's part of its own, its last node made by it), or null. */
function fastenerOfPart(doc: StudioDoc, inst: StudioDoc): BomFastener | null {
  const top = inst.nodes[inst.nodes.length - 1], made = top && 'made' in top ? top.made : undefined;
  if (!made || made.command !== 'fastener') return null;
  const kind = String(made.values.kind), size = String(made.values.size), threaded = kind !== 'hex-nut' && kind !== 'washer', lengthMM = threaded ? Number(made.values.length) : undefined;
  const row = fastenerRowFor(doc, kind, size, lengthMM), label = `${kind} ${size}${threaded ? ` × ${lengthMM}` : ''}`;
  const why = !row ? [`no fastener row for ${label}: what is bought is an estimate`] : row.estimate ? [`its row ${row.id} is an estimate`] : [];
  const catalogue = row && (row.partNumber || row.supplier) ? [row.partNumber, row.supplier].filter(Boolean).join(', ') : undefined;
  return { kind, size: row?.designation ?? label, row: row?.id ?? null, source: row?.source ?? null, estimate: why.length > 0, why, ...(catalogue ? { catalogue } : {}) };
}
export interface BomView {
  beadAccounting?: BeadAccounting;
  /** `massBoundG` (O179): the part's mass is partly from the mesh — how far it may be off (g), an estimate. */
  parts: { id: string; name: string; material: string | null; massG: number; massBoundG?: number | null; /** O8: the solids it comes as, when a body is in several. */ lumps?: number; library: string | null; shape: string; fastener?: BomFastener }[];
  /** The bought machine elements (O142): in the base part (`part: 'base'`) and in each placed part, one a body. */
  /** FRk1 (D165): the frame's plates made — gussets and end caps — one a body: their thickness, area, volume and material. */
  plates?: { part: string; item: string; kind: 'gusset' | 'end-cap'; thicknessMM: number; areaMM2: number; volumeMM3: number; material: string | null; massG: number | null }[];
  elements?: { part: string; item: string; kind: string; size: string; row: string | null; source: string | null; estimate: boolean; why: string[]; by: 'override' | 'default'; massG: number | null; catalogue?: string }[];
  /**
   * O165's F10 (O169): an assembly's base part's own made bodies — its frame's members by cut-list row (section, length,
   * material), and any other made body — and the base part's whole mass (Σ volume · density, as a placed part's is).
   */
  base?: { members: { item: number; section: string; lengthMM: number; material: string | null; pieces: string[]; massG: number; massBoundG?: number | null }[]; others: { key: string; name: string; material: string | null; massG: number; massBoundG?: number | null; lumps?: number }[]; massG: number; massBoundG?: number | null };
}
export interface BomLine {
  item: string; parts: string[]; qty: number; material: string | null; massG: number; source: string | null;
  /** O179: a part's mass partly from the mesh: how far the line's may be off (g; null: unknown) — the line an estimate. */
  massBoundG?: number | null;
  /** O8: the solids a part comes as, when a body of it is in several (lumps touching or apart). */
  lumps?: number;
  /** A bought element's line (O142): its kind, sizes, the user's row, whether an estimate, and whether the person's override made it bought. `parts`: `part:feature` each. */
  kind?: string; size?: string; row?: string | null; estimate?: boolean; override?: boolean;
  /** A made plate's line (FRk1): its kind and sizes, merged by kind, thickness, area and material; `parts` `part:feature` each. */
  plate?: { kind: 'gusset' | 'end-cap'; thicknessMM: number; areaMM2: number; volumeMM3: number }; /** Its catalogue number and supplier (a coupling's row). */ catalogue?: string;
  /** A frame member's line (O169): its cut-list row's section and long-point length; `parts` `base:body` each. */
  member?: { section: string; lengthMM: number };
}
export interface Bom { lines: BomLine[]; totalQty: number; /** Valid body subtotal when beadAccounting is incomplete; not an approvable total. */ totalMassG: number; /** O179: how far the total may be off (g; null: unknown), when any of it is from the mesh. */ totalMassBoundG?: number | null; beadAccounting?: BeadAccounting; /** The bought elements counted (their mass is their parts'). */ elementQty?: number; /** The plates counted (FRk1; their mass is their parts'). */ plateQty?: number }
/** The BOM agent's view from evaluations given at once (O147: the chat's drawings build it synchronously). */
export function bomViewOf(doc: StudioDoc, evaluate: (doc: StudioDoc) => EvalResult | null): BomView {
  doc = resolveShopTree(doc);
  const parts: BomView['parts'] = [];
  const accounting: { scope: string; accounting?: BeadAccounting }[] = [];
  const inspect = (d: StudioDoc, scope: string) => {
    const e = evaluate(d); accounting.push({ scope, accounting: beadAccounting(d, e?.ok ? e.bodies : []) });
    for (const i of d.instances ?? []) inspect(i.doc, `${scope}/${i.id}`);
  };
  inspect(doc, 'base');
  const beads = combineBeadAccounting(accounting);
  for (const inst of doc.instances ?? []) {
    const e = evaluate(inst.doc), bodies = e?.ok ? e.bodies : [];
    const lib = inst.doc.nodes.find(n => n.kind === 'library') as { library?: { library?: string; version?: string; part?: string; variant?: string } } | undefined, o = lib?.library;
    // (F9: a fastener placed as its own part is bought, its row the person's.)
    const fastener = fastenerOfPart(doc, inst.doc);
    parts.push({ id: inst.id, name: inst.name, material: bodies.length ? materialIdOf(inst.doc, bodies[0]) ?? null : null, massG: r6(massOf(inst.doc, bodies)), ...massBoundField(inst.doc, bodies), ...lumpsField(bodies), library: o ? `${o.library}@${o.version}/${o.part}${o.variant ? `:${o.variant}` : ''}` : null, shape: shapeOf(inst.doc, !!e?.ok), ...(fastener ? { fastener } : {}) });
  }
  // (O169, F10: an assembly's base part makes things too — a welded frame's members: its made bodies as lines, its mass
  // in the total. A part with no placed parts is its own one line (bom.ts), so this is only for an assembly.)
  let baseOwn: BomView['base'] | undefined;
  if (doc.instances?.length) {
    const e = evaluate(doc), bodies = e?.ok ? e.bodies : [], made = madeBodies(doc.nodes, bodies), list = partCutList(doc, made);
    const members = (list?.rows ?? []).map(r => {
      const pieces = [...r.pieces], first = bodies.find(b => b.key === pieces[0]);
      return { item: r.item, section: r.section, lengthMM: r6(r.longPointMM), material: first ? materialIdOf(doc, first) ?? null : null, pieces, massG: r6(bodies.filter(b => pieces.includes(b.key)).reduce((t, b) => t + (exactMass(doc, b) ?? 0), 0)), ...massBoundField(doc, bodies.filter(b => pieces.includes(b.key))) };
    });
    // (Masses Σ volume · density by the document's materials (exactMass): a body's own massG is the default material's.)
    const others = made.filter(b => !b.cutPiece && !b.element).map(b => ({ key: b.key, name: b.key, material: materialIdOf(doc, b) ?? null, massG: exactMass(doc, b) ?? 0, ...massBoundField(doc, [b]), ...lumpsField([b]) }));
    if (bodies.length) baseOwn = { members, others, massG: r6(massOf(doc, bodies)), ...massBoundField(doc, bodies) };
  }
  // (O142: the bought elements — the base part's and each placed part's — as their own lines' material.)
  const elements: NonNullable<BomView['elements']> = [], plates: NonNullable<BomView['plates']> = [];
  const take = (part: string, d: StudioDoc, bodies: readonly BodyResult[]) => {
    for (const b of bodies) {
      const e = b.element; if (!e || (e.kind !== 'gusset' && e.kind !== 'end-cap') || !b.ref) continue;
      const node = d.nodes[b.ref.node]; if (!node || node.bought === true) continue;
      plates.push({ part, item: node.id ?? `n${b.ref.node}`, kind: e.kind, thicknessMM: r6(e.report.thicknessMM), areaMM2: r6(e.report.areaMM2), volumeMM3: r6(e.report.volumeMM3), material: materialIdOf(d, b) ?? null, massG: b.massG === null ? null : exactMass(d, b) });
    }
    for (const l of elementLines(d, bodies)) if (l.bought) elements.push({ part, item: l.item, kind: l.kind, size: l.size, row: l.row?.id ?? null, source: l.row?.source ?? null, estimate: l.estimate, why: l.why, by: l.boughtBy, massG: l.massG === null ? null : r6(l.massG), ...(l.catalogue ? { catalogue: l.catalogue } : {}) });
  };
  const base = evaluate(doc); if (base?.ok) take('base', doc, base.bodies);
  for (const inst of doc.instances ?? []) { const e = evaluate(inst.doc); if (e?.ok) take(inst.id, inst.doc, e.bodies); }
  return JSON.parse(JSON.stringify({ parts, ...(beads ? { beadAccounting: beads } : {}), ...(plates.length ? { plates } : {}), ...(elements.length ? { elements } : {}), ...(baseOwn ? { base: baseOwn } : {}) })) as BomView;
}
/** A line's mass bound with one more part's added (O179): null stays unknown; the line is an estimate. */
function withBound(l: BomLine, g: number | null): void {
  l.massBoundG = l.massBoundG === null || g === null ? null : r6((l.massBoundG ?? 0) + g);
  l.estimate = true;
}
/** The deterministic BOM: identical parts (same shape and material) on one line, in first-seen order. */
export function deriveBom(view: BomView): Bom {
  const lines: BomLine[] = [];
  for (const p of view.parts) {
    const l = lines.find(x => { const q = view.parts.find(v => v.id === x.parts[0])!; return q.shape === p.shape && q.material === p.material; });
    if (l) { l.parts.push(p.id); l.qty++; l.massG = r6(l.massG + p.massG); if (p.massBoundG !== undefined) withBound(l, p.massBoundG); }
    else if (p.fastener) { const f = p.fastener; lines.push({ item: p.name, parts: [p.id], qty: 1, material: p.material, massG: p.massG, source: f.source, kind: 'fastener', size: f.size, row: f.row, estimate: f.estimate, ...(f.catalogue ? { catalogue: f.catalogue } : {}) }); }
    else lines.push({ item: p.name, parts: [p.id], qty: 1, material: p.material, massG: p.massG, source: p.library, ...(p.massBoundG !== undefined ? { massBoundG: p.massBoundG, estimate: true } : {}), ...(p.lumps ? { lumps: p.lumps } : {}) });
  }
  // (O169, F10: the base part's frame members, a line a cut-list row — section, length, material — then its other made
  // bodies, one line each, before the plates.)
  for (const m of view.base?.members ?? []) lines.push({ item: `${m.section} × ${+m.lengthMM.toFixed(3)}`, parts: m.pieces.map(k => `base:${k}`), qty: m.pieces.length, material: m.material, massG: m.massG, source: null, member: { section: m.section, lengthMM: m.lengthMM }, ...(m.massBoundG !== undefined ? { massBoundG: m.massBoundG, estimate: true } : {}) });
  for (const o of view.base?.others ?? []) lines.push({ item: o.name, parts: [`base:${o.key}`], qty: 1, material: o.material, massG: o.massG, source: null, ...(o.massBoundG !== undefined ? { massBoundG: o.massBoundG, estimate: true } : {}), ...(o.lumps ? { lumps: o.lumps } : {}) });
  // (FRk1: the made plates after the parts, merged by kind, thickness, area and material: four equal gussets one line ×4.)
  for (const p of view.plates ?? []) {
    const id = `${p.part}:${p.item}`, l = lines.find(x => x.plate && x.plate.kind === p.kind && x.plate.thicknessMM === p.thicknessMM && x.plate.areaMM2 === p.areaMM2 && x.material === p.material);
    if (l) { l.parts.push(id); l.qty++; l.massG = r6(l.massG + (p.massG ?? 0)); }
    else lines.push({ item: `${p.kind} plate ${+p.thicknessMM.toFixed(3)} mm`, parts: [id], qty: 1, material: p.material, massG: p.massG ?? 0, source: null, size: `${+p.thicknessMM.toFixed(3)} mm plate, ${+p.areaMM2.toFixed(3)} mm²`, plate: { kind: p.kind, thicknessMM: p.thicknessMM, areaMM2: p.areaMM2, volumeMM3: p.volumeMM3 } });
  }
  // (O142: each bought element merged by (kind, size, row): 2 copies of a part with 1 key — one line, ×2.)
  for (const e of view.elements ?? []) {
    const id = `${e.part}:${e.item}`, l = lines.find(x => x.kind === e.kind && x.size === e.size && (x.row ?? null) === e.row);
    if (l) { l.parts.push(id); l.qty++; l.massG = r6(l.massG + (e.massG ?? 0)); l.estimate = l.estimate || e.estimate; l.override = l.override || e.by === 'override'; }
    else lines.push({ item: `${e.kind} ${e.size}`, parts: [id], qty: 1, material: null, massG: e.massG ?? 0, source: e.source, kind: e.kind, size: e.size, row: e.row, estimate: e.estimate, override: e.by === 'override', ...(e.catalogue ? { catalogue: e.catalogue } : {}) });
  }
  // (O179: the total's bound, when any mass in it is partly from the mesh: the parts' and the base part's.)
  const bounded = [...view.parts.map(p => p.massBoundG), view.base?.massBoundG].filter(b => b !== undefined);
  const totalBound = bounded.length ? { totalMassBoundG: bounded.some(b => b === null) ? null : r6(bounded.reduce((t: number, b) => t + (b as number), 0)) } : {};
  return { lines, totalQty: view.parts.length, totalMassG: r6(view.parts.reduce((s, p) => s + p.massG, 0) + (view.base?.massG ?? 0)), ...totalBound, ...(view.beadAccounting ? { beadAccounting: view.beadAccounting } : {}), ...(view.elements?.length ? { elementQty: view.elements.length } : {}), ...(view.plates?.length ? { plateQty: view.plates.length } : {}) };
}
