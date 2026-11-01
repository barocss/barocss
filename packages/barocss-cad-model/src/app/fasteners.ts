// Standard fasteners (barocss/barocss#2094): a small catalogue of metric coarse-thread parts and their simple
// shapes — hex head screws (ISO 4017), socket head cap screws (ISO 4762), countersunk socket screws
// (ISO 10642), hex nuts (ISO 4032) and plain washers (ISO 7089), M3 to M12 — and how one goes into a hole: through a clearance hole (ISO 273) with a
// washer and nut under the far side, or into a tapped hole (tap drill d − P). The thread is cosmetic: its
// size, pitch and hand are recorded with the part (and shown), the shank is a plain cylinder at the nominal
// diameter — no helical geometry. The checks are of size and length only, never of strength, preload or
// manufacturability. The sizes are the person's (O7): the document's fastener-size rows, from a file they loaded
// (samples/rows/fastener-sizes.json is an example, its sources named); none is built in. A size with no row is
// refused where it is needed ([FASTENER_SIZE_ROW]).
import { emptyDoc, withNode, type PartInstance, type StudioDoc } from '../engine/doc';
import { fastenerSizesOf, NO_SIZES, noSizeRow } from '../engine/fastenerSizeRows';
import { bodyKeyFor } from '../engine/ids';
import type { Command, Ctx, HandleSpec, PlacedHole, Values } from './commands';
import { nextInstanceId } from '../assembly/takenIds';
import { coded, refusal } from '../engine/refusal';

export type FastenerKind = 'hex-bolt' | 'socket-screw' | 'csk-screw' | 'hex-nut' | 'washer';
export interface FastenerSize {
  /** Nominal thread diameter (mm) and coarse pitch (mm). */
  d: number; pitch: number;
  /** Hex across flats (bolt heads and nuts, mm). */
  s: number;
  /** Hex bolt head height, nut height, socket head diameter and height, socket (hex key) size, washer inner / outer / thickness (mm). */
  k: number; m: number; dk: number; ks: number; socket: number; wd1: number; wd2: number; wh: number;
  /** Lengths offered (mm), shortest to longest: ISO 4017 hex head screws and ISO 4762 cap screws. */
  lengths: number[]; capLengths: number[];
  /** ISO 10642 countersunk head: theoretical head diameter, head height and socket size (mm), and the lengths offered (overall, head included). */
  cdk: number; ck: number; csocket: number; cskLengths: number[];
  /** ISO 273 clearance hole diameters: fine, medium, coarse (mm). Tap drill for a 6H internal thread (mm). */
  clearance: [number, number, number]; tap: number;
  /** Whether the ISO 4017 lengths were cross-checked against a source (else they follow the standard's 2d … 10d rule, unchecked). */
  checked4017: boolean;
}
/** The sizes a document's rows give, by size ("M6"). */
export type FastenerSizes = Readonly<Record<string, FastenerSize>>;
export const FASTENER_KINDS: { value: FastenerKind; label: string; standard: string }[] = [
  { value: 'hex-bolt', label: 'Hex head bolt', standard: 'ISO 4017' },
  { value: 'socket-screw', label: 'Socket head cap screw', standard: 'ISO 4762' },
  { value: 'csk-screw', label: 'Countersunk socket screw', standard: 'ISO 10642' },
  { value: 'hex-nut', label: 'Hex nut', standard: 'ISO 4032' },
  { value: 'washer', label: 'Plain washer', standard: 'ISO 7089' },
];
/** The lengths a kind comes in at a size (ISO 4017 for hex bolts, ISO 4762 for cap screws, ISO 10642 for countersunk screws). */
export const lengthsOf = (kind: string, size: FastenerSize) => kind === 'socket-screw' ? size.capLengths : kind === 'csk-screw' ? size.cskLengths : size.lengths;
/** The lengths offered at a size by its row (no size chosen yet: M6's, else the first row's, as the field has always shown);
 *  no rows: none. */
