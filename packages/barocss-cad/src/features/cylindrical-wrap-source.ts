import { checkBrep, type Brep, type BrepFace } from '../brep/brep-core.js';
import type { CurveRegion2 } from '../brep/curved-arrangement.js';
import { kernelRefusal, isFrom, type KernelError } from '../core/barocss-error.js';
import { ownSnapshot, hasExactOwnFields, type OwnSnapshotSpec } from '../core/own-data.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import { extractSurfaceIsoCurve } from '../nurbs/surfaces/surface-isocurve.js';
import { splitSurfaceAtParameter } from '../nurbs/surfaces/surface-parameter-split.js';
import type { Part } from '../part/part-model.js';
import type { Curve, Surface } from '../types.js';
import { buildCylindricalWrapMap, certifyCylindricalWrapCarrier, type CylindricalWrapMap, type CylindricalWrapCarrierCertificate } from './cylindrical-wrap-map.js';
import { brepFromPrismatic, prismaticFromProfile, type PrismaticSolid } from './prismatic-solid.js';

export type CylindricalWrapSourceCode = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'SOURCE';
export type CylindricalWrapSourceError = KernelError & { readonly code: CylindricalWrapSourceCode };
export interface CylindricalWrapSourceOptions { readonly id: string; readonly mapTolerance: number }
export interface CylindricalWrapUVSourceOptions { readonly id: string }
interface CylindricalWrapSourceData {
  /** Independent copies of the actual cached source, never the comparison reconstruction. */
  readonly brep: Brep;
  readonly prismatic: PrismaticSolid;
  readonly face: BrepFace;
  readonly quarter: Surface;
  readonly boundary: Curve;
  readonly radius: number;
  readonly z: readonly [number, number];
  readonly proof: {
    readonly authority: 'native-prismatic-source-and-full-stored-brep-consistency';
    readonly comparison: 'all-own-fields-with-binary64-bits-and-array-order';
    readonly sourceId: string;
    readonly sourceBody: string;
    readonly sourceShell: string;
    readonly nativeSourceConsistency: true;
    /** The internal Part representation has no nominal producer-history brand. */
    readonly historicalProducerProvenance: false;
    readonly strictSourceValid: true;
    readonly fullNativeExterior: true;
    readonly extraction: 'direct-copy';
    readonly insertedKnots: 0;
    readonly originalDomain: readonly [0, 0.5];
    readonly wrappedSolid: false;
  };
}
export interface CylindricalWrapSource extends CylindricalWrapSourceData { readonly map: CylindricalWrapMap }
/** Native UV source only; no chart tolerance, arclength nodes or inverse is requested or returned. */
export interface CylindricalWrapUVSource extends CylindricalWrapSourceData { readonly carrier: CylindricalWrapCarrierCertificate }

