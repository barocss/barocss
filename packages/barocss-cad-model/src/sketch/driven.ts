// A persistent solver recipe. The authored numeric seed is never replaced by a
// previous solution: free coordinates therefore do not depend on edit history.
import { NODE_EXTRA_FIELDS, type DrivenSketchNode, type ModelNode, type NodeExtras, type NumericDrivenSketchSeed, type SketchNode } from '../engine/doc';
import { isRefusal, refusal } from '../engine/refusal';
import { profileOf } from './loops';
import { arcOf, outlineSegments } from './profile';
import { sketchShapes } from './reopen';
import { commitDimension } from './rules';
import { edgeAngle } from './terms';

type Params = Readonly<Record<string, number>>;
type Obj = Record<string, unknown>;
const record = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const point = (x: unknown, n = 2): x is number[] => Array.isArray(x) && x.length === n && x.every(num);
const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  return record(a) && record(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
};
const copy = <T>(x: T): T => structuredClone(x);
function input(ok: unknown, message: string): asserts ok {
  if (!ok) throw refusal('PARAMETER_UNBINDABLE', `Driven sketch: ${message}`, { phase: 'input' });
}
function keys(x: unknown, allowed: readonly string[], required: readonly string[], label: string): asserts x is Obj {
  input(record(x), `${label} must be an object`);
  input(Object.keys(x).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(x, k)), `${label} has missing or unsupported fields`);
}
const index = (x: unknown, n: number): x is number => Number.isInteger(x) && Number(x) >= 0 && Number(x) < n;
function indices(x: unknown, accepts: (i: unknown) => boolean, label: string): asserts x is number[] {
  input(Array.isArray(x) && x.every(accepts) && new Set(x).size === x.length, `${label} must contain distinct existing indices`);
}
function loop(x: unknown, label: string): asserts x is Obj[] {
  input(Array.isArray(x) && x.length >= 1, `${label} must be a closed line/arc loop`);
  for (const s of x) {
    input(record(s), `${label} segment must be an object`);
    keys(s, s.kind === 'line' ? ['kind', 'start'] : ['kind', 'start', 'center', 'direction'], s.kind === 'line' ? ['kind', 'start'] : ['kind', 'start', 'center', 'direction'], label);
    input(point(s.start) && (s.kind === 'line' || s.kind === 'arc' && point(s.center) && (s.direction === 'cw' || s.direction === 'ccw')), `${label} needs finite numeric line/arc coordinates`);
  }
  for (let i = 0; i < x.length; i++) {
    const s = x[i], a = s.start as number[], b = x[(i + 1) % x.length].start as number[];
    input(x.length === 1 && s.kind === 'arc' || Math.hypot(a[0] - b[0], a[1] - b[1]) >= .001, `${label} has a collapsed segment`);
    if (s.kind === 'arc') {
      const c = s.center as number[], r = Math.hypot(a[0] - c[0], a[1] - c[1]);
      input(r >= .001 && Math.abs(r - Math.hypot(b[0] - c[0], b[1] - c[1])) <= 1e-7, `${label} arc endpoints do not share a circle`);
    }
  }
}
function rule(x: unknown, n: number, bulges: number[], circles: number): void {
  input(record(x) && typeof x.kind === 'string', 'outline rule must have a supported kind');
  const p = (v: unknown) => index(v, n), l = (v: unknown) => p(v) && !bulges[v as number], a = (v: unknown) => p(v) && !!bulges[v as number], c = (v: unknown) => index(v, circles);
  const pair = (check: (v: unknown) => boolean) => check(x.a) && check(x.b) && x.a !== x.b;
  let fields: string[], valid: boolean;
  switch (x.kind) {
    case 'parallel': case 'perpendicular': case 'equal': fields = ['kind', 'a', 'b']; valid = pair(l); break;
    case 'fix': fields = ['kind', 'point', 'at']; valid = p(x.point) && point(x.at); break;
    case 'coincident': fields = ['kind', 'point', 'arc']; valid = p(x.point) && a(x.arc); break;
    case 'distance': case 'dx': case 'dy': fields = ['kind', 'a', 'b', 'value']; valid = pair(p) && num(x.value) && x.value >= .001; break;
    case 'angle': fields = ['kind', 'a', 'b', 'value']; valid = pair(l) && num(x.value) && x.value > 0 && x.value < 180; break;
    case 'cdist': case 'cdx': case 'cdy': fields = ['kind', 'a', 'circle', 'value']; valid = p(x.a) && c(x.circle) && num(x.value) && x.value >= .001; break;
    case 'cedge': fields = ['kind', 'edge', 'circle', 'axis', 'value']; valid = l(x.edge) && c(x.circle) && (x.axis === 0 || x.axis === 1) && num(x.value) && x.value >= .001; break;
    case 'ccdist': case 'ccdx': case 'ccdy': fields = ['kind', 'a', 'b', 'value']; valid = pair(c) && num(x.value) && x.value >= .001; break;
    case 'cconc': fields = ['kind', 'a', 'b']; valid = pair(c); break;
    case 'ctan': fields = ['kind', 'edge', 'circle']; valid = l(x.edge) && c(x.circle); break;
    case 'symmetric': fields = ['kind', 'a', 'b', 'line']; valid = pair(p) && l(x.line); break;
    default: input(false, `unsupported outline rule ${x.kind}`);
  }
  keys(x, fields, fields, 'outline rule'); input(valid, 'outline rule has invalid numeric values or references');
}
function outline(x: unknown, segments: Obj[]): void {
  const allowed = ['points', 'bulges', 'lengths', 'radii', 'tangents', 'equalRadii', 'concentric', 'hv', 'rules', 'circles'];
  keys(x, allowed, ['points', 'lengths'], 'outline');
  const n = segments.length;
  input(Array.isArray(x.points) && x.points.length === n && x.points.every(p => point(p)), 'outline needs one finite point per segment');
  const points = x.points as [number, number][];
  if (x.bulges !== undefined) input(Array.isArray(x.bulges) && x.bulges.length === n && x.bulges.every(num), 'outline bulges must be finite numbers');
  const bulges = (x.bulges as number[] | undefined) ?? points.map(() => 0), arc = (i: unknown) => index(i, n) && !!bulges[i as number], line = (i: unknown) => index(i, n) && !bulges[i as number];
  const emitted = outlineSegments(points, bulges);
  for (let i = 0; i < n; i++) {
    const s = segments[i], t = emitted[i];
    input(s.kind === t.kind && point(s.start) && s.start.every((v, j) => Math.abs(v - t.start[j]) <= 1e-9), 'source segments disagree with the authored outline');
    if (s.kind === 'arc' && t.kind === 'arc') input(s.direction === t.direction && point(s.center) && s.center.every((v, j) => Math.abs(v - Number(t.center[j])) <= 1e-9), 'source arc disagrees with its outline bulge');
  }
  for (const key of ['lengths', 'radii']) if (x[key] !== undefined) {
    input(record(x[key]), `outline ${key} must be a numeric index map`);
    for (const [i, v] of Object.entries(x[key] as Obj)) input(/^(0|[1-9]\d*)$/.test(i) && (key === 'lengths' ? line(+i) : arc(+i)) && num(v) && v >= .001, `outline ${key} must name existing ${key === 'lengths' ? 'lines' : 'arcs'} with finite positive values`);
  }
  if (x.tangents !== undefined) indices(x.tangents, i => index(i, n) && (arc(i) || arc((Number(i) - 1 + n) % n)), 'tangent joints');
  for (const key of ['equalRadii', 'concentric']) if (x[key] !== undefined) {
    input(Array.isArray(x[key]), `outline ${key} must be arc pairs`);
    for (const p of x[key] as unknown[]) input(Array.isArray(p) && p.length === 2 && arc(p[0]) && arc(p[1]) && p[0] < p[1], `outline ${key} needs distinct ordered arc indices`);
  }
  if (x.hv !== undefined) { keys(x.hv, ['h', 'v'], ['h', 'v'], 'outline HV'); indices(x.hv.h, line, 'horizontal edges'); indices(x.hv.v, line, 'vertical edges'); input(!(x.hv.h as number[]).some(i => (x.hv as {v: number[]}).v.includes(i)), 'one line cannot be both horizontal and vertical'); }
  if (x.circles !== undefined) {
    input(Array.isArray(x.circles), 'outline circles must be numeric circles');
    for (const c of x.circles) { keys(c, ['c', 'r'], ['c', 'r'], 'outline circle'); input(point(c.c) && num(c.r) && c.r >= .001, 'outline circle needs finite center and positive radius'); }
  }
  if (x.rules !== undefined) { input(Array.isArray(x.rules), 'outline rules must be a list'); for (const r of x.rules) rule(r, n, bulges, (x.circles as unknown[] | undefined)?.length ?? 0); }
}
function construction(x: unknown, ids: string[]): void {
  input(Array.isArray(x), 'construction must be a list');
  for (const s of x) {
    input(record(s), 'construction record must be a shape');
    const fields = s.kind === 'polygon' ? ['points', 'closed', 'bulges'] : s.kind === 'rectangle' || s.kind === 'slot' ? ['a', 'b', ...(s.kind === 'slot' ? ['r'] : [])] : s.kind === 'circle' ? ['c', 'r'] : s.kind === 'bezier' ? ['poles'] : null;
    input(fields, 'unsupported construction shape');
    keys(s, ['kind', 'ids', 'construction', ...fields], ['kind', ...(s.kind === 'polygon' ? ['points', 'closed'] : fields)], 'construction shape');
    input(s.construction === true || s.kind === 'bezier' && s.construction === undefined, 'construction records must be references');
    if (s.kind === 'polygon' || s.kind === 'bezier') {
      const ps = s.kind === 'polygon' ? s.points : s.poles; input(Array.isArray(ps) && ps.length >= 2 && ps.every(p => point(p)), 'construction points must be numeric');
      if (s.kind === 'polygon') { input(typeof s.closed === 'boolean', 'construction polygon needs closed'); if (s.bulges !== undefined) input(Array.isArray(s.bulges) && s.bulges.length === ps.length && s.bulges.every(num), 'construction bulges must be numeric'); }
    } else if (s.kind === 'circle') input(point(s.c) && num(s.r) && s.r > 0, 'construction circle must be numeric');
    else input(point(s.a) && point(s.b) && (s.kind !== 'slot' || num(s.r) && s.r > 0), 'construction rectangle/slot must be numeric');
    if (s.ids !== undefined) { input(Array.isArray(s.ids) && s.ids.every(id => typeof id === 'string' && /^e\d+$/.test(id)), 'construction IDs must be stable side IDs'); ids.push(...s.ids as string[]); }
  }
}
/** Verify the authored coefficients, rather than repairing an inconsistent seed.
 * These are the numerical sketch solver's existing linear/angular budgets. */
