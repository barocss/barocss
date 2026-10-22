import type { Brep } from './brep-core.js';
import type { FrameEndReport, FrameMemberReport } from './frame-section.js';
import { curveDomain, evaluateCurve } from './math.js';

// FR4a (D127): a frame's cut list. Each member as a piece to cut — its axis length (the centroidal line between its two
// end planes, in closed form where both ends are planes; else its volume over its section's area), its long point (its
// extent along its line, from the body), each end's cut (mitre about the section's y, bevel about its x), its mass — and
// identical pieces grouped on one row. Densities are the caller's (the studio's materials are estimates, D67).

/** One end of a piece as cut: what finishes it, and for a plane its angles from square (degrees). */
export interface CutEnd {
  readonly end: 'start' | 'end';
  /** square (or a through member's run-on, cut square), mitre, butt or trim to a plane — planes; cope or trim to an envelope or a body — not. */
  readonly kind: FrameEndReport['kind'];
  readonly gapMM?: number;
  readonly notch?: FrameEndReport['notch'];
  readonly point: number;
  /** The plane's tilt about the section's y (a mitre box's angle) and about its x (the saw's bevel); null where the end is no plane. */
  readonly mitreDegrees: number | null; readonly bevelDegrees: number | null;
  readonly with?: number;
}
/** A member as a piece to cut (`cutPiece`). */
export interface CutPiece {
  /** The output it is. */
  readonly id: string;
  readonly curve?: FrameMemberReport['curve'];
  readonly section: string; readonly areaMM2: number;
  /** Turned over across its section's y axis (FR2). */
  readonly mirrored: boolean;
  /** Whether a reversed piece is the same piece: its section symmetric about its own x or y through its centroid (a tube, a channel); else (an angle) its ends are told apart in order. */
  readonly reversible: boolean;
  /** Its centroidal axis between its end planes (closed form), or its volume over its area where an end is no plane (`fromVolume`). */
  readonly axisLengthMM: number; readonly fromVolume: boolean;
  /** Its extent along its line, from the body (vertices, and curved edges at 64 points each). */
  readonly longPointMM: number;
  readonly volumeMM3: number;
  readonly ends: readonly [CutEnd, CutEnd];
  /** Its own material and density (kg/m³), where the caller gives one (a body's material): grouped by it, its mass by it. */
  readonly material?: string; readonly densityKgPerM3?: number;
}
/** One row of a cut list: identical pieces. */
export interface CutRow {
  readonly item: number; readonly section: string; readonly mirrored: boolean; readonly quantity: number; readonly pieces: readonly string[];
  readonly material?: string;
  readonly axisLengthMM: number; readonly fromVolume: boolean; readonly longPointMM: number; readonly ends: readonly [CutEnd, CutEnd];
  /** A piece's mass: ρ·A·L (closed form) where both ends are planes, else ρ·V (the body's volume); and the row's. */
  readonly massKG: number; readonly totalMassKG: number;
}
export interface CutList {
  readonly rows: readonly CutRow[];
  readonly totals: { readonly quantity: number; readonly axisLengthMM: number; readonly massKG: number };
  readonly densityKgPerM3: number; readonly material?: string;
}

/** A cut list refused: its message starts with `[CODE]`. */
export class CutListError extends Error {
  constructor(detail: string) { super(detail.slice(0, 1024)); this.name = 'CutListError'; }
}

