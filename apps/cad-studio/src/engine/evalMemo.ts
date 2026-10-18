// PERF3 A3 (D82): an agent's ops evaluate the same parts again — a proposal's ops when it is accepted or rebased, the
// unchanged prefixes a reference check reads after every batch. Kept by what an evaluation reads (evaluatedPart:
// nodes, parameters, outputs, instances), the last few; a refusal or a superseded run is not kept.
//
// The key is the part's JSON with every node's text kept per node object, and long texts and number arrays in it
// replaced by short stand-ins: an imported STEP text by an id (exact: a small map of the texts seen), a mesh's or a
// cage's numbers by their length and a 64-bit digest. Whole JSON cost 69 ms a lookup with a 30 MB STEP import and
// 53 ms with a 200k-triangle inline mesh; a batch looks up about one part per op and per reference.
import type { ModelNode, StudioDoc } from './doc';
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
const LONG_TEXT = 1 << 16, LONG_ARRAY = 1 << 12, TEXTS = 8;
const texts = new Map<string, number>();
let nextText = 1;
function textId(t: string): number {
  let id = texts.get(t);
  if (id === undefined) { id = nextText++; texts.set(t, id); if (texts.size > TEXTS) texts.delete(texts.keys().next().value!); }
  else { texts.delete(t); texts.set(t, id); }
  return id;
}
const digests = new WeakMap<readonly unknown[], string>();
const bits = new Float64Array(1), words = new Uint32Array(bits.buffer);
/** A long number array's stand-in: its length and two 32-bit FNV-1a hashes of its doubles (kept per array). */
function arrayDigest(a: readonly unknown[]): string | null {
  let d = digests.get(a);
  if (d !== undefined) return d;
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ a.length;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]; if (typeof x !== 'number') return null;
    bits[0] = x; h1 = Math.imul(h1 ^ words[0], 0x01000193); h1 = Math.imul(h1 ^ words[1], 0x01000193); h2 = Math.imul(h2 ^ words[1], 0x01000193) ^ (h2 >>> 13); h2 = Math.imul(h2 ^ words[0], 0x01000193);
  }
  d = `\u0000a${a.length}:${(h1 >>> 0).toString(36)}:${(h2 >>> 0).toString(36)}`; digests.set(a, d);
  return d;
}
function shortened(_k: string, v: unknown): unknown {
  if (typeof v === 'string') return v.length > LONG_TEXT ? `\u0000t${textId(v)}` : v;
  if (Array.isArray(v) && v.length > LONG_ARRAY) return arrayDigest(v) ?? v;
  return v;
}
const nodeKeys = new WeakMap<ModelNode, string>();
function nodeKey(n: ModelNode): string { let k = nodeKeys.get(n); if (k === undefined) { k = JSON.stringify(n, shortened); nodeKeys.set(n, k); } return k; }
/** What an evaluation of the document reads, as a key. */
export function evaluationKey(doc: StudioDoc): string {
  const part = evaluatedPart(doc);
  return `${doc.nodes.map(nodeKey).join('\u0001')}\u0002${JSON.stringify({ ...part, nodes: [] }, shortened)}`;
}
function evaluateKept(doc: StudioDoc, evaluate: Evaluate): Promise<EvalResult | null> {
  const key = evaluationKey(doc), have = kept.get(key);
  if (have) { kept.delete(key); kept.set(key, have); return have; }
  const result = evaluate(doc);
  kept.set(key, result); if (kept.size > KEEP) kept.delete(kept.keys().next().value!);
  void result.then(r => forgetUnless(key, result, !!r?.ok), () => forgetUnless(key, result, false));
  return result;
}
function forgetUnless(key: string, result: Promise<EvalResult | null>, ok: boolean) { if (!ok && kept.get(key) === result) kept.delete(key); }