function sourceConstraints(seed: NumericDrivenSketchSeed): void {
  const o = seed.outline, p = o.points, n = p.length, b = o.bulges ?? p.map(() => 0);
  const delta = (a: readonly number[], z: readonly number[]) => [z[0] - a[0], z[1] - a[1]];
  const distance = (a: readonly number[], z: readonly number[]) => Math.hypot(z[0] - a[0], z[1] - a[1]);
  const line = (i: number) => delta(p[i], p[(i + 1) % n]);
  const length = (i: number) => Math.hypot(...line(i));
  const arc = (i: number) => arcOf(p[i], p[(i + 1) % n], b[i]);
  const gap = (a: number[], z: number[]) => Math.abs(Math.atan2(a[0] * z[1] - a[1] * z[0], a[0] * z[0] + a[1] * z[1]));
  const linear = (actual: number, wanted: number, label: string) => input(Math.abs(actual - wanted) <= 1e-7, `source ${label} does not meet its existing numeric constraint`);
  const angular = (actual: number, wanted: number, label: string) => input(Math.abs(actual - wanted) <= 1e-9, `source ${label} does not meet its existing angular constraint`);
  const parallel = (a: number[], z: number[], label: string) => { const t = gap(a, z); angular(Math.min(t, Math.PI - t), 0, label); };
  for (const [i, v] of Object.entries(o.lengths ?? {})) linear(length(+i), v, `line ${i} length`);
  for (const [i, v] of Object.entries(o.radii ?? {})) linear(arc(+i).radius, v, `arc ${i} radius`);
  for (const i of o.hv?.h ?? []) linear(line(i)[1], 0, `line ${i} horizontal`);
  for (const i of o.hv?.v ?? []) linear(line(i)[0], 0, `line ${i} vertical`);
  for (const j of o.tangents ?? []) {
    const i = (j - 1 + n) % n, left = b[i] ? delta(arc(i).center, p[j]) : line(i), right = b[j] ? delta(arc(j).center, p[j]) : line(j);
    if (b[i] && b[j]) parallel(left, right, `joint ${j} tangent`); else angular(gap(left, right), Math.PI / 2, `joint ${j} tangent`);
  }
  for (const [a, z] of o.equalRadii ?? []) linear(arc(a).radius, arc(z).radius, 'equal radii');
  for (const [a, z] of o.concentric ?? []) linear(distance(arc(a).center, arc(z).center), 0, 'concentric arcs');
  const c = (i: number) => o.circles![i];
  const measured = (a: readonly number[], z: readonly number[], kind: string) => kind.endsWith('dx') || kind === 'dx' ? Math.abs(z[0] - a[0]) : kind.endsWith('dy') || kind === 'dy' ? Math.abs(z[1] - a[1]) : distance(a, z);
  for (const r of o.rules ?? []) {
    switch (r.kind) {
      case 'parallel': parallel(line(r.a), line(r.b), 'parallel rule'); break;
      case 'perpendicular': angular(gap(line(r.a), line(r.b)), Math.PI / 2, 'perpendicular rule'); break;
      case 'equal': linear(length(r.a), length(r.b), 'equal line rule'); break;
      case 'fix': linear(distance(p[r.point], r.at), 0, 'fixed point'); break;
      case 'coincident': linear(distance(p[r.point], arc(r.arc).center), 0, 'point/arc center coincidence'); break;
      case 'distance': case 'dx': case 'dy': linear(measured(p[r.a], p[r.b], r.kind), r.value, r.kind); break;
      case 'angle': angular(edgeAngle(p, r.a, r.b).degrees * Math.PI / 180, r.value * Math.PI / 180, 'angle rule'); break;
      case 'cdist': case 'cdx': case 'cdy': linear(measured(p[r.a], c(r.circle).c, r.kind), r.value, r.kind); break;
      case 'cedge': input((r.axis === 1 ? o.hv?.h : o.hv?.v)?.includes(r.edge), 'circle/edge distance needs its horizontal or vertical source edge'); linear(Math.abs(c(r.circle).c[r.axis] - p[r.edge][r.axis]), r.value, 'circle/edge distance'); break;
      case 'ccdist': case 'ccdx': case 'ccdy': linear(measured(c(r.a).c, c(r.b).c, r.kind), r.value, r.kind); break;
      case 'cconc': linear(distance(c(r.a).c, c(r.b).c), 0, 'circle concentricity'); break;
      case 'ctan': { const v = line(r.edge), d = delta(p[r.edge], c(r.circle).c); linear(Math.abs(v[0] * d[1] - v[1] * d[0]) / length(r.edge), c(r.circle).r, 'line/circle tangent'); break; }
      case 'symmetric': {
        const a = p[r.a], z = p[r.b], start = p[r.line], v = line(r.line), size = length(r.line), middle = [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2], d = delta(start, middle);
        linear((v[0] * d[1] - v[1] * d[0]) / size, 0, 'symmetry midpoint'); angular(gap(v, delta(a, z)), Math.PI / 2, 'symmetry perpendicular'); break;
      }
    }
  }
}
type Attached = { role: 'holes' | 'regions'; loop: number; circle: number };
function circleMatches(loop: NumericDrivenSketchSeed['segments'] | undefined, circle: { c: [number, number]; r: number }): boolean {
  if (loop?.length !== 1 || loop[0].kind !== 'arc') return false;
  const s = loop[0];
  return Math.hypot(s.center[0] - circle.c[0], s.center[1] - circle.c[1]) <= 1e-9
    && Math.abs(Math.hypot(s.start[0] - s.center[0], s.start[1] - s.center[1]) - circle.r) <= 1e-9;
}
/** Reopen's UI proximity match is not source-geometry authority. Each attached
 * circle must describe exactly one original full-circle loop at this budget. */
