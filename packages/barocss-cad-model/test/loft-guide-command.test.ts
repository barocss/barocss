import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { sketch } from '../src/api';
import { emptyDoc, withNode, type DocPlane, type ModelNode, type SketchNode, type StudioDoc } from '../src/engine/doc';
import { directOps, emptyDirect, geometryOf, importSource } from '../src/engine/direct';
import { loadDirect } from '../src/engine/directModule';
import { loftCommand } from '../src/app/profileCommands';
import { framedLoftSections } from '../src/app/profiles';
import { copyLoftGuide } from '../src/app/loftGuides';
import type { Ctx, Values } from '../src/app/commands';

// Command authoring only: no solid evaluation, native loft oracle, mass, codec, or browser flow.
// The circle profiles and quadratic/cubic controls reuse the fixed public CG1 inputs.
type Point = [number, number, number];
type Loft = Extract<ModelNode, { kind: 'loft' }>;
const QUADRATIC: Point[] = [[1, 0, 0], [3, 0, 1.5], [1, 0, 3]];
const CUBIC: Point[] = [[1, 0, 0], [4, 0, 1], [2, 0, 2], [4, 0, 3]];
const SOURCE = `@model guide_input {
  version: 0;
  length-unit: mm;
  @curve #quadratic { type: nurbs; degree: 2; knots: [0,0,0,1,1,1]; control-points: [[1,0,0],[3,0,1.5],[1,0,3]]; weights: [1,1,1]; }
  @curve #cubic { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[1,0,0],[4,0,1],[2,0,2],[4,0,3]]; weights: [1,1,1,1]; }
  @curve #affine { type: nurbs; degree: 2; knots: [2,2,2,5,5,5]; control-points: [[1,0,0],[3,0,1.5],[1,0,3]]; weights: [2,2,2]; }
  @curve #line { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[1,0,0],[1,0,3]]; weights: [1,1]; }
  @curve #rational { type: nurbs; degree: 2; knots: [0,0,0,1,1,1]; control-points: [[1,0,0],[3,0,1.5],[1,0,3]]; weights: [1,2,1]; }
  @curve #multi { type: nurbs; degree: 2; knots: [0,0,0,0.5,1,1,1]; control-points: [[1,0,0],[3,0,1],[2,0,2],[1,0,3]]; weights: [1,1,1,1]; }
  @surface #panel { type: nurbs; degree-u: 1; degree-v: 1; knots-u: [0,0,1,1]; knots-v: [0,0,1,1]; control-points: [[[0,0,0],[0,1,0]],[[1,0,0],[1,1,0]]]; weights: [[1,1],[1,1]]; }
}`;

before(async () => { await loadDirect(); });

function circle(doc: StudioDoc, radius: number, plane?: DocPlane): StudioDoc {
  return withNode(doc, { kind: 'sketch', ...sketch().circle({ r: radius }).data, ...(plane ? { plane } : {}) } as SketchNode);
}
function document(): StudioDoc {
  const lower = circle(emptyDoc(), 1);
  const upper = circle(lower, 4, { origin: [0, 0, 3], normal: [0, 0, 1], xAxis: [1, 0, 0] });
  return { ...upper, direct: importSource(emptyDirect(), SOURCE, 'guide input') };
}
function context(doc: StudioDoc, picked = [0, 1]): Ctx {
  return { doc, bodies: [], selection: { faces: [], edges: [], bodies: [], sketches: picked } };
}
function objectId(doc: StudioDoc, geometry: string): string {
  const object = doc.direct?.objects.find(value => value.geometry === geometry);
  assert.ok(object, `missing imported ${geometry}`);
  return object.id;
}
function build(ctx: Ctx, values: Values): StudioDoc {
  assert.ok(loftCommand.build);
  return loftCommand.build(ctx, values);
}
function loft(doc: StudioDoc): Loft {
  const node = doc.nodes.at(-1);
  assert.ok(node?.kind === 'loft');
  return node;
}

