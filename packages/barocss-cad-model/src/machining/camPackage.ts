// G23's data side, B (the S0 in decisions-outer.md, with the GPU lane's additions): CNC8's 2.5D preview as an ordered
// tool-tip path, for the GPU lane's material-removal preview — NOT FOR PRODUCTION, no G-code (README §4), its banner
// first. Each setup has one frame (world → machine, column-major 4×4; the tool's axis its +Z) and a program of typed
// moves: a rapid only at the safe height, then down into the cut by a ramp along the pocket's first loop or by a plunge,
// the loops fed at each level from the outermost in (linked at depth inside the pocket), a retract back up before the
// next level and at the end; a hole drilled by a plunge and a retract. The safe height (the stock's top along the axis
// and 5 mm), the ramp's angle (3°) and the plunge-or-ramp choice are estimates, said. The tool is a whole shape (flat,
// ball or bull with its corner radius, its flute length, its shank); the stock CNC7b's, as a solid, or its refusal.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { camPreview, NOT_FOR_PRODUCTION, type DrillPoint, type PocketPass } from './cam';
import { chooseStock } from './stock';
import { DIRECTION_NAMES, DIRECTIONS } from './access';

export const CAM_PACKAGE_VERSION = 'cam-package-v1';
type Vec3 = [number, number, number];
export type MoveKind = 'rapid' | 'feed' | 'plunge' | 'ramp' | 'retract';
/** A move of the tool's tip, in its setup's machine frame (mm). */
export interface Move { kind: MoveKind; a: Vec3; b: Vec3 }
/** A pass: a pocket's loop at a level, or a hole; its moves [from, to) of its setup's program. */
export interface Pass { kind: 'pocket' | 'drill'; feature: string; level?: number; loop?: number; from: number; to: number }
export interface ToolShape {
  kind: 'flat' | 'ball' | 'bull'; diameterMM: number; cornerMM: number; fluteMM: number; shankMM: number;
  basis: { diameter: 'given' | 'estimate'; shape: 'given' | 'estimate' };
}
export interface SetupProgram {
  setup: string;
  /** World → machine, column-major: the setup's axes, the tool's axis machine +Z. */
  frame: number[];
  axis: Vec3;
  safeZ: { mm: number; basis: 'estimate' };
  entry: { rampDeg: number; basis: 'estimate'; rule: string };
  moves: Move[]; passes: Pass[];
}
export type StockSolid = { kind: 'box'; min: Vec3; max: Vec3 } | { kind: 'cylinder'; start: Vec3; axis: Vec3; length: number; diameter: number };
export interface CamPackage {
  banner: string; notForProduction: true; version: typeof CAM_PACKAGE_VERSION;
  tool: ToolShape; stepoverMM: number; stepdownMM: number; basis: string;
  stock: StockSolid | { refused: { code: string; message: string } };
  setups: SetupProgram[];
  skipped: readonly { feature: string; why: string }[];
}

const SAFE_ABOVE_MM = 5, RAMP_DEG = 3;
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A setup's machine axes: x, y across, z its direction (the tool's axis, out of the material), right-handed. */
function axesOf(n: readonly number[]): [Vec3, Vec3, Vec3] {
  const X = Math.abs(n[0]) < 0.9 ? [0, 1, 2].map(k => [1, 0, 0][k] - n[0] * n[k]) : [0, 1, 2].map(k => [0, 1, 0][k] - n[1] * n[k]), l = Math.hypot(X[0], X[1], X[2]);
  const x: Vec3 = [X[0] / l, X[1] / l, X[2] / l], y: Vec3 = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]];
  return [x, y, [n[0], n[1], n[2]]];
}

