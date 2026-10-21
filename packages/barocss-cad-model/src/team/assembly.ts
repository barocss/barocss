// The Assembly integrator and the BOM agent (A8.4, O36). After a part's own gates (A8.2), the whole assembly is checked
// with the part as it would be: no two parts' bodies meet (exact on the meshes; within their chord tolerance of
// touching, undecided), every hole pattern still on every built part that shares it (a part moved since is caught),
// and the whole assembly within the total mass budget — so parts each under a share that is not fixed cannot sum past
// the total unnoticed. The BOM agent is read-only: given a built view of the assembly, it lists the parts; the BOM is
// checked against the assembly (every instance counted once, the totals), with a library part's source named.
import { meshClearance } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { Evaluate } from '../chat/tools';
import { massProperties } from '../chat/analysis';
import { materialIdOf } from '../app/bodies';
import { meshesMeet } from '../robot/sweep';
import { chordOf, measureBody } from '../chat/references';
import { holesOff, placedBodies, readInterfaces } from './parts';
import { elementLines } from '../engine/elements';
import type { RoleReport } from './team';

export type AssemblyCode = 'PARTS_MEET' | 'PARTS_TOUCH' | 'EXPECTED_CONTACT' | 'PATTERN_MISALIGNED' | 'OVER_TOTAL_BUDGET';
export interface AssemblyFinding { code: AssemblyCode; message: string; entities?: string[] }
export interface AssemblyCheck { verdict: 'pass' | 'fail' | 'undecided'; findings: AssemblyFinding[]; massG: number }

/** Every part's bodies where the assembly places them (the base part's as they are). */
export async function assemblyBodies(doc: StudioDoc, evaluate: Evaluate): Promise<Map<string, BodyResult[]>> {
  const out = new Map<string, BodyResult[]>(), base = await evaluate(doc);
  if (base?.ok && base.bodies.length) out.set('base', base.bodies);
  for (const inst of doc.instances ?? []) if (!inst.hidden) { const b = await placedBodies(inst, evaluate); if (b.length) out.set(inst.id, b); }
  return out;
}
const massOf = (doc: StudioDoc, bodies: readonly BodyResult[]) => (massProperties(doc, bodies) as { mass_g: number }[]).reduce((s, x) => s + x.mass_g, 0);

/** The whole assembly's gate: parts meeting, the patterns on every built part, the total mass. */
export async function checkAssembly(doc: StudioDoc, evaluate: Evaluate): Promise<AssemblyCheck> {
  const parts = await assemblyBodies(doc, evaluate), ids = [...parts.keys()], findings: AssemblyFinding[] = [];
  // (Freeform faces measured against their part's B-rep, O59: the chord a placed body keeps, its depth unmoved.)
  for (const id of ids) { const d = id === 'base' ? doc : doc.instances?.find(x => x.id === id)?.doc; if (d) for (const b of parts.get(id)!) measureBody(d, b); }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    for (const a of parts.get(ids[i])!) for (const b of parts.get(ids[j])!) {
      const A = a.mesh.bounds, B = b.mesh.bounds, chord = chordOf(a.mesh) + chordOf(b.mesh);
      if ([0, 1, 2].some(k => A.max[k] < B.min[k] - chord - 1e-6 || B.max[k] < A.min[k] - chord - 1e-6)) continue;
      if (meshesMeet(a.mesh.positions, a.mesh.indices, b.mesh.positions, b.mesh.indices)) findings.push({ code: 'PARTS_MEET', message: `${ids[i]} and ${ids[j]} interpenetrate`, entities: [ids[i], ids[j]] });
      else if (meshClearance(a.mesh.positions, a.mesh.indices, b.mesh.positions, b.mesh.indices).distanceMM <= chord) {
        // (Contact is the normal state of an assembly where it is declared: a hole pattern the two share, or a mate
        // between them — expected, named, passed. Undeclared touching is not decided by the meshes: held.)
        const why = declaredContact(doc, ids[i], ids[j]);
        findings.push(why ? { code: 'EXPECTED_CONTACT', message: `${ids[i]} and ${ids[j]} touch, as ${why} puts them together`, entities: [ids[i], ids[j]] } : { code: 'PARTS_TOUCH', message: `${ids[i]} and ${ids[j]} touch (within their meshes' chord tolerance, ${chord.toPrecision(3)} mm) with no interface or mate that puts them together: not decided by the meshes`, entities: [ids[i], ids[j]] });
      }
    }
  }
  const ifc = readInterfaces(doc.interfaces);
  for (const p of ifc.holePatterns) for (const part of p.parts) { const b = parts.get(part); if (!b) continue; const off = holesOff(b, p); if (off.length) findings.push({ code: 'PATTERN_MISALIGNED', message: `${part} is off ${p.id} at ${off.map(o => `(${o.join(', ')})`).join(', ')}`, entities: [part] }); }
  let massG = 0;
  for (const [id, b] of parts) massG += massOf(id === 'base' ? doc : (doc.instances ?? []).find(i => i.id === id)!.doc, b);
  if (ifc.budgets.massG !== undefined && massG > ifc.budgets.massG + 1e-9) findings.push({ code: 'OVER_TOTAL_BUDGET', message: `the assembly weighs ${Number(massG.toPrecision(6))} g, over its ${ifc.budgets.massG} g` });
  const deciding = findings.filter(f => f.code !== 'EXPECTED_CONTACT');
  return { verdict: deciding.some(f => f.code !== 'PARTS_TOUCH') ? 'fail' : deciding.length ? 'undecided' : 'pass', findings, massG };
}

