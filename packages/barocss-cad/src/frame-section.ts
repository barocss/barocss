import type { ProfileSegmentInput, XY } from './extruded-profile-solid.js';

// FR1 structural sections (D122, D123). A section is a closed profile with holes in its own XY: its loops, a name for
// each segment, its area and centroid in closed form and its box. Every dimension is given (no section sizes and no
// radii are built in: a catalogue of sizes is the user's own data, D122). The closed forms are the oracles' too.

/** A section kind's numbers, resolved (millimetres). */
export type FrameSectionSpec =
  | { readonly kind: 'rect-tube'; readonly width: number; readonly height: number; readonly wall: number; readonly outerRadius: number; readonly innerRadius?: number }
  | { readonly kind: 'round-tube'; readonly diameter: number; readonly wall: number }
  | { readonly kind: 'angle'; readonly legX: number; readonly legY: number; readonly thickness: number; readonly rootRadius: number; readonly toeRadius: number }
  | { readonly kind: 'channel'; readonly height: number; readonly width: number; readonly web: number; readonly flange: number; readonly rootRadius: number }
  | { readonly kind: 'tslot'; readonly size: number; readonly cells: 1 | 2; readonly openSlots: number; readonly opening: number; readonly lip: number; readonly undercut: number; readonly depth: number; readonly bore: number };

/** A built section: loops in its own XY, the name of each segment (each loop's in order), area, centroid and box. */
export interface FrameSection {
  readonly outer: readonly ProfileSegmentInput[]; readonly outerNames: readonly string[];
  readonly holes: readonly (readonly ProfileSegmentInput[])[]; readonly holeNames: readonly (readonly string[])[];
  readonly areaMM2: number; readonly centroid: XY; readonly box: { readonly min: XY; readonly max: XY };
  /** A short description, `rect-tube 40 × 40 × 3, ro 6, ri 3 (concentric)`. */
  readonly label: string;
  /**
   * Dimensions not given but derived by a geometric rule (never a material or catalogue value), and how: a rectangular
   * tube's bore radius left out is concentric with its outer corners, `{ innerRadius: 'concentric: ro − t' }`.
   */
  readonly derived?: Readonly<Record<string, string>>;
}

/** A section's dimensions refused: the part model's PARAMETER code, the message starting `[SECTION_DIMENSIONS]`. */
export class FrameSectionError extends Error {
  constructor(detail: string) { super(`[SECTION_DIMENSIONS] ${detail}`.slice(0, 1024)); this.name = 'FrameSectionError'; }
}

/** The spandrel of a quarter disk of radius r (the square r × r less the disk): its area and its centroid's distance from the square's corner, along each side. */
const SPANDREL = 1 - Math.PI / 4;
const spandrelArea = (r: number) => SPANDREL * r * r;
const spandrelReach = (r: number) => r * (10 - 3 * Math.PI) / (3 * (4 - Math.PI));
const fmt = (x: number) => String(+x.toFixed(4));
const refuse = (detail: string): never => { throw new FrameSectionError(detail); };

/** A loop under construction: segments and their names; a line of no length is left out (its start merges). */
interface LoopBuilder { readonly segments: ProfileSegmentInput[]; readonly names: string[] }
function line(b: LoopBuilder, start: XY, name: string): void { b.segments.push({ kind: 'line', start }); b.names.push(name); }
function arc(b: LoopBuilder, start: XY, center: XY, direction: 'ccw' | 'cw', name: string): void { b.segments.push({ kind: 'arc', start, center, direction }); b.names.push(name); }

/** A rectangle 2hx × 2hy about the origin, corners rounded r (0: sharp), anticlockwise from its bottom side; names under `prefix`. */
function roundedRect(hx: number, hy: number, r: number, prefix: string): LoopBuilder {
  const b: LoopBuilder = { segments: [], names: [] };
  if (r === 0) { line(b, [-hx, -hy], `${prefix}bottom`); line(b, [hx, -hy], `${prefix}right`); line(b, [hx, hy], `${prefix}top`); line(b, [-hx, hy], `${prefix}left`); return b; }
  line(b, [-hx + r, -hy], `${prefix}bottom`); arc(b, [hx - r, -hy], [hx - r, -hy + r], 'ccw', `${prefix}round.br`);
  line(b, [hx, -hy + r], `${prefix}right`); arc(b, [hx, hy - r], [hx - r, hy - r], 'ccw', `${prefix}round.tr`);
  line(b, [hx - r, hy], `${prefix}top`); arc(b, [-hx + r, hy], [-hx + r, hy - r], 'ccw', `${prefix}round.tl`);
  line(b, [-hx, hy - r], `${prefix}left`); arc(b, [-hx, -hy + r], [-hx + r, -hy + r], 'ccw', `${prefix}round.bl`);
  return b;
}