function lengthsOfSize(kind: string, sizes: FastenerSizes, size: string): number[] {
  const row = sizes[size] ?? sizes.M6 ?? Object.values(sizes)[0];
  return row ? lengthsOf(kind, row) : [];
}

/** How a hole of diameter `hd` takes a size: a clearance hole (its ISO 273 series), a tap drill, or neither. */
export type HoleFit = { fit: 'clearance'; series: 'fine' | 'medium' | 'coarse' } | { fit: 'tapped' } | { fit: 'tight' } | { fit: 'loose' };
export function holeFit(size: FastenerSize, hd: number): HoleFit {
  if (hd >= size.tap - 0.15 && hd <= size.tap + 0.2) return { fit: 'tapped' };
  const [f, m, c] = size.clearance;
  if (hd < f - 0.05) return { fit: 'tight' };
  if (hd > c + 0.5) return { fit: 'loose' };
  const series = (['fine', 'medium', 'coarse'] as const)[[f, m, c].reduce((b, x, i, a) => Math.abs(x - hd) < Math.abs(a[b] - hd) ? i : b, 0)];
  return { fit: 'clearance', series };
}
/** The size a hole is for: the one whose clearance (ISO 273) or tap drill it is nearest (Ø5 is M6's tap drill, not a loose M4). */
export function sizeForHole(hd: number, sizes: FastenerSizes): { size: string; fit: HoleFit } | null {
  let best: { size: string; fit: HoleFit; off: number } | null = null;
  for (const [name, size] of Object.entries(sizes)) {
    const fit = holeFit(size, hd); if (fit.fit !== 'clearance' && fit.fit !== 'tapped') continue;
    const off = fit.fit === 'tapped' ? Math.abs(hd - size.tap) : Math.min(...size.clearance.map(c => Math.abs(hd - c)));
    if (!best || off < best.off - 1e-9) best = { size: name, fit, off };
  }
  return best && { size: best.size, fit: best.fit };
}
/** What a through bolt with a washer and nut needs: the grip, the washer, the nut and two pitches beyond it. */
export const nutJointNeed = (size: FastenerSize, grip: number) => Math.round((grip + size.wh + size.m + 2 * size.pitch) * 1000) / 1000;
/** The length a joint takes (the shortest that does), or null when none in the catalogue does. */
export function jointLength(v: Values, sizes: FastenerSizes): number | null {
  const size = sizes[String(v.size)]; if (!size) return null;
  const ls = lengthsOf(String(v.kind), size), grip = Number(v.grip), depth = Number(v.holeDepth);
  if (v.joint === 'nut') { if (!(grip > 0)) return null; const need = nutJointNeed(size, grip); return ls.find(l => l >= need) ?? null; }
  if (v.joint === 'tapped' && depth > 0) {
    // Engaging 1.5 d where it can (a through hole no more than its depth is needed; a blind one keeps 2 pitches clear at the bottom).
    const most = String(v.through) === '1' ? Infinity : depth - 2 * size.pitch, want = Math.min(1.5 * size.d, depth, most);
    return ls.find(l => l >= want && l <= most) ?? [...ls].reverse().find(l => l <= most) ?? ls[0] ?? null; // (the shortest, flagged, when none keeps clear)
  }
  return null;
}
const threaded = (kind: string) => kind === 'hex-bolt' || kind === 'socket-screw' || kind === 'csk-screw';

