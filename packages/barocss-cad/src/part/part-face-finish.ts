// Native-face finishing cases moved unchanged from part-model.ts. Runtime helpers stay with their original owner.
import { isFacetFace, type Brep } from '../brep/brep-core.js';
import { faceGeometry } from '../brep/analytic-boolean.js';
import { prismaticFromProfile, type PrismaticSolid } from '../features/prismatic-solid.js';
import { isMeshBrepError } from '../mesh/mesh-brep.js';
import { threadSolid } from '../machine/thread-solid.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import type { BrepAffine } from '../brep/brep-transform.js';
import type { XY } from '../brep/curved-arrangement.js';
import type { Point } from '../types.js';
import type { ProfileSegmentInput } from '../features/extruded-profile-solid.js';
import type { CadPartDim, CadPartFeature, Part, Result, Solid } from './part-types.js';
import type { Tools } from './part-model.js';
import { draftBoxCorner } from './part-box-draft.js';

// Private structural contract. Original functions retain their caches, profiling and closure state.
interface FaceFinishHelpers {
  readonly CadPartLimits: { readonly edges: number };
  readonly brepOf: (part: Part, id: string) => Brep;
  readonly bounds: (solid: Solid) => { min: Point; max: Point };
  readonly boxSolid: (min: Point, max: Point, tag: string) => Solid;
  readonly boolean: (a: Solid, b: Solid, op: 'union' | 'difference' | 'intersection', at: string, edgeFitTolerance?: number) => Solid;
  readonly empty: (solid: Solid) => boolean;
  readonly exactVolume: (solid: Solid) => number;
  readonly faceVertices: (brep: Brep, face: string) => Point[];
  readonly affine: (solid: Solid, matrix: BrepAffine['matrix'], origin: readonly number[], rename?: ((name: string) => string) | string) => Solid;
  readonly draftWedge: (prism: PrismaticSolid, u0: number, u1: number, v0: number, v1: number, neutral: number,
    angle: number, frame: BrepAffine['matrix'], origin: Point, tag: string) => Solid;
}
const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });

