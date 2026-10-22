import { resolveShopTree } from '../engine/shopRows';
import { bearingHousingRef } from '../engine/bearingContext';
// The Assembly integrator and the BOM agent (A8.4, O36). After a part's own gates (A8.2), the whole assembly is checked
// with the part as it would be: no two parts' bodies meet (exact on the meshes; within their chord tolerance of
// touching, undecided), every hole pattern still on every built part that shares it (a part moved since is caught),
// and the whole assembly within the total mass budget — so parts each under a share that is not fixed cannot sum past
// the total unnoticed. The BOM agent is read-only: given a built view of the assembly, it lists the parts; the BOM is
// checked against the assembly (every instance counted once, the totals), with a library part's source named.
import { meshClearance } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import type { Evaluate } from '../chat/tools';
import { massProperties } from '../chat/analysis';
import { meshesMeet } from '../robot/sweep';
import { chordOf, measureBody } from '../chat/references';
import { holesOff, placedBodies, readInterfaces } from './parts';
import type { RoleReport } from './team';
import { bomViewOf, type Bom, type BomView } from './bomCore';
import { beadAccounting, combineBeadAccounting, incompleteBeadReason, type BeadAccounting } from '../frames/beadAccounting';

export type AssemblyCode = 'PARTS_MEET' | 'PARTS_TOUCH' | 'EXPECTED_CONTACT' | 'PATTERN_MISALIGNED' | 'OVER_TOTAL_BUDGET' | 'BEAD_ACCOUNTING_INCOMPLETE';
export interface AssemblyFinding { code: AssemblyCode; message: string; entities?: string[] }
export interface AssemblyCheck { verdict: 'pass' | 'fail' | 'undecided'; findings: AssemblyFinding[]; /** Valid body subtotal when beadAccounting is incomplete. */ massG: number; beadAccounting?: BeadAccounting }

/** Every part's bodies where the assembly places them (the base part's as they are). */
export async function assemblyBodies(doc: StudioDoc, evaluate: Evaluate): Promise<Map<string, BodyResult[]>> {
  doc = resolveShopTree(doc);
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
  const accountingRows: { scope: string; accounting?: BeadAccounting }[] = [];
  const inspect = async (d: StudioDoc, scope: string) => {
    const e = await evaluate(d); accountingRows.push({ scope, accounting: beadAccounting(d, e?.ok ? e.bodies : []) });
    for (const i of d.instances ?? []) if (!i.hidden) await inspect(i.doc, `${scope}/${i.id}`);
  };
  await inspect(doc, 'base');
  const accounting = combineBeadAccounting(accountingRows);
  const incomplete = incompleteBeadReason(accounting);
  if (incomplete) findings.push({ code: 'BEAD_ACCOUNTING_INCOMPLETE', message: `${incomplete}; massG is a valid body subtotal only` });
  if (!incomplete && ifc.budgets.massG !== undefined && massG > ifc.budgets.massG + 1e-9) findings.push({ code: 'OVER_TOTAL_BUDGET', message: `the assembly weighs ${Number(massG.toPrecision(6))} g, over its ${ifc.budgets.massG} g` });
  const deciding = findings.filter(f => f.code !== 'EXPECTED_CONTACT');
  return { verdict: deciding.some(f => f.code !== 'PARTS_TOUCH' && f.code !== 'BEAD_ACCOUNTING_INCOMPLETE') ? 'fail' : deciding.length ? 'undecided' : 'pass', findings, massG, ...(accounting ? { beadAccounting: accounting } : {}) };
}

/** What declares two parts' contact: a hole pattern both share (its mating faces), or a mate between them; else null. */
export function declaredContact(doc: StudioDoc, a: string, b: string): string | null {
  const p = readInterfaces(doc.interfaces).holePatterns.find(x => x.parts.includes(a) && x.parts.includes(b));
  if (p) return `the hole pattern ${p.id}`;
  const m = (doc.mates ?? []).find(x => (x.a.part === a && x.b.part === b) || (x.a.part === b && x.b.part === a));
  return m ? `the mate ${m.id}` : null;
}

