// Revolved solids (brep-core step 9): a closed line + arc profile in the XY sketch plane turned about
// an axis lying in that plane. Every face is an exact rational surface of revolution: a line parallel
// to the axis gives a cylinder, one across it a planar annulus, any other line a cone; an arc gives a
// torus patch (a sphere zone when its centre is on the axis). A full turn is made of two halves (no
// seams); a partial turn gets two planar end caps. The profile may reach the axis at vertices (poles:
// spheres, cone tips, discs) and run along it (axis segments bound no wall; the caps of a partial turn
// share them), but not touch or cross it anywhere else.
import { BrepError, buildBrep, loopVectorArea, surfaceNormalAtCentre, type Brep, type BrepFaceInput, type BrepLoopInput } from '../brep/brep-core.js';
import { curveTolerance, intersectSegments, locateInRegion, segStart, type CurveSegment2 } from '../brep/curved-arrangement.js';
import { exactPoint2, exactPoint2FromXY, exactOrient2, type ExactPoint2 } from '../brep/planar-arrangement.js';
import { sideName, SIDE_TAG } from '../document/side-names.js';
import { buildProfileLoop, segmentCurve, type ProfileSegment, type ProfileSegmentInput, type XY } from './extruded-profile-solid.js';
import { evaluateCurve, curveDomain } from '../core/math.js';
import { unsupportedNativeMass } from '../internal/native-si-mass-state.js';
import { add, dot, scale, sub, unit } from '../core/vec3.js';
import type { Curve, Point, Surface } from '../types.js';

export interface RevolveInput {
  readonly id?: string;
  readonly profile: readonly ProfileSegmentInput[];
  /** Strictly interior, pairwise disjoint bore loops. No touching or nested loops. */
  readonly holes?: readonly (readonly ProfileSegmentInput[])[];
  /** One side-tag list per authored bore loop (SideTags.holes). */
  readonly holeTags?: readonly (readonly string[])[];
  /** The axis: a point on it and its direction, both in the sketch plane (z = 0). */
  readonly axis: { readonly origin: XY; readonly direction: XY };
  /** 0 < angle ≤ 360; positive turns the profile from the sketch plane towards +Z. */
  readonly angle: number;
  /** The sketch's segment tags (R10a, D86): sides named `${id}.side[t]` instead of by position. */
  readonly sideTags?: readonly string[];
}

/** Validate native bore boundaries without subtracting solids or changing authored loop topology. */
function profileLoops(input: RevolveInput): readonly (readonly ProfileSegment[])[] {
  const loops = [input.profile, ...Array.from(input.holes ?? [])].map(p => buildProfileLoop(p, { maximumSegments: 1024 }).segments);
  if (loops.length === 1) return loops;
  const seenTags = new Set<string>();
  if (input.holeTags && input.holeTags.length !== loops.length - 1) throw new BrepError('INPUT', 'revolve: holeTags must have one list per bore');
  for (const [i, tags] of [input.sideTags, ...Array.from(input.holeTags ?? [])].entries()) if (tags) {
    const authored = i === 0 ? input.profile : input.holes![i - 1];
    if (tags.length !== authored.length) throw new BrepError('INPUT', 'revolve: side tags must match their authored loop');
    for (const tag of Array.from(tags)) {
      if (typeof tag !== 'string' || !SIDE_TAG.test(tag) || seenTags.has(tag)) throw new BrepError('INPUT', 'revolve: side tags must be valid and unique across all loops');
      seenTags.add(tag);
    }
  }
  const rings = loops.map(loop => loop.map((s): CurveSegment2 => s.kind === 'line'
    ? { kind: 'line', a: [...s.start], b: [...s.end] }
    : { kind: 'arc', c: [...s.center], r: s.radius, t0: s.startAngle, sweep: s.sweep }));
  const tolerance = curveTolerance(rings);
  for (let i = 1; i < rings.length; i++) {
    for (let j = 0; j < i; j++) {
      if (rings[i].some(a => rings[j].some(b => intersectSegments(a, b, tolerance).length))) throw new BrepError('GEOMETRY', 'revolve: bore boundaries must not touch or cross');
      const p = segStart(rings[i][0]), where = locateInRegion(p, { outer: rings[j], holes: [] }, tolerance);
      if (j === 0 ? where !== 'in' : where !== 'out') throw new BrepError('GEOMETRY', 'revolve: bores must be strictly inside the profile and pairwise disjoint');
      if (j > 0 && locateInRegion(segStart(rings[j][0]), { outer: rings[i], holes: [] }, tolerance) !== 'out') throw new BrepError('GEOMETRY', 'revolve: nested bores are not supported');
    }
  }
  return loops;
}

