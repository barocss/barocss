import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep } from '@barocss/cad';
import { part, param, type RawNurbsSurface, type StudioPart } from '../src/api';
import { commandById, type Ctx } from '../src/app/commands';
import { editFields } from '../src/app/editFields';
import { checkNode } from '../src/chat/features';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { thickenSnapshot } from '../src/engine/thicken';
import { loadDirect } from '../src/engine/directModule';
import { surfacesSource } from '../src/engine/curveSource';
import { partBreps, evaluateDoc } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';

// Independent flat oracle: S(u,v) = [20+5u,-11+5v,3], u in [-2,6], v in [1,7].
function surface() {
  return { degreeU: 1, degreeV: 1, knotsU: [-2, -2, 6, 6], knotsV: [1, 1, 7, 7],
    controlPoints: [[[10, -6, 3], [10, 24, 3]], [[50, -6, 3], [50, 24, 3]]] as [number, number, number][][], weights: [[1, 1], [1, 1]] };
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-7, `${actual} vs ${expected}`);
function mass(p: StudioPart, volume: number, z: number) {
  const m = p.mass({ density: 1 }); close(m.volume, volume); close(m.centroid[0], 30); close(m.centroid[1], 9); close(m.centroid[2], z);
}
function context(doc = emptyDoc(), direct?: string[]): Ctx { return { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] }, ...(direct ? { direct } : {}) }; }
function sourceDoc(): StudioDoc {
  const s = surface(), text = surfacesSource('Flat', [{ ...s, points: s.controlPoints }]);
  return { ...emptyDoc(), direct: { sources: { source: text }, objects: [{ id: 'surface', name: 'Flat source', source: 'source', geometry: 's1' }] } };
}
const command = () => commandById('thicken')!;

test('raw facade creates on an empty part, with all sides and independent planar mass and bounds', t => {
  let acceptedNames: string[] | undefined;
  for (const [side, z, minZ, maxZ] of [['normal', 4, 3, 5], ['reverse', 2, 1, 3], ['both', 3, 2, 4]] as const) {
    const input = surface(), before = structuredClone(input), made = part('Wall').thicken(input, { t: 2, side });
    const node = made.doc.nodes[0]; assert.equal(node.kind, 'thicken');
    if (node.kind !== 'thicken') assert.fail('thicken');
    assert.equal(node.name, 'Whole surface snapshot'); assert.equal(node.side, side === 'normal' ? undefined : side); assert.deepEqual(node.surface, before);
    assert.equal(made.doc.nodes.length, 1); mass(made, 2400, z);
    const [{ brep }] = partBreps(made.doc); assert.equal(checkBrep(brep).valid, true); assert.ok(brep.shells.every(s => s.closed));
    const expectedMin = [10, -6, minZ], expectedMax = [50, 24, maxZ];
    for (let axis = 0; axis < 3; axis++) { close(Math.min(...brep.vertices.map(v => v.point[axis])), expectedMin[axis]); close(Math.max(...brep.vertices.map(v => v.point[axis])), expectedMax[axis]); }
    const names = made.select().faces().names(); assert.equal(names.length, 6); assert.equal(new Set(names).size, 6); const nativeNames = brep.faces.map(f => f.name!);
    assert.ok(nativeNames.every(name => name.startsWith(`${node.id}.facet`)));
    assert.equal(nativeNames.length, 73);
    assert.deepEqual([...new Set(names.flatMap(name => name.split('+')))].sort(), [...nativeNames].sort());
    if (acceptedNames) assert.deepEqual(names, acceptedNames); else acceptedNames = names;
    t.diagnostic(JSON.stringify({ side, t: 2, publicNames: names, brepNames: nativeNames }));
    input.controlPoints[0][0][0] = 99; input.weights[0][0] = 2; assert.deepEqual(made.doc.nodes[0], node);
    const returned = made.doc; if (returned.nodes[0].kind === 'thicken') returned.nodes[0].surface.controlPoints[0][0][0] = 77;
    assert.deepEqual(made.doc.nodes[0], node);
  }
});

test('only thickness binds; edits preserve names, snapshots and immutable input on refusal', async () => {
  const wall = part('Bound').parameter('wall', 2).thicken(surface(), { t: param('wall') }), doc = wall.doc, node = doc.nodes[0];
  assert.ok(node.kind === 'thicken'); assert.deepEqual(node.thickness, { parameter: 'wall' });
  const names = wall.select().faces().names(), changed = wall.withParameters({ wall: 3 }); mass(changed, 3600, 4.5);
  assert.deepEqual(changed.select().faces().names(), names);
  for (const t of [0, -1, 10001, NaN]) assert.throws(() => wall.withParameters({ wall: t }));
  assert.deepEqual(wall.doc, doc);
  assert.throws(() => part().thicken(surface(), { t: param('missing') }), /PARAMETER_UNKNOWN/);
  assert.throws(() => part().parameter('side', 1).thicken(surface(), { t: 2, side: param('side') as never }), /VALUE|PARAMETER_UNBINDABLE/);
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, doc);
  const reopened = part('Reopened', opened.doc); mass(reopened, 2400, 4); assert.deepEqual(reopened.select().faces().names(), names);
  const fields = editFields(opened.doc.nodes, 0, opened.doc.parameters), tField = fields.find(f => f.key === 't'), sideField = fields.find(f => f.key === 'side');
  assert.equal(tField?.kind, 'number'); assert.equal(sideField?.kind, 'choice');
  if (tField?.kind !== 'number' || sideField?.kind !== 'choice') assert.fail('editable thickness and side');
  const bothNodes = sideField.set(tField.set(opened.doc.nodes, 3), 'both'), both = part('Both', { ...opened.doc, nodes: bothNodes }); mass(both, 3600, 3);
  assert.deepEqual(both.select().faces().names(), names);
  const normal = sideField.set(bothNodes, 'normal')[0]; assert.ok(normal.kind === 'thicken'); assert.equal(normal.side, undefined);
});

