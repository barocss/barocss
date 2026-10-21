// The sheet as SVG: one user unit per millimetre, so the file prints at the drawing's scale. Arcs are
// exact SVG elliptical arcs (a projected circle's principal axes from its conjugate semi-diameters).
import { PENS, hatch, type Mark, type Sheet } from './sheet';

const n = (v: number) => { const r = Math.round(v * 1e4) / 1e4; return Object.is(r, -0) ? '0' : String(r); };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The SVG path data of an arc `center + u·cos t + v·sin t` (t0 to t1). */
export function arcPath(center: readonly number[], u: readonly number[], v: readonly number[], t0: number, t1: number): string {
  const at = (t: number) => [center[0] + u[0] * Math.cos(t) + v[0] * Math.sin(t), center[1] + u[1] * Math.cos(t) + v[1] * Math.sin(t)];
  // Principal axes: where |p − c| is extreme, tan 2t = 2 u·v / (|u|² − |v|²).
  const uu = u[0] * u[0] + u[1] * u[1], vv = v[0] * v[0] + v[1] * v[1], uv = u[0] * v[0] + u[1] * v[1];
  const ts = 0.5 * Math.atan2(2 * uv, uu - vv);
  const A = [u[0] * Math.cos(ts) + v[0] * Math.sin(ts), u[1] * Math.cos(ts) + v[1] * Math.sin(ts)];
  const B = [-u[0] * Math.sin(ts) + v[0] * Math.cos(ts), -u[1] * Math.sin(ts) + v[1] * Math.cos(ts)];
  const rx = Math.hypot(A[0], A[1]), ry = Math.hypot(B[0], B[1]), rot = Math.atan2(A[1], A[0]) * 180 / Math.PI;
  const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
  // A whole turn is two half arcs (an SVG arc cannot end where it starts).
  const spans = t1 - t0 >= 2 * Math.PI - 1e-9 ? [[t0, t0 + Math.PI], [t0 + Math.PI, t1]] : [[t0, t1]];
  const s = at(t0);
  return `M${n(s[0])} ${n(s[1])}` + spans.map(([a, b]) => { const e = at(b); return `A${n(rx)} ${n(ry)} ${n(rot)} ${b - a > Math.PI ? 1 : 0} ${sweep} ${n(e[0])} ${n(e[1])}`; }).join('');
}

function markSvg(m: Mark): string {
  if (m.kind === 'fill') return `<path d="M${m.points.map(p => `${n(p[0])} ${n(p[1])}`).join('L')}Z" fill="#000" stroke="none"/>`;
  if (m.kind === 'text') {
    const rot = m.angle ? ` transform="rotate(${n(-m.angle)} ${n(m.at[0])} ${n(m.at[1])})"` : '';
    return `<text fill="#000" stroke="none" x="${n(m.at[0])}" y="${n(m.at[1])}" font-size="${n(m.size)}"${m.anchor === 'start' ? '' : ` text-anchor="${m.anchor}"`}${m.bold ? ' font-weight="bold"' : ''}${rot}>${esc(m.text)}</text>`;
  }
  const pen = PENS[m.pen], style = `stroke-width="${pen.width}"${pen.dash ? ` stroke-dasharray="${pen.dash.join(' ')}"` : ''}`;
  if (m.kind === 'hatch') return hatch(m.rings, m.spacing).map(markSvg).join('');
  if (m.kind === 'line') return `<line x1="${n(m.a[0])}" y1="${n(m.a[1])}" x2="${n(m.b[0])}" y2="${n(m.b[1])}" ${style}/>`;
  if (m.kind === 'polyline') return `<polyline points="${m.points.map(p => `${n(p[0])},${n(p[1])}`).join(' ')}" ${style}/>`;
  return `<path d="${arcPath(m.center, m.u, m.v, m.t0, m.t1)}" ${style}/>`;
}

/** Marks as SVG elements. */
export const marksSvg = (marks: readonly Mark[]) => marks.map(markSvg).join('');

/** The sheet's groups as SVG elements (dimensions carry data-dim; the `selected` one has class sel). */
export function sheetGroupsSvg(sheet: Sheet, selected?: string | null): string {
  return sheet.groups.map(g => `<g class="${g.role}${selected && g.id === selected ? ' sel' : ''}"${g.view ? ` data-view="${g.view}"` : ''}${g.id ? ` data-dim="${esc(g.id)}"` : ''}>${g.marks.map(markSvg).join('')}</g>`).join('\n');
}

/** A standalone SVG file of the sheet, printing at true size. */
export function sheetSvg(sheet: Sheet, title: string): string {
  const [W, H] = sheet.size;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
<title>${esc(title)}</title>
<rect width="${W}" height="${H}" fill="#fff"/>
<g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" font-family="Helvetica, Arial, sans-serif">
${sheetGroupsSvg(sheet)}
</g>
</svg>
`;
}
