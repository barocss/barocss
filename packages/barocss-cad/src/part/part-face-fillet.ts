// 3b (D361): the part model's face-fillet feature and its helpers (`analyticOf`, `restoreCorner`, `revolvedFillet`, `parallelFillet` and the
// section geometry they share), moved out of part-model.ts's operation() as they were there. The dispatcher calls `faceFilletOperation`; part-model's values come through a function-level import.
import { BrepError, isFacetFace, nurbsOf, type Brep, type BrepFace } from '../brep/brep-core.js';
import { prismaticFromProfile } from '../features/prismatic-solid.js';
import { faceGeometry, type FaceGeometry } from '../brep/analytic-boolean.js';
import { polynomialFaceFillet } from '../blend/polynomial-face-fillet.js';
import type { FilletReport } from '../blend/rolling-ball.js';
import { revolveProfile } from '../features/revolve.js';
import { type BrepAffine } from '../brep/brep-transform.js';
import { curveDomain, evaluateCurve, evaluateSurface, surfaceDomain } from '../core/math.js';
import { type ProfileSegmentInput } from '../features/extruded-profile-solid.js';
import type { Point } from '../types.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import { revolutionOf } from '../nurbs/surfaces/surface-revolution.js';
import { finishEdges } from './part-finish.js';
import type { CadPartDim, CadPartErrorCode, Solid, CadPartFeature, Result, Tools, Part } from './part-model.js';
import { CadPartError, affine, boolean, brepOf, empty, exactVolume } from './part-model.js';
/** A face-fillet feature's evaluation (part-model.ts's operation() for this kind). */
export function faceFilletOperation(f: CadPartFeature & Record<string, unknown>, t: Tools): () => Result {
  const { dim, solids, fail, at } = t;
  const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });
  switch (f.kind) {
    case 'face-fillet': {
      const target = solids(f.target, 'target'), names = f.faces as unknown, r = dim(f.radius as CadPartDim, 'radius', true);
      if (!Array.isArray(names) || names.length !== 2 || !names.every(x => typeof x === 'string' && x) || names[0] === names[1]) fail('INPUT', 'faces must name two different faces');
      if (target.length !== 1) fail('REFERENCE', 'face fillet one part at a time (name it as id/k)');
      // The rounds built from a section (extruded or revolved); a pair those do not take goes to the rolling ball: faces
      // that meet, by every edge they share (F0); faces apart, with their corner restored first (F1).
      const built = (): Result => {
        const source = target[0].solid;
        if (source.kind === 'brep' && source.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'a face fillet on mesh faces is not supported yet');
        const brep = brepOf(target[0], at), points = new Map(brep.vertices.map(v => [v.id, v.point])), edges = new Map(brep.edges.map(e => [e.id, e])), coedges = new Map(brep.coedges.map(c => [c.id, c]));
        // A plane and a cylinder square to it: the round revolved about the cylinder's axis.
        const groups = (names as string[]).map(name => brep.faces.filter(x => x.name === name || (x.name ?? '').split('#')[0] === name));
        const kinds = groups.map(g => g.length ? faceGeometry(g[0]).kind : null);
        const sides = (names as string[]).map((name, k) => ({ name, faces: groups[k] }));
        if (groups.every(g => g.length) && !kinds.every(x => x === 'plane')) {
          // A plane across a cylinder's axis, or a cone: the round revolved; a plane along the axis, or two parallel
          // cylinders: the round extruded.
          const k = kinds.indexOf('plane'), c = kinds.indexOf('cylinder'), cyl = c >= 0 ? faceGeometry(groups[c][0]) : null;
          const across = k >= 0 && cyl?.kind === 'cylinder' && Math.abs(dot(unit((faceGeometry(groups[k][0]) as { n: Point }).n), unit(cyl.a))) > 0.5;
          if (kinds.includes('other') || across) return one(revolvedFillet(brep, source, sides[0], sides[1], r, at, fail));
          if (kinds.every(x => x === 'cylinder' || x === 'plane')) return one(parallelFillet(brep, source, sides[0], sides[1], r, at, fail));
        }
        // Each face by its name (pieces `#k` of one plane together): its plane and its loops as rings of points.
        const planes = (names as string[]).map(name => {
          const group = brep.faces.filter(x => x.name === name || (x.name ?? '').split('#')[0] === name);
          if (!group.length) return fail('REFERENCE', `no face ${name} on the target`);
          const g = faceGeometry(group[0]);
          if (g.kind !== 'plane') return fail('CAPABILITY', `[FACE_FILLET_FACE] ${name} is not a planar face (a face fillet takes planes and cylinders: two planes, a plane and a cylinder across or along its axis, or two parallel cylinders)`);
          const rings = group.flatMap(x => x.loops.map(id => brep.loops.find(l => l.id === id)!.coedges.map(cid => {
            const c = coedges.get(cid)!, e = edges.get(c.edge)!;
            if (e.curve.degree !== 1 || e.curve.controlPoints.length !== 2) fail('CAPABILITY', `[FACE_FILLET_FACE] ${name} has a curved edge`);
            return points.get(c.sense === 'forward' ? e.vertices[0] : e.vertices[1])!;
          })));
          for (const x of group.slice(1)) { const h = faceGeometry(x); if (h.kind !== 'plane' || len(sub(h.n, g.n)) > 1e-9 || Math.abs(dot(sub(h.o, g.o), g.n)) > 1e-9 * Math.max(1, len(g.o))) fail('CAPABILITY', `[FACE_FILLET_FACE] the faces named ${name} are not one plane`); }
          return { name, n: unit(g.n), d: dot(unit(g.n), g.o), rings };
        });
        const [A, B] = planes, u = cross(A.n, B.n), uu = dot(u, u);
        if (!(Math.sqrt(uu) > 1e-9)) fail('CAPABILITY', `[FACE_FILLET_PARALLEL] ${A.name} and ${B.name} are parallel: their planes do not meet`);
        // The planes' meeting line: point C, direction t.
        const t = unit(u), C = scale(add(scale(cross(B.n, u), A.d), scale(cross(u, A.n), B.d)), 1 / uu);
        const all = [...A.rings.flat(), ...B.rings.flat()], size = Math.max(1, r, ...all.map(q => len(sub(q, C)))), tol = 1e-9 * size;
        // Each face's side of the line, in its plane and square to the line; the face must lie wholly on it.
        const toward = (S: typeof A) => {
          const q = S.rings.flat(), mid = scale(q.reduce((m, x) => add(m, x), [0, 0, 0] as Point), 1 / q.length), w = sub(mid, C), dir = unit(sub(w, scale(t, dot(w, t))));
          if (q.some(x => dot(sub(x, C), dir) < -tol)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${S.name} crosses the line where its plane meets the other's`);
          return dir;
        };
        const dA = toward(A), dB = toward(B), cos = Math.max(-1, Math.min(1, dot(dA, dB))), theta = Math.acos(cos);
        if (!(theta > 1e-6 && theta < Math.PI - 1e-6)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A.name} and ${B.name} lie in one plane`);
        // Inside corner: each face's outward normal points to the other's side.
        const sA = dot(A.n, dB), sB = dot(B.n, dA);
        if (!(Math.abs(sA) > 1e-9 && Math.sign(sA) === Math.sign(sB))) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A.name} and ${B.name} face neither into nor away from their corner`);
        const inside = sA > 0, a = r / Math.tan(theta / 2);
        // Over the length both faces run beside the line.
        const along = (S: typeof A) => S.rings.flat().map(x => dot(sub(x, C), t)), ta = along(A), tb = along(B), lo = Math.max(Math.min(...ta), Math.min(...tb)), hi = Math.min(Math.max(...ta), Math.max(...tb));
        if (!(hi - lo > tol)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A.name} and ${B.name} do not run side by side along their corner`);
        // Tangency: each face holds its tangent line (a from the corner) over [lo, hi].
        for (const [S, d] of [[A, dA], [B, dB]] as const) {
          const p2 = (x: Point): [number, number] => [dot(sub(x, C), t), dot(sub(x, C), d)];
          if (!lineInFace(S.rings.map(ring => ring.map(p2)), a, lo, hi, tol)) fail('GEOMETRY', `[FACE_FILLET_RADIUS] a ${r} mm round would not meet ${S.name} tangentially: the face stops before ${+a.toPrecision(9)} mm from the corner`);
        }
        // The round's section Q (corner, tangent point on A, the near arc, tangent point on B), laid along the line.
        const X = dA, Y = unit(sub(dB, scale(dA, cos))), Z = cross(X, Y), flip = dot(Z, t) < 0, z0 = flip ? -hi : lo, z1 = flip ? -lo : hi;
        const outer: ProfileSegmentInput[] = [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [a, 0], center: [a, r], direction: 'cw' }, { kind: 'line', start: [a * cos, a * Math.sin(theta)] }];
        const m: BrepAffine['matrix'] = [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
        const tool = affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: z1 - z0, from: z0, tag: at }) }, m, C, n => n === `${at}.side1` ? `${at}.round` : n);
        const area = a * r - r * r * (Math.PI - theta) / 2, held = boolean(source, tool, 'intersection', at), was = empty(held) ? 0 : exactVolume(held), before = exactVolume(source), L = hi - lo;
        const out = boolean(source, tool, inside ? 'union' : 'difference', at), change = exactVolume(out) - before, pieces = out.kind === 'brep' ? out.brep.bodies.length : 1;
        const want = inside ? area * L - was : -was, close = Math.abs(change - want) <= 1e-7 * Math.max(before, area * L);
        if (pieces !== 1 || !close || !(Math.abs(want) > 1e-9 * area * L)) fail('GEOMETRY', `[FACE_FILLET_NOT_CLEAR] the round between ${A.name} and ${B.name} would ${inside ? 'add' : 'take'} ${+Math.abs(change).toPrecision(9)} mm³ (${+Math.abs(want).toPrecision(9)} expected)${pieces !== 1 ? ` and leave ${pieces} bodies` : ''}`);
        return one(out);
      };
      return () => {
        try { return built(); }
        catch (cause) {
          // (Only a pair of kinds the sections do not take: parallel faces never meet, the ball cannot help them.)
          if (!(cause instanceof CadPartError) || cause.details.category !== 'CAPABILITY' || !/\[FACE_FILLET_FACE\]/.test(cause.message)) throw cause;
          let part: Part = target[0], shared = sharedEdges(brepOf(part, at), names as string[]);
          if (!shared.length) {
            // F1: apart — restore the corner between them (what lies there removed or filled), then the same.
            const restored = restoreCorner(brepOf(part, at), part.solid, (names as string[]).map(name => ({ name, faces: brepOf(part, at).faces.filter(x => x.name === name || (x.name ?? '').split('#')[0] === name) })), r, at, fail);
            if (!restored) {
              // A bounded convex polynomial corner can replace its old strip directly. Analytic restores keep priority.
              try {
                const made = polynomialFaceFillet(brepOf(part, at), names as [string, string], r, at);
                if (made) return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, fillet: [made.report] }] };
              } catch (error) {
                const refusal = error instanceof BrepError ? /^B-rep: (SELECTION|CAPABILITY|PARAMETER): (.*)$/s.exec(error.message) : null;
                if (refusal) fail(refusal[1] as CadPartErrorCode, refusal[2]);
                throw error;
              }
              throw cause;
            }
            part = { solid: restored }; shared = sharedEdges(brepOf(part, at), names as string[]);
            if (!shared.length) fail('GEOMETRY', `[FACE_FILLET_NOT_CLEAR] ${(names as string[]).join(' and ')} do not meet once the corner between them is restored`);
          }
          const reports: FilletReport[] = [], solid = finishEdges(part, shared, r, 'fillet', at, fail, reports);
          return { kind: 'solid', parts: [{ solid, ...(reports.length ? { fillet: reports } : {}) }] };
        }
      };
    }
  }
  throw new Error(`faceFilletOperation: ${f.kind} is not one of its features`);
}
/** A face's analytic surface, for the corner restore: its signed distance (outside +) and a shell d thick beside it. */
export interface Analytic { readonly dist: (x: Point) => number; readonly shell: (d: number, side: 1 | -1, margin: number, tag: string) => Solid | null }
export function analyticOf(S: { name: string; faces: readonly BrepFace[] }, brep: Brep, size: number): Analytic | null {
  if (!S.faces.length || S.faces.some(x => x.surface.kind === 'facets')) return null;
  const g = faceGeometry(S.faces[0]), pts = boundaryOf(brep, S.faces).flat();
  if (g.kind === 'plane') {
    const n = unit(g.n), o = g.o, u = unit(Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0])), v = cross(n, u);
    const us = pts.map(q => dot(sub(q, o), u)), vs = pts.map(q => dot(sub(q, o), v));
    return {
      dist: x => dot(sub(x, o), n),
      shell: (d, side, margin, tag) => {
        const [u0, u1, v0, v1] = [Math.min(...us) - margin, Math.max(...us) + margin, Math.min(...vs) - margin, Math.max(...vs) + margin];
        const box: Solid = { kind: 'upright', solid: prismaticFromProfile({ outer: [{ kind: 'line', start: [u0, v0] }, { kind: 'line', start: [u1, v0] }, { kind: 'line', start: [u1, v1] }, { kind: 'line', start: [u0, v1] }], height: d, from: side > 0 ? 0 : -d, tag }) };
        return affine(box, [u[0], v[0], n[0], u[1], v[1], n[1], u[2], v[2], n[2]], o);
      },
    };
  }
  const R = revolutionOf(nurbsOf(S.faces[0]), size);
  if (!R) return null;
  const toRH = (x: Point): XY2 => { const w = sub(x, R.c), h = dot(w, R.a); return [len(sub(w, scale(R.a, h))), h]; };
  // The outward side in the half-plane: from the surface's normal at its middle (the face's sense kept).
  const F = nurbsOf(S.faces[0]), { u, v } = surfaceDomain(F), um = (u[0] + u[1]) / 2, vm = (v[0] + v[1]) / 2, du = 1e-6 * (u[1] - u[0]), dv = 1e-6 * (v[1] - v[0]);
  const P = evaluateSurface(F, um, vm) as Point, N3 = scale(unit(cross(sub(evaluateSurface(F, um + du, vm) as Point, P), sub(evaluateSurface(F, um, vm + dv) as Point, P))), S.faces[0].sense === 'forward' ? 1 : -1);
  const radial = unit(sub(sub(P, R.c), scale(R.a, dot(sub(P, R.c), R.a)))), n2: XY2 = [dot(N3, radial), dot(N3, R.a)], P2 = toRH(P), rh = pts.map(toRH);
  const Z = cross(R.e1, R.a), m: BrepAffine['matrix'] = [R.e1[0], R.a[0], Z[0], R.e1[1], R.a[1], Z[1], R.e1[2], R.a[2], Z[2]];
  const revolved = (outer: ProfileSegmentInput[], tag: string): Solid => affine({ kind: 'brep', brep: revolveProfile({ id: tag, profile: outer, axis: { origin: [0, 0], direction: [0, 1] }, angle: 360 }) }, m, R.c);
  const pr = R.profile;
  if (pr.kind === 'line') {
    const dl = sub2(pr.q, pr.p), t = unit2(dl), side0 = Math.sign(cross2(t, n2)) || 1, nrm: XY2 = [-t[1] * side0, t[0] * side0];
    const ss = rh.map(q => (q[0] - pr.p[0]) * t[0] + (q[1] - pr.p[1]) * t[1]);
    return {
      dist: x => { const q = toRH(x); return (q[0] - pr.p[0]) * nrm[0] + (q[1] - pr.p[1]) * nrm[1]; },
      shell: (d, side, margin, tag) => {
        const s0 = Math.min(...ss) - margin, s1 = Math.max(...ss) + margin, at2 = (s: number, off: number): XY2 => [pr.p[0] + t[0] * s + nrm[0] * off, pr.p[1] + t[1] * s + nrm[1] * off];
        const corners = [at2(s0, 0), at2(s1, 0), at2(s1, side * d), at2(s0, side * d)];
        if (corners.some(q => q[0] <= 1e-9 * size)) return null;
        return revolved(corners.map(start => ({ kind: 'line', start })), tag);
      },
    };
  }
  const out: 1 | -1 = n2[0] * (P2[0] - pr.c[0]) + n2[1] * (P2[1] - pr.c[1]) > 0 ? 1 : -1, ang = (q: XY2) => Math.atan2(q[1] - pr.c[1], q[0] - pr.c[0]);
  const mid = ang(P2), as = rh.map(q => { let a = ang(q) - mid; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; });
  return {
    dist: x => (len2(sub2(toRH(x), pr.c)) - pr.r) * out,
    shell: (d, side, margin, tag) => {
      const a0 = mid + Math.max(-Math.PI + 1e-3, Math.min(...as) - margin / pr.r), a1 = mid + Math.min(Math.PI - 1e-3, Math.max(...as) + margin / pr.r), r2 = pr.r + side * out * d;
      const pt = (a: number, rr: number): XY2 => [pr.c[0] + rr * Math.cos(a), pr.c[1] + rr * Math.sin(a)];
      const ring = [pt(a0, pr.r), pt(a1, pr.r), pt(a1, r2), pt(a0, r2)];
      if (!(r2 > 1e-9 * size) || ring.some(q => q[0] <= 1e-9 * size)) return null;
      return revolved([{ kind: 'arc', start: ring[0], center: pr.c, direction: 'ccw' }, { kind: 'line', start: ring[1] }, { kind: 'arc', start: ring[2], center: pr.c, direction: 'cw' }, { kind: 'line', start: ring[3] }], tag);
    },
  };
}

/**
 * The corner between two faces that do not meet, restored (F1): whatever lies within d of both their surfaces on the
 * corner's side — an earlier round, a chamfer, a step — removed (an inside corner: the body less the outer shells'
 * overlap W) or filled (an outside corner: the body and the inner shells' overlap), so the two meet along their
 * surfaces' intersection. Which side, from a face between them (its vertices within d of both, outside both or inside
 * both). W's faces on A's or B's surface take their names. Null when the faces are not planes or surfaces of revolution.
 */
export function restoreCorner(brep: Brep, source: Solid, sides: readonly { name: string; faces: readonly BrepFace[] }[], r: number, at: string, fail: (code: CadPartErrorCode, detail: string) => never): Solid | null {
  const size = Math.max(1, r, ...brep.vertices.map(v => len(v.point))), surf = sides.map(S => analyticOf(S, brep, size));
  if (surf.some(x => !x)) return null;
  // (Two parallel planes never meet: there is no corner to restore.)
  const g = sides.map(S => faceGeometry(S.faces[0]));
  if (g[0].kind === 'plane' && g[1].kind === 'plane' && len(cross(unit(g[0].n), unit(g[1].n))) < 1e-9) return null;
  const [A, B] = surf as Analytic[], d = 3 * r, margin = d + 1e-3 * size, inSides = new Set(sides.flatMap(S => S.faces.map(x => x.id)));
  // (Points inside the faces, not their vertices: a round's lie on its contacts, on A or B.)
  const inner = (x: BrepFace): Point[] => { if (x.surface.kind === 'facets') return []; const F = nurbsOf(x), { u, v } = surfaceDomain(F); return [[0.5, 0.5], [0.3, 0.5], [0.7, 0.5], [0.5, 0.3], [0.5, 0.7]].map(([p, q]) => evaluateSurface(F, u[0] + (u[1] - u[0]) * p, v[0] + (v[1] - v[0]) * q) as Point); };
  // (Faces between the two border one of them: an edge shared with A or B — not a far face that happens to lie near both.)
  const loopsOf = new Map(brep.loops.map(l => [l.id, l.face])), sideEdges = new Set(brep.coedges.filter(c => inSides.has(loopsOf.get(c.loop)!)).map(c => c.edge));
  const bordering = new Set(brep.coedges.filter(c => sideEdges.has(c.edge)).map(c => loopsOf.get(c.loop)!));
  const between = brep.faces.filter(x => !inSides.has(x.id) && bordering.has(x.id)).flatMap(inner).map(q => [A.dist(q), B.dist(q)]).filter(([a, b]) => Math.abs(a) < d && Math.abs(b) < d);
  const outside = between.some(([a, b]) => a > 1e-7 * size && b > 1e-7 * size), insideBoth = between.some(([a, b]) => a < -1e-7 * size && b < -1e-7 * size);
  if (outside === insideBoth) fail('CAPABILITY', `[FACE_FILLET_FACES] nothing lies between ${sides[0].name} and ${sides[1].name} on one side of their corner to replace`);
  const side: 1 | -1 = outside ? 1 : -1;
  const shells = surf.map((x, k) => x!.shell(d, side, margin, `${at}_w${k}`));
  if (shells.some(x => !x)) fail('GEOMETRY', `[FACE_FILLET_RADIUS] a ${r} mm round's corner region would cross the axis`);
  const W = boolean(shells[0]!, shells[1]!, 'intersection', at);
  if (empty(W)) return null;
  const out = boolean(source, W, outside ? 'difference' : 'union', at), pieces = out.kind === 'brep' ? out.brep.bodies.length : 1;
  if (pieces !== 1) fail('GEOMETRY', `[FACE_FILLET_NOT_CLEAR] restoring the corner between ${sides[0].name} and ${sides[1].name} would leave ${pieces} bodies`);
  // W's faces left on A's or B's surface (every inner point on it) take that face's name.
  if (out.kind !== 'brep') return out;
  const named = out.brep.faces.map(x => { if (inSides.has(x.id)) return x; const q = inner(x); const k = q.length ? [A, B].findIndex(Sx => q.every(p => Math.abs(Sx.dist(p)) <= 1e-7 * size)) : -1; return k < 0 ? x : { ...x, name: sides[k].name }; });
  return { kind: 'brep', brep: { ...out.brep, faces: named } };
}

/** The names of the edges two named faces share (each face with its pieces `#k`), in the body's order; none when one has no name (the edge fillet finds edges by name). */
export function sharedEdges(brep: Brep, names: readonly string[]): string[] {
  const of = (name: string) => new Set(brep.faces.filter(x => x.name === name || (x.name ?? '').split('#')[0] === name).flatMap(x => x.loops));
  const [A, B] = names.map(of), byEdge = new Map<string, { a: boolean; b: boolean }>();
  for (const c of brep.coedges) { const u = byEdge.get(c.edge) ?? { a: false, b: false }; if (A.has(c.loop)) u.a = true; if (B.has(c.loop)) u.b = true; byEdge.set(c.edge, u); }
  const shared = brep.edges.filter(e => byEdge.get(e.id)?.a && byEdge.get(e.id)?.b);
  return shared.every(e => e.name) ? shared.map(e => e.name!) : [];
}

/** A face's boundary: the edges of its pieces not shared between them, each sampled as a polyline (lines as their ends). */
export function boundaryOf(brep: Brep, faces: readonly BrepFace[]): Point[][] {
  const loops = new Set(faces.flatMap(x => x.loops)), uses = new Map<string, number>(), edges = new Map(brep.edges.map(e => [e.id, e]));
  for (const c of brep.coedges) if (loops.has(c.loop)) uses.set(c.edge, (uses.get(c.edge) ?? 0) + 1);
  return [...uses].filter(([, k]) => k === 1).map(([id]) => { const e = edges.get(id)!, [t0, t1] = curveDomain(e.curve), N = e.curve.degree === 1 && e.curve.controlPoints.length === 2 ? 1 : 64; return Array.from({ length: N + 1 }, (_, i) => evaluateCurve(e.curve, t0 + (t1 - t0) * i / N) as Point); });
}
/** A circle through a polyline's points (its centre and unit normal), or null when they are not on one. */
export function circleOf(pts: readonly Point[]): { c: Point; n: Point; R: number } | null {
  if (pts.length < 3) return null;
  const A = pts[0], B = pts[Math.floor(pts.length / 3)], C = pts[Math.floor(2 * pts.length / 3)], ab = sub(B, A), ac = sub(C, A), n0 = cross(ab, ac), nn = dot(n0, n0);
  if (!(nn > 1e-24)) return null;
  const c = add(A, scale(add(scale(cross(n0, ab), dot(ac, ac)), scale(cross(ac, n0), dot(ab, ab))), 1 / (2 * nn))), R = len(sub(A, c));
  return pts.every(q => Math.abs(len(sub(q, c)) - R) <= 1e-7 * Math.max(1, R) && Math.abs(dot(sub(q, c), unit(n0))) <= 1e-7 * Math.max(1, R)) ? { c, n: unit(n0), R } : null;
}

/**
 * A face fillet between two faces that turn about one axis — a plane across it, a cylinder, a cone, a sphere, a torus
 * (a boss on a plate, a tapered boss, a disc's rim, a hole's or countersink's edge, a chamfer meeting a shaft, a ball
 * on a stem, a dome on a plate, beside an earlier round). In the half-plane through the axis (radius, height) each is a
 * line or a circle: the round's centre is where they meet pushed off by its radius (outward: an inside corner, filled;
 * inward: an outside one, cut), and its section — the corner, along one face to its tangent point, the round's short
 * arc, back along the other — is revolved about the axis; corners on several circles are each rounded. A cylinder,
 * cone, sphere or torus must be whole round and hold its tangent point along its generator; a plane must hold the
 * tangent circle; the volume is checked by Pappus (the section's area and first moment, its arcs exact).
 */
export function revolvedFillet(brep: Brep, source: Solid, A0: { name: string; faces: readonly BrepFace[] }, B0: { name: string; faces: readonly BrepFace[] }, r: number, at: string, fail: (code: CadPartErrorCode, detail: string) => never): Solid {
  const sides = [A0, B0].map(S => ({ ...S, g: faceGeometry(S.faces[0]), bound: boundaryOf(brep, S.faces) }));
  const unsupported = (S: typeof sides[number]) => fail('CAPABILITY', `[FACE_FILLET_FACE] ${S.name} is not a plane, cylinder, cone, sphere or torus turning about the other's axis (a face fillet takes these)`);
  // The axis: a cylinder's, else the common axis of a curved face's boundary circles.
  let O: Point, a: Point;
  const cyl = sides.find(S => S.g.kind === 'cylinder');
  if (cyl && cyl.g.kind === 'cylinder') { O = cyl.g.c; a = unit(cyl.g.a); }
  else {
    // (A cone's, sphere's or torus's own axis, as the kernel recognises it.)
    const S0 = sides.find(x => x.g.kind === 'other')!, R0 = S0.faces[0].surface.kind === 'facets' ? null : revolutionOf(nurbsOf(S0.faces[0]), Math.max(1, r, ...sides.flatMap(S => S.bound.flat().map(q => len(q)))));
    if (!R0) return unsupported(S0);
    O = R0.c; a = unit(R0.a);
  }
  const k0 = [0, 1, 2].reduce((m, k) => Math.abs(a[k]) > Math.abs(a[m]) ? k : m, 0); if (a[k0] < 0) a = scale(a, -1);
  const hOf = (q: Point) => dot(sub(q, O), a), radialOf = (q: Point) => sub(sub(q, O), scale(a, hOf(q))), rhoOf = (q: Point) => len(radialOf(q)), to2 = (q: Point): XY2 => [rhoOf(q), hOf(q)];
  const size = Math.max(1, r, ...sides.flatMap(S => S.bound.flat().map(q => len(sub(q, O))))), tol = 1e-9 * size, fit = 1e-7 * size;
  const wholeRound = (S: typeof sides[number]) => S.bound.every(e => circleOf(e) !== null);
  // Each face as a curve in the half-plane, with what it holds of it: a line's extent along it, a circle's arc.
  const curves = sides.map(S => {
    const pts = S.bound.flat().map(to2);
    if (S.g.kind === 'plane') {
      if (Math.abs(Math.abs(dot(unit(S.g.n), a)) - 1) > 1e-9) return fail('CAPABILITY', `[FACE_FILLET_FACE] ${S.name} is not square to the axis`);
      return { S, sec: { kind: 'line', p: [0, hOf(S.g.o)], n: [0, Math.sign(dot(unit(S.g.n), a))] } as Section2, flat: true, pts, mid: null as XY2 | null };
    }
    if (S.g.kind === 'cylinder') {
      if (len(cross(unit(S.g.a), a)) > 1e-9 || rhoOf(S.g.c) > tol) return fail('CAPABILITY', `[FACE_FILLET_FACE] ${S.name} does not turn about the other's axis`);
      if (!wholeRound(S)) return fail('CAPABILITY', `[FACE_FILLET_FACE] ${S.name} is not a whole round face`);
      return { S, sec: { kind: 'line', p: [S.g.r, 0], n: [S.g.out, 0] } as Section2, flat: false, pts, mid: null as XY2 | null };
    }
    // A cone, sphere or torus: its surface on one line or circle in the half-plane, whole round.
    if (S.faces.some(x => x.surface.kind === 'facets') || !wholeRound(S)) return unsupported(S);
    // Recognised by the kernel (revolutionOf): its axis must be the corner's, its meridian a line (a cone) or a circle
    // (a sphere, a torus), seen in this half-plane; every sample of every piece on it.
    const Rv = revolutionOf(nurbsOf(S.faces[0]), size);
    if (!Rv || len(cross(unit(Rv.a), a)) > 1e-9 || len(cross(sub(Rv.c, O), a)) > fit) return unsupported(S);
    const flip = dot(Rv.a, a) < 0 ? -1 : 1, off = dot(sub(Rv.c, O), a), toHalf = (q: XY2): XY2 => [q[0], off + flip * q[1]];
    const samples = S.faces.flatMap(x => { const F = nurbsOf(x), { u, v } = surfaceDomain(F); return Array.from({ length: 49 }, (_, i) => to2(evaluateSurface(F, u[0] + (u[1] - u[0]) * (i % 7) / 6, v[0] + (v[1] - v[0]) * Math.floor(i / 7) / 6) as Point)); });
    const F = nurbsOf(S.faces[0]), { u, v } = surfaceDomain(F), um = (u[0] + u[1]) / 2, vm = (v[0] + v[1]) / 2, du = 1e-6 * (u[1] - u[0]), dv = 1e-6 * (v[1] - v[0]);
    const P = evaluateSurface(F, um, vm) as Point, N3 = scale(unit(cross(sub(evaluateSurface(F, um + du, vm) as Point, P), sub(evaluateSurface(F, um, vm + dv) as Point, P))), S.faces[0].sense === 'forward' ? 1 : -1);
    const P2 = to2(P), n2: XY2 = [dot(N3, unit(radialOf(P))), dot(N3, a)], pr = Rv.profile;
    if (pr.kind === 'line') {
      const p0 = toHalf(pr.p), d = unit2(sub2(toHalf(pr.q), p0));
      if (Math.abs(d[0]) <= 1e-9 || Math.abs(d[1]) <= 1e-9 || samples.some(q => Math.abs(cross2(d, sub2(q, p0))) > fit)) return unsupported(S);
      const side = Math.sign(cross2(d, n2)) || 1;
      return { S, sec: { kind: 'line', p: p0, n: [-d[1] * side, d[0] * side] } as Section2, flat: false, pts: samples, mid: null as XY2 | null };
    }
    const cc = toHalf(pr.c), R = pr.r;
    if (samples.some(q => Math.abs(len2(sub2(q, cc)) - R) > fit)) return unsupported(S);
    const out: 1 | -1 = n2[0] * (P2[0] - cc[0]) + n2[1] * (P2[1] - cc[1]) > 0 ? 1 : -1;
    return { S, sec: { kind: 'circle', c: cc, R, out } as Section2, flat: false, pts: samples, mid: P2 };
  });
  // Whether a face holds a section point T: a plane the circle through it, a line face its extent, a circle face its arc.
  const holds = (k: number, T: XY2) => {
    const K = curves[k], c = K.sec;
    if (K.flat) {
      const rho = T[0], crossing = K.S.bound.some(e => e.some((q, i) => i > 0 && (rhoOf(e[i - 1]) - rho) * (rhoOf(q) - rho) < -1e-14 * size * size));
      const e1 = unit(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])), e2 = cross(a, e1), flat = (q: Point): XY2 => [dot(sub(q, O), e1), dot(sub(q, O), e2)];
      const flats = K.S.bound.map(e => e.map(flat)), probe = (phi: number): XY2 => [rho * Math.cos(phi), rho * Math.sin(phi)];
      const away = (pt: XY2) => Math.min(...flats.flat().map(q => Math.hypot(q[0] - pt[0], q[1] - pt[1])));
      const best = Array.from({ length: 8 }, (_, i) => probe(i * Math.PI / 4)).reduce((m, pt) => away(pt) > away(m) ? pt : m);
      const inFace = flats.reduce((n, e) => n + e.filter((pt, i) => { if (i === 0) return false; const q = e[i - 1]; return (pt[1] > best[1]) !== (q[1] > best[1]) && best[0] < pt[0] + (best[1] - pt[1]) * (q[0] - pt[0]) / (q[1] - pt[1]); }).length, 0) % 2 === 1;
      return !crossing && inFace && rho > tol;
    }
    if (c.kind === 'line') { const d: XY2 = [-c.n[1], c.n[0]], ts = K.pts.map(q => (q[0] - c.p[0]) * d[0] + (q[1] - c.p[1]) * d[1]), t = (T[0] - c.p[0]) * d[0] + (T[1] - c.p[1]) * d[1]; return t >= Math.min(...ts) - fit && t <= Math.max(...ts) + fit; }
    const ang = (q: XY2) => { const w = sub2(q, c.c), m = sub2(K.mid!, c.c); return Math.atan2(cross2(m, w), m[0] * w[0] + m[1] * w[1]); };
    const as = K.pts.map(ang), t = ang(T); return t >= Math.min(...as) - fit / c.R && t <= Math.max(...as) + fit / c.R;
  };
  const found: { s: 1 | -1; X: XY2; tA: XY2; tB: XY2; C: XY2 }[] = [], missed: string[] = [];
  for (const s of [1, -1] as const) for (const X of meet2(offset2(curves[0].sec, s * r), offset2(curves[1].sec, s * r))) {
    const tA = foot2(curves[0].sec, X), tB = foot2(curves[1].sec, X), corners = meet2(curves[0].sec, curves[1].sec).sort((p, q) => len2(sub2(p, X)) - len2(sub2(q, X)));
    if (!corners.length) continue;
    if (!holds(0, tA)) { missed.push(A0.name); continue; }
    if (!holds(1, tB)) { missed.push(B0.name); continue; }
    found.push({ s, X, tA, tB, C: corners[0] });
  }
  if (!found.length && missed.length) fail('GEOMETRY', `[FACE_FILLET_RADIUS] a ${r} mm round would not meet ${[...new Set(missed)].join(' or ')} tangentially: its tangent point lies off the face`);
  if (!found.length) fail('GEOMETRY', `[FACE_FILLET_RADIUS] no ${r} mm round is tangent to both ${A0.name} and ${B0.name} (their surfaces do not meet)`);
  const corners = found.filter((f, k) => found.findIndex(g => len2(sub2(g.C, f.C)) <= 1e-9 * size) === k);
  if (corners.some(f => f.s !== corners[0].s)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A0.name} and ${B0.name} make an inside and an outside corner: a ${r} mm round fits both ways`);
  const inside = corners[0].s > 0;
  // The rounds' seam laid where a face's own seam is (the line its halves share): a seam met off it breaks the Boolean's
  // topology; with none, square to the axis from its first coordinate direction.
  const seamOf = (S: typeof sides[number]) => { const loops = new Set(S.faces.flatMap(x => x.loops)), uses = new Map<string, number>(); for (const c of brep.coedges) if (loops.has(c.loop)) uses.set(c.edge, (uses.get(c.edge) ?? 0) + 1); const id = [...uses].find(([, k]) => k === 2)?.[0]; return id === undefined ? null : brep.vertices.find(v => v.id === brep.edges.find(e => e.id === id)!.vertices[0])!.point; };
  const seam = [...sides].sort((p, q) => (p.g.kind === 'other' ? 0 : 1) - (q.g.kind === 'other' ? 0 : 1)).map(seamOf).find(x => x && rhoOf(x) > tol);
  const e1 = seam ? unit(radialOf(seam)) : unit(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])), Z = cross(e1, a), m: BrepAffine['matrix'] = [e1[0], a[0], Z[0], e1[1], a[1], Z[1], e1[2], a[2], Z[2]];
  const along = (c: Section2, P: XY2, Q: XY2): ProfileSegmentInput => c.kind === 'line' ? { kind: 'line', start: P } : { kind: 'arc', start: P, center: c.c, direction: shortWay(P, Q, c.c) };
  let out = source;
  corners.forEach(({ X, tA, tB, C }, k) => {
    const outer: ProfileSegmentInput[] = [along(curves[0].sec, C, tA), { kind: 'arc', start: tA, center: X, direction: shortWay(tA, tB, X) }, along(curves[1].sec, tB, C)];
    // The section stays off the axis.
    if (!([C, tA, tB].every(q => q[0] > tol) && X[0] - r > -tol)) fail('GEOMETRY', `[FACE_FILLET_RADIUS] a ${r} mm round would cross the axis`);
    const { area, moment } = loopMoments2(outer), V = 2 * Math.PI * Math.abs(moment), tag = k ? `${at}_${k}` : at, name = k ? `${at}.round${k}` : `${at}.round`;
    const made = revolveProfile({ id: tag, profile: outer, axis: { origin: [0, 0], direction: [0, 1] }, angle: 360 });
    const tool = affine({ kind: 'brep', brep: made }, m, O, x => x.startsWith(`${tag}.side1`) ? `${name}${x.slice(`${tag}.side1`.length)}` : x);
    const held = boolean(out, tool, 'intersection', at), was = empty(held) ? 0 : exactVolume(held), before = exactVolume(out);
    const next = boolean(out, tool, inside ? 'union' : 'difference', at), change = exactVolume(next) - before, pieces = next.kind === 'brep' ? next.brep.bodies.length : 1, want = inside ? V - was : -was;
    if (pieces !== 1 || Math.abs(change - want) > 1e-7 * Math.max(before, V) || !(Math.abs(want) > 1e-9 * V) || !(Math.abs(area) > 0)) fail('GEOMETRY', `[FACE_FILLET_NOT_CLEAR] the round between ${A0.name} and ${B0.name} would ${inside ? 'add' : 'take'} ${+Math.abs(change).toPrecision(9)} mm³ (${+Math.abs(want).toPrecision(9)} expected)${pieces !== 1 ? ` and leave ${pieces} bodies` : ''}`);
    out = next;
  });
  return out;
}

export type XY2 = [number, number];
/** A face seen in the section square to the fillet's direction: a line (a point, its outward normal) or a circle. */
export type Section2 = { kind: 'line'; p: XY2; n: XY2 } | { kind: 'circle'; c: XY2; R: number; out: 1 | -1 };
export const sub2 = (a: XY2, b: XY2): XY2 => [a[0] - b[0], a[1] - b[1]], cross2 = (a: XY2, b: XY2) => a[0] * b[1] - a[1] * b[0], len2 = (a: XY2) => Math.hypot(a[0], a[1]);
export const unit2 = (a: XY2): XY2 => { const l = len2(a); return [a[0] / l, a[1] / l]; };
/** A section curve pushed off by `by` along its outward normal. */
export function offset2(c: Section2, by: number): Section2 { return c.kind === 'line' ? { ...c, p: [c.p[0] + c.n[0] * by, c.p[1] + c.n[1] * by] } : { ...c, R: c.R + by * c.out }; }
/** Where two section curves meet (none, one or two points). */
export function meet2(a: Section2, b: Section2): XY2[] {
  if (a.kind === 'line' && b.kind === 'line') {
    const da: XY2 = [-a.n[1], a.n[0]], db: XY2 = [-b.n[1], b.n[0]], den = cross2(da, db);
    if (Math.abs(den) < 1e-12) return [];
    const t = cross2(sub2(b.p, a.p), db) / den; return [[a.p[0] + da[0] * t, a.p[1] + da[1] * t]];
  }
  if (a.kind === 'circle' && b.kind === 'line') return meet2(b, a);
  if (a.kind === 'line' && b.kind === 'circle') {
    const dir: XY2 = [-a.n[1], a.n[0]], w = sub2(a.p, b.c), along = w[0] * dir[0] + w[1] * dir[1], dist = w[0] * a.n[0] + w[1] * a.n[1], h2 = b.R * b.R - dist * dist;
    if (h2 < 0) return [];
    const foot: XY2 = [a.p[0] - dir[0] * along, a.p[1] - dir[1] * along], h = Math.sqrt(h2);
    return [[foot[0] + dir[0] * h, foot[1] + dir[1] * h], [foot[0] - dir[0] * h, foot[1] - dir[1] * h]];
  }
  const A = a as Extract<Section2, { kind: 'circle' }>, B = b as Extract<Section2, { kind: 'circle' }>, w = sub2(B.c, A.c), D = len2(w);
  if (!(D > 1e-12) || D > A.R + B.R || D < Math.abs(A.R - B.R)) return [];
  const x = (D * D + A.R * A.R - B.R * B.R) / (2 * D), h = Math.sqrt(Math.max(0, A.R * A.R - x * x)), u: XY2 = [w[0] / D, w[1] / D];
  return [[A.c[0] + u[0] * x - u[1] * h, A.c[1] + u[1] * x + u[0] * h], [A.c[0] + u[0] * x + u[1] * h, A.c[1] + u[1] * x - u[0] * h]];
}
/** The point of a section curve nearest X (a ball's tangent point). */
export function foot2(c: Section2, X: XY2): XY2 {
  if (c.kind === 'line') { const d = (X[0] - c.p[0]) * c.n[0] + (X[1] - c.p[1]) * c.n[1]; return [X[0] - c.n[0] * d, X[1] - c.n[1] * d]; }
  const w = sub2(X, c.c), l = len2(w); return [c.c[0] + w[0] / l * c.R, c.c[1] + w[1] / l * c.R];
}
/** The short way round a circle from P to Q about M. */
export const shortWay = (P: XY2, Q: XY2, M: XY2): 'cw' | 'ccw' => cross2(sub2(P, M), sub2(Q, M)) > 0 ? 'ccw' : 'cw';
/** A closed loop's signed area (counter-clockwise positive), its arcs exact: each chord's triangle plus the arc's segment. */
export function loopArea2(loop: readonly ProfileSegmentInput[]): number {
  let A = 0;
  loop.forEach((g, k) => {
    const P = g.start as XY2, Q = loop[(k + 1) % loop.length].start as XY2; A += cross2(P, Q) / 2;
    if (g.kind === 'arc') { const M = g.center as XY2, R = len2(sub2(P, M)), phi = Math.abs(Math.atan2(cross2(sub2(P, M), sub2(Q, M)), (P[0] - M[0]) * (Q[0] - M[0]) + (P[1] - M[1]) * (Q[1] - M[1]))); A += (g.direction === 'ccw' ? 1 : -1) * R * R / 2 * (phi - Math.sin(phi)); }
  });
  return A;
}
/**
 * A closed loop's signed area and first moment about the y axis (∫∫ x dA), by Green's theorem (∮ x dy, ∮ x²/2 dy):
 * lines in closed form, arcs integrated exactly over their sweep.
 */
export function loopMoments2(loop: readonly ProfileSegmentInput[]): { area: number; moment: number } {
  let area = 0, moment = 0;
  loop.forEach((g, k) => {
    const P = g.start as XY2, Q = loop[(k + 1) % loop.length].start as XY2;
    if (g.kind !== 'arc') { area += (Q[1] - P[1]) * (P[0] + Q[0]) / 2; moment += (Q[1] - P[1]) * (P[0] * P[0] + P[0] * Q[0] + Q[0] * Q[0]) / 6; return; }
    const M = g.center as XY2, R = len2(sub2(P, M)), t0 = Math.atan2(P[1] - M[1], P[0] - M[0]);
    let sweep = Math.atan2(Q[1] - M[1], Q[0] - M[0]) - t0;
    if (g.direction === 'ccw') { while (sweep <= 0) sweep += 2 * Math.PI; } else { while (sweep >= 0) sweep -= 2 * Math.PI; }
    const t1 = t0 + sweep, cx = M[0], S1 = (t: number) => Math.sin(t), C2 = (t: number) => t / 2 + Math.sin(2 * t) / 4, C3 = (t: number) => Math.sin(t) - Math.sin(t) ** 3 / 3;
    // x = cx + R cos t, dy = R cos t dt.
    area += cx * R * (S1(t1) - S1(t0)) + R * R * (C2(t1) - C2(t0));
    moment += (cx * cx * R * (S1(t1) - S1(t0)) + 2 * cx * R * R * (C2(t1) - C2(t0)) + R ** 3 * (C3(t1) - C3(t0))) / 2;
  });
  return { area, moment };
}
/** Whether the segment y = h, x in [x0, x1] lies inside the region bounded by these polylines (even-odd), its boundary included. */
export function lineInSoup(lines: readonly (readonly XY2[])[], h: number, x0: number, x1: number, tol: number): boolean {
  const segs: [XY2, XY2][] = lines.flatMap(l => l.slice(1).map((q, k) => [l[k], q] as [XY2, XY2]));
  const onEdge = (x: number, y: number) => segs.some(([p, q]) => { const dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy, s = l2 > 0 ? Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / l2)) : 0; return Math.hypot(p[0] + s * dx - x, p[1] + s * dy - y) <= tol; });
  const inside = (x: number, y: number) => onEdge(x, y) || segs.filter(([p, q]) => (p[1] > y) !== (q[1] > y) && x < p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1])).length % 2 === 1;
  const xs = [x0, x1];
  for (const [p, q] of segs) { if (Math.abs(p[1] - h) <= tol) xs.push(p[0]); if ((p[1] - h) * (q[1] - h) < 0) xs.push(p[0] + (h - p[1]) * (q[0] - p[0]) / (q[1] - p[1])); }
  const cuts = [...new Set(xs.filter(x => x >= x0 - tol && x <= x1 + tol).map(x => Math.min(x1, Math.max(x0, x))))].sort((p, q) => p - q);
  return cuts.every((x, k) => inside(x, h) && (k === 0 || inside((cuts[k - 1] + x) / 2, h)));
}

/**
 * A face fillet between faces that all run along one direction — a plane along a cylinder's axis (a tube on a plate),
 * or two parallel cylinders (two bosses joined) — that need not touch. In the section square to the direction the faces
 * are lines and circles: the round's centre is where their curves pushed off by the radius meet (outward for an inside
 * corner, filled; inward for an outside one, cut), and its section — the corner where the curves meet, along one face
 * to its tangent point, the round's short arc, back along the other — is extruded over the length both faces run.
 * Faces that meet at two corners (a tube on a plate, two joined bosses) are rounded at both.
 * Each face (a cylinder may be partial) must hold its tangent line there; the volume is checked against the section's
 * exact area.
 */
export function parallelFillet(brep: Brep, source: Solid, A0: { name: string; faces: readonly BrepFace[] }, B0: { name: string; faces: readonly BrepFace[] }, r: number, at: string, fail: (code: CadPartErrorCode, detail: string) => never): Solid {
  const sides = [A0, B0].map(S => ({ ...S, g: faceGeometry(S.faces[0]) }));
  const cyl = sides.find(S => S.g.kind === 'cylinder')!.g as Extract<FaceGeometry, { kind: 'cylinder' }>, d = unit(cyl.a), O = cyl.c;
  for (const S of sides) {
    for (const x of S.faces.slice(1)) { const h = faceGeometry(x); if (h.kind !== S.g.kind || (h.kind === 'plane' && S.g.kind === 'plane' && len(sub(unit(h.n), unit(S.g.n))) > 1e-9) || (h.kind === 'cylinder' && S.g.kind === 'cylinder' && (Math.abs(h.r - S.g.r) > 1e-9 * Math.max(1, S.g.r) || len(cross(sub(h.c, S.g.c), unit(S.g.a))) > 1e-9 * Math.max(1, S.g.r)))) fail('CAPABILITY', `[FACE_FILLET_FACE] the faces named ${S.name} are not one surface`); }
    if (S.g.kind === 'plane' && Math.abs(dot(unit(S.g.n), d)) > 1e-9) fail('CAPABILITY', `[FACE_FILLET_FACE] ${S.name} is neither across nor along the cylinder's axis`);
    if (S.g.kind === 'cylinder' && len(cross(unit(S.g.a), d)) > 1e-9) fail('CAPABILITY', `[FACE_FILLET_FACE] ${A0.name} and ${B0.name} are cylinders whose axes are not parallel`);
  }
  const e1 = unit(Math.abs(d[0]) < 0.9 ? cross(d, [1, 0, 0]) : cross(d, [0, 1, 0])), e2 = cross(d, e1);
  const to2 = (q: Point): XY2 => [dot(sub(q, O), e1), dot(sub(q, O), e2)], hOf = (q: Point) => dot(sub(q, O), d);
  const curves: Section2[] = sides.map(S => S.g.kind === 'plane' ? { kind: 'line', p: to2(S.g.o), n: [dot(unit(S.g.n), e1), dot(unit(S.g.n), e2)] } : { kind: 'circle', c: to2((S.g as { c: Point }).c), R: (S.g as { r: number }).r, out: (S.g as { out: 1 | -1 }).out });
  const edges = new Map(brep.edges.map(e => [e.id, e]));
  // Each face's boundary (edges not shared between its pieces), sampled.
  const bounds = sides.map(S => {
    const loops = new Set(S.faces.flatMap(x => x.loops)), uses = new Map<string, number>();
    for (const c of brep.coedges) if (loops.has(c.loop)) uses.set(c.edge, (uses.get(c.edge) ?? 0) + 1);
    return [...uses].filter(([, k]) => k === 1).map(([id]) => { const e = edges.get(id)!, [t0, t1] = curveDomain(e.curve), N = e.curve.degree === 1 && e.curve.controlPoints.length === 2 ? 1 : 64; return Array.from({ length: N + 1 }, (_, i) => evaluateCurve(e.curve, t0 + (t1 - t0) * i / N) as Point); });
  });
  const hs = bounds.map(b => b.flat().map(hOf)), lo = Math.max(...hs.map(h => Math.min(...h))), hi = Math.min(...hs.map(h => Math.max(...h)));
  const size = Math.max(1, r, ...curves.map(c => c.kind === 'circle' ? c.R + len2(c.c) : len2(c.p))), tol = 1e-9 * size;
  if (!(hi - lo > tol)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A0.name} and ${B0.name} do not run side by side`);
  // Whether a face holds the line along the direction through a section point T, over [lo, hi].
  const holds = (k: number, T: XY2) => {
    const c = curves[k], lines = c.kind === 'line'
      ? bounds[k].map(l => l.map(q => [hOf(q), cross2(c.n, sub2(to2(q), T))] as XY2))
      : bounds[k].map(l => l.map(q => { const w = sub2(to2(q), c.c), t = sub2(T, c.c); return [hOf(q), c.R * Math.atan2(cross2(t, w), t[0] * w[0] + t[1] * w[1])] as XY2; })).flatMap(l => {
        // (Split where the angle jumps round the back of the cylinder.)
        const parts: XY2[][] = [[]]; l.forEach((p, i) => { if (i && Math.abs(p[1] - l[i - 1][1]) > Math.PI * c.R) parts.push([]); parts[parts.length - 1].push(p); }); return parts.filter(x => x.length > 1);
      });
    return lineInSoup(lines, 0, lo, hi, 1e-7 * size);
  };
  // The round's centre: the curves pushed off by r meet there, outward (inside corner) or inward (outside corner).
  const found: { s: 1 | -1; X: XY2; tA: XY2; tB: XY2; C: XY2 }[] = [];
  for (const s of [1, -1] as const) for (const X of meet2(offset2(curves[0], s * r), offset2(curves[1], s * r))) {
    const tA = foot2(curves[0], X), tB = foot2(curves[1], X), corners = meet2(curves[0], curves[1]).sort((p, q) => len2(sub2(p, X)) - len2(sub2(q, X)));
    if (!corners.length || !holds(0, tA) || !holds(1, tB)) continue;
    found.push({ s, X, tA, tB, C: corners[0] });
  }
  if (!found.length) fail('GEOMETRY', `[FACE_FILLET_RADIUS] no ${r} mm round is tangent to both ${A0.name} and ${B0.name} where they run (or their surfaces do not meet)`);
  // Every corner the faces meet at is rounded, all inside or all outside; both kinds at once is no one corner's round.
  const corners = found.filter((f, k) => found.findIndex(g => len2(sub2(g.C, f.C)) <= 1e-9 * size) === k);
  if (corners.some(f => f.s !== corners[0].s)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A0.name} and ${B0.name} make an inside and an outside corner: a ${r} mm round fits both ways`);
  const inside = corners[0].s > 0, L = hi - lo, m: BrepAffine['matrix'] = [e1[0], e2[0], d[0], e1[1], e2[1], d[1], e1[2], e2[2], d[2]];
  // Each section: corner → along the first face → the round's short arc → along the second face back to the corner.
  const along = (c: Section2, P: XY2, Q: XY2): ProfileSegmentInput => c.kind === 'line' ? { kind: 'line', start: P } : { kind: 'arc', start: P, center: c.c, direction: shortWay(P, Q, c.c) };
  let out = source;
  corners.forEach(({ X, tA, tB, C }, k) => {
    const outer: ProfileSegmentInput[] = [along(curves[0], C, tA), { kind: 'arc', start: tA, center: X, direction: shortWay(tA, tB, X) }, along(curves[1], tB, C)];
    const area = Math.abs(loopArea2(outer)), tag = `${at}.q${k}`, name = k ? `${at}.round${k}` : `${at}.round`;
    const tool = affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: L, from: lo, tag }) }, m, O, x => x === `${tag}.side1` ? name : x);
    const held = boolean(out, tool, 'intersection', at), was = empty(held) ? 0 : exactVolume(held), before = exactVolume(out);
    const next = boolean(out, tool, inside ? 'union' : 'difference', at), change = exactVolume(next) - before, pieces = next.kind === 'brep' ? next.brep.bodies.length : 1, want = inside ? area * L - was : -was;
    if (pieces !== 1 || Math.abs(change - want) > 1e-7 * Math.max(before, area * L) || !(Math.abs(want) > 1e-9 * area * L)) fail('GEOMETRY', `[FACE_FILLET_NOT_CLEAR] the round between ${A0.name} and ${B0.name} would ${inside ? 'add' : 'take'} ${+Math.abs(change).toPrecision(9)} mm³ (${+Math.abs(want).toPrecision(9)} expected)${pieces !== 1 ? ` and leave ${pieces} bodies` : ''}`);
    out = next;
  });
  return out;
}

