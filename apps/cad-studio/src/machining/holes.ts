// CNC2 (O85): holes and threads, from the part's exact geometry. A bore is a concave exact cylinder round more than half
// a turn; a hole is the bores on one axis line, its steps (a counterbore: a wider step at an open end) each with its
// extent along the axis. Its ends are open where a ray down the axis leaves the part. A step's reach is from the nearer
// open end with no narrower step between to its far side — what the tool of its diameter must go in — and its depth over its diameter is that reach
// over 2r. A tapped hole is the document's (`hole.thread`, cosmetic): its bore is matched by face name and checked
// against the fastener table's tap drill (d − P), its size and its length.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
import { buildBvh, rayHit } from '../print/orient';
import { FASTENER_SIZES } from '../app/fasteners';

type Vec3 = readonly [number, number, number] | readonly number[];
export interface HoleStep { readonly faces: readonly string[]; readonly diameterMM: number; readonly fromMM: number; readonly toMM: number; readonly reachMM: number | null }
export interface Hole {
  readonly body: string;
  /** A point on the axis and its unit direction; positions along it are from that point. */
  readonly point: readonly number[]; readonly axis: readonly number[];
  /** Narrowest first. */
  readonly steps: readonly HoleStep[];
  /** Open at the low end, at the high end (a ray down the axis leaves the part). */
  readonly open: readonly [boolean, boolean];
  readonly counterbore: boolean;
}
export interface TappedHole { readonly node: string; readonly thread: string; readonly sizeMM: number; readonly pitchMM: number; readonly tapMM: number | null; readonly boreMM: number | null; readonly lengthMM: number | null; readonly faces: readonly string[] }

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
interface Piece { face: number; c: number[]; a: number[]; r: number }
/** A cylinder piece's span round its axis (radians) when it faces its axis (concave: a bore or an inside fillet), else null. */
export function concaveSpan(m: DisplayMesh, f: number, c: readonly number[], a: readonly number[]): number | null {
  const P = m.positions, I = m.indices, X0 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], k0 = dot(X0, a), U = [X0[0] - k0 * a[0], X0[1] - k0 * a[1], X0[2] - k0 * a[2]], Ul = Math.hypot(U[0], U[1], U[2]);
  const X = [U[0] / Ul, U[1] / Ul, U[2] / Ul], Y = [a[1] * X[2] - a[2] * X[1], a[2] * X[0] - a[0] * X[2], a[0] * X[1] - a[1] * X[0]];
  let inward = 0, outward = 0; const angles: number[] = [];
  for (let t = 0; t < I.length; t += 3) {
    if (m.faceOfVertex[I[t]] !== f) continue;
    const i0 = 3 * I[t], i1 = 3 * I[t + 1], i2 = 3 * I[t + 2];
    const ux = P[i1] - P[i0], uy = P[i1 + 1] - P[i0 + 1], uz = P[i1 + 2] - P[i0 + 2], wx = P[i2] - P[i0], wy = P[i2 + 1] - P[i0 + 1], wz = P[i2 + 2] - P[i0 + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const gx = (P[i0] + P[i1] + P[i2]) / 3 - c[0], gy = (P[i0 + 1] + P[i1 + 1] + P[i2 + 1]) / 3 - c[1], gz = (P[i0 + 2] + P[i1 + 2] + P[i2 + 2]) / 3 - c[2], s = gx * a[0] + gy * a[1] + gz * a[2];
    if (nx * (gx - s * a[0]) + ny * (gy - s * a[1]) + nz * (gz - s * a[2]) < 0) inward++; else outward++;
    for (const i of [i0, i1, i2]) { const vx = P[i] - c[0], vy = P[i + 1] - c[1], vz = P[i + 2] - c[2]; angles.push(Math.atan2(vx * Y[0] + vy * Y[1] + vz * Y[2], vx * X[0] + vy * X[1] + vz * X[2])); }
  }
  if (!(inward > outward) || !angles.length) return null;
  angles.sort((x, y) => x - y);
  let gap = angles[0] + 2 * Math.PI - angles[angles.length - 1];
  for (let i = 1; i < angles.length; i++) gap = Math.max(gap, angles[i] - angles[i - 1]);
  return 2 * Math.PI - gap;
}
/** A bore: concave, round more than half a turn (half a turn or less is an inside fillet). */
const isBore = (m: DisplayMesh, f: number, c: number[], a: number[]) => { const span = concaveSpan(m, f, c, a); return span !== null && span > Math.PI + 1e-6; };
/** Whether two cylinders share an axis line (any radius). */
function coaxial(x: Piece, y: Piece): boolean {
  if (Math.abs(Math.abs(dot(x.a, y.a)) - 1) > 1e-9) return false;
  const d = [x.c[0] - y.c[0], x.c[1] - y.c[1], x.c[2] - y.c[2]], s = dot(d, y.a);
  return Math.hypot(d[0] - s * y.a[0], d[1] - s * y.a[1], d[2] - s * y.a[2]) <= 1e-9;
}
/** A face's extent along an axis from a point on it. */
export function extent(m: DisplayMesh, f: number, c: readonly number[], a: readonly number[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < m.faceOfVertex.length; i++) if (m.faceOfVertex[i] === f) { const s = (m.positions[3 * i] - c[0]) * a[0] + (m.positions[3 * i + 1] - c[1]) * a[1] + (m.positions[3 * i + 2] - c[2]) * a[2]; if (s < lo) lo = s; if (s > hi) hi = s; }
  return [lo, hi];
}