function attachedCircles(seed: NumericDrivenSketchSeed): Attached[] {
  const used = new Set<string>();
  return (seed.outline.circles ?? []).map((circle, i) => {
    const matches = (['holes', 'regions'] as const).flatMap(role => (seed[role] ?? []).flatMap((loop, j) => circleMatches(loop, circle) ? [{ role, loop: j, circle: i }] : []));
    input(matches.length === 1, 'an attached circle must match one original full-circle hole or region within 1e-9 mm');
    const match = matches[0], key = `${match.role}:${match.loop}`;
    input(!used.has(key), 'attached circles must not share one original loop'); used.add(key); return match;
  });
}
function assertSeed(x: unknown): asserts x is NumericDrivenSketchSeed {
  keys(x, ['profile', 'segments', 'outline', 'holes', 'regions', 'sideTags', 'construction'], ['profile', 'segments', 'outline', 'sideTags'], 'numeric seed');
  input(x.profile === 'loop', 'v1 requires a numeric loop profile'); loop(x.segments, 'source outer loop'); outline(x.outline, x.segments);
  for (const key of ['holes', 'regions']) if (x[key] !== undefined) { input(Array.isArray(x[key]), `source ${key} must be loops`); for (const l of x[key] as unknown[]) loop(l, `source ${key}`); }
  keys(x.sideTags, ['outer', 'holes', 'regions'], ['outer'], 'side tags'); const ids: string[] = [];
  const tags = (t: unknown, length: number) => { input(Array.isArray(t) && t.length === length && t.every(id => typeof id === 'string' && /^e\d+$/.test(id)), 'every side needs its existing stable ID'); ids.push(...t as string[]); };
  tags(x.sideTags.outer, x.segments.length);
  for (const key of ['holes', 'regions']) { const loops = (x[key] as unknown[][] | undefined) ?? [], ts = x.sideTags[key]; input(ts === undefined ? loops.length === 0 : Array.isArray(ts) && ts.length === loops.length, `source ${key} tags must match loop roles/order`); loops.forEach((l, i) => tags((ts as unknown[])[i], l.length)); }
  if (x.construction !== undefined) construction(x.construction, ids);
  input(new Set(ids).size === ids.length, 'side IDs must be unique across material and construction');
  sourceConstraints(x as unknown as NumericDrivenSketchSeed);
  attachedCircles(x as unknown as NumericDrivenSketchSeed);
}
function parameter(name: string, parameters: Params): number {
  input(typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name), 'binding needs a valid parameter name');
  if (!Object.hasOwn(parameters, name)) throw refusal('PARAMETER_UNKNOWN', `Driven sketch: no parameter ${name}`, { phase: 'parameter' });
  const v = parameters[name];
  if (!num(v) || v < .001) throw refusal('VALUE', `Driven sketch: ${name} must be finite and at least 0.001 mm`, { phase: 'parameter' });
  return v;
}
/** Strict saved form; no generated IDs, parameter leaves in the seed or cached solution. */
export function assertDrivenSketchNode(node: unknown, parameters: Params): asserts node is DrivenSketchNode {
  keys(node, ['kind', 'version', 'seed', 'bindings', 'plane', 'on', ...NODE_EXTRA_FIELDS], ['kind', 'version', 'seed', 'bindings'], 'node');
  input(node.kind === 'driven-sketch' && node.version === 1, 'unsupported kind or version'); assertSeed(node.seed);
  input(Array.isArray(node.bindings) && node.bindings.length === 1, 'v1 requires exactly one line-length binding'); const b = node.bindings[0];
  keys(b, ['kind', 'entity', 'value'], ['kind', 'entity', 'value'], 'binding'); keys(b.value, ['parameter'], ['parameter'], 'binding value');
  input(b.kind === 'line-length' && typeof b.entity === 'string' && typeof b.value.parameter === 'string', 'binding must name a line entity and parameter'); parameter(b.value.parameter, parameters);
  const i = node.seed.sideTags.outer.indexOf(b.entity);
  input(i >= 0 && node.seed.segments[i].kind === 'line' && !(node.seed.outline.bulges?.[i]) && num(node.seed.outline.lengths?.[i]), 'binding must select one outer line with an existing numeric driving length');
  if (node.plane !== undefined) {
    keys(node.plane, ['origin', 'normal', 'xAxis'], ['origin', 'normal', 'xAxis'], 'plane'); input(point(node.plane.origin, 3) && point(node.plane.normal, 3) && point(node.plane.xAxis, 3), 'plane must have finite coordinates and axes');
    const [a, z] = [node.plane.normal, node.plane.xAxis], crossNorm = Math.hypot(a[1] * z[2] - a[2] * z[1], a[2] * z[0] - a[0] * z[2], a[0] * z[1] - a[1] * z[0]); input(num(crossNorm) && crossNorm > 0, 'plane axes must not be zero or collinear');
  }
  if (node.on !== undefined) { keys(node.on, ['node', 'side'], ['node', 'side'], 'body target'); input(Number.isInteger(node.on.node) && Number(node.on.node) >= 0 && typeof node.on.side === 'string' && (/^(solid|negative|positive|instance[123])$/.test(node.on.side) || /^part(?:0|[1-9]\d*)$/.test(node.on.side)), 'body target is malformed'); }
  if (node.id !== undefined) input(typeof node.id === 'string' && node.id.length > 0, 'feature ID must be text');
  if (node.suppressed !== undefined) input(node.suppressed === true, 'suppressed must be true');
  if (node.held !== undefined) input(typeof node.held === 'string', 'held must be text');
  if (node.bought !== undefined) input(typeof node.bought === 'boolean', 'bought must be boolean');
  if (node.rematched !== undefined) input(record(node.rematched) && Object.values(node.rematched).every(v => typeof v === 'string'), 'rematched must map names');
  if (node.sigs !== undefined) {
    input(record(node.sigs), 'signatures must be a name map');
    for (const s of Object.values(node.sigs)) { keys(s, ['k', 'p', 'd', 's', 'r', 'n'], ['k', 'p', 's'], 'signature'); input(typeof s.k === 'string' && point(s.p, 3) && num(s.s) && (s.d === undefined || point(s.d, 3)) && (s.r === undefined || num(s.r)) && (s.n === undefined || Number.isInteger(s.n) && Number(s.n) > 0), 'signature must be finite'); }
  }
}
function context(node: DrivenSketchNode | (SketchNode & NodeExtras)): Obj {
  return Object.fromEntries(['plane', 'on', ...NODE_EXTRA_FIELDS].filter(k => Object.hasOwn(node, k)).map(k => [k, copy((node as unknown as Obj)[k])]));
}
/** One solve from the original source, followed by whole-profile admission. */
export function resolveDrivenSketch(node: DrivenSketchNode, parameters: Params): SketchNode & NodeExtras {
  assertDrivenSketchNode(node, parameters);
  const source = { kind: 'sketch', ...copy(node.seed) } as SketchNode, binding = node.bindings[0];
  try {
    const { shape, done } = sketchShapes(source);
    input(shape?.kind === 'polygon' && shape.closed && shape.ids, 'source must reopen as a tagged closed outline');
    const authored = profileOf([shape, ...done]);
    input(!('error' in authored), `source profile is invalid${'error' in authored ? ': ' + authored.error : ''}`);
    input(equal(authored.node.sideTags, source.sideTags), 'source hole/region roles or side order are inconsistent');
    const i = shape.ids.indexOf(binding.entity); input(i >= 0 && !shape.bulges?.[i] && num(shape.lengths?.[i]), 'bound outer line is missing from the reopened source');
    const solved = commitDimension(shape, `len${i}`, parameter(binding.value.parameter, parameters));
    if (!solved.ok) throw refusal('REFUSED', `Driven sketch: ${solved.reason}`, { phase: 'solve', entity: binding.entity });
    const profile = profileOf([solved.shape, ...done]);
    if ('error' in profile) throw refusal('REFUSED', `Driven sketch: ${profile.error}`, { phase: 'profile', entity: binding.entity });
    const next = profile.node;
    if (!equal(next.sideTags, source.sideTags)) throw refusal('REFUSED', 'Driven sketch: the edit changes a hole, region or side identity/order', { phase: 'profile', entity: binding.entity });
    // Only circles actually attached to this seed can move with its solve.
    // Their presence must not disable checks on any separate authored loop.
    const attached = attachedCircles(node.seed);
    for (const role of ['holes', 'regions'] as const) for (const [i, original] of (node.seed[role] ?? []).entries()) {
      const mapping = attached.find(m => m.role === role && m.loop === i), result = next[role]?.[i];
      const kept = mapping ? circleMatches(result as NumericDrivenSketchSeed['segments'], solved.shape.circles![mapping.circle]) : equal(result, original);
      if (!kept) throw refusal('REFUSED', 'Driven sketch: the edit changes an untouched hole or region, or loses an attached circle', { phase: 'profile' });
    }
    return { ...next, ...(node.seed.construction === undefined ? {} : { construction: copy(node.seed.construction) }), ...context(node) } as SketchNode & NodeExtras;
  } catch (cause) {
    if (isRefusal(cause)) throw cause;
    throw refusal('REFUSED', `Driven sketch: ${cause instanceof Error ? cause.message : String(cause)}`, { phase: 'resolve' });
  }
}
/** Bind an existing numeric driving line without storing its derived solution. */
export function bindSketchLengthNode(node: ModelNode, entity: string, name: string, parameters: Params): DrivenSketchNode {
  if (node.kind === 'driven-sketch') {
    assertDrivenSketchNode(node, parameters); input(node.bindings[0].entity === entity, 'unbind the existing line before binding another line');
    const next = { ...copy(node), bindings: [{ kind: 'line-length', entity, value: { parameter: name } }] } as DrivenSketchNode;
    resolveDrivenSketch(next, parameters); return next;
  }
  input(node.kind === 'sketch' && node.profile === 'loop', 'v1 binds numeric loop sketches only');
  keys(node, ['kind', 'profile', 'segments', 'outline', 'holes', 'regions', 'sideTags', 'construction', 'plane', 'on', ...NODE_EXTRA_FIELDS], ['kind', 'profile', 'segments', 'outline', 'sideTags'], 'source sketch');
  const seed = Object.fromEntries(['profile', 'segments', 'outline', 'holes', 'regions', 'sideTags', 'construction'].filter(k => Object.hasOwn(node, k)).map(k => [k, copy((node as unknown as Obj)[k])])) as unknown as NumericDrivenSketchSeed;
  const next = { kind: 'driven-sketch', version: 1, seed, bindings: [{ kind: 'line-length', entity, value: { parameter: name } }], ...context(node) } as DrivenSketchNode;
  resolveDrivenSketch(next, parameters); return next;
}
/** Detach at the current solved value, preserving all supported node context. */
export function unbindSketchLengthNode(node: DrivenSketchNode, parameters: Params): SketchNode & NodeExtras {
  return resolveDrivenSketch(node, parameters);
}
