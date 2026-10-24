// Requirements as executable checks (A3.1). The brief is kept in the document (`StudioDoc.requirements`): each
// requirement quotes its source text, says what it is about, and carries a predicate — declarative JSON, never
// code: `{op, query: {fn, …}, value, tol, unit}`. The query functions measure with what the agent has (facts,
// measure, analysis), their subjects by names or selectors (A1: stable feature ids; selectors resolve to names).
// `check_spec` runs every predicate against the part as it stands: pass, fail, or unknown with why (an assumed
// material, a missing reference, an analysis that does not apply). Failures in full, passes by count.
import { emptyDoc, featureLabel, leafBodies, prefixDoc, withNode, type StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { nodeIndexOf } from '../engine/ids';
import { measureBetween, type MeasurePick } from '../app/measure';
import { resolveEdge, resolveFace, resolveNames } from './names';
import { factsOf } from './observe';
import { draftAnalysis, interference, wallThickness } from '../analysis/analysis';
import { checkPlacedSpurGears, checkPlacedSpurRack, instantiateLibraryPart } from '@barocss/cad';
import { libraryById } from '../library/libraries';
import { holeAlignment } from '../analysis/alignment';
import { overhangOf } from '../print/overhang';
import { printability, type PrintabilityReport } from '../print/rules';
import { processProfile } from '../library/materials';
import { faceTableOf } from '../assembly/faces';
import { checkKeepouts, datumToFace, datumWorld, readReferences } from './references';
import { unconfirmed, unitAssumptions } from './drafts';
import { beadAccounting, incompleteBeadReason } from '../frames/beadAccounting';
import type { Query, Predicate, Failure, Report, Outcome, Evaluate, Validation, Policy } from '../engine/schema/spec';



const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
/** A short hash of the model (its features, parameters and looks): a report says which model it is about. */
export function modelHash(doc: StudioDoc): string {
  // (Kept by the objects it reads — an edit makes new nodes; a selection, a view or a proposal keeps them — so the
  // checks, the proposals' staleness and the history share one walk of the document per edit, PERF3 A6.)
  const have = hashes.get(doc.nodes);
  if (have && have.parameters === doc.parameters && have.bodies === doc.bodies) return have.hash;
  const s = JSON.stringify([doc.nodes, doc.parameters, doc.bodies]); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  const hash = h.toString(16).padStart(8, '0');
  hashes.set(doc.nodes, { parameters: doc.parameters, bodies: doc.bodies, hash });
  return hash;
}
const hashes = new WeakMap<object, { parameters: unknown; bodies: unknown; hash: string }>();
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

// One printability report per evaluation (its bodies), process, printer, direction and looks (materials: warp): every print_rule of a
// check run reads the same one (it measured every rule each time, PERF3 A1).
const printReports = new WeakMap<readonly BodyResult[], Map<string, Promise<PrintabilityReport>>>();
function printabilityOf(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, direction?: readonly number[]): Promise<PrintabilityReport> {
  const key = JSON.stringify([doc.process, doc.printer, direction ?? doc.print?.direction ?? null, doc.bodies ?? null, doc.mould ?? null, doc.brief?.material ?? null]);
  let byKey = printReports.get(bodies); if (!byKey) { byKey = new Map(); printReports.set(bodies, byKey); }
  let r = byKey.get(key); if (!r) { r = printability(doc, bodies, evaluate, direction ? { direction } : {}); byKey.set(key, r); }
  return r;
}
/** A query's measurement, with the faces or bodies it is about; or unknown with why. */
async function measure(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, q: Query): Promise<{ x: number; entities?: string[]; hint?: string; chord?: number } | { unknown: string }> {
  if ('body' in q && q.body !== undefined && !bodies.some(b => b.key === q.body)) return { unknown: `no body ${q.body} (bodies: ${bodies.map(b => b.key).join(', ') || 'none'})` };
  const facts = factsOf(doc, bodiesOf(bodies, 'body' in q ? q.body : undefined));
  switch (q.fn) {
    case 'bbox': { const k = 'xyz'.indexOf(q.axis); return facts.bbox ? { x: facts.bbox.max[k] - facts.bbox.min[k], hint: `the overall ${q.axis} size` } : { unknown: 'no body' }; }
    case 'volume': {
      const incomplete = !q.body ? incompleteBeadReason(beadAccounting(doc, bodies)) : null;
      return incomplete ? { unknown: incomplete } : { x: facts.volume };
    }
    case 'mass': {
      const incomplete = !q.body ? incompleteBeadReason(beadAccounting(doc, bodies)) : null;
      if (incomplete) return { unknown: incomplete };
      return facts.mass_assumed ? { unknown: `the material of ${facts.materials.filter(m => m.assumed).map(m => m.body).join(', ')} is not set: its mass is assumed (aluminium); set the material first` } : { x: facts.mass };
    }
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
      const walls = bodiesOf(bodies, q.body).map(b => wallThickness(b)) as { thinnest: number | null; face?: string }[];
      const thin = walls.filter(w => w.thinnest !== null).sort((x, y) => x.thinnest! - y.thinnest!)[0];
      return thin ? { x: thin.thinnest!, ...(thin.face ? { entities: [thin.face] } : {}), hint: 'the thinnest wall (display mesh)' } : { unknown: 'no wall measured' };
    }
    case 'draft_min': {
      // (IM2, O78: every wall's exact draft — flat and curved; a straddling face's least is 0.)
      const walls = bodiesOf(bodies, q.body).flatMap(b => draftAnalysis(doc, b, q.pull ?? [0, 0, 1]).walls as { face: string; draft: number }[]);
      if (!walls.length) return { unknown: 'no walls along the pull to judge' };
      const worst = [...walls].sort((x, y) => x.draft - y.draft)[0];
      return { x: worst.draft, entities: [worst.face], hint: 'the least drafted wall (exact normals)' };
    }
    case 'keepout': {
      const res = await checkKeepouts(doc, bodiesOf(bodies, q.body), evaluate, { keepout: q.keepout });
      if (!res.length) return { unknown: `no keep-out ${q.keepout} (or no body)` };
      const enters = res.filter(r => r.overlap > 1e-6);
      if (enters.length) { const v = Math.max(...enters.map(r => r.overlap)); return { x: -v, entities: enters.map(r => r.body), hint: `${enters.map(r => r.body).join(', ')} enter${enters.length === 1 ? 's' : ''} ${q.keepout} by ${r4(v)} mm³ (measured as minus that; exact)` }; }
      const near = res.reduce((a, b) => ((b.clearance ?? Infinity) < (a.clearance ?? Infinity) ? b : a));
      return { x: near.clearance!, chord: near.chordMM, entities: [near.body], hint: `${near.body} is ${r4(near.clearance!)} mm from ${q.keepout} (meshes exact; chord tolerance ${r4(near.chordMM)} mm)` };
    }
    case 'datum_distance': {
      const set = readReferences(doc.references), d = set.datums.find(x => x.id === q.datum);
      if (!d) return { unknown: `no datum ${q.datum}` };
      const names = resolveFace(doc.nodes, bodies, q.face);
      if (typeof names === 'string' || names.length !== 1) return { unknown: typeof names === 'string' ? names : `${JSON.stringify(q.face)} is ${names.length} faces` };
      const f = resolveNames(bodies as BodyResult[], { faces: [names[0]] }).selection.faces[0];
      if (!f) return { unknown: `no face ${names[0]}` };
      const m = datumToFace(datumWorld(set, d), bodies[f.body].mesh, f.face);
      return { x: m.distance, entities: [names[0]], hint: `${m.what}${m.angle !== null ? `; at ${r4(m.angle)}°` : ''}` };
    }
    case 'clearance': {
      const pairs = await interference(doc, bodies, evaluate, [q.a, q.b]) as { overlap?: number; clearance?: number }[];
      if (!pairs.length) return { unknown: `bodies ${q.a} and ${q.b} are not both there` };
      return pairs[0].overlap ? { x: -pairs[0].overlap, entities: [q.a, q.b], hint: `they overlap by ${pairs[0].overlap} mm³ (measured as minus that)` } : { x: pairs[0].clearance!, entities: [q.a, q.b] };
    }
    case 'gear_center_distance': case 'gear_backlash': case 'gear_contact_ratio': case 'gear_clearance': return gearPair(doc, bodies, q);
    case 'print_rule': {
      const report = await printabilityOf(doc, bodies, evaluate, q.direction);
      const r = report.rules.find(x => x.id === q.rule);
      if (!r) return { unknown: `no rule ${q.rule} (rules: ${report.rules.map(x => x.id).join(', ')})` };
      if (r.status === 'unknown' || r.status === 'n/a' || r.value === undefined) return { unknown: `${q.rule}: ${r.status === 'n/a' ? 'not applicable — ' : ''}${r.why ?? r.message}` };
      return { x: r.value, ...(r.entities ? { entities: [...r.entities] } : {}), hint: `${r.status}: ${r.message}${r.limit !== undefined ? ` (limit ${r.limit}${r.unit ? ` ${r.unit}` : ''}, ${r.source})` : ''}` };
    }
    case 'subd_deviation': {
      // (R7, D79: the SubD caps' largest distance from the limit surface; at: crease — only those at crease, corner or boundary vertices.)
      const subs = bodiesOf(bodies, q.body).filter(b => b.subd);
      if (!subs.length) return { unknown: q.body ? `${q.body} is not a SubD body with caps` : 'no SubD body with caps (its cage is regular everywhere: exact, no deviation)' };
      const worst = subs.reduce((a, b) => (q.at === 'crease' ? b.subd!.creaseDeviation > a.subd!.creaseDeviation : b.subd!.maxDeviation > a.subd!.maxDeviation) ? b : a), s = worst.subd!, x = q.at === 'crease' ? s.creaseDeviation : s.maxDeviation;
      return { x, entities: [worst.key], hint: `${+(100 * x / s.size).toPrecision(2)}% of its size (${s.caps} caps at ${s.irregularVertices} irregular ${s.irregularVertices === 1 ? 'vertex' : 'vertices'}); warned past 0.2% at crease, corner or boundary vertices` };
    }
    case 'overhang_area': {
      const profile = processProfile(doc.process);
      if (!profile?.additive) return { unknown: profile ? `${profile.label} is not printing: no overhang limit` : 'no printing process is chosen' };
      const limit = profile.thresholds.maxOverhangDeg.value, table = faceTableOf(doc);
      const reports = bodiesOf(bodies, q.body).map(b => overhangOf(b.mesh, table, limit, q.direction));
      const total = reports.reduce((n, r) => n + r.overhangArea, 0), names = reports.flatMap(r => r.faces.map(f => f.name));
      return { x: total, entities: names.slice(0, 20), hint: `past ${limit}° from the vertical (${profile.label})${reports.some(r => r.approximate) ? '; curved faces by their display triangles: accurate to the chord error' : ''}` };
    }
    case 'hole_alignment': {
      const r = holeAlignment(doc, q.board, q.features);
      if (typeof r === 'string') return { unknown: r };
      if (r.unmatched.length || r.maxOffset === null) return { unknown: `no hole of ${q.board} runs parallel to ${r.unmatched.join(', ')}` };
      const worst = r.pairs.reduce((a, b) => (b.offset ?? 0) > (a.offset ?? 0) ? b : a);
      return { x: r.maxOffset, entities: r.pairs.map(p => p.feature), hint: `${r.pairs.length} axes against ${r.holes} holes; the worst ${worst.feature} off ${worst.hole} by ${+r.maxOffset.toFixed(4)} mm` };
    }
    case 'library_check': {
      const i = nodeIndexOf(doc.nodes, q.feature), node = i >= 0 ? doc.nodes[i] : undefined;
      if (node?.kind !== 'library') return { unknown: `${q.feature} is not a library part` };
      const lib = libraryById(node.library.library);
      if (!lib) return { unknown: `the library ${node.library.library} is not installed here` };
      let c;
      try { c = instantiateLibraryPart(lib, node.library.part, { ...(node.library.variant ? { variant: node.library.variant } : {}), params: node.library.params, ...(node.context ? { context: node.context } : {}) }).checks.find(x => x.id === q.check); }
      catch (cause) { return { unknown: cause instanceof Error ? cause.message.replace(/^library: /, '') : String(cause) }; }
      if (!c) return { unknown: `${node.name} has no rule ${q.check}` };
      if (c.pass === null) return { unknown: `${q.check}: ${c.unknown}` };
      return { x: c.value ?? (c.pass ? 1 : 0), entities: [q.feature], hint: `${c.pass ? 'met' : 'not met'} (${c.level}): ${c.message}` };
    }
  }
  return { unknown: `unknown query ${(q as { fn: string }).fn}` };
}