test('Loft None preserves the fixed legacy authored bytes, including height sections and copied loop profiles', () => {
  const doc = document(), ctx = context(doc), before = JSON.stringify(doc);
  // Fixed legacy authoring result through the existing document API, independent of the new guide helpers.
  let expected = withNode(doc, { kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [1, 0], center: [0, 0], direction: 'ccw' }] });
  expected = withNode(expected, { kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [4, 0], center: [0, 0], direction: 'ccw' }] });
  expected = withNode(expected, { kind: 'loft', sections: [{ sketch: 2, z: 0 }, { sketch: 3, z: 3 }], from: [0, 1] });
  const legacyValues: Values[] = [{ smooth: 'no' }, { smooth: 'no', guide: '' }];
  for (const values of legacyValues) {
    const next = build(ctx, values);
    assert.equal(JSON.stringify(next), JSON.stringify(expected));
    assert.equal(Object.hasOwn(loft(next), 'guide'), false);
    assert.ok(loft(next).sections.every(section => Object.hasOwn(section, 'z') && !Object.hasOwn(section, 'frame')));
  }
  assert.equal(loftCommand.defaults?.(ctx).guide, '', 'None remains explicit even when direct curves are available');
  assert.equal(JSON.stringify(doc), before);
});

test('framed sections retain pick order and authored profile coordinates, with independent frames and no copied feature ids', () => {
  const lower: DocPlane = { origin: [11, -5, 3], normal: [0, -1, 0], xAxis: [1, 0, 0] };
  const upper: DocPlane = { origin: [17, -5, 9], normal: [0, -1, 0], xAxis: [1, 0, 0] };
  const doc = circle(circle(emptyDoc(), 1, lower), 4, upper), before = JSON.stringify(doc);
  const result = framedLoftSections(doc.nodes, [1, 0]);
  assert.ok(!('error' in result));
  assert.deepEqual(result.sections.map(section => section.source), [1, 0]);
  assert.deepEqual(result.sections.map(section => section.frame), [
    { origin: [17, -5, 9], xAxis: [1, 0, 0], yAxis: [0, 0, 1] },
    { origin: [11, -5, 3], xAxis: [1, 0, 0], yAxis: [0, 0, 1] },
  ]);
  for (const section of result.sections) {
    const original = doc.nodes[section.source];
    assert.ok(original.kind === 'sketch' && original.profile === 'circle' && section.node.profile === 'circle');
    assert.equal(section.node.radius, original.radius);
    assert.deepEqual(section.node.center, original.center);
    assert.deepEqual(section.node.plane, original.plane);
    assert.notEqual(section.node, original);
    assert.notEqual(section.node.center, original.center);
    assert.notEqual(section.node.plane, original.plane);
    assert.equal(Object.hasOwn(section.node, 'id'), false, 'withNode must assign a fresh id to the copied profile');
  }
  const first = result.sections[0].node;
  assert.ok(first.profile === 'circle' && first.plane);
  first.center[0] = 99; first.plane.origin[0] = 999; result.sections[0].frame.origin[1] = 888;
  assert.equal(JSON.stringify(doc), before, 'editing a returned snapshot cannot modify the authored sketches');
  for (const [picked, reason] of [
    [[0], /exactly two/], [[0, 1, 2], /exactly two/], [[0, 0], /different sketches/], [[0, 99], /not a finished sketch/],
  ] as const) {
    const invalid = framedLoftSections(doc.nodes, picked);
    assert.ok('error' in invalid); assert.match(invalid.error, reason);
    assert.equal(JSON.stringify(doc), before);
  }
});

