// Multi-agent v1, the deterministic core (A7, O30–O31). Roles propose; a deterministic Integrator decides.
//   - A patch is a list of A4's ops against a base revision. A base that is not the current one is refused (STALE_BASE);
//     rebasing is explicit, and traced.
//   - The Integrator takes patches one at a time: a dry run on a copy of the state, then the gates in order — validity,
//     interference/clearance, interfaces, DFM, analysis — each with a typed verdict, the first fail stopping the rest;
//     then the Verifier's review of what the patch makes. Applied, rejected, held (a gate undecided: the user's) or stale.
//   - The Verifier is given artifacts and requirements only: its view is built (a frozen object of a fixed key set),
//     not asked for in a prompt — it never sees the ops, the Designer's rationale or a chat.
//   - Every patch leaves a trace; a logical sequence number in place of wall time, so a run is reproducible to the byte.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { dispatchTool, type ChatState, type Evaluate } from '../chat/tools';
import type { Op } from '../engine/schema/proposals';
import { checkSpec } from '../chat/spec';
import type { Report } from '../engine/schema/spec';
import { interference, massProperties } from '../analysis/analysis';
import { factsOf } from '../chat/observe';
import { checkKeepouts, readReferences } from '../chat/references';
import type { KeepoutResult } from '../engine/schema/references';
import { printability, type PrintabilityReport } from '../print/rules';
import { processProfile } from '../library/materials';
import { readBrief, isStated } from '../chat/brief';

// ——— revisions and patches
// (The canonical JSON and A7's revision live in util/revision.ts — no imports — so frames/ can pin a part's revision, FRf2.)
import { canonical, canonicalOf, revisionContent, revisionOf } from '../util/revision';
export { canonical, canonicalOf, revisionContent, revisionOf };
export interface Patch { id: string; by: string; base: string; ops: Op[]; rationale?: string; /** The base it was made on, when rebased. */ rebasedFrom?: string; /** The Designer's answer to soft findings: kept as it is, because… (A8.1: held for the user with this reason, not rejected again). */ keep?: string }
/** The patch made again on another revision (explicit: never automatic); its trace names the old base. */
export const rebase = (p: Patch, revision: string): Patch => ({ ...p, base: revision, rebasedFrom: p.rebasedFrom ?? p.base });

// ——— gates
export type GateName = 'validity' | 'interference' | 'interfaces' | 'dfm' | 'analysis';
export const GATES: readonly GateName[] = ['validity', 'interference', 'interfaces', 'dfm', 'analysis'];
export type Verdict = 'pass' | 'fail' | 'undecided' | 'skipped';
export type FindingCode = 'NOT_A_DRAWING_OP' | 'DRAWING_ISSUES' | 'DRAWING_WARNING' | 'STALE_BASE' | 'OP_REFUSED' | 'NO_SOLID' | 'NOT_EVALUATED' | 'REFERENCE_BROKEN' | 'OVERLAP' | 'KEEPOUT_VIOLATED' | 'KEEPOUT_UNDECIDED' | 'CONTRACT_CHANGED' | 'INTERFACE_FAILED' | 'DFM_FAILED' | 'NO_PROCESS' | 'NOT_CHECKED' | 'HARD_FAILED' | 'HARD_UNKNOWN' | 'NOT_REACHED' | 'VERIFIER';
export interface Finding { code: FindingCode; message: string; entities?: string[] }
export interface GateResult { gate: GateName; verdict: Verdict; findings: Finding[] }
/** The fields a patch may not change: the contracts, the Requirements role's and the user's. */
export const CONTRACT_FIELDS = ['references', 'brief', 'requirements', 'process', 'printer', 'drafts', 'questions', 'interfaces'] as const;
const INTERFACE_QUERIES = new Set(['keepout', 'datum_distance', 'clearance', 'hole_alignment']);
/** The contract fields that differ between two states. */
export const contractChanges = (a: StudioDoc, b: StudioDoc) => CONTRACT_FIELDS.filter(k => canonical((a as unknown as Record<string, unknown>)[k] ?? null) !== canonical((b as unknown as Record<string, unknown>)[k] ?? null));

