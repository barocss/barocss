// The Ellipse tool's clicks (pure geometry; the Viewport wires the pointer): the centre, the end of the first axis (its semi-axis rx
// and direction), then any point whose distance from that axis line is the other semi-axis ry.
import { normalAngle, type EllipseDef } from '@barocss/cad-model/sketch/ellipse';
type P2 = [number, number];

export interface EllipseDraft { c: P2; a?: P2 }
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** The first axis from the centre to its end: semi-axis (mm) and angle (degrees anticlockwise from +X, in [0, 360)); null when the end is the centre. */
export function ellipseAxis(c: P2, a: P2): { rx: number; angle: number } | null {
  const rx = Math.hypot(a[0] - c[0], a[1] - c[1]); if (!(rx > 0)) return null;
  return { rx: r6(rx), angle: normalAngle(r6(Math.atan2(a[1] - c[1], a[0] - c[0]) * 180 / Math.PI)) };
}

/** The ellipse a draft with its axis end makes with the pointer at `p` (ry: p's distance from the axis line); null before the axis end or on the axis line. */
export function draftEllipse(d: EllipseDraft, p: P2): EllipseDef | null {
  const ax = d.a && ellipseAxis(d.c, d.a); if (!ax) return null;
  const ry = r6(Math.abs((p[0] - d.c[0]) * Math.sin(ax.angle * Math.PI / 180) - (p[1] - d.c[1]) * Math.cos(ax.angle * Math.PI / 180)));
  return ry > 0 ? { center: [d.c[0], d.c[1]], rx: ax.rx, ry, angle: ax.angle } : null;
}

/** A click: the next draft (null once finished) and, on the third click, the ellipse it makes. A click that makes nothing new (the centre again, the axis line) changes nothing. */
export function ellipseClick(d: EllipseDraft | null, c: P2): { draft: EllipseDraft | null; def?: EllipseDef } {
  if (!d) return { draft: { c } };
  if (!d.a) return ellipseAxis(d.c, c) ? { draft: { c: d.c, a: c } } : { draft: d };
  const def = draftEllipse(d, c);
  return def ? { draft: null, def } : { draft: d };
}

/** n points round the ellipse at equal parameter steps (display). */
export function ellipseSamples(d: EllipseDef, n = 72): P2[] {
  const a = d.angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  return Array.from({ length: n }, (_, k) => { const t = 2 * Math.PI * k / n, x = d.rx * Math.cos(t), y = d.ry * Math.sin(t); return [d.center[0] + ca * x - sa * y, d.center[1] + sa * x + ca * y] as P2; });
}
