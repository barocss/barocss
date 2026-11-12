import assert from 'node:assert/strict';
import test from 'node:test';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { commands, patchValues, type Ctx } from '../src/app/commands';
import { editCommand, featureOfPick } from '../src/app/editCommand';
import { editFields } from '../src/app/editFields';
import { runTool, type ChatState } from '../src/chat/tools';
import { rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { convertLinearPatternDistance } from '../src/engine/linearSpanPattern';
import { readStudioDoc } from '../src/engine/migrate';
import { toPartDocument } from '../src/engine/part';

const seed = rectanglePart(10, 6, 8);
const parent = { node: 1, side: 'solid' } as const;
const recipe = { kind: 'linear-span-pattern', parent, axis: 'x', span: 90, count: 4 } as const;

test('fixed span lowers to the same native feature, geometry and names as its derived pitch', () => {
  for (const [axis, span, count, spacing] of [
    ['x', 90, 4, 30],
    ['x', 90, 6, 18],
    ['y', 25, 3, 12.5],
    ['z', 100, 7, 100 / 6],
  ] as const) {
    const fixed = withNode(seed, { ...recipe, axis, span, count });
    const legacy = withNode(seed, { kind: 'linear-pattern', parent, axis, count, spacing });
    const compiled = toPartDocument(fixed), same = toPartDocument(legacy);
    assert.deepEqual(compiled, same);
    const [body] = evaluateCadPart(compiled).outputs;
    const [control] = evaluateCadPart(same).outputs;
    assert.ok(checkOutput(body).valid);
    assert.equal(body.bodyCount, count);
    assert.deepEqual(body.brep, control.brep);
    assert.ok(Math.abs(massPropertiesOf(body).volume - 480 * count) < 1e-8);
    const opened = readStudioDoc(JSON.stringify(fixed));
    assert.ok('doc' in opened);
    assert.deepEqual(opened.doc, fixed);
  }
});

test('fixed span rejects malformed authority, values and references before read or evaluation', () => {
  for (const [patch, expected] of [
    [{ spacing: 30 }, /unknown field/i],
    [{ count: 1 }, /whole-number Count/i],
    [{ count: 2.5 }, /whole-number Count/i],
    [{ count: 65 }, /whole-number Count/i],
    [{ count: { parameter: 'p' } }, /whole-number Count/i],
    [{ span: 0 }, /finite positive/i],
    [{ span: -1 }, /finite positive/i],
    [{ span: Infinity }, /finite positive/i],
    [{ span: { parameter: 'p' } }, /finite positive/i],
    [{ span: Number.MIN_VALUE, count: 6 }, /Derived spacing/i],
    [{ span: 20001, count: 3 }, /Derived spacing/i],
    [{ axis: 'u' }, /direction X, Y or Z/i],
    [{ parent: { node: 2, side: 'solid' } }, /preceding body/i],
    [{ parent: { node: 1, side: 'near' } }, /preceding body/i],
  ] as const) {
    const fixed = withNode(seed, recipe);
    const bad = { ...fixed, nodes: [...fixed.nodes.slice(0, 2), { ...fixed.nodes[2], ...patch, suppressed: true } as ModelNode] };
    const opened = readStudioDoc(JSON.stringify(bad));
    assert.ok('error' in opened);
    assert.match(opened.error, expected);
    assert.throws(() => toPartDocument(bad), expected);
  }
  const max = withNode(seed, { ...recipe, span: 630000, count: 64 });
  const [compiled] = toPartDocument(max).features.slice(-1);
  assert.ok(compiled.kind === 'linear-pattern');
  assert.equal(compiled.spacing, 10000);
  const nested = { ...seed, instances: [{ doc: withNode(seed, { ...recipe, span: -1 }) }] } as StudioDoc;
  assert.throws(() => toPartDocument(nested), /finite positive/i);
});

test('fixed-span editor changes count without binding it and keeps copy picks out of seed editing', () => {
  const fixed = withNode(seed, recipe);
  const fields = editFields(fixed.nodes, 2, { p: 90 });
  const count = fields.find(field => field.key === 'count');
  const span = fields.find(field => field.key === 'span');
  assert.ok(count?.kind === 'number' && span?.kind === 'number');
  assert.ok(!('bind' in count) && !('bind' in span));
  const nodes = count.set(fixed.nodes, 6);
  assert.deepEqual(nodes[2], { ...fixed.nodes[2], count: 6 });
  const result = evaluateDoc({ ...fixed, nodes }, 1);
  assert.ok(result.ok);
  const context: Ctx = { doc: { ...fixed, nodes }, bodies: result.bodies, selection: { faces: [], edges: [], bodies: [0] } };
  const edit = editCommand(2, nodes)!;
  const handles = edit.handles!(context, edit.defaults!(context));
  assert.deepEqual(handles.map(handle => [handle.key, handle.at[0], handle.screenOffset]), [['span', 95, undefined], ['count', 100, 16]]);
  assert.equal(handles[1].scale, 1 / 18);
  const face = result.bodies[0].mesh.faces.find(face => face.name.startsWith('n1.') && face.name.includes('@1'));
  assert.ok(face);
  assert.equal(featureOfPick({ faces: [{ body: 0, face: face.index }], edges: [], bodies: [] }, result.bodies, nodes), null);
});

test('linear pattern creation switches authority while keeping the current placement', () => {
  const result = evaluateDoc(seed, 1);
  assert.ok(result.ok);
  const ctx: Ctx = { doc: seed, bodies: result.bodies, selection: { faces: [], edges: [], bodies: [0] } };
  const linear = commands.find(command => command.id === 'linear-pattern')!;
  const initial = { ...linear.defaults!(ctx), spacing: 30, count: 4 };
  const fixed = patchValues(linear, ctx, initial, { distanceMode: 'span' });
  assert.equal(fixed.span, 90);
  assert.deepEqual(toPartDocument(linear.build!(ctx, fixed)), toPartDocument(linear.build!(ctx, initial)));
  const denser = patchValues(linear, ctx, fixed, { count: 6 });
  const created = linear.build!(ctx, denser);
  assert.deepEqual(created.nodes[2], { ...recipe, count: 6, id: 'n2' });
  const handles = linear.handles!(ctx, denser);
  assert.deepEqual(handles.map(handle => [handle.key, handle.at[0]]), [['span', 95], ['count', 100]]);
  assert.equal(handles[1].scale, 1 / 18);
  const back = patchValues(linear, ctx, denser, { distanceMode: 'spacing' });
  assert.equal(back.spacing, 18);
  assert.deepEqual(toPartDocument(linear.build!(ctx, back)), toPartDocument(created));
  const separate = patchValues(linear, ctx, denser, { result: 'separate' });
  assert.equal(separate.distanceMode, 'spacing');
  assert.equal(separate.spacing, 18);
  assert.throws(() => linear.build!(ctx, { ...denser, result: 'separate' }), /requires One body/);
  assert.throws(() => linear.build!(ctx, { ...denser, count: 25 }), /whole-number Count from 2 to 24/);
});

test('the existing agent command can author the same fixed-span feature', async () => {
  const result = evaluateDoc(seed, 1);
  assert.ok(result.ok);
  const state: ChatState = { doc: seed, bodies: result.bodies };
  const previous = process.env.CAD_AUTONOMY;
  process.env.CAD_AUTONOMY = '3';
  try {
    const response = await runTool(state, 'run_command', { command: 'linear-pattern', bodies: ['b1'], values: { distanceMode: 'span', span: 90, count: 4 } }, async doc => evaluateDoc(doc, 1));
    assert.equal(response.isError, false, response.summary);
    assert.deepEqual(response.state.doc.nodes[2], { ...recipe, id: 'n2' });
  } finally {
    if (previous === undefined) delete process.env.CAD_AUTONOMY;
    else process.env.CAD_AUTONOMY = previous;
  }
});

test('history conversion keeps native placement and refuses to detach a named spacing', () => {
  const legacy = { kind: 'linear-pattern', parent, axis: 'x', count: 4, spacing: 30, id: 'n2', bought: true } as const;
  const converted = convertLinearPatternDistance(legacy, 'span', 2);
  assert.ok('node' in converted);
  assert.deepEqual(converted.node, { ...recipe, id: 'n2', bought: true });
  assert.deepEqual(toPartDocument(withNode(seed, converted.node)), toPartDocument(withNode(seed, legacy)));
  const six = { ...recipe, count: 6, id: 'n2', bought: true };
  const back = convertLinearPatternDistance(six, 'spacing', 2);
  assert.ok('node' in back);
  assert.deepEqual(back.node, { ...legacy, count: 6, spacing: 18 });
  assert.deepEqual(toPartDocument(withNode(seed, back.node)), toPartDocument(withNode(seed, six)));
  for (const [patch, expected] of [
    [{ spacing: { parameter: 'pitch' } }, /Unbind Spacing/i],
    [{ spacing: -30 }, /finite positive/i],
    [{ count: 1 }, /whole-number Count/i],
  ] as const) {
    const refused = convertLinearPatternDistance({ ...legacy, ...patch }, 'span', 2);
    assert.ok('message' in refused);
    assert.match(refused.message, expected);
  }
});