/** The pairs of bodies whose solids overlap (the kernel's intersection), as "a|b". */
async function overlaps(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (bodies.length < 2) return out;
  for (const r of await interference(doc, bodies, evaluate) as { a: string; b: string; overlap?: number }[]) if (r.overlap) out.set(`${r.a}|${r.b}`, r.overlap);
  return out;
}
/** The process the DFM gate checks: the brief's stated one, else the part's. */
const processOf = (doc: StudioDoc) => { const p = readBrief(doc.brief)?.process; return p && isStated(p) ? p.value : doc.process; };

interface Candidate { before: ChatState; after: ChatState | null; refused?: string; broken: number }
/** Runs the gates on a dry run's result, in order; the first fail stops the rest. */
export async function runGates(c: Candidate, evaluate: Evaluate): Promise<{ gates: GateResult[]; spec: Report | null; keepouts: KeepoutResult[]; print: PrintabilityReport | null }> {
  const gates: GateResult[] = [], push = (g: GateResult) => gates.push(g);
  let spec: Report | null = null, keepouts: KeepoutResult[] = [], print: PrintabilityReport | null = null;
  const stopped = () => gates.some(g => g.verdict === 'fail');
  for (const gate of GATES) {
    if (stopped()) { push({ gate, verdict: 'skipped', findings: [{ code: 'NOT_REACHED', message: 'not reached: an earlier gate failed' }] }); continue; }
    const after = c.after;
    if (gate === 'validity') {
      const f: Finding[] = [];
      if (c.refused || !after) f.push({ code: 'OP_REFUSED', message: c.refused ?? 'the ops did not apply' });
      else {
        const e = await evaluate(after.doc);
        if (!e?.ok) f.push({ code: 'NOT_EVALUATED', message: e && !e.ok ? e.error.detail : 'the part did not evaluate' });
        else if (!after.bodies.length) f.push({ code: 'NO_SOLID', message: 'the part has no solid' });
        if (c.broken) f.push({ code: 'REFERENCE_BROKEN', message: `${c.broken} stored reference${c.broken === 1 ? '' : 's'} no longer resolve${c.broken === 1 ? 's' : ''}` });
      }
      push({ gate, verdict: f.length ? 'fail' : 'pass', findings: f }); continue;
    }
    if (!after) continue;
    if (gate === 'interference') {
      const was = await overlaps(c.before.doc, c.before.bodies, evaluate), now = await overlaps(after.doc, after.bodies, evaluate), f: Finding[] = [];
      for (const [pair, v] of now) if (!was.has(pair)) f.push({ code: 'OVERLAP', message: `${pair.replace('|', ' and ')} overlap by ${Number(v.toPrecision(6))} mm³`, entities: pair.split('|') });
      if (readReferences(after.doc.references).keepouts.length) {
        keepouts = await checkKeepouts(after.doc, after.bodies, evaluate);
        for (const k of keepouts) if (k.verdict === 'violated') f.push({ code: 'KEEPOUT_VIOLATED', message: `${k.body} and ${k.keepout}: ${k.why}`, entities: [k.body] });
        else if (k.verdict === 'undecided') f.push({ code: 'KEEPOUT_UNDECIDED', message: `${k.body} and ${k.keepout}: ${k.why}`, entities: [k.body] });
      }
      push({ gate, verdict: f.some(x => x.code !== 'KEEPOUT_UNDECIDED') ? 'fail' : f.length ? 'undecided' : 'pass', findings: f }); continue;
    }
    if (gate === 'interfaces') {
      const f: Finding[] = [];
      const changed = contractChanges(c.before.doc, after.doc);
      if (changed.length) f.push({ code: 'CONTRACT_CHANGED', message: `the patch changes the part's ${changed.join(', ')}: contracts, the Requirements role's and the user's — held for the user to decide`, entities: changed });
      if (!f.length && after.doc.requirements?.length) {
        const { outcomes, ...r } = await checkSpec(after.doc, after.bodies, evaluate); spec = r;
        for (const q of after.doc.requirements) if (q.hard && INTERFACE_QUERIES.has(q.check.query.fn)) { const o = outcomes.get(q.id); if (o?.status === 'fail') f.push({ code: 'INTERFACE_FAILED', message: `${q.id} (${q.check.query.fn}) fails: ${String(o.measured)}`, entities: o.entities }); }
      }
      push({ gate, verdict: f.some(x => x.code === 'INTERFACE_FAILED') ? 'fail' : f.length ? 'undecided' : 'pass', findings: f }); continue;
    }
    if (gate === 'dfm') {
      const proc = processOf(after.doc);
      if (!proc) { push({ gate, verdict: 'skipped', findings: [{ code: 'NO_PROCESS', message: 'no process: the brief states none and the part has none' }] }); continue; }
      if (!processProfile(proc)) { push({ gate, verdict: 'skipped', findings: [{ code: 'NOT_CHECKED', message: `${proc} has no checks yet (the kernel lane's later steps)` }] }); continue; }
      print = await printability({ ...after.doc, process: proc }, after.bodies, evaluate);
      const fails = print.rules.filter(r => r.status === 'fail' && r.level === 'feasible');
      push({ gate, verdict: fails.length ? 'fail' : 'pass', findings: fails.map(r => ({ code: 'DFM_FAILED' as const, message: `${r.id}: ${r.message}`, ...(r.entities ? { entities: [...r.entities] } : {}) })) }); continue;
    }
    // analysis
    if (!after.doc.requirements?.length) { push({ gate, verdict: 'skipped', findings: [] }); continue; }
    if (!spec) { const { outcomes: _o, ...r } = await checkSpec(after.doc, after.bodies, evaluate); void _o; spec = r; }
    const hardIds = new Set(after.doc.requirements.filter(q => q.hard).map(q => q.id));
    const f: Finding[] = [...spec.failures.filter(x => hardIds.has(x.req_id)).map(x => ({ code: 'HARD_FAILED' as const, message: `${x.req_id}: ${String(x.measured)} (want ${x.expected})`, ...(x.entities ? { entities: x.entities } : {}) })),
      ...spec.unknowns.filter(x => hardIds.has(x.req_id)).map(x => ({ code: 'HARD_UNKNOWN' as const, message: `${x.req_id}: ${x.why}` }))];
    push({ gate, verdict: f.some(x => x.code === 'HARD_FAILED') ? 'fail' : f.length ? 'undecided' : 'pass', findings: f });
  }
  return { gates, spec, keepouts, print };
}

