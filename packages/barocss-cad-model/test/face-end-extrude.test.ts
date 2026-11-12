import assert from 'node:assert/strict';
import test from 'node:test';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { patchValues, shownFields, type Ctx } from '../src/app/commands';
import { extrudeCommand } from '../src/app/profileCommands';
import { evaluateDoc } from '../src/engine/evaluate';
import { bodyNodes, duplicateBody, moveFeature, renumber } from '../src/chat/features';
import { parentsOf, prefixDoc, usesOf, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { toPartDocument } from '../src/engine/part';

const recipe = {
  id: 'n3', kind: 'face-end-extrude', sketch: 2,
  target: { body: { node: 1, side: 'solid' }, feature: 'n1', face: 'n1.bottom' },
} as const;
const documentAt = (from: number): StudioDoc => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-5, -5], max: [15, 15] },
    { id: 'n1', kind: 'extrude', sketch: 0, from, height: 5 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    recipe,
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
});

test('a named native end face changes only the derived height on a target edit', () => {
  for (const from of [20, 30, 40]) {
    const doc = documentAt(from);
    const opened = readStudioDoc(JSON.stringify(doc));
    assert.ok('doc' in opened);
    assert.deepEqual(opened.doc, doc);
    const part = toPartDocument(doc);
    assert.deepEqual(part.features[3], { id: 'n3', kind: 'extrude', sketch: 'n2', height: from });
    const results = evaluateCadPart(part).outputs;
    assert.deepEqual(results.map(output => output.id), ['n1', 'n3']);
    for (const [index, bottom, top, volume] of [[0, from, from + 5, 2000], [1, 0, from, 100 * from]]) {
      const output = results[index];
      assert.ok(checkOutput(output).valid);
      assert.equal(output.brep.vertices.length, 8);
      assert.deepEqual([...new Set(output.brep.vertices.map(vertex => vertex.point[2]))].sort((a, b) => a - b), [bottom, top]);
      assert.ok(Math.abs(massPropertiesOf(output).volume - volume) < 1e-8);
    }
  }
});

test('a saved target is one current exact rectangular cap that contains the source', () => {
  const base = documentAt(20);
  const edited = (index: number, next: ModelNode) => ({ ...base, nodes: base.nodes.map((node, i) => i === index ? next : node) });
  const targetSketch = base.nodes[0];
  assert.ok(targetSketch.kind === 'sketch' && targetSketch.profile === 'rectangle');
  assert.throws(() => toPartDocument(edited(0, { ...targetSketch, max: [3, 15] })), /entire projected profile/i);
  assert.throws(() => toPartDocument(documentAt(0)), /positive Z/i);
  assert.throws(() => toPartDocument(documentAt(-20)), /positive Z/i);
  assert.throws(() => toPartDocument(edited(3, { ...recipe, target: { ...recipe.target, face: 'n1.unknown' } })), /missing or ambiguous/i);
  assert.throws(() => toPartDocument(edited(3, { ...recipe, target: { ...recipe.target, face: 'n1.top' } })), /face down/i);
  assert.throws(() => toPartDocument(edited(3, { ...recipe, target: { ...recipe.target, face: 'n1.side0' } })), /horizontal plane/i);
  assert.throws(() => toPartDocument(edited(1, { ...base.nodes[1], suppressed: true })), /missing or suppressed/i);
  const consumed: StudioDoc = { ...base, nodes: [...base.nodes.slice(0, 3),
    { id: 'n4', kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [0, 0, 5] }, recipe], nextId: 5 };
  assert.throws(() => toPartDocument(consumed), /one current exact solid/i);
  const source = base.nodes[2];
  assert.ok(source.kind === 'sketch' && source.profile === 'rectangle');
  assert.throws(() => toPartDocument(edited(2, { ...source, min: [{ parameter: 'p' }, 0] })), /literal rectangle/i);
});

test('saved recipes refuse ambiguous identity and a second authored height', () => {
  const base = documentAt(20);
  for (const [node, expected] of [
    [{ ...recipe, height: 20 }, /unknown field/i],
    [{ ...recipe, target: { ...recipe.target, feature: 'n4' } }, /feature identity/i],
    [{ ...recipe, target: { ...recipe.target, body: { node: 3, side: 'solid' } } }, /preceding solid/i],
    [{ ...recipe, target: { ...recipe.target, face: 'n1.bottom+n1.top' } }, /persistent native face name/i],
  ] as const) {
    const doc = { ...base, nodes: [...base.nodes.slice(0, 3), node] };
    const opened = readStudioDoc(JSON.stringify(doc));
    assert.ok('error' in opened);
    assert.match(opened.error, expected);
    assert.throws(() => toPartDocument(doc), expected);
  }
  const duplicatedId = { ...base, nodes: [base.nodes[0], base.nodes[1], { ...base.nodes[2], id: 'n1' }, recipe] };
  assert.throws(() => toPartDocument(duplicatedId), /ambiguous/i);
});

