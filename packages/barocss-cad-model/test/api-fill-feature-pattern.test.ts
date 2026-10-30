import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep } from '@barocss/cad';
import { part, param, Location, type StudioPart, type FillFeaturePatternRegion } from '../src/api';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { evaluatedPart, WireSender, WireReceiver } from '../src/engine/wireDoc';
import { readStudioDoc } from '../src/engine/migrate';
import { eligibleFillPatternRegions, fillRegionSnapshot, fillPatternDocumentProblem } from '../src/engine/fillFeaturePattern';
import { bindParameter } from '../src/engine/parameters';
import { editFields } from '../src/app/editFields';
import { commandById, type Ctx } from '../src/app/commands';
import { checkNode } from '../src/chat/features';
import { emptyDoc, withNode } from '../src/engine/doc';
import { flattenAssembly } from '../src/engine/flatten';
import { addPart } from '../src/assembly/edit';
import { runTool } from '../src/chat/tools';

// Independent oracle: /tmp/d335-plan/independent-oracle.json. Ten disjoint 3×5×10 cuts.
const region: FillFeaturePatternRegion = { points: [[4, 4], [52, 4], [52, 20], [28, 20], [28, 36], [4, 36]] };
const options = () => ({ region: structuredClone(region), anchor: [8.5, 8.5] as const, spacing: param('sx'), count: 4, spacing2: param('sy'), count2: 3 });
const source = () => part('L mask').parameter('sx', 12).parameter('sy', 10).parameter('copies', 4).parameter('seedX', 7).parameter('toolWidth', 3)
  .box({ w: 60, d: 40, h: 10 }).subtract(p => p.box({ w: 3, d: 5, h: 10, x: 0, y: 6 }).moved(Location.at([7, 0, 0])));
const baseCells = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2]] as const;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
function geometry(p: StudioPart, cells: readonly (readonly [number, number])[], volume: number, centroid: readonly number[], sy = 10, width = 3, seedX = 7) {
  const mass = p.mass({ density: 1 }); close(mass.volume, volume); mass.centroid.forEach((v, k) => close(v, centroid[k]));
  const exact = partBreps(p.doc); assert.equal(exact.length, 1);
  const brep = exact[0].brep; assert.equal(brep.bodies.length, 1); assert.equal(brep.bodies[0].kind, 'solid'); assert.ok(brep.shells.every(s => s.closed));
  const report = checkBrep(brep); assert.equal(report.valid, true, report.issues.join('\n'));
  for (const [i, j] of cells) for (const dx of [0, width]) for (const dy of [0, 5]) for (const z of [0, 10]) {
    const point = [seedX + i * 12 + dx, 6 + j * sy + dy, z];
    assert.ok(brep.vertices.some(v => point.every((c, k) => Math.abs(c - v.point[k]) <= 1e-9)), `missing ${point}`);
  }
  const names = p.select().faces().names(); assert.equal(new Set(names).size, names.length);
  for (const [i, j] of cells) if (i || j) for (let side = 0; side < 4; side++) assert.ok(names.some(n => n.endsWith(`.side${side}@${i},${j}`)), `missing side ${side}@${i},${j}`);
  for (const [i, j] of [[2, 2], [3, 2]]) assert.ok(!names.some(n => n.includes(`@${i},${j}`)));
  return names;
}
function sketchDoc() {
  const doc = withNode(source().doc, { kind: 'sketch', profile: 'polygon', points: region.points.map(p => [p[0], p[1]]) });
  return { doc, index: doc.nodes.length - 1 };
}