// ——— the Verifier's view: built, not asked for
export const VERIFIER_VIEW_KEYS = ['revision', 'brief', 'requirements', 'facts', 'mass', 'boxes', 'keepouts', 'printability', 'checks'] as const;
export type VerifierView = Readonly<Record<(typeof VERIFIER_VIEW_KEYS)[number], unknown>>;
const deepFreeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.freeze(v); for (const x of Object.values(v as object)) deepFreeze(x); } return v; };
/** What the Verifier is given: the artifacts and the requirements of the part a patch would make — nothing of the patch. */
export function verifierView(doc: StudioDoc, bodies: readonly BodyResult[], extra: { keepouts: readonly KeepoutResult[]; print: PrintabilityReport | null; spec: Report | null }): VerifierView {
  const view = {
    revision: revisionOf(doc), brief: doc.brief ?? null, requirements: doc.requirements ?? [],
    facts: factsOf(doc, bodies), mass: massProperties(doc, bodies), boxes: bodies.map(b => ({ body: b.key, min: b.mesh.bounds.min, max: b.mesh.bounds.max })),
    keepouts: extra.keepouts.map(k => ({ keepout: k.keepout, body: k.body, verdict: k.verdict, clearance: k.clearance, chordMM: k.chordMM })),
    printability: extra.print ? extra.print.rules.map(r => ({ id: r.id, status: r.status, message: r.message })) : null,
    checks: extra.spec ? { summary: extra.spec.summary, failures: extra.spec.failures, unknowns: extra.spec.unknowns } : null,
  };
  return deepFreeze(JSON.parse(JSON.stringify(view)) as VerifierView);
}

