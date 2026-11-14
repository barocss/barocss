import { curveD1Evaluator, surfaceD1Evaluator } from '../core/derivatives.js';
import { curveDomain, surfaceDomain } from '../core/math.js';
import { add, cross, dist, dot, len, scale, unit } from '../core/vec3.js';
import { CadNumericPolicy, geometryScaleMM, linearToleranceMM } from '../numeric-policy.js';
import type { Curve, Point, Surface } from '../types.js';
import type { Brep, BrepCoedge, BrepFace } from './brep-core.js';

export type BrepEdgeContinuityRefusal =
  | 'edge-not-found'
  | 'invalid-incidence'
  | 'same-face-seam'
  | 'faceted-geometry'
  | 'missing-pcurve'
  | 'binding-mismatch'
  | 'derivative-unavailable';

interface FaceIdentity {
  readonly id: string;
  readonly name?: string;
}

export type BrepEdgeContinuityResult =
  | {
    readonly status: 'measured';
    readonly edgeId: string;
    readonly edgeName?: string;
    readonly faces: readonly [FaceIdentity, FaceIdentity];
    readonly sampleCount: number;
    readonly minimumAngleDegrees: number;
    readonly maximumAngleDegrees: number;
    readonly samples: readonly { readonly parameter: number; readonly angleDegrees: number }[];
  }
  | { readonly status: 'unsupported'; readonly edgeId: string; readonly reason: BrepEdgeContinuityRefusal };

const SAMPLE_COUNT = 8;

function findUnique<T extends { readonly id: string }>(items: readonly T[], id: string): T | undefined {
  let found: T | undefined;
  for (const item of items) {
    if (item.id !== id) continue;
    if (found) return undefined;
    found = item;
  }
  return found;
}

function faceAtUse(brep: Brep, use: BrepCoedge): BrepFace | undefined {
  const loop = findUnique(brep.loops, use.loop);
  if (!loop?.coedges.includes(use.id)) return undefined;
  const face = findUnique(brep.faces, loop.face);
  if (!face?.loops.includes(loop.id)) return undefined;
  return face;
}

function faceIdentity(face: BrepFace): FaceIdentity {
  return face.name === undefined ? { id: face.id } : { id: face.id, name: face.name };
}

function prepareSide(pcurve: Curve, surface: Surface, sense: BrepFace['sense']) {
  return {
    uvAt: curveD1Evaluator(pcurve),
    surfaceAt: surfaceD1Evaluator(surface),
    domain: surfaceDomain(surface),
    orientation: sense === 'forward' ? 1 : -1,
  };
}

// Rational evaluation can round an endpoint coordinate just outside its chart.
function chartParameter(parameter: number, [start, end]: readonly [number, number]): number | undefined {
  const rounding = 32 * Number.EPSILON * Math.max(Math.abs(start), Math.abs(end));
  if (parameter < start - rounding || parameter > end + rounding) return undefined;
  return Math.min(end, Math.max(start, parameter));
}

function orientedNormal(du: Point, dv: Point, orientation: number): Point | undefined {
  const uLength = len(du), vLength = len(dv);
  if (!(uLength > 0 && vLength > 0 && Number.isFinite(uLength) && Number.isFinite(vLength))) return undefined;
  const normal = cross(unit(du), unit(dv));
  const normalLength = len(normal);
  if (!(normalLength > CadNumericPolicy.relativeComparison)) return undefined;
  return scale(unit(normal), orientation);
}

/**
 * Sample the angle between the two oriented native face normals, in degrees.
 * Each interior sample needs two native pcurve point and derivative bindings.
 * Extrema describe the samples only. This is a local inspection of the selected edge.
 */
