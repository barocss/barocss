import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep } from '@barocss/cad';
import { part, param, Location, type StudioPart, type FillFeaturePatternRegion } from '../src/api';
import { withNode, type StudioDoc, type SketchNode } from '../src/engine/doc';
import { fillRegionSnapshot, eligibleFillPatternRegions, fillPatternDocumentProblem } from '../src/engine/fillFeaturePattern';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { profileOf } from '../src/sketch/loops';
import type { SketchShape } from '../src/sketch/types';
import { commandById, type Ctx } from '../src/app/commands';
import { editFields } from '../src/app/editFields';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { WireSender, WireReceiver, evaluatedPart } from '../src/engine/wireDoc';
import { flattenAssembly } from '../src/engine/flatten';

type XY = readonly [number, number];
const outer: XY[] = [[4, 4], [52, 4], [52, 36], [4, 36]];
const holes: XY[][] = [[[20, 16], [34, 16], [34, 30], [20, 30]], [[42, 6], [46, 6], [44, 10]]];
const source = () => part('D345 reference mask').parameter('sx', 12).parameter('sy', 10).parameter('holeLeft', 20)
  .box({ w: 60, d: 40, h: 10 }).subtract(p => p.box({ w: 3, d: 5, h: 10, x: 0, y: 6 }).moved(Location.at([7, 0, 0])));
function authored() {
  const shapes: SketchShape[] = [{ kind: 'rectangle', a: [4, 4], b: [52, 36] }, { kind: 'rectangle', a: [20, 16], b: [34, 30] },
    { kind: 'polygon', points: [[42, 6], [46, 6], [44, 10]], closed: true }];
  const made = profileOf(shapes); assert.ok('node' in made, JSON.stringify(made)); assert.equal(made.node.holes?.length, 2);
  const doc = withNode(source().doc, made.node); return { doc, index: doc.nodes.length - 1 };
}
const options = (region: FillFeaturePatternRegion) => ({ region, anchor: [8, 8] as const, spacing: param('sx'), count: 4, spacing2: param('sy'), count2: 3 });
// Independent integer winding and material moments. No CAD mask or mass function supplies expectations.
function classification(ring: readonly XY[], p: XY): 'inside' | 'boundary' | 'outside' {
  let winding = 0;
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length], side = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (side === 0 && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1])) return 'boundary';
    if (a[1] <= p[1] && b[1] > p[1] && side > 0) winding++;
    if (a[1] > p[1] && b[1] <= p[1] && side < 0) winding--;
  }
  return winding ? 'inside' : 'outside';
}
function expected(region: FillFeaturePatternRegion, sy = 10) {
  const cells: [number, number][] = []; let cutX2 = 0, cutY2 = 0;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
    const reference: XY = [8 + 12 * i, 8 + sy * j];
    if ((i || j) && (classification(region.points, reference) === 'outside' || region.holes?.some(h => classification(h, reference) !== 'outside'))) continue;
    cells.push([i, j]); cutX2 += 17 + 24 * i; cutY2 += 17 + 2 * sy * j;
  }
  const volume = 24000 - cells.length * 150;
  return { cells, volume, centroid: [(720000 - 75 * cutX2) / volume, (480000 - 75 * cutY2) / volume, 5] };
}
function geometry(p: StudioPart, region: FillFeaturePatternRegion, sy = 10) {
  const oracle = expected(region, sy), mass = p.mass({ density: 1 });
  assert.ok(Math.abs(mass.volume - oracle.volume) <= 1e-7); mass.centroid.forEach((v, k) => assert.ok(Math.abs(v - oracle.centroid[k]) <= 1e-7));
  const bodies = partBreps(p.doc); assert.equal(bodies.length, 1); const brep = bodies[0].brep;
  assert.equal(checkBrep(brep, { strict: true }).valid, true); assert.equal(brep.bodies.length, 1); assert.equal(brep.bodies[0].kind, 'solid'); assert.ok(brep.shells.every(s => s.closed));
  for (const [i, j] of oracle.cells) for (const dx of [0, 3]) for (const dy of [0, 5]) for (const z of [0, 10]) {
    const point = [7 + 12 * i + dx, 6 + sy * j + dy, z]; assert.ok(brep.vertices.some(v => v.point.every((x, k) => Math.abs(x - point[k]) <= 1e-9)), `missing cutter corner ${point}`);
  }
  const names = p.select().faces().names(); assert.equal(new Set(names).size, names.length);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) if (i || j) {
    const admitted = oracle.cells.some(([x, y]) => x === i && y === j);
    assert.equal(names.some(name => name.endsWith(`.side0@${i},${j}`)), admitted, `authored cell suffix ${i},${j}`);
  }
  return { ...oracle, names: names.sort() };
}
function mask(doc: StudioDoc, index: number) { return fillRegionSnapshot(doc, index); }

