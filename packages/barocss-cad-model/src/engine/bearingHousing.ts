// A9-7's geometry seam only. Assembly references and their saved schema are separate.
import { seatedBearing, transformBrep, type BearingFitClasses, type BearingRow, type Brep, type BrepAffine, type PlacedShaft } from '@barocss/cad';
import { refusal } from './refusal';

/** The existing placementOf result: local point -> assembly point, row-major rigid rotation. */
export interface HousingPose { m: readonly number[]; t: readonly number[] }

function checkedPose(pose: HousingPose, label: string): void {
  const bad = () => { throw refusal('BEARING_HOUSING_POSE', `${label} must be a finite rigid pose`); };
  if (!pose || !Array.isArray(pose.m) || !Array.isArray(pose.t) || pose.m.length !== 9 || pose.t.length !== 3 || ![...pose.m, ...pose.t].every(Number.isFinite)) bad();
  const m = pose.m;
  for (let i = 0; i < 3; i++) for (let j = i; j < 3; j++) {
    const dot = m[3 * i] * m[3 * j] + m[3 * i + 1] * m[3 * j + 1] + m[3 * i + 2] * m[3 * j + 2];
    if (Math.abs(dot - (i === j ? 1 : 0)) > 1e-8) bad();
  }
  const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  if (Math.abs(det - 1) > 1e-8) bad();
}

/** Target-local -> owner-local. Both poses must come from the same current assembly. */
export function relativeHousingPose(owner: HousingPose, target: HousingPose): BrepAffine {
  checkedPose(owner, 'bearing owner'); checkedPose(target, 'housing target');
  const a = owner.m, b = target.m, matrix: [number, number, number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const delta = target.t.map((v, i) => v - owner.t[i]), offset: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) matrix[3 * i + j] = a[i] * b[j] + a[3 + i] * b[3 + j] + a[6 + i] * b[6 + j];
    offset[i] = a[i] * delta[0] + a[3 + i] * delta[1] + a[6 + i] * delta[2];
  }
  if (![...matrix, ...offset].every(Number.isFinite)) throw refusal('BEARING_HOUSING_POSE', 'the relative housing pose is not finite');
  return { matrix, offset };
}

/** Reuse the native seat/housing/fit checks with the actual current exact target in the owner's frame. */
export function bearingInExternalHousing(input: {
  row: BearingRow;
  shaft: PlacedShaft & { readonly brep: Brep };
  ownerPose: HousingPose;
  target?: { readonly brep: Brep; readonly pose: HousingPose };
  step: number; against: 'start' | 'end'; fit?: BearingFitClasses; id: string;
}): ReturnType<typeof seatedBearing> {
  if (!input.target?.brep) throw refusal('BEARING_HOUSING_REFERENCE', 'the current exact housing body is required');
  const housing = transformBrep(input.target.brep, relativeHousingPose(input.ownerPose, input.target.pose));
  return seatedBearing(input.row, input.shaft, { step: input.step, against: input.against, housing, ...(input.fit ? { fit: input.fit } : {}) }, input.id);
}