test('the target is a history dependency and stays outside the new body ownership chain', () => {
  const doc = documentAt(20);
  assert.deepEqual(parentsOf(recipe), [2]);
  assert.deepEqual(usesOf(recipe), [2, 1]);
  assert.deepEqual(bodyNodes(doc.nodes, 3), [3, 2]);
  assert.deepEqual(prefixDoc(doc, 4).outputs, doc.outputs);
  assert.deepEqual(renumber(recipe, index => index + 2), { ...recipe, sketch: 4, target: { ...recipe.target, body: { node: 3, side: 'solid' } } });
  const moved = moveFeature(doc, 1, 1);
  assert.ok('error' in moved);
  assert.match(moved.error, /cannot come first/i);
  assert.throws(() => duplicateBody(doc, { node: 3, side: 'solid' }, [5, 0, 0]), /duplicating a body with a bound end face/i);
});

test('the Extrude command binds a picked native cap and resets the pick when depth mode changes', () => {
  const doc = { ...prefixDoc(documentAt(20), 3), nextId: 3 };
  const evaluated = evaluateDoc(doc, 0);
  assert.ok(evaluated.ok);
  const ctx: Ctx = { doc, viewportEndFace: true, bodies: evaluated.bodies, selection: { sketches: [2], faces: [], edges: [], bodies: [] } };
  const cmd = extrudeCommand, defaults = cmd.defaults!(ctx);
  const depth = cmd.fields!(ctx).find(field => field.key === 'depth');
  assert.ok(depth?.kind === 'choice');
  assert.deepEqual(depth.options.map(option => option.value), ['distance', 'to-face']);
  const withoutViewport: Ctx = { doc, bodies: ctx.bodies, selection: ctx.selection };
  assert.deepEqual(cmd.fields!(withoutViewport).map(field => field.key), ['h', 'draft']);
  assert.deepEqual(cmd.fields!({ ...ctx, bodies: [] }).map(field => field.key), ['h', 'draft']);
  const legacy = cmd.build!(ctx, { ...defaults, h: 11, draft: 3 });
  assert.deepEqual(legacy.nodes[3], { id: 'n3', kind: 'extrude', sketch: 2, height: 11, draft: 3 });
  assert.equal(cmd.handles!(ctx, defaults).length, 1);

  const targetMode = patchValues(cmd, ctx, { ...defaults, h: 11, draft: 3 }, { depth: 'to-face' });
  assert.deepEqual(shownFields(cmd.fields!(ctx), targetMode).map(field => field.key), ['depth']);
  assert.deepEqual(cmd.handles!(ctx, targetMode), []);
  assert.throws(() => cmd.build!(ctx, targetMode), /original planar face/i);
  const bottom = ctx.bodies[0].mesh.faces.find(face => face.name === 'n1.bottom')!;
  const picked = cmd.onPick!(ctx, targetMode, { face: { body: 0, face: bottom.index }, edge: null });
  assert.ok(picked && !('error' in picked));
  const bound = cmd.build!(ctx, picked);
  assert.deepEqual(bound.nodes[3], recipe);
  assert.deepEqual(bound.outputs, documentAt(20).outputs);
  assert.throws(() => cmd.build!(ctx, { ...picked, op: 'cut' }), /new body/i);

  const back = patchValues(cmd, ctx, picked, { depth: 'distance' });
  assert.equal(back.endBody, undefined);
  assert.equal(back.endFace, undefined);
  assert.deepEqual(cmd.build!(ctx, back), legacy);

  const face = { body: 0, face: bottom.index };
  const attached: Ctx = { ...ctx, selection: { faces: [face], edges: [], bodies: [] } };
  const attachedDepth = cmd.fields!(attached).find(field => field.key === 'depth');
  assert.ok(attachedDepth?.kind === 'choice');
  assert.deepEqual(attachedDepth.options.map(option => option.value), ['distance', 'through']);
  assert.throws(() => cmd.build!(attached, picked), /finished XY rectangle/i);
});
