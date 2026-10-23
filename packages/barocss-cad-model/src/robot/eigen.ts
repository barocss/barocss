// A symmetric 3 × 3's eigenvalues by the trigonometric closed form (R4 B5': urdfCheck's and mjcfCheck's copies, the
// same operations in the same order). Not the kernel's symmetricEigen3: that is a Jacobi sweep, whose values differ
// in the last bits (999 of 1,000 random inertia tensors, worst relative 5.7e-15).
type V3 = [number, number, number];

/** The eigenvalues, ascending. */
export function symmetricEigenvalues3(a: number[]): V3 {
  const p1 = a[1] * a[1] + a[2] * a[2] + a[5] * a[5];
  if (p1 === 0) return [a[0], a[4], a[8]].sort((x, y) => x - y) as V3;
  const q = (a[0] + a[4] + a[8]) / 3, p2 = (a[0] - q) ** 2 + (a[4] - q) ** 2 + (a[8] - q) ** 2 + 2 * p1, p = Math.sqrt(p2 / 6);
  const b = a.map((x, i) => (x - (i % 4 === 0 ? q : 0)) / p), r = (b[0] * (b[4] * b[8] - b[5] * b[7]) - b[1] * (b[3] * b[8] - b[5] * b[6]) + b[2] * (b[3] * b[7] - b[4] * b[6])) / 2;
  const phi = r <= -1 ? Math.PI / 3 : r >= 1 ? 0 : Math.acos(r) / 3, e1 = q + 2 * p * Math.cos(phi), e3 = q + 2 * p * Math.cos(phi + 2 * Math.PI / 3);
  return [e3, 3 * q - e1 - e3, e1];
}
