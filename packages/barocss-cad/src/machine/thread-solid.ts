// Modelled ISO metric threads (ISO 68-1 basic profile: crest P/8 wide at the major diameter, 60° flanks,
// root P/4 wide at d − 5H/4, H = √3/2 · P). By default as helical B-spline faces (thread-helical.ts); the
// faceted form below (the one documents written before 2026-10-18 keep) as one closed mesh so that no
// Boolean is needed: a threaded rod, a hex head bolt (the head and its threaded shank), or a hex nut
// with a threaded bore. The helix is sampled every 7.5° round and every P/12 along; each facet is flat,
// so the solid is exact as a polyhedron and its mass, drawing and export follow from it.
import { brepFromTriangles } from '../mesh/mesh-brep.js';
import type { Brep } from '../brep/brep-core.js';
import { helicalThreadSolid } from './thread-helical.js';

export interface ThreadSolidRequest {
  readonly id?: string;
  /** Nominal (major) diameter and pitch, mm. */
  readonly diameter: number; readonly pitch: number;
  /** The axis (parallel to Z) through [x, y]; `seat` the Z where a head or nut stands (default 0). */
  readonly center?: readonly [number, number]; readonly seat?: number;
  /** A rod or a bolt's shank: its length below the seat. */
  readonly length?: number;
  /** A hex head above the seat (bolt), or a hex nut above the seat with the thread through it (internal). */
  readonly hex?: { readonly across: number; readonly height: number; readonly internal?: boolean };
  /**
   * The profile pushed out by this many mm (radially, every phase): the clearance a nut or a tapped hole leaves
   * on a bolt's thread. Default 0.04 for a nut, 0 for a rod or bolt.
   */
  readonly clearance?: number;
  /** Steps round a turn (a multiple of 12, default 48) and along a pitch (default 12). */
  readonly around?: number; readonly along?: number;
  /**
   * How the thread is built: `helical` (the default) as half-turn B-spline faces between helices, named
   * `${id}.thread#k`, `.end`, `.seat`, `.head`, `.hex0–5`, `.top`, `.bottom`; or `faceted`, one closed mesh of
   * flat facets named `${id}.facet${k}` (the form documents written before 2026-10-18 keep).
   */
  readonly form?: 'faceted' | 'helical';
}

/** The basic profile's radius at a phase along one pitch (0: the middle of a crest). */
export function isoThreadRadius(d: number, pitch: number, phase: number): number {
  const H = Math.sqrt(3) / 2 * pitch, rMaj = d / 2, rMin = rMaj - 5 * H / 8;
  let u = phase - Math.floor(phase); if (u > 0.5) u -= 1;
  const a = Math.abs(u), crest = 1 / 16, flank = 0.3125;
  return a <= crest ? rMaj : a <= crest + flank ? rMaj - (rMaj - rMin) * (a - crest) / flank : rMin;
}

/** The radial clearance a thread's profile is pushed out by (a nut's 0.04 mm by default). */
export function clearanceOf(req: ThreadSolidRequest, nut: boolean): number {
  const c = req.clearance ?? (nut ? 0.04 : 0);
  if (!(Number.isFinite(c) && c >= 0 && c < req.pitch / 4)) throw new RangeError('a thread\'s clearance is at least 0 and below a quarter of its pitch');
  return c;
}

