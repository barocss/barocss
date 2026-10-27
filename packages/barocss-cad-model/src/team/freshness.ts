import { resolveShopTree } from '../engine/shopRows';
import { bearingDependencyKey } from '../engine/bearingContext';
// Result freshness (A8.5b, O32's addendum, O39). Every result is stamped with the fingerprint of what it read — a digest
// per input (the model, the material, the process, the interfaces, the references, the requirement, the drafts, the
// drawing) and the A1 signature of each face it names — and read back against the document as it is: current, stale
// (each changed input named) or unresolved (a face gone, ambiguous, or now named otherwise: never re-targeted; a stored
// reference A1 cannot tell, with A1's candidates). A stale or unresolved result is never shown as current nor used for
// an approval. A result belongs to the run that made it; one arriving after a later run opened is kept, marked late,
// under its own run only. A result that failed, is not supported or did not converge has no value and no verdict: it
// never reads as 0 or as a pass.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { Evaluate } from '../chat/tools';
import { briefMaterial } from '../chat/brief';
import { massProperties } from '../analysis/analysis';
import { checkSpec, runCheck } from '../chat/spec';
import type { Outcome, Query } from '../engine/schema/spec';
import { runDrawingTool } from '../chat/drawing';
import { linkInertia } from '../robot/inertia';
import { inertiaJson } from '../robot/reports';
import { printability } from '../print/rules';
import { fromSig, markedReferences, toSig, verifyReferences, type Sig } from '../engine/references';
import { matchSignature, signaturesOf, type Signature } from '../engine/rematch';
import { bomView, checkBom, deriveBom } from './assembly';
import { digestOf } from '../util/digest';
import { readInterfaces } from './interfaces';
import { modelContent } from '../util/revision';
import { beadAccounting, incompleteBeadReason } from '../frames/beadAccounting';
import { refusal } from '../engine/refusal';

export type ResultKind = 'requirement' | 'check_spec' | 'keepout' | 'mass' | 'inertia' | 'dfm' | 'bom' | 'drawing';
export type InputName = 'model' | 'material' | 'process' | 'interfaces' | 'references' | 'requirement' | 'requirements' | 'drafts' | 'drawing';
export type ResultStatus = 'ok' | 'failed' | 'unsupported' | 'non_converged';
export interface Fingerprint {
  inputs: Partial<Record<InputName, string>>;
  /** Each face it names, by its A1 signature then. */
  faces?: Record<string, Sig>;
  /** The stored references it relies on (A1's `where`: "mate m1"). */
  refs?: string[];
}
export interface Result {
  id: string; kind: ResultKind; subject: string; run: string;
  /** The instance it is about; none: the document's own part (or the whole assembly, for a BOM). */
  part?: string;
  status: ResultStatus;
  /** What it found; null when not ok. */
  value: unknown;
  /** Its number, where it has one (a mass, a measured value); null when not ok. */
  number: number | null;
  verdict?: 'pass' | 'fail' | 'unknown';
  why?: string;
  fingerprint: Fingerprint;
  /** Arrived after a later run for the same kind and subject opened: kept under its own run only. */
  late?: true;
}