/** What declares two parts' contact: a hole pattern both share (its mating faces), or a mate between them; else null. */
export function declaredContact(doc: StudioDoc, a: string, b: string): string | null {
  const p = readInterfaces(doc.interfaces).holePatterns.find(x => x.parts.includes(a) && x.parts.includes(b));
  if (p) return `the hole pattern ${p.id}`;
  const m = (doc.mates ?? []).find(x => (x.a.part === a && x.b.part === b) || (x.a.part === b && x.b.part === a));
  return m ? `the mate ${m.id}` : null;
}

// ——— the BOM agent: read-only, on a built view
export interface BomView {
  parts: { id: string; name: string; material: string | null; massG: number; library: string | null; shape: string }[];
  /** The bought machine elements (O142): in the base part (`part: 'base'`) and in each placed part, one a body. */
  elements?: { part: string; item: string; kind: string; size: string; row: string | null; source: string | null; estimate: boolean; why: string[]; by: 'override' | 'default'; massG: number | null }[];
}
export interface BomLine {
  item: string; parts: string[]; qty: number; material: string | null; massG: number; source: string | null;
  /** A bought element's line (O142): its kind, sizes, the user's row, whether an estimate, and whether the person's override made it bought. `parts`: `part:feature` each. */
  kind?: string; size?: string; row?: string | null; estimate?: boolean; override?: boolean;
}
export interface Bom { lines: BomLine[]; totalQty: number; totalMassG: number; /** The bought elements counted (their mass is their parts'). */ elementQty?: number }
export interface BomRole { model: string; bom(view: BomView): Promise<Bom & RoleReport> }
const r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
/** The BOM agent's view: each part's name, material, mass, its library origin and a fingerprint of its shape — nothing to change. */
export async function bomView(doc: StudioDoc, evaluate: Evaluate): Promise<BomView> {
  const parts: BomView['parts'] = [];
  for (const inst of doc.instances ?? []) {
    const e = await evaluate(inst.doc), bodies = e?.ok ? e.bodies : [];
    const lib = inst.doc.nodes.find(n => n.kind === 'library') as { library?: { library?: string; version?: string; part?: string; variant?: string } } | undefined, o = lib?.library;
    parts.push({ id: inst.id, name: inst.name, material: bodies.length ? materialIdOf(inst.doc, bodies[0]) ?? null : null, massG: r6(massOf(inst.doc, bodies)), library: o ? `${o.library}@${o.version}/${o.part}${o.variant ? `:${o.variant}` : ''}` : null, shape: JSON.stringify(inst.doc.nodes) });
  }
  // (O142: the bought elements — the base part's and each placed part's — as their own lines' material.)
  const elements: NonNullable<BomView['elements']> = [];
  const take = (part: string, d: StudioDoc, bodies: readonly BodyResult[]) => {
    for (const l of elementLines(d, bodies)) if (l.bought) elements.push({ part, item: l.item, kind: l.kind, size: l.size, row: l.row?.id ?? null, source: l.row?.source ?? null, estimate: l.estimate, why: l.why, by: l.boughtBy, massG: l.massG === null ? null : r6(l.massG) });
  };
  const base = await evaluate(doc); if (base?.ok) take('base', doc, base.bodies);
  for (const inst of doc.instances ?? []) { const e = await evaluate(inst.doc); if (e?.ok) take(inst.id, inst.doc, e.bodies); }
  return JSON.parse(JSON.stringify({ parts, ...(elements.length ? { elements } : {}) })) as BomView;
}
/** The BOM checked against the assembly: every instance on one line once, each line's quantity its parts, the totals. */
export function checkBom(view: BomView, bom: Bom): string[] {
  const out: string[] = [], seen = new Map<string, number>(), lines = bom.lines.filter(l => l.kind === undefined), bought = bom.lines.filter(l => l.kind !== undefined);
  for (const l of bom.lines) if (l.qty !== l.parts.length) out.push(`${l.item}: quantity ${l.qty}, ${l.parts.length} parts`);
  for (const l of lines) for (const p of l.parts) seen.set(p, (seen.get(p) ?? 0) + 1);
  // (O142: each bought element on one line once, its line's kind, size and row its own; the count.)
  const els = view.elements ?? [], on = new Map<string, number>();
  for (const l of bought) for (const p of l.parts) {
    on.set(p, (on.get(p) ?? 0) + 1);
    const e = els.find(x => `${x.part}:${x.item}` === p);
    if (!e) out.push(`${l.item}: ${p} is no bought element of the assembly`);
    else if (e.kind !== l.kind || e.size !== l.size || e.row !== (l.row ?? null)) out.push(`${l.item}: ${p} is a ${e.kind} ${e.size}${e.row ? ` (row ${e.row})` : ''}, not this line's`);
    else if (e.estimate && !l.estimate) out.push(`${l.item}: ${p} is an estimate (${e.why.join('; ')}), the line does not say so`);
  }
  for (const e of els) if ((on.get(`${e.part}:${e.item}`) ?? 0) !== 1) out.push(`${e.part}:${e.item} (${e.kind} ${e.size}) is on ${on.get(`${e.part}:${e.item}`) ?? 0} lines, not one`);
  if (els.length && bom.elementQty !== els.length) out.push(`bought elements ${bom.elementQty ?? 0}, the assembly has ${els.length}`);
  for (const p of view.parts) if ((seen.get(p.id) ?? 0) !== 1) out.push(`${p.id} (${p.name}) is on ${seen.get(p.id) ?? 0} lines, not one`);
  for (const id of seen.keys()) if (!view.parts.some(p => p.id === id)) out.push(`${id} is not in the assembly`);
  const qty = view.parts.length, mass = r6(view.parts.reduce((s, p) => s + p.massG, 0));
  if (bom.totalQty !== qty) out.push(`total quantity ${bom.totalQty}, the assembly has ${qty} parts`);
  if (Math.abs(bom.totalMassG - mass) > 1e-6 * Math.max(1, mass)) out.push(`total mass ${bom.totalMassG} g, the assembly weighs ${mass} g`);
  for (const l of lines) { const lib = view.parts.find(p => p.id === l.parts[0])?.library; if (lib && l.source !== lib) out.push(`${l.item}: a library part with no source (${lib})`); }
  return out;
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
    else lines.push({ item: `${e.kind} ${e.size}`, parts: [id], qty: 1, material: null, massG: e.massG ?? 0, source: e.source, kind: e.kind, size: e.size, row: e.row, estimate: e.estimate, override: e.by === 'override' });
  }
  return { lines, totalQty: view.parts.length, totalMassG: r6(view.parts.reduce((s, p) => s + p.massG, 0)), ...(view.elements?.length ? { elementQty: view.elements.length } : {}) };
}