export function measureBrepEdgeContinuity(brep: Brep, edgeId: string): BrepEdgeContinuityResult {
  const refuse = (reason: BrepEdgeContinuityRefusal): BrepEdgeContinuityResult => ({ status: 'unsupported', edgeId, reason });
  const edge = findUnique(brep.edges, edgeId);
  if (!edge) return refuse('edge-not-found');

  const uses = brep.coedges.filter(use => use.edge === edge.id);
  if (uses.length !== 2) return refuse('invalid-incidence');
  const [first, second] = uses;
  if (first.id === second.id || first.twin !== second.id || second.twin !== first.id || first.sense === second.sense) {
    return refuse('invalid-incidence');
  }

  const firstFace = faceAtUse(brep, first), secondFace = faceAtUse(brep, second);
  if (!firstFace || !secondFace || firstFace.shell !== secondFace.shell) return refuse('invalid-incidence');
  const shell = findUnique(brep.shells, firstFace.shell);
  if (!shell?.faces.includes(firstFace.id) || !shell.faces.includes(secondFace.id)) return refuse('invalid-incidence');
  if (firstFace.id === secondFace.id) return refuse('same-face-seam');
  if (brep.source.family === 'mesh' || firstFace.surface.kind === 'facets' || secondFace.surface.kind === 'facets') {
    return refuse('faceted-geometry');
  }
  if (!first.pcurve || !second.pcurve) return refuse('missing-pcurve');
  if (!Number.isFinite(edge.tolerance) || edge.tolerance < 0) return refuse('binding-mismatch');

  try {
    const [start, end] = curveDomain(edge.curve);
    for (const pcurve of [first.pcurve, second.pcurve]) {
      const [pStart, pEnd] = curveDomain(pcurve);
      if (pStart !== start || pEnd !== end || pcurve.controlPoints.some(point => point[2] !== 0)) {
        return refuse('binding-mismatch');
      }
    }
    const edgeAt = curveD1Evaluator(edge.curve);
    const sides = [
      prepareSide(first.pcurve, firstFace.surface, firstFace.sense),
      prepareSide(second.pcurve, secondFace.surface, secondFace.sense),
    ];
    const tolerance = Math.min(edge.tolerance, linearToleranceMM(geometryScaleMM(edge.curve.controlPoints)));
    const samples: { parameter: number; angleDegrees: number }[] = [];
    let previous = start, minimumAngleDegrees = Infinity, maximumAngleDegrees = 0;

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const fraction = (i + 0.5) / SAMPLE_COUNT;
      const parameter = (1 - fraction) * start + fraction * end;
      if (!(previous < parameter && parameter < end)) return refuse('derivative-unavailable');
      previous = parameter;
      const world = edgeAt(parameter), speed = len(world.derivative);
      if (!(speed > 0 && Number.isFinite(speed))) return refuse('derivative-unavailable');

      const normals: Point[] = [], supportPoints: Point[] = [];
      for (const side of sides) {
        // Both pcurves use the edge's canonical parameter, even for a reversed coedge.
        const uv = side.uvAt(parameter);
        const u = chartParameter(uv.point[0], side.domain.u), v = chartParameter(uv.point[1], side.domain.v);
        if (u === undefined || v === undefined) return refuse('binding-mismatch');
        const support = side.surfaceAt(u, v);
        const chain = add(scale(support.du, uv.derivative[0]), scale(support.dv, uv.derivative[1]));
        const tangentError = dist(chain, world.derivative) / speed;
        if (!(dist(support.point, world.point) <= tolerance && tangentError <= CadNumericPolicy.relativeComparison)) {
          return refuse('binding-mismatch');
        }
        const normal = orientedNormal(support.du, support.dv, side.orientation);
        if (!normal) return refuse('derivative-unavailable');
        normals.push(normal);
        supportPoints.push(support.point);
      }
      if (dist(supportPoints[0], supportPoints[1]) > tolerance) return refuse('binding-mismatch');
      const angleDegrees = Math.atan2(len(cross(normals[0], normals[1])), dot(normals[0], normals[1])) * (180 / Math.PI);
      samples.push({ parameter, angleDegrees });
      minimumAngleDegrees = Math.min(minimumAngleDegrees, angleDegrees);
      maximumAngleDegrees = Math.max(maximumAngleDegrees, angleDegrees);
    }

    return {
      status: 'measured',
      edgeId,
      ...(edge.name === undefined ? {} : { edgeName: edge.name }),
      faces: [faceIdentity(firstFace), faceIdentity(secondFace)],
      sampleCount: samples.length,
      minimumAngleDegrees,
      maximumAngleDegrees,
      samples,
    };
  } catch {
    return refuse('derivative-unavailable');
  }
}
