import test from 'node:test';
import assert from 'node:assert/strict';
import type { Resolved } from '../src/drawing/dimensions';
import { calculateToleranceStack, type ToleranceStackTerm } from '../src/drawing/toleranceStack';
import type { DrawingDimension, Tolerance } from '../src/drawing/types';

type Linear = Extract<Resolved, { ok: true; kind: 'linear' }>;
const terms = [{ id: 'a', sign: 1 }, { id: 'b', sign: -1 }] as const;
const pointZone = { kind: 'deviation', lower: 0, upper: 0 } as const;

function linear(id: string, value: number, tol?: Tolerance): Linear {
  const dim: Linear['dim'] = {
    id, kind: 'linear', view: 'front', orient: 'horizontal', place: [0, 1], tol,
    a: { edge: `${id}:left`, at: 'end', near: [0, 0, 0] },
    b: { edge: `${id}:right`, at: 'end', near: [value, 0, 0] },
  };
  return { ok: true, kind: 'linear', dim, value, a: [0, 0], b: [value, 0], text: 'Rounded nominal', alt: 'Secondary text' };
}

function refuses(unit: string, selected: readonly ToleranceStackTerm[], dimensions: readonly Resolved[], reason: RegExp): void {
  const result = calculateToleranceStack(unit, selected, dimensions);
  assert.ok(result.ok === false);
  assert.match(result.reason, reason);
}

test('signed worst-case limits use the raw model value, including asymmetric negative terms', () => {
  const dimensions = [
    linear('a', 25.1234, { kind: 'symmetric', value: 0.12 }),
    linear('b', 10.7, { kind: 'deviation', lower: -0.03, upper: 0.14 }),
    linear('c', 1.005, { kind: 'deviation', lower: 0.02, upper: 0.08 }),
  ];
  // (25.0034 to 25.2434) - (10.67 to 10.84) + (1.025 to 1.085)
  const picked = [...terms, { id: 'c', sign: 1 }] as const;
  const expected = { ok: true, unit: 'mm', nominal: '15.4284', minimum: '15.1884', maximum: '15.6584' };
  assert.deepEqual(calculateToleranceStack('mm', picked, dimensions), expected);
  assert.deepEqual(calculateToleranceStack('mm', [...picked].reverse(), [...dimensions].reverse()), expected);
});

test('exact arithmetic preserves small clearances, zero and negative stack totals', () => {
  const dimensions = [
    linear('a', 10000000000000, { kind: 'symmetric', value: 1e-8 }),
    linear('b', 10000000000000, { kind: 'deviation', lower: 1e-8, upper: 1e-8 }),
  ];
  assert.deepEqual(calculateToleranceStack('mm', terms, dimensions), {
    ok: true, unit: 'mm', nominal: '0', minimum: '-0.00000002', maximum: '0',
  });
  assert.deepEqual(calculateToleranceStack('mm', terms, [linear('a', 0.1, pointZone), linear('b', 0.3, pointZone)]), {
    ok: true, unit: 'mm', nominal: '-0.2', minimum: '-0.2', maximum: '-0.2',
  });
});

test('rejects an invalid selection and unresolved, missing or ambiguous IDs', () => {
  const a = linear('a', 10, pointZone);
  const b = linear('b', 10, pointZone);
  refuses('inch', terms, [a, b], /millimetres/);
  refuses('mm', [terms[0]], [a, b], /at least two/);
  refuses('mm', [terms[0], { id: ' ', sign: 1 }], [a, b], /dimension ID/);
  refuses('mm', [terms[0], { id: 'b', sign: 0 as 1 }], [a, b], /plus or minus/);
  refuses('mm', [terms[0], { id: 'a', sign: -1 }], [a, b], /only once/);
  refuses('mm', terms, [a], /missing/);
  refuses('mm', terms, [a, b, linear('b', 12, pointZone)], /More than one/);
  refuses('mm', terms, [a, { ok: false, dim: b.dim, reason: 'Edge missing' }], /cannot resolve/);
});

test('rejects non-linear, basic, counted and differently oriented dimensions', () => {
  const a = linear('a', 10, pointZone);
  const b = linear('b', 10, pointZone);
  const round: DrawingDimension = { id: 'b', kind: 'diameter', edge: 'ring', near: [0, 0, 0], place: [0, 1], view: 'front', tol: pointZone };
  refuses('mm', terms, [a, { ok: true, kind: 'diameter', dim: round, center: [0, 0], radius: 5, value: 10, text: 'Ø10' }], /must be linear/);
  refuses('mm', terms, [a, { ...b, dim: { ...b.dim, basic: true } }], /one size/);
  refuses('mm', terms, [a, { ...b, dim: { ...b.dim, count: 2 } }], /one size/);
  refuses('mm', terms, [a, { ...b, dim: { ...b.dim, orient: 'aligned' } }], /horizontal or vertical/);
  refuses('mm', terms, [a, { ...b, dim: { ...b.dim, orient: 'vertical' } }], /same orientation/);
  refuses('mm', terms, [a, { ...b, dim: { ...b.dim, view: 'right' } }], /same view/);
  assert.ok(calculateToleranceStack('mm', terms, [
    { ...a, dim: { ...a.dim, orient: 'vertical' } }, { ...b, dim: { ...b.dim, orient: 'vertical' } },
  ]).ok);
});

test('rejects repeated authored endpoints and allows distinct edges with equal values', () => {
  const a = linear('a', 10, pointZone);
  const b = linear('b', 10, pointZone);
  assert.ok(calculateToleranceStack('mm', terms, [a, b]).ok);
  refuses('mm', terms, [a, { ...b, dim: { ...b.dim, a: a.dim.b, b: a.dim.a } }], /same points/);
});

test('rejects missing, malformed or nonphysical tolerances', () => {
  const a = linear('a', 10, pointZone);
  for (const value of [0, -1, NaN, Infinity]) {
    refuses('mm', terms, [a, linear('b', value, pointZone)], /finite positive length/);
  }
  refuses('mm', terms, [a, linear('b', 10)], /needs an explicit numeric tolerance/);
  refuses('mm', terms, [a, linear('b', 10, { kind: 'fit', code: 'H7' })], /uses a fit/);
  const badTolerances: readonly Tolerance[] = [
    { kind: 'symmetric', value: -1 }, { kind: 'symmetric', value: 0 }, { kind: 'symmetric', value: Infinity },
    { kind: 'deviation', lower: 0.1, upper: 0.03 }, { kind: 'deviation', lower: NaN, upper: 0 },
  ];
  for (const tolerance of badTolerances) {
    refuses('mm', terms, [a, linear('b', 10, tolerance)], /invalid tolerance/);
  }
  for (const lower of [-1, -2]) {
    refuses('mm', terms, [a, linear('b', 1, { kind: 'deviation', lower, upper: 1 })], /zero or negative size/);
  }
});
