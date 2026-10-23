// The chat tools' shared kit (R3, split from chat/tools.ts): the state a call acts on, its outcome, the per-call
// flags, and the helpers every handler uses — accept (evaluate a candidate, or refuse it) and fail (a refusal).
import { refOf, shownFields, type Field, type Values } from '../app/commands';
import { featureLabel, type StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import type { PersonRowFiles } from './rowFiles';
import type { ImageTrace } from './trace';
import type { NameSelection } from './names';
import { changeOf, factsOf } from './observe';
import type { Transactions } from './transactions';
import { expectedOf, runCheck, type Policy } from './spec';
import { captureSignatures, refreshSignatures } from '../engine/references';
import { documentBeadOwnershipError } from '../frames/beadOwnership';

/**
 * How much a result lists (A2.4): 'concise' facts and what changed without the bodies' faces and edges,
 * 'detailed' them all (paged), else ('auto') them when the part is small. Set per call from `response_format`.
 */
export let responseFormat: 'auto' | 'concise' | 'detailed' = 'auto';
/** The reason a change may break a passing hard requirement (`because`), per call. */
export let because = '';
/** A part tool call's flags, set as it starts (R3: they lived beside runPartTool, read by every handler). */
export function setCall(args: Record<string, unknown>): void {
  responseFormat = args.response_format === 'concise' || args.response_format === 'detailed' ? args.response_format : 'auto';
  because = typeof args.because === 'string' ? args.because : '';
}
/** The tools' own runner, passed to a handler that calls tools again (a batch, a script, a proposal) — no module imports tools.ts. */
export type PartRun = (state: ChatState, name: string, input: unknown, evaluate: Evaluate) => Promise<ToolOutcome>;
/** A part tool's handler (R3: one per v1 tool, in a module per v2 action group). */
export type PartHandler = (state: ChatState, args: Record<string, unknown>, evaluate: Evaluate, run: PartRun) => Promise<ToolOutcome>;

/** A selection by persistent names (stable across evaluations, unlike mesh indices). */
/** The part as the chat turn has built it so far. */
/** `images`: traces of the images attached in this conversation (image 1 first). */
/** `policy`: what the tools remember across a session's checks (chat/spec.ts). */
/** `turnBase`: the part as the turn found it (the L2 gate weighs the turn's changes against it, D41). */
/** `turns`: what the user typed in this conversation, sent by the studio (A6.2, O25), so a quote said to be theirs can be
 * checked; absent where no conversation is known (cad-cli, cad-mcp --doc, a plain script). */
export interface ChatState { doc: StudioDoc; bodies: BodyResult[]; /** FRf2: a part-scoped call's placed part (its document the state's). */ partOf?: string; selection?: NameSelection; images?: ImageTrace[]; policy?: Policy; tx?: Transactions; turnBase?: StudioDoc; turns?: readonly string[]; rowFiles?: PersonRowFiles }
export type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
/** `images`: PNGs to show the model along with the text (base64). */
export interface ToolOutcome { state: ChatState; content: string; isError: boolean; changed: boolean; summary: string; images?: { data: string; mediaType: 'image/png' }[] }

export const r3 = (v: number) => Math.round(v * 1000) / 1000;
export const v3 = (v: readonly number[]) => v.map(r3);
export const json = (v: unknown) => JSON.stringify(v);

/** The visible bodies, with their faces and edges by name when `detail` (`cap` a page, page `page` from 1). */
export function describeBodies(doc: StudioDoc, bodies: BodyResult[], detail: boolean, cap = 120, page = 1) {
  return bodies.map(b => {
    const ref = refOf(b), node = doc.nodes[ref.node], m = b.mesh;
    const out: Record<string, unknown> = {
      key: b.key, made_by: node ? `${ref.node}: ${featureLabel(node, ref.node, doc.nodes)}` : undefined, ...(b.idealModel ? { ideal_model: b.idealModel } : {}),
      volume_mm3: b.volumeMM3 === null ? null : r3(b.volumeMM3), bounds: { min: v3(m.bounds.min), max: v3(m.bounds.max) },
      face_count: m.faces.length, edge_count: m.edges.length,
    };
    if (detail) {
      const from = (page - 1) * cap, pages = Math.max(1, Math.ceil(Math.max(m.faces.length, m.edges.length) / cap));
      out.faces = m.faces.slice(from, from + cap).map(f => ({ name: f.name.split('+')[0], ...(f.name.includes('+') ? { also: f.name.split('+').slice(1) } : {}), kind: f.kind, normal: v3(f.normal), centre: v3(f.centroid), area_mm2: r3(f.areaMM2), ...(f.radius ? { radius: r3(f.radius) } : {}) }));
      out.edges = m.edges.slice(from, from + cap).map(e => ({ name: e.names[0], from: v3(e.a), to: v3(e.b), ...(e.straight ? { line: e.axis ? `along ${e.axis}` : 'oblique' } : { line: 'curve' }) }));
      if (pages > 1) out.page = { page, pages, note: `faces and edges ${from + 1}–${from + cap}; the next page: get_part_summary {"body": "${b.key}", "page": ${Math.min(pages, page + 1)}}` };
    }
    return out;
  });
}

export function features(doc: StudioDoc) {
  return doc.nodes.map((n, i) => ({ index: i, label: featureLabel(n, i, doc.nodes), node: n }));
}

/** At most this many checkpoints a session (the oldest dropped first). */
export const CHECKPOINTS = 20;

export const DETAIL_LIMIT = 80;

/** Evaluates a candidate document: the new state, or the engine's refusal as a tool error. */
export async function accept(state: ChatState, next: StudioDoc, evaluate: Evaluate, what: string, extra: Record<string, unknown> = {}, refresh = false): Promise<ToolOutcome> {
  const ownershipError = documentBeadOwnershipError(next);
  if (ownershipError) return fail(state, ownershipError);
  // (References written by this change get their signatures from the bodies they were picked on, engine/references.ts.)
  next = captureSignatures(next, state.bodies);
  const r = await evaluate(next);
  if (!r) return fail(state, 'The evaluation was superseded; try again.');
  if (!r.ok) return fail(state, `${r.error.title}. ${r.error.hint}`, { detail: r.error.detail, kept: 'the part is unchanged' });
  // (A change breaking a hard requirement that passed at the last check is refused, unless it says why.)
  const broken: string[] = [];
  if (state.policy?.passedHard.length && !because) for (const id of state.policy.passedHard) {
    const req = next.requirements?.find(q => q.id === id); if (!req) continue;
    const o = await runCheck(next, r.bodies, evaluate, req.check);
    if (o.status === 'fail') broken.push(`${id} ("${req.source}": measured ${JSON.stringify(o.measured)}, expected ${expectedOf(req.check)})`);
  }
  if (broken.length) return fail(state, `This change breaks hard requirement${broken.length > 1 ? 's' : ''} that passed: ${broken.join('; ')}. Change it otherwise, or make it anyway with "because": why.`, { kept: 'the part is unchanged' });
  // (An accepted edit, its names matched against the document before it: the signatures follow the part.)
  if (refresh) next = await refreshSignatures(next, r.bodies, evaluate);
  const entries = r.bodies.reduce((s, b) => s + b.mesh.faces.length + b.mesh.edges.length, 0);
  // On a big part, the bodies this change made (or changed) are still listed in full, when small enough.
  const fresh = new Set(state.bodies.map(b => `${b.key}:${b.volumeMM3}`));
  // (Compact facts after every change and what changed, A2.1; faces and edges in detail through inspect.)
  const facts = factsOf(next, r.bodies), change = changeOf(factsOf(state.doc, state.bodies), facts);
  const result = {
    ok: true, did: what, ...extra, feature_count: next.nodes.length, facts, change,
    ...(responseFormat === 'concise' ? {} : { bodies: entries <= DETAIL_LIMIT || responseFormat === 'detailed' ? describeBodies(next, r.bodies, true)
      : r.bodies.map(b => describeBodies(next, [b], !fresh.has(`${b.key}:${b.volumeMM3}`) && b.mesh.faces.length + b.mesh.edges.length <= DETAIL_LIMIT)[0]),
    ...(entries > DETAIL_LIMIT && responseFormat !== 'detailed' ? { note: 'faces and edges of other bodies: get_part_summary {"body": key}' } : {}) }),
  };
  return { state: { ...state, doc: next, bodies: r.bodies }, content: json(result), isError: false, changed: true, summary: `${what} → ${r.bodies.length} bod${r.bodies.length === 1 ? 'y' : 'ies'}${r.bodies[0]?.volumeMM3 != null ? `, ${Math.round(r.bodies.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0))} mm³` : ''}` };
}

