// AM5 (D76): 3MF, the printing package — objects (meshes, welded), build items with their transforms, base materials
// with display colours, face colours (as further base materials, or a Materials-extension colour group) and Production
// extension UUIDs. Written by our own code: the model XML deflated by CompressionStream, the package by our ZIP writer.
import { writeZip } from '../io/zip';

export interface ThreeMfObject {
  readonly name: string;
  /** Triangles in millimetres; vertices at exactly the same point are welded (the display mesh repeats them per face). */
  readonly positions: ArrayLike<number>; readonly indices: ArrayLike<number>;
  /** The material's name and the body's display colour (#rgb or #rrggbb). */
  readonly material: string; readonly color: string;
  /** A colour per triangle (a coloured face), or null for the body's. */
  readonly triangleColors?: readonly (string | null)[];
}
/** A build item: an object placed by a 3MF transform, the 12 numbers m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32 (a point is the row [x y z 1] times the matrix). */
export interface ThreeMfItem { readonly object: number; readonly transform?: readonly number[]; readonly name?: string }
export interface ThreeMfModel {
  readonly title: string; readonly objects: readonly ThreeMfObject[]; readonly items: readonly ThreeMfItem[];
  /** Face colours as further base materials (core: every consumer) or a Materials-extension colour group (then required). */
  readonly faceColors?: 'base' | 'colorgroup';
  /** Production UUIDs: random by default; a test passes its own. */
  readonly uuid?: () => string;
  /** The archive's time stamp and the model's CreationDate (left out when not given). */
  readonly date?: Date;
  /** O9: the source revision the model was made from, as metadata (left out when not given). */
  readonly source?: string;
}
export interface ThreeMfStats {
  readonly objects: number; readonly items: number; readonly triangles: number; readonly vertices: number;
  /** Vertices before welding; triangles dropped as degenerate once welded. */
  readonly verticesIn: number; readonly droppedTriangles: number;
  /** Directed edges with no opposite (open) or repeated (more than two faces): 0 and 0 for a closed manifold mesh. */
  readonly openEdges: number; readonly repeatedEdges: number;
  readonly modelXmlBytes: number; readonly bytes: number; readonly duration: number;
}

/** O9: BaroCSS's own metadata (the source revision), a namespace of its own as 3MF asks of a name not in its list. */
const NS_BAROCSS = 'https://barocss.com/3mf/2026';
const NS_CORE = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const NS_PROD = 'http://schemas.microsoft.com/3dmanufacturing/production/2015/06';
const NS_MAT = 'http://schemas.microsoft.com/3dmanufacturing/material/2015/02';
const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
const RELS = '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A colour as 3MF's #RRGGBB, or null when it is not #rgb / #rrggbb. */
export function colorOf(c: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(x => x + x).join('') : m[1];
  return `#${h.toUpperCase()}`;
}
/** The shortest decimal that reads back as the same 32-bit float (at most 9 digits). */
function f32(x: number): string {
  if (x === 0) return '0';
  for (let p = 6; p < 9; p++) { const s = +x.toPrecision(p); if (Math.fround(s) === x) return String(s); }
  return String(+x.toPrecision(9));
}
const num = (x: number) => { const v = +x.toPrecision(12); return v === 0 ? '0' : String(v); };
function randomUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

