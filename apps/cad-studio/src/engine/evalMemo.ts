// PERF3 A3 (D82): an agent's ops evaluate the same parts again — a proposal's ops when it is accepted or rebased, the
// unchanged prefixes a reference check reads after every batch. Kept by what an evaluation reads (evaluatedPart:
// nodes, parameters, outputs, instances), the last few; a refusal or a superseded run is not kept.
import type { StudioDoc } from './doc';
import type { EvalResult } from './evaluate';
import { evaluatedPart } from './wireDoc';

export type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
const KEEP = 16;
const kept = new Map<string, Promise<EvalResult | null>>();
const memos = new WeakMap<Evaluate, Evaluate>();

/** The evaluation by content: the same part again is the result already made (or being made). */
export function rememberedEvaluate(evaluate: Evaluate): Evaluate {
  let m = memos.get(evaluate);
  if (!m) { m = (doc: StudioDoc) => evaluateKept(doc, evaluate); memos.set(evaluate, m); memos.set(m, m); }
  return m;
}
function evaluateKept(doc: StudioDoc, evaluate: Evaluate): Promise<EvalResult | null> {
  const key = JSON.stringify(evaluatedPart(doc)), have = kept.get(key);
  if (have) { kept.delete(key); kept.set(key, have); return have; }
  const result = evaluate(doc);
  kept.set(key, result); if (kept.size > KEEP) kept.delete(kept.keys().next().value!);
  void result.then(r => forgetUnless(key, result, !!r?.ok), () => forgetUnless(key, result, false));
  return result;
}
function forgetUnless(key: string, result: Promise<EvalResult | null>, ok: boolean) { if (!ok && kept.get(key) === result) kept.delete(key); }