function positive(x: number, what: string): void { if (!(x > 0)) refuse(`${what} must be positive (${x})`); }
function nonNegative(x: number, what: string): void { if (!(x >= 0)) refuse(`${what} must be 0 or more (${x})`); }

/**
 * A rectangular tube `width` (x) × `height` (y), wall t, outer corners `outerRadius` ro (0: sharp) and the bore's
 * `innerRadius` ri — by default concentric, ro − t (ro 0: 0). A ro in (0, t) has no concentric bore: its ri is given.
 * A = bh − (4 − π)ro² − [(b − 2t)(h − 2t) − (4 − π)ri²]; centred on the origin. Faces `bottom`, `right`, `top`, `left`,
 * `round.br` …, and the bore's `bore.bottom` ….
 */
function rectTube(s: Extract<FrameSectionSpec, { kind: 'rect-tube' }>): FrameSection {
  const { width: b, height: h, wall: t, outerRadius: ro } = s;
  positive(b, 'width'); positive(h, 'height'); positive(t, 'wall'); nonNegative(ro, 'outerRadius');
  if (!(2 * t < Math.min(b, h))) refuse(`a wall ${fmt(t)} leaves no bore in ${fmt(b)} × ${fmt(h)}`);
  if (!(ro < Math.min(b, h) / 2)) refuse(`an outer radius ${fmt(ro)} leaves no flat side on ${fmt(b)} × ${fmt(h)}`);
  if (s.innerRadius === undefined && ro > 0 && ro < t) refuse(`an outer radius ${fmt(ro)} under the wall ${fmt(t)} has no concentric bore radius: give innerRadius`);
  const ri = s.innerRadius ?? Math.max(0, ro - t);
  nonNegative(ri, 'innerRadius');
  if (!(ri < Math.min(b, h) / 2 - t)) refuse(`an inner radius ${fmt(ri)} leaves no flat side in the bore`);
  if (ri > ro) refuse(`an inner radius ${fmt(ri)} past the outer ${fmt(ro)} thins the wall at the corners`);
  const out = roundedRect(b / 2, h / 2, ro, ''), bore = roundedRect(b / 2 - t, h / 2 - t, ri, 'bore.'), k = 4 - Math.PI;
  return { outer: out.segments, outerNames: out.names, holes: [bore.segments], holeNames: [bore.names],
    areaMM2: b * h - k * ro * ro - ((b - 2 * t) * (h - 2 * t) - k * ri * ri), centroid: [0, 0], box: { min: [-b / 2, -h / 2], max: [b / 2, h / 2] },
    label: `rect-tube ${fmt(b)} × ${fmt(h)} × ${fmt(t)}${ro ? `, ro ${fmt(ro)}, ri ${fmt(ri)}${s.innerRadius === undefined ? ' (concentric)' : ''}` : s.innerRadius !== undefined ? `, ri ${fmt(ri)}` : ''}`,
    ...(s.innerRadius === undefined ? { derived: { innerRadius: ro ? 'concentric: ro − t' : 'sharp: 0, as the outer corners' } } : {}) };
}

/** A round tube Ø`diameter`, wall t, centred on the origin: A = π(R² − r²). Faces `outside`, `bore`. */
function roundTube(s: Extract<FrameSectionSpec, { kind: 'round-tube' }>): FrameSection {
  const R = s.diameter / 2, t = s.wall;
  positive(s.diameter, 'diameter'); positive(t, 'wall');
  if (!(t < R)) refuse(`a wall ${fmt(t)} leaves no bore in Ø${fmt(s.diameter)}`);
  const r = R - t;
  return { outer: [{ kind: 'arc', start: [R, 0], center: [0, 0], direction: 'ccw' }], outerNames: ['outside'], holes: [[{ kind: 'arc', start: [r, 0], center: [0, 0], direction: 'ccw' }]], holeNames: [['bore']],
    areaMM2: Math.PI * (R * R - r * r), centroid: [0, 0], box: { min: [-R, -R], max: [R, R] }, label: `round-tube Ø${fmt(s.diameter)} × ${fmt(t)}` };
}