// ——— the inputs
/** The authored evaluation inputs, including section/weld and catalogue rows, recursively for placed parts. */
export function modelInput(doc: StudioDoc): string { const housing = bearingDependencyKey(resolveShopTree(doc)); return digestOf(housing === undefined ? modelContent(doc) : { model: modelContent(doc), housing }); }
const ownMaterial = ([k, l]: [string, { material?: string }]) => [k, l.material ?? null] as const;
const partMaterial = (i: NonNullable<StudioDoc['instances']>[number]) => [i.id, materialInput(i.doc)] as const;
/** The material: each body's own (only its `material`: never its colour, appearance or name), the brief's, each part's. */
export function materialInput(doc: StudioDoc): string { return digestOf({ own: Object.entries(doc.bodies ?? {}).map(ownMaterial), brief: briefMaterial(doc) ?? null, parts: (doc.instances ?? []).map(partMaterial) }); }
const INPUTS: Record<Exclude<InputName, 'requirement'>, (doc: StudioDoc) => string> = {
  model: modelInput, material: materialInput,
  process: doc => digestOf({ process: doc.process ?? null, printer: doc.printer ?? null, print: doc.print ?? null, mould: doc.mould ?? null, machining: doc.machining ?? null, casting: doc.casting ?? null, brief: doc.brief?.process ?? null }),
  interfaces: doc => digestOf(readInterfaces(doc.interfaces)),
  references: doc => digestOf(doc.references ?? null),
  requirements: doc => digestOf(doc.requirements ?? []),
  drafts: doc => digestOf(doc.drafts ?? null),
  drawing: doc => digestOf(doc.drawing ?? null),
};
const inputOf = (doc: StudioDoc, name: InputName, subject: string) => (name === 'requirement' ? digestOf((doc.requirements ?? []).find(r => r.id === subject) ?? null) : INPUTS[name](doc));
/** What each kind reads. */
export const READS: Record<ResultKind, readonly InputName[]> = {
  requirement: ['model', 'requirement'], check_spec: ['model', 'material', 'process', 'references', 'requirements', 'drafts'], keepout: ['model', 'references'],
  mass: ['model', 'material'], inertia: ['model', 'material'], dfm: ['model', 'process', 'material'], bom: ['model', 'material', 'interfaces'], drawing: ['model', 'drawing'],
};
/** What a requirement's query reads besides its model and itself. */
const QUERY_READS: Partial<Record<Query['fn'], readonly InputName[]>> = { mass: ['material'], library_check: ['material', 'process'], print_rule: ['process', 'material'], overhang_area: ['process'], keepout: ['references'], datum_distance: ['references'] };
/** The faces a query names by name (a selector by role is resolved again by role: not pinned). */
function facesNamed(q: Query): string[] {
  const out: string[] = [], o = q as Record<string, unknown>;
  for (const k of ['face', 'a', 'b']) if (typeof o[k] === 'string' && /^n\d+\./.test(o[k] as string) && q.fn !== 'clearance' && !q.fn.startsWith('gear_')) out.push(o[k] as string);
  return out;
}
function faceSignatures(bodies: readonly BodyResult[]): Map<string, Signature> {
  const all = new Map<string, Signature>();
  for (const b of bodies) for (const [name, s] of signaturesOf(b).faces) all.set(name, s);
  return all;
}
const partDoc = (doc: StudioDoc, part?: string) => {
  if (!part) return resolveShopTree(doc);
  const child = doc.instances?.find(i => i.id === part)?.doc;
  return child ? resolveShopTree(child, doc, part) : undefined;
};

/** A result stamped with what it read. */
export function stamp(doc: StudioDoc, bodies: readonly BodyResult[], r: Omit<Result, 'fingerprint' | 'value' | 'number'> & { value?: unknown; number?: number | null }, o: { reads?: readonly InputName[]; faces?: readonly string[]; refs?: readonly string[] } = {}): Result {
  const d = partDoc(doc, r.part) ?? doc, names = [...new Set([...READS[r.kind], ...(o.reads ?? [])])].sort();
  const inputs: Fingerprint['inputs'] = {};
  for (const n of names) inputs[n] = inputOf(d, n, r.subject);
  const fingerprint: Fingerprint = { inputs };
  if (o.faces?.length) { const sigs = faceSignatures(bodies), faces: Record<string, Sig> = {}; for (const f of o.faces) { const s = sigs.get(f); if (s) faces[f] = toSig(s); } if (Object.keys(faces).length) fingerprint.faces = faces; }
  if (o.refs?.length) fingerprint.refs = [...o.refs];
  const ok = r.status === 'ok';
  return { ...r, value: ok ? r.value ?? null : null, number: ok ? r.number ?? null : null, ...(ok ? {} : { verdict: undefined }), fingerprint } as Result;
}

