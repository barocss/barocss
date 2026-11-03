import { CadNumericPolicy, checkBrep, type Brep, type Curve } from '@barocss/cad';
import type { SketchNode } from '../engine/doc';
import { partBreps } from '../engine/evaluate';
import { isRefusal } from '../engine/refusal';
import type { Ctx } from './commands';
import { resolveNativeOffsetFace } from './nativeOffsetFace';

// These are shape limits, not missing ownership, broken incidence or invalid native geometry.
const unsupportedProfiles = new Set([
  'pick a native cardinal planar cap with an affine support.',
  'only native cardinal prism or cylinder caps are supported.',
  'holes and multiple face loops are not supported.',
  'the bounded native cap profile has at most 16 edges per face.',
  'a simple native right prism with 3 to 16 cap corners is required; partitioned faces are unsupported.',
  'the current native topology is outside the unpartitioned cap profile.',
  'the native cap must be strictly convex.',
  'the other cap is not a congruent native right-prism cap.',
  'the right prism must have native straight edges.',
  'drafted or slanted neighbouring faces are not supported.',
  'every prism support must be a native affine plane.',
]);
function finitePoint(point: readonly number[], physical = true): boolean {
  if (point.length !== 3) return false;
  for (const value of point) if (!Number.isFinite(value) || physical && Math.abs(value) > CadNumericPolicy.coordinateAbs) return false;
  return true;
}
function finiteKnots(knots: readonly number[], degree: number): boolean {
  for (let i = 0; i < knots.length; i++) if (!Number.isFinite(knots[i]) || i > 0 && knots[i] < knots[i - 1]) return false;
  return knots[degree] < knots[knots.length - degree - 1];
}
function finiteCurve(curve: Curve, physical = true): boolean {
  if (!Number.isSafeInteger(curve.degree) || curve.degree < 1 || curve.controlPoints.length <= curve.degree || curve.weights.length !== curve.controlPoints.length || curve.knots.length !== curve.controlPoints.length + curve.degree + 1) return false;
  for (const point of curve.controlPoints) if (!finitePoint(point, physical)) return false;
  if (!finiteKnots(curve.knots, curve.degree)) return false;
  for (const weight of curve.weights) if (!Number.isFinite(weight) || !(weight > 0)) return false;
  return true;
}
function finiteGeometry(brep: Brep): boolean {
  if (!brep.vertices.length || !brep.edges.length || !brep.faces.length) return false;
  for (const vertex of brep.vertices) if (!finitePoint(vertex.point)) return false;
  for (const edge of brep.edges) if (!finiteCurve(edge.curve)) return false;
  for (const coedge of brep.coedges) if (coedge.pcurve && !finiteCurve(coedge.pcurve, false)) return false;
  for (const face of brep.faces) {
    if (face.surface.kind !== 'surface') return false;
    const surface = face.surface, nu = surface.controlPoints.length, nv = surface.controlPoints[0]?.length ?? 0;
    if (!Number.isSafeInteger(surface.degreeU) || !Number.isSafeInteger(surface.degreeV) || surface.degreeU < 1 || surface.degreeV < 1 || nu <= surface.degreeU || nv <= surface.degreeV || surface.weights.length !== nu || surface.knotsU.length !== nu + surface.degreeU + 1 || surface.knotsV.length !== nv + surface.degreeV + 1) return false;
    for (let i = 0; i < nu; i++) {
      if (surface.controlPoints[i].length !== nv || surface.weights[i].length !== nv) return false;
      for (const point of surface.controlPoints[i]) if (!finitePoint(point)) return false;
      for (const weight of surface.weights[i]) if (!Number.isFinite(weight) || !(weight > 0)) return false;
    }
    if (!finiteKnots(surface.knotsU, surface.degreeU) || !finiteKnots(surface.knotsV, surface.degreeV)) return false;
  }
  return true;
}
function currentUnsupportedProfile(ctx: Ctx): boolean {
  const picked = ctx.selection.faces[0], body = ctx.bodies[picked.body], face = body.mesh.faces[picked.face];
  let brep: Brep | undefined, matches = 0;
  for (const candidate of partBreps(ctx.doc)) if (candidate.key === body.key) { brep = candidate.brep; matches++; }
  if (matches !== 1 || !brep) return false;
  let faces = 0;
  for (const candidate of brep.faces) if (candidate.id === face.id && candidate.name === face.name) faces++;
  return faces === 1 && finiteGeometry(brep) && checkBrep(brep, { strict: true }).valid;
}

/** Build-time correction for an owned native +Z polygon cap. Other profiles keep the existing route. */
export function nativeExtrudeFace(ctx: Ctx, fallback: SketchNode): SketchNode {
  const selection = ctx.selection;
  if (selection.faces.length !== 1 || selection.edges.length || selection.bodies.length || selection.sketches?.length || selection.vertices?.length || ctx.direct?.length) return fallback;
  const picked = selection.faces[0], body = ctx.bodies[picked.body], face = body?.mesh.faces[picked.face];
  if (!body?.ref || !face?.id || face.kind !== 'plane' || face.facet || !face.name || face.name.includes('+') || face.normal[0] !== 0 || face.normal[1] !== 0 || face.normal[2] !== 1) return fallback;
  if (fallback.profile !== 'loop' || fallback.holes?.length) return fallback;
  for (const segment of fallback.segments) if (segment.kind !== 'line') return fallback;
  try {
    const native = resolveNativeOffsetFace(ctx);
    if (native.axis !== 2 || native.sign !== 1 || native.kind !== 'polygon') return fallback;
    return structuredClone(native.sketch);
  } catch (error) {
    // Unsupported current geometry keeps the generic face profile. Stale identity must still refuse.
    if (isRefusal(error, 'VALUE') && unsupportedProfiles.has(error.message.replace(/^\[VALUE\] Offset face: /, '')) && currentUnsupportedProfile(ctx)) return fallback;
    throw error;
  }
}