/** What a fastener is, in words: "Hex head bolt ISO 4017 M8×1.25 × 30, cosmetic right-hand thread". */
export function fastenerName(v: Values, sizes: FastenerSizes): string {
  const kind = FASTENER_KINDS.find(k => k.value === v.kind) ?? FASTENER_KINDS[0], size = sizes[String(v.size)];
  if (!size) return kind.label;
  const thread = `M${size.d}×${size.pitch}`;
  return `${kind.label} ${kind.standard} ${v.kind === 'washer' ? `${size.d}` : thread}${threaded(String(v.kind)) ? ` × ${v.length}` : ''}`;
}
/** The cosmetic thread a fastener carries (none for a washer): size, pitch, hand and where along its axis. */
export function fastenerThread(v: Values, sizes: FastenerSizes): { d: number; pitch: number; hand: 'right'; length: number; internal: boolean } | null {
  const size = sizes[String(v.size)]; if (!size || v.kind === 'washer') return null;
  return { d: size.d, pitch: size.pitch, hand: 'right', length: v.kind === 'hex-nut' ? size.m : Number(v.length), internal: v.kind === 'hex-nut' };
}

/** Corner points of a regular hexagon by across-flats `s` about (x, y), a flat at the bottom. */
const hexagon = (x: number, y: number, s: number): [number, number][] => {
  const R = s / Math.sqrt(3), r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  return Array.from({ length: 6 }, (_, k) => { const a = (k * 60 + 30) * Math.PI / 180; return [r6(x + R * Math.cos(a)), r6(y + R * Math.sin(a))]; });
};
const circle = (x: number, y: number, r: number) => [{ kind: 'arc' as const, start: [Math.round((x + r) * 1e6) / 1e6, y] as [number, number], center: [x, y] as [number, number], direction: 'ccw' as const }];