test('quadratic and cubic guide commands author copied controls and explicit frames with unique new feature ids', () => {
  const doc = document(), ctx = context(doc), before = JSON.stringify(doc);
  for (const [geometry, kind, points] of [['quadratic', 'quadratic-bezier', QUADRATIC], ['cubic', 'cubic-bezier', CUBIC]] as const) {
    const next = build(ctx, { smooth: 'no', guide: objectId(doc, geometry) }), node = loft(next);
    assert.deepEqual(node.guide, { kind, controlPoints: points });
    assert.deepEqual(node.from, [0, 1]);
    assert.deepEqual(node.sections, [
      { sketch: 2, frame: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0] } },
      { sketch: 3, frame: { origin: [0, 0, 3], xAxis: [1, 0, 0], yAxis: [0, 1, 0] } },
    ]);
    assert.deepEqual(next.nodes.slice(0, 2), doc.nodes);
    const ids = next.nodes.map(value => value.id);
    assert.ok(ids.every(id => typeof id === 'string'));
    assert.equal(new Set(ids).size, ids.length, 'copied sketches must not duplicate their source feature ids');
    assert.deepEqual(ids.slice(0, 2), ['n0', 'n1']);
    assert.ok(ids.slice(2).every(id => id !== 'n0' && id !== 'n1'));
    for (const [source, copied] of [[0, 2], [1, 3]]) {
      const original = doc.nodes[source], profile = next.nodes[copied];
      assert.ok(original.kind === 'sketch' && original.profile === 'circle' && profile.kind === 'sketch' && profile.profile === 'circle');
      assert.equal(profile.radius, original.radius); assert.deepEqual(profile.center, original.center);
      assert.deepEqual(profile.plane, original.plane);
      assert.notEqual(profile.center, original.center);
    }
    assert.equal(JSON.stringify(doc), before);
  }
});

test('affine knot intervals and common positive weights keep the controls; baked Direct movement is copied once and stays independent', () => {
  const doc = document(), before = JSON.stringify(doc), affine = copyLoftGuide(doc, objectId(doc, 'affine'));
  assert.ok(affine.ok);
  assert.deepEqual(affine.guide, { kind: 'quadratic-bezier', controlPoints: QUADRATIC });
  const id = objectId(doc, 'cubic'), copied = copyLoftGuide(doc, id);
  assert.ok(copied.ok);
  const moved = directOps.move(doc.direct!, [id], [5, -3, 4]);
  const movedObject = moved.objects.find(value => value.id === id);
  assert.ok(movedObject);
  const compiled = geometryOf(moved, movedObject);
  assert.ok(compiled.kind === 'curve');
  const compiledBefore = structuredClone(compiled.controlPoints);
  const movedCopy = copyLoftGuide({ direct: moved }, id);
  assert.ok(movedCopy.ok);
  // Existing curvesSource text generation can round: copy the currently compiled world-mm controls exactly.
  assert.deepEqual(movedCopy.guide, { kind: 'cubic-bezier', controlPoints: compiledBefore });
  assert.deepEqual(copied.guide, { kind: 'cubic-bezier', controlPoints: CUBIC });
  movedCopy.guide.controlPoints[0][0] = 1000;
  assert.deepEqual(compiled.controlPoints, compiledBefore, 'the snapshot must not alias the Direct compile cache');
  const copiedAgain = copyLoftGuide(doc, id);
  assert.ok(copiedAgain.ok);
  assert.deepEqual(copiedAgain.guide, { kind: 'cubic-bezier', controlPoints: CUBIC });
  assert.equal(JSON.stringify(doc), before);
});

test('unsupported direct geometry returns explicit reasons without changing the document or silently choosing another curve', () => {
  const doc = document(), ctx = context(doc), before = JSON.stringify(doc);
  for (const [geometry, reason] of [
    ['line', /degree 2 or 3|quadratic|cubic/i],
    ['rational', /equal weights|nonconstant rational/i],
    ['multi', /control points|clamped|internal|additional knots/i],
    ['panel', /curve.*surface|not a surface/i],
  ] as const) {
    const id = objectId(doc, geometry), result = copyLoftGuide(doc, id);
    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.match(result.reason, reason);
    assert.throws(() => build(ctx, { smooth: 'no', guide: id }), reason);
    assert.equal(JSON.stringify(doc), before);
  }
});

