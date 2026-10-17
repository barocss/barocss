// Standard fasteners, stage 1 (barocss/barocss#2094): a small catalogue of metric coarse-thread parts and
// their simple shapes — hex head bolts (ISO 4017), socket head cap screws (ISO 4762), hex nuts (ISO 4032)
// and plain washers (ISO 7089), M3 to M12. The thread is cosmetic: its size, pitch and hand are recorded
// with the part (and shown), the shank is a plain cylinder at the nominal diameter — no helical geometry,
// and no claim of fit, strength or manufacturability. The sizes are the standards' nominal values; check
// them against the standard (and the supplier) before using a drawing for manufacture.
import { withNode, type StudioDoc } from '../engine/doc';
import type { Command, Ctx, HandleSpec, Values } from './commands';

export type FastenerKind = 'hex-bolt' | 'socket-screw' | 'hex-nut' | 'washer';
export interface FastenerSize {
  /** Nominal thread diameter (mm) and coarse pitch (mm). */
  d: number; pitch: number;
  /** Hex across flats (bolt heads and nuts, mm). */
  s: number;
  /** Hex bolt head height, nut height, socket head diameter and height, socket (hex key) size, washer inner / outer / thickness (mm). */
  k: number; m: number; dk: number; ks: number; socket: number; wd1: number; wd2: number; wh: number;
  /** Lengths offered (mm), shortest to longest, for bolts and screws. */
  lengths: number[];
}
const L = (from: number, to: number) => [4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 110, 120].filter(l => l >= from && l <= to);
/**
 * The catalogue. Sources: ISO 261/262 (metric coarse pitches), ISO 4017 (hex head: s, k), ISO 4032 (hex
 * nut: m), ISO 4762 (socket head cap: dk, k = d, socket s), ISO 7089 (washer: d1, d2, h). Nominal values.
 */
export const FASTENER_SIZES: Record<string, FastenerSize> = {
  M3: { d: 3, pitch: 0.5, s: 5.5, k: 2, m: 2.4, dk: 5.5, ks: 3, socket: 2.5, wd1: 3.2, wd2: 7, wh: 0.5, lengths: L(5, 30) },
  M4: { d: 4, pitch: 0.7, s: 7, k: 2.8, m: 3.2, dk: 7, ks: 4, socket: 3, wd1: 4.3, wd2: 9, wh: 0.8, lengths: L(6, 40) },
  M5: { d: 5, pitch: 0.8, s: 8, k: 3.5, m: 4.7, dk: 8.5, ks: 5, socket: 4, wd1: 5.3, wd2: 10, wh: 1, lengths: L(8, 50) },
  M6: { d: 6, pitch: 1, s: 10, k: 4, m: 5.2, dk: 10, ks: 6, socket: 5, wd1: 6.4, wd2: 12, wh: 1.6, lengths: L(8, 60) },
  M8: { d: 8, pitch: 1.25, s: 13, k: 5.3, m: 6.8, dk: 13, ks: 8, socket: 6, wd1: 8.4, wd2: 16, wh: 1.6, lengths: L(10, 80) },
  M10: { d: 10, pitch: 1.5, s: 16, k: 6.4, m: 8.4, dk: 16, ks: 10, socket: 8, wd1: 10.5, wd2: 20, wh: 2, lengths: L(12, 100) },
  M12: { d: 12, pitch: 1.75, s: 18, k: 7.5, m: 10.8, dk: 18, ks: 12, socket: 10, wd1: 13, wd2: 24, wh: 2.5, lengths: L(16, 120) },
};
export const FASTENER_KINDS: { value: FastenerKind; label: string; standard: string }[] = [
  { value: 'hex-bolt', label: 'Hex head bolt', standard: 'ISO 4017' },
  { value: 'socket-screw', label: 'Socket head cap screw', standard: 'ISO 4762' },
  { value: 'hex-nut', label: 'Hex nut', standard: 'ISO 4032' },
  { value: 'washer', label: 'Plain washer', standard: 'ISO 7089' },
];
const threaded = (kind: string) => kind === 'hex-bolt' || kind === 'socket-screw';

