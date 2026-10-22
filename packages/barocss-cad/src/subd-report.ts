// SD2 (R7): what a SubD build promises, measured. G1 between faces: along every edge that is not sharp, both faces'
// normals at the same points (and the gap between their boundaries); the deviation from the Catmull–Clark limit
// surface: each cap (and, as a check of the measure, some exact quads) against the limit sampled by refining the
// quad's one-ring — each sample's distance to the cap (its closest point on that cap: within the cap, so never less
// than the distance to the whole surface), and at the same parameters (larger still: the limit's parametrisation at
// an irregular vertex is not a polynomial's).
import { evaluateSurfaceD1 } from './derivatives.js';
import { evaluateSurface } from './math.js';
import type { Surface } from './types.js';
import { buildSubd, type EdgeRun, type SubdCage, type SubdOptions } from './subd.js';
import { closestOnCap, limitGrid, polyMesh } from './subd-sd2.js';

export interface SubdReport {
  /** Catmull–Clark steps taken (0: regular, SD1), irregular vertices and caps after them, B-rep faces. */
  readonly steps: number; readonly irregularVertices: number; readonly capCount: number; readonly faces: number;
  /** The largest angle between the two faces' normals along edges that are not sharp, over `samples` points; the largest gap. */
  readonly g1: { readonly maxAngleDeg: number; readonly edges: number; readonly samples: number; readonly maxGapMM: number; readonly sharpEdges: number };
  /**
   * The caps' shape on a 33 × 33 grid of each: the smallest |Su × Sv| against the cap's median (0: a degenerate point)
   * and the largest angle between neighbouring grid points' normals (near 180°: a fold). G1 along edges and a small
   * distance from the limit do not show a fold; this does.
   */
  readonly caps: { readonly minJacobianRatio: number; readonly maxNormalTurnDeg: number };
  /** The caps' largest and root-mean-square distance of the limit samples to them; at the same parameters; the exact quads' (≈ 0). */
  readonly deviation: { readonly maxMM: number; readonly rmsMM: number; readonly parametricMaxMM: number; readonly samples: number; readonly levels: number; readonly exactMaxMM: number; readonly exactSamples: number };
}
export interface SubdReportOptions extends SubdOptions { readonly levels?: number; readonly samplesPerEdge?: number; readonly exactQuads?: number }

/** A run's point at fraction s along it (the loop's way), in its face's parameters. */
function runParam(r: EdgeRun, s: number): [number, number] {
  const x = r.q0 + s * r.count;
  return r.side === 0 ? [x, 0] : r.side === 1 ? [r.K, x] : r.side === 2 ? [r.K - x, r.L] : [0, r.L - x];
}
function normalAt(S: Surface, u: number, v: number): { p: number[]; n: number[] | null } {
  const d = evaluateSurfaceD1(S, u, v), a = d.du, b = d.dv;
  const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], l = Math.hypot(n[0], n[1], n[2]);
  return { p: d.point, n: l > 1e-14 * Math.max(1, Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2])) ? n.map(x => x / l) : null };
}

