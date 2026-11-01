// R5.3 (D227): the part model's frame and weldment features — members, frames, gussets, end caps and weld beads —
// moved out of part-model.ts's operation() as they were there. Since D361 the frame helpers live here too; they call part-model's
// `boolean` and its other values through a function-level import (the Boolean stays in part-model.ts, where `frk-6-ordered-trim.test`'s coverage trap observes it).
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import { loopArea, loopPerimeter, type BeadJointRef, type BeadReport, type BeadSharedComponent, type BeadSharedSeam, type EndCapReport, type GussetReport, type WeldmentSeam } from '../frame-sheet/frame-weldment.js';
import { BrepError, mergeBreps, nurbsOf, type Brep } from '../brep/brep-core.js';
import { transformBrep, type BrepAffine } from '../brep/brep-transform.js';
import { curveTolerance, locateInRegion, type CurveSegment2, type XY } from '../brep/curved-arrangement.js';
import { FRAME_ANCHORS, anchorPoint, frameSection, isFrameSectionError, loopBox, type FrameAnchor, type FrameEndReport, type FrameMemberReport, type FrameNotchReport, type FrameSectionSpec } from '../frame-sheet/frame-section.js';
import { brepMassProperties, combineMassProperties, prismaticMassProperties, type MassProperties } from '../brep/solid-mass.js';
import { type Point } from '../types.js';
import { buildProfileLoop, type ProfileSegmentInput } from '../features/extruded-profile-solid.js';
import { revolveMassProperties, revolveProfile, type RevolveInput } from '../features/revolve.js';
import { lookupSection, sectionTableProblem, type SectionTable } from '../features/section-table.js';
import { type SideTags } from '../document/side-names.js';
import { booleanAnalytic } from '../brep/analytic-boolean.js';
import { brepFromPrismatic, prismaticFromProfile } from '../features/prismatic-solid.js';
import { curveDomain, evaluateCurve } from '../core/math.js';
import { draftedExtrusion } from '../features/drafted-extrusion.js';
import { glueAtSharedFace } from '../brep/brep-glue.js';
import { planar } from '../brep/brep-tessellate.js';
import { CadPartError, isRecord, CadPartLimits, moveAll, boolean, brepOf, obliqueHalf, splitBodies, empty, volumeOfSolid, resolvedDefinition } from './part-model.js';
import type { CadPartDim, Solid, CadPartPoint3, Part, Result, CadPartFeature, Tools } from './part-model.js';

/** A frame or weldment feature's evaluation (part-model.ts's operation() for these kinds). */
export function frameOperation(f: CadPartFeature & Record<string, unknown>, t: Tools): () => Result {
  const { dim, xyz, integer, ref, fail, at } = t;
  switch (f.kind) {
    case 'frame-member': {
      const start = xyz(f.start as CadPartPoint3, 'start'), end = xyz(f.end as CadPartPoint3, 'end'), L = len(sub(end, start));
      if (!(L > MEMBER_MIN_MM)) fail('PARAMETER', `[SEGMENT_ZERO_LENGTH] a member runs from its start to its end: they are ${L} mm apart`);
      const look = memberLook(f, '', dim, fail), up = memberUp(f.up, xyz, fail), shape = memberShape(f.section, 'section', { ref, dim, integer, fail });
      return () => buildMember(shape, { start, end, L, ...look, up, at });
    }
    case 'frame': {
      // FR2 (D124): one member per segment of a skeleton, each its own body (`<id>/<k>`), never united.
      const pts = f.points as unknown, segs = f.segments as unknown;
      if (!Array.isArray(pts) || pts.length < 2 || pts.length > CadPartLimits.points) fail('INPUT', `points must list 2 to ${CadPartLimits.points} [x, y, z] points`);
      if (!Array.isArray(segs) || !segs.length || segs.length > FRAME_MAX_MEMBERS) fail('INPUT', `segments must list 1 to ${FRAME_MAX_MEMBERS} [from, to] point indices`);
      const points = (pts as CadPartPoint3[]).map((p, i) => xyz(p, `points[${i}]`));
      const pairs = (segs as unknown[]).map((g, k): [number, number] => {
        if (isRecord(g)) return [integer(g.from, `segments[${k}].from`, 0, points.length - 1), integer(g.to, `segments[${k}].to`, 0, points.length - 1)];
        if (!Array.isArray(g) || g.length !== 2) fail('INPUT', `segments[${k}] must be [from, to] or { from, to, through | center }`);
        return [integer((g as unknown[])[0], `segments[${k}][0]`, 0, points.length - 1), integer((g as unknown[])[1], `segments[${k}][1]`, 0, points.length - 1)];
      });
      const lengths = pairs.map(([i, j], k) => {
        const L = len(sub(points[j], points[i]));
        if (!(L > MEMBER_MIN_MM)) fail('PARAMETER', `[SEGMENT_ZERO_LENGTH] segment ${k} runs from point ${i} to point ${j}: they are ${L} mm apart`);
        return L;
      });
      const curved = (segs as unknown[]).some(isRecord) || f.bends !== undefined;
      const clash = curved ? null : skeletonClash(points, pairs);
      if (clash) fail('PARAMETER', clash);
      const base = { look: memberLook(f, '', dim, fail), shape: memberShape(f.section, 'section', { ref, dim, integer, fail }) }, up = memberUp(f.up, xyz, fail);
      const per = pairs.map(() => base);
      const list = f.overrides as unknown;
      if (list !== undefined) {
        if (!Array.isArray(list) || list.length > pairs.length) fail('INPUT', 'overrides must list up to one { member, … } per member');
        const seen = new Set<number>();
        (list as unknown[]).forEach((o, n) => {
          if (!isRecord(o)) fail('INPUT', `overrides[${n}] must be { member, section?, anchor?, offset?, roll?, mirror? }`);
          const r = o as Record<string, unknown>, k = integer(r.member, `overrides[${n}].member`, 0, pairs.length - 1);
          if (seen.has(k)) fail('INPUT', `overrides[${n}]: member ${k} is overridden twice`);
          seen.add(k);
          const look = memberLook(r, `overrides[${n}].`, dim, fail, base.look);
          per[k] = { look, shape: r.section === undefined ? base.shape : memberShape(r.section, `overrides[${n}].section`, { ref, dim, integer, fail }) };
        });
      }
      if (curved) {
        const paths = frameCurvePaths(segs as unknown[], points, pairs, f.bends, { xyz, integer, dim, fail });
        const cornerSpec = frameCorners(f.corners, points, pairs, integer, fail, dim), curvePoints = new Set(paths.filter(p => p.center).flatMap(p => [p.from, p.to, ...p.indices.flatMap(i => pairs[i])]).map(i => canonicalPoint(points, i)));
        if (cornerSpec && [...cornerSpec.at.values()].some(c => c.notch)) fail('CAPABILITY', '[NOTCH_CUTTER] notch cutters on curved frames are not supported');
        if (cornerSpec && (cornerSpec.gap > 0 || [...cornerSpec.at.values()].some(c => (c.gap ?? 0) > 0))) fail('CAPABILITY', '[GAP_SIZE] gaps on curved frames are not supported');
        const suppressed = new Map(cornerSpec?.at ?? []);
        for (const point of curvePoints) {
          const incident = paths.filter(p => canonicalPoint(points, p.from) === point || canonicalPoint(points, p.to) === point);
          const kind = cornerSpec?.at.get(point)?.kind ?? (incident.length > 1 ? cornerSpec?.fallback ?? 'none' : 'none');
          if (!incident.length && cornerSpec?.at.has(point)) fail('PARAMETER', '[BEND_RADIUS] an authored corner conflicts with a consumed bend point');
          if (kind === 'butt') fail('CAPABILITY', '[BUTT_ON_CURVED_MEMBER] a butt cannot use a curved member as a planar face');
          if (kind !== 'none') {
            const outward = incident.map(p => canonicalPoint(points, p.from) === point ? (p.tangent ?? unit(sub(p.end, p.start))) : scale(p.endTangent ?? unit(sub(p.end, p.start)), -1));
            if (kind !== 'mitre' || outward.length !== 2) fail('CAPABILITY', '[ARC_MEMBER] a curved end corner requires a two-member mitre');
          }
          suppressed.set(point, { kind: 'none' });
        }
        const straightCorners = cornerSpec ? { ...cornerSpec, at: suppressed } : null;
        const trims = frameTrims(f.trims, pairs.length, { ref, xyz, integer, fail });
        if (trims.some(t => paths.some(p => p.center && p.indices.includes(t.member)))) fail('CAPABILITY', '[ARC_MEMBER] a curved member cannot be trimmed by the straight-member plane path');
        return () => {
          const places = pairs.map(([i, j], k) => placeMember(per[k].shape, { start: points[i], end: points[j], L: lengths[k], ...per[k].look, up }));
          const plan = straightCorners ? planCorners(straightCorners, points, pairs, lengths, places, at, fail) : emptyPlan(pairs.length);
          if (trims.length) planTrims(plan, trims, points, pairs, lengths, places, fail);
          for (const point of curvePoints) {
            const incident = paths.filter(p => canonicalPoint(points, p.from) === point || canonicalPoint(points, p.to) === point), kind = cornerSpec?.at.get(point)?.kind ?? (incident.length > 1 ? cornerSpec?.fallback ?? 'none' : 'none');
            if (kind !== 'mitre') continue;
            const ends = incident.map(path => {
              const end = canonicalPoint(points, path.to) === point ? 1 as const : 0 as const, k = path.indices[0], look = per[k].look;
              const tangent = end ? path.endTangent ?? unit(sub(path.end, path.start)) : path.tangent ?? unit(sub(path.end, path.start));
              const P = placeMember(per[k].shape, { ...look, up, start: points[point], end: add(points[point], tangent), L: 1 });
              if (path.center && end) { const startP = placeMember(per[k].shape, { ...look, up, start: path.start, end: add(path.start, path.tangent!), L: 1 }), x = rotateAround(startP.F.x, path.normal!, path.angle!); Object.assign(P, { F: { x, y: cross(tangent, x) } }); }
              return { member: k, end, P, inward: end ? tangent : scale(tangent, -1) };
            });
            const [A, B] = ends;
            for (const E of ends) plan.report[E.member] = plan.report[E.member].filter(r => r.end !== endName(E.end));
            if (dot(A.inward, B.inward) < -1 + 1e-9) {
              for (const E of ends) plan.report[E.member].push({ end: endName(E.end), point, kind: 'mitre', with: E === A ? B.member : A.member, angle: 0, plane: { origin: points[point], normal: E.inward } });
            } else mitre(plan, A, B, A.P, B.P, A.inward, B.inward, points[point], point, fail);
          }
          return { kind: 'solid', parts: paths.flatMap(path => {
          const k = path.indices[0], peers = path.indices.map(i => JSON.stringify(per[i]));
          if (peers.some(p => p !== peers[0])) fail('PARAMETER', '[BEND_RADIUS] joined bend segments must have identical section and placement');
          if (!path.center) return (buildMember(per[k].shape, { ...per[k].look, up, start: path.start, end: path.end, L: path.lead, at: `${at}.m${k}`, frame: { member: k, from: path.from, to: path.to }, ends: { extend: plan.extend[k], cuts: plan.cuts[k], subtract: plan.subtract[k], report: plan.report[k] } }) as Extract<Result, { kind: 'solid' }>).parts;
          return buildCurvedMember(per[k].shape, path, { ...per[k].look, up, at: `${at}.m${k}`, frame: { member: k, from: path.from, to: path.to }, ends: { extend: plan.extend[k], cuts: plan.cuts[k], subtract: [], report: plan.report[k] } }, fail).parts;
        }) };
        };
      }
      const corners = frameCorners(f.corners, points, pairs, integer, fail, dim), trims = frameTrims(f.trims, pairs.length, { ref, xyz, integer, fail });
      return () => {
        const places = pairs.map(([i, j], k) => placeMember(per[k].shape, { start: points[i], end: points[j], L: lengths[k], ...per[k].look, up }));
        const plan = corners || trims.length ? (corners ? planCorners(corners, points, pairs, lengths, places, at, fail) : emptyPlan(pairs.length)) : null, parts: Part[] = [];
        if (plan) planTrims(plan, trims, points, pairs, lengths, places, fail);
        for (let k = 0; k < pairs.length; k++) {
          const [i, j] = pairs[k], ends = plan ? { extend: plan.extend[k], cuts: plan.cuts[k], subtract: plan.subtract[k], report: [...plan.report[k]].sort((a, b) => a.end < b.end ? 1 : a.end > b.end ? -1 : 0) } : undefined;
          const r = buildMember(per[k].shape, { start: points[i], end: points[j], L: lengths[k], ...per[k].look, up, at: `${at}.m${k}`, frame: { member: k, from: i, to: j }, ...(ends ? { ends } : {}) }) as Extract<Result, { kind: 'solid' }>;
          parts.push(...r.parts);
        }
        return { kind: 'solid', parts };
      };
    }
    case 'gusset': case 'end-cap': {
      // FRk1 (D165): plates on a frame's members, placed by the members as built (referenced, not consumed).
      const fr = ref(f.frame, 'frame'), built = fr.result.kind === 'solid' && fr.part === null ? fr.result.parts.filter(q => q.memberPlace && q.member?.frame) : [];
      if (!built.length) fail('REFERENCE', `${String(f.frame)} is not a frame`);
      const byMember = new Map(built.map(q => [q.member!.frame!.member, q])), last = Math.max(...byMember.keys()), frame = String(f.frame);
      if (f.kind === 'end-cap') {
        const k = integer(f.member, 'member', 0, last), end = f.end === 'end' ? 1 : f.end === 'start' ? 0 : fail('INPUT', 'end must be start or end');
        if (f.fit !== 'over' && f.fit !== 'inset') fail('INPUT', 'fit must be over (the section\'s outline) or inset (in its bore)');
        const t = dim(f.thickness, 'thickness', true), part = byMember.get(k);
        if (!part) fail('REFERENCE', `${frame} has no member ${k}`);
        return () => endCapOf(part!, frame, k, end as 0 | 1, f.fit, t, at, fail);
      }
      if (!Array.isArray(f.legs) || f.legs.length !== 2) fail('INPUT', 'legs must be [l1, l2]: along the first member and the second');
      const legs: [number, number] = [dim(f.legs[0], 'legs[0]', true), dim(f.legs[1], 'legs[1]', true)];
      const t = dim(f.thickness, 'thickness', true), clip = f.clip === undefined ? 0 : dim(f.clip, 'clip'), offset = f.offset === undefined ? 0 : dim(f.offset, 'offset');
      if (clip < 0) fail('INPUT', 'clip must be 0 or more');
      let pair: [number, number] | undefined;
      if (f.members !== undefined) {
        if (!Array.isArray(f.members) || f.members.length !== 2) fail('INPUT', 'members must be [a, b], two members of the frame');
        pair = [integer(f.members[0], 'members[0]', 0, last), integer(f.members[1], 'members[1]', 0, last)];
        if (pair[0] === pair[1]) fail('INPUT', 'members must be two different members');
      }
      if (f.along !== undefined && f.along !== 1 && f.along !== -1) fail('INPUT', 'along must be 1 (the member\'s own direction) or −1');
      const point = integer(f.point, 'point', 0, CadPartLimits.points - 1);
      return () => gussetOf(byMember, { frame, point, ...(pair ? { pair } : {}), ...(f.along !== undefined ? { along: f.along as 1 | -1 } : {}), legs, t, clip, offset }, at, fail);
    }
    case 'weld-bead': {
      // FRk2 (D166): a fillet on a frame's joint, placed by the members (and gussets) as built; nothing consumed.
      const fr = ref(f.frame, 'frame'), built = fr.result.kind === 'solid' && fr.part === null ? fr.result.parts.filter(q => q.memberPlace && q.member?.frame) : [];
      if (!built.length) fail('REFERENCE', `${String(f.frame)} is not a frame`);
      const byMember = new Map(built.map(q => [q.member!.frame!.member, q])), frame = String(f.frame), on = f.on as unknown;
      if (isEndpointBead(f)) return () => t.endpointBead(f, byMember, frame);
      if (f.sharing !== undefined) fail('PARAMETER', '[BEAD_SHARED_UNSUPPORTED] sharing is supported only on endpoint beads');
      const leg = dim(f.leg, 'leg', true);
      if (f.inner !== undefined && typeof f.inner !== 'boolean') fail('INPUT', 'inner must be true or false');
      if (!isRecord(on)) return fail('INPUT', 'on must be { member, end }, { gusset } or { cap }');
      if ('cap' in on) { ref(on.cap, 'on.cap'); return fail('PARAMETER', '[BEAD_KIND] a cap sits flush with its member\'s outline: it is welded by a corner weld, not a fillet (its seam is in its endCap report)'); }
      if ('gusset' in on) {
        const g = ref(on.gusset, 'on.gusset').result, gp = g.kind === 'solid' && g.parts.length === 1 ? g.parts[0] : undefined;
        if (!gp?.gussetPlace) return fail('REFERENCE', `${String(on.gusset)} is not a gusset`);
        if (gp.gusset!.frame !== frame) fail('REFERENCE', `gusset ${String(on.gusset)} is on ${gp.gusset!.frame}, not ${frame}`);
        return () => gussetBead(byMember, gp, frame, String(on.gusset), leg, at, fail);
      }
      const k = integer(on.member, 'on.member', 0, Math.max(...byMember.keys())), part = byMember.get(k);
      if (on.end !== 'start' && on.end !== 'end') fail('INPUT', 'on.end must be start or end');
      if (!part) return fail('REFERENCE', `${frame} has no member ${k}`);
      return () => endBead(byMember, part, frame, k, on.end === 'end' ? 1 : 0, leg, f.inner === true, at, fail);
    }
  }
  throw new Error(`frameOperation: ${f.kind} is not one of its features`);
}
// Frame helpers moved from part-model.ts (3b, D361).
/** A member shorter than this is refused (FR1, D123). */
const MEMBER_MIN_MM = 1e-6;
/** A member's section ready to extrude: its loops and roles, and (a kind's) its closed-form area, centroid and box. */
type MemberShape = { readonly kind: string; readonly label: string; readonly outer: readonly ProfileSegmentInput[]; readonly holes: readonly (readonly ProfileSegmentInput[])[]; readonly tags?: SideTags;
  readonly outerNames?: readonly string[]; readonly holeNames?: readonly (readonly string[])[]; readonly areaMM2?: number; readonly centroid?: XY; readonly box?: { readonly min: XY; readonly max: XY }; readonly derived?: Readonly<Record<string, string>> };
