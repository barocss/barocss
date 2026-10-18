// LIB2 (D62): placing library parts by their interfaces, and the fits a library declares checked by building them.
// Two interfaces mate facing each other: b's frame turned and moved onto a's with its z against a's z and its x along
// a's x (y following), shifted by an offset in a's frame. A fit builds both parts, places b so, and measures their
// overlap with the exact Boolean: touching parts overlap by nothing.
import { booleanAnalytic } from './analytic-boolean.js';
import { brepMassProperties } from './solid-mass.js';
import { transformBrep } from './brep-transform.js';
import type { Brep } from './brep-core.js';
import { evaluateCadPart } from './part-model.js';
import { CadLibraryError, instantiateLibraryPart, type CadLibrary, type CadLibraryFitEnd, type CadLibraryInterface } from './library.js';

/** A rigid placement: p ↦ R p + t (R row-major 3 × 3). */
export interface LibraryPlacement { readonly rotation: readonly number[]; readonly translation: readonly [number, number, number] }
type V = [number, number, number];
const unitOf = (v: readonly unknown[]): V => { const a = v as number[], n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; };
const crossOf = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Where b goes so that its interface meets a's: R takes b's frame (x, y, z) to (x_a, −y_a, −z_a) — facing — and t puts
 * b's origin at a's moved by `offset` (along a's x, y, z). Frames in their parts' own coordinates; the result in a's.
 */
export function placeByInterfaces(a: CadLibraryInterface, b: CadLibraryInterface, offset: readonly number[] = [0, 0, 0]): LibraryPlacement {
  const za = unitOf(a.frame.z), xa = unitOf(a.frame.x), ya = crossOf(za, xa), zb = unitOf(b.frame.z), xb = unitOf(b.frame.x), yb = crossOf(zb, xb);
  // (Orthonormal: the x's made perpendicular to the z's on load; y = z × x.)
  const to: V[] = [xa, [-ya[0], -ya[1], -ya[2]], [-za[0], -za[1], -za[2]]], from: V[] = [xb, yb, zb], R: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R.push(to[0][i] * from[0][j] + to[1][i] * from[1][j] + to[2][i] * from[2][j]);
  const oa = a.frame.origin as number[], ob = b.frame.origin as number[];
  const t: V = [0, 1, 2].map(i => oa[i] + offset[0] * xa[i] + offset[1] * ya[i] + offset[2] * za[i] - (R[3 * i] * ob[0] + R[3 * i + 1] * ob[1] + R[3 * i + 2] * ob[2])) as V;
  return { rotation: R, translation: t };
}

/** One end built: its bodies (the part's outputs) and its interface. */
function build(lib: CadLibrary, end: CadLibraryFitEnd, prefix: string): { breps: Brep[]; itf: CadLibraryInterface; warnings: readonly string[] } {
  const inst = instantiateLibraryPart(lib, end.part, { ...(end.variant ? { variant: end.variant } : {}), ...(end.params ? { params: end.params } : {}), prefix });
  const itf = inst.interfaces.find(i => i.id === end.interface);
  if (!itf) throw new CadLibraryError('REFERENCE', `${lib.manifest.id}/${end.part}`, `interface ${end.interface} is not there for these values`);
  const result = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: inst.features });
  return { breps: inst.outputs.map(o => result.output(o).brep), itf, warnings: inst.warnings };
}

/**
 * A fit's result: the overlap as placed; whether the parts touch — pushed `contactProbeMM` further into a (along −z of
 * a's interface) they overlap — so a fit is not passed by parts standing apart; ok when both hold.
 */
export interface LibraryFitReport { readonly id: string; readonly overlapMM3: number; readonly maxOverlapMM3: number; readonly contact: boolean; readonly contactProbeMM: number; readonly ok: boolean; readonly placement: LibraryPlacement; readonly warnings: readonly string[] }

/** A declared fit (or one given): both parts built, b placed onto a, their overlap by the exact Boolean intersection. */
export function checkLibraryFit(lib: CadLibrary, fit: string | { readonly a: CadLibraryFitEnd; readonly b: CadLibraryFitEnd; readonly offset?: readonly number[]; readonly maxOverlapMM3?: number; readonly id?: string }): LibraryFitReport {
  const f = typeof fit === 'string' ? lib.manifest.fits?.find(x => x.id === fit) : fit;
  if (!f) throw new CadLibraryError('REFERENCE', lib.manifest.id, `no fit ${String(fit)}`);
  const A = build(lib, f.a, 'A'), B = build(lib, f.b, 'B'), offset = f.offset ?? [0, 0, 0], placement = placeByInterfaces(A.itf, B.itf, offset);
  const probe = 0.01, pushed = placeByInterfaces(A.itf, B.itf, [offset[0], offset[1], offset[2] - probe]);
  const overlap = overlapOf(A.breps, B.breps, placement), max = f.maxOverlapMM3 ?? 1e-6, contact = overlapOf(A.breps, B.breps, pushed) > max;
  return { id: f.id ?? 'fit', overlapMM3: overlap, maxOverlapMM3: max, contact, contactProbeMM: probe, ok: overlap <= max && contact, placement, warnings: [...A.warnings, ...B.warnings] };
}
/** The volume common to a's bodies and b's placed. */
function overlapOf(a: readonly Brep[], b: readonly Brep[], p: LibraryPlacement): number {
  let overlap = 0;
  for (const bb of b) {
    const moved = transformBrep(bb, { matrix: p.rotation as [number, number, number, number, number, number, number, number, number], offset: p.translation });
    for (const ab of a) { const common = booleanAnalytic(ab, moved, 'intersection'); if (common.bodies.length) overlap += brepMassProperties(common, 1).volumeMM3; }
  }
  return overlap;
}