/**
 * An angle: legs `legX` a (along x) and `legY` b (along y), thickness t, root radius r1, toe radii r2; the heel at the
 * origin. A = t(a + b − t) + (1 − π/4)(r1² − 2r2²). Faces `back.x` (y 0), `end.x`, `toe.x`, `face.x` (y t), `root`,
 * `face.y` (x t), `toe.y`, `end.y`, `back.y` (x 0).
 */
function angle(s: Extract<FrameSectionSpec, { kind: 'angle' }>): FrameSection {
  const { legX: a, legY: b, thickness: t, rootRadius: r1, toeRadius: r2 } = s;
  positive(a, 'legX'); positive(b, 'legY'); positive(t, 'thickness'); nonNegative(r1, 'rootRadius'); nonNegative(r2, 'toeRadius');
  if (!(r2 < t)) refuse(`a toe radius ${fmt(r2)} must be under the thickness ${fmt(t)}`);
  if (!(a - r2 > t + r1) || !(b - r2 > t + r1)) refuse(`legs ${fmt(a)} and ${fmt(b)} leave no flat face between the root (${fmt(t)} + ${fmt(r1)}) and the toe (${fmt(r2)})`);
  const L: LoopBuilder = { segments: [], names: [] };
  line(L, [0, 0], 'back.x'); line(L, [a, 0], 'end.x');
  if (r2 > 0) arc(L, [a, t - r2], [a - r2, t - r2], 'ccw', 'toe.x');
  line(L, [a - r2, t], 'face.x');
  if (r1 > 0) arc(L, [t + r1, t], [t + r1, t + r1], 'cw', 'root');
  line(L, [t, t + r1], 'face.y');
  if (r2 > 0) arc(L, [t, b - r2], [t - r2, b - r2], 'ccw', 'toe.y');
  line(L, [t - r2, b], 'end.y'); line(L, [0, b], 'back.y');
  // Moments: the two legs (x 0..a by 0..t, then 0..t by t..b), the root's spandrel added at (t, t), each toe's taken off.
  const s1 = spandrelArea(r1), s2 = spandrelArea(r2), c1 = spandrelReach(r1), c2 = spandrelReach(r2);
  const A = a * t + t * (b - t) + s1 - 2 * s2;
  const Mx = a * t * a / 2 + t * (b - t) * t / 2 + s1 * (t + c1) - s2 * (a - c2) - s2 * (t - c2);
  const My = a * t * t / 2 + t * (b - t) * (t + b) / 2 + s1 * (t + c1) - s2 * (t - c2) - s2 * (b - c2);
  return { outer: L.segments, outerNames: L.names, holes: [], holeNames: [], areaMM2: A, centroid: [Mx / A, My / A], box: { min: [0, 0], max: [a, b] },
    label: `angle ${fmt(a)} × ${fmt(b)} × ${fmt(t)}${r1 || r2 ? `, r1 ${fmt(r1)}, r2 ${fmt(r2)}` : ''}` };
}

/**
 * A channel with parallel flanges: `height` h along y, flanges `width` b along x, `web` tw, `flange` tf, root radius r;
 * its back on x 0 and its bottom on y 0. A = h·tw + 2(b − tw)tf + 2(1 − π/4)r². Faces `back`, `bottom`, `tip.bottom`,
 * `inside.bottom`, `root.bottom`, `web`, `root.top`, `inside.top`, `tip.top`, `top`.
 */
function channel(s: Extract<FrameSectionSpec, { kind: 'channel' }>): FrameSection {
  const { height: h, width: b, web: tw, flange: tf, rootRadius: r } = s;
  positive(h, 'height'); positive(b, 'width'); positive(tw, 'web'); positive(tf, 'flange'); nonNegative(r, 'rootRadius');
  if (!(b - tw > r)) refuse(`flanges ${fmt(b)} wide leave no flat inside past the web ${fmt(tw)} and the root ${fmt(r)}`);
  if (!(h - 2 * tf - 2 * r > 0)) refuse(`a height ${fmt(h)} leaves no flat web between the flanges ${fmt(tf)} and the roots ${fmt(r)}`);
  const L: LoopBuilder = { segments: [], names: [] };
  line(L, [0, 0], 'bottom'); line(L, [b, 0], 'tip.bottom'); line(L, [b, tf], 'inside.bottom');
  if (r > 0) arc(L, [tw + r, tf], [tw + r, tf + r], 'cw', 'root.bottom');
  line(L, [tw, tf + r], 'web');
  if (r > 0) arc(L, [tw, h - tf - r], [tw + r, h - tf - r], 'cw', 'root.top');
  line(L, [tw + r, h - tf], 'inside.top'); line(L, [b, h - tf], 'tip.top'); line(L, [b, h], 'top'); line(L, [0, h], 'back');
  const S = spandrelArea(r), c = spandrelReach(r), A = h * tw + 2 * (b - tw) * tf + 2 * S;
  const Mx = h * tw * tw / 2 + 2 * (b - tw) * tf * (tw + b) / 2 + 2 * S * (tw + c);
  return { outer: L.segments, outerNames: L.names, holes: [], holeNames: [], areaMM2: A, centroid: [Mx / A, h / 2], box: { min: [0, 0], max: [b, h] },
    label: `channel ${fmt(h)} × ${fmt(b)} × ${fmt(tw)}/${fmt(tf)}${r ? `, r ${fmt(r)}` : ''}` };
}

