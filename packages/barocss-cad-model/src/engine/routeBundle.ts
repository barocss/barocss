// PB0: two explicitly bound direct curves and copied sweeps, one translation tie.
// These helpers return private candidates. Whole-document evaluation and commit belong to the caller.
import type { Curve } from '@barocss/cad';
import type { RouteBundle, RouteBundleMember, StudioDoc } from './doc';
import { geometryOf, modelOf, movePole, polesOf, type DirectGeometry } from './direct';
import { canonical, fnv64 } from '../util/revision';
import { isRefusal, refusal } from './refusal';

type XYZ = [number, number, number];
export interface CreateRouteBundleMemberInput {
  id: string;
  curveObjectId: string;
  handleKey: string;
  sweepFeatureId: string;
  profileFeatureId: string;
}
export interface CreateRouteBundleInput {
  id: string;
  tieId: string;
  anchorMM: XYZ;
  members: [CreateRouteBundleMemberInput, CreateRouteBundleMemberInput];
  expectedDocumentIdentity: string;
}

function fail(message: string): never { throw refusal('BAD_REFERENCE', `Route bundle: ${message}`); }
const RESELECT = ' Reselect the current curve and copied sweep.';
function check(value: unknown, message: string): asserts value { if (!value) fail(message); }
function boundary<T>(run: () => T): T {
  try { return run(); }
  catch (error) {
    if (isRefusal(error) && error.code === 'BAD_REFERENCE' && error.message.includes('Route bundle:')) throw error;
    return fail(error instanceof Error ? error.message : String(error));
  }
}
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
function record(value: unknown, name: string): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be a record.`);
  check(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, `${name} must be plain data.`);
  check(Object.values(Object.getOwnPropertyDescriptors(value)).every(d => 'value' in d), `${name} must not contain accessors.`);
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, keys: readonly string[], name: string): void {
  check(Object.keys(value).every(k => keys.includes(k)) && keys.every(k => own(value, k)), `${name} has missing or unsupported fields.`);
}
function dense(value: unknown, name: string): unknown[] {
  check(Array.isArray(value), `${name} must be an array.`);
  for (let i = 0; i < value.length; i++) check(own(value, String(i)), `${name} must be dense.`);
  return value;
}
function text(value: unknown, name: string): string { check(typeof value === 'string' && value.length > 0, `${name} must be a nonempty string.`); return value; }
function number(value: unknown, name: string): number { check(typeof value === 'number' && Number.isFinite(value), `${name} must be finite.`); return value; }
function xyz(value: unknown, name: string): XYZ {
  const a = dense(value, name); check(a.length === 3, `${name} must have three coordinates.`);
  return [number(a[0], name), number(a[1], name), number(a[2], name)];
}
function add(a: XYZ, b: XYZ): XYZ { return xyz(a.map((v, k) => v + b[k]), 'translated coordinate'); }
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/** JSON identity is deliberately full-document, rather than revisionOf's selected model fields. */
function jsonData(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { number(value, 'document number'); return; }
  check(typeof value === 'object' && value !== null, 'document identity needs JSON data.');
  check(!seen.has(value), 'document identity must not be cyclic.'); seen.add(value);
  if (Array.isArray(value)) dense(value, 'document array').forEach(v => jsonData(v, seen));
  else for (const v of Object.values(record(value, 'document record'))) if (v !== undefined) jsonData(v, seen);
  seen.delete(value);
}

function markerNodes(input: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(input.nodes)) return [];
  return input.nodes.filter(n => n !== null && typeof n === 'object' && own(n, 'routeBundleMember'));
}
function rejectNested(input: Record<string, unknown>, seen = new Set<object>()): void {
  check(!seen.has(input), 'nested document graph must not be cyclic.'); seen.add(input);
  const children: unknown[] = [];
  if (Array.isArray(input.instances)) for (const i of input.instances) if (i && typeof i === 'object') children.push(i.doc);
  if (input.pendingParts && typeof input.pendingParts === 'object') for (const p of Object.values(input.pendingParts)) if (p && typeof p === 'object') children.push(p.doc);
  for (const child of children) {
    if (!child || typeof child !== 'object' || Array.isArray(child)) continue;
    const d = record(child, 'nested document');
    check(!own(d, 'routeBundles') && !(Number(d.schema) >= 4) && markerNodes(d).length === 0, 'nested route bundles are not supported.');
    rejectNested(d, seen);
  }
  seen.delete(input);
}
function pathOf(curve: Curve) {
  return { degree: curve.degree, knots: [...curve.knots], controlPoints: curve.controlPoints.map(p => [...p] as XYZ), weights: [...curve.weights] };
}
function cubic(curve: Curve): void {
  check(curve.kind === 'curve' && curve.degree === 3, 'only open clamped cubic curves are supported.');
  const points = dense(curve.controlPoints, 'curve poles'); check(points.length >= 4, 'a cubic needs at least four poles.');
  points.forEach(p => xyz(p, 'curve pole'));
  const knots = dense(curve.knots, 'curve knots').map(v => number(v, 'curve knot'));
  const weights = dense(curve.weights, 'curve weights').map(v => number(v, 'curve weight'));
  check(weights.length === points.length && weights.every(w => w > 0), 'curve weights must match the poles and be positive.');
  check(knots.length === points.length + 4 && knots.every((k, i) => i === 0 || k >= knots[i - 1]), 'curve knots must match the fixed cubic topology.');
  const lo = knots[0], hi = knots[knots.length - 1];
  check(lo < hi && knots.slice(0, 4).every(k => k === lo) && knots.slice(-4).every(k => k === hi), 'the cubic must be open and clamped.');
  check(!same(points[0], points[points.length - 1]), 'closed curves are not supported.');
}
function sourceOf(doc: StudioDoc, objectId: string, handleKey: string) {
  const d = doc.direct; check(d, 'direct geometry is missing.');
  record(d.sources, 'direct sources');
  const objects = dense(d.objects, 'direct objects').map(o => record(o, 'direct object'));
  const matches = objects.filter(o => o.id === objectId); check(matches.length === 1, 'the curve object is missing or ambiguous.' + RESELECT);
  const raw = matches[0];
  check(Object.keys(raw).every(k => ['id', 'name', 'source', 'geometry', 'hidden'].includes(k)), 'placed or trimmed curve objects are not supported.');
  const object = d.objects.find(o => o.id === objectId)!;
  const key = text(object.source, 'source key'), geometryId = text(object.geometry, 'geometry id');
  check(own(d.sources, key), 'the direct source is missing.' + RESELECT);
  const source = text(d.sources[key], 'direct source'), model = modelOf(source);
  check(model.lengthUnit === 'mm', 'the direct source must use millimetres.');
  check(model.objects.filter(o => o.id === geometryId).length === 1, 'the source geometry is missing or ambiguous.' + RESELECT);
  const curve = geometryOf(d, object); check(curve.kind === 'curve', 'the selected object is not a curve.'); cubic(curve);
  check(/^(0|[1-9]\d*)$/.test(handleKey), 'the handle key must name one curve pole.');
  const index = Number(handleKey); check(Number.isSafeInteger(index) && index > 0 && index < curve.controlPoints.length - 1, 'only an existing interior pole can be tied.');
  const pole = polesOf(d, objectId).find(p => p.key === handleKey); check(pole, 'the selected handle is missing.' + RESELECT);
  const sourceCanonical = canonical({ source, object: { id: object.id, source: key, geometry: geometryId }, curve: pathOf(curve) });
  return { object, curve, pole: xyz(pole.at, 'selected pole'), index, sourceCanonical, sourceRevision: fnv64(sourceCanonical) };
}
function sweepOf(doc: StudioDoc, member: CreateRouteBundleMemberInput) {
  const nodes = dense(doc.nodes, 'document nodes').map(n => record(n, 'feature'));
  const sweeps = nodes.flatMap((n, i) => n.id === member.sweepFeatureId ? [i] : []), profiles = nodes.flatMap((n, i) => n.id === member.profileFeatureId ? [i] : []);
  check(sweeps.length === 1 && profiles.length === 1, 'the sweep or profile stable id is missing or ambiguous.' + RESELECT);
  const index = sweeps[0], profileIndex = profiles[0], node = doc.nodes[index], profile = doc.nodes[profileIndex];
  check(node.kind === 'sweep-curve' && !node.suppressed, 'the member must name an active copied sweep.');
  check(profileIndex < index && node.sketch === profileIndex && profile.kind === 'sketch' && !profile.suppressed, 'the profile must be the sweep\'s earlier sketch.' + RESELECT);
  check(profile.profile === 'circle' && typeof profile.radius === 'number' && Number.isFinite(profile.radius) && profile.radius > 0, 'PB0 requires a finite positive circular profile.');
  const center = dense(profile.center, 'profile center'); check(center.length === 2 && center.every(v => typeof v === 'number' && Number.isFinite(v)), 'the profile center must be finite.');
  check(profile.association === undefined && profile.plane === undefined && profile.on === undefined, 'placed or associative profiles are not supported.');
  for (const [name, loops] of [['regions', profile.regions], ['holes', profile.holes]] as const) check(loops === undefined || dense(loops, `profile ${name}`).length === 0, 'PB0 requires a single circle without holes or extra regions.');
  check(profile.outline === undefined, 'PB0 does not support a separate profile reopen outline.');
  return { node, index };
}
function memberInput(input: unknown): CreateRouteBundleMemberInput {
  const m = record(input, 'member');
  return { id: text(m.id, 'member id'), curveObjectId: text(m.curveObjectId, 'curve object id'), handleKey: text(m.handleKey, 'handle key'), sweepFeatureId: text(m.sweepFeatureId, 'sweep feature id'), profileFeatureId: text(m.profileFeatureId, 'profile feature id') };
}
function admit(input: unknown): void {
  const raw = record(input, 'document'); rejectNested(raw);
  const schema = raw.schema === undefined ? 0 : Number(raw.schema), marked = markerNodes(raw);
  check(Number.isInteger(schema) && schema >= 0 && schema <= 4, 'the document schema is unsupported.');
  if (schema < 4) { check(!own(raw, 'routeBundles') && marked.length === 0, 'bundle data requires schema 4.'); return; }
  check(raw.schema === 4 && raw.format === 'barocss-cad-model' && raw.units === 'mm', 'bundle documents need schema 4 and millimetres.');
  const bundles = dense(raw.routeBundles, 'route bundles'); check(bundles.length === 1, 'PB0 requires exactly one explicit bundle.');
  const bundle = record(bundles[0], 'bundle'); fields(bundle, ['id', 'version', 'kind', 'frame', 'tie', 'members'], 'bundle');
  const bundleId = text(bundle.id, 'bundle id');
  check(bundle.version === 1 && bundle.kind === 'two-open-curves-one-translation-tie' && bundle.frame === 'world-mm', 'the bundle version, kind or frame is unsupported.');
  const tie = record(bundle.tie, 'tie'); fields(tie, ['id', 'anchorMM'], 'tie'); text(tie.id, 'tie id'); const anchor = xyz(tie.anchorMM, 'tie anchor');
  const members = dense(bundle.members, 'bundle members'); check(members.length === 2, 'PB0 requires exactly two members.');
  const ids = new Set<string>(), objects = new Set<string>(), aliases = new Set<string>(), sweeps = new Set<string>(), profiles = new Set<string>();
  const doc = raw as unknown as StudioDoc;
  for (const value of members) {
    const m = record(value, 'member');
    fields(m, ['id', 'curveObjectId', 'sourceKey', 'geometryId', 'handleKey', 'sourceRevision', 'sourceCanonical', 'offsetMM', 'sweepFeatureId', 'profileFeatureId'], 'member');
    const member = memberInput(m), source = sourceOf(doc, member.curveObjectId, member.handleKey), sweep = sweepOf(doc, member);
    const alias = canonical([source.object.source, source.object.geometry]);
    check(!ids.has(member.id) && !objects.has(member.curveObjectId) && !aliases.has(alias) && !sweeps.has(member.sweepFeatureId) && !profiles.has(member.profileFeatureId), 'members must name distinct ids, curves, sweeps and profiles.');
    ids.add(member.id); objects.add(member.curveObjectId); aliases.add(alias); sweeps.add(member.sweepFeatureId); profiles.add(member.profileFeatureId);
    check(m.sourceKey === source.object.source && m.geometryId === source.object.geometry && m.sourceCanonical === source.sourceCanonical && m.sourceRevision === source.sourceRevision, 'the member source binding is stale.' + RESELECT);
    const tiedPole = add(anchor, xyz(m.offsetMM, 'member offset'));
    // Reuse the fixed Kernel PB0 point oracle (foundation test, lines 7/10):
    // Euclidean 1e-7 mm only for this derived tie relation; stored inputs stay exact.
    check(Math.hypot(...source.pole.map((v, k) => v - tiedPole[k])) <= 1e-7, 'the selected pole does not match the tie offset.');
    check(same(sweep.node.path, pathOf(source.curve)), 'the copied sweep path is stale.' + RESELECT);
    const marker = record(sweep.node.routeBundleMember, 'sweep bundle marker'); fields(marker, ['bundleId', 'memberId'], 'sweep bundle marker');
    check(marker.bundleId === bundleId && marker.memberId === member.id, 'the sweep marker does not match its member.');
  }
  check(marked.length === 2 && marked.every(n => n.kind === 'sweep-curve' && sweeps.has(String(n.id))), 'orphan or unsupported bundle markers are not allowed.');
}

/** Bundle admission only; legacy documents without bundle metadata keep their existing admission. */
export function assertRouteBundleDocument(input: unknown): void { boundary(() => admit(input)); }
export function routeBundleDocumentIdentity(doc: StudioDoc): string {
  return boundary(() => { admit(doc); jsonData(doc); return canonical(doc); });
}
function identity(doc: StudioDoc, expected: string): void { check(typeof expected === 'string' && expected === routeBundleDocumentIdentity(doc), 'the accepted document changed.'); }
function capturedMember(doc: StudioDoc, input: CreateRouteBundleMemberInput, anchor: XYZ): RouteBundleMember {
  const s = sourceOf(doc, input.curveObjectId, input.handleKey);
  return { ...input, sourceKey: s.object.source, geometryId: s.object.geometry, sourceCanonical: s.sourceCanonical, sourceRevision: s.sourceRevision, offsetMM: xyz(s.pole.map((v, k) => v - anchor[k]), 'member offset') };
}
function install(doc: StudioDoc, bundle: RouteBundle): StudioDoc {
  const next = structuredClone(doc); next.schema = 4; next.routeBundles = [bundle];
  for (const member of bundle.members) {
    const s = sourceOf(next, member.curveObjectId, member.handleKey), { node } = sweepOf(next, member);
    node.path = pathOf(s.curve); node.routeBundleMember = { bundleId: bundle.id, memberId: member.id };
  }
  admit(next); return next;
}
export function createRouteBundle(doc: StudioDoc, input: CreateRouteBundleInput): StudioDoc {
  return boundary(() => {
    const raw = record(input, 'create input'); fields(raw, ['id', 'tieId', 'anchorMM', 'members', 'expectedDocumentIdentity'], 'create input');
    admit(doc); identity(doc, text(raw.expectedDocumentIdentity, 'expected document identity')); check(doc.schema !== 4, 'a bundle already exists.');
    const anchor = xyz(input.anchorMM, 'tie anchor'), members = dense(input.members, 'create members'); check(members.length === 2, 'PB0 requires exactly two members.');
    const captured = members.map(m => {
      fields(record(m, 'create member'), ['id', 'curveObjectId', 'handleKey', 'sweepFeatureId', 'profileFeatureId'], 'create member');
      const member = memberInput(m), source = sourceOf(doc, member.curveObjectId, member.handleKey), sweep = sweepOf(doc, member);
      check(same(sweep.node.path, pathOf(source.curve)), 'create needs a copied sweep matching the current curve.' + RESELECT);
      return capturedMember(doc, member, anchor);
    });
    return install(doc, { id: text(input.id, 'bundle id'), version: 1, kind: 'two-open-curves-one-translation-tie', frame: 'world-mm', tie: { id: text(input.tieId, 'tie id'), anchorMM: anchor }, members: captured as [RouteBundleMember, RouteBundleMember] });
  });
}

function unchangedExceptSelected(before: DirectGeometry, after: DirectGeometry, selected: Set<string>): void {
  check(before.objects.length === after.objects.length, 'a pole edit changed the object count.');
  for (let i = 0; i < before.objects.length; i++) {
    const a = before.objects[i], b = after.objects[i];
    if (!selected.has(a.id)) check(same(a, b), 'an unselected object was changed.');
    else check(same({ ...a, source: '' }, { ...b, source: '' }), 'a selected object changed its selector or placement.');
  }
  for (const [key, value] of Object.entries(before.sources)) check(after.sources[key] === value, 'an accepted source was overwritten.');
}
export function moveRouteBundle(frozenStart: StudioDoc, bundleId: string, totalDeltaMM: XYZ, expectedDocumentIdentity: string): StudioDoc {
  return boundary(() => {
    admit(frozenStart); identity(frozenStart, expectedDocumentIdentity); const delta = xyz(totalDeltaMM, 'total translation');
    const bundle = frozenStart.routeBundles?.find(b => b.id === bundleId); check(bundle, 'the bundle is missing.');
    if (delta.every(v => v === 0)) return structuredClone(frozenStart);
    const next = structuredClone(frozenStart), startDirect = frozenStart.direct!;
    let direct = next.direct!;
    for (const member of bundle.members) {
      const start = sourceOf(frozenStart, member.curveObjectId, member.handleKey);
      direct = movePole(direct, member.curveObjectId, member.handleKey, add(start.pole, delta));
    }
    unchangedExceptSelected(startDirect, direct, new Set(bundle.members.map(m => m.curveObjectId)));
    next.direct = direct;
    for (const member of bundle.members) {
      const a = sourceOf(frozenStart, member.curveObjectId, member.handleKey), b = sourceOf(next, member.curveObjectId, member.handleKey);
      check(a.curve.degree === b.curve.degree && same(a.curve.knots, b.curve.knots) && same(a.curve.weights, b.curve.weights) && a.curve.controlPoints.length === b.curve.controlPoints.length, 'a pole edit changed the fixed topology.');
      for (let i = 0; i < a.curve.controlPoints.length; i++) check(same(b.curve.controlPoints[i], i === a.index ? add(a.pole, delta) : a.curve.controlPoints[i]), 'a pole edit changed an unselected pole or endpoint.');
    }
    const anchor = add(xyz(bundle.tie.anchorMM, 'tie anchor'), delta);
    const members = bundle.members.map(m => ({ ...capturedMember(next, m, anchor), offsetMM: [...m.offsetMM] as XYZ })) as [RouteBundleMember, RouteBundleMember];
    return install(next, { ...structuredClone(bundle), tie: { ...bundle.tie, anchorMM: anchor }, members });
  });
}
export function detachRouteBundle(doc: StudioDoc, bundleId: string, expectedDocumentIdentity: string): StudioDoc {
  return boundary(() => {
    admit(doc); identity(doc, expectedDocumentIdentity); check(doc.routeBundles?.some(b => b.id === bundleId), 'the bundle is missing.');
    const next = structuredClone(doc);
    next.routeBundles = next.routeBundles!.filter(b => b.id !== bundleId);
    for (const node of next.nodes) if (node.kind === 'sweep-curve' && node.routeBundleMember?.bundleId === bundleId) delete node.routeBundleMember;
    if (!next.routeBundles.length) { delete next.routeBundles; next.schema = 3; }
    admit(next); return next;
  });
}
