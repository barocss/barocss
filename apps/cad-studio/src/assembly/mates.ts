// Assembly mates: an instance placed by relating its faces to faces of parts already placed. Each mate
// names a face that stays (`a`, on the base part or another instance) and a face on the instance it
// moves (`b`). The solve is analytic and exact for these rigid cases: the directions the mates demand
// (face normals, cylinder axes) fix the rotation — one direction by the smallest turn from where the part
// stands, two by the frame they span — and the positions they demand are linear in the move, solved for the
// smallest move from where it stands. A mate that disagrees with the ones before it is refused with the
// reason; nothing is fitted or iterated, so a solved assembly stays put when it is solved again.
import type { PartInstance } from '../engine/doc';

export type Vec3 = [number, number, number];
export type MateKind = 'coincident' | 'concentric' | 'distance' | 'angle';
/** A face by its persistent B-rep name on a part: `base` (the document's own part) or an instance id. */
export interface MateRef { part: string; face: string }
/**
 * `coincident`: flat faces flush, facing each other (flip: facing the same way). `distance`: the same,
 * `distance` mm apart along the fixed face's normal. `concentric`: two round faces on one axis, the axes
 * either way round (flip unset: as the other mates or the part's stance have it), the same way (false)
 * or reversed (true). `angle`: flat faces `angle` degrees apart (0: facing each other as in coincident; flip:
 * measured from facing the same way), with no hold on position.
 */
export interface Mate { id: string; kind: MateKind; a: MateRef; b: MateRef; distance?: number; angle?: number; flip?: boolean }

/** A face's exact geometry in its part's own coordinates. */
export type MateFace =
  | { kind: 'plane'; point: Vec3; normal: Vec3 }
  | { kind: 'cylinder'; point: Vec3; axis: Vec3; radius: number; outer: boolean };
export type FaceTable = Record<string, MateFace>;

export const BASE = 'base';
export const KIND_LABEL: Record<MateKind, string> = { coincident: 'Coincident', concentric: 'Concentric', distance: 'Distance', angle: 'Angle' };
export const mateLabel = (mate: Mate, index: number) => `${KIND_LABEL[mate.kind]} ${index + 1}`;

/** Which mates a pair of faces admits. */
export const kindsFor = (a: MateFace, b: MateFace): MateKind[] =>
  a.kind === 'plane' && b.kind === 'plane' ? ['coincident', 'distance', 'angle'] : a.kind === 'cylinder' && b.kind === 'cylinder' ? ['concentric'] : [];