/**
 * The pair checks of two spur gears as placed (R6a.4b, D56): centre distance, backlash (the circumferential one on the
 * working pitch circle), usable contact ratio — the verdict mode, cached in the kernel — or the least clearance over a
 * tooth period (the full sweep: minus the depth when the teeth cross). Gears built on further are not gears here.
 */
function gearPair(doc: StudioDoc, bodies: readonly BodyResult[], q: Extract<Query, { a: string; b: string }>): { x: number; entities?: string[]; hint?: string } | { unknown: string } {
  const bodyOf = (id: string) => { const i = nodeIndexOf(doc.nodes, id); return i < 0 ? undefined : bodies.find(b => b.ref?.node === i && (b.gear || b.rack)); };
  const b1 = bodyOf(q.a), b2 = bodyOf(q.b);
  if (!b1 || !b2) return { unknown: `${!b1 ? q.a : q.b} is not a spur gear or rack body as made (one built on further is a body, not a gear, here)` };
  if (b1.rack && b2.rack) return { unknown: 'two racks do not mesh' };
  const mode = q.fn === 'gear_clearance' ? 'report' : 'verdict';
  // (A gear and a rack, either way round: the rack's checks — the centre distance is the gear axis's from its pitch line.)
  let c: { centerDistance: number; nominalCenterDistance: number; backlash: number; usableContactRatio: number; idealContactRatio: number; sweep: { minimumClearance: number; interference: boolean; at: number } };
  try { c = b1.gear && b2.gear ? checkPlacedSpurGears(b1.gear, b2.gear, { mode }) : checkPlacedSpurRack((b1.gear ?? b2.gear)!, (b1.rack ?? b2.rack)!, { mode }); }
  catch (cause) { return { unknown: cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause) }; }
  const entities = [q.a, q.b];
  switch (q.fn) {
    case 'gear_center_distance': return { x: c.centerDistance, entities, hint: `nominal ${r4(c.nominalCenterDistance)} mm` };
    case 'gear_backlash': return { x: c.backlash, entities, hint: 'circumferential, on the working pitch circles' };
    case 'gear_contact_ratio': return { x: c.usableContactRatio, entities, hint: `the usable flanks (ideal ${c.idealContactRatio.toFixed(4)})` };
    default: return { x: c.sweep.minimumClearance, entities, hint: c.sweep.interference ? `the teeth cross at ${c.sweep.at.toFixed(2)}° (measured as minus the depth)` : 'the least clearance over a tooth period' };
  }
}

