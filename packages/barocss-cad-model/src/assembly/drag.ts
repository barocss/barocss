// A part instance dragged with the viewport gizmo: moved along a world axis, or turned about one through
// the centre of its box, as a new placement (position, rotation X then Y then Z in degrees). The
// matrices are what the renderer shows while dragging, before the instance is evaluated there.
import type { PartInstance } from '../engine/doc';
import { type Freedom } from './mates';
import { eulerOf, rotationMatrix } from '../engine/placement';
import type { Axis3 } from '../engine/vec3';

type Vec3 = [number, number, number];
type Mat3 = Parameters<typeof eulerOf>[0];
const clean = (v: number) => Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) || 0 : v;

/** A quarter turn's sine and cosine exactly, otherwise the floating values. */
function sinCos(degrees: number): [number, number] {
  const q = ((Math.round(degrees) % 360) + 360) % 360;
  if (Number.isInteger(degrees) && q % 90 === 0) return [[0, 1, 0, -1][q / 90], [1, 0, -1, 0][q / 90]];
  const a = degrees * Math.PI / 180; return [Math.sin(a), Math.cos(a)];
}
/** The right-handed rotation about a world axis (row-major 3 × 3). */
export function axisTurn(axis: Axis3, degrees: number): Mat3 {
  const [s, c] = sinCos(degrees);
  return (axis === 0 ? [1, 0, 0, 0, c, -s, 0, s, c] : axis === 1 ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1]) as Mat3;
}
const mul = (a: Mat3, b: Mat3): Mat3 => { const r = new Array(9).fill(0) as Mat3; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]; return r; };
const apply = (m: Mat3, v: Vec3): Vec3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

export const movedInstance = (inst: PartInstance, delta: Vec3): PartInstance =>
  ({ ...inst, position: inst.position.map((v, k) => clean(v + delta[k])) as Vec3 });

/** Turned about a world axis through `centre` (the part's points p go to c + R(p − c)). */
export function turnedInstance(inst: PartInstance, axis: Axis3, degrees: number, centre: Vec3): PartInstance {
  const R = axisTurn(axis, degrees), rotation = eulerOf(mul(R, rotationMatrix(inst.rotation))).map(clean) as Vec3;
  const p = apply(R, inst.position.map((v, k) => v - centre[k]) as Vec3);
  return { ...inst, rotation, position: p.map((v, k) => clean(v + centre[k])) as Vec3 };
}

/** What the gizmo offers for an instance: none when it is fixed, hidden or fully placed by its mates. */
export function gizmoAxes(inst: PartInstance, freedom: Freedom | undefined): { move: Axis3[]; turn: Axis3[] } | null {
  if (inst.grounded || inst.hidden) return null;
  const slides = freedom ? freedom.slides > 0 : true, turns = freedom ? freedom.turns > 0 : true;
  if (!slides && !turns) return null;
  return { move: slides ? [0, 1, 2] : [], turn: turns ? [0, 1, 2] : [] };
}

export type InstanceDrag = { kind: 'move'; delta: Vec3 } | { kind: 'turn'; axis: Axis3; degrees: number; centre: Vec3 };
/** The drag as a 4 × 4 column-major matrix on the instance's placed meshes (for the renderer's preview). */
export function previewMatrix(drag: InstanceDrag): Float64Array {
  const m = new Float64Array(16); m[0] = m[5] = m[10] = m[15] = 1;
  if (drag.kind === 'move') { m[12] = drag.delta[0]; m[13] = drag.delta[1]; m[14] = drag.delta[2]; return m; }
  const R = axisTurn(drag.axis, drag.degrees), c = drag.centre, t = apply(R, [-c[0], -c[1], -c[2]]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[j * 4 + i] = R[i * 3 + j];
  m[12] = t[0] + c[0]; m[13] = t[1] + c[1]; m[14] = t[2] + c[2];
  return m;
}

/**
 * A dragged move lined up with other bodies, as CAD tools snap: along each axis being dragged, when the
 * moving box's low side, middle or high side comes within `tol` mm of another body's low side, middle or
 * high side, it is put exactly there. Returns the move and the axes that snapped.
 */
export function alignMove(box: { min: readonly number[]; max: readonly number[] }, others: readonly { min: readonly number[]; max: readonly number[] }[], move: readonly number[], dragged: readonly boolean[], tol: number): { move: [number, number, number]; snapped: number[] } {
  const out = [...move] as [number, number, number], snapped: number[] = [];
  for (let k = 0; k < 3; k++) {
    if (!dragged[k]) continue;
    const mine = [box.min[k], (box.min[k] + box.max[k]) / 2, box.max[k]].map(v => v + out[k]);
    let best = tol, shift = 0;
    for (const o of others) for (const t of [o.min[k], (o.min[k] + o.max[k]) / 2, o.max[k]]) for (const m of mine) { const d = t - m; if (Math.abs(d) < best) { best = Math.abs(d); shift = d; } }
    if (best < tol) { out[k] = Math.round((out[k] + shift) * 1000) / 1000; snapped.push(k); }
  }
  return { move: out, snapped };
}
