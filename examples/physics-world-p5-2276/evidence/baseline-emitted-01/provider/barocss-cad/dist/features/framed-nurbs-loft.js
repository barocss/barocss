// A polynomial guide on explicit parallel frames reuses the existing height-section loft once.
import { BrepError } from '../brep/brep-core.js';
import { buildProfileLoop, ExtrudedProfileLimits } from './extruded-profile-solid.js';
import { admitLoftCommonFrame, loftFrameOffset, loftFramePoint, loftFrameLocal, placeLoftInFrame } from './loft-common-frame.js';
const fail = (detail) => { throw new BrepError('INPUT', `loft: framed polynomial guide ${detail}`); };
const separation = 'loft: framed polynomial guides need positive plane separation';
function shiftedPoint(p, shift) {
    return shift[0] === 0 && shift[1] === 0 ? [p[0], p[1]] : [p[0] + shift[0], p[1] + shift[1]];
}
function localProfile(profile, shift) {
    if (!Array.isArray(profile))
        return fail('needs line/arc profile arrays; inline ellipses are not supported');
    const source = profile, original = buildProfileLoop(source), copy = [];
    for (const segment of source)
        copy.push(segment.kind === 'line' ? { ...segment, start: shiftedPoint(segment.start, shift) }
            : { ...segment, start: shiftedPoint(segment.start, shift), center: shiftedPoint(segment.center, shift) });
    const moved = buildProfileLoop(copy);
    if (moved.reversed !== original.reversed)
        return fail('loses profile orientation under the frame translation');
    for (let i = 0; i < original.segments.length; i++) {
        const a = original.segments[i], b = moved.segments[i];
        if (a.kind !== b.kind || (a.kind === 'arc' && (b.kind !== 'arc' || a.startAngle !== b.startAngle || a.sweep !== b.sweep)))
            return fail('loses arc correspondence under the frame translation');
    }
    return copy;
}
function localGuide(value, frame) {
    if (!value || value.kind !== 'nurbs')
        return fail('needs one polynomial nurbs guide');
    const g = value, points = g.controlPoints;
    // Bound adapter copies before the original degree/knot admission. These are the same source limits.
    if (!Array.isArray(points) || points.length < 2 || points.length > 64)
        return fail('needs 2 to 64 finite three-component world guide controls');
    if (!Array.isArray(g.knots) || g.knots.length > 70)
        return fail('needs knots within the existing guide count limit');
    const copy = [];
    for (const point of points) {
        if (!Array.isArray(point) || point.length !== 3)
            return fail('needs finite three-component world guide controls');
        for (let c = 0; c < 3; c++)
            if (typeof point[c] !== 'number' || !Number.isFinite(point[c]) || Math.abs(point[c]) > ExtrudedProfileLimits.coordinateMM)
                return fail('needs finite world guide controls within the existing coordinate range');
        const local = loftFrameLocal(frame, point), world = loftFramePoint(frame, local);
        for (let c = 0; c < 3; c++)
            if (world[c] !== point[c])
                return fail('needs an exact world/local guide reconstruction');
        copy.push(local);
    }
    // Keep extra/malformed fields for the original guide admission; never discard caller-supplied weights.
    return { ...g, controlPoints: copy, knots: Array.isArray(g.knots) ? [...g.knots] : g.knots };
}
export function framedNurbsLoftSolid(input, frames, legacy) {
    const common = admitLoftCommonFrame(frames, fail), sections = [];
    for (let i = 0; i < frames.length; i++) {
        const offset = i === 0 ? { shift: [0, 0], height: 0 } : loftFrameOffset(common, frames[i].origin, fail, separation);
        const restored = loftFramePoint(common, [offset.shift[0], offset.shift[1], offset.height]);
        for (let c = 0; c < 3; c++)
            if (restored[c] !== frames[i].origin[c])
                return fail('needs an exact world/local frame reconstruction');
        if (i > 0) {
            const a = frames[i - 1].origin, b = frames[i].origin, delta = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
            if (!(offset.height - sections[i - 1].z > 1e-9 * Math.max(1, delta)))
                throw new BrepError('GEOMETRY', separation);
        }
        sections.push({ profile: localProfile(input.sections[i].profile, offset.shift), z: offset.height });
    }
    const guide = localGuide(input.guide, common);
    const local = legacy({ id: input.id, name: input.name, sections, ...(input.sideTags ? { sideTags: input.sideTags } : {}) }, undefined, guide);
    return placeLoftInFrame(local, common, fail);
}
