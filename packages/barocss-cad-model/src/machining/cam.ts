// CNC8 (O103): an optional 2.5D CAM preview — NOT FOR PRODUCTION. Outlines only, to look at: for each recognised closed
// pocket (CNC7a), contour-parallel loops — the floor's outline offset inward by the tool's radius, then by the stepover,
// until it closes up — at each step-down level from the top to the floor; for each hole, a drill point (its entry, axis,
// depth, diameter). No G-code, no feeds or speeds, no collision checking, no islands cleared around, no stock model:
// README §4 forbids production G-code, and every file this writes says so first (an SVG's first line, the JSON's first key). Slots and steps (open on a
// side) are listed, not previewed. The tool's diameter is given or an estimate; the stepover and step-down are
// estimates of the tool's diameter (40 %, 50 %), said.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh } from '../engine/mesh';
import { featuresOf, type Feature } from './features';
import { holesOf } from './holes';
import { DIRECTION_NAMES, DIRECTIONS } from './access';
import { madeBodies } from '../engine/elements';
import { r6 } from '../util/round';

export const NOT_FOR_PRODUCTION = 'NOT FOR PRODUCTION — a 2.5D preview of outlines to look at, not a toolpath for a machine: no G-code, no feeds or speeds, no collision check';
export const TOOL_ESTIMATE_MM = 6, STEPOVER_SHARE = 0.4, STEPDOWN_SHARE = 0.5;
type P2 = [number, number];
type V = readonly number[];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export interface PocketPass {
  readonly kind: 'pocket'; readonly feature: string; readonly setup: string;
  /** The floor's plane: a point on it, its in-plane axes and its normal (the setup's direction). */
  readonly plane: { readonly origin: readonly number[]; readonly x: readonly number[]; readonly y: readonly number[]; readonly normal: readonly number[] };
  /** Depths below the top, one pass a level, the last the floor's. */
  readonly levels: readonly number[];
  /** The tool's centre loops in the plane's coordinates, outermost first; empty when the tool does not fit. */
  readonly loops: readonly (readonly P2[])[];
  readonly lengthMM: number;
  readonly note?: string;
}
export interface DrillPoint { readonly kind: 'drill'; readonly feature: string; readonly setup: string; readonly at: readonly number[]; readonly axis: readonly number[]; readonly depthMM: number; readonly diameterMM: number }
export interface CamPreview {
  readonly banner: string; readonly notForProduction: true;
  readonly tool: { readonly diameterMM: number; readonly basis: 'given' | 'estimate' };
  readonly stepoverMM: number; readonly stepdownMM: number; readonly basis: string;
  readonly operations: readonly (PocketPass | DrillPoint)[];
  /** Features not previewed, and why. */
  readonly skipped: readonly { readonly feature: string; readonly why: string }[];
}

const area = (p: readonly P2[]) => { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; } return s / 2; };
const perimeter = (p: readonly P2[]) => { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += Math.hypot(q[0] - p[i][0], q[1] - p[i][1]); } return s; };
/** A floor face's outer boundary in its plane: the edges its triangles use once, walked into loops, the largest kept. */
function outlineOf(m: DisplayMesh, face: number, X: V, Y: V): P2[] | null {
  const P = m.positions, I = m.indices, key = (i: number) => `${Math.round(P[3 * i] * 1e5)},${Math.round(P[3 * i + 1] * 1e5)},${Math.round(P[3 * i + 2] * 1e5)}`;
  const count = new Map<string, number>(), at = new Map<string, number>();
  for (let t = 0; t < I.length; t += 3) {
    if (m.faceOfVertex[I[t]] !== face) continue;
    for (let k = 0; k < 3; k++) {
      const a = key(I[t + k]), b = key(I[t + (k + 1) % 3]); at.set(a, I[t + k]); at.set(b, I[t + (k + 1) % 3]);
      const e = a < b ? `${a}|${b}` : `${b}|${a}`; count.set(e, (count.get(e) ?? 0) + 1);
    }
  }
  const next = new Map<string, string[]>();
  for (const [e, n] of count) if (n === 1) { const [a, b] = e.split('|'); next.set(a, [...(next.get(a) ?? []), b]); next.set(b, [...(next.get(b) ?? []), a]); }
  const seen = new Set<string>(), loops: P2[][] = [];
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop: string[] = [start]; seen.add(start); let prev = '', cur = start;
    for (;;) { const nb = (next.get(cur) ?? []).find(x => x !== prev && !seen.has(x)); if (!nb) break; loop.push(nb); seen.add(nb); prev = cur; cur = nb; }
    if (loop.length >= 3) loops.push(loop.map(k => { const i = at.get(k)!, p = [P[3 * i], P[3 * i + 1], P[3 * i + 2]]; return [dot(p, X), dot(p, Y)] as P2; }));
  }
  if (!loops.length) return null;
  // (Collinear points dropped: the mitred offset of a chord polygon keeps its corners.)
  const outer = loops.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0];
  const clean = outer.filter((p, i) => { const a = outer[(i + outer.length - 1) % outer.length], b = outer[(i + 1) % outer.length]; return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 1e-9; });
  return area(clean) < 0 ? clean.reverse() : clean;
}
/**
 * A counter-clockwise polygon offset inward by d: each edge moved in, the corners where neighbouring moved lines cross.
 * An edge the offset turns against its own direction (a short chord of a rounded corner, once d passes its radius) is
 * dropped and the corners found again — the rounded corner turns sharp, as a contour offset does. Null once it closes up.
 */
