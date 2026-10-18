// Primitive solids beside Box and Cylinder, each a sketch and one extrude or revolve (so they edit like any
// feature): sphere, cone (or frustum), torus, tube, wedge and regular polygon prism. They stand on Z = At Z
// at the given X, Y, to the right of what is there by default.
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
const circleLoop = (cx: number, cy: number, r: number): LoopSegment[] => [{ kind: 'arc', start: [cx + r, cy], center: [cx, cy], direction: 'ccw' }];

type V3 = [number, number, number];
const n = (v: Values, ...keys: string[]) => keys.map(k => Number(v[k]));
/** A puck at (x, y, z) that slides the shape on its plane (its X and Y values). */
export const puck = (at: V3): HandleSpec => ({ key: 'x', at, dir: [1, 0, 0], pair: { key: 'y', dir: [0, 1, 0] } });
const arrow = (key: string, at: V3, dir: V3, extra: Partial<HandleSpec> = {}): HandleSpec => ({ key, at, dir, min: 0.5, step: 0.5, ...extra });
const X: V3 = [1, 0, 0], Y: V3 = [0, 1, 0], Z: V3 = [0, 0, 1];

/** The one selected body when it is a spur gear as made (not built on further): its node and index. */
function gearPicked(ctx: Ctx): { node: Extract<ModelNode, { kind: 'gear' }>; index: number } | null {
  const picked = new Set<number>(ctx.selection.bodies); ctx.selection.faces.forEach(f => picked.add(f.body)); ctx.selection.edges.forEach(e => picked.add(e.body));
  if (picked.size !== 1) return null;
  const body = ctx.bodies[[...picked][0]], ref = body?.ref, node = ref ? ctx.doc.nodes[ref.node] : undefined;
  return node?.kind === 'gear' && ref!.side === 'solid' ? { node, index: ref!.node } : null;
}

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
    id: 'gear', label: 'Spur gear', icon: 'cad-gear', hint: 'An involute spur gear by module, teeth and face width (20°; a schematic root, not validated for manufacturing)', group: 'create', keywords: 'gear spur involute module teeth pinion wheel cog transmission',
    available: () => ok,
    fields: () => [{ key: 'm', label: 'Module', kind: 'mm', min: 0.2 }, { key: 'teeth', label: 'Teeth', kind: 'count', min: 18, max: 200 }, { key: 'b', label: 'Face width', kind: 'mm', min: 0.5 }, { key: 'bore', label: 'Bore', kind: 'mm', min: 0 }, ...at],
    defaults: ctx => ({ m: 2, teeth: 20, b: 10, bore: 8, ...beside(ctx, 30) }),
    place: centred,
    handles: (_, v) => { const [m, z, b, x, y, zz] = n(v, 'm', 'teeth', 'b', 'x', 'y', 'z'); return [puck([x, y, zz]), arrow('b', [x + m * z / 2, y, zz + b], Z)]; },
    build: (ctx, v) => {
      const [m, z, b, bore, x, y, zz] = n(v, 'm', 'teeth', 'b', 'bore', 'x', 'y', 'z');
      return withNode(ctx.doc, { kind: 'gear', module: m, teeth: Math.round(z), faceWidth: b, ...(bore > 0 ? { bore } : {}), center: [x, y], ...(zz ? { from: zz } : {}), generator: 'spur-gear@0' });
    },
  },
  {
    id: 'gear-mesh', label: 'Meshing gear', icon: 'cad-gear', hint: 'A spur gear meshing with the selected one: beside it at the centre distance, turned to mesh, following its turn', group: 'create', keywords: 'gear mesh mate pair wheel pinion train ratio',
    available: ctx => gearPicked(ctx) !== null ? ok : { ok: false as const, reason: 'Select one spur gear to mesh with.' },
    fields: () => [{ key: 'teeth', label: 'Teeth', kind: 'count', min: 18, max: 200 }, { key: 'dir', label: 'Direction', kind: 'deg' }, { key: 'bore', label: 'Bore', kind: 'mm', min: 0 }],
    defaults: ctx => { const g = gearPicked(ctx); return { teeth: g ? Math.min(200, 2 * g.node.teeth) : 40, dir: 0, bore: 8 }; },
    build: (ctx, v) => {
      const g = gearPicked(ctx); if (!g) throw new Error('Select one spur gear to mesh with.');
      const [z, dir, bore] = n(v, 'teeth', 'dir', 'bore');
      return withNode(ctx.doc, { kind: 'gear', module: g.node.module, teeth: Math.round(z), faceWidth: g.node.faceWidth, ...(bore > 0 ? { bore } : {}), ...(g.node.thicknessReduction !== undefined ? { thicknessReduction: g.node.thicknessReduction } : {}), center: [0, 0], mesh: { gear: g.index, ...(dir ? { direction: dir } : {}) }, generator: 'spur-gear@0' });
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
