import test from 'node:test';
import assert from 'node:assert/strict';
import { commands, type Ctx, type Values } from '../src/app/commands';
import { editFields } from '../src/app/editFields';
import { rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import type { BodyResult } from '../src/engine/evaluate';
import { evaluateDoc } from '../src/engine/evaluate';
import { toPartDocument } from '../src/engine/part';
import { readStudioDoc } from '../src/engine/migrate';
import { encodeStudioFile, decodeStudioFile } from '../src/engine/container';
import { isRefusal } from '../src/engine/refusal';
import { runTool, type ChatState } from '../src/chat/tools';
import { emptyDirect, geometryOf, importSource } from '../src/engine/direct';
import { createRouteBundle, routeBundleDocumentIdentity, type CreateRouteBundleMemberInput } from '../src/engine/routeBundle';

type Pattern = Extract<ModelNode, { kind: 'circular-pattern' }>;
const command = commands.find(c => c.id === 'circular-pattern')!;
function create(span: number, count = 4, axis = 'z', result = 'one'): StudioDoc {
  const doc = rectanglePart(80, 40, 10);
  // This builder only reads the chosen body's stable reference; geometry stays in the real document.
  const body = { key: 'b1', ref: { node: 1, side: 'solid' } } as BodyResult;
  const ctx: Ctx = { doc, bodies: [body], selection: { faces: [], edges: [], bodies: [0] } };
  const values: Values = { axis, count, span, px: -100, py: 0, result };
  return command.build!(ctx, values);
}
const pattern = (doc: StudioDoc): Pattern => {
  const node = doc.nodes[2]; assert.equal(node.kind, 'circular-pattern'); return node as Pattern;
};
function count(doc: StudioDoc, value: number): StudioDoc {
  const field = editFields(doc.nodes, 2).find(f => f.key === 'count');
  assert.ok(field && field.kind === 'number'); return { ...doc, nodes: field.set(doc.nodes, value) };
}
function legacy(doc: StudioDoc): StudioDoc {
  const copy = structuredClone(doc); delete pattern(copy).span; return copy;
}
async function saved(doc: StudioDoc): Promise<StudioDoc> {
  const file = await decodeStudioFile(encodeStudioFile(doc)), read = readStudioDoc(file.text);
  assert.ok('doc' in read, 'saved document reads'); return read.doc;
}

// Schema4 requires one PB0 bundle. Reuse route-bundle-admission.test.ts's canonical source and
// construction as a codec antecedent after the pattern; this test makes no PB0 geometry claim.
const ROUTE_CODEC_SOURCE = `@model bundle {
  version: 0;
  length-unit: mm;
  @curve #A { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[-2,0,0],[-2,0,10],[-2,0,20],[-2,0,30]]; weights: [1,1,1,1]; }
  @curve #B { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[2,0,0],[2,0,10],[2,0,20],[2,0,30]]; weights: [1,1,1,1]; }
}`;
function inSchema(doc: StudioDoc, schema: number): StudioDoc {
  if (schema === 3) return doc;
  const direct = importSource(emptyDirect(), ROUTE_CODEC_SOURCE, 'bundle'), members: CreateRouteBundleMemberInput[] = [];
  assert.equal(direct.objects.length, 2);
  let next: StudioDoc = { ...doc, direct };
  for (let i = 0; i < 2; i++) {
    const object = direct.objects[i], curve = geometryOf(direct, object); assert.ok(curve.kind === 'curve');
    const profile = next.nodes.length, controlPoints: [number, number, number][] = [];
    for (const p of curve.controlPoints) controlPoints.push([p[0], p[1], p[2]]);
    next = withNode(next, { kind: 'sketch', profile: 'circle', center: [i ? 2 : -2, 0], radius: 0.5 });
    next = withNode(next, { kind: 'sweep-curve', sketch: profile, name: object.name, path: { degree: curve.degree, knots: [...curve.knots], controlPoints, weights: [...curve.weights] } });
    members.push({ id: i ? 'B' : 'A', curveObjectId: object.id, handleKey: '1', profileFeatureId: next.nodes[profile].id!, sweepFeatureId: next.nodes.at(-1)!.id! });
  }
  return createRouteBundle(next, { id: 'bundle1', tieId: 'tie1', anchorMM: [0, 0, 10], expectedDocumentIdentity: routeBundleDocumentIdentity(next), members: [members[0], members[1]] });
}

test('270 partial and 360 full turns retain distinct intent despite identical original step/count', () => {
  const partial = create(270), full = create(360), before = structuredClone(partial);
  assert.equal(pattern(partial).angle, 90); assert.equal(pattern(full).angle, 90);
  assert.equal(pattern(partial).span, 270); assert.equal(pattern(full).span, 360);
  assert.deepEqual(toPartDocument(partial), toPartDocument(full), 'metadata does not alter the original native geometry');
  const p2 = count(partial, 2), f2 = count(full, 2);
  assert.equal(pattern(p2).angle, 270); assert.equal(pattern(f2).angle, 180);
  assert.deepEqual(pattern(p2).parent, pattern(partial).parent); assert.deepEqual(pattern(p2).pivot, [-100, 0, 0]);
  assert.deepEqual(partial, before, 'editing never mutates the authored document');
  const native = toPartDocument(p2).features.at(-1)!;
  assert.equal(native.kind, 'circular-pattern'); assert.ok(!('span' in native), 'intent stays in Model, not the CAD schema');
});

test('180 partial spread includes endpoints after Count4 to3, while full-circle steps retain creation rounding', () => {
  const doc = create(180), after = count(doc, 3);
  assert.equal(pattern(doc).angle, 60); assert.equal(pattern(after).angle, 90); assert.equal(pattern(after).span, 180);
  assert.equal(pattern(count(create(360), 7)).angle, 51.428571);
  assert.deepEqual(toPartDocument(after), toPartDocument(legacy(after)), 'native geometry is byte-equivalent with or without the intent field');
});

test('creation retains existing signed and large-spread geometry without new range admission', () => {
  for (const [span, stored, angle] of [[720, 360, 90], [-540, -540, -180], [-900, -900, -300], [0, 0, 0]]) {
    const doc = create(span); assert.equal(pattern(doc).span, stored); assert.equal(pattern(doc).angle, angle);
    assert.deepEqual(toPartDocument(doc), toPartDocument(legacy(doc)));
  }
  assert.equal(pattern(count(create(-540), 3)).angle, -270);
  const zero = evaluateDoc(create(0), 1); assert.equal(zero.ok, false, 'zero step is still refused by existing native admission');
  const single = create(270, 1); assert.equal(pattern(single).angle, Infinity);
  assert.throws(() => toPartDocument(single), error => isRefusal(error, 'VALUE'), 'partial count1 creation is still refused, never repaired to a new admitted shape');
});

test('legacy absence preserves exact old count arithmetic and serialization; X/Y and separate paths keep their graphs', async () => {
  const old = legacy(create(270)); assert.equal(pattern(count(old, 7)).angle, 360 / 7);
  assert.equal(pattern(count(old, 0)).angle, 360); assert.ok(!Object.hasOwn(pattern(count(old, 2)), 'span'));
  assert.deepEqual(await saved(old), old);
  for (const axis of ['x', 'y']) {
    const doc = create(270, 9, axis); assert.equal(pattern(doc).count, 4); assert.equal(pattern(doc).angle, 90);
    assert.ok(!Object.hasOwn(pattern(doc), 'span')); assert.equal(pattern(count(doc, 2)).angle, 90);
  }
  const separate = create(270, 4, 'z', 'separate');
  assert.equal(separate.nodes.filter(n => n.kind === 'circular-pattern').length, 0);
  const rotations = separate.nodes.filter(n => n.kind === 'rotate');
  assert.deepEqual(rotations.map(n => n.angle), [90, 180, 270]);
  for (const node of separate.nodes) assert.ok(!Object.hasOwn(node, 'span'));
  assert.equal(Object.keys(separate.outputs).length, 4);
});

for (const schema of [3, 4] as const) test(`schema${schema} Save/load retains partial intent and Count1 round trip`, async () => {
  const doc = inSchema(create(-900), schema), one = count(doc, 1);
  assert.equal(pattern(one).angle, 360); assert.equal(pattern(one).span, -900);
  const reopened = await saved(one); assert.equal(reopened.schema, schema); assert.deepEqual(pattern(reopened), pattern(one));
  const four = count(reopened, 4); assert.equal(pattern(four).angle, -300); assert.equal(pattern(four).span, -900);
  assert.deepEqual(toPartDocument(four), toPartDocument(doc));
  const partial = await saved(inSchema(create(270), schema)); assert.equal(pattern(count(partial, 2)).angle, 270);
});

test('typed read and direct compile reject malformed or contradictory metadata, including suppressed and nested nodes', () => {
  const bad = [
    { span: null }, { span: '270' }, { span: { parameter: 's' } }, { span: NaN }, { span: Infinity }, { span: -Infinity },
    { axis: 'x' }, { angle: 180 }, { span: 180 }, { angle: NaN }, { count: 1, angle: 270 }, { suppressed: true, angle: 180 },
  ];
  const baselines = [inSchema(create(270), 3), inSchema(create(270), 4)];
  for (const patch of bad) {
    for (const baseline of baselines) {
      const doc = structuredClone(baseline); Object.assign(pattern(doc), patch);
      assert.throws(() => toPartDocument(doc), error => isRefusal(error, 'VALUE'));
      const read = readStudioDoc(JSON.stringify(doc)); assert.ok('error' in read); assert.match(read.error, /Circular body pattern spread/);
    }
  }
  const child = create(270); pattern(child).angle = 180;
  for (const tree of [
    { ...rectanglePart(1, 1, 1), instances: [{ id: 'p1', doc: child }] },
    { ...rectanglePart(1, 1, 1), pendingParts: { child: { doc: child } } },
  ]) {
    assert.throws(() => toPartDocument(tree as StudioDoc), error => isRefusal(error, 'VALUE'));
    const read = readStudioDoc(JSON.stringify(tree)); assert.ok('error' in read); assert.match(read.error, /Circular body pattern spread/);
  }
});

test('invalid counts retain existing native admission instead of metadata clamping or a new positive span rule', () => {
  for (const value of [0, -1, 65]) {
    const doc = count(create(270), value); assert.equal(pattern(doc).count, value);
    const native = toPartDocument(doc).features.at(-1)!; assert.equal(native.kind, 'circular-pattern');
    const result = evaluateDoc(doc, 1); assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error.detail, /count must be an integer/);
  }
  const doc = create(720); pattern(doc).span = 720;
  assert.doesNotThrow(() => toPartDocument(doc), 'finite coherent full-turn metadata has no new span range limit');
});

