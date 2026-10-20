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
import type { Op } from '../chat/proposals';
import { checkSpec, type Report } from '../chat/spec';
import { interference, massProperties } from '../chat/analysis';
import { factsOf } from '../chat/observe';
import { checkKeepouts, readReferences, type KeepoutResult } from '../chat/references';
import { printability, type PrintabilityReport } from '../print/rules';
import { processProfile } from '../library/materials';
import { readBrief, isStated } from '../chat/brief';

// ——— revisions and patches
/** The canonical JSON of a value: object keys sorted, so equal documents give equal text. */
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
}
/** What a revision covers: the model and the contracts a patch may depend on. */
const REVISION_FIELDS = ['nodes', 'parameters', 'bodies', 'requirements', 'brief', 'references', 'process', 'printer', 'drafts'] as const;
/** The canonical JSON of what a revision covers: equal exactly when the states a patch depends on are equal. */
export const canonicalOf = (doc: StudioDoc) => canonical(Object.fromEntries(REVISION_FIELDS.map(k => [k, (doc as unknown as Record<string, unknown>)[k]])));
/**
 * The document's revision: a 64-bit FNV-1a (two 32-bit lanes) of its canonical JSON, 16 hex digits — **for staleness,
 * not integrity**: equal hashes are confirmed by comparing the canonical JSON before a patch is applied (`integrate`'s
 * `bases`), so a collision cannot apply a patch to another state.
 */
export function revisionOf(doc: StudioDoc): string {
  const s = canonicalOf(doc);
  let h1 = 0x811c9dc5, h2 = 0x050c5d1f;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 ^= c; h1 = Math.imul(h1, 0x01000193) >>> 0; h2 ^= c; h2 = Math.imul(h2, 0x01000193) >>> 0; h2 = (h2 ^ (h1 >>> 7)) >>> 0; }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
export interface Patch { id: string; by: string; base: string; ops: Op[]; rationale?: string; /** The base it was made on, when rebased. */ rebasedFrom?: string }
/** The patch made again on another revision (explicit: never automatic); its trace names the old base. */
export const rebase = (p: Patch, revision: string): Patch => ({ ...p, base: revision, rebasedFrom: p.rebasedFrom ?? p.base });

// ——— gates
export type GateName = 'validity' | 'interference' | 'interfaces' | 'dfm' | 'analysis';
export const GATES: readonly GateName[] = ['validity', 'interference', 'interfaces', 'dfm', 'analysis'];
export type Verdict = 'pass' | 'fail' | 'undecided' | 'skipped';
export type FindingCode = 'STALE_BASE' | 'OP_REFUSED' | 'NO_SOLID' | 'NOT_EVALUATED' | 'REFERENCE_BROKEN' | 'OVERLAP' | 'KEEPOUT_VIOLATED' | 'KEEPOUT_UNDECIDED' | 'CONTRACT_CHANGED' | 'INTERFACE_FAILED' | 'DFM_FAILED' | 'NO_PROCESS' | 'NOT_CHECKED' | 'HARD_FAILED' | 'HARD_UNKNOWN' | 'NOT_REACHED' | 'VERIFIER';
export interface Finding { code: FindingCode; message: string; entities?: string[] }
export interface GateResult { gate: GateName; verdict: Verdict; findings: Finding[] }
/** The fields a patch may not change: the contracts, the Requirements role's and the user's. */
export const CONTRACT_FIELDS = ['references', 'brief', 'requirements', 'process', 'printer', 'drafts', 'questions'] as const;
const INTERFACE_QUERIES = new Set(['keepout', 'datum_distance', 'clearance', 'hole_alignment']);
/** The contract fields that differ between two states. */
export const contractChanges = (a: StudioDoc, b: StudioDoc) => CONTRACT_FIELDS.filter(k => canonical((a as unknown as Record<string, unknown>)[k] ?? null) !== canonical((b as unknown as Record<string, unknown>)[k] ?? null));

/** The pairs of bodies whose solids overlap (the kernel's intersection), as "a|b". */
async function overlaps(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (bodies.length < 2) return out;
  for (const r of await interference(doc, bodies, evaluate) as { a: string; b: string; overlap_mm3?: number }[]) if (r.overlap_mm3) out.set(`${r.a}|${r.b}`, r.overlap_mm3);
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
    keepouts: extra.keepouts.map(k => ({ keepout: k.keepout, body: k.body, verdict: k.verdict, clearanceMM: k.clearanceMM, chordMM: k.chordMM })),
    printability: extra.print ? extra.print.rules.map(r => ({ id: r.id, status: r.status, message: r.message })) : null,
    checks: extra.spec ? { summary: extra.spec.summary, failures: extra.spec.failures, unknowns: extra.spec.unknowns } : null,
  };
  return deepFreeze(JSON.parse(JSON.stringify(view)) as VerifierView);
}