// ——— freshness
export interface Unresolved { face: string; why: 'gone' | 'ambiguous' | 'renamed' | 'reference'; candidates: string[]; message: string }
export interface Freshness { state: 'current' | 'stale' | 'unresolved'; changed: InputName[]; unresolved: Unresolved[] }
/** A result against the document as it is: each input's digest again, each face matched again by A1's one matcher. */
export async function freshnessOf(r: Result, doc: StudioDoc, evaluate: Evaluate): Promise<Freshness> {
  const d = partDoc(doc, r.part), changed: InputName[] = [], unresolved: Unresolved[] = [];
  if (!d) return { state: 'unresolved', changed, unresolved: [{ face: r.part!, why: 'gone', candidates: [], message: `the part ${r.part} is gone` }] };
  for (const [n, dg] of Object.entries(r.fingerprint.inputs) as [InputName, string][]) if (inputOf(d, n, r.subject) !== dg) changed.push(n);
  const needBodies = !!r.fingerprint.faces || !!r.fingerprint.refs?.length;
  const e = needBodies ? await evaluate(d) : null, bodies = e?.ok ? e.bodies : [];
  if (r.fingerprint.faces) {
    const sigs = faceSignatures(bodies);
    for (const [face, sig] of Object.entries(r.fingerprint.faces)) {
      const m = matchSignature(fromSig(sig), sigs, false);
      if (m === face) continue;
      if (typeof m === 'string') unresolved.push({ face, why: 'renamed', candidates: [m], message: `${face} is now named ${m}: the result is not moved to it` });
      else if (!m.length) unresolved.push({ face, why: 'gone', candidates: [], message: `${face} is gone` });
      else unresolved.push({ face, why: 'ambiguous', candidates: m, message: `${face} could be ${m.join(' or ')}` });
    }
  }
  if (r.fingerprint.refs?.length) {
    // (A stored reference: A1's own verification — a problem it cannot tell, or a re-match not yet confirmed by the user.)
    const v = await verifyReferences(d, bodies, evaluate), marked = markedReferences(v.doc);
    for (const where of r.fingerprint.refs) {
      for (const p of v.problems) if (p.where === where) unresolved.push({ face: p.name, why: p.candidates.length ? 'ambiguous' : 'gone', candidates: p.candidates, message: `${where}: "${p.name}" ${p.candidates.length ? `could be ${p.candidates.join(' or ')}` : 'is gone'}` });
      // (Marked: re-matched now, or earlier and not yet confirmed — either way not the face the result was about.)
      for (const mk of marked) if (mk.where === where) unresolved.push({ face: mk.was, why: 'renamed', candidates: [mk.now], message: `${where}: "${mk.was}" re-matched to "${mk.now}", not confirmed by the user` });
    }
  }
  return { state: unresolved.length ? 'unresolved' : changed.length ? 'stale' : 'current', changed, unresolved };
}
/** A result's number: only an ok result's (never a 0 for one that failed). */
export const numericOf = (r: Result): number | null => (r.status === 'ok' ? r.number : null);
/** Whether a result passes now: ok, a pass, and current. */
export const passes = (r: Result, f: Freshness) => r.status === 'ok' && r.verdict === 'pass' && f.state === 'current';
/** How a result is shown: its value only when current; stale or unresolved, said so first; not ok, its status and why. */
export function displayOf(r: Result, f: Freshness): string {
  const what = `${r.kind} ${r.subject}`;
  if (r.status !== 'ok') return `${what}: ${r.status.replace('_', '-')}${r.why ? ` — ${r.why}` : ''}`;
  const shown = `${r.number !== null ? r.number : JSON.stringify(r.value)?.slice(0, 80)}${r.verdict ? ` (${r.verdict})` : ''}`;
  if (f.state === 'stale') return `${what}: STALE — ${f.changed.join(', ')} changed since; it was ${shown}`;
  if (f.state === 'unresolved') return `${what}: UNRESOLVED — ${f.unresolved.map(u => u.message).join('; ')}; it was ${shown}`;
  return `${what}: ${shown}`;
}
export interface FreshSummary { pass: number; fail: number; unknown: number; stale: number; unresolved: number; failed: number; unsupported: number; non_converged: number }
/** Counts over results with their freshness: a pass only when ok, a pass and current; the rest by what they are. */
export function summaryOf(rs: readonly { result: Result; freshness: Freshness }[]): FreshSummary {
  const s: FreshSummary = { pass: 0, fail: 0, unknown: 0, stale: 0, unresolved: 0, failed: 0, unsupported: 0, non_converged: 0 };
  for (const { result: r, freshness: f } of rs) {
    if (r.status !== 'ok') s[r.status]++;
    else if (f.state !== 'current') s[f.state]++;
    else s[r.verdict ?? 'unknown']++;
  }
  return s;
}