export function fail(state: ChatState, reason: string, extra: Record<string, unknown> = {}): ToolOutcome {
  return { state, content: json({ ok: false, error: reason, ...extra }), isError: true, changed: false, summary: reason };
}

export function checkValues(fields: Field[], values: Values): string | null {
  for (const f of shownFields(fields, values)) {
    const v = values[f.key];
    if (v === undefined || v === '') return `"${f.key}" (${f.label}) is required.`;
    if (f.kind === 'choice') { if (!f.options.some(o => o.value === String(v))) return `"${f.key}" is one of ${f.options.map(o => o.value).join(', ')}.`; continue; }
    const n = Number(v);
    if (!Number.isFinite(n)) return `"${f.key}" (${f.label}) must be a number.`;
    if (f.kind === 'count' && !Number.isInteger(n)) return `"${f.key}" must be a whole number.`;
    if (f.min !== undefined && n < f.min) return `"${f.key}" (${f.label}) must be at least ${f.min}.`;
    if (f.max !== undefined && n > f.max) return `"${f.key}" (${f.label}) must be at most ${f.max}.`;
  }
  return null;
}

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const strings = (v: unknown) => Array.isArray(v) ? v.map(String) : [];
/** A list of names or selectors (objects kept as they are). */
export const list = (v: unknown): unknown[] => Array.isArray(v) ? v.map(x => isObj(x) ? x : String(x)) : [];