/** A frame's members at most (FR2, D124). */
const FRAME_MAX_MEMBERS = 256;
/** How a member's section sits on its line: its anchor, the offset it moves by, its roll, mirrored or not. */
type MemberLook = { readonly anchor: FrameAnchor; readonly offset: XY; readonly roll: number; readonly mirror: boolean };
/** A member's (or an override's: `base` for what it leaves out) anchor, offset, roll and mirror, checked. */
function memberLook(r: Record<string, unknown>, at: string, dim: Tools['dim'], fail: Tools['fail'], base?: MemberLook): MemberLook {
  const anchor = (r.anchor === undefined ? base?.anchor ?? 'centroid' : r.anchor) as FrameAnchor;
  if (!(FRAME_ANCHORS as readonly unknown[]).includes(anchor)) fail('INPUT', `${at}anchor must be one of ${FRAME_ANCHORS.join(', ')}`);
  const roll = r.roll === undefined ? base?.roll ?? 0 : r.roll;
  if (typeof roll !== 'number' || !Number.isFinite(roll)) fail('INPUT', `${at}roll must be a number of degrees`);
  let offset: XY = base?.offset ?? [0, 0];
  if (r.offset !== undefined) {
    if (!Array.isArray(r.offset) || r.offset.length !== 2) fail('INPUT', `${at}offset must be [x, y] in the section's plane`);
    offset = [dim((r.offset as readonly CadPartDim[])[0], `${at}offset x`), dim((r.offset as readonly CadPartDim[])[1], `${at}offset y`)];
  }
  const mirror = r.mirror === undefined ? base?.mirror ?? false : r.mirror;
  if (typeof mirror !== 'boolean') fail('INPUT', `${at}mirror must be true or false`);
  return { anchor, offset, roll: roll as number, mirror: mirror as boolean };
}
/** The up reference (default +Z), not zero. */
function memberUp(v: unknown, xyz: Tools['xyz'], fail: Tools['fail']): Point {
  const up = v === undefined ? [0, 0, 1] as Point : xyz(v as CadPartPoint3, 'up');
  if (!(len(up) > 1e-12)) fail('INPUT', 'up must not be zero');
  return up;
}
/** A member's section ready to extrude (its names not yet under the member's id): a kind's, or a closed sketch's. */
function memberShape(sec: unknown, what: string, t: Pick<Tools, 'ref' | 'dim' | 'integer' | 'fail'>): MemberShape {
  if (!isRecord(sec)) t.fail('INPUT', `${what} must be { kind, … }: rect-tube, round-tube, angle, channel, i-beam, tslot or sketch`);
  const section = sec as Record<string, unknown>;
  if (section.kind === 'sketch') {
    const sketch = t.ref(section.sketch, `${what}.sketch`).result;
    if (sketch.kind !== 'sketch') t.fail('REFERENCE', `${what}.sketch: ${String(section.sketch)} is not a sketch`);
    const { outer, regions, holes, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
    if (regions?.length) t.fail('CAPABILITY', 'a member\'s sketch section takes one outer loop (holes allowed) yet');
    return { kind: 'sketch', label: `sketch ${String(section.sketch)}`, outer, holes: holes ?? [], ...(tags ? { tags } : {}) };
  }
  if (section.kind === 'table') {
    const problem = sectionTableProblem(section.table);
    if (problem) t.fail('PARAMETER', `[SECTION_TABLE] ${problem}`);
    const r = lookupSection(section.table as SectionTable, section.size as string);
    if ('miss' in r) return t.fail('PARAMETER', `[SECTION_TABLE_MISS] ${what}: ${r.miss}`);
    const b = frameSection(r.spec), tag = `${(section.table as SectionTable).id} ${String(section.size)}${r.estimate ? ', an estimate' : r.source ? ` (${r.source})` : ''}`;
    return { kind: r.spec.kind, label: `${tag}: ${b.label}`, outer: b.outer, holes: b.holes, outerNames: b.outerNames, holeNames: b.holeNames, areaMM2: b.area, centroid: b.centroid, box: b.box, ...(b.derived ? { derived: b.derived } : {}) };
  }
  try {
    const b = frameSection(sectionSpec(section, t.dim, t.integer, t.fail));
    return { kind: section.kind as string, label: b.label, outer: b.outer, holes: b.holes, outerNames: b.outerNames, holeNames: b.holeNames, areaMM2: b.area, centroid: b.centroid, box: b.box, ...(b.derived ? { derived: b.derived } : {}) };
  } catch (cause) { if (isFrameSectionError(cause)) return t.fail('PARAMETER', cause.message); throw cause; }
}
/** A section mirrored across its own y axis (x ↦ −x): its loops turned about, arcs the other way, its centroid and box with it. */
function mirroredShape(s: MemberShape): MemberShape {
  return { ...s, outer: s.outer.map(mirrorSegment), holes: s.holes.map(h => h.map(mirrorSegment)), ...(s.centroid ? { centroid: [-s.centroid[0], s.centroid[1]] as XY } : {}),
    ...(s.box ? { box: { min: [-s.box.max[0], s.box.min[1]] as XY, max: [-s.box.min[0], s.box.max[1]] as XY } } : {}), label: `${s.label}, mirrored` };
}
function mirrorSegment(g: ProfileSegmentInput): ProfileSegmentInput {
  return g.kind === 'line' ? { kind: 'line', start: [-g.start[0], g.start[1]] } : { kind: 'arc', start: [-g.start[0], g.start[1]], center: [-g.center[0], g.center[1]], direction: g.direction === 'ccw' ? 'cw' : 'ccw' };
}
const samePoint = (x: Point, y: Point): boolean => len(sub(x, y)) <= MEMBER_MIN_MM;
/**
 * Why a skeleton's segments cannot each be a member, or null: two on the same two points (`MEMBER_DUPLICATE`), or two
 * on one line sharing a length (`SKELETON_OVERLAP`) — a member would run through another.
 */
function skeletonClash(points: readonly Point[], pairs: readonly (readonly [number, number])[]): string | null {
  for (let a = 0; a < pairs.length; a++) for (let b = a + 1; b < pairs.length; b++) {
    const p = points[pairs[a][0]], q = points[pairs[a][1]], r = points[pairs[b][0]], t = points[pairs[b][1]];
    if ((samePoint(p, r) && samePoint(q, t)) || (samePoint(p, t) && samePoint(q, r))) return `[MEMBER_DUPLICATE] segments ${a} and ${b} join the same two points`;
    const L = len(sub(q, p)), u = scale(sub(q, p), 1 / L);
    if (len(cross(sub(r, p), u)) > MEMBER_MIN_MM || len(cross(sub(t, p), u)) > MEMBER_MIN_MM) continue;
    const t0 = dot(sub(r, p), u), t1 = dot(sub(t, p), u), lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(L, Math.max(t0, t1));
    if (hi - lo > MEMBER_MIN_MM) return `[SKELETON_OVERLAP] segments ${a} and ${b} lie on one line and share ${+(hi - lo).toFixed(6)} mm of it`;
  }
  return null;
}
/** A section kind's dimensions resolved (parameters allowed); the kind's own checks follow in `frameSection`. */
function sectionSpec(s: Record<string, unknown>, dim: Tools['dim'], integer: Tools['integer'], fail: Tools['fail']): FrameSectionSpec {
  const n = (key: string) => dim(s[key] as CadPartDim, `section.${key}`);
  switch (s.kind) {
    case 'rect-tube': return { kind: 'rect-tube', width: n('width'), height: n('height'), wall: n('wall'), outerRadius: n('outerRadius'), ...(s.innerRadius !== undefined ? { innerRadius: n('innerRadius') } : {}) };
    case 'round-tube': return { kind: 'round-tube', diameter: n('diameter'), wall: n('wall') };
    case 'angle': return { kind: 'angle', legX: n('legX'), legY: n('legY'), thickness: n('thickness'), rootRadius: n('rootRadius'), toeRadius: n('toeRadius') };
    case 'channel': return { kind: 'channel', height: n('height'), width: n('width'), web: n('web'), flange: n('flange'), rootRadius: n('rootRadius'), toeRadius: s.toeRadius === undefined ? 0 : n('toeRadius'), flangeSlope: s.flangeSlope === undefined ? 0 : n('flangeSlope') };
    case 'i-beam': return { kind: 'i-beam', height: n('height'), width: n('width'), web: n('web'), flange: n('flange'), rootRadius: n('rootRadius'), toeRadius: n('toeRadius'), flangeSlope: n('flangeSlope') };
    case 'tslot': {
      const cells = integer(s.cells, 'section.cells', 1, 2) as 1 | 2;
      if (cells === 1 && s.openSlots === undefined) fail('INPUT', 'section.openSlots (0 to 4, clockwise from the top) must be given for one cell');
      return { kind: 'tslot', size: n('size'), cells, openSlots: cells === 1 ? integer(s.openSlots, 'section.openSlots', 0, 4) : 6, opening: n('opening'), lip: n('lip'), undercut: n('undercut'), depth: n('depth'), bore: n('bore') };
    }
  }
  return fail('INPUT', `section.kind must be rect-tube, round-tube, angle, channel, i-beam, tslot or sketch (not ${String(s.kind)})`);
}
/** Components within rounding of 0 or ±1 are exactly that (an axis-aligned member stays exact). */
const snapUnit = (v: Point): Point => v.map(c => Math.abs(c) < 1e-12 ? 0 : Math.abs(Math.abs(c) - 1) < 1e-12 ? Math.sign(c) : c) as unknown as Point;
const ROLL_COS = [1, 0, -1, 0], ROLL_SIN = [0, 1, 0, -1];
/**
 * A member's section frame: y along `up` made square to the line u (a line along it takes +X, or +Y if along that too),
 * x = y × u, then both turned `roll` degrees about u (quarter turns exact).
 */
function memberFrame(u: Point, up: Point, rollDegrees: number): { x: Point; y: Point; fallback?: Point } {
  let r = unit(up), fallback: Point | undefined;
  if (len(cross(u, r)) < 1e-9) { fallback = len(cross(u, [1, 0, 0])) < 1e-9 ? [0, 1, 0] : [1, 0, 0]; r = fallback; }
  const y0 = unit(sub(r, scale(u, dot(r, u)))), x0 = cross(y0, u), q = rollDegrees / 90, k = Math.round(q);
  const quarter = Math.abs(q - k) < 1e-12, i = ((k % 4) + 4) % 4, c = quarter ? ROLL_COS[i] : Math.cos(rollDegrees * Math.PI / 180), s = quarter ? ROLL_SIN[i] : Math.sin(rollDegrees * Math.PI / 180);
  const x = snapUnit(add(scale(x0, c), scale(y0, s)));
  return { x, y: snapUnit(cross(u, x)), ...(fallback ? { fallback } : {}) };
}
/** The point (sx, sy) of a section in its frame, from `base`. */
const sectionPoint = (F: { x: Point; y: Point }, sx: number, sy: number, base: Point): Point => add(base, add(scale(F.x, sx), scale(F.y, sy)));
/** A member built: its section extruded L in its own XY (ends `.start`, `.end`), moved onto its line, its report on it. */
type JointKind = 'mitre' | 'butt' | 'cope' | 'order' | 'none';
type CornerAt = { readonly kind: JointKind; readonly through?: number; readonly trim?: 'face' | 'envelope'; readonly order?: readonly number[]; readonly gap?: number; readonly notch?: FrameNotchReport };
type CornerSpec = { readonly fallback: 'mitre' | 'butt' | 'none'; readonly multi: 'order' | 'none'; readonly tee: 'butt' | 'cope' | 'none'; readonly gap: number; readonly at: ReadonlyMap<number, CornerAt> };
/** A frame's `corners` checked (their points as the first point at the same place), or null when it has none. */
function frameCorners(v: unknown, points: readonly Point[], pairs: readonly (readonly [number, number])[], integer: Tools['integer'], fail: Tools['fail'], dim: Tools['dim']): CornerSpec | null {
  if (v === undefined) return null;
  if (!isRecord(v)) fail('INPUT', 'corners must be { default?, multi?, tee?, at? }');
  const c = v as Record<string, unknown>;
  const pick = <T extends string>(key: string, kinds: readonly T[], dflt: T): T => { if (c[key] !== undefined && !kinds.includes(c[key] as T)) fail('INPUT', `corners.${key} must be ${kinds.slice(0, -1).join(', ')} or ${kinds[kinds.length - 1]}`); return (c[key] as T | undefined) ?? dflt; };
  const fallback = pick('default', ['mitre', 'butt', 'none'] as const, 'mitre'), multi = pick('multi', ['order', 'none'] as const, 'none'), tee = pick('tee', ['butt', 'cope', 'none'] as const, 'none');
  const extra = Object.keys(c).find(k => !['default', 'multi', 'tee', 'at', 'gap'].includes(k));
  if (extra) fail('INPUT', `corners has no ${extra}`);
  const taggedDimension = (v: unknown, name: string, tag: 'GAP_SIZE' | 'NOTCH_CUTTER'): number => {
    try { return dim(v as CadPartDim, name); }
    catch (cause) { if (cause instanceof CadPartError) fail(cause.details.category, `[${tag}] ${cause.message}`); throw cause; }
  };
  const gapOf = (v: unknown, name: string): number => { const g = taggedDimension(v, name, 'GAP_SIZE'); if (!(g >= 0)) fail('PARAMETER', '[GAP_SIZE] gap must be finite and nonnegative'); return g; };
  const gap = c.gap === undefined ? 0 : gapOf(c.gap, 'corners.gap');
  const at = new Map<number, CornerAt>();
  if (c.at !== undefined) {
    if (!Array.isArray(c.at) || c.at.length > CadPartLimits.points) fail('INPUT', 'corners.at must list { point, kind, through?, trim?, order? }');
    (c.at as unknown[]).forEach((e, n) => {
      if (!isRecord(e)) fail('INPUT', `corners.at[${n}] must be { point, kind, through?, trim?, order? }`);
      const r = e as Record<string, unknown>, p = canonicalPoint(points, integer(r.point, `corners.at[${n}].point`, 0, points.length - 1));
      if (r.gap !== undefined || r.notch !== undefined) {
        const unknown = Object.keys(r).find(k => !['point', 'kind', 'through', 'trim', 'order', 'gap', 'notch'].includes(k));
        if (unknown) fail('PARAMETER', `[${r.notch !== undefined ? 'NOTCH_CUTTER' : 'GAP_SIZE'}] corners.at[${n}] has no ${unknown}`);
      }
      if (!['mitre', 'butt', 'cope', 'order', 'none'].includes(r.kind as string)) fail('INPUT', `corners.at[${n}].kind must be mitre, butt, cope, order or none`);
      if (at.has(p)) fail('INPUT', `corners.at[${n}]: point ${r.point} is set twice`);
      const through = r.through === undefined ? undefined : integer(r.through, `corners.at[${n}].through`, 0, pairs.length - 1);
      if (through !== undefined && r.kind !== 'butt' && r.kind !== 'cope') fail('INPUT', `corners.at[${n}]: through belongs to a butt or a cope`);
      if (r.trim !== undefined && (r.kind !== 'butt' || (r.trim !== 'face' && r.trim !== 'envelope'))) fail('INPUT', `corners.at[${n}]: trim (face or envelope) belongs to a butt`);
      let order: number[] | undefined;
      if (r.order !== undefined) {
        if (r.kind !== 'order' || !Array.isArray(r.order)) fail('INPUT', `corners.at[${n}]: order (a list of members) belongs to an ordered trim`);
        order = (r.order as unknown[]).map((m, i) => integer(m, `corners.at[${n}].order[${i}]`, 0, pairs.length - 1));
      }
      const localGap = r.gap === undefined ? undefined : gapOf(r.gap, `corners.at[${n}].gap`);
      let notch: FrameNotchReport | undefined;
      if (r.notch !== undefined) {
        if (r.kind !== 'cope' || !isRecord(r.notch)) fail('PARAMETER', '[NOTCH_CUTTER] a notch belongs to a cope and must name a cutter');
        const v = r.notch as Record<string, unknown>, value = (key: string) => taggedDimension(v[key], `corners.at[${n}].notch.${key}`, 'NOTCH_CUTTER');
        if (v.kind === 'holesaw') {
          if (Object.keys(v).some(k => !['kind', 'diameter', 'offset'].includes(k))) fail('PARAMETER', '[NOTCH_CUTTER] holesaw takes diameter and optional signed offset');
          const diameter = value('diameter'), offset = v.offset === undefined ? 0 : value('offset');
          if (!(diameter > MEMBER_MIN_MM)) fail('PARAMETER', '[NOTCH_CUTTER] holesaw diameter must be positive');
          notch = { kind: 'holesaw', diameter: diameter, offset: offset };
        } else if (v.kind === 'v') {
          if (Object.keys(v).some(k => !['kind', 'depth', 'angle'].includes(k))) fail('PARAMETER', '[NOTCH_CUTTER] v takes depth and included angle');
          const depth = value('depth'), angle = value('angle');
          if (!(depth > MEMBER_MIN_MM && angle > 0 && angle < 180)) fail('PARAMETER', '[NOTCH_CUTTER] v requires positive depth and included angle in (0,180) degrees');
          notch = { kind: 'v', depth: depth, angle: angle };
        } else fail('PARAMETER', '[NOTCH_CUTTER] cutter kind must be holesaw or v');
        if ((localGap ?? gap) > 0) fail('PARAMETER', '[NOTCH_CUTTER] positive gap with a notch cutter is not supported');
      }
      at.set(p, { ...(localGap !== undefined ? { gap: localGap } : {}), ...(notch ? { notch } : {}), kind: r.kind as JointKind, ...(through !== undefined ? { through } : {}), ...(r.trim !== undefined ? { trim: r.trim as 'face' | 'envelope' } : {}), ...(order ? { order } : {}) });
    });
  }
  return { fallback, multi, tee, gap, at };
}
/** The first point at the same place as point i (within 1e-6 mm): a joint is a place, not an index. */
function canonicalPoint(points: readonly Point[], i: number): number {
  for (let k = 0; k < i; k++) if (samePoint(points[k], points[i])) return k;
  return i;
}
/** The vertices of a section's loops (starts and arc centres) in the part, as placed at a point of its line. */
function sectionVertices(P: MemberPlace, at: Point): Point[] {
  const out: Point[] = [];
  for (const loop of [P.shape.outer, ...P.shape.holes]) for (const g of loop) {
    out.push(sectionPoint(P.F, g.start[0] - P.q[0], g.start[1] - P.q[1], at));
    if (g.kind === 'arc') out.push(sectionPoint(P.F, g.center[0] - P.q[0], g.center[1] - P.q[1], at));
  }
  return out;
}
/** The corners of a section's box in the part, as placed at a point of its line. */
const boxCorners = (P: MemberPlace, at: Point): Point[] => [[P.box.min[0], P.box.min[1]], [P.box.max[0], P.box.min[1]], [P.box.max[0], P.box.max[1]], [P.box.min[0], P.box.max[1]]].map(c => sectionPoint(P.F, c[0] - P.q[0], c[1] - P.q[1], at));
/** Whether two point sets are the same (each of one within tol of one of the other, the counts equal). */
function samePoints(a: readonly Point[], b: readonly Point[], tol: number): boolean {
  if (a.length !== b.length) return false;
  for (const p of a) { let hit = false; for (const r of b) if (len(sub(p, r)) <= tol) { hit = true; break; } if (!hit) return false; }
  return true;
}
const reflect = (v: Point, m: Point): Point => sub(v, scale(m, 2 * dot(v, m)));
/** A member's end trimmed to a plane (kept on its own side) or to an earlier body (FR3b, D126). */
type FrameTrim = { readonly member: number; readonly end: 0 | 1; readonly plane?: { readonly o: Point; readonly n: Point }; readonly body?: readonly Solid[] };
/** A frame's `trims`: each `{ member, end, plane: { origin, normal } }` or `{ member, end, body }` (an earlier feature, not consumed). */
function frameTrims(v: unknown, members: number, t: Pick<Tools, 'ref' | 'xyz' | 'integer' | 'fail'>): FrameTrim[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > 2 * members) t.fail('INPUT', 'trims must list { member, end, plane | body } (two at most a member)');
  const seen = new Set<string>();
  return (v as unknown[]).map((e, n) => {
    if (!isRecord(e)) t.fail('INPUT', `trims[${n}] must be { member, end, plane | body }`);
    const r = e as Record<string, unknown>, member = t.integer(r.member, `trims[${n}].member`, 0, members - 1);
    if (r.end !== 'start' && r.end !== 'end') t.fail('INPUT', `trims[${n}].end must be start or end`);
    const end = r.end === 'end' ? 1 : 0, key = `${member}:${end}`;
    if (seen.has(key)) t.fail('INPUT', `trims[${n}]: member ${member}'s ${r.end} is trimmed twice`);
    seen.add(key);
    if ((r.plane === undefined) === (r.body === undefined)) t.fail('INPUT', `trims[${n}] takes a plane or a body (one of them)`);
    if (r.plane !== undefined) {
      if (!isRecord(r.plane)) t.fail('INPUT', `trims[${n}].plane must be { origin, normal }`);
      const pl = r.plane as Record<string, unknown>, n3 = t.xyz(pl.normal as CadPartPoint3, `trims[${n}].plane.normal`);
      if (!(len(n3) > 1e-12)) t.fail('INPUT', `trims[${n}].plane.normal must not be zero`);
      return { member, end, plane: { o: t.xyz(pl.origin as CadPartPoint3, `trims[${n}].plane.origin`), n: unit(n3) } } as FrameTrim;
    }
    const { part, result } = t.ref(r.body, `trims[${n}].body`);
    if (result.kind !== 'solid') t.fail('REFERENCE', `trims[${n}].body: ${String(r.body)} is a sketch, not a body`);
    const parts = (result as Extract<Result, { kind: 'solid' }>).parts;
    return { member, end, body: (part === null ? parts : [parts[part]]).map(q => q.solid) } as FrameTrim;
  });
}
const emptyPlan = (n: number): EndsPlan => ({ extend: Array.from({ length: n }, () => [0, 0] as [number, number]), cuts: Array.from({ length: n }, () => []), subtract: Array.from({ length: n }, () => []), report: Array.from({ length: n }, () => []) });
/**
 * Trims to a plane or a body (FR3b, D126), on ends no joint finishes. A plane: the member run on to meet it (the line's
 * crossing, its section's reach past it), cut keeping its other end's side; `TRIM_PARALLEL` along it, `TRIM_EMPTY` where the
 * plane lies past the member's other end. A body: taken from the member, the piece holding its other end kept; nothing
 * taken is `TRIM_MISSES`.
 */