// ——— runs: a result belongs to the run that made it
export interface Run { id: string; kind: ResultKind; subject: string; part?: string; seq: number }
export interface ResultStore { version: 1; seq: number; runs: Run[]; results: Result[] }
export const emptyStore = (): ResultStore => ({ version: 1, seq: 0, runs: [], results: [] });
const sameSubject = (a: { kind: ResultKind; subject: string; part?: string }, b: { kind: ResultKind; subject: string; part?: string }) => a.kind === b.kind && a.subject === b.subject && (a.part ?? '') === (b.part ?? '');
/** A run opened for a kind and subject: it supersedes every earlier one for them. */
export function openRun(store: ResultStore, kind: ResultKind, subject: string, part?: string): { store: ResultStore; run: string } {
  const seq = store.seq + 1, id = `R${seq}`;
  return { store: { ...store, seq, runs: [...store.runs, { id, kind, subject, ...(part ? { part } : {}), seq }] }, run: id };
}
/** A result recorded under its run; late when a later run for the same kind and subject was opened before it arrived. */
export function recordResult(store: ResultStore, r: Result): ResultStore {
  const run = store.runs.find(x => x.id === r.run);
  if (!run || !sameSubject(run, r)) throw refusal('NO_RUN', `${r.run} is not a run for ${r.kind} ${r.subject}`);
  const late = store.runs.some(x => x.seq > run.seq && sameSubject(x, run));
  return { ...store, results: [...store.results.filter(x => x.run !== r.run), late ? { ...r, late: true } : r] };
}
/** The result of the latest run for a kind and subject: pending until it arrives, never an earlier run's late one. */
export function currentOf(store: ResultStore, kind: ResultKind, subject: string, part?: string): Result | 'pending' | null {
  const runs = store.runs.filter(x => sameSubject(x, { kind, subject, part })); if (!runs.length) return null;
  const last = runs.reduce((a, b) => (b.seq > a.seq ? b : a));
  return store.results.find(x => x.run === last.id) ?? 'pending';
}

