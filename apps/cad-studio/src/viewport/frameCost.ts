import { FRAME_PASSES, type FramePass, type MeshCost } from '@barocss/gpu/viewer';
import type { DisplayMode } from './renderer';

// O10's GPU part: what each body cost the frames drawn, by display mode, the same on both renderers (gpuRenderer.ts
// reads the GPU viewer's per-mesh counts, renderer.ts counts its own draws). Read-only and off by default: counting
// changes nothing drawn. Work counts, not time — no per-body GPU time is measured; the frame's own CPU time is given.

export type { FramePass };
/** Draw calls, the primitives they drew, and the draws by pass (where a pass draws a body's meshes: FRAME_PASSES). */
export interface CostCounts { draws: number; triangles: number; lines: number; points: number; passes: Record<FramePass, number> }
export interface BodyCost extends CostCounts {
  /** The body's key, or `${instanceId}/${bodyKey}` for a placed copy (each copy its own, shared geometry or not). */
  key: string;
  /** The body's primitives (triangles, lines and points) over the frame's primitives: a share of the work drawn, not of time. */
  share: number;
}
export interface FrameCost {
  renderer: 'webgpu' | 'webgl2';
  mode: DisplayMode;
  /** The renderer's count of frames tracked, at this frame. */
  frame: number;
  /** The frame's CPU time to record and submit it (ms). */
  cpuMs: number;
  bodies: BodyCost[];
  /**
   * What no body drew: the grid, ground, background, overlays and labels on WebGPU; on WebGL2 the draws its render
   * makes itself (background, grid, ground shadow, direct geometry, proposals, the composite) — its overlays' own
   * helpers are not counted there.
   */
  scene: CostCounts;
}

const MODES: readonly DisplayMode[] = ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray'];
const newCounts = (): CostCounts & { frame: number } => ({ frame: -1, draws: 0, triangles: 0, lines: 0, points: 0, passes: { shadow: 0, surface: 0, transparent: 0, oit: 0, hiddenLines: 0, caps: 0, outlineMask: 0 } });
function zero(c: CostCounts): void {
  c.draws = 0; c.triangles = 0; c.lines = 0; c.points = 0;
  for (let i = 0; i < FRAME_PASSES.length; i++) c.passes[FRAME_PASSES[i]] = 0;
}
function copyCounts(c: CostCounts): CostCounts { return { draws: c.draws, triangles: c.triangles, lines: c.lines, points: c.points, passes: { ...c.passes } }; }
const primitives = (c: CostCounts) => c.triangles + c.lines + c.points;

/** A body's counts by display mode, kept between frames: made when the body is first counted, dropped with its owner. */
export class CostRecord {
  readonly modes: (CostCounts & { frame: number })[] = [];
  constructor(readonly key: string) {}
}

/**
 * The tally: a renderer begins each tracked frame in its mode, adds each body's draws, and ends it. Records hang off
 * the renderer's own objects (a WeakMap); a mode's counts are zeroed when its next frame first touches them.
 */
export class FrameCostTally {
  tracking = false;
  private frame = 0;
  private mode = 0;
  private records = new WeakMap<object, CostRecord>();
  private last: ({ frame: number; cpuMs: number; scene: CostCounts & { frame: number } } | undefined)[] = [];

  /** The owner's record, or null when it has none yet (then `recordNew`, its key made once). */
  recordOf(owner: object): CostRecord | null { return this.records.get(owner) ?? null; }
  recordNew(owner: object, key: string): CostRecord { const r = new CostRecord(key); this.records.set(owner, r); return r; }

  begin(mode: DisplayMode): void {
    this.frame++; this.mode = Math.max(0, MODES.indexOf(mode));
    const l = this.last[this.mode] ??= { frame: -1, cpuMs: 0, scene: newCounts() };
    l.frame = this.frame; zero(l.scene);
  }
  private counts(r: CostRecord): CostCounts {
    const c = r.modes[this.mode] ??= newCounts();
    if (c.frame !== this.frame) { zero(c); c.frame = this.frame; }
    return c;
  }
  /** One draw of a body's (or, with null, of the scene's) in a pass. */
  add(r: CostRecord | null, pass: FramePass, triangles: number, lines: number, points: number): void {
    const c = r ? this.counts(r) : this.last[this.mode]!.scene;
    c.draws++; c.triangles += triangles; c.lines += lines; c.points += points; c.passes[pass]++;
  }
  /** A GPU viewer mesh's counts of the frame added to a body's (or, with null, to the scene's). */
  addMesh(r: CostRecord | null, m: MeshCost | undefined): void {
    if (!m || !m.draws) return;
    const c = r ? this.counts(r) : this.last[this.mode]!.scene;
    c.draws += m.draws; c.triangles += m.triangles; c.lines += m.lines; c.points += m.points;
    for (let i = 0; i < FRAME_PASSES.length; i++) { const p = FRAME_PASSES[i]; c.passes[p] += m.passes[p]; }
  }
  /** A body's counts of the frame taken back off the scene's (the GPU renderer adds every mesh to the scene first). */
  subtractFromScene(r: CostRecord): void {
    const c = r.modes[this.mode], s = this.last[this.mode]!.scene;
    if (!c || c.frame !== this.frame) return;
    s.draws -= c.draws; s.triangles -= c.triangles; s.lines -= c.lines; s.points -= c.points;
    for (let i = 0; i < FRAME_PASSES.length; i++) { const p = FRAME_PASSES[i]; s.passes[p] -= c.passes[p]; }
  }
  end(cpuMs: number): void { this.last[this.mode]!.cpuMs = cpuMs; }

  /** The last frame tracked in each mode, of the records still shown (`shown`: the renderer's current ones). */
  report(renderer: FrameCost['renderer'], shown: readonly (CostRecord | null)[]): Partial<Record<DisplayMode, FrameCost>> {
    const out: Partial<Record<DisplayMode, FrameCost>> = {};
    for (let m = 0; m < MODES.length; m++) {
      const l = this.last[m]; if (!l) continue;
      const bodies: BodyCost[] = [];
      for (const r of shown) { const c = r?.modes[m]; if (r && c && c.frame === l.frame) bodies.push({ key: r.key, share: 0, ...copyCounts(c) }); }
      const total = bodies.reduce((n, b) => n + primitives(b), primitives(l.scene));
      for (const b of bodies) b.share = total ? primitives(b) / total : 0;
      out[MODES[m]] = { renderer, mode: MODES[m], frame: l.frame, cpuMs: l.cpuMs, bodies, scene: copyCounts(l.scene) };
    }
    return out;
  }
}
