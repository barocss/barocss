import type { ClearancePair } from '@barocss/cad-model/team/clearanceMap';
import { CLEARANCE_MAP_VERSION } from '@barocss/cad-model/team/clearanceMap';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

/** Ephemeral analysis output. Geometry and fields keep the Model API's local body frame. */
export interface ClearanceOverlay {
  id: string;
  bodyKey: string;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  colors: Float32Array;
  field?: Float32Array;
  model: Float64Array;
  state: ClearancePair['state'] | 'pending' | 'refused';
  hatched: boolean;
  opacity: number;
}
export interface ClearanceDisplay {
  version: typeof CLEARANCE_MAP_VERSION;
  request: number;
  revision: string;
  /** The near band, in mm. */
  near: number;
  stage: 'evaluating' | 'map' | 'bands' | 'overlaps' | 'ready' | 'error';
  pairs: readonly ClearancePair[];
  overlays: readonly ClearanceOverlay[];
  /** World-space section; overlays clip with the same kept side/cutout as their solids. */
  clip?: { planes: readonly { normal: Vec3; offset: number }[]; cutout: boolean };
  error?: string;
}

export type ClearanceDrawGeometry = Pick<ClearanceOverlay, 'positions' | 'normals' | 'indices' | 'colors'>;
/** Clip drawing triangles without caps. The exact Model field on the original overlay is never rewritten. */
export function clipClearanceGeometry(overlay: ClearanceOverlay, clip: ClearanceDisplay['clip']): ClearanceDrawGeometry {
  if (!clip?.planes.length) return overlay;
  const out: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
  // Local position, normal and display colour; intersection colours use the same interpolation as rasterization.
  const vertex = (index: number) => [...overlay.positions.subarray(index * 3, index * 3 + 3), ...overlay.normals.subarray(index * 3, index * 3 + 3), ...overlay.colors.subarray(index * 3, index * 3 + 3)];
  const distance = (v: number[], p: NonNullable<ClearanceDisplay['clip']>['planes'][number]) => {
    const m = overlay.model, x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
    return p.normal[0] * x + p.normal[1] * y + p.normal[2] * z - p.offset;
  };
  const cut = (polygon: number[][], plane: NonNullable<ClearanceDisplay['clip']>['planes'][number], sign: number) => {
    const result: number[][] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = sign * distance(a, plane), db = sign * distance(b, plane);
      // The kept piece owns the boundary. A coplanar triangle must not enter a later cutout piece again.
      const insideA = sign > 0 ? da >= 0 : da > 0, insideB = sign > 0 ? db >= 0 : db > 0;
      if (insideA) result.push(a);
      if (insideA !== insideB) { const t = da / (da - db); result.push(a.map((value, k) => value + t * (b[k] - value))); }
    }
    return result;
  };
  const append = (polygon: number[][]) => {
    for (let i = 1; i + 1 < polygon.length; i++) {
      const tri = [polygon[0], polygon[i], polygon[i + 1]];
      for (const v of tri) { indices.push(out.length / 3); out.push(...v.slice(0, 3)); normals.push(...v.slice(3, 6)); colors.push(...v.slice(6, 9)); }
    }
  };
  for (let t = 0; t + 2 < overlay.indices.length; t += 3) {
    let polygon = [vertex(overlay.indices[t]), vertex(overlay.indices[t + 1]), vertex(overlay.indices[t + 2])];
    if (clip.cutout) {
      for (const plane of clip.planes) { append(cut(polygon, plane, 1)); polygon = cut(polygon, plane, -1); if (!polygon.length) break; }
    } else { for (const plane of clip.planes) polygon = cut(polygon, plane, 1); append(polygon); }
  }
  return { positions: Float32Array.from(out), normals: Float32Array.from(normals), indices: Uint32Array.from(indices), colors: Float32Array.from(colors) };
}