export function threadSolid(req: ThreadSolidRequest): Brep {
  if ((req.form ?? 'helical') === 'helical') return helicalThreadSolid(req);
  const d = req.diameter, P = req.pitch, [cx, cy] = req.center ?? [0, 0], seat = req.seat ?? 0, N = req.around ?? 48, K = req.along ?? 12;
  if (!(d > 0 && P > 0 && P < d / 2)) throw new RangeError('a thread needs a diameter and a pitch below half of it');
  if (!(N >= 12 && N % 12 === 0)) throw new RangeError('steps round a turn must be a multiple of 12');
  const hex = req.hex, nut = !!hex?.internal;
  if (hex && !(hex.across > d && hex.height > 0)) throw new RangeError('a hex must be wider across flats than the thread and have a height');
  if (!nut && !((req.length ?? 0) > 0)) throw new RangeError('a threaded rod or shank needs a length');
  // (A nut's thread leaves a little clearance on the bolt's.)
  const clear = clearanceOf(req, nut);
  const z0 = nut ? seat : seat - req.length!, z1 = nut ? seat + hex!.height : seat;
  const M = Math.max(1, Math.ceil((z1 - z0) / (P / K))), zs = Array.from({ length: M + 1 }, (_, j) => j === M ? z1 : z0 + (z1 - z0) * j / M);
  const P3: number[] = [], I: number[] = [], vertex = (x: number, y: number, z: number) => { P3.push(x, y, z); return P3.length / 3 - 1; };
  const angle = (i: number) => 2 * Math.PI * i / N;
  // The thread surface: rows of N points, the radius following the helix (a column a turn later is a pitch higher).
  const ring = zs.map(z => Array.from({ length: N }, (_, i) => { const r = isoThreadRadius(d, P, z / P - i / N) + clear, t = angle(i); return vertex(cx + r * Math.cos(t), cy + r * Math.sin(t), z); }));
  const quad = (a: number, b: number, c: number, e: number) => I.push(a, b, c, a, c, e);
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const i1 = (i + 1) % N, a = ring[j][i], b = ring[j][i1], c = ring[j + 1][i1], e = ring[j + 1][i];
    // Facing out of the rod; into the bore of a nut (its material is outside).
    if (nut) quad(a, e, c, b); else quad(a, b, c, e);
  }
  // A hex's outline at the ring's angles (its corners at 30° + k·60° are among them): `across` apart.
  const hexAt = (z: number) => Array.from({ length: N }, (_, i) => {
    const t = angle(i), k = Math.round((t - Math.PI / 6) / (Math.PI / 3)), c0 = Math.PI / 6 + k * Math.PI / 3, R = hex!.across / Math.sqrt(3);
    // On the flat between the corners at c0 and c0 + 60° (or the one before): a point along it, not by trigonometry.
    const lo = t >= c0 ? c0 : c0 - Math.PI / 3, f = (t - lo) / (Math.PI / 3), A = [R * Math.cos(lo), R * Math.sin(lo)], B = [R * Math.cos(lo + Math.PI / 3), R * Math.sin(lo + Math.PI / 3)];
    // (The flat's point at the ray's angle: the line A–B met by the ray.)
    const dx = B[0] - A[0], dy = B[1] - A[1], ct = Math.cos(t), st = Math.sin(t), s = (A[0] * st - A[1] * ct) / (dy * ct - dx * st);
    const x = f === 0 ? A[0] : A[0] + dx * s, y = f === 0 ? A[1] : A[1] + dy * s;
    return vertex(cx + x, cy + y, z);
  });
  // A flat ring between the thread's row and a hex outline at the same Z (`up`: facing +Z).
  const annulus = (inner: number[], outer: number[], up: boolean) => { for (let i = 0; i < N; i++) { const i1 = (i + 1) % N; if (up) quad(inner[i], outer[i], outer[i1], inner[i1]); else quad(inner[i], inner[i1], outer[i1], outer[i]); } };
  const walls = (lo: number[], hi: number[]) => { for (let i = 0; i < N; i++) { const i1 = (i + 1) % N; quad(lo[i], lo[i1], hi[i1], hi[i]); } };
  const fan = (row: number[], z: number, up: boolean) => { const c = vertex(cx, cy, z); for (let i = 0; i < N; i++) { const i1 = (i + 1) % N; if (up) I.push(c, row[i], row[i1]); else I.push(c, row[i1], row[i]); } };
  if (!hex) { fan(ring[0], z0, false); fan(ring[M], z1, true); }
  else if (!nut) {
    // The rod's end below; the head on the seat: its underside round the shank, its six sides, its top.
    fan(ring[0], z0, false);
    const under = hexAt(seat), top = hexAt(seat + hex.height);
    annulus(ring[M], under, false); walls(under, top); fan(top, seat + hex.height, true);
  } else {
    // The nut: its faces round the bore at the bottom and the top, and its six sides.
    const lo = hexAt(z0), hi = hexAt(z1);
    annulus(ring[0], lo, false); annulus(ring[M], hi, true); walls(lo, hi);
  }
  return brepFromTriangles(P3, I, { id: req.id ?? 'thread', maximumTriangles: 400_000 });
}
