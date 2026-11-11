import test from 'node:test';
import assert from 'node:assert/strict';
import { brepMassProperties, checkBrep, coedgeVertices, evaluateCadPart, outputOf, tessellateBrep, type Brep } from '@barocss/cad';
import { sectionOf, type SectionResult } from '../src/drawing/section';
import type { XY } from '../src/drawing/types';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { toPartDocument } from '../src/engine/part';

const thickness = 1 / 64;
const midpoint = 1 / 128;
const supportedGap = 2 ** -23;
const unsupportedGap = 2 ** -24;
const offsets = [0, 8192, -8192];

function boxAt(y: number, depth = thickness): StudioDoc {
  return withNode(rectanglePart(10, depth, 10), { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [0, y, 0] });
}

function addBox(doc: StudioDoc, x: number, y: number): StudioDoc {
  const sketch = doc.nodes.length;
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + 10, thickness] });
  doc = withNode(doc, { kind: 'extrude', sketch, height: 10 });
  return withNode(doc, { kind: 'translate', parent: { node: sketch + 1, side: 'solid' }, offset: [0, y, 0] });
}

function success(result: SectionResult) {
  assert.ok(result.ok, result.ok ? '' : result.error);
  return result;
}

function failure(result: SectionResult, pattern: RegExp) {
  assert.ok(!result.ok, 'expected an explicit section failure');
  assert.match(result.error, pattern);
}

function area(points: readonly XY[]): number {
  return Math.abs(points.reduce((sum, [x, z], i) => {
    const [u, v] = points[(i + 1) % points.length];
    return sum + x * v - z * u;
  }, 0)) / 2;
}

function corners(points: readonly XY[]): string[] {
  return [...new Set(points.map(p => p.join(',')))].sort();
}

function assertClosed(brep: Brep): void {
  const report = checkBrep(brep, { strict: true });
  assert.equal(report.valid, true, report.issues.join('\n'));
  assert.equal(report.counts.bodies, 1);
  assert.ok(brep.shells.every(s => s.closed));
}

function assertVolume(brep: Brep, expected: number): void {
  const actual = brepMassProperties(brep, 1).volume;
  assert.ok(Math.abs(actual - expected) <= 1e-10, `volume ${actual}, expected ${expected}`);
}

/** Measure the actual native cap from its ordered B-rep vertices in the XZ plane. */
function assertNativeCap(brep: Brep, y: number): void {
  const loops = new Map(brep.loops.map(l => [l.id, l]));
  const coedges = new Map(brep.coedges.map(c => [c.id, c]));
  const edges = new Map(brep.edges.map(e => [e.id, e]));
  const vertices = new Map(brep.vertices.map(v => [v.id, v.point]));
  const faces = brep.faces.map(f => f.loops.map(id => loops.get(id)!.coedges.map(cid => vertices.get(coedgeVertices(brep, coedges.get(cid)!, edges)[0])!)));
  const cap = faces.filter(loops => loops.flat().every(p => p[1] === y));
  assert.equal(cap.length, 1);
  assert.equal(cap[0].length, 1);
  const ring = cap[0][0].map(([x, , z]): XY => [x, z]);
  assert.deepEqual(corners(ring), ['0,0', '0,10', '10,0', '10,10']);
  assert.equal(area(ring), 100);
}

function nativeHalves(doc: StudioDoc, y: number): readonly [Brep, Brep] {
  const part = toPartDocument(doc);
  const [{ id: target }] = evaluateCadPart(part).outputs;
  const cut = evaluateCadPart({ ...part, features: [...part.features, { id: 'reference_split', kind: 'split', target, axis: 'y', at: y }] });
  return [outputOf(cut, 'reference_split/0').brep, outputOf(cut, 'reference_split/1').brep];
}

function assertOutline(result: SectionResult, y: number, x = 0, sign = 1, body = 0): void {
  const { projection, rings, ringBodies } = success(result);
  assert.deepEqual(ringBodies, [body]);
  assert.equal(rings.length, 1);
  const expected = [x, x + 10].flatMap(u => [0, 10].map(z => [sign * u, z] as XY));
  assert.deepEqual(corners(rings[0]), corners(expected));
  assert.equal(area(rings[0]), 100);
  assert.equal(projection.edges.length, 4);
  assert.ok(projection.edges.every(e => e.kind === 'line' && e.ends?.every(p => p[1] === y)), JSON.stringify(projection.edges));
}

function depths(result: SectionResult): number[] {
  return [...new Set(success(result).projection.edges.flatMap(e => e.ends?.map(p => p[1]) ?? []))].sort((a, b) => a - b);
}

