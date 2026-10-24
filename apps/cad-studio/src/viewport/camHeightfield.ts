import type { SetupProgram, StockSolid, ToolShape } from '@barocss/cad-model/machining/camPackage';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { madeBodies } from '@barocss/cad-model/engine/elements';
import type { CamRemoval } from './camDisplay';

// G23 CNC (G-R3, from Codex's source 5c9f861f): the stock as a height field in one setup's machine frame, cut by the
// ordered program's cutting moves from pristine stock each time. A conservative display estimate, not a swept
// Boolean: a cell is lowered only to where the tool reaches its furthest corner, so uncertain boundary cells keep
// material. A cut the field cannot show (a buried finite flute under the surface) is refused, never faked.

type V3 = [number, number, number];
type XY = [number, number];
const EPS = 1e-8, GRID = 192, SAMPLES = 250000, CELL_VISITS = 25000000, CYLINDER_SEGMENTS = 64;
/** How far under the part's surface a cell must be cut to count as overcut: the part mesh's own error is not known here. */
export const CAM_OVERCUT_TOLERANCE_MM = 0.01;
/** A part's display mesh in world coordinates (the target the program must not enter). */
export interface CamPartMesh { positions: ArrayLike<number>; indices: ArrayLike<number> }
/** The part the program must not enter: the bodies its process makes (O160: a bought bearing or O-ring is not the part's own material). */
export function camPartMeshes(doc: StudioDoc, bodies: readonly BodyResult[]): CamPartMesh[] { return madeBodies(doc.nodes, bodies).map(b => b.mesh); }
const CUTS: ReadonlySet<string> = new Set(['feed', 'plunge', 'ramp']);
const KINDS: ReadonlySet<string> = new Set(['rapid', 'feed', 'plunge', 'ramp', 'retract']);
const refuse = (code: string, reason: string): never => { throw new Error(`[CAM_${code}] ${reason}`); };
const finite3 = (p: readonly number[]) => p.length === 3 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]);

/** Only proper signed-axis permutations are supported; no scale, skew or reflected setup frame. */
function checkFrame(f: ArrayLike<number>): void {
  if (f.length !== 16 || !Array.from(f).every(Number.isFinite) || Math.abs(f[3]) > EPS || Math.abs(f[7]) > EPS || Math.abs(f[11]) > EPS || Math.abs(f[15] - 1) > EPS) refuse('FRAME', 'Expected a finite rigid signed-axis-permutation setup frame.');
  const used = [0, 0, 0];
  for (let j = 0; j < 3; j++) {
    let ones = 0;
    for (let k = 0; k < 3; k++) {
      const v = Math.abs(f[j * 4 + k]);
      if (Math.abs(v - 1) <= EPS) { ones++; used[k]++; } else if (v > EPS) refuse('FRAME', 'Skew or non-axis-aligned setup frames are unsupported.');
    }
    if (ones !== 1) refuse('FRAME', 'Skew or non-axis-aligned setup frames are unsupported.');
  }
  if (used[0] !== 1 || used[1] !== 1 || used[2] !== 1) refuse('FRAME', 'Skew or non-axis-aligned setup frames are unsupported.');
  const det = f[0] * (f[5] * f[10] - f[9] * f[6]) - f[4] * (f[1] * f[10] - f[9] * f[2]) + f[8] * (f[1] * f[6] - f[5] * f[2]);
  if (Math.abs(det - 1) > EPS) refuse('FRAME', 'The setup frame must be a proper rotation.');
}