/**
 * Whether the segment y = h, x in [x0, x1] lies in a face (its rings in the plane's coordinates; the first of each
 * piece outer, the rest holes — tested by even-odd crossing, so the order does not matter), its boundary included.
 */
export function lineInFace(rings: readonly (readonly [number, number][])[], h: number, x0: number, x1: number, tol: number): boolean {
  const onEdge = (x: number, y: number) => rings.some(ring => ring.some((p, k) => { const q = ring[(k + 1) % ring.length], dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy;
    const s = l2 > 0 ? Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / l2)) : 0; return Math.hypot(p[0] + s * dx - x, p[1] + s * dy - y) <= tol; }));
  const inside = (x: number, y: number) => onEdge(x, y) || rings.reduce((n, ring) => n + ring.filter((p, k) => { const q = ring[(k + 1) % ring.length]; return (p[1] > y) !== (q[1] > y) && x < p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1]); }).length, 0) % 2 === 1;
  // Where the boundary meets the line: between those, the line is wholly in or out.
  const xs = [x0, x1];
  for (const ring of rings) ring.forEach((p, k) => { const q = ring[(k + 1) % ring.length];
    if (Math.abs(p[1] - h) <= tol) xs.push(p[0]);
    if ((p[1] - h) * (q[1] - h) < 0) xs.push(p[0] + (h - p[1]) * (q[0] - p[0]) / (q[1] - p[1])); });
  const cuts = [...new Set(xs.filter(x => x >= x0 - tol && x <= x1 + tol).map(x => Math.min(x1, Math.max(x0, x))))].sort((p, q) => p - q);
  return cuts.every((x, k) => inside(x, h) && (k === 0 || inside((cuts[k - 1] + x) / 2, h)));
}