export function subdReport(cage: SubdCage, options: SubdReportOptions = {}): SubdReport {
  const build = buildSubd(cage, options), levels = options.levels ?? 4, per = options.samplesPerEdge ?? 9;
  const faces = build.brep.faces, surf = (k: number) => faces[k].surface as Surface;
  let maxAngle = 0, maxGap = 0, samples = 0, edges = 0;
  for (const [edge, runs] of build.runs) {
    if (build.sharpEdges.has(edge) || runs.length !== 2) continue;
    edges++;
    for (let q = 0; q < per; q++) {
      const s = q / (per - 1), [ua, va] = runParam(runs[0], s), [ub, vb] = runParam(runs[1], 1 - s);
      const A = normalAt(surf(runs[0].face), ua, va), B = normalAt(surf(runs[1].face), ub, vb);
      maxGap = Math.max(maxGap, Math.hypot(A.p[0] - B.p[0], A.p[1] - B.p[1], A.p[2] - B.p[2]));
      if (!A.n || !B.n) continue;
      samples++;
      maxAngle = Math.max(maxAngle, Math.acos(Math.max(-1, Math.min(1, A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2]))) * 180 / Math.PI);
    }
  }
  // Deviation: caps, and up to `exactQuads` quads that are exact B-spline (a check that the measure reads 0 there).
  const mesh = build.mesh ?? polyMesh(build.quads);
  let maxDev = 0, sum = 0, n = 0, paramMax = 0, exactMax = 0, exactN = 0, exactLeft = options.exactQuads ?? 4;
  build.cells.forEach((cells, k) => cells.forEach(c => {
    const cap = build.caps.has(c.face);
    if (!cap && exactLeft <= 0) return;
    if (!cap) exactLeft--;
    for (const g of limitGrid(mesh, c.face, c.r, levels)) {
      const p = evaluateSurface(surf(k), c.i + g.u, c.j + g.v), d = Math.hypot(p[0] - g.p[0], p[1] - g.p[1], p[2] - g.p[2]);
      if (!cap) { exactMax = Math.max(exactMax, d); exactN++; continue; }
      const [cu, cv] = closestOnCap(surf(k), g.p, g.u, g.v), q = evaluateSurface(surf(k), cu, cv), e = Math.hypot(q[0] - g.p[0], q[1] - g.p[1], q[2] - g.p[2]);
      paramMax = Math.max(paramMax, d); maxDev = Math.max(maxDev, e); sum += e * e; n++;
    }
  }));
  // The caps' shape: degenerate points and folds.
  let minRel = Infinity, maxTurn = 0;
  const N = 32, nrm: (number[] | null)[] = new Array((N + 1) * (N + 1)), lens = new Float64Array((N + 1) * (N + 1));
  build.cells.forEach((cells, k) => {
    const cap = build.caps.get(cells[0].face); if (!cap) return;
    // (A cap whose two edges at the vertex are both sharp — a one-face sector of a crease — has its corner there at a
    // straight angle: Su ∥ Sv at that one point, as in the limit itself. That point is left out.)
    const fan = build.mesh!.fans[cap.vertex]!, at = fan.faces.findIndex(f => f.face === cap.face);
    const straight = fan.sharp[at] && fan.sharp[(at + 1) % fan.sharp.length];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      if (straight && i === 0 && j === 0) { lens[0] = NaN; nrm[0] = null; continue; }
      const d = evaluateSurfaceD1(surf(k), i / N, j / N), a = d.du, b = d.dv, n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], l = Math.hypot(n[0], n[1], n[2]);
      lens[i * (N + 1) + j] = l; nrm[i * (N + 1) + j] = l > 0 ? n.map(x => x / l) : null;
    }
    const sorted = Float64Array.from(lens.filter(x => !Number.isNaN(x))).sort(), median = sorted[sorted.length >> 1];
    minRel = Math.min(minRel, sorted[0] / median);
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) for (const [di, dj] of [[1, 0], [0, 1]]) {
      if (i + di > N || j + dj > N || (straight && i === 0 && j === 0)) continue;
      const p = nrm[i * (N + 1) + j], q = nrm[(i + di) * (N + 1) + j + dj];
      maxTurn = p && q ? Math.max(maxTurn, Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]))) * 180 / Math.PI) : 180;
    }
  });
  const irregular = build.mesh ? build.mesh.fans.filter(f => f && !f.regular).length : 0;
  return {
    steps: build.steps, irregularVertices: irregular, capCount: build.caps.size, faces: faces.length,
    caps: { minJacobianRatio: build.caps.size ? minRel : 1, maxNormalTurnDeg: maxTurn },
    g1: { maxAngleDeg: maxAngle, edges, samples, maxGapMM: maxGap, sharpEdges: build.sharpEdges.size },
    deviation: { maxMM: maxDev, rmsMM: n ? Math.sqrt(sum / n) : 0, parametricMaxMM: paramMax, samples: n, levels, exactMaxMM: exactMax, exactSamples: exactN },
  };
}