/** The slot faces of a T-slot section, clockwise from the top as the library's part opens them (cells 1: the first `openSlots`; cells 2: all six). */
type Slot = { readonly id: string; readonly face: 'top' | 'right' | 'bottom' | 'left'; readonly at: number };
function slotsOf(a: number, cells: 1 | 2, open: number): Slot[] {
  if (cells === 2) return [{ id: 't1', face: 'top', at: 0 }, { id: 't2', face: 'top', at: a }, { id: 'r', face: 'right', at: 0 }, { id: 'b2', face: 'bottom', at: a }, { id: 'b1', face: 'bottom', at: 0 }, { id: 'l', face: 'left', at: 0 }];
  return ([{ id: 't1', face: 'top', at: 0 }, { id: 'r', face: 'right', at: 0 }, { id: 'b1', face: 'bottom', at: 0 }, { id: 'l', face: 'left', at: 0 }] as Slot[]).slice(0, open);
}

/**
 * A 20-class T-slot extrusion's section (the tslot-20 library part's shape, D122): `size` a, `cells` 1 (a × a) or 2
 * (2a × a), a slot `opening` wo through a `lip` tl, an `undercut` wu under the lips tapering at 45° back to wo, the slot
 * `depth` ds from the face, and a core `bore` per cell; the first cell's centre at the origin. Every value is the
 * user's (the library's are estimates). Each slot is wo·ds + (wu/2 − wo/2)² of area: A = cells·a² − n·slot −
 * cells·π(bore/2)². Faces `top.0` … (the face pieces), `<slot>.lip0` … `<slot>.floor` (t1, t2, r, b2, b1, l), `core<k>`.
 */