function planTrims(plan: EndsPlan, trims: readonly FrameTrim[], points: readonly Point[], pairs: readonly (readonly [number, number])[], lengths: readonly number[], places: readonly MemberPlace[], fail: Tools['fail']): void {
  for (const tr of trims) {
    const k = tr.member, P = places[k], a = points[pairs[k][0]], b = points[pairs[k][1]], here = tr.end ? b : a, away = tr.end ? scale(P.u, -1) : P.u;
    if (plan.report[k].some(e => e.end === endName(tr.end) && e.kind !== 'square')) fail('INPUT', `trims: member ${k}'s ${endName(tr.end)} is finished by its joint already`);
    if (tr.plane) {
      const nu = dot(tr.plane.n, P.u);
      if (Math.abs(nu) < 1e-9) fail('PARAMETER', `[TRIM_PARALLEL] member ${k} runs along the plane it is trimmed to`);
      // The line's crossing, as a distance from this end towards the other (positive: inside the member).
      const s = dot(tr.plane.n, sub(tr.plane.o, a)) / nu, inside = tr.end ? lengths[k] - s : s;
      if (inside >= lengths[k] - MEMBER_MIN_MM) fail('PARAMETER', `[TRIM_EMPTY] member ${k}: the plane lies at or past its other end`);
      const cos = Math.abs(nu), reach = reachOf(P, here);
      plan.extend[k][tr.end] = Math.max(0, -inside) + reach * Math.sqrt(1 - cos * cos) / cos + reach + 1;
      // Kept: the other end's side (n·x < n·o there).
      const n = dot(tr.plane.n, sub(tr.end ? a : b, tr.plane.o)) < 0 ? tr.plane.n : scale(tr.plane.n, -1);
      plan.cuts[k].push({ o: tr.plane.o, n, name: `${endName(tr.end)}.trim` });
      plan.report[k] = plan.report[k].filter(e => e.end !== endName(tr.end));
      plan.report[k].push({ end: endName(tr.end), point: pairs[k][tr.end], kind: 'trim', angle: Math.acos(Math.min(1, cos)) * 180 / Math.PI, plane: { origin: tr.plane.o, normal: n } });
      continue;
    }
    for (const body of tr.body!) plan.subtract[k].push({ solid: body, name: `${endName(tr.end)}.trim`, keepFrom: here, toward: away, mustTouch: true });
    plan.report[k] = plan.report[k].filter(e => e.end !== endName(tr.end));
    plan.report[k].push({ end: endName(tr.end), point: pairs[k][tr.end], kind: 'trim' });
  }
}
/** One member end meeting at a place: the member and which end. */
type JointEnd = { readonly member: number; readonly end: 0 | 1 };
/** Where one member's line passes through a place inside its length (a T-joint's through member). */
type JointPass = { readonly member: number; readonly s: number };
/** Per member, as planned: how far each end runs on, its plane cuts, the solids taken from it, what each end is. */
type EndsPlan = { extend: [number, number][]; cuts: { o: Point; n: Point; name: string }[][]; subtract: MemberSubtract[][]; report: FrameEndReport[][] };
const endName = (e: 0 | 1) => e ? 'end' : 'start';
/** A member's envelope (its outer loop filled, no bore) along its line from `from` to `to` mm past its start: what other members are trimmed to. */
function envelopeOf(P: MemberPlace, start: Point, from: number, to: number, name: string): Solid {
  const solid = prismaticFromProfile({ outer: P.shape.outer, height: to - from, from: from, tag: name, names: { outer: P.shape.outer.map(() => name), bottom: name, top: name } });
  const m: BrepAffine['matrix'] = [P.F.x[0], P.F.y[0], P.u[0], P.F.x[1], P.F.y[1], P.u[1], P.F.x[2], P.F.y[2], P.u[2]];
  return (moveAll([{ solid: { kind: 'upright', solid } }], m, sectionPoint(P.F, -P.q[0], -P.q[1], start)) as Extract<Result, { kind: 'solid' }>).parts[0].solid;
}
/** The half-diagonal of a member's section box from its line: how far its section reaches from its line. */
const reachOf = (P: MemberPlace, at: Point): number => Math.max(...boxCorners(P, at).map(v => len(sub(v, at))));
/**
 * Where a box side of T's section has material: the spans, along T's other section axis, of its outer loop's straight
 * segments lying on that side (merged). A butt on the face may only land within them (FR3b, D126: no silent gap).
 */