/** Assemble the outer and bore walls directly. A partial turn shares each bore edge with a cap inner loop. */
function revolveHollow(input: RevolveInput): Brep {
  profileLoops(input);
  const id = input.id ?? 'revolve', full = input.angle === 360;
  const outer = revolveProfile({ ...input, holes: undefined, holeTags: undefined });
  const bores = input.holes!.map((profile, i) => revolveProfile({ ...input, id: `${id}_hole${i}`, profile, sideTags: input.holeTags?.[i], holes: undefined, holeTags: undefined }));
  const reverse = (sense: 'forward' | 'reversed'): 'forward' | 'reversed' => sense === 'forward' ? 'reversed' : 'forward';
  const faceInputs = (b: Brep, inward: boolean): BrepFaceInput[] => {
    const loops = new Map(b.loops.map(l => [l.id, l])), coedges = new Map(b.coedges.map(c => [c.id, c]));
    return b.faces.map(f => ({ id: f.id, name: f.name, surface: f.surface, sense: inward ? reverse(f.sense) : f.sense,
      loops: f.loops.map(lid => {
        const loop = loops.get(lid)!, uses = loop.coedges.map(cid => { const c = coedges.get(cid)!; return { edge: c.edge, sense: c.sense }; });
        return { kind: loop.kind, uses: inward ? uses.reverse().map(u => ({ edge: u.edge, sense: reverse(u.sense) })) : uses };
      }) }));
  };
  const faces = faceInputs(outer, false), boreFaces = bores.map(b => faceInputs(b, true));
  if (!full) for (const end of ['start', 'end']) {
    const capIndex = faces.findIndex(f => f.name === `${id}.${end}`), cap = faces[capIndex];
    const inner: BrepLoopInput[] = [];
    boreFaces.forEach((walls, i) => {
      const index = walls.findIndex(f => f.name === `${id}_hole${i}.${end}`), boreCap = walls[index];
      inner.push(...boreCap.loops.map(l => ({ ...l, kind: 'inner' as const })));
      walls.splice(index, 1);
    });
    faces[capIndex] = { ...cap, loops: [...cap.loops, ...inner] };
  }
  // Keep authored tag naming consistent across all loops; absent tags retain a stable hole prefix.
  for (let i = 0; i < boreFaces.length; i++) if (input.holeTags?.[i]) {
    boreFaces[i] = boreFaces[i].map(f => ({ ...f, name: f.name?.replace(`${id}_hole${i}.side[`, `${id}.side[`) }));
  }
  const all = [outer, ...bores];
  const brep = buildBrep({ source: { family: 'revolve', id }, vertices: all.flatMap(b => b.vertices), edges: all.flatMap(b => b.edges),
    bodies: [{ id: `${id}_body`, kind: 'solid', shells: full
      ? [{ id: 's', closed: true, faces }, ...boreFaces.map((f, i) => ({ id: `hole${i}`, closed: true, faces: f }))]
      : [{ id: 's', closed: true, faces: [...faces, ...boreFaces.flat()] }] }] });
  const faceName = new Map(brep.faces.map(f => [f.id, f.name!])), loopFace = new Map(brep.loops.map(l => [l.id, l.face]));
  const names = new Map<string, string[]>(); for (const c of brep.coedges) names.set(c.edge, [...(names.get(c.edge) ?? []), faceName.get(loopFace.get(c.loop)!)!]);
  const baseOf = (edge: string) => [...new Set(names.get(edge))].sort().join('|'), counts = new Map<string, number>(), used = new Map<string, number>();
  for (const e of brep.edges) { const base = baseOf(e.id); counts.set(base, (counts.get(base) ?? 0) + 1); }
  return { ...brep, edges: brep.edges.map(e => { const base = baseOf(e.id), k = (used.get(base) ?? 0) + 1; used.set(base, k); return { ...e, name: counts.get(base)! > 1 ? `${base}#${k}` : base }; }) };
}

