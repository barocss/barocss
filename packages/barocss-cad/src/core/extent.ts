/**
 * Math.min / Math.max over an array without spreading it into arguments (no call-stack limit on mesh-sized arrays, no
 * argument copy). The same result as the spread form: NaN if any entry is NaN, −0 below +0, ±Infinity when empty.
 */
export function minOf(xs: ArrayLike<number>): number {
  let r = Infinity;
  for (let i = 0; i < xs.length; i++) { const x = xs[i]; if (x !== x) return NaN; if (x < r || (x === 0 && r === 0 && Object.is(x, -0))) r = x; }
  return r;
}
export function maxOf(xs: ArrayLike<number>): number {
  let r = -Infinity;
  for (let i = 0; i < xs.length; i++) { const x = xs[i]; if (x !== x) return NaN; if (x > r || (x === 0 && r === 0 && Object.is(r, -0))) r = x; }
  return r;
}
/** minOf / maxOf of coordinate k of a list of points. */
export function minAt(ps: readonly (ArrayLike<number>)[], k: number): number {
  let r = Infinity;
  for (let i = 0; i < ps.length; i++) { const x = ps[i][k]; if (x !== x) return NaN; if (x < r || (x === 0 && r === 0 && Object.is(x, -0))) r = x; }
  return r;
}
export function maxAt(ps: readonly (ArrayLike<number>)[], k: number): number {
  let r = -Infinity;
  for (let i = 0; i < ps.length; i++) { const x = ps[i][k]; if (x !== x) return NaN; if (x > r || (x === 0 && r === 0 && Object.is(r, -0))) r = x; }
  return r;
}
