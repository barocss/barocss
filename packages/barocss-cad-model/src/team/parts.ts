// Multi-agent v3, part one (A8.2, O34): the Architect's `interfaces` — the assembly's contract — and Part agents working
// against it under leases. The interfaces hold datums and keep-outs (A6.3's, by id), hole patterns (positions in the
// assembly's frame, a diameter, the parts that share them), envelopes (a part's box) and budgets (mass, whole and per
// part), with a revision of their own. The Architect leases each part to one agent against the interfaces' revision; a
// Part agent's patch is ops on its part only, checked: its lease (NO_LEASE, LEASE_EXPIRED), the contract it was made on
// (CONTRACT_MOVED), its scope (OUT_OF_PART); then A7's validity and the part's contract — inside its envelope, its holes
// on its patterns (the exact cylinder's axis through each position, at the diameter), within its mass budget.
import { placedBase, type PartInstance, type StudioDoc } from '../engine/doc';
import { placeBody, type BodyResult } from '../engine/evaluate';
import { dispatchTool, type ChatState, type Evaluate } from '../chat/tools';
import type { Op } from '../engine/schema/proposals';
import { rotationMatrix } from '../engine/placement';
import { massProperties } from '../analysis/analysis';
import { revisionOf, type Decision, type GateResult, type RoleReport } from './team';
import { interfacesRevision, readInterfaces, type HolePattern, type Interfaces } from './interfaces';
import { checkAssembly } from './assembly';
import { beadAccounting, incompleteBeadReason } from '../frames/beadAccounting';

// (The interfaces' reader and revision live in team/interfaces.ts — no runner imports — so the bundle, baseline, ECR and
// freshness read them without importing the chat tools; re-exported here unchanged.)
export { readInterfaces, interfacesRevision, type HolePattern, type Envelope, type Interfaces } from './interfaces';

export interface Lease { part: string; holder: string; contract: string; until: number; /** The ECR whose approval left it on the old contract (A8.3): renewed by the Architect. */ expiredBy?: string }
export interface PartPatch { id: string; by: string; part: string; contract: string; ops: Op[] }
export type PartCode = 'PARTS_MEET' | 'PARTS_TOUCH' | 'EXPECTED_CONTACT' | 'PATTERN_MISALIGNED' | 'OVER_TOTAL_BUDGET' | 'BEAD_ACCOUNTING_INCOMPLETE' | 'NO_LEASE' | 'LEASE_EXPIRED' | 'CONTRACT_MOVED' | 'OUT_OF_PART' | 'OP_REFUSED' | 'NOT_EVALUATED' | 'OUT_OF_ENVELOPE' | 'HOLE_OFF_PATTERN' | 'OVER_BUDGET';
export interface PartTrace { seq: number; patch: PartPatch; decision: Decision; gates: (Omit<GateResult, 'gate' | 'findings'> & { gate: 'lease' | 'validity' | 'contract' | 'assembly'; findings: { code: PartCode | 'NOT_REACHED'; message: string; entities?: string[] }[] })[]; revisionAfter: string | null }

/** The tools that change the assembly itself, not a part: a Part agent may not use them. */
const ASSEMBLY_OPS = new Set(['add_part', 'place_part', 'delete_part', 'add_mate', 'edit_mate', 'delete_mate', 'insert_part', 'snap_part', 'set_joints']);
/** A part's bodies where the assembly places it — its own document unplaced and flattened (placedBase, O10: the keys every
 *  producer gives them, a sub-assembly's nested bodies among them), moved by the placement. */
export async function placedBodies(inst: PartInstance, evaluate: Evaluate, parent?: StudioDoc): Promise<BodyResult[]> {
  const r = await evaluate(placedBase(inst, parent));
  if (!r?.ok) return [];
  const m = rotationMatrix(inst.rotation) as unknown as number[];
  return r.bodies.map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, m, inst.position));
}
const TOL = 0.05;
/** The holes of a pattern a part's bodies do not have: no exact cylinder on its axis through the position, at its diameter. */
export function holesOff(bodies: readonly BodyResult[], p: HolePattern): [number, number, number][] {
  const a = p.axis, l = Math.hypot(...a), u = [a[0] / l, a[1] / l, a[2] / l];
  return p.positions.filter(pos => !bodies.some(b => b.mesh.faces.some(f => {
    const e = f.exact; if (e?.kind !== 'cylinder' || Math.abs(2 * e.r - p.diameter) > TOL) return false;
    const d = Math.abs(e.a[0] * u[0] + e.a[1] * u[1] + e.a[2] * u[2]); if (d < 1 - 1e-9) return false;
    const w = [pos[0] - e.c[0], pos[1] - e.c[1], pos[2] - e.c[2]], t = w[0] * e.a[0] + w[1] * e.a[1] + w[2] * e.a[2];
    return Math.hypot(w[0] - t * e.a[0], w[1] - t * e.a[1], w[2] - t * e.a[2]) <= TOL;
  })));
}