/** Unit circle arc from 0 through `sweep` (≤ 2π) as rational quadratic control points (x, y) and weights. */
function unitArc(sweep: number): { pts: XY[]; w: number[]; knots: number[] } {
  const spans = Math.max(1, Math.ceil(sweep / (Math.PI / 2) - 1e-12)), dt = sweep / spans, wm = Math.cos(dt / 2);
  const pts: XY[] = [[1, 0]], w = [1], knots = [0, 0, 0];
  for (let s = 0; s < spans; s++) {
    const a = dt * (s + 0.5), b = dt * (s + 1);
    pts.push([Math.cos(a) / wm, Math.sin(a) / wm], [Math.cos(b), Math.sin(b)]); w.push(wm, 1);
    if (s < spans - 1) knots.push((s + 1) / spans, (s + 1) / spans);
  }
  knots.push(1, 1, 1);
  return { pts, w, knots };
}

export function revolveProfile(input: RevolveInput): Brep {
  if (input.holes?.length) return revolveHollow(input);
  const id = input.id ?? 'revolve', deg = input.angle;
  if (!(typeof deg === 'number' && deg > 0 && deg <= 360)) throw new BrepError('INPUT', 'revolve: the angle must be in (0, 360] degrees');
  const alpha = deg * Math.PI / 180, full = deg === 360;
  const [dx, dy] = input.axis.direction, dl = Math.hypot(dx, dy);
  if (!(dl > 0)) throw new BrepError('INPUT', 'revolve: the axis needs a direction');
  const d: Point = [dx / dl, dy / dl, 0], s: Point = [-d[1], d[0], 0], z: Point = [0, 0, 1], A0: Point = [input.axis.origin[0], input.axis.origin[1], 0];
  const loop0 = buildProfileLoop(input.profile, { maximumSegments: 1024 }), built = loop0.segments;
  // (Tagged sides by the authored segment, a clockwise loop having been reversed; a circle's two halves its one tag.)
  const tags = input.sideTags, sideOf = (i: number) => tags ? sideName(id, built.length > 1 ? (loop0.reversed ? built.length - 1 - i : i) : 0, tags) : `${id}.side${i}`;
  // A single closed arc (a circle) becomes two halves, so every profile edge has two vertices.
  const loop: ProfileSegment[] = built.length > 1 ? [...built] : (() => {
    const arc = built[0]; if (arc.kind !== 'arc') throw new BrepError('GEOMETRY', 'revolve: a profile needs at least two segments');
    const half = arc.sweep / 2, mid = arc.startAngle + half, m: XY = [arc.center[0] + arc.radius * Math.cos(mid), arc.center[1] + arc.radius * Math.sin(mid)];
    return [{ ...arc, end: m, sweep: half, length: arc.length / 2 }, { ...arc, start: m, startAngle: mid, sweep: half, length: arc.length / 2 }];
  })(), n = loop.length;
  // Profile coordinates: h along the axis, ρ off it (towards s). The profile lies on one side, ρ > 0.
  const p3 = (p: readonly number[]): Point => [p[0], p[1], p[2] ?? 0];
  const hr = (p: readonly number[]): XY => { const q = sub(p3(p), A0); return [dot(q, d), dot(q, s)]; };
  // The profile lies on one side, ρ > 0, except at vertices on the axis (poles) and along whole lines
  // on it (the axis segments, which bound no wall).
  let side = 0;
  const onAxisAt = (p: readonly number[]) => Math.abs(hr(p)[1]) <= 1e-9 * Math.max(1, Math.abs(p[0]), Math.abs(p[1]));
  const axial = loop.map(seg => seg.kind === 'line' && onAxisAt(seg.start) && onAxisAt(seg.end));
  loop.forEach((seg, i) => {
    if (axial[i]) return;
    // A line's signed radius is affine. A circular arc's extrema are its carrier points along ±s.
    const candidates: { p: XY; interior: boolean }[] = [{ p: seg.start, interior: false }, { p: seg.end, interior: false }];
    if (seg.kind === 'arc') {
      const centre = exactPoint2FromXY([...seg.center]), zero = exactPoint2FromXY([0, 0]);
      // Subtract authored coordinates as exact homogeneous rationals, before any Number rounding.
      const ray = (q: XY): ExactPoint2 => {
        const e = exactPoint2FromXY(q), denominator = e.w * centre.w;
        return exactPoint2(e.x * centre.w - centre.x * e.w, denominator,
          e.y * centre.w - centre.y * e.w, denominator);
      };
      // The same half-plane/cross ordering as the exact planar arrangement, from +X counter-clockwise.
      const half = (v: ExactPoint2) => v.y > 0n || (v.y === 0n && v.x > 0n) ? 0 : 1;
      const less = (a: ExactPoint2, b: ExactPoint2) => half(a) !== half(b)
        ? half(a) < half(b) : exactOrient2(zero, a, b) > 0;
      const sameRay = (a: ExactPoint2, b: ExactPoint2) => half(a) === half(b) && exactOrient2(zero, a, b) === 0;
      const first = ray(seg.start), last = ray(seg.end), [start, end] = seg.sweep > 0 ? [first, last] : [last, first];
      if ((start.x === 0n && start.y === 0n) || (end.x === 0n && end.y === 0n) || sameRay(start, end)) {
        throw new BrepError('GEOMETRY', 'revolve: the arc direction cannot be determined from its endpoint rays');
      }
      for (const sign of [-1, 1]) {
        const critical = exactPoint2FromXY([sign * s[0], sign * s[1]]);
        if (critical.x === 0n && critical.y === 0n) {
          throw new BrepError('GEOMETRY', 'revolve: the arc direction cannot be determined from its endpoint rays');
        }
        if (sameRay(start, critical) || sameRay(end, critical)) continue;
        // Circular order handles both minor and major arcs, including the wrap across +X.
        const interior = less(start, end) ? less(start, critical) && less(critical, end)
          : less(start, critical) || less(critical, end);
        if (interior) {
          const p: XY = [seg.center[0] + sign * seg.radius * s[0], seg.center[1] + sign * seg.radius * s[1]];
          candidates.push({ p, interior: true });
        }
      }
    }
    for (const { p, interior } of candidates) {
      const rho = hr(p)[1];
      if (onAxisAt(p)) { if (!interior) continue; throw new BrepError('GEOMETRY', 'revolve: the profile touches the axis between its vertices'); }
      if (side && Math.sign(rho) !== side) throw new BrepError('GEOMETRY', 'revolve: the profile crosses the axis');
      side = Math.sign(rho);
    }
  });
  if (!side) throw new BrepError('GEOMETRY', 'revolve: the profile lies on the axis');
  const pole = loop.map(seg => onAxisAt(seg.start));
  // Two walls meeting on the axis at one vertex pinch a full turn to a point (not a manifold solid).
  if (full) loop.forEach((_, v) => { if (pole[v] && !axial[v] && !axial[(v + n - 1) % n]) throw new BrepError('GEOMETRY', 'revolve: the profile meets the axis at a single vertex between two walls (the solid would pinch to a point there)'); });
  // Keep ρ positive: flip s (and so the turning direction stays towards +Z by flipping d as well).
  const S: Point = side > 0 ? s : scale(s, -1), D: Point = side > 0 ? d : scale(d, -1);
  const toHR = (p: readonly number[]): XY => { const q = sub(p3(p), A0); return [dot(q, D), dot(q, S)]; };
  const at = (h: number, rho: number, phi: number): Point => add(add(A0, scale(D, h)), add(scale(S, rho * Math.cos(phi)), scale(z, rho * Math.sin(phi))));
  const stations = full ? [0, Math.PI, 2 * Math.PI] : alpha <= Math.PI ? [0, alpha] : [0, alpha / 2, alpha], parts = stations.length - 1;
  const station = (k: number) => full && k === parts ? 0 : k;
  // A pole is one vertex at every station; an axis segment is one edge (a cap edge of a partial turn).

  // Profile curves (in XY, z = 0) and their (h, ρ) control points.
  const profileCurves = loop.map((seg, i) => segmentCurve(seg as ProfileSegment, 0, `${id}_p${i}`));
  const rotateCurve = (c: Curve, phi: number, cid: string): Curve => ({ ...c, id: cid, controlPoints: c.controlPoints.map(p => { const [h, r] = toHR(p); return at(h, r, phi); }) });
  const vertices: { id: string; point: Point }[] = [], vid = (k: number, v: number) => pole[v % n] ? `${id}_pole${v % n}` : `${id}_v${station(k)}_${v % n}`;
  for (let k = 0; k < (full ? parts : parts + 1); k++) for (let v = 0; v < n; v++) { if (pole[v] && k > 0) continue; const [h, r] = toHR([loop[v].start[0], loop[v].start[1], 0]); vertices.push({ id: vid(k, v), point: pole[v] ? at(h, 0, 0) : at(h, r, stations[k]) }); }
  const edges: { id: string; curve: Curve; vertices: [string, string] }[] = [];
  const pid = (k: number, i: number) => axial[i] ? `${id}_axis${i}` : `${id}_pe${station(k)}_${i}`, aid = (k: number, v: number) => `${id}_ae${k}_${v}`;
  for (let k = 0; k < (full ? parts : parts + 1); k++) loop.forEach((_, i) => {
    if (axial[i] && (full || k > 0)) return;
    edges.push({ id: pid(k, i), curve: rotateCurve(profileCurves[i], axial[i] ? 0 : stations[k], pid(k, i)), vertices: [vid(k, i), vid(k, i + 1)] });
  });
  for (let k = 0; k < parts; k++) for (let v = 0; v < n; v++) {
    if (pole[v]) continue;
    const [h, r] = toHR([loop[v].start[0], loop[v].start[1], 0]), arc = unitArc(stations[k + 1] - stations[k]), c0 = Math.cos(stations[k]), s0 = Math.sin(stations[k]);
    const cps = arc.pts.map(([x, y]): Point => { const X = x * c0 - y * s0, Y = x * s0 + y * c0; return add(add(A0, scale(D, h)), add(scale(S, r * X), scale(z, r * Y))); });
    edges.push({ id: aid(k, v), curve: { kind: 'curve', id: aid(k, v), degree: 2, knots: arc.knots, controlPoints: cps, weights: arc.w }, vertices: [vid(k, v), vid(k + 1, v)] });
  }
  // Every edge starts and ends exactly on its vertices (rotations computed two ways differ in the last bits).
  const pointOf = new Map(vertices.map(v => [v.id, v.point]));
  for (const e of edges) { const cp = e.curve.controlPoints as Point[]; cp[0] = pointOf.get(e.vertices[0])!; cp[cp.length - 1] = pointOf.get(e.vertices[1])!; }
  const curveOf = new Map(edges.map(e => [e.id, e.curve]));

  // Faces: the wall of every profile segment over every part, and the end caps of a partial turn.
  const faces: { id: string; name: string; surface: Surface; sense: 'forward' | 'reversed'; loops: { kind: 'outer' | 'inner'; uses: { edge: string; sense: 'forward' | 'reversed' }[] }[] }[] = [];
  const orient = (uses: { edge: string; sense: 'forward' | 'reversed' }[], outward: Point) => {
    const area = loopVectorArea(uses.map(u => ({ curve: curveOf.get(u.edge)!, sense: u.sense })));
    return dot(area, outward) >= 0 ? uses : [...uses].reverse().map(u => ({ edge: u.edge, sense: (u.sense === 'forward' ? 'reversed' : 'forward') as 'forward' | 'reversed' }));
  };
  const senseFor = (surface: Surface, outward: Point): 'forward' | 'reversed' => dot(surfaceNormalAtCentre(surface), outward) >= 0 ? 'forward' : 'reversed';
  loop.forEach((seg, i) => {
    if (axial[i]) return;
    const c = profileCurves[i], [t0, t1] = curveDomain(c), mid = evaluateCurve(c, (t0 + t1) / 2), ahead = evaluateCurve(c, (t0 + t1) / 2 + (t1 - t0) * 1e-4);
    const tan = unit(sub(ahead, mid)), right: Point = [tan[1], -tan[0], 0]; // outward in the sketch plane (material on the left)
    const [nh, nr] = [dot(right, D), dot(right, S)], [h0, r0] = toHR(seg.start), [h1, r1] = toHR(seg.end);
    for (let k = 0; k < parts; k++) {
      const phi0 = stations[k], phi1 = stations[k + 1], pm = (phi0 + phi1) / 2;
      const outward = add(scale(D, nh), add(scale(S, nr * Math.cos(pm)), scale(z, nr * Math.sin(pm))));
      let surface: Surface;
      const arc = unitArc(phi1 - phi0), c0 = Math.cos(phi0), s0 = Math.sin(phi0);
      const ring = (h: number, r: number) => arc.pts.map(([x, y]): Point => { const X = x * c0 - y * s0, Y = x * s0 + y * c0; return add(add(A0, scale(D, h)), add(scale(S, r * X), scale(z, r * Y))); });
      if (seg.kind === 'line' && Math.abs(h1 - h0) <= 1e-12 * Math.max(1, Math.abs(h0))) {
        // Across the axis: a planar annulus sector, as a bilinear patch over its bounds in its plane.
        const rmax = Math.max(r0, r1) / Math.cos(Math.min(Math.PI / 2, phi1 - phi0) / 2) * 1.01, centre = add(A0, scale(D, h0));
        const e1 = S, e2 = z, p = (a: number, b: number): Point => add(centre, add(scale(e1, a), scale(e2, b)));
        surface = { kind: 'surface', id: `${id}_f${i}_${k}`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[p(-rmax, -rmax), p(-rmax, rmax)], [p(rmax, -rmax), p(rmax, rmax)]], weights: [[1, 1], [1, 1]] };
      } else {
        // U around the axis (the arc), V along the profile segment; weights multiply.
        const prof = c.controlPoints.map(toHR), pw = c.weights;
        surface = { kind: 'surface', id: `${id}_f${i}_${k}`, degreeU: 2, degreeV: c.degree, knotsU: arc.knots, knotsV: c.knots,
          controlPoints: arc.pts.map((_, a) => prof.map(([h, r]) => ring(h, r)[a])), weights: arc.w.map(wa => pw.map(wp => wa * wp)) };
      }
      // A pole end has no arc edge: the loop passes through the pole vertex.
      const uses = orient(([{ edge: pid(k, i), sense: 'forward' }, pole[(i + 1) % n] ? null : { edge: aid(k, (i + 1) % n), sense: 'forward' }, { edge: pid(k + 1, i), sense: 'reversed' }, pole[i] ? null : { edge: aid(k, i), sense: 'reversed' }] as const)
        .filter(u => u !== null).map(u => ({ edge: u!.edge, sense: u!.sense as 'forward' | 'reversed' })), outward);
      faces.push({ id: `${id}_f${i}_${k}`, name: tags && built.length === 1 ? `${sideOf(i)}#${i * parts + k + 1}` : parts > 1 ? `${sideOf(i)}#${k + 1}` : sideOf(i), surface, sense: senseFor(surface, outward), loops: [{ kind: 'outer', uses }] });
    }
  });
  if (!full) for (const [k, name] of [[0, 'start'], [parts, 'end']] as const) {
    const phi = stations[k], radial = add(scale(S, Math.cos(phi)), scale(z, Math.sin(phi))), outward = k === 0 ? scale(add(scale(S, -Math.sin(phi)), scale(z, Math.cos(phi))), -1) : add(scale(S, -Math.sin(phi)), scale(z, Math.cos(phi)));
    const hs = loop.map(sg => toHR(sg.start)[0]), rs = loop.map(sg => toHR(sg.start)[1]), pad = 1 + Math.max(...rs);
    const [ha, hb] = [Math.min(...hs) - pad, Math.max(...hs) + pad], [ra, rb] = [0, Math.max(...rs) + pad];
    const p = (h: number, r: number): Point => add(add(A0, scale(D, h)), scale(radial, r));
    const surface: Surface = { kind: 'surface', id: `${id}_${name}`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[p(ha, ra), p(ha, rb)], [p(hb, ra), p(hb, rb)]], weights: [[1, 1], [1, 1]] };
    const uses = orient(loop.map((_, i) => ({ edge: pid(k, i), sense: 'forward' as const })), outward);
    faces.push({ id: `${id}_${name}`, name: `${id}.${name}`, surface, sense: senseFor(surface, outward), loops: [{ kind: 'outer', uses }] });
  }
  const brep = buildBrep({ source: { family: 'revolve', id }, vertices, edges: edges.map(e => ({ ...e, name: e.id })),
    bodies: [{ id: `${id}_body`, kind: 'solid', shells: [{ id: 's', closed: true, faces }] }] });
  // Edge names from their faces.
  const faceName = new Map(brep.faces.map(f => [f.id, f.name!])), loopFace = new Map(brep.loops.map(l => [l.id, l.face]));
  const names = new Map<string, string[]>(); for (const c of brep.coedges) names.set(c.edge, [...(names.get(c.edge) ?? []), faceName.get(loopFace.get(c.loop)!)!]);
  const used = new Map<string, number>();
  return { ...brep, edges: brep.edges.map(e => { const base = [...new Set(names.get(e.id))].sort().join('|'); const k = (used.get(base) ?? 0) + 1; used.set(base, k); return { ...e, name: k > 1 || brep.edges.filter(x => [...new Set(names.get(x.id))].sort().join('|') === base).length > 1 ? `${base}#${k}` : base }; }) };
}

