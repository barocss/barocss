// Scripted roles (A7, O31): the deterministic stand-ins that drive the team's core in tests, fixtures and `cad-cli team`.
// A scenario names the start (a document, else an empty part), the Requirements role's ops, the Designer's steps (a
// patch, "done", or "rebase" — the last patch made again on the current revision, explicitly) and the Verifier's rules
// (checks of the view it is given: the total mass, a body's box). Live roles (model adapters) take their place in the
// comparison the owner is to approve (O30).
import type { StudioDoc } from '../engine/doc';
import { emptyDoc } from '../engine/doc';
import type { ChatState, Evaluate } from '../chat/tools';
import type { Op } from '../chat/proposals';
import { rebase, runTeam, type DesignerRole, type DrafterRole, type Patch, type RequirementsRole, type ReviewerName, type ReviewerRole, type ReviewView, type TeamRun, type VerifierRole, type VerifierView } from './team';

export type DesignerStep = { patch: { id: string; ops: Op[]; rationale?: string; /** "stale": made on an old revision (a fixed one no part has). */ base?: 'stale'; /** Kept against soft findings, because… */ keep?: string } } | 'done' | 'rebase';
export type VerifierRule = { kind: 'max_mass_g'; value: number } | { kind: 'max_size'; axis: 'x' | 'y' | 'z'; value: number } | { kind: 'min_bodies'; value: number };
/** A reviewer's rules (A8.1): DFM — a printability rule at a status (the recommended ones the gate lets pass); Analysis — a failing soft requirement. */
export type ReviewerRule = { kind: 'print_rule'; rule: string; status: 'warn' | 'fail' } | { kind: 'soft_failing' } | { kind: 'soft_unknown' };
export interface Scenario {
  case: string; note?: string; prompt?: string; start?: StudioDoc;
  requirements?: { ops: Op[] }; designer: DesignerStep[]; verifier?: { model?: string; rules: VerifierRule[] };
  reviewers?: { name: ReviewerName; model?: string; rules: ReviewerRule[] }[];
  drafter?: DesignerStep[];
  maxPatches?: number;
}
/** A revision no part has: a scripted patch made "on an old base". */
export const STALE_REVISION = '0000000000000000';

