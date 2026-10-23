// R5.3 (D227): the part model's frame and weldment features — members, frames, gussets, end caps and weld beads —
// moved out of part-model.ts's operation() as they were there. The frame helpers stay in part-model.ts (they build on
// its Boolean, which the coverage trap pins there) and come in the helpers. The dispatcher calls `frameOperation`.
import { add, cross, dot, len, scale, sub, unit } from '../vec3.js';
import type { CadPartPoint3, Part, Result, CadPartFeature, Tools, PartHelpers } from './part-model.js';

/** A frame or weldment feature's evaluation (part-model.ts's operation() for these kinds). */
export function frameOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result {
  const { dim, xyz, integer, ref, fail, at } = t;
  const { isRecord, CadPartLimits, FRAME_MAX_MEMBERS, MEMBER_MIN_MM, buildCurvedMember, buildMember, canonicalPoint, emptyPlan, endBead, endCapOf, endName, frameCorners, frameCurvePaths, frameTrims, gussetBead, gussetOf, isEndpointBead, memberLook, memberShape, memberUp, mitre, placeMember, planCorners, planTrims, rotateAround, skeletonClash } = k;
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
              for (const E of ends) plan.report[E.member].push({ end: endName(E.end), point, kind: 'mitre', with: E === A ? B.member : A.member, angleDegrees: 0, plane: { origin: points[point], normal: E.inward } });
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