/**
 * Mass properties of a revolved profile in closed form: dV = ρ dφ dA over the profile in (h, ρ), with
 * the φ integrals done exactly and the profile moments ∫∫ hᵐρᵏ dA by Green's theorem (Gauss–Legendre
 * on each segment: exact for lines, far below rounding for arcs).
 */
/** The revolved solid's mass properties in closed form (MMGS: density g/cm³; R7.3b). */
export function revolveMassProperties(input: RevolveInput, density: number): { volume: number; mass: number; centroid: Point; inertia: [[number, number, number], [number, number, number], [number, number, number]]; method: 'closed-form' } {
  if (!(density > 0 && Number.isFinite(density))) throw new BrepError('INPUT', 'a positive finite density is required');
  const alpha = input.angle * Math.PI / 180, [dx, dy] = input.axis.direction, dl = Math.hypot(dx, dy);
  let D: Point = [dx / dl, dy / dl, 0], S: Point = [-D[1], D[0], 0]; const Z: Point = [0, 0, 1], A0: Point = [input.axis.origin[0], input.axis.origin[1], 0];
  const loops = profileLoops(input), loop = loops[0];
  const hrOf = (x: number, y: number): XY => { const q: Point = [x - A0[0], y - A0[1], 0]; return [dot(q, D), dot(q, S)]; };
  // The side of the axis the profile lies on (from a point off it: a vertex may be on the axis).
  const off = loop.map(sg => sg.kind === 'line' ? [(sg.start[0] + sg.end[0]) / 2, (sg.start[1] + sg.end[1]) / 2] : [sg.center[0] + sg.radius * Math.cos(sg.startAngle + sg.sweep / 2), sg.center[1] + sg.radius * Math.sin(sg.startAngle + sg.sweep / 2)]).map(([x, y]) => hrOf(x, y)[1]).find(r => Math.abs(r) > 1e-9) ?? 1;
  if (off < 0) { D = scale(D, -1); S = scale(S, -1); }
  // ∫∫ hᵐ ρᵏ dA = ∮ hᵐ⁺¹ ρᵏ / (m + 1) dρ (the profile runs counter-clockwise in x, y; in (h, ρ) the
  // orientation is the same when (D, S) is right-handed in the plane, which it is: S = D rotated +90°).
  const GL = [[0.0198550717512319, 0.0506142681451881], [0.1016667612931866, 0.1111905172266872], [0.2372337950418355, 0.1568533229389436], [0.4082826787521751, 0.1813418916891810], [0.5917173212478249, 0.1813418916891810], [0.7627662049581645, 0.1568533229389436], [0.8983332387068134, 0.1111905172266872], [0.9801449282487681, 0.0506142681451881]];
  const moment = (m: number, k: number) => {
    let acc = 0;
    for (const [index, boundary] of loops.entries()) for (const seg of boundary) {
      const pieces = seg.kind === 'line' ? 1 : Math.max(1, Math.ceil(Math.abs(seg.sweep) / (Math.PI / 8)));
      for (let p = 0; p < pieces; p++) for (const [x, w] of GL) {
        const t = (p + x) / pieces;
        let X: number, Y: number, dX: number, dY: number;
        if (seg.kind === 'line') { X = seg.start[0] + (seg.end[0] - seg.start[0]) * t; Y = seg.start[1] + (seg.end[1] - seg.start[1]) * t; dX = seg.end[0] - seg.start[0]; dY = seg.end[1] - seg.start[1]; }
        else { const a = seg.startAngle + seg.sweep * t; X = seg.center[0] + seg.radius * Math.cos(a); Y = seg.center[1] + seg.radius * Math.sin(a); dX = -seg.radius * Math.sin(a) * seg.sweep; dY = seg.radius * Math.cos(a) * seg.sweep; }
        const [h, r] = hrOf(X, Y), dr = dX * S[0] + dY * S[1];
        acc += (index === 0 ? 1 : -1) * w / pieces * h ** (m + 1) * r ** k / (m + 1) * dr;
      }
    }
    return acc;
  };
  // φ integrals over [0, α].
  const c1 = Math.sin(alpha), s1 = 1 - Math.cos(alpha), cc = alpha / 2 + Math.sin(2 * alpha) / 4, ss = alpha / 2 - Math.sin(2 * alpha) / 4, sc = Math.sin(alpha) ** 2 / 2;
  // In the local frame (h along D, a = ρ cos φ along S, b = ρ sin φ along Z), dV = ρ dφ dA.
  const V = alpha * moment(0, 1), Ih = alpha * moment(1, 1), Ia = c1 * moment(0, 2), Ib = s1 * moment(0, 2);
  const Ihh = alpha * moment(2, 1), Iaa = cc * moment(0, 3), Ibb = ss * moment(0, 3), Iha = c1 * moment(1, 2), Ihb = s1 * moment(1, 2), Iab = sc * moment(0, 3);
  const ch = Ih / V, ca = Ia / V, cb = Ib / V;
  const k = density * 1e-3;
  const hh = Ihh - V * ch * ch, aa = Iaa - V * ca * ca, bb = Ibb - V * cb * cb, ha = Iha - V * ch * ca, hb = Ihb - V * ch * cb, ab = Iab - V * ca * cb;
  // Local inertia tensor (products stored as −∫xy dm), rotated to world: columns D, S, Z.
  const L = [[k * (aa + bb), -k * ha, -k * hb], [-k * ha, k * (hh + bb), -k * ab], [-k * hb, -k * ab, k * (hh + aa)]], R = [D, S, Z];
  const world = [0, 1, 2].map(i => [0, 1, 2].map(j => { let v = 0; for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) v += R[p][i] * L[p][q] * R[q][j]; return v; })) as [[number, number, number], [number, number, number], [number, number, number]];
  const centroid = add(add(A0, scale(D, ch)), add(scale(S, ca), scale(Z, cb)));
  return unsupportedNativeMass({ volume: V, mass: density * V * 1e-3, centroid, inertia: world, method: 'closed-form' }, 'revolved');
}