// ——— the reviewers' views (A8.1): built, frozen, read-only — a view holds no state, evaluate or dispatcher
export const DFM_VIEW_KEYS = ['revision', 'process', 'printability', 'facts', 'boxes'] as const;
export const ANALYSIS_VIEW_KEYS = ['revision', 'requirements', 'checks', 'mass', 'keepouts'] as const;
export type ReviewerName = 'dfm' | 'analysis';
export type ReviewView = Readonly<Record<string, unknown>>;
/** What a reviewer is given: its fixed key set of the part a patch would make. */
export function reviewView(name: ReviewerName, doc: StudioDoc, bodies: readonly BodyResult[], extra: { keepouts: readonly KeepoutResult[]; print: PrintabilityReport | null; spec: Report | null }): ReviewView {
  const v = verifierView(doc, bodies, extra) as Record<string, unknown>;
  const keys: readonly string[] = name === 'dfm' ? DFM_VIEW_KEYS : ANALYSIS_VIEW_KEYS;
  const all: Record<string, unknown> = { ...v, process: processOf(doc) ?? null };
  return deepFreeze(JSON.parse(JSON.stringify(Object.fromEntries(keys.map(k => [k, all[k] ?? null])))) as ReviewView);
}
export interface ReviewFinding { code: string; message: string; entities?: string[] }
/** A reviewer's verdict, as the gates': accept, reject, undecided (the patch held for the user) or skipped (it cannot check this — said why). */
export type ReviewVerdict = 'accept' | 'reject' | 'undecided' | 'skipped';
/** The findings that are a preference, not a requirement: a Designer may answer them with "keep, because…". */
export const SOFT_CODES = new Set(['DFM_RECOMMENDED', 'SOFT_FAILING']);
export interface ReviewerRole { name: ReviewerName; model: string; review(view: ReviewView): Promise<{ verdict: ReviewVerdict; findings: ReviewFinding[] } & RoleReport> }

// ——— roles
export interface RoleReport { tokens?: number }
export interface RequirementsRole { model: string; brief(input: { prompt: string; revision: string }): Promise<{ ops: Op[] } & RoleReport> }
/** What the Designer sees: the part as it stands (its revision, facts, requirements), and the last decision and its findings. */
export interface DesignerView { revision: string; facts: unknown; brief: unknown; requirements: unknown; last: { decision: Decision; findings: Finding[] } | null }
export interface DesignerRole { model: string; propose(view: DesignerView): Promise<({ patch: Omit<Patch, 'base'> & { base?: string } } | 'done') & RoleReport> }
export interface VerifierRole { model: string; review(view: VerifierView): Promise<{ accept: boolean; findings: string[] } & RoleReport> }

export type Decision = 'applied' | 'rejected' | 'held' | 'stale';
export interface Trace {
  /** The parallel reviewers' verdicts (A8.1), by role name. */
  reviews?: { role: ReviewerName; model: string; verdict: ReviewVerdict; findings: ReviewFinding[] }[];
  seq: number; patch: Patch; base: string; rebasedFrom?: string; revisionAfter: string | null;
  /** The Designer's reason for keeping a patch against soft findings (held). */
  keptBecause?: string;
  /** The contracts the patch would change (held for the user; A8's ECR later). */
  contractChanges?: string[];
  diff?: unknown; gates: GateResult[]; verifier?: { model: string; accept: boolean; findings: string[] }; decision: Decision; tokens: Record<string, number>;
}

/**
 * The Integrator: one patch, against the state it is given (its current revision). Stale: refused. Else a dry run,
 * the gates, the Verifier on what passes; the state after only when applied.
 */
