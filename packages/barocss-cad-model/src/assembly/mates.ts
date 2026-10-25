// Assembly mates: an instance placed by relating its faces to faces of parts already placed. Each mate
// names a face that stays (`a`, on the base part or another instance) and a face on the instance it
// moves (`b`). The solve is analytic and exact for these rigid cases: the directions the mates demand
// (face normals, cylinder axes) fix the rotation — one direction by the smallest turn from where the part
// stands, two by the frame they span — and the positions they demand are linear in the move, solved for the
// smallest move from where it stands. A mate that disagrees with the ones before it is refused with the
// reason; nothing is fitted or iterated, so a solved assembly stays put when it is solved again.
import { connectorOf, validateBallOptions, validateFastenedOptions, validateUniversalOptions, type Connector } from './connectors';
import { isRefusal, refusal } from '../engine/refusal';
import type { PartInstance } from '../engine/doc';
import type { Sig } from '../engine/references';
import { dot, cross, add, sub, len } from '../engine/vec3';
import { axisAngle, clean, DEG, eulerOf, matMul, rotationMatrix, type Mat3 } from '../engine/placement';

// (R7.3c, conventions §10.2: the one Vec3, engine/vec3's.)
import type { Vec3 } from '../engine/vec3';
export type { Vec3 };
export type MateKind = 'coincident' | 'concentric' | 'distance' | 'angle' | 'tangent' | 'lock' | 'cam' | 'fastened' | 'ball' | 'universal';
/** A face by its persistent B-rep name on a part: `base` (the document's own part) or an instance id. */
/** `sig`: the face's geometry when it was picked; `was`: its name before a re-match (engine/references.ts). */
export interface MateRef { part: string; face: string; at?: Connector; sig?: Sig; was?: string }
/**
 * `coincident`: flat faces flush, facing each other (flip: facing the same way). `distance`: the same,
 * `distance` mm apart along the fixed face's normal. `concentric`: two round faces on one axis, the axes
 * either way round (flip unset: as the other mates or the part's stance have it), the same way (false)
 * or reversed (true). `angle`: flat faces `angle` degrees apart (0: facing each other as in coincident; flip:
 * measured from facing the same way), with no hold on position. `tangent`: a round face touching a flat face,
 * its axis parallel to the face and its radius in front of it (flip: behind it); or two round faces touching
 * along parallel axes, outside each other (a pin inside a hole: inside; flip swaps the two).
 * `cam` (O24 a): b's flat face kept on a's lobe as a turns (a cam and its flat-faced follower), or on a's flat face as a
 * slides (a follower pushing a valve) — no constraint for the solver (b's own mates place it, seated at the solved
 * pose); the joint tree couples b's slide to a's joint (robot/cam.ts).
 * Origin planes (`origin:xy`…) have no material side: a flat mate with one lines the planes up facing the
 * same way by default, and flip opposes them.
 */
export interface Mate {
  /** fastened aligns persistent connector origins, Z and X (0 DoF); ball aligns only origins (3 free turns). Universal holds origins and a.Z perpendicular to b.X (2 turns). Lock keeps the current relative pose. */
  id: string; kind: MateKind; a: MateRef; b: MateRef; distance?: number; angle?: number; flip?: boolean;
  /** `lock`: b's placement in a's own coordinates, kept as it was when locked (its faces are unused, ''). */
  rel?: { position: Vec3; rotation: Vec3 };
}

/**
 * A face's (or an edge's) exact geometry in its part's own coordinates. O24 (c): besides flat and round faces, a
 * sphere (its centre), a cone (its apex, the axis toward its base, the half-angle in radians), a straight edge (its
 * start, its direction, its length) and a circular edge (its centre, its normal, its radius; an arc's ends). A flat
 * face's `centre` is its area centroid; a round face's or a cone's `span` its extent along the axis from `point`.
 */
export type MateFace =
  | { kind: 'plane'; point: Vec3; normal: Vec3; centre?: Vec3; /** Derived connector X for fastened only; never stored as a reference. */ x?: Vec3 }
  | { kind: 'cylinder'; point: Vec3; axis: Vec3; radius: number; outer: boolean; span?: [number, number] }
  | { kind: 'sphere'; point: Vec3; radius: number; outer: boolean }
  | { kind: 'cone'; point: Vec3; axis: Vec3; half: number; outer: boolean; span?: [number, number] }
  | { kind: 'line'; point: Vec3; axis: Vec3; length: number }
  | { kind: 'circle'; point: Vec3; axis: Vec3; radius: number; ends?: [Vec3, Vec3] };
export type FaceTable = Record<string, MateFace>;

export const BASE = 'base';
export const KIND_LABEL: Record<MateKind, string> = { coincident: 'Coincident', concentric: 'Concentric', distance: 'Distance', angle: 'Angle', tangent: 'Tangent', lock: 'Lock', cam: 'Cam', fastened: 'Fastened', ball: 'Ball', universal: 'Universal' };
export const mateLabel = (mate: Mate, index: number) => `${KIND_LABEL[mate.kind]} ${index + 1}`;

/** A face or edge with an axis (a round face, a cone, a circular or straight edge): concentric reads its line. */
const axial = (f: MateFace) => f.kind === 'cylinder' || f.kind === 'cone' || f.kind === 'circle' || f.kind === 'line';
/** Which mates a pair of faces admits. */
export function kindsFor(a: MateFace, b: MateFace): MateKind[] {
  const out: MateKind[] = [];
  if (a.kind === 'plane' && b.kind === 'plane') out.push('coincident', 'distance', 'angle');
  else if (a.kind === 'cylinder' && b.kind === 'cylinder') out.push('concentric', 'tangent');
  else if (a.kind === 'line' && b.kind === 'line') out.push('coincident', 'concentric');
  else if (axial(a) && axial(b) || a.kind === 'sphere' && b.kind === 'sphere') out.push('concentric');
  else if (a.kind === 'plane' && b.kind === 'line' || a.kind === 'line' && b.kind === 'plane') out.push('coincident');
  else if (a.kind === 'plane' && (b.kind === 'cylinder' || b.kind === 'sphere') || (a.kind === 'cylinder' || a.kind === 'sphere') && b.kind === 'plane') out.push('tangent');
  if (b.kind === 'plane') out.push('cam');
  return out;
}

