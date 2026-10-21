// Analysis maps on the bodies (G6): a scalar per display vertex or triangle, its unit, range, thresholds and legend — what
// the viewer's colour map draws (Geometry.setScalars, Mesh.colorMap) and the legend shows. Worked out when a map is chosen
// or the bodies change, never per frame. IM4 thickness here (its thresholds from the moulding rules, as the outer lane
// named them, O-G6); IM2 draft and CNC access when their exports reach this branch.
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { wallSamples } from '@barocss/cad-model/chat/analysis';
import { wallsOf } from '@barocss/cad-model/mould/walls';
import { materialIdOf } from '@barocss/cad-model/app/bodies';
import { materialData, processProfile } from '@barocss/cad-model/library/materials';

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

/** Where the thickness map's thresholds come from (the moulding rules'): the process's thinnest wall and adjacent-wall ratio, the material's range's low end. */
export interface ThicknessLimits { minWallMM: number | null; materialLowMM: number | null; ratio: number }

/** The limits for a part's bodies by its process and their materials (IM4's rules, as the outer lane named them, O-G6). */
export function thicknessLimits(doc: StudioDoc, body: BodyResult): ThicknessLimits {
  const profile = processProfile(doc.process), id = materialIdOf(doc, body), range = id && doc.process === 'injection' ? materialData(id)?.wallMM?.injection : undefined;
  return { minWallMM: profile?.thresholds.minWall?.value ?? null, materialLowMM: range ? range[0] : null, ratio: profile?.thresholds.adjacentWallRatio?.value ?? 0.6 };
}

/**
 * IM4's wall thickness, per display triangle (mm): the local thickness of its wall samples (the inscribed sphere on the
 * inward ray; none where the ray finds no wall), over [0, max(2 × nominal, thick95)] from the wall report. Red under the
 * thinnest wall the process makes and under the material's moulding range's low end; green at the nominal; orange to the
 * thick-section limit (nominal over the process's adjacent-wall ratio); purple past it.
 */
export function thicknessMap(doc: StudioDoc, body: BodyResult, limits: ThicknessLimits = thicknessLimits(doc, body)): ScalarMap {
  const w = wallSamples(body), values = new Float32Array(w.local.length);
  for (let t = 0; t < values.length; t++) values[t] = Number.isFinite(w.local[t]) ? w.local[t] : NaN;
  const report = wallsOf(doc, [body], limits.ratio)[0], nominal = report?.nominalMM ?? 1, limit = nominal / limits.ratio;
  const hi = Math.max(2 * nominal, report?.thick95MM ?? 0, 1e-6), thin = Math.max(limits.minWallMM ?? 0, limits.materialLowMM ?? 0);
  // (Hard edges at the thresholds: two stops a hair apart.)
  const eps = 1e-6 * hi, stops: [number, string][] = [];
  if (thin > 0 && thin < nominal) stops.push([0, '#d7301f'], [thin, '#d7301f'], [thin + eps, '#c2e699']);
  else stops.push([0, '#c2e699']);
  stops.push([nominal, '#31a354']);
  if (limit < hi) stops.push([limit, '#fd8d3c'], [limit + eps, '#7b3294'], [hi, '#7b3294']);
  else stops.push([hi, '#fd8d3c']);
  const thresholds: ScalarMap['thresholds'] = [];
  if (limits.minWallMM !== null) thresholds.push({ value: limits.minWallMM, label: 'the process\'s thinnest' });
  if (limits.materialLowMM !== null) thresholds.push({ value: limits.materialLowMM, label: 'the material\'s range' });
  thresholds.push({ value: nominal, label: 'nominal' }, { value: limit, label: `thick (nominal / ${limits.ratio})` });
  return {
    body: body.key, per: 'triangle', values, unit: 'mm', range: [0, hi],
    thresholds: thresholds.filter(t => t.value >= 0 && t.value <= hi),
    legend: { title: 'Wall thickness', stops }, above: '#7b3294', missing: '#808080',
  };
}

/** The maps of a kind for the bodies shown. */
export function mapsOf(kind: MapKind, doc: StudioDoc, bodies: readonly BodyResult[]): ScalarMap[] {
  return kind === 'thickness' ? bodies.map(b => thicknessMap(doc, b)) : [];
}
