import { resolveShopTree } from '../engine/shopRows';
import { toPartDocument } from '../engine/part';
// The BOM's synchronous core (O147 B2, split from team/assembly.ts): the BOM agent's view of an assembly — each placed
// part's name, material, mass, library origin and shape fingerprint, and the bought machine elements — and the
// deterministic BOM derived from it. It imports nothing of the chat's tools, so the chat's drawings (chat/drawing.ts)
// read it without a cycle through them.
import type { PartInstance, StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import { massBoundOf, massProperties } from '../analysis/analysis';
import { materialIdOf } from '../app/bodies';
import { elementLines, madeBodies } from '../engine/elements';
import { partCutList } from '../app/cutList';
import { MATERIALS } from '../library/materials';
import { beadAccounting, combineBeadAccounting, type BeadAccounting } from '../frames/beadAccounting';
import { fastenerRowFor } from '../engine/fastenerRows';
import { r6 } from '../util/round';
import { looksDocOf } from '../assembly/looks';

// Equal feature text can resolve different local/parent rows. Compare the converted geometry for row-backed parts.
function shapeOf(doc: StudioDoc, evaluated: boolean): string {
  const backed = doc.nodes.some(n => ['bearing', 'oring-gland', 'oring', 'retaining-ring', 'sprocket', 'pulley', 'belt', 'coupling', 'connector-opening'].includes(n.kind) || ((n.kind === 'frame' || n.kind === 'frame-member') && (n.section.kind === 'library' || (n.kind === 'frame' && n.overrides?.some(o => o.section?.kind === 'library')))));
  return JSON.stringify(backed && evaluated ? toPartDocument(doc) : doc.nodes);
}
/**
 * A body's mass from its exact volume and its material's density (O169): its own massG is the default material's.
 * (V · ρ · 1e-3, not app/mass's massGOf V · ρ / 1000: the two round differently, and the BOM keeps its own.)
 */
const exactMass = (doc: StudioDoc, b: BodyResult): number | null => { const m = MATERIALS.find(x => x.id === materialIdOf(doc, b)); return b.volume === null || !m ? b.mass : r6(b.volume * m.density * 1e-3); };
const massOf = (doc: StudioDoc, bodies: readonly BodyResult[]) => (massProperties(doc, bodies) as { mass: number }[]).reduce((s, x) => s + x.mass, 0);
/** O179: a mass found partly from the mesh — its bound (g; null when a tessellated body has none) — or nothing when exact. */
/** O8: how many solids a part comes as, when a body of it is in several (lumps touching or apart): nothing otherwise. */
export const lumpsField = (bodies: readonly BodyResult[]): { lumps?: number } => bodies.some(b => (b.pieces ?? 1) > 1) ? { lumps: bodies.reduce((n, b) => n + (b.pieces ?? 1), 0) } : {};
export const massBoundField = (doc: StudioDoc, bodies: readonly BodyResult[]): { massBound?: number | null } => {
  if (!bodies.some(b => b.volumeBasis)) return {};
  const g = massBoundOf(doc, bodies);
  return { massBound: g === null ? null : r6(g) };
};
/** A placed fastener's bought line (F9): its kind, size and length as placed, and the person's row it is, if one is. */
export interface BomFastener { kind: string; size: string; row: string | null; source: string | null; estimate: boolean; why: string[]; catalogue?: string }
/** The fastener a placed part is (the fastener command's part of its own, its last node made by it), or null. */
function fastenerOfPart(doc: StudioDoc, inst: StudioDoc): BomFastener | null {
  const top = inst.nodes[inst.nodes.length - 1], made = top && 'made' in top ? top.made : undefined;
  if (!made || made.command !== 'fastener') return null;
  const kind = String(made.values.kind), size = String(made.values.size), threaded = kind !== 'hex-nut' && kind !== 'washer', length = threaded ? Number(made.values.length) : undefined;
  const row = fastenerRowFor(doc, kind, size, length), label = `${kind} ${size}${threaded ? ` × ${length}` : ''}`;
  const why = !row ? [`no fastener row for ${label}: what is bought is an estimate`] : row.estimate ? [`its row ${row.id} is an estimate`] : [];
  const catalogue = row && (row.partNumber || row.supplier) ? [row.partNumber, row.supplier].filter(Boolean).join(', ') : undefined;
  return { kind, size: row?.designation ?? label, row: row?.id ?? null, source: row?.source ?? null, estimate: why.length > 0, why, ...(catalogue ? { catalogue } : {}) };
}
export interface BomView {
  beadAccounting?: BeadAccounting;
  /** `massBound` (O179): the part's mass is partly from the mesh — how far it may be off (g), an estimate. */
  parts: { id: string; name: string; material: string | null; mass: number; massBound?: number | null; /** O8: the solids it comes as, when a body is in several. */ lumps?: number; library: string | null; shape: string; fastener?: BomFastener;
    /** D387: a sub-assembly (a placed part with parts of its own): its mass, bound and material roll up its own bodies and its shown nested parts'. */ assembly?: true;
    /** D387: a nested part's occurrence path (`sub1/p2`, also its id) and the path of the sub-assembly it is in. Top-level parts have neither. */ path?: string; parent?: string }[];
  /** The bought machine elements (O142): in the base part (`part: 'base'`) and in each placed part, one a body. */
  /** FRk1 (D165): the frame's plates made — gussets and end caps — one a body: their thickness, area, volume and material. */
  plates?: { part: string; item: string; kind: 'gusset' | 'end-cap'; thickness: number; area: number; volume: number; material: string | null; mass: number | null }[];
  elements?: { part: string; item: string; kind: string; size: string; row: string | null; source: string | null; estimate: boolean; why: string[]; by: 'override' | 'default'; mass: number | null; catalogue?: string }[];
  /**
   * O165's F10 (O169): an assembly's base part's own made bodies — its frame's members by cut-list row (section, length,
   * material), and any other made body — and the base part's whole mass (Σ volume · density, as a placed part's is).
   */
  base?: { members: { item: number; section: string; length: number; material: string | null; pieces: string[]; mass: number; massBound?: number | null }[]; others: { key: string; name: string; material: string | null; mass: number; massBound?: number | null; lumps?: number }[]; mass: number; massBound?: number | null };
}
export interface BomLine {
  item: string; parts: string[]; qty: number; material: string | null; mass: number; source: string | null;
  /** O179: a part's mass partly from the mesh: how far the line's may be off (g; null: unknown) — the line an estimate. */
  massBound?: number | null;
  /** O8: the solids a part comes as, when a body of it is in several (lumps touching or apart). */
  lumps?: number;
  /** A bought element's line (O142): its kind, sizes, the user's row, whether an estimate, and whether the person's override made it bought. `parts`: `part:feature` each. */
  kind?: string; size?: string; row?: string | null; estimate?: boolean; override?: boolean;
  /** A made plate's line (FRk1): its kind and sizes, merged by kind, thickness, area and material; `parts` `part:feature` each. */
  plate?: { kind: 'gusset' | 'end-cap'; thickness: number; area: number; volume: number }; /** Its catalogue number and supplier (a coupling's row). */ catalogue?: string;
  /** A frame member's line (O169): its cut-list row's section and long-point length; `parts` `base:body` each. */
  member?: { section: string; length: number };
  /** D387: a sub-assembly's line; its nested parts' lines follow it, each with the `level` below it (1, 2, …) and the `parent` path it is in. */
  assembly?: true; level?: number; parent?: string;
  /** D387: a nested line's quantity in one sub-assembly (its qty is that times the sub-assembly line's, counted once over its occurrences). */
  perParent?: number;
}
export interface Bom { lines: BomLine[]; totalQty: number; /** Valid body subtotal when beadAccounting is incomplete; not an approvable total. */ totalMass: number; /** O179: how far the total may be off (g; null: unknown), when any of it is from the mesh. */ totalMassBound?: number | null; beadAccounting?: BeadAccounting; /** The bought elements counted (their mass is their parts'). */ elementQty?: number; /** The plates counted (FRk1; their mass is their parts'). */ plateQty?: number }
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
  // (D387: a sub-assembly rolls its own bodies and its shown nested parts up; each nested part a part of its own, by path.)
  const all: { id: string; doc: StudioDoc; looks: StudioDoc }[] = [];
  // (Roadmap 10 ①: `host` is the top-level occurrence and `path` the nested part under it: the part's material and mass are read
  // from its document with that occurrence's own looks over it — the very document when none is set.)
  const place = (inst: PartInstance, id: string, parent: string | undefined, container: StudioDoc, host: PartInstance, path: readonly string[]): BomView['parts'][number] => {
    const e = evaluate(inst.doc), bodies = e?.ok ? e.bodies : [], looked = looksDocOf(host, path), own = r6(massOf(looked, bodies));
    const lib = inst.doc.nodes.find(n => n.kind === 'library') as { library?: { library?: string; version?: string; part?: string; variant?: string } } | undefined, o = lib?.library;
    // (F9: a fastener placed as its own part is bought, its row the person's.)
    // (D387: its rows are the containing sub-assembly's, as when that is opened alone.)
    const fastener = fastenerOfPart(container, inst.doc);
    const nested = inst.doc.instances?.length ? inst.doc.instances.filter(i => !i.hidden) : null;
    const entry: BomView['parts'][number] = { id, name: inst.name, material: bodies.length ? materialIdOf(looked, bodies[0]) ?? null : null, mass: own, ...massBoundField(looked, bodies), ...lumpsField(bodies), library: o ? `${o.library}@${o.version}/${o.part}${o.variant ? `:${o.variant}` : ''}` : null, shape: shapeOf(inst.doc, !!e?.ok), ...(fastener ? { fastener } : {}) };
    all.push({ id, doc: inst.doc, looks: looked });
    if (!inst.doc.instances?.length) { if (parent !== undefined) { entry.path = id; entry.parent = parent; } return entry; }
    const kids = (nested ?? []).map(n => ({ n, part: place(n, `${id}/${n.id}`, id, inst.doc, host, [...path, n.id]) }));
    const rolled = [entry.massBound, ...kids.map(k => k.part.massBound)].filter(b => b !== undefined);
    entry.mass = r6(own + kids.reduce((t, k) => t + k.part.mass, 0));
    if (rolled.length) entry.massBound = rolled.some(b => b === null) ? null : r6(rolled.reduce((t: number, b) => t + (b as number), 0));
    // (Two sub-assemblies are one line only when their nested parts, and where they sit, agree too.)
    entry.shape = JSON.stringify({ own: entry.shape, parts: kids.map(k => JSON.stringify([k.part.shape, k.part.material, k.n.position, k.n.rotation])).sort() });
    // (Sorted: the order the parts are listed in is not what makes two sub-assemblies alike.)
    entry.assembly = true;
    if (parent !== undefined) { entry.path = id; entry.parent = parent; }
    ordered.set(id, kids.map(k => k.part));
    return entry;
  };
  const ordered = new Map<string, BomView['parts']>();
  const push = (p: BomView['parts'][number]) => { parts.push(p); for (const k of ordered.get(p.id) ?? []) push(k); };
  for (const inst of doc.instances ?? []) push(place(inst, inst.id, undefined, doc, inst, []));
  // (O169, F10: an assembly's base part makes things too — a welded frame's members: its made bodies as lines, its mass
  // in the total. A part with no placed parts is its own one line (bom.ts), so this is only for an assembly.)
  let baseOwn: BomView['base'] | undefined;
  if (doc.instances?.length) {
    const e = evaluate(doc), bodies = e?.ok ? e.bodies : [], made = madeBodies(doc.nodes, bodies), list = partCutList(doc, made);
    const members = (list?.rows ?? []).map(r => {
      const pieces = [...r.pieces], first = bodies.find(b => b.key === pieces[0]);
      return { item: r.item, section: r.section, length: r6(r.longPoint), material: first ? materialIdOf(doc, first) ?? null : null, pieces, mass: r6(bodies.filter(b => pieces.includes(b.key)).reduce((t, b) => t + (exactMass(doc, b) ?? 0), 0)), ...massBoundField(doc, bodies.filter(b => pieces.includes(b.key))) };
    });
    // (Masses Σ volume · density by the document's materials (exactMass): a body's own massG is the default material's.)
    const others = made.filter(b => !b.cutPiece && !b.element).map(b => ({ key: b.key, name: b.key, material: materialIdOf(doc, b) ?? null, mass: exactMass(doc, b) ?? 0, ...massBoundField(doc, [b]), ...lumpsField([b]) }));
    if (bodies.length) baseOwn = { members, others, mass: r6(massOf(doc, bodies)), ...massBoundField(doc, bodies) };
  }
  // (O142: the bought elements — the base part's and each placed part's — as their own lines' material.)
  const elements: NonNullable<BomView['elements']> = [], plates: NonNullable<BomView['plates']> = [];
  const take = (part: string, d: StudioDoc, bodies: readonly BodyResult[], looked: StudioDoc = d) => {
    for (const b of bodies) {
      const e = b.element; if (!e || (e.kind !== 'gusset' && e.kind !== 'end-cap') || !b.ref) continue;
      const node = d.nodes[b.ref.node]; if (!node || node.bought === true) continue;
      plates.push({ part, item: node.id ?? `n${b.ref.node}`, kind: e.kind, thickness: r6(e.report.thickness), area: r6(e.report.area), volume: r6(e.report.volume), material: materialIdOf(looked, b) ?? null, mass: b.mass === null ? null : exactMass(looked, b) });
    }
    for (const l of elementLines(d, bodies)) if (l.bought) elements.push({ part, item: l.item, kind: l.kind, size: l.size, row: l.row?.id ?? null, source: l.row?.source ?? null, estimate: l.estimate, why: l.why, by: l.boughtBy, mass: l.mass === null ? null : r6(l.mass), ...(l.catalogue ? { catalogue: l.catalogue } : {}) });
  };
  const base = evaluate(doc); if (base?.ok) take('base', doc, base.bodies);
  for (const a of all) { const e = evaluate(a.doc); if (e?.ok) take(a.id, a.doc, e.bodies, a.looks); }
  return JSON.parse(JSON.stringify({ parts, ...(beads ? { beadAccounting: beads } : {}), ...(plates.length ? { plates } : {}), ...(elements.length ? { elements } : {}), ...(baseOwn ? { base: baseOwn } : {}) })) as BomView;
}
/** A line's mass bound with one more part's added (O179): null stays unknown; the line is an estimate. */
function withBound(l: BomLine, g: number | null): void {
  l.massBound = l.massBound === null || g === null ? null : r6((l.massBound ?? 0) + g);
  l.estimate = true;
}
/** The deterministic BOM: identical parts (same shape and material) on one line, in first-seen order. */
export function deriveBom(view: BomView): Bom {
  const lines: BomLine[] = [];
  // (D387: top-level parts only at first; a sub-assembly's nested parts follow its line, grouped the same way within it.)
  const top = view.parts.filter(p => p.parent === undefined), kids = new Map<string, BomView['parts']>();
  for (const p of view.parts) if (p.parent !== undefined) (kids.get(p.parent) ?? kids.set(p.parent, []).get(p.parent)!).push(p);
  const group = (list: BomView['parts'], level: number): BomLine[] => {
    const mine: { line: BomLine; occ: BomView['parts'] }[] = [];
    for (const p of list) {
      const m = mine.find(x => x.occ[0].shape === p.shape && x.occ[0].material === p.material), l = m?.line;
      if (m && l) { m.occ.push(p); l.parts.push(p.id); l.qty++; l.mass = r6(l.mass + p.mass); if (p.massBound !== undefined) withBound(l, p.massBound); continue; }
      let line: BomLine;
      if (p.fastener) { const f = p.fastener; line = { item: p.name, parts: [p.id], qty: 1, material: p.material, mass: p.mass, source: f.source, kind: 'fastener', size: f.size, row: f.row, estimate: f.estimate, ...(f.catalogue ? { catalogue: f.catalogue } : {}) }; }
      else line = { item: p.name, parts: [p.id], qty: 1, material: p.material, mass: p.mass, source: p.library, ...(p.massBound !== undefined ? { massBound: p.massBound, estimate: true } : {}), ...(p.lumps ? { lumps: p.lumps } : {}) };
      if (p.assembly) line.assembly = true;
      if (level > 0) { line.level = level; line.parent = p.parent; }
      mine.push({ line, occ: [p] });
    }
    // (Each sub-assembly line's nested lines straight after it: the nested parts of every occurrence it merges, each once.)
    return mine.flatMap(m => {
      if (!m.line.assembly) return [m.line];
      const sub = group(m.occ.flatMap(o => kids.get(o.id) ?? []), level + 1);
      for (const c of sub) if (c.level === level + 1) c.perParent = c.qty / m.occ.length;
      return [m.line, ...sub];
    });
  };
  lines.push(...group(top, 0));
  // (O169, F10: the base part's frame members, a line a cut-list row — section, length, material — then its other made
  // bodies, one line each, before the plates.)
  for (const m of view.base?.members ?? []) lines.push({ item: `${m.section} × ${+m.length.toFixed(3)}`, parts: m.pieces.map(k => `base:${k}`), qty: m.pieces.length, material: m.material, mass: m.mass, source: null, member: { section: m.section, length: m.length }, ...(m.massBound !== undefined ? { massBound: m.massBound, estimate: true } : {}) });
  for (const o of view.base?.others ?? []) lines.push({ item: o.name, parts: [`base:${o.key}`], qty: 1, material: o.material, mass: o.mass, source: null, ...(o.massBound !== undefined ? { massBound: o.massBound, estimate: true } : {}), ...(o.lumps ? { lumps: o.lumps } : {}) });
  // (FRk1: the made plates after the parts, merged by kind, thickness, area and material: four equal gussets one line ×4.)
  for (const p of view.plates ?? []) {
    const id = `${p.part}:${p.item}`, l = lines.find(x => x.plate && x.plate.kind === p.kind && x.plate.thickness === p.thickness && x.plate.area === p.area && x.material === p.material);
    if (l) { l.parts.push(id); l.qty++; l.mass = r6(l.mass + (p.mass ?? 0)); }
    else lines.push({ item: `${p.kind} plate ${+p.thickness.toFixed(3)} mm`, parts: [id], qty: 1, material: p.material, mass: p.mass ?? 0, source: null, size: `${+p.thickness.toFixed(3)} mm plate, ${+p.area.toFixed(3)} mm²`, plate: { kind: p.kind, thickness: p.thickness, area: p.area, volume: p.volume } });
  }
  // (O142: each bought element merged by (kind, size, row): 2 copies of a part with 1 key — one line, ×2.)
  for (const e of view.elements ?? []) {
    const id = `${e.part}:${e.item}`, l = lines.find(x => x.kind === e.kind && x.size === e.size && (x.row ?? null) === e.row);
    if (l) { l.parts.push(id); l.qty++; l.mass = r6(l.mass + (e.mass ?? 0)); l.estimate = l.estimate || e.estimate; l.override = l.override || e.by === 'override'; }
    else lines.push({ item: `${e.kind} ${e.size}`, parts: [id], qty: 1, material: null, mass: e.mass ?? 0, source: e.source, kind: e.kind, size: e.size, row: e.row, estimate: e.estimate, override: e.by === 'override', ...(e.catalogue ? { catalogue: e.catalogue } : {}) });
  }
  // (O179: the total's bound, when any mass in it is partly from the mesh: the parts' and the base part's.)
  const bounded = [...top.map(p => p.massBound), view.base?.massBound].filter(b => b !== undefined);
  const totalBound = bounded.length ? { totalMassBound: bounded.some(b => b === null) ? null : r6(bounded.reduce((t: number, b) => t + (b as number), 0)) } : {};
  return { lines, totalQty: top.length, totalMass: r6(top.reduce((s, p) => s + p.mass, 0) + (view.base?.mass ?? 0)), ...totalBound, ...(view.beadAccounting ? { beadAccounting: view.beadAccounting } : {}), ...(view.elements?.length ? { elementQty: view.elements.length } : {}), ...(view.plates?.length ? { plateQty: view.plates.length } : {}) };
}
