// Gauss–Legendre nodes and weights, computed by Newton's method on the Legendre polynomial (one definition for the
// modules that integrate by it).

/** Gauss–Legendre nodes and weights on [0, 1]. */
export function gauss(n: number): { x: number[]; w: number[] } {
  const x: number[] = [], w: number[] = [];
  for (let i = 1; i <= n; i++) {
    let t = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), d = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = t;
      for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      d = n * (t * p1 - p0) / (t * t - 1);
      const dx = p1 / d; t -= dx;
      if (Math.abs(dx) < 1e-16) break;
    }
    x.push((1 - t) / 2); w.push(1 / ((1 - t * t) * d * d));
  }
  return { x, w };
}
