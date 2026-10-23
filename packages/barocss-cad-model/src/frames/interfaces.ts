// FRe (O120): a T-slot frame member's interfaces, so the tslot-20 library's hardware snaps to it as to the library's own
// profile — the same ids, roles and accepts (slot-t1 … slot-l: t-slot ⇄ slot-nut; end0, end1: profile-end ⇄ end-cap;
// face-top, face-right: profile-face ⇄ bracket-leg), each frame read off the member's own faces, no table of sizes:
//   - a slot: on its lips' underside plane (`<slot>.under0`), centred between its two lips (`lip0`, `lip1`), at the
//     member's start; z its underside's normal (into the slot), x along the member — the library's slot frame;
//   - an end: on its end face, centred on the section's origin (from its outer faces), z out of the member;
//   - a face: on the top or right outer face over the section's origin, z its normal, x along the member.
// The mates go on the faces named (the plane each frame lies on), as the library's interfaces' do. Every plane is the
// face's exact one (the display mesh's points are single precision).
import type { CadLibraryInterface } from '@barocss/cad';
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh } from '../engine/mesh';
import { r9 } from '../util/round';

type V = [number, number, number];
const SLOTS = [['t1', 'slot-t1'], ['t2', 'slot-t2'], ['r', 'slot-r'], ['b2', 'slot-b2'], ['b1', 'slot-b1'], ['l', 'slot-l']] as const;
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A planar face by its name: its exact plane (the kernel's, not the display mesh's single precision) — a point and its outward normal. */
function plane(m: DisplayMesh, prefix: string, name: string): { name: string; n: V; p: V } | null {
  const full = `${prefix}.${name}`, f = m.faces.find(x => x.kind === 'plane' && x.name === full);
  if (!f || f.exact?.kind !== 'plane') return null;
  return { name: full, n: [f.exact.n[0], f.exact.n[1], f.exact.n[2]], p: [f.exact.o[0], f.exact.o[1], f.exact.o[2]] };
}
/** The point whose components along three orthonormal directions are given. */
const compose = (a: V, ca: number, b: V, cb: number, c: V, cc: number): V => [0, 1, 2].map(k => r9(a[k] * ca + b[k] * cb + c[k] * cc)) as V;

/**
 * The interfaces of a member body whose faces are a T-slot section's (its top, right, left, start and end faces and the
 * slots it has); null for any other body. Ids as the library's: `slot-t1`, `end0`, `face-top` … — the body names them apart.
 */
export function tslotInterfaces(b: BodyResult): CadLibraryInterface[] | null {
  const m = b.mesh, end = m.faces.find(f => f.kind === 'plane' && /\.end$/.test(f.name));
  if (!end || !b.cutPiece) return null;
  const prefix = end.name.slice(0, -'.end'.length);
  const top = plane(m, prefix, 'top.0'), right = plane(m, prefix, 'right.0'), left = plane(m, prefix, 'left.0'), start = plane(m, prefix, 'start'), stop = plane(m, prefix, 'end');
  if (!top || !right || !left || !start || !stop) return null;
  if (!SLOTS.some(([s]) => plane(m, prefix, `${s}.under0`))) return null;
  const A = stop.n, Y = top.n, X = right.n;
  // (The section's origin: its first cell's centre, as the library's profile has it (a second cell at +a along X) — half
  // the section's height a in from its left face, and a/2 below its top.)
  const halfY = halfHeight(m, prefix, Y), ox = dot(left.p, X) + halfY, oy = dot(top.p, Y) - halfY, s0 = dot(start.p, A), s1 = dot(stop.p, A);
  const out: CadLibraryInterface[] = [];
  for (const [s, id] of SLOTS) {
    const under = plane(m, prefix, `${s}.under0`), lip0 = plane(m, prefix, `${s}.lip0`), lip1 = plane(m, prefix, `${s}.lip1`);
    if (!under || !lip0 || !lip1) continue;
    // (Across the opening: the lips face each other; their planes' middle along lip0's normal.)
    const u = lip0.n, mid = (dot(lip0.p, u) + dot(lip1.p, u)) / 2;
    out.push({ id, role: 't-slot', accepts: ['slot-nut'], frame: { origin: compose(A, s0, under.n, dot(under.p, under.n), u, mid), z: under.n, x: A }, faces: { plane: under.name }, description: `the ${s} slot's lip underside, at the member's start` });
  }
  out.push({ id: 'end0', role: 'profile-end', accepts: ['end-cap'], frame: { origin: compose(A, s0, X, ox, Y, oy), z: start.n, x: X }, faces: { plane: start.name } });
  out.push({ id: 'end1', role: 'profile-end', accepts: ['end-cap'], frame: { origin: compose(A, s1, X, ox, Y, oy), z: stop.n, x: X }, faces: { plane: stop.name } });
  out.push({ id: 'face-top', role: 'profile-face', accepts: ['bracket-leg'], frame: { origin: compose(A, s0, X, ox, Y, dot(top.p, Y)), z: Y, x: A }, faces: { plane: top.name } });
  out.push({ id: 'face-right', role: 'profile-face', accepts: ['bracket-leg'], frame: { origin: compose(A, s0, X, dot(right.p, X), Y, oy), z: X, x: A }, faces: { plane: right.name } });
  return out;
}

/** Half the section's height: its top face over its bottom one (`bottom.0`), along Y. */
function halfHeight(m: DisplayMesh, prefix: string, Y: V): number {
  const top = plane(m, prefix, 'top.0'), bottom = plane(m, prefix, 'bottom.0');
  return top && bottom ? (dot(top.p, Y) - dot(bottom.p, Y)) / 2 : 0;
}