test('offline edit_feature accepts coherent whole-node intent/pivot, refuses stale intent atomically, and permits explicit legacy replacement', async () => {
  const was = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = '3';
  try {
    const doc = create(270), result = evaluateDoc(doc, 1); assert.ok(result.ok);
    const state: ChatState = { doc, bodies: result.bodies }, evaluate = async (next: StudioDoc) => evaluateDoc(next, 2);
    const replacement = { ...pattern(doc), count: 2, angle: 270 };
    const edited = await runTool(state, 'edit_feature', { index: 2, feature: replacement }, evaluate);
    assert.ok(!edited.isError, edited.content); assert.deepEqual(pattern(edited.state.doc), replacement);
    assert.deepEqual(edited.state.doc.nodes.slice(0, 2), doc.nodes.slice(0, 2));
    assert.equal(pattern(edited.state.doc).id, pattern(doc).id); assert.equal(pattern(edited.state.doc).span, 270);
    assert.deepEqual(toPartDocument(edited.state.doc), toPartDocument(count(doc, 2)), 'whole replacement and the public count field compile the same native geometry');
    const accepted = structuredClone(edited.state.doc), bodies = structuredClone(edited.state.bodies);
    const stale = await runTool(edited.state, 'edit_feature', { index: 2, feature: { ...replacement, angle: 180 } }, evaluate);
    assert.equal(stale.isError, true); assert.match(stale.content, /Circular body pattern spread/);
    assert.deepEqual(stale.state.doc, accepted); assert.deepEqual(stale.state.bodies, bodies);
    const explicit: Pattern = { ...replacement, angle: 180 }; delete explicit.span;
    const reset = await runTool(edited.state, 'edit_feature', { index: 2, feature: explicit }, evaluate);
    assert.ok(!reset.isError, reset.content); assert.deepEqual(pattern(reset.state.doc), explicit);
    assert.ok(!Object.hasOwn(pattern(reset.state.doc), 'span'), 'whole replacement without span explicitly resets to a legacy recipe; no intent inferred');
  } finally {
    if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was;
  }
});
