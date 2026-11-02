import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { bomViewOf, deriveBom } from '../src/bom/core';
import { MATERIALS } from '../src/library/materials';

const evaluate = (doc: StudioDoc) => evaluateDoc(doc, 1);
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} vs ${expected}`);
const at = (id: string, doc: StudioDoc, part?: PartInstance['part']): PartInstance => ({ id, name: id, doc, position: [0, 0, 0], rotation: [0, 0, 0], ...(part ? { part } : {}) });
const assembly = (...instances: PartInstance[]): StudioDoc => ({ ...emptyDoc(), instances });
const bom = (doc: StudioDoc) => deriveBom(bomViewOf(doc, evaluate));
const lines = (doc: StudioDoc) => bom(doc).lines.map(line => [line.parts, line.qty]);

function plate(parameters: Record<string, number>): StudioDoc {
  const doc = rectanglePart(60, 40, 10), sketch = doc.nodes[0];
  assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle');
  return { ...doc, parameters, nodes: [{ ...sketch, max: [{ parameter: 'W' }, 40] }, ...doc.nodes.slice(1)] };
}

function volume(doc: StudioDoc): number {
  const result = evaluate(doc);
  assert.ok(result.ok);
  assert.equal(result.bodies.length, 1);
  const value = result.bodies[0].volume;
  assert.notEqual(value, null);
  return value!;
}

test('same ordinary nodes with W60 and W80 make two quantity-one BOM lines, with native volumes and mass retained', () => {
  const narrow = plate({ W: 60 }), wide = plate({ W: 80 });
  assert.deepEqual(narrow.nodes, wide.nodes);
  near(volume(narrow), 24000); near(volume(wide), 32000);
  const doc = assembly(at('narrow', narrow), at('wide', wide)), before = JSON.stringify(doc), result = bom(doc);
  assert.deepEqual(result.lines.map(line => [line.parts, line.qty]), [[['narrow'], 1], [['wide'], 1]]);
  assert.equal(result.totalQty, 2);
  near(result.totalMass, (24000 + 32000) * MATERIALS[0].density * 1e-3);
  assert.equal(JSON.stringify(doc), before);
});

test('equal nodes and parameter values group across independent and shared definitions, names and placements', () => {
  const first = at('first', plate({ W: 60 }), { id: 'shared', rev: 'A', source: './first.bcad' });
  const second = at('second', plate({ W: 60 }), { id: 'other', rev: 'B', source: './other.bcad' });
  second.position = [100, 0, 0];
  const third = at('third', first.doc, first.part);
  assert.deepEqual(lines(assembly(first, second, third)), [[['first', 'second', 'third'], 3]]);
});

test('parameter dictionary insertion order does not split equal values or mutate sources; a used value still separates', () => {
  const a = plate({ W: 60, spare: 7 }), b = plate({ spare: 7, W: 60 });
  assert.notEqual(JSON.stringify(a.parameters), JSON.stringify(b.parameters));
  const doc = assembly(at('a', a), at('b', b)), before = JSON.stringify(doc);
  assert.deepEqual(lines(doc), [[['a', 'b'], 2]]);
  assert.equal(JSON.stringify(doc), before);
  const changed = { ...b, parameters: { ...b.parameters, W: 80 } };
  assert.deepEqual(lines(assembly(at('a', a), at('b', changed))), [[['a'], 1], [['b'], 1]]);
});

test('ordinary identity conservatively includes unused parameter values, without claiming geometric equivalence', () => {
  const a = plate({ W: 60, spare: 7 }), b = plate({ W: 60, spare: 8 });
  near(volume(a), volume(b));
  assert.deepEqual(lines(assembly(at('a', a), at('b', b))), [[['a'], 1], [['b'], 1]]);
});

test('parameter-free ordinary parts keep the exact legacy shape key and grouping', () => {
  const part = rectanglePart(60, 40, 10), doc = assembly(at('a', part), at('b', part));
  assert.deepEqual(part.parameters, {});
  for (const item of bomViewOf(doc, evaluate).parts) assert.equal(item.shape, JSON.stringify(part.nodes));
  assert.deepEqual(lines(doc), [[['a', 'b'], 2]]);
});

test('parameter identity propagates through nested parts and sub-assembly grouping', () => {
  const narrow = assembly(at('plate', plate({ W: 60, spare: 7 })));
  const wide = assembly(at('plate', plate({ W: 80, spare: 7 })));
  const distinct = bom(assembly(at('subA', narrow), at('subB', wide)));
  assert.deepEqual(distinct.lines.map(line => [line.parts, line.qty, line.level ?? 0]), [
    [['subA'], 1, 0], [['subA/plate'], 1, 1], [['subB'], 1, 0], [['subB/plate'], 1, 1],
  ]);
  const equal = assembly(at('plate', plate({ spare: 7, W: 60 })));
  const grouped = bom(assembly(at('subA', narrow), at('subB', equal)));
  assert.deepEqual(grouped.lines.map(line => [line.parts, line.qty, line.level ?? 0]), [
    [['subA', 'subB'], 2, 0], [['subA/plate', 'subB/plate'], 2, 1],
  ]);
  assert.equal(grouped.lines[1].perParent, 1);
  near(distinct.totalMass, (24000 + 32000) * MATERIALS[0].density * 1e-3);
});

test('material remains a separate grouping condition for equal parameterized shapes', () => {
  const part = plate({ W: 60 }), steel: StudioDoc = { ...part, bodies: { b1: { material: 'steel' } } };
  const brass: StudioDoc = { ...part, bodies: { b1: { material: 'brass' } } };
  const result = bom(assembly(at('steel1', steel), at('brass', brass), at('steel2', steel)));
  assert.deepEqual(result.lines.map(line => [line.parts, line.qty, line.material]), [[['steel1', 'steel2'], 2, 'steel'], [['brass'], 1, 'brass']]);
  for (const line of result.lines) {
    const material = MATERIALS.find(item => item.id === line.material)!;
    near(line.mass, line.qty * 24000 * material.density * 1e-3);
  }
});

test('native document Save/Open retains parameter-distinct BOM grouping without changing accepted data', async () => {
  const doc = assembly(at('narrow', plate({ W: 60 })), at('wide', plate({ W: 80 })));
  const before = JSON.stringify(doc), opened = await readStudioFile(encodeStudioFile(doc));
  assert.ok('doc' in opened);
  assert.deepEqual(opened.doc, doc);
  assert.deepEqual(bom(opened.doc), bom(doc));
  assert.deepEqual(lines(opened.doc), [[['narrow'], 1], [['wide'], 1]]);
  assert.equal(JSON.stringify(doc), before);
});