/** The nodes of a fastener standing on (x, y, z): heads and nuts and washers above z, a bolt's shank below it. */
export function fastenerNodes(doc: StudioDoc, v: Values, sizes: FastenerSizes = fastenerSizesOf(doc)): StudioDoc {
  // (Steel, unless the body already has a material of its own: kept by its first solid, see app/bodies.ts;
  // a joint's washer and nut are named for what they are.)
  const { doc: out, extra } = buildFastener(doc, v, sizes), first = out.nodes.findIndex((n, i) => i >= doc.nodes.length && (n.kind === 'extrude' || n.kind === 'thread')), key = bodyKeyFor(out.nodes, first);
  let bodies = { ...out.bodies };
  if (first >= 0 && !bodies[key]?.material) bodies = { ...bodies, [key]: { ...bodies[key], material: 'steel' } };
  for (const e of extra) { const k = bodyKeyFor(out.nodes, e.node); bodies = { ...bodies, [k]: { ...bodies[k], name: e.name, material: bodies[k]?.material ?? 'steel' } }; }
  return { ...out, bodies };
}
function buildFastener(doc: StudioDoc, v: Values, sizes: FastenerSizes): { doc: StudioDoc; extra: { node: number; name: string }[] } {
  const size = sizes[String(v.size)]; if (!size) throw coded('FASTENER_SIZE_ROW', noSizeRow(String(v.size)));
  const x = Number(v.x), y = Number(v.y), z = Number(v.z), len = Number(v.length), at = (h: number) => (h ? { from: h } : {}), kind = String(v.kind);
  if (![x, y, z].every(Number.isFinite)) throw refusal('FASTENER_POSITION', 'Give the fastener a position (X, Y and Z in mm).');
  const ls = lengthsOf(kind, size);
  if (threaded(kind) && !ls.includes(len)) throw refusal('FASTENER_LENGTH', `${String(v.size)} ${kind === 'hex-bolt' ? 'bolts' : 'screws'} come ${ls[0]}–${ls[ls.length - 1]} mm long (${ls.join(', ')}).`);
  const nut = threaded(kind) && v.joint === 'nut', grip = Number(v.grip);
  if (nut) {
    if (!(grip > 0) || !Number.isFinite(grip)) throw refusal('FASTENER_GRIP', 'Give the joint its grip: the thickness the bolt clamps (mm).');
    const need = nutJointNeed(size, grip);
    if (len < need) throw refusal('FASTENER_LENGTH', `${String(v.size)} × ${len} is too short for this joint: it needs ${need} mm (grip ${grip} + washer ${size.wh} + nut ${size.m} + 2 pitches) — ${ls.find(l => l >= need) ?? 'longer than the catalogue has'}.`);
  }
  let d = doc;
  const add = (n: Parameters<typeof withNode>[1]) => { d = withNode(d, n); return d.nodes.length - 1; }, extra: { node: number; name: string }[] = [];
  // Modelled: a hex bolt's and a nut's thread as helical B-spline faces (one solid each), else a plain cylinder.
  const modelled = v.model === 'modelled' && (kind === 'hex-bolt' || kind === 'hex-nut');
  const nutAt = (seat: number) => modelled ? add({ kind: 'thread', diameter: size.d, pitch: size.pitch, center: [x, y], seat, hex: { across: size.s, height: size.m, internal: true }, form: 'helical' })
    : add({ kind: 'extrude', sketch: add({ kind: 'sketch', profile: 'polygon', points: hexagon(x, y, size.s), holes: [circle(x, y, size.d / 2)] }), height: size.m, ...at(seat) });
  // Through, with a washer and nut under the far face (separate bodies, made before the bolt's last step).
  const joint = () => {
    if (!nut) return;
    const ws = add({ kind: 'sketch', profile: 'circle', center: [x, y], radius: size.wd2 / 2, holes: [circle(x, y, size.wd1 / 2)] });
    extra.push({ node: add({ kind: 'extrude', sketch: ws, height: size.wh, from: z - grip - size.wh }), name: `Washer ISO 7089 ${size.d}` });
    extra.push({ node: nutAt(z - grip - size.wh - size.m), name: `Nut ISO 4032 M${size.d}` });
  };
  switch (kind) {
    case 'hex-nut': nutAt(z); break;
    case 'washer': {
      const sk = add({ kind: 'sketch', profile: 'circle', center: [x, y], radius: size.wd2 / 2, holes: [circle(x, y, size.wd1 / 2)] });
      add({ kind: 'extrude', sketch: sk, height: size.wh, ...at(z) }); break;
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
      joint();
      add({ kind: 'union', left: { node: headSolid, side: 'solid' }, right: { node: shank, side: 'solid' } }); break;
    }
    case 'csk-screw': {
      // A 90° head sunk into the face (its top flush at z, Ø dk), turned about the axis; its hex socket cut
      // in; the shank from the head down (the length is overall, the head included), from inside the cone
      // to just under the socket.
      const plane = { origin: [x, y, z] as [number, number, number], normal: [0, -1, 0] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] };
      const hp = add({ kind: 'sketch', profile: 'polygon', points: [[0, 0], [size.cdk / 2, 0], [size.d / 2, -size.ck], [0, -size.ck]], plane });
      const cone = add({ kind: 'revolve', sketch: hp, axis: 'y', angle: 360 });
      const sp = add({ kind: 'sketch', profile: 'polygon', points: hexagon(x, y, size.csocket) });
      const socket = add({ kind: 'extrude', sketch: sp, height: size.ck * 0.6 + 0.5, from: z - size.ck * 0.6 });
      const head = add({ kind: 'difference', parent: { node: cone, side: 'solid' }, tool: { node: socket, side: 'solid' } });
      const ss = add({ kind: 'sketch', profile: 'circle', center: [x, y], radius: size.d / 2 });
      const shank = add({ kind: 'extrude', sketch: ss, height: len - size.ck * 0.6 - 0.1, from: z - len });
      joint();
      add({ kind: 'union', left: { node: head, side: 'solid' }, right: { node: shank, side: 'solid' } }); break;
    }
    default: {
      if (modelled) { joint(); add({ kind: 'thread', diameter: size.d, pitch: size.pitch, center: [x, y], seat: z, length: len, hex: { across: size.s, height: size.k }, form: 'helical' }); break; }
      const hs = add({ kind: 'sketch', profile: 'polygon', points: hexagon(x, y, size.s) });
      const head = add({ kind: 'extrude', sketch: hs, height: size.k, ...at(z) });
      const ss = add({ kind: 'sketch', profile: 'circle', center: [x, y], radius: size.d / 2 });
      const shank = add({ kind: 'extrude', sketch: ss, height: len, from: z - len });
      joint();
      add({ kind: 'union', left: { node: head, side: 'solid' }, right: { node: shank, side: 'solid' } });
    }
  }
  return { doc: d, extra };
}