const SOURCE = 'cylindrical-wrap-source';
function fail(code: CylindricalWrapSourceCode, detail: string): never {
  throw kernelRefusal(SOURCE, code, `Cylindrical wrap source: ${detail}`) as CylindricalWrapSourceError;
}
export function isCylindricalWrapSourceError(error: unknown): error is CylindricalWrapSourceError {
  try { return isFrom<CylindricalWrapSourceCode>(error, SOURCE); } catch { return false; }
}
function wrap(code: CylindricalWrapSourceCode, detail: string): never { return fail(code, detail); }
const SNAPSHOT: OwnSnapshotSpec<CylindricalWrapSourceCode> = {
  input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap, isRefusal: isCylindricalWrapSourceError,
};
function record(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INPUT', 'plain own source records are required');
  const data = value as Record<string, unknown>, keys = Object.keys(data);
  for (const key of required) if (!Object.hasOwn(data, key)) fail('INPUT', 'a source field is missing');
  for (const key of keys) if (!required.includes(key) && !optional.includes(key)) fail('SUPPORT', 'source fields outside the native cylinder family are unsupported');
  return data;
}
function array(value: unknown, count: number): unknown[] {
  if (!Array.isArray(value) || value.length !== count) fail('SUPPORT', 'the native source has an unsupported entity count');
  return value;
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > CadNumericPolicy.coordinateAbs) fail('INPUT', 'source coordinates must stay within the native CAD range');
  return value;
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,31}$/.test(value)) fail('INPUT', 'a bounded native extraction id is required');
  return value;
}
/** Every own field is compared, including names, senses, topology, pcurves and entity tolerances. */
function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const key of ka) if (!Object.hasOwn(b, key) || !sameData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  return true;
}
function circleRegion(input: unknown): { region: CurveRegion2; radius: number } {
  const data = record(input, ['outer', 'holes']);
  array(data.holes, 0);
  const outer = array(data.outer, 2);
  let radius: number | null = null;
  let expected: CurveRegion2['outer'] | null = null;
  const matched = [false, false];
  for (const item of outer) {
    const arc = record(item, ['kind', 'c', 'r', 't0', 'sweep'], ['tag']);
    if (arc.kind !== 'arc') fail('SUPPORT', 'only the original two circular half-arcs are supported');
    const center = array(arc.c, 2);
    if (center[0] !== 0 || center[1] !== 0) fail('SUPPORT', 'the source circle must be centered at the origin');
    const r = finite(arc.r);
    if (!(r >= 0.01) || (radius !== null && r !== radius)) fail('SUPPORT', 'one native radius in 0.01..10000 is required');
    radius = r;
    if (!expected) {
      // The native arrangement stores a slightly shifted second half. Compare its producer values;
      // never replace the actual source arcs or assume both stored angles are ideal Math.PI.
      expected = prismaticFromProfile({ outer: [{ kind: 'arc', start: [r, 0], center: [0, 0], direction: 'ccw' }], height: 1 }).slabs[0].regions[0].outer;
    }
    let found = -1;
    for (let i = 0; i < expected.length; i++) {
      const original = expected[i];
      if (!matched[i] && original.kind === 'arc' && arc.t0 === original.t0 && arc.sweep === original.sweep) { found = i; break; }
    }
    if (found < 0) fail('SUPPORT', 'the original native half-turn parameters are required exactly once');
    matched[found] = true;
    if (arc.tag !== undefined && (typeof arc.tag !== 'string' || arc.tag.length > 128)) fail('INPUT', 'a bounded source wall name is required');
  }
  if (!matched[0] || !matched[1] || radius === null) fail('SUPPORT', 'a complete original circular section is required');
  return { region: data as unknown as CurveRegion2, radius };
}
function sourceSnapshot(input: unknown): { part: Part; solid: PrismaticSolid; radius: number; z: [number, number] } {
  const data = record(ownSnapshot(input, false, SNAPSHOT), ['solid', 'brep']);
  const solidData = record(data.solid, ['kind'], ['solid', 'brep']);
  if (solidData.kind !== 'upright') fail('SUPPORT', 'only an unchanged native upright source is supported');
  if (!hasExactOwnFields(solidData, ['kind', 'solid'])) fail('INPUT', 'the upright source fields are incomplete');
  const solid = record(solidData.solid, ['kind', 'slabs', 'caps']);
  if (solid.kind !== 'prismatic-solid') fail('SUPPORT', 'a native prismatic source is required');
  const slab = record(array(solid.slabs, 1)[0], ['z0', 'z1', 'regions']);
  const z0 = finite(slab.z0), z1 = finite(slab.z1);
  if (!(z1 > z0)) fail('SUPPORT', 'one positive source Z slab is required');
  const { radius } = circleRegion(array(slab.regions, 1)[0]);
  let lower = false, upper = false;
  for (const item of array(solid.caps, 2)) {
    const cap = record(item, ['z', 'regions', 'tag']);
    if (typeof cap.tag !== 'string' || !cap.tag.length || cap.tag.length > 128) fail('INPUT', 'bounded original cap names are required');
    if (!sameData(cap.regions, slab.regions)) fail('SOURCE', 'cap regions must retain the original complete circular section');
    if (cap.z === z0 && !lower) lower = true;
    else if (cap.z === z1 && !upper) upper = true;
    else fail('SUPPORT', 'one original cap at each slab endpoint is required');
  }
  if (!lower || !upper) fail('SUPPORT', 'both original caps are required');
  return { part: data as unknown as Part, solid: solid as unknown as PrismaticSolid, radius, z: [z0, z1] };
}
function positiveCarrier(brep: Brep, radius: number, z: readonly [number, number]): BrepFace {
  let found: BrepFace | null = null;
  for (const face of brep.faces) {
    const surface = face.surface;
    if (surface.kind !== 'surface' || surface.degreeU !== 2 || surface.degreeV !== 1 || surface.controlPoints.length !== 5) continue;
    const p = surface.controlPoints;
    if (p[0][0][0] !== radius || p[0][0][1] !== 0 || !(p[1][0][1] > 0)) continue;
    if (found) fail('SOURCE', 'the original positive-Y carrier is ambiguous');
    if (face.sense !== 'forward') fail('SUPPORT', 'the selected original carrier must face radially outward');
    for (let i = 0; i < p.length; i++) {
      if (p[i][0][0] !== p[i][1][0] || p[i][0][1] !== p[i][1][1] || p[i][0][2] !== z[0] || p[i][1][2] !== z[1]
        || surface.weights[i][0] !== surface.weights[i][1]) fail('SOURCE', 'the original wall must remain an upright extrusion');
    }
    found = face;
  }
  if (!found) fail('SOURCE', 'the original positive-Y native cylinder carrier is missing');
  return found;
}

