import type { MoveKind, StockSolid } from '@barocss/cad-model/machining/camPackage';
import type { CamDisplay } from './camDisplay';
import { camSetupToWorld } from './camHeightfield';
import { camToolGeometry } from './camToolGeometry';
import { overlayCount, type OverlayDrawing } from './overlayDrawing';

// G23 CNC (G-R3): the preview's drawings in world coordinates, for both renderers' overlay passes. The stock is wired
// where the Model put it; the paths, the remaining stock and the tool are in the setup's machine frame and turned back
// with its inverse (a signed axis permutation, so exact). Identities stay stable while their inputs do, so a backend
// re-uploads only what changed: the paths with the setup, the remaining stock with each removal, the tool with each pose.

export type CamDrawing = OverlayDrawing;
const COLORS: Record<MoveKind, [number, number, number]> = { rapid: [0.45, 0.62, 0.95], feed: [0.2, 0.87, 0.52], plunge: [0.95, 0.3, 0.22], ramp: [0.93, 0.7, 0.2], retract: [0.7, 0.45, 0.9] };
const ORDER: readonly MoveKind[] = ['rapid', 'feed', 'plunge', 'ramp', 'retract'];
const point = (p: readonly number[]) => p.length === 3 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]);

/** Points (machine frame, plus an offset there) to world: `m` is machine → world, column-major. */
export function camToWorld(src: ArrayLike<number>, m: ArrayLike<number>, ox = 0, oy = 0, oz = 0): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i] + ox, y = src[i + 1] + oy, z = src[i + 2] + oz;
    out[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  return out;
}
/** Directions (normals) to world: the rotation only. */
function directionsToWorld(src: ArrayLike<number>, m: ArrayLike<number>): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i], y = src[i + 1], z = src[i + 2];
    out[i] = m[0] * x + m[4] * y + m[8] * z; out[i + 1] = m[1] * x + m[5] * y + m[9] * z; out[i + 2] = m[2] * x + m[6] * y + m[10] * z;
  }
  return out;
}

/** The Model's stock as a wire in world coordinates; never the target's bounds in place of a refusal. */
export function camStockWire(stock: StockSolid): Float32Array {
  const p: number[] = [];
  if (stock.kind === 'box') {
    if (!point(stock.min) || !point(stock.max) || stock.min.some((v, k) => v >= stock.max[k])) throw new Error('CAM display: invalid box stock');
    for (let i = 0; i < 8; i++) for (let k = 0; k < 3; k++) {
      if (i & (1 << k)) continue;
      const j = i | (1 << k);
      p.push(i & 1 ? stock.max[0] : stock.min[0], i & 2 ? stock.max[1] : stock.min[1], i & 4 ? stock.max[2] : stock.min[2]);
      p.push(j & 1 ? stock.max[0] : stock.min[0], j & 2 ? stock.max[1] : stock.min[1], j & 4 ? stock.max[2] : stock.min[2]);
    }
    return Float32Array.from(p);
  }
  if (!point(stock.start) || !point(stock.axis) || Math.abs(Math.hypot(...stock.axis) - 1) > 1e-8 || !Number.isFinite(stock.length) || !Number.isFinite(stock.diameter) || stock.length <= 0 || stock.diameter <= 0) throw new Error('CAM display: invalid cylinder stock');
  const a = stock.axis, s = stock.start, r = stock.diameter / 2;
  // (Two directions across the axis.)
  const helper = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let ux = a[1] * helper[2] - a[2] * helper[1], uy = a[2] * helper[0] - a[0] * helper[2], uz = a[0] * helper[1] - a[1] * helper[0];
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = a[1] * uz - a[2] * uy, vy = a[2] * ux - a[0] * uz, vz = a[0] * uy - a[1] * ux;
  for (let i = 0; i < 64; i++) {
    const c0 = Math.cos(i * Math.PI / 32), s0 = Math.sin(i * Math.PI / 32), c1 = Math.cos((i + 1) * Math.PI / 32), s1 = Math.sin((i + 1) * Math.PI / 32);
    for (const t of [0, stock.length]) {
      p.push(s[0] + a[0] * t + r * (ux * c0 + vx * s0), s[1] + a[1] * t + r * (uy * c0 + vy * s0), s[2] + a[2] * t + r * (uz * c0 + vz * s0));
      p.push(s[0] + a[0] * t + r * (ux * c1 + vx * s1), s[1] + a[1] * t + r * (uy * c1 + vy * s1), s[2] + a[2] * t + r * (uz * c1 + vz * s1));
    }
    if (i % 16 === 0) {
      p.push(s[0] + r * (ux * c0 + vx * s0), s[1] + r * (uy * c0 + vy * s0), s[2] + r * (uz * c0 + vz * s0));
      p.push(s[0] + a[0] * stock.length + r * (ux * c0 + vx * s0), s[1] + a[1] * stock.length + r * (uy * c0 + vy * s0), s[2] + a[2] * stock.length + r * (uz * c0 + vz * s0));
    }
  }
  return Float32Array.from(p);
}

