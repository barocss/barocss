// The AI evaluation's judge: what a run left — the StudioDoc in its state file — read afresh by the engine, never the
// model's word. A brief's oracle is a list of checks on a Judged document: its bodies (base part and each placed part,
// evaluated again here), the assembly as placed, and the engine's own read actions run on it (dispatchTool on a fresh
// state: BOM, joints, drawing issues, manufacturability). Each check is scored; a run passes when every hard check does.
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { resolveShopTree } from '@barocss/cad-model/engine/shopRows';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { assemblyPlacedBodies, type PlacedBody } from '@barocss/cad-model/team/clearanceMap';

export interface Check { id: string; what: string; pass: boolean; hard: boolean; measured?: unknown; expected?: unknown }
export interface Judged {
  doc: StudioDoc;
  /** The base part's bodies (null: it does not evaluate). */
  base: BodyResult[] | null;
  /** Each placed part's own bodies, by instance id (null: it does not evaluate). */
  parts: Record<string, BodyResult[] | null>;
  placed: PlacedBody[];
  /** An engine read action on the document, its JSON (or {error}). */
  read(tool: string, args: Record<string, unknown>): Promise<Record<string, any>>;
}

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const bodiesOf = (r: Awaited<ReturnType<typeof evaluate>>) => r && r.ok ? [...r.bodies] : null;

export async function judge(doc: StudioDoc): Promise<Judged> {
  const base = bodiesOf(await evaluate(resolveShopTree(doc)));
  const parts: Judged['parts'] = {};
  for (const inst of doc.instances ?? []) { try { parts[inst.id] = bodiesOf(await evaluate(resolveShopTree(inst.doc, doc, inst.id))); } catch { parts[inst.id] = null; } }
  let placed: PlacedBody[] = [];
  try { placed = await assemblyPlacedBodies(doc, evaluate); } catch { /* none placed */ }
  const state = { doc, bodies: base ?? [], turnBase: doc } as unknown as ChatState;
  return {
    doc, base, parts, placed,
    async read(tool, args) {
      try {
        const r = await dispatchTool(state, tool, args, evaluate);
        let j: unknown; try { j = JSON.parse(r.content); } catch { j = { text: r.content }; }
        return r.isError ? { error: (j as { error?: string }).error ?? r.content } : j as Record<string, any>;
      } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
    },
  };
}

