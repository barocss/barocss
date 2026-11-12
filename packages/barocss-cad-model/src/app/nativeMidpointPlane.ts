import { CadNumericPolicy, checkBrep, type Brep, type BrepFace } from '@barocss/cad';
import { finiteBinary64Integer } from '../engine/binary64';
import type { StudioDoc } from '../engine/doc';
import { partBreps } from '../engine/evaluate';
import { bodyKeyFor, featureId } from '../engine/ids';
import { refusal } from '../engine/refusal';
import { cross, dot, len, scale, sub, unit, type Vec3 } from '../engine/vec3';
import { yAxisOf, type SketchPlane } from '../sketch/plane';

export type NativeMidpointFace = { id: string; name: string };

type Exact3 = [bigint, bigint, bigint];
type Support = { point: Vec3; poles: Vec3[]; normal: Exact3 };

const axes = [0, 1, 2] as const;
const tolerance = CadNumericPolicy.linearTolerance;
const maxFaces = 48, maxBoundary = 192;
const unsupported = (message: string) => refusal('VALUE', message);
const abs = (n: bigint) => n < 0n ? -n : n;
const zero = (n: number) => n === 0 ? 0 : n;
const baseName = (name: string) => name.replace(/#\d+$/, '');
const inRange = (point: Vec3) => point.length === 3
  && point.every(value => Number.isFinite(value) && Math.abs(value) <= CadNumericPolicy.coordinateAbs);

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/** Proportional exact normals have the same primitive integer vector and sign. */
function exactNormal(a: Exact3, b: Exact3): Exact3 {
  const n: Exact3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const divisor = gcd(gcd(abs(n[0]), abs(n[1])), abs(n[2]));
  if (divisor === 0n) throw unsupported('A selected native support is degenerate.');
  const largest = axes.reduce((best, axis) => abs(n[axis]) > abs(n[best]) ? axis : best);
  const signedDivisor = n[largest] < 0n ? -divisor : divisor;
  return [n[0] / signedDivisor, n[1] / signedDivisor, n[2] / signedDivisor];
}

/** The native poles prove an affine plane in the stored binary64 coefficients. */
function supportOf(face: BrepFace): Support {
  const surface = face.surface;
  if (surface.kind !== 'surface' || surface.degreeU !== 1 || surface.degreeV !== 1
    || surface.controlPoints.length !== 2 || surface.controlPoints.some(row => row.length !== 2)
    || surface.weights.length !== 2 || surface.weights.some(row => row.length !== 2)) {
    throw unsupported('Select two native affine planar faces.');
  }
  const poles = surface.controlPoints.flat(), weight = surface.weights[0][0];
  if (!poles.every(inRange) || !Number.isFinite(weight) || !(weight > 0)
    || !surface.weights.every(row => row.every(value => value === weight))) {
    throw unsupported('Select two native affine planar faces within the coordinate range.');
  }
  const [p, v, u, corner] = poles.map(point => point.map(finiteBinary64Integer) as Exact3);
  if (axes.some(axis => p[axis] + corner[axis] !== u[axis] + v[axis])) {
    throw unsupported('Select two native affine planar faces.');
  }
  const along = (point: Exact3): Exact3 => [point[0] - p[0], point[1] - p[1], point[2] - p[2]];
  return { point: poles[0], poles, normal: exactNormal(along(u), along(v)) };
}

function resolveFace(brep: Brep, pick: NativeMidpointFace): BrepFace {
  if (!pick || typeof pick.id !== 'string' || !pick.id || typeof pick.name !== 'string' || !pick.name
    || pick.name.includes('+') || baseName(pick.name) !== pick.name) {
    throw unsupported('Select two faces with unambiguous native identities.');
  }
  const byId = brep.faces.filter(face => face.id === pick.id);
  const byName = brep.faces.filter(face => face.name !== undefined && baseName(face.name) === pick.name);
  if (byId.length !== 1 || byName.length !== 1 || byId[0] !== byName[0] || byId[0].name !== pick.name) {
    throw unsupported('A selected native face is missing or ambiguous.');
  }
  return byId[0];
}

/** Read two distinct supports on one checked native solid and return their independent midpoint frame. */
export function midpointPlaneOfBrep(brep: Brep, faces: readonly [NativeMidpointFace, NativeMidpointFace]): SketchPlane {
  if (brep.bodies.length !== 1 || brep.bodies[0].kind !== 'solid' || brep.bodies[0].shells.length !== 1
    || brep.shells.length !== 1 || !brep.shells[0].closed || brep.faces.some(face => face.surface.kind !== 'surface')) {
    throw unsupported('Select two faces on one closed native solid.');
  }
  if (brep.faces.length > maxFaces || [brep.coedges, brep.edges, brep.vertices, brep.loops].some(items => items.length > maxBoundary)) {
    throw unsupported('The native solid exceeds the midpoint plane limits.');
  }
  if (faces.length !== 2 || faces[0]?.id === faces[1]?.id) throw unsupported('Select two distinct native faces.');
  const first = resolveFace(brep, faces[0]), second = resolveFace(brep, faces[1]);
  if (!checkBrep(brep, { strict: true }).valid) throw unsupported('The native solid has an invalid boundary.');
  const a = supportOf(first), b = supportOf(second);
  if (axes.some(axis => a.normal[axis] !== b.normal[axis])) throw unsupported('Select two exactly parallel native faces.');

  const direction = a.normal.map(Number) as Vec3;
  const largest = Math.max(...direction.map(Math.abs));
  if (!Number.isFinite(largest)) throw unsupported('The native plane direction cannot be represented.');
  const normal = unit(scale(direction, 1 / largest)).map(zero) as Vec3;
  const squaredLength = dot(normal, normal);
  const distance = (from: Vec3, to: Vec3) => dot(sub(to, from), normal);
  if (!(Math.abs(distance(a.point, b.point)) > tolerance)) throw unsupported('The two native planes are coincident or too close.');

  const middle = a.point.map((value, axis) => (value + b.point[axis]) / 2) as Vec3;
  const origin = scale(normal, dot(middle, normal) / squaredLength).map(zero) as Vec3;
  const least = axes.reduce((best, axis) => abs(a.normal[axis]) < abs(a.normal[best]) ? axis : best);
  const basis: Vec3 = [0, 0, 0];
  basis[least] = 1;
  const xAxis = unit(sub(basis, scale(normal, normal[least] / squaredLength))).map(zero) as Vec3;

  // Check the returned binary64 frame against both original native supports.
  if (!inRange(origin) || [a, b].some(plane => plane.poles.some(pole => Math.abs(distance(plane.point, pole)) > tolerance))
    || Math.abs(distance(a.point, origin) - distance(origin, b.point)) > tolerance
    || Math.abs(squaredLength - 1) > 1e-12 || Math.abs(dot(xAxis, xAxis) - 1) > 1e-12
    || Math.abs(dot(normal, xAxis)) > 1e-12) {
    throw unsupported('The midpoint plane cannot be represented within the native tolerance.');
  }
  const frame = { origin, normal, xAxis };
  // Sketch coordinates use a cleaned Y axis. Bound the resulting world displacement
  // throughout the authored range before returning the native frame.
  if (len(sub(yAxisOf(frame), cross(normal, xAxis))) * CadNumericPolicy.coordinateAbs > tolerance) {
    throw unsupported('The native midpoint plane is outside the sketch coordinate tolerance.');
  }
  return frame;
}

/** Resolve the selected top-level body and native face pair from the current part. */
export function nativeMidpointPlane(doc: StudioDoc, key: string, faces: readonly [NativeMidpointFace, NativeMidpointFace]): SketchPlane {
  if (doc.instances?.length) throw unsupported('Open the source part on its own.');
  const ref = Object.hasOwn(doc.outputs, key) ? doc.outputs[key] : undefined;
  const source = ref && doc.nodes[ref.node];
  if (!ref || !source || source.suppressed || ref.side !== 'solid' || bodyKeyFor(doc.nodes, ref.node, ref.side) !== key
    || doc.nodes.filter((_, index) => featureId(doc.nodes, index) === featureId(doc.nodes, ref.node)).length !== 1) {
    throw unsupported('Select two faces on one current native solid.');
  }
  let matches: ReturnType<typeof partBreps>;
  try { matches = partBreps(doc).filter(body => body.key === key); }
  catch { throw unsupported('The current native solid could not be resolved.'); }
  if (matches.length !== 1) throw unsupported('Select two faces on one current native solid.');
  return midpointPlaneOfBrep(matches[0].brep, faces);
}
