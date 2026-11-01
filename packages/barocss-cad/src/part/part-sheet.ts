// R5.3 (D226): the part model's sheet-metal features — base and contour flanges, corner reliefs and edge flanges — moved
// out of part-model.ts's operation() as they were there. Since D361 the sheet helpers (`sheetFlange` and the rest) live
// here too and reach part-model.ts's values through a function-level import. The dispatcher calls `sheetOperation` for those kinds.
import { type BendTable, type BendTableUse, isSheetMetalError, type SheetReport, bendAllowance, bendDeduction, bendTableProblem, contourFlangeSection, flangeSection, lookupBend, outsideSetback } from '../frame-sheet/sheet-metal.js';
import { type Point } from '../types.js';
import { prismaticFromProfile } from '../features/prismatic-solid.js';
import { type Brep } from '../brep/brep-core.js';
import { faceGeometry } from '../brep/analytic-boolean.js';
import { type BrepAffine } from '../brep/brep-transform.js';
import { type ProfileSegmentInput } from '../features/extruded-profile-solid.js';
import { add, cross, dot, len, scale, sub } from '../core/vec3.js';
import type { CadPartDim, CadPartPoint2, CadPartSketchPlane, Result, Solid, CadPartFeature, Tools, PartHelpers, Part } from './part-model.js';
import { affine, boolean, brepOf, exactVolume, faceVertices } from './part-model.js';

