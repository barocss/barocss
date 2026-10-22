// Types for FRk3's independent section oracle (frk3-oracle.mjs): signed triangles and circular sectors, no kernel code.
export interface SectionMoments { readonly A: number; readonly c: readonly [number, number]; readonly Jxx: number; readonly Jyy: number; readonly Jxy: number }
export function sectionOracle(section: Record<string, unknown>): SectionMoments;
export function prismOracle(section: Record<string, unknown>, lengthMM: number, rho?: number): SectionMoments & { readonly volume: number; readonly mass: number; readonly inertia: readonly (readonly number[])[] };