/** The setup's moves by kind as world segments: whole (`upTo` Infinity) or the prefix up to `upTo`. */
function paths(display: CamDisplay, world: Float64Array, upTo: number): CamDrawing[] {
  const groups = new Map<MoveKind, number[]>(), moves = display.setup.moves, prefix = upTo !== Infinity;
  for (let i = 0; i < moves.length && i < upTo; i++) {
    const move = moves[i], fraction = Math.min(1, upTo - i), list = groups.get(move.kind) ?? [];
    groups.set(move.kind, list);
    list.push(move.a[0], move.a[1], move.a[2], move.a[0] + fraction * (move.b[0] - move.a[0]), move.a[1] + fraction * (move.b[1] - move.a[1]), move.a[2] + fraction * (move.b[2] - move.a[2]));
  }
  const out: CamDrawing[] = [];
  for (const kind of ORDER) {
    const list = groups.get(kind);
    if (list) out.push({ name: (prefix ? 'done:' : 'path:') + kind, positions: camToWorld(list, world), topology: 'lines', color: COLORS[kind], opacity: prefix ? 0.95 : 0.3, width: prefix ? 2 : 1.1 });
  }
  return out;
}

/** Keeps each drawing's identity while its inputs are unchanged; `update(null)` forgets everything. */
export class CamOverlayGeometry {
  private key = '';
  private fixed: CamDrawing[] = [];
  private world: Float64Array = new Float64Array(16);
  private removalSource?: object;
  private remaining?: CamDrawing;
  private progress = NaN;
  private done: CamDrawing[] = [];
  private activeIndex = -1;
  private active?: CamDrawing;
  private toolKey = '';
  private toolLocal: ReturnType<typeof camToolGeometry> | null = null;
  private pose = '';
  private tool: CamDrawing[] = [];