test('fill API uses exact inline snapshot, original CUT history, both spacing bindings and independent mass/cell/name oracle', () => {
  const seed = source(), before = seed.doc, input = options(), accepted = seed.fillFeaturePattern(input), doc = accepted.doc, node = doc.nodes.at(-1);
  assert.ok(node?.kind === 'fill-feature-pattern'); assert.deepEqual(node.spacing, { parameter: 'sx' }); assert.deepEqual(node.spacing2, { parameter: 'sy' });
  assert.deepEqual(doc.nodes.slice(0, -1), before.nodes); assert.deepEqual(node.anchor, [8.5, 8.5]);
  geometry(accepted, baseCells, 22500, [4559 / 150, 607 / 30, 5]);
  geometry(accepted.withParameters({ sy: 12 }), baseCells.filter(([i, j]) => j === 0 || i < 2), 22800, [61 / 2, 765 / 38, 5], 12);
  geometry(seed.fillFeaturePattern({ ...options(), region: { points: [...region.points].reverse() } }), baseCells, 22500, [4559 / 150, 607 / 30, 5]);
  (input.region.points as [number, number][])[0] = [99, 99]; assert.deepEqual(accepted.doc, doc); assert.deepEqual(seed.doc, before);
  for (const key of ['count', 'count2', 'anchorX', 'anchorY']) assert.throws(() => bindParameter(doc, { feature: doc.nodes.length - 1, value: key, parameter: 'copies' }), /PARAMETER_UNBINDABLE/);
  for (const key of ['count', 'count2']) assert.throws(() => seed.fillFeaturePattern({ ...options(), [key]: param('copies') }), /PARAMETER_UNBINDABLE/);
  const bound = bindParameter(doc, { feature: doc.nodes.length - 1, value: 'spacing2', parameter: 'sy' }); assert.deepEqual(bound.nodes.at(-1), node);
});

test('snapshot source edits stay independent; editor reselect captures new region and chat edits retain feature identity', async () => {
  const { doc, index } = sketchDoc(), snapshot = fillRegionSnapshot(doc, index), accepted = part('snapshot', doc).fillFeaturePattern({ ...options(), region: snapshot }).doc;
  assert.deepEqual(eligibleFillPatternRegions(doc).find(c => c.value === String(index)), { value: String(index), label: `Sketch ${index + 1} (snapshot)` });
  const edited = structuredClone(accepted), sk = edited.nodes[index]; assert.ok(sk.kind === 'sketch' && sk.profile === 'polygon'); sk.points[3][0] = 16; sk.points[4][0] = 16;
  geometry(part('independent', edited), baseCells, 22500, [4559 / 150, 607 / 30, 5]);
  const fields = editFields(edited.nodes, edited.nodes.length - 1, edited.parameters), choice = fields.find(f => f.key === 'region');
  assert.ok(choice?.kind === 'choice'); assert.equal(choice.label, 'Region snapshot'); assert.equal(choice.get(edited.nodes), ''); assert.equal(choice.options[0].label, 'Current region snapshot');
  const replaced = { ...edited, nodes: choice.set(edited.nodes, String(index)) };
  geometry(part('reselected', replaced), baseCells.filter(([i, j]) => j !== 2 || i === 0), 22650, [9159 / 302, 6127 / 302, 5]);
  const evaluate = async (candidate: typeof doc) => evaluateDoc(candidate, 1), initial = await evaluate(edited); assert.ok(initial.ok);
  const result = await runTool({ doc: edited, bodies: initial.bodies }, 'edit_feature', { index: edited.nodes.length - 1, values: { region: String(index) } }, evaluate);
  assert.ok(!result.isError, result.content); assert.equal(result.state.doc.nodes.at(-1)!.id, accepted.nodes.at(-1)!.id);
  geometry(part('chat snapshot', result.state.doc), baseCells.filter(([i, j]) => j !== 2 || i === 0), 22650, [9159 / 302, 6127 / 302, 5]);
});

test('snapshot native file, wire, nested and placed document roundtrips preserve authored data and names', async () => {
  const accepted = source().fillFeaturePattern(options()), doc = accepted.doc, names = accepted.select().faces().names().sort();
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, doc);
  assert.deepEqual(part('native', opened.doc).select().faces().names().sort(), names);
  const sender = new WireSender(), receiver = new WireReceiver(), wired = receiver.unpack(sender.pack(doc)); sender.dispose(); assert.deepEqual(evaluatedPart(wired), evaluatedPart(doc));
  geometry(part('wire', wired), baseCells, 22500, [4559 / 150, 607 / 30, 5]);
  assert.equal(fillPatternDocumentProblem({ nodes: [], parameters: {}, pendingParts: { x: { doc } } }), null);
  const assembly = addPart(emptyDoc(), { name: 'inline', doc }).doc; assert.ok(assembly.instances?.length === 1);
  assert.equal(fillPatternDocumentProblem(assembly), null);
  geometry(part('flattened', flattenAssembly(doc)), baseCells, 22500, [4559 / 150, 607 / 30, 5]);
});