function tslot(s: Extract<FrameSectionSpec, { kind: 'tslot' }>): FrameSection {
  const { size: a, cells, opening: wo, lip: tl, undercut: wu, depth: ds, bore } = s;
  positive(a, 'size'); positive(wo, 'opening'); positive(tl, 'lip'); positive(wu, 'undercut'); positive(ds, 'depth'); positive(bore, 'bore');
  if (cells !== 1 && cells !== 2) refuse(`cells must be 1 or 2 (${cells})`);
  if (cells === 1 && !(Number.isInteger(s.openSlots) && s.openSlots >= 0 && s.openSlots <= 4)) refuse(`openSlots must be 0 to 4 (${s.openSlots})`);
  const ho = wo / 2, hu = wu / 2, dt = tl + hu - ho;
  if (!(hu > ho)) refuse(`the undercut ${fmt(wu)} must be wider than the opening ${fmt(wo)}`);
  if (!(dt < ds)) refuse(`a slot ${fmt(ds)} deep has no straight part below its 45° undercut (to ${fmt(dt)})`);
  if (!(ds < a / 2 - bore / 2)) refuse(`a slot ${fmt(ds)} deep reaches the core bore Ø${fmt(bore)} in a ${fmt(a)} section`);
  if (!(ho < a / 2 - ds) || !(hu < a / 2 - dt)) refuse(`slots ${fmt(wo)} / ${fmt(wu)} wide and ${fmt(ds)} deep meet their neighbours in a ${fmt(a)} section`);
  const xr = a * cells - a / 2, slots = slotsOf(a, cells, s.openSlots);
  // Each face anticlockwise: its start, its direction along and inwards; the slots on it in that order.
  const faces = [
    { face: 'bottom', start: [-a / 2, -a / 2] as XY, along: [1, 0] as XY, inward: [0, 1] as XY, length: a * cells },
    { face: 'right', start: [xr, -a / 2] as XY, along: [0, 1] as XY, inward: [-1, 0] as XY, length: a },
    { face: 'top', start: [xr, a / 2] as XY, along: [-1, 0] as XY, inward: [0, -1] as XY, length: a * cells },
    { face: 'left', start: [-a / 2, a / 2] as XY, along: [0, -1] as XY, inward: [1, 0] as XY, length: a },
  ] as const;
  const L: LoopBuilder = { segments: [], names: [] };
  const notch: [number, number, string][] = [[-ho, 0, 'lip0'], [-ho, tl, 'under0'], [-hu, tl, 'taper0'], [-ho, dt, 'wall0'], [-ho, ds, 'floor'], [ho, ds, 'wall1'], [ho, dt, 'taper1'], [hu, tl, 'under1'], [ho, tl, 'lip1']];
  let slotArea = 0, Mx = 0, My = 0;
  const one = wo * ds + (hu - ho) * (hu - ho), depthBar = (wo * ds * ds / 2 + (hu - ho) * (hu - ho) * (2 * tl + dt) / 3) / one;
  for (const F of faces) {
    // A slot's centre as a distance along the face from its start.
    const on = slots.filter(q => q.face === F.face).map(q => ({ q, s: F.face === 'bottom' ? q.at + a / 2 : F.face === 'top' ? xr - q.at : a / 2 })).sort((p, q) => p.s - q.s);
    let piece = 0;
    line(L, F.start, `${F.face}.${piece++}`);
    for (const { q, s: c } of on) {
      for (const [sx, d, name] of notch) line(L, [F.start[0] + (c + sx) * F.along[0] + d * F.inward[0], F.start[1] + (c + sx) * F.along[1] + d * F.inward[1]], `${q.id}.${name}`);
      line(L, [F.start[0] + (c + ho) * F.along[0], F.start[1] + (c + ho) * F.along[1]], `${F.face}.${piece++}`);
      const cx = F.start[0] + c * F.along[0] + depthBar * F.inward[0], cy = F.start[1] + c * F.along[1] + depthBar * F.inward[1];
      slotArea += one; Mx += one * cx; My += one * cy;
    }
  }
  const holes: ProfileSegmentInput[][] = [], holeNames: string[][] = [], rb = bore / 2, disk = Math.PI * rb * rb;
  for (let k = 0; k < cells; k++) { holes.push([{ kind: 'arc', start: [k * a + rb, 0], center: [k * a, 0], direction: 'ccw' }]); holeNames.push([`core${k}`]); Mx += disk * k * a; }
  const box = a * a * cells, A = box - slotArea - cells * disk;
  const centroid: XY = [(box * (xr - a / 2) / 2 - Mx) / A, (0 - My) / A];
  return { outer: L.segments, outerNames: L.names, holes, holeNames, areaMM2: A, centroid, box: { min: [-a / 2, -a / 2], max: [xr, a / 2] },
    label: `tslot ${fmt(a)}${cells === 2 ? ` × ${fmt(2 * a)}` : ''}, ${slots.length} slot${slots.length === 1 ? '' : 's'}` };
}

/** A section kind built from its numbers; refused `[SECTION_DIMENSIONS]` where they do not make one. */
export function frameSection(spec: FrameSectionSpec): FrameSection {
  switch (spec.kind) {
    case 'rect-tube': return rectTube(spec);
    case 'round-tube': return roundTube(spec);
    case 'angle': return angle(spec);
    case 'channel': return channel(spec);
    case 'tslot': return tslot(spec);
  }
}

/** The places in a section a member's line can run through: its centroid, its own origin, and its box's nine points. */
export const FRAME_ANCHORS = ['centroid', 'origin', 'bottom-left', 'bottom', 'bottom-right', 'left', 'center', 'right', 'top-left', 'top', 'top-right'] as const;
export type FrameAnchor = typeof FRAME_ANCHORS[number];
/** An anchor's point in the section's XY, given its centroid and box. */
export function anchorPoint(anchor: FrameAnchor, centroid: XY, box: { readonly min: XY; readonly max: XY }): XY {
  if (anchor === 'centroid') return centroid;
  if (anchor === 'origin') return [0, 0];
  const x = /left/.test(anchor) ? box.min[0] : /right/.test(anchor) ? box.max[0] : (box.min[0] + box.max[0]) / 2;
  const y = /bottom/.test(anchor) ? box.min[1] : /top/.test(anchor) ? box.max[1] : (box.min[1] + box.max[1]) / 2;
  return [x, y];
}

