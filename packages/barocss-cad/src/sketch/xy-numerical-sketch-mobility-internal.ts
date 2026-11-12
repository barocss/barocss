import { factorQR } from './xy-numerical-sketch-solver-internal.js';

function dot(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, i) => sum + value * b[i], 0);
}

function backSubstitute(upper: readonly number[][], rhs: readonly number[]): number[] {
  const solution = Array(rhs.length).fill(0) as number[];
  for (let i = rhs.length - 1; i >= 0; i--) {
    let value = rhs[i];
    for (let j = i + 1; j < rhs.length; j++) value -= upper[i][j] * solution[j];
    solution[i] = value / upper[i][i];
  }
  return solution;
}

/** Orthonormal numerical nullspace of the undamped Jacobian, or no reliable classification. */
export function checkedNullspace(matrix: number[][], columns: number): {
  basis: number[][]; uncertainty: number; rank: number; threshold: number;
} | null {
  const { a, order, diagonals, rank, threshold } = factorQR(matrix, matrix.map(() => 0), columns);
  // Keep the solver's rank policy. Refuse when either side of its rank boundary is uncertain.
  if (!Number.isFinite(threshold) || diagonals.some((value, i) => i < rank ? value <= 16 * threshold : value >= threshold / 16)) return null;

  const norm = matrix.reduce((max, row) => Math.max(max, row.reduce((sum, value) => sum + Math.abs(value), 0)), 1);
  const roundoff = 32 * Number.EPSILON * Math.max(matrix.length, columns) * norm;
  const inverseRowSums = Array(rank).fill(0) as number[];
  for (let j = 0; j < rank; j++) {
    const inverseColumn = backSubstitute(a, inverseRowSums.map((_, i) => i === j ? 1 : 0));
    inverseColumn.forEach((value, i) => { inverseRowSums[i] += Math.abs(value); });
  }
  const inverseNorm = Math.max(1, ...inverseRowSums);
  if (!(roundoff * inverseNorm <= 1e-8)) return null;

  const basis: number[][] = [];
  for (let free = rank; free < columns; free++) {
    // In pivot order, solve R11 z = -R12 e, with one free coefficient equal to one.
    const leading = backSubstitute(a, inverseRowSums.map((_, i) => -a[i][free]));
    const vector = Array(columns).fill(0) as number[];
    leading.forEach((value, i) => { vector[order[i]] = value; });
    vector[order[free]] = 1;
    // Re-orthogonalize so that projection magnitudes are independent of the free-column basis.
    for (let pass = 0; pass < 2; pass++) for (const q of basis) {
      const projection = dot(vector, q);
      for (let i = 0; i < columns; i++) vector[i] -= projection * q[i];
    }
    const length = Math.hypot(...vector);
    if (!(length >= 1) || !Number.isFinite(length)) return null;
    basis.push(vector.map(value => value / length));
  }

  let residual = 0;
  for (const [i, q] of basis.entries()) {
    for (let j = 0; j <= i; j++) if (Math.abs(dot(q, basis[j]) - Number(i === j)) > 64 * Number.EPSILON * columns) return null;
    for (const row of matrix) residual = Math.max(residual, Math.abs(dot(row, q)));
  }
  const uncertainty = Math.max(64 * Number.EPSILON, inverseNorm * (roundoff + residual));
  return residual <= threshold / 8 && uncertainty <= 1e-8 ? { basis, uncertainty, rank, threshold } : null;
}