/** The inverse of the declared world → machine rigid frame (machine → world), for display resources only. */
export function camSetupToWorld(frame: ArrayLike<number>): Float64Array {
  checkFrame(frame);
  const m = new Float64Array(16); m[15] = 1;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[j * 4 + i] = frame[i * 4 + j];
  for (let i = 0; i < 3; i++) m[12 + i] = -(m[i] * frame[12] + m[4 + i] * frame[13] + m[8 + i] * frame[14]);
  return m;
}
function checkTool(tool: ToolShape): void {
  if (!['flat', 'ball', 'bull'].includes(tool.kind) || ![tool.diameter, tool.cornerMM, tool.fluteMM, tool.shankMM].every(Number.isFinite) || tool.diameter <= 0 || tool.fluteMM <= 0 || tool.shankMM <= 0) refuse('TOOL', 'Tool diameter, flute length and shank diameter must be finite positive distances.');
  const r = tool.diameter / 2;
  if (tool.kind === 'flat' ? tool.cornerMM !== 0 : tool.kind === 'ball' ? Math.abs(tool.cornerMM - r) > EPS : !(tool.cornerMM > 0 && tool.cornerMM <= r)) refuse('TOOL', 'The declared corner radius does not match the flat, ball or bull profile.');
  if (tool.fluteMM < tool.cornerMM) refuse('TOOL', 'The flute is shorter than the rounded nose.');
}
/** The cutting profile's height above the tip at a radius from the axis (Infinity outside the tool). */
function bottom(tool: ToolShape, radius: number): number {
  const r = tool.diameter / 2;
  if (radius < 0 || radius > r || !Number.isFinite(radius)) return Infinity;
  if (tool.kind === 'flat') return 0;
  const c = tool.cornerMM, q = Math.max(0, radius - (r - c));
  return c - Math.sqrt(Math.max(0, c * c - q * q));
}
/** The exact radial nose height above the tip; shankMM is a diameter and never a cutting length. */
export function camToolBottom(tool: ToolShape, radius: number): number { checkTool(tool); return bottom(tool, radius); }
/** A point of the frame (machine coordinates of a world point, or a direction without the translation). */
function moved(p: readonly number[], f: ArrayLike<number>, direction = false): V3 {
  const t = direction ? 0 : 1;
  return [f[0] * p[0] + f[4] * p[1] + f[8] * p[2] + t * f[12], f[1] * p[0] + f[5] * p[1] + f[9] * p[2] + t * f[13], f[2] * p[0] + f[6] * p[1] + f[10] * p[2] + t * f[14]];
}
function polygonArea(p: readonly XY[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}
/** Sutherland–Hodgman: `subject` clipped to the convex counter-clockwise `clip`; the winding is kept. */
function clipPolygon(subject: XY[], clip: readonly XY[]): XY[] {
  let polygon = subject;
  for (let i = 0; i < clip.length && polygon.length; i++) {
    const ax = clip[i][0], ay = clip[i][1], ex = clip[(i + 1) % clip.length][0] - ax, ey = clip[(i + 1) % clip.length][1] - ay, next: XY[] = [];
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j], q = polygon[(j + 1) % polygon.length];
      const dp = ex * (p[1] - ay) - ey * (p[0] - ax), dq = ex * (q[1] - ay) - ey * (q[0] - ax);
      if (dp >= 0) next.push(p);
      if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    polygon = next;
  }
  return polygon;
}

/** Flat-shaded triangles, non-indexed (each triangle its own normal). */
class MeshOut {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  tri(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, nx: number, ny: number, nz: number): void {
    this.positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  }
  quadWall(ax: number, ay: number, bx: number, by: number, z0: number, z1: number): void {
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy);
    if (!l) return;
    const nx = dy / l, ny = -dx / l;
    this.tri(ax, ay, z0, bx, by, z0, bx, by, z1, nx, ny, 0);
    this.tri(ax, ay, z0, bx, by, z1, ax, ay, z1, nx, ny, 0);
  }
}