/** A sheet-metal feature's evaluation (part-model.ts's operation() for these kinds). */
export function sheetOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result {
  const { dim, xy, xyz, solids, ref, fail, at } = t;
  const { isRecord, CadPartLimits, frameOf, framed, placed } = k;
  const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });
  switch (f.kind) {
    case 'sheet-base': case 'sheet-contour': {
      const T = dim(f.thickness as CadPartDim, 'thickness', true), R = dim(f.bendRadius as CadPartDim, 'bendRadius', true), K = f.kFactor, table = f.bendTable as BendTable | undefined;
      if ((K === undefined) === (table === undefined)) fail('PARAMETER', 'give the sheet a kFactor or a bendTable (one of them)');
      if (K !== undefined && (typeof K !== 'number' || !Number.isFinite(K) || K < 0 || K > 1)) fail('PARAMETER', 'kFactor must be a number from 0 to 1 (the neutral layer lies within the sheet)');
      const problem = table === undefined ? null : bendTableProblem(table);
      if (problem) fail('PARAMETER', `[BEND_TABLE] ${problem}`);
      const rules = K !== undefined ? { kFactor: K as number } : { bendTable: table! };
      if (f.kind === 'sheet-base') {
        const sketch = ref(f.sketch, 'sketch').result;
        if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
        const { outer, frame, regions, holes, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
        if (regions?.length) fail('CAPABILITY', 'a sheet\'s base takes one outer loop (holes allowed) yet');
        if (f.reverse !== undefined && typeof f.reverse !== 'boolean') fail('INPUT', 'reverse must be true or false');
        const report: SheetReport = { thickness: T, bendRadius: R, ...rules, fixedFace: `${at}.top`, bends: [] };
        return () => withSheet(placed(frame, () => one({ kind: 'upright', solid: prismaticFromProfile({ outer, ...(holes ? { holes } : {}), ...(tags ? { sideTags: tags } : {}), height: T, from: f.reverse ? -T : 0, tag: at }) }))(), report);
      }
      const list = f.path as unknown;
      if (!Array.isArray(list) || list.length < 2 || list.length > CadPartLimits.copies) fail('INPUT', 'path must list 2 to 64 points');
      const path = (list as CadPartPoint2[]).map((p, i) => xy(p, `path[${i}]`));
      if (f.side !== 'left' && f.side !== 'right') fail('INPUT', 'side must be left or right (where the material lies, looking along the path)');
      const width = dim(f.width as CadPartDim, 'width', true), frame = f.plane === undefined ? undefined : frameOf(f.plane as CadPartSketchPlane, xyz, fail);
      let section: ReturnType<typeof contourFlangeSection>;
      try { section = contourFlangeSection(path, f.side as 'left' | 'right', T, R, at); }
      catch (cause) { if (isSheetMetalError(cause)) fail(cause.code, cause.message); throw cause; }
      const report: SheetReport = { thickness: T, bendRadius: R, ...rules, fixedFace: `${at}.leg0.a`, bends: section!.bends.map(b => {
        const angle = Math.abs(b.angle), k = bendK(rules, T, R, angle, `bend${b.vertex}`, fail);
        return { name: `${at}.bend${b.vertex}`, inner: b.inner, outer: b.outer, radius: R, angle: angle * 180 / Math.PI, axis: { origin: framed(frame, [b.center[0], b.center[1], 0]), direction: frame ? [frame.m[2], frame.m[5], frame.m[8]] as Point : [0, 0, 1] as Point },
          allowance: bendAllowance(angle, R, T, k.kFactor), setback: outsideSetback(angle, R, T), deduction: bendDeduction(angle, R, T, k.kFactor), kFactor: k.kFactor, ...(k.use ? { table: k.use } : {}) };
      }) };
      return () => withSheet(placed(frame, () => one({ kind: 'upright', solid: prismaticFromProfile({ outer: section!.segments, height: width, from: 0, tag: at, names: { outer: section!.names, bottom: `${at}.front`, top: `${at}.back` } }) }))(), report);
    }
    case 'sheet-corner-relief': {
      const parts = solids(f.target, 'target');
      if (parts.length !== 1) fail('SELECTION', 'a corner relief takes one sheet body');
      const p = parts[0];
      if (!p.sheet) return fail('CAPABILITY', '[NOT_A_SHEET] the target is not sheet metal: made by a sheet feature (its holes and cuts carry it; moves, patterns and unions do not)');
      if (f.shape !== 'square' && f.shape !== 'round') fail('INPUT', 'shape must be square or round');
      if (typeof f.corner !== 'string') fail('INPUT', 'corner must name the edge of the corner (between its two thickness faces)');
      const size = dim(f.size as CadPartDim, 'size', true);
      return () => sheetCornerRelief(p, p.sheet!, at, f.corner as string, f.shape as 'square' | 'round', size, fail);
    }
    case 'sheet-flange': {
      const parts = solids(f.target, 'target');
      if (parts.length !== 1) fail('SELECTION', 'a flange takes one sheet body');
      const p = parts[0], sheet = p.sheet;
      if (!sheet) return fail('CAPABILITY', '[NOT_A_SHEET] the target is not sheet metal: made by a sheet feature (its holes and cuts carry it; moves, patterns and unions do not)');
      const T = sheet.thickness, R = f.bendRadius === undefined ? sheet.bendRadius : dim(f.bendRadius as CadPartDim, 'bendRadius', true), L = dim(f.length as CadPartDim, 'length', true);
      const deg = f.angle === undefined ? 90 : f.angle;
      if (typeof deg !== 'number' || !Number.isFinite(deg)) fail('INPUT', 'angle must be a number');
      if (!((deg as number) > 1e-6 && (deg as number) < 180 - 1e-6)) fail('PARAMETER', `[BEND_ANGLE] a flange bends between 0 and 180° (not ${deg}°: 180° is a hem, not supported yet)`);
      const measure = f.measure ?? 'outer', position = f.position ?? 'material-inside';
      if (measure !== 'outer' && measure !== 'inner' && measure !== 'tangent') fail('INPUT', 'measure must be outer, inner or tangent');
      if (position !== 'material-inside' && position !== 'material-outside' && position !== 'bend-outside') fail('INPUT', 'position must be material-inside, material-outside or bend-outside');
      const offs = f.offsets === undefined ? [0, 0] : f.offsets as unknown;
      if (!Array.isArray(offs) || offs.length !== 2) fail('INPUT', 'offsets must be [from the start, from the end]');
      const off = (offs as CadPartDim[]).map((v, i) => { const x = dim(v, `offsets[${i}]`); if (x < 0) fail('PARAMETER', 'offsets must not be negative'); return x; }) as [number, number];
      // (The relief has no defaults in the kernel (D119): its kind, and for a cut its width and depth, are given — or it
      // is refused where an end lies inside the edge. Absent: undefined; 'none': null.)
      const rl = f.relief as Record<string, unknown> | undefined;
      if (rl !== undefined && !isRecord(rl)) fail('INPUT', 'relief must be { kind, width, depth }');
      if (rl !== undefined && rl.kind !== 'rectangular' && rl.kind !== 'obround' && rl.kind !== 'none') fail('INPUT', 'relief.kind must be rectangular, obround or none');
      for (const k of ['width', 'depth'] as const) if (rl !== undefined && rl.kind !== 'none' && rl[k] === undefined) fail('PARAMETER', `[RELIEF_REQUIRED] a ${String(rl.kind)} relief needs its ${k} (mm): the kernel takes no default`);
      const relief = rl === undefined ? undefined : rl.kind === 'none' ? null : { kind: rl.kind as 'rectangular' | 'obround', width: dim(rl.width as CadPartDim, 'relief width', true), depth: dim(rl.depth as CadPartDim, 'relief depth', true) };
      if (typeof f.edge !== 'string') fail('INPUT', 'edge must name an edge of the sheet');
      const th = (deg as number) * Math.PI / 180, ossb = outsideSetback(th, R, T), issb = R * Math.tan(th / 2);
      const straight = measure === 'outer' ? L - ossb : measure === 'inner' ? L - issb : L;
      if (!(straight > 1e-6)) fail('PARAMETER', `[BEND_DOES_NOT_FIT] a flange ${L} mm long (${measure}) is within its bend's setback of ${+(measure === 'inner' ? issb : ossb).toFixed(6)} mm`);
      const trim = position === 'material-inside' ? ossb : position === 'material-outside' ? issb : 0, k = bendK(sheet, T, R, th, 'the flange', fail);
      return () => sheetFlange({ part: p, sheet, at, edge: f.edge as string, T, K: k, R, th, trim, straight, off, relief, fail });
    }
  }
  throw new Error(`sheetOperation: ${f.kind} is not one of its features`);
}
// Sheet-metal helpers moved from part-model.ts (3b, D361).
/** A bend's K: the sheet's, or its table's for T, R and the angle (R12.4, D120); a bend outside the table refused by name. */
export function bendK(rules: { readonly kFactor?: number; readonly bendTable?: BendTable }, T: number, R: number, angle: number, what: string, fail: Tools['fail']): { kFactor: number; use?: BendTableUse } {
  if (rules.kFactor !== undefined) return { kFactor: rules.kFactor };
  const r = lookupBend(rules.bendTable!, T, R, angle);
  if ('miss' in r) return fail('PARAMETER', `[BEND_TABLE_MISS] ${what}: ${r.miss}`);
  return r;
}
/**
 * An edge flange on a sheet (R12.3, D118; see the feature): its edge's frame (x out across the edge, y up from the picked
 * skin, z along the edge), the plate trimmed and relieved, the flange's section extruded and united; refused where it
 * meets the sheet anywhere but its root.
 */
