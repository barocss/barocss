import { booleanAnalytic, faceGeometry } from '../brep/analytic-boolean.js';
import { brepMassProperties } from '../brep/solid-mass.js';
import { transformBrep } from '../brep/brep-transform.js';
import { evaluateCadPart, outputOf } from '../part/part-model.js';
import { evaluateCurve, curveDomain } from '../core/math.js';
import { lookupFit, FitError } from './fits.js';
import { dot } from '../core/vec3.js';
import { isFrom, kernelRefusal } from '../core/barocss-error.js';
/** This module's refusal (R7.3a batch 2: the BearingError class folded, D279): a BarocssError, `details.source` 'bearing'. */
export const bearingError = (code, detail) => kernelRefusal('bearing', code, `bearing: ${detail}`);
/** Whether something thrown is this module's refusal. */
export const isBearingError = (e) => isFrom(e, 'bearing');
const fail = (code, detail) => { throw bearingError(code, detail); };
const EPS = 1e-6;
const mm = (x) => +x.toFixed(6);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
/** Why a bearing row is not one, or null. */
export function bearingRowProblem(r) {
    if (typeof r !== 'object' || r === null || Array.isArray(r))
        return 'a bearing row is an object { id, bore, outside, width, chamfer?, … , source | estimate }';
    const o = r, at = typeof o.id === 'string' && o.id.trim() ? `bearing row ${o.id}` : '';
    if (!at)
        return 'a bearing row needs an id';
    for (const k of Object.keys(o))
        if (!['id', 'designation', 'bore', 'outside', 'width', 'chamfer', 'daMin', 'daMax', 'DaMax', 'raMax', 'boreDeviation', 'outsideDeviation', 'source', 'estimate'].includes(k))
            return `${at}: unknown field ${k}`;
    for (const k of ['bore', 'outside', 'width'])
        if (!(num(o[k]) && o[k] > 0))
            return `${at}: ${k} must be a number of mm above 0`;
    for (const k of ['chamfer', 'daMin', 'daMax', 'DaMax', 'raMax'])
        if (o[k] !== undefined && !(num(o[k]) && o[k] >= 0))
            return `${at}: ${k} must be a number of mm, 0 or more`;
    const d = o.bore, D = o.outside, B = o.width, c = o.chamfer ?? 0;
    if (!(D > d))
        return `${at}: its outside Ø${D} must exceed its bore Ø${d}`;
    if (!(2 * c < Math.min(B, (D - d) / 2)))
        return `${at}: its corner r ${c} is too large for a ${B} × ${(D - d) / 2} section`;
    if (o.daMin !== undefined && o.daMax !== undefined && o.daMin > o.daMax)
        return `${at}: da min is above da max`;
    for (const k of ['boreDeviation', 'outsideDeviation']) {
        const v = o[k];
        if (v !== undefined && !(Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1]) && v[0] >= v[1]))
            return `${at}: ${k} must be [upper, lower] mm, upper ≥ lower`;
    }
    if ((o.source !== undefined) === (o.estimate === true))
        return `${at}: cite its source or say estimate: true — ${o.source !== undefined ? 'not both' : 'never neither'}`;
    if (o.source !== undefined && typeof o.source !== 'string')
        return `${at}: source must be text`;
    return null;
}
/** The envelope in its own frame: axis +Z, from z 0 to B, faces named under `id`. */
export function bearingEnvelope(row, id) {
    const p = bearingRowProblem(row);
    if (p)
        fail('INVALID_INPUT', p);
    const ri = row.bore / 2, ro = row.outside / 2, B = row.width, c = row.chamfer ?? 0, segs = [], tags = [];
    const line = (x, y, t) => { segs.push({ kind: 'line', start: [x, y] }); tags.push(t); };
    const arc = (x, y, cx, cy, t) => { segs.push({ kind: 'arc', start: [x, y], center: [cx, cy], direction: 'ccw' }); tags.push(t); };
    line(ri + c, 0, 'face0');
    if (c)
        arc(ro - c, 0, ro - c, c, 'corner1');
    line(ro, c, 'outside');
    if (c)
        arc(ro, B - c, ro - c, B - c, 'corner2');
    line(ro - c, B, 'face1');
    if (c)
        arc(ri + c, B, ri + c, B - c, 'corner3');
    line(ri, B - c, 'bore');
    if (c)
        arc(ri, c, ri + c, c, 'corner4');
    const sub = `${id}__e`, doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
            { id: `${sub}s`, kind: 'sketch', profile: 'loop', segments: segs, plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] }, sideTags: { outer: tags } },
            { id: sub, kind: 'revolve', sketch: `${sub}s`, axis: { origin: [0, 0], direction: 'y' }, angle: 360 }
        ] };
    const prefix = `${sub}.side[`;
    return transformBrep(outputOf(evaluateCadPart(doc), sub).brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, nm => nm.split('|').map(q => q.startsWith(prefix) ? `${id}.${q.slice(prefix.length, q.indexOf(']'))}${q.slice(q.indexOf(']') + 1)}` : q).join('|'));
}
const vol = (b) => brepMassProperties(b, 1, { quadratureSegments: 12 }).volume;
/** What the Boolean takes of `body` where `tool` stands (V(body) − V(body − tool)). */
function overlapOf(body, tool) {
    const v0 = vol(body);
    let left;
    try {
        left = booleanAnalytic(body, tool, 'difference');
    }
    catch (cause) {
        if (cause instanceof Error && /empty|no solid|nothing/i.test(cause.message))
            return v0;
        throw cause;
    }
    return Math.max(0, v0 - (left.bodies.length ? vol(left) : 0));
}
const apply = (m, p) => { const a = m.matrix, t = m.offset ?? [0, 0, 0]; return [a[0] * p[0] + a[1] * p[1] + a[2] * p[2] + t[0], a[3] * p[0] + a[4] * p[1] + a[5] * p[2] + t[1], a[6] * p[0] + a[7] * p[1] + a[8] * p[2] + t[2]]; };
const dirOf = (m, v) => { const a = m.matrix; return [a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2], a[6] * v[0] + a[7] * v[1] + a[8] * v[2]]; };
/** A ring's fit: the seat's class at its size against the ring's deviation (mm), as clearance = hole − shaft. */
function ringFit(tables, cls, size, ring, seatIsShaft) {
    let limit;
    try {
        limit = lookupFit(tables, cls, size);
    }
    catch (cause) {
        if (cause instanceof FitError)
            fail('SEAT_FIT', cause.message.replace(/^\[[A-Z_]+\] /, ''));
        throw cause;
    }
    if (!ring)
        return { limit };
    // (Hole − shaft: on the shaft the bearing's bore is the hole; in the housing the housing's bore is.)
    const [hiH, loH, hiS, loS] = seatIsShaft ? [ring[0], ring[1], limit.upper, limit.lower] : [limit.upper, limit.lower, ring[0], ring[1]];
    const min = loH - hiS, max = hiH - loS;
    return { limit: limit, clearanceMin: min, clearanceMax: max, kind: min >= 0 ? 'clearance' : max <= 0 ? 'interference' : 'transition' };
}
/**
 * The housing's shoulder at a face of the bearing (FRk8a, D181): a planar face square to the axis at `t` along it, its
 * outward normal toward the bearing (`toward`: +1 along the axis, −1 against), reaching the bore (Ø`D`) and stepping in
 * from it. Its diameter is its edges' nearest approach to the axis (each edge sampled), else null.
 */
