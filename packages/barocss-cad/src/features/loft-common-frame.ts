// Shared rigid placement for lofts built once in a common local frame.
import { BrepError } from '../brep/brep-core.js';
import { transformBrep, type BrepAffine } from '../brep/brep-transform.js';
import { combineMassProperties } from '../brep/solid-mass.js';
import { unsupportedNativeMass } from '../internal/native-si-mass-state.js';
import { ExtrudedProfileLimits } from './extruded-profile-solid.js';
import type { loftSolid } from './loft.js';
import type { Point } from '../types.js';

export interface LoftFrameBasis { readonly origin: Point; readonly u: Point; readonly v: Point }
export interface LoftCommonFrame extends LoftFrameBasis { readonly n: Point }
export interface LoftFrameOffset { readonly shift: [number, number]; readonly height: number }
type Fail = (detail: string) => never;
type BuiltLoft = ReturnType<typeof loftSolid>;
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function admitLoftCommonFrame(frames: readonly LoftFrameBasis[], fail: Fail): LoftCommonFrame {
  const a = frames[0], u = a.u, v = a.v, n: Point = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  for (let i = 1; i < frames.length; i++) for (let c = 0; c < 3; c++) if (u[c] !== frames[i].u[c] || v[c] !== frames[i].v[c]) return fail('need identical frame axes');
  if (dot(u, u) !== 1 || dot(v, v) !== 1 || dot(u, v) !== 0 || dot(n, n) !== 1) return fail('need a certified rigid common frame');
  return { origin: a.origin, u, v, n };
}

export function loftFrameOffset(frame: LoftCommonFrame, origin: Point, fail: Fail, separationDetail: string): LoftFrameOffset {
  const delta: Point = [origin[0] - frame.origin[0], origin[1] - frame.origin[1], origin[2] - frame.origin[2]];
  const { u, v, n } = frame, shift: [number, number] = [dot(delta, u), dot(delta, v)], height = dot(delta, n);
  if (!(height > 1e-9 * Math.max(1, Math.hypot(...delta)))) throw new BrepError('GEOMETRY', separationDetail);
  for (let c = 0; c < 3; c++) if (u[c] * shift[0] + v[c] * shift[1] + n[c] * height !== delta[c]) return fail('need an exact rigid decomposition of the frame displacement');
  return { shift, height };
}

export function loftFramePoint(frame: LoftCommonFrame, p: Point): Point {
  const { u, v, n, origin: o } = frame;
  return [u[0] * p[0] + v[0] * p[1] + n[0] * p[2] + o[0], u[1] * p[0] + v[1] * p[1] + n[1] * p[2] + o[1], u[2] * p[0] + v[2] * p[1] + n[2] * p[2] + o[2]];
}
export function loftFrameVector(frame: LoftCommonFrame, p: Point): Point { return [dot(p, frame.u), dot(p, frame.v), dot(p, frame.n)]; }
export function loftFrameLocal(frame: LoftCommonFrame, p: Point): Point {
  return loftFrameVector(frame, [p[0] - frame.origin[0], p[1] - frame.origin[1], p[2] - frame.origin[2]]);
}
function outside(p: Point): boolean {
  for (let c = 0; c < 3; c++) if (!Number.isFinite(p[c]) || Math.abs(p[c]) > ExtrudedProfileLimits.coordinateMM) return true;
  return false;
}
function placedMass(local: BuiltLoft, frame: LoftCommonFrame, density: number) {
  const props = local.mass(density), world = combineMassProperties([{ props, axes: [frame.u, frame.v, frame.n], offset: frame.origin }]);
  return unsupportedNativeMass({ ...world, method: props.method }, 'transformed');
}

/** One world transform; preserve the original local mass method and existing transformed SI refusal. */
export function placeLoftInFrame(local: BuiltLoft, frame: LoftCommonFrame, fail: Fail): BuiltLoft {
  const { u, v, n } = frame, matrix: BrepAffine['matrix'] = [u[0], v[0], n[0], u[1], v[1], n[1], u[2], v[2], n[2]];
  const brep = transformBrep(local.brep, { matrix, offset: frame.origin });
  for (const vertex of brep.vertices) if (outside(vertex.point)) return fail('leave the existing modeling coordinate range');
  for (const edge of brep.edges) for (const pole of edge.curve.controlPoints) if (outside(pole)) return fail('leave the existing modeling coordinate range');
  for (const face of brep.faces) {
    if (face.surface.kind !== 'surface') return fail('leave the existing modeling coordinate range');
    for (const row of face.surface.controlPoints) for (const pole of row) if (outside(pole)) return fail('leave the existing modeling coordinate range');
  }
  return { brep, mass: density => placedMass(local, frame, density) };
}