test('Guide choice lists only supported snapshots and its steps describe the chosen copied source rather than a live link', () => {
  const doc = document(), ctx = context(doc), before = JSON.stringify(doc);
  const fields = loftCommand.fields?.(ctx, { smooth: 'no', guide: '' }) ?? [];
  const field = fields.find(value => value.key === 'guide');
  assert.ok(field?.kind === 'choice');
  assert.equal(field.label, 'Guide (copied)');
  assert.deepEqual(field.options.map(option => option.value), ['', objectId(doc, 'quadratic'), objectId(doc, 'cubic'), objectId(doc, 'affine')]);
  assert.match(field.options[0].label, /None/i);
  assert.ok(fields.some(value => value.key === 'smooth'));
  const noneSteps = loftCommand.steps?.(ctx, { smooth: 'no', guide: '' }) ?? [];
  for (const geometry of ['line', 'rational', 'multi', 'panel']) {
    const name = doc.direct!.objects.find(value => value.id === objectId(doc, geometry))!.name;
    assert.ok(noneSteps.some(step => !step.done && /Unavailable guide/i.test(step.label) && step.text.includes(name)));
  }
  for (const geometry of ['quadratic', 'cubic']) {
    const id = objectId(doc, geometry), name = doc.direct!.objects.find(value => value.id === id)!.name;
    assert.ok(loftCommand.fields?.(ctx, { smooth: 'no', guide: id }).every(value => value.key !== 'smooth'));
    const steps = loftCommand.steps?.(ctx, { smooth: 'no', guide: id }) ?? [];
    const step = steps.find(value => /guide/i.test(value.label));
    assert.ok(step?.done);
    assert.ok(step.text.includes(name));
    const description = `${step.label} ${step.text}`;
    assert.match(description, /copied|snapshot/i);
    assert.match(description, /not.*live|does not.*follow|do not.*follow|do not.*update|not.*follow|not.*track/i);
  }
  const unsupported = loftCommand.steps?.(ctx, { smooth: 'no', guide: objectId(doc, 'rational') }) ?? [];
  assert.ok(unsupported.some(step => !step.done && /weight|rational/i.test(step.text)));
  assert.equal(JSON.stringify(doc), before);
});

test('a deleted guide or invalid saved choice is refused without falling back to None or another imported curve', () => {
  const original = document(), id = objectId(original, 'cubic'), originalBefore = JSON.stringify(original);
  // Remove an object from a copy of an existing public-API document, as a deletion changes its object list.
  const deleted = structuredClone(original);
  deleted.direct!.objects = deleted.direct!.objects.filter(value => value.id !== id);
  for (const [doc, choice] of [[deleted, id], [original, 'not-an-imported-object']] as const) {
    const before = JSON.stringify(doc), ctx = context(doc), result = copyLoftGuide(doc, choice);
    assert.ok(!result.ok); assert.match(result.reason, /no longer|missing|not.*document/i);
    assert.throws(() => build(ctx, { smooth: 'no', guide: choice }), /no longer|missing|not.*document/i);
    const field = loftCommand.fields?.(ctx, { smooth: 'no', guide: choice }).find(value => value.key === 'guide');
    assert.ok(field?.kind === 'choice' && !field.options.some(option => option.value === choice));
    assert.ok(field.unknown);
    assert.match(field.unknown(choice), /no longer|missing|not.*document/i);
    const steps = loftCommand.steps?.(ctx, { smooth: 'no', guide: choice }) ?? [];
    assert.ok(steps.some(step => !step.done && /no longer|missing|not.*document/i.test(step.text)));
    assert.equal(JSON.stringify(doc), before);
  }
  assert.equal(JSON.stringify(original), originalBefore);
});