function sideContact(P: MemberPlace, axis: 0 | 1, at: number): [number, number][] {
  const loop = P.shape.outer, spans: [number, number][] = [], other = 1 - axis, tol = 1e-9 * Math.max(1, P.box.max[0] - P.box.min[0], P.box.max[1] - P.box.min[1]);
  for (let i = 0; i < loop.length; i++) {
    const g = loop[i], e = loop[(i + 1) % loop.length].start;
    if (g.kind === 'line' && Math.abs(g.start[axis] - at) <= tol && Math.abs(e[axis] - at) <= tol) spans.push([Math.min(g.start[other], e[other]), Math.max(g.start[other], e[other])]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const sp of spans) { const last = merged[merged.length - 1]; if (last && sp[0] <= last[1] + tol) last[1] = Math.max(last[1], sp[1]); else merged.push([sp[0], sp[1]]); }
  return merged;
}
/**
 * A butt of O on T's box face facing it, at `at` (O's end there): the face plane, the cut, how far O runs on into T, O's
 * angle from square; refused where the side is no face of T's box (`BUTT_NOT_ON_A_FACE`) or where O's end would reach past
 * the material on that side (`BUTT_ON_OPEN_SIDE`: an angle's or a channel's open side, a round tube, a round corner).
 */
function faceButt(PT: MemberPlace, PO: MemberPlace, inT: Point | null, inO: Point, at: Point, where: string, fail: Tools['fail']): { face: Point; w: Point; side: number; runO: number; deg: number } {
  // The side of T that O comes from, square to T's line, in T's section axes.
  const tAxis = inT ?? PT.u, w0 = sub(scale(inO, -1), scale(tAxis, dot(scale(inO, -1), tAxis))), wl = len(w0), w = scale(w0, 1 / wl), wx = dot(w, PT.F.x), wy = dot(w, PT.F.y);
  const found: 0 | 1 | -1 = Math.abs(Math.abs(wx) - 1) < 1e-9 ? 0 : Math.abs(Math.abs(wy) - 1) < 1e-9 ? 1 : -1;
  if (found < 0) return fail('PARAMETER', `[BUTT_NOT_ON_A_FACE] ${where} at an edge of its section, not a face (turn one, or mitre)`);
  const axis = found as 0 | 1;
  const sign = (axis === 0 ? wx : wy) > 0 ? 1 : -1, boxAt = sign > 0 ? PT.box.max[axis] : PT.box.min[axis], side = sign * (boxAt - PT.q[axis]);
  // O's end spans, along T's other section axis (in T's section coordinates), what must all land on T's material there.
  const otherDir = axis === 0 ? PT.F.y : PT.F.x, other = 1 - axis, ext = boxCorners(PO, at).map(v => dot(sub(v, at), otherDir) + PT.q[other]);
  const lo = Math.min(...ext), hi = Math.max(...ext), contact = sideContact(PT, axis, boxAt), tol = 1e-9 * Math.max(1, hi - lo);
  if (!contact.some(([a, b]) => a <= lo + tol && b >= hi - tol)) {
    const names = ['x', 'y'], spans = contact.length ? contact.map(([a, b]) => `${+a.toFixed(3)} to ${+b.toFixed(3)}`).join(', ') : 'none';
    fail('PARAMETER', `[BUTT_ON_OPEN_SIDE] ${where}: its end spans ${+lo.toFixed(3)} to ${+hi.toFixed(3)} mm along the through member's section ${names[other]}, but the side ${sign > 0 ? '+' : '−'}${names[axis]} of that section has material only at ${spans}: a gap would be left (trim it to the envelope, or cope it)`);
  }
  const sO = Math.max(...boxCorners(PO, at).map(v => dot(sub(v, at), w)));
  return { face: add(at, scale(w, side)), w, side, runO: Math.max(0, (sO - side) / wl) + reachOf(PO, at) + 1, deg: Math.acos(Math.min(1, Math.abs(dot(inO, w)))) * 180 / Math.PI };
}
/** The part of T's line around a place: its envelope from E before to `on` past, along its own direction from its start (a pass: around s). */
function envelopeAround(PT: MemberPlace, start: Point, L: number, at: { end?: 0 | 1; s?: number }, on: number, E: number, name: string): Solid {
  if (at.s !== undefined) return envelopeOf(PT, start, Math.max(0, at.s - E), Math.min(L, at.s + E), name);
  return at.end ? envelopeOf(PT, start, Math.max(0, L - E), L + on, name) : envelopeOf(PT, start, -on, Math.min(L, E), name);
}
/** Whether v is a signed unit axis, ±x, ±y or ±z, exactly. */
function signedUnitAxis(v: Point): boolean {
  let ones = 0;
  for (let k = 0; k < 3; k++) { if (v[k] === 0) continue; if (Math.abs(v[k]) !== 1) return false; ones++; }
  return ones === 1;
}
/**
 * The capped ordered joint (FRk6, D178): three identical, centred, rounded or square tubes on snapped axes, at right
 * angles, meeting at one point.
 * - Let A be the first member's envelope (through the joint, at least h each way) and B the second's.
 * - Then A ∪ B capped at the joint equals A ∪ the kept piece of (B extended − A). On the band |x| < h − r, B lies in
 *   A. Beyond it, B's points outside A's rounded corners run on along B's axis into B's own side, the piece kept.
 * - So the third member, which subtracts both, is trimmed the same with B capped, and B needs no Boolean of its own.
 * Every other placement, profile and short window keeps the general route, compared exactly.
 */
function canCapOrderedEnvelope(ordered: readonly JointEnd[], points: readonly Point[], pairs: readonly (readonly [number, number])[], lengths: readonly number[], places: readonly MemberPlace[], joint: Point, run0: number, E: number): boolean {
  if (ordered.length !== 3) return false;
  const a = places[ordered[0].member], b = places[ordered[1].member], c = places[ordered[2].member], h = (a.box.max[0] - a.box.min[0]) / 2;
  const outer = JSON.stringify(a.shape.outer);
  for (const e of ordered) {
    const P = places[e.member], end = points[pairs[e.member][e.end]];
    if (P.shape.kind !== 'rect-tube' || JSON.stringify(P.shape.outer) !== outer
      || P.box.max[0] - P.box.min[0] !== 2 * h || P.box.max[1] - P.box.min[1] !== 2 * h
      || P.q[0] !== (P.box.min[0] + P.box.max[0]) / 2 || P.q[1] !== (P.box.min[1] + P.box.max[1]) / 2
      || !signedUnitAxis(P.u) || !signedUnitAxis(P.F.x) || !signedUnitAxis(P.F.y)
      || end[0] !== joint[0] || end[1] !== joint[1] || end[2] !== joint[2]) return false;
  }
  return dot(a.u, b.u) === 0 && dot(a.u, c.u) === 0 && dot(b.u, c.u) === 0
    && Math.min(lengths[ordered[0].member], E) >= h && Math.min(lengths[ordered[1].member], E) > h && run0 >= h;
}
/**
 * Each member's ends at the frame's joints (FR3a D125, FR3b D126). A joint is a place (points within 1e-6 mm): the member
 * ends there, and the members whose line passes through it inside its length.
 * - Two ends, no pass: a corner — `mitre` (both on the plane square to u1 + u2; `MITRE_SECTIONS_DIFFER` unless the second
 *   section is the first reflected in it), `butt` (`through` runs on to cover; the other ends on its box face, `trim:
 *   'face'`, or on its envelope, `'envelope'`), `cope` (a butt to the envelope), `none`. `CORNER_ANGLE` in line or folded.
 * - Three or more ends, no pass: an ordered trim (`order`, by default the larger sections first, then the lower index):
 *   the first runs on to cover the rest, each next is trimmed to the envelopes of all before it.
 * - Ends on a pass: a T-joint — each ending member butted (face or envelope) or coped to the member passing through;
 *   two passes through one place cross (`MEMBERS_CLASH`).
 * A setting that does not fit its joint is `CORNER_NOT_A_JOINT`.
 */
function planCorners(spec: CornerSpec, points: readonly Point[], pairs: readonly (readonly [number, number])[], lengths: readonly number[], places: readonly MemberPlace[], at: string, fail: Tools['fail']): EndsPlan {
  const plan: EndsPlan = { extend: pairs.map(() => [0, 0]), cuts: pairs.map(() => []), subtract: pairs.map(() => []), report: pairs.map(() => []) };
  const ends = new Map<number, JointEnd[]>();
  pairs.forEach(([i, j], k) => ([[i, 0], [j, 1]] as const).forEach(([p, end]) => { const c = canonicalPoint(points, p); if (!ends.has(c)) ends.set(c, []); ends.get(c)!.push({ member: k, end }); }));
  // Members passing through each place inside their length; two crossing inside both: a clash.
  const passes = new Map<number, JointPass[]>();
  for (const p of ends.keys()) for (let k = 0; k < pairs.length; k++) {
    const a = points[pairs[k][0]], s = dot(sub(points[p], a), places[k].u);
    if (s > MEMBER_MIN_MM && s < lengths[k] - MEMBER_MIN_MM && (len(sub(points[p], add(a, scale(places[k].u, s)))) <= MEMBER_MIN_MM || ((spec.at.get(p)?.kind ?? spec.tee) === 'cope' && withinEnvelope(places[k], a, points[p])))) { if (!passes.has(p)) passes.set(p, []); passes.get(p)!.push({ member: k, s }); }
  }
  const clash = crossingMembers(points, pairs, lengths, places);
  if (clash) fail('PARAMETER', clash);
  for (const [p, list] of passes) if (list.length > 1) fail('PARAMETER', `[MEMBERS_CLASH] members ${list[0].member} and ${list[1].member} both run through point ${p}`);
  for (const p of spec.at.keys()) if (!ends.has(p)) fail('PARAMETER', `[CORNER_NOT_A_JOINT] point ${p}: no member ends there`);
  const Rmax = Math.max(...places.map((P, k) => reachOf(P, points[pairs[k][0]])));
  for (const [p, list] of ends) {
    const there = points[p], pass = passes.get(p)?.[0], set = spec.at.get(p), gap = set?.gap ?? spec.gap;
    if (gap > 0 && ((set?.kind === 'none' || set?.kind === 'order') || (!pass && list.length > 2) || (!pass && list.length === 1 && set?.gap !== undefined))) fail('PARAMETER', '[GAP_SIZE] gap requires a two-member mitre or face butt');
    if (set?.notch && !pass && list.length !== 2) fail('PARAMETER', '[NOTCH_CUTTER] a cutter requires a branch meeting one through member');
    if (pass) {
      // A T-joint: each member ending here meets the one passing through.
      const kind = set?.kind ?? spec.tee;
      if (kind !== 'butt' && kind !== 'cope' && kind !== 'none') fail('PARAMETER', `[CORNER_NOT_A_JOINT] point ${p}: a T-joint (member ${pass.member} runs through) takes butt, cope or none, not ${kind}`);
      if (kind === 'none') { if (gap > 0) fail('PARAMETER', '[GAP_SIZE] a positive gap cannot leave an actual joint unfinished'); squareEnds(plan, list, p); continue; }
      const PT = places[pass.member], T0 = points[pairs[pass.member][0]];
      for (const O of list) {
        const PO = places[O.member], inO = O.end ? PO.u : scale(PO.u, -1);
        if (len(cross(inO, PT.u)) < 1e-9) fail('PARAMETER', `[CORNER_ANGLE] point ${p}: member ${O.member} runs along member ${pass.member}`);
        teeOrButt(plan, kind === 'cope' || set?.trim === 'envelope', PT, PO, null, inO, there, O, pass.member, p, T0, lengths[pass.member], { s: pass.s }, 0, Rmax, at, fail, set?.notch, lengths[O.member]);
      }
      continue;
    }
    if (list.length === 1) { squareEnds(plan, list, p); continue; }
    if (list.length === 2) {
      const kind = set?.kind ?? spec.fallback;
      if (kind === 'order') fail('PARAMETER', `[CORNER_NOT_A_JOINT] point ${p}: two members meet there; an ordered trim joins three or more`);
      if (kind === 'none') { if (gap > 0) fail('PARAMETER', '[GAP_SIZE] a positive gap cannot leave an actual joint unfinished'); squareEnds(plan, list, p); continue; }
      const [A, B] = list, PA = places[A.member], PB = places[B.member], inA = A.end ? PA.u : scale(PA.u, -1), inB = B.end ? PB.u : scale(PB.u, -1), c = dot(inA, inB);
      if (c < -1 + 1e-12) fail('PARAMETER', `[CORNER_ANGLE] point ${p}: members ${A.member} and ${B.member} are in line, no corner to finish`);
      if (c > 1 - 1e-12) fail('PARAMETER', `[CORNER_ANGLE] point ${p}: members ${A.member} and ${B.member} fold back on each other`);
      if (kind === 'mitre') { mitre(plan, A, B, PA, PB, inA, inB, there, p, fail); continue; }
      const through = set?.through ?? (PA.area > PB.area + 1e-9 ? A.member : PB.area > PA.area + 1e-9 ? B.member : Math.min(A.member, B.member));
      if (through !== A.member && through !== B.member) fail('INPUT', `corners at point ${p}: through must be member ${A.member} or ${B.member}`);
      const [T, O] = through === A.member ? [A, B] : [B, A], PT = places[T.member], PO = places[O.member], inT = T === A ? inA : inB, inO = T === A ? inB : inA;
      // T runs on past the point to cover O's section there.
      const runT = Math.max(0, ...boxCorners(PO, there).map(v => dot(sub(v, there), inT)));
      plan.extend[T.member][T.end] = runT;
      plan.report[T.member].push({ end: endName(T.end), point: p, kind: 'through', with: O.member, extended: runT });
      teeOrButt(plan, kind === 'cope' || set?.trim === 'envelope', PT, PO, inT, inO, there, O, T.member, p, points[pairs[T.member][0]], lengths[T.member], { end: T.end }, runT, Rmax, at, fail, set?.notch, lengths[O.member]);
      continue;
    }
    // Three or more: an ordered trim, the first running through.
    const kind = set?.kind ?? spec.multi;
    if (kind === 'none') { squareEnds(plan, list, p); continue; }
    if (kind !== 'order') fail('PARAMETER', `[CORNER_NOT_A_JOINT] point ${p}: ${list.length} member ends meet there; a ${kind} joins two (an ordered trim joins three or more)`);
    const members = list.map(e => e.member), order = set?.order ?? [...members].sort((a, b) => (places[b].area - places[a].area) || a - b);
    if (order.length !== members.length || !members.every(m => order.includes(m))) fail('INPUT', `corners at point ${p}: order must list members ${members.join(', ')}, each once`);
    const byMember = new Map(list.map(e => [e.member, e])), first = byMember.get(order[0])!, P0 = places[first.member], in0 = first.end ? P0.u : scale(P0.u, -1);
    const run0 = Math.max(0, ...order.slice(1).flatMap(m => boxCorners(places[m], there).map(v => dot(sub(v, there), in0))));
    plan.extend[first.member][first.end] = run0;
    plan.report[first.member].push({ end: endName(first.end), point: p, kind: 'through', with: order[1], extended: run0 });
    // Each next member is trimmed to the envelopes of all before it, each as trimmed itself (its own envelope less the
    // earlier ones, the piece reaching its own way kept): exactly the space the earlier members take, no more.
    const E = 3 * Rmax + 1, taken: Solid[] = [envelopeAround(P0, points[pairs[first.member][0]], lengths[first.member], { end: first.end }, run0, E, `${at}_env${first.member}`)];
    const capAtJoint = canCapOrderedEnvelope(order.map(m => byMember.get(m)!), points, pairs, lengths, places, there, run0, E);
    order.slice(1).forEach((m, r) => {
      const e = byMember.get(m)!, inE = e.end ? places[m].u : scale(places[m].u, -1), away = scale(inE, -1);
      plan.extend[m][e.end] = 2 * Rmax + 1;
      for (const solid of taken) plan.subtract[m].push({ solid, name: `${endName(e.end)}.trim`, keepFrom: there, toward: away });
      plan.report[m].push({ end: endName(e.end), point: p, kind: 'trim', with: order[r], rank: r + 1, against: order.slice(0, r + 1) });
      if (r + 2 < order.length) {
        // (At the capped joint, D178: the envelope stops at the joint and takes no Boolean; see canCapOrderedEnvelope.)
        let env = envelopeAround(places[m], points[pairs[m][0]], lengths[m], { end: e.end }, capAtJoint ? 0 : plan.extend[m][e.end], E, `${at}_env${m}`);
        if (!capAtJoint) for (const solid of taken) env = keepFarthest(boolean(env, solid, 'difference', `${at}_env${m}`), there, away);
        taken.push(env);
      }
    });
  }
  applyJointGaps(plan, spec, points, pairs, lengths, places, fail);
  return plan;
}
/** Exact outer-envelope membership; an eccentric T follows the actual section rather than a chord or its box. */
function withinEnvelope(P: MemberPlace, start: Point, point: Point): boolean {
  const v = sub(point, start), xy: XY = [dot(v, P.F.x) + P.q[0], dot(v, P.F.y) + P.q[1]];
  const outer: CurveSegment2[] = buildProfileLoop(P.shape.outer, { maximumSegments: 1024 }).segments.map(s => s.kind === 'line'
    ? { kind: 'line', a: [...s.start], b: [...s.end] } : { kind: 'arc', c: [...s.center], r: s.radius, t0: s.startAngle, sweep: s.sweep });
  return locateInRegion(xy, { outer, holes: [] }, curveTolerance([outer])) !== 'out';
}
/** Move the actual cut planes, with matching report planes. gap is always the complete authored joint clearance. */
function applyJointGaps(plan: EndsPlan, spec: CornerSpec, points: readonly Point[], pairs: readonly (readonly [number, number])[], lengths: readonly number[], places: readonly MemberPlace[], fail: Tools['fail']): void {
  for (let k = 0; k < plan.report.length; k++) {
    plan.report[k] = plan.report[k].map(e => {
      const gap = spec.at.get(e.point)?.gap ?? spec.gap;
      if (!gap || e.kind === 'square' || e.kind === 'through') return e;
      if ((e.kind !== 'mitre' && e.kind !== 'butt') || !e.plane) fail('PARAMETER', '[GAP_SIZE] positive gap requires a planar mitre or face butt; cope/envelope gaps are not supported');
      const d = e.kind === 'mitre' ? gap / 2 : gap, n = e.plane!.normal as Point, origin = sub(e.plane!.origin as Point, scale(n, d));
      if (!(gap < lengths[k])) fail('PARAMETER', '[GAP_SIZE] gap must be smaller than the member length');
      const cut = plan.cuts[k].find(c => c.name === `${e.end}.${e.kind}`);
      if (!cut) fail('PARAMETER', '[GAP_SIZE] the joint has no movable planar cut');
      cut!.o = origin;
      return { ...e, gap: gap, plane: { origin, normal: n } };
    });
    // Both cuts together must retain a positive centroidal span; no clamping or fallback.
    if (plan.report[k].some(e => (e.gap ?? 0) > 0)) {
      const u = places[k].u, start = points[pairs[k][0]], bound: [number, number] = [0, lengths[k]];
      for (const e of plan.report[k]) {
        const end = e.end === 'start' ? 0 : 1;
        if (e.plane) {
          const n = e.plane.normal as Point, nu = dot(n, u);
          bound[end] = dot(n, sub(e.plane.origin as Point, start)) / nu;
        } else if (e.kind === 'through') bound[end] = end ? lengths[k] + (e.extended ?? 0) : -(e.extended ?? 0);
      }
      if (!(bound[1] - bound[0] > MEMBER_MIN_MM)) fail('PARAMETER', '[GAP_SIZE] the joint gaps consume the member');
    }
  }
}
/** Cutter plane fixed by the through member and branch: holesaw offset is signed along cross(through axis, inward). */
function planNotch(plan: EndsPlan, notch: FrameNotchReport, PT: MemberPlace, PO: MemberPlace, inward: Point, at: Point, O: JointEnd, T: number, p: number, T0: Point, Rmax: number, id: string, fail: Tools['fail'], length: number): void {
  const W = PT.u, X = unit(cross(W, inward)), away = scale(inward, -1), projection = add(T0, scale(W, dot(sub(at, T0), W)));
  let cutter: Solid;
  if (notch.kind === 'holesaw') {
    const r = notch.diameter / 2, offset = notch.offset;
    const transverse = boxCorners(PO, at).map(v => dot(sub(v, projection), X) - offset);
    if (!(r > Math.max(...transverse.map(Math.abs)) + MEMBER_MIN_MM)) fail('PARAMETER', '[NOTCH_CUTTER] holesaw does not cover the branch transverse section');
    if (!(r < length)) fail('PARAMETER', '[NOTCH_CUTTER] holesaw reaches past the branch length');
    const E = 4 * Rmax + 2 * r + Math.abs(offset) + 1, Y = cross(W, X), center = add(projection, scale(X, offset));
    const profile: ProfileSegmentInput[] = [{ kind: 'arc', start: [r, 0], center: [0, 0], direction: 'ccw' }];
    cutter = placedSolid({ kind: 'upright', solid: prismaticFromProfile({ outer: profile, height: 2 * E, from: -E, tag: `${id}_notch${O.member}` }) }, X, Y, W, center);
    plan.extend[O.member][O.end] = E;
  } else {
    if (Math.abs(dot(W, inward)) > 1e-9) fail('PARAMETER', '[NOTCH_CUTTER] v cutter requires perpendicular branch and through axes');
    const extent = boxCorners(PO, at).map(v => dot(sub(v, at), X)), width = Math.max(...extent) - Math.min(...extent);
    if (!(notch.depth < width && notch.depth < length)) fail('PARAMETER', '[NOTCH_CUTTER] v depth must be under the branch width and length');
    const E = 4 * Rmax + notch.depth + 1, reach = (notch.depth + E) * Math.tan(notch.angle * Math.PI / 360);
    const profile: ProfileSegmentInput[] = [[-reach, -E], [reach, -E], [0, notch.depth]].map(start => ({ kind: 'line', start: start as XY }));
    cutter = placedSolid({ kind: 'upright', solid: prismaticFromProfile({ outer: profile, height: 2 * E, from: -E, tag: `${id}_notch${O.member}` }) }, X, away, cross(X, away), at);
  }
  plan.subtract[O.member].push({ solid: cutter, name: `${endName(O.end)}.notch`, keepFrom: at, toward: away, edgeFitTolerance: 1e-11 });
  plan.report[O.member].push({ end: endName(O.end), point: p, kind: 'notch', with: T, notch });
}

/** Ends left square at a place. */
function squareEnds(plan: EndsPlan, list: readonly JointEnd[], p: number): void { for (const e of list) plan.report[e.member].push({ end: endName(e.end), point: p, kind: 'square' }); }
/** A mitre between A (into the point) and B (out of it). */
function mitre(plan: EndsPlan, A: JointEnd, B: JointEnd, PA: MemberPlace, PB: MemberPlace, inA: Point, inB: Point, at: Point, p: number, fail: Tools['fail']): void {
  const u2 = scale(inB, -1), m = unit(add(inA, u2)), cos = dot(inA, m), tan = Math.sqrt(1 - cos * cos) / cos;
  const vA = sectionVertices(PA, at).map(v => add(at, reflect(sub(v, at), m))), vB = sectionVertices(PB, at);
  const size = Math.max(1, ...vB.map(v => len(sub(v, at))));
  if (!samePoints(vA, vB, 1e-9 * size)) fail('PARAMETER', `[MITRE_SECTIONS_DIFFER] point ${p}: members ${A.member} and ${B.member} would not meet face to face on the mitre (different sections, or turned differently); give a butt`);
  const deg = Math.acos(Math.min(1, cos)) * 180 / Math.PI;
  for (const [E, n, P] of [[A, m, PA], [B, scale(m, -1), PB]] as const) {
    const reach = reachOf(P, at);
    plan.extend[E.member][E.end] = reach * tan + reach + 1;
    plan.cuts[E.member].push({ o: at, n, name: `${endName(E.end)}.mitre` });
    plan.report[E.member].push({ end: endName(E.end), point: p, kind: 'mitre', with: E === A ? B.member : A.member, angle: deg, plane: { origin: at, normal: n } });
  }
}
/** O's end on T at a corner (T running on `on` past it) or a T-joint (T passing through): on T's box face, or to its envelope (a cope). */
function teeOrButt(plan: EndsPlan, envelope: boolean, PT: MemberPlace, PO: MemberPlace, inT: Point | null, inO: Point, at: Point, O: JointEnd, T: number, p: number, T0: Point, LT: number, where: { end?: 0 | 1; s?: number }, on: number, Rmax: number, id: string, fail: Tools['fail'], notch?: FrameNotchReport, length = Infinity): void {
  if (notch) {
    planNotch(plan, notch, PT, PO, inO, at, O, T, p, T0, Rmax, id, fail, length); return;
  }
  if (envelope) {
    plan.extend[O.member][O.end] = 2 * Rmax + 1;
    plan.subtract[O.member].push({ solid: envelopeAround(PT, T0, LT, where, on, 3 * Rmax + 1, `${id}_m${O.member}_on${T}`), name: `${endName(O.end)}.cope`, keepFrom: at, toward: scale(inO, -1) });
    plan.report[O.member].push({ end: endName(O.end), point: p, kind: 'cope', with: T });
    return;
  }
  const b = faceButt(PT, PO, inT, inO, at, `point ${p}: member ${O.member} meets member ${T}`, fail);
  plan.extend[O.member][O.end] = b.runO;
  plan.cuts[O.member].push({ o: b.face, n: scale(b.w, -1), name: `${endName(O.end)}.butt` });
  plan.report[O.member].push({ end: endName(O.end), point: p, kind: 'butt', with: T, angle: b.deg, plane: { origin: b.face, normal: scale(b.w, -1) } });
}
/** Two members whose lines cross inside both their lengths (not at a joint): `MEMBERS_CLASH` — one would run through the other. */
function crossingMembers(points: readonly Point[], pairs: readonly (readonly [number, number])[], lengths: readonly number[], places: readonly MemberPlace[]): string | null {
  for (let a = 0; a < pairs.length; a++) for (let b = a + 1; b < pairs.length; b++) {
    const pa = points[pairs[a][0]], pb = points[pairs[b][0]], ua = places[a].u, ub = places[b].u, w0 = sub(pa, pb);
    const B = dot(ua, ub), d = dot(ua, w0), e = dot(ub, w0), den = 1 - B * B;
    if (den < 1e-12) continue;
    const s = (B * e - d) / den, t = (e - B * d) / den;
    if (s <= MEMBER_MIN_MM || s >= lengths[a] - MEMBER_MIN_MM || t <= MEMBER_MIN_MM || t >= lengths[b] - MEMBER_MIN_MM) continue;
    if (len(sub(add(pa, scale(ua, s)), add(pb, scale(ub, t)))) <= MEMBER_MIN_MM) return `[MEMBERS_CLASH] members ${a} and ${b} cross inside both their lengths (split one at the crossing to make a joint)`;
  }
  return null;
}
/** A member's section placed on its line: the (mirrored) shape, area, centroid, box, the line's direction, the frame, the line's section point. */
type MemberPlace = { readonly shape: MemberShape; readonly area: number; readonly centroid: XY; readonly box: { readonly min: XY; readonly max: XY }; readonly u: Point; readonly F: { x: Point; y: Point; fallback?: Point }; readonly q: XY };
function placeMember(given: MemberShape, o: MemberLook & { start: Point; end: Point; L: number; up: Point }): MemberPlace {
  const shape = o.mirror ? mirroredShape(given) : given;
  let area = shape.areaMM2, centroid = shape.centroid;
  // (A sketch section: its area and centroid by a unit prism's exact mass.)
  if (area === undefined || centroid === undefined) {
    const m = prismaticMassProperties(prismaticFromProfile({ outer: shape.outer, ...(shape.holes.length ? { holes: shape.holes } : {}), height: 1, from: 0 }), 1);
    area = m.volume; centroid = [m.centroid[0], m.centroid[1]];
  }
  const box = shape.box ?? loopBox(shape.outer), u = snapUnit(scale(sub(o.end, o.start), 1 / o.L)), F = memberFrame(u, o.up, o.roll);
  // (The section point on the line: the anchor's, less the offset the section is moved by.)
  const p = anchorPoint(o.anchor, centroid, box);
  return { shape, area, centroid, box, u, F, q: [p[0] - o.offset[0], p[1] - o.offset[1]] };
}
// FRk4: authored circular paths, composed only from exact prisms and revolutions.
const rotateAround = (v: Point, axis: Point, angle: number): Point => add(add(scale(v, Math.cos(angle)), scale(cross(axis, v), Math.sin(angle))), scale(axis, dot(axis, v) * (1 - Math.cos(angle))));
type FrameCurvePath = { from: number; to: number; indices: number[]; start: Point; end: Point; arcStart?: Point; arcEnd?: Point; center?: Point; normal?: Point; radius?: number; angle?: number; tangent?: Point; endTangent?: Point; lead: number; tail: number };
function frameCurvePaths(segs: unknown[], points: Point[], pairs: readonly (readonly [number, number])[], bends: unknown, t: Pick<Tools, 'xyz' | 'integer' | 'dim' | 'fail'>): FrameCurvePath[] {
  const { fail } = t, used = new Set<number>(), paths: FrameCurvePath[] = [];
  const arcFail = (detail: string): never => fail('PARAMETER', `[ARC_MEMBER] ${detail}`);
  const arc = (k: number, g: Record<string, unknown>): FrameCurvePath => {
    const [from, to] = pairs[k], start = points[from], end = points[to];
    if (g.through !== undefined && g.center !== undefined) arcFail(`segment ${k}: give through or center, never both`);
    let center: Point, normal: Point;
    if (g.through !== undefined) {
      const via = points[t.integer(g.through, `segments[${k}].through`, 0, points.length - 1)], u = sub(via, start), v = sub(end, start), n = cross(u, v), nn = dot(n, n);
      if (!(Math.sqrt(nn) > 1e-9 * Math.max(1, len(u) * len(v)))) arcFail(`segment ${k}: three distinct noncollinear points are required`);
      center = add(start, scale(add(scale(cross(v, n), dot(u, u)), scale(cross(n, u), dot(v, v))), 1 / (2 * nn)));
      normal = unit(n);
    } else if (g.center !== undefined) {
      center = t.xyz(g.center as CadPartPoint3, `segments[${k}].center`);
      const a = sub(start, center), b = sub(end, center), n = cross(a, b);
      if (!(len(n) > 1e-9 * Math.max(1, len(a) * len(b)))) arcFail(`segment ${k}: center form requires a unique minor arc below 180 degrees`);
      normal = unit(n);
    } else return arcFail(`segment ${k}: give through or center`);
    const a = sub(start, center), b = sub(end, center), radius = len(a);
    if (!(radius > MEMBER_MIN_MM) || Math.abs(len(b) - radius) > 1e-9 * Math.max(1, radius)) arcFail(`segment ${k}: endpoints must lie on the same positive-radius circle`);
    let angle = Math.atan2(dot(normal, cross(a, b)), dot(a, b)); if (angle <= 0) angle += 2 * Math.PI;
    if (!(angle > 1e-9 && angle < 2 * Math.PI - 1e-9)) arcFail(`segment ${k}: sweep must be above zero and below a full turn`);
    return { from, to, indices: [k], start, end, arcStart: start, arcEnd: end, center, normal, radius, angle, tangent: unit(cross(normal, a)), endTangent: unit(cross(normal, b)), lead: 0, tail: 0 };
  };
  if (bends !== undefined) {
    if (!Array.isArray(bends)) fail('INPUT', 'bends must list { point, radius }');
    for (const raw of bends as unknown[]) {
      if (!isRecord(raw)) fail('INPUT', 'each bend must be { point, radius }');
      const g = raw as Record<string, unknown>, point = t.integer(g.point, 'bends.point', 0, points.length - 1), radius = t.dim(g.radius as CadPartDim, 'bends.radius');
      const incident = pairs.map((p, i) => p.includes(point) ? i : -1).filter(i => i >= 0);
      if (!(radius > MEMBER_MIN_MM) || incident.length !== 2 || incident.some(i => used.has(i) || isRecord(segs[i]))) fail('PARAMETER', '[BEND_RADIUS] a bend needs a positive radius and exactly two unclaimed straight segments');
      const [i, j] = incident, from = pairs[i][0] === point ? pairs[i][1] : pairs[i][0], to = pairs[j][0] === point ? pairs[j][1] : pairs[j][0], start = points[from], end = points[to], V = points[point], a = unit(sub(V, start)), b = unit(sub(end, V)), theta = Math.acos(Math.max(-1, Math.min(1, dot(a, b)))), setback = radius * Math.tan(theta / 2), l0 = len(sub(V, start)), l1 = len(sub(end, V));
      if (!(theta > 1e-9 && theta < Math.PI - 1e-9 && setback < l0 - MEMBER_MIN_MM && setback < l1 - MEMBER_MIN_MM)) fail('PARAMETER', '[BEND_RADIUS] bend tangencies consume a leg or the corner has no unique tangent circle');
      const normal = unit(cross(a, b)), arcStart = sub(V, scale(a, setback)), arcEnd = add(V, scale(b, setback)), center = add(arcStart, scale(cross(normal, a), radius));
      used.add(i); used.add(j);
      paths.push({ from, to, indices: [i, j], start, end, arcStart, arcEnd, center, normal, radius, angle: theta, tangent: a, endTangent: b, lead: l0 - setback, tail: l1 - setback });
    }
  }
  for (let k = 0; k < pairs.length; k++) if (!used.has(k)) {
    const g = segs[k]; if (isRecord(g)) paths.push(arc(k, g));
    else { const [from, to] = pairs[k]; paths.push({ from, to, indices: [k], start: points[from], end: points[to], lead: len(sub(points[to], points[from])), tail: 0 }); }
  }
  return paths.sort((a, b) => a.indices[0] - b.indices[0]);
}
function buildCurvedMember(given: MemberShape, path: FrameCurvePath, o: MemberLook & { up: Point; at: string; frame: { member: number; from: number; to: number }; ends?: MemberEnds }, fail: Tools['fail']): Extract<Result, { kind: 'solid' }> {
  if (!path.center) return buildMember(given, { ...o, start: path.start, end: path.end, L: path.lead }) as Extract<Result, { kind: 'solid' }>;
  let tangent = path.tangent!;
  const P = placeMember(given, { ...o, start: path.start, end: add(path.start, tangent), L: 1 }), { shape, centroid, q } = P, C = path.center, aEnd = path.arcEnd!;
  let F = P.F, aStart = path.arcStart!, theta = path.angle!;
  const extend = o.ends?.extend ?? [0, 0], e0 = path.lead ? 0 : 2 * extend[0] / path.radius!, e1 = path.tail ? 0 : 2 * extend[1] / path.radius!;
  if (theta + e0 + e1 >= 2 * Math.PI - 1e-9) fail('PARAMETER', '[ARC_MEMBER] end mitre continuation reaches a full turn');
  if (e0) { aStart = add(C, rotateAround(sub(aStart, C), path.normal!, -e0)); tangent = rotateAround(tangent, path.normal!, -e0); F = { x: rotateAround(F.x, path.normal!, -e0), y: rotateAround(F.y, path.normal!, -e0) }; }
  theta += e0 + e1;
  const radial = sub(C, aStart), cx = dot(radial, F.x) + q[0], cy = dot(radial, F.y) + q[1], reach = loopBox(shape.outer);
  const toward = unit(radial), minRadius = path.radius! - Math.max(...[[reach.min[0], reach.min[1]], [reach.min[0], reach.max[1]], [reach.max[0], reach.min[1]], [reach.max[0], reach.max[1]]].map(p => (p[0] - q[0]) * dot(F.x, toward) + (p[1] - q[1]) * dot(F.y, toward)));
  if (!(minRadius > MEMBER_MIN_MM)) fail('PARAMETER', `[${path.indices.length > 1 ? 'BEND_RADIUS' : 'ARC_MEMBER'}] the section reaches the bend axis; increase the radius`);
  const d: XY = [-cy + q[1], cx - q[0]], dl = Math.hypot(...d), direction: XY = [d[0] / dl, d[1] / dl];
  const roleNames = [...(shape.outerNames ?? shape.outer.map((_, i) => `side${i}`)), ...shape.holes.flatMap((h, j) => shape.holeNames?.[j] ?? h.map((_, i) => `bore${j}.side${i}`))];
  let roleIndex = shape.outer.length;
  const input: RevolveInput = { id: `${o.at}_arc`.replace(/\./g, '_'), profile: shape.outer, holes: shape.holes, axis: { origin: [cx, cy], direction }, angle: theta * 180 / Math.PI, sideTags: shape.outer.map((_, i) => `role${i}`), holeTags: shape.holes.map(h => h.map(() => `role${roleIndex++}`)) };
  const matrix: BrepAffine['matrix'] = [F.x[0], F.y[0], tangent[0], F.x[1], F.y[1], tangent[1], F.x[2], F.y[2], tangent[2]], origin = sectionPoint(F, -q[0], -q[1], aStart);
  const arcPrefix = path.indices.length > 1 ? `${o.at}.bend` : o.at;
  const renameArc = (n: string) => n.replace(`${o.at}_arc`.replace(/\./g, '_'), arcPrefix).replace(/\.side\[role(\d+)\]/g, (_, i: string) => `.${roleNames[Number(i)]}`);
  let brep = transformBrep(revolveProfile(input), { matrix, offset: origin }, renameArc);
  const masses: { local: (density: number) => MassProperties; axes: [Point, Point, Point]; offset: Point }[] = [{ local: density => revolveMassProperties(input, density), axes: [F.x, F.y, tangent], offset: origin }];
  const rotate = (v: Point): Point => add(add(scale(v, Math.cos(theta)), scale(cross(path.normal!, v), Math.sin(theta))), scale(path.normal!, dot(path.normal!, v) * (1 - Math.cos(theta))));
  const pieces: Brep[] = [];
  const prismAt = (start: Point, L: number, x: Point, y: Point, z: Point, suffix: string): Brep => {
    const prefix = `${o.at}.${suffix === 'lead' ? 'straight0' : 'straight1'}`, solid = prismaticFromProfile({ outer: shape.outer, holes: shape.holes, height: L, tag: `${o.at}_${suffix}`, names: { ...(shape.outerNames ? { outer: shape.outerNames.map(n => `${prefix}.${n}`) } : {}), ...(shape.holeNames ? { holes: shape.holeNames.map(h => h.map(n => `${prefix}.${n}`)) } : {}), bottom: `${prefix}.start`, top: `${prefix}.end` } });
    const offset = sectionPoint({ x, y }, -q[0], -q[1], start);
    masses.push({ local: density => prismaticMassProperties(solid, density), axes: [x, y, z], offset });
    return transformBrep(brepFromPrismatic(solid), { matrix: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]], offset });
  };
  if (path.lead) pieces.push(prismAt(sub(path.start, scale(tangent, extend[0])), path.lead + extend[0], F.x, F.y, tangent, 'lead'));
  pieces.push(brep);
  if (path.tail) pieces.push(prismAt(aEnd, path.tail + extend[1], rotate(F.x), rotate(F.y), path.endTangent!, 'tail'));
  brep = pieces[0];
  for (const next of pieces.slice(1)) {
    const glued = glueAtSharedFace(brep, next, { family: 'frame-curve', id: o.at.replace(/\./g, '_') });
    if (!glued) fail('GEOMETRY', '[ARC_MEMBER] tangent pieces could not be joined at their complete section');
    brep = glued!;
  }
  for (const cut of o.ends?.cuts ?? []) {
    const x = unit(cross(cut.n, Math.abs(cut.n[0]) < .9 ? [1, 0, 0] : [0, 1, 0])), y = cross(cut.n, x), R = 4 * (path.radius! + len(sub(path.start, path.end)) + 1000);
    brep = booleanAnalytic(brep, brepOf({ solid: obliqueHalf(cut.o, cut.n, x, y, R, true, `${o.at}_clip`.replace(/\./g, '_'), `${o.at}.${cut.name}`) }, 'frame_clip'), 'intersection');
  }
  const cStart = sectionPoint(P.F, centroid[0] - q[0], centroid[1] - q[1], path.arcStart!), nAxis = path.normal!, radialC = sub(cStart, C), axialC = scale(nAxis, dot(radialC, nAxis)), radialOnly = sub(radialC, axialC), centroidRadius = len(radialOnly), cEnd = add(C, rotateAround(radialC, nAxis, path.angle!));
  let startAngle = 0, endAngle = path.angle!, lead = path.lead, tail = path.tail;
  for (const cut of o.ends?.cuts ?? []) {
    const start = cut.name.startsWith('start'), reference = start ? 0 : path.angle!;
    if ((start && path.lead) || (!start && path.tail)) {
      const tangent = start ? path.tangent! : path.endTangent!, point = start ? sub(cStart, scale(tangent, path.lead)) : add(cEnd, scale(tangent, path.tail)), t = -dot(cut.n, sub(point, cut.o)) / dot(cut.n, tangent);
      if (start) lead -= t; else tail += t;
    } else {
      const A = dot(cut.n, radialOnly), B = dot(cut.n, cross(nAxis, radialOnly)), D = dot(cut.n, sub(add(C, axialC), cut.o)), v = -D / Math.hypot(A, B);
      if (Math.abs(v) > 1) fail('PARAMETER', '[ARC_MEMBER] mitre plane misses the centroidal arc');
      const phase = Math.atan2(B, A), alpha = Math.acos(v), choices = [phase + alpha, phase - alpha].flatMap(t => [-2, -1, 0, 1, 2].map(k => t + 2 * Math.PI * k)), angle = choices.sort((a, b) => Math.abs(a - reference) - Math.abs(b - reference))[0];
      if (start) startAngle = angle; else endAngle = angle;
    }
  }
  const developedLength = lead + centroidRadius * (endAngle - startAngle) + tail;
  const base = buildMember(given, { ...o, ends: undefined, start: path.start, end: add(path.start, path.tangent!), L: 1 }) as Extract<Result, { kind: 'solid' }>, member = base.parts[0].member!;
  const curve = { kind: path.indices.length > 1 ? 'bend' as const : 'arc' as const, center: C, axis: nAxis, radius: path.radius!, centroidRadius: centroidRadius, angle: (endAngle - startAngle) * 180 / Math.PI, startTangent: rotateAround(path.tangent!, nAxis, startAngle), endTangent: rotateAround(path.tangent!, nAxis, endAngle), developedLength: developedLength, segmentIndices: path.indices, straightLengths: [lead, tail] as const };
  return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass: density => o.ends?.cuts.length ? brepMassProperties(brep, density) : combineMassProperties(masses.map(m => ({ props: m.local(density), axes: m.axes, offset: m.offset }))), member: { ...member, axis: curve.startTangent, xAxis: rotateAround(member.xAxis as Point, nAxis, startAngle), yAxis: rotateAround(member.yAxis as Point, nAxis, startAngle), end: path.end, length: developedLength, curve, ...(o.ends ? { ends: o.ends.report } : {}), centroidLine: { start: sub(add(C, rotateAround(radialC, nAxis, startAngle)), scale(path.tangent!, lead)), end: add(add(C, rotateAround(radialC, nAxis, endAngle)), scale(path.endTangent!, tail)) } } }] };
}

