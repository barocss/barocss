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
import { draftSamples } from '@barocss/cad-model/mould/draft';
import { accessSamples } from '@barocss/cad-model/machining/access';
import { castingDraftLimits } from '@barocss/cad-model/casting/report';

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
export type MapKind = 'thickness' | 'draft' | 'access';

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

/**
 * The draft's least and recommended angles for the part (degrees), as its report reads them: an injection moulding's from
 * its surface finish (none without a finish set: the rule is unknown), a casting's from its alloy's family
 * (`castingDraftLimits`); null otherwise.
 */
export function draftLimits(doc: StudioDoc, bodies: readonly BodyResult[]): { minDeg: number; recDeg: number | null } | null {
  const profile = processProfile(doc.process);
  if (!profile) return null;
  if (profile.id === 'injection') { const f = doc.mould?.finish ? profile.finishes?.find(x => x.id === doc.mould!.finish) : undefined; return f ? { minDeg: f.draftMinDeg, recDeg: f.draftRecDeg ?? null } : null; }
  if (profile.id === 'die-casting' || profile.id === 'sand-casting') { const c = castingDraftLimits(doc, bodies, profile); return c ? { minDeg: c.minDeg, recDeg: c.recDeg } : null; }
  return null;
}

/**
 * IM2's draft per display vertex (degrees, signed: + releasing along the pull, − against it), from the exact normals
 * (`draftSamples`). With a least draft m: red where |draft| < m, + light to dark green from m to 2m, − light to dark blue,
 * saturating past ±2m, marks at ±m; without one (no finish, no casting alloy) only the diverging map, ±10°.
 */
export function draftMap(doc: StudioDoc, body: BodyResult, pull: readonly number[], limits: { minDeg: number; recDeg: number | null } | null): ScalarMap {
  const values = draftSamples(doc, body, pull), m = limits?.minDeg ?? 0, eps = 1e-6;
  const stops: [number, string][] = m > 0
    ? [[-2 * m, '#08519c'], [-m, '#9ecae1'], [-m + eps, '#d7301f'], [m - eps, '#d7301f'], [m, '#a1d99b'], [2 * m, '#006d2c']]
    : [[-10, '#08519c'], [0, '#f0f0f0'], [10, '#006d2c']];
  const lo = stops[0][0], hi = stops[stops.length - 1][0];
  return {
    body: body.key, per: 'vertex', values, unit: '°', range: [lo, hi],
    thresholds: m > 0 ? [{ value: -m, label: `− least draft (${m}°)` }, { value: m, label: `least draft (${m}°)` }] : [],
    legend: { title: 'Draft against the pull', stops }, below: stops[0][1], above: stops[stops.length - 1][1], missing: '#808080',
  };
}

/** CNC4's access per display triangle: the share of it no 3-axis direction reaches (`accessSamples`), 0 neutral, 1 red. */
export function accessMaps(bodies: readonly BodyResult[]): ScalarMap[] {
  return accessSamples(bodies).map(a => ({
    body: a.body, per: 'triangle' as const, values: a.unreachedShare, unit: 'share', range: [0, 1] as [number, number], thresholds: [],
    legend: { title: 'Not reached by a 3-axis mill', stops: [[0, '#c6dbef'], [0.5, '#fc9272'], [1, '#cb181d']] as [number, string][] }, missing: '#808080',
  }));
}

/** The maps of a kind for the bodies shown (draft needs the mould's pull: none without one). */
export function mapsOf(kind: MapKind, doc: StudioDoc, bodies: readonly BodyResult[]): ScalarMap[] {
  if (kind === 'thickness') return bodies.map(b => thicknessMap(doc, b));
  if (kind === 'access') return accessMaps(bodies);
  const pull = doc.mould?.pull;
  if (!pull) return [];
  const limits = draftLimits(doc, bodies);
  return bodies.map(b => draftMap(doc, b, pull, limits));
}