/** One predicate against the part as it stands. */
export async function runCheck(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, p: Predicate): Promise<Outcome> {
  if (!bodies.length && p.query.fn !== 'count_solids') return { status: 'fail', measured: 'no body', hint: 'the part has no body yet' };
  const m = await measure(doc, bodies, evaluate, p.query);
  if ('unknown' in m) return { status: 'unknown', why: m.unknown };
  // (A value good to a chord tolerance, A6.3: decided only when it holds, or fails, anywhere within it; else undecided.)
  if (m.chord !== undefined && m.chord > 0) {
    const lo = meets(m.x - m.chord, p).ok, hi = meets(m.x + m.chord, p).ok;
    if (lo !== hi || !Number.isFinite(m.chord)) return { status: 'unknown', why: `undecided: ${r4(m.x)} is within the meshes' chord tolerance (${Number.isFinite(m.chord) ? `${r4(m.chord)} mm` : 'unbounded'}) of the limit${m.hint ? ` — ${m.hint}` : ''}` };
  }
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
  // (A draft's dimensions not yet confirmed by the user, A6.4: unknowns too, said so.)
  for (const a of unitAssumptions(doc)) unknowns.push({ req_id: `draft:${a.split(':')[0]}.units`, why: a.slice(a.indexOf(':') + 2) });
  for (const u of unconfirmed(doc)) unknowns.push({ req_id: `draft:${u.key}`, why: `${u.dim.label}, ${u.dim.value} mm, ${u.dim.basis === 'scaled' ? 'scaled from an image' : 'read from a drawing'}: not confirmed by the user` });
  return { model_hash: modelHash(doc), summary: { pass, fail: failures.length, unknown: unknowns.length, hard_failing: hard }, failures, unknowns, outcomes };
}