export function sheetFlange(o: { part: Part; sheet: SheetReport; at: string; edge: string; T: number; K: { kFactor: number; use?: BendTableUse }; R: number; th: number; trim: number; straight: number; off: [number, number]; relief: { kind: 'rectangular' | 'obround'; width: number; depth: number } | null | undefined; fail: Tools['fail'] }): Result {
  const { part, sheet, at, T, K, R, th, trim, straight, off, relief, fail } = o, brep = brepOf(part, 'target');
  const e = edgeNamed(brep, o.edge, fail);
  const ends = e.curve.controlPoints, A = ends[0], B = ends[ends.length - 1], Le = len(sub(B, A));
  const tol = 1e-9 * Math.max(1, ...A.map(Math.abs), ...B.map(Math.abs));
  if (!(e.curve.degree === 1 && ends.length === 2 && Le > tol)) fail('PARAMETER', `[EDGE_NOT_SHEET] ${e.name} is not straight: a flange goes on a straight edge`);
  const u = scale(sub(B, A), 1 / Le), loopFace = new Map(brep.loops.map(l => [l.id, l.face])), faceIds = brep.coedges.filter(c => c.edge === e!.id).map(c => loopFace.get(c.loop)!);
  const faces = faceIds.map(id => brep.faces.find(x => x.id === id)!), geos = faces.map(x => faceGeometry(x));
  // The picked skin S and the thickness face E: both planes, square to each other and the edge; E with an edge along this
  // one T below S over some of its length (the sheet T thick there; E may run on, merged with a flange's end beside it),
  // the plate behind E.
  let frame: { n: Point; m: Point; S: number } | null = null;
  for (const [s, k] of [[0, 1], [1, 0]] as const) {
    const gs = geos[s], ge = geos[k];
    if (faces.length !== 2 || gs.kind !== 'plane' || ge.kind !== 'plane' || Math.abs(dot(gs.n, ge.n)) > 1e-9 || Math.abs(dot(gs.n, u)) > 1e-9 || Math.abs(dot(ge.n, u)) > 1e-9) continue;
    const behind = faceVertices(brep, faces[s].id).map(q => dot(sub(q, A), ge.n));
    if (Math.max(...behind) <= tol && hasEdgeBelow(brep, faces[k].id, A, u, Le, gs.n, T)) { frame = { n: gs.n, m: ge.n, S: s }; break; }
  }
  if (!frame) return fail('PARAMETER', `[EDGE_NOT_SHEET] ${e.name} is not an edge between the sheet's skin and its ${T} mm thickness`);
  const { n, m } = frame, w = cross(m, n), zB = dot(sub(B, A), w), zlo = Math.min(0, zB), zhi = Math.max(0, zB);
  // (Offsets from the edge's start (A) and end (B).)
  const z0 = zlo + (zB > 0 ? off[0] : off[1]), z1 = zhi - (zB > 0 ? off[1] : off[0]);
  if (!(z1 - z0 > 1e-6)) fail('PARAMETER', `[BEND_DOES_NOT_FIT] offsets ${off[0]} and ${off[1]} leave nothing of the ${+Le.toFixed(6)} mm edge`);
  // The plate behind the edge must reach past the trim.
  const depth = -Math.min(...faceVertices(brep, faces[frame.S].id).map(q => dot(sub(q, A), m)));
  if (trim > 0 && !(depth > trim + tol)) fail('PARAMETER', `[BEND_DOES_NOT_FIT] the sheet is ${+depth.toFixed(6)} mm deep behind ${e.name}; the bend takes ${+trim.toFixed(6)} mm of it`);
  const F: BrepAffine['matrix'] = [m[0], n[0], w[0], m[1], n[1], w[1], m[2], n[2], w[2]];
  const local = (outer: ProfileSegmentInput[], from: number, h: number, tag: string, names?: { outer: string[]; bottom: string; top: string }) => affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: h, from: from, tag, ...(names ? { names } : {}) }) }, F, A);
  // The cut into the plate, one tool (no two cuts with faces on one plane): the trim [−trim, 1] × [z0, z1] and a relief at
  // each end inside the edge, `depth` past the bend's start, as one loop across the edge (x) and along it (z), taken down
  // through the plate. (Bend outside: no trim, each relief its own loop.)
  // An end inside the edge needs a relief said (kind, width and depth, or 'none'); 'none' cuts nothing there.
  const inside0 = z0 > zlo + tol, inside1 = z1 < zhi - tol;
  if ((inside0 || inside1) && relief === undefined) fail('PARAMETER', `[RELIEF_REQUIRED] the flange on ${e.name} ends inside the edge: give its relief — { kind: 'rectangular' | 'obround', width, depth } or { kind: 'none' }`);
  const cut = relief ?? null, at0 = cut !== null && inside0, at1 = cut !== null && inside1;
  const xd = cut ? -(trim + cut.depth) : -trim, r = cut ? cut.width / 2 : 0;
  if ((at0 && z0 - 2 * r < zlo - tol) || (at1 && z1 + 2 * r > zhi + tol)) fail('PARAMETER', `[BEND_DOES_NOT_FIT] a relief ${cut!.width} mm wide does not fit beside the flange on ${e.name} (offset it at least that far)`);
  if (cut?.kind === 'obround' && cut.depth < r) fail('PARAMETER', `[BEND_DOES_NOT_FIT] an obround relief needs a depth of at least half its width (${r} mm)`);
  const loops: ProfileSegmentInput[][] = [];
  const tail = (y: number, out: ProfileSegmentInput[], up: boolean) => {
    // A relief from the edge (x = 1) across to its deep end and back, between y and y ± width (up: towards +z).
    const y1 = up ? y + 2 * r : y - 2 * r;
    if (cut!.kind === 'rectangular') { out.push({ kind: 'line', start: [xd, up ? y1 : y] }, { kind: 'line', start: [xd, up ? y : y1] }); return; }
    out.push({ kind: 'arc', start: [xd + r, up ? y1 : y], center: [xd + r, (y + y1) / 2], direction: 'ccw' }, { kind: 'line', start: [xd + r, up ? y : y1] });
  };
  if (trim > 0) {
    const ya = at0 ? z0 - 2 * r : z0, yb = at1 ? z1 + 2 * r : z1, loop: ProfileSegmentInput[] = [{ kind: 'line', start: [1, ya] }, { kind: 'line', start: [1, yb] }];
    if (at1) tail(z1, loop, true);
    loop.push({ kind: 'line', start: [-trim, z1] }, { kind: 'line', start: [-trim, z0] });
    if (at0) tail(z0, loop, false);
    loops.push(loop);
  } else {
    if (at0) { const l: ProfileSegmentInput[] = [{ kind: 'line', start: [1, z0 - 2 * r] }, { kind: 'line', start: [1, z0] }]; tail(z0 - 2 * r, l, true); loops.push(l); }
    if (at1) { const l: ProfileSegmentInput[] = [{ kind: 'line', start: [1, z1] }, { kind: 'line', start: [1, z1 + 2 * r] }]; tail(z1, l, true); loops.push(l); }
  }
  const G: BrepAffine['matrix'] = [m[0], w[0], -n[0], m[1], w[1], -n[1], m[2], w[2], -n[2]], top = add(A, n);
  let plate = part.solid;
  // (Where the cut or the flange reaches another bend of the sheet the Boolean meets it along an edge: said so by name.)
  const collide = (cause: unknown): never => {
    if (cause instanceof Error && /not a manifold solid|touch along an edge/.test(cause.message)) fail('GEOMETRY', `[FLANGES_COLLIDE] the flange on ${e!.name} or its cut into the plate meets the sheet's other bends or flanges: keep it at least its setback (${+Math.max(trim, (R + T) * Math.tan(th / 2)).toFixed(6)} mm) from them`);
    throw cause;
  };
  try { loops.forEach((outer, k) => { plate = boolean(plate, affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: T + 2, from: 0, tag: k ? `${at}.relief${k}` : trim > 0 ? `${at}.trim` : `${at}.relief0` }) }, G, top), 'difference', at); }); }
  catch (cause) { collide(cause); }
  const sec = flangeSection(at, T, R, th, trim, straight), piece = local([...sec.segments], z0, z1 - z0, at, { outer: [...sec.names], bottom: `${at}.start`, top: `${at}.end` });
  // Joined at its root only: anything more is the flange running into the sheet (or another flange).
  let out: Solid;
  try { out = boolean(plate, piece, 'union', at); }
  catch (cause) { collide(cause); }
  // (Reliefs of neighbouring flanges may meet and cut a corner off: the sheet must stay one piece.)
  const pieces = out!.kind === 'brep' ? out!.brep.bodies.length : 1;
  if (pieces > 1) fail('GEOMETRY', `[SHEET_IN_PIECES] the flange on ${e.name} and its reliefs leave the sheet in ${pieces} pieces: move it, or its neighbour, further from the corner`);
  const vp = exactVolume(plate), vf = exactVolume(piece), vu = exactVolume(out!);
  if (vp + vf - vu > 1e-8 * (vp + vf)) fail('GEOMETRY', `[FLANGES_COLLIDE] the flange on ${e.name} runs into the sheet: ${+(vp + vf - vu).toPrecision(6)} mm³ of it overlaps`);
  const c = add(A, add(scale(m, sec.center[0]), scale(n, sec.center[1])));
  const bend = { name: `${at}.bend`, inner: `${at}.bend.inner`, outer: `${at}.bend.outer`, radius: R, angle: th * 180 / Math.PI, axis: { origin: c, direction: w }, allowance: bendAllowance(th, R, T, K.kFactor), setback: outsideSetback(th, R, T), deduction: bendDeduction(th, R, T, K.kFactor), kFactor: K.kFactor, ...(K.use ? { table: K.use } : {}) };
  return { kind: 'solid', parts: [{ solid: out!, sheet: { ...sheet, bends: [...sheet.bends, bend] } }] };
}
/** An edge of a B-rep by its name, else by its faces' names without their piece numbers (one such edge). */
export function edgeNamed(brep: Brep, name: string, fail: Tools['fail']): Brep['edges'][number] {
  let e = brep.edges.find(x => x.name === name);
  if (!e) {
    const want = name.split('|').map(n => n.replace(/#\d+$/, '')).sort().join('|');
    const like = brep.edges.filter(x => x.name && x.name.split('|').map(n => n.replace(/#\d+$/, '')).sort().join('|') === want);
    if (like.length > 1) fail('SELECTION', `${name} names ${like.length} edges: ${like.map(x => x.name).join(', ')}`);
    e = like[0];
  }
  if (!e) return fail('SELECTION', `no edge named ${name}; edges: ${brep.edges.slice(0, 12).map(x => x.name).join(', ')}${brep.edges.length > 12 ? ', …' : ''}`);
  return e;
}
/**
 * A corner relief on a sheet (R12.3b, D119; see the feature): the corner's frame (x and y into the plate along its two
 * edges, z along the thickness), the square or the quarter disc cut through it; refused unless exactly the plate's corner
 * goes (s² T or π s² T / 4) and the sheet stays one piece.
 */
export function sheetCornerRelief(part: Part, sheet: SheetReport, at: string, corner: string, shape: 'square' | 'round', s: number, fail: Tools['fail']): Result {
  const T = sheet.thickness, brep = brepOf(part, 'target'), e = edgeNamed(brep, corner, fail);
  const ends = e.curve.controlPoints, A = ends[0], B = ends[ends.length - 1], tol = 1e-9 * Math.max(1, ...A.map(Math.abs), ...B.map(Math.abs));
  if (!(e.curve.degree === 1 && ends.length === 2 && Math.abs(len(sub(B, A)) - T) <= 1e-7 * Math.max(1, T))) fail('PARAMETER', `[EDGE_NOT_SHEET] ${e.name} is not a corner of the sheet: the straight edge, ${T} mm long, between two thickness faces`);
  const d = scale(sub(B, A), 1 / len(sub(B, A))), loopFace = new Map(brep.loops.map(l => [l.id, l.face]));
  const faces = brep.coedges.filter(c => c.edge === e.id).map(c => brep.faces.find(x => x.id === loopFace.get(c.loop))!), geos = faces.map(x => faceGeometry(x));
  if (faces.length !== 2 || geos.some(g => g.kind !== 'plane') || geos.some(g => Math.abs(dot((g as { n: Point }).n, d)) > 1e-9)) fail('PARAMETER', `[EDGE_NOT_SHEET] ${e.name} is not between two thickness faces of the sheet`);
  const m1 = (geos[0] as { n: Point }).n, m2 = (geos[1] as { n: Point }).n;
  if (Math.abs(dot(m1, m2)) > 1e-9) fail('CAPABILITY', `[CORNER_NOT_SQUARE] the corner ${e.name} is ${+(Math.acos(Math.max(-1, Math.min(1, -dot(m1, m2)))) * 180 / Math.PI).toFixed(6)}°: corner reliefs are made at square corners yet`);
  // Convex: each face behind the other's plane.
  const behind = (face: string, n: Point) => faceVertices(brep, face).every(q => dot(sub(q, A), n) <= tol);
  if (!behind(faces[1].id, m1) || !behind(faces[0].id, m2)) fail('CAPABILITY', `[CORNER_NOT_SQUARE] the corner ${e.name} is not convex`);
  const X = scale(m1, -1), Y = scale(m2, -1), Z = cross(X, Y), zB = dot(sub(B, A), Z), z0 = Math.min(0, zB) - 1, z1 = Math.max(0, zB) + 1;
  const outer: ProfileSegmentInput[] = shape === 'square' ? [{ kind: 'line', start: [-1, -1] }, { kind: 'line', start: [s, -1] }, { kind: 'line', start: [s, s] }, { kind: 'line', start: [-1, s] }] : [{ kind: 'arc', start: [s, 0], center: [0, 0], direction: 'ccw' }];
  const tool = affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: z1 - z0, from: z0, tag: at }) }, [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], A);
  let out: Solid;
  try { out = boolean(part.solid, tool, 'difference', at); }
  catch (cause) { if (cause instanceof Error && /not a manifold solid|touch along an edge/.test(cause.message)) fail('GEOMETRY', `[CORNER_NOT_CLEAR] the relief at ${e.name} meets more than the plate's corner`); throw cause; }
  const want = (shape === 'square' ? s * s : Math.PI * s * s / 4) * T, took = exactVolume(part.solid) - exactVolume(out!), pieces = out!.kind === 'brep' ? out!.brep.bodies.length : 1;
  if (pieces > 1 || Math.abs(took - want) > 1e-8 * Math.max(want, exactVolume(part.solid))) fail('GEOMETRY', `[CORNER_NOT_CLEAR] the relief at ${e.name} would take ${+took.toPrecision(9)} mm³ (the plate's corner is ${+want.toPrecision(9)}): a flange or a cut is there already, or the size reaches past the plate`);
  return { kind: 'solid', parts: [{ solid: out!, sheet }] };
}
/** Whether a face has a straight edge along u at T below the plane through A (normal n), overlapping [A, A + Le·u]. */
export function hasEdgeBelow(brep: Brep, face: string, A: Point, u: Point, Le: number, n: Point, T: number): boolean {
  const loops = new Set(brep.loops.filter(l => l.face === face).map(l => l.id)), edges = new Map(brep.edges.map(x => [x.id, x])), tol = 1e-7 * Math.max(1, T);
  for (const c of brep.coedges) {
    if (!loops.has(c.loop)) continue;
    const p = edges.get(c.edge)!.curve.controlPoints, a = p[0], b = p[p.length - 1], d = sub(b, a), l = len(d);
    if (!(l > 0) || Math.abs(Math.abs(dot(d, u)) / l - 1) > 1e-9 || Math.abs(dot(sub(a, A), n) + T) > tol || Math.abs(dot(sub(b, A), n) + T) > tol) continue;
    const s0 = Math.min(dot(sub(a, A), u), dot(sub(b, A), u)), s1 = Math.max(dot(sub(a, A), u), dot(sub(b, A), u));
    if (Math.min(s1, Le) - Math.max(s0, 0) > tol) return true;
  }
  return false;
}
/** A sheet feature's result: its one part carrying the sheet's report. */
export const withSheet = (r: Result, sheet: SheetReport): Result => r.kind === 'solid' ? { kind: 'solid', parts: r.parts.map(p => ({ ...p, sheet })) } : r;