test('fill real command accepts body-only CUT selection, copies snapshot and rejects invalid edits atomically', () => {
  const { doc, index } = sketchDoc(), result = evaluateDoc(doc, 1); assert.ok(result.ok, result.ok ? '' : result.error.detail);
  const ctx: Ctx = { doc, bodies: result.bodies, selection: { faces: [], edges: [], bodies: [0] } }, before = structuredClone(ctx), cmd = commandById('fill-feature-pattern')!;
  const values = { region: String(index), anchorX: 8.5, anchorY: 8.5, spacing: 12, count: 4, spacing2: 10, count2: 3 };
  assert.equal(cmd.available(ctx).ok, true); assert.equal(cmd.fields!(ctx)[0].label, 'Region snapshot');
  const made = cmd.build!(ctx, values); geometry(part('command fill', made), baseCells, 22500, [4559 / 150, 607 / 30, 5]);
  for (const edit of [{ count: 33, count2: 2 }, { spacing: 0 }, { anchorX: NaN }, { region: '' }, { region: '-1' }, { count2: 1.5 }]) assert.throws(() => cmd.build!(ctx, { ...values, ...edit }));
  for (const bad of [{ ...ctx, direct: ['x'] }, { ...ctx, selection: { faces: [], edges: [], bodies: [] } }]) { assert.equal(cmd.available(bad).ok, false); assert.throws(() => cmd.build!(bad, values)); }
  assert.deepEqual(ctx, before);
});

test('native and chat admission reject malformed, suppressed and nested recipes without changing accepted document', () => {
  const doc = source().fillFeaturePattern(options()).doc, before = structuredClone(doc), index = doc.nodes.length - 1;
  const badRegions = [{ ...region, holes: [] }, { objectId: 'live' }, { points: [[0, 0], [1, 1], [0, 1], [1, 0]] }, { points: [[0, 0], [1, 0], [0, 0]] }, { points: [[0, 0], [1, 0], [0, NaN]] }];
  for (const change of [...badRegions.map(region => ({ region })), { anchor: [8.5, 8.5, 0] }, { anchor: [param('sx'), 0] }, { count: param('copies') }, { count: 33, count2: 2 }, { spacing2: -1 }, { unexpected: true }]) {
    const bad = structuredClone(doc); bad.nodes[index] = { ...bad.nodes[index], ...change } as typeof bad.nodes[number];
    assert.ok(fillPatternDocumentProblem(bad)); assert.ok(checkNode(bad.nodes[index], bad.nodes.slice(0, index), bad.parameters));
    assert.ok('error' in readStudioDoc(JSON.stringify(bad))); assert.throws(() => part('bad', bad));
    bad.nodes[index].suppressed = true; assert.ok(fillPatternDocumentProblem(bad));
    assert.ok(fillPatternDocumentProblem({ nodes: [], parameters: {}, instances: [{ doc: bad }] }));
    assert.ok(fillPatternDocumentProblem({ nodes: [], parameters: {}, pendingParts: { x: { doc: bad } } }));
    assert.throws(() => addPart(emptyDoc(), { name: 'malformed', doc: bad }));
    assert.throws(() => flattenAssembly(bad));
  }
  const suppressed = structuredClone(doc); suppressed.nodes[index - 1].suppressed = true; assert.ok(fillPatternDocumentProblem(suppressed));
  const consumed = structuredClone(doc); consumed.nodes.push({ kind: 'translate', parent: { node: index, side: 'solid' }, offset: [1, 0, 0] });
  consumed.nodes.push({ ...structuredClone(doc.nodes[index]), parent: { node: index - 1, side: 'solid' } } as typeof doc.nodes[number]); assert.ok(fillPatternDocumentProblem(consumed));
  assert.deepEqual(doc, before);
});

