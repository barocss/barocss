// Primitive solids beside Box and Cylinder, each a sketch and one extrude or revolve (so they edit like any
// feature): sphere, cone (or frustum), torus, tube, wedge and regular polygon prism. They stand on Z = At Z
// at the given X, Y, to the right of what is there by default.
import { bevelGearDimensions, wormDimensions, wormWheelSpec, checkWormPair } from '@barocss/cad';
import { withNode, type LoopSegment, type ModelNode, type StudioDoc } from '../engine/doc';
import type { Command, Ctx, HandleSpec, Values } from './commands';

const ok = { ok: true as const };
const r1 = (v: number) => Math.round(v * 10) / 10;
/** Right of the part's bodies (or the origin), and where along Y. */
const beside = (ctx: Ctx, gap: number) => { const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity); return { x: Number.isFinite(right) ? r1(right + gap) : 0, y: 16, z: 0 }; };
const at = [{ key: 'x', label: 'Centre X', kind: 'mm' as const }, { key: 'y', label: 'Centre Y', kind: 'mm' as const }, { key: 'z', label: 'At Z', kind: 'mm' as const }];
/** The XZ plane through (x, y, z): its X along world X, its Y up world Z, facing −Y. */
const upright = (v: Values) => ({ origin: [Number(v.x), Number(v.y), Number(v.z)] as [number, number, number], normal: [0, -1, 0] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] });
/** A sketch drawn on the upright plane, turned a full turn about its Y axis (world Z through x, y). */
function turned(doc: StudioDoc, sketch: ModelNode): StudioDoc {
  const d = withNode(doc, sketch);
  return withNode(d, { kind: 'revolve', sketch: d.nodes.length - 1, axis: 'y', angleDegrees: 360 });
}
/**
 * A regular torus cage (every vertex valence 4) of nu × nv quads standing on z, wound outward. Its radii are grown so
 * that the limit surface's points over the cage's vertices sit at the ring radius and, across the tube, the tube
 * radius (a vertex's limit is the (1, 4, 1)/6 average of its neighbours along each direction).
 */
function torusCage(R: number, r: number, nu: number, nv: number, [x, y, z]: [number, number, number]) {
  const cu = (4 + 2 * Math.cos(2 * Math.PI / nu)) / 6, cv = (4 + 2 * Math.cos(2 * Math.PI / nv)) / 6, Rc = R / cu, rc = r / cv;
  const positions: number[] = [], faces: number[][] = [], round = (t: number) => Math.round(t * 1e9) / 1e9;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const u = 2 * Math.PI * i / nu, w = 2 * Math.PI * j / nv;
    positions.push(round(x + (Rc + rc * Math.cos(w)) * Math.cos(u)), round(y + (Rc + rc * Math.cos(w)) * Math.sin(u)), round(z + r + rc * Math.sin(w)));
  }
  const at = (i: number, j: number) => (i % nu) * nv + (j % nv);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) faces.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
  return { positions, faces };
}
/**
 * A thick-walled tube's cage (D84): open both ends, its axis along Z from z to z + h, every vertex valence 4 (a torus
 * by topology: regular, its limit exact). Round it `nu` columns (the first centred on +X, so a lug or tab extruded
 * from it is square to X), along it `nh` rows on each wall, one quad across each rim. The radii are grown so that
 * the walls' limit sits at them (as the torus'); the rims come out round, tightened by holding loops.
 */
export function tubeCage(ro: number, ri: number, h: number, nu: number, nh: number, [x, y, z]: [number, number, number]) {
  const cu = (4 + 2 * Math.cos(2 * Math.PI / nu)) / 6, round = (t: number) => Math.round(t * 1e9) / 1e9, section: [number, number][] = [];
  // The wall's section, outer wall up then inner wall down: faces wound outward.
  for (let k = 0; k <= nh; k++) section.push([ro / cu, h * k / nh]);
  for (let k = nh; k >= 0; k--) section.push([ri / cu, h * k / nh]);
  const m = section.length, positions: number[] = [], faces: number[][] = [];
  for (let i = 0; i < nu; i++) {
    const a = 2 * Math.PI * (i - 0.5) / nu;
    for (const [r, zz] of section) positions.push(round(x + r * Math.cos(a)), round(y + r * Math.sin(a)), round(z + zz));
  }
  const at = (i: number, j: number) => (i % nu) * m + (j % m);
  for (let i = 0; i < nu; i++) for (let j = 0; j < m; j++) faces.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
  return { positions, faces };
}
/**
 * A box's cage (SD2, D78): w × d × h on its surface lattice of `n` quads along each side, wound outward; its eight
 * corners valence 3 (extraordinary). More quads, a squarer limit (rounder edges with fewer).
 */
export function boxCage(w: number, d: number, h: number, n: number, [x, y, z]: [number, number, number]) {
  const at = new Map<string, number>(), positions: number[] = [], faces: number[][] = [];
  const vertex = (p: number[]) => { const key = p.join(','); let i = at.get(key); if (i === undefined) { i = positions.length / 3; at.set(key, i); positions.push(x - w / 2 + p[0] * w / n, y - d / 2 + p[1] * d / n, z + p[2] * h / n); } return i; };
  // Each side: its fixed axis a at 0 or n; (b, c) with e_b × e_c outward.
  for (const a of [0, 1, 2]) for (const s of [0, n]) {
    const [b, c] = s ? [(a + 1) % 3, (a + 2) % 3] : [(a + 2) % 3, (a + 1) % 3];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = (u: number, v: number) => { const q = [0, 0, 0]; q[a] = s; q[b] = u; q[c] = v; return vertex(q); };
      faces.push([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)]);
    }
  }
  return { positions, faces };
}
const circleLoop = (cx: number, cy: number, r: number): LoopSegment[] => [{ kind: 'arc', start: [cx + r, cy], center: [cx, cy], direction: 'ccw' }];