export async function integrate(state: ChatState, patch: Patch, evaluate: Evaluate, o: { seq: number; verifier?: VerifierRole; reviewers?: readonly ReviewerRole[]; /** The states patches were made on, by revision (their canonical JSON): a patch's base confirmed against it. */ bases?: ReadonlyMap<string, string> }): Promise<{ state: ChatState; trace: Trace }> {
  const current = revisionOf(state.doc), tokens: Record<string, number> = {};
  const base: Omit<Trace, 'gates' | 'decision' | 'revisionAfter'> = { seq: o.seq, patch, base: patch.base, ...(patch.rebasedFrom ? { rebasedFrom: patch.rebasedFrom } : {}), tokens };
  const stale = (message: string) => ({ state, trace: { ...base, revisionAfter: null, gates: [{ gate: 'validity' as const, verdict: 'fail' as const, findings: [{ code: 'STALE_BASE' as const, message }] }], decision: 'stale' as const } });
  if (patch.base !== current) return stale(`the patch is on ${patch.base}; the part is at ${current}: rebase it explicitly`);
  // (The hash names the base; the canonical JSON confirms it: a collision is refused, not applied.)
  if (o.bases) {
    const was = o.bases.get(patch.base);
    if (was === undefined) return stale(`the patch's base ${patch.base} is not a state this run gave a role: rebase it on the current one`);
    if (was !== canonicalOf(state.doc)) return stale(`the base's hash ${patch.base} matches the part's, but the states differ (a hash collision): rebase it explicitly`);
  }
  const r = await dispatchTool(state, 'apply_ops', { ops: patch.ops }, evaluate);
  let refused: string | undefined, broken = 0, diff: unknown;
  if (r.isError) { try { refused = JSON.parse(r.content).error; } catch { refused = r.content; } }
  else { const body = JSON.parse(r.content); diff = body.diff; broken = (body.broken_references ?? []).length; }
  const g = await runGates({ before: state, after: r.isError ? null : r.state, ...(refused ? { refused } : {}), broken }, evaluate);
  const failed = g.gates.some(x => x.verdict === 'fail'), undecided = g.gates.some(x => x.verdict === 'undecided');
  let decision: Decision = failed ? 'rejected' : undecided ? 'held' : 'applied', verifier: Trace['verifier'], reviews: Trace['reviews'];
  if (decision === 'applied' && (o.verifier || o.reviewers?.length)) {
    // (The Verifier and the reviewers in parallel, each on its own built view; joined by role name, so the trace is the same whichever ends first.)
    const [v, ...rs] = await Promise.all([o.verifier ? o.verifier.review(verifierView(r.state.doc, r.state.bodies, g)) : Promise.resolve(null), ...(o.reviewers ?? []).map(x => x.review(reviewView(x.name, r.state.doc, r.state.bodies, g)))]);
    if (v && o.verifier) { tokens.verifier = v.tokens ?? 0; verifier = { model: o.verifier.model, accept: v.accept, findings: v.findings }; if (!v.accept) decision = 'rejected'; }
    if (o.reviewers?.length) {
      reviews = o.reviewers.map((x, i) => ({ role: x.name, model: x.model, verdict: rs[i]!.verdict, findings: rs[i]!.findings })).sort((a, b) => a.role.localeCompare(b.role));
      o.reviewers.forEach((x, i) => { tokens[x.name] = rs[i]!.tokens ?? 0; });
      // (A rejection rejects — but a Designer's "keep, because…" against soft findings only holds it for the user with that
      // reason; a reviewer that cannot decide — undecided or skipped — holds it too: never a pass.)
      const rejecting = reviews.filter(x => x.verdict === 'reject'), soft = rejecting.length > 0 && rejecting.every(x => x.findings.every(f => SOFT_CODES.has(f.code)));
      if (rejecting.length && !(soft && patch.keep)) decision = 'rejected';
      else if (decision === 'applied' && (rejecting.length || reviews.some(x => x.verdict === 'undecided' || x.verdict === 'skipped'))) decision = 'held';
    }
  }
  const applied = decision === 'applied';
  const changes = r.isError ? [] : contractChanges(state.doc, r.state.doc);
  return { state: applied ? r.state : state, trace: { ...base, ...(diff !== undefined ? { diff } : {}), ...(changes.length ? { contractChanges: changes } : {}), gates: g.gates, ...(verifier ? { verifier } : {}), ...(reviews ? { reviews } : {}), ...(patch.keep && decision === 'held' ? { keptBecause: patch.keep } : {}), decision, revisionAfter: applied ? revisionOf(r.state.doc) : null } };
}