test('fill hole mask: actual profile producer captures two owned rings and retains exact seven-cell oracle', () => {
  const { doc, index } = authored(), before = structuredClone(doc), region = mask(doc, index);
  assert.deepEqual(region, { points: outer, holes }); assert.equal(eligibleFillPatternRegions(doc).some(c => c.value === String(index)), true);
  const oracle = expected(region); assert.deepEqual(oracle.cells, [[0, 0], [1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2]]);
  assert.equal(oracle.volume, 22950); assert.deepEqual(oracle.centroid, [9265 / 306, 6161 / 306, 5]);
  const accepted = part('profile producer', doc).fillFeaturePattern(options(region)); geometry(accepted, region);
  const node = doc.nodes[index]; assert.ok(node.kind === 'sketch' && node.holes); node.holes[0][0].start[0] = 21;
  assert.deepEqual(region, { points: outer, holes }); assert.deepEqual(accepted.doc.nodes.slice(0, -1), before.nodes);
  const resolved = structuredClone(before), sketch = resolved.nodes[index]; assert.ok(sketch.kind === 'sketch' && sketch.holes); sketch.holes[0][0].start[0] = { parameter: 'holeLeft' };
  assert.deepEqual(mask(resolved, index), region); assert.deepEqual(resolved.parameters, before.parameters);
});

test('fill hole mask: Y-spacing binding changes seven to nine cuts with stable grid suffixes', () => {
  const { doc, index } = authored(), region = mask(doc, index), accepted = part('bound holes', doc).fillFeaturePattern(options(region));
  const before = accepted.doc, edited = accepted.withParameters({ sy: 12 }), oracle = expected(region, 12);
  assert.equal(oracle.cells.length, 9); assert.equal(oracle.volume, 22650); assert.deepEqual(oracle.centroid, [9159 / 302, 6007 / 302, 5]);
  geometry(edited, region, 12); assert.deepEqual(accepted.doc, before);
  const node = edited.doc.nodes.at(-1); assert.ok(node?.kind === 'fill-feature-pattern'); assert.deepEqual(node.spacing, { parameter: 'sx' }); assert.deepEqual(node.spacing2, { parameter: 'sy' });
});

test('fill hole mask: source edit stays independent until explicit existing editor reselect', () => {
  const { doc, index } = authored(), region = mask(doc, index), accepted = part('owned holes', doc).fillFeaturePattern(options(region)), edited = accepted.doc;
  const node = edited.nodes[index]; assert.ok(node.kind === 'sketch' && node.holes);
  for (const segment of node.holes[0]) { assert.equal(typeof segment.start[0], 'number'); segment.start[0] = Number(segment.start[0]) + 16; }
  geometry(part('unchanged captured mask', edited), region);
  const feature = edited.nodes.length - 1, selector = editFields(edited.nodes, feature, edited.parameters).find(f => f.key === 'region'); assert.ok(selector?.kind === 'choice');
  const reselected = { ...edited, nodes: selector.set(edited.nodes, String(index)) }, next = mask(edited, index);
  assert.equal(expected(next).cells.length, 9); geometry(part('recaptured holes', reselected), next);
  assert.equal(reselected.nodes[feature].id, edited.nodes[feature].id); assert.deepEqual((edited.nodes[feature] as { region: FillFeaturePatternRegion }).region, region);
});