export function inset(poly: readonly P2[], d: number): P2[] | null {
  let lines = poly.map((p, i) => { const q = poly[(i + 1) % poly.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, nx = -(q[1] - p[1]) / l, ny = (q[0] - p[0]) / l; return { p: [p[0] + d * nx, p[1] + d * ny] as P2, u: [(q[0] - p[0]) / l, (q[1] - p[1]) / l] as P2 }; });
  for (let round = 0; round < poly.length; round++) {
    const n = lines.length; if (n < 3) return null;
    const out: P2[] = [];
    for (let i = 0; i < n; i++) {
      const a = lines[(i + n - 1) % n], b = lines[i], den = a.u[0] * b.u[1] - a.u[1] * b.u[0];
      if (Math.abs(den) < 1e-12) { out.push(b.p); continue; }
      const t = ((b.p[0] - a.p[0]) * b.u[1] - (b.p[1] - a.p[1]) * b.u[0]) / den;
      out.push([a.p[0] + t * a.u[0], a.p[1] + t * a.u[1]]);
    }
    // (Edge i runs from corner i to corner i + 1, along line i.)
    const turned = lines.map((l, i) => { const q = out[(i + 1) % n], e = [q[0] - out[i][0], q[1] - out[i][1]]; return e[0] * l.u[0] + e[1] * l.u[1] < -1e-9; });
    if (!turned.some(Boolean)) return area(out) > 1e-9 ? out : null;
    lines = lines.filter((_, i) => !turned[i]);
  }
  return null;
}

/** The preview: pockets' loops and holes' drill points for the part's features; `tool` the diameter (default an estimate). */
export function camPreview(doc: StudioDoc, all: readonly BodyResult[], o: { toolDiameter?: number } = {}): CamPreview {
  const bodies = madeBodies(doc.nodes, all); // (O160: a bought element is not machined.)
  const D = o.toolDiameter && o.toolDiameter > 0 ? o.toolDiameter : TOOL_ESTIMATE_MM, R = D / 2, so = STEPOVER_SHARE * D, sd = STEPDOWN_SHARE * D;
  const holes = holesOf(bodies), features = featuresOf(doc, bodies, holes), ops: (PocketPass | DrillPoint)[] = [], skipped: { feature: string; why: string }[] = [];
  for (const f of features) {
    if (f.kind === 'pocket') { const p = pocketPass(f, bodies, R, so, sd); if (p) ops.push(p); else skipped.push({ feature: f.id, why: 'its floor\'s outline could not be read' }); }
    // (O161, F3: a plunge of the tool makes a hole of the tool's diameter, so a wider one is milled as a circular pocket.)
    else if (f.kind === 'hole') for (const dp of drillPoints(f, holes)) ops.push(dp.diameterMM > D + 1e-9 ? boreAsPocket(dp, R, so, sd) : dp);
    else if (f.kind === 'slot' || f.kind === 'step') skipped.push({ feature: f.id, why: `a ${f.kind} is open on a side: not previewed` });
  }
  return { banner: NOT_FOR_PRODUCTION, notForProduction: true, tool: { diameterMM: D, basis: o.toolDiameter && o.toolDiameter > 0 ? 'given' : 'estimate' }, stepoverMM: r6(so), stepdownMM: r6(sd),
    basis: `the stepover ${STEPOVER_SHARE * 100} % and the step-down ${STEPDOWN_SHARE * 100} % of the tool's diameter: estimates`, operations: ops, skipped };
}
function pocketPass(f: Feature, bodies: readonly BodyResult[], R: number, so: number, sd: number): PocketPass | null {
  const b = bodies.find(x => x.key === f.body); if (!b) return null;
  const dir = DIRECTION_NAMES.indexOf(f.setups[0]), n = DIRECTIONS[dir], m = b.mesh;
  const face = m.faces.find(x => f.faces.includes(x.name) && x.exact?.kind === 'plane' && dot(x.exact.n, n) > 1 - 1e-9); if (!face || face.exact?.kind !== 'plane') return null;
  const X = Math.abs(n[0]) < 0.9 ? [0, 1, 2].map(k => [1, 0, 0][k] - n[0] * n[k]) : [0, 1, 2].map(k => [0, 1, 0][k] - n[1] * n[k]), xl = Math.hypot(X[0], X[1], X[2]), Xu = X.map(v => v / xl);
  const Yu = [n[1] * Xu[2] - n[2] * Xu[1], n[2] * Xu[0] - n[0] * Xu[2], n[0] * Xu[1] - n[1] * Xu[0]];
  const outline = outlineOf(m, face.index, Xu, Yu); if (!outline) return null;
  const loops: P2[][] = [];
  for (let k = 0, d = R; k < 10000; k++, d += so) { const l = inset(outline, d); if (!l) break; loops.push(l.map(p => [r6(p[0]), r6(p[1])] as P2)); }
  const levels: number[] = []; for (let z = sd; z < f.depthMM - 1e-9; z += sd) levels.push(r6(z)); levels.push(f.depthMM);
  const o = face.exact.o, origin = [0, 1, 2].map(k => o[k]);
  return { kind: 'pocket', feature: f.id, setup: f.setups[0], plane: { origin, x: Xu.map(r6), y: Yu.map(r6), normal: [...n] }, levels, loops, lengthMM: r6(loops.reduce((s, l) => s + perimeter(l), 0) * levels.length),
    ...(loops.length ? {} : { note: `the tool (Ø${2 * R}) does not fit the pocket (${f.widthMM} wide)` }) };
}
/** The largest chord-to-arc gap (mm) of the polygon a circular pocket's outline is drawn as: inscribed, so the cut stays inside. */
const BORE_SAGITTA_MM = 1e-3;
/**
 * A hole wider than the tool as a circular pocket in its drill point's setup (O161, F3): the floor at its bottom, the
 * outline its circle (an inscribed polygon, BORE_SAGITTA_MM), the loops and levels as a pocket's.
 */
function boreAsPocket(dp: DrillPoint, R: number, so: number, sd: number): PocketPass {
  const n = [-dp.axis[0], -dp.axis[1], -dp.axis[2]];
  const X = Math.abs(n[0]) < 0.9 ? [1 - n[0] * n[0], -n[0] * n[1], -n[0] * n[2]] : [-n[1] * n[0], 1 - n[1] * n[1], -n[1] * n[2]], xl = Math.hypot(X[0], X[1], X[2]);
  const Xu = [X[0] / xl, X[1] / xl, X[2] / xl], Yu = [n[1] * Xu[2] - n[2] * Xu[1], n[2] * Xu[0] - n[0] * Xu[2], n[0] * Xu[1] - n[1] * Xu[0]];
  const r = dp.diameterMM / 2, cx = dot(dp.at, Xu), cy = dot(dp.at, Yu), N = Math.max(16, Math.ceil(Math.PI / Math.acos(1 - BORE_SAGITTA_MM / r)));
  const outline: P2[] = [];
  for (let i = 0; i < N; i++) { const a = 2 * Math.PI * i / N; outline.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  const loops: P2[][] = [];
  for (let k = 0, d = R; k < 10000; k++, d += so) { const l = inset(outline, d); if (!l) break; loops.push(l.map(p => [r6(p[0]), r6(p[1])] as P2)); }
  const levels: number[] = []; for (let z = sd; z < dp.depthMM - 1e-9; z += sd) levels.push(r6(z)); levels.push(dp.depthMM);
  const origin = [0, 1, 2].map(k => r6(dp.at[k] + dp.depthMM * dp.axis[k]));
  return { kind: 'pocket', feature: dp.feature, setup: dp.setup, plane: { origin, x: Xu.map(r6), y: Yu.map(r6), normal: n.map(v => v + 0) }, levels, loops, lengthMM: r6(loops.reduce((s, l) => s + perimeter(l), 0) * levels.length),
    note: `Ø${r6(dp.diameterMM)} is wider than the Ø${r6(2 * R)} tool: milled as a circular pocket, not drilled` };
}
function drillPoints(f: Feature, holes: ReturnType<typeof holesOf>): DrillPoint[] {
  const h = holes.find(x => x.steps.some(s => s.faces.some(n => f.faces.includes(n)))); if (!h) return [];
  const s = h.steps[0], lo = Math.min(...h.steps.map(x => x.fromMM)), hi = Math.max(...h.steps.map(x => x.toMM));
  return f.setups.map(setup => {
    const d = DIRECTIONS[DIRECTION_NAMES.indexOf(setup)], fromHigh = dot(d, h.axis) > 0, t = fromHigh ? hi : lo;
    return { kind: 'drill' as const, feature: f.id, setup, at: [0, 1, 2].map(k => r6(h.point[k] + t * h.axis[k])), axis: [0, 1, 2].map(k => r6(-d[k])), depthMM: r6(fromHigh ? hi - s.fromMM : s.toMM - lo), diameterMM: r6(s.diameterMM) };
  });
}

/** One setup's outlines as an SVG, looking down its direction — the banner its first line. */
export function camSvg(p: CamPreview, setup: string): string {
  const pockets = p.operations.filter((o): o is PocketPass => o.kind === 'pocket' && o.setup === setup), drills = p.operations.filter((o): o is DrillPoint => o.kind === 'drill' && o.setup === setup);
  const pts: P2[] = pockets.flatMap(o => o.loops.flat() as P2[]);
  const k = DIRECTION_NAMES.indexOf(setup), n = DIRECTIONS[k];
  const X = Math.abs(n[0]) < 0.9 ? [0, 1, 2].map(i => [1, 0, 0][i] - n[0] * n[i]) : [0, 1, 2].map(i => [0, 1, 0][i] - n[1] * n[i]), xl = Math.hypot(X[0], X[1], X[2]), Xu = X.map(v => v / xl), Yu = [n[1] * Xu[2] - n[2] * Xu[1], n[2] * Xu[0] - n[0] * Xu[2], n[0] * Xu[1] - n[1] * Xu[0]];
  for (const d of drills) pts.push([dot(d.at, Xu), dot(d.at, Yu)]);
  const lo = [Math.min(0, ...pts.map(q => q[0])) - 10, Math.min(0, ...pts.map(q => q[1])) - 10], hi = [Math.max(10, ...pts.map(q => q[0])) + 10, Math.max(10, ...pts.map(q => q[1])) + 10];
  const w = hi[0] - lo[0], h = hi[1] - lo[1], y = (v: number) => r6(hi[1] - v + lo[1]);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return [`<!-- ${esc(p.banner)} -->`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r6(lo[0])} ${r6(lo[1] - 12)} ${r6(w)} ${r6(h + 12)}">`,
    `<text x="${r6(lo[0] + 2)}" y="${r6(lo[1] - 4)}" font-size="4" fill="#c00">${esc(p.banner)}</text>`,
    ...pockets.flatMap(o => o.loops.map(l => `<polygon points="${l.map(q => `${q[0]},${y(q[1])}`).join(' ')}" fill="none" stroke="#06c" stroke-width="0.3"/>`)),
    ...drills.map(d => `<circle cx="${r6(dot(d.at, Xu))}" cy="${y(dot(d.at, Yu))}" r="${r6(d.diameterMM / 2)}" fill="none" stroke="#c60" stroke-width="0.3"/>`), '</svg>', ''].join('\n');
}