const axialFace = (f: MateFace): MateFace => f.kind === 'cone' || f.kind === 'circle' || f.kind === 'line' ? { kind: 'cylinder', point: f.point, axis: f.axis, radius: 0, outer: true } : f;

/**
 * A mate's two faces as the solver and the joint tree take them (O24 c): the kinds that read only a line become a
 * round face of radius 0 on it — concentric with a cone, a circular or a straight edge (a cone: its apex on its axis);
 * an edge on a face (coincident) a radius-0 round face tangent to it; two edges coincident, concentric. The mate's
 * kind is the one solved (`as`). Two spheres concentric and a sphere tangent to a face stay spheres.
 */
export function solvedFaces(kind: MateKind, a: MateFace, b: MateFace): { as: MateKind; a: MateFace; b: MateFace } {
  if (kind === 'concentric') return { as: kind, a: axialFace(a), b: axialFace(b) };
  if (kind === 'coincident' && (a.kind === 'line' || b.kind === 'line')) return { as: a.kind === 'line' && b.kind === 'line' ? 'concentric' : 'tangent', a: axialFace(a), b: axialFace(b) };
  return { as: kind, a, b };
}

/** Project connector frames to existing geometry rows. Universal reads a.Z and b.X, not both full frames. */
export function mateFacesOf(mate: Mate, faces: { a: MateFace; b: MateFace }): ReturnType<typeof solvedFaces> {
  validateFastenedOptions(mate.kind, mate);
  validateBallOptions(mate.kind, mate);
  validateUniversalOptions(mate.kind, mate);
  if ((mate.a.at || mate.b.at) && (mate.kind === 'cam' || mate.kind === 'lock')) throw refusal('CONNECTOR_KIND', 'Connectors support coincident, distance, angle, concentric and tangent mates.');
  return solvedFaces(mate.kind, referenceFace(mate.a, faces.a, mate.kind), referenceFace(mate.b, faces.b, mate.kind, true));
}
function referenceFace(ref: MateRef, face: MateFace, kind: MateKind, moving = false): MateFace {
  if (ref.at === undefined && kind !== 'fastened' && kind !== 'ball' && kind !== 'universal') return face;
  const frame = connectorOf(face, { at: ref.at === undefined ? {} : ref.at, name: ref.face });
  // Use the existing point rows and free twists; a ball never constrains connector X or Z.
  if (kind === 'ball') return { kind: 'sphere', point: frame.point, radius: 0, outer: true };
  // The two joint axes belong to opposite bodies: fixed connector Z and moving connector X.
  if (kind === 'universal') return { kind: 'plane', point: frame.point, normal: moving ? frame.x : frame.normal };
  if (kind === 'fastened') return { kind: 'plane', point: frame.point, normal: frame.normal, x: frame.x };
  return kind === 'concentric' || kind === 'tangent'
    ? { kind: 'cylinder', point: frame.point, axis: frame.normal, radius: 0, outer: true }
    : { kind: 'plane', point: frame.point, normal: frame.normal };
}
/** Admitted classic kinds for the selected reference options. Invalid connector data stays a typed refusal. */
export function mateKindsOf(refs: { a: MateRef; b: MateRef }, faces: { a: MateFace; b: MateFace }): MateKind[] {
  const { a, b } = refs, { a: fa, b: fb } = faces;
  if (a.at === undefined && b.at === undefined) return kindsFor(fa, fb);
  const out: MateKind[] = [];
  for (const kind of ['coincident', 'distance', 'angle', 'concentric', 'tangent'] as const) {
    const sf = mateFacesOf({ id: '', kind, a, b }, { a: fa, b: fb });
    if (kindsFor(sf.a, sf.b).includes(sf.as)) out.push(kind);
  }
  return out;
}