const FNS = ['bbox', 'volume', 'mass', 'count_solids', 'count_faces_of_kind', 'distance_between', 'radius', 'hole_diameter', 'min_wall', 'draft_min', 'clearance', 'gear_center_distance', 'gear_backlash', 'gear_contact_ratio', 'gear_clearance', 'library_check', 'hole_alignment', 'overhang_area', 'print_rule', 'subd_deviation', 'keepout', 'datum_distance'];
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
  if (f.fn === 'hole_alignment' && (typeof f.board !== 'string' || (f.features !== undefined && (!Array.isArray(f.features) || f.features.some(x => typeof x !== 'string'))))) return `${q.id}: hole_alignment takes board (base or a part id) and features? (library part ids)`;
  if (f.fn === 'library_check' && (typeof f.feature !== 'string' || typeof f.check !== 'string')) return `${q.id}: library_check takes a library part's feature id (n<k>) and the rule's id (check)`;
  if (String(f.fn).startsWith('gear_') && (typeof f.a !== 'string' || typeof f.b !== 'string')) return `${q.id}: ${f.fn} takes two spur gears' feature ids a and b (n<k>)`;
  if (q.invariant === true && (typeof q.invariant_reason !== 'string' || !q.invariant_reason)) return `${q.id}: an invariant requirement says why (invariant_reason)`;
  return null;
}