/** One selected setup, from pristine stock each evaluation. A conservative display estimate, not a swept Boolean. */
export class CamHeightfield {
  private readonly setup: SetupProgram;
  private readonly tool: ToolShape;
  private readonly nx: number;
  private readonly ny: number;
  private readonly dx: number;
  private readonly dy: number;
  private readonly x0: number;
  private readonly y0: number;
  private readonly z0: number;
  private readonly z1: number;
  private readonly pitch: number;
  private readonly spacing: number;
  private readonly halfDiagonal: number;
  /** Per cell: whether it lies inside the stock's footprint, its centre, its area in the footprint. */
  private readonly inside: Uint8Array;
  private readonly cx: Float64Array;
  private readonly cy: Float64Array;
  private readonly area: Float64Array;
  /** Cells the cylinder's footprint cuts: their clipped polygons (whole cells are their rectangles). */
  private readonly clipped = new Map<number, XY[]>();
  /** Per cell: the part's highest surface in the column through its centre (machine Z), −Infinity with no part there. */
  private readonly partTop: Float64Array;

  constructor(stock: StockSolid, setup: SetupProgram, tool: ToolShape, cellMM = 0.5, part: readonly CamPartMesh[] = []) {
    checkFrame(setup.frame); checkTool(tool);
    if (!finite3(setup.axis) || Math.hypot(setup.axis[0] - setup.frame[2], setup.axis[1] - setup.frame[6], setup.axis[2] - setup.frame[10]) > EPS) refuse('FRAME', 'The setup axis does not match the machine +Z direction.');
    if (!Number.isFinite(cellMM) || cellMM <= 0) refuse('GRID', 'Cell pitch must be finite and positive.');
    if (!setup.moves.length) refuse('PROGRAM', 'The selected setup has no moves.');
    if (!Number.isFinite(setup.safeZ.mm)) refuse('PROGRAM', 'Safe height must be finite.');
    for (const move of setup.moves) if (!KINDS.has(move.kind) || !finite3(move.a) || !finite3(move.b)) refuse('PROGRAM', 'Every ordered move needs a supported kind and finite endpoints.');
    this.setup = { ...setup, frame: [...setup.frame], axis: [...setup.axis], moves: setup.moves.map(m => ({ ...m, a: [...m.a], b: [...m.b] })) };
    this.tool = { ...tool, basis: { ...tool.basis } };
    const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
    let circle: XY[] | null = null;
    if (stock.kind === 'box') {
      if (!finite3(stock.min) || !finite3(stock.max) || stock.min.some((v, k) => v >= stock.max[k])) refuse('STOCK', 'Box stock needs finite ascending extents.');
      for (let bits = 0; bits < 8; bits++) {
        const p = moved([bits & 1 ? stock.max[0] : stock.min[0], bits & 2 ? stock.max[1] : stock.min[1], bits & 4 ? stock.max[2] : stock.min[2]], setup.frame);
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
      }
    } else if (stock.kind === 'cylinder') {
      if (!finite3(stock.start) || !finite3(stock.axis) || Math.abs(Math.hypot(...stock.axis) - 1) > EPS || !Number.isFinite(stock.length) || stock.length <= 0 || !Number.isFinite(stock.diameter) || stock.diameter <= 0) refuse('STOCK', 'Cylinder stock needs a unit axis and finite positive length and diameter.');
      const axis = moved(stock.axis, setup.frame, true), start = moved(stock.start, setup.frame), r = stock.diameter / 2;
      if (Math.abs(axis[0]) > EPS || Math.abs(axis[1]) > EPS || Math.abs(Math.abs(axis[2]) - 1) > EPS) refuse('STOCK', 'Cylinder stock needs its axis along the machine Z (a turned setup of a bar is not supported).');
      lo[0] = start[0] - r; lo[1] = start[1] - r; lo[2] = Math.min(start[2], start[2] + stock.length * axis[2]);
      hi[0] = start[0] + r; hi[1] = start[1] + r; hi[2] = Math.max(start[2], start[2] + stock.length * axis[2]);
      // (The inscribed 64-chord footprint: a radial chord error r·(1 − cos(π/64)), apart from the grid's.)
      circle = [];
      for (let k = 0; k < CYLINDER_SEGMENTS; k++) circle.push([start[0] + r * Math.cos(k * 2 * Math.PI / CYLINDER_SEGMENTS), start[1] + r * Math.sin(k * 2 * Math.PI / CYLINDER_SEGMENTS)]);
    } else refuse('STOCK', 'Only box stock or cylinder stock along the machine Z is supported.');
    const pitch = Math.max(cellMM, (hi[0] - lo[0]) / GRID, (hi[1] - lo[1]) / GRID);
    this.nx = Math.max(1, Math.min(GRID, Math.ceil((hi[0] - lo[0]) / pitch - 1e-9))); this.ny = Math.max(1, Math.min(GRID, Math.ceil((hi[1] - lo[1]) / pitch - 1e-9)));
    this.dx = (hi[0] - lo[0]) / this.nx; this.dy = (hi[1] - lo[1]) / this.ny;
    this.x0 = lo[0]; this.y0 = lo[1]; this.z0 = lo[2]; this.z1 = hi[2];
    this.pitch = Math.max(this.dx, this.dy); this.halfDiagonal = Math.hypot(this.dx, this.dy) / 2;
    if (tool.diameter / 2 <= this.halfDiagonal) refuse('GRID', 'The tool is too small to cover one conservative cell at the effective grid pitch.');
    this.spacing = Math.min(this.pitch / 2, tool.diameter / 8, tool.fluteMM / 2);
    const n = this.nx * this.ny;
    this.inside = new Uint8Array(n); this.cx = new Float64Array(n); this.cy = new Float64Array(n); this.area = new Float64Array(n);
    for (let y = 0; y < this.ny; y++) for (let x = 0; x < this.nx; x++) {
      const at = y * this.nx + x, a = this.x0 + x * this.dx, b = this.y0 + y * this.dy;
      this.cx[at] = a + this.dx / 2; this.cy[at] = b + this.dy / 2;
      if (!circle) { this.inside[at] = 1; this.area[at] = this.dx * this.dy; continue; }
      const polygon = clipPolygon([[a, b], [a + this.dx, b], [a + this.dx, b + this.dy], [a, b + this.dy]], circle), size = polygon.length >= 3 ? polygonArea(polygon) : 0;
      if (size <= 0) continue;
      this.inside[at] = 1; this.area[at] = size;
      if (Math.abs(size - this.dx * this.dy) > 1e-12 * this.dx * this.dy) this.clipped.set(at, polygon);
    }
    this.partTop = new Float64Array(n).fill(-Infinity);
    for (const mesh of part) this.rasterPart(mesh, setup.frame);
  }