// ——— the BOM agent: read-only, on a built view
export { bomViewOf, deriveBom, type Bom, type BomLine, type BomView } from './bomCore';
export interface BomRole { model: string; bom(view: BomView): Promise<Bom & RoleReport> }
const r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
/** The BOM agent's view: each part's name, material, mass, its library origin and a fingerprint of its shape — nothing to change. */
export async function bomView(doc: StudioDoc, evaluate: Evaluate): Promise<BomView> {
  doc = resolveShopTree(doc);
  // (Each document evaluated once, then the view built from the results: the same as bomViewOf with a synchronous evaluation.)
  const results = new Map<StudioDoc, EvalResult | null>();
  const inspect = async (d: StudioDoc): Promise<void> => {
    if (results.has(d)) return;
    const result = await evaluate(d);
    if (!result?.ok && d.nodes.some(n => !n.suppressed && bearingHousingRef(n))) throw new Error(`[BEARING_HOUSING_EVALUATION] ${result ? JSON.stringify(result.error) : 'no evaluation result'}`);
    results.set(d, result); for (const i of d.instances ?? []) await inspect(i.doc);
  };
  await inspect(doc);
  return bomViewOf(doc, d => results.get(d) ?? null);
}
/** The BOM checked against the assembly: every instance on one line once, each line's quantity its parts, the totals. */
export function checkBom(view: BomView, bom: Bom): string[] {
  const out: string[] = [], seen = new Map<string, number>(), lines = bom.lines.filter(l => l.kind === undefined && !l.plate), bought = bom.lines.filter(l => l.kind !== undefined);
  if (JSON.stringify(view.beadAccounting) !== JSON.stringify(bom.beadAccounting)) out.push('bead accounting must retain the built view completeness and body subtotals');
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
  // (FRk1: each made plate on one plate line once, the line's kind and sizes its own; the count.)
  const plates = view.plates ?? [], onPlate = new Map<string, number>();
  for (const l of bom.lines) if (l.plate) for (const p of l.parts) {
    onPlate.set(p, (onPlate.get(p) ?? 0) + 1);
    const x = plates.find(q => `${q.part}:${q.item}` === p);
    if (!x) out.push(`${l.item}: ${p} is no plate of the assembly`);
    else if (x.kind !== l.plate.kind || x.thicknessMM !== l.plate.thicknessMM || x.areaMM2 !== l.plate.areaMM2 || x.material !== l.material) out.push(`${l.item}: ${p} is a ${x.kind} ${x.thicknessMM} mm, ${x.areaMM2} mm², not this line's`);
  }
  for (const x of plates) if ((onPlate.get(`${x.part}:${x.item}`) ?? 0) !== 1) out.push(`${x.part}:${x.item} (${x.kind}) is on ${onPlate.get(`${x.part}:${x.item}`) ?? 0} plate lines, not one`);
  if (plates.length && bom.plateQty !== plates.length) out.push(`plates ${bom.plateQty ?? 0}, the assembly has ${plates.length}`);
  for (const p of view.parts) if ((seen.get(p.id) ?? 0) !== 1) out.push(`${p.id} (${p.name}) is on ${seen.get(p.id) ?? 0} lines, not one`);
  for (const id of seen.keys()) if (!view.parts.some(p => p.id === id)) out.push(`${id} is not in the assembly`);
  const qty = view.parts.length, mass = r6(view.parts.reduce((s, p) => s + p.massG, 0));
  if (bom.totalQty !== qty) out.push(`total quantity ${bom.totalQty}, the assembly has ${qty} parts`);
  if (Math.abs(bom.totalMassG - mass) > 1e-6 * Math.max(1, mass)) out.push(`total mass ${bom.totalMassG} g, the assembly weighs ${mass} g`);
  for (const l of lines) { const lib = view.parts.find(p => p.id === l.parts[0])?.library; if (lib && l.source !== lib) out.push(`${l.item}: a library part with no source (${lib})`); }
  return out;
}