/** What the Designer is given each round. */
export function designerView(state: ChatState, last: DesignerView['last']): DesignerView {
  return { revision: revisionOf(state.doc), facts: factsOf(state.doc, state.bodies), brief: state.doc.brief ?? null, requirements: state.doc.requirements ?? [], last };
}

export interface TeamRun { traces: Trace[]; final: StudioDoc; revision: string; accepted: number; tried: number; tokens: Record<string, number>; costPerAccepted: number | null; ended: 'done' | 'budget' }
/** A team run: the Requirements role's brief applied (traced), then the Designer's patches through the Integrator and the Verifier until done or the budget. */
export async function runTeam(start: ChatState, roles: { requirements?: RequirementsRole; designer: DesignerRole; verifier?: VerifierRole; reviewers?: readonly ReviewerRole[]; drafter?: DrafterRole }, prompt: string, evaluate: Evaluate, o: { maxPatches?: number } = {}): Promise<TeamRun> {
  let state = start, seq = 0, last: DesignerView['last'] = null, ended: TeamRun['ended'] = 'budget';
  // (Every state a role was given, by revision: a patch's base confirmed by its canonical JSON.)
  const bases = new Map<string, string>(), seen = (s: ChatState) => { bases.set(revisionOf(s.doc), canonicalOf(s.doc)); return s; };
  const traces: Trace[] = [], tokens: Record<string, number> = { requirements: 0, designer: 0, verifier: 0, ...Object.fromEntries((roles.reviewers ?? []).map(x => [x.name, 0])), ...(roles.drafter ? { drafter: 0 } : {}) };
  if (roles.requirements) {
    // (The brief and requirements are the Requirements role's: applied without the design gates, traced.)
    const b = await roles.requirements.brief({ prompt, revision: revisionOf(state.doc) }); tokens.requirements += b.tokens ?? 0;
    const r = await dispatchTool(state, 'apply_ops', { ops: b.ops }, evaluate);
    const patch: Patch = { id: 'brief', by: 'requirements', base: revisionOf(state.doc), ops: b.ops };
    traces.push({ seq: ++seq, patch, base: patch.base, gates: [{ gate: 'validity', verdict: r.isError ? 'fail' : 'pass', findings: r.isError ? [{ code: 'OP_REFUSED', message: JSON.parse(r.content).error }] : [] }], decision: r.isError ? 'rejected' : 'applied', revisionAfter: r.isError ? null : revisionOf(r.state.doc), tokens: { requirements: b.tokens ?? 0 } });
    if (!r.isError) state = r.state;
  }
  for (let k = 0; k < (o.maxPatches ?? 8); k++) {
    const p = await roles.designer.propose(designerView(seen(state), last)); tokens.designer += p.tokens ?? 0;
    if (p === 'done' || ('patch' in p) === false) { ended = 'done'; break; }
    const patch: Patch = { ...p.patch, base: p.patch.base ?? revisionOf(state.doc) };
    const out = await integrate(state, patch, evaluate, { seq: ++seq, bases, ...(roles.verifier ? { verifier: roles.verifier } : {}), ...(roles.reviewers ? { reviewers: roles.reviewers } : {}) });
    out.trace.tokens.designer = p.tokens ?? 0; tokens.verifier += out.trace.tokens.verifier ?? 0;
    for (const x of roles.reviewers ?? []) tokens[x.name] += out.trace.tokens[x.name] ?? 0;
    traces.push(out.trace); state = out.state;
    last = { decision: out.trace.decision, findings: [...out.trace.gates.flatMap(g => g.findings.filter(f => f.code !== 'NOT_REACHED')), ...(out.trace.verifier?.findings ?? []).map(m => ({ code: 'VERIFIER' as const, message: m })), ...(out.trace.reviews ?? []).flatMap(rv => rv.findings.map(f => ({ code: 'VERIFIER' as const, message: `${rv.role}: ${f.code}: ${f.message}` })))] };
  }
  // (The drawing, A8.1: drafted on the revision the design ended at, its drawing ops only.)
  if (roles.drafter) for (let k = 0; k < 4; k++) {
    const p = await roles.drafter.draft(designerView(seen(state), last)); tokens.drafter += p.tokens ?? 0;
    if (p === 'done' || !('patch' in p)) break;
    const out = await integrateDrawing(state, { ...p.patch, by: 'drafter', base: p.patch.base ?? revisionOf(state.doc) }, evaluate, { seq: ++seq, bases });
    traces.push(out.trace); state = out.state;
    last = { decision: out.trace.decision, findings: out.trace.gates.flatMap(g => g.findings) };
  }
  const design = (t: Trace) => t.patch.by !== 'requirements' && t.patch.by !== 'drafter';
  const accepted = traces.filter(t => design(t) && t.decision === 'applied').length, tried = traces.filter(design).length;
  const total = Object.values(tokens).reduce((s, v) => s + v, 0);
  return { traces, final: state.doc, revision: revisionOf(state.doc), accepted, tried, tokens, costPerAccepted: accepted ? total / accepted : null, ended };
}