  update(display: CamDisplay | null): CamDrawing[] {
    if (!display) {
      this.key = ''; this.fixed = []; this.removalSource = undefined; this.remaining = undefined; this.progress = NaN; this.done = [];
      this.activeIndex = -1; this.active = undefined; this.toolKey = ''; this.toolLocal = null; this.pose = ''; this.tool = [];
      return [];
    }
    if ('refused' in display.package.stock) throw new Error('CAM stock: ' + display.package.stock.refused.code + ' · ' + display.package.stock.refused.message);
    const moves = display.setup.moves;
    if (!moves.length || !Number.isFinite(display.progress) || display.progress < 0 || display.progress > moves.length || !point(display.position)
      || moves.some(move => !(move.kind in COLORS) || !point(move.a) || !point(move.b))) throw new Error('CAM display: invalid or empty ordered program');
    const key = display.packageKey + ':' + display.setupIndex;
    if (this.key !== key) {
      const world = camSetupToWorld(display.setup.frame);
      this.fixed = [{ name: 'stock', positions: camStockWire(display.package.stock), topology: 'lines', color: [0.67, 0.76, 0.87], opacity: 0.8, width: 1.2 }, ...paths(display, world, Infinity)];
      // (The machine axes at the setup's origin, x red, y green, z blue: the tool's axis.)
      const length = Math.max(5, display.package.tool.diameterMM * 2);
      for (let k = 0; k < 3; k++) {
        const axis = [0, 0, 0, 0, 0, 0]; axis[3 + k] = length;
        this.fixed.push({ name: 'axis:' + 'xyz'[k], positions: camToWorld(axis, world), topology: 'lines', color: k === 0 ? [0.95, 0.25, 0.25] : k === 1 ? [0.25, 0.9, 0.35] : [0.3, 0.55, 1], opacity: 1, width: 2 });
      }
      this.world = world; this.key = key; this.removalSource = undefined; this.progress = NaN; this.activeIndex = -1; this.pose = '';
    }
    if (this.removalSource !== display.removal.geometry) {
      const g = display.removal.geometry;
      this.remaining = { name: 'remaining', positions: camToWorld(g.positions, this.world), normals: g.normals && directionsToWorld(g.normals, this.world), indices: g.indices, topology: 'triangles', color: [0.94, 0.57, 0.12], opacity: 0.58, lit: true };
      this.removalSource = g;
    }
    if (this.progress !== display.progress) { this.done = paths(display, this.world, display.progress); this.progress = display.progress; }
    const index = Math.min(Math.floor(display.progress), moves.length - 1);
    if (this.activeIndex !== index) {
      const move = moves[index];
      this.active = { name: 'active:' + move.kind, positions: camToWorld([...move.a, ...move.b], this.world), topology: 'lines', color: [1, 0.95, 0.68], opacity: 1, width: 3 };
      this.activeIndex = index;
    }
    const t = display.package.tool, toolKey = `${t.kind}|${t.diameterMM}|${t.cornerMM}|${t.fluteMM}|${t.shankMM}`;
    if (this.toolKey !== toolKey) { this.toolLocal = camToolGeometry(t); this.toolKey = toolKey; this.pose = ''; }
    // (The tool's tip at the program's position, its axis the machine +Z: its local mesh moved there, then to world.)
    const p = display.position, pose = `${key}|${p[0]}|${p[1]}|${p[2]}`;
    if (this.pose !== pose && this.toolLocal) {
      const { flute, shank } = this.toolLocal;
      this.tool = [
        { name: 'tool:flute', positions: camToWorld(flute.positions, this.world, p[0], p[1], p[2]), normals: flute.normals && directionsToWorld(flute.normals, this.world), indices: flute.indices, topology: 'triangles', color: [0.83, 0.85, 0.9], opacity: 0.95, lit: true },
        { name: 'tool:shank', positions: camToWorld(shank.positions, this.world, p[0], p[1], p[2]), normals: shank.normals && directionsToWorld(shank.normals, this.world), indices: shank.indices, topology: 'triangles', color: [0.48, 0.56, 0.67], opacity: 0.95, lit: true },
      ];
      this.pose = pose;
    }
    const all = [...this.fixed, ...(this.remaining ? [this.remaining] : []), ...this.done, ...(this.active ? [this.active] : []), ...this.tool];
    return all.filter(d => overlayCount(d) > 0);
  }
}

/** The stock's world bounds (a bar's exact box about its axis), to frame the preview once per setup. */
export function camStockBounds(stock: StockSolid): { min: [number, number, number]; max: [number, number, number] } {
  if (stock.kind === 'box') return { min: [...stock.min], max: [...stock.max] };
  const min: [number, number, number] = [0, 0, 0], max: [number, number, number] = [0, 0, 0], r = stock.diameter / 2;
  for (let k = 0; k < 3; k++) {
    const end = stock.start[k] + stock.axis[k] * stock.length, across = r * Math.sqrt(Math.max(0, 1 - stock.axis[k] * stock.axis[k]));
    min[k] = Math.min(stock.start[k], end) - across; max[k] = Math.max(stock.start[k], end) + across;
  }
  return { min, max };
}