interface Welded { readonly positions: Float32Array; readonly triangles: Uint32Array; /** The input triangle of each kept one. */ readonly from: Uint32Array; readonly dropped: number }
/** Welds vertices at bit-identical 32-bit points (−0 as 0) by an open-addressed hash, and drops triangles that collapse. */
function weld(P: ArrayLike<number>, I: ArrayLike<number>): Welded {
  const n = P.length / 3, f = Float32Array.from(P as ArrayLike<number>), u = new Uint32Array(f.buffer);
  for (let k = 0; k < f.length; k++) if (f[k] === 0) f[k] = 0;
  let size = 1; while (size < 2 * n) size <<= 1;
  const mask = size - 1, table = new Int32Array(size).fill(-1), remap = new Uint32Array(n), out = new Uint32Array(3 * n);
  let m = 0;
  for (let v = 0; v < n; v++) {
    const x = u[3 * v], y = u[3 * v + 1], z = u[3 * v + 2];
    let h = (Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77) ^ Math.imul(z, 0xc2b2ae3d)) & mask;
    for (;;) {
      const w = table[h];
      if (w < 0) { table[h] = m; out[3 * m] = x; out[3 * m + 1] = y; out[3 * m + 2] = z; remap[v] = m++; break; }
      if (out[3 * w] === x && out[3 * w + 1] === y && out[3 * w + 2] === z) { remap[v] = w; break; }
      h = (h + 1) & mask;
    }
  }
  const T = I.length / 3, tri = new Uint32Array(3 * T), from = new Uint32Array(T);
  let t2 = 0;
  for (let t = 0; t < T; t++) {
    const a = remap[I[3 * t]], b = remap[I[3 * t + 1]], c = remap[I[3 * t + 2]];
    if (a === b || b === c || a === c) continue;
    tri[3 * t2] = a; tri[3 * t2 + 1] = b; tri[3 * t2 + 2] = c; from[t2++] = t;
  }
  return { positions: new Float32Array(out.buffer.slice(0, 12 * m)), triangles: tri.slice(0, 3 * t2), from: from.slice(0, t2), dropped: T - t2 };
}
/** Directed edges without an opposite, and directed edges used more than once, by sorted keys a·V + b. */
function edgeCheck(tri: Uint32Array, V: number): { open: number; repeated: number } {
  const keys = new Float64Array(tri.length);
  for (let t = 0; t < tri.length; t += 3) for (let k = 0; k < 3; k++) keys[t + k] = tri[t + k] * V + tri[t + (k + 1) % 3];
  keys.sort();
  let open = 0, repeated = 0;
  for (let i = 0; i < keys.length; i++) {
    if (i > 0 && keys[i] === keys[i - 1]) { repeated++; continue; }
    const a = Math.floor(keys[i] / V), b = keys[i] - a * V, r = b * V + a;
    let lo = 0, hi = keys.length - 1, found = false;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (keys[mid] === r) { found = true; break; } if (keys[mid] < r) lo = mid + 1; else hi = mid - 1; }
    if (!found) open++;
  }
  return { open, repeated };
}