/** The package: the tool's whole shape (`tool` given, else a flat end mill of CNC8's diameter, its flute 3 D and shank D, estimates). */
export function camPackage(doc: StudioDoc, bodies: readonly BodyResult[], o: { toolMM?: number; tool?: Partial<Omit<ToolShape, 'basis'>> } = {}): CamPackage {
  const p = camPreview(doc, bodies, { ...(o.tool?.diameterMM ?? o.toolMM ? { toolMM: o.tool?.diameterMM ?? o.toolMM } : {}) });
  const D = p.tool.diameterMM, kind = o.tool?.kind ?? 'flat';
  const tool: ToolShape = { kind, diameterMM: D, cornerMM: kind === 'ball' ? D / 2 : kind === 'bull' ? o.tool?.cornerMM ?? D / 4 : 0, fluteMM: o.tool?.fluteMM ?? 3 * D, shankMM: o.tool?.shankMM ?? D, basis: { diameter: p.tool.basis, shape: o.tool ? 'given' : 'estimate' } };
  const st = chooseStock(doc, bodies, 'cnc-milling');
  const stock: CamPackage['stock'] = st.ok ? ('min' in st.choice.placement ? { kind: 'box', min: [...st.choice.placement.min] as Vec3, max: [...st.choice.placement.max] as Vec3 } : { kind: 'cylinder', start: [...st.choice.placement.start] as Vec3, axis: [...st.choice.placement.axis] as Vec3, length: st.choice.placement.length, diameter: st.choice.placement.diameter }) : { refused: { code: st.code, message: st.message } };
  // (The highest point to keep clear of: the stock's corners, else the part's box.)
  const corners: Vec3[] = [];
  if ('kind' in stock && stock.kind === 'box') for (let i = 0; i < 8; i++) corners.push([i & 1 ? stock.max[0] : stock.min[0], i & 2 ? stock.max[1] : stock.min[1], i & 4 ? stock.max[2] : stock.min[2]]);
  else if ('kind' in stock) { const r = stock.diameter / 2; for (const t of [0, stock.length]) for (let i = 0; i < 8; i++) corners.push([0, 1, 2].map(k => stock.start[k] + t * stock.axis[k] + (i & (1 << k) ? r : -r)) as Vec3); }
  else for (const b of bodies) for (let i = 0; i < 8; i++) corners.push([0, 1, 2].map(k => i & (1 << k) ? b.mesh.bounds.max[k] : b.mesh.bounds.min[k]) as Vec3);
  const setups = new Map<string, SetupProgram>();
  const programOf = (setup: string): SetupProgram => {
    const had = setups.get(setup); if (had) return had;
    const n = DIRECTIONS[DIRECTION_NAMES.indexOf(setup)], [x, y, z] = axesOf(n), top = Math.max(...corners.map(c => dot(c, n)));
    const prog: SetupProgram = { setup, frame: [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, 0, 0, 0, 1].map(v => v + 0), axis: z, safeZ: { mm: top + SAFE_ABOVE_MM, basis: 'estimate' },
      entry: { rampDeg: RAMP_DEG, basis: 'estimate', rule: `a ramp at ${RAMP_DEG}° along the level's first loop where it is long enough for the step down, else a plunge` }, moves: [], passes: [] };
    setups.set(setup, prog);
    return prog;
  };
  for (const op of p.operations) { if (op.kind === 'pocket') pocketMoves(programOf(op.setup), op); else drillMoves(programOf(op.setup), op); }
  for (const s of setups.values()) { const last = s.moves.at(-1); if (last && last.b[2] < s.safeZ.mm) s.moves.push({ kind: 'retract', a: last.b, b: [last.b[0], last.b[1], s.safeZ.mm] }); }
  return { banner: NOT_FOR_PRODUCTION, notForProduction: true, version: CAM_PACKAGE_VERSION, tool, stepoverMM: p.stepoverMM, stepdownMM: p.stepdownMM, basis: p.basis, stock, setups: [...setups.values()], skipped: p.skipped };
}

