// R12c.5 (D159): O-ring glands — the groove cut from the user's ring row and gland sizes, the gland's arithmetic against
// guidance ranges that are data, and the ring as an exact torus whose free overlap with the sealing surface is measured.
//
// The ring is the user's row { id, dash?, insideDiameterMM, crossSectionMM, source | estimate } (none built in). The
// ranges are data too: by default D139's O2 (Fictiv's gland design guide) — squeeze 18–25 % radial (piston, rod), 20–30 %
// face; fill 75–85 %; stretch up to 5 % — flagged estimates (the owner: "O-링 범위 … 추정값으로 표시해"), the user's own
// ranges with their source taking their place.
// - piston: the groove in a shaft's cylinder, sealing on a bore (sealDiameter the bore's Ø): its depth h = (D_bore − D_g)/2,
//   the ring stretched on the groove's bottom, stretch (D_g − ID)/ID.
// - rod: the groove in a bore, sealing on a rod (sealDiameter the rod's Ø): h = (D_g − D_rod)/2, stretch (D_rod − ID)/ID.
// - face: an annular groove into a flat face, h its depth, its inner Ø D_g, stretch (D_g − ID)/ID.
// The stretched ring keeps its volume 2π²Rr²: r'²(R_b + r') = r²(ID/2 + r), R_b the radius it lies on. Squeeze (CS − h)/CS
// nominal and stretched; fill πCS'²/4 over w·h; at the fit's extremes when the seal and the groove have classes (R12c.2),
// the depth's range and so the squeeze's. Errors GLAND_DIMENSIONS: no depth, squeeze ≤ 0, fill ≥ 100 %, the groove through
// the part's wall or off its face. Warnings SQUEEZE_RANGE, FILL_RANGE, STRETCH_RANGE against the ranges.
import type { Brep } from '../brep-core.js';
import { booleanAnalytic, faceGeometry } from '../analytic-boolean.js';
import { brepMassProperties } from '../solid-mass.js';
import { transformBrep, type BrepAffine } from '../brep-transform.js';
import { evaluateCadPart } from '../part/part-model.js';
import { lookupFit, FitError, type FitTable } from './fits.js';
import type { Point } from '../types.js';

export type GlandCode = 'INVALID_INPUT' | 'GLAND_DIMENSIONS' | 'SQUEEZE_RANGE' | 'FILL_RANGE' | 'STRETCH_RANGE';
export class GlandError extends Error {
  constructor(readonly code: GlandCode, detail: string) { super(`gland: ${detail}`); this.name = 'GlandError'; }
}
const fail = (code: GlandCode, detail: string): never => { throw new GlandError(code, detail); };
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const pct = (x: number) => +(100 * x).toFixed(3);
const mm = (x: number) => +x.toFixed(6);

export interface ORingRow { readonly id: string; readonly dash?: string; readonly insideDiameterMM: number; readonly crossSectionMM: number; readonly source?: string; readonly estimate?: boolean }
export interface GlandRanges { readonly squeezePercent: readonly [number, number]; readonly fillPercent: readonly [number, number]; readonly stretchMaxPercent: number; readonly source?: string; readonly estimate?: boolean }
/** D139's O2 (Fictiv's O-ring groove design guide, read 2026-10-21): guidance ranges, shipped as estimates. */
export const O2_RANGES: { readonly radial: GlandRanges; readonly face: GlandRanges } = {
  radial: { squeezePercent: [18, 25], fillPercent: [75, 85], stretchMaxPercent: 5, source: 'Fictiv, O-Ring Groove (Gland) Design Guide (D139 O2): guidance', estimate: true },
  face: { squeezePercent: [20, 30], fillPercent: [75, 85], stretchMaxPercent: 5, source: 'Fictiv, O-Ring Groove (Gland) Design Guide (D139 O2): guidance', estimate: true },
};
export interface GlandSpec {
  readonly kind: 'piston' | 'rod' | 'face';
  readonly ring: ORingRow;
  /** piston: the groove's bottom Ø; rod: its bottom (outer) Ø; face: its inner Ø. */
  readonly grooveDiameterMM: number;
  readonly widthMM: number;
  /** piston: the bore's Ø; rod: the rod's Ø (radial glands). */
  readonly sealDiameterMM?: number;
  /** face: the groove's depth. */
  readonly depthMM?: number;
  readonly ranges?: GlandRanges;
  /** The seal's and the groove's classes (R12c.2): the depth at their extremes. */
  readonly fit?: { readonly tables: readonly FitTable[]; readonly seal?: string; readonly groove?: string };
}
export interface GlandReport {
  readonly kind: 'piston' | 'rod' | 'face'; readonly ring: string; readonly ringEstimate: boolean; readonly ringSource?: string;
  readonly insideDiameterMM: number; readonly crossSectionMM: number;
  readonly grooveDiameterMM: number; readonly widthMM: number; readonly depthMM: number; readonly sealDiameterMM?: number;
  readonly stretchPercent: number; readonly stretchedCrossSectionMM: number;
  readonly squeezePercent: number; readonly squeezeStretchedPercent: number; readonly fillPercent: number; readonly fillStretchedPercent: number;
  /** At the fit's extremes (stretched section): the least and the greatest squeeze. */
  readonly squeezeRangePercent?: readonly [number, number];
  readonly ranges: GlandRanges;
  readonly warnings: readonly { readonly code: 'SQUEEZE_RANGE' | 'FILL_RANGE' | 'STRETCH_RANGE'; readonly message: string }[];
}