/** The fit of a placed fastener, in words, for its steps: the hole, then the joint. */
export function fastenerFit(v: Values, sizes: FastenerSizes): { label: string; text: string; done: boolean }[] {
  const size = sizes[String(v.size)], kind = String(v.kind); if (!size || !threaded(kind)) return [];
  const out: { label: string; text: string; done: boolean }[] = [], hd = Number(v.holeD), M = `M${size.d}`;
  if (hd > 0) {
    const f = holeFit(size, hd), want = v.joint === 'tapped' ? 'tapped' : 'clearance';
    const text = f.fit === 'clearance' ? `Ø${hd}: clearance for ${M}, ISO 273 ${f.series} (Ø${size.clearance.join(' / ')})`
      : f.fit === 'tapped' ? `Ø${hd}: the tap drill of ${M} (Ø${size.tap}) — a tapped hole`
        : f.fit === 'tight' ? `Ø${hd} is too small for ${M}: clearance Ø${size.clearance[0]}+, tap drill Ø${size.tap}` : `Ø${hd} is looser than ISO 273 coarse Ø${size.clearance[2]} for ${M}`;
    out.push({ label: 'Hole', text: f.fit === want || v.joint === 'free' && f.fit === 'clearance' ? text : f.fit === 'clearance' || f.fit === 'tapped' ? `${text} — not what a ${v.joint === 'tapped' ? 'tapped' : 'through'} joint wants` : text, done: f.fit === want || (v.joint === 'free' && f.fit === 'clearance') });
  }
  if (kind === 'csk-screw') out.push({ label: 'Head', text: `sinks into a 90° countersink Ø${size.cdk} (ISO 10642 head, ${size.ck} deep) — make the hole Countersunk, Ø${size.cdk} or a little more`, done: true });
  const len = Number(v.length);
  if (v.joint === 'nut') {
    const need = nutJointNeed(size, Number(v.grip));
    out.push({ label: 'Joint', text: `through ${v.grip} mm, washer + nut: needs ${need} mm (grip + ${size.wh} + ${size.m} + 2 pitches), ${len} mm ${len >= need ? 'reaches' : 'is too short'}`, done: len >= need });
  } else if (v.joint === 'tapped') {
    const depth = Number(v.holeDepth), engaged = depth > 0 ? Math.min(len, depth) : len, blind = depth > 0 && String(v.through) !== '1';
    const bottom = blind ? depth - len : Infinity, ok = engaged >= size.d && bottom >= 2 * size.pitch;
    out.push({ label: 'Joint', text: `tapped: engages ${engaged} mm (${Math.round(engaged / size.d * 10) / 10} d; about 1 d in steel, 1.5 d in aluminium is the usual guide)${blind ? `, ${Math.round(bottom * 100) / 100} mm clear of the bottom` : ''} — sizes only, not a strength check`, done: ok });
  }
  return out;
}