// ——— roles
export interface RoleReport { tokens?: number }
export interface RequirementsRole { model: string; brief(input: { prompt: string; revision: string }): Promise<{ ops: Op[] } & RoleReport> }
/** What the Designer sees: the part as it stands (its revision, facts, requirements), and the last decision and its findings. */
export interface DesignerView { revision: string; facts: unknown; brief: unknown; requirements: unknown; last: { decision: Decision; findings: Finding[] } | null }
export interface DesignerRole { model: string; propose(view: DesignerView): Promise<({ patch: Omit<Patch, 'base'> & { base?: string } } | 'done') & RoleReport> }
export interface VerifierRole { model: string; review(view: VerifierView): Promise<{ accept: boolean; findings: string[] } & RoleReport> }

export type Decision = 'applied' | 'rejected' | 'held' | 'stale';
export interface Trace {
  seq: number; patch: Patch; base: string; rebasedFrom?: string; revisionAfter: string | null;
  /** The contracts the patch would change (held for the user; A8's ECR later). */
  contractChanges?: string[];
  diff?: unknown; gates: GateResult[]; verifier?: { model: string; accept: boolean; findings: string[] }; decision: Decision; tokens: Record<string, number>;
}

/**
 * The Integrator: one patch, against the state it is given (its current revision). Stale: refused. Else a dry run,
 * the gates, the Verifier on what passes; the state after only when applied.
 */
export async function integrate(state: ChatState, patch: Patch, evaluate: Evaluate, o: { seq: number; verifier?: VerifierRole; /** The states patches were made on, by revision (their canonical JSON): a patch's base confirmed against it. */ bases?: ReadonlyMap<string, string> }): Promise<{ state: ChatState; trace: Trace }> {
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
  let decision: Decision = failed ? 'rejected' : undecided ? 'held' : 'applied', verifier: Trace['verifier'];
  if (decision === 'applied' && o.verifier) {
    const v = await o.verifier.review(verifierView(r.state.doc, r.state.bodies, g));
    tokens.verifier = v.tokens ?? 0; verifier = { model: o.verifier.model, accept: v.accept, findings: v.findings };
    if (!v.accept) decision = 'rejected';
  }
  const applied = decision === 'applied';
  const changes = r.isError ? [] : contractChanges(state.doc, r.state.doc);
  return { state: applied ? r.state : state, trace: { ...base, ...(diff !== undefined ? { diff } : {}), ...(changes.length ? { contractChanges: changes } : {}), gates: g.gates, ...(verifier ? { verifier } : {}), decision, revisionAfter: applied ? revisionOf(r.state.doc) : null } };
}

/** What the Designer is given each round. */
export function designerView(state: ChatState, last: DesignerView['last']): DesignerView {
  return { revision: revisionOf(state.doc), facts: factsOf(state.doc, state.bodies), brief: state.doc.brief ?? null, requirements: state.doc.requirements ?? [], last };
}

export interface TeamRun { traces: Trace[]; final: StudioDoc; revision: string; accepted: number; tried: number; tokens: Record<string, number>; costPerAccepted: number | null; ended: 'done' | 'budget' }
/** A team run: the Requirements role's brief applied (traced), then the Designer's patches through the Integrator and the Verifier until done or the budget. */
export async function runTeam(start: ChatState, roles: { requirements?: RequirementsRole; designer: DesignerRole; verifier?: VerifierRole }, prompt: string, evaluate: Evaluate, o: { maxPatches?: number } = {}): Promise<TeamRun> {
  let state = start, seq = 0, last: DesignerView['last'] = null, ended: TeamRun['ended'] = 'budget';
  // (Every state a role was given, by revision: a patch's base confirmed by its canonical JSON.)
  const bases = new Map<string, string>(), seen = (s: ChatState) => { bases.set(revisionOf(s.doc), canonicalOf(s.doc)); return s; };
  const traces: Trace[] = [], tokens: Record<string, number> = { requirements: 0, designer: 0, verifier: 0 };
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
    const out = await integrate(state, patch, evaluate, { seq: ++seq, bases, ...(roles.verifier ? { verifier: roles.verifier } : {}) });
    out.trace.tokens.designer = p.tokens ?? 0; tokens.verifier += out.trace.tokens.verifier ?? 0;
    traces.push(out.trace); state = out.state;
    last = { decision: out.trace.decision, findings: [...out.trace.gates.flatMap(g => g.findings.filter(f => f.code !== 'NOT_REACHED')), ...(out.trace.verifier?.findings ?? []).map(m => ({ code: 'VERIFIER' as const, message: m }))] };
  }
  const accepted = traces.filter(t => t.patch.by !== 'requirements' && t.decision === 'applied').length, tried = traces.filter(t => t.patch.by !== 'requirements').length;
  const total = Object.values(tokens).reduce((s, v) => s + v, 0);
  return { traces, final: state.doc, revision: revisionOf(state.doc), accepted, tried, tokens, costPerAccepted: accepted ? total / accepted : null, ended };
}