// ---- the suite checked against mutants (A3.2) ------------------------------------------------------------------
/** At most this many mutants a validation (each is one evaluation and one run of the suite). */
export const MAX_MUTANTS = 8;
/**
 * Cheap mutants of the model, each a document: every body scaled ×1.15 and ×0.87 (about the origin), the first
 * parameters ±15% (else the first extrusion's height), the features the requirements' subjects come from
 * suppressed, and the trivial stub (a box as big as the part).
 */
export function mutantsOf(doc: StudioDoc, bodies: readonly BodyResult[], outcomes: ReadonlyMap<string, Outcome>): { label: string; doc: StudioDoc }[] {
  const out: { label: string; doc: StudioDoc }[] = [];
  const scaled = (factor: number) => leafBodies(doc.nodes).reduce((d, ref) => withNode(d, { kind: 'scale', parent: ref, factor, pivot: [0, 0, 0] }), doc);
  out.push({ label: 'every body ×1.15', doc: scaled(1.15) }, { label: 'every body ×0.87', doc: scaled(0.87) });
  const params = Object.keys(doc.parameters).slice(0, 2);
  for (const k of params) for (const f of [1.15, 0.85]) out.push({ label: `parameter ${k} ×${f}`, doc: { ...doc, parameters: { ...doc.parameters, [k]: doc.parameters[k] * f } } });
  if (!params.length) {
    const i = doc.nodes.findIndex(n => n.kind === 'extrude' && typeof n.height === 'number');
    if (i >= 0) for (const f of [1.15, 0.85]) { const nodes = [...doc.nodes], n = nodes[i] as { height: number }; nodes[i] = { ...nodes[i], height: n.height * f } as typeof nodes[number]; out.push({ label: `feature ${i} height ×${f}`, doc: prefixDoc({ ...doc, nodes }, nodes.length) }); }
  }
  const owners = [...new Set([...outcomes.values()].flatMap(o => o.entities ?? []).flatMap(n => n.split(/[|+]/).map(p => nodeIndexOf(doc.nodes, p.split('.')[0]))).filter(i => i > 0))].slice(0, 2);
  for (const i of owners) { const nodes = doc.nodes.map((n, k) => k === i ? { ...n, suppressed: true as const } : n); out.push({ label: `feature ${i} suppressed`, doc: prefixDoc({ ...doc, nodes }, nodes.length) }); }
  const facts = factsOf(doc, bodies);
  if (facts.bbox) {
    const { min, max } = facts.bbox;
    const stub = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [min[0], min[1]], max: [max[0], max[1]] }), { kind: 'extrude', sketch: 0, height: max[2] - min[2], from: min[2] });
    out.push({ label: 'the stub (a box as big as the part)', doc: { ...stub, requirements: doc.requirements } });
  }
  return out.slice(0, MAX_MUTANTS);
}

/**
 * The suite against the mutants: a predicate that passes on the model and on every mutant it applies to (built,
 * its subject resolving) is vacuous — it cannot tell this model from a broken one — unless declared invariant;
 * one with fewer than two mutants it applies to is unverified.
 */
