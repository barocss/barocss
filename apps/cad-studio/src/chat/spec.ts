// Requirements as executable checks (A3.1). The brief is kept in the document (`StudioDoc.requirements`): each
// requirement quotes its source text, says what it is about, and carries a predicate — declarative JSON, never
// code: `{op, query: {fn, …}, value, tol, unit}`. The query functions measure with what the agent has (facts,
// measure, analysis), their subjects by names or selectors (A1: stable feature ids; selectors resolve to names).
// `check_spec` runs every predicate against the part as it stands: pass, fail, or unknown with why (an assumed
// material, a missing reference, an analysis that does not apply). Failures in full, passes by count.
import { featureLabel, type StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import { nodeIndexOf } from '../engine/ids';
import { measureBetween, type MeasurePick } from '../app/measure';
import { resolveEdge, resolveFace, resolveNames } from './names';
import { factsOf } from './observe';
import { draftAnalysis, interference, wallThickness } from './analysis';

/** What is measured. Subjects (`a`, `b`, `face`) are face or edge names or selectors; `body` a body key (none: the part). */
export type Query =
  | { fn: 'bbox'; axis: 'x' | 'y' | 'z'; body?: string }
  | { fn: 'volume'; body?: string }
  | { fn: 'mass'; body?: string }
  | { fn: 'count_solids' }
  | { fn: 'count_faces_of_kind'; kind: 'plane' | 'curved'; body?: string }
  | { fn: 'distance_between'; a: unknown; b: unknown }
  | { fn: 'radius'; face: unknown }
  | { fn: 'hole_diameter'; face: unknown }
  | { fn: 'min_wall'; body?: string }
  | { fn: 'draft_min'; body?: string; pull?: [number, number, number] }
  | { fn: 'clearance'; a: string; b: string };
/** `==`: value ± tol; `<=` / `>=`: against value (tol allowed); `between`: min … max. */
export interface Predicate { op: '==' | '<=' | '>=' | 'between'; query: Query; value?: number; tol?: number; min?: number; max?: number; unit?: string }
export interface Requirement {
  id: string;
  /** The words it comes from, quoted as given. */
  source: string;
  /** What it is about, in words. */
  subject?: string;
  assume?: string;
  /** Hard: the part fails without it; soft: a preference. */
  hard: boolean;
  /** stated: given; assumed: chosen where the brief said nothing; ambiguous: the brief can be read more ways. */
  basis?: 'stated' | 'assumed' | 'ambiguous';
  check: Predicate;
}

export interface Failure { req_id: string; check: string; measured: unknown; expected: string; delta?: number; entities?: string[]; feature?: string; hint: string }
export interface Report {
  model_hash: string; summary: { pass: number; fail: number; unknown: number; hard_failing: number };
  failures: Failure[]; unknowns: { req_id: string; why: string }[];
}
export type Outcome = { status: 'pass' | 'fail' | 'unknown'; measured?: unknown; delta?: number; entities?: string[]; why?: string; hint?: string };
type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
/** A short hash of the model (its features, parameters and looks): a report says which model it is about. */
export function modelHash(doc: StudioDoc): string {
  const s = JSON.stringify([doc.nodes, doc.parameters, doc.bodies]); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export const expectedOf = (p: Predicate) => (p.op === '==' ? `${p.value} ± ${p.tol ?? 0}` : p.op === 'between' ? `${p.min} … ${p.max}` : `${p.op} ${p.value}${p.tol ? ` (± ${p.tol})` : ''}`) + (p.unit ? ` ${p.unit}` : '');
/** Whether `x` meets the predicate, and by how much it misses (signed: positive over). */
export function meets(x: number, p: Predicate): { ok: boolean; delta: number } {
  const t = (p.tol ?? 0) + 1e-9 * Math.max(1, Math.abs(p.value ?? 0));
  switch (p.op) {
    case '==': return { ok: Math.abs(x - p.value!) <= t, delta: x - p.value! };
    case '<=': return { ok: x <= p.value! + t, delta: Math.max(0, x - p.value!) };
    case '>=': return { ok: x >= p.value! - t, delta: Math.min(0, x - p.value!) };
    case 'between': return { ok: x >= p.min! - 1e-9 && x <= p.max! + 1e-9, delta: x < p.min! ? x - p.min! : x > p.max! ? x - p.max! : 0 };
  }
}

function featureOf(doc: StudioDoc, names: readonly string[]): string | undefined {
  const ids = names.flatMap(n => n.split(/[|+]/).map(p => nodeIndexOf(doc.nodes, p.split('.')[0]))).filter(i => i >= 0);
  if (!ids.length) return undefined;
  const i = Math.max(...ids); return `${i}: ${featureLabel(doc.nodes[i], i, doc.nodes)}`;
}
/** A face or edge from a name or selector, or why not. */
function pickOf(doc: StudioDoc, bodies: readonly BodyResult[], sel: unknown): { name: string; pick: MeasurePick } | string {
  const isEdge = typeof sel === 'object' && sel !== null && 'between' in sel;
  const r = isEdge ? resolveEdge(doc.nodes, bodies, sel) : resolveFace(doc.nodes, bodies, sel);
  if (typeof r === 'string') return r;
  if (r.length !== 1) return `${JSON.stringify(sel)} is ${r.length} faces; a check takes one`;
  const name = r[0], { selection } = resolveNames(bodies as BodyResult[], { faces: [name], edges: [name] });
  if (selection.faces[0]) return { name, pick: { body: selection.faces[0].body, face: selection.faces[0].face } };
  if (selection.edges[0]) return { name, pick: { body: selection.edges[0].body, edge: selection.edges[0].edge } };
  return `no face or edge named "${name}"`;
}
const bodiesOf = (bodies: readonly BodyResult[], key?: string) => key ? bodies.filter(b => b.key === key) : bodies;

/** A query's measurement, with the faces or bodies it is about; or unknown with why. */
async function measure(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, q: Query): Promise<{ x: number; entities?: string[]; hint?: string } | { unknown: string }> {
  if ('body' in q && q.body !== undefined && !bodies.some(b => b.key === q.body)) return { unknown: `no body ${q.body} (bodies: ${bodies.map(b => b.key).join(', ') || 'none'})` };
  const facts = factsOf(doc, bodiesOf(bodies, 'body' in q ? q.body : undefined));
  switch (q.fn) {
    case 'bbox': { const k = 'xyz'.indexOf(q.axis); return facts.bbox ? { x: facts.bbox.max[k] - facts.bbox.min[k], hint: `the overall ${q.axis} size` } : { unknown: 'no body' }; }
    case 'volume': return { x: facts.volume_mm3 };
    case 'mass': return facts.mass_assumed ? { unknown: `the material of ${facts.materials.filter(m => m.assumed).map(m => m.body).join(', ')} is not set: its mass is assumed (aluminium); set the material first` } : { x: facts.mass_g };
    case 'count_solids': return { x: facts.solids };
    case 'count_faces_of_kind': return { x: bodiesOf(bodies, q.body).reduce((n, b) => n + b.mesh.faces.filter(f => f.kind === q.kind).length, 0) };
    case 'distance_between': {
      const a = pickOf(doc, bodies, q.a), b = pickOf(doc, bodies, q.b);
      if (typeof a === 'string') return { unknown: a }; if (typeof b === 'string') return { unknown: b };
      const m = measureBetween(bodies[a.pick.body].mesh, a.pick, bodies[b.pick.body].mesh, b.pick);
      return { x: m.normalDistance ?? m.distance, entities: [a.name, b.name], hint: m.normalDistance !== undefined ? 'the normal distance between parallel faces' : 'the shortest distance' };
    }
    case 'radius': case 'hole_diameter': {
      const a = pickOf(doc, bodies, q.face); if (typeof a === 'string') return { unknown: a };
      const f = a.pick.face !== undefined ? bodies[a.pick.body].mesh.faces[a.pick.face] : undefined;
      if (!f?.radius) return { unknown: `${a.name} is not a round face` };
      return { x: q.fn === 'radius' ? f.radius : 2 * f.radius, entities: [a.name] };
    }
    case 'min_wall': {
      const walls = bodiesOf(bodies, q.body).map(b => wallThickness(b)) as { thinnest_mm: number | null; face?: string }[];
      const thin = walls.filter(w => w.thinnest_mm !== null).sort((x, y) => x.thinnest_mm! - y.thinnest_mm!)[0];
      return thin ? { x: thin.thinnest_mm!, ...(thin.face ? { entities: [thin.face] } : {}), hint: 'the thinnest wall (display mesh)' } : { unknown: 'no wall measured' };
    }
    case 'draft_min': {
      const walls = bodiesOf(bodies, q.body).flatMap(b => draftAnalysis(b, q.pull ?? [0, 0, 1]).walls as { face: string; draft_deg: number }[]);
      if (!walls.length) return { unknown: 'no flat walls to judge (curved faces are not judged)' };
      const worst = [...walls].sort((x, y) => x.draft_deg - y.draft_deg)[0];
      return { x: worst.draft_deg, entities: [worst.face], hint: 'the least drafted flat wall' };
    }
    case 'clearance': {
      const pairs = await interference(doc, bodies, evaluate, [q.a, q.b]) as { overlap_mm3?: number; clearance_mm?: number }[];
      if (!pairs.length) return { unknown: `bodies ${q.a} and ${q.b} are not both there` };
      return pairs[0].overlap_mm3 ? { x: -pairs[0].overlap_mm3, entities: [q.a, q.b], hint: `they overlap by ${pairs[0].overlap_mm3} mm³ (measured as minus that)` } : { x: pairs[0].clearance_mm!, entities: [q.a, q.b] };
    }
  }
  return { unknown: `unknown query ${(q as { fn: string }).fn}` };
}

/** One predicate against the part as it stands. */
export async function runCheck(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, p: Predicate): Promise<Outcome> {
  if (!bodies.length && p.query.fn !== 'count_solids') return { status: 'fail', measured: 'no body', hint: 'the part has no body yet' };
  const m = await measure(doc, bodies, evaluate, p.query);
  if ('unknown' in m) return { status: 'unknown', why: m.unknown };
  const r = meets(m.x, p);
  return { status: r.ok ? 'pass' : 'fail', measured: r4(m.x), delta: r4(r.delta), ...(m.entities ? { entities: m.entities } : {}), ...(m.hint ? { hint: m.hint } : {}) };
}

/** Every requirement's predicate against the part: failures in full, passes by count, unknowns with why. */
export async function checkSpec(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate): Promise<Report & { outcomes: Map<string, Outcome> }> {
  const failures: Failure[] = [], unknowns: Report['unknowns'] = [], outcomes = new Map<string, Outcome>();
  let pass = 0, hard = 0;
  for (const req of doc.requirements ?? []) {
    const o = await runCheck(doc, bodies, evaluate, req.check); outcomes.set(req.id, o);
    if (o.status === 'pass') { pass++; continue; }
    if (o.status === 'unknown') { unknowns.push({ req_id: req.id, why: o.why ?? 'cannot be measured' }); continue; }
    if (req.hard) hard++;
    const feature = o.entities?.length ? featureOf(doc, o.entities) : undefined;
    failures.push({ req_id: req.id, check: req.check.query.fn, measured: o.measured, expected: expectedOf(req.check), ...(o.delta !== undefined ? { delta: o.delta } : {}),
      ...(o.entities?.length ? { entities: o.entities } : {}), ...(feature ? { feature } : {}), hint: `${o.hint ? `${o.hint}; ` : ''}${req.hard ? 'hard' : 'soft'}: "${req.source}"` });
  }
  return { model_hash: modelHash(doc), summary: { pass, fail: failures.length, unknown: unknowns.length, hard_failing: hard }, failures, unknowns, outcomes };
}

const FNS = ['bbox', 'volume', 'mass', 'count_solids', 'count_faces_of_kind', 'distance_between', 'radius', 'hole_diameter', 'min_wall', 'draft_min', 'clearance'];
/** Why a requirement cannot be kept (malformed), or null. */
export function checkRequirement(r: unknown): string | null {
  if (typeof r !== 'object' || r === null) return 'a requirement is an object';
  const q = r as Record<string, unknown>, c = q.check as Record<string, unknown> | undefined, f = c?.query as Record<string, unknown> | undefined;
  if (typeof q.id !== 'string' || !q.id) return 'a requirement needs an id';
  if (typeof q.source !== 'string') return `${q.id}: quote its source text ("source")`;
  if (typeof q.hard !== 'boolean') return `${q.id}: say whether it is hard (true) or soft (false)`;
  if (!c || !['==', '<=', '>=', 'between'].includes(String(c.op))) return `${q.id}: a check is {op: "==" | "<=" | ">=" | "between", query, value | min, max, tol?, unit?}`;
  if (!f || !FNS.includes(String(f.fn))) return `${q.id}: query.fn is one of ${FNS.join(', ')}`;
  for (const k of ['value', 'tol', 'min', 'max']) if (c[k] !== undefined && (typeof c[k] !== 'number' || !Number.isFinite(c[k]))) return `${q.id}: ${k} is a number`;
  if (c.op === 'between' ? c.min === undefined || c.max === undefined : c.value === undefined) return `${q.id}: ${c.op === 'between' ? 'between takes min and max' : `${c.op} takes a value`}`;
  if (f.fn === 'bbox' && !['x', 'y', 'z'].includes(String(f.axis))) return `${q.id}: bbox takes an axis (x, y or z)`;
  if (f.fn === 'count_faces_of_kind' && !['plane', 'curved'].includes(String(f.kind))) return `${q.id}: count_faces_of_kind takes kind plane or curved`;
  if (f.fn === 'distance_between' && (f.a === undefined || f.b === undefined)) return `${q.id}: distance_between takes a and b (faces or edges)`;
  if ((f.fn === 'radius' || f.fn === 'hole_diameter') && f.face === undefined) return `${q.id}: ${f.fn} takes a face`;
  if (f.fn === 'clearance' && (typeof f.a !== 'string' || typeof f.b !== 'string')) return `${q.id}: clearance takes two body keys a and b`;
  return null;
}
