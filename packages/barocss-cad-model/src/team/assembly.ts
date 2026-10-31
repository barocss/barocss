import { resolveShopTree } from '../engine/shopRows';
// The Assembly integrator and the BOM agent (A8.4, O36). After a part's own gates (A8.2), the whole assembly is checked
// with the part as it would be: no two parts' bodies meet (exact on the meshes; within their chord tolerance of
// touching, undecided), every hole pattern still on every built part that shares it (a part moved since is caught),
// and the whole assembly within the total mass budget — so parts each under a share that is not fixed cannot sum past
// the total unnoticed. The BOM agent is read-only: given a built view of the assembly, it lists the parts; the BOM is
// checked against the assembly (every instance counted once, the totals), with a library part's source named.
import { hostOf } from '../engine/occurrences';
import { meshClearance } from '@barocss/cad';
import type { PartInstance, StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { Evaluate } from '../chat/tools';
import { massProperties } from '../analysis/analysis';
import { meshesMeet } from '../robot/sweep';
import { chordOf, measureBody } from '../chat/references';
import { holesOff, placedBodies, readInterfaces } from './parts';
import type { RoleReport } from './team';
import { bomViewOf, type Bom, type BomView } from '../bom/core';
import { beadAccounting, combineBeadAccounting, incompleteBeadReason, type BeadAccounting } from '../frames/beadAccounting';
import { r6 } from '../util/round';
import { evaluateTree } from '../assembly/instances';
import { looksDocOf, looksOf, lookTargetsOf } from '../assembly/looks';
import { placedBase } from '../engine/doc';
import { massGOf } from '../app/mass';
import { materialOf } from '../library/materials';
import { briefMaterial } from '../chat/brief';
import { r3 } from '../util/round';

export type AssemblyCode = 'PARTS_MEET' | 'PARTS_TOUCH' | 'EXPECTED_CONTACT' | 'PATTERN_MISALIGNED' | 'OVER_TOTAL_BUDGET' | 'BEAD_ACCOUNTING_INCOMPLETE';
export interface AssemblyFinding { code: AssemblyCode; message: string; entities?: string[] }
export interface AssemblyCheck { verdict: 'pass' | 'fail' | 'undecided'; findings: AssemblyFinding[]; /** Valid body subtotal when beadAccounting is incomplete. */ mass: number; beadAccounting?: BeadAccounting }

/** Every part's bodies where the assembly places them (the base part's as they are). */
export async function assemblyBodies(doc: StudioDoc, evaluate: Evaluate): Promise<Map<string, BodyResult[]>> {
  doc = resolveShopTree(doc);
  const out = new Map<string, BodyResult[]>(), base = await evaluate(doc);
  if (base?.ok && base.bodies.length) out.set('base', base.bodies);
  for (const inst of doc.instances ?? []) if (!inst.hidden) { const b = await placedBodies(inst, evaluate, doc); if (b.length) out.set(inst.id, b); }
  return out;
}
const massOf = (doc: StudioDoc, bodies: readonly BodyResult[]) => (massProperties(doc, bodies) as { mass: number }[]).reduce((s, x) => s + x.mass, 0);

/**
 * A placed part's mass: by its document's materials, with the occurrence's own looks over them (roadmap 10 ①). Overrides inside a
 * sub-assembly name nested parts, whose bodies carry folded keys: each body's material is then read through where it comes from.
 */
function occurrenceMass(inst: PartInstance, bodies: readonly BodyResult[], parent: StudioDoc): number {
  const nested = Object.keys(inst.looks ?? {}).some(k => k.includes('/'));
  if (!nested) return massOf(looksDocOf(inst), bodies);
  const looks = looksOf(inst, lookTargetsOf(inst, placedBase(inst, parent).nodes, bodies));
  return bodies.reduce((t, b, k) => t + (b.volume === null ? 0 : r3(massGOf(b.volume, materialOf(looks[k].material ?? briefMaterial(inst.doc)).density))), 0);
}

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
      else if (meshClearance(a.mesh.positions, a.mesh.indices, b.mesh.positions, b.mesh.indices).distance <= chord) {
        // (Contact is the normal state of an assembly where it is declared: a hole pattern the two share, or a mate
        // between them — expected, named, passed. Undeclared touching is not decided by the meshes: held.)
        const why = declaredContact(doc, ids[i], ids[j]);
        findings.push(why ? { code: 'EXPECTED_CONTACT', message: `${ids[i]} and ${ids[j]} touch, as ${why} puts them together`, entities: [ids[i], ids[j]] } : { code: 'PARTS_TOUCH', message: `${ids[i]} and ${ids[j]} touch (within their meshes' chord tolerance, ${chord.toPrecision(3)} mm) with no interface or mate that puts them together: not decided by the meshes`, entities: [ids[i], ids[j]] });
      }
    }
  }
  const ifc = readInterfaces(doc.interfaces);
  for (const p of ifc.holePatterns) for (const part of p.parts) { const b = parts.get(part); if (!b) continue; const off = holesOff(b, p); if (off.length) findings.push({ code: 'PATTERN_MISALIGNED', message: `${part} is off ${p.id} at ${off.map(o => `(${o.join(', ')})`).join(', ')}`, entities: [part] }); }
  let mass = 0;
  for (const [id, b] of parts) mass += id === 'base' ? massOf(doc, b) : occurrenceMass((doc.instances ?? []).find(i => i.id === id)!, b, doc);
  const accountingRows: { scope: string; accounting?: BeadAccounting }[] = [];
  const inspect = async (d: StudioDoc, scope: string) => {
    const e = await evaluate(d); accountingRows.push({ scope, accounting: beadAccounting(d, e?.ok ? e.bodies : []) });
    for (const i of d.instances ?? []) if (!i.hidden) await inspect(i.doc, `${scope}/${i.id}`);
  };
  await inspect(doc, 'base');
  const accounting = combineBeadAccounting(accountingRows);
  const incomplete = incompleteBeadReason(accounting);
  if (incomplete) findings.push({ code: 'BEAD_ACCOUNTING_INCOMPLETE', message: `${incomplete}; massG is a valid body subtotal only` });
  if (!incomplete && ifc.budgets.mass !== undefined && mass > ifc.budgets.mass + 1e-9) findings.push({ code: 'OVER_TOTAL_BUDGET', message: `the assembly weighs ${Number(mass.toPrecision(6))} g, over its ${ifc.budgets.mass} g` });
  const deciding = findings.filter(f => f.code !== 'EXPECTED_CONTACT');
  return { verdict: deciding.some(f => f.code !== 'PARTS_TOUCH' && f.code !== 'BEAD_ACCOUNTING_INCOMPLETE') ? 'fail' : deciding.length ? 'undecided' : 'pass', findings, mass, ...(accounting ? { beadAccounting: accounting } : {}) };
}

