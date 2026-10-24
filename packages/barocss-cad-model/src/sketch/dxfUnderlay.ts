// A DXF drawing's reference underlay (A6.4, O68): what the profile reader does not take as regions — SPLINE, ELLIPSE,
// INSERT/BLOCK (and everything inside a block), TEXT and MTEXT — as polylines and texts in mm, to trace over. Our own
// reader: a spline by de Boor (rational with its weights), an ellipse by its parameters, both flattened to a chord
// tolerance; a block through its insert's transform T(insertion)·R(rotation)·S(sx, sy)·T(−base point), nested to any
// depth, a MINSERT's grid as repeats, the OCS (0, 0, −1) a mirror of X; a text's insertion (or its alignment point),
// height, rotation and plain string (MTEXT's inline codes stripped). The underlay never becomes a region, a hole, a
// sketch entity or a dimension: the profile reader reads regions from the top level's LINE, ARC, CIRCLE, LWPOLYLINE and
// POLYLINE alone, as before. A spline given by fit points only is left out and listed (its interpolation is the writer's).
import { pairsOf } from './dxfRead';
import { refusal } from '../engine/refusal';

type P = [number, number];
/** A 2D affine map: x' = a x + b y + e, y' = c x + d y + f. */
interface M2 { a: number; b: number; c: number; d: number; e: number; f: number }
export interface UnderlayText { at: P; text: string; height: number; angle: number }
export interface Underlay {
  polylines: P[][]; texts: UnderlayText[];
  /** The entities shown, by type, blocks expanded (a circle or arc a non-uniform scale makes an ellipse counted as ELLIPSE). */
  counts: Record<string, number>;
  /** Entities left out, by type: how many and why. */
  left: Record<string, { count: number; why: string }>;
  /** With `{ detail: true }`: each spline and ellipse as read, the map to mm it went through, and its vertices' parameters (tests: O68). */
  curves?: UnderlayCurve[];
}
export type UnderlayCurve = ({ type: 'SPLINE'; degree: number; knots: number[]; control: P[]; weights: number[] | null } | { type: 'ELLIPSE'; center: P; major: P; ratio: number; start: number; end: number })
  & { map: M2; polyline: number; params: number[] };
export type { M2 as UnderlayMap };
/** The chord tolerance of the flattened curves (mm, on the sheet as drawn). */
export const UNDERLAY_TOLERANCE = 0.01;
/** The kinds the underlay shows at the top level (the profile reader takes the rest of the geometry). */
export const UNDERLAY_TOP = new Set(['SPLINE', 'ELLIPSE', 'INSERT', 'TEXT', 'MTEXT']);

