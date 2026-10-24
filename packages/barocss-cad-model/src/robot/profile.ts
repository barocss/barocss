// Motion profiles (RD2, O21): a move of distance d from rest to rest within limits, as exact piecewise polynomials.
//   trapezoid: velocity v and acceleration a limits; T = d/v + v/a, or 2√(d/a) when v is never reached (triangular);
//   S-curve:   v, a and jerk j limits (the double S of Biagiotti & Melchiorri, rest to rest): seven segments of constant
//              jerk (+j, 0, −j, 0, −j, 0, +j); a or v not reached shortens them (their closed forms, below).
// Each segment is a polynomial in time, so positions, speeds and accelerations are exact anywhere and their extremes
// are at the segment ends: the limits are checked there, never by sampling alone.
import { refusal } from '../engine/refusal';

export type ProfileKind = 'trapezoid' | 's-curve';
export interface Segment { t0: number; t1: number; /** At t0: position, velocity, acceleration; the jerk over the segment. */ s: number; v: number; a: number; j: number }
export interface Profile { kind: ProfileKind; distance: number; duration: number; segments: Segment[]; /** The peaks the profile reaches. */ vPeak: number; aPeak: number; jPeak: number }

/** The segments from their durations and jerks (or a constant acceleration, for the trapezoid), integrated exactly. */
function build(kind: ProfileKind, d: number, parts: { dt: number; j?: number; a?: number }[]): Profile {
  const segments: Segment[] = [];
  let t = 0, s = 0, v = 0, a = 0, vPeak = 0, aPeak = 0, jPeak = 0;
  for (const p of parts) {
    if (!(p.dt > 0)) continue;
    if (p.a !== undefined) a = p.a;
    const j = p.j ?? 0;
    segments.push({ t0: t, t1: t + p.dt, s, v, a, j });
    const dt = p.dt;
    s += v * dt + a * dt * dt / 2 + j * dt * dt * dt / 6; v += a * dt + j * dt * dt / 2; a += j * dt; t += dt;
    vPeak = Math.max(vPeak, Math.abs(v)); aPeak = Math.max(aPeak, Math.abs(a), Math.abs(segments[segments.length - 1].a)); jPeak = Math.max(jPeak, Math.abs(j));
    if (p.a !== undefined) a = 0;
  }
  return { kind, distance: d, duration: t, segments, vPeak, aPeak, jPeak };
}

/** A trapezoid (triangular when v is not reached) over |d| ≥ 0, its sign d's. */
export function trapezoid(d: number, vMax: number, aMax: number): Profile {
  if (!(vMax > 0 && aMax > 0)) throw refusal('LIMITS_BAD', 'a trapezoid needs velocity and acceleration limits above 0');
  const D = Math.abs(d), sg = Math.sign(d) || 1;
  if (D === 0) return build('trapezoid', d, []);
  if (D >= vMax * vMax / aMax) { const ta = vMax / aMax, tv = D / vMax - ta; return build('trapezoid', d, [{ dt: ta, a: sg * aMax }, { dt: tv, a: 0 }, { dt: ta, a: -sg * aMax }]); }
  const ta = Math.sqrt(D / aMax);
  return build('trapezoid', d, [{ dt: ta, a: sg * aMax }, { dt: ta, a: -sg * aMax }]);
}

/** The S-curve's acceleration and constant-velocity times (rest to rest, B&M 3.4.2): Tj, Ta (each half), Tv. */
export function sCurveTimes(D: number, vMax: number, aMax: number, jMax: number): { Tj: number; Ta: number; Tv: number } {
  // (v reached? With a reached: Tj = a/j, Ta = Tj + v/a; else Tj = √(v/j), Ta = 2Tj.)
  let Tj = vMax * jMax >= aMax * aMax ? aMax / jMax : Math.sqrt(vMax / jMax), Ta = vMax * jMax >= aMax * aMax ? Tj + vMax / aMax : 2 * Tj;
  let Tv = D / vMax - Ta;
  if (Tv < 0) {
    // (v not reached: a reached if the distance allows, else neither: Tj = (D / 2j)^⅓.)
    Tv = 0; Tj = aMax / jMax;
    Ta = (aMax * aMax / jMax + Math.sqrt((aMax * aMax / jMax) ** 2 + 4 * D * aMax)) / (2 * aMax);
    if (Ta < 2 * Tj) { Tj = Math.cbrt(D / (2 * jMax)); Ta = 2 * Tj; }
  }
  return { Tj, Ta, Tv };
}
/** A jerk-limited S-curve over d, rest to rest. */
export function sCurve(d: number, vMax: number, aMax: number, jMax: number): Profile {
  if (!(vMax > 0 && aMax > 0 && jMax > 0)) throw refusal('LIMITS_BAD', 'an S-curve needs velocity, acceleration and jerk limits above 0');
  const D = Math.abs(d), sg = Math.sign(d) || 1;
  if (D === 0) return build('s-curve', d, []);
  const { Tj, Ta, Tv } = sCurveTimes(D, vMax, aMax, jMax), j = sg * jMax;
  return build('s-curve', d, [{ dt: Tj, j }, { dt: Ta - 2 * Tj, j: 0 }, { dt: Tj, j: -j }, { dt: Tv, j: 0 }, { dt: Tj, j: -j }, { dt: Ta - 2 * Tj, j: 0 }, { dt: Tj, j }]);
}

/** Position, velocity and acceleration at time t within one segment, by its own polynomial (one-sided at its ends: where the
 * acceleration jumps, a segment's end has its own value, not the next segment's). */
export function onSegment(g: Segment, t: number): { s: number; v: number; a: number } {
  const u = t - g.t0;
  return { s: g.s + g.v * u + g.a * u * u / 2 + g.j * u * u * u / 6, v: g.v + g.a * u + g.j * u * u / 2, a: g.a + g.j * u };
}
/** Position, velocity and acceleration at time t (clamped to the move). */
export function at(p: Profile, t: number): { s: number; v: number; a: number } {
  if (!p.segments.length) return { s: t <= 0 ? 0 : p.distance, v: 0, a: 0 };
  if (t <= 0) return { s: 0, v: 0, a: 0 };
  if (t >= p.duration) return { s: p.distance, v: 0, a: 0 };
  let k = 0; while (k < p.segments.length - 1 && t > p.segments[k].t1) k++;
  const g = p.segments[k], u = t - g.t0;
  return { s: g.s + g.v * u + g.a * u * u / 2 + g.j * u * u * u / 6, v: g.v + g.a * u + g.j * u * u / 2, a: g.a + g.j * u };
}