// ── Small exact vector and rotation helpers (row-major 3 × 3) ──
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a: Vec3): Vec3 => mul(a, 1 / len(a));
const apply = (m: Mat3, v: Vec3): Vec3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** Columns c0, c1, c2 as a matrix, and a frame's transpose. */
const fromColumns = (c0: Vec3, c1: Vec3, c2: Vec3): Mat3 => [c0[0], c1[0], c2[0], c0[1], c1[1], c2[1], c0[2], c1[2], c2[2]];
const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
/** The smallest rotation taking unit `from` onto unit `to`; a half turn about the perpendicular nearest +Z (else +X) when they are opposed. */
function turnOnto(from: Vec3, to: Vec3): Mat3 {
  const c = dot(from, to);
  if (c > 1 - 1e-15) return IDENTITY;
  if (c < -1 + 1e-12) {
    const pref: Vec3 = Math.abs(from[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    return axisAngle(unit(sub(pref, mul(from, dot(pref, from)))), Math.PI);
  }
  const k = cross(from, to), s = len(k);
  return axisAngle(mul(k, 1 / s), Math.atan2(s, c));
}



/** A face moved by a placement (R, t). */
function placeFace(f: MateFace, R: Mat3, t: Vec3): MateFace {
  return f.kind === 'plane' ? { kind: 'plane', point: add(apply(R, f.point), t), normal: apply(R, f.normal), ...(f.x ? { x: apply(R, f.x) } : {}) }
    : f.kind === 'sphere' ? { ...f, point: add(apply(R, f.point), t) }
    : { ...f, point: add(apply(R, f.point), t), axis: apply(R, f.axis) };
}

export interface Problem { mate: string; reason: string }
/** How a mate in a loop is refused (the rebuild report groups those mates into their loops, O10). */
export const LOOP_REASON = 'It closes a loop';
export interface Solved {
  /** The instances with every mated one placed (unchanged where a mate failed). */
  instances: PartInstance[];
  /** Mates that cannot be met, each with why. */
  problems: Problem[];
  /** A part's faces are still being read: nothing was solved. */
  pending: boolean;
  /**
   * What each mated instance can still do: free turns (0: its mates fix the rotation, 1: about one axis,
   * 2 or 3) and free slides (directions of travel, a slide round a round face included).
   */
  freedom: Record<string, Freedom>;
}
export interface Freedom { turns: number; slides: number }

const DIR_TOL = 1e-9, POS_TOL = 1e-6;
const fmtNum = (v: number) => String(Math.round(v * 1000) / 1000);
const degBetween = (c: number) => Math.acos(Math.max(-1, Math.min(1, c))) / DEG;

/** Why a mate cannot be made from these two faces (or null). */
export function mateRefusal(mate: Mate, fa: MateFace | undefined, fb: MateFace | undefined): string | null {
  if (!fa || !fb) return 'One of its faces is no longer on the part (a feature was edited or removed).';
  let pair: ReturnType<typeof mateFacesOf>;
  try { pair = mateFacesOf(mate, { a: fa, b: fb }); } catch (e) { if (isRefusal(e)) return e.message; throw e; }
  if (mate.kind === 'fastened' || mate.kind === 'ball' || mate.kind === 'universal') return null;
  const kinds = kindsFor(pair.a, pair.b);
  if (!kinds.includes(pair.as)) return mate.kind === 'concentric' ? 'Concentric needs two round faces, cones or edges with an axis; or two spheres.'
    : mate.kind === 'tangent' ? 'Tangent needs a round face, and a flat or another round face; or a sphere and a flat face.' : mate.kind === 'cam' ? 'Cam needs a face of the cam (its lobe) and the follower\'s flat face.'
    : mate.kind === 'coincident' ? 'Coincident needs two flat faces, a straight edge and a flat face, or two straight edges.' : `${KIND_LABEL[mate.kind]} needs two flat faces.`;
  if (mate.kind === 'distance' && !Number.isFinite(mate.distance ?? NaN)) return 'Enter a distance.';
  if (mate.kind === 'angle' && !(Number.isFinite(mate.angle ?? NaN) && mate.angle! >= 0 && mate.angle! <= 180)) return 'Enter an angle from 0° to 180°.';
  return null;
}

/**
 * Places every instance its mates move. `tables(part)` gives a part's faces in its own coordinates
 * (undefined while they are being read). Instances are solved after the parts they are mated to; the base
 * part, grounded instances and instances no mate moves keep where they are. Given the placements `before` a
 * change, a part whose first mate's part moved while it stayed is carried along with it first, so it keeps
 * its place relative to that part in the directions its mates leave free.
 */
export function solveAssembly(instances: readonly PartInstance[], mates: readonly Mate[], tables: (part: string) => FaceTable | undefined, before?: readonly PartInstance[]): Solved {
  const problems: Problem[] = [];
  const byId = new Map(instances.map(i => [i.id, i]));
  const name = (part: string) => part === BASE ? 'the base part' : byId.get(part)?.name ?? part;
  // Static checks: both parts present and different, the moving one free, both faces there and suited.
  // (`faces`: each mate's two faces as solved — an edge or a cone as a radius-0 round face, solvedFaces.)
  const valid: Mate[] = [], faces = new Map<string, ReturnType<typeof solvedFaces>>();
  for (const m of mates) {
    if (m.a.part !== BASE && !byId.has(m.a.part) || !byId.has(m.b.part) && m.b.part !== BASE) { problems.push({ mate: m.id, reason: 'One of its parts was removed.' }); continue; }
    if (m.a.part === m.b.part) { problems.push({ mate: m.id, reason: 'Both faces are on the same part.' }); continue; }
    if (m.b.part === BASE || byId.get(m.b.part)?.grounded) { problems.push({ mate: m.id, reason: `${name(m.b.part)} is fixed, so this mate cannot move it.` }); continue; }
    if ((m.a.at !== undefined || m.b.at !== undefined) && (m.kind === 'lock' || m.kind === 'cam')) { problems.push({ mate: m.id, reason: '[CONNECTOR_KIND] A cam or lock mate cannot carry connectors.' }); continue; }
    if (m.kind === 'lock') { if (m.rel) valid.push(m); else problems.push({ mate: m.id, reason: 'It has no placement to keep.' }); continue; }
    const ta = tables(m.a.part), tb = tables(m.b.part);
    if (!ta || !tb) return { instances: [...instances], problems: [], pending: true, freedom: {} };
    const why = mateRefusal(m, ta[m.a.face], tb[m.b.face]);
    if (why) { problems.push({ mate: m.id, reason: why }); continue; }
    // (A cam mate holds nothing here: the follower's own mates place it; the joint tree couples it, robot/cam.ts.)
    if (m.kind === 'cam') continue;
    const sf = mateFacesOf(m, { a: ta[m.a.face], b: tb[m.b.face] });
    faces.set(m.id, sf); valid.push(sf.as === m.kind ? m : { ...m, kind: sf.as });
  }
  const label = (m: Mate) => { const k = mates.findIndex(x => x.id === m.id); return mateLabel(mates[k], k); };
  const fixedFace = (m: Mate) => faces.get(m.id)!.a, movingFace = (m: Mate) => faces.get(m.id)!.b;
  // Placements as solved so far (the base part at the origin).
  const placed = new Map<string, { R: Mat3; t: Vec3 }>([[BASE, { R: IDENTITY, t: [0, 0, 0] }]]);
  const moved = new Set(valid.map(m => m.b.part));
  for (const inst of instances) if (!moved.has(inst.id)) placed.set(inst.id, { R: rotationMatrix(inst.rotation), t: [...inst.position] });
  const out = new Map(instances.map(i => [i.id, i])), freedom: Record<string, Freedom> = {};
  let waiting = [...moved];
  while (waiting.length) {
    const ready = waiting.filter(id => valid.every(m => m.b.part !== id || placed.has(m.a.part)));
    if (!ready.length) {
      // What is left moves in a loop (A placed by B placed by A): none of it can be solved.
      for (const id of waiting) for (const m of valid) if (m.b.part === id) problems.push({ mate: m.id, reason: `${LOOP_REASON}: ${name(m.a.part)} is itself placed by mates to ${name(id)}. Fix one of the parts or delete a mate in the loop.` });
      for (const id of waiting) { const i = byId.get(id)!; placed.set(id, { R: rotationMatrix(i.rotation), t: [...i.position] }); }
      break;
    }
    for (const id of ready) {
      const own = valid.filter(m => m.b.part === id), lock = own.find(m => m.kind === 'lock');
      if (lock) {
        // Locked: its placement is the lock's, on the part it is locked to; the other mates are only checked.
        const ref = placed.get(lock.a.part)!, R = matMul(ref.R, rotationMatrix(lock.rel!.rotation)), t = add(apply(ref.R, lock.rel!.position), ref.t);
        const at = { ...byId.get(id)!, rotation: eulerOf(R), position: t.map(v => clean(v)) as Vec3 };
        for (const m of own) {
          if (m === lock) continue;
          let why: string | null = null;
          if (m.kind === 'lock') {
            const R2 = matMul(placed.get(m.a.part)!.R, rotationMatrix(m.rel!.rotation)), t2 = add(apply(placed.get(m.a.part)!.R, m.rel!.position), placed.get(m.a.part)!.t);
            if (R2.some((v, k) => Math.abs(v - R[k]) > DIR_TOL) || len(sub(t2, t)) > POS_TOL) why = `it holds ${name(id)} somewhere else.`;
          } else {
            const one = solveOne(at, [{ mate: m, fixed: placeFace(fixedFace(m), placed.get(m.a.part)!.R, placed.get(m.a.part)!.t), moving: movingFace(m) }], label, name(id));
            const turn = degBetween((one.R[0] * R[0] + one.R[1] * R[1] + one.R[2] * R[2] + one.R[3] * R[3] + one.R[4] * R[4] + one.R[5] * R[5] + one.R[6] * R[6] + one.R[7] * R[7] + one.R[8] * R[8] - 1) / 2), off = len(sub(one.t, t));
            if (one.problems.length) why = one.problems[0].reason;
            else if (turn > 1e-6 || off > POS_TOL) why = `it holds ${name(id)} ${off > POS_TOL ? `${fmtNum(off)} mm` : ''}${off > POS_TOL && turn > 1e-6 ? ' and ' : ''}${turn > 1e-6 ? `${fmtNum(turn)}°` : ''} from where this mate puts it.`;
          }
          if (why) problems.push({ mate: m.id, reason: `Conflicts with ${label(lock)}: ${why}` });
        }
        placed.set(id, { R, t }); freedom[id] = { turns: 0, slides: 0 }; out.set(id, at);
        continue;
      }
      const inst = carried(byId.get(id)!, own[0].a.part, placed.get(own[0].a.part)!, before);
      const r = solveOne(inst, own.map(m => {
        const ref = placed.get(m.a.part)!;
        return { mate: m, fixed: placeFace(fixedFace(m), ref.R, ref.t), moving: movingFace(m) };
      }), label, name(id));
      problems.push(...r.problems);
      placed.set(id, { R: r.R, t: r.t }); freedom[id] = r.freedom;
      if (own.length > r.problems.length) out.set(id, { ...inst, rotation: eulerOf(r.R), position: r.t.map(v => clean(v)) as Vec3 });
    }
    waiting = waiting.filter(id => !ready.includes(id));
  }
  return { instances: instances.map(i => out.get(i.id)!), problems, pending: false, freedom };
}

/** What a lock keeps: b's placement in a's own coordinates (a: the base part at the origin, or an instance). */
export function lockRel(a: { position: readonly number[]; rotation: readonly number[] } | null, b: { position: readonly number[]; rotation: readonly number[] }): { position: Vec3; rotation: Vec3 } {
  const Ra = a ? rotationMatrix(a.rotation) : IDENTITY, ta: Vec3 = a ? [...a.position] as Vec3 : [0, 0, 0], RaT = transpose(Ra);
  return { rotation: eulerOf(matMul(RaT, rotationMatrix(b.rotation))), position: apply(RaT, sub([...b.position] as Vec3, ta)).map(v => clean(v)) as Vec3 };
}

/** An instance moved rigidly with its reference part, when that part moved since `before` and it did not. */
function carried(inst: PartInstance, ref: string, now: { R: Mat3; t: Vec3 }, before: readonly PartInstance[] | undefined): PartInstance {
  const was = before?.find(i => i.id === inst.id), refWas = before?.find(i => i.id === ref);
  const same = (a: readonly number[], b: readonly number[]) => a.every((v, k) => v === b[k]);
  if (!was || !refWas || !same(was.position, inst.position) || !same(was.rotation, inst.rotation)) return inst;
  const Ro = rotationMatrix(refWas.rotation);
  if (same(Ro, now.R) && same(refWas.position, now.t)) return inst;
  const D = matMul(now.R, transpose(Ro));
  return { ...inst, rotation: eulerOf(matMul(D, rotationMatrix(inst.rotation))), position: add(apply(D, sub(inst.position as Vec3, refWas.position as Vec3)), now.t) };
}

interface Term { mate: Mate; fixed: MateFace; moving: MateFace }

/** One instance placed by its mates (each to faces already placed), from where it stands. */
function solveOne(inst: PartInstance, terms: Term[], label: (m: Mate) => string, partName: string): { R: Mat3; t: Vec3; problems: Problem[]; freedom: Freedom } {
  const problems: Problem[] = [];
  // 1. Rotation: each mate asks R·u = v for a direction u of the moving face (a normal, an axis).
  const dirs: { u: Vec3; v: Vec3; mate: Mate }[] = [], accepted: Term[] = [];
  let frame: Mat3 | null = null;
  const Rcur = rotationMatrix(inst.rotation);
  // One explicit universal reuses the existing perpendicular-direction solve and three point rows.
  // Combining it with other mates needs a coupled solve/rank analysis outside this slice; locks are
  // checked separately at their captured pose by solveAssembly. Refuse instead of reporting false DoF.
  const universals = terms.filter(t => t.mate.kind === 'universal');
  if (universals.length && terms.length > 1) {
    const rest = solveOne(inst, terms.filter(t => t.mate.kind !== 'universal'), label, partName);
    return { ...rest, problems: [...rest.problems, ...universals.map(t => ({ mate: t.mate.id, reason: 'A universal combined with other mates needs an unsupported coupled solve.' }))] };
  }
  // One ball anchor (including redundant mates on that same point) is a point-only joint. Distinct
  // anchors need a coupled rotational solve, which this analytic slice does not implement.
  const balls = terms.filter(t => t.mate.kind === 'ball');
  const unsupported = balls.filter(t => len(sub(t.moving.point, balls[0].moving.point)) > POS_TOL);
  if (unsupported.length) {
    const rest = solveOne(inst, terms.filter(t => !unsupported.includes(t)), label, partName);
    return { ...rest, problems: [...rest.problems, ...unsupported.map(t => ({ mate: t.mate.id, reason: 'Ball mates at different points of one moving part need an unsupported rotational solve.' }))] };
  }
  // Mates with a set sense first; an axis either way round then takes the sense that fits them (or, when
  // both fit, the one nearer how the part stands).
  const free = (t: Term) => t.mate.kind === 'concentric' && t.mate.flip === undefined || roundPair(t);
  // Angles, universals and flat-to-round tangents hold a direction at an angle to another, not onto it: they come after.
  const cone = (t: Term) => t.mate.kind === 'angle' || t.mate.kind === 'universal' || t.mate.kind === 'tangent' && !roundPair(t);
  // (A sphere's mates hold its centre only: no direction.)
  const turning = terms.filter(t => t.fixed.kind !== 'sphere' && t.moving.kind !== 'sphere');
  const angles = turning.filter(cone);
  for (const term of [...turning.filter(t => !free(t) && !cone(t)), ...turning.filter(free)]) {
    const directions = term.mate.kind === 'fastened'
      ? [{ u: (term.moving as Plane).normal, v: mul((term.fixed as Plane).normal, term.mate.flip ? -1 : 1) }, { u: (term.moving as Plane).x!, v: (term.fixed as Plane).x! }]
      : [directionOf(term)];
    const count = dirs.length;
    const previousFrame: Mat3 | null = frame;
    let rejected = false;
    for (const { u, v: v0 } of directions) {
      const misfit = (v: Vec3): string | null => {
        if (frame) {
          const off = len(sub(apply(frame, u), v));
          return off > DIR_TOL ? `${dirs.map(d => label(d.mate)).filter((x, i, all) => all.indexOf(x) === i).join(' and ')}: they turn ${partName} so this face points ${fmtNum(degBetween(dot(apply(frame, u), v)))}° away from where it must.` : null;
        }
        const d = dirs.find(d => Math.abs(dot(u, d.u) - dot(v, d.v)) > DIR_TOL);
        if (!d) return null;
        // The same face (or a parallel one) already pointed by that mate: say how far this one would turn it.
        const c = dot(u, d.u);
        if (Math.abs(c) > 1 - DIR_TOL) {
          const turn = fmtNum(degBetween(dot(v, d.v) * Math.sign(c)));
          return d.mate.b.face === term.mate.b.face ? `${label(d.mate)}: it already sets which way this face of ${partName} points, and this mate would turn it ${turn}° from there.`
            : `${label(d.mate)}: it already sets which way a face of ${partName} parallel to this one points, and this mate would turn them ${turn}° from there.`;
        }
        return `${label(d.mate)}: on ${partName} its face is ${fmtNum(degBetween(c))}° from that mate's face, but the faces they mate to are ${fmtNum(degBetween(dot(v, d.v)))}° apart.`;
      };
      let v = v0, conflict = misfit(v0);
      if (free(term)) {
        const back = mul(v0, -1), fitsBack = !misfit(back);
        const nearer = dot(apply(frame ?? Rcur, u), v0) >= 0 ? v0 : back;
        v = conflict ? back : fitsBack ? nearer : v0;
        if (!conflict || fitsBack) conflict = null;
      }
      if (conflict) { problems.push({ mate: term.mate.id, reason: `Conflicts with ${conflict}` }); rejected = true; break; }
      dirs.push({ u, v, mate: term.mate });
      // Two independent directions fix the rotation: the frame they span on the part onto their partners' frame.
      if (!frame && len(cross(u, dirs[0].u)) > 1e-6) frame = matMul(orthoFrame(dirs[0].v, v), transpose(orthoFrame(dirs[0].u, u)));
    }
    if (rejected) { dirs.splice(count); frame = previousFrame; } else accepted.push(term);
  }
  // One direction (or parallel ones): the smallest turn from where the part stands.
  let R = frame ?? (dirs.length ? matMul(turnOnto(unit(apply(Rcur, dirs[0].u)), unit(dirs[0].v)), Rcur) : Rcur);
  // Angles: each turns the part about the one axis left free (the fixed direction, else the first angle's
  // partner normal) by the smallest turn that sets it; with the rotation already fixed it is only checked.
  let hinge: Vec3 | null = frame ? null : dirs.length ? unit(dirs[0].v) : null;
  // Free turns: none once the rotation is fixed, one about the hinge, two when an angle alone holds it.
  let turns = frame ? 0 : dirs.length ? 1 : 3;
  for (const term of angles) {
    // An angle: the moving normal at `angle` to the partner's (opposed); a tangent: the axis square to the face's normal.
    const dirOf = (f: MateFace) => f.kind === 'plane' ? f.normal : (f as Cylinder).axis;
    const u = dirOf(term.moving), n = dirOf(term.fixed);
    const w = term.mate.kind === 'angle' && !planesAligned(term.mate) ? mul(n, -1) : n, c = term.mate.kind === 'angle' ? Math.cos((term.mate.angle ?? 0) * DEG) : 0, a = apply(R, u);
    const fixedBy = dirs.map(d => label(d.mate)).filter((x, i, all) => all.indexOf(x) === i).join(' and ') || 'the angle before it';
    if (frame) {
      if (Math.abs(dot(a, w) - c) > DIR_TOL) problems.push({ mate: term.mate.id, reason: `Conflicts with ${fixedBy}: they hold this face of ${partName} at ${fmtNum(degBetween(dot(a, w)))}° to its partner.` });
      else accepted.push(term);
      continue;
    }
    if (!hinge) {
      // Nothing holds the part yet: the smallest turn of this face onto the cone around its partner.
      const k = cross(a, w), s = len(k);
      const axis = s > 1e-12 ? mul(k, 1 / s) : perpendiculars(a)[0];
      R = matMul(axisAngle(axis, Math.acos(Math.max(-1, Math.min(1, dot(a, w)))) - Math.acos(Math.max(-1, Math.min(1, c)))), R);
      hinge = w; turns = 2; accepted.push(term); continue;
    }
    // A cos φ + B sin φ = C for the turn φ about the hinge.
    const along = mul(hinge, dot(a, hinge)), across = sub(a, along);
    const A = dot(across, w), B = dot(cross(hinge, across), w), C = c - dot(along, w), r = Math.hypot(A, B);
    const lo = degBetween(dot(along, w) + r), hi = degBetween(dot(along, w) - r);
    if (r < 1e-12 ? Math.abs(C) > DIR_TOL : Math.abs(C) > r + DIR_TOL) {
      problems.push({ mate: term.mate.id, reason: `Conflicts with ${fixedBy}: turning ${partName} about the axis they leave free, this face can only be ${fmtNum(lo)}° to ${fmtNum(hi)}° from its partner.` });
      continue;
    }
    if (r >= 1e-12) {
      const phi0 = Math.atan2(B, A), d = Math.acos(Math.max(-1, Math.min(1, C / r)));
      const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x)), p1 = wrap(phi0 + d), p2 = wrap(phi0 - d);
      R = matMul(axisAngle(hinge, Math.abs(p1) <= Math.abs(p2) ? p1 : p2), R);
    }
    frame = R; turns = 0; accepted.push(term);
  }
  // 2. Position: each mate asks g·t = h along one direction (flat faces) or two (an axis); the move is the
  // smallest from where the part stands. A mate whose demand the earlier ones already fix differently is refused.
  accepted.push(...terms.filter(t => t.fixed.kind === 'sphere' || t.moving.kind === 'sphere'));
  const t0: Vec3 = [...inst.position] as Vec3;
  const basis: { q: Vec3; s: number }[] = [], refused: Term[] = [];
  for (const term of accepted) {
    const added: { q: Vec3; s: number }[] = [];
    let off = 0;
    for (const { g, h } of rowsOf(term, R)) {
      let gp = g, r = h - dot(g, t0);
      for (const b of [...basis, ...added]) { const c = dot(gp, b.q); gp = sub(gp, mul(b.q, c)); r -= c * b.s; }
      const n = len(gp);
      if (n > 1e-9) added.push({ q: mul(gp, 1 / n), s: r / n });
      else if (Math.abs(r) > POS_TOL) { off = Math.abs(r); break; }
    }
    if (!off) { basis.push(...added); continue; }
    refused.push(term);
    const before = accepted.slice(0, accepted.indexOf(term)).map(x => label(x.mate));
    problems.push({ mate: term.mate.id, reason: `Conflicts with ${before.length ? before.join(' and ') : 'the mates before it'}: they hold ${partName} ${fmtNum(off)} mm from where this mate puts it.` });
  }
  // Round-to-round tangents: the axes a fixed distance apart, met by the smallest move the linear mates allow.
  let t = basis.reduce((acc, b) => add(acc, mul(b.q, b.s)), t0);
  const held = basis.map(b => b.q);
  const rounds = accepted.filter(roundPair);
  let roundHolds = 0; // directions the round tangents take (each one, a wedge two)
  // Two of them on parallel axes, with nothing else holding the part across them: wedged against both.
  if (rounds.length >= 2) {
    const r = placeWedge(rounds[0], rounds[1], R, t, held);
    if (r && 't' in r) { t = r.t; rounds.splice(0, 2); roundHolds += 2; }
    else if (r) {
      const [one, other] = rounds;
      refused.push(other); rounds.splice(1, 1);
      problems.push({ mate: other.mate.id, reason: `Conflicts with ${label(one.mate)}: ${r.why}` });
    }
  }
  for (const term of rounds) {
    const r = placeRound(term, R, t, held);
    if ('t' in r) { t = r.t; roundHolds += r.holds; continue; }
    refused.push(term);
    // What holds it: every mate placed by position before it (the linear ones, and earlier round ones).
    const before = accepted.filter(x => x !== term && !refused.includes(x) && (!roundPair(x) || accepted.indexOf(x) < accepted.indexOf(term))).map(x => label(x.mate));
    problems.push({ mate: term.mate.id, reason: `Conflicts with ${before.length ? before.join(' and ') : 'the mates before it'}: they hold ${partName} so the axes can only be ${r.range} apart, not ${fmtNum(r.want)} mm.` });
  }
  // A mate refused for its position gives up its direction too: solve again without it.
  if (refused.length) {
    const again = solveOne(inst, accepted.filter(x => !refused.includes(x)), label, partName);
    return { R: again.R, t: again.t, problems: [...problems, ...again.problems], freedom: again.freedom };
  }
  return { R, t, problems, freedom: { turns, slides: Math.max(0, 3 - basis.length - roundHolds) } };
}

