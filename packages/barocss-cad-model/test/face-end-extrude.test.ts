import assert from 'node:assert/strict';
import test from 'node:test';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { patchValues, shownFields, type Ctx } from '../src/app/commands';
import { extrudeCommand } from '../src/app/profileCommands';
import { evaluateDoc } from '../src/engine/evaluate';
import { bodyNodes, duplicateBody, moveFeature, renumber } from '../src/chat/features';
import { parentsOf, prefixDoc, usesOf, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { currentFaceEndDistance, toPartDocument } from '../src/engine/part';
import { detachFaceEndExtrude } from '../src/engine/faceEndExtrude';

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

test('detaching keeps the exact current distance and the feature identity used by later nodes', () => {
  const base = documentAt(30), downstream = {
    id: 'n4', kind: 'translate', parent: { node: 3, side: 'solid' }, offset: [0, 0, 12],
  } as const;
  const bound: StudioDoc = {
    ...base, nodes: [...base.nodes, { ...downstream, offset: [...downstream.offset] }],
    outputs: { b1: base.outputs.b1, b4: { node: 4, side: 'solid' } }, nextId: 5,
  };
  assert.equal(currentFaceEndDistance(bound, 3), 30);
  assert.throws(() => currentFaceEndDistance(bound, 4), /active Extrude to face/i);
  assert.throws(() => currentFaceEndDistance(documentAt(-20), 3), /positive Z/i);
  assert.throws(() => detachFaceEndExtrude(recipe, NaN), /current exact distance/i);
  assert.throws(() => detachFaceEndExtrude(recipe, 0), /current exact distance/i);
  assert.throws(() => detachFaceEndExtrude({ ...recipe, suppressed: true }, 30), /current exact distance/i);
  const detached = detachFaceEndExtrude({ ...recipe, bought: false, held: 'old target' }, currentFaceEndDistance(bound, 3));
  assert.deepEqual(detached, { id: 'n3', kind: 'extrude', sketch: 2, height: 30, bought: false });
  assert.deepEqual(usesOf(detached), [2]);
  const replaced = { ...bound, nodes: bound.nodes.map((node, i) => i === 3 ? detached : node) };
  assert.deepEqual(toPartDocument(replaced), toPartDocument(bound));
  const moved = { ...replaced, nodes: replaced.nodes.map((node, i) => i === 1 && node.kind === 'extrude' ? { ...node, from: 40 } : node) };
  const part = toPartDocument(moved), outputs = evaluateCadPart(part).outputs;
  assert.deepEqual(part.features[3], { id: 'n3', kind: 'extrude', sketch: 'n2', height: 30 });
  assert.equal(outputs.find(output => output.id === 'n4')?.brep.vertices.length, 8);
  assert.ok(Math.abs(massPropertiesOf(outputs.find(output => output.id === 'n4')!).volume - 3000) < 1e-8);
});

function translatedDocument(origin: [number, number, number], travel: number): StudioDoc {
  const [x, y, z] = origin, doc = documentAt(z + travel);
  const [targetProfile, target, source] = doc.nodes;
  assert.ok(targetProfile.kind === 'sketch' && targetProfile.profile === 'rectangle');
  assert.ok(source.kind === 'sketch' && source.profile === 'rectangle');
  return {
    ...doc,
    nodes: [
      { ...targetProfile, min: [x - 5, y - 5], max: [x + 15, y + 15] }, target,
      { ...source, plane: { origin, normal: [0, 0, 1], xAxis: [1, 0, 0] } }, recipe,
    ],
  };
}

test('a common XY-plane translation preserves signed travel and the two native box oracles', () => {
  for (const origin of [[0, 0, 0], [12, -7, -100], [-25, 19, 15], [12, -7, -20]] as [number, number, number][]) {
    for (const travel of [20, 30]) {
      const [x, y, z] = origin, doc = translatedDocument(origin, travel), part = toPartDocument(doc);
      assert.deepEqual(part.features[3], { id: 'n3', kind: 'extrude', sketch: 'n2', height: travel });
      assert.equal(currentFaceEndDistance(doc, 3), travel);
      const { outputs } = evaluateCadPart(part);
      assert.deepEqual(outputs.map(output => output.id), ['n1', 'n3']);
      for (const [index, extent, lo, hi, volume, centerZ, cap, normalZ] of [
        [0, [-5, 15], travel, travel + 5, 2000, z + travel + 2.5, 'n1.bottom', -1],
        [1, [0, 10], 0, travel, 100 * travel, z + travel / 2, 'n3.top', 1],
      ] as const) {
        const output = outputs[index], mass = massPropertiesOf(output);
        assert.ok(checkOutput(output).valid);
        assert.equal(output.brep.faces.length, 6);
        assert.equal(output.brep.vertices.length, 8);
        const points = extent.flatMap(dx => extent.flatMap(dy => [lo, hi].map(dz => [x + dx, y + dy, z + dz])));
        assert.ok(points.every(point => output.brep.vertices.some(vertex => vertex.point.every((v, i) => v === point[i]))));
        const faces = output.brep.faces.filter(face => face.name === cap);
        assert.equal(faces.length, 1);
        const plane = faceGeometry(faces[0]);
        assert.ok(plane.kind === 'plane');
        assert.ok(Math.abs(plane.o[2] - (z + travel)) < 1e-8);
        assert.ok(Math.abs(plane.n[0]) < 1e-8 && Math.abs(plane.n[1]) < 1e-8 && Math.abs(plane.n[2] - normalZ) < 1e-8);
        assert.ok(Math.abs(mass.volume - volume) < 1e-8);
        assert.ok(mass.centroid.every((value, i) => Math.abs(value - [x + 5, y + 5, centerZ][i]) < 1e-8));
      }
    }
  }
});

test('the translated end uses world trim, exact raw axes and positive local travel', () => {
  const doc = translatedDocument([0, 0, 30], 20), source = doc.nodes[2];
  assert.ok(source.kind === 'sketch' && source.profile === 'rectangle' && source.plane);
  const plane = source.plane;
  const movedSource = (next: typeof plane) => ({ ...doc, nodes: doc.nodes.map((node, i) => i === 2 ? { ...source, plane: next } : node) });
  assert.throws(() => toPartDocument(movedSource({ ...plane, origin: [25, 0, 30] })), /entire projected profile/i);
  assert.throws(() => toPartDocument(movedSource({ ...plane, origin: [9998, 0, 30] })), /native coordinate range/i);
  assert.throws(() => toPartDocument(movedSource({ ...plane, origin: [10001, 0, 30] })), /translated XY plane/i);
  for (const next of [
    { ...plane, xAxis: [0, 1, 0] }, { ...plane, xAxis: [-1, 0, 0] }, { ...plane, xAxis: [2, 0, 0] },
    { ...plane, normal: [0, 0, -1] }, { ...plane, normal: [0, 1e-10, 1] },
  ] as (typeof plane)[]) assert.throws(() => toPartDocument(movedSource(next)), /translated XY plane/i);
  for (const travel of [0, -10, 1e-8]) assert.throws(() => toPartDocument(translatedDocument([0, 0, 30], travel)), /positive Z/i);
});

test('a fractional translated source reaches the native cap within the linear tolerance', () => {
  const origin: [number, number, number] = [12.125, -7.25, -73.4], travel = 23.7;
  const doc = translatedDocument(origin, travel), part = toPartDocument(doc);
  const lowered = part.features[3];
  assert.ok(lowered.kind === 'extrude' && typeof lowered.height === 'number');
  assert.ok(Math.abs(lowered.height - travel) <= 1e-7);
  assert.ok(Math.abs(origin[2] + lowered.height - (origin[2] + travel)) <= 1e-7);
  const { outputs } = evaluateCadPart(part);
  assert.ok(outputs.every(output => checkOutput(output).valid));
  const cap = (output: typeof outputs[number], name: string) => {
    const face = output.brep.faces.find(face => face.name === name)!;
    const plane = faceGeometry(face);
    assert.ok(plane.kind === 'plane');
    return plane.o[2];
  };
  assert.ok(Math.abs(cap(outputs[0], 'n1.bottom') - cap(outputs[1], 'n3.top')) <= 1e-7);
  assert.ok(Math.abs(massPropertiesOf(outputs[1]).volume - 100 * travel) < 1e-8);
});