// ——— the Drafting agent (A8.1): drawing ops only, on a frozen revision
export const DRAWING_OPS = new Set(['auto_dimension', 'fix_drawing', 'set_drawing', 'accept_tolerances']);
export interface DrafterRole { model: string; draft(view: DesignerView): Promise<({ patch: Omit<Patch, 'base'> & { base?: string } } | 'done') & RoleReport> }
/** A drafting patch: refused unless every op is a drawing op and the model is at its base (the canonical JSON confirming
 * it); applied, the drawing's issue list read — its errors reject it, its warnings listed. The model's revision unmoved. */
export async function integrateDrawing(state: ChatState, patch: Patch, evaluate: Evaluate, o: { seq: number; bases?: ReadonlyMap<string, string> }): Promise<{ state: ChatState; trace: Trace }> {
  const current = revisionOf(state.doc), base = { seq: o.seq, patch, base: patch.base, ...(patch.rebasedFrom ? { rebasedFrom: patch.rebasedFrom } : {}), tokens: {} as Record<string, number> };
  const refuse = (decision: Decision, code: FindingCode, message: string) => ({ state, trace: { ...base, revisionAfter: null, gates: [{ gate: 'validity' as const, verdict: 'fail' as const, findings: [{ code, message }] }], decision } });
  const bad = patch.ops.filter(op => !DRAWING_OPS.has(op.tool));
  if (bad.length) return refuse('rejected', 'NOT_A_DRAWING_OP', `the drafting agent changes the drawing only: ${bad.map(b => b.tool).join(', ')} ${bad.length === 1 ? 'is' : 'are'} not drawing ops (${[...DRAWING_OPS].join(', ')})`);
  if (patch.base !== current || (o.bases && o.bases.get(patch.base) !== canonicalOf(state.doc))) return refuse('stale', 'STALE_BASE', `the drawing was made on ${patch.base}; the model is at ${current}: draft it again on the current revision`);
  const r = await dispatchTool(state, 'apply_ops', { ops: patch.ops }, evaluate);
  if (r.isError) { let m = r.content; try { m = JSON.parse(r.content).error; } catch { /* plain */ } return refuse('rejected', 'OP_REFUSED', m); }
  const issues = JSON.parse((await dispatchTool(r.state, 'drawing_issues', {}, evaluate)).content) as { issues: { code: string; severity?: string; level?: string; message?: string }[] };
  const errors = issues.issues.filter(x => (x.severity ?? x.level) === 'error'), warnings = issues.issues.filter(x => (x.severity ?? x.level) !== 'error');
  const gate: GateResult = { gate: 'validity', verdict: errors.length ? 'fail' : 'pass', findings: [...errors.map(x => ({ code: 'DRAWING_ISSUES' as const, message: `${x.code}: ${x.message ?? ''}` })), ...warnings.map(x => ({ code: 'DRAWING_WARNING' as const, message: `${x.code}: ${x.message ?? ''}` }))] };
  const applied = !errors.length;
  return { state: applied ? r.state : state, trace: { ...base, gates: [gate], decision: applied ? 'applied' : 'rejected', revisionAfter: applied ? revisionOf(r.state.doc) : null } };
}