type V3 = [number, number, number];
const n = (v: Values, ...keys: string[]) => keys.map(k => Number(v[k]));
/** A puck at (x, y, z) that slides the shape on its plane (its X and Y values). */
export const puck = (at: V3): HandleSpec => ({ key: 'x', at, dir: [1, 0, 0], pair: { key: 'y', dir: [0, 1, 0] } });
const arrow = (key: string, at: V3, dir: V3, extra: Partial<HandleSpec> = {}): HandleSpec => ({ key, at, dir, min: 0.5, step: 0.5, ...extra });
const X: V3 = [1, 0, 0], Y: V3 = [0, 1, 0], Z: V3 = [0, 0, 1];
/**
 * Spring steel's shear modulus G, MPa: an estimate (a commonly used round figure, no source read), prefilled by the
 * Spring command and flagged as such on the node (the owner, R12c: "스프링 G는 추정값으로 표시해").
 */
export const STEEL_G_ESTIMATE_MPA = 79300;
/** Spring steel's Young's modulus E, MPa, for a torsion spring's rate: an estimate likewise (no source read), flagged. */
export const STEEL_E_ESTIMATE_MPA = 206000;

/** The one selected body when it is a spur gear as made (not built on further): its node and index. */
/** The Internal gear command's default x2 (D132): unshifted, a ring's tip corners cut a rack-cut pinion's fillet at no backlash. */
const RING_SHIFT = 0.5;
function gearPicked(ctx: Ctx): { node: Extract<ModelNode, { kind: 'gear' }>; index: number } | null {
  const p = pickedGearNode(ctx);
  return p && p.node.kind === 'gear' ? { node: p.node, index: p.index } : null;
}
/** The one gear, internal gear or bevel gear (as made) the selection picks (R12b.2a: a pinion meshes inside a ring; R12b.3: a bevel gear's mate). */
function pickedGearNode(ctx: Ctx): { node: Extract<ModelNode, { kind: 'gear' | 'internal-gear' | 'bevel-gear' }>; index: number } | null {
  const picked = new Set<number>(ctx.selection.bodies); ctx.selection.faces.forEach(f => picked.add(f.body)); ctx.selection.edges.forEach(e => picked.add(e.body));
  if (picked.size !== 1) return null;
  const body = ctx.bodies[[...picked][0]], ref = body?.ref, node = ref ? ctx.doc.nodes[ref.node] : undefined;
  return (node?.kind === 'gear' || node?.kind === 'internal-gear' || node?.kind === 'bevel-gear') && ref!.side === 'solid' ? { node, index: ref!.node } : null;
}
const bevelPicked = (ctx: Ctx) => { const p = pickedGearNode(ctx); return p && p.node.kind === 'bevel-gear' ? { node: p.node, index: p.index } : null; };

/** Placed with its centre (axis) at the pointer. */
const centred = (v: Values, [x, y, z]: [number, number, number]): Values => ({ ...v, x, y, z });