type V3 = readonly [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const PLANE_KINDS = new Set(['square', 'through', 'mitre', 'butt']);

/** An end's angles from square: its plane's normal against the section's x, y and the line u. */
function endCut(e: FrameEndReport, m: FrameMemberReport): CutEnd {
  const base = { end: e.end, kind: e.kind, point: e.point, ...(e.gapMM !== undefined ? { gapMM: e.gapMM } : {}), ...(e.notch ? { notch: e.notch } : {}), ...(e.with !== undefined ? { with: e.with } : {}) };
  if (!e.plane) return { ...base, mitreDegrees: e.kind === 'square' || e.kind === 'through' ? 0 : null, bevelDegrees: e.kind === 'square' || e.kind === 'through' ? 0 : null };
  const axis = m.curve ? (e.end === 'start' ? m.curve.startTangent : m.curve.endTangent) : m.axis;
  let x = m.xAxis, y = m.yAxis;
  if (m.curve && e.end === 'end') {
    const n = m.curve.axis, a = Math.acos(Math.max(-1, Math.min(1, dot(m.curve.startTangent, m.curve.endTangent)))), sign = dot(n, [m.curve.startTangent[1] * m.curve.endTangent[2] - m.curve.startTangent[2] * m.curve.endTangent[1], m.curve.startTangent[2] * m.curve.endTangent[0] - m.curve.startTangent[0] * m.curve.endTangent[2], m.curve.startTangent[0] * m.curve.endTangent[1] - m.curve.startTangent[1] * m.curve.endTangent[0]]) < 0 ? -1 : 1;
    const rotate = (v: V3): V3 => { const c = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]]; return [0, 1, 2].map(i => v[i] * Math.cos(a) + sign * c[i] * Math.sin(a) + n[i] * dot(n, v) * (1 - Math.cos(a))) as unknown as V3; };
    x = rotate(x); y = rotate(y);
  }
  const n = e.plane.normal, nu = Math.abs(dot(n, axis));
  return { ...base, mitreDegrees: Math.atan2(Math.abs(dot(n, x)), nu) * 180 / Math.PI, bevelDegrees: Math.atan2(Math.abs(dot(n, y)), nu) * 180 / Math.PI };
}
/** Where an end lies along the centroidal line (mm past its start), or null where it is no plane. */
function endAt(e: FrameEndReport | undefined, m: FrameMemberReport, which: 0 | 1): number | null {
  const c0 = m.centroidLine.start, u = m.axis;
  if (!e || e.kind === 'square') return which ? m.lengthMM : 0;
  if (e.kind === 'through') return which ? m.lengthMM + (e.extendedMM ?? 0) : -(e.extendedMM ?? 0);
  if (!e.plane) return null;
  // The line c0 + s·u meets the plane n·(x − o) = 0.
  const n = e.plane.normal, o = e.plane.origin, nu = dot(n, u);
  return (dot(n, [o[0] - c0[0], o[1] - c0[1], o[2] - c0[2]])) / nu;
}
/** A body's extent along a direction: its vertices, and its curved edges at 64 points each. */
function extentAlong(brep: Brep, u: V3): number {
  let lo = Infinity, hi = -Infinity;
  for (const v of brep.vertices) { const s = dot(v.point, u); lo = Math.min(lo, s); hi = Math.max(hi, s); }
  for (const e of brep.edges) {
    if (e.curve.degree === 1 && e.curve.controlPoints.length === 2) continue;
    const [a, b] = curveDomain(e.curve);
    for (let k = 1; k < 64; k++) { const s = dot(evaluateCurve(e.curve, a + (b - a) * k / 64), u); lo = Math.min(lo, s); hi = Math.max(hi, s); }
  }
  return hi - lo;
}

/** A frame member's output as a piece to cut; refused `[NOT_A_MEMBER]` for a body that is no member. */
export function cutPiece(output: { readonly id: string; readonly brep: Brep; readonly member?: FrameMemberReport; massProperties(density: number): { readonly volumeMM3: number } }, options?: { readonly volumeMM3?: number }): CutPiece {
  const m = output.member;
  if (!m) throw new CutListError(`[NOT_A_MEMBER] ${output.id} is not a frame member`);
  // (The volume when the caller has it already: the body's own mass, worked out once.)
  const ends = m.ends ?? [], start = ends.find(e => e.end === 'start'), end = ends.find(e => e.end === 'end'), volume = (typeof options === 'object' ? options?.volumeMM3 : undefined) ?? output.massProperties(1).volumeMM3;
  const s0 = endAt(start, m, 0), s1 = endAt(end, m, 1), planar = s0 !== null && s1 !== null && ends.every(e => PLANE_KINDS.has(e.kind) || (e.kind === 'trim' && !!e.plane));
  const square = (which: 'start' | 'end', point: number): FrameEndReport => ({ end: which, kind: 'square', point });
  return {
    id: output.id, ...(m.curve ? { curve: m.curve } : {}), section: m.section, areaMM2: m.areaMM2, mirrored: !!m.mirrored, reversible: m.reversible ?? false,
    axisLengthMM: m.curve?.developedLengthMM ?? (planar ? s1! - s0! : volume / m.areaMM2), fromVolume: m.curve ? ends.some(e => (e.angleDegrees ?? 0) !== 0 || e.kind === 'trim' || e.kind === 'cope') : !planar, longPointMM: m.curve?.developedLengthMM ?? extentAlong(output.brep, m.axis), volumeMM3: volume,
    ends: [endCut(start ?? square('start', m.frame?.from ?? 0), m), endCut(end ?? square('end', m.frame?.to ?? 0), m)],
  };
}

const r6 = (x: number | null) => x === null ? 'n' : (Math.round(x * 1e6) / 1e6).toFixed(6);
/** An end as a cut, for telling pieces apart: a through end is cut square. */
const endKey = (e: CutEnd) => `${e.kind === 'through' ? 'square' : e.kind}:${r6(e.mitreDegrees)}:${r6(e.bevelDegrees)}${e.gapMM ? `:gap${r6(e.gapMM)}` : ''}${e.notch ? `:${JSON.stringify(e.notch)}` : ''}`;
/**
 * The cut list of pieces (FR4a, D127): identical pieces on one row — the same section (mirrored apart), axis length and
 * long point to 1e-6 mm, and end cuts (kind, mitre and bevel to 1e-6°; as an unordered pair where the piece is reversible,
 * in order where it is not); a piece with an end that is no plane also by its volume (to 1e-3 mm³). In first-seen
 * order; pieces of different materials apart. Mass by each piece's density, else `densityKgPerM3` (kg/m³) — the caller's.
 */