/** What a fastener is, in words: "Hex head bolt ISO 4017 M8×1.25 × 30, cosmetic right-hand thread". */
export function fastenerName(v: Values): string {
  const kind = FASTENER_KINDS.find(k => k.value === v.kind) ?? FASTENER_KINDS[0], size = FASTENER_SIZES[String(v.size)];
  if (!size) return kind.label;
  const thread = `M${size.d}×${size.pitch}`;
  return `${kind.label} ${kind.standard} ${v.kind === 'washer' ? `${size.d}` : thread}${threaded(String(v.kind)) ? ` × ${v.length}` : ''}`;
}
/** The cosmetic thread a fastener carries (none for a washer): size, pitch, hand and where along its axis. */
export function fastenerThread(v: Values): { d: number; pitch: number; hand: 'right'; length: number; internal: boolean } | null {
  const size = FASTENER_SIZES[String(v.size)]; if (!size || v.kind === 'washer') return null;
  return { d: size.d, pitch: size.pitch, hand: 'right', length: v.kind === 'hex-nut' ? size.m : Number(v.length), internal: v.kind === 'hex-nut' };
}

/** Corner points of a regular hexagon by across-flats `s` about (x, y), a flat at the bottom. */
const hexagon = (x: number, y: number, s: number): [number, number][] => {
  const R = s / Math.sqrt(3), r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  return Array.from({ length: 6 }, (_, k) => { const a = (k * 60 + 30) * Math.PI / 180; return [r6(x + R * Math.cos(a)), r6(y + R * Math.sin(a))]; });
};
const circle = (x: number, y: number, r: number) => [{ kind: 'arc' as const, start: [Math.round((x + r) * 1e6) / 1e6, y] as [number, number], center: [x, y] as [number, number], direction: 'ccw' as const }];

/** The nodes of a fastener standing on (x, y, z): heads and nuts and washers above z, a bolt's shank below it. */
export function fastenerNodes(doc: StudioDoc, v: Values): StudioDoc {
  // (Steel, unless the body already has a material of its own: kept by its first solid, see app/bodies.ts.)
  const out = buildFastener(doc, v), first = out.nodes.findIndex((n, i) => i >= doc.nodes.length && n.kind === 'extrude'), key = `b${first}`;
  return first < 0 || out.bodies?.[key]?.material ? out : { ...out, bodies: { ...out.bodies, [key]: { ...out.bodies?.[key], material: 'steel' } } };
}
function buildFastener(doc: StudioDoc, v: Values): StudioDoc {
  const size = FASTENER_SIZES[String(v.size)]; if (!size) throw new Error(`No size ${String(v.size)} in the catalogue (M3–M12).`);
  const x = Number(v.x), y = Number(v.y), z = Number(v.z), len = Number(v.length), at = (h: number) => (h ? { from: h } : {});
  if (threaded(String(v.kind)) && !size.lengths.includes(len)) throw new Error(`${String(v.size)} ${String(v.kind) === 'hex-bolt' ? 'bolts' : 'screws'} come ${size.lengths[0]}–${size.lengths[size.lengths.length - 1]} mm long (${size.lengths.join(', ')}).`);
  let d = doc;
  const add = (n: Parameters<typeof withNode>[1]) => { d = withNode(d, n); return d.nodes.length - 1; };
  switch (v.kind) {
    case 'hex-nut': {
      const sk = add({ kind: 'sketch', profile: 'polygon', points: hexagon(x, y, size.s), holes: [circle(x, y, size.d / 2)] });
      add({ kind: 'extrude', sketch: sk, height: size.m, ...at(z) }); return d;
    }
    case 'washer': {
      const sk = add({ kind: 'sketch', profile: 'circle', center: [x, y], radius: size.wd2 / 2, holes: [circle(x, y, size.wd1 / 2)] });
      add({ kind: 'extrude', sketch: sk, height: size.wh, ...at(z) }); return d;
    }
    case 'socket-screw': {
      // The head (with its hex socket cut in) on the face, the shank down from it.
      const hs = add({ kind: 'sketch', profile: 'circle', center: [x, y], radius: size.dk / 2, holes: [hexagon(x, y, size.socket).map(p => ({ kind: 'line' as const, start: p }))] });
      const head = add({ kind: 'extrude', sketch: hs, height: size.ks, ...at(z) });
      const floor = add({ kind: 'sketch', profile: 'circle', center: [x, y], radius: size.socket * 0.7 });
      const plug = add({ kind: 'extrude', sketch: floor, height: size.ks * 0.4, ...at(z) });
      const headSolid = add({ kind: 'union', left: { node: head, side: 'solid' }, right: { node: plug, side: 'solid' } });
      const ss = add({ kind: 'sketch', profile: 'circle', center: [x, y], radius: size.d / 2 });
      const shank = add({ kind: 'extrude', sketch: ss, height: len, from: z - len });
      add({ kind: 'union', left: { node: headSolid, side: 'solid' }, right: { node: shank, side: 'solid' } }); return d;
    }
    default: {
      const hs = add({ kind: 'sketch', profile: 'polygon', points: hexagon(x, y, size.s) });
      const head = add({ kind: 'extrude', sketch: hs, height: size.k, ...at(z) });
      const ss = add({ kind: 'sketch', profile: 'circle', center: [x, y], radius: size.d / 2 });
      const shank = add({ kind: 'extrude', sketch: ss, height: len, from: z - len });
      add({ kind: 'union', left: { node: head, side: 'solid' }, right: { node: shank, side: 'solid' } }); return d;
    }
  }
}