const I2: M2 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const mul = (p: M2, q: M2): M2 => ({ a: p.a * q.a + p.b * q.c, b: p.a * q.b + p.b * q.d, c: p.c * q.a + p.d * q.c, d: p.c * q.b + p.d * q.d, e: p.a * q.e + p.b * q.f + p.e, f: p.c * q.e + p.d * q.f + p.f });
const apply = (m: M2, x: number, y: number): P => [m.a * x + m.b * y + m.e, m.c * x + m.d * y + m.f];
const shift = (x: number, y: number): M2 => ({ ...I2, e: x, f: y });
const turn = (deg: number): M2 => { const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return { a: c, b: -s, c: s, d: c, e: 0, f: 0 }; };
const scale = (sx: number, sy: number): M2 => ({ a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
/** The OCS for an extrusion of (0, 0, ±1): +Z the world's; −Z mirrors X (the arbitrary-axis algorithm's Ax = (−1, 0, 0)). */
const ocs = (z: number): M2 => (z < 0 ? scale(-1, 1) : I2);
/** The largest stretch of a map (its largest singular value): a chord tolerance in its source is the target's over it. */
function stretch(m: M2): number {
  const p = m.a * m.a + m.c * m.c, q = m.b * m.b + m.d * m.d, r = m.a * m.b + m.c * m.d, h = (p + q) / 2, k = Math.sqrt(((p - q) / 2) ** 2 + r * r);
  return Math.sqrt(h + k);
}
/** Whether a map keeps circles circles (a similarity, mirrored or not). */
function similar(m: M2): boolean {
  const p = m.a * m.a + m.c * m.c, q = m.b * m.b + m.d * m.d, r = m.a * m.b + m.c * m.d;
  return Math.abs(p - q) <= 1e-12 * Math.max(p, q) && Math.abs(r) <= 1e-12 * Math.max(p, q);
}

interface Entity { type: string; body: [number, string][] }
const num = (v: string | undefined, what: string): number => { const x = Number(v); if (v === undefined || !Number.isFinite(x)) throw refusal('DXF_MALFORMED', `${what}: "${(v ?? '').slice(0, 20)}" is not a number`); return x; };
const get = (e: Entity, code: number, d?: number): number => { const v = e.body.find(p => p[0] === code); if (!v) { if (d !== undefined) return d; throw refusal('DXF_MALFORMED', `a ${e.type} without its group ${code}`); } return num(v[1], `${e.type} group ${code}`); };
const all = (e: Entity, code: number): number[] => e.body.filter(p => p[0] === code).map(p => num(p[1], `${e.type} group ${code}`));
const str = (e: Entity, code: number): string | undefined => e.body.find(p => p[0] === code)?.[1];

/** A section's entities: each `0 <type>` with its pairs. */
function entitiesOf(pairs: [number, string][], from: number, until: (p: [number, string]) => boolean): { list: Entity[]; end: number } {
  const list: Entity[] = [];
  let i = from;
  while (i < pairs.length && !until(pairs[i])) {
    if (pairs[i][0] !== 0) { i++; continue; }
    const type = pairs[i][1], body: [number, string][] = []; i++;
    while (i < pairs.length && pairs[i][0] !== 0) body.push(pairs[i++]);
    list.push({ type, body });
  }
  return { list, end: i };
}
/** The BLOCKS section: each block's base point and entities (POLYLINE's VERTEX entities kept with it). */
function blocksOf(pairs: [number, string][]): Map<string, { base: P; entities: Entity[] }> {
  const out = new Map<string, { base: P; entities: Entity[] }>();
  const start = pairs.findIndex((p, i) => p[0] === 2 && p[1] === 'BLOCKS' && pairs[i - 1]?.[0] === 0 && pairs[i - 1]?.[1] === 'SECTION');
  if (start < 0) return out;
  const { list } = entitiesOf(pairs, start + 1, p => p[0] === 0 && p[1] === 'ENDSEC');
  let current: { name: string; base: P; entities: Entity[] } | null = null;
  for (const e of list) {
    if (e.type === 'BLOCK') { current = { name: str(e, 2) ?? '', base: [get(e, 10, 0), get(e, 20, 0)], entities: [] }; continue; }
    if (e.type === 'ENDBLK') { if (current) out.set(current.name, { base: current.base, entities: current.entities }); current = null; continue; }
    current?.entities.push(e);
  }
  return out;
}

// ——— curves
/** The de Boor point of a B-spline (rational when w is given) at t, into out. */
export function splinePoint(degree: number, knots: readonly number[], cps: readonly P[], w: readonly number[] | null, t: number): P {
  const n = cps.length - 1;
  let k = degree;
  if (t >= knots[n + 1]) k = n; else while (k < n && t >= knots[k + 1]) k++;
  const dx: number[] = [], dy: number[] = [], dw: number[] = [];
  for (let j = 0; j <= degree; j++) { const c = cps[k - degree + j], ww = w ? w[k - degree + j] : 1; dx.push(c[0] * ww); dy.push(c[1] * ww); dw.push(ww); }
  for (let r = 1; r <= degree; r++) for (let j = degree; j >= r; j--) {
    const i = k - degree + j, den = knots[i + degree - r + 1] - knots[i], a = den === 0 ? 0 : (t - knots[i]) / den;
    dx[j] = (1 - a) * dx[j - 1] + a * dx[j]; dy[j] = (1 - a) * dy[j - 1] + a * dy[j]; dw[j] = (1 - a) * dw[j - 1] + a * dw[j];
  }
  return [dx[degree] / dw[degree], dy[degree] / dw[degree]];
}
/** A curve flattened over [t0, t1]: at least `min` pieces, each halved until its points at ¼, ½ and ¾ are within tol/2 of the chord (to depth 24). */
function flatten(at: (t: number) => P, t0: number, t1: number, tol: number, min: number, out: P[], ts?: number[]): void {
  const push = (u0: number, p0: P, u1: number, p1: P, depth: number) => {
    const um = (u0 + u1) / 2, pm = at(um), q1 = at(u0 + (u1 - u0) / 4), q3 = at(u0 + 3 * (u1 - u0) / 4);
    // (Three points sampled, half the tolerance asked of them: the peak between them stays inside it — checked densely by the tests.)
    if (depth < 24 && Math.max(chordGap(pm, p0, p1), chordGap(q1, p0, p1), chordGap(q3, p0, p1)) > tol / 2) { push(u0, p0, um, pm, depth + 1); push(um, pm, u1, p1, depth + 1); return; }
    out.push(p1); ts?.push(u1);
  };
  let u = t0, p = at(t0);
  if (!out.length) { out.push(p); ts?.push(t0); }
  for (let k = 1; k <= min; k++) { const v = t0 + (t1 - t0) * k / min, q = at(v); push(u, p, v, q, 0); u = v; p = q; }
}
function chordGap(p: P, a: P, b: P): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const s = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - s * dx, p[1] - a[1] - s * dy);
}