const DEFAULT_COLOR = '#B4B8BE';
/** The index of `key` in the list, added (as `value`) the first time. */
function intern<T>(index: Map<string, number>, list: T[], key: string, value: T): number {
  let i = index.get(key);
  if (i === undefined) { i = list.length; list.push(value); index.set(key, i); }
  return i;
}
/** The 3MF package of the model, with what was written; refused (said) with nothing to write or a bad item. */
export async function write3mf(model: ThreeMfModel): Promise<{ bytes: Uint8Array; stats: ThreeMfStats } | { error: string }> {
  const t0 = performance.now(), uuid = model.uuid ?? randomUuid, faceMode = model.faceColors ?? 'base';
  if (!model.objects.length) return { error: 'there is no body to write' };
  if (!model.items.length) return { error: 'there is no build item' };
  for (const it of model.items) {
    if (!(it.object >= 0 && it.object < model.objects.length)) return { error: `a build item names object ${it.object}, which is not there` };
    if (it.transform && (it.transform.length !== 12 || !it.transform.every(Number.isFinite))) return { error: 'a build item\'s transform is not 12 finite numbers' };
  }
  // Base materials: one per (material, colour) of the bodies, in their order; face colours after them ('base' mode).
  const bases: { name: string; color: string }[] = [], baseIndex = new Map<string, number>(), colors: string[] = [], colorIndex = new Map<string, number>();
  const welded = model.objects.map(o => weld(o.positions, o.indices));
  const objBase = model.objects.map(o => { const c = colorOf(o.color) ?? DEFAULT_COLOR; return intern(baseIndex, bases, `${o.material || 'Default'}\u0000${c}`, { name: o.material || 'Default', color: c }); });
  // (A face colour per kept triangle: its base or colour-group index, or −1 for the body's.)
  const triFace = model.objects.map((o, k) => {
    const w = welded[k], out = new Int32Array(w.from.length).fill(-1);
    if (!o.triangleColors) return out;
    for (let t = 0; t < w.from.length; t++) {
      const raw = o.triangleColors[w.from[t]], c = raw ? colorOf(raw) : null;
      if (c) out[t] = faceMode === 'base' ? intern(baseIndex, bases, `${o.material || 'Default'} (${c})\u0000${c}`, { name: `${o.material || 'Default'} (${c})`, color: c }) : intern(colorIndex, colors, c, c);
    }
    return out;
  });
  const usesGroup = faceMode === 'colorgroup' && colors.length > 0, baseId = 1, groupId = 2, firstObject = 3;
  const x: string[] = [];
  x.push(`<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="${NS_CORE}" xmlns:p="${NS_PROD}"${model.source ? ` xmlns:barocss="${NS_BAROCSS}"` : ''}${usesGroup ? ` xmlns:m="${NS_MAT}" requiredextensions="m"` : ''}>\n`);
  x.push(` <metadata name="Title">${esc(model.title)}</metadata>\n <metadata name="Application">BaroCSS Studio</metadata>\n`);
  if (model.date) x.push(` <metadata name="CreationDate">${model.date.toISOString().slice(0, 10)}</metadata>\n`);
  if (model.source) x.push(` <metadata name="barocss:SourceRevision">${esc(model.source)}</metadata>\n`);
  x.push(' <resources>\n');
  x.push(`  <basematerials id="${baseId}">`); for (const b of bases) x.push(`<base name="${esc(b.name)}" displaycolor="${b.color}"/>`); x.push('</basematerials>\n');
  if (usesGroup) { x.push(`  <m:colorgroup id="${groupId}">`); for (const c of colors) x.push(`<m:color color="${c}"/>`); x.push('</m:colorgroup>\n'); }
  let triangles = 0, vertices = 0, verticesIn = 0, dropped = 0, open = 0, repeated = 0;
  model.objects.forEach((o, k) => {
    const w = welded[k], P = w.positions, T = w.triangles, F = triFace[k], V = P.length / 3;
    triangles += T.length / 3; vertices += V; verticesIn += o.positions.length / 3; dropped += w.dropped;
    const e = edgeCheck(T, V); open += e.open; repeated += e.repeated;
    x.push(`  <object id="${firstObject + k}" type="model" name="${esc(o.name)}" pid="${baseId}" pindex="${objBase[k]}" p:UUID="${uuid()}"><mesh><vertices>`);
    const rows: string[] = new Array(V);
    for (let v = 0; v < V; v++) rows[v] = `<vertex x="${f32(P[3 * v])}" y="${f32(P[3 * v + 1])}" z="${f32(P[3 * v + 2])}"/>`;
    x.push(rows.join(''), '</vertices><triangles>');
    const tris: string[] = new Array(T.length / 3);
    for (let t = 0; t < tris.length; t++) {
      const c = F[t];
      tris[t] = c < 0 ? `<triangle v1="${T[3 * t]}" v2="${T[3 * t + 1]}" v3="${T[3 * t + 2]}"/>` : `<triangle v1="${T[3 * t]}" v2="${T[3 * t + 1]}" v3="${T[3 * t + 2]}" pid="${usesGroup ? groupId : baseId}" p1="${c}"/>`;
    }
    x.push(tris.join(''), '</triangles></mesh></object>\n');
  });
  x.push(` </resources>\n <build p:UUID="${uuid()}">\n`);
  for (const it of model.items) {
    const tr = it.transform && !isIdentity(it.transform) ? ` transform="${it.transform.map(num).join(' ')}"` : '';
    x.push(`  <item objectid="${firstObject + it.object}"${tr}${it.name ? ` partnumber="${esc(it.name)}"` : ''} p:UUID="${uuid()}"/>\n`);
  }
  x.push(' </build>\n</model>\n');
  const xml = new TextEncoder().encode(x.join('')), enc = new TextEncoder();
  const bytes = await writeZip([
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc.encode(RELS) },
    { name: '3D/3dmodel.model', data: xml, deflate: true },
  ], model.date ?? new Date());
  return { bytes, stats: { objects: model.objects.length, items: model.items.length, triangles, vertices, verticesIn, droppedTriangles: dropped, openEdges: open, repeatedEdges: repeated, modelXmlBytes: xml.length, bytes: bytes.length, duration: (performance.now() - t0) / 1000 } };
}
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const isIdentity = (m: readonly number[]) => m.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-12);