/** The part Integrator: a Part agent's patch under its lease, on its part only, against its contract. */
export async function integratePart(state: ChatState, patch: PartPatch, leases: ReadonlyMap<string, Lease>, evaluate: Evaluate, seq: number): Promise<{ state: ChatState; trace: PartTrace }> {
  const gates: PartTrace['gates'] = [], done = (decision: Decision, s = state) => ({ state: s, trace: { seq, patch, decision, gates, revisionAfter: decision === 'applied' ? revisionOf(s.doc) : null } });
  const stop = (gate: 'lease' | 'validity' | 'contract' | 'assembly', code: PartCode, message: string, entities?: string[]) => {
    gates.push({ gate, verdict: 'fail', findings: [{ code, message, ...(entities ? { entities } : {}) }] });
    for (const g of ['lease', 'validity', 'contract', 'assembly'] as const) if (!gates.some(x => x.gate === g)) gates.push({ gate: g, verdict: 'skipped', findings: [{ code: 'NOT_REACHED', message: 'not reached: an earlier gate failed' }] });
    return done(gate === 'lease' && (code === 'CONTRACT_MOVED' || code === 'LEASE_EXPIRED') ? 'stale' : 'rejected');
  };
  // (The lease: the holder's, in time, on the contract as it stands.)
  const lease = leases.get(patch.part), contract = interfacesRevision(state.doc);
  if (!lease || lease.holder !== patch.by) return stop('lease', 'NO_LEASE', lease ? `${patch.part} is leased to ${lease.holder}, not ${patch.by}` : `${patch.part} has no lease`);
  if (seq > lease.until) return stop('lease', 'LEASE_EXPIRED', `${patch.by}'s lease on ${patch.part} ran to ${lease.until}; this is ${seq}: the Architect renews it`);
  if (lease.contract !== contract || patch.contract !== contract) return stop('lease', 'CONTRACT_MOVED', `the interfaces are at ${contract}; the ${lease.contract !== contract ? 'lease' : 'patch'} was made on ${lease.contract !== contract ? lease.contract : patch.contract}: re-read them`);
  const out = patch.ops.find(op => ASSEMBLY_OPS.has(op.tool) || (op.args?.part !== undefined && op.args.part !== patch.part));
  if (out) return stop('lease', 'OUT_OF_PART', `${out.tool}${out.args?.part !== undefined ? ` on ${String(out.args.part)}` : ''}: ${patch.by} works on ${patch.part} only`);
  gates.push({ gate: 'lease', verdict: 'pass', findings: [] });
  // (Validity: the ops on the part, all or nothing.)
  const r = await dispatchTool(state, 'apply_ops', { ops: patch.ops.map(op => ({ ...op, args: { ...(op.args ?? {}), part: patch.part } })) }, evaluate);
  if (r.isError) { let m = r.content; try { m = JSON.parse(r.content).error; } catch { /* plain */ } return stop('validity', 'OP_REFUSED', m); }
  const inst = r.state.doc.instances?.find(i => i.id === patch.part);
  const bodies = inst ? await placedBodies(inst, evaluate, r.state.doc) : [];
  if (!inst || !bodies.length) return stop('validity', 'NOT_EVALUATED', `${patch.part} has no solid`);
  gates.push({ gate: 'validity', verdict: 'pass', findings: [] });
  // (The part's contract: its envelope, its hole patterns, its mass budget.)
  const ifc = readInterfaces(r.state.doc.interfaces), findings: PartTrace['gates'][number]['findings'] = [];
  const incomplete = incompleteBeadReason(beadAccounting(inst.doc, bodies));
  if (incomplete) findings.push({ code: 'BEAD_ACCOUNTING_INCOMPLETE', message: incomplete });
  for (const env of ifc.envelopes.filter(e => e.part === patch.part)) for (const b of bodies) {
    const { min, max } = b.mesh.bounds;
    if ([0, 1, 2].some(k => min[k] < env.min[k] - 1e-6 || max[k] > env.max[k] + 1e-6)) findings.push({ code: 'OUT_OF_ENVELOPE', message: `${patch.part}'s ${b.key} reaches [${min.map(v => +v.toFixed(3))}]–[${max.map(v => +v.toFixed(3))}], outside ${env.id} [${env.min}]–[${env.max}]`, entities: [b.key] });
  }
  for (const p of ifc.holePatterns.filter(x => x.parts.includes(patch.part))) { const off = holesOff(bodies, p); if (off.length) findings.push({ code: 'HOLE_OFF_PATTERN', message: `${patch.part} has no Ø${p.diameter} hole on ${p.id} at ${off.map(o => `(${o.join(', ')})`).join(', ')}` }); }
  const budget = ifc.budgets.parts?.[patch.part];
  if (!incomplete && budget !== undefined) { const g = (massProperties(inst.doc, bodies) as { mass: number }[]).reduce((s, x) => s + x.mass, 0); if (g > budget + 1e-9) findings.push({ code: 'OVER_BUDGET', message: `${patch.part} weighs ${Number(g.toPrecision(6))} g, over its ${budget} g` }); }
  gates.push({ gate: 'contract', verdict: findings.length ? 'fail' : 'pass', findings });
  if (findings.length) { gates.push({ gate: 'assembly', verdict: 'skipped', findings: [{ code: 'NOT_REACHED', message: 'not reached: an earlier gate failed' }] }); return done('rejected'); }
  // (The Assembly integrator, A8.4: the whole assembly with this part as it would be — parts meeting, every pattern on every built part, the total mass.)
  const whole = await checkAssembly(r.state.doc, evaluate);
  gates.push({ gate: 'assembly', verdict: whole.verdict, findings: whole.findings });
  return whole.verdict === 'fail' ? done('rejected') : whole.verdict === 'undecided' ? done('held') : done('applied', r.state);
}