/** A loop's box exactly: its segments' starts and each arc's extreme points on the axes it sweeps past. */
export function loopBox(segments: readonly ProfileSegmentInput[]): { min: XY; max: XY } {
  const min: XY = [Infinity, Infinity], max: XY = [-Infinity, -Infinity];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i], next = segments[(i + 1) % segments.length].start;
    take(min, max, s.start[0], s.start[1]);
    if (s.kind !== 'arc') continue;
    const r = Math.hypot(s.start[0] - s.center[0], s.start[1] - s.center[1]), a0 = Math.atan2(s.start[1] - s.center[1], s.start[0] - s.center[0]);
    // (A loop of one arc is a whole circle: its end is its start.)
    let sweep = segments.length === 1 ? 2 * Math.PI : Math.atan2(next[1] - s.center[1], next[0] - s.center[0]) - a0;
    if (segments.length > 1) { if (s.direction === 'ccw' && sweep <= 0) sweep += 2 * Math.PI; if (s.direction === 'cw' && sweep >= 0) sweep -= 2 * Math.PI; }
    for (let k = -8; k <= 8; k++) {
      const q = k * Math.PI / 2, t = s.direction === 'ccw' ? q - a0 : a0 - q;
      if (t > 0 && t < Math.abs(sweep)) take(min, max, s.center[0] + r * Math.cos(q), s.center[1] + r * Math.sin(q));
    }
  }
  return { min, max };
}
function take(min: XY, max: XY, x: number, y: number): void { min[0] = Math.min(min[0], x); min[1] = Math.min(min[1], y); max[0] = Math.max(max[0], x); max[1] = Math.max(max[1], y); }

/** A member as built (FR1, D123): its section, where its line runs and the section's frame in the part. */
export interface FrameMemberReport {
  /** The section kind and its description (`rect-tube 40 × 40 × 3, ro 6`; a sketch section: `sketch <id>`). */
  readonly sectionKind: string; readonly section: string;
  /** Its area and centroid in the section's own XY (closed forms; a sketch section's by its prism's exact mass). */
  readonly areaMM2: number; readonly centroid: XY;
  /** The section's dimensions derived by a geometric rule, and how (`FrameSection.derived`). */
  readonly derived?: Readonly<Record<string, string>>;
  /** The section's point on the member's line (`anchor`), and how far the section is moved from it (`offset`, in its XY). */
  readonly anchor: FrameAnchor; readonly offset: XY; readonly rollDegrees: number;
  /** The section turned over across its own y axis (FR2, D124). */
  readonly mirrored?: true;
  /** A frame's member (FR2, D124): its index and the skeleton points it runs from and to. */
  readonly frame?: { readonly member: number; readonly from: number; readonly to: number };
  /** The member's line, its length, its direction (the extrusion's) and the section's x and y in the part. */
  readonly start: readonly [number, number, number]; readonly end: readonly [number, number, number]; readonly lengthMM: number;
  readonly axis: readonly [number, number, number]; readonly xAxis: readonly [number, number, number]; readonly yAxis: readonly [number, number, number];
  /** The up reference was along the member, so the section's y came from this one instead. */
  readonly upFallback?: readonly [number, number, number];
  /** How its ends are finished at the frame's corners (FR3a, D125): square, mitre, butt, or running through. */
  readonly ends?: readonly FrameEndReport[];
  /** The centroidal axis in the part: the line A·L is measured on. */
  readonly centroidLine: { readonly start: readonly [number, number, number]; readonly end: readonly [number, number, number] };
}

/**
 * One end of a frame's member at a corner (FR3a, D125): `square` (no corner, or one left as it is), `mitre` (cut on the
 * plane halfway between the two members), `butt` (ended on the face of the member that runs through), `through` (run on
 * past the corner to cover the other member). `point` the skeleton point; `with` the other member; `angleDegrees` the
 * cut from square; `plane` the cut's (its normal pointing away from the member); `extendedMM` how far a through member
 * runs past the point.
 */
export interface FrameEndReport {
  readonly end: 'start' | 'end'; readonly point: number; readonly kind: 'square' | 'mitre' | 'butt' | 'through';
  readonly with?: number; readonly angleDegrees?: number; readonly extendedMM?: number;
  readonly plane?: { readonly origin: readonly [number, number, number]; readonly normal: readonly [number, number, number] };
}