/** How far a pair of round faces' axes must be apart (outside each other; inside a hole, or flipped: the difference). */
function roundGap(term: Term): number {
  const f = term.fixed as Cylinder, m = term.moving as Cylinder;
  return (f.outer !== m.outer) !== !!term.mate.flip ? Math.abs(f.radius - m.radius) : f.radius + m.radius;
}

/**
 * Two round-to-round tangents on parallel axes, with both directions across them free: across the axes,
 * the shift Δ must lie on two circles (|Δ − qᵢ| = dᵢ, qᵢ the fixed axis less the moving one), so Δ is
 * where they cross — the crossing nearer no shift. Null when this case does not apply (the axes are not
 * parallel, or the linear mates already hold a direction across them).
 */
function placeWedge(first: Term, second: Term, R: Mat3, t: Vec3, held: Vec3[]): { t: Vec3 } | { why: string } | null {
  const f1 = first.fixed as Cylinder, f2 = second.fixed as Cylinder;
  if (len(cross(f1.axis, f2.axis)) > 1e-9) return null;
  const [e1, e2] = perpendiculars(f1.axis);
  // Both directions across the axes must be free of the linear mates.
  if (held.some(q => Math.abs(dot(q, e1)) > 1e-9 || Math.abs(dot(q, e2)) > 1e-9)) return null;
  const across = (v: Vec3): [number, number] => [dot(v, e1), dot(v, e2)];
  const q = [first, second].map(term => {
    const fixedAt = across((term.fixed as Cylinder).point), movingAt = across(add(apply(R, (term.moving as Cylinder).point), t));
    return [fixedAt[0] - movingAt[0], fixedAt[1] - movingAt[1]] as [number, number];
  });
  const d1 = roundGap(first), d2 = roundGap(second);
  const dx = q[1][0] - q[0][0], dy = q[1][1] - q[0][1], D = Math.hypot(dx, dy);
  if (D < 1e-12) {
    if (Math.abs(d1 - d2) > POS_TOL) return { why: `both put the same axis, ${fmtNum(d1)} and ${fmtNum(d2)} mm from it.` };
    return null; // the same circle twice: one tangent does
  }
  if (D > d1 + d2 + POS_TOL || D < Math.abs(d1 - d2) - POS_TOL) {
    return { why: `the two axes it touches are ${fmtNum(D)} mm apart, so it cannot be ${fmtNum(d1)} mm from one and ${fmtNum(d2)} mm from the other.` };
  }
  // The crossings of the two circles; the one needing the smaller shift.
  const along = (D * D + d1 * d1 - d2 * d2) / (2 * D), h = Math.sqrt(Math.max(0, d1 * d1 - along * along));
  const ux = dx / D, uy = dy / D, mx = q[0][0] + along * ux, my = q[0][1] + along * uy;
  const p1: [number, number] = [mx - h * uy, my + h * ux], p2: [number, number] = [mx + h * uy, my - h * ux];
  const shift = Math.hypot(...p1) <= Math.hypot(...p2) ? p1 : p2;
  held.push(e1, e2);
  return { t: add(t, add(mul(e1, shift[0]), mul(e2, shift[1]))) };
}

