// Mass properties as the Body panel shows them: a body's mass and inertia in its own material (the kernel
// works them out for aluminium; both scale with density), inertia about its centre of mass or another
// point (the parallel-axis rule), and several bodies' combined mass and centre of mass.
import type { BodyResult } from '../engine/evaluate';

type V3 = [number, number, number];
/** g/cm³: the density the kernel's mass and inertia are for (aluminium); a material's figures scale by its own over this. */
export const KERNEL_DENSITY = 2.7;
/** A volume's mass (g) at a density (g/cm³). */
export const massGOf = (volume: number, gPerCm3: number) => volume * gPerCm3 / 1000;

/** A body's mass (g) and inertia about its centre of mass (g·mm²) in a material of `gPerCm3`. */
export function bodyMass(b: BodyResult, gPerCm3: number): { mass: number; centroid: V3; inertia: number[][] } | null {
  if (b.volume === null || !b.centroid || !b.inertia) return null;
  // Kernel and public inertia are both g·mm²; only the density ratio changes the value.
  const k = gPerCm3 / KERNEL_DENSITY;
  return { mass: massGOf(b.volume, gPerCm3), centroid: b.centroid, inertia: b.inertia.map(r => r.map(v => v * k)) };
}
/** Inertia (g·mm²) moved from the centre of mass to `about`: I + m (|d|² E − d dᵀ), d from `about` to the centre. */
export function inertiaAbout(inertia: number[][], mass: number, centroid: V3, about: V3): number[][] {
  const m = mass, d = [0, 1, 2].map(i => centroid[i] - about[i]), dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  return inertia.map((r, i) => r.map((v, j) => v + m * ((i === j ? dd : 0) - d[i] * d[j])));
}
/** Several bodies together: their mass and centre of mass (each in its own material), and their box. */
export function combined(parts: { mass: number; centroid: V3 }[]): { mass: number; centroid: V3 } | null {
  const M = parts.reduce((t, p) => t + p.mass, 0); if (!(M > 0)) return null;
  return { mass: M, centroid: [0, 1, 2].map(k => parts.reduce((t, p) => t + p.mass * p.centroid[k], 0) / M) as V3 };
}
/** A figure to three significant digits (no exponent below a million). */
export const sig3 = (v: number, scale = 0) => { if (v === 0 || Math.abs(v) < 1e-6 * scale) return '0'; const p = Math.pow(10, Math.max(0, 2 - Math.floor(Math.log10(Math.abs(v))))); return String(Math.round(v * p) / p); };
