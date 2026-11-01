// Bounded seam guides add only transverse Bezier displacement on strictly ordered cap planes.
// Quadratic poles use the cap midplane; cubic poles use the one-third and two-third planes.
import { BrepError } from '../brep/brep-core.js';
import { ExtrudedProfileLimits } from './extruded-profile-solid.js';
const fail = (detail) => { throw new BrepError('INPUT', `loft: quadratic guide ${detail}`); };
export function admitLoftGuide(value, start, end, normal, endpointDetail = 'endpoints must exactly match the two cap +X seams') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return fail('must be one explicit guide object');
    const g = value;
    if (g.kind === 'cubic-bezier') {
        const cubicFail = (detail) => { throw new BrepError('INPUT', `loft: cubic guide ${detail}`); };
        if (Object.keys(g).length !== 2 || !Object.hasOwn(g, 'kind') || !Object.hasOwn(g, 'controlPoints'))
            return cubicFail('needs exactly kind cubic-bezier and controlPoints');
        if (!Array.isArray(g.controlPoints) || g.controlPoints.length !== 4)
            return cubicFail('needs exactly four world control points');
        const controls = Array.from(g.controlPoints, (p) => {
            if (!Array.isArray(p) || p.length !== 3 || ![0, 1, 2].every(i => typeof p[i] === 'number' && Number.isFinite(p[i]) && Math.abs(p[i]) <= ExtrudedProfileLimits.coordinateMM))
                return cubicFail('needs finite three-component points within the existing coordinate range');
            return [...p];
        });
        if (!start.every((x, c) => x === controls[0][c]) || !end.every((x, c) => x === controls[3][c]))
            return cubicFail(endpointDetail);
        const offsets = [1, 2].map(i => controls[i].map((x, c) => x - (start[c] + (end[c] - start[c]) * (i / 3))));
        for (let i = 0; i < 2; i++)
            if (normal[0] * offsets[i][0] + normal[1] * offsets[i][1] + normal[2] * offsets[i][2] !== 0)
                return cubicFail(`control ${i + 1} must lie exactly on the cap fraction ${i + 1}/3 plane`);
        return {
            degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1],
            // Keep authored seam poles, translating the other rulings by their linear cap offsets.
            controls: (lo, hi) => [lo, ...[1, 2].map(i => controls[i].map((x, c) => x + (1 - i / 3) * (lo[c] - start[c]) + (i / 3) * (hi[c] - end[c]))), hi],
            offset: (t) => offsets[0].map((x, c) => 3 * t * (1 - t) * (1 - t) * x + 3 * t * t * (1 - t) * offsets[1][c]),
        };
    }
    if (Object.keys(g).length !== 2 || !Object.hasOwn(g, 'kind') || !Object.hasOwn(g, 'controlPoints') || g.kind !== 'quadratic-bezier')
        return fail('needs exactly kind quadratic-bezier and controlPoints');
    if (!Array.isArray(g.controlPoints) || g.controlPoints.length !== 3)
        return fail('needs exactly three world control points');
    const controls = g.controlPoints.map((p) => {
        if (!Array.isArray(p) || p.length !== 3 || !p.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= ExtrudedProfileLimits.coordinateMM))
            return fail('needs finite three-component points within the existing coordinate range');
        return [...p];
    });
    if (!start.every((x, c) => x === controls[0][c]) || !end.every((x, c) => x === controls[2][c]))
        return fail(endpointDetail);
    const d = controls[1].map((x, c) => x - (start[c] + end[c]) / 2);
    if (normal[0] * d[0] + normal[1] * d[1] + normal[2] * d[2] !== 0)
        return fail('middle control must lie exactly on the cap midplane');
    const middle = (lo, hi) => controls[1].map((x, c) => x + ((lo[c] - start[c]) + (hi[c] - end[c])) / 2);
    return {
        degree: 2, knots: [0, 0, 0, 1, 1, 1],
        /** The seam itself keeps the authored middle pole exactly; no fit or projection. */
        controls: (lo, hi) => [lo, middle(lo, hi), hi],
        /** Q(t) minus the straight seam: 2t(1-t) times its transverse middle-pole offset. */
        offset: (t) => d.map(x => 2 * t * (1 - t) * x),
    };
}
