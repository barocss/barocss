// CG1.1d: admit a positive homothety of one simple line/arc loop, then reuse the legacy
// exact ruled loft in a rigid common frame. There is no second loft or mass solver here.
import { BrepError } from '../brep/brep-core.js';
import { transformBrep } from '../brep/brep-transform.js';
import { combineMassProperties } from '../brep/solid-mass.js';
import { unsupportedNativeMass } from '../internal/native-si-mass-state.js';
import { buildProfileLoop, ExtrudedProfileLimits } from './extruded-profile-solid.js';
import { admitLoftGuide } from './loft-guide.js';
const fail = (detail) => { throw new BrepError('INPUT', `loft: framed mixed curves ${detail}`); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function framedMixedLoftSolid(input, frames, legacy) {
    const [a, b] = frames, u = a.u, v = a.v, n = cross(u, v);
    if (!u.every((x, c) => x === b.u[c]) || !v.every((x, c) => x === b.v[c]))
        return fail('need identical frame axes');
    // A mass rotation must actually be rigid. Refuse uncertified floating frames rather than
    // normalize/project the authored axes or apply rigid mass algebra to a shear/scale.
    if (dot(u, u) !== 1 || dot(v, v) !== 1 || dot(u, v) !== 0 || dot(n, n) !== 1)
        return fail('need a certified rigid common frame');
    const delta = b.origin.map((x, c) => x - a.origin[c]);
    const shift = [dot(delta, u), dot(delta, v)], height = dot(delta, n);
    if (!(height > 1e-9 * Math.max(1, Math.hypot(...delta))))
        throw new BrepError('GEOMETRY', 'loft: framed mixed curves need positive plane separation');
    if (delta.some((x, c) => u[c] * shift[0] + v[c] * shift[1] + n[c] * height !== x))
        return fail('need an exact rigid decomposition of the frame displacement');
    const profiles = input.sections.map(s => {
        if (!Array.isArray(s.profile))
            return fail('need line/arc profile arrays on both sections');
        const p = s.profile;
        if (!p.some(g => g.kind === 'line') || !p.some(g => g.kind === 'arc'))
            return fail('need both lines and arcs on each section');
        return p;
    });
    const loops = profiles.map(p => buildProfileLoop(p)), [lo, hi] = profiles;
    if (lo.length !== hi.length || lo.some((s, i) => s.kind !== hi[i].kind))
        return fail('need identical segment topology and authored order');
    // Choose the largest authored start displacement as a stable scale witness, then verify
    // every start, arc centre and direction exactly. This is admission, not a best fit.
    let witness = 0, component = 0, extent = 0;
    for (let i = 1; i < lo.length; i++)
        for (let c = 0; c < 2; c++) {
            const d = Math.abs(lo[i].start[c] - lo[0].start[c]);
            if (d > extent) {
                extent = d;
                witness = i;
                component = c;
            }
        }
    if (!(extent > 0))
        return fail('have no nondegenerate scale witness');
    const scale = (hi[witness].start[component] - hi[0].start[component]) / (lo[witness].start[component] - lo[0].start[component]);
    if (!(Number.isFinite(scale) && scale > 0))
        return fail('need a positive finite uniform scale');
    const translation = [hi[0].start[0] - scale * lo[0].start[0], hi[0].start[1] - scale * lo[0].start[1]];
    const matches = (x, y) => x.every((q, c) => scale * q + translation[c] === y[c]);
    for (let i = 0; i < lo.length; i++) {
        const x = lo[i], y = hi[i];
        if (!matches(x.start, y.start))
            return fail('are not an exact uniform scale and translation');
        if (x.kind === 'arc' && (y.kind !== 'arc' || x.direction !== y.direction || !matches(x.center, y.center)))
            return fail('need corresponding arc centres and directions');
        const l = loops[0].segments[i], h = loops[1].segments[i];
        if (l.kind !== h.kind || (l.kind === 'arc' && (h.kind !== 'arc' || l.startAngle !== h.startAngle || l.sweep !== h.sweep)))
            return fail('have uncertified arc parameter correspondence');
    }
    if (input.sideTags && (input.sideTags.length !== lo.length || input.sideTags.some(t => typeof t !== 'string' || !t.length) || new Set(input.sideTags).size !== lo.length))
        return fail('need one unique tag per authored contour segment');
    const move = (p) => [p[0] + shift[0], p[1] + shift[1]];
    const upper = hi.map((s) => s.kind === 'line' ? { kind: 'line', start: move(s.start) } : { kind: 'arc', start: move(s.start), center: move(s.center), direction: s.direction });
    const movedLoop = buildProfileLoop(upper), total = [translation[0] + shift[0], translation[1] + shift[1]];
    const mapped = (x, y) => x.every((q, c) => scale * q + total[c] === y[c]);
    for (let i = 0; i < lo.length; i++) {
        const x = lo[i], y = upper[i], l = loops[0].segments[i], h = movedLoop.segments[i];
        if (!mapped(x.start, y.start) || (x.kind === 'arc' && (y.kind !== 'arc' || !mapped(x.center, y.center))))
            return fail('have an uncertified in-plane frame translation');
        if (l.kind !== h.kind || (l.kind === 'arc' && (h.kind !== 'arc' || l.startAngle !== h.startAngle || l.sweep !== h.sweep)))
            return fail('lose arc correspondence under the frame translation');
    }
    const worldPoint = (p) => a.origin.map((x, c) => u[c] * p[0] + v[c] * p[1] + n[c] * p[2] + x);
    const localVector = (p) => [dot(p, u), dot(p, v), dot(p, n)];
    const guideFactory = input.guide === undefined ? undefined : (start, end) => {
        const startWorld = worldPoint(start), endWorld = worldPoint(end);
        // Bind to the actual first legacy curve, without snapping a trigonometric endpoint
        // or silently relocating the authored seam after clockwise normalization.
        const authored = [worldPoint([...lo[0].start, 0]), worldPoint([...upper[0].start, height])];
        if (!startWorld.every((x, c) => x === authored[0][c]) || !endWorld.every((x, c) => x === authored[1][c]))
            return fail('need the first authored seam to survive exact curve normalization');
        const guide = admitLoftGuide(input.guide, startWorld, endWorld, n, 'endpoints must exactly match the first mixed-curve cap seams');
        return {
            degree: guide.degree, knots: [...guide.knots],
            controls: (lo, hi) => guide.controls(worldPoint(lo), worldPoint(hi)).map((target, i, poles) => {
                if (i === 0)
                    return lo;
                if (i === poles.length - 1)
                    return hi;
                const local = localVector(target.map((x, c) => x - a.origin[c]));
                const z = guide.degree === 2 ? (lo[2] + hi[2]) / 2 : lo[2] + (hi[2] - lo[2]) * (i / guide.degree);
                if (!worldPoint(local).every((x, c) => x === target[c]) || local[2] !== z)
                    return fail('need an exact transverse guide transform');
                return local;
            }),
            offset: (t) => {
                const d = localVector(guide.offset(t));
                if (d[2] !== 0)
                    return fail('need an exact transverse guide displacement');
                return d;
            },
        };
    };
    // No explicit frame remains: the shared legacy builder runs once, with the optional guide.
    // Positive scale through the span preserves the simple admitted loop at every t.
    const local = legacy({ id: input.id, name: input.name, sections: [{ profile: lo, z: 0 }, { profile: upper, z: height }], ...(input.sideTags ? { sideTags: input.sideTags } : {}) }, guideFactory);
    const matrix = [u[0], v[0], n[0], u[1], v[1], n[1], u[2], v[2], n[2]];
    const brep = transformBrep(local.brep, { matrix, offset: a.origin });
    const outside = (p) => p.some(x => !Number.isFinite(x) || Math.abs(x) > ExtrudedProfileLimits.coordinateMM);
    if (brep.vertices.some(x => outside(x.point)) || brep.edges.some(e => e.curve.controlPoints.some(outside)) || brep.faces.some(f => f.surface.kind !== 'surface' || f.surface.controlPoints.some(row => row.some(outside))))
        return fail('leave the existing modeling coordinate range');
    return { brep, mass: (density) => {
            const props = local.mass(density), world = combineMassProperties([{ props, axes: [u, v, n], offset: a.origin }]);
            // Use existing rigid mass algebra without upgrading the original quadrature method or
            // inventing a native-SI carrier (the existing moved-mass path is also unavailable there).
            return unsupportedNativeMass({ ...world, method: props.method }, 'transformed');
        } };
}