test('count one and no admitted extras retain original source; source tool size and position parameters still recompute', () => {
  const seed = source(), names = seed.select().faces().names().sort();
  for (const opt of [{ ...options(), count: 1, count2: 1 }, { ...options(), anchor: [1000, 1000] as const }]) {
    const p = seed.fillFeaturePattern(opt); geometry(p, [[0, 0]], 23850, [9583 / 318, 6383 / 318, 5]); assert.deepEqual(p.select().faces().names().sort(), names);
  }
  const doc = source().doc, translation = doc.nodes.findIndex(n => n.kind === 'translate'), tool = doc.nodes.findIndex((n, i) => n.kind === 'extrude' && i > 1);
  assert.ok(translation >= 0 && tool >= 0);
  const toolNode = doc.nodes[tool]; assert.ok(toolNode.kind === 'extrude');
  let bound = bindParameter(doc, { feature: translation, value: 'o0', parameter: 'seedX' });
  bound = bindParameter(bound, { feature: tool, value: 'w', parameter: 'toolWidth' });
  const p = part('source bound', bound).fillFeaturePattern(options());
  const moved = p.withParameters({ seedX: 8 }); geometry(moved, baseCells, 22500, [(24000 * 30 - 1500 * 25.1) / 22500, 607 / 30, 5], 10, 3, 8);
  const sized = p.withParameters({ toolWidth: 2 }); geometry(sized, baseCells, 23000, [(24000 * 30 - 1000 * 23.6) / 23000, (24000 * 20 - 1000 * 16.5) / 23000, 5], 10, 2);
  const node = moved.doc.nodes.at(-1); assert.ok(node?.kind === 'fill-feature-pattern'); assert.deepEqual(node.anchor, [8.5, 8.5]);
});


test('snapshot picker admits solved GUI line outlines and resolved coordinates while refusing unsupported profiles', () => {
  const { doc, index } = sketchDoc(), node = doc.nodes[index]; assert.ok(node.kind === 'sketch' && node.profile === 'polygon');
  node.outline = { points: region.points.map(p => [p[0], p[1]]), hv: { h: [0, 2, 4], v: [1, 3, 5] } };
  node.plane = { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] };
  assert.deepEqual(fillRegionSnapshot(doc, index), region);
  node.points[0][0] = { parameter: 'edgeX' }; doc.parameters.edgeX = 4; assert.deepEqual(fillRegionSnapshot(doc, index), region);
  const original = structuredClone(doc);
  for (const patch of [{ plane: { origin: [], normal: [], xAxis: [] } }, { plane: { origin: [0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { plane: { origin: new Array(3), normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { plane: { origin: [0, 0, 0], normal: [0, 0, 1, 0], xAxis: [1, 0, 0] } }, { plane: { origin: [0, 0, NaN], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { holes: {} }, { regions: {} }, { holes: [[{ kind: 'line', start: [0, 0] }]] }, { regions: [[{ kind: 'line', start: [0, 0] }]] }, { plane: { origin: [0, 0, 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { profile: 'circle', center: [0, 0], radius: 3 }, { profile: 'loop', segments: [{ kind: 'arc', start: [0, 0], center: [1, 1], direction: 'ccw' }] }]) {
    const bad = structuredClone(original); bad.nodes[index] = { ...bad.nodes[index], ...patch } as typeof node;
    assert.throws(() => fillRegionSnapshot(bad, index)); assert.ok(!eligibleFillPatternRegions(bad).some(c => c.value === String(index)));
  }
  delete doc.parameters.edgeX; assert.throws(() => fillRegionSnapshot(doc, index));
});


test('an empty original tool retains stock and one-cell recipes still validate source activity', () => {
  const doc = source().doc, seed = doc.nodes.pop(); assert.ok(seed?.kind === 'difference');
  const empty = doc.nodes.length;
  doc.nodes.push({ kind: 'difference', parent: seed.tool, tool: seed.tool, id: 'emptyTool' });
  doc.nodes.push({ ...seed, tool: { node: empty, side: 'solid' } });
  const p = part('empty original tool', doc), accepted = p.fillFeaturePattern(options());
  close(accepted.mass({ density: 1 }).volume, 24000); assert.deepEqual(accepted.select().faces().names(), p.select().faces().names());
  const invalid = accepted.doc, last = invalid.nodes.at(-1); assert.ok(last?.kind === 'fill-feature-pattern');
  last.count = 1; last.count2 = 1; invalid.nodes[last.parent.node].suppressed = true;
  assert.throws(() => part('invalid one cell', invalid));
});