export function cutList(pieces: readonly CutPiece[], options: { readonly densityKgPerM3: number; readonly material?: string }): CutList {
  const rhoOf = (p: CutPiece) => p.densityKgPerM3 ?? options.densityKgPerM3;
  for (const r of [options.densityKgPerM3, ...pieces.map(rhoOf)]) if (!(r > 0) || !Number.isFinite(r)) throw new CutListError(`[DENSITY] a density above 0 kg/m³ is needed (${r})`);
  const rows: { key: string; row: { item: number; section: string; mirrored: boolean; material?: string; pieces: string[]; axisLengthMM: number; fromVolume: boolean; longPointMM: number; ends: readonly [CutEnd, CutEnd]; massKG: number } }[] = [];
  for (const p of pieces) {
    const ends = [endKey(p.ends[0]), endKey(p.ends[1])], pair = p.reversible ? [...ends].sort().join('|') : ends.join('|'), rho = rhoOf(p), material = p.material ?? options.material;
    const curveKey = p.curve ? [p.curve.kind, r6(p.curve.radiusMM), r6(p.curve.angleDegrees), ...p.curve.straightLengthsMM.map(r6)].join(':') : '';
    const key = [curveKey, p.section, p.mirrored, material ?? '', rho, r6(p.axisLengthMM), r6(p.longPointMM), pair, p.fromVolume ? (Math.round(p.volumeMM3 * 1e3) / 1e3).toFixed(3) : ''].join('#');
    const hit = rows.find(r => r.key === key);
    if (hit) { hit.row.pieces.push(p.id); continue; }
    const massKG = rho * (p.fromVolume ? p.volumeMM3 : p.areaMM2 * p.axisLengthMM) * 1e-9;
    rows.push({ key, row: { item: rows.length + 1, section: p.section, mirrored: p.mirrored, ...(material ? { material } : {}), pieces: [p.id], axisLengthMM: p.axisLengthMM, fromVolume: p.fromVolume, longPointMM: p.longPointMM, ends: p.ends, massKG } });
  }
  const out = rows.map(({ row }) => ({ ...row, quantity: row.pieces.length, totalMassKG: row.massKG * row.pieces.length }));
  return {
    rows: out, densityKgPerM3: options.densityKgPerM3, ...(options.material ? { material: options.material } : {}),
    totals: { quantity: out.reduce((n, r) => n + r.quantity, 0), axisLengthMM: out.reduce((n, r) => n + r.axisLengthMM * r.quantity, 0), massKG: out.reduce((n, r) => n + r.totalMassKG, 0) },
  };
}

/** A cut list as CSV (RFC 4180 quoting; lengths in mm to 1e-3, angles to 1e-3°, mass in kg to 1e-6). */
export function cutListCsv(list: CutList): string {
  const q = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const n = (x: number | null, d: number) => x === null ? '' : String(Math.round(x * 10 ** d) / 10 ** d);
  const originalCut = (e: CutEnd) => e.kind === 'square' || e.kind === 'through' ? 'square' : e.mitreDegrees === null ? e.kind : `${e.kind} ${n(e.mitreDegrees, 3)}°${e.bevelDegrees ? ` / bevel ${n(e.bevelDegrees, 3)}°` : ''}`;
  const cut = (e: CutEnd) => originalCut(e) + (e.gapMM ? ` / gap ${n(e.gapMM, 3)} mm` : '') + (e.notch ? e.notch.kind === 'holesaw' ? ` / holesaw diameter ${n(e.notch.diameterMM, 3)} mm offset ${n(e.notch.offsetMM, 3)} mm` : ` / v depth ${n(e.notch.depthMM, 3)} mm angle ${n(e.notch.angleDegrees, 3)}°` : '');
  const lines = ['item,quantity,section,material,axis length (mm),long point (mm),start cut,end cut,mass each (kg),mass (kg),pieces'];
  for (const r of list.rows) lines.push([String(r.item), String(r.quantity), q(r.section + (r.mirrored ? ' (mirrored)' : '')), q(r.material ?? list.material ?? ''), n(r.axisLengthMM, 3) + (r.fromVolume ? ' (by volume)' : ''), n(r.longPointMM, 3), q(cut(r.ends[0])), q(cut(r.ends[1])), n(r.massKG, 6), n(r.totalMassKG, 6), q(r.pieces.join(' '))].join(','));
  lines.push(['total', String(list.totals.quantity), '', '', n(list.totals.axisLengthMM, 3), '', '', '', '', n(list.totals.massKG, 6), ''].join(','));
  return lines.join('\n') + '\n';
}