  /** The part's triangles in the machine frame, each written into the cells whose centres its plan covers (the highest kept). */
  private rasterPart(mesh: CamPartMesh, f: ArrayLike<number>): void {
    const p = mesh.positions, idx = mesh.indices, m = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
      m[i] = f[0] * p[i] + f[4] * p[i + 1] + f[8] * p[i + 2] + f[12];
      m[i + 1] = f[1] * p[i] + f[5] * p[i + 1] + f[9] * p[i + 2] + f[13];
      m[i + 2] = f[2] * p[i] + f[6] * p[i + 1] + f[10] * p[i + 2] + f[14];
    }
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ax = m[a], ay = m[a + 1], bx = m[b], by = m[b + 1], cx = m[c], cy = m[c + 1];
      const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      // (A wall seen edge-on covers no cell centre.)
      if (Math.abs(det) < 1e-12) continue;
      const lx = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - this.x0) / this.dx - 0.5)), hx = Math.min(this.nx - 1, Math.floor((Math.max(ax, bx, cx) - this.x0) / this.dx - 0.5));
      const ly = Math.max(0, Math.ceil((Math.min(ay, by, cy) - this.y0) / this.dy - 0.5)), hy = Math.min(this.ny - 1, Math.floor((Math.max(ay, by, cy) - this.y0) / this.dy - 0.5));
      for (let y = ly; y <= hy; y++) for (let x = lx; x <= hx; x++) {
        const at = y * this.nx + x, px = this.cx[at], py = this.cy[at];
        const u = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / det, v = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / det, w = 1 - u - v;
        if (u < -1e-12 || v < -1e-12 || w < -1e-12) continue;
        const z = u * m[a + 2] + v * m[b + 2] + w * m[c + 2];
        if (z > this.partTop[at]) this.partTop[at] = z;
      }
    }
  }

  /** The stock after the program up to `progress` (completed moves plus a fraction of the next), from pristine stock. */
  evaluate(progress: number): CamRemoval {
    const moves = this.setup.moves;
    if (!Number.isFinite(progress) || progress < 0 || progress > moves.length) refuse('PROGRESS', 'Progress must be a completed-move count plus a fraction within the selected setup.');
    const heights = new Float64Array(this.inside.length).fill(this.z1), radius = this.tool.diameter / 2, flute = this.tool.fluteMM;
    let samples = 0, visits = 0;
    for (let index = 0; index < moves.length && index < progress; index++) {
      const move = moves[index];
      if (!CUTS.has(move.kind)) continue;
      const fraction = Math.min(1, progress - index), ax = move.a[0], ay = move.a[1], az = move.a[2];
      const ex = move.b[0] - ax, ey = move.b[1] - ay, ez = move.b[2] - az, count = Math.ceil(Math.hypot(ex, ey, ez) * fraction / this.spacing);
      if (!Number.isSafeInteger(count) || samples + count + 1 > SAMPLES) refuse('WORK', `The reconstruction exceeds ${SAMPLES} cutter-tip samples.`);
      samples += count + 1;
      for (let sample = 0; sample <= count; sample++) {
        const t = count ? fraction * sample / count : 0, px = ax + ex * t, py = ay + ey * t, pz = az + ez * t, cutterTop = pz + flute;
        const lx = Math.max(0, Math.floor((px - radius - this.x0) / this.dx)), hx = Math.min(this.nx - 1, Math.floor((px + radius - this.x0) / this.dx));
        const ly = Math.max(0, Math.floor((py - radius - this.y0) / this.dy)), hy = Math.min(this.ny - 1, Math.floor((py + radius - this.y0) / this.dy));
        for (let y = ly; y <= hy; y++) for (let x = lx; x <= hx; x++) {
          if (++visits > CELL_VISITS) refuse('WORK', `The reconstruction exceeds ${CELL_VISITS} cell visits.`);
          const at = y * this.nx + x, height = heights[at];
          if (!this.inside[at] || height <= this.z0) continue;
          const distance = Math.hypot(this.cx[at] - px, this.cy[at] - py), near = Math.max(0, distance - this.halfDiagonal);
          if (near > radius) continue;
          if (cutterTop < height - EPS && cutterTop > this.z0 + EPS && pz + bottom(this.tool, near) < height - EPS) refuse('BURIED', 'A cut below the surface beyond the flute would leave a sealed void; a height field cannot show it.');
          // (Lowered only to where the tool reaches the cell's furthest corner: uncertain boundary cells keep material.)
          const z = pz + bottom(this.tool, distance + this.halfDiagonal);
          if (cutterTop >= height - EPS && z < height) heights[at] = Math.max(this.z0, z);
        }
      }
    }
    return this.mesh(heights);
  }

  private topOf(heights: Float64Array, x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.nx || y >= this.ny) return this.z0;
    const at = y * this.nx + x;
    return this.inside[at] ? Math.max(this.z0, heights[at]) : this.z0;
  }

  /** Tops and bottoms per cell; walls only where a cell stands above its neighbour (or the footprint's edge). */
  private mesh(heights: Float64Array): CamRemoval {
    const out = new MeshOut(), over = new MeshOut(), z0 = this.z0;
    let removedMM3 = 0, overcutMM3 = 0, overcutCells = 0;
    for (let y = 0; y < this.ny; y++) for (let x = 0; x < this.nx; x++) {
      const at = y * this.nx + x;
      if (!this.inside[at]) continue;
      const top = Math.max(z0, heights[at]), part = this.partTop[at];
      removedMM3 += this.area[at] * (this.z1 - top);
      // (Cut below the part's surface: the tool entered the part. Its top is drawn red, not with the stock left.)
      const gouged = part - top > CAM_OVERCUT_TOLERANCE_MM;
      if (gouged) { overcutMM3 += this.area[at] * (Math.min(part, this.z1) - top); overcutCells++; }
      const a = this.x0 + x * this.dx, b = this.y0 + y * this.dy, c = a + this.dx, d = b + this.dy, polygon = this.clipped.get(at);
      const topOut = gouged ? over : out;
      if (top <= z0) {
        if (gouged && !polygon) { over.tri(a, b, z0, c, b, z0, c, d, z0, 0, 0, 1); over.tri(a, b, z0, c, d, z0, a, d, z0, 0, 0, 1); }
        else if (gouged) for (let k = 1; k + 1 < polygon!.length; k++) over.tri(polygon![0][0], polygon![0][1], z0, polygon![k][0], polygon![k][1], z0, polygon![k + 1][0], polygon![k + 1][1], z0, 0, 0, 1);
        continue;
      }
      if (!polygon) {
        topOut.tri(a, b, top, c, b, top, c, d, top, 0, 0, 1); topOut.tri(a, b, top, c, d, top, a, d, top, 0, 0, 1);
        out.tri(a, b, z0, c, d, z0, c, b, z0, 0, 0, -1); out.tri(a, b, z0, a, d, z0, c, d, z0, 0, 0, -1);
        const south = this.topOf(heights, x, y - 1), east = this.topOf(heights, x + 1, y), north = this.topOf(heights, x, y + 1), west = this.topOf(heights, x - 1, y);
        if (top > south) out.quadWall(a, b, c, b, south, top);
        if (top > east) out.quadWall(c, b, c, d, east, top);
        if (top > north) out.quadWall(c, d, a, d, north, top);
        if (top > west) out.quadWall(a, d, a, b, west, top);
        continue;
      }
      for (let k = 1; k + 1 < polygon.length; k++) {
        const p = polygon[0], q = polygon[k], r = polygon[k + 1];
        topOut.tri(p[0], p[1], top, q[0], q[1], top, r[0], r[1], top, 0, 0, 1);
        out.tri(p[0], p[1], z0, r[0], r[1], z0, q[0], q[1], z0, 0, 0, -1);
      }
      for (let k = 0; k < polygon.length; k++) {
        const p = polygon[k], q = polygon[(k + 1) % polygon.length];
        // (An edge on the cell's own side meets that neighbour; a chord of the footprint meets nothing.)
        const base = Math.abs(p[1] - b) <= EPS && Math.abs(q[1] - b) <= EPS ? this.topOf(heights, x, y - 1)
          : Math.abs(p[0] - c) <= EPS && Math.abs(q[0] - c) <= EPS ? this.topOf(heights, x + 1, y)
          : Math.abs(p[1] - d) <= EPS && Math.abs(q[1] - d) <= EPS ? this.topOf(heights, x, y + 1)
          : Math.abs(p[0] - a) <= EPS && Math.abs(q[0] - a) <= EPS ? this.topOf(heights, x - 1, y) : z0;
        if (top > base) out.quadWall(p[0], p[1], q[0], q[1], base, top);
      }
    }
    // (How far inside the exact swept edge material may be left: a cell stays when its centre is more than r − h from
    // every sample (h the half diagonal), so a point of it lies more than r − 2h from them, and the samples are within
    // half their spacing of the path. Hence 2h + s/2 — the full diagonal, not half of it.)
    return {
      geometry: { positions: Float32Array.from(out.positions), normals: Float32Array.from(out.normals) },
      overcut: { positions: Float32Array.from(over.positions), normals: Float32Array.from(over.normals) }, overcutMM3, overcutCells,
      cellMM: this.pitch, sampleMM: this.spacing, nx: this.nx, ny: this.ny, removedMM3, lateralUncertaintyMM: 2 * this.halfDiagonal + this.spacing / 2,
    };
  }
}