test('fill hole mask: existing command, file, wire and nested guards use the shared owned snapshot', async () => {
  const { doc, index } = authored(), region = mask(doc, index), initial = evaluateDoc(doc, 0); assert.ok(initial.ok);
  const ctx: Ctx = { doc, bodies: initial.bodies, selection: { faces: [], edges: [], bodies: [0] } }, before = structuredClone(ctx), command = commandById('fill-feature-pattern')!;
  const values = { region: String(index), anchorX: 8, anchorY: 8, spacing: 12, count: 4, spacing2: 10, count2: 3 };
  const accepted = command.build!(ctx, values); geometry(part('actual command', accepted), region); assert.deepEqual(ctx, before);
  for (const change of [{ count: 65 }, { spacing2: 0 }, { region: '-1' }]) assert.throws(() => command.build!(ctx, { ...values, ...change })); assert.deepEqual(ctx, before);
  const opened = await readStudioFile(encodeStudioFile(accepted)); assert.ok('doc' in opened); assert.deepEqual(opened.doc, accepted); geometry(part('native holes', opened.doc), region);
  const sender = new WireSender(), receiver = new WireReceiver(), wired = receiver.unpack(sender.pack(accepted)); sender.dispose(); assert.deepEqual(evaluatedPart(wired), evaluatedPart(accepted)); geometry(part('wire holes', wired), region);
  geometry(part('flattened holes', flattenAssembly(accepted)), region);
  assert.equal(fillPatternDocumentProblem({ nodes: [], parameters: {}, instances: [{ doc: accepted }], pendingParts: { same: { doc: accepted } } }), null);
  for (const malformed of [{ points: outer, holes: [] }, { points: outer, holes: [holes[0], holes[0]] }, { points: outer, holes: [[[4, 8], [8, 8], [8, 12]]] }]) {
    const bad = structuredClone(accepted), last = bad.nodes.at(-1)!; Object.assign(last, { region: malformed, suppressed: true });
    assert.ok(fillPatternDocumentProblem(bad)); assert.ok(fillPatternDocumentProblem({ nodes: [], parameters: {}, pendingParts: { bad: { doc: bad } } }));
  }
});

test('fill hole mask: Sketch holes empty omits field; raw empty holes remain invalid; source guards stay active', () => {
  const { doc, index } = authored(), node = doc.nodes[index]; assert.ok(node.kind === 'sketch'); node.holes = [];
  const noHoles = mask(doc, index); assert.deepEqual(noHoles, { points: outer }); assert.equal(Object.hasOwn(noHoles, 'holes'), false);
  assert.throws(() => source().fillFeaturePattern(options({ points: outer, holes: [] })));
  for (const patch of [{ on: { node: 1, side: 'solid' } }, { association: {} }, { suppressed: true }, { regions: [[{ kind: 'line', start: [1, 1] }]] }, { plane: { origin: [0, 0, 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { holes: [[{ kind: 'arc', start: [20, 16], center: [20, 20], direction: 'ccw' }]] }]) {
    const bad = structuredClone(doc); Object.assign(bad.nodes[index], patch); assert.throws(() => mask(bad, index)); assert.equal(eligibleFillPatternRegions(bad).some(c => c.value === String(index)), false);
  }
});

test('fill hole mask: nested snapshot descriptor admission invokes no accessor and bounds aggregate before coordinate reads', () => {
  const sample = authored(); let calls = 0;
  const accessor = (target: object, key: PropertyKey) => Object.defineProperty(target, key, { configurable: true, enumerable: true, get() { calls++; throw new Error('getter must not run'); } });
  for (const change of [
    (node: SketchNode) => accessor(node, 'kind'),
    (node: SketchNode) => accessor(node, 'holes'),
    (node: SketchNode) => accessor(node.holes![0][0], 'kind'),
    (node: SketchNode) => accessor(node.holes![0][0], 'start'),
    (node: SketchNode) => accessor(node.holes![0][0].start, 0),
    (node: SketchNode) => { const value = { parameter: 'holeLeft' }; accessor(value, 'parameter'); node.holes![0][0].start[0] = value; },
  ]) {
    const doc = structuredClone(sample.doc); change(doc.nodes[sample.index] as SketchNode); assert.throws(() => mask(doc, sample.index));
    assert.equal(eligibleFillPatternRegions(doc).some(c => c.value === String(sample.index)), false); assert.equal(calls, 0);
  }
  const over = structuredClone(sample.doc), node = over.nodes[sample.index]; assert.ok(node.kind === 'sketch' && node.holes);
  node.holes = [node.holes[0], structuredClone(node.holes[0]), structuredClone(node.holes[0]), structuredClone(node.holes[0])];
  accessor(node.holes[0][0], 'kind'); assert.throws(() => mask(over, sample.index), /at most 16/); assert.equal(calls, 0);
  const extra = structuredClone(sample.doc), sk = extra.nodes[sample.index]; assert.ok(sk.kind === 'sketch' && sk.holes); Object.assign(sk.holes[0][0].start, { extra: 1 }); assert.throws(() => mask(extra, sample.index));
});