/** Why an O-ring row is not one, or null. */
export function oringRowProblem(r: unknown): string | null {
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return 'an O-ring row is an object { id, dash?, insideDiameterMM, crossSectionMM, source | estimate }';
  const o = r as Record<string, unknown>, at = typeof o.id === 'string' && o.id.trim() ? `O-ring row ${o.id}` : '';
  if (!at) return 'an O-ring row needs an id';
  for (const k of Object.keys(o)) if (!['id', 'dash', 'insideDiameterMM', 'crossSectionMM', 'source', 'estimate'].includes(k)) return `${at}: unknown field ${k}`;
  for (const k of ['insideDiameterMM', 'crossSectionMM']) if (!(num(o[k]) && (o[k] as number) > 0)) return `${at}: ${k} must be a number of mm above 0`;
  if ((o.source !== undefined) === (o.estimate === true)) return `${at}: cite its source or say estimate: true — ${o.source !== undefined ? 'not both' : 'never neither'}`;
  return null;
}
function rangesProblem(r: GlandRanges): string | null {
  const ok2 = (v: unknown) => Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1]) && v[0] <= v[1];
  if (!ok2(r.squeezePercent) || !ok2(r.fillPercent) || !num(r.stretchMaxPercent)) return 'ranges are { squeezePercent: [lo, hi], fillPercent: [lo, hi], stretchMaxPercent, source | estimate }';
  if (r.source === undefined && !r.estimate) return 'ranges cite their source or say estimate: true';
  return null;
}

/** The section r' of a ring of section r and mean radius R once its mean radius is Rb + r' (volume kept). */
function stretched(r: number, R: number, Rb: number): number { let s = r; for (let i = 0; i < 80; i++) { const n = Math.sqrt(r * r * R / (Rb + s)); if (Math.abs(n - s) < 1e-15) return n; s = n; } return s; }