/** The text of an MTEXT without its inline codes, as ezdxf's plain_text(): \P a new line, \~ a space, \\ \{ \} the characters; formats dropped. */
export function plainMtext(s: string): string {
  let out = '', i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '{' || ch === '}') { i++; continue; }
    if (ch !== '\\') { out += ch; i++; continue; }
    const c = s[i + 1];
    if (c === undefined) { i++; continue; }
    if (c === 'P') { out += '\n'; i += 2; continue; }
    if (c === '~') { out += ' '; i += 2; continue; }
    if (c === '\\' || c === '{' || c === '}') { out += c; i += 2; continue; }
    if ('LlOoKkNX'.includes(c)) { i += 2; continue; }
    if (c === 'S') { const e = s.indexOf(';', i); const stack = s.slice(i + 2, e < 0 ? s.length : e); out += stack.replace(/[\^#]/, '/').replace(/\^/g, ''); i = e < 0 ? s.length : e + 1; continue; }
    // (\f… \F… \H… \W… \Q… \T… \A… \C… \c… \p…: to the semicolon.)
    const e = s.indexOf(';', i); i = e < 0 ? s.length : e + 1;
  }
  return out;
}

/** The underlay of a DXF drawing, its lengths times toMM. */
export function readUnderlay(text: string, to: number, o: { detail?: boolean } = {}): Underlay {
  const pairs = pairsOf(text), blocks = blocksOf(pairs);
  const start = pairs.findIndex((p, i) => p[0] === 2 && p[1] === 'ENTITIES' && pairs[i - 1]?.[0] === 0 && pairs[i - 1]?.[1] === 'SECTION');
  if (start < 0) throw refusal('DXF_MALFORMED', 'no ENTITIES section: not a DXF drawing');
  const top = entitiesOf(pairs, start + 1, p => p[0] === 0 && p[1] === 'ENDSEC').list;
  const u: Underlay = { polylines: [], texts: [], counts: {}, left: {}, ...(o.detail ? { curves: [] } : {}) }, unit = scale(to, to);
  const count = (t: string) => { u.counts[t] = (u.counts[t] ?? 0) + 1; };
  const leave = (t: string, why: string) => { const l = u.left[t] ?? (u.left[t] = { count: 0, why }); l.count++; };
  const walk = (list: readonly Entity[], m: M2, inBlock: boolean, path: string[]) => {
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (e.type === 'VERTEX' || e.type === 'SEQEND' || e.type === 'ATTRIB') continue;
      if (!inBlock && !UNDERLAY_TOP.has(e.type)) continue;
      const z = get(e, 230, 1);
      if (Math.abs(Math.abs(z) - 1) > 1e-9 || all(e, 30).some(v => Math.abs(v) > 1e-9) && e.type !== 'INSERT' && e.type !== 'TEXT' && e.type !== 'MTEXT') throw refusal('DXF_UNSUPPORTED', `a ${e.type} off the XY plane: the drawing reader takes 2D drawings`);
      const M = mul(m, ocs(z));
      const tol = UNDERLAY_TOLERANCE / stretch(mul(unit, M));
      if (e.type === 'INSERT') {
        const name = str(e, 2) ?? '', b = blocks.get(name);
        if (!b) throw refusal('DXF_MALFORMED', `an INSERT of a block "${name}" the file does not define`);
        if (path.includes(name)) throw refusal('DXF_MALFORMED', `block "${name}" inserts itself (${[...path, name].join(' → ')})`);
        const cols = get(e, 70, 1), rows = get(e, 71, 1), cs = get(e, 44, 0), rs = get(e, 45, 0), rot = get(e, 50, 0);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const cell = mul(mul(mul(mul(shift(get(e, 10), get(e, 20)), turn(rot)), shift(c * cs, r * rs)), scale(get(e, 41, 1), get(e, 42, 1))), shift(-b.base[0], -b.base[1]));
          walk(b.entities, mul(M, cell), true, [...path, name]);
        }
        continue;
      }
      const W = mul(unit, M), line: P[] = [];
      const point = (x: number, y: number) => apply(W, x, y);
      if (e.type === 'LINE') { u.polylines.push([point(get(e, 10), get(e, 20)), point(get(e, 11), get(e, 21))]); count('LINE'); continue; }
      if (e.type === 'CIRCLE' || e.type === 'ARC') {
        const cx = get(e, 10), cy = get(e, 20), r = get(e, 40), a0 = e.type === 'ARC' ? get(e, 50) * Math.PI / 180 : 0;
        let a1 = e.type === 'ARC' ? get(e, 51) * Math.PI / 180 : 2 * Math.PI; if (a1 <= a0) a1 += 2 * Math.PI;
        flatten(t => point(cx + r * Math.cos(t), cy + r * Math.sin(t)), a0, a1, tol, 8, line);
        u.polylines.push(line); count(similar(M) ? e.type : 'ELLIPSE'); continue;
      }
      if (e.type === 'ELLIPSE') {
        const cx = get(e, 10), cy = get(e, 20), ax = get(e, 11), ay = get(e, 21), ratio = get(e, 40), t0 = get(e, 41, 0);
        let t1 = get(e, 42, 2 * Math.PI); if (t1 <= t0) t1 += 2 * Math.PI;
        // (The minor axis is the major turned a quarter about the extrusion, times the ratio: in the OCS, (−ay, ax).)
        const ts: number[] | undefined = u.curves ? [] : undefined;
        flatten(t => point(cx + ax * Math.cos(t) - ratio * ay * Math.sin(t), cy + ay * Math.cos(t) + ratio * ax * Math.sin(t)), t0, t1, tol, 16, line, ts);
        u.curves?.push({ type: 'ELLIPSE', center: [cx, cy], major: [ax, ay], ratio, start: t0, end: t1, map: W, polyline: u.polylines.length, params: ts! });
        u.polylines.push(line); count('ELLIPSE'); continue;
      }
      if (e.type === 'SPLINE') {
        const degree = get(e, 71), xs = all(e, 10), ys = all(e, 20), knots = all(e, 40), w = all(e, 41);
        if (!xs.length) { leave('SPLINE', 'fit points only: the curve through them is the writing program\'s interpolation, not read'); continue; }
        const cps: P[] = xs.map((x, i) => [x, ys[i]]);
        if (knots.length !== cps.length + degree + 1) throw refusal('DXF_MALFORMED', `a SPLINE with ${knots.length} knots for ${cps.length} control points of degree ${degree}`);
        const weights = w.length === cps.length && w.some(v => v !== 1) ? w : null;
        const at = (t: number) => { const q = splinePoint(degree, knots, cps, weights, t); return point(q[0], q[1]); };
        // (Each knot span flattened on its own: the curve is smooth only within one.)
        const ts: number[] | undefined = u.curves ? [] : undefined;
        for (let s = degree; s < cps.length; s++) if (knots[s + 1] > knots[s]) flatten(at, knots[s], knots[s + 1], tol, 4, line, ts);
        u.curves?.push({ type: 'SPLINE', degree, knots, control: cps, weights, map: W, polyline: u.polylines.length, params: ts! });
        u.polylines.push(line); count('SPLINE'); continue;
      }
      if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
        const pts: P[] = [], bulges: number[] = [];
        if (e.type === 'LWPOLYLINE') { for (const [code, v] of e.body) { if (code === 10) { pts.push([num(v, 'x'), 0]); bulges.push(0); } else if (code === 20 && pts.length) pts[pts.length - 1][1] = num(v, 'y'); else if (code === 42 && pts.length) bulges[bulges.length - 1] = num(v, 'bulge'); } }
        else for (let j = k + 1; j < list.length && list[j].type === 'VERTEX'; j++) { pts.push([get(list[j], 10), get(list[j], 20)]); bulges.push(get(list[j], 42, 0)); }
        const closed = (get(e, 70, 0) & 1) === 1, n = pts.length;
        for (let j = 0; j + 1 < n + (closed ? 1 : 0); j++) {
          const a = pts[j], b = pts[(j + 1) % n], g = bulges[j];
          if (Math.abs(g) < 1e-12) { if (!line.length) line.push(point(a[0], a[1])); line.push(point(b[0], b[1])); continue; }
          const dx = b[0] - a[0], dy = b[1] - a[1], ch = Math.hypot(dx, dy), th = 4 * Math.atan(g), r = ch / (2 * Math.sin(th / 2)), h = r * Math.cos(th / 2);
          const cx = (a[0] + b[0]) / 2 - dy / ch * h, cy = (a[1] + b[1]) / 2 + dx / ch * h, s0 = Math.atan2(a[1] - cy, a[0] - cx), R = Math.abs(r);
          flatten(t => point(cx + R * Math.cos(t), cy + R * Math.sin(t)), s0, s0 + th, tol, 4, line);
        }
        u.polylines.push(line); count(e.type); continue;
      }
      if (e.type === 'TEXT' || e.type === 'MTEXT') {
        const aligned = e.type === 'TEXT' && (get(e, 72, 0) !== 0 || get(e, 73, 0) !== 0) && e.body.some(p => p[0] === 11);
        const x = aligned ? get(e, 11) : get(e, 10), y = aligned ? get(e, 21) : get(e, 20), h = get(e, 40);
        // (MTEXT's direction: its X axis (11, 21) when given, else its rotation (50).)
        const rot = e.type === 'MTEXT' && e.body.some(p => p[0] === 11) ? Math.atan2(get(e, 21), get(e, 11)) * 180 / Math.PI : get(e, 50, 0);
        const d = apply({ ...W, e: 0, f: 0 }, Math.cos(rot * Math.PI / 180), Math.sin(rot * Math.PI / 180)), up = apply({ ...W, e: 0, f: 0 }, -Math.sin(rot * Math.PI / 180), Math.cos(rot * Math.PI / 180));
        const raw = e.type === 'MTEXT' ? [...e.body.filter(p => p[0] === 3).map(p => p[1]), str(e, 1) ?? ''].join('') : str(e, 1) ?? '';
        u.texts.push({ at: point(x, y), text: e.type === 'MTEXT' ? plainMtext(raw) : raw, height: h * Math.hypot(up[0], up[1]), angle: Math.atan2(d[1], d[0]) * 180 / Math.PI });
        count(e.type); continue;
      }
      leave(e.type, inBlock ? 'not read inside a block' : 'not read');
    }
  };
  walk(top, I2, false, []);
  return u;
}