const ok = { ok: true as const };
const JOINTS = [{ value: 'free', label: 'On its own' }, { value: 'nut', label: 'Through, washer + nut' }, { value: 'tapped', label: 'Into a tapped hole' }];
export const fastenerCommand: Command = {
  id: 'fastener', label: 'Fastener', icon: 'cad-fastener', group: 'create', keywords: 'bolt screw nut washer iso metric m3 m4 m5 m6 m8 m10 m12 standard part hardware joint tapped clearance',
  hint: 'A bolt, cap screw, nut or washer from your loaded fastener sizes — click a hole’s rim to fit one to it (size, nut or tapped, length); the thread is cosmetic',
  available: ctx => Object.keys(fastenerSizesOf(ctx.doc)).length ? ok : { ok: false as const, reason: NO_SIZES },
  fields: (ctx, v) => [
    { key: 'kind', label: 'Part', kind: 'choice', options: FASTENER_KINDS.map(k => ({ value: k.value, label: `${k.label} (${k.standard})` })) },
    { key: 'size', label: 'Size', kind: 'choice', options: Object.entries(fastenerSizesOf(ctx.doc)).map(([m, s]) => ({ value: m, label: `${m} × ${s.pitch}` })), empty: NO_SIZES },
    { key: 'length', label: 'Length', kind: 'choice', options: lengthsOfSize(String(v?.kind), fastenerSizesOf(ctx.doc), String(v?.size)).map(l => ({ value: String(l), label: `${l} mm` })), when: x => threaded(String(x.kind)) },
    { key: 'joint', label: 'Joint', kind: 'choice', options: JOINTS, when: x => threaded(String(x.kind)) },
    { key: 'model', label: 'Thread', kind: 'choice', options: [{ value: 'cosmetic', label: 'Cosmetic (drawn)' }, { value: 'modelled', label: 'Modelled (helix)' }], when: x => x.kind === 'hex-bolt' || x.kind === 'hex-nut' },
    { key: 'grip', label: 'Grip', kind: 'mm', min: 0.5, when: x => threaded(String(x.kind)) && x.joint === 'nut' },
    { key: 'x', label: 'Axis at X', kind: 'mm' }, { key: 'y', label: 'Axis at Y', kind: 'mm' }, { key: 'z', label: 'Seat at Z', kind: 'mm' },
    { key: 'insert', label: 'Insert', kind: 'choice', options: [{ value: 'part', label: 'Into this part' }, { value: 'instance', label: 'As a part of its own (assembly)' }] },
  ],
  defaults: (ctx: Ctx) => { const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity); const sizes = fastenerSizesOf(ctx.doc), first = Object.keys(sizes)[0]; return { kind: 'hex-bolt', size: sizes.M6 || !first ? 'M6' : first, length: '20', joint: 'free', grip: 10, holeD: 0, holeDepth: 0, through: '0', insert: 'part', model: 'cosmetic', x: Number.isFinite(right) ? Math.round(right + 14) : 0, y: 16, z: 0 }; },
  // A new size keeps the length when that size comes in it, else the nearest it does; a joint takes the
  // shortest length that does for it.
  // At a hole's rim (place gives the hole): the size it is for and how — through and clear: washer + nut; a tap drill:
  // tapped (O7: here, where the document's sizes are known).
  derive: (ctx, v, changed) => {
    const sizes = fastenerSizesOf(ctx.doc);
    if (changed.includes('holeD') && Number(v.holeD) > 0 && threaded(String(v.kind))) {
      const fit = sizeForHole(Number(v.holeD), sizes);
      if (fit) v = { ...v, size: fit.size, joint: fit.fit.fit === 'tapped' ? 'tapped' : String(v.through) === '1' ? 'nut' : 'free', grip: Number(v.holeDepth) };
    }
    const size = sizes[String(v.size)]; if (!size) return v;
    if (threaded(String(v.kind)) && v.joint !== 'free' && changed.some(k => ['size', 'kind', 'joint', 'grip', 'holeD', 'holeDepth'].includes(k))) {
      const l = jointLength(v, sizes); if (l !== null) return { ...v, length: String(l) };
    }
    if (!changed.includes('size') && !changed.includes('kind') && !changed.includes('holeD')) return v;
    const ls = lengthsOf(String(v.kind), size), want = Number(v.length);
    return ls.includes(want) || !ls.length ? v : { ...v, length: String(ls.reduce((b, l) => Math.abs(l - want) < Math.abs(b - want) ? l : b, ls[0])) };
  },
  // At a hole's rim: the hole, which derive sizes the fastener for.
  place: (v, [x, y, z], _normal, hole?: PlacedHole) => ({ ...v, x, y, z, holeD: hole?.d ?? 0, holeDepth: hole?.depth ?? 0, through: hole?.through ? '1' : '0' }),
  handles: (_ctx, v): HandleSpec[] => [{ key: 'x', at: [Number(v.x), Number(v.y), Number(v.z)], dir: [1, 0, 0], pair: { key: 'y', dir: [0, 1, 0] } }],
  steps: (ctx, v) => {
    const sizes = fastenerSizesOf(ctx.doc), t = fastenerThread(v, sizes), size = sizes[String(v.size)];
    if (!size) return [{ label: 'Size', text: noSizeRow(String(v.size)), done: false }];
    const data = v.kind === 'hex-bolt' && !size.checked4017 ? [{ label: 'Data', text: `ISO 4017 ${String(v.size)} lengths not yet cross-checked (its fastener size row says so)`, done: false }] : [];
    return [{ label: 'Part', text: fastenerName(v, sizes), done: true }, ...(t ? [{ label: 'Thread', text: `M${t.d}×${t.pitch} ${t.hand}-hand, ${t.internal ? 'internal' : 'external'}, ${v.model === 'modelled' && (v.kind === 'hex-bolt' || v.kind === 'hex-nut') ? 'modelled: ISO 68-1 basic profile as helical B-spline faces (a nut 0.04 mm clear)' : 'cosmetic (no helical geometry)'}`, done: true }] : []), ...fastenerFit(v, sizes), ...data];
  },
  build: (ctx, v) => v.insert === 'instance' ? withFastenerInstance(ctx.doc, v) : fastenerNodes(ctx.doc, { ...v, length: Number(v.length) }),
};