/** A gland's arithmetic: its depth, stretch, stretched section, squeeze, fill; checked against the ranges. */
export function glandCheck(spec: GlandSpec): GlandReport {
  const p = oringRowProblem(spec.ring); if (p) fail('INVALID_INPUT', p);
  const k = spec.kind; if (k !== 'piston' && k !== 'rod' && k !== 'face') fail('INVALID_INPUT', `a gland is piston, rod or face (got ${String(k)})`);
  const Dg = spec.grooveDiameterMM, w = spec.widthMM;
  if (!(num(Dg) && Dg > 0 && num(w) && w > 0)) fail('GLAND_DIMENSIONS', 'the groove\'s diameter and width must be numbers of mm above 0');
  const ranges = spec.ranges ?? (k === 'face' ? O2_RANGES.face : O2_RANGES.radial), rp = rangesProblem(ranges); if (rp) fail('INVALID_INPUT', rp);
  const ID = spec.ring.insideDiameterMM, CS = spec.ring.crossSectionMM, r = CS / 2, R = ID / 2 + r;
  let h: number, base: number, seal: number | undefined;
  if (k === 'face') { h = spec.depthMM ?? fail('GLAND_DIMENSIONS', 'a face gland needs its depth'); base = Dg / 2; }
  else {
    seal = spec.sealDiameterMM ?? fail('GLAND_DIMENSIONS', `a ${k} gland needs the ${k === 'piston' ? 'bore' : 'rod'}'s Ø it seals on`);
    h = k === 'piston' ? (seal! - Dg) / 2 : (Dg - seal!) / 2; base = k === 'piston' ? Dg / 2 : seal! / 2;
  }
  if (!(h > 0)) fail('GLAND_DIMENSIONS', `the gland has no depth (${mm(h)} mm): ${k === 'piston' ? 'the groove\'s bottom must be below the bore' : k === 'rod' ? 'the groove\'s bottom must be beyond the rod' : 'give a depth above 0'}`);
  const stretch = (2 * base - ID) / ID, rs = stretched(r, R, base), CSs = 2 * rs;
  const sq0 = (CS - h) / CS, sq = (CSs - h) / CSs, fill0 = Math.PI * CS * CS / 4 / (w * h), fill = Math.PI * CSs * CSs / 4 / (w * h);
  if (!(sq > 0)) fail('GLAND_DIMENSIONS', `the ring (its section ${mm(CSs)} mm stretched) is not squeezed in a gland ${mm(h)} deep: no seal`);
  if (!(fill < 1)) fail('GLAND_DIMENSIONS', `the ring fills ${pct(fill)} % of the groove (${mm(w)} × ${mm(h)}): it cannot fit`);
  // The fit's extremes: the depth between the seal's and the groove's limit sizes.
  let range: [number, number] | undefined;
  if (spec.fit && k !== 'face' && (spec.fit.seal || spec.fit.groove)) {
    const lim = (cls: string | undefined, size: number) => { if (!cls) return { min: size, max: size }; try { const l = lookupFit(spec.fit!.tables, cls, size); return { min: l.minMM, max: l.maxMM }; } catch (cause) { if (cause instanceof FitError) fail('GLAND_DIMENSIONS', cause.message); throw cause; } };
    const s = lim(spec.fit.seal, seal!), g = lim(spec.fit.groove, Dg);
    const hMin = k === 'piston' ? (s.min - g.max) / 2 : (g.min - s.max) / 2, hMax = k === 'piston' ? (s.max - g.min) / 2 : (g.max - s.min) / 2;
    range = [(CSs - hMax) / CSs, (CSs - hMin) / CSs];
    if (!(range[0] > 0)) fail('GLAND_DIMENSIONS', `at the fit's extremes the gland is ${mm(hMax)} deep: the ring is not squeezed (${pct(range[0])} %)`);
  }
  const warnings: GlandReport['warnings'][number][] = [], tag = ranges.estimate ? ' (an estimate)' : '';
  const sqLo = range ? range[0] : sq, sqHi = range ? range[1] : sq;
  if (100 * sqLo < ranges.squeezePercent[0] || 100 * sqHi > ranges.squeezePercent[1]) warnings.push({ code: 'SQUEEZE_RANGE', message: `squeeze ${range ? `${pct(sqLo)}–${pct(sqHi)}` : pct(sq)} % outside ${ranges.squeezePercent[0]}–${ranges.squeezePercent[1]} %${tag}` });
  if (100 * fill < ranges.fillPercent[0] || 100 * fill > ranges.fillPercent[1]) warnings.push({ code: 'FILL_RANGE', message: `fill ${pct(fill)} % outside ${ranges.fillPercent[0]}–${ranges.fillPercent[1]} %${tag}` });
  if (100 * stretch > ranges.stretchMaxPercent || stretch < 0) warnings.push({ code: 'STRETCH_RANGE', message: stretch < 0 ? `the ring's ID ${mm(ID)} is larger than the Ø${mm(2 * base)} it lies on: loose (${pct(stretch)} %)` : `stretch ${pct(stretch)} % above ${ranges.stretchMaxPercent} %${tag}` });
  return { kind: k, ring: spec.ring.id, ringEstimate: spec.ring.estimate === true, ...(spec.ring.source ? { ringSource: spec.ring.source } : {}), insideDiameterMM: ID, crossSectionMM: CS,
    grooveDiameterMM: Dg, widthMM: w, depthMM: h, ...(seal !== undefined ? { sealDiameterMM: seal } : {}), stretchPercent: 100 * stretch, stretchedCrossSectionMM: CSs,
    squeezePercent: 100 * sq0, squeezeStretchedPercent: 100 * sq, fillPercent: 100 * fill0, fillStretchedPercent: 100 * fill, ...(range ? { squeezeRangePercent: [100 * range[0], 100 * range[1]] as const } : {}), ranges, warnings };
}

/** Where a gland stands: its axis (a point and direction), its groove's span along it, the side of the ring. */
export interface GlandPlace { readonly origin: Point; readonly axis: Point; readonly fromMM: number; readonly toMM: number; readonly ringCenterRadiusMM: number; readonly ringCenterAlongMM: number }