export async function validateSuite(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, outcomes: ReadonlyMap<string, Outcome>): Promise<Validation> {
  const t = performance.now(), mutants = mutantsOf(doc, bodies, outcomes), passes = new Map<string, number>(), applies = new Map<string, number>();
  let built = 0;
  for (const m of mutants) {
    const r = await evaluate(m.doc); if (!r?.ok) continue;
    built++;
    for (const req of doc.requirements ?? []) {
      const o = await runCheck(m.doc, r.bodies, evaluate, req.check); if (o.status === 'unknown') continue;
      applies.set(req.id, (applies.get(req.id) ?? 0) + 1); if (o.status === 'pass') passes.set(req.id, (passes.get(req.id) ?? 0) + 1);
    }
  }
  const out: Validation = { mutants: { built, tried: mutants.length, duration: Math.round(performance.now() - t) / 1000, labels: mutants.map(m => m.label) }, vacuous: [], unverified: [], invariant: [] };
  for (const req of doc.requirements ?? []) {
    if (outcomes.get(req.id)?.status !== 'pass') continue;
    const n = applies.get(req.id) ?? 0, p = passes.get(req.id) ?? 0;
    if (req.invariant) out.invariant.push({ req_id: req.id, reason: req.invariant_reason ?? '' });
    else if (n < 2) out.unverified.push({ req_id: req.id, why: `only ${n} mutant${n === 1 ? '' : 's'} applied (built, its subject resolving)` });
    else if (p === n) out.vacuous.push({ req_id: req.id, why: `passes on every mutant it applies to (${p} of ${n}): it cannot tell this model from a changed one; tighten it, or declare it invariant with a reason` });
  }
  return out;
}

export const newPolicy = (): Policy => ({ last: {}, rounds: {}, passedHard: [], calls: 0 });
/** A failing suite's score (higher is better): minus each failure's miss relative to what it asked for. */
const scoreOf = (doc: StudioDoc, failures: readonly Failure[]) => -failures.reduce((a, f) => {
  const req = doc.requirements?.find(r => r.id === f.req_id), ref = Math.max(1e-9, Math.abs(req?.check.value ?? req?.check.max ?? req?.check.min ?? 1));
  return a + Math.abs(f.delta ?? 1) / ref;
}, 0);
/** The policy after a check: the best snapshot, the rounds without progress, and what to tell the agent. */
export function updatePolicy(policy: Policy, doc: StudioDoc, report: Report, outcomes: ReadonlyMap<string, Outcome>, maxTurns?: number): { policy: Policy; out: Record<string, unknown> } {
  const p: Policy = { ...policy, last: { ...policy.last }, rounds: { ...policy.rounds } };
  const score = scoreOf(doc, report.failures);
  if (!p.best || report.summary.pass > p.best.pass || report.summary.pass === p.best.pass && score > p.best.score) p.best = { hash: report.model_hash, pass: report.summary.pass, score, doc };
  for (const f of report.failures) {
    const d = Math.abs(f.delta ?? Infinity), was = p.last[f.req_id];
    p.rounds[f.req_id] = was !== undefined && !(d < was - 1e-9) ? (p.rounds[f.req_id] ?? 0) + 1 : 0;
    p.last[f.req_id] = Math.min(d, was ?? Infinity);
  }
  for (const id of Object.keys(p.rounds)) if (!report.failures.some(f => f.req_id === id)) { delete p.rounds[id]; delete p.last[id]; }
  p.passedHard = (doc.requirements ?? []).filter(r => r.hard && outcomes.get(r.id)?.status === 'pass').map(r => r.id);
  const stuck = Object.entries(p.rounds).filter(([, n]) => n >= 2).map(([id]) => id);
  return { policy: p, out: {
    best: { model_hash: p.best.hash, pass: p.best.pass, this_is_best: p.best.hash === report.model_hash },
    ...(Object.keys(p.rounds).length ? { rounds_without_progress: p.rounds } : {}),
    ...(stuck.length ? { hint: `no progress on ${stuck.join(', ')} for 2 rounds: start again from the brief, these checks and the best snapshot (${p.best.hash}), rather than patching further` } : {}),
    tool_calls: p.calls, ...(maxTurns ? { turns_budget: maxTurns } : {}),
  } };
}