export function scriptedDesigner(steps: readonly DesignerStep[]): DesignerRole {
  let k = 0, last: Patch | null = null;
  return {
    model: 'scripted',
    async propose(view) {
      const s = steps[k++];
      if (s === undefined || s === 'done') return 'done';
      if (s === 'rebase') { if (!last) return 'done'; last = rebase(last, view.revision); return { patch: last }; }
      last = { id: s.patch.id, by: 'designer', base: s.patch.base === 'stale' ? STALE_REVISION : view.revision, ops: s.patch.ops, ...(s.patch.rationale ? { rationale: s.patch.rationale } : {}), ...(s.patch.keep ? { keep: s.patch.keep } : {}) };
      return { patch: last };
    },
  };
}
const n = (v: unknown) => (typeof v === 'number' ? v : 0);
/** A Verifier that checks only what its view holds: its rules, each a finding when broken. */
export function scriptedVerifier(rules: readonly VerifierRule[], model = 'scripted'): VerifierRole {
  return {
    model,
    async review(view: VerifierView) {
      const findings: string[] = [];
      for (const r of rules) {
        if (r.kind === 'max_mass_g') { const g = (view.mass as { mass_g?: number }[]).reduce((s, b) => s + n(b.mass_g), 0); if (g > r.value) findings.push(`the part weighs ${Number(g.toPrecision(6))} g, over ${r.value} g`); }
        else if (r.kind === 'max_size') { const k = 'xyz'.indexOf(r.axis), boxes = view.boxes as { body: string; min: number[]; max: number[] }[]; const lo = Math.min(...boxes.map(b => b.min[k])), hi = Math.max(...boxes.map(b => b.max[k])); if (hi - lo > r.value + 1e-9) findings.push(`${Number((hi - lo).toPrecision(6))} mm along ${r.axis}, over ${r.value} mm`); }
        else if ((view.boxes as unknown[]).length < r.value) findings.push(`${(view.boxes as unknown[]).length} bodies, fewer than ${r.value}`);
      }
      return { accept: !findings.length, findings };
    },
  };
}
/** A reviewer that reads only its view: its rules, each a typed finding when met. */
export function scriptedReviewer(name: ReviewerName, rules: readonly ReviewerRule[], model = 'scripted'): ReviewerRole {
  return {
    name, model,
    async review(view: ReviewView) {
      const findings: { code: string; message: string }[] = [];
      // (A DFM review on a part with no process, or one whose checks are not built: skipped, said why — not a pass.)
      if (name === 'dfm' && rules.some(r => r.kind === 'print_rule') && view.printability === null) return { verdict: 'skipped' as const, findings: [{ code: view.process ? 'NOT_CHECKED' : 'NO_PROCESS', message: view.process ? `${String(view.process)} has no checks yet` : 'no process to review against' }] };
      for (const r of rules) {
        if (r.kind === 'print_rule') for (const x of (view.printability as { id: string; status: string; message: string }[] | null) ?? []) { if (x.id === r.rule && x.status === r.status) findings.push({ code: 'DFM_RECOMMENDED', message: `${x.id} ${x.status}: ${x.message}` }); }
        else if (r.kind === 'soft_unknown') {
          // (A soft requirement the checks could not measure: the Analysis reviewer cannot decide it — undecided.)
          const soft = new Set((view.requirements as { id: string; hard: boolean }[]).filter(q => !q.hard).map(q => q.id));
          for (const u of ((view.checks as { unknowns: { req_id: string; why: string }[] } | null)?.unknowns ?? [])) if (soft.has(u.req_id)) findings.push({ code: 'UNDECIDED', message: `${u.req_id}: ${u.why}` });
        } else {
          const soft = new Set((view.requirements as { id: string; hard: boolean }[]).filter(q => !q.hard).map(q => q.id));
          for (const f of ((view.checks as { failures: { req_id: string; measured: unknown; expected: string }[] } | null)?.failures ?? [])) if (soft.has(f.req_id)) findings.push({ code: 'SOFT_FAILING', message: `${f.req_id}: ${String(f.measured)} (want ${f.expected})` });
        }
      }
      // (An undecided rule's findings hold the patch; any other finding rejects it.)
      return { verdict: findings.some(f => f.code !== 'UNDECIDED') ? 'reject' as const : findings.length ? 'undecided' as const : 'accept' as const, findings };
    },
  };
}
/** A drafting agent replaying its steps (drawing ops; "stale": on an old revision). */
export function scriptedDrafter(steps: readonly DesignerStep[]): DrafterRole {
  const d = scriptedDesigner(steps);
  return { model: 'scripted', draft: v => d.propose(v) };
}
export const scriptedRequirements = (ops: Op[]): RequirementsRole => ({ model: 'scripted', async brief() { return { ops }; } });

/** A scenario run with scripted roles, from its start. */
export async function runScenario(sc: Scenario, evaluate: Evaluate): Promise<TeamRun> {
  const doc = sc.start ?? emptyDoc(), e = await evaluate(doc), start: ChatState = { doc, bodies: e?.ok ? e.bodies : [] };
  return runTeam(start, { ...(sc.requirements ? { requirements: scriptedRequirements(sc.requirements.ops) } : {}), designer: scriptedDesigner(sc.designer), ...(sc.verifier ? { verifier: scriptedVerifier(sc.verifier.rules, sc.verifier.model) } : {}), ...(sc.reviewers ? { reviewers: sc.reviewers.map(r => scriptedReviewer(r.name, r.rules, r.model)) } : {}), ...(sc.drafter ? { drafter: scriptedDrafter(sc.drafter) } : {}) }, sc.prompt ?? sc.case, evaluate, { maxPatches: sc.maxPatches ?? sc.designer.length });
}
/** A run as `cad-cli team` prints it: its traces (gates' verdicts and findings), decisions, tokens. */
export function runSummary(r: TeamRun) {
  return {
    ended: r.ended, revision: r.revision, accepted: r.accepted, tried: r.tried, tokens: r.tokens, cost_per_accepted: r.costPerAccepted,
    traces: r.traces.map(t => ({ seq: t.seq, patch: t.patch.id, by: t.patch.by, base: t.base, ...(t.rebasedFrom ? { rebased_from: t.rebasedFrom } : {}), decision: t.decision, ...(t.contractChanges ? { contract_changes: t.contractChanges } : {}), revision_after: t.revisionAfter, gates: t.gates.map(g => ({ gate: g.gate, verdict: g.verdict, findings: g.findings })), ...(t.verifier ? { verifier: t.verifier } : {}), ...(t.reviews ? { reviews: t.reviews } : {}), ...(t.keptBecause ? { kept_because: t.keptBecause } : {}) })),
  };
}
