import assert from 'node:assert/strict';
import test from 'node:test';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { deleteFeature, duplicateBody, renumber } from '../src/chat/features';
import { encodeStudioFile } from '../src/engine/container';
import type { LoopSegment, RegionExtrudeNode, SketchNode, StudioDoc } from '../src/engine/doc';
import { flattenAssembly } from '../src/engine/flatten';
import { readStudioDoc } from '../src/engine/migrate';
import { toPartDocument } from '../src/engine/part';

const plane = { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } satisfies RegionExtrudeNode['plane'];
const corners: [number, number][] = [[14, 6], [24, 6], [24, 18], [14, 18]];
const lines = (points: [number, number][]): LoopSegment[] => points.map(start => ({ kind: 'line', start }));
const ids = ['e5', 'e6', 'e7', 'e8'];
const source = { kind: 'sketch', id: 'n0', profile: 'rectangle', min: [4, 6], max: [14, 16],
  regions: [lines(corners), lines([[28, 6], [38, 6], [38, 18], [28, 18]])],
  sideTags: { outer: ['e1', 'e2', 'e3', 'e4'], regions: [ids, ['e9', 'e10', 'e11', 'e12']] } } satisfies SketchNode & { id: string };
const extrusion = { kind: 'region-extrude', id: 'n1', sketch: 0, sourceFeature: 'n0', height: 2, plane,
  boundary: [{ side: 'e5', ends: [[14, 6], [24, 6]] }, { side: 'e6', ends: [[24, 6], [24, 18]] },
    { side: 'e7', ends: [[14, 18], [24, 18]] }, { side: 'e8', ends: [[14, 6], [14, 18]] }] } satisfies RegionExtrudeNode & { id: string };
const doc: StudioDoc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [source, extrusion],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };

const evaluate = (candidate: StudioDoc) => evaluateCadPart(toPartDocument(candidate)).outputs;
const checkRegion = (outputs: ReturnType<typeof evaluate>) => {
  assert.equal(outputs.length, 1);
  const [output] = outputs;
  assert.equal(output.id, 'n1');
  assert.equal(checkOutput(output).valid, true);
  const { volume, centroid } = massPropertiesOf(output);
  assert.ok(Math.abs(volume - 240) < 1e-9);
  assert.ok(Math.hypot(centroid[0] - 19, centroid[1] - 12, centroid[2] - 1) < 1e-9);
  assert.ok(output.brep.faces.some(face => face.name === 'n1.side[e8]'));
};

test('schema 3 opens and saves the exact recipe, and lowers only the selected fixed boundary', () => {
  assert.deepEqual(readStudioDoc(new TextDecoder().decode(encodeStudioFile(doc))), { doc, notes: [] });
  checkRegion(evaluate(doc));
  const withParameter: StudioDoc = { ...doc, parameters: { H: 2 }, nodes: [source, { ...extrusion, height: { parameter: 'H' } }] };
  checkRegion(evaluate(withParameter));
  const legacy: StudioDoc = { ...doc, nodes: [source, { kind: 'extrude', id: 'n1', sketch: 0, height: 2 }] };
  assert.ok(Math.abs(massPropertiesOf(evaluate(legacy)[0]).volume - 680) < 1e-9);
});

test('loop reorder or reversal and source index renumbering retain the same region', () => {
  const changed: SketchNode = { ...source, regions: [source.regions[1], lines([corners[1], corners[0], corners[3], corners[2]])],
    sideTags: { ...source.sideTags, regions: [source.sideTags.regions[1], ['e5', 'e8', 'e7', 'e6']] } };
  const candidate: StudioDoc = { ...doc, nodes: [{ id: 'n2', kind: 'sketch', profile: 'circle', center: [100, 100], radius: 1 },
    changed, renumber(extrusion, i => i + 1)], outputs: { b1: { node: 2, side: 'solid' } }, nextId: 3 };
  checkRegion(evaluate(candidate));
});

test('stale geometry, source substitution, overlap, plane changes and holes fail safely', () => {
  const copy = (patch: Partial<SketchNode>): StudioDoc => ({ ...doc, nodes: [{ ...source, ...patch } as SketchNode, extrusion] });
  const changed = [
    copy({ regions: [lines([[14, 6], [25, 6], [25, 18], [14, 18]]), source.regions[1]] }),
    copy({ regions: [source.regions[0], lines([[23, 7], [38, 7], [38, 18], [23, 18]])] }),
    copy({ holes: [lines([[15, 7], [16, 7], [16, 8], [15, 8]])] }),
    copy({ plane: { ...plane, origin: [0, 0, 1] } }),
    { ...doc, nodes: [{ ...source, id: 'n2' }, extrusion] } satisfies StudioDoc,
  ];
  for (const candidate of changed) {
    assert.match((readStudioDoc(JSON.stringify(candidate)) as { error: string }).error, /Extrude region/i);
    assert.throws(() => evaluate(candidate), /Extrude region/i);
    assert.throws(() => encodeStudioFile(candidate), /Extrude region/i);
  }
  const malformed = { ...doc, nodes: [source, { ...extrusion, suppressed: 'false' }] };
  assert.match((readStudioDoc(JSON.stringify(malformed)) as { error: string }).error, /malformed/i);
  const nested = { ...doc, nodes: [], outputs: {}, instances: [{ doc: changed[0] }] };
  assert.match((readStudioDoc(JSON.stringify(nested)) as { error: string }).error, /Extrude region/i);
});

test('suppression and duplication preserve graph ownership', () => {
  const suppressed: StudioDoc = { ...doc, nodes: [source, { ...extrusion, suppressed: true }] };
  assert.deepEqual(evaluate(suppressed), []);
  const duplicate = duplicateBody(doc, { node: 1, side: 'solid' }, [30, 0, 0]).doc;
  const outputs = evaluate(duplicate);
  assert.equal(outputs.length, 2);
  assert.ok(outputs.every(output => checkOutput(output).valid && Math.abs(massPropertiesOf(output).volume - 240) < 1e-9));
  const placed: StudioDoc = { ...doc, instances: [{ id: 'part', name: 'Part', doc, position: [0, 40, 0], rotation: [0, 0, 0] }] };
  const flattened = flattenAssembly(placed);
  const flattenedOutputs = evaluate(flattened);
  assert.equal(flattenedOutputs.length, 2);
  assert.ok(flattenedOutputs.every(output => checkOutput(output).valid && Math.abs(massPropertiesOf(output).volume - 240) < 1e-9));
});

test('deleting the last individual extrusion preserves the authored sketch', () => {
  const deleted = deleteFeature(doc, 1);
  assert.ok('doc' in deleted);
  assert.deepEqual(deleted.doc.nodes, [source]);
  assert.deepEqual(deleted.doc.outputs, {});
});