/** A part document's solid: one sketch extruded along its plane's normal. */
function prism(id: string, sketch: Record<string, unknown>, height: number): Brep {
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: `${id}s`, kind: 'sketch', ...sketch }, { id, kind: 'extrude', sketch: `${id}s`, height }] };
  return evaluateCadPart(doc as unknown as Parameters<typeof evaluateCadPart>[0]).output(id).brep;
}
const ring = (r: number) => [{ kind: 'arc', start: [r, 0], center: [0, 0], direction: 'ccw' }, { kind: 'arc', start: [-r, 0], center: [0, 0], direction: 'ccw' }];
const frameOf = (origin: Point, a: Point): BrepAffine => {
  const x: Point = Math.abs(a[2]) < 0.9 ? [a[1], -a[0], 0] : [0, a[2], -a[1]], n = Math.hypot(...x), u: Point = [x[0] / n, x[1] / n, x[2] / n];
  const v: Point = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  return { matrix: [u[0], v[0], a[0], u[1], v[1], a[1], u[2], v[2], a[2]], offset: origin };
};
const vol = (b: Brep) => brepMassProperties(b, 1, { quadratureSegments: 12 }).volumeMM3;

/** The gland's groove cut into `target` at its face, with the gland's check. */
export function glandCut(target: Brep, spec: GlandSpec & { readonly face: string; readonly atMM?: number; readonly centerMM?: Point }, id: string): { readonly brep: Brep; readonly report: GlandReport; readonly place: GlandPlace } {
  const report = glandCheck(spec);
  const face = target.faces.find(f => f.name === spec.face) ?? target.faces.find(f => f.name?.replace(/#\d+$/, '') === spec.face) ?? target.faces.find(f => f.id === spec.face) ?? fail('INVALID_INPUT', `no face ${spec.face}`);
  const g = faceGeometry(face), w = spec.widthMM, h = report.depthMM, Dg = spec.grooveDiameterMM;
  let tool: Brep, place: GlandPlace;
  if (spec.kind === 'face') {
    if (g.kind !== 'plane') fail('GLAND_DIMENSIONS', `${spec.face} is not flat: a face gland is cut into a flat face`);
    const pl = g as Extract<typeof g, { kind: 'plane' }>, n = [...pl.n] as Point, c = spec.centerMM ?? fail('INVALID_INPUT', 'a face gland needs its centre');
    const off = (c[0] - pl.o[0]) * n[0] + (c[1] - pl.o[1]) * n[1] + (c[2] - pl.o[2]) * n[2];
    if (Math.abs(off) > 1e-6) fail('GLAND_DIMENSIONS', `the gland's centre is ${mm(off)} mm off the face's plane`);
    const inward: Point = [-n[0], -n[1], -n[2]], origin: Point = [c[0] + n[0] * 1, c[1] + n[1] * 1, c[2] + n[2] * 1];
    tool = transformBrep(prism(`${id}__g`, { profile: 'circle', center: [0, 0], radius: Dg / 2 + w, holes: [ring(Dg / 2)], plane: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, h + 1), frameOf(origin, inward));
    place = { origin: c, axis: n, fromMM: -h, toMM: 0, ringCenterRadiusMM: Dg / 2 + report.stretchedCrossSectionMM / 2, ringCenterAlongMM: -h + report.stretchedCrossSectionMM / 2 };
  } else {
    if (g.kind !== 'cylinder') fail('GLAND_DIMENSIONS', `${spec.face} is not a cylinder: a ${spec.kind} gland is cut into one`);
    const cy = g as Extract<typeof g, { kind: 'cylinder' }>;
    if (spec.kind === 'piston' && cy.out !== 1) fail('GLAND_DIMENSIONS', `${spec.face} is a bore: a piston gland's groove is cut into a shaft's outside (a rod gland into a bore)`);
    if (spec.kind === 'rod' && cy.out !== -1) fail('GLAND_DIMENSIONS', `${spec.face} is a shaft's outside: a rod gland's groove is cut into a bore (a piston gland into a shaft)`);
    if (spec.kind === 'piston' && !(Dg < 2 * cy.r - 1e-9)) fail('GLAND_DIMENSIONS', `the groove's bottom Ø${mm(Dg)} is not below the face's Ø${mm(2 * cy.r)}`);
    if (spec.kind === 'rod' && !(Dg > 2 * cy.r + 1e-9)) fail('GLAND_DIMENSIONS', `the groove's bottom Ø${mm(Dg)} is not beyond the bore's Ø${mm(2 * cy.r)}`);
    // The face's extent along its axis; the groove from `at` within it.
    const a = [...cy.a] as Point, loops = new Set(face.loops), edges = new Map(target.edges.map(e => [e.id, e])), verts = new Map(target.vertices.map(v => [v.id, v.point]));
    let lo = Infinity, hi = -Infinity;
    for (const ce of target.coedges) if (loops.has(ce.loop)) for (const v of edges.get(ce.edge)!.vertices) { const q = verts.get(v)!, s = (q[0] - cy.c[0]) * a[0] + (q[1] - cy.c[1]) * a[1] + (q[2] - cy.c[2]) * a[2]; lo = Math.min(lo, s); hi = Math.max(hi, s); }
    const at = spec.atMM ?? fail('INVALID_INPUT', 'a radial gland needs its position (at, along the face from its start)');
    if (at < -1e-9 || at + w > hi - lo + 1e-9) fail('GLAND_DIMENSIONS', `the groove (${mm(at)} to ${mm(at + w)}) runs off the face (0 to ${mm(hi - lo)})`);
    const origin: Point = [cy.c[0] + a[0] * (lo + at), cy.c[1] + a[1] * (lo + at), cy.c[2] + a[2] * (lo + at)];
    const outer = spec.kind === 'piston' ? cy.r + 1 : Dg / 2, inner = spec.kind === 'piston' ? Dg / 2 : Math.max(cy.r - Math.min(1, cy.r / 2), cy.r / 2);
    tool = transformBrep(prism(`${id}__g`, { profile: 'circle', center: [0, 0], radius: outer, holes: [ring(inner)], plane: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, w), frameOf(origin, a));
    const rs = report.stretchedCrossSectionMM / 2;
    // (The free ring rests where it is stretched, centred along the groove: a piston's on the groove's bottom, the bore
    // displacing its outer side; a rod's on the rod (its stretch is on the rod, D163's fix), the groove's bottom
    // displacing its outer side. Either way its volume is the free ring's, 2π²(ID/2 + r)r².)
    place = { origin, axis: a, fromMM: 0, toMM: w, ringCenterRadiusMM: spec.kind === 'piston' ? Dg / 2 + rs : report.sealDiameterMM! / 2 + rs, ringCenterAlongMM: w / 2 };
  }
  const named = transformBrep(tool, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, () => `${id}.groove`);
  const brep = booleanAnalytic(target, named, 'difference');
  if (brep.bodies.length > target.bodies.length) fail('GLAND_DIMENSIONS', 'the groove cuts through the part\'s wall: it splits it');
  return { brep, report, place };
}

/** The O-ring in its gland as an exact torus (stretched section, at rest where it is stretched: a piston's groove bottom, a rod), and the free ring's overlap with what squeezes it (the bore, the rod gland's groove bottom, the face's flange) by the analytic Boolean. */
export function oringInGland(report: GlandReport, place: GlandPlace, id: string): { readonly brep: Brep; readonly overlapMM3: number } {
  const rs = report.stretchedCrossSectionMM / 2, Rc = place.ringCenterRadiusMM, sub = `${id}__t`;
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: `${sub}s`, kind: 'sketch', profile: 'circle', center: [Rc, place.ringCenterAlongMM], radius: rs, plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } },
    { id: sub, kind: 'revolve', sketch: `${sub}s`, axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }] };
  const local = transformBrep(evaluateCadPart(doc as unknown as Parameters<typeof evaluateCadPart>[0]).output(sub).brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, n => n.split(`${sub}.`).join(`${id}.`));
  // What squeezes it, in the gland's frame: beyond the bore (piston), beyond the groove's bottom (rod), above the face (face).
  let keep: Brep, overlap = 0;
  if (report.kind === 'piston') keep = prism(`${id}__b`, { profile: 'circle', center: [0, 0], radius: report.sealDiameterMM! / 2, plane: { origin: [0, 0, place.ringCenterAlongMM - 2 * rs - 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, 4 * rs + 2);
  else if (report.kind === 'rod') keep = prism(`${id}__b`, { profile: 'circle', center: [0, 0], radius: report.grooveDiameterMM / 2, plane: { origin: [0, 0, place.ringCenterAlongMM - 2 * rs - 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, 4 * rs + 2);
  else keep = prism(`${id}__b`, { profile: 'circle', center: [0, 0], radius: Rc + 2 * rs + 1, plane: { origin: [0, 0, place.ringCenterAlongMM - 2 * rs - 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, 2 * rs + 1 - place.ringCenterAlongMM);
  // (What is displaced: the ring less its side of the squeezing surface, measured directly.)
  try { const out = booleanAnalytic(local, keep, 'difference'); overlap = out.bodies.length ? vol(out) : 0; } catch (cause) { if (!(cause instanceof Error && /empty|no solid|nothing/i.test(cause.message))) throw cause; overlap = 0; }
  return { brep: transformBrep(local, frameOf(place.origin, place.axis)), overlapMM3: overlap };
}
