// Analysis maps on the bodies (G6): a scalar per display vertex or triangle, its unit, range, thresholds and legend — what
// the viewer's colour map draws (Geometry.setScalars, Mesh.colorMap) and the legend shows. Worked out when a map is chosen
// or the bodies change, never per frame. IM4 thickness here; IM2 draft and CNC access when their exports land (O-G6).
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { wallSamples } from '@barocss/cad-model/chat/analysis';

export interface ScalarMap {
  /** The body (BodyResult.key) it colours. */
  body: string;
  per: 'vertex' | 'triangle';
  /** One a display vertex or triangle; NaN where there is none. */
  values: Float32Array;
  unit: string;
  range: [number, number];
  thresholds: { value: number; label: string }[];
  legend: { title: string; stops: [number, string][] };
  below?: string; above?: string; missing?: string;
}
export type MapKind = 'thickness';

/** The area-weighted q-quantile of the finite values (as the wall report's). */
function quantile(v: ArrayLike<number>, w: ArrayLike<number>, q: number): number | null {
  const idx: number[] = []; for (let i = 0; i < v.length; i++) if (Number.isFinite(v[i]) && w[i] > 0) idx.push(i);
  if (!idx.length) return null;
  idx.sort((a, b) => v[a] - v[b]);
  const total = idx.reduce((s, i) => s + w[i], 0);
  let acc = 0; for (const i of idx) { acc += w[i]; if (acc >= q * total) return v[i]; }
  return v[idx[idx.length - 1]];
}

/**
 * IM4's wall thickness, per display triangle (mm): the local thickness of its wall samples (the inscribed sphere on the
 * inward ray; none where the ray finds no wall). Thin red, the nominal (the area-weighted median) green, the thick-section
 * limit (nominal over the adjacent-wall ratio, as the wall report's, 0.6 by default) orange; past it purple.
 */
export function thicknessMap(body: BodyResult, ratio = 0.6): ScalarMap {
  const w = wallSamples(body), values = new Float32Array(w.local.length);
  for (let t = 0; t < values.length; t++) values[t] = Number.isFinite(w.local[t]) ? w.local[t] : NaN;
  const nominal = quantile(w.local, w.area, 0.5) ?? 1, limit = nominal / ratio;
  const stops: [number, string][] = [[0, '#d7301f'], [nominal, '#31a354'], [limit, '#fd8d3c']];
  return {
    body: body.key, per: 'triangle', values, unit: 'mm', range: [0, limit],
    thresholds: [{ value: nominal, label: 'nominal' }, { value: limit, label: `thick (nominal / ${ratio})` }],
    legend: { title: 'Wall thickness', stops }, above: '#7b3294', missing: '#808080',
  };
}

/** The maps of a kind for the bodies shown. */
export function mapsOf(kind: MapKind, bodies: readonly BodyResult[]): ScalarMap[] {
  return kind === 'thickness' ? bodies.map(b => thicknessMap(b)) : [];
}
