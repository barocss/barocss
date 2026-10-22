// K5 (D144): three small generic routines moved down from the studio — a polygonal section's area, centroid and second
// moments by Green's theorem (the RB9 beam rung's, O73), a symmetric 3 × 3's eigenvalues and eigenvectors by cyclic
// Jacobi rotations (the robot track's inertia, RM, and the kernel's own mesh offset), and a closed triangle mesh's
// signed volume by the divergence theorem (the lattice's, AM7). Each is exact to rounding; none allocates per element.

export type Vector3 = [number, number, number];
/** A 3 × 3 matrix, row-major. */
export type Matrix3 = [number, number, number, number, number, number, number, number, number];

/** A plane section: its area, centroid, and second moments about the centroid (∫(y − cy)² dA, ∫(x − cx)² dA, ∫(x − cx)(y − cy) dA), with the principal ones. */
export interface SectionProperties {
  readonly area: number; readonly centroid: readonly [number, number];
  readonly Ixx: number; readonly Iyy: number; readonly Ixy: number;
  /** The principal second moments (I1 ≥ I2) and the angle (radians, from +x) of I1's axis. */
  readonly I1: number; readonly I2: number; readonly angle: number;
  readonly loops: number;
}

/** Green's theorem on one loop: [A, ∫x dA, ∫y dA, ∫y² dA, ∫x² dA, ∫xy dA], signed by its orientation (anticlockwise positive). */
function green(loop: readonly (readonly [number, number])[]): [number, number, number, number, number, number] {
  let A = 0, Sx = 0, Sy = 0, Iyy = 0, Ixx = 0, Ixy = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, y0] = loop[i], [x1, y1] = loop[(i + 1) % loop.length], c = x0 * y1 - x1 * y0;
    A += c / 2; Sx += (x0 + x1) * c / 6; Sy += (y0 + y1) * c / 6;
    Iyy += (y0 * y0 + y0 * y1 + y1 * y1) * c / 12; Ixx += (x0 * x0 + x0 * x1 + x1 * x1) * c / 12;
    Ixy += (2 * x0 * y0 + x0 * y1 + x1 * y0 + 2 * x1 * y1) * c / 24;
  }
  return [A, Sx, Sy, Iyy, Ixx, Ixy];
}
/** Whether p is inside a loop (even–odd crossings of a ray along +x). */
function inside(p: readonly [number, number], loop: readonly (readonly [number, number])[]): boolean {
  let n = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) { const [xi, yi] = loop[i], [xj, yj] = loop[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) n = !n; }
  return n;
}

/**
 * A section of straight-edged loops (each a list of (x, y) corners, either orientation, closing on itself): a loop
 * inside an odd number of others is a hole. Area, centroid and second moments by Green's theorem; the principal moments
 * from the 2 × 2 tensor in closed form.
 */
export function polygonSectionProperties(loops: readonly (readonly (readonly [number, number])[])[]): SectionProperties {
  const sum = [0, 0, 0, 0, 0, 0];
  for (const l of loops) {
    if (l.length < 3) continue;
    const g = green(l);
    let depth = 0; for (const o of loops) if (o !== l && o.length >= 3 && inside(l[0], o)) depth++;
    const s = (g[0] < 0 ? -1 : 1) * (depth % 2 === 1 ? -1 : 1);
    for (let k = 0; k < 6; k++) sum[k] += s * g[k];
  }
  const [A, Sx, Sy, Iyy0, Ixx0, Ixy0] = sum, cx = Sx / A, cy = Sy / A;
  // (About the centroid: the parallel-axis theorem. Ixx is ∫(y − cy)², about the x axis; Iyy ∫(x − cx)².)
  const Ixx = Iyy0 - A * cy * cy, Iyy = Ixx0 - A * cx * cx, Ixy = Ixy0 - A * cx * cy;
  const m = (Ixx + Iyy) / 2, r = Math.hypot((Ixx - Iyy) / 2, Ixy);
  // (The second moment about the centroidal axis along θ is Ixx cos²θ + Iyy sin²θ − 2 Ixy sinθ cosθ = m + r cos(2θ − φ),
  // φ = atan2(−2Ixy, Ixx − Iyy): largest, I1, at θ = φ/2.)
  return { area: A, centroid: [cx, cy], Ixx, Iyy, Ixy, I1: m + r, I2: m - r, angle: Math.atan2(-2 * Ixy, Ixx - Iyy) / 2, loops: loops.length };
}

/**
 * A symmetric 3 × 3 matrix's eigen decomposition in place, by cyclic Jacobi rotations: A's diagonal becomes the
 * eigenvalues (unordered), V's columns the unit eigenvectors (row-major 3 × 3). Up to 50 sweeps; done when the
 * off-diagonal's square is 1e-30 of the diagonal's.
 */
export function symmetricEigen3InPlace(A: Float64Array | number[], V: Float64Array | number[]): void {
  V[0] = 1; V[1] = 0; V[2] = 0; V[3] = 0; V[4] = 1; V[5] = 0; V[6] = 0; V[7] = 0; V[8] = 1;
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = A[1] * A[1] + A[2] * A[2] + A[5] * A[5], scale = A[0] * A[0] + A[4] * A[4] + A[8] * A[8];
    if (!(off > 1e-30 * scale)) return;
    for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++) {
      const apq = A[3 * p + q];
      if (apq === 0) continue;
      const th = (A[3 * q + q] - A[3 * p + p]) / (2 * apq), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const akp = A[3 * k + p], akq = A[3 * k + q]; A[3 * k + p] = c * akp - s * akq; A[3 * k + q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = A[3 * p + k], aqk = A[3 * q + k]; A[3 * p + k] = c * apk - s * aqk; A[3 * q + k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = V[3 * k + p], vkq = V[3 * k + q]; V[3 * k + p] = c * vkp - s * vkq; V[3 * k + q] = s * vkp + c * vkq; }
    }
  }
}
/** A symmetric 3 × 3's eigenvalues (ascending) and unit eigenvectors (the columns of `vectors`, row-major, in the same order). */
export function symmetricEigen3(S: ArrayLike<number>): { readonly values: Vector3; readonly vectors: Matrix3 } {
  const A = Array.from({ length: 9 }, (_, i) => S[i]), V = new Array<number>(9);
  symmetricEigen3InPlace(A, V);
  const order = [0, 1, 2].sort((i, j) => A[i * 4] - A[j * 4]);
  return { values: [A[order[0] * 4], A[order[1] * 4], A[order[2] * 4]], vectors: [0, 1, 2].flatMap(r => order.map(i => V[r * 3 + i])) as Matrix3 };
}

/** A closed triangle mesh's signed volume (positive when its triangles face out): Σ a·(b × c) / 6. */
export function meshVolume(positions: ArrayLike<number>, indices: ArrayLike<number>): number {
  const P = positions, I = indices; let v6 = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v6 += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v6 / 6;
}
