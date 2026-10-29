// CG1.1d: admit a positive homothety of one simple line/arc loop, then reuse the legacy
// exact ruled loft in a rigid common frame. There is no second loft or mass solver here.
import { BrepError } from '../brep/brep-core.js';
import { buildProfileLoop, type ProfileSegmentInput } from './extruded-profile-solid.js';
import { admitLoftGuide, type LoftGuideFactory, type LoftLegacyBuilder } from './loft-guide.js';
import { admitLoftCommonFrame, loftFrameOffset, loftFramePoint, loftFrameVector, placeLoftInFrame, type LoftFrameBasis } from './loft-common-frame.js';
import type { LoftInput } from './loft.js';
import type { Point } from '../types.js';

type XY = [number, number];
const fail = (detail: string): never => { throw new BrepError('INPUT', `loft: framed mixed curves ${detail}`); };

export function framedMixedLoftSolid(input: LoftInput, frames: readonly LoftFrameBasis[], legacy: LoftLegacyBuilder) {
  const [a, b] = frames, common = admitLoftCommonFrame(frames, fail), n = common.n;
  const { shift, height } = loftFrameOffset(common, b.origin, fail, 'loft: framed mixed curves need positive plane separation');

  const profiles = input.sections.map(s => {
    if (!Array.isArray(s.profile)) return fail('need line/arc profile arrays on both sections');
    const p = s.profile as readonly ProfileSegmentInput[];
    if (!p.some(g => g.kind === 'line') || !p.some(g => g.kind === 'arc')) return fail('need both lines and arcs on each section');
    return p;
  });
  const loops = profiles.map(p => buildProfileLoop(p)), [lo, hi] = profiles;
  if (lo.length !== hi.length || lo.some((s, i) => s.kind !== hi[i].kind)) return fail('need identical segment topology and authored order');
  // Choose the largest authored start displacement as a stable scale witness, then verify
  // every start, arc centre and direction exactly. This is admission, not a best fit.
  let witness = 0, component = 0, extent = 0;
  for (let i = 1; i < lo.length; i++) for (let c = 0; c < 2; c++) {
    const d = Math.abs(lo[i].start[c] - lo[0].start[c]);
    if (d > extent) { extent = d; witness = i; component = c; }
  }
  if (!(extent > 0)) return fail('have no nondegenerate scale witness');
  const scale = (hi[witness].start[component] - hi[0].start[component]) / (lo[witness].start[component] - lo[0].start[component]);
  if (!(Number.isFinite(scale) && scale > 0)) return fail('need a positive finite uniform scale');
  const translation: XY = [hi[0].start[0] - scale * lo[0].start[0], hi[0].start[1] - scale * lo[0].start[1]];
  const matches = (x: XY, y: XY) => x.every((q, c) => scale * q + translation[c] === y[c]);
  for (let i = 0; i < lo.length; i++) {
    const x = lo[i], y = hi[i];
    if (!matches(x.start, y.start)) return fail('are not an exact uniform scale and translation');
    if (x.kind === 'arc' && (y.kind !== 'arc' || x.direction !== y.direction || !matches(x.center, y.center))) return fail('need corresponding arc centres and directions');
    const l = loops[0].segments[i], h = loops[1].segments[i];
    if (l.kind !== h.kind || (l.kind === 'arc' && (h.kind !== 'arc' || l.startAngle !== h.startAngle || l.sweep !== h.sweep))) return fail('have uncertified arc parameter correspondence');
  }
  if (input.sideTags && (input.sideTags.length !== lo.length || input.sideTags.some(t => typeof t !== 'string' || !t.length) || new Set(input.sideTags).size !== lo.length)) return fail('need one unique tag per authored contour segment');

  const move = (p: XY): XY => [p[0] + shift[0], p[1] + shift[1]];
  const upper = hi.map((s): ProfileSegmentInput => s.kind === 'line' ? { kind: 'line', start: move(s.start) } : { kind: 'arc', start: move(s.start), center: move(s.center), direction: s.direction });
  const movedLoop = buildProfileLoop(upper), total: XY = [translation[0] + shift[0], translation[1] + shift[1]];
  const mapped = (x: XY, y: XY) => x.every((q, c) => scale * q + total[c] === y[c]);
  for (let i = 0; i < lo.length; i++) {
    const x = lo[i], y = upper[i], l = loops[0].segments[i], h = movedLoop.segments[i];
    if (!mapped(x.start, y.start) || (x.kind === 'arc' && (y.kind !== 'arc' || !mapped(x.center, y.center)))) return fail('have an uncertified in-plane frame translation');
    if (l.kind !== h.kind || (l.kind === 'arc' && (h.kind !== 'arc' || l.startAngle !== h.startAngle || l.sweep !== h.sweep))) return fail('lose arc correspondence under the frame translation');
  }
  const worldPoint = (p: Point): Point => loftFramePoint(common, p);
  const localVector = (p: Point): Point => loftFrameVector(common, p);
  const guideFactory: LoftGuideFactory | undefined = input.guide === undefined ? undefined : (start, end) => {
    const startWorld = worldPoint(start), endWorld = worldPoint(end);
    // Bind to the actual first legacy curve, without snapping a trigonometric endpoint
    // or silently relocating the authored seam after clockwise normalization.
    const authored = [worldPoint([...lo[0].start, 0]), worldPoint([...upper[0].start, height])];
    if (!startWorld.every((x, c) => x === authored[0][c]) || !endWorld.every((x, c) => x === authored[1][c])) return fail('need the first authored seam to survive exact curve normalization');
    const guide = admitLoftGuide(input.guide, startWorld, endWorld, n, 'endpoints must exactly match the first mixed-curve cap seams');
    return {
      degree: guide.degree, knots: [...guide.knots],
      controls: (lo: Point, hi: Point): Point[] => guide.controls(worldPoint(lo), worldPoint(hi)).map((target, i, poles) => {
        if (i === 0) return lo;
        if (i === poles.length - 1) return hi;
        const local = localVector(target.map((x, c) => x - a.origin[c]) as Point);
        const z = guide.degree === 2 ? (lo[2] + hi[2]) / 2 : lo[2] + (hi[2] - lo[2]) * (i / guide.degree);
        if (!worldPoint(local).every((x, c) => x === target[c]) || local[2] !== z) return fail('need an exact transverse guide transform');
        return local;
      }),
      offset: (t: number): Point => {
        const d = localVector(guide.offset(t));
        if (d[2] !== 0) return fail('need an exact transverse guide displacement');
        return d;
      },
    };
  };
  // No explicit frame remains: the shared legacy builder runs once, with the optional guide.
  // Positive scale through the span preserves the simple admitted loop at every t.
  const local = legacy({ id: input.id, name: input.name, sections: [{ profile: lo, z: 0 }, { profile: upper, z: height }], ...(input.sideTags ? { sideTags: input.sideTags } : {}) }, guideFactory);
  return placeLoftInFrame(local, common, fail);
}
