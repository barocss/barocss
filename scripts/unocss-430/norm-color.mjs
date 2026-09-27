// #430: NORM_COLOR=1 in the #231/#253/#364 harnesses rewrites every computed color in the recorded signatures to
// oklab(L a b) rounded to 3 decimals, so the same color serialized as rgb()/oklch()/oklab() compares equal
// (presetWind4 writes colors as color-mix(in oklab, C 100%, transparent), which computes to oklab(); Tailwind 4.3
// writes oklch()). Applied to every arm alike; the harness default (strict string compare) is unchanged.
const r3 = (x) => (Math.abs(x) < 0.0005 ? 0 : x).toFixed(3);
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function rgb2lab(R, G, B) {
  const [r, g, b] = [lin(R), lin(G), lin(B)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const fmt = (L, a, b, al) => `oklab(${r3(L)} ${r3(a)} ${r3(b)}${al != null && +al !== 1 ? ' / ' + (+al).toFixed(3) : ''})`;
export function normColor(v) {
  return v
    .replace(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*([\d.]+))?\)/g, (_, r, g, b, a) => fmt(...rgb2lab(+r, +g, +b), a))
    .replace(/oklch\(([-\d.e]+) ([-\d.e]+) ([-\d.e]+)(?: \/ ([\d.]+))?\)/g, (_, L, C, H, a) => fmt(+L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180), a))
    .replace(/oklab\(([-\d.e]+) ([-\d.e]+) ([-\d.e]+)(?: \/ ([\d.]+))?\)/g, (_, L, a, b, al) => fmt(+L, +a, +b, al));
}
export const normSig = (sig) => (Array.isArray(sig) ? sig.map((row) => (Array.isArray(row) ? row.map((v) => (typeof v === 'string' ? normColor(v) : v)) : row)) : sig);
export function normReport(r, keys) { if (process.env.NORM_COLOR) for (const k of keys) if (r[k]) r[k] = normSig(r[k]); return r; }