/**
 * Two round faces touching: the moving axis `want` = rA + rB from the fixed one (inside a hole, or flipped:
 * |rA − rB|). Across the fixed axis that is a circle; the move goes to its nearest point, along the
 * directions the linear mates (`held`, orthonormal) leave free. Once placed, both directions across the
 * axis are held for later ones.
 */
function placeRound(term: Term, R: Mat3, t: Vec3, held: Vec3[]): { t: Vec3; holds: number } | { range: string; want: number } {
  const f = term.fixed as Cylinder, m = term.moving as Cylinder;
  const inside = (f.outer !== m.outer) !== !!term.mate.flip, want = inside ? Math.abs(f.radius - m.radius) : f.radius + m.radius;
  const [e1, e2] = perpendiculars(f.axis);
  const off = sub(add(apply(R, m.point), t), f.point), x: [number, number] = [dot(off, e1), dot(off, e2)];
  // The free directions (the complement of what is held), and what each does across the axis.
  const freeDirs: Vec3[] = [];
  for (const e of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[]) {
    let v = e;
    for (const q of [...held, ...freeDirs]) v = sub(v, mul(q, dot(v, q)));
    if (len(v) > 1e-9) freeDirs.push(unit(v));
  }
  const G = freeDirs.map(fd => [dot(fd, e1), dot(fd, e2)] as [number, number]);
  // G Gᵀ (2 × 2): its rank is how many directions across the axis are free.
  const a = G.reduce((s, g) => s + g[0] * g[0], 0), b = G.reduce((s, g) => s + g[0] * g[1], 0), c = G.reduce((s, g) => s + g[1] * g[1], 0);
  const det = a * c - b * b, norm2 = Math.hypot(x[0], x[1]);
  const lockAfter = () => { held.push(...[e1, e2].map(e => { let v = e; for (const q of held) v = sub(v, mul(q, dot(v, q))); return v; }).filter(v => len(v) > 1e-9).map(unit)); };
  const moveBy = (s: [number, number], inv: [number, number, number]): Vec3 => {
    // The smallest move making the shift s across the axis: Δ = Σ fᵢ (Gᵢ · (G Gᵀ)⁺ s).
    const y: [number, number] = [inv[0] * s[0] + inv[1] * s[1], inv[1] * s[0] + inv[2] * s[1]];
    return freeDirs.reduce((acc, fd, i) => add(acc, mul(fd, G[i][0] * y[0] + G[i][1] * y[1])), [0, 0, 0] as Vec3);
  };
  if (det > 1e-12) {
    // Free across the axis: straight out (or in) to the circle; from the axis itself, along the first direction across.
    const dir: [number, number] = norm2 > 1e-12 ? [x[0] / norm2, x[1] / norm2] : [1, 0];
    const target: [number, number] = [dir[0] * want, dir[1] * want];
    const tt = add(t, moveBy([target[0] - x[0], target[1] - x[1]], [c / det, -b / det, a / det]));
    lockAfter(); return { t: tt, holds: 1 };
  }
  if (a + c > 1e-12) {
    // One direction g across the axis: |x + λ g| = want, the smaller λ.
    const gl = Math.sqrt(a + c), g: [number, number] = [Math.sqrt(a) / gl, (b >= 0 ? 1 : -1) * Math.sqrt(c) / gl];
    const xg = x[0] * g[0] + x[1] * g[1], perp = Math.abs(x[0] * g[1] - x[1] * g[0]), disc = want * want - perp * perp;
    if (disc < -POS_TOL * want * 2) return { range: `at least ${fmtNum(perp)} mm`, want };
    const root = Math.sqrt(Math.max(0, disc)), l1 = -xg + root, l2 = -xg - root, lambda = Math.abs(l1) <= Math.abs(l2) ? l1 : l2;
    const s2 = a + c; // G Gᵀ = s2 g gᵀ: its pseudo-inverse on g is g gᵀ / s2
    const tt = add(t, moveBy([lambda * g[0], lambda * g[1]], [g[0] * g[0] / s2, g[0] * g[1] / s2, g[1] * g[1] / s2]));
    lockAfter(); return { t: tt, holds: 1 };
  }
  if (Math.abs(norm2 - want) > POS_TOL) return { range: `exactly ${fmtNum(norm2)} mm`, want };
  return { t, holds: 0 };
}

