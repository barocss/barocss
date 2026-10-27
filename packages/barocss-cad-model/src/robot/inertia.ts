// Link inertia (RM3, O16): each link's mass, centre of mass and inertia about it, in the link's own frame.
// A link's bodies (the part's, in its own coordinates, each at its material's density) are combined by mass, their
// inertias moved to the common centre by the parallel-axis theorem; the result is then expressed in the link frame:
//   I_L = Rᵀ · I_P · R     (R: the link frame's axes as columns in the part's coordinates),
// the centre as Rᵀ (c − o). SI units (kg, m, kg·m²) as URDF and MJCF take them. Checked: symmetric positive definite
// and the triangle inequality on the principal moments (I1 ≤ I2 + I3 …), each a typed problem when it fails.
// The link frame (what RM4 writes the child link in): the base link's part frame; a link on a moving joint, at the
// joint's point with Z along its axis and X the part's X square to it (else the part's Y); a fixed one, its part frame.
import { symmetricEigen3 } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { lookOf, materialIdOf } from '../app/bodies';
import { MATERIALS_DATA, materialData, materialOf, type WebSource } from '../library/materials';
import { rotationMatrix } from '../engine/placement';
import type { JointTree } from './joints';
import { KERNEL_DENSITY } from '../app/mass';

// (The one Mat3, engine/placement's: 9 numbers, row-major, its columns the frame's axes.)
import type { Mat3 } from '../engine/placement';
export type { Mat3 };
// (R7.3c, conventions §10.2: the one Vec3, engine/vec3's.)
export type V3 = import('../engine/vec3').Vec3;
export interface Frame { /** Origin, in the part's coordinates (mm). */ origin: V3; /** Axes as columns, in the part's coordinates. */ R: Mat3 }
export type InertiaCode = 'NO_BODY' | 'NO_VOLUME' | 'NOT_SPD' | 'TRIANGLE' | 'MATERIAL_ASSUMED';
export interface LinkInertia {
  link: string; part: string | null;
  massKg: number;
  /** The centre of mass in the link frame (m). */
  comM: V3;
  /** About the centre of mass, in the link frame (kg·m²), row major. */
  inertia: Mat3;
  /** Principal moments (ascending) and their axes (columns) in the link frame. */
  principal: { moments: V3; axes: Mat3 };
  frame: Frame;
  /** The bodies counted, each with its material and whether that was assumed. */
  bodies: {
    key: string; material: string; assumed: boolean; massKg: number;
    /** Calculation-time catalogue inputs for mass, not measured or native-inertia provenance. */
    materialSnapshot?: {
      bodyMaterialId: string | null; inputMaterialId: string | null; resolvedMaterialId: string;
      fallback: 'none' | 'unset' | 'unknown-id'; densityGPerCm3: number; catalogueDensityGPerCm3: number | null;
      /** Catalogue declarations, not a guarantee of agreement with runtime-used density or authenticity. */
      libraryVersion: string;
      densitySourceId: string | null; densitySourceText: string | null; densityPage?: WebSource;
      rowEstimate: boolean | null; basis: 'builtin-catalogue-not-measured';
    };
    inertiaSource?: 'mmgs-density-scaled' | 'callback-override';
  }[];
  issues: { code: InertiaCode; message: string }[];
}