/** Shared original-source extraction. No nominal chart or inverse is built here. */
function sourceCore(input: Part, id: string): CylindricalWrapSourceData {
  const { part, solid, radius, z } = sourceSnapshot(input), brep = part.brep!;
  if (!brep || brep.format !== 'barocss-brep' || brep.version !== 0 || brep.lengthUnit !== 'mm'
    || !brep.source || brep.source.family !== 'prismatic-solid' || typeof brep.source.id !== 'string'
    || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(brep.source.id)) fail('SOURCE', 'the complete original native B-rep is required');
  // Rebuild only for comparison with the same source and id. Never return or substitute this reconstruction.
  let comparison: Brep;
  try { comparison = brepFromPrismatic(solid, { id: brep.source.id }); }
  catch { fail('SOURCE', 'the native source cannot reconstruct its original complete boundary'); }
  if (!sameData(brep, comparison)) fail('SOURCE', 'the original B-rep differs from its full native source boundary');
  const checked = checkBrep(brep, { strict: true });
  if (!checked.valid || brep.bodies.length !== 1 || brep.bodies[0].kind !== 'solid' || brep.shells.length !== 1 || !brep.shells[0].closed || brep.faces.length !== 4) fail('SOURCE', 'one strict-valid closed original cylinder is required');
  const face = positiveCarrier(brep, radius, z);
  if (face.surface.kind !== 'surface') fail('SOURCE', 'an original NURBS carrier is required');
  const split = splitSurfaceAtParameter(face.surface, { axis: 'u', parameter: 0.5, lowerSurfaceId: `${id}_quarter`, upperSurfaceId: `${id}_unused` });
  if (split.provenance.refinement.kind !== 'direct-copy' || split.provenance.refinement.insertions !== 0) fail('SOURCE', 'quarter extraction must directly copy original rows');
  const quarter = split.lower;
  if (!sameData(quarter.knotsU, [0, 0, 0, 0.5, 0.5, 0.5])) fail('SOURCE', 'the original quarter domain must remain [0,0.5]');
  const boundary = extractSurfaceIsoCurve(quarter, { fixedAxis: 'v', parameter: quarter.knotsV[1], curveId: `${id}_boundary` }).curve;
  return { brep, prismatic: solid, face, quarter, boundary, radius, z,
    proof: { authority: 'native-prismatic-source-and-full-stored-brep-consistency', comparison: 'all-own-fields-with-binary64-bits-and-array-order',
      sourceId: brep.source.id, sourceBody: brep.bodies[0].id, sourceShell: face.shell,
      nativeSourceConsistency: true, historicalProducerProvenance: false, strictSourceValid: true, fullNativeExterior: true,
      extraction: 'direct-copy', insertedKnots: 0, originalDomain: [0, 0.5], wrappedSolid: false } };
}


/** Private full-map admission. Existing inverse-map support, tolerance and budget rules remain unchanged. */
export function buildCylindricalWrapSource(input: Part, options: CylindricalWrapSourceOptions): CylindricalWrapSource {
  const optionData = record(ownSnapshot(options, false, SNAPSHOT), ['id', 'mapTolerance']);
  if (!hasExactOwnFields(optionData, ['id', 'mapTolerance'])) fail('INPUT', 'only extraction id and map tolerance are accepted');
  const id = identifier(optionData.id);
  if (typeof optionData.mapTolerance !== 'number' || !(optionData.mapTolerance > 0)) fail('INPUT', 'a positive finite map tolerance is required');
  const { brep, prismatic, face, quarter, boundary, radius, z, proof } = sourceCore(input, id);
  const map = buildCylindricalWrapMap(boundary, { radius, tolerance: optionData.mapTolerance });
  return { brep, prismatic, face, quarter, boundary, map, radius, z, proof };
}

/** Private native-UV admission. Coefficient certification does not satisfy an inverse-map request. */
export function buildCylindricalWrapUVSource(input: Part, options: CylindricalWrapUVSourceOptions): CylindricalWrapUVSource {
  const optionData = record(ownSnapshot(options, false, SNAPSHOT), ['id']);
  if (!hasExactOwnFields(optionData, ['id'])) fail('INPUT', 'only an extraction id is accepted by the native-UV source');
  const source = sourceCore(input, identifier(optionData.id));
  const carrier = certifyCylindricalWrapCarrier(source.boundary, { radius: source.radius });
  return { ...source, carrier };
}
