// Scripted roles (A7, O31): the deterministic stand-ins that drive the team's core in tests, fixtures and `cad-cli team`.
// A scenario names the start (a document, else an empty part), the Requirements role's ops, the Designer's steps (a
// patch, "done", or "rebase" — the last patch made again on the current revision, explicitly) and the Verifier's rules
// (checks of the view it is given: the total mass, a body's box). Live roles (model adapters) take their place in the
// comparison the owner is to approve (O30).
import type { StudioDoc } from '../engine/doc';
import { emptyDoc } from '../engine/doc';
import type { ChatState, Evaluate } from '../chat/tools';
import type { Op } from '../chat/proposals';
import { rebase, runTeam, type DesignerRole, type Patch, type RequirementsRole, type TeamRun, type VerifierRole, type VerifierView } from './team';

export type DesignerStep = { patch: { id: string; ops: Op[]; rationale?: string; /** "stale": made on an old revision (a fixed one no part has). */ base?: 'stale' } } | 'done' | 'rebase';
export type VerifierRule = { kind: 'max_mass_g'; value: number } | { kind: 'max_size'; axis: 'x' | 'y' | 'z'; value: number } | { kind: 'min_bodies'; value: number };
export interface Scenario {
  case: string; note?: string; prompt?: string; start?: StudioDoc;
  requirements?: { ops: Op[] }; designer: DesignerStep[]; verifier?: { model?: string; rules: VerifierRule[] };
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
      last = { id: s.patch.id, by: 'designer', base: s.patch.base === 'stale' ? STALE_REVISION : view.revision, ops: s.patch.ops, ...(s.patch.rationale ? { rationale: s.patch.rationale } : {}) };
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
export const scriptedRequirements = (ops: Op[]): RequirementsRole => ({ model: 'scripted', async brief() { return { ops }; } });

/** A scenario run with scripted roles, from its start. */
export async function runScenario(sc: Scenario, evaluate: Evaluate): Promise<TeamRun> {
  const doc = sc.start ?? emptyDoc(), e = await evaluate(doc), start: ChatState = { doc, bodies: e?.ok ? e.bodies : [] };
  return runTeam(start, { ...(sc.requirements ? { requirements: scriptedRequirements(sc.requirements.ops) } : {}), designer: scriptedDesigner(sc.designer), ...(sc.verifier ? { verifier: scriptedVerifier(sc.verifier.rules, sc.verifier.model) } : {}) }, sc.prompt ?? sc.case, evaluate, { maxPatches: sc.maxPatches ?? sc.designer.length });
}
/** A run as `cad-cli team` prints it: its traces (gates' verdicts and findings), decisions, tokens. */
export function runSummary(r: TeamRun) {
  return {
    ended: r.ended, revision: r.revision, accepted: r.accepted, tried: r.tried, tokens: r.tokens, cost_per_accepted: r.costPerAccepted,
    traces: r.traces.map(t => ({ seq: t.seq, patch: t.patch.id, by: t.patch.by, base: t.base, ...(t.rebasedFrom ? { rebased_from: t.rebasedFrom } : {}), decision: t.decision, revision_after: t.revisionAfter, gates: t.gates.map(g => ({ gate: g.gate, verdict: g.verdict, findings: g.findings })), ...(t.verifier ? { verifier: t.verifier } : {}) })),
  };
}
