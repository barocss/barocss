// Structural equality of plain data (JSON-like values: arrays, plain objects, primitives), shared by the
// schema-1 modules that re-check an input or a report against an expected copy. Arrays match only
// arrays of the same length, objects need the same own keys, and leaves compare with Object.is (so NaN
// equals NaN and 0 differs from -0).
export function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => same(value, b[index]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key]));
  }
  return Object.is(a, b);
}
