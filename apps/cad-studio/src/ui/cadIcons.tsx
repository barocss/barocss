// CAD command icons, drawn to one system so they read as a set: a 24 × 24 grid, 1.5 strokes in the current
// colour, solids in one isometric view (built from model coordinates by `iso`, so every block, cylinder
// and prism shares its angles and proportions) and shaded in three tones (top lightest, then right, then
// left), with the part the command makes or changes in the accent colour (`--icon-ac`). No dashes: at
// rail size they break up; construction lines are lighter strokes instead. `Icon` uses these for `cad-` names.
import type { ReactNode } from 'react';

type V3 = [number, number, number];
type XY = [number, number];
const K = 8.5, OY = 12;
/** Model (x, y, z) in units of a cube's side (0…1 fills the icon) to icon coordinates. */
const iso = ([x, y, z]: V3): XY => [12 + (x - y) * 0.866 * K, OY + (x + y) * 0.5 * K - z * K];
const f1 = (v: number) => String(Math.round(v * 100) / 100);
const d = (pts: XY[], close = true) => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + (close ? 'Z' : '');
const isoPath = (pts: V3[], close = true) => d(pts.map(iso), close);

const TONE = { top: 0.34, right: 0.2, left: 0.1 } as const;
// Faces are opaque (the current colour mixed into the icon's background, `--icon-bg`), so what is behind
// them is hidden as on a solid, and lines never show through.
const BG = 'var(--icon-bg, #242529)';
const tone = (p: number) => ({ fill: `color-mix(in srgb, currentColor ${Math.round(p * 100)}%, ${BG})` });
const acTone = { fill: `color-mix(in srgb, var(--icon-ac) 55%, ${BG})` };
const dark = { fill: `color-mix(in srgb, ${BG} 45%, #000)` };
/** A filled face, no outline. `ac`: in the accent colour. */
const toneOf = tone;
const face = (path: string, t: number, ac = false, key?: string | number) => <path key={key} d={path} style={ac ? acTone : toneOf(t)} stroke="none" />;
const line = (path: string, key?: string | number) => <path key={key} d={path} />;
const ac = (path: string, key?: string | number) => <path key={key} d={path} className="ac" />;
const ghost = (path: string, key?: string | number) => <path key={key} d={path} strokeOpacity={0.45} strokeWidth={1.1} />;
/** An arrow head at `tip` pointing away from `from` (filled, accent by default). */
function head(from: XY, tip: XY, size = 3.4, accent = true): ReactNode {
  const l = Math.hypot(tip[0] - from[0], tip[1] - from[1]) || 1, u: XY = [(tip[0] - from[0]) / l, (tip[1] - from[1]) / l], n: XY = [-u[1], u[0]];
  const b: XY = [tip[0] - u[0] * size, tip[1] - u[1] * size], w = size * 0.62;
  return <path d={d([tip, [b[0] + n[0] * w, b[1] + n[1] * w], [b[0] - n[0] * w, b[1] - n[1] * w]])} className={accent ? 'acf ac' : undefined} fill={accent ? undefined : 'currentColor'} strokeWidth={1} />;
}

/**
 * A prism: a profile in the model's XZ plane (x right, z up; counter-clockwise; arcs already sampled)
 * pulled along Y from y0 to y1. Draws the side faces turned to the view, the near cap (y1), and the edges:
 * the cap's outline, the far ends of the seen faces and the runs along Y at silhouette and sharp corners.
 * `accent(i)`: the side face from point i to i + 1 in the accent colour.
 */
function prism(pts: XY[], y0 = 0, y1 = 1, opts: { accent?: (i: number) => boolean; capAccent?: boolean } = {}): ReactNode[] {
  const n = pts.length, out: ReactNode[] = [];
  // Outward normal of edge a→b (counter-clockwise in x, z): (dz, −dx); seen when it leans to the viewer (+x, +z).
  const sides = pts.map((a, i) => {
    const b = pts[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (b[1] - a[1]) / l, nz = -(b[0] - a[0]) / l;
    return { i, a, b, nx, nz, seen: nx + nz > 1e-6, depth: a[0] + b[0] + a[1] + b[1] };
  });
  for (const s of sides.filter(x => x.seen).sort((p, q) => p.depth - q.depth)) {
    const tone = TONE.left + (TONE.top - TONE.left) * Math.max(0, s.nz) + (TONE.right - TONE.left) * Math.max(0, s.nx);
    out.push(face(isoPath([[s.a[0], y0, s.a[1]], [s.b[0], y0, s.b[1]], [s.b[0], y1, s.b[1]], [s.a[0], y1, s.a[1]]]), tone, opts.accent?.(s.i) ?? false, 'f' + s.i));
  }
  const cap = pts.map(p => [p[0], y1, p[1]] as V3);
  out.push(face(isoPath(cap), TONE.left, !!opts.capAccent, 'cap'), line(isoPath(cap), 'capl'));
  const far = sides.filter(x => x.seen).map(x => isoPath([[x.a[0], y0, x.a[1]], [x.b[0], y0, x.b[1]]], false)).join('');
  const turn = (k: number) => {
    const p = pts[(k - 1 + n) % n], c = pts[k], q = pts[(k + 1) % n];
    let t = Math.abs(Math.atan2(q[1] - c[1], q[0] - c[0]) - Math.atan2(c[1] - p[1], c[0] - p[0])); if (t > Math.PI) t = 2 * Math.PI - t;
    return t;
  };
  const runs = pts.map((c, k) => { const was = sides[(k - 1 + n) % n].seen, is = sides[k].seen; return was !== is || (was && is && turn(k) > 0.35) ? isoPath([[c[0], y0, c[1]], [c[0], y1, c[1]]], false) : ''; }).join('');
  out.push(line(far + runs, 'edges'));
  return out;
}
/** An arc in the profile plane, sampled (degrees, counter-clockwise from +x). */
const arc = (c: XY, r: number, from: number, to: number, steps = 8): XY[] => Array.from({ length: steps + 1 }, (_, i) => { const a = (from + (to - from) * i / steps) * Math.PI / 180; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; });

/** A horizontal circle (centre in model x, y, at height z) as an iso ellipse. */
function ellipse(c: V3, r: number, extra: Record<string, unknown> = {}, key?: string): ReactNode {
  const [x, y] = iso(c);
  return <ellipse key={key} cx={f1(x)} cy={f1(y)} rx={f1(1.2247 * r * K)} ry={f1(0.7071 * r * K)} {...extra} />;
}
/** An upright cylinder (or a cone's frustum: top radius `rt`) about (c, c) from z0 to z1. */
function cylinder(c: number, r: number, z0: number, z1: number, rt = r, opts: { bore?: number; accentTop?: boolean } = {}): ReactNode[] {
  const [bx, by] = iso([c, c, z0]), [tx, ty] = iso([c, c, z1]), rx = 1.2247 * K, ry = 0.7071 * K;
  const wall = `M${f1(tx - rt * rx)} ${f1(ty)}L${f1(bx - r * rx)} ${f1(by)}A${f1(r * rx)} ${f1(r * ry)} 0 0 0 ${f1(bx + r * rx)} ${f1(by)}L${f1(tx + rt * rx)} ${f1(ty)}` + (rt > 0 ? `A${f1(rt * rx)} ${f1(rt * ry)} 0 0 1 ${f1(tx - rt * rx)} ${f1(ty)}Z` : 'Z');
  const outline = `M${f1(tx - rt * rx)} ${f1(ty)}L${f1(bx - r * rx)} ${f1(by)}A${f1(r * rx)} ${f1(r * ry)} 0 0 0 ${f1(bx + r * rx)} ${f1(by)}L${f1(tx + rt * rx)} ${f1(ty)}`;
  const out: ReactNode[] = [face(wall, TONE.right, false, 'w'), line(outline, 'wl')];
  if (rt > 0) {
    out.push(ellipse([c, c, z1], rt, { style: opts.accentTop ? acTone : tone(TONE.top), stroke: 'none' }, 'tf'), ellipse([c, c, z1], rt, {}, 'tl'));
    if (opts.bore) out.push(ellipse([c, c, z1], opts.bore, { style: dark }, 'b'));
  }
  return out;
}

/** The unit block's three seen faces and edges, between (x0, y0, z0) and (x1, y1, z1). */
const block = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, opts: { accent?: (i: number) => boolean } = {}) =>
  prism([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1, opts);

/** Points one clicks, as small accent dots. */
const dots = (pts: XY[]) => <g>{pts.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={1.7} className="acf" stroke="none" />)}</g>;
// Flat (2D) parts share these: a 1.5 stroke, round ends, filled heads.
const arrow = (from: XY, to: XY, accent = true): ReactNode[] => [accent ? ac(d([from, to], false), 's') : line(d([from, to], false), 's'), <g key="h">{head(from, to, 3.6, accent)}</g>];

