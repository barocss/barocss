// Input regressions only. Execution is deferred with the API improvement group.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, BarocssError, type BodyQuery } from '../src/api';
import type { Vec3 } from '@barocss/cad/api';
import { withLibraryPart, type LibraryPartInput } from '../src/api/library';
import { emptyDoc } from '../src/engine/doc';

const invalid: unknown[] = [null, undefined, [], [1, 2], [1, 2, 3, 4], '123',
  { 0: 1, 1: 2, 2: 3, length: 3 }, new Float64Array([1, 2, 3]), new Array(3),
  [1, 2, NaN], [1, Infinity, 3], [1, 2, '3'], [1, 2, Symbol('z')], [1, 2, 3n]];
const value = (error: unknown) => error instanceof BarocssError && error.code === 'VALUE';

test('library placement helper refuses malformed point and explicit xDirection before evaluation', () => {
  const doc = emptyDoc(), before = structuredClone(doc);
  for (const tuple of invalid) {
    assert.throws(() => withLibraryPart(doc, 'absent', 'enclosure', 'pcb-standoff', 'absent', tuple as Vec3, {}), value);
    if (tuple !== undefined) assert.throws(() => withLibraryPart(doc, 'absent', 'enclosure', 'pcb-standoff', 'absent', [1, 2, 3], { xDirection: tuple as Vec3 }), value);
  }
  assert.deepEqual(doc, before);
});

test('library placement helper refuses malformed options containers and face names before evaluation', () => {
  const doc = emptyDoc(), before = structuredClone(doc);
  for (const options of [null, undefined, [], 42, false, 'options']) {
    assert.throws(() => withLibraryPart(doc, 'absent', 'enclosure', 'pcb-standoff', 'n1.top', [1, 2, 3], options as unknown as LibraryPartInput), value);
  }
  for (const face of [null, undefined, '', 42, Symbol('face')]) {
    assert.throws(() => withLibraryPart(doc, 'absent', 'enclosure', 'pcb-standoff', face as unknown as string, [1, 2, 3], {}), value);
  }
  assert.deepEqual(doc, before);
});

test('libraryPart facade preserves its source on malformed placement tuples', () => {
  const floor = part('floor').box({ w: 30, d: 20, h: 2 }), before = floor.doc;
  for (const tuple of invalid) {
    assert.throws(() => floor.libraryPart('enclosure', 'pcb-standoff', { face: b => b.faces().facing('+z'), point: tuple as Vec3 }), value);
    if (tuple !== undefined) assert.throws(() => floor.libraryPart('enclosure', 'pcb-standoff', { face: b => b.faces().facing('+z'), point: [10, 10, 2], xDirection: tuple as Vec3 }), value);
  }
  assert.deepEqual(floor.doc, before);
});

test('valid frozen library placement tuples match omitted and explicit default X directions', () => {
  const floor = part('floor').box({ w: 30, d: 20, h: 2 });
  const point = Object.freeze([10, 10, 2]) as Vec3, xDirection = Object.freeze([1, 0, 0]) as Vec3;
  const options = { variant: 'M3', params: { h: 5 }, face: (b: BodyQuery) => b.faces().facing('+z'), point };
  const implicit = floor.libraryPart('enclosure', 'pcb-standoff', options);
  const explicit = floor.libraryPart('enclosure', 'pcb-standoff', { ...options, xDirection });
  assert.deepEqual(explicit.doc, implicit.doc);
  assert.deepEqual(point, [10, 10, 2]);
  assert.deepEqual(xDirection, [1, 0, 0]);
});
