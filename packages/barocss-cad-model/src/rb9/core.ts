// The RB9 ladder harness's core (O70, RB9.1): a rung's parameter space and seeded sampler (edge-of-range values forced in
// the first trials, so the scripted agent's pass^k is not luck), its hidden checker's predicates, its scripted ideal
// agent, its mutants; one trial built on a fresh document through the agent's own tools (dispatchTool, the tool layer the
// chat server's MCP server runs), checked after it stops; the metrics (pass@1, pass@k, pass^k, the Requirement Score).
import { emptyDoc, type StudioDoc } from '../engine/doc';
import { evaluatePart, type BodyResult } from '../engine/evaluate';
import { dispatchTool, type ChatState } from '../chat/tools';

export type Params = Record<string, number | string>;
export interface Call { tool: string; args: Record<string, unknown> }
/** A parameter: its range (which may depend on those before it), a step, or a choice. */
export type Dim = { key: string; lo: number | ((p: Params) => number); hi: number | ((p: Params) => number); step: number } | { key: string; choice: readonly string[] };
/** One predicate of the hidden checker: whether it holds, what it measured and what it asked. */
export interface Outcome { id: string; hard: boolean; pass: boolean; measured: unknown; expected: string }
export interface Built { doc: StudioDoc; bodies: readonly BodyResult[] }
export type Evaluate = (doc: StudioDoc) => Promise<ReturnType<typeof evaluatePart>>;
/** `target`: the predicate it must fail (by the parameters, when a rung's families differ). */
export interface Mutant { id: string; target: string | ((p: Params) => string); why: string; calls(p: Params): Call[] }
export interface Rung {
  n: number; id: string; title: string;
  space: readonly Dim[];
  prompt(p: Params): string;
  /** The ideal agent's calls (the json arm's tools). */
  scripted(p: Params): Call[];
  /** The hidden checker: run on the part the agent leaves, never shown to it. */
  check(b: Built, p: Params, evaluate: Evaluate): Promise<Outcome[]>;
  mutants: readonly Mutant[];
}

/** mulberry32: a small seeded PRNG (deterministic across runs and platforms). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Trial k's corner pattern: 0 every parameter at its low end, 1 at its high end, 2 alternating, 3 the other alternation; then random. */
function cornerOf(k: number, i: number): number | null { return k === 0 ? 0 : k === 1 ? 1 : k === 2 ? i % 2 : k === 3 ? 1 - i % 2 : null; }
const at = (v: number | ((p: Params) => number), p: Params) => (typeof v === 'number' ? v : v(p));
/** Trial k's parameters from the seed: the edge patterns first, the rest uniform on the step grid. */
export function sample(space: readonly Dim[], seed: number, k: number): Params {
  const rnd = prng(seed * 7919 + k * 104729 + 1), p: Params = {};
  space.forEach((d, i) => {
    const c = cornerOf(k, i), u = c ?? rnd();
    if ('choice' in d) { p[d.key] = d.choice[c === null ? Math.floor(u * d.choice.length) % d.choice.length : c === 0 ? 0 : d.choice.length - 1]; return; }
    const lo = at(d.lo, p), hi = at(d.hi, p), n = Math.max(0, Math.floor((hi - lo) / d.step + 1e-9));
    p[d.key] = Math.round((lo + Math.min(n, Math.floor(u * (n + 1))) * d.step) * 1e9) / 1e9;
  });
  return p;
}

const evaluate: Evaluate = async doc => evaluatePart(doc, 1);
/** The calls made on a fresh document, one at a time as the agent's turn would (L2: applied directly); stops at a refusal. */
export async function build(calls: readonly Call[], prompt = ''): Promise<Built & { refused: string[]; calls: number }> {
  // (The brief's words as the conversation: a brief field "stated" quotes them, A6.1.)
  let state: ChatState = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc(), turns: prompt ? [prompt] : [] };
  const refused: string[] = [];
  for (const c of calls) {
    const r = await dispatchTool(state, c.tool, c.args, evaluate);
    if (r.isError) { refused.push(`${c.tool}: ${r.content.slice(0, 200)}`); break; }
    state = r.state;
  }
  const e = await evaluate(state.doc);
  return { doc: state.doc, bodies: e.ok ? e.bodies : [], refused, calls: calls.length };
}

export interface Trial { rung: string; trial: number; seed: number; params: Params; pass: boolean; rs: number; outcomes: Outcome[]; refused: string[]; calls: number; wallTime: number }
/** One trial: sampled, built by the scripted agent, checked. */
export async function runTrial(rung: Rung, seed: number, k: number): Promise<Trial> {
  const params = sample(rung.space, seed, k), t0 = performance.now(), b = await build(rung.scripted(params), rung.prompt(params));
  const outcomes = await rung.check(b, params, evaluate), hard = outcomes.filter(o => o.hard);
  return { rung: rung.id, trial: k, seed, params, pass: !b.refused.length && hard.every(o => o.pass), rs: hard.length ? hard.filter(o => o.pass).length / hard.length : 0, outcomes, refused: b.refused, calls: b.calls, wallTime: Math.round(performance.now() - t0) / 1000 };
}
export interface MutantResult { rung: string; mutant: string; target: string; why: string; killed: boolean; failed: string[]; params: Params }
/** Each mutant on trial 0's and trial 1's parameters (both range ends): killed when its targeted predicate fails. */
export async function runMutants(rung: Rung, seed: number): Promise<MutantResult[]> {
  const out: MutantResult[] = [];
  for (const m of rung.mutants) for (const k of [0, 1]) {
    const params = sample(rung.space, seed, k), b = await build(m.calls(params), rung.prompt(params)), outcomes = await rung.check(b, params, evaluate);
    const failed = [...outcomes.filter(o => !o.pass).map(o => o.id), ...(b.refused.length ? ['(refused)'] : [])];
    const target = typeof m.target === 'function' ? m.target(params) : m.target;
    out.push({ rung: rung.id, mutant: `${m.id}@${k}`, target, why: m.why, killed: failed.includes(target), failed, params });
  }
  return out;
}

export interface RungSummary { rung: string; n: number; title: string; trials: number; passed: number; pass1: number; passAtK: boolean; passPowK: boolean; rs: number; mutants: number; killed: number; predicates: string[]; unkilled: string[] }
/** Per rung: pass@1 = c/n, pass@k (any), pass^k (all), the mean Requirement Score; the mutants killed and the predicates no mutant targets. */
export function summarize(rung: Rung, trials: readonly Trial[], mutants: readonly MutantResult[]): RungSummary {
  const preds = [...new Set(trials.flatMap(t => t.outcomes.filter(o => o.hard).map(o => o.id)))], targeted = new Set(mutants.filter(m => m.killed).map(m => m.target));
  return { rung: rung.id, n: rung.n, title: rung.title, trials: trials.length, passed: trials.filter(t => t.pass).length, pass1: trials.length ? trials.filter(t => t.pass).length / trials.length : 0,
    passAtK: trials.some(t => t.pass), passPowK: trials.every(t => t.pass), rs: trials.length ? trials.reduce((s, t) => s + t.rs, 0) / trials.length : 0,
    mutants: mutants.length, killed: mutants.filter(m => m.killed).length, predicates: preds, unkilled: preds.filter(id => !targeted.has(id)) };
}