// Booleans: two circles r 6.5 at x 9 and 15 meeting at x 12, y 12 ± 5.77.
const BA = 'M12 6.23A6.5 6.5 0 1 0 12 17.77';
/** A coil seen from the side: five turns, each a front half (solid) and a back half (faint), between two ground plates. */
const SPRING = (() => {
  let front = '', back = '';
  for (let k = 0; k < 5; k++) { const y = 5 + k * 2.9; front += `M5 ${y.toFixed(2)}C5 ${(y + 2.6).toFixed(2)} 19 ${(y + 2.9).toFixed(2)} 19 ${(y + 1.45).toFixed(2)}`; back += `M19 ${(y + 1.45).toFixed(2)}C19 ${(y - 0.2).toFixed(2)} 5 ${(y + 0.3).toFixed(2)} 5 ${(y + 2.9).toFixed(2)}`; }
  return { front, back };
})();
const circles = [<circle key="a" cx="9" cy="12" r="6.5" />, <circle key="b" cx="15" cy="12" r="6.5" />];

export const CAD_ICONS: Record<string, ReactNode> = {
  // A pencil drawing a profile on a plane.
  'cad-sketch': <>{face(isoPath([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]), 0.12)}{ghost(isoPath([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]))}
    {ac(isoPath([[0.2, 0.25, 0], [0.75, 0.25, 0], [0.75, 0.75, 0], [0.2, 0.75, 0]]))}
    <path d="M13.2 13.8l6.6-6.6 2.2 2.2-6.6 6.6-3 .8z" style={tone(0.34)} /><path d="M18.4 8.6l2.2 2.2" /></>,
  // A profile pulled up into a block: the new block in the accent colour, the pull arrow.
  'cad-extrude': <>{face(isoPath([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]), 0.1)}{ghost(isoPath([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]))}
    {prism([[0.15, 0], [0.85, 0], [0.85, 0.55], [0.15, 0.55]], 0.15, 0.85, { accent: () => true, capAccent: true })}
    {arrow(iso([0.5, 0.5, 0.55]), [12, 1.6])}</>,
  // A profile beside an axis, and the turn round the axis it is swept through.
  'cad-revolve': <>{ghost('M8 2.5V21.5')}{face('M10.5 5.5h4l2.5 3v7l-2.5 3h-4z', TONE.right)}{line('M10.5 5.5h4l2.5 3v7l-2.5 3h-4z')}
    {ac('M8 9.2c-3.6 0-5.4 1-5.4 2.8s1.8 2.8 5.4 2.8c1.2 0 2.2-.1 3-.3')}<g>{head([9.6, 14.6], [13.2, 14.1])}</g></>,
  // A round section carried along a bent path.
  'cad-sweep': <>{ac('M4.5 19.5V13a7 7 0 0 1 7-7h8')}{line('M2.5 19.5V13a9 9 0 0 1 9-9h8M6.5 19.5V13a5 5 0 0 1 5-5h8')}
    <ellipse cx="4.5" cy="19.5" rx="2" ry="0.9" style={tone(0.34)} /><ellipse cx="19.5" cy="6" rx="0.9" ry="2" /></>,
  // A square section blended into a round one above it.
  'cad-loft': (() => {
    const l = iso([0, 1, -0.2]), b = iso([1, 1, -0.2]), r = iso([1, 0, -0.2]), t = iso([0, 0, -0.2]), [cx, cy] = iso([0.5, 0.5, 1.05]), rx = 4.4, ry = 2.5;
    const body = `M${f1(l[0])} ${f1(l[1])}L${f1(b[0])} ${f1(b[1])}L${f1(r[0])} ${f1(r[1])}L${f1(cx + rx)} ${f1(cy)}A${rx} ${ry} 0 0 0 ${f1(cx - rx)} ${f1(cy)}Z`;
    return <>{ghost(d([l, t, r], false))}{face(`M${f1(l[0])} ${f1(l[1])}L${f1(b[0])} ${f1(b[1])}L${f1(cx)} ${f1(cy + ry)}A${rx} ${ry} 0 0 1 ${f1(cx - rx)} ${f1(cy)}Z`, TONE.left)}
      {face(`M${f1(b[0])} ${f1(b[1])}L${f1(r[0])} ${f1(r[1])}L${f1(cx + rx)} ${f1(cy)}A${rx} ${ry} 0 0 1 ${f1(cx)} ${f1(cy + ry)}Z`, TONE.right)}
      {line(body.replace(/A[^Z]*Z$/, '') + `M${f1(b[0])} ${f1(b[1])}L${f1(cx)} ${f1(cy + ry)}`)}
      <ellipse cx={f1(cx)} cy={f1(cy)} rx={rx} ry={ry} style={acTone} className="ac" /></>;
  })(),
  // A plate with a round hole in its top.
  'cad-hole': <>{block(0, 0, 0, 1, 1, 0.6)}<g transform="translate(0 3.4)">{ellipse([0.5, 0.5, 0.6], 0.24, { style: dark })}{ellipse([0.5, 0.5, 0.6], 0.24, { className: 'ac' })}</g></>,
  // A block with its front top edge rounded.
  'cad-fillet': <>{prism([[0, 0], [1, 0], ...arc([0.5, 0.5], 0.5, 0, 90), [0, 1]], 0, 1, { accent: i => i >= 2 && i < 10 })}{ac(isoPath(arc([0.5, 0.5], 0.5, 0, 90).map(p => [p[0], 1, p[1]] as V3), false))}</>,
  // An L whose inside corner is one round, tangent to its floor and its wall.
  'cad-face-fillet': <>{prism([[0, 0], [1, 0], [1, 0.3], ...arc([0.7, 0.7], 0.4, 270, 180).slice(1), [0.3, 1], [0, 1]], 0, 1, { accent: i => i >= 2 && i < 10 })}{ac(isoPath(arc([0.7, 0.7], 0.4, 270, 180).map(p => [p[0], 1, p[1]] as V3), false))}</>,
  // A rod with a helix wound round it.
  'cad-thread': <>{prism([[0.3, 0], [0.7, 0], [0.7, 1], [0.3, 1]], 0, 1)}{ac(isoPath(Array.from({ length: 49 }, (_, i) => { const t = i / 48 * 6 * Math.PI; return [0.5 + 0.24 * Math.cos(t), 0.5 + 0.24 * Math.sin(t), 0.08 + 0.84 * i / 48] as V3; }), false))}</>,
  // A wall whose top is one half cylinder, side to side.
  'cad-full-round': <>{prism([[0.2, 0], [0.8, 0], ...arc([0.5, 0.7], 0.3, 0, 180), [0.2, 0.7]], 0, 1, { accent: i => i >= 2 && i < 10 })}{ac(isoPath(arc([0.5, 0.7], 0.3, 0, 180).map(p => [p[0], 1, p[1]] as V3), false))}</>,
  // A block with its front top edge cut at 45°.
  'cad-chamfer': <>{prism([[0, 0], [1, 0], [1, 0.55], [0.55, 1], [0, 1]], 0, 1, { accent: i => i === 2 })}{ac(isoPath([[1, 1, 0.55], [0.55, 1, 1]], false))}</>,
  // A block hollowed to thin walls, open at the top.
  'cad-shell': (() => {
    const t = 0.17, u = 1 - t, o: V3[] = [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], i: V3[] = [[t, t, 1], [u, t, 1], [u, u, 1], [t, u, 1]];
    return <><clipPath id="cad-shell-open"><path d={isoPath(i)} /></clipPath>
      <g clipPath="url(#cad-shell-open)">{face(isoPath([[t, t, t], [t, t, 1], [t, u, 1], [t, u, t]]), TONE.right * 0.7)}{face(isoPath([[t, t, t], [t, t, 1], [u, t, 1], [u, t, t]]), TONE.left)}
      {face(isoPath([[t, t, t], [u, t, t], [u, u, t], [t, u, t]]), TONE.top * 0.7)}
      {line(isoPath([[t, t, 1], [t, t, t]], false) + isoPath([[u, t, t], [t, t, t], [t, u, t]], false))}</g>
      <path d={isoPath(o) + isoPath(i)} fillRule="evenodd" style={acTone} stroke="none" />
      {face(isoPath([[1, 0, 1], [1, 1, 1], [1, 1, 0], [1, 0, 0]]), TONE.right)}{face(isoPath([[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]), TONE.left)}
      {line(isoPath([[0, 0, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1]]) + isoPath([[1, 1, 1], [1, 1, 0]], false))}{ac(isoPath(i))}</>;
  })(),
  // Walls leaning in from a pull direction.
  'cad-draft': <>{prism([[0.05, 0], [0.95, 0], [0.75, 1], [0.25, 1]], 0, 1, { accent: i => i === 1 })}{ghost(d([iso([0.95, 1, 0]), iso([0.95, 1, 1.05])], false))}</>,
  // Four arrows from a centre.
  'cad-move': <>{line('M12 3.5v17M3.5 12h17')}<g>{head([12, 8], [12, 2.5], 3.6, false)}{head([12, 16], [12, 21.5], 3.6, false)}{head([8, 12], [2.5, 12], 3.6, false)}{head([16, 12], [21.5, 12], 3.6, false)}</g><circle cx="12" cy="12" r="2.2" className="acf ac" /></>,
  // A turn about a centre.
  'cad-rotate': <>{ac('M19.2 9.5A7.5 7.5 0 1 0 19.5 13')}<g>{head([18, 6.8], [19.6, 10.2], 3.8)}</g><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" /></>,
  // A small square grown into a large one along the diagonal.
  'cad-scale': <>{face('M3.5 11.5h9v9h-9z', TONE.right)}{line('M3.5 11.5h9v9h-9z')}{ghost('M3.5 3.5h17v17')}{arrow([9, 15], [19.5, 4.5])}</>,
  // A block brought down onto another's top face.
  'cad-align': <>{block(0, 0, 0, 1, 1, 0.38, { accent: i => i === 2 })}<g transform="translate(0 -6.2)">{block(0.22, 0.22, 0.38, 0.78, 0.78, 0.8)}</g>{arrow([12, 0.9], [12, 4.6])}</>,
  // A hex head bolt: the head, the shank with cosmetic thread lines.
  'cad-fastener': <>{cylinder(0.5, 0.18, -0.95, 0.35, 0.18)}{prism([[0.12, 0.35], [0.88, 0.35], [0.88, 0.62], [0.12, 0.62]], 0.12, 0.88)}{ac('M10.6 15.4l2.8 1.4M10.6 17.6l2.8 1.4M10.6 19.8l2.8 1.4')}</>,
  // A block and its copy beside it.
  'cad-duplicate': <><g transform="translate(-4 -2.4)">{block(0.08, 0.08, 0.1, 0.62, 0.62, 0.64)}</g><g transform="translate(4 2.4)">{block(0.08, 0.08, 0.1, 0.62, 0.62, 0.64, { accent: () => true })}</g></>,
  // A shape and its mirror image across a plane.
  'cad-mirror': <>{ac('M12 2.5v19')}{face('M9.5 6.5v11h-6z', TONE.right)}{line('M9.5 6.5v11h-6z')}{ghost('M14.5 6.5v11h6z')}</>,
  // Copies in a row along an arrow.
  'cad-pattern-linear': <>{[3, 9.5, 16].map((x, k) => <rect key={x} x={x} y="5.5" width="5" height="5" rx="1" className={k === 0 ? 'ac' : undefined} style={k ? tone(0.2) : acTone} strokeOpacity={k ? 0.6 : 1} />)}
    {arrow([3, 16.5], [21.5, 16.5], false)}</>,
  // Copies round an axis.
  'cad-pattern-circular': <>{ghost('M12 4.5a7.5 7.5 0 1 1-.01 0')}<circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    {[0, 90, 180, 270].map((a, k) => { const r = a * Math.PI / 180, x = 12 + 7.5 * Math.sin(r), y = 12 - 7.5 * Math.cos(r); return <rect key={a} x={f1(x - 2.3)} y={f1(y - 2.3)} width="4.6" height="4.6" rx="1" className={k === 0 ? 'ac' : undefined} style={k ? tone(0.2) : acTone} strokeOpacity={k ? 0.6 : 1} />; })}</>,
  // A block cut in two by a plane between the halves.
  // (A block whose top is fine triangles on its near half and two coarse ones, in the accent, on the far half.)
  'cad-decimate': (() => {
    const top = (x: number, y: number): V3 => [x, y, 1], fine: string[] = [];
    for (let k = 1; k < 4; k++) fine.push(isoPath([top(k / 8, 0), top(k / 8, 1)], false));
    for (let k = 1; k < 4; k++) fine.push(isoPath([top(0, k / 4), top(0.5, k / 4)], false));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) fine.push(isoPath([top(i / 8, j / 4), top((i + 1) / 8, (j + 1) / 4)], false));
    return <>{block(0, 0, 0, 1, 1, 1)}{fine.map((p, k) => ghost(p, k))}{ac(isoPath([top(0.5, 0), top(0.5, 1)], false), 'm')}{ac(isoPath([top(0.5, 0), top(1, 1)], false), 'c')}</>;
  })(),
  'cad-split': <>{block(0, 0, 0, 1, 0.42, 1)}{face(isoPath([[-0.1, 0.5, -0.12], [1.1, 0.5, -0.12], [1.1, 0.5, 1.12], [-0.1, 0.5, 1.12]]), 0, true)}{ac(isoPath([[-0.1, 0.5, -0.12], [1.1, 0.5, -0.12], [1.1, 0.5, 1.12], [-0.1, 0.5, 1.12]]))}{block(0, 0.58, 0, 1, 1, 1)}</>,
  // Two blocks overlapping, the overlap lit.
  'cad-interference': <><g transform="translate(-3.4 -1.6)">{block(0.05, 0.05, 0.1, 0.62, 0.62, 0.7)}</g><g transform="translate(3.4 1.6)">{block(0.05, 0.05, 0.1, 0.62, 0.62, 0.7)}</g>{face('M10.2 8.6l3.6 1.8v3.8l-3.6-1.8z', 0, true)}{ac('M10.2 8.6l3.6 1.8v3.8l-3.6-1.8z')}</>,
  // A rule with ticks.
  'cad-measure': <>{face('M2.8 15.6L15.6 2.8l5.6 5.6L8.4 21.2z', TONE.right)}{line('M2.8 15.6L15.6 2.8l5.6 5.6L8.4 21.2z')}{ac('M6.2 12.2l2.2 2.2M9 9.4l1.5 1.5M11.8 6.6l2.2 2.2M14.6 3.8l1.5 1.5')}</>,
  // A parts list: a sheet with its lines, their item marks in the accent (O147's BOM).
  'cad-bom': <>{face('M5 2.8h10.4l3.6 3.6v14.8H5z', TONE.right)}{line('M5 2.8h10.4l3.6 3.6v14.8H5z')}{line('M10.4 9.2h5.6M10.4 13h5.6M10.4 16.8h4')}{ac('M7.4 9.2h1.2M7.4 13h1.2M7.4 16.8h1.2')}</>,
  // A rebuild (O10): a block in a turning arrow, the arrow in the accent.
  'cad-rebuild': <><g transform="translate(0 1.2)">{block(0.22, 0.22, 0.05, 0.78, 0.78, 0.6)}</g>{ac('M20.2 11.4A8.2 8.2 0 1 1 17.8 5.8')}{ac('M18.4 2.6l-.4 3.4-3.4-.2')}</>,
  // Primitive solids.
  'cad-box': <>{block(0, 0, 0, 1, 1, 1)}</>,
  'cad-cylinder': <>{cylinder(0.5, 0.5, -0.05, 0.95)}</>,
  'cad-sphere': <><circle cx="12" cy="12" r="8.5" style={tone(TONE.right)} /><path d="M3.5 12a8.5 3.2 0 0 0 17 0" strokeOpacity={0.55} /><ellipse cx="9" cy="8.6" rx="2.6" ry="1.8" style={tone(0.3)} stroke="none" /><circle cx="12" cy="12" r="8.5" /></>,
  'cad-cone': <>{cylinder(0.5, 0.52, -0.08, 1.05, 0)}</>,
  'cad-gear': <><path d="M12 2.5l1.6 2.6 3-.6.6 3 2.6 1.6-1.4 2.9 1.4 2.9-2.6 1.6-.6 3-3-.6L12 21.5l-1.6-2.6-3 .6-.6-3-2.6-1.6 1.4-2.9-1.4-2.9 2.6-1.6.6-3 3 .6z" style={tone(TONE.right)} /><circle cx="12" cy="12" r="2.6" style={dark} /></>,
  // An O-ring (R12c.5): the ring's section as a torus seen across, its gland's groove in the accent colour.
  'cad-oring': <><circle cx="12" cy="12" r="8.5" style={tone(TONE.right)} /><circle cx="12" cy="12" r="5" style={dark} />{ac('M3.5 12a8.5 8.5 0 0 1 17 0')}</>,
  // A bearing (R12c.4): its outer and inner rings, the balls between in the accent colour.
  'cad-bearing': <><circle cx="12" cy="12" r="9.5" style={tone(TONE.right)} /><circle cx="12" cy="12" r="4.5" style={dark} />{[0, 1, 2, 3, 4, 5].map(k => <circle key={k} cx={12 + 7 * Math.cos(k * Math.PI / 3)} cy={12 + 7 * Math.sin(k * Math.PI / 3)} r="1.3" className="acf" stroke="none" />)}</>,
  // A key (R12c.3b): a round-ended block, its top in the accent colour.
  'cad-key': <><path d="M7 9h10a3 3 0 0 1 0 6H7a3 3 0 0 1 0-6z" style={tone(TONE.right)} />{ac('M7 9h10')}</>,
  // A shaft (R12c.3a): three steps side by side, the middle one larger, its keyseat in the accent colour.
  'cad-shaft': <><path d="M2.5 9.5h6v-2h7v2h6v5h-6v2h-7v-2h-6z" style={tone(TONE.right)} />{ac('M10.2 7.5h3.6')}<path d="M8.5 7.5v9M15.5 7.5v9" strokeOpacity={0.55} /></>,
  // A fit (R12c.2): a shaft in its bore, the gap between them in the accent colour.
  'cad-fit': <><circle cx="12" cy="12" r="9" style={tone(TONE.right)} /><circle cx="12" cy="12" r="5.6" style={dark} /><circle cx="12" cy="12" r="4.6" style={tone(TONE.top)} />{ac('M17.6 12h3.4M3 12h3.4')}</>,
  // A gusset (FRk1): an L of two members, the clipped plate in its corner in the accent colour.
  'cad-gusset': <><path d="M3 3h4v14h14v4H3z" style={tone(TONE.right)} /><path d="M7 9.5v7.5h7.5z" style={dark} />{ac('M7 9.5v7.5h7.5z')}</>,
  // An end cap (FRk1): a tube seen along its end, the cap over it in the accent colour.
  'cad-end-cap': <><path d="M4 9h11v10H4z" style={tone(TONE.right)} /><path d="M6.5 11.5h6v5h-6z" style={dark} /><path d="M15 7.5h2.5v13H15z" style={tone(TONE.top)} />{ac('M15 7.5h2.5v13H15z')}</>,
  // A connector opening (R12c.7): a panel with a stadium opening, the opening in the accent colour.
  'cad-connector': <><path d="M3 5h18v14H3z" style={tone(TONE.right)} /><path d="M8.5 10.5h7a1.5 1.5 0 0 1 0 3h-7a1.5 1.5 0 0 1 0-3z" style={dark} />{ac('M8.5 10.5h7a1.5 1.5 0 0 1 0 3h-7a1.5 1.5 0 0 1 0-3z')}</>,
  // A sprocket (R12c.6b): its teeth round the seats, the bore; the seats' circle in the accent colour.
  'cad-sprocket': <><path d="M18.96 10.15L21.35 11.06L21.35 12.94L18.96 13.85L18.95 13.88L20.57 15.86L19.63 17.49L17.10 17.08L17.08 17.10L17.49 19.63L15.86 20.57L13.88 18.95L13.85 18.96L12.94 21.35L11.06 21.35L10.15 18.96L10.12 18.95L8.14 20.57L6.51 19.63L6.92 17.10L6.90 17.08L4.37 17.49L3.43 15.86L5.05 13.88L5.04 13.85L2.65 12.94L2.65 11.06L5.04 10.15L5.05 10.12L3.43 8.14L4.37 6.51L6.90 6.92L6.92 6.90L6.51 4.37L8.14 3.43L10.12 5.05L10.15 5.04L11.06 2.65L12.94 2.65L13.85 5.04L13.88 5.05L15.86 3.43L17.49 4.37L17.08 6.90L17.10 6.92L19.63 6.51L20.57 8.14L18.95 10.12Z" style={tone(TONE.right)} /><circle cx="12" cy="12" r="2.4" style={dark} />{ac('M12 4.8a7.2 7.2 0 1 1 -0.01 0')}</>,
  // A pulley (R12c.6b): a V-grooved wheel seen across, the groove in the accent colour.
  'cad-pulley': <><path d="M6 3h12v6l-3 3 3 3v6H6v-6l3-3-3-3z" style={tone(TONE.right)} />{ac('M9 12h6')}<path d="M12 3v18" strokeOpacity={0.4} /></>,
  // A belt drive (R12c.6b): two wheels and the belt round them in the accent colour.
  'cad-belt': <><circle cx="7" cy="12" r="3.4" style={tone(TONE.right)} /><circle cx="18" cy="12" r="2.2" style={tone(TONE.right)} />{ac('M7 7.2L18 8.4a3.6 3.6 0 0 1 0 7.2L7 16.8a4.8 4.8 0 0 1 0-9.6z')}</>,
  // A coupling (R12c.6b): a sleeve joining two shaft ends, the sleeve in the accent colour.
  'cad-coupling': <><path d="M2.5 10h6v4h-6zM15.5 10h6v4h-6z" style={tone(TONE.top)} /><path d="M8.5 7h7v10h-7z" style={tone(TONE.right)} />{ac('M8.5 7h7v10h-7z')}</>,
  // A disc cam (R12c.6a): its lobed profile round a bore, the roller follower on top and its stem in the accent colour.
  'cad-cam': <><path d="M17.76 15.5L17.56 16.23L17.33 16.93L17.08 17.6L16.76 18.25L16.36 18.85L15.89 19.39L15.35 19.86L14.75 20.26L14.1 20.58L13.42 20.81L12.72 20.95L12 21L11.28 20.95L10.58 20.81L9.9 20.58L9.25 20.26L8.65 19.86L8.11 19.39L7.64 18.85L7.24 18.25L6.92 17.6L6.69 16.92L6.55 16.22L6.5 15.5L6.55 14.78L6.69 14.08L6.91 13.39L7.18 12.72L7.48 12.03L7.83 11.33L8.27 10.63L8.8 9.95L9.44 9.31L10.19 8.76L11.06 8.33L12 8.06L12.99 7.97L13.99 8.08L14.95 8.39L15.82 8.89L16.57 9.55L17.17 10.33L17.6 11.2L17.88 12.1L18.01 13.01L18.01 13.89L17.92 14.72Z" style={tone(TONE.right)} /><circle cx="12" cy="15.5" r="1.6" style={dark} /><circle cx="12" cy="6.25" r="1.8" style={tone(TONE.top)} />{ac('M12 4.45V1.5')}</>,
  // A compression spring (R12c.1a): its coil between the ground plates.
  'cad-spring': <>{ghost(SPRING.back)}{line(SPRING.front)}{ac('M4 4.2h16M4 20.4h16')}</>,
  // A rack: a bar with trapezoid teeth along its top.
  'cad-rack': <><path d="M2.5 19.5v-6h1.4l1.2-3.4h2l1.2 3.4h1.4l1.2-3.4h2l1.2 3.4h1.4l1.2-3.4h2l1.2 3.4h.5v6z" style={tone(TONE.right)} /></>,
  'cad-subd': <><ellipse cx="12" cy="12.5" rx="9.5" ry="5.5" style={tone(TONE.right)} /><ellipse cx="12" cy="11.6" rx="4.2" ry="2.1" style={dark} />{ac('M12 7v3.5M12 13.7v4.3M2.5 12.5h5.3M16.2 12.5h5.3')}</>,
  'cad-torus': <><ellipse cx="12" cy="12.5" rx="9.5" ry="5.5" style={tone(TONE.right)} /><ellipse cx="12" cy="11.6" rx="4.2" ry="2.1" style={dark} />
    <path d="M7.8 11.6a4.2 2.1 0 0 0 8.4 0" strokeOpacity={0.6} /><ellipse cx="12" cy="12.5" rx="9.5" ry="5.5" /></>,
  'cad-tube': <>{cylinder(0.5, 0.5, -0.05, 0.95, 0.5, { bore: 0.27 })}</>,
  'cad-wedge': <>{prism([[0, 0], [1, 0], [0, 1]])}</>,
  // Sheet metal (R12.1): a thin plate, its top the sheet; an L of sheet, its bend in the accent colour.
  'cad-sheet-plate': <>{prism([[0, 0.3], [1, 0.3], [1, 0.44], [0, 0.44]], 0, 1, { accent: i => i === 2 })}</>,
  // A plate with a flange bent up from its edge, the flange in the accent colour.
  'cad-sheet-flange': <>{(() => {
    const t = 0.12, r = 0.14, c: XY = [1 - t - r, t + r];
    const pts: XY[] = [[0, 0], ...arc(c, r + t, 270, 360, 6), [1, 0.95], [1 - t, 0.95], ...arc(c, r, 0, -90, 6), [0, t]];
    return prism(pts, 0, 1, { accent: i => i >= 1 && i < 10 });
  })()}</>,
  // A plate with its corner cut away in the accent colour.
  'cad-sheet-corner': <>{prism([[0, 0.3], [0.62, 0.3], [0.62, 0.44], [0, 0.44]], 0, 1)}{prism([[0.62, 0.3], [1, 0.3], [1, 0.44], [0.62, 0.44]], 0.38, 1)}{face(isoPath([[0.62, 0, 0.44], [1, 0, 0.44], [1, 0.38, 0.44], [0.62, 0.38, 0.44]]), 0, true)}</>,
  'cad-sheet-profile': <>{(() => {
    const t = 0.14, r = 0.16, c: XY = [t + r, t + r];
    const pts: XY[] = [[1, 0], [1, t], ...arc(c, r, 270, 180, 6), [t, 1], [0, 1], ...arc(c, r + t, 180, 270, 6)];
    return prism(pts, 0, 1, { accent: i => i >= 2 && i < 8 });
  })()}</>,
  // A structural member (FR1): an angle's length, its section's cap in the accent colour.
  'cad-frame-member': <>{prism([[0, 0], [0.62, 0], [0.62, 0.16], [0.16, 0.16], [0.16, 0.62], [0, 0.62]], 0, 1, { capAccent: true })}</>,
  // A frame (FR2): a table's top rail on two legs, the members' caps in the accent colour.
  'cad-frame': <>{prism([[0, 0], [0.16, 0], [0.16, 0.84], [0.84, 0.84], [0.84, 0], [1, 0], [1, 1], [0, 1]], 0.2, 0.8, { capAccent: true })}</>,
  'cad-prism': <>{(() => {
    // A hexagonal prism, axis up: the top hexagon, then the three faces toward the view.
    const h = Array.from({ length: 6 }, (_, k) => { const a = (k * 60 + 30) * Math.PI / 180; return [0.5 + 0.55 * Math.cos(a), 0.5 + 0.55 * Math.sin(a)] as XY; });
    const top = h.map(([x, y]) => [x, y, 1] as V3), bottom = h.map(([x, y]) => [x, y, 0] as V3), out: ReactNode[] = [];
    [5, 0, 1].forEach(k => { const j = (k + 1) % 6, q = [bottom[k], bottom[j], top[j], top[k]]; out.push(face(isoPath(q), k === 5 ? TONE.right : k === 0 ? (TONE.right + TONE.left) / 2 : TONE.left, false, 'p' + k)); });
    out.push(face(isoPath(top), TONE.top, false, 'top'), line(isoPath(top), 'tl'), line(isoPath([bottom[5], bottom[0], bottom[1], bottom[2]], false), 'bl'));
    out.push(line([5, 0, 1, 2].map(k => isoPath([bottom[k], top[k]], false)).join(''), 'v'));
    return out;
  })()}</>,
  // Command-specific silhouettes: keep the original icons above for their original commands.
  // Internal teeth face into a ring, rather than out from a spur gear.
  'cad-internal-gear': <><circle cx="12" cy="12" r="9.5" style={tone(TONE.right)} /><path d="M10 5h4v2l2 1 1.7-1 2 3.5-1.7 1v2l1.7 1-2 3.5-1.7-1-2 1v2h-4v-2l-2-1-1.7 1-2-3.5 1.7-1v-2l-1.7-1 2-3.5L8 8l2-1z" style={dark} className="ac" /></>,
  // A toothed cone: wide heel below, narrow hub above.
  'cad-bevel-gear': <><ellipse cx="12" cy="6" rx="3.2" ry="1.7" style={tone(TONE.top)} /><path d="M8.8 6L3 17q9 6 18 0L15.2 6" style={tone(TONE.right)} /><path d="M3 17l1 3 2.4-.5 1.7 2 2.5-1 2.4 1 2.4-1 2.5.4L21 17" className="ac" /><path d="M9 9L6 17M12 9v10M15 9l3 8" strokeOpacity={0.55} /></>,
  // A threaded worm above its crossed wheel.
  'cad-worm-pair': <><path d="M2.5 3.5h19v5h-19z" style={tone(TONE.right)} /><path d="M5 8.5l3-5m1 5 3-5m1 5 3-5m1 5 3-5" className="ac" /><path d="M7 12l2-1 2 1 2-1 2 1 2-.3 1 2 2 1-1 2 .3 2-2 1-1 2-2-1-2 .3-1-2-2-1 1-2z" style={tone(TONE.right)} /><circle cx="13.2" cy="16" r="2.3" style={dark} /><path d="M13.2 13.7V10" className="ac" /></>,
  // Two separate toothed wheels engaging on a diagonal.
  'cad-gear-mesh': <><path d="M6 2.5h3l.6 2 2 .6 1.5 2.6-1.4 1.5.3 2.1-2.6 1.5L7.5 12 5 13l-2-2 .8-2.2L2.5 7l1.5-2.5L6 4z" style={tone(TONE.right)} /><circle cx="7.7" cy="7.7" r="1.6" style={dark} /><path d="M15.4 11l2.6.7.6 2 2 .7.8 2.6-1.5 1.6-.2 2.1-2.7.8-1.5-1.4-2.1.3-1.8-2.1.7-2-1-1.9 1.9-2z" style={acTone} className="ac" /><circle cx="16.6" cy="16.8" r="1.6" style={dark} /></>,
  // A hub with the rectangular key slot cut into its bore.
  'cad-keyway': <><circle cx="12" cy="12" r="9" style={tone(TONE.right)} /><path d="M10 6h4v3a4.5 4.5 0 1 1-4 0z" style={dark} /><path d="M10 9V6h4v3" className="ac" /></>,
  // An open circlip with two plier holes.
  'cad-retaining-ring': <><path d="M8 3.7a9 9 0 1 0 8 0l-1.5 4a4.7 4.7 0 1 1-5 0z" style={tone(TONE.right)} /><circle cx="7.4" cy="6.2" r="1.1" className="ac" /><circle cx="16.6" cy="6.2" r="1.1" className="ac" /></>,
  // A long dowel, with its circular end and chamfer visible.
  'cad-pin': <><path d="M5 17L15.5 3.5q3.5-1 4.5 3L9.5 20q-3.5 1-4.5-3z" style={tone(TONE.right)} /><ellipse cx="7.3" cy="18.5" rx="2.6" ry="1.6" transform="rotate(38 7.3 18.5)" style={tone(TONE.top)} /><path d="M15 4.2l4.4 3" className="ac" /></>,
  // An elbow pipe with open annular ends; the sweep icon retains its section/path view.
  'cad-pipe': <><path d="M3 19V12a9 9 0 0 1 9-9h7v6h-7a3 3 0 0 0-3 3v7" style={tone(TONE.right)} /><ellipse cx="6" cy="19" rx="3" ry="1.8" style={tone(TONE.top)} /><ellipse cx="6" cy="19" rx="1.3" ry=".8" style={dark} /><ellipse cx="19" cy="6" rx="1.8" ry="3" style={tone(TONE.top)} /><ellipse cx="19" cy="6" rx=".8" ry="1.3" style={dark} /><path d="M6 13a7 7 0 0 1 7-7" className="ac" /></>,
  // An existing face displaced outwards, with its former plane still visible.
  'cad-offset-face': <>{block(0.05, 0.05, 0, 0.8, 0.8, 0.65)}{ghost(isoPath([[0.8, 0.05, 0], [0.8, 0.8, 0], [0.8, 0.8, 0.65], [0.8, 0.05, 0.65]]))}{face('M18 8l4-2v9l-4 2z', 0, true)}{ac('M18 8l4-2v9l-4 2z')}{arrow([15.5, 11], [20.5, 8.5])}</>,
  // A closed print body with an exposed cavity and a small drain below.
  'cad-hollow': <><path d="M4 4h16v16H4z" style={tone(TONE.right)} /><path d="M7 7h10v9H7z" style={dark} /><path d="M7 16V7h10" className="ac" /><circle cx="12" cy="19" r="1.2" style={dark} /></>,
  // An open frame filled with crossing struts, rather than a hollow wall.
  'cad-lattice': <><path d="M3 5h18v15H3z" style={tone(TONE.left)} /><path d="M3 10l5-5 10 15 3-5M3 15L13 5l8 10M3 20L18 5M8 20L21 7" className="ac" /><path d="M3 5h18v15H3z" /></>,
  // Two keyed pieces on a printer bed, rather than a single cutting plane.
  'cad-split-bed': <><path d="M2 18l10-4 10 4-10 4z" style={tone(TONE.left)} /><path d="M3 7h7v4h2v3h-2v3H3z" style={tone(TONE.right)} /><path d="M14 7h7v10h-7v-3h2v-3h-2z" style={tone(TONE.top)} /><path d="M10 11h2v3h-2M14 11h2v3h-2" className="ac" /></>,
  // A shaft and its mating bore, separated along their common axis.
  'cad-fit-pair': <><path d="M2 9h8v6H2z" style={tone(TONE.right)} /><ellipse cx="10" cy="12" rx="1.7" ry="3" style={tone(TONE.top)} /><ellipse cx="18.5" cy="12" rx="3.5" ry="7" style={tone(TONE.right)} /><ellipse cx="18.5" cy="12" rx="1.4" ry="3" style={dark} /><path d="M11.5 5h5m-2-2 2 2-2 2" className="ac" /></>,
  // Rounded SubD forms retain visible quad loops, distinct from analytic primitives.
  'cad-subd-box': <><path d="M8 3h8q5 1 5 6v6q0 5-5 6H8q-5-1-5-6V9q0-5 5-6z" style={tone(TONE.right)} /><path d="M8 3q-3 9 0 18M16 3q3 9 0 18M3 8q9 3 18 0M3 16q9-3 18 0" strokeOpacity={0.55} /><path d="M8 8h8v8H8z" className="ac" /></>,
  'cad-subd-tube': <><path d="M4 6v12a8 3.5 0 0 0 16 0V6" style={tone(TONE.right)} /><ellipse cx="12" cy="6" rx="8" ry="3.5" style={tone(TONE.top)} /><ellipse cx="12" cy="6" rx="4.5" ry="1.7" style={dark} /><path d="M4 12a8 3.5 0 0 0 16 0M8 9v12M16 9v12" className="ac" /></>,
  'cad-subd-torus': <><ellipse cx="12" cy="12" rx="9.5" ry="7" style={tone(TONE.right)} /><ellipse cx="12" cy="12" rx="4" ry="2.6" style={dark} /><path d="M2.5 12h5.5m8 0h5.5M12 5v4.4m0 5.2V19M5.3 7.1l3.9 3.1m5.6 3.6 3.9 3.1M18.7 7.1l-3.9 3.1m-5.6 3.6-3.9 3.1" className="ac" /></>,
  // A control cage: wire edges and selected vertices, without a shaded body.
  'cad-subd-edit': <>{ghost('M5 7l9-4 6 5v9l-9 4-6-5zM5 7l6 5 9-4M11 12v9M14 3v9l6 5M5 16l9-4')}{ac('M5 7l6 5 9-4M11 12v9')}{dots([[5, 7], [11, 12], [20, 8], [11, 21]])}</>,
  // A mounting plate: a pilot bore surrounded by a four-bolt pattern.
  'cad-mount': <><rect x="3" y="3" width="18" height="18" rx="2" style={tone(TONE.right)} /><circle cx="12" cy="12" r="4" style={dark} />{[[6.5, 6.5], [17.5, 6.5], [6.5, 17.5], [17.5, 17.5]].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r="1.3" className="ac" />)}</>,
  // Sketch tools: flat drawings with their defining points (the points you click) in the accent colour.
  'cad-sk-rect': <>{face('M4.5 7h15v10h-15z', 0.12)}{line('M4.5 7h15v10h-15z')}{dots([[4.5, 7], [19.5, 17]])}</>,
  'cad-sk-circle': <><circle cx="12" cy="12" r="7.5" style={tone(0.12)} /><circle cx="12" cy="12" r="7.5" />{ghost('M12 12l5.3-5.3')}{dots([[12, 12], [17.3, 6.7]])}</>,
  'cad-sk-line': <>{line('M4 18L9 7l6 8 5-9')}{dots([[4, 18], [9, 7], [15, 15], [20, 6]])}</>,
  'cad-sk-arc': <>{ghost('M5 18L19 18')}{line('M5 18A8 8 0 0 1 19 18')}{dots([[5, 18], [19, 18], [12, 10.2]])}</>,
  // Centre arc: the centre and the two ends lit, the radii to them ghosted.
  'cad-sk-carc': <>{ghost('M7 17l10-0.01M7 17l8.5-8.5')}{line('M17 17A10 10 0 0 0 14.07 9.93')}{dots([[7, 17], [17, 17], [14.07, 9.93]])}</>,
  // Spline: a smooth curve through its lit points.
  'cad-sk-spline': <>{line('M4 17C7 5 11 5 12 12S17 19 20 7')}{dots([[4, 17], [12, 12], [20, 7]])}</>,
  'cad-sk-slot': <><path d="M8 8h8a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z" style={tone(0.12)} />{line('M8 8h8a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z')}{ghost('M8 12h8')}{dots([[8, 12], [16, 12]])}</>,
  // Trim: a line across two others, the piece between them cut away (dashed), its new ends lit.
  'cad-sk-trim': <>{line('M7.5 4.5v15M16.5 4.5v15')}{line('M3 12h4.5M16.5 12h4.5')}<path d="M9.6 12h4.8" className="ac" strokeDasharray="1.4 1.7" />{dots([[7.5, 12], [16.5, 12]])}</>,
  // Extend: a line run on (dashed) to a boundary it meets, the new end lit.
  'cad-sk-extend': <>{line('M19 4.5v15')}{line('M4 12h7')}<path d="M11 12h8" className="ac" strokeDasharray="1.6 1.7" />{dots([[19, 12]])}</>,
  // Split: one line broken at a lit point, its two halves apart.
  'cad-sk-split': <>{line('M4 16.5l6.6-4.2M13.4 10.5L20 6.5')}<circle cx="12" cy="11.4" r="2.2" className="ac" />{dots([[4, 16.5], [20, 6.5]])}</>,
  'cad-sk-select': <>{ghost('M4 15l7-9 9 7')}<path d="M10 9.5l9 3.6-3.9 1.3 2.6 3.7-1.7 1.2-2.6-3.7-2.6 3z" style={acTone} className="ac" strokeWidth={1.2} />{dots([[4, 15]])}</>,
  'cad-sk-construction': <><path d="M4 18L20 6" strokeDasharray="2.4 2.2" className="ac" /><circle cx="12" cy="12" r="5.5" strokeDasharray="2.4 2.2" strokeOpacity={0.6} />{dots([[4, 18], [20, 6]])}</>,
  'cad-sk-dim': <>{line('M5 17V9M19 17V9')}{ac('M5 12h14')}<g>{head([9, 12], [5, 12], 3.2)}{head([15, 12], [19, 12], 3.2)}</g>{ghost('M5 19h14')}</>,
  // Booleans: the result shaded in the accent colour.
  'cad-union': <><path d={BA + 'A6.5 6.5 0 1 0 12 6.23Z'} style={acTone} stroke="none" /><path d={BA + 'A6.5 6.5 0 1 0 12 6.23'} /></>,
  'cad-subtract': <><path d={BA + 'A6.5 6.5 0 0 1 12 6.23Z'} style={acTone} stroke="none" /><path d={BA + 'A6.5 6.5 0 0 1 12 6.23'} />{ghost('M12 6.23A6.5 6.5 0 1 1 12 17.77')}</>,
  'cad-intersect': <><path d="M12 6.23A6.5 6.5 0 0 0 12 17.77A6.5 6.5 0 0 0 12 6.23Z" style={acTone} stroke="none" />{circles.map(c => <g key={c.key} strokeOpacity={0.5}>{c}</g>)}<path d="M12 6.23A6.5 6.5 0 0 0 12 17.77A6.5 6.5 0 0 0 12 6.23Z" /></>,
};

export function CadIcon({ name, small }: { name: string; small?: boolean }) {
  const s = small ? 16 : 20;
  return <svg className="cad-icon" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{CAD_ICONS[name]}</svg>;
}