/** What declares two parts' contact: a hole pattern both share (its mating faces), or a mate between them; else null. */
export function declaredContact(doc: StudioDoc, a: string, b: string): string | null {
  const p = readInterfaces(doc.interfaces).holePatterns.find(x => x.parts.includes(a) && x.parts.includes(b));
  if (p) return `the hole pattern ${p.id}`;
  const m = (doc.mates ?? []).find(x => (hostOf(x.a.part) === a && hostOf(x.b.part) === b) || (hostOf(x.a.part) === b && hostOf(x.b.part) === a));
  return m ? `the mate ${m.id}` : null;
}

// ——— the BOM agent: read-only, on a built view
export { bomViewOf, deriveBom, type Bom, type BomLine, type BomView } from '../bom/core';
export interface BomRole { model: string; bom(view: BomView): Promise<Bom & RoleReport> }
/** The BOM agent's view: each part's name, material, mass, its library origin and a fingerprint of its shape — nothing to change. */
export async function bomView(doc: StudioDoc, evaluate: Evaluate): Promise<BomView> {
  doc = resolveShopTree(doc);
  // (Each document evaluated once, then the view built from the results: the same as bomViewOf with a synchronous evaluation.)
  const results = await evaluateTree(doc, evaluate);
  return bomViewOf(doc, d => results.get(d) ?? null);
}
/** The BOM checked against the assembly: every instance on one line once, each line's quantity its parts, the totals. */
export function checkBom(view: BomView, bom: Bom): string[] {
  const isBase = (l: Bom['lines'][number]) => l.parts.length > 0 && l.parts.every(p => p.startsWith('base:'));
  const out: string[] = [], seen = new Map<string, number>(), lines = bom.lines.filter(l => (l.kind === undefined || l.kind === 'fastener') && !l.plate && !l.member && !isBase(l)), bought = bom.lines.filter(l => l.kind !== undefined && l.kind !== 'fastener');
  if (JSON.stringify(view.beadAccounting) !== JSON.stringify(bom.beadAccounting)) out.push('bead accounting must retain the built view completeness and body subtotals');
  for (const l of bom.lines) if (l.qty !== l.parts.length) out.push(`${l.item}: quantity ${l.qty}, ${l.parts.length} parts`);
  for (const l of lines) for (const p of l.parts) seen.set(p, (seen.get(p) ?? 0) + 1);
  // (F9: a placed fastener's line is a part line, each of its parts that fastener — its size and row the line's, an estimate said.)
  for (const l of bom.lines) if (l.kind === 'fastener') for (const p of l.parts) {
    const f = view.parts.find(x => x.id === p)?.fastener;
    if (!f) out.push(`${l.item}: ${p} is no placed fastener`);
    else if (f.size !== l.size || f.row !== (l.row ?? null)) out.push(`${l.item}: ${p} is ${f.size}${f.row ? ` (row ${f.row})` : ''}, not this line's`);
    else if (f.estimate && !l.estimate) out.push(`${l.item}: ${p} is an estimate (${f.why.join('; ')}), the line does not say so`);
  }
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
    else if (x.kind !== l.plate.kind || x.thickness !== l.plate.thickness || x.area !== l.plate.area || x.material !== l.material) out.push(`${l.item}: ${p} is a ${x.kind} ${x.thickness} mm, ${x.area} mm², not this line's`);
  }
  for (const x of plates) if ((onPlate.get(`${x.part}:${x.item}`) ?? 0) !== 1) out.push(`${x.part}:${x.item} (${x.kind}) is on ${onPlate.get(`${x.part}:${x.item}`) ?? 0} plate lines, not one`);
  if (plates.length && bom.plateQty !== plates.length) out.push(`plates ${bom.plateQty ?? 0}, the assembly has ${plates.length}`);
  // (O169, F10: the base part's members, each piece on its cut-list row's line once — its section, length and material;
  // its other made bodies, each on a line of its own.)
  const rows = view.base?.members ?? [], onMember = new Map<string, number>();
  for (const l of bom.lines) if (l.member) for (const p of l.parts) {
    onMember.set(p, (onMember.get(p) ?? 0) + 1);
    const r = rows.find(m => m.pieces.some(k => `base:${k}` === p));
    if (!r) out.push(`${l.item}: ${p} is no frame member of the base part`);
    else if (r.section !== l.member.section || r.length !== l.member.length || r.material !== l.material) out.push(`${l.item}: ${p} is a ${r.section} × ${r.length}, not this line's`);
  }
  for (const r of rows) for (const k of r.pieces) if ((onMember.get(`base:${k}`) ?? 0) !== 1) out.push(`base:${k} (member) is on ${onMember.get(`base:${k}`) ?? 0} member lines, not one`);
  const others = view.base?.others ?? [];
  for (const l of bom.lines) if (!l.member && isBase(l) && !l.kind && !l.plate) for (const p of l.parts) if (!others.some(o => `base:${o.key}` === p)) out.push(`${l.item}: ${p} is no made body of the base part`);
  for (const o of others) if (bom.lines.filter(l => !l.member && l.parts.includes(`base:${o.key}`)).length !== 1) out.push(`base:${o.key} is not on one line`);
  for (const p of view.parts) if ((seen.get(p.id) ?? 0) !== 1) out.push(`${p.id} (${p.name}) is on ${seen.get(p.id) ?? 0} lines, not one`);
  for (const id of seen.keys()) if (!view.parts.some(p => p.id === id)) out.push(`${id} is not in the assembly`);
  // (D387: a sub-assembly's mass is rolled up its nested parts': the total is the top-level parts' once.)
  const topParts = view.parts.filter(p => p.parent === undefined), qty = topParts.length, mass = r6(topParts.reduce((s, p) => s + p.mass, 0) + (view.base?.mass ?? 0));
  if (bom.totalQty !== qty) out.push(`total quantity ${bom.totalQty}, the assembly has ${qty} parts`);
  if (Math.abs(bom.totalMass - mass) > 1e-6 * Math.max(1, mass)) out.push(`total mass ${bom.totalMass} g, the assembly weighs ${mass} g`);
  for (const l of lines) { const lib = view.parts.find(p => p.id === l.parts[0])?.library; if (lib && l.source !== lib) out.push(`${l.item}: a library part with no source (${lib})`); }
  return out;
}