/** How a member's ends are finished at its frame's corners (FR3a, D125): how far each end runs on, the planes it is cut by (keeping n·x < n·o), what each end is. */
type MemberEnds = { readonly extend: readonly [number, number]; readonly cuts: readonly { readonly o: Point; readonly n: Point; readonly name: string }[]; readonly subtract: readonly MemberSubtract[]; readonly report: readonly FrameEndReport[] };
/**
 * A solid taken from a member at one end (an envelope it is trimmed or coped to, a body it is trimmed to): of the pieces
 * left, the one reaching farthest from `keepFrom` along `toward` (its own length's way) is kept. `mustTouch`: refused
 * `TRIM_MISSES` when nothing is taken.
 */
type MemberSubtract = { readonly solid: Solid; readonly name: string; readonly keepFrom: Point; readonly toward: Point; readonly mustTouch?: boolean; readonly edgeFitTolerance?: number };
/** A solid in several pieces: the one reaching farthest from `from` along `toward` (one piece: itself). */
function keepFarthest(s: Solid, from: Point, toward: Point): Solid {
  if (s.kind !== 'brep') return s;
  const pieces = splitBodies(s.brep);
  return pieces.length > 1 ? { kind: 'brep', brep: farthestPiece(pieces, from, toward) } : s;
}
/** A section's loop vertices (starts and arc centres) in its own XY. */
function shapeVertices(shape: MemberShape): Point[] {
  const out: Point[] = [];
  for (const loop of [shape.outer, ...shape.holes]) for (const g of loop) { out.push([g.start[0], g.start[1], 0]); if (g.kind === 'arc') out.push([g.center[0], g.center[1], 0]); }
  return out;
}
/** Whether a section is symmetric about its own x or y line through its centroid (its vertices map onto themselves). */
function reversibleSection(shape: MemberShape, c: XY): boolean {
  const v = shapeVertices(shape), size = Math.max(1, ...v.map(p => Math.hypot(p[0] - c[0], p[1] - c[1]))), tol = 1e-9 * size;
  const aboutX = v.map(p => [p[0], 2 * c[1] - p[1], 0] as Point), aboutY = v.map(p => [2 * c[0] - p[0], p[1], 0] as Point);
  return samePoints(aboutX, v, tol) || samePoints(aboutY, v, tol);
}
/** Of a member's pieces, the one whose points reach farthest from `from` along `toward`. */
function farthestPiece(pieces: readonly Brep[], from: Point, toward: Point): Brep {
  let best = pieces[0], reach = -Infinity;
  for (const b of pieces) { let r = -Infinity; for (const v of b.vertices) r = Math.max(r, dot(sub(v.point, from), toward)); if (r > reach) { reach = r; best = b; } }
  return best;
}
/** A member built: its section extruded along its line (run on past an end where a corner needs it, ends `.start`, `.end`), moved onto its line, cut at its corners, its report on it. */
function buildMember(given: MemberShape, o: MemberLook & { start: Point; end: Point; L: number; up: Point; at: string; frame?: { member: number; from: number; to: number }; ends?: MemberEnds }): Result {
  const P = placeMember(given, o), { shape, area, centroid, u, F, q } = P, pre = (n: string) => `${o.at}.${n}`, e0 = o.ends?.extend[0] ?? 0, e1 = o.ends?.extend[1] ?? 0;
  const solid = prismaticFromProfile({ outer: shape.outer, ...(shape.holes.length ? { holes: shape.holes } : {}), ...(shape.tags ? { sideTags: shape.tags } : {}), height: o.L + e0 + e1, from: -e0, tag: o.at,
    names: { ...(shape.outerNames ? { outer: shape.outerNames.map(pre) } : {}), ...(shape.holeNames ? { holes: shape.holeNames.map(h => h.map(pre)) } : {}), bottom: `${o.at}.start`, top: `${o.at}.end` } });
  const origin = sectionPoint(F, -q[0], -q[1], o.start), m: BrepAffine['matrix'] = [F.x[0], F.y[0], u[0], F.x[1], F.y[1], u[1], F.x[2], F.y[2], u[2]];
  const member: FrameMemberReport = { sectionKind: shape.kind, section: shape.label, area: area, centroid, ...(shape.derived ? { derived: shape.derived } : {}), anchor: o.anchor, offset: o.offset, roll: o.roll, ...(o.mirror ? { mirrored: true } : {}), reversible: reversibleSection(shape, centroid), ...(o.frame ? { frame: o.frame } : {}),
    start: o.start, end: o.end, length: o.L, axis: u, xAxis: F.x, yAxis: F.y, ...(F.fallback ? { upFallback: F.fallback } : {}),
    centroidLine: { start: sectionPoint(F, centroid[0] - q[0], centroid[1] - q[1], o.start), end: sectionPoint(F, centroid[0] - q[0], centroid[1] - q[1], o.end) },
    ...(o.ends ? { ends: o.ends.report } : {}) };
  const r = moveAll([{ solid: { kind: 'upright', solid } }], m, origin) as Extract<Result, { kind: 'solid' }>;
  const memberPlace: MemberPlaced = { place: P, lengthMM: o.L, extend: [e0, e1], at: o.at };
  if (!o.ends?.cuts.length && !o.ends?.subtract.length) return { kind: 'solid', parts: r.parts.map(part => ({ ...part, member, memberPlace })) };
  // Cut at its corners: each plane keeps the member's side (n·x < n·o); a half-space round it, R past every point of it.
  let cut = r.parts[0].solid;
  const R = o.L + e0 + e1 + 2 * Math.hypot(P.box.max[0] - P.box.min[0], P.box.max[1] - P.box.min[1]) + 1;
  for (const c of o.ends.cuts) {
    const x = unit(cross(c.n, Math.abs(c.n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), y = cross(c.n, x);
    // (The tool's own ids take no dots; its cap is named as the member's cut face.)
    cut = boolean(cut, obliqueHalf(c.o, c.n, x, y, R, true, `${o.at}_${c.name}`.replace(/\./g, '_'), `${o.at}.${c.name}`), 'intersection', o.at.replace(/\./g, '_'));
  }
  if (cut.kind === 'brep' && cut.brep.bodies.length !== 1) throw new CadPartError('GEOMETRY', o.at, `[TRIM_LEAVES_PIECES] cut at its corners, member ${o.frame?.member ?? ''} is in ${cut.brep.bodies.length} pieces`);
  // Then the solids taken from it (envelopes, bodies): of the pieces left, the one reaching farthest its own way is kept.
  for (const t of o.ends.subtract) {
    const before = t.mustTouch ? volumeOfSolid(cut) : 0, next = boolean(cut, t.solid, 'difference', `${o.at}_${t.name}`.replace(/\./g, '_'), t.edgeFitTolerance);
    if (empty(next)) throw new CadPartError('PARAMETER', o.at, `[TRIM_EMPTY] member ${o.frame?.member ?? ''}: nothing is left of it`);
    const pieces = next.kind === 'brep' ? splitBodies(next.brep) : null;
    cut = pieces && pieces.length > 1 ? { kind: 'brep', brep: farthestPiece(pieces, t.keepFrom, t.toward) } : next;
    if (t.mustTouch && Math.abs(volumeOfSolid(cut) - before) <= 1e-9 * Math.max(1, before)) throw new CadPartError('PARAMETER', o.at, `[TRIM_MISSES] member ${o.frame?.member ?? ''} does not reach the body it is trimmed to`);
  }
  return { kind: 'solid', parts: [{ solid: cut, member, memberPlace }] };
}
/** A frame member as built (FRk1): its section placed on its line, its length, how far each end runs on, its faces' prefix. */
export type MemberPlaced = { readonly place: MemberPlace; readonly lengthMM: number; readonly extend: readonly [number, number]; readonly at: string };
/** The matrix of a member's frame (the section's x, y and its line's direction as columns) and the part point of its section's origin at its start. */
function memberAffine(P: MemberPlace, start: Point): { m: BrepAffine['matrix']; o: Point } {
  return { m: [P.F.x[0], P.F.y[0], P.u[0], P.F.x[1], P.F.y[1], P.u[1], P.F.x[2], P.F.y[2], P.u[2]], o: sectionPoint(P.F, -P.q[0], -P.q[1], start) };
}
/**
 * An end cap (FRk1, D165): a plate over a member's square end (its section's outer loop) or inset in its bore (the bore's
 * loop), `t` thick, on the end as built (a through end where it runs on to). Refused `CAP_END` on an end a joint cuts
 * (a mitre, a butt, a cope, a trim) and for a plug where the section has no bore or several.
 */
function endCapOf(part: Part, frame: string, k: number, end: 0 | 1, fit: 'over' | 'inset', t: number, at: string, fail: Tools['fail']): Result {
  const { place: P, lengthMM: L, extend } = part.memberPlace!, report = part.member!, e = report.ends?.find(x => x.end === endName(end));
  if (e && e.kind !== 'square' && e.kind !== 'through') fail('PARAMETER', `[CAP_END] member ${k}'s ${endName(end)} is cut by a ${e.kind}: a cap sits on a square end`);
  if (fit === 'inset' && P.shape.holes.length !== 1) fail('PARAMETER', `[CAP_END] member ${k}'s section has ${P.shape.holes.length ? `${P.shape.holes.length} bores` : 'no bore'}: a plug goes into one bore (give fit over)`);
  const loop = fit === 'over' ? P.shape.outer : P.shape.holes[0], z = end ? L + extend[1] : -extend[0];
  // Over: outside the end; inset: inside the bore, flush with the end.
  const from = (fit === 'over') === (end === 1) ? z : z - t, out = end ? 1 : -1;
  const names = fit === 'over' ? { bottom: end ? `${at}.seat` : `${at}.face`, top: end ? `${at}.face` : `${at}.seat` } : { bottom: end ? `${at}.inner` : `${at}.face`, top: end ? `${at}.face` : `${at}.inner` };
  const solid = prismaticFromProfile({ outer: loop, height: t, from: from, tag: at, names });
  const start = report.start as unknown as Point, { m, o } = memberAffine(P, start), A = loopArea(loop);
  const endCap: EndCapReport = { frame, member: k, end: endName(end), fit, thickness: t, area: A, volume: A * t, plane: { origin: noNegativeZero(add(start, scale(P.u, z))), normal: noNegativeZero(scale(P.u, out)) }, seam: { length: loopPerimeter(loop), exact: true } };
  const r = moveAll([{ solid: { kind: 'upright', solid } }], m, o) as Extract<Result, { kind: 'solid' }>;
  return { kind: 'solid', parts: [{ ...r.parts[0], endCap }] };
}
/** A report's point with −0 written as 0. */
const noNegativeZero = (v: Point): Point => [v[0] + 0, v[1] + 0, v[2] + 0];
/** A member at a joint: its index, its direction away from the joint, how far it reaches that way, and where its line lies. */
type GussetArm = { readonly k: number; readonly away: Point; readonly reach: number; readonly part: Part };
/**
 * Where a member's side facing `w` (square to its line) lies, and whether it is flat over a plate's span (`n`-ward from
 * the line, lo to hi): its distance from the line, and the name of the straight face there. Refused `GUSSET_FIT` at an
 * edge of its section (turned) and where the side has no flat material over the span (a round tube, a round corner).
 */
function gussetSide(arm: GussetArm, w: Point, n: Point, lo: number, hi: number, fail: Tools['fail']): { h: number; face?: string } {
  const { place: P, at } = arm.part.memberPlace!, wx = dot(w, P.F.x), wy = dot(w, P.F.y);
  const axis = Math.abs(Math.abs(wx) - 1) < 1e-9 ? 0 : Math.abs(Math.abs(wy) - 1) < 1e-9 ? 1 : -1;
  if (axis < 0) fail('PARAMETER', `[GUSSET_FIT] member ${arm.k} meets the gusset at an edge of its section, not a face (turn the member a quarter, or leave the gusset out)`);
  const ax = axis as 0 | 1, sign = (ax === 0 ? wx : wy) > 0 ? 1 : -1, boxAt = sign > 0 ? P.box.max[ax] : P.box.min[ax], other = 1 - ax;
  const nd = dot(n, ax === 0 ? P.F.y : P.F.x), a = P.q[other] + nd * lo, b = P.q[other] + nd * hi, s0 = Math.min(a, b), s1 = Math.max(a, b);
  const tol = 1e-9 * Math.max(1, P.box.max[0] - P.box.min[0], P.box.max[1] - P.box.min[1]), loop = P.shape.outer;
  for (let i = 0; i < loop.length; i++) {
    const g = loop[i], e = loop[(i + 1) % loop.length].start;
    if (g.kind !== 'line' || Math.abs(g.start[ax] - boxAt) > tol || Math.abs(e[ax] - boxAt) > tol) continue;
    if (Math.min(g.start[other], e[other]) <= s0 + tol && Math.max(g.start[other], e[other]) >= s1 - tol) return { h: sign * (boxAt - P.q[ax]), ...(P.shape.outerNames ? { face: `${at}.${P.shape.outerNames[i]}` } : {}) };
  }
  const spans = sideContact(P, ax, boxAt).map(([p, q]) => `${+p.toFixed(3)} to ${+q.toFixed(3)}`).join(', ') || 'none';
  return fail('PARAMETER', `[GUSSET_FIT] member ${arm.k} has no flat face under the gusset: it spans ${+s0.toFixed(3)} to ${+s1.toFixed(3)} mm across that side, whose flat material is at ${spans} (a round tube or a round corner)`);
}
/**
 * A gusset (FRk1, D165) in the corner of two members of a frame at a skeleton point: in their plane (its normal a × b of
 * their directions away from the joint), its legs along their inner faces from where those faces meet, the corner
 * clipped. Refused `GUSSET_FIT`: no two members there (or not those named), members in line, a member meeting it at an
 * edge or a round, a leg past its member, a clip not under the legs.
 */
function gussetOf(byMember: ReadonlyMap<number, Part>, g: { frame: string; point: number; pair?: readonly [number, number]; along?: 1 | -1; legs: readonly [number, number]; t: number; clip: number; offset: number }, at: string, fail: Tools['fail']): Result {
  let p: Point | undefined;
  for (const q of byMember.values()) { const fm = q.member!.frame!; if (fm.from === g.point) p = q.member!.start as unknown as Point; else if (fm.to === g.point) p = q.member!.end as unknown as Point; if (p) break; }
  if (!p) return fail('PARAMETER', `[GUSSET_FIT] no member of ${g.frame} ends at point ${g.point}`);
  const arms: GussetArm[] = [];
  for (const [k, q] of byMember) {
    const r = q.member!, s = r.start as unknown as Point, u = q.memberPlace!.place.u, L = r.length, d = dot(sub(p, s), u);
    if (samePoint(s, p)) arms.push({ k, away: u, reach: L, part: q });
    else if (samePoint(r.end as unknown as Point, p)) arms.push({ k, away: scale(u, -1), reach: L, part: q });
    else if (d > MEMBER_MIN_MM && d < L - MEMBER_MIN_MM && len(sub(p, add(s, scale(u, d)))) <= MEMBER_MIN_MM) {
      // (A member passing through: its leg runs `along` its own direction or the other way.)
      if ((g.pair ? g.pair.includes(k) : true) && g.along === undefined) fail('INPUT', `member ${k} runs through point ${g.point}: along (1 or −1) says which way the gusset's leg runs on it`);
      arms.push({ k, away: scale(u, g.along ?? 1), reach: (g.along ?? 1) > 0 ? L - d : d, part: q });
    }
  }
  const chosen = g.pair ? g.pair.map(k => arms.find(a => a.k === k)) : arms.length === 2 ? arms : null;
  if (!chosen) return fail('PARAMETER', `[GUSSET_FIT] ${arms.length} members meet at point ${g.point}${arms.length > 2 ? ': say which two (members)' : ''}`);
  const missing = g.pair?.find((k, i) => !chosen[i]);
  if (missing !== undefined) return fail('PARAMETER', `[GUSSET_FIT] member ${missing} does not meet point ${g.point}`);
  const [A, B] = chosen as GussetArm[], cos = dot(A.away, B.away), axb = cross(A.away, B.away), sin = len(axb);
  if (sin < 1e-9) return fail('PARAMETER', `[GUSSET_FIT] members ${A.k} and ${B.k} are in line at point ${g.point}: no corner for a gusset`);
  const n = scale(axb, 1 / sin), ey = unit(sub(B.away, scale(A.away, cos))), wb = unit(sub(A.away, scale(B.away, cos))), lo = g.offset - g.t / 2, hi = g.offset + g.t / 2;
  const sa = gussetSide(A, ey, n, lo, hi, fail), sb = gussetSide(B, wb, n, lo, hi, fail);
  // The inner faces' meeting in the plate's plane (x along A, y towards B): y = h_a, and h_b·w_b + s·u_b.
  const s = (sa.h + sb.h * cos) / sin, xV = sb.h * sin + s * cos, yV = sa.h, [l1, l2] = g.legs, c = g.clip;
  if (!(c < Math.min(l1, l2))) fail('PARAMETER', `[GUSSET_FIT] a clip of ${c} mm leaves nothing of legs ${l1} and ${l2}`);
  if (xV + l1 > A.reach + MEMBER_MIN_MM) fail('PARAMETER', `[GUSSET_FIT] leg ${l1} runs past member ${A.k}: ${+(A.reach - xV).toFixed(3)} mm of its face from the corner`);
  if (s + l2 > B.reach + MEMBER_MIN_MM) fail('PARAMETER', `[GUSSET_FIT] leg ${l2} runs past member ${B.k}: ${+(B.reach - s).toFixed(3)} mm of its face from the corner`);
  const at2 = (d: number, along: 'a' | 'b'): XY => along === 'a' ? [xV + d, yV] : [xV + d * cos, yV + d * sin];
  const corners: XY[] = c > 0 ? [at2(c, 'a'), at2(l1, 'a'), at2(l2, 'b'), at2(c, 'b')] : [[xV, yV], at2(l1, 'a'), at2(l2, 'b')];
  const outer: ProfileSegmentInput[] = corners.map(start => ({ kind: 'line', start }));
  const names = [`${at}.on.m${A.k}`, `${at}.free`, `${at}.on.m${B.k}`, ...(c > 0 ? [`${at}.clip`] : [])];
  const solid = prismaticFromProfile({ outer, height: g.t, from: 0, tag: at, names: { outer: names, bottom: `${at}.back`, top: `${at}.front` } });
  const m: BrepAffine['matrix'] = [A.away[0], ey[0], n[0], A.away[1], ey[1], n[1], A.away[2], ey[2], n[2]], mid = add(p, scale(n, g.offset));
  const area = (l1 * l2 - c * c) * sin / 2, seams: WeldmentSeam[] = [{ member: A.k, length: l1 - c, ...(sa.face ? { face: sa.face } : {}) }, { member: B.k, length: l2 - c, ...(sb.face ? { face: sb.face } : {}) }];
  const gusset: GussetReport = { frame: g.frame, point: g.point, members: [A.k, B.k], legs: [l1, l2], thickness: g.t, clip: c, offset: g.offset, angle: Math.atan2(sin, cos) * 180 / Math.PI,
    plane: { origin: noNegativeZero(mid), normal: noNegativeZero(n) }, area: area, volume: area * g.t, outline: corners.map(([x, y]) => noNegativeZero(add(mid, add(scale(A.away, x), scale(ey, y))))), seams };
  const r = moveAll([{ solid: { kind: 'upright', solid } }], m, add(p, scale(n, lo))) as Extract<Result, { kind: 'solid' }>;
  const gussetPlace: GussetPlaced = { p, n, ua: A.away, ey, ub: B.away, wb, xV, yV, s, legs: [l1, l2], clip: c, t: g.t, offset: g.offset, members: [A.k, B.k] };
  return { kind: 'solid', parts: [{ ...r.parts[0], gusset, gussetPlace }] };
}
/** A gusset as built (FRk2): its corner's frame (p, n; ua, ey along member A; ub, wb along member B), its corner, legs, clip, thickness, offset. */
export type GussetPlaced = { readonly p: Point; readonly n: Point; readonly ua: Point; readonly ey: Point; readonly ub: Point; readonly wb: Point; readonly xV: number; readonly yV: number; readonly s: number;
  readonly legs: readonly [number, number]; readonly clip: number; readonly t: number; readonly offset: number; readonly members: readonly [number, number] };
/** A B-rep or a prism moved from a local frame (its columns X, Y, W) at `o` into the part. */
function placedSolid(s: Solid, X: Point, Y: Point, W: Point, o: Point): Solid {
  const m: BrepAffine['matrix'] = [X[0], Y[0], W[0], X[1], Y[1], W[1], X[2], Y[2], W[2]];
  return s.kind === 'upright' ? (moveAll([{ solid: s }], m, o) as Extract<Result, { kind: 'solid' }>).parts[0].solid : { kind: 'brep', brep: transformBrep(s.brep, { matrix: m, offset: [o[0], o[1], o[2]] }) };
}
/** A flat face another member offers an end, in the end's plane: its loops in the plane's (a, b) from E, and the member. */
type Landing = { readonly k: number; readonly outer: readonly XY[]; readonly holes: readonly (readonly XY[])[] };
/** A B-rep face's loop as its vertices in order, or null where an edge is not straight (its midpoint off its chord). */
function straightLoop(brep: Brep, loopId: string): Point[] | null {
  const loop = brep.loops.find(l => l.id === loopId)!, pts: Point[] = [];
  for (const cid of loop.coedges) {
    const c = brep.coedges.find(x => x.id === cid)!, e = brep.edges.find(x => x.id === c.edge)!, [v0, v1] = e.vertices.map(v => brep.vertices.find(x => x.id === v)!.point);
    const [t0, t1] = curveDomain(e.curve), mid = evaluateCurve(e.curve, (t0 + t1) / 2), chord = scale(add(v0, v1), 0.5);
    if (len(sub(mid, chord)) > 1e-9 * Math.max(1, len(sub(v1, v0)))) return null;
    pts.push(c.sense === 'forward' ? v0 : v1);
  }
  return pts;
}
/**
 * The flat faces of the frame's other members lying in the plane through E square to `out` (an end's plane, `out` out of
 * it) and facing back at it, as built (a mitre's cut kept): each face's loops in the plane's (a, b) from E.
 */
function landingFaces(byMember: ReadonlyMap<number, Part>, self: number, E: Point, out: Point, a: Point, b: Point, at: string): Landing[] {
  const found: Landing[] = [];
  for (const [k, q] of byMember) {
    if (k === self) continue;
    const P = q.memberPlace!.place;
    // (Only a member with a box side in that plane facing back: then its faces lying there.)
    const faces = [0, 1].some(ax => [1, -1].some(sign => Math.abs(dot(scale(ax === 0 ? P.F.x : P.F.y, sign), out) + 1) < 1e-9));
    if (!faces) continue;
    const brep = brepOf(q, `${at}_m${k}`), on = (v: Point) => Math.abs(dot(sub(v, E), out)) <= MEMBER_MIN_MM, uv = (v: Point): XY => [dot(sub(v, E), a), dot(sub(v, E), b)];
    for (const f of brep.faces) {
      const loops = f.loops.map(l => straightLoop(brep, l));
      if (loops.some(l => !l || !l.every(on))) continue;
      // (Facing back at the end: its outer loop runs anticlockwise about its outward normal, so its area vector is against `out`.)
      const outer = loops[0]!, n = outer.reduce((acc, v, i) => add(acc, cross(v, outer[(i + 1) % outer.length])), [0, 0, 0] as Point);
      if (dot(n, out) >= 0) continue;
      found.push({ k, outer: outer.map(uv), holes: loops.slice(1).map(l => l!.map(uv)) });
    }
  }
  return found;
}
/** A landing face as a slab `h` deep on the end's side of its plane (−out), in the end's plane frame (a, b, a × b) at E. */
function landingSlab(f: Landing, a: Point, b: Point, E: Point, out: Point, h: number, at: string): Solid {
  const W = cross(a, b), up = dot(W, out) < 0, line = (start: XY): ProfileSegmentInput => ({ kind: 'line', start });
  const solid = prismaticFromProfile({ outer: f.outer.map(line), ...(f.holes.length ? { holes: f.holes.map(h2 => h2.map(line)) } : {}), height: h, from: up ? 0 : -h, tag: at });
  return placedSolid({ kind: 'upright', solid }, a, b, W, E);
}
/**
 * Landing faces meeting along edges as one loop each: split at collinear vertices before dropping opposite edge pairs
 * (within 1e-6 mm), then chain the rest. Null where that does not close up, or with holes: use the slabs' Booleans.
 */
function mergedLandings(faces: readonly Landing[]): Landing[] | null {
  if (faces.some(f => f.holes.length)) return null;
  const same = (p: XY, q: XY) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= MEMBER_MIN_MM;
  const source: [XY, XY][] = faces.flatMap(f => f.outer.map((p, i) => [p, f.outer[(i + 1) % f.outer.length]] as [XY, XY]));
  const edges: [XY, XY][] = source.flatMap(([p, q]) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy), ts = [0, 1];
    for (const v of source.flat()) {
      const t = ((v[0] - p[0]) * dx + (v[1] - p[1]) * dy) / (l * l);
      if (t > 0 && t < 1 && Math.abs(dx * (v[1] - p[1]) - dy * (v[0] - p[0])) <= MEMBER_MIN_MM * l) ts.push(t);
    }
    const cut = ts.sort((a, b) => a - b).filter((t, i, all) => i === 0 || (t - all[i - 1]) * l > MEMBER_MIN_MM);
    const point = (t: number): XY => [p[0] + t * dx, p[1] + t * dy];
    return cut.slice(1).map((t, i) => [point(cut[i]), point(t)] as [XY, XY]);
  });
  const kept = edges.filter(([p, q]) => !edges.some(([r, t]) => same(p, t) && same(q, r)));
  const loops: XY[][] = [], used = new Set<number>();
  for (let i = 0; i < kept.length; i++) {
    if (used.has(i)) continue;
    const loop: XY[] = [kept[i][0]];
    let at = i;
    for (let guard = 0; guard <= kept.length; guard++) {
      used.add(at);
      const end = kept[at][1];
      if (same(end, loop[0])) break;
      loop.push(end);
      const next = kept.findIndex((e, j) => !used.has(j) && same(e[0], end));
      if (next < 0) return null;
      at = next;
    }
    loops.push(loop);
  }
  // (Loops run as the faces' outer loops did: the other way round, a hole — in the outer loop it lies in.)
  const area = (P: readonly XY[]) => P.reduce((A, p, i) => A + p[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * p[1], 0) / 2;
  const sign = Math.sign(area(faces[0].outer)), outers = loops.filter(l => Math.sign(area(l)) === sign), holes = loops.filter(l => Math.sign(area(l)) !== sign);
  const within = (X: XY, P: readonly XY[]) => { let w = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > X[1]) !== (P[j][1] > X[1]) && X[0] < (P[j][0] - P[i][0]) * (X[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) w = !w; return w; };
  return outers.map(outer => ({ k: faces[0].k, outer, holes: holes.filter(h => within(h[0], outer)) }));
}
/** Whether segment A–B (in the plane's (a, b)) lies on an edge of a landing face's loops. */
function onLandingEdge(A: XY, B: XY, f: Landing): boolean {
  const tol = 1e-6;
  for (const P of [f.outer, ...f.holes]) for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const off = (X: XY) => Math.abs((q[0] - p[0]) * (X[1] - p[1]) - (q[1] - p[1]) * (X[0] - p[0])) / l, along = (X: XY) => ((X[0] - p[0]) * (q[0] - p[0]) + (X[1] - p[1]) * (q[1] - p[1])) / l;
    if (off(A) < tol && off(B) < tol && [A, B].every(X => along(X) >= -tol && along(X) <= l + tol)) return true;
  }
  return false;
}
/** The parts of a loop's straight sides (in the plane's (a, b)) lying on a landing face's edge: flush, no fillet there (mm). */
function flushLength(loop: readonly ProfileSegmentInput[], toPlane: (p: XY) => XY, faces: readonly Landing[]): number {
  let flush = 0;
  for (let i = 0; i < loop.length; i++) {
    const g = loop[i];
    if (g.kind !== 'line') continue;
    const A = toPlane(g.start), B = toPlane(loop[(i + 1) % loop.length].start);
    if (faces.some(f => onLandingEdge(A, B, f))) flush += Math.hypot(B[0] - A[0], B[1] - A[1]);
  }
  return flush;
}
/** Whether point X lies inside (or on) a convex loop. */
function inConvex(X: XY, P: readonly XY[]): boolean {
  let sign = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], c = (q[0] - p[0]) * (X[1] - p[1]) - (q[1] - p[1]) * (X[0] - p[0]);
    if (Math.abs(c) <= 1e-9 * Math.max(1, Math.hypot(q[0] - p[0], q[1] - p[1]))) continue;
    if (sign && Math.sign(c) !== sign) return false;
    sign = Math.sign(c);
  }
  return true;
}
const convexLoop = (P: readonly XY[]): boolean => P.every((_, i) => inConvex(P[(i + 2) % P.length], P)) && P.length >= 3;
/** A B-rep with every id prefixed (and every reference to one), so several can be merged into one as bodies of their own. */
function prefixedIds(b: Brep, p: string): Brep {
  const r = (x: string) => p + x;
  return { ...b, bodies: b.bodies.map(x => ({ ...x, id: r(x.id), shells: x.shells.map(r) })), shells: b.shells.map(x => ({ ...x, id: r(x.id), body: r(x.body), faces: x.faces.map(r) })),
    faces: b.faces.map(x => ({ ...x, id: r(x.id), shell: r(x.shell), loops: x.loops.map(r) })), loops: b.loops.map(x => ({ ...x, id: r(x.id), face: r(x.face), coedges: x.coedges.map(r) })),
    coedges: b.coedges.map(x => ({ ...x, id: r(x.id), edge: r(x.edge), loop: r(x.loop), next: r(x.next), prev: r(x.prev), twin: x.twin === null ? null : r(x.twin) })),
    edges: b.edges.map(x => ({ ...x, id: r(x.id), vertices: [r(x.vertices[0]), r(x.vertices[1])] as const })), vertices: b.vertices.map(x => ({ ...x, id: r(x.id) })) };
}
/** A loop in an end's own frame: as it is at an end; its x and y swapped at a start (so the axis turns and the frame stays right-handed). */
function endLoop(loop: readonly ProfileSegmentInput[], end: 0 | 1): ProfileSegmentInput[] {
  if (end) return [...loop];
  return loop.map(g => g.kind === 'line' ? { kind: 'line', start: [g.start[1], g.start[0]] as XY } : { kind: 'arc', start: [g.start[1], g.start[0]] as XY, center: [g.center[1], g.center[0]] as XY, direction: g.direction === 'ccw' ? 'cw' : 'ccw' });
}
/** Whether a member's section box offset by z, in the end's plane (a, b) from E, lies within one convex landing face (no clipping needed). */
function landsWithin(P: MemberPlace, E: Point, a: Point, b: Point, z: number, f: Landing): boolean {
  if (f.holes.length || !convexLoop(f.outer)) return false;
  const pts = boxCorners(P, E).map(v => [dot(sub(v, E), a), dot(sub(v, E), b)] as XY);
  const lo = [Math.min(...pts.map(p => p[0])) - z, Math.min(...pts.map(p => p[1])) - z], hi = [Math.max(...pts.map(p => p[0])) + z, Math.max(...pts.map(p => p[1])) + z];
  return ([[lo[0], lo[1]], [hi[0], lo[1]], [hi[0], hi[1]], [lo[0], hi[1]]] as XY[]).every(X => inConvex(X, f.outer));
}
/** An ordered trim's complete end from its actual cutter faces, never from its nominal joint point. */
function orderedBeadPlane(part: Part, e: FrameEndReport, out: Point, where: string, fail: Tools['fail']): { origin: Point; normal: Point } {
  const refuse = (): never => fail('PARAMETER', `[BEAD_SEAM_NOT_PLANAR] ${where} is trimmed to an envelope or a body: its complete seam is not one plane's loop`);
  if (!e.rank || !e.against?.length) return refuse();
  const at = part.memberPlace!.at, frameAt = at.slice(0, at.lastIndexOf('.m')), brep = brepOf(part, at.replace(/\./g, '_'));
  // Envelope faces keep their producer's name through the ordered Boolean cuts (FR3b).
  const named = (name: string | undefined, prefix: string) => name === prefix || name?.startsWith(`${prefix}#`) === true;
  const caps = brep.faces.filter(f => e.against!.some(k => named(f.name, `${frameAt}_env${k}`)));
  // A surviving run-on cap means only part of the section reached the cutters: no full end plane.
  if (!caps.length || brep.faces.some(f => named(f.name, `${at}.${e.end}`))) return refuse();
  const planes = caps.map(f => planar(nurbsOf(f)));
  if (planes.some(p => !p)) return refuse();
  const first = planes[0]!, normal = scale(first.normal, caps[0].sense === 'forward' ? 1 : -1);
  if (planes.some(p => len(cross(p!.normal, normal)) > 1e-9 || Math.abs(dot(sub(p!.origin, first.origin), normal)) > MEMBER_MIN_MM)) return refuse();
  const angle = Math.atan2(len(cross(normal, out)), dot(normal, out)) * 180 / Math.PI;
  if (angle > 1e-9) fail('PARAMETER', `[BEAD_ANGLE] ${where} meets its face at ${+angle.toFixed(6)}° from square: fillets on oblique ends are not modelled yet`);
  return { origin: first.origin, normal };
}
// ---- shared endpoint bead ownership (D170) ------------------------------------------------------------
export type EndpointBead = Extract<CadPartFeature, { kind: 'weld-bead' }> & { readonly on: BeadJointRef };
export function isEndpointBead(f: CadPartFeature): f is EndpointBead {
  const on: unknown = f.kind === 'weld-bead' ? f.on : undefined;
  return isRecord(on) && Number.isInteger(on.member) && (on.end === 'start' || on.end === 'end');
}
const jointOrder = (a: BeadJointRef, b: BeadJointRef) => a.member - b.member || (a.end === b.end ? 0 : a.end === 'start' ? -1 : 1);
const jointKey = (j: BeadJointRef) => `${j.member}:${j.end}`;
/** Peer edits invalidate an owned result even when its own authored feature has not changed. */
export function endpointContext(features: readonly CadPartFeature[], frame: string, parameters: Readonly<Record<string, number>>): unknown {
  return features.filter((f): f is EndpointBead => isEndpointBead(f) && f.frame === frame).sort((a, b) => jointOrder(a.on, b.on) || a.id.localeCompare(b.id)).map(f => [f.id, resolvedDefinition(f, parameters)]);
}
type BeadEndGeometry = { readonly edges: readonly Brep['edges'][number][]; readonly out: Point; readonly axes: readonly [Point, Point, Point] };
type BeadCandidate = { readonly feature: EndpointBead; readonly joint: BeadJointRef; readonly part?: Part; readonly end?: BeadEndGeometry; readonly leg?: number; readonly nominal?: Part; readonly error?: CadPartError };
type SharedBeadPair = { readonly a: number; readonly b: number; readonly runs: readonly (readonly [Point, Point])[]; readonly overlap?: Brep; readonly uncertain: boolean };
function beadDimension(v: unknown, parameters: Readonly<Record<string, number>>, at: string): number {
  let x = v;
  if (isRecord(v)) {
    if (typeof v.parameter !== 'string' || !Object.hasOwn(parameters, v.parameter)) throw new CadPartError('PARAMETER', at, 'leg: unknown parameter');
    x = parameters[v.parameter];
  }
  if (typeof x !== 'number' || !Number.isFinite(x) || !(x > 0) || x > CadPartLimits.length) throw new CadPartError('PARAMETER', at, 'leg must be a finite positive length within 10000 mm');
  return x;
}
/** Actual end faces, including an unsupported ordered/curved end, provide the boundary for refusal discovery. */
function beadEndGeometry(part: Part, joint: BeadJointRef): BeadEndGeometry {
  const P = part.memberPlace!.place, start = part.member!.start as Point, e = part.member!.ends?.find(x => x.end === joint.end);
  const out = scale(P.u, joint.end === 'end' ? 1 : -1), at = part.memberPlace!.at, b = brepOf(part, at.replace(/\./g, '_'));
  const frameAt = at.slice(0, at.lastIndexOf('.m')), named = (name: string | undefined, prefix: string) => name === prefix || name?.startsWith(`${prefix}#`) === true;
  const origin = e?.plane?.origin as Point | undefined ?? add(start, scale(P.u, joint.end === 'end' ? part.memberPlace!.lengthMM + part.memberPlace!.extend[1] : -part.memberPlace!.extend[0]));
  const faces = b.faces.filter(f => {
    if (e?.rank && e.against?.some(k => named(f.name, `${frameAt}_env${k}`))) return true;
    if (named(f.name, `${at}.${joint.end}`) || named(f.name, `${at}.${joint.end}.butt`)) return true;
    if (!e?.plane) return false;
    const p = planar(nurbsOf(f));
    return !!p && len(cross(p.normal, e.plane.normal as Point)) <= 1e-9 && Math.abs(dot(sub(p.origin, origin), e.plane.normal as Point)) <= MEMBER_MIN_MM;
  });
  const loops = new Set(faces.flatMap(f => f.loops)), coedges = b.coedges.filter(c => loops.has(c.loop)), edges = new Set(coedges.map(c => c.edge));
  return { edges: b.edges.filter(x => edges.has(x.id)), out, axes: [P.F.x, P.F.y, P.u] };
}
function beadStraightEdge(edge: Brep['edges'][number]): readonly [Point, Point] | null {
  // A rational linear curve is straight regardless of its parametrisation; higher-degree curves are not admitted.
  const c = edge.curve;
  if (c.degree !== 1 || c.controlPoints.length !== 2) return null;
  const [lo, hi] = curveDomain(c);
  return [evaluateCurve(c, lo), evaluateCurve(c, hi)];
}
/** Collinear overlap of actual boundary edges; touching at a point is not a seam. */
function commonBeadRuns(a: BeadEndGeometry, b: BeadEndGeometry): (readonly [Point, Point])[] {
  const runs: [Point, Point][] = [];
  for (const ea of a.edges) for (const eb of b.edges) {
    const A = beadStraightEdge(ea), B = beadStraightEdge(eb);
    if (!A || !B) continue;
    const d = unit(sub(A[1], A[0])), L = len(sub(A[1], A[0]));
    if (len(cross(sub(B[0], A[0]), d)) > MEMBER_MIN_MM || len(cross(sub(B[1], A[0]), d)) > MEMBER_MIN_MM) continue;
    const t = B.map(p => dot(sub(p, A[0]), d)), lo = Math.max(0, Math.min(...t)), hi = Math.min(L, Math.max(...t));
    if (hi - lo > MEMBER_MIN_MM) runs.push([add(A[0], scale(d, lo)), add(A[0], scale(d, hi))]);
  }
  // Coalesce split edges and duplicate coedges on one run, but never bridge a gap.
  const merged: [Point, Point][] = [];
  for (const run of runs) {
    let current = run;
    for (let i = 0; i < merged.length;) {
      const p = merged[i], d = unit(sub(current[1], current[0])), L = len(sub(current[1], current[0]));
      const t = p.map(x => dot(sub(x, current[0]), d));
      if (p.every(x => len(cross(sub(x, current[0]), d)) <= MEMBER_MIN_MM) && Math.max(...t) >= -MEMBER_MIN_MM && Math.min(...t) <= L + MEMBER_MIN_MM) {
        const O = current[0]; current = [add(O, scale(d, Math.min(0, ...t))), add(O, scale(d, Math.max(L, ...t)))]; merged.splice(i, 1); i = 0;
      } else i++;
    }
    merged.push(current);
  }
  return merged;
}
function beadBoxesApart(a: Brep, b: Brep): boolean {
  const box = (r: Brep) => { const points = r.faces.flatMap(f => nurbsOf(f).controlPoints.flat()); return [0, 1, 2].map(k => [Math.min(...points.map(p => p[k])), Math.max(...points.map(p => p[k]))]); };
  const A = box(a), B = box(b);
  return A.some((p, k) => p[1] <= B[k][0] + 1e-9 || B[k][1] <= p[0] + 1e-9);
}
/** A manifest describes declared endpoints of this frame, never the discovered components. */
function beadManifestProblem(f: EndpointBead, candidates: readonly BeadCandidate[], parameters: Readonly<Record<string, number>>): string | null {
  const s: unknown = f.sharing;
  if (!isRecord(s) || Object.keys(s).some(k => !['version', 'policy', 'joints'].includes(k)) || s.version !== 1 || s.policy !== 'equal-length' || !Array.isArray(s.joints)) return 'give sharing version 1, equal-length policy and the complete frame endpoint manifest';
  const expected = new Map(candidates.map(c => [jointKey(c.joint), c])), seen = new Set<string>();
  for (const j of Array.from(s.joints) as unknown[]) {
    if (!isRecord(j) || Object.keys(j).some(k => !['member', 'end', 'leg'].includes(k)) || !Number.isInteger(j.member) || (j.end !== 'start' && j.end !== 'end')) return 'each manifest joint must give member, end and leg';
    const key = jointKey(j as unknown as BeadJointRef), actual = expected.get(key);
    if (seen.has(key)) return 'the frame manifest repeats a joint';
    seen.add(key);
    if (!actual) return 'a manifest joint has no declared endpoint bead';
    let declared: number;
    try { declared = beadDimension(actual.feature.leg, parameters, actual.feature.id); }
    catch {
      // An invalid declared leg belongs to its actual component. A faithful frame manifest must not
      // turn that one intrinsic error into a refusal of every independent component in this frame.
      if (JSON.stringify(j.leg) !== JSON.stringify(actual.feature.leg)) return 'an invalid manifest leg differs from its declared endpoint bead';
      continue;
    }
    try { if (beadDimension(j.leg, parameters, f.id) !== declared) return 'manifest leg differs from the declared endpoint bead'; }
    catch { return 'a manifest leg is unresolved or invalid'; }
  }
  return seen.size !== expected.size ? 'the frame manifest omits a declared endpoint bead' : null;
}
/** Prove the one supported shared shape from the actual overlap, not from a nominal endpoint or a volume fraction. */
function sharedBeadPath(a: BeadCandidate, b: BeadCandidate, pair: SharedBeadPair): readonly [Point, Point] | null {
  if (!a.end || !b.end || !a.part || !b.part || a.leg !== b.leg || a.feature.inner || b.feature.inner || pair.uncertain || !pair.overlap || pair.overlap.bodies.length !== 1 || pair.runs.length !== 1) return null;
  if ([a, b].some(c => [c.part!.memberPlace!.place.shape.outer, ...c.part!.memberPlace!.place.shape.holes].some(loop => loop.some(g => g.kind !== 'line')))) return null;
  const A = a.end, B = b.end, z = a.leg!;
  if (Math.abs(dot(A.out, B.out)) > 1e-9 || !pair.overlap.faces.every(f => !!planar(nurbsOf(f)))) return null;
  const along = (p: Point) => A.axes.map(d => dot(sub(p, a.part!.member!.start as Point), d));
  let [p, q] = pair.runs[0];
  const x = along(p), y = along(q), first = x.findIndex((v, k) => Math.abs(v - y[k]) > MEMBER_MIN_MM);
  if (first < 0) return null;
  if (x[first] > y[first]) [p, q] = [q, p];
  const direction = unit(sub(q, p));
  if (Math.abs(dot(direction, A.out)) > 1e-9 || Math.abs(dot(direction, B.out)) > 1e-9) return null;
  // The shared run must cover both complete authored end-boundary runs. A shorter overlap is not V1.
  for (const end of [A, B]) {
    const intervals = end.edges.map(beadStraightEdge).filter((e): e is readonly [Point, Point] => !!e && e.every(v => len(cross(sub(v, p), direction)) <= MEMBER_MIN_MM)).map(e => e.map(v => dot(sub(v, p), direction)));
    if (!intervals.length || Math.abs(Math.min(...intervals.flat())) > MEMBER_MIN_MM || Math.abs(Math.max(...intervals.flat()) - len(sub(q, p))) > MEMBER_MIN_MM) return null;
  }
  const expected = [p, add(p, scale(A.out, -z)), add(p, scale(B.out, -z)), q, add(q, scale(A.out, -z)), add(q, scale(B.out, -z))];
  const vertices = pair.overlap.vertices.map(v => v.point);
  // All six corners and only points on their straight edges: no partial triangular coverage or second run.
  const onEdge = (v: Point) => expected.some((u, i) => expected.some((w, j) => {
    if (j <= i || !((i < 3 && j < 3) || (i >= 3 && j >= 3) || j === i + 3)) return false;
    const d = sub(w, u), t = dot(sub(v, u), d) / dot(d, d);
    return t >= -1e-9 && t <= 1 + 1e-9 && len(sub(v, add(u, scale(d, t)))) <= MEMBER_MIN_MM;
  }));
  if (!expected.every(u => vertices.some(v => len(sub(v, u)) <= MEMBER_MIN_MM)) || !vertices.every(onEdge)) return null;
  const V = brepMassProperties(pair.overlap, 1).volume, want = len(sub(q, p)) * z * z / 2;
  if (Math.abs(V - want) > 1e-9 * Math.max(1, want)) return null;
  return [p, q];
}
/** Keep exclusive material intact and split only native bodies containing the shared prism. */
function ownedEndpointBead(candidate: BeadCandidate, overlap: Brep, seam: Omit<BeadSharedSeam, 'ownedSharedVolume'>): Result {
  const nominal = candidate.nominal!, brep = brepOf(nominal, candidate.feature.id), [p, q] = seam.path as readonly [Point, Point];
  const n = unit(sub(q, p)), midpoint = scale(add(p, q), 0.5), x = candidate.end!.out, y = cross(n, x), below = seam.ownedInterval[0] === 0;
  const R = Math.max(1, ...brep.vertices.map(v => len(sub(v.point, midpoint)))) + 1, id = candidate.feature.id.replace(/\./g, '_');
  const half = obliqueHalf(midpoint, n, x, y, R, !below, `${id}_ownership`);
  const unowned = boolean({ kind: 'brep', brep: overlap }, half, 'intersection', `${id}_unowned`);
  const removed = volumeOfSolid(unowned), ownedSharedVolume = brepMassProperties(overlap, 1).volume - removed;
  const parts = splitBodies(brep).map((body, i) => {
    const shared = booleanAnalytic(body, overlap, 'intersection', { id: `${id}_shared${i}` });
    if (!shared.bodies.length) return prefixedIds(body, `exclusive${i}:`);
    const kept = boolean({ kind: 'brep', brep: body }, unowned, 'difference', `${id}_owned${i}`);
    return prefixedIds(brepOf({ solid: kept }, `${id}_owned${i}`), `owned${i}:`);
  });
  const owned = mergeBreps(parts, { family: 'weld-bead', id }), volumeMM3 = brepMassProperties(owned, 1).volume;
  if (Math.abs(volumeMM3 - (nominal.bead!.nominalVolume - removed)) > 1e-9 * Math.max(1, volumeMM3)) throw new CadPartError('GEOMETRY', candidate.feature.id, 'owned partition did not preserve exclusive material');
  return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: owned }, bead: { ...nominal.bead!, volume: volumeMM3, sharedSeams: [{ ...seam, ownedSharedVolume: ownedSharedVolume }] } }] };
}
/** Discover the actual graph first, then plan every component before exposing either participant. */
export function planEndpointBeads(features: readonly CadPartFeature[], byMember: ReadonlyMap<number, Part>, frame: string, parameters: Readonly<Record<string, number>>): Map<string, Result | CadPartError> {
  const candidates: BeadCandidate[] = features.filter((f): f is EndpointBead => isEndpointBead(f) && f.frame === frame).sort((a, b) => jointOrder(a.on, b.on) || a.id.localeCompare(b.id)).map(feature => {
    const joint: BeadJointRef = { member: feature.on.member, end: feature.on.end }, part = byMember.get(joint.member), at = feature.id;
    const fail: Tools['fail'] = (code, detail) => { throw new CadPartError(code, at, detail); };
    let end: BeadEndGeometry | undefined, leg: number | undefined;
    try {
      if (!part || joint.member < 0) fail('REFERENCE', `${frame} has no member ${joint.member}`);
      const jointReport = part!.member?.ends?.find(e => e.end === joint.end);
      if ((jointReport?.gap ?? 0) > 0 || jointReport?.kind === 'notch') fail('PARAMETER', '[BEAD_SEAM_NOT_PLANAR] positive gaps and cutter notches do not admit contact fillets');
      end = beadEndGeometry(part!, joint);
      leg = beadDimension(feature.leg, parameters, at);
      if (feature.inner !== undefined && typeof feature.inner !== 'boolean') fail('INPUT', 'inner must be true or false');
      const result = endBead(byMember, part!, frame, joint.member, joint.end === 'end' ? 1 : 0, leg, feature.inner === true, at, fail) as Extract<Result, { kind: 'solid' }>;
      return { feature, joint, part, end, leg, nominal: result.parts[0] };
    } catch (cause) {
      const error = cause instanceof CadPartError ? cause : new CadPartError('GEOMETRY', at, cause instanceof Error ? cause.message : String(cause));
      return { feature, joint, part, end, leg, error };
    }
  });
  const pairs: SharedBeadPair[] = [], neighbours = candidates.map(() => new Set<number>());
  for (let a = 0; a < candidates.length; a++) for (let b = a + 1; b < candidates.length; b++) {
    const A = candidates[a], B = candidates[b], runs = A.end && B.end ? commonBeadRuns(A.end, B.end) : [];
    let overlap: Brep | undefined, uncertain = false;
    if (A.nominal && B.nominal) {
      const ab = brepOf(A.nominal, A.feature.id), bb = brepOf(B.nominal, B.feature.id);
      if (!beadBoxesApart(ab, bb)) {
        try { const r = booleanAnalytic(ab, bb, 'intersection', { id: `shared_${a}_${b}` }); if (r.bodies.length) overlap = r; }
        catch (cause) {
          if (!(cause instanceof BrepError)) throw cause;
          if (!runs.length) throw new CadPartError('PARAMETER', A.feature.id, `[BEAD_SHARED_UNSUPPORTED] overlap failed without a proved boundary component: ${cause.message}`);
          uncertain = true;
        }
      }
    } else uncertain = runs.length > 0;
    if (overlap || uncertain || jointKey(A.joint) === jointKey(B.joint)) {
      pairs.push({ a, b, runs, overlap, uncertain }); neighbours[a].add(b); neighbours[b].add(a);
    }
  }
  const plan = new Map<string, Result | CadPartError>(), visited = new Set<number>();
  for (let start = 0; start < candidates.length; start++) {
    if (visited.has(start)) continue;
    const component = [start]; visited.add(start);
    for (let k = 0; k < component.length; k++) for (const next of neighbours[component[k]]) if (!visited.has(next)) { visited.add(next); component.push(next); }
    component.sort((a, b) => jointOrder(candidates[a].joint, candidates[b].joint));
    const group = component.map(k => candidates[k]), shared = component.length > 1;
    const joints = [...new Map(group.map(c => [jointKey(c.joint), c.joint])).values()], sharedComponent: BeadSharedComponent | undefined = shared ? { frame, joints } : undefined;
    const refuse = (tag: 'BEAD_SHARED_CONTEXT' | 'BEAD_SHARED_UNSUPPORTED', detail: string) => {
      for (const c of group) plan.set(c.feature.id, new CadPartError('PARAMETER', c.feature.id, `[${tag}] ${detail}`, sharedComponent));
    };
    const problem = group.map(c => c.feature.sharing !== undefined || shared ? beadManifestProblem(c.feature, candidates, parameters) : null).find(Boolean);
    if (problem) { refuse('BEAD_SHARED_CONTEXT', problem); continue; }
    if (shared && group.some(c => Object.keys(c.feature.on).some(k => k !== 'member' && k !== 'end'))) { refuse('BEAD_SHARED_CONTEXT', 'endpoint flags are inconsistent with the manifest'); continue; }
    if (shared && (group.length !== 2 || joints.length !== 2)) { refuse(joints.length !== group.length ? 'BEAD_SHARED_CONTEXT' : 'BEAD_SHARED_UNSUPPORTED', 'only two distinct endpoint beads on one complete straight seam are supported'); continue; }
    if (shared && group.some(c => c.leg === undefined)) { refuse('BEAD_SHARED_CONTEXT', 'a declared participant leg is unresolved or invalid'); continue; }
    const error = group.find(c => c.error)?.error;
    if (error) {
      for (const c of group) plan.set(c.feature.id, shared ? new CadPartError('PARAMETER', c.feature.id, `[BEAD_SHARED_UNSUPPORTED] ${error.message}`, sharedComponent) : error);
      continue;
    }
    if (!shared) { const c = group[0]; plan.set(c.feature.id, { kind: 'solid', parts: [c.nominal!] }); continue; }
    const pair = pairs.find(p => p.a === component[0] && p.b === component[1])!, [a, b] = group;
    try {
      const path = sharedBeadPath(a, b, pair);
      if (!path) { refuse('BEAD_SHARED_UNSUPPORTED', 'requires equal legs, outer sharp square ends and one complete straight triangular shared prism'); continue; }
      const lengthMM = len(sub(path[1], path[0])), nominalSharedVolume = brepMassProperties(pair.overlap!, 1).volume;
      const id = JSON.stringify(['shared-seam-v1', frame, joints]), refs = joints as [BeadJointRef, BeadJointRef];
      // Commit both planned results together. A partition error leaves neither nominal participant available.
      const results = group.map((c, i) => ownedEndpointBead(c, pair.overlap!, { id, joints: refs, path: path, length: lengthMM, ownedInterval: i === 0 ? [0, 0.5] : [0.5, 1], nominalSharedVolume: nominalSharedVolume }));
      group.forEach((c, i) => plan.set(c.feature.id, results[i]));
    } catch (cause) {
      refuse('BEAD_SHARED_UNSUPPORTED', `owned B-rep partition failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  return plan;
}

/**
 * A fillet bead on a member's end landing square on other members' flat faces (FRk2, D166): the end's outer loop offset
 * by the leg, drafted 45° back along the member, less its envelope, kept on the faces it lands on; with `inner`, the
 * bore's fillet too. Refused: a mitre (`BEAD_KIND`: a groove weld's seam only), an end that is no plane
 * (`BEAD_SEAM_NOT_PLANAR`), an end at an angle to its face (`BEAD_ANGLE`), landing on no member (`BEAD_KIND`), a leg
 * larger than a concave round or the bore's rounds allow (`BEAD_SIZE`).
 */
function endBead(byMember: ReadonlyMap<number, Part>, part: Part, frame: string, k: number, end: 0 | 1, z: number, inner: boolean, at: string, fail: Tools['fail']): Result {
  const { place: P, lengthMM: L, extend } = part.memberPlace!, report = part.member!, e = report.ends?.find(x => x.end === endName(end)), where = `member ${k}'s ${endName(end)}`;
  if ((e?.gap ?? 0) > 0 || e?.kind === 'notch') fail('PARAMETER', `[BEAD_SEAM_NOT_PLANAR] ${where} has a positive gap or cutter notch: contact fillets are not supported`);
  if (e?.kind === 'mitre') fail('PARAMETER', `[BEAD_KIND] ${where} is mitred: a mitre takes a groove weld (its seam only), not a fillet`);
  if (e?.kind === 'cope') fail('PARAMETER', `[BEAD_SEAM_NOT_PLANAR] ${where} is coped: its seam is no plane's loop`);
  if (e?.angle !== undefined && Math.abs(e.angle) > 1e-9) fail('PARAMETER', `[BEAD_ANGLE] ${where} meets its face at ${+e.angle.toFixed(6)}° from square: fillets on oblique ends are not modelled yet`);
  const out = end ? P.u : scale(P.u, -1), plane = e?.plane ?? (e?.kind === 'trim' ? orderedBeadPlane(part, e, out, where, fail) : undefined);
  const start = report.start as unknown as Point, zE = plane ? dot(sub(plane.origin as Point, start), P.u) : end ? L + extend[1] : -extend[0];
  const E = add(start, scale(P.u, zE));
  let faces = landingFaces(byMember, k, E, out, P.F.x, P.F.y, at);
  {
    // (Only the faces under its footprint: the section's box offset by the leg.)
    const pts = boxCorners(P, E).map(v => [dot(sub(v, E), P.F.x), dot(sub(v, E), P.F.y)]), lo = [Math.min(...pts.map(p => p[0])) - z, Math.min(...pts.map(p => p[1])) - z], hi = [Math.max(...pts.map(p => p[0])) + z, Math.max(...pts.map(p => p[1])) + z];
    const overlaps = (f: Landing) => { const xs = f.outer.map(p => p[0]), ys = f.outer.map(p => p[1]); return Math.min(...xs) < hi[0] - 1e-9 && Math.max(...xs) > lo[0] + 1e-9 && Math.min(...ys) < hi[1] - 1e-9 && Math.max(...ys) > lo[1] + 1e-9; };
    faces = faces.filter(overlaps);
  }
  if (!faces.length) fail('PARAMETER', `[BEAD_KIND] ${where} lands on no member's flat face of ${frame}: nothing to weld it to`);
  // The end's own frame: the section's x and y (swapped at a start), W out of the end; the end's plane at zP.
  const X = end ? P.F.x : P.F.y, Y = end ? P.F.y : P.F.x, o = sectionPoint(P.F, -P.q[0], -P.q[1], start), zP = end ? zE : -zE, id = at.replace(/\./g, '_');
  const drafted = (loop: readonly ProfileSegmentInput[], draft: number, tag: string): Solid => {
    try { return placedSolid({ kind: 'brep', brep: draftedExtrusion({ profile: endLoop(loop, end), z0: zP - z, z1: zP, draft: draft, tag, id: tag.replace(/\./g, '_') }) }, X, Y, out, o); }
    catch (cause) { if (cause instanceof BrepError) return fail('PARAMETER', `[BEAD_SIZE] ${where}: a leg of ${z} mm does not fit its ${draft < 0 ? 'outline' : 'bore'} (a concave round or the bore's rounds under the leg)`); throw cause; }
  };
  const prism = (loop: readonly ProfileSegmentInput[], from: number, h: number, tag: string): Solid => placedSolid({ kind: 'upright', solid: prismaticFromProfile({ outer: endLoop(loop, end), height: h, from: from, tag }) }, X, Y, out, o);
  let bead = boolean(drafted(P.shape.outer, -45, `${at}.fillet`), prism(P.shape.outer, zP - z - 1, z + 1, `${at}.on.m${k}`), 'difference', id);
  if (inner) {
    if (P.shape.holes.length !== 1) fail('PARAMETER', `[BEAD_KIND] ${where}: its section has ${P.shape.holes.length ? `${P.shape.holes.length} bores` : 'no bore'}: no inner fillet to weld`);
    bead = boolean(bead, boolean(prism(P.shape.holes[0], zP - z, z, `${at}.bore`), drafted(P.shape.holes[0], 45, `${at}.inner`), 'difference', id), 'union', id);
  }
  // Kept on the faces it lands on: past a face's flat (a flush side), no fillet.
  if (!faces.some(f => landsWithin(P, E, P.F.x, P.F.y, z, f))) {
    const merged = faces.length > 1 ? mergedLandings(faces) : null, slabs = merged ?? faces, base = bead;
    try {
      let slab = landingSlab(slabs[0], P.F.x, P.F.y, E, out, z + 1, `${at}.cut`);
      for (let i = 1; i < slabs.length; i++) slab = boolean(slab, landingSlab(slabs[i], P.F.x, P.F.y, E, out, z + 1, `${at}.cut`), 'union', id);
      bead = boolean(base, slab, 'intersection', id);
    } catch (cause) {
      if (!(cause instanceof CadPartError || cause instanceof BrepError) || faces.length < 2) throw cause;
      // (Two fillets meeting only along a line — an end's corner at the faces' inside corner — are no one solid: each
      // face's piece is a body of its own.)
      const pieces = faces.map((f, i) => boolean(base, landingSlab(f, P.F.x, P.F.y, E, out, z + 1, `${at}.cut`), 'intersection', `${id}_p${i}`)).filter(q => !empty(q));
      bead = { kind: 'brep', brep: mergeBreps(pieces.map((q, i) => prefixedIds(transformBrep(brepOf({ solid: q }, `${id}_p${i}`), { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, n => `${n}#${i + 1}`), `p${i}:`)), { family: 'weld-bead', id }) };
    }
  }
  if (empty(bead)) fail('PARAMETER', `[BEAD_SIZE] ${where}: no fillet is left on the faces it lands on`);
  const flush = flushLength(P.shape.outer, q => [q[0] - P.q[0], q[1] - P.q[1]], (faces.length > 1 ? mergedLandings(faces) : null) ?? faces);
  const perimeter = loopPerimeter(P.shape.outer) + (inner ? loopPerimeter(P.shape.holes[0]) : 0);
  const bead_: BeadReport = { frame, on: { member: k, end: endName(end) }, kind: 'fillet', leg: z, throat: z / Math.SQRT2, meets: [...new Set(faces.map(f => f.k))], seam: { length: perimeter, flush: flush, exact: true, ...(inner ? { inner: true as const } : {}) }, volume: volumeOfSolid(bead), nominalVolume: volumeOfSolid(bead), sharedSeams: [], corner: 'mitred' };
  return { kind: 'solid', parts: [{ solid: bead, bead: bead_ }] };
}
/**
 * The fillets along a gusset's two seams, on both its faces (FRk2, D166): each a right triangle of legs z on the
 * member's face and the gusset's, run the seam's length: (l − c)·z² a seam. Refused `BEAD_SIZE` where the clip is under
 * the leg (the corner leaves the fillets no room) or the fillets run off a member's flat face.
 */
function gussetBead(byMember: ReadonlyMap<number, Part>, gp: Part, frame: string, gusset: string, z: number, at: string, fail: Tools['fail']): Result {
  const G = gp.gussetPlace!, [l1, l2] = G.legs, c = G.clip, id = at.replace(/\./g, '_');
  if (c < z - 1e-9) fail('PARAMETER', `[BEAD_SIZE] gusset ${gusset}'s clip ${c} is under the leg ${z}: the corner leaves its fillets no room`);
  const lo = G.offset - G.t / 2 - z, hi = G.offset + G.t / 2 + z;
  for (let i = 0; i < 2; i++) {
    // (Each member's face under the gusset and its fillets: flat across their whole width.)
    const m = G.members[i];
    try { gussetSide({ k: m, away: i ? G.ub : G.ua, reach: Infinity, part: byMember.get(m)! }, i ? G.wb : G.ey, G.n, lo, hi, fail); }
    catch (cause) { if (cause instanceof CadPartError) fail('PARAMETER', `[BEAD_SIZE] gusset ${gusset}'s fillets run off member ${m}'s flat face (${z} mm each side of its ${G.t} mm)`); throw cause; }
  }
  const corner = add(G.p, add(scale(G.ua, G.xV), scale(G.ey, G.yV)));
  // Seam A from c to l1 along member A's face (into the gusset: ey); seam B from c to l2 along B's (into it: wb).
  const seams: readonly [Point, Point, Point, number][] = [[add(corner, scale(G.ua, c)), G.ua, G.ey, l1 - c], [add(corner, scale(G.ub, c)), G.ub, G.wb, l2 - c]];
  let bead: Solid | null = null;
  for (let i = 0; i < 2; i++) {
    const [S0, sdir, d, L] = seams[i], m = cross(sdir, d);
    for (const side of [1, -1]) {
      const B0 = add(S0, scale(G.n, G.offset + side * G.t / 2)), tri = [B0, add(B0, scale(G.n, side * z)), add(B0, scale(d, z))];
      const outer: ProfileSegmentInput[] = tri.map(Q => ({ kind: 'line', start: [dot(sub(Q, S0), d), dot(sub(Q, S0), m)] as XY }));
      const piece = placedSolid({ kind: 'upright', solid: prismaticFromProfile({ outer, height: L, from: 0, tag: `${at}.m${G.members[i]}.${side > 0 ? 'front' : 'back'}` }) }, d, m, sdir, S0);
      bead = bead ? boolean(bead, piece, 'union', id) : piece;
    }
  }
  const length = 2 * (l1 - c) + 2 * (l2 - c);
  const bead_: BeadReport = { frame, on: { gusset }, kind: 'fillet', leg: z, throat: z / Math.SQRT2, meets: [...G.members], seam: { length: length, flush: 0, exact: true }, volume: length * z * z / 2, nominalVolume: length * z * z / 2, sharedSeams: [], corner: 'mitred' };
  return { kind: 'solid', parts: [{ solid: bead!, bead: bead_ }] };
}
