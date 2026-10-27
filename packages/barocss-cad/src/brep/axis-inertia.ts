import { solidMassError, type MassProperties } from './solid-mass.js';

type Vector3 = readonly [number, number, number];

/** A line in the same XYZ coordinates as the mass properties. The point is in mm. */
export interface MassInertiaAxis {
  readonly point: Vector3;
  /** A finite nonzero direction; its magnitude does not change the queried line. */
  readonly direction: Vector3;
}

const fail = (detail: string): never => { throw solidMassError(`axis inertia: ${detail}`); };
const finite = (value: number, label: string): number => Number.isFinite(value) ? value : fail(`${label} must remain finite`);

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function vector(value: unknown, label: string): Vector3 {
  if (!Array.isArray(value) || value.length !== 3) return fail(`${label} must be a dense array of three finite numbers`);
  const component = (i: number): number => {
    if (!Object.hasOwn(value, i)) return fail(`${label} must be a dense array of three finite numbers`);
    const coordinate = value[i];
    if (typeof coordinate !== 'number' || !Number.isFinite(coordinate)) return fail(`${label} must be a dense array of three finite numbers`);
    return coordinate;
  };
  return [component(0), component(1), component(2)];
}
function tensor(value: unknown): readonly [Vector3, Vector3, Vector3] {
  if (!Array.isArray(value) || value.length !== 3 || ![0, 1, 2].every(i => Object.hasOwn(value, i))) return fail('inertia must be a dense 3 by 3 tensor');
  return [vector(value[0], 'inertia row 0'), vector(value[1], 'inertia row 1'), vector(value[2], 'inertia row 2')];
}
function dot(a: Vector3, b: Vector3, label: string): number {
  let sum = 0;
  for (let i = 0; i < 3; i++) sum = finite(sum + finite(a[i] * b[i], label), label);
  return sum;
}

/**
 * Moment about the line through axis.point, in g*mm^2. The input inertia is the full
 * COM tensor in g*mm^2; mass is in g, and centroid/point are in mm in the same XYZ frame.
 * The direction is normalized. The query uses u^T I_COM u + mass*|(centroid-point) cross u|^2.
 * Volume and method are not used. No frame rotation or material/density conversion is applied.
 * This is a numerical MMGS query, not native SI provenance or physical validation of the tensor.
 * It does not certify symmetry, positive definiteness, manufacturing tolerance or numerical error.
 */
export function momentOfInertiaAboutAxis(props: MassProperties, axis: MassInertiaAxis): number {
  const input = record(props, 'mass properties'), line = record(axis, 'axis'), mass = input.mass;
  if (typeof mass !== 'number' || !Number.isFinite(mass) || !(mass > 0)) return fail('mass must be a positive finite number');
  const centroid = vector(input.centroid, 'centroid'), inertia = tensor(input.inertia);
  const point = vector(line.point, 'axis.point'), direction = vector(line.direction, 'axis.direction');
  const maximum = Math.max(...direction.map(Math.abs));
  if (!(maximum > 0)) return fail('axis.direction must be nonzero');
  const scaled: Vector3 = [direction[0] / maximum, direction[1] / maximum, direction[2] / maximum];
  const length = finite(Math.hypot(...scaled), 'axis.direction norm');
  const u: Vector3 = [scaled[0] / length, scaled[1] / length, scaled[2] / length];
  const product: Vector3 = [dot(inertia[0], u, 'central projection'), dot(inertia[1], u, 'central projection'), dot(inertia[2], u, 'central projection')];
  const central = dot(u, product, 'central projection');
  if (central < 0) return fail('central inertia projection must be nonnegative');
  const d: Vector3 = [finite(centroid[0] - point[0], 'COM offset'), finite(centroid[1] - point[1], 'COM offset'), finite(centroid[2] - point[2], 'COM offset')];
  const cross: Vector3 = [finite(d[1] * u[2] - d[2] * u[1], 'axis distance'), finite(d[2] * u[0] - d[0] * u[2], 'axis distance'), finite(d[0] * u[1] - d[1] * u[0], 'axis distance')];
  const parallel = finite(mass * dot(cross, cross, 'squared axis distance'), 'parallel-axis contribution');
  const result = finite(central + parallel, 'axis inertia');
  if (result < 0) return fail('axis inertia must be nonnegative');
  return result;
}
