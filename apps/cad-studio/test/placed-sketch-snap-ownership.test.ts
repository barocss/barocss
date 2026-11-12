import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyDoc, type PartInstance } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { InstanceEvaluationSource } from '../src/viewport/instanceEvaluation';
import { acceptedPlacedSketchSnaps } from '../src/viewport/placedSketchSnaps';
import type { InstanceItem } from '../src/viewport/renderer';

const base = emptyDoc(), body = { key: 'b1' } as BodyResult;
const left: PartInstance = { id: 'left', name: 'Left', doc: base, position: [0, 0, 0], rotation: [0, 0, 0] };
const right: PartInstance = { ...left, id: 'right', name: 'Right', position: [20, 0, 0] };
const doc = { ...base, instances: [left, right] };
const leftBodies = [body], rightBody = { ...body }, rightBodies = [rightBody];
const items: InstanceItem[] = [{ id: 'left', bodies: leftBodies }, { id: 'right', bodies: rightBodies }];
const accepted = new Map([
  ['left', { inst: left, sourceKey: 'source', bodies: leftBodies }],
  ['right', { inst: right, sourceKey: 'source', bodies: rightBodies }],
]);
const sources = new Map<string, InstanceEvaluationSource>([
  ['left', { ok: true, key: 'source', base }],
  ['right', { ok: true, key: 'source', base }],
]);

test('a current visible instance owns only its own accepted mesh', () => {
  const results = acceptedPlacedSketchSnaps(doc, accepted, sources, items);
  assert.deepEqual(results, [{ instance: left, body }, { instance: right, body: rightBody }]);
  assert.equal(results[0].instance, left);
  assert.equal(results[1].body, rightBody);
  const moved: PartInstance = { ...left, position: [40, 0, 0] };
  assert.deepEqual(acceptedPlacedSketchSnaps({ ...doc, instances: [moved, right] }, accepted, sources, items),
    [{ instance: right, body: rightBody }]);
});

test('wrong source, hidden looks, replacement meshes and duplicate IDs are excluded', () => {
  const revised = new Map(sources).set('left', { ok: true, key: 'changed', base });
  assert.deepEqual(acceptedPlacedSketchSnaps(doc, accepted, revised, items).map(source => source.instance.id), ['right']);
  const hidden = { ...items[0], looks: new Map([['b1', { hidden: true }]]) };
  assert.deepEqual(acceptedPlacedSketchSnaps(doc, accepted, sources, [hidden, items[1]]).map(source => source.instance.id), ['right']);
  const proposed = { ...items[0], bodies: [{ ...body }] };
  assert.deepEqual(acceptedPlacedSketchSnaps(doc, accepted, sources, [proposed, items[1]]).map(source => source.instance.id), ['right']);
  assert.deepEqual(acceptedPlacedSketchSnaps(doc, accepted, sources, [items[0], items[0]]), []);
  const other = { ...doc, instances: [left, { ...left }] };
  assert.deepEqual(acceptedPlacedSketchSnaps(other, accepted, sources, items), []);
});
