p = '/Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/src/engine/direct.ts'
t = open(p).read()
def rep(a, b):
    global t
    assert a in t, a
    t = t.replace(a, b, 1)

helper = '''/** What extendDeviation needs to know about one extension. */
interface ExtendRun {
  s: Surface; stored: Surface; d1: (u: number, v: number) => SurfaceD1Result; alongU: boolean; atMax: boolean; eA: number; distance: number;
  a0: number; a1: number; b0: number; b1: number; n: number; across: number; extra: number;
  /** The fit's scaled parameters of each row (along the extended direction) and each column (across it). */
  rowParam: readonly number[]; colParam: readonly number[];
}
const clampTo = (x: number, [lo, hi]: readonly [number, number]) => Math.min(Math.max(x, lo), hi);
/** The stored surface at the midpoint of the fit parameters of rows r0, r1 and columns c0, c1 (clamped to its domain). */
function storedAt(run: ExtendRun, r0: number, r1: number, c0: number, c1: number): [number, number, number] {
  const dom = surfaceDomain(run.stored), rp = (run.rowParam[r0] + run.rowParam[r1]) / 2, cp = (run.colParam[c0] + run.colParam[c1]) / 2;
  const p = run.alongU ? evaluateSurface(run.stored, clampTo(rp, dom.u), clampTo(cp, dom.v)) : evaluateSurface(run.stored, clampTo(cp, dom.u), clampTo(rp, dom.v));
  return [p[0], p[1], p[2]];
}
/** The original surface at (a, b), a along the extended direction. */
function originalAt(run: ExtendRun, a: number, b: number): [number, number, number] {
  const p = run.alongU ? evaluateSurface(run.s, a, b) : evaluateSurface(run.s, b, a);
  return [p[0], p[1], p[2]];
}
/**
 * The largest distance, measured between the fit's sample rows, of the stored extension from what it should be: in the original
 * region the first-order distance off the original surface (sliding along it is not counted), in the extension the distance off the straight run.
 */
function extendDeviation(run: ExtendRun): number {
  let worst = 0;
  // Row r of the fit for original row i: the extension rows come first on a min edge.
  const first = run.atMax ? 0 : run.extra;
  for (let i = 0; i <= run.n; i++) for (let j = 0; j <= run.across; j++) for (let kind = 0; kind < 3; kind++) {
    const di = kind === 1 ? 0 : 1, dj = kind === 0 ? 0 : 1;
    if (i + di > run.n || j + dj > run.across) continue;
    const a = (sampleAt(run.a0, run.a1, i, run.n) + sampleAt(run.a0, run.a1, i + di, run.n)) / 2, b = (sampleAt(run.b0, run.b1, j, run.across) + sampleAt(run.b0, run.b1, j + dj, run.across)) / 2;
    const r = storedAt(run, first + i, first + i + di, j, j + dj), o = originalAt(run, a, b), g = run.alongU ? run.d1(a, b) : run.d1(b, a);
    const nx = g.du[1] * g.dv[2] - g.du[2] * g.dv[1], ny = g.du[2] * g.dv[0] - g.du[0] * g.dv[2], nz = g.du[0] * g.dv[1] - g.du[1] * g.dv[0], l = Math.hypot(nx, ny, nz);
    if (!(l > 0)) continue;
    const gap = Math.abs(((r[0] - o[0]) * nx + (r[1] - o[1]) * ny + (r[2] - o[2]) * nz) / l);
    if (!(gap <= worst)) worst = gap;
  }
  // Extension levels 0 (the edge row) to extra: level m is row 11 + m on a max edge, row extra - m on a min edge.
  for (let m = 0; m < run.extra; m++) for (let j = 0; j <= run.across; j++) for (let half = 0; half < 2; half++) {
    if (half === 1 && j === run.across) continue;
    const b = (sampleAt(run.b0, run.b1, j, run.across) + sampleAt(run.b0, run.b1, j + half, run.across)) / 2, t = edgeTangent(run.d1, run.alongU, run.atMax, run.eA, b);
    if (t === null) continue;
    const r0 = run.atMax ? run.n + m : run.extra - m, r1 = run.atMax ? r0 + 1 : r0 - 1;
    const r = storedAt(run, r0, r1, j, j + half), o = originalAt(run, run.eA, b), k = run.distance * (m + 0.5) / run.extra;
    const dx = r[0] - o[0] - t[0] * k, dy = r[1] - o[1] - t[1] * k, dz = r[2] - o[2] - t[2] * k, along = dx * t[0] + dy * t[1] + dz * t[2];
    const gap = Math.hypot(dx - along * t[0], dy - along * t[1], dz - along * t[2]);
    if (!(gap <= worst)) worst = gap;
  }
  return worst;
}
/** The result's name: the extended surface, with its measured deviation (mm) when that is over the numeric tolerance. */
function extendedName(name: string, off: number): string {
  return off <= CadNumericPolicy.linearTolerance ? `${name} · extended` : `${name} · extended (±${off >= 0.001 ? Math.round(off * 1000) / 1000 : off.toPrecision(1)})`;
}
/** The mean total chord length'''
rep("/** The mean total chord length", helper)

rep("(re-fitted as a bicubic B-spline).\n", "(re-fitted as a bicubic B-spline).\n")
rep("so only its sample points are held to it.\n", "so only its sample points are held to it;\n   * a curved support's measured off-sample deviation is shown in the result's name (±mm).\n")

rep("    const next = add(d, [id], surfacesSource('extended', [scaledFit]), [{ geometry: 's1', name: `${nameOf(d, id)} · extended` }]);\n",
    "    const text = surfacesSource('extended', [scaledFit]), next = add(d, [id], text, [{ geometry: 's1', name: extendedName(nameOf(d, id), 0) }]);\n")
rep("    return next;\n  },\n  /**\n   * The curve fitted again",
"""    // The loss between the sample rows, which the sample check does not see, goes into the name (as refitCurve's does).
    const rowParam = (alongU ? ub.map(x => x * lu) : vb.map(x => x * lv)), colParam = (alongU ? vb.map(x => x * lv) : ub.map(x => x * lu));
    const off = extendDeviation({ s, stored, d1, alongU, atMax, eA, distance, a0, a1, b0, b1, n, across, extra, rowParam, colParam });
    return off <= CadNumericPolicy.linearTolerance ? next : add(d, [id], text, [{ geometry: 's1', name: extendedName(nameOf(d, id), off) }]);
  },
  /**
   * The curve fitted again""")
open(p, 'w').write(t)

r = '/Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/README.md'
x = open(r).read()
old = "`extendSurface` still refuses surfaces with trims.\n"
assert old in x
x = x.replace(old, "`extendSurface` keeps a flat parallelogram support exact to the numeric tolerance; a curved support is re-fitted, with the measured deviation in the result's name (±mm). It still refuses surfaces with trims.\n", 1)
open(r, 'w').write(x)
