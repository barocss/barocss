// The sheet as a one-page vector PDF at true size: lines and polylines as paths, arcs as cubic Béziers
// (a quarter turn or less each), text in the standard Helvetica fonts (WinAnsi, so Ø and ° print).
import { PENS, hatch, type Mark, type Sheet } from '@barocss/cad-model/drawing/sheet';
import { textWidth } from '@barocss/cad-model/drawing/text';

const PT = 72 / 25.4;
const n = (v: number) => { const r = Math.round(v * 1e4) / 1e4; return Object.is(r, -0) ? '0' : String(r); };

/** The characters of the sheet's text a PDF in its standard fonts cannot show (they print as ?). */
export function pdfMissing(sheet: Sheet): string[] {
  const ok = new Set(['…', 'Ø', 'ø', '°', '±', '×', '·', '–', '—', '’']), out = new Set<string>();
  for (const g of sheet.groups) for (const m of g.marks) if (m.kind === 'text') for (const ch of m.text) { const c = ch.charCodeAt(0); if (!ok.has(ch) && (c < 0x20 || (c > 0x7e && (c < 0xa0 || c > 0xff)))) out.add(ch); }
  return [...out];
}
/** WinAnsi bytes of a string (characters outside it print as ?), escaped for a PDF string. */
function winAnsi(s: string): string {
  const special: Record<string, number> = { '…': 0x85, 'Ø': 0xd8, 'ø': 0xf8, '°': 0xb0, '±': 0xb1, '×': 0xd7, '·': 0xb7, '–': 0x96, '—': 0x97, '’': 0x92 };
  let out = '';
  for (const ch of s) {
    const c = special[ch] ?? ch.charCodeAt(0);
    const b = c < 0x20 || (c > 0x7e && !special[ch] && (c < 0xa0 || c > 0xff)) ? 0x3f : c;
    out += b === 0x28 || b === 0x29 || b === 0x5c ? '\\' + String.fromCharCode(b) : b > 0x7e ? '\\' + b.toString(8).padStart(3, '0') : String.fromCharCode(b);
  }
  return out;
}


function markOps(m: Mark): string {
  if (m.kind === 'fill') return `${m.points.map((p, k) => `${n(p[0])} ${n(p[1])} ${k ? 'l' : 'm'}`).join(' ')} h f\n`;
  if (m.kind === 'text') {
    const a = (m.angle ?? 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), w = textWidth(m.text, m.size, !!m.bold);
    const shift = m.anchor === 'middle' ? w / 2 : m.anchor === 'end' ? w : 0;
    // The page is drawn y down, so the text matrix flips its own y back up.
    const x = m.at[0] - shift * c, y = m.at[1] + shift * s;
    return `BT /${m.bold ? 'F2' : 'F1'} 1 Tf ${n(m.size * c)} ${n(-m.size * s)} ${n(-m.size * s)} ${n(-m.size * c)} ${n(x)} ${n(y)} Tm (${winAnsi(m.text)}) Tj ET\n`;
  }
  if (m.kind === 'hatch') return hatch(m.rings, m.spacing).map(markOps).join('');
  const pen = PENS[m.pen], style = `${pen.width} w ${pen.dash ? `[${pen.dash.join(' ')}] 0 d` : '[] 0 d'}`;
  if (m.kind === 'line') return `${style} ${n(m.a[0])} ${n(m.a[1])} m ${n(m.b[0])} ${n(m.b[1])} l S\n`;
  if (m.kind === 'polyline') return `${style} ${m.points.map((p, k) => `${n(p[0])} ${n(p[1])} ${k ? 'l' : 'm'}`).join(' ')} S\n`;
  // An arc of the ellipse: each piece the affine image of a circular arc's Bézier.
  const at = (t: number) => [m.center[0] + m.u[0] * Math.cos(t) + m.v[0] * Math.sin(t), m.center[1] + m.u[1] * Math.cos(t) + m.v[1] * Math.sin(t)];
  const tan = (t: number) => [-m.u[0] * Math.sin(t) + m.v[0] * Math.cos(t), -m.u[1] * Math.sin(t) + m.v[1] * Math.cos(t)];
  const pieces = Math.max(1, Math.ceil((m.t1 - m.t0) / (Math.PI / 2) - 1e-9)), dt = (m.t1 - m.t0) / pieces, k = 4 / 3 * Math.tan(dt / 4);
  const s0 = at(m.t0); let ops = `${style} ${n(s0[0])} ${n(s0[1])} m`;
  for (let i = 0; i < pieces; i++) {
    const a = m.t0 + i * dt, b = a + dt, pa = at(a), pb = at(b), ta = tan(a), tb = tan(b);
    ops += ` ${n(pa[0] + k * ta[0])} ${n(pa[1] + k * ta[1])} ${n(pb[0] - k * tb[0])} ${n(pb[1] - k * tb[1])} ${n(pb[0])} ${n(pb[1])} c`;
  }
  return ops + ' S\n';
}

export function sheetPdf(sheet: Sheet, title: string): Uint8Array {
  const [W, H] = sheet.size;
  const content = `1 J 1 j 0 G 0 g\n${n(PT)} 0 0 ${n(-PT)} 0 ${n(H * PT)} cm\n` + sheet.groups.flatMap(g => g.marks.map(markOps)).join('');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(W * PT)} ${n(H * PT)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    `<< /Title (${winAnsi(title)}) /Producer (barocss cad-studio) >>`,
  ];
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character is a single byte (the escapes above keep strings 7-bit except the header).
  return Uint8Array.from(out, ch => ch.charCodeAt(0) & 0xff);
}