export const primitives: Command[] = [
  {
    id: 'sphere', label: 'Sphere', icon: 'cad-sphere', hint: 'A ball by radius, standing on At Z', group: 'create', keywords: 'ball globe dome round',
    available: () => ok,
    fields: () => [{ key: 'r', label: 'Radius', kind: 'mm', min: 0.5 }, ...at],
    defaults: ctx => ({ r: 10, ...beside(ctx, 14) }),
    place: centred,
    handles: (_, v) => { const [r, x, y, z] = n(v, 'r', 'x', 'y', 'z'); return [puck([x, y, z]), arrow('r', [x + r, y, z + r], X)]; },
    // A half disc right of the axis, from the bottom pole to the top one.
    build: (ctx, v) => { const r = Number(v.r); return turned(ctx.doc, { kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [0, 0], center: [0, r], direction: 'ccw' }, { kind: 'line', start: [0, 2 * r] }], plane: upright(v) }); },
  },
  {
    id: 'cone', label: 'Cone', icon: 'cad-cone', hint: 'A cone, or a frustum with a top radius', group: 'create', keywords: 'taper frustum point spike funnel',
    available: () => ok,
    fields: () => [{ key: 'r', label: 'Base radius', kind: 'mm', min: 0.5 }, { key: 'rt', label: 'Top radius', kind: 'mm', min: 0 }, { key: 'h', label: 'Height', kind: 'mm', min: 0.5 }, ...at],
    defaults: ctx => ({ r: 10, rt: 0, h: 20, ...beside(ctx, 14) }),
    place: centred,
    handles: (_, v) => { const [r, rt, h, x, y, z] = n(v, 'r', 'rt', 'h', 'x', 'y', 'z'); return [puck([x, y, z]), arrow('r', [x + r, y, z], X), arrow('rt', [x + rt, y, z + h], X, { min: 0 }), arrow('h', [x, y, z + h], Z)]; },
    build: (ctx, v) => {
      const r = Number(v.r), rt = Number(v.rt), h = Number(v.h);
      const points: [number, number][] = rt > 0 ? [[0, 0], [r, 0], [rt, h], [0, h]] : [[0, 0], [r, 0], [0, h]];
      return turned(ctx.doc, { kind: 'sketch', profile: 'polygon', points, plane: upright(v) });
    },
  },
  {
    id: 'torus', label: 'Torus', icon: 'cad-torus', hint: 'A ring: a tube radius turned at a ring radius', group: 'create', keywords: 'ring donut o-ring',
    available: () => ok,
    fields: () => [{ key: 'R', label: 'Ring radius', kind: 'mm', min: 1 }, { key: 'r', label: 'Tube radius', kind: 'mm', min: 0.5 }, ...at],
    defaults: ctx => ({ R: 20, r: 5, ...beside(ctx, 30) }),
    place: centred,
    handles: (_, v) => { const [R, r, x, y, z] = n(v, 'R', 'r', 'x', 'y', 'z'); return [puck([x, y, z]), arrow('R', [x + R + r, y, z + r], X, { min: 1 }), arrow('r', [x + R, y, z + 2 * r], Z, { scale: 0.5 })]; },
    build: (ctx, v) => {
      const R = Number(v.R), r = Number(v.r);
      if (!(r < R)) throw new Error('The tube radius must be smaller than the ring radius.');
      return turned(ctx.doc, { kind: 'sketch', profile: 'circle', center: [R, r], radius: r, plane: upright(v) });
    },
  },
  {
    id: 'gear', label: 'Spur gear', icon: 'cad-gear', hint: 'An involute spur or helical gear by module, teeth and face width (20°; helical: normal module, helix angle and hand). Its root is the one the basic rack cuts (tip radius 0.38 m). Not validated for manufacturing', group: 'create', keywords: 'gear spur involute module teeth pinion wheel cog transmission',
    available: () => ok,
    fields: () => [{ key: 'm', label: 'Module', kind: 'mm', min: 0.2 }, { key: 'teeth', label: 'Teeth', kind: 'count', min: 6, max: 200 }, { key: 'b', label: 'Face width', kind: 'mm', min: 0.5 }, { key: 'shift', label: 'Profile shift x', kind: 'number', min: -0.5, max: 1, step: 0.05 },
      { key: 'helix', label: 'Helix angle β', kind: 'deg', min: 0, max: 45 }, { key: 'hand', label: 'Hand', kind: 'choice', options: [{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }], when: v => Number(v.helix) > 0 },
      { key: 'bore', label: 'Bore', kind: 'mm', min: 0 }, ...at],
    defaults: ctx => ({ m: 2, teeth: 20, b: 10, shift: 0, helix: 0, hand: 'right', bore: 8, ...beside(ctx, 30) }),
    place: centred,
    handles: (_, v) => { const [m, z, b, x, y, zz] = n(v, 'm', 'teeth', 'b', 'x', 'y', 'z'); return [puck([x, y, zz]), arrow('b', [x + m * z / 2, y, zz + b], Z)]; },
    build: (ctx, v) => {
      const [m, z, b, bore, x, y, zz, shift, helix] = n(v, 'm', 'teeth', 'b', 'bore', 'x', 'y', 'z', 'shift', 'helix');
      return withNode(ctx.doc, { kind: 'gear', module: m, teeth: Math.round(z), faceWidth: b, ...(shift ? { profileShift: shift } : {}), ...(helix ? { helixAngle: helix, hand: v.hand === 'left' ? 'left' as const : 'right' as const } : {}), ...(bore > 0 ? { bore } : {}), center: [x, y], ...(zz ? { from: zz } : {}), generator: 'spur-gear@1' });
    },
  },
  {
    id: 'internal-gear', label: 'Internal gear', icon: 'cad-gear', hint: 'An involute internal (ring) gear by module, teeth, face width and rim diameter (20°; helical: normal module, helix angle and hand). Shifted x2 0.5 by default, so a rack-cut pinion inside clears its tips. Its root is the one a pinion-type cutter cuts (24 teeth by default: an estimate, the shop\'s to give); a helical ring\'s is schematic. Not validated for manufacturing. Select it and add a Meshing gear to put a pinion inside', group: 'create', keywords: 'internal gear ring annulus planetary epicyclic inner teeth',
    available: () => ok,
    fields: () => [{ key: 'm', label: 'Module', kind: 'mm', min: 0.2 }, { key: 'teeth', label: 'Teeth', kind: 'count', min: 8, max: 200 }, { key: 'b', label: 'Face width', kind: 'mm', min: 0.5 }, { key: 'rim', label: 'Rim Ø', kind: 'mm', min: 1 }, { key: 'shift', label: 'Profile shift x (default 0.5: clears rack-cut pinions, D132)', kind: 'number', min: -0.5, max: 0.75, step: 0.05 },
      { key: 'helix', label: 'Helix angle β', kind: 'deg', min: 0, max: 45 }, { key: 'hand', label: 'Hand', kind: 'choice', options: [{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }], when: v => Number(v.helix) > 0 },
      // (R12b.2b, D133: the cutter that cuts its root — the shop's; 24 teeth an estimate. 0: the schematic root. A helical ring's root is schematic.)
      { key: 'cutter', label: 'Cutter teeth (estimate: the shop\'s; 0 schematic)', kind: 'count', min: 0, max: 196, when: v => !(Number(v.helix) > 0) }, ...at],
    // (x2 0.5 by default: unshifted, the ring's tip corners run into a rack-cut pinion's root fillet at no backlash — D132.)
    defaults: ctx => ({ m: 2, teeth: 60, b: 10, rim: 140, shift: RING_SHIFT, helix: 0, hand: 'right', cutter: 24, ...beside(ctx, 75) }),
    place: centred,
    handles: (_, v) => { const [m, z, b, x, y, zz] = n(v, 'm', 'teeth', 'b', 'x', 'y', 'z'); return [puck([x, y, zz]), arrow('b', [x + m * z / 2, y, zz + b], Z)]; },
    build: (ctx, v) => {
      const [m, z, b, rim, x, y, zz, shift, helix, cutter] = n(v, 'm', 'teeth', 'b', 'rim', 'x', 'y', 'z', 'shift', 'helix', 'cutter');
      const shaped = !helix && cutter > 0;
      return withNode(ctx.doc, { kind: 'internal-gear', module: m, teeth: Math.round(z), faceWidth: b, rim, ...(shift ? { profileShift: shift } : {}), ...(helix ? { helixAngle: helix, hand: v.hand === 'left' ? 'left' as const : 'right' as const } : {}), center: [x, y], ...(zz ? { from: zz } : {}), generator: shaped ? 'internal-gear@1' : 'internal-gear@0', ...(shaped ? { cutter: { teeth: Math.round(cutter) } } : {}), ...(shift === RING_SHIFT ? { shiftDefault: true } : {}) });
    },
  },
  {
    id: 'bevel-gear', label: 'Bevel gear', icon: 'cad-gear', hint: 'A straight or spiral bevel gear by module (at the heel), teeth, its mate\'s teeth, shaft angle and face width: the exact spherical involute, standard proportions (the cones through the apex), spherical ends (20°). A spiral one (a spiral angle above 0) is the ideal conjugate — line contact, not a face-milled or face-hobbed tooth: an ideal model. Its root is schematic. Not validated for manufacturing. Select it and add a Meshing gear for its mate', group: 'create', keywords: 'bevel gear conical miter mitre right angle crown pinion spherical involute spiral',
    available: () => ok,
    fields: () => [{ key: 'm', label: 'Module (heel)', kind: 'mm', min: 0.2 }, { key: 'teeth', label: 'Teeth', kind: 'count', min: 5, max: 200 }, { key: 'mate', label: 'Mate\'s teeth', kind: 'count', min: 5, max: 200 }, { key: 'sigma', label: 'Shaft angle Σ', kind: 'deg', min: 1, max: 179 },
      { key: 'b', label: 'Face width', kind: 'mm', min: 0.5 }, { key: 'bore', label: 'Bore', kind: 'mm', min: 0 },
      // (R12b.4, D135: a spiral one, the ideal conjugate; its cutter radius the shop's — 0 takes the mean cone distance, an estimate.)
      { key: 'spiral', label: 'Spiral angle β (0 straight; above 0: an ideal model)', kind: 'deg', min: 0, max: 45 }, { key: 'hand', label: 'Hand', kind: 'choice', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }], when: v => Number(v.spiral) > 0 },
      { key: 'rc', label: 'Cutter radius (0: the mean cone distance, an estimate)', kind: 'mm', min: 0, when: v => Number(v.spiral) > 0 }, ...at],
    defaults: ctx => ({ m: 2, teeth: 20, mate: 40, sigma: 90, b: 10, bore: 8, spiral: 0, hand: 'left', rc: 0, ...beside(ctx, 30) }),
    place: centred,
    handles: (_, v) => { const [m, z, x, y, zz] = n(v, 'm', 'teeth', 'x', 'y', 'z'); return [puck([x, y, zz]), arrow('b', [x + m * z / 2, y, zz], X)]; },
    build: (ctx, v) => {
      const [m, z, zm, sigma, b, bore, x, y, zz, beta, rc] = n(v, 'm', 'teeth', 'mate', 'sigma', 'b', 'bore', 'x', 'y', 'z', 'spiral', 'rc');
      // (Standing on At Z: its apex below by the toe's lowest point, Ri cos(δ + θa), the teeth above it.)
      const spec = { moduleMM: m, teeth: Math.round(z), mateTeeth: Math.round(zm), shaftAngleDeg: sigma, faceWidthMM: b }, g = bevelGearDimensions(spec), low = g.Ri * Math.cos(g.tipPolar);
      // (A spiral one's cutter radius left 0: the mean cone distance, said to be an estimate.)
      const spiral = beta > 0 ? { angle: beta, hand: v.hand === 'right' ? 'right' as const : 'left' as const, cutterRadius: rc > 0 ? rc : +((g.Re + g.Ri) / 2).toFixed(3), ...(rc > 0 ? {} : { cutterEstimate: true }) } : undefined;
      return withNode(ctx.doc, { kind: 'bevel-gear', module: m, teeth: Math.round(z), mateTeeth: Math.round(zm), ...(sigma !== 90 ? { shaftAngle: sigma } : {}), faceWidth: b, ...(bore > 0 ? { bore } : {}), center: [x, y], from: zz - low, generator: 'bevel-gear@0', ...(spiral ? { spiral } : {}) });
    },
  },
  {
    id: 'worm-pair', label: 'Worm gear pair', icon: 'cad-gear', hint: 'A cylindrical worm (ZI involute helicoid or ZA straight axial sides) and its wheel — a helical gear at the worm\'s lead angle and hand, or a throated wheel enveloping a ZA worm (cut by a hob of its thread) — crossed at 90° by the axial module, starts, the worm\'s reference diameter and the wheel\'s teeth (α_n 20°). The worm meshes with the wheel and follows it as the wheel is edited. Not validated for manufacturing', group: 'create', keywords: 'worm wheel gear pair reducer screw crossed right angle ratio ZI ZA',
    available: () => ok,
    fields: () => [{ key: 'm', label: 'Axial module', kind: 'mm', min: 0.2 }, { key: 'starts', label: 'Starts', kind: 'count', min: 1, max: 4 }, { key: 'd1', label: 'Worm reference Ø', kind: 'mm', min: 1 },
      { key: 'hand', label: 'Hand', kind: 'choice', options: [{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }] },
      // (R12b.6, D137: the wheel cylindrical — a helical gear — or throated, enveloping its worm, which is then ZA.)
      { key: 'wheel', label: 'Wheel', kind: 'choice', options: [{ value: 'cylindrical', label: 'Cylindrical (helical gear)' }, { value: 'throated', label: 'Throated (enveloping; ZA worm)' }] },
      { key: 'form', label: 'Worm form', kind: 'choice', options: [{ value: 'ZI', label: 'ZI (involute helicoid)' }, { value: 'ZA', label: 'ZA (straight axial sides)' }], when: v => v.wheel !== 'throated' },
      { key: 'z2', label: 'Wheel teeth', kind: 'count', min: 10, max: 200 }, { key: 'b', label: 'Wheel face width', kind: 'mm', min: 0.5 }, { key: 'bore', label: 'Wheel bore', kind: 'mm', min: 0 }, { key: 'wbore', label: 'Worm bore', kind: 'mm', min: 0 }, ...at],
    defaults: ctx => ({ m: 3, starts: 2, d1: 44, hand: 'right', wheel: 'cylindrical', form: 'ZI', z2: 30, b: 20, bore: 20, wbore: 12, ...beside(ctx, 60) }),
    // (Not placed at the pointer: placed commands fill the top bar's shapes strip, which is full at 1440 px — one more
    // pushes the page sideways. It sits in the side toolbar, which scrolls; its position by its fields.)
    handles: (_, v) => { const [m, z2, x, y, zz] = n(v, 'm', 'z2', 'x', 'y', 'z'); return [puck([x, y, zz]), arrow('b', [x + m * z2 / 2, y, zz], X)]; },
    build: (ctx, v) => {
      const [m, z1, d1, z2, b, bore, wbore, x, y, zz] = n(v, 'm', 'starts', 'd1', 'z2', 'b', 'bore', 'wbore', 'x', 'y', 'z'), hand = v.hand === 'left' ? 'left' as const : 'right' as const, throated = v.wheel === 'throated', form = throated || v.form === 'ZA' ? 'ZA' as const : 'ZI' as const;
      // (The wheel: a helical gear at β = γ of the worm's hand, its normal module m_x cos γ. The worm long enough for the
      // mesh zone — where the wheel's tips reach its thread — and an axial pitch on either side.)
      const worm = { axialModuleMM: m, starts: Math.round(z1), diameterMM: d1, hand, lengthMM: 1, form }, g = wormDimensions(worm), wh = wormWheelSpec(worm, { teeth: Math.round(z2), faceWidthMM: b });
      const zone = checkWormPair(worm, wh, { mode: 'verdict', samples: 16 }).meshZoneHalfLengthMM, L = Math.ceil(2 * zone + 2 * Math.PI * m);
      // (The wheel's root schematic, spur-gear@0: a worm wheel is hobbed by a hob of the worm's own form, not cut by the
      // basic rack — whose generated root, at m_n, puts its fillet where an axial-module worm's crest reaches: a ZA worm
      // cuts it at no backlash, D136.)
      const wheel = throated ? withNode(ctx.doc, { kind: 'worm-wheel', module: m, starts: Math.round(z1), diameter: d1, hand, teeth: Math.round(z2), faceWidth: b, ...(bore > 0 ? { bore } : {}), center: [x, y], ...(zz ? { from: zz } : {}), generator: 'worm-wheel@0' })
        : withNode(ctx.doc, { kind: 'gear', module: g.mn, helixAngle: g.gamma * 180 / Math.PI, hand, teeth: Math.round(z2), faceWidth: b, ...(bore > 0 ? { bore } : {}), center: [x, y], ...(zz ? { from: zz } : {}), generator: 'spur-gear@0' });
      return withNode(wheel, { kind: 'worm', starts: Math.round(z1), form, length: L, ...(wbore > 0 ? { bore: wbore } : {}), mesh: { gear: wheel.nodes.length - 1 }, generator: 'worm@0' });
    },
  },
  {
    id: 'spring', label: 'Spring', icon: 'cad-spring', hint: 'A coil spring of round wire — the wire\'s exact circle swept along the coil, fitted within 1e-4 of its diameter: compression (open, closed, or closed and ground ends), extension (close-wound, machine-loop or crossover hooks) or torsion (close-wound, tangent legs). Its rate from G (E for torsion; steel\'s prefilled, an estimate), its lengths and the stress at a working load in its notes. Not validated for manufacturing', group: 'create', keywords: 'spring coil compression extension tension torsion helix helical wire hook loop leg ground closed rate stiffness plunger',
    available: () => ok,
    fields: () => [{ key: 'type', label: 'Type', kind: 'choice', options: [{ value: 'compression', label: 'Compression' }, { value: 'extension', label: 'Extension' }, { value: 'torsion', label: 'Torsion' }] },
      { key: 'd', label: 'Wire Ø', kind: 'mm', min: 0.1 }, { key: 'D', label: 'Mean coil Ø', kind: 'mm', min: 0.5 }, { key: 'n', label: 'Active coils', kind: 'number', min: 0.5, step: 0.25 },
      { key: 'p', label: 'Pitch', kind: 'mm', min: 0.1, when: v => v.type === 'compression' }, { key: 'pw', label: 'Pitch (0: close-wound)', kind: 'mm', min: 0, when: v => v.type !== 'compression' },
      { key: 'ends', label: 'Ends', kind: 'choice', options: [{ value: 'closed-ground', label: 'Closed and ground' }, { value: 'closed', label: 'Closed' }, { value: 'open', label: 'Open' }], when: v => v.type === 'compression' },
      { key: 'hooks', label: 'Hooks', kind: 'choice', options: [{ value: 'machine-loop', label: 'Machine loops' }, { value: 'crossover', label: 'Crossover' }], when: v => v.type === 'extension' },
      { key: 'Fi', label: 'Initial tension (N, yours)', kind: 'number', min: 0, when: v => v.type === 'extension' },
      { key: 'L0', label: 'Start leg', kind: 'mm', min: 0.1, when: v => v.type === 'torsion' }, { key: 'L1', label: 'End leg', kind: 'mm', min: 0.1, when: v => v.type === 'torsion' },
      { key: 'hand', label: 'Hand', kind: 'choice', options: [{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }] },
      { key: 'G', label: 'Shear modulus G (MPa)', kind: 'number', min: 0, when: v => v.type !== 'torsion' }, { key: 'E', label: 'Young\'s modulus E (MPa)', kind: 'number', min: 0, when: v => v.type === 'torsion' },
      { key: 'F', label: 'Working load (N)', kind: 'number', min: 0, when: v => v.type !== 'torsion' }, { key: 'M', label: 'Working moment (N·mm)', kind: 'number', min: 0, when: v => v.type === 'torsion' }, ...at],
    defaults: ctx => ({ type: 'compression', d: 2, D: 20, n: 6, p: 5, pw: 0, ends: 'closed-ground', hooks: 'machine-loop', Fi: 0, L0: 20, L1: 20, hand: 'right', G: STEEL_G_ESTIMATE_MPA, E: STEEL_E_ESTIMATE_MPA, F: 0, M: 0, ...beside(ctx, 20) }),
    handles: (_, v) => { const [D, x, y, zz] = n(v, 'D', 'x', 'y', 'z'); return [puck([x, y, zz]), arrow('D', [x + D / 2, y, zz], X, { scale: 2 })]; },
    build: (ctx, v) => {
      const [d, D, na, p, pw, Fi, L0, L1, G, E, F, M, x, y, zz] = n(v, 'd', 'D', 'n', 'p', 'pw', 'Fi', 'L0', 'L1', 'G', 'E', 'F', 'M', 'x', 'y', 'z'), hand = v.hand === 'left' ? 'left' as const : 'right' as const, place = { center: [x, y] as [number, number], ...(zz ? { from: zz } : {}), generator: 'spring@0' as const };
      // (G and E prefilled with steel's are flagged estimates, the owner's decision for R12c; a value typed in is the user's.)
      const g = G > 0 ? { shearModulus: G, ...(G === STEEL_G_ESTIMATE_MPA ? { shearModulusEstimate: true } : {}) } : {};
      if (v.type === 'torsion') return withNode(ctx.doc, { kind: 'spring', type: 'torsion', wire: d, diameter: D, activeCoils: na, ...(pw > 0 ? { pitch: pw } : {}), hand, legLengths: [L0, L1], ...(E > 0 ? { youngsModulus: E, ...(E === STEEL_E_ESTIMATE_MPA ? { youngsModulusEstimate: true } : {}) } : {}), ...(M > 0 ? { moment: M } : {}), ...place });
      if (v.type === 'extension') return withNode(ctx.doc, { kind: 'spring', type: 'extension', wire: d, diameter: D, activeCoils: na, ...(pw > 0 ? { pitch: pw } : {}), hand, hooks: v.hooks === 'crossover' ? 'crossover' : 'machine-loop', ...(Fi > 0 ? { initialTension: Fi } : {}), ...g, ...(F > 0 ? { load: F } : {}), ...place });
      const ends = v.ends === 'open' || v.ends === 'closed' ? v.ends : 'closed-ground' as const;
      return withNode(ctx.doc, { kind: 'spring', wire: d, diameter: D, activeCoils: na, pitch: p, hand, ends, ...g, ...(F > 0 ? { load: F } : {}), ...place });
    },
  },
  {
    id: 'gear-mesh', label: 'Meshing gear', icon: 'cad-gear', hint: 'A spur gear meshing with the selected one: beside it at the centre distance, turned to mesh, following its turn — or, with an internal gear selected, a pinion inside it; with a bevel gear selected, its mate (the same apex, the shaft angle toward the direction)', group: 'create', keywords: 'gear mesh mate pair wheel pinion train ratio planet internal ring bevel',
    available: ctx => pickedGearNode(ctx) !== null ? ok : { ok: false as const, reason: 'Select one spur, internal or bevel gear to mesh with.' },
    // (A bevel gear's mate: its teeth are the selected gear's mate's — the direction and bore only.)
    fields: ctx => bevelPicked(ctx) ? [{ key: 'dir', label: 'Direction', kind: 'deg' }, { key: 'bore', label: 'Bore', kind: 'mm', min: 0 }] : [{ key: 'teeth', label: 'Teeth', kind: 'count', min: 6, max: 200 }, { key: 'dir', label: 'Direction', kind: 'deg' }, { key: 'shift', label: 'Profile shift x', kind: 'number', min: -0.5, max: 1, step: 0.05 }, { key: 'bore', label: 'Bore', kind: 'mm', min: 0 }],
    // (Inside a ring: 2/5 of its teeth by default — 24 in 60, clear of the interference conditions.)
    defaults: (ctx): Values => { const p = pickedGearNode(ctx); if (p?.node.kind === 'bevel-gear') return { dir: 0, bore: 8 }; return { teeth: p ? p.node.kind === 'internal-gear' ? Math.max(6, Math.round(0.4 * p.node.teeth)) : Math.min(200, 2 * p.node.teeth) : 40, dir: 0, shift: 0, bore: 8 }; },
    build: (ctx, v) => {
      const bevel = bevelPicked(ctx);
      if (bevel) {
        const [dir, bore] = n(v, 'dir', 'bore'), g = bevel.node;
        return withNode(ctx.doc, { kind: 'bevel-gear', module: g.module, teeth: g.mateTeeth, mateTeeth: g.teeth, ...(g.shaftAngle !== undefined ? { shaftAngle: g.shaftAngle } : {}), faceWidth: g.faceWidth, ...(bore > 0 ? { bore } : {}), ...(g.thicknessReduction !== undefined ? { thicknessReduction: g.thicknessReduction } : {}), center: [0, 0], mesh: { gear: bevel.index, ...(dir ? { direction: dir } : {}) }, generator: 'bevel-gear@0' });
      }
      const ring = pickedGearNode(ctx);
      if (ring && ring.node.kind === 'internal-gear') {
        const [z, dir, bore, shift] = n(v, 'teeth', 'dir', 'bore', 'shift');
        return withNode(ctx.doc, { kind: 'gear', module: ring.node.module, teeth: Math.round(z), faceWidth: ring.node.faceWidth, ...(shift ? { profileShift: shift } : {}), ...(bore > 0 ? { bore } : {}), ...(ring.node.thicknessReduction !== undefined ? { thicknessReduction: ring.node.thicknessReduction } : {}), center: [0, 0], mesh: { gear: ring.index, ...(dir ? { direction: dir } : {}) }, generator: 'spur-gear@1' });
      }
      const g = gearPicked(ctx); if (!g) throw new Error('Select one spur gear or internal gear to mesh with.');
      const [z, dir, bore, shift] = n(v, 'teeth', 'dir', 'bore', 'shift');
      return withNode(ctx.doc, { kind: 'gear', module: g.node.module, teeth: Math.round(z), faceWidth: g.node.faceWidth, ...(shift ? { profileShift: shift } : {}), ...(bore > 0 ? { bore } : {}), ...(g.node.thicknessReduction !== undefined ? { thicknessReduction: g.node.thicknessReduction } : {}), center: [0, 0], mesh: { gear: g.index, ...(dir ? { direction: dir } : {}) }, generator: 'spur-gear@1' });
    },
  },
  {
    id: 'gear-rack', label: 'Gear rack', icon: 'cad-rack', hint: 'A rack (teeth on a bar): meshing with the selected gear — helical too, its teeth inclined, the opposite hand — under it and travelling with its turn; or on its own (straight). Its root has the basic rack\'s fillet (0.38 m)', group: 'create', keywords: 'rack gear linear pinion straight teeth bar slide',
    available: () => ok,
    // (Meshing with a selected gear: its module and face width; where it stands, from the gear.)
    fields: ctx => gearPicked(ctx) ? [{ key: 'teeth', label: 'Teeth', kind: 'count', min: 1, max: 500 }, { key: 'h', label: 'Height', kind: 'mm', min: 0.5 }, { key: 'dir', label: 'Direction', kind: 'deg' }]
      : [{ key: 'm', label: 'Module', kind: 'mm', min: 0.2 }, { key: 'teeth', label: 'Teeth', kind: 'count', min: 1, max: 500 }, { key: 'b', label: 'Face width', kind: 'mm', min: 0.5 }, { key: 'h', label: 'Height', kind: 'mm', min: 0.5 }, ...at],
    defaults: (ctx): Values => { const g = gearPicked(ctx); return g ? { teeth: Math.max(4, Math.round(g.node.teeth * 0.8)), h: 4 * Number(g.node.module), dir: -90 } : { m: 2, teeth: 15, b: 10, h: 8, ...beside(ctx, 10) }; },
    build: (ctx, v) => {
      const g = gearPicked(ctx), [z, h] = n(v, 'teeth', 'h');
      if (g) {
        const dir = Number(v.dir);
        return withNode(ctx.doc, { kind: 'rack', module: g.node.module, teeth: Math.round(z), faceWidth: g.node.faceWidth, height: h, ...(g.node.thicknessReduction !== undefined ? { thicknessReduction: g.node.thicknessReduction } : {}), origin: [0, 0], mesh: { gear: g.index, ...(dir !== -90 ? { direction: dir } : {}) }, generator: 'spur-rack@1' });
      }
      const [m, b, x, y, zz] = n(v, 'm', 'b', 'x', 'y', 'z');
      return withNode(ctx.doc, { kind: 'rack', module: m, teeth: Math.round(z), faceWidth: b, height: h, origin: [x, y], ...(zz ? { from: zz } : {}), generator: 'spur-rack@1' });
    },
  },
  {
    id: 'subd-torus', label: 'SubD torus', icon: 'cad-subd', hint: 'A smooth ring from a quad cage (SubD): its exact limit surface, B-spline faces', group: 'create', keywords: 'subd subdivision smooth cage organic ring freeform',
    available: () => ok,
    fields: () => [{ key: 'R', label: 'Ring radius', kind: 'mm', min: 1 }, { key: 'r', label: 'Tube radius', kind: 'mm', min: 0.5 }, { key: 'nu', label: 'Quads round', kind: 'count', min: 4, max: 64 }, { key: 'nv', label: 'Quads across', kind: 'count', min: 4, max: 32 }, ...at],
    defaults: ctx => ({ R: 20, r: 6, nu: 16, nv: 8, ...beside(ctx, 30) }),
    place: centred,
    handles: (_, v) => { const [R, r, x, y, z] = n(v, 'R', 'r', 'x', 'y', 'z'); return [puck([x, y, z]), arrow('R', [x + R + r, y, z + r], X, { min: 1 }), arrow('r', [x + R, y, z + 2 * r], Z, { scale: 0.5 })]; },
    build: (ctx, v) => {
      const [R, r] = n(v, 'R', 'r');
      if (!(r < R)) throw new Error('The tube radius must be smaller than the ring radius.');
      return withNode(ctx.doc, { kind: 'subd', name: 'torus', cage: torusCage(R, r, Math.round(Number(v.nu)), Math.round(Number(v.nv)), n(v, 'x', 'y', 'z') as [number, number, number]) });
    },
  },
  {
    id: 'subd-tube', label: 'SubD tube', icon: 'cad-subd', hint: 'A smooth thick-walled tube open at both ends from a quad cage (SubD): exact B-spline faces; insert holding loops to tighten its rims, extrude a lug from its wall', group: 'create', keywords: 'subd subdivision smooth cage organic tube pipe sleeve clamp collar ring freeform',
    available: () => ok,
    fields: () => [{ key: 'r', label: 'Outer radius', kind: 'mm', min: 1 }, { key: 'ri', label: 'Inner radius', kind: 'mm', min: 0.5 }, { key: 'h', label: 'Length', kind: 'mm', min: 1 }, { key: 'nu', label: 'Quads round', kind: 'count', min: 6, max: 64 }, { key: 'nh', label: 'Quads along', kind: 'count', min: 1, max: 24 }, ...at],
    defaults: ctx => ({ r: 20, ri: 17, h: 40, nu: 24, nh: 7, ...beside(ctx, 22) }),
    place: centred,
    handles: (_, v) => { const [r, ri, h, x, y, z] = n(v, 'r', 'ri', 'h', 'x', 'y', 'z'); return [puck([x, y, z]), arrow('r', [x + r, y, z + h / 2], X, { min: 1 }), arrow('ri', [x - ri, y, z + h], [-1, 0, 0], { min: 0.5 }), arrow('h', [x + (r + ri) / 2, y, z + h], Z, { min: 1 })]; },
    build: (ctx, v) => {
      const [r, ri, h] = n(v, 'r', 'ri', 'h');
      if (!(ri < r)) throw new Error('The inner radius must be smaller than the outer one.');
      return withNode(ctx.doc, { kind: 'subd', name: 'tube', cage: tubeCage(r, ri, h, Math.round(Number(v.nu)), Math.round(Number(v.nh)), n(v, 'x', 'y', 'z') as [number, number, number]) });
    },
  },
  {
    id: 'subd-box', label: 'SubD box', icon: 'cad-subd', hint: 'A smooth block from a box cage (SubD): exact B-spline faces, G1 caps at its eight corners (extraordinary vertices)', group: 'create', keywords: 'subd subdivision smooth cage organic box block rounded freeform pebble',
    available: () => ok,
    fields: () => [{ key: 'w', label: 'Width X', kind: 'mm', min: 1 }, { key: 'd', label: 'Depth Y', kind: 'mm', min: 1 }, { key: 'h', label: 'Height Z', kind: 'mm', min: 1 }, { key: 'n', label: 'Quads along a side', kind: 'count', min: 1, max: 12 }, ...at],
    defaults: ctx => ({ w: 30, d: 20, h: 16, n: 3, ...beside(ctx, 15) }),
    place: centred,
    handles: (_, v) => { const [w, d, h, x, y, z] = n(v, 'w', 'd', 'h', 'x', 'y', 'z'); return [puck([x, y, z]), arrow('w', [x + w / 2, y, z + h / 2], X, { min: 1 }), arrow('d', [x, y + d / 2, z + h / 2], Y, { min: 1 }), arrow('h', [x, y, z + h], Z, { min: 1 })]; },
    build: (ctx, v) => {
      const [w, d, h] = n(v, 'w', 'd', 'h');
      return withNode(ctx.doc, { kind: 'subd', name: 'box', cage: boxCage(w, d, h, Math.round(Number(v.n)), n(v, 'x', 'y', 'z') as [number, number, number]) });
    },
  },
  {
    id: 'tube', label: 'Tube', icon: 'cad-tube', hint: 'A hollow round bar: outer and inner radius, length', group: 'create', keywords: 'pipe hollow sleeve bush spacer ring',
    available: () => ok,
    fields: () => [{ key: 'r', label: 'Outer radius', kind: 'mm', min: 1 }, { key: 'ri', label: 'Inner radius', kind: 'mm', min: 0.1 }, { key: 'h', label: 'Length', kind: 'mm', min: 0.5 }, ...at],
    defaults: ctx => ({ r: 10, ri: 6, h: 24, ...beside(ctx, 14) }),
    place: centred,
    handles: (_, v) => { const [r, ri, h, x, y, z] = n(v, 'r', 'ri', 'h', 'x', 'y', 'z'); return [puck([x, y, z]), arrow('r', [x + r, y, z + h / 2], X, { min: 1 }), arrow('ri', [x - ri, y, z + h], [-1, 0, 0], { min: 0.1 }), arrow('h', [x + (r + ri) / 2, y, z + h], Z)]; },
    build: (ctx, v) => {
      const r = Number(v.r), ri = Number(v.ri), x = Number(v.x), y = Number(v.y), z = Number(v.z);
      if (!(ri < r)) throw new Error('The inner radius must be smaller than the outer one.');
      const d = withNode(ctx.doc, { kind: 'sketch', profile: 'circle', center: [x, y], radius: r, holes: [circleLoop(x, y, ri)] });
      return withNode(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: Number(v.h), ...(z ? { from: z } : {}) });
    },
  },
  {
    id: 'wedge', label: 'Wedge', icon: 'cad-wedge', hint: 'A ramp: width, depth and height, sloping down along X', group: 'create', keywords: 'ramp slope triangle prism chock',
    available: () => ok,
    fields: () => [{ key: 'w', label: 'Width X', kind: 'mm', min: 1 }, { key: 'd', label: 'Depth Y', kind: 'mm', min: 1 }, { key: 'h', label: 'Height Z', kind: 'mm', min: 1 },
      { key: 'x', label: 'At X', kind: 'mm' }, { key: 'y', label: 'At Y', kind: 'mm' }, { key: 'z', label: 'At Z', kind: 'mm' }],
    defaults: ctx => ({ w: 32, d: 16, h: 16, ...beside(ctx, 16), y: 0 }),
    // Its middle at the pointer.
    place: (v, [x, y, z]) => ({ ...v, x: r1(x - Number(v.w) / 2), y: r1(y - Number(v.d) / 2), z }),
    handles: (_, v) => { const [w, d, h, x, y, z] = n(v, 'w', 'd', 'h', 'x', 'y', 'z'); return [puck([x + w / 2, y + d / 2, z]), arrow('w', [x + w, y + d / 2, z], X, { min: 1 }), arrow('d', [x + w / 4, y + d, z + h / 4], Y, { min: 1 }), arrow('h', [x, y + d / 2, z + h], Z, { min: 1 })]; },
    // The triangle on the plane at the far side (Y + depth), pulled towards −Y through the depth.
    build: (ctx, v) => {
      const w = Number(v.w), dpt = Number(v.d), h = Number(v.h), plane = { ...upright(v), origin: [Number(v.x), Number(v.y) + dpt, Number(v.z)] as [number, number, number] };
      const d = withNode(ctx.doc, { kind: 'sketch', profile: 'polygon', points: [[0, 0], [w, 0], [0, h]], plane });
      return withNode(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: dpt });
    },
  },
  {
    id: 'prism', label: 'Polygon prism', icon: 'cad-prism', hint: 'A regular prism (hexagon by default): sides, size across the flats, height', group: 'create', keywords: 'hexagon hex nut bolt head octagon polygon',
    available: () => ok,
    fields: () => [{ key: 'n', label: 'Sides', kind: 'count', min: 3, max: 12 }, { key: 's', label: 'Across flats', kind: 'mm', min: 1 }, { key: 'h', label: 'Height', kind: 'mm', min: 0.5 }, ...at],
    defaults: ctx => ({ n: 6, s: 16, h: 10, ...beside(ctx, 14) }),
    place: centred,
    handles: (_, v) => { const [s, h, x, y, z] = n(v, 's', 'h', 'x', 'y', 'z'); return [puck([x, y, z]), arrow('s', [x, y + s / 2, z + h / 2], Y, { scale: 2, min: 1 }), arrow('h', [x, y, z + h], Z)]; },
    build: (ctx, v) => {
      const n = Math.round(Number(v.n)), s = Number(v.s), x = Number(v.x), y = Number(v.y), z = Number(v.z), R = s / 2 / Math.cos(Math.PI / n);
      // A flat at the bottom: corners at half a step either side of −Y.
      const points = Array.from({ length: n }, (_, k) => { const a = -Math.PI / 2 + Math.PI / n + 2 * Math.PI * k / n; return [Math.round((x + R * Math.cos(a)) * 1e6) / 1e6, Math.round((y + R * Math.sin(a)) * 1e6) / 1e6] as [number, number]; });
      const d = withNode(ctx.doc, n <= 8 ? { kind: 'sketch', profile: 'polygon', points } : { kind: 'sketch', profile: 'loop', segments: points.map(p => ({ kind: 'line' as const, start: p })) });
      return withNode(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: Number(v.h), ...(z ? { from: z } : {}) });
    },
  },
];