test('creation preserves a separate stock body and its focus', () => {
  const stock = part().box({ w: 12, d: 7, h: 5, x: 80, y: -3, z: 1 }), key = stock.bodies()[0], names = stock.select().faces().names();
  const both = stock.body(key).thicken(surface(), { t: 2 }); assert.equal(both.bodies().length, 2); assert.deepEqual(both.body(key).select().faces().names(), names);
  close(both.mass({ density: 1 }).volume, 420); const newKey = both.bodies().find(k => k !== key)!; mass(both.body(newKey), 2400, 4);
});

test('raw context discovery and chat admission use the strict public snapshot validator', () => {
  const ctx = { ...context(), thickenSnapshot: { surface: surface(), name: 'Raw snapshot' } };
  assert.deepEqual(command().available(ctx), { ok: true }); assert.deepEqual(command().fields!(ctx).map(f => f.key), ['t', 'side']);
  const doc = command().build!(ctx, { t: 2, side: 'reverse' }); assert.equal(checkNode(doc.nodes[0], [], {}), null);
  for (const extra of [{ trims: [] }, { objectId: 'surface' }, { kind: 'surface' }]) {
    const raw = { ...surface(), ...extra } as RawNurbsSurface;
    assert.equal(command().available({ ...ctx, thickenSnapshot: { ...ctx.thickenSnapshot, surface: raw } }).ok, false);
    assert.match(checkNode({ ...doc.nodes[0], surface: raw }, [], {})!, /VALUE|surface|field/i);
  }
  assert.match(checkNode({ ...doc.nodes[0], thickness: 0 }, [], {})!, /VALUE|positive/i);
  assert.match(checkNode({ ...doc.nodes[0], side: 'left' }, [], {})!, /normal|reverse|both/);
});

test('selected direct capture checks trims and identity before copying, and keeps independent history', async () => {
  await loadDirect();
  const doc = sourceDoc(), ctx = context(doc, ['surface']), before = structuredClone(doc), snapshot = thickenSnapshot(ctx);
  assert.equal(snapshot.name, 'Flat source'); assert.deepEqual(snapshot.surface, surface());
  const accepted = command().build!(ctx, { t: 2, side: 'normal' }); assert.deepEqual(doc, before);
  assert.deepEqual(accepted.direct, doc.direct); assert.equal(accepted.direct!.objects[0].hidden, undefined);
  const node = accepted.nodes[0]; assert.ok(node.kind === 'thicken'); assert.equal(node.name, 'Flat source');
  const withoutSource = { ...accepted, direct: { sources: {}, objects: [] } }; mass(part('Independent', withoutSource), 2400, 4);
  assert.deepEqual(withoutSource.nodes[0], node);
  assert.equal(command().available(context(doc, ['surface', 'surface'])).ok, false);
  assert.equal(command().available(context(doc, ['missing'])).ok, false);
  const ambiguous = structuredClone(doc); ambiguous.direct!.objects.push({ ...ambiguous.direct!.objects[0] }); assert.equal(command().available(context(ambiguous, ['surface'])).ok, false);
  for (const trims of [{}, null, 'bad', [{ keep: 'inside', points: [] }]]) {
    const malformed = structuredClone(doc); malformed.direct!.objects[0].trims = trims as never; malformed.direct!.sources.source = 'invalid source';
    const availability = command().available(context(malformed, ['surface'])); assert.equal(availability.ok, false);
    if (!availability.ok) assert.match(availability.reason, /untrim/i);
  }
  const missingSource = structuredClone(doc); delete missingSource.direct!.sources.source; assert.equal(command().available(context(missingSource, ['surface'])).ok, false);
  const missingGeometry = structuredClone(doc); missingGeometry.direct!.objects[0].geometry = 'missing'; assert.equal(command().available(context(missingGeometry, ['surface'])).ok, false);
});

test('fold preview refuses before acceptance and facade retains its native mapped refusal', async () => {
  const w = Math.SQRT1_2, quarter = { degreeU: 2, degreeV: 1, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[10, 0, 0], [10, 10, 0]], [[10, 0, 10], [10, 10, 10]], [[0, 0, 10], [0, 10, 10]]] as [number, number, number][][], weights: [[1, 1], [w, w], [1, 1]] };
  for (const [t, side] of [[12, 'normal'], [21, 'both']] as const) {
    const base = part(), before = base.doc;
    assert.throws(() => base.thicken(quarter, { t, side }), (error: unknown) => { assert.equal((error as { code: string }).code, 'OFFSET_FOLDS'); assert.equal((error as { where: string }).where, 'evaluate'); assert.ok((error as { details: { friendly: unknown } }).details.friendly); return true; });
    assert.deepEqual(base.doc, before);
    const ctx = { ...context(), thickenSnapshot: { surface: quarter, name: 'Fold' } }, candidate = command().build!(ctx, { t, side });
    const result = await evaluateDoc(candidate, 1); assert.equal(result.ok, false); assert.deepEqual(ctx.doc, emptyDoc());
  }
});