type Cylinder = Extract<MateFace, { kind: 'cylinder' }>;
type Plane = Extract<MateFace, { kind: 'plane' }>;
/** Whether a flat mate's normals face the same way: flip, or the reverse when an origin plane is involved. */
/** A frame, not a face of a B-rep: a part's origin planes, or a datum of its locked references (A6.3, O75) — no material side. */
export const frameFace = (name: string) => name.startsWith('origin:') || name.startsWith('datum:');
export const planesAligned = (m: Mate) => !!m.flip !== (frameFace(m.a.face) || frameFace(m.b.face));
/** The direction a mate turns: flat faces opposed (flip: the same way), axes the same way (flip: reversed). */
function directionOf(t: Term): { u: Vec3; v: Vec3 } {
  if (t.fixed.kind === 'plane' && t.moving.kind === 'plane') return { u: t.moving.normal, v: planesAligned(t.mate) ? t.fixed.normal : mul(t.fixed.normal, -1) };
  return { u: (t.moving as Cylinder).axis, v: mul((t.fixed as Cylinder).axis, t.mate.kind === 'concentric' && t.mate.flip ? -1 : 1) };
}
/** A tangent between two round faces (parallel axes a sum or a difference of radii apart). */
const roundPair = (t: Term) => t.mate.kind === 'tangent' && t.fixed.kind === 'cylinder' && t.moving.kind === 'cylinder';
/** The linear conditions g·t = h a mate puts on the move t, once the rotation R is known. */
function rowsOf(term: Term, R: Mat3): { g: Vec3; h: number }[] {
  const f = term.fixed, m = term.moving;
  if (term.mate.kind === 'angle') return [];
  if (term.mate.kind === 'fastened' || term.mate.kind === 'universal') return ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[]).map(e => ({ g: e, h: dot(e, f.point) - dot(e, apply(R, m.point)) }));
  if (term.mate.kind === 'tangent') {
    // The axis a radius off the face: in front of it (flip: behind).
    const side = term.mate.flip ? -1 : 1;
    if (f.kind === 'plane' && (m.kind === 'cylinder' || m.kind === 'sphere')) return [{ g: f.normal, h: dot(f.normal, f.point) + side * m.radius - dot(f.normal, apply(R, m.point)) }];
    if ((f.kind === 'cylinder' || f.kind === 'sphere') && m.kind === 'plane') { const n = apply(R, m.normal); return [{ g: n, h: dot(n, f.point) - side * f.radius - dot(n, apply(R, m.point)) }]; }
    return []; // two round faces: not linear, placed after the linear mates (placeRound)
  }
  if (f.kind === 'plane' && m.kind === 'plane') {
    const d = term.mate.kind === 'distance' ? term.mate.distance ?? 0 : 0;
    return [{ g: f.normal, h: dot(f.normal, f.point) + d - dot(f.normal, apply(R, m.point)) }];
  }
  // Two spheres' centres together, in all three directions.
  if (f.kind === 'sphere') return ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[]).map(e => ({ g: e, h: dot(e, f.point) - dot(e, apply(R, m.point)) }));
  // The moving axis point on the fixed axis: no offset across it, in two directions.
  return perpendiculars((f as Cylinder).axis).map(e => ({ g: e, h: dot(e, f.point) - dot(e, apply(R, m.point)) }));
}

/** An orthonormal frame (as matrix columns) from a first direction and a second one not parallel to it. */
function orthoFrame(a: Vec3, b: Vec3): Mat3 {
  const e1 = unit(a), e2 = unit(sub(b, mul(e1, dot(b, e1)))), e3 = cross(e1, e2);
  return fromColumns(e1, e2, e3);
}
/** Two unit directions perpendicular to a unit axis and to each other (exact for axis-aligned axes). */
function perpendiculars(a: Vec3): [Vec3, Vec3] {
  const pref: Vec3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = unit(sub(pref, mul(a, dot(pref, a))));
  return [e1, cross(a, e1)];
}