// ——— the producers: each result kind stamped, its failures its own status
async function bodiesOf(doc: StudioDoc, evaluate: Evaluate): Promise<{ ok: true; bodies: BodyResult[] } | { ok: false; why: string }> {
  const e = await evaluate(doc);
  if (!e?.ok) return { ok: false, why: e && !e.ok && 'error' in e ? `the part does not evaluate: ${JSON.stringify((e as { error: unknown }).error).slice(0, 160)}` : 'the part does not evaluate' };
  if (!e.bodies.length) return { ok: false, why: 'the part has no body' };
  return { ok: true, bodies: e.bodies };
}
const resultId = (kind: ResultKind, subject: string, run: string, part?: string) => `${kind}:${part ? `${part}/` : ''}${subject}@${run}`;
/** A requirement's outcome as a result: pass and fail ok; undecided ok with an unknown verdict; not measurable unsupported; no body failed. */
function fromOutcome(o: Outcome): { status: ResultStatus; verdict?: Result['verdict']; number?: number | null; value?: unknown; why?: string } {
  if (o.status === 'unknown') return /^undecided/.test(o.why ?? '') ? { status: 'ok', verdict: 'unknown', number: null, value: null, why: o.why } : { status: 'unsupported', why: o.why ?? 'cannot be measured' };
  if (o.measured === 'no body') return { status: 'failed', why: o.hint ?? 'the part has no body' };
  return { status: 'ok', verdict: o.status, number: typeof o.measured === 'number' ? o.measured : null, value: { measured: o.measured, delta: o.delta, entities: o.entities } };
}
/** Every requirement's verdict and the check_spec report, stamped. */
export async function requirementResults(doc: StudioDoc, evaluate: Evaluate, run: string, part?: string): Promise<Result[]> {
  const d = partDoc(doc, part)!, b = await bodiesOf(d, evaluate), bodies = b.ok ? b.bodies : [];
  const out: Result[] = [];
  const report = b.ok ? await checkSpec(d, bodies, evaluate) : null;
  for (const req of d.requirements ?? []) {
    const o = report ? report.outcomes.get(req.id)! : null, m = o ? fromOutcome(o) : { status: 'failed' as const, why: (b as { why: string }).why };
    out.push(stamp(doc, bodies, { id: resultId('requirement', req.id, run, part), kind: 'requirement', subject: req.id, run, ...(part ? { part } : {}), ...m }, { reads: QUERY_READS[req.check.query.fn] ?? [], faces: facesNamed(req.check.query) }));
  }
  const s = report?.summary;
  out.push(stamp(doc, bodies, { id: resultId('check_spec', 'all', run, part), kind: 'check_spec', subject: 'all', run, ...(part ? { part } : {}),
    ...(report ? { status: 'ok' as const, value: s, number: null, verdict: s!.fail ? 'fail' as const : s!.unknown ? 'unknown' as const : 'pass' as const } : { status: 'failed' as const, why: (b as { why: string }).why }) }));
  return out;
}
/** A keep-out's verdict: the least clearance at least 0 (A6.3), undecided within the chord tolerance. */
export async function keepoutResult(doc: StudioDoc, keepout: string, evaluate: Evaluate, run: string, part?: string): Promise<Result> {
  const d = partDoc(doc, part)!, b = await bodiesOf(d, evaluate), id = resultId('keepout', keepout, run, part), base = { id, kind: 'keepout' as const, subject: keepout, run, ...(part ? { part } : {}) };
  if (!b.ok) return stamp(doc, [], { ...base, status: 'failed', why: b.why });
  return stamp(doc, b.bodies, { ...base, ...fromOutcome(await runCheck(d, b.bodies, evaluate, { op: '>=', value: 0, query: { fn: 'keepout', keepout } })) });
}
/** The mass of a part's bodies (g), each body's material said assumed or not. */
export async function massResult(doc: StudioDoc, evaluate: Evaluate, run: string, part?: string): Promise<Result> {
  const d = partDoc(doc, part)!, b = await bodiesOf(d, evaluate), base = { id: resultId('mass', part ?? 'base', run, part), kind: 'mass' as const, subject: part ?? 'base', run, ...(part ? { part } : {}) };
  if (!b.ok) return stamp(doc, [], { ...base, status: 'failed', why: b.why });
  const incomplete = incompleteBeadReason(beadAccounting(d, b.bodies));
  if (incomplete) return stamp(doc, b.bodies, { ...base, status: 'unsupported', why: incomplete });
  const per = massProperties(d, b.bodies) as { body: string; mass: number | null; assumed: boolean }[];
  if (per.some(x => typeof x.mass !== 'number')) return stamp(doc, b.bodies, { ...base, status: 'unsupported', why: 'a body has no closed volume' });
  return stamp(doc, b.bodies, { ...base, status: 'ok', number: per.reduce((s, x) => s + x.mass!, 0), value: per.map(x => ({ body: x.body, mass: x.mass, assumed: x.assumed })) });
}
const IDENTITY = { origin: [0, 0, 0] as [number, number, number], R: [1, 0, 0, 0, 1, 0, 0, 0, 1] as [number, number, number, number, number, number, number, number, number] };
/** A part's mass (g), centroid (mm) and flat inertia about its centre (g·mm²); no body or no volume, failed. */
export async function inertiaResult(doc: StudioDoc, evaluate: Evaluate, run: string, part?: string): Promise<Result> {
  const d = partDoc(doc, part)!, b = await bodiesOf(d, evaluate), base = { id: resultId('inertia', part ?? 'base', run, part), kind: 'inertia' as const, subject: part ?? 'base', run, ...(part ? { part } : {}) };
  if (!b.ok) return stamp(doc, [], { ...base, status: 'failed', why: b.why });
  const incomplete = incompleteBeadReason(beadAccounting(d, b.bodies));
  if (incomplete) return stamp(doc, b.bodies, { ...base, status: 'unsupported', why: incomplete });
  const li = linkInertia(part ?? 'base', part ?? null, d, b.bodies, IDENTITY), bad = li.issues.filter(i => i.code === 'NO_BODY' || i.code === 'NO_VOLUME');
  if (bad.length) return stamp(doc, b.bodies, { ...base, status: 'failed', why: bad.map(i => i.message).join('; ') });
  const projection = inertiaJson(li);
  return stamp(doc, b.bodies, { ...base, status: 'ok', number: projection.mass, value: { mass: projection.mass, centroid: projection.centroid, inertia: projection.inertia.flat(), issues: li.issues.map(i => i.code) } });
}
/** Printability under the document's process: unsupported without a printing process; fail, unknown or pass by its rules. */
export async function dfmResult(doc: StudioDoc, evaluate: Evaluate, run: string, part?: string): Promise<Result> {
  const d = partDoc(doc, part)!, b = await bodiesOf(d, evaluate), base = { id: resultId('dfm', part ?? 'base', run, part), kind: 'dfm' as const, subject: part ?? 'base', run, ...(part ? { part } : {}) };
  if (!b.ok) return stamp(doc, [], { ...base, status: 'failed', why: b.why });
  const rep = await printability(d, b.bodies, evaluate);
  if (!rep.process || rep.rules.every(r => r.status === 'n/a')) return stamp(doc, b.bodies, { ...base, status: 'unsupported', why: rep.process ? `${rep.process} has no printing rules` : 'no process is set' });
  const v = rep.rules.some(r => r.status === 'fail') ? 'fail' : rep.rules.some(r => r.status === 'unknown') ? 'unknown' : 'pass';
  return stamp(doc, b.bodies, { ...base, status: 'ok', verdict: v, number: null, value: rep.rules.map(r => ({ id: r.id, status: r.status, ...(r.why ? { why: r.why } : {}) })) });
}
/** The BOM derived and checked against the assembly; a part that does not evaluate, failed. */
export async function bomResult(doc: StudioDoc, evaluate: Evaluate, run: string): Promise<Result> {
  const base = { id: resultId('bom', 'assembly', run), kind: 'bom' as const, subject: 'assembly', run };
  const inspect = async (d: StudioDoc, scope: string): Promise<string | null> => {
    if (d.nodes.length || (scope && !d.instances?.length)) {
      const b = await bodiesOf(d, evaluate);
      if (!b.ok) return `${scope || 'base'}: ${b.why}`;
      const incomplete = incompleteBeadReason(beadAccounting(d, b.bodies));
      if (incomplete) return `${scope || 'base'}: ${incomplete}`;
    }
    for (const inst of d.instances ?? []) { const why = await inspect(inst.doc, scope ? `${scope}/${inst.id}` : inst.id); if (why) return why; }
    return null;
  };
  const incomplete = await inspect(resolveShopTree(doc), '');
  if (incomplete) return stamp(doc, [], { ...base, status: /BEAD_ACCOUNTING_INCOMPLETE/.test(incomplete) ? 'unsupported' : 'failed', why: incomplete });
  const view = await bomView(doc, evaluate), bom = deriveBom(view), problems = checkBom(view, bom);
  return stamp(doc, [], { ...base, status: 'ok', verdict: problems.length ? 'fail' : 'pass', number: bom.totalMass, value: problems.length ? { bom, problems } : bom });
}
/** The drawing's issues: errors fail it; a drawing that cannot be built failed. */
export function drawingResult(doc: StudioDoc, run: string): Result {
  const base = { id: resultId('drawing', 'sheet', run), kind: 'drawing' as const, subject: 'sheet', run }, r = runDrawingTool(doc, 'drawing_issues', {});
  if ('error' in r) return stamp(doc, [], { ...base, status: 'failed', why: r.error });
  const issues = (r.content as { issues: { code: string; severity: string }[] }).issues;
  return stamp(doc, [], { ...base, status: 'ok', verdict: issues.some(i => i.severity === 'error') ? 'fail' : 'pass', number: issues.length, value: issues });
}