const ok = { ok: true as const };
export const fastenerCommand: Command = {
  id: 'fastener', label: 'Fastener', icon: 'cad-fastener', group: 'create', keywords: 'bolt screw nut washer iso metric m3 m4 m5 m6 m8 m10 m12 standard part hardware',
  hint: 'A standard bolt, cap screw, nut or washer (ISO, M3–M12) — click a face or a hole’s rim to place it; the thread is cosmetic',
  available: () => ok,
  fields: (_ctx, v) => [
    { key: 'kind', label: 'Part', kind: 'choice', options: FASTENER_KINDS.map(k => ({ value: k.value, label: `${k.label} (${k.standard})` })) },
    { key: 'size', label: 'Size', kind: 'choice', options: Object.keys(FASTENER_SIZES).map(m => ({ value: m, label: `${m} × ${FASTENER_SIZES[m].pitch}` })) },
    { key: 'length', label: 'Length', kind: 'choice', options: (FASTENER_SIZES[String(v?.size)] ?? FASTENER_SIZES.M6).lengths.map(l => ({ value: String(l), label: `${l} mm` })), when: x => threaded(String(x.kind)) },
    { key: 'x', label: 'Axis at X', kind: 'mm' }, { key: 'y', label: 'Axis at Y', kind: 'mm' }, { key: 'z', label: 'Seat at Z', kind: 'mm' },
  ],
  defaults: (ctx: Ctx) => { const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity); return { kind: 'hex-bolt', size: 'M6', length: '20', x: Number.isFinite(right) ? Math.round(right + 14) : 0, y: 16, z: 0 }; },
  // A new size keeps the length when that size comes in it, else the nearest it does.
  derive: (_ctx, v, changed) => {
    if (!changed.includes('size')) return v;
    const ls = FASTENER_SIZES[String(v.size)]?.lengths ?? [], want = Number(v.length);
    return ls.includes(want) || !ls.length ? v : { ...v, length: String(ls.reduce((b, l) => Math.abs(l - want) < Math.abs(b - want) ? l : b, ls[0])) };
  },
  place: (v, [x, y, z]) => ({ ...v, x, y, z }),
  handles: (_ctx, v): HandleSpec[] => [{ key: 'x', at: [Number(v.x), Number(v.y), Number(v.z)], dir: [1, 0, 0], pair: { key: 'y', dir: [0, 1, 0] } }],
  steps: (_ctx, v) => { const t = fastenerThread(v); return [{ label: 'Part', text: fastenerName(v), done: true }, ...(t ? [{ label: 'Thread', text: `M${t.d}×${t.pitch} ${t.hand}-hand, ${t.internal ? 'internal' : 'external'}, cosmetic (no helical geometry)`, done: true }] : [])]; },
  build: (ctx, v) => fastenerNodes(ctx.doc, { ...v, length: Number(v.length) }),
};