function housingShoulder(housing, origin, axis, D, t, toward) {
    const loops = new Map(housing.loops.map(l => [l.id, l])), coedges = new Map(housing.coedges.map(c => [c.id, c])), edges = new Map(housing.edges.map(e => [e.id, e]));
    let best = null;
    for (const f of housing.faces) {
        const g = faceGeometry(f);
        if (g.kind !== 'plane' || Math.abs(dot(g.n, axis) - toward) > 1e-9)
            continue;
        const at = (g.o[0] - origin[0]) * axis[0] + (g.o[1] - origin[1]) * axis[1] + (g.o[2] - origin[2]) * axis[2];
        if (Math.abs(at - t) > EPS)
            continue;
        let lo = Infinity, hi = -Infinity;
        for (const l of f.loops)
            for (const cid of loops.get(l).coedges) {
                const curve = edges.get(coedges.get(cid).edge).curve, [t0, t1] = curveDomain(curve);
                for (let k = 0; k <= 32; k++) {
                    const p = evaluateCurve(curve, t0 + (t1 - t0) * k / 32), x = p[0] - origin[0], y = p[1] - origin[1], z = p[2] - origin[2], al = x * axis[0] + y * axis[1] + z * axis[2];
                    const r = Math.hypot(x - axis[0] * al, y - axis[1] * al, z - axis[2] * al);
                    if (r < lo)
                        lo = r;
                    if (r > hi)
                        hi = r;
                }
            }
        if (hi < D / 2 - EPS || !(lo < D / 2 - EPS))
            continue;
        if (best === null || 2 * lo > best)
            best = 2 * lo;
    }
    return best;
}
/** A bearing from `row`, on step `step` of a placed shaft against the shoulder at its `against` end; optionally in a housing. */
export function seatedBearing(row, shaft, spec, id) {
    const env = bearingEnvelope(row, id), d = row.bore, D = row.outside, B = row.width, c = row.chamfer ?? 0, warnings = [];
    const s = shaft.report.steps[spec.step - 1] ?? fail('INVALID_INPUT', `the shaft has no step ${spec.step} (it has ${shaft.report.steps.length})`);
    if (Math.abs(s.diameter - d) > EPS)
        fail('SEAT_FIT', `step ${spec.step} is Ø${mm(s.diameter)}; bearing ${row.id}'s bore is Ø${mm(d)}: the seat is modelled at the bore's size (its class carries the limits)`);
    if (spec.against !== 'start' && spec.against !== 'end')
        fail('INVALID_INPUT', 'against is start or end');
    if (B > s.to - s.from + EPS)
        fail('SEAT_ABUTMENT', `step ${spec.step}'s seat is ${mm(s.to - s.from)} long, shorter than the bearing's ${mm(B)}`);
    const sh = spec.against === 'start' ? shaft.report.shoulders.find(x => x.index === spec.step - 1) : shaft.report.shoulders.find(x => x.index === spec.step);
    if (!sh)
        fail('SEAT_ABUTMENT', `step ${spec.step} has no shoulder at its ${spec.against}: the bearing has nothing to stand against`);
    const shoulderD = spec.against === 'start' ? sh.before : sh.after;
    if (!(shoulderD > d))
        fail('SEAT_ABUTMENT', `the shoulder at step ${spec.step}'s ${spec.against} steps down (Ø${mm(shoulderD)}): it does not hold the bearing`);
    if (row.daMin !== undefined && shoulderD < row.daMin - EPS)
        fail('SEAT_ABUTMENT', `the shoulder Ø${mm(shoulderD)} is below da min ${row.daMin} (bearing ${row.id}): the inner ring would not bear on it`);
    if (row.daMax !== undefined && shoulderD > row.daMax + EPS)
        fail('SEAT_ABUTMENT', `the shoulder Ø${mm(shoulderD)} is above da max ${row.daMax} (bearing ${row.id}): it would reach the seals or the cage`);
    const fil = sh.fillet, raMax = row.raMax ?? c;
    if (fil > raMax + EPS)
        fail('SEAT_ABUTMENT', `the shoulder's fillet r ${mm(fil)} exceeds ${row.raMax !== undefined ? 'ra max' : 'the bearing\'s corner r'} ${mm(raMax)}: the bearing would stand on it`);
    const from = spec.against === 'start' ? s.from : s.to - B, to = from + B, far = spec.against === 'start' ? to : from;
    // The other side: a ring groove's near wall within 1 mm of the face, or a shoulder there.
    const groove = shaft.report.grooves.find(g => g.step === spec.step && (spec.against === 'start' ? g.from >= far - EPS && g.from <= far + 1 + EPS : g.from + g.width <= far + EPS && g.from + g.width >= far - 1 - EPS));
    const otherShoulder = Math.abs(far - (spec.against === 'start' ? s.to : s.from)) < EPS;
    const located = groove ? `ring groove ${groove.index}` : otherShoulder ? 'a shoulder' : null;
    if (!located)
        warnings.push(`the bearing's ${spec.against === 'start' ? 'end' : 'start'} side is not located: no ring groove within 1 mm of its face and no shoulder (a spacer is not modelled)`);
    const local = transformBrep(env, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, from] }), brep = transformBrep(local, shaft.place);
    const shaftOverlap = overlapOf(shaft.brep, brep);
    if (shaftOverlap > 1e-6 * vol(brep))
        fail('SEAT_ABUTMENT', `the bearing overlaps the shaft by ${+shaftOverlap.toPrecision(4)} mm³`);
    let housing;
    if (spec.housing) {
        const axisW = dirOf(shaft.place, [0, 0, 1]), originW = apply(shaft.place, [0, 0, 0]);
        const bore = spec.housing.faces.map(f => ({ f, g: faceGeometry(f) })).find(({ g }) => {
            if (g.kind !== 'cylinder' || g.out !== -1 || Math.abs(2 * g.r - D) > EPS || Math.abs(Math.abs(dot(g.a, axisW)) - 1) > 1e-9)
                return false;
            const off = [g.c[0] - originW[0], g.c[1] - originW[1], g.c[2] - originW[2]], al = dot(off, axisW);
            return Math.hypot(off[0] - axisW[0] * al, off[1] - axisW[1] * al, off[2] - axisW[2] * al) < EPS;
        });
        if (!bore)
            fail('SEAT_FIT', `the housing has no Ø${mm(D)} bore on the bearing's axis`);
        const loops = new Set(bore.f.loops), edges = new Map(spec.housing.edges.map(e => [e.id, e])), verts = new Map(spec.housing.vertices.map(v => [v.id, v.point]));
        let lo = Infinity, hi = -Infinity;
        for (const ce of spec.housing.coedges)
            if (loops.has(ce.loop))
                for (const v of edges.get(ce.edge).vertices) {
                    const p = verts.get(v), t = dot([p[0] - originW[0], p[1] - originW[1], p[2] - originW[2]], axisW);
                    lo = Math.min(lo, t);
                    hi = Math.max(hi, t);
                }
        const covered = lo <= from + EPS && hi >= to - EPS;
        if (!covered)
            warnings.push(`the housing's bore (${mm(lo)} to ${mm(hi)} along the axis) does not cover the bearing (${mm(from)} to ${mm(to)})`);
        const hOverlap = overlapOf(spec.housing, brep);
        if (hOverlap > 1e-6 * vol(brep))
            fail('SEAT_ABUTMENT', `the bearing overlaps the housing by ${+hOverlap.toPrecision(4)} mm³`);
        // FRk8a (D181): the housing's shoulder, from its faces, against the row's Da max.
        const start = housingShoulder(spec.housing, originW, axisW, D, from, 1), end = housingShoulder(spec.housing, originW, axisW, D, to, -1);
        for (const [at, dia] of [['start', start], ['end', end]])
            if (dia !== null && row.DaMax !== undefined && dia > row.DaMax + EPS)
                fail('SEAT_ABUTMENT', `the housing's shoulder Ø${mm(dia)} at the bearing's ${at} is above Da max ${row.DaMax} (bearing ${row.id}): the outer ring would not bear on it`);
        const mine = spec.against === 'start' ? start : end, other = spec.against === 'start' ? end : start, otherSide = spec.against === 'start' ? 'end' : 'start';
        const shoulder = mine !== null ? { at: spec.against, diameter: mm(mine) } : other !== null ? { at: otherSide, diameter: mm(other) } : null;
        if (mine === null)
            warnings.push(other !== null ? `the housing has no shoulder at the bearing's ${spec.against} (its shaft's located side), only at its ${otherSide}` : 'the housing has no shoulder at either face of the bearing: its outer ring is not located (a cover or a ring is not modelled)');
        housing = { bore: D, overlap: hOverlap, covered, shoulder };
    }
    const shaftFit = spec.fit?.shaft ? ringFit(spec.fit.tables, spec.fit.shaft, d, row.boreDeviation, true) : undefined;
    const housingFit = spec.fit?.housing && spec.housing ? ringFit(spec.fit.tables, spec.fit.housing, D, row.outsideDeviation, false) : undefined;
    if (spec.fit?.housing && !spec.housing)
        warnings.push('a housing class is given but no housing');
    return { brep, report: { row: row.id, ...(row.designation ? { designation: row.designation } : {}), bore: d, outside: D, width: B, chamfer: c, estimate: row.estimate === true, ...(row.source ? { source: row.source } : {}),
            seat: { step: spec.step, against: spec.against, from: from, to: to, shoulder: shoulderD, shoulderFillet: fil, located, overlap: shaftOverlap },
            ...(housing ? { housing } : {}), ...(shaftFit ? { shaftFit } : {}), ...(housingFit ? { housingFit } : {}), warnings, notForStructuralCalculation: true } };
}
