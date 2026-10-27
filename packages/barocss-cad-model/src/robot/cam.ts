// O24 (a), PG-5: a cam and its flat-faced follower, read from the cam part's own B-rep. A `cam` mate names a face of
// the lobe (on the cam's part, turning on its joint) and the follower's flat face (its part sliding on its joint). The
// follower's lift is the lobe's support function along the follower face's normal — exact for a flat face at any
// offset, a concave stretch bridged as a tappet bridges it:
//   h(θ) = max over the lobe's profile of (p − o)·R(a, −θ)u,    q_f = (h(θ) − h(0)) / (u·w)
// with o, a the cam joint's point and axis, u the direction from the cam to the follower face (its outward normal
// reversed), w the follower's slide axis. The profile is the lobe's faces within the follower face's slab along the
// axis: flats and round faces parallel to the axis (each round face an arc, its centre, radius and the span its edges
// bound); an end face (across the axis) bounds nothing; anything else is refused (CAM_PROFILE_UNSUPPORTED). A
// sliding driver (a follower pushing a valve) is linear — q_b = q_a (w_a·u) / (w_b·u) — and couples as a gear does.
import { curveDomain, evaluateCadPart, evaluateCurve, faceGeometry } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import { withBeadRetry } from '../engine/part';
import { faceKey } from '../assembly/faces';
import { refusal } from '../engine/refusal';
import { clean } from '../engine/placement';

type V3 = readonly [number, number, number];
/** A face of a part as a cam reads it, in the part's own coordinates: its kind, a round face's circle, its boundary's samples. */
export interface CamFace { name: string; kind: 'plane' | 'cylinder' | 'other'; c?: V3; a?: V3; r?: number; outer?: boolean; n?: V3; pts: V3[]; /** A round face bounded by a closed edge: the whole circle. */ whole?: boolean }
const EDGE_SAMPLES = 17;
const unitOf = (v: readonly number[]): V3 => { const q = [clean(v[0], 1e-12), clean(v[1], 1e-12), clean(v[2], 1e-12)], l = Math.hypot(q[0], q[1], q[2]); return [q[0] / l, q[1] / l, q[2] / l]; };
const cache = new Map<string, CamFace[]>();
/** The faces of a part (its B-rep, evaluated once per content): each one's geometry and its boundary sampled. */
export function camFacesOf(doc: StudioDoc): CamFace[] {
  const key = faceKey(doc), have = cache.get(key);
  if (have) return have;
  const out: CamFace[] = [];
  for (const o of withBeadRetry(doc, part => evaluateCadPart(part)).outputs) {
    const b = o.brep, loops = new Map(b.loops.map(l => [l.id, l])), coedges = new Map(b.coedges.map(c => [c.id, c])), edges = new Map(b.edges.map(e => [e.id, e]));
    for (const f of b.faces) {
      const pts: V3[] = [];
      let whole = false;
      for (const lid of f.loops) for (const cid of loops.get(lid)!.coedges) {
        const e = edges.get(coedges.get(cid)!.edge)!, [t0, t1] = curveDomain(e.curve);
        if (e.vertices[0] === e.vertices[1]) whole = true;
        for (let k = 0; k < EDGE_SAMPLES; k++) { const p = evaluateCurve(e.curve, t0 + ((t1 - t0) * k) / (EDGE_SAMPLES - 1)); pts.push([p[0], p[1], p[2]]); }
      }
      const name = (f.name ?? f.id).replace(/#\d+$/, '');
      let g: ReturnType<typeof faceGeometry>;
      try { g = faceGeometry(f); } catch { out.push({ name, kind: 'other', pts }); continue; }
      // (Within a nanometre of a round number, that number — a circle read back from its NURBS — as the face tables read it.)
      if (g.kind === 'plane') out.push({ name, kind: 'plane', n: unitOf(g.n), pts });
      else if (g.kind === 'cylinder') out.push({ name, kind: 'cylinder', c: [clean(g.c[0]), clean(g.c[1]), clean(g.c[2])], a: unitOf(g.a), r: clean(g.r), outer: g.out > 0, pts, ...(whole ? { whole } : {}) });
      else out.push({ name, kind: 'other', pts });
    }
  }
  cache.set(key, out); if (cache.size > 16) cache.delete(cache.keys().next().value!);
  return out;
}

/** A turning cam's lift, world at the solved pose: its points and arcs about the cam's axis, the follower's direction. */
export interface CamLift {
  /** The cam mate, the cam's joint, the follower's slide. */
  mate: string; cam: string; follower: string;
  o: V3; a: V3; u: V3; uw: number;
  /** The profile: boundary points and round faces (centre, radius, span: from angle `from` through `width`, about a). */
  points: V3[]; arcs: { c: V3; r: number; from: number; width: number }[];
  /** The support at θ = 0 (mm), and a bound on |dh/dθ| (mm per radian: the profile's farthest reach from the axis). */
  h0: number; reach: number;
}
const dot = (x: readonly number[], y: readonly number[]) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
const cross = (x: readonly number[], y: readonly number[]): V3 => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
const E = [0, 0, 0], B1 = [0, 0, 0], B2 = [0, 0, 0];
/** The lobe's support at cam angle θ (radians, the cam joint's own sense), along u: the follower face's distance from the axis. */
export function camSupport(c: CamLift, theta: number): number {
  // (u turned back by θ about a — Rodrigues; u ⟂ a, so the a·u term vanishes.)
  const ct = Math.cos(theta), st = Math.sin(-theta), axu = cross(c.a, c.u);
  for (let i = 0; i < 3; i++) E[i] = c.u[i] * ct + axu[i] * st;
  let h = -Infinity;
  for (const p of c.points) { const v = (p[0] - c.o[0]) * E[0] + (p[1] - c.o[1]) * E[1] + (p[2] - c.o[2]) * E[2]; if (v > h) h = v; }
  if (c.arcs.length) {
    // (E's angle about a, in the frame the arcs' spans are measured in.)
    basis(c.a, B1, B2);
    const ang = Math.atan2(dot(E, B2), dot(E, B1));
    for (const arc of c.arcs) {
      let d = ang - arc.from; d -= 2 * Math.PI * Math.floor(d / (2 * Math.PI));
      if (d <= arc.width + 1e-12) { const v = (arc.c[0] - c.o[0]) * E[0] + (arc.c[1] - c.o[1]) * E[1] + (arc.c[2] - c.o[2]) * E[2] + arc.r; if (v > h) h = v; }
    }
  }
  return h;
}
/** The follower's joint value at cam angle θ. */
export const camValue = (c: CamLift, theta: number) => (camSupport(c, theta) - c.h0) / c.uw;
/** dq_f/dθ at θ (central difference over 1e-6 rad: the support is smooth where the lobe's faces meet tangent). */
export const camRate = (c: CamLift, theta: number) => (camValue(c, theta + 1e-6) - camValue(c, theta - 1e-6)) / 2e-6;
/** An orthonormal pair across a (into b1, b2). */
function basis(a: readonly number[], b1: number[], b2: number[]): void {
  const t = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], d = dot(t, a);
  b1[0] = t[0] - d * a[0]; b1[1] = t[1] - d * a[1]; b1[2] = t[2] - d * a[2];
  const l = Math.hypot(b1[0], b1[1], b1[2]); b1[0] /= l; b1[1] /= l; b1[2] /= l;
  const c = cross(a, b1); b2[0] = c[0]; b2[1] = c[1]; b2[2] = c[2];
}