/** A world point in a setup's machine frame. */
const toMachine = (s: SetupProgram, w: readonly number[]): Vec3 => { const f = s.frame; return [f[0] * w[0] + f[4] * w[1] + f[8] * w[2] + 0, f[1] * w[0] + f[5] * w[1] + f[9] * w[2] + 0, f[2] * w[0] + f[6] * w[1] + f[10] * w[2] + 0]; };
/** From where the tool is to `to`: up to the safe height, across, down — or nothing if it is there. */
function linkTo(s: SetupProgram, to: Vec3): void {
  const last = s.moves.at(-1), at = last ? last.b : null, safe = s.safeZ.mm;
  if (at && at[2] < safe) s.moves.push({ kind: 'retract', a: at, b: [at[0], at[1], safe] });
  const from: Vec3 = at ? [at[0], at[1], safe] : [to[0], to[1], safe];
  if (!at || from[0] !== to[0] || from[1] !== to[1]) s.moves.push({ kind: 'rapid', a: from, b: [to[0], to[1], safe] });
}

function pocketMoves(s: SetupProgram, op: PocketPass): void {
  if (!op.loops.length) return;
  const floor = op.levels.at(-1)!, o = op.plane.origin, X = op.plane.x, Y = op.plane.y;
  const at = (q: readonly number[], depth: number): Vec3 => { const w = [0, 1, 2].map(k => o[k] + q[0] * X[k] + q[1] * Y[k] + (floor - depth) * op.plane.normal[k]); return toMachine(s, w); };
  let prev = 0;
  for (const level of op.levels) {
    op.loops.forEach((loop, j) => {
      const from = s.moves.length, pts = loop.map(q => at(q, level));
      if (j === 0) {
        // (Down into the cut: through the air cleared so far by a plunge, then a ramp along the loop or a plunge.)
        const start = pts[0], above = at(loop[0], prev); linkTo(s, start);
        s.moves.push({ kind: 'plunge', a: [start[0], start[1], s.safeZ.mm], b: above });
        const need = (level - prev) / Math.tan(RAMP_DEG * Math.PI / 180);
        let len = 0; for (let i = 0; i < pts.length; i++) len += Math.hypot(pts[(i + 1) % pts.length][0] - pts[i][0], pts[(i + 1) % pts.length][1] - pts[i][1]);
        if (len >= need && need > 0) {
          let walked = 0, here: Vec3 = above;
          for (let i = 0; i < pts.length && walked < need; i++) {
            const b = pts[(i + 1) % pts.length], seg = Math.hypot(b[0] - pts[i][0], b[1] - pts[i][1]), t = Math.min(1, (need - walked) / seg);
            const end: Vec3 = [pts[i][0] + t * (b[0] - pts[i][0]), pts[i][1] + t * (b[1] - pts[i][1]), above[2] - (above[2] - start[2]) * Math.min(1, (walked + t * seg) / need)];
            s.moves.push({ kind: 'ramp', a: here, b: end }); here = end; walked += t * seg;
          }
          // (Back to the loop's start at depth, along it, then round the whole loop.)
          s.moves.push({ kind: 'feed', a: here, b: start });
        } else if (level > prev) s.moves.push({ kind: 'plunge', a: above, b: start });
      } else {
        // (Inward to the next loop at depth: inside the pocket, cutting.)
        const last = s.moves.at(-1)!.b; s.moves.push({ kind: 'feed', a: last, b: pts[0] });
      }
      for (let i = 0; i < pts.length; i++) s.moves.push({ kind: 'feed', a: pts[i], b: pts[(i + 1) % pts.length] });
      s.passes.push({ kind: 'pocket', feature: op.feature, level, loop: j, from, to: s.moves.length });
    });
    prev = level;
  }
}

function drillMoves(s: SetupProgram, op: DrillPoint): void {
  const from = s.moves.length, entry = toMachine(s, op.at), bottom = toMachine(s, op.at.map((v, k) => v + op.depthMM * op.axis[k]));
  linkTo(s, entry);
  s.moves.push({ kind: 'plunge', a: [entry[0], entry[1], s.safeZ.mm], b: bottom }, { kind: 'retract', a: bottom, b: [entry[0], entry[1], s.safeZ.mm] });
  s.passes.push({ kind: 'drill', feature: op.feature, from, to: s.moves.length });
}