/** The turn of an instance whose +Z stands out of a face facing `up` (as `oriented` turns a shape's bodies). */
const UP_ROTATION: Record<string, [number, number, number]> = { '+z': [0, 0, 0], '-z': [180, 0, 0], '+x': [0, 90, 0], '-x': [0, -90, 0], '+y': [-90, 0, 0], '-y': [90, 0, 0] };
/**
 * The fastener as a part of its own, placed in the assembly (an instance, counted in the bill of
 * materials and mated like any part): built about its own origin, remembered as a fastener (so it shows
 * its thread), then moved to the seat and turned out of the face it was placed on.
 */
export function withFastenerInstance(doc: StudioDoc, v: Values): StudioDoc {
  // (Built from the assembly's sizes: the part keeps none of its own and inherits them, as placed parts inherit rows.)
  const sizes = fastenerSizesOf(doc), at = { ...v, x: 0, y: 0, z: 0, up: '+z', insert: 'part', length: Number(v.length) };
  const local = fastenerNodes(emptyDoc(), at, sizes), last = local.nodes.length - 1, top = local.nodes[last];
  const made = { command: 'fastener', values: { ...at, length: String(v.length) }, ...(local.nodes.length !== 2 ? { nodes: local.nodes.length } : {}) };
  const part: StudioDoc = top && (top.kind === 'union' || top.kind === 'extrude' || top.kind === 'thread') ? { ...local, nodes: [...local.nodes.slice(0, -1), { ...top, made }] } : local;
  const list = doc.instances ?? [];
  const inst: PartInstance = { id: nextInstanceId(doc, 'inst'), name: fastenerName(v, sizes), doc: part, position: [Number(v.x), Number(v.y), Number(v.z)], rotation: [...(UP_ROTATION[String(v.up ?? '+z')] ?? UP_ROTATION['+z'])] };
  return { ...doc, instances: [...list, inst] };
}
