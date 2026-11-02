/** Private staged experiment: project a real cached tangent before warm apply. */
export type WarmVector = readonly [number, number, number];

export class WarmTransportError extends Error {
  readonly code = 'WARM_TRANSPORT_UNRESOLVED';
  constructor(readonly reason: string) {
    super(`WARM_TRANSPORT_UNRESOLVED: ${reason}`);
    this.name = 'WarmTransportError';
  }
}

export function transportWarmTangent(tangentNs: WarmVector, normal: WarmVector): [number, number, number] {
  const [tx, ty, tz] = tangentNs, [nx, ny, nz] = normal;
  if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(tz)
    || !Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) {
    throw new WarmTransportError('NONFINITE_INPUT');
  }
  const normalSquared = nx * nx + ny * ny + nz * nz;
  if (!(normalSquared > 0) || !Number.isFinite(normalSquared)) {
    throw new WarmTransportError('NORMAL_SQUARED_NOT_FINITE_POSITIVE');
  }
  // T cross n, followed by n cross (T cross n).
  const cx = ty * nz - tz * ny;
  const cy = tz * nx - tx * nz;
  const cz = tx * ny - ty * nx;
  const inverseNormalSquared = 1 / normalSquared;
  const x = (ny * cz - nz * cy) * inverseNormalSquared;
  const y = (nz * cx - nx * cz) * inverseNormalSquared;
  const z = (nx * cy - ny * cx) * inverseNormalSquared;
  if (!Number.isFinite(inverseNormalSquared)
    || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new WarmTransportError('NONFINITE_PROJECTION');
  }
  return [x, y, z];
}