type Place = (p: readonly number[]) => V3;
/**
 * A cam's lift from its faces (world, through `place` and `turn`): the faces within the follower face's slab
 * [lo, hi] along the axis a through o. Refused: a face there that is neither a flat nor a round face along the axis.
 */
export function camLiftOf(o: { mate: string; cam: string; follower: string; faces: readonly CamFace[]; place: Place; turn: Place; o: V3; a: V3; u: V3; w: V3; lo: number; hi: number }): CamLift {
  const points: V3[] = [], arcs: CamLift['arcs'] = [], b1 = [0, 0, 0], b2 = [0, 0, 0];
  basis(o.a, b1, b2);
  let reach = 0;
  for (const f of o.faces) {
    const pts = f.pts.map(o.place), along = pts.map(p => dot([p[0] - o.o[0], p[1] - o.o[1], p[2] - o.o[2]], o.a));
    if (!pts.length || Math.max(...along) <= o.lo + 1e-9 || Math.min(...along) >= o.hi - 1e-9) continue;
    if (f.kind === 'plane') {
      const n = o.turn(f.n!);
      if (Math.abs(Math.abs(dot(n, o.a)) - 1) < 1e-9) continue;
      if (Math.abs(dot(n, o.a)) > 1e-9) throw refusal('CAM_PROFILE_UNSUPPORTED', `${o.mate}: ${o.cam}.${f.name} is a flat face neither along the cam's axis nor across it: no lift is read from it`);
    } else if (f.kind === 'cylinder') {
      const ax = o.turn(f.a!);
      if (Math.abs(Math.abs(dot(ax, o.a)) - 1) > 1e-9) throw refusal('CAM_PROFILE_UNSUPPORTED', `${o.mate}: ${o.cam}.${f.name} is a round face not along the cam's axis`);
      if (f.outer) {
        const c = o.place(f.c!), rel = (p: V3) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
        const angles = pts.map(p => { const v = rel(p); return Math.atan2(dot(v, b2), dot(v, b1)); }).sort((x, y) => x - y);
        // (The span: the circle less its widest gap between boundary samples.)
        let gap = angles[0] + 2 * Math.PI - angles[angles.length - 1], from = angles[0];
        for (let i = 1; i < angles.length; i++) if (angles[i] - angles[i - 1] > gap) { gap = angles[i] - angles[i - 1]; from = angles[i]; }
        arcs.push({ c, r: f.r!, from, width: f.whole ? 2 * Math.PI : 2 * Math.PI - gap });
        const cc = [c[0] - o.o[0], c[1] - o.o[1], c[2] - o.o[2]], radial = Math.hypot(...[0, 1, 2].map(i => cc[i] - dot(cc, o.a) * o.a[i]));
        reach = Math.max(reach, radial + f.r!);
      }
    } else throw refusal('CAM_PROFILE_UNSUPPORTED', `${o.mate}: ${o.cam}.${f.name} is a general surface: a lift is read only from flats and round faces along the cam's axis`);
    for (const p of pts) {
      points.push(p);
      const v = [p[0] - o.o[0], p[1] - o.o[1], p[2] - o.o[2]], s = dot(v, o.a);
      reach = Math.max(reach, Math.hypot(v[0] - s * o.a[0], v[1] - s * o.a[1], v[2] - s * o.a[2]));
    }
  }
  if (!points.length) throw refusal('CAM_PROFILE_UNSUPPORTED', `${o.mate}: no face of ${o.cam} lies under the follower's face (along the cam's axis)`);
  const lift: CamLift = { mate: o.mate, cam: o.cam, follower: o.follower, o: o.o, a: o.a, u: o.u, uw: dot(o.u, o.w), points, arcs, h0: 0, reach };
  lift.h0 = camSupport(lift, 0);
  return lift;
}
