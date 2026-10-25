import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readNativeSIInertia } from '@barocss/cad/internal/native-si-mass';
import { evaluatePart, nativeMassPropertiesOfBody } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { partsOf, robotViewOf, treeOf } from '../src/robot/verbs';
import { robotParts } from '../src/robot/urdf';
import { linkInertia, type Frame } from '../src/robot/inertia';
import { nativeLinkInertia } from '../src/robot/nativeInertia';
import { MATERIALS } from '../src/library/materials';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const AT_PART: Frame = { origin: [0, 0, 0], R: [1, 0, 0, 0, 1, 0, 0, 0, 1] };

test('native target provenance: arm-6r, four-bar and urdf-2r use raw SI for every massive body, with zero fallbacks', async () => {
  for (const name of ['arm-6r', 'four-bar', 'urdf-2r']) {
    const doc = JSON.parse(readFileSync(resolve(import.meta.dirname, `../../barocss-cad/conformance/rm/${name}/robot.bcad`), 'utf8')) as StudioDoc;
    const result = await evaluate(doc); assert.ok(result.ok);
    const view = await robotViewOf(doc, result.bodies, evaluate), partOf = partsOf(view), tree = treeOf(view);
    const before = new Map(tree.links.flatMap(l => { const part = l.part && partOf(l.part); return part ? [[l.id, JSON.stringify(part.bodies.map(b => [b.volume, b.mass, b.centroid, b.inertia]))] as const] : []; }));
    const native = robotParts(tree, partOf); assert.ok(!('refusals' in native), name);
    const count = tree.links.reduce((sum, l) => sum + (l.part ? partOf(l.part)?.bodies.filter(b => b.volume !== null && b.centroid && b.inertia).length ?? 0 : 0), 0);
    assert.equal(native.nativeInertia.length, count, name); assert.ok(count > 0);
    assert.ok(native.nativeInertia.every(b => b.mode === 'raw-native-si' && !b.reason), `${name}: ${JSON.stringify(native.nativeInertia)}`);
    assert.ok(!native.notes.some(n => n.includes('MMGS round-trip')), name);
    for (const l of tree.links) {
      const part = l.part && partOf(l.part); if (!part) continue;
      assert.equal(JSON.stringify(part.bodies.map(b => [b.volume, b.mass, b.centroid, b.inertia])), before.get(l.id), 'public body values are not rewritten');
    }
  }
});

test('native lookup keeps the exact cached result through ordinary copies; material density is applied once', () => {
  const doc = rectanglePart(10, 10, 10), result = evaluatePart(doc, 1); assert.ok(result.ok);
  const body = result.bodies[0], props = nativeMassPropertiesOfBody(body); assert.ok(props);
  const copy = { ...body, notes: [{ text: 'a note copy' }] };
  assert.equal(nativeMassPropertiesOfBody(copy), props);
  const raw = readNativeSIInertia(props); assert.ok(raw.ok);
  assert.equal(readNativeSIInertia(props), raw, 'the Kernel lookup returns its cached result');
  const steel = MATERIALS.find(m => Math.abs(m.density - 2.7) > 1)!;
  const materialDoc = { ...doc, bodies: { [body.key]: { material: steel.id } } };
  const native = nativeLinkInertia('base', 'base', materialDoc, [copy], AT_PART);
  assert.deepEqual(native.basis, [{ link: 'base', body: body.key, mode: 'raw-native-si' }]);
  const ratio = steel.density / raw.density;
  assert.deepEqual(native.inertia.inertia, raw.inertia.flat().map(x => x * ratio + 0), 'exact legacy SI coefficient order, then one material ratio');
  const scale = 45 * steel.density / 2.7 * 1e-9;
  for (const i of [0, 4, 8]) assert.ok(Math.abs(native.inertia.inertia[i] - scale) <= scale * 1e-12);
});

test('source-less worker clones keep existing export support and expose unavailable provenance without changing default inertia', () => {
  const doc = rectanglePart(10, 10, 10), result = evaluatePart(doc, 1); assert.ok(result.ok);
  const body = result.bodies[0], clone = structuredClone(body);
  for (const derived of [clone]) {
    assert.equal(nativeMassPropertiesOfBody(derived), undefined);
    const expected = linkInertia('base', 'base', doc, [derived], AT_PART), before = JSON.stringify(expected);
    const native = nativeLinkInertia('base', 'base', doc, [derived], AT_PART);
    assert.deepEqual(native.inertia, expected);
    assert.deepEqual(native.basis, [{ link: 'base', body: body.key, mode: 'mmgs-roundtrip', reason: 'untracked' }]);
    assert.match(native.notes[0], /native SI provenance unavailable \(untracked\); existing MMGS round-trip inertia used/);
    assert.equal(JSON.stringify(linkInertia('base', 'base', doc, [derived], AT_PART)), before);
  }
});