/** Resolve the original inputs and return the original deferred finish closure. */
export function faceFinishOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: FaceFinishHelpers): () => Result {
  const { dim, solids, fail, at } = t;
  const { CadPartLimits, brepOf, bounds, boxSolid, boolean, empty, exactVolume, faceVertices, affine, draftWedge } = k;
  switch (f.kind) {
    case 'full-round': {
      const target = solids(f.target, 'target'), names = f.faces as unknown, along = f.along as unknown;
      if (!Array.isArray(names) || !names.length || names.length > CadPartLimits.edges || !names.every(x => typeof x === 'string') || new Set(names).size !== names.length) fail('INPUT', 'faces must list 1 to 64 distinct face names');
      if (along !== undefined && along !== 'x' && along !== 'y') fail('INPUT', 'along must be x or y');
      if (target.length !== 1) fail('REFERENCE', 'full round one part at a time (name it as id/k)');
      return () => {
        if (target[0].solid.kind === 'brep' && target[0].solid.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'full round on mesh faces is not supported yet');
        const brep = brepOf(target[0], at), edges = new Map(brep.edges.map(e => [e.id, e])), points = new Map(brep.vertices.map(v => [v.id, v.point])), coedges = new Map(brep.coedges.map(c => [c.id, c]));
        // Each face's rectangle, read from the body as it was (before any round): its span along and across, and its height.
        const rounds = (names as string[]).map(name => {
          const face = brep.faces.find(x => x.name === name || (x.name ?? '').split('#')[0] === name);
          if (!face) return fail('REFERENCE', `no face ${name} on the target`);
          const g = faceGeometry(face);
          if (g.kind !== 'plane' || Math.abs(g.n[2] - 1) > 1e-9) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} is not a planar face facing +Z`);
          if (face.loops.length !== 1) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} has holes`);
          const loop = brep.loops.find(l => l.id === face.loops[0])!;
          const ring = loop.coedges.map(id => { const c = coedges.get(id)!, e = edges.get(c.edge)!; if (e.curve.degree !== 1 || e.curve.controlPoints.length !== 2) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} has a curved edge`); return points.get(c.sense === 'forward' ? e.vertices[0] : e.vertices[1])!; });
          const xs = ring.map(q => q[0]), ys = ring.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), z = ring[0][2];
          const tol = 1e-9 * Math.max(1, ...ring.flat().map(Math.abs));
          const corner = (q: Point) => (Math.abs(q[0] - x0) <= tol || Math.abs(q[0] - x1) <= tol) && (Math.abs(q[1] - y0) <= tol || Math.abs(q[1] - y1) <= tol);
          if (ring.length !== 4 || !ring.every(corner) || new Set(ring.map(q => `${Math.abs(q[0] - x0) <= tol}${Math.abs(q[1] - y0) <= tol}`)).size !== 4) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} is not an axis-aligned rectangle`);
          const dir = along ?? (x1 - x0 >= y1 - y0 ? 'x' : 'y');
          const [l0, l1, a0, a1] = dir === 'x' ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
          return { name, dir, l0, l1, a0, a1, z, r: (a1 - a0) / 2 };
        });
        let out = target[0].solid;
        rounds.forEach((q, k) => {
          // The corner material above the round, in (across, height), laid along the face: up one side, over the top,
          // down the other and back over the half circle. X, Y, Z: the local axes' images (determinant +1).
          const across = q.dir === 'x' ? [q.a0, q.a1] : [-q.a1, -q.a0], base = q.z - q.r, mid = (across[0] + across[1]) / 2;
          const outer: ProfileSegmentInput[] = [{ kind: 'line', start: [across[0], base] }, { kind: 'line', start: [across[0], q.z + q.r] }, { kind: 'line', start: [across[1], q.z + q.r] }, { kind: 'arc', start: [across[1], base], center: [mid, base], direction: 'ccw' }];
          const m: BrepAffine['matrix'] = q.dir === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : [-1, 0, 0, 0, 0, 1, 0, 1, 0];
          const tool = affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: q.l1 - q.l0, from: 0, tag: `${at}.round${k}` }) }, m, q.dir === 'x' ? [q.l0, 0, 0] : [0, q.l0, 0], n => n === `${at}.round${k}.side3` ? `${at}.round${k}` : n);
          // Open sides: no material just outside either side, a radius deep, from the round's foot to the top (a plate
          // under the face, or a neighbour within the radius, would be grooved by the cut).
          for (const [s0, s1] of [[q.a0 - q.r, q.a0], [q.a1, q.a1 + q.r]]) {
            const strip = q.dir === 'x' ? boxSolid([q.l0, s0, base], [q.l1, s1, q.z], `${at}.clear${k}`) : boxSolid([s0, q.l0, base], [s1, q.l1, q.z], `${at}.clear${k}`);
            const beside = boolean(out, strip, 'intersection', at);
            if (!empty(beside) && exactVolume(beside) > 1e-9 * exactVolume(strip)) fail('GEOMETRY', `[FULL_ROUND_NOT_CLEAR] the full round of ${q.name} needs its sides open ${+q.r.toPrecision(9)} mm down from it: material stands beside it`);
          }
          const before = exactVolume(out), next = boolean(out, tool, 'difference', at), pieces = next.kind === 'brep' ? next.brep.bodies.length : 1;
          const took = before - (empty(next) ? 0 : exactVolume(next)), want = (q.l1 - q.l0) * (q.a1 - q.a0) ** 2 * (4 - Math.PI) / 8;
          if (pieces !== 1 || Math.abs(took - want) > 1e-8 * Math.max(want, before)) fail('GEOMETRY', `[FULL_ROUND_NOT_CLEAR] the full round of ${q.name} would take ${+took.toPrecision(9)} mm³, not the ${+want.toPrecision(9)} its top holds: its sides must drop at least ${+q.r.toPrecision(9)} mm and nothing may stand above it`);
          out = next;
        });
        return one(out);
      };
    }
    case 'face-thread': {
      const target = solids(f.target, 'target'), name = f.face, p = dim(f.pitch as CadPartDim, 'pitch', true);
      const nominal = f.diameter === undefined ? null : dim(f.diameter as CadPartDim, 'diameter', true), want = f.length === undefined ? null : dim(f.length as CadPartDim, 'length', true);
      const end = f.end ?? '+', relief = f.relief === undefined ? p : dim(f.relief as CadPartDim, 'relief'), clearance = f.clearance === undefined ? null : dim(f.clearance as CadPartDim, 'clearance');
      if (typeof name !== 'string' || !name) fail('INPUT', 'face must name a cylindrical face');
      if (end !== '+' && end !== '-') fail('INPUT', "end must be '+' or '-'");
      const hand = f.hand ?? 'right';
      if (hand !== 'right' && hand !== 'left') fail('INPUT', 'hand must be right or left');
      if (!(relief >= 0)) fail('INPUT', 'relief must not be negative');
      if (clearance !== null && !(clearance >= 0 && clearance < p / 4)) fail('INPUT', 'clearance must be at least 0 and below a quarter of the pitch');
      if (target.length !== 1) fail('REFERENCE', 'thread one part at a time (name it as id/k)');
      return () => {
        const source = target[0].solid;
        if (source.kind === 'brep' && source.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'a thread on mesh faces is not supported yet');
        // The face by its name: a whole cylinder is often kept as its halves (`#1`, `#2`), one surface between them.
        const brep = brepOf(target[0], at), group = brep.faces.filter(x => x.name === name || (x.name ?? '').split('#')[0] === name);
        if (!group.length) return fail('REFERENCE', `no face ${name} on the target`);
        const g = faceGeometry(group[0]);
        if (g.kind !== 'cylinder') return fail('CAPABILITY', `[FACE_THREAD_FACE] ${name} is not a cylindrical face`);
        for (const x of group.slice(1)) {
          const h = faceGeometry(x);
          if (h.kind !== 'cylinder' || Math.abs(h.r - g.r) > 1e-9 * Math.max(1, g.r) || Math.abs(Math.abs(dot(unit(h.a), unit(g.a))) - 1) > 1e-12 || len(cross(sub(h.c, g.c), unit(g.a))) > 1e-9 * Math.max(1, g.r) || h.out !== g.out) fail('CAPABILITY', `[FACE_THREAD_FACE] the faces named ${name} are not one cylinder`);
        }
        const inGroup = new Set(group.map(x => x.id)), loops = new Set(group.flatMap(x => x.loops));
        // The axis, its largest component positive; t: the distance along it from the face's axis point.
        const k0 = [0, 1, 2].reduce((m, k) => Math.abs(g.a[k]) > Math.abs(g.a[m]) ? k : m, 0), a = unit(g.a[k0] < 0 ? scale(g.a, -1) : g.a), R = g.r;
        const points = new Map(brep.vertices.map(v => [v.id, v.point])), edges = new Map(brep.edges.map(e => [e.id, e])), loopFace = new Map(brep.loops.map(l => [l.id, l.face]));
        const own = brep.coedges.filter(c => loops.has(c.loop)), uses = new Map<string, number>();
        for (const c of own) uses.set(c.edge, (uses.get(c.edge) ?? 0) + 1);
        const tOf = (q: Point) => dot(sub(q, g.c), a), radial = (q: Point) => len(sub(sub(q, g.c), scale(a, tOf(q))));
        const ts = own.flatMap(c => edges.get(c.edge)!.vertices.map(v => tOf(points.get(v)!))), t0 = Math.min(...ts), t1 = Math.max(...ts), L = t1 - t0, tol = 1e-7 * Math.max(1, R, L);
        // Whole round: every edge it does not share with itself (a seam) is a circle in one of its end planes.
        const boundary = [...uses].filter(([, n]) => n === 1).map(([id]) => edges.get(id)!);
        const atEnd = (t: number) => Math.abs(t - t0) <= tol ? 0 : Math.abs(t - t1) <= tol ? 1 : -1;
        if (!(L > tol) || boundary.some(e => { const [u, v] = e.vertices.map(id => atEnd(tOf(points.get(id)!))); return u < 0 || u !== v; })) fail('CAPABILITY', `[FACE_THREAD_FACE] ${name} is not a whole round face between two end circles`);
        // Each end: what lies beyond it, from the faces met there — outward (a shoulder, the plate a hole opens in),
        // or not; flat: a plane square to the axis.
        const beyond = [0, 1].map(side => {
          const met = new Set(boundary.filter(e => atEnd(tOf(points.get(e.vertices[0])!)) === side).flatMap(e => brep.coedges.filter(c => c.edge === e.id).map(c => loopFace.get(c.loop)!)).filter(id => !inGroup.has(id)));
          const faces = brep.faces.filter(x => met.has(x.id)), corners = faces.flatMap(x => faceVertices(brep, x.id));
          const outward = corners.some(q => radial(q) > R + tol), flat = faces.length > 0 && faces.every(x => { const h = faceGeometry(x); return h.kind === 'plane' && Math.abs(Math.abs(dot(h.n, a)) - 1) <= 1e-9; });
          return { outward, flat };
        });
        const span = want ?? L;
        if (span > L + tol) fail('PARAMETER', `[FACE_THREAD_SIZE] the thread's length ${+span.toPrecision(9)} is longer than the face (${+L.toPrecision(9)})`);
        const r0 = end === '+' ? t1 - span : t0, r1 = end === '+' ? t1 : t0 + span;
        // A range end on a face end takes that end's kind; one inside the face meets the face going on (outward-free, not flat).
        const kindAt = (t: number) => { const side = atEnd(t); return side < 0 ? { outward: false, flat: false } : beyond[side]; };
        const ends = [kindAt(r0), kindAt(r1)], external = g.out === 1;
        // Local frame: Z along the axis from its point g.c (identity for +Z, to keep upright tools upright).
        const e1 = Math.abs(a[2] - 1) <= 1e-15 ? [1, 0, 0] as Point : unit(cross(Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], a)), e2 = cross(a, e1);
        const m: BrepAffine['matrix'] = [e1[0], e2[0], a[0], e1[1], e2[1], a[1], e1[2], e2[2], a[2]], o = [g.c[0], g.c[1], g.c[2]];
        const local = (s: Solid) => affine(s, m, o);
        const ring = (outer: number, inner: number | null, lo: number, hi: number, tag: string) => local({ kind: 'upright', solid: prismaticFromProfile({ outer: [{ kind: 'arc', start: [outer, 0], center: [0, 0], direction: 'ccw' }], ...(inner !== null ? { holes: [[{ kind: 'arc', start: [inner, 0], center: [0, 0], direction: 'ccw' }]] } : {}), height: hi - lo, from: lo, tag }) });
        const rod = (d: number, lo: number, hi: number, clear = 0) => {
          if (!(hi - lo >= p - tol)) fail('PARAMETER', `[FACE_THREAD_SIZE] the thread would be ${+(hi - lo).toPrecision(9)} mm long: at least a pitch (${p}) is needed`);
          let made: Brep;
          try { made = threadSolid({ id: at, diameter: d, pitch: p, center: [0, 0], seat: hi, length: hi - lo, form: 'helical', clearance: clear }); }
          catch (cause) { if (cause instanceof RangeError || isMeshBrepError(cause)) fail('PARAMETER', cause.message); throw cause; }
          // (A left-hand thread: the right-hand rod mirrored through a plane holding its axis.)
          const s = local(hand === 'left' ? affine({ kind: 'brep', brep: made! }, [-1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0]) : { kind: 'brep', brep: made! });
          return { solid: s, area: exactVolume(s) / (hi - lo) };
        };
        const close = (got: number, expected: number, scaleOf: number) => Math.abs(got - expected) <= 1e-7 * Math.max(expected, scaleOf);
        const before = exactVolume(source);
        if (!external) {
          if (nominal === null) fail('INPUT', 'a thread in a hole needs its nominal diameter: the hole is its tap drill');
          const d = nominal!;
          if (!(d / 2 > R + tol)) fail('PARAMETER', `[FACE_THREAD_SIZE] an M${d} thread is no wider than the ${+(2 * R).toPrecision(9)} mm hole`);
          // Fill the hole over the length (a plug a pitch wider, in the wall), then cut the thread.
          const filled = boolean(source, ring(d / 2 + p, null, r0, r1, `${at}.plug`), 'union', at), added = exactVolume(filled) - before;
          if (!close(added, Math.PI * R * R * span, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] the wall round ${name} is thinner than the thread needs (${+(d / 2 + p - R).toPrecision(9)} mm past the hole)`);
          const tap = rod(d, r0 - (ends[0].outward ? p : 0), r1 + (ends[1].outward ? p : 0), clearance ?? 0.04);
          const out = boolean(filled, tap.solid, 'difference', at), taken = exactVolume(filled) - exactVolume(out), pieces = out.kind === 'brep' ? out.brep.bodies.length : 1;
          if (pieces !== 1 || !close(taken, tap.area * span, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] the thread in ${name} would take ${+taken.toPrecision(9)} mm³, not the ${+(tap.area * span).toPrecision(9)} its length holds: something stands past the hole's ends`);
          return one(out);
        }
        if (clearance !== null) fail('INPUT', `the clearance goes in the hole: a shaft's thread (${name}) is the bolt's own`);
        if (nominal !== null && Math.abs(nominal - 2 * R) > tol) fail('PARAMETER', `[FACE_THREAD_SIZE] a thread on a ${+(2 * R).toPrecision(9)} mm shaft is M${+(2 * R).toPrecision(9)}, not M${nominal}`);
        const core = R - 0.8 * p;
        if (!(core > 0)) fail('PARAMETER', `[FACE_THREAD_SIZE] a ${p} mm pitch is too coarse for a ${+(2 * R).toPrecision(9)} mm shaft`);
        // A flat free end takes the thread to it; any other end leaves a relief groove at the core.
        const free = ends.map(e => !e.outward && e.flat), w = free.map(x => x ? 0 : relief);
        if (w.some((x, i) => !free[i] && !(x > 0))) fail('CAPABILITY', `[FACE_THREAD_RELIEF] the thread on ${name} ends at a shoulder or inside the face: it needs a relief groove (relief > 0)`);
        const necked = boolean(source, ring(R + p, core, r0 - (free[0] ? p : 0), r1 + (free[1] ? p : 0), `${at}.neck`), 'difference', at), cut = before - exactVolume(necked);
        if (!close(cut, Math.PI * (R * R - core * core) * span, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] material stands round ${name} within ${+p.toPrecision(9)} mm of it: the thread has no room`);
        const thread = rod(2 * R, r0 + w[0], r1 - w[1]), length = r1 - w[1] - r0 - w[0];
        const out = boolean(necked, thread.solid, 'union', at), joined = exactVolume(out) - exactVolume(necked), pieces = out.kind === 'brep' ? out.brep.bodies.length : 1;
        if (pieces !== 1 || !close(joined, (thread.area - Math.PI * core * core) * length, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] the thread on ${name} did not join the shaft's core as one body`);
        return one(out);
      };
    }
    case 'draft': {
      const target = solids(f.target, 'target'), requested = f.faces as unknown, angle = f.angle as unknown;
      if (!Array.isArray(requested) || !requested.length || requested.length > CadPartLimits.edges || !requested.every(x => typeof x === 'string')) fail('INPUT', 'faces must list 1 to 64 face names');
      const names = requested as string[];
      if (typeof angle !== 'number' || !Number.isFinite(angle) || angle === 0 || Math.abs(angle) >= 45) fail('INPUT', 'angle must be a number of degrees, not 0, below 45 in size');
      if (target.length !== 1) fail('REFERENCE', 'draft one part at a time (name it as id/k)');
      const neutral = f.neutral === undefined ? undefined : dim(f.neutral as CadPartDim, 'neutral');
      const pull = f.pull === undefined ? 'z' : f.pull as unknown;
      if (pull !== 'x' && pull !== 'y' && pull !== 'z' && pull !== '-x' && pull !== '-y' && pull !== '-z') fail('INPUT', 'pull must be x, y or z (a positive coordinate axis), or -x, -y or -z');
      return () => {
        if (target[0].solid.kind === 'brep' && target[0].solid.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'draft on mesh faces is not supported yet (general draft and offset arrive with R11)');
        // Signed permutations put the pull on local Z with determinant +1 and no trigonometric rotation.
        const negativePull = pull === '-x' || pull === '-y' || pull === '-z';
        const toZ: BrepAffine['matrix'] | null = pull === 'x' ? [0, 1, 0, 0, 0, 1, 1, 0, 0] : pull === 'y' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : pull === '-x' ? [0, 1, 0, 0, 0, -1, -1, 0, 0] : pull === '-y' ? [0, 0, 1, -1, 0, 0, 0, -1, 0] : pull === '-z' ? [1, 0, 0, 0, -1, 0, 0, 0, -1] : null;
        const fromZ: BrepAffine['matrix'] | null = pull === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : pull === 'y' ? [0, 1, 0, 0, 0, 1, 1, 0, 0] : pull === '-x' ? [0, 0, -1, 1, 0, 0, 0, -1, 0] : pull === '-y' ? [0, -1, 0, 0, 0, -1, 1, 0, 0] : pull === '-z' ? [1, 0, 0, 0, -1, 0, 0, 0, -1] : null;
        const localSolid = toZ ? affine(target[0].solid, toZ, [0, 0, 0]) : target[0].solid;
        const box = bounds(localSolid), zN = negativePull && neutral !== undefined ? -neutral : neutral ?? box.min[2], a = (angle as number) * Math.PI / 180;
        if (names.length === 2 && names[0] !== names[1]) {
          // Materialize upright input under this feature's id regardless of the source Part's cached B-rep.
          const corner = draftBoxCorner(brepOf({ solid: localSolid }, at), [names[0], names[1]], zN, a, at, fail);
          if (corner) {
            const result: Solid = { kind: 'brep', brep: corner };
            return one(fromZ ? affine(result, fromZ, [0, 0, 0]) : result);
          }
        }
        const brep = brepOf(toZ ? { solid: localSolid } : target[0], at), R = len(sub(box.max, box.min)) + 2;
        // Extend tool coverage beyond the face; keep the turn on the authored neutral plane.
        const lift = 1e-6 * R;
        const coedges = new Map(brep.coedges.map(c => [c.id, c])), edges = new Map(brep.edges.map(e => [e.id, e])), points = new Map(brep.vertices.map(v => [v.id, v.point]));
        // Each face's wedge, from the body as it was: the face pushed in (or out) as deep as the turn takes
        // its top, met with the half-space beyond its turned plane (through its line on the neutral plane).
        const wedges = names.map(name => {
          const face = brep.faces.find(x => x.name === name || (x.name ?? '').split('#')[0] === name);
          if (!face) return fail('REFERENCE', `no face ${name} on the target`);
          const loop = brep.loops.find(l => l.id === face.loops[0])!;
          const ring = loop.coedges.map(id => { const c = coedges.get(id)!, e = edges.get(c.edge)!; return points.get(c.sense === 'forward' ? e.vertices[0] : e.vertices[1])!; });
          let nrm: Point = [0, 0, 0];
          ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]; nrm = add(nrm, [(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])]); });
          const n = unit(nrm);
          if (Math.abs(n[2]) > 1e-9 || face.loops.length > 1) fail('CAPABILITY', `${name}: a draft takes side faces square to the pull (${pull === 'x' ? 'X' : pull === 'y' ? 'Y' : pull === '-x' ? '-X' : pull === '-y' ? '-Y' : pull === '-z' ? '-Z' : 'Z'}) without holes`);
          const zs = ring.map(p => p[2]), top = Math.max(...zs), height = top - zN;
          if (!(height > 0) || Math.min(...zs) < zN - 1e-6) fail('SELECTION', negativePull ? `${name}: the neutral plane ${pull.slice(1)} = ${-zN} must be at or above the face for pull ${pull}` : `${name}: the neutral plane ${pull} = ${zN} must be at or below the face`);
          // A frame on the face: X along it (level), Y up, Z into the body (draft in) or out of it (draft out).
          const along: Point = a > 0 ? [-n[0], -n[1], -n[2]] : n, x = unit(cross([0, 0, 1], along)), y = cross(along, x);
          const m: BrepAffine['matrix'] = [x[0], y[0], along[0], x[1], y[1], along[1], x[2], y[2], along[2]], o = ring[0];
          const uv = ring.map(p => { const d = sub(p, o); return [dot(d, x), dot(d, y)]; });
          // (A little wider and taller than the face, so the wedge's ends do not lie on its neighbours' planes.)
          const e = 1e-3 * R, wide = a > 0 ? e : 0, u0 = Math.min(...uv.map(q => q[0])) - wide, u1 = Math.max(...uv.map(q => q[0])) + wide, minV = Math.min(...uv.map(q => q[1])), v0 = minV - (a > 0 ? 2 * lift : 0), v1 = Math.max(...uv.map(q => q[1])) + wide;
          const depth = height * Math.tan(Math.abs(a)) + 1;
          // Preserve the original profile admission separately from the outward tool's exact extent.
          const outline: ProfileSegmentInput[] = [[u0, minV - 2 * lift], [u1, minV - 2 * lift], [u1, v1], [u0, v1]].map(start => ({ kind: 'line', start: start as XY }));
          const prism = prismaticFromProfile({ outer: outline, height: depth, from: a > 0 ? 0 : -1e-3, tag: `${at}.draft` });
          // Retain the former finite half-box's coordinate admission, not its rounded far-corner plane.
          boxSolid([-R, -R, 0], [R, R, R], `${at}.draft`);
          return draftWedge(prism, u0, u1, v0, v1, zN - o[2], a, m, o, `${at}.draft`);
        });
        // The wedge path still takes only disjoint faces.
        const edgesOf = (name: string) => { const face = brep.faces.find(x => x.name === name || (x.name ?? '').split('#')[0] === name)!; return new Set(face.loops.flatMap(l => brep.loops.find(x => x.id === l)!.coedges.map(c => coedges.get(c)!.edge))); };
        const sets = names.map(edgesOf);
        sets.forEach((x, i) => sets.forEach((y, j) => { if (j > i && [...x].some(e => y.has(e))) fail('CAPABILITY', `${names[i]} and ${names[j]} meet along an edge: draft faces that do not touch (or every side of an extrusion with its draft)`); }));
        // The wedges together, then off the body (or onto it) at once.
        const all = wedges.filter(w => !empty(w)).reduce<Solid | null>((u, w) => u ? boolean(u, w, 'union', at) : w, null);
        const result = all ? boolean(localSolid, all, a > 0 ? 'difference' : 'union', at) : localSolid;
        return one(fromZ ? affine(result, fromZ, [0, 0, 0]) : result);
      };
    }
    default: return fail('INPUT', `unknown face finish kind ${f.kind}`);
  }
}