// The checks.
export const check = (id: string, what: string, pass: boolean, measured?: unknown, expected?: unknown, hard = true): Check => ({ id, what, pass, hard, ...(measured !== undefined ? { measured } : {}), ...(expected !== undefined ? { expected } : {}) });
const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Solids (bodies with a volume) of a part. */
export const solids = (b: BodyResult[] | null) => (b ?? []).filter(x => (x.volume ?? 0) > 0 && x.role !== 'infill');
export const volumeOf = (b: BodyResult[] | null) => r3(solids(b).reduce((s, x) => s + (x.volume ?? 0), 0));
/** The bodies' overall box, sorted smallest first (the brief's sizes, in whichever axis the agent put them). */
export function sizeOf(b: BodyResult[] | null): number[] {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const x of solids(b)) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], x.mesh.bounds.min[k]); hi[k] = Math.max(hi[k], x.mesh.bounds.max[k]); }
  return lo[0] === Infinity ? [] : hi.map((h, k) => r3(h - lo[k]));
}
export const sorted = (v: number[]) => [...v].sort((a, b) => a - b);
/** The part's overall size against the brief's, in any axis order, within `tol` mm each. */
export function size(id: string, b: BodyResult[] | null, want: number[], tol = 0.2, hard = true): Check {
  const got = sorted(sizeOf(b)), w = sorted(want);
  return check(id, `overall size ${w.join(' × ')} mm (any axis order, ±${tol})`, got.length === 3 && got.every((g, k) => Math.abs(g - w[k]) <= tol), got, w, hard);
}
/** The solids' total volume within a relative band of the closed form. */
export function volume(id: string, b: BodyResult[] | null, want: number, rel = 0.005, what = 'volume', hard = true): Check {
  const got = volumeOf(b);
  return check(id, `${what} ${r3(want)} mm³ ±${(rel * 100).toFixed(1)} %`, Math.abs(got - want) <= rel * want, got, r3(want), hard);
}
export const oneSolid = (id: string, b: BodyResult[] | null, n = 1, hard = true) => check(id, `${n} solid${n > 1 ? 's' : ''}`, solids(b).length === n, solids(b).length, n, hard);
export const evaluates = (id: string, b: BodyResult[] | null) => check(id, 'the part evaluates', b !== null && solids(b).length > 0, b === null ? 'does not evaluate' : `${solids(b).length} solids`);
/** Every node of a document, its placed parts' too. */
export function allNodes(doc: StudioDoc): { kind: string; [k: string]: any }[] {
  return [...doc.nodes, ...(doc.instances ?? []).flatMap(i => allNodes(i.doc))] as never;
}
export const hasKind = (id: string, doc: StudioDoc, kinds: string | RegExp, what: string, min = 1, hard = true) => {
  const n = allNodes(doc).filter(x => typeof kinds === 'string' ? x.kind === kinds : kinds.test(x.kind)).length;
  return check(id, what, n >= min, n, `≥ ${min}`, hard);
};
/** A read action that answers without a refusal. */
export async function reads(id: string, j: Judged, tool: string, args: Record<string, unknown>, what: string, hard = true): Promise<Check & { result: Record<string, any> }> {
  const r = await j.read(tool, args);
  return { ...check(id, what, !r.error, r.error ? String(r.error).slice(0, 300) : 'answered', undefined, hard), result: r };
}

export interface Score { pass: boolean; score: number; hardPassed: number; hard: number; checks: Check[] }
export function scoreOf(checks: Check[]): Score {
  const hard = checks.filter(c => c.hard), passed = checks.filter(c => c.pass);
  return { pass: hard.every(c => c.pass), score: checks.length ? r3(passed.length / checks.length) : 0, hardPassed: hard.filter(c => c.pass).length, hard: hard.length, checks };
}

// The long briefs' elements (the owner, 2026-10-24): each element of a descriptive prompt scored per run as done,
// approximated (and how), missing, or refused (the tool's refusal). Scripted where an oracle can read it from the
// document; else judged by a reviewer from the run's stills (review.json), and said which.
export type ElementStatus = 'done' | 'approximated' | 'missing' | 'refused';
export interface ElementVerdict { status: ElementStatus; how?: string; evidence?: unknown }
export interface Element { id: string; what: string; oracle?: (j: Judged, calls: { tool: string; args: unknown; ok: boolean; error?: string; text: string }[]) => Promise<ElementVerdict> | ElementVerdict }
export interface ElementResult extends Partial<ElementVerdict> { id: string; what: string; by: 'oracle' | 'review' | 'pending' }
export interface Review { schema: string; by: string; at: string; elements: Record<string, ElementVerdict>; notes?: string }
export async function elementsOf(elements: readonly Element[], j: Judged, calls: Parameters<NonNullable<Element['oracle']>>[1], review: Review | null): Promise<ElementResult[]> {
  const out: ElementResult[] = [];
  for (const e of elements) {
    if (e.oracle) { try { out.push({ id: e.id, what: e.what, by: 'oracle', ...(await e.oracle(j, calls)) }); } catch (x) { out.push({ id: e.id, what: e.what, by: 'oracle', status: 'missing', how: `the oracle failed: ${x instanceof Error ? x.message : String(x)}` }); } }
    else if (review?.elements[e.id]) out.push({ id: e.id, what: e.what, by: 'review', ...review.elements[e.id] });
    else out.push({ id: e.id, what: e.what, by: 'pending' });
  }
  return out;
}