/** Each body's holes: its bores grouped by axis line, their steps, open ends and reaches. */
export function holesOf(bodies: readonly BodyResult[]): Hole[] {
  const out: Hole[] = [];
  for (const body of bodies) {
    const m = body.mesh, pieces: Piece[] = [];
    for (const f of m.faces) {
      const e = f.exact; if (e?.kind !== 'cylinder') continue;
      const l = Math.hypot(e.a[0], e.a[1], e.a[2]), a = [e.a[0] / l, e.a[1] / l, e.a[2] / l], c = [e.c[0], e.c[1], e.c[2]];
      if (isBore(m, f.index, c, a)) pieces.push({ face: f.index, c, a, r: e.r });
    }
    if (!pieces.length) continue;
    const bvh = buildBvh(m), used = new Set<Piece>();
    for (const p0 of pieces) {
      if (used.has(p0)) continue;
      const group = pieces.filter(q => !used.has(q) && coaxial(q, p0)); for (const q of group) used.add(q);
      // (The axis's sign fixed by its largest component, so a hole's low and high ends do not depend on the pieces' order.)
      const big = [0, 1, 2].reduce((b, k) => Math.abs(p0.a[k]) > Math.abs(p0.a[b]) ? k : b, 0), a = p0.a[big] < 0 ? p0.a.map(x => -x) : p0.a, c = p0.c;
      // Steps: pieces of one radius (a face the kernel split shows as several) — their extents joined.
      const radii: { r: number; faces: number[]; lo: number; hi: number }[] = [];
      for (const q of group) {
        const [lo, hi] = extent(m, q.face, c, a), s = radii.find(x => Math.abs(x.r - q.r) <= 1e-9);
        if (s) { s.faces.push(q.face); s.lo = Math.min(s.lo, lo); s.hi = Math.max(s.hi, hi); } else radii.push({ r: q.r, faces: [q.face], lo, hi });
      }
      radii.sort((x, y) => x.r - y.r);
      const T0 = Math.min(...radii.map(s => s.lo)), T1 = Math.max(...radii.map(s => s.hi)), eps = Math.min(0.01, (T1 - T0) / 4);
      const at = (t: number) => [c[0] + t * a[0], c[1] + t * a[1], c[2] + t * a[2]];
      const open: [boolean, boolean] = [rayHit(bvh, at(T0 + eps), [-a[0], -a[1], -a[2]]) === Infinity, rayHit(bvh, at(T1 - eps), a) === Infinity];
      const steps: HoleStep[] = radii.map(s => {
        // (From an end only past no narrower step: a wider step behind a narrower one is an internal groove, which no
        // straight tool reaches — CNC4's access.)
        const fromLow = open[0] && !radii.some(q => q.r < s.r - 1e-9 && q.lo < s.lo - 1e-6), fromHigh = open[1] && !radii.some(q => q.r < s.r - 1e-9 && q.hi > s.hi + 1e-6);
        const reach = Math.min(fromLow ? s.hi - T0 : Infinity, fromHigh ? T1 - s.lo : Infinity);
        return { faces: [...new Set(s.faces.map(f => m.faces[f].name))], diameterMM: 2 * s.r, fromMM: s.lo, toMM: s.hi, reachMM: Number.isFinite(reach) ? reach : null };
      });
      // (A counterbore: a wider step that reaches an open end.)
      const counterbore = radii.length > 1 && radii.slice(1).some(s => (open[0] && s.lo <= T0 + 1e-6) || (open[1] && s.hi >= T1 - 1e-6));
      out.push({ body: body.key, point: c, axis: a, steps, open, counterbore });
    }
  }
  return out;
}