for (const offset of offsets) {
  test(`section at ${offset}: strict native halves and one matching cap in both viewing directions`, () => {
    const doc = boxAt(offset);
    const [{ brep }] = evaluateCadPart(toPartDocument(doc)).outputs;
    assertClosed(brep);
    assertVolume(brep, 1.5625);
    const positions = tessellateBrep(brep, { segmentsPerQuarter: 4 }).positions;
    assert.ok(positions instanceof Float64Array);
    const ys = positions.filter((_, i) => i % 3 === 1);
    assert.deepEqual([Math.min(...ys), Math.max(...ys)], [offset, offset + thickness]);
    const y = offset + midpoint;
    for (const half of nativeHalves(doc, y)) {
      assertClosed(half);
      assertVolume(half, 0.78125);
      assertNativeCap(half, y);
    }
    assert.deepEqual(depths(sectionOf(doc, y)), [y, offset + thickness]);
    assert.deepEqual(depths(sectionOf(doc, -y, 'y+')), [offset, y]);
    assertOutline(sectionOf(doc, y, 'y-', 'front', undefined, undefined, true), y);
    assertOutline(sectionOf(doc, -y, 'y+', 'front', undefined, undefined, true), y, 0, -1);
    assertOutline(sectionOf(doc, -y, 'y-', 'front', undefined, [0, -2, 0], true), y, 0, -1);
  });

  test(`section at ${offset}: near cuts, misses and exact contacts`, () => {
    const doc = boxAt(offset), far = offset + thickness;
    for (const y of [offset + supportedGap, far - supportedGap]) {
      const halves = nativeHalves(doc, y);
      assertVolume(halves[0], 100 * (y - offset));
      assertVolume(halves[1], 100 * (far - y));
      for (const half of halves) {
        assertClosed(half);
        assertNativeCap(half, y);
      }
      assertOutline(sectionOf(doc, y, 'y-', 'front', undefined, undefined, true), y);
      assertOutline(sectionOf(doc, -y, 'y+', 'front', undefined, undefined, true), y, 0, -1);
    }
    for (const y of [offset + unsupportedGap, far - unsupportedGap]) {
      assert.throws(() => nativeHalves(doc, y), /no output reference_split/);
      failure(sectionOf(doc, y), /no output section_/);
      failure(sectionOf(doc, -y, 'y+'), /no output section_/);
    }
    for (const y of [offset - 1, offset - unsupportedGap]) {
      const whole = sectionOf(doc, y);
      assert.deepEqual(depths(whole), [offset, far]);
      assert.deepEqual(success(whole).rings, []);
      assert.deepEqual(success(sectionOf(doc, y, 'y-', 'front', undefined, undefined, true)).projection.edges, []);
    }
    assertOutline(sectionOf(doc, offset, 'y-', 'front', undefined, undefined, true), offset);
    for (const y of [far, far + unsupportedGap, far + 1]) failure(sectionOf(doc, y), /Nothing of the part lies behind/);
    assertOutline(sectionOf(doc, -far, 'y+', 'front', undefined, undefined, true), far, 0, -1);
    failure(sectionOf(doc, -offset, 'y+'), /Nothing of the part lies behind/);
  });

  test(`section at ${offset}: only the crossing body supplies a cap in a three-body part`, () => {
    const cut = offset + midpoint;
    const front = withNode(boxAt(offset - 1), { kind: 'translate', parent: { node: 2, side: 'solid' }, offset: [-20, 0, 0] });
    const behind = addBox(front, 20, cut + unsupportedGap);
    const doc = addBox(behind, 0, offset);
    assert.deepEqual(evaluateCadPart(toPartDocument(doc)).outputs.map(o => Math.min(...o.brep.vertices.map(v => v.point[0]))), [-20, 20, 0]);
    const full = success(sectionOf(doc, cut));
    assert.deepEqual(full.ringBodies, [2]);
    assert.deepEqual([full.projection.min, full.projection.max], [[0, 0], [30, 10]]);
    assertOutline(sectionOf(doc, cut, 'y-', 'front', undefined, undefined, true), cut, 0, 1, 2);
    const reversed = success(sectionOf(doc, -cut, 'y+'));
    assert.deepEqual(reversed.ringBodies, [2]);
    assert.deepEqual([reversed.projection.min, reversed.projection.max], [[-10, 0], [20, 10]]);
    assertOutline(sectionOf(doc, -cut, 'y+', 'front', undefined, undefined, true), cut, 0, -1, 2);
  });
}

test('a thick box retains the same axis cut after translation', () => {
  for (const offset of offsets) {
    const y = offset + 4;
    const doc = boxAt(offset, 10);
    assert.deepEqual(depths(sectionOf(doc, y)), [y, offset + 10]);
    assertOutline(sectionOf(doc, y, 'y-', 'front', undefined, undefined, true), y);
  }
});

test('an oblique section through a box keeps the diagonal cap', () => {
  const result = success(sectionOf(boxAt(0, 10), 10 / Math.sqrt(2), 'y-', 'front', undefined, [1, 1, 0], true));
  assert.deepEqual(result.ringBodies, [0]);
  assert.equal(result.rings.length, 1);
  assert.ok(Math.abs(area(result.rings[0]) - 100 * Math.sqrt(2)) <= 1e-9);
  assert.equal(result.projection.edges.length, 4);
  assert.ok(result.projection.edges.every(e => e.ends?.every(([x, y]) => Math.abs(x + y - 10) <= 1e-9)));
});