// ——— roles and the run
export interface ArchitectRole { model: string; plan(view: { revision: string }): Promise<{ ops: Op[]; interfaces: Interfaces; leases: Omit<Lease, 'contract'>[] } & RoleReport> }
export interface PartView { part: string; contract: string; interfaces: Interfaces; lease: Lease | null; revision: string }
export interface PartAgentRole { name: string; part: string; model: string; propose(view: PartView): Promise<({ patch: Omit<PartPatch, 'by' | 'part' | 'contract'> & { contract?: string; part?: string } } | 'done') & RoleReport> }
export interface PartsRun { traces: PartTrace[]; final: StudioDoc; leases: Lease[]; accepted: number }
/** The Architect sets the assembly up (its ops), the interfaces and the leases; the Part agents then take turns, one patch a turn, until all are done or the budget. */
export async function runParts(start: ChatState, architect: ArchitectRole, agents: readonly PartAgentRole[], evaluate: Evaluate, o: { rounds?: number } = {}): Promise<PartsRun> {
  const plan = await architect.plan({ revision: revisionOf(start.doc) });
  const set = await dispatchTool(start, 'apply_ops', { ops: plan.ops }, evaluate);
  if (set.isError) throw new Error(`the Architect's setup was refused: ${set.content}`);
  let state: ChatState = { ...set.state, doc: { ...set.state.doc, interfaces: plan.interfaces } };
  const contract = interfacesRevision(state.doc), leases = new Map(plan.leases.map(l => [l.part, { ...l, contract }])), traces: PartTrace[] = [], finished = new Set<string>();
  let seq = 0;
  for (let round = 0; round < (o.rounds ?? 4) && finished.size < agents.length; round++) for (const a of agents) {
    if (finished.has(a.name)) continue;
    const p = await a.propose({ part: a.part, contract: interfacesRevision(state.doc), interfaces: readInterfaces(state.doc.interfaces), lease: leases.get(a.part) ?? null, revision: revisionOf(state.doc) });
    if (p === 'done' || !('patch' in p)) { finished.add(a.name); continue; }
    const out = await integratePart(state, { id: p.patch.id, by: a.name, part: p.patch.part ?? a.part, contract: p.patch.contract ?? interfacesRevision(state.doc), ops: p.patch.ops }, leases, evaluate, ++seq);
    traces.push(out.trace); state = out.state;
  }
  return { traces, final: state.doc, leases: [...leases.values()], accepted: traces.filter(t => t.decision === 'applied').length };
}