/** The document's tapped holes, each matched to its bore by face name (`n4.side0` is node n4's). */
export function tappedHoles(doc: StudioDoc, holes: readonly Hole[]): TappedHole[] {
  const out: TappedHole[] = [];
  for (const n of doc.nodes) {
    if (n.kind !== 'hole' || !n.thread) continue;
    const id = (n as { id?: string }).id, t = /^M([\d.]+)×([\d.]+)/.exec(n.thread); if (!id || !t) continue;
    const d = Number(t[1]), size = FASTENER_SIZES[`M${t[1]}`], mine = holes.flatMap(h => h.steps.filter(s => s.faces.some(f => f.split('.')[0] === id)));
    // (Patterned copies are several bores of one node: each its own, the worst read.)
    const bore = mine.length ? mine.reduce((w, s) => (size && Math.abs(s.diameterMM - size.tap) > Math.abs(w.diameterMM - size.tap)) ? s : w) : null;
    out.push({ node: id, thread: n.thread, sizeMM: d, pitchMM: Number(t[2]), tapMM: size ? size.tap : null, boreMM: bore ? bore.diameterMM : null, lengthMM: mine.length ? Math.max(...mine.map(s => s.toMM - s.fromMM)) : null, faces: [...new Set(mine.flatMap(s => s.faces))] });
  }
  return out;
}

/** Whether a diameter is on the drill table (its steps as read): null above it (milled, not drilled) or below it. */
export function onDrillTable(dMM: number, t: (k: string) => number): boolean | null {
  if (dMM < t('drillMinMM') - 1e-9 || dMM > t('drillMaxMM') + 1e-9) return null;
  const on = (step: number) => Math.abs(dMM / step - Math.round(dMM / step)) * step <= 1e-6;
  if (dMM <= t('drillFineToMM') + 1e-9) return on(t('drillFineStepMM'));
  if (dMM <= t('drillStepToMM') + 1e-9) return on(t('drillStepMM')) || on(t('drillQuarterStepMM'));
  return on(t('drillCoarseStepMM'));
}
/** The drill sizes either side of a diameter (for a message). */
export function nearestDrills(dMM: number, t: (k: string) => number): [number, number] {
  const step = dMM <= t('drillFineToMM') ? t('drillFineStepMM') : dMM <= t('drillStepToMM') ? t('drillStepMM') : t('drillCoarseStepMM'), r = (v: number) => Math.round(v * 1e3) / 1e3;
  return [r(Math.floor(dMM / step + 1e-9) * step), r(Math.ceil(dMM / step - 1e-9) * step)];
}