// ── Small exact vector and rotation helpers (row-major 3 × 3) ──
type Mat3 = [number, number, number, number, number, number, number, number, number];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => mul(a, 1 / len(a));
const apply = (m: Mat3, v: Vec3): Vec3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const matMul = (a: Mat3, b: Mat3): Mat3 => {
  const r = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
};
const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** Columns c0, c1, c2 as a matrix, and a frame's transpose. */
const fromColumns = (c0: Vec3, c1: Vec3, c2: Vec3): Mat3 => [c0[0], c1[0], c2[0], c0[1], c1[1], c2[1], c0[2], c1[2], c2[2]];
const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
/** Rotation by `angle` radians about the unit `axis` (Rodrigues). */
function axisAngle(axis: Vec3, angle: number): Mat3 {
  const [x, y, z] = axis, c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
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

const DEG = Math.PI / 180;
/** An instance's rotation (degrees about X, then Y, then Z, as placedDoc applies it): R = Rz · Ry · Rx. */
export function rotationMatrix(rotation: readonly number[]): Mat3 {
  return matMul(axisAngle([0, 0, 1], rotation[2] * DEG), matMul(axisAngle([0, 1, 0], rotation[1] * DEG), axisAngle([1, 0, 0], rotation[0] * DEG)));
}
/** Values a hair from a round number are that number (and −0 is 0), so solved placements read cleanly. */
export const clean = (v: number, step = 1e-9) => { const r = Math.round(v); const x = Math.abs(v - r) < step ? r : v; return x === 0 ? 0 : x; };
/** The X→Y→Z angles (degrees) of a rotation; at ±90° about Y the X angle is 0. */
export function eulerOf(m: Mat3): Vec3 {
  const sy = -m[6];
  if (Math.abs(sy) > 1 - 1e-12) {
    const y = sy > 0 ? 90 : -90;
    return [0, y, clean(Math.atan2(-m[1], m[4]) / DEG)];
  }
  return [clean(Math.atan2(m[7], m[8]) / DEG), clean(Math.atan2(sy, Math.hypot(m[7], m[8])) / DEG), clean(Math.atan2(m[3], m[0]) / DEG)];
}

/** A face moved by a placement (R, t). */
function placeFace(f: MateFace, R: Mat3, t: Vec3): MateFace {
  return f.kind === 'plane' ? { kind: 'plane', point: add(apply(R, f.point), t), normal: apply(R, f.normal) }
    : { ...f, point: add(apply(R, f.point), t), axis: apply(R, f.axis) };
}

export interface Problem { mate: string; reason: string }
export interface Solved {
  /** The instances with every mated one placed (unchanged where a mate failed). */
  instances: PartInstance[];
  /** Mates that cannot be met, each with why. */
  problems: Problem[];
  /** A part's faces are still being read: nothing was solved. */
  pending: boolean;
}

const DIR_TOL = 1e-9, POS_TOL = 1e-6;
const fmtNum = (v: number) => String(Math.round(v * 1000) / 1000);
const degBetween = (c: number) => Math.acos(Math.max(-1, Math.min(1, c))) / DEG;

/** Why a mate cannot be made from these two faces (or null). */
export function mateRefusal(mate: Mate, fa: MateFace | undefined, fb: MateFace | undefined): string | null {
  if (!fa || !fb) return 'One of its faces is no longer on the part (a feature was edited or removed).';
  const kinds = kindsFor(fa, fb);
  if (!kinds.length) return 'A flat face and a round face cannot be mated: pick two flat faces (coincident, distance, angle) or two round faces (concentric).';
  if (!kinds.includes(mate.kind)) return mate.kind === 'concentric' ? 'Concentric needs two round faces (a hole, a pin).' : `${KIND_LABEL[mate.kind]} needs two flat faces.`;
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
  const valid: Mate[] = [];
  for (const m of mates) {
    if (m.a.part !== BASE && !byId.has(m.a.part) || !byId.has(m.b.part) && m.b.part !== BASE) { problems.push({ mate: m.id, reason: 'One of its parts was removed.' }); continue; }
    if (m.a.part === m.b.part) { problems.push({ mate: m.id, reason: 'Both faces are on the same part.' }); continue; }
    if (m.b.part === BASE || byId.get(m.b.part)?.grounded) { problems.push({ mate: m.id, reason: `${name(m.b.part)} is fixed, so this mate cannot move it.` }); continue; }
    const ta = tables(m.a.part), tb = tables(m.b.part);
    if (!ta || !tb) return { instances: [...instances], problems: [], pending: true };
    const why = mateRefusal(m, ta[m.a.face], tb[m.b.face]);
    if (why) { problems.push({ mate: m.id, reason: why }); continue; }
    valid.push(m);
  }
  const label = (m: Mate) => mateLabel(m, mates.indexOf(m));
  // Placements as solved so far (the base part at the origin).
  const placed = new Map<string, { R: Mat3; t: Vec3 }>([[BASE, { R: IDENTITY, t: [0, 0, 0] }]]);
  const moved = new Set(valid.map(m => m.b.part));
  for (const inst of instances) if (!moved.has(inst.id)) placed.set(inst.id, { R: rotationMatrix(inst.rotation), t: [...inst.position] });
  const out = new Map(instances.map(i => [i.id, i]));
  let waiting = [...moved];
  while (waiting.length) {
    const ready = waiting.filter(id => valid.every(m => m.b.part !== id || placed.has(m.a.part)));
    if (!ready.length) {
      // What is left moves in a loop (A placed by B placed by A): none of it can be solved.
      for (const id of waiting) for (const m of valid) if (m.b.part === id) problems.push({ mate: m.id, reason: `It closes a loop: ${name(m.a.part)} is itself placed by mates to ${name(id)}. Fix one of the parts or delete a mate in the loop.` });
      for (const id of waiting) { const i = byId.get(id)!; placed.set(id, { R: rotationMatrix(i.rotation), t: [...i.position] }); }
      break;
    }
    for (const id of ready) {
      const own = valid.filter(m => m.b.part === id), inst = carried(byId.get(id)!, own[0].a.part, placed.get(own[0].a.part)!, before);
      const r = solveOne(inst, own.map(m => {
        const ref = placed.get(m.a.part)!;
        return { mate: m, fixed: placeFace(tables(m.a.part)![m.a.face], ref.R, ref.t), moving: tables(id)![m.b.face] };
      }), label, name(id));
      problems.push(...r.problems);
      placed.set(id, { R: r.R, t: r.t });
      if (own.length > r.problems.length) out.set(id, { ...inst, rotation: eulerOf(r.R), position: r.t.map(v => clean(v)) as Vec3 });
    }
    waiting = waiting.filter(id => !ready.includes(id));
  }
  return { instances: instances.map(i => out.get(i.id)!), problems, pending: false };
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
function solveOne(inst: PartInstance, terms: Term[], label: (m: Mate) => string, partName: string): { R: Mat3; t: Vec3; problems: Problem[] } {
  const problems: Problem[] = [];
  // 1. Rotation: each mate asks R·u = v for a direction u of the moving face (a normal, an axis).
  const dirs: { u: Vec3; v: Vec3; mate: Mate }[] = [], accepted: Term[] = [];
  let frame: Mat3 | null = null;
  const Rcur = rotationMatrix(inst.rotation);
  // Mates with a set sense first; an axis either way round then takes the sense that fits them (or, when
  // both fit, the one nearer how the part stands).
  const free = (t: Term) => t.mate.kind === 'concentric' && t.mate.flip === undefined;
  const angles = terms.filter(t => t.mate.kind === 'angle');
  for (const term of [...terms.filter(t => !free(t) && t.mate.kind !== 'angle'), ...terms.filter(free)]) {
    const { u, v: v0 } = directionOf(term);
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
    if (conflict) { problems.push({ mate: term.mate.id, reason: `Conflicts with ${conflict}` }); continue; }
    dirs.push({ u, v, mate: term.mate }); accepted.push(term);
    // Two independent directions fix the rotation: the frame they span on the part onto their partners' frame.
    if (!frame && len(cross(u, dirs[0].u)) > 1e-6) frame = matMul(orthoFrame(dirs[0].v, v), transpose(orthoFrame(dirs[0].u, u)));
  }
  // One direction (or parallel ones): the smallest turn from where the part stands.
  let R = frame ?? (dirs.length ? matMul(turnOnto(unit(apply(Rcur, dirs[0].u)), unit(dirs[0].v)), Rcur) : Rcur);
  // Angles: each turns the part about the one axis left free (the fixed direction, else the first angle's
  // partner normal) by the smallest turn that sets it; with the rotation already fixed it is only checked.
  let hinge: Vec3 | null = frame ? null : dirs.length ? unit(dirs[0].v) : null;
  for (const term of angles) {
    const u = (term.moving as Extract<MateFace, { kind: 'plane' }>).normal, n = (term.fixed as Extract<MateFace, { kind: 'plane' }>).normal;
    const w = term.mate.flip ? n : mul(n, -1), c = Math.cos((term.mate.angle ?? 0) * DEG), a = apply(R, u);
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
      hinge = w; accepted.push(term); continue;
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
    frame = R; accepted.push(term);
  }
  // 2. Position: each mate asks g·t = h along one direction (flat faces) or two (an axis); the move is the
  // smallest from where the part stands. A mate whose demand the earlier ones already fix differently is refused.
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
  // A mate refused for its position gives up its direction too: solve again without it.
  if (refused.length) {
    const again = solveOne(inst, accepted.filter(x => !refused.includes(x)), label, partName);
    return { R: again.R, t: again.t, problems: [...problems, ...again.problems] };
  }
  return { R, t: basis.reduce((acc, b) => add(acc, mul(b.q, b.s)), t0), problems };
}

type Cylinder = Extract<MateFace, { kind: 'cylinder' }>;
/** The direction a mate turns: flat faces opposed (flip: the same way), axes the same way (flip: reversed). */
function directionOf(t: Term): { u: Vec3; v: Vec3 } {
  if (t.fixed.kind === 'plane' && t.moving.kind === 'plane') return { u: t.moving.normal, v: t.mate.flip ? t.fixed.normal : mul(t.fixed.normal, -1) };
  return { u: (t.moving as Cylinder).axis, v: mul((t.fixed as Cylinder).axis, t.mate.flip ? -1 : 1) };
}
/** The linear conditions g·t = h a mate puts on the move t, once the rotation R is known. */
function rowsOf(term: Term, R: Mat3): { g: Vec3; h: number }[] {
  const f = term.fixed, m = term.moving;
  if (term.mate.kind === 'angle') return [];
  if (f.kind === 'plane' && m.kind === 'plane') {
    const d = term.mate.kind === 'distance' ? term.mate.distance ?? 0 : 0;
    return [{ g: f.normal, h: dot(f.normal, f.point) + d - dot(f.normal, apply(R, m.point)) }];
  }
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