const mul = (a: Mat3, b: Mat3): Mat3 => { const r = new Array(9).fill(0) as Mat3; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]; return r; };
const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const applyM = (m: Mat3, v: readonly number[]): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const unit = (v: V3): V3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
const crossV = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** The rotation `I_L = Rᵀ I R` (R's columns: the new axes in the old coordinates). */
export const rotateInertia = (I: Mat3, R: Mat3): Mat3 => mul(mul(transpose(R), I), R);

/** One body's mass (kg), centre (mm, part coordinates) and inertia about it (kg·m²) at its own material's density. */
function bodyMass(doc: StudioDoc, b: BodyResult): {
  m: number; c: V3; I: Mat3; material: string; assumed: boolean;
  materialSnapshot: NonNullable<LinkInertia['bodies'][number]['materialSnapshot']>;
  inertiaSource: NonNullable<LinkInertia['bodies'][number]['inertiaSource']>;
} | null {
  if (b.volume === null || !b.centroid || !b.inertia) return null;
  const id = materialIdOf(doc, b), mat = materialOf(id), density = mat.density, k = density / KERNEL_DENSITY;
  const row = materialData(mat.id), densitySourceId = row?.sources.density ?? null, page = row?.pages?.density, catalogueDensity = row?.density;
  const materialSnapshot: NonNullable<LinkInertia['bodies'][number]['materialSnapshot']> = {
    bodyMaterialId: lookOf(doc, b).material ?? null, inputMaterialId: id ?? null, resolvedMaterialId: mat.id,
    fallback: id === undefined ? 'unset' : id === mat.id ? 'none' : 'unknown-id',
    densityGPerCm3: density,
    catalogueDensityGPerCm3: typeof catalogueDensity === 'number' && Number.isFinite(catalogueDensity) ? catalogueDensity : null,
    // Version, source ID/text/page and row estimate are catalogue declarations, not runtime-density agreement or authenticity evidence.
    libraryVersion: MATERIALS_DATA.libraryVersion,
    densitySourceId, densitySourceText: densitySourceId === null ? null : MATERIALS_DATA.sources[densitySourceId] ?? null,
    ...(page ? { densityPage: { ...page } } : {}), rowEstimate: row?.estimate ?? null,
    basis: 'builtin-catalogue-not-measured',
  };
  // (Mass in kg as V · ρ · 1e-6, inertia in kg·m² as I · k · 1e-9 from g·mm²: its own units and order, so not app/mass's bodyMass.)
  return { m: b.volume * density * 1e-6, c: b.centroid, I: b.inertia.flat().map(x => x * k * 1e-9) as Mat3, material: mat.label, assumed: !id, materialSnapshot, inertiaSource: 'mmgs-density-scaled' };
}

/** A part's bodies combined (parallel axis), then in the frame: mass, centre, inertia, principal axes, the checks. */
export function linkInertia(link: string, part: string | null, doc: StudioDoc | null, bodies: readonly BodyResult[], frame: Frame, bodyInertia?: (body: BodyResult) => Mat3 | undefined): LinkInertia {
  const issues: LinkInertia['issues'] = [], counted: LinkInertia['bodies'] = [];
  const parts = doc ? bodies.map(b => {
    const mass = bodyMass(doc, b), native = mass && bodyInertia?.(b);
    return { b, mass: mass && native ? { ...mass, I: native, inertiaSource: 'callback-override' as const } : mass };
  }) : [];
  for (const { b, mass } of parts) if (!mass) issues.push({ code: 'NO_VOLUME', message: `${b.key} has no closed volume: its mass is not counted.` });
  const ok = parts.filter((p): p is { b: BodyResult; mass: NonNullable<ReturnType<typeof bodyMass>> } => !!p.mass);
  const M = ok.reduce((s, p) => s + p.mass.m, 0);
  if (!ok.length || !(M > 0)) {
    issues.push({ code: 'NO_BODY', message: part === null ? 'a dummy link of a joint chain: massless' : 'no body with a volume: massless' });
    return { link, part, massKg: 0, comM: [0, 0, 0], inertia: [0, 0, 0, 0, 0, 0, 0, 0, 0], principal: { moments: [0, 0, 0], axes: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, frame, bodies: [], issues };
  }
  // The common centre (mm), then each inertia moved to it: I + m (|d|² E − d dᵀ), d in metres.
  const c = [0, 1, 2].map(k => ok.reduce((s, p) => s + p.mass.m * p.mass.c[k], 0) / M) as V3;
  const I = [0, 0, 0, 0, 0, 0, 0, 0, 0] as Mat3;
  for (const { b, mass } of ok) {
    const d = [0, 1, 2].map(k => (mass.c[k] - c[k]) / 1000), dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) I[i * 3 + j] += mass.I[i * 3 + j] + mass.m * ((i === j ? dd : 0) - d[i] * d[j]);
    counted.push({ key: b.key, material: mass.material, assumed: mass.assumed, massKg: mass.m, materialSnapshot: mass.materialSnapshot, inertiaSource: mass.inertiaSource });
    if (mass.assumed) issues.push({ code: 'MATERIAL_ASSUMED', message: `${b.key} has no material set: ${mass.material} assumed.` });
  }
  const IL = rotateInertia(symmetrize(I), frame.R), com = applyM(transpose(frame.R), [c[0] - frame.origin[0], c[1] - frame.origin[1], c[2] - frame.origin[2]]).map(x => x / 1000) as V3;
  const e = symmetricEigen3(IL), [i1, i2, i3] = e.values, tol = 1e-9 * Math.max(Math.abs(i3), 1e-300);
  if (!(i1 > tol)) issues.push({ code: 'NOT_SPD', message: `its inertia is not positive definite (least principal moment ${i1.toExponential(3)} kg·m²)` });
  if (i3 > i1 + i2 + tol) issues.push({ code: 'TRIANGLE', message: `its principal moments break the triangle inequality (${i3.toExponential(4)} > ${i1.toExponential(4)} + ${i2.toExponential(4)})` });
  return { link, part, massKg: M, comM: com, inertia: IL, principal: { moments: e.values, axes: e.vectors }, frame, bodies: counted, issues };
}
const symmetrize = (m: Mat3): Mat3 => [m[0], (m[1] + m[3]) / 2, (m[2] + m[6]) / 2, (m[1] + m[3]) / 2, m[4], (m[5] + m[7]) / 2, (m[2] + m[6]) / 2, (m[5] + m[7]) / 2, m[8]];

/** The link frame of each link, in its part's own coordinates (see the head of this file). */
export function linkFrames(tree: JointTree, placementOf: (part: string) => { position: readonly number[]; rotation: readonly number[] } | null): Map<string, Frame> {
  const out = new Map<string, Frame>();
  for (const l of tree.links) {
    if (l.part === null) continue;
    const own = tree.joints.find(j => j.child === l.id), place = placementOf(l.part);
    const P = (place ? rotationMatrix(place.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1]) as Mat3, t = (place?.position ?? [0, 0, 0]) as V3;
    if (!own || own.type === 'fixed') { out.set(l.id, { origin: [0, 0, 0], R: [1, 0, 0, 0, 1, 0, 0, 0, 1] }); continue; }
    // (The joint's point and axis are world: back into the part's coordinates through its placement.)
    const Pt = transpose(P), z = unit(applyM(Pt, own.axis)), o = applyM(Pt, [own.origin[0] - t[0], own.origin[1] - t[1], own.origin[2] - t[2]]);
    // (X: the part's X with its part along Z taken off; the part's Y when Z is near its X.)
    const pick: V3 = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], along = pick[0] * z[0] + pick[1] * z[1] + pick[2] * z[2];
    const x = unit([pick[0] - along * z[0], pick[1] - along * z[1], pick[2] - along * z[2]]), y = crossV(z, x);
    out.set(l.id, { origin: o.map(v => (Math.abs(v) < 1e-12 ? 0 : v)) as V3, R: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]] });
  }
  return out;
}

/** Every link's inertia: `partOf(part)` gives a part's document and its bodies in its own coordinates. */
export function treeInertia(tree: JointTree, partOf: (part: string) => { doc: StudioDoc; bodies: readonly BodyResult[]; position: readonly number[]; rotation: readonly number[] } | null): LinkInertia[] {
  const frames = linkFrames(tree, p => partOf(p));
  return tree.links.map(l => {
    const p = l.part === null ? null : partOf(l.part);
    return linkInertia(l.id, l.part, p?.doc ?? null, p?.bodies ?? [], frames.get(l.id) ?? { origin: [0, 0, 0], R: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
  });
}
