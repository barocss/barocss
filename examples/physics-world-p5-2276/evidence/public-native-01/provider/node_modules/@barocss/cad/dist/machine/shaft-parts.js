import { booleanAnalytic, faceGeometry } from '../brep/analytic-boolean.js';
import { transformBrep } from '../brep/brep-transform.js';
import { evaluateCadPart, outputOf } from '../part/part-model.js';
import { fitLimits } from './fits.js';
import { add, cross, dot, scale as scl, sub } from '../core/vec3.js';
import { isFrom, kernelRefusal } from '../core/barocss-error.js';
/** This module's refusal (R7.3a batch 2: the ShaftPartError class folded, D279): a BarocssError, `details.source` 'shaft-part'. */
export const shaftPartError = (code, detail) => kernelRefusal('shaft-part', code, `shaft part: ${detail}`);
/** Whether something thrown is this module's refusal. */
export const isShaftPartError = (e) => isFrom(e, 'shaft-part');
const fail = (code, detail) => { throw shaftPartError(code, detail); };
const pos = (v, what) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fail('INVALID_INPUT', `${what} must be a number of mm above 0`));
const EPS = 1e-9;
const mm = (x) => +x.toFixed(6);
/** A tool's part document: one sketch extruded `height` along its plane's normal. */
function prism(id, sketch, height) {
    const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: `${id}s`, kind: 'sketch', ...sketch }, { id, kind: 'extrude', sketch: `${id}s`, height }] };
    return outputOf(evaluateCadPart(doc), id).brep;
}
const named = (b, name) => transformBrep(b, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, () => name);
/** A part's faces renamed from its tool's id to its own (`<tool>.top` → `<id>.top`). */
const own = (b, tool, id) => transformBrep(b, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, n => n.split(`${tool}.`).join(`${id}.`));
const turnZ = (deg) => { const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const apply = (m, p) => { const a = m.matrix, t = m.offset ?? [0, 0, 0]; return [a[0] * p[0] + a[1] * p[1] + a[2] * p[2] + t[0], a[3] * p[0] + a[4] * p[1] + a[5] * p[2] + t[1], a[6] * p[0] + a[7] * p[1] + a[8] * p[2] + t[2]]; };
const dirOf = (m, v) => { const a = m.matrix; return [a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2], a[6] * v[0] + a[7] * v[1] + a[8] * v[2]]; };
const unit = (a) => { const n = Math.hypot(...a); return [a[0] / n, a[1] / n, a[2] / n]; };
/** A bore's reference direction square to its axis: +X projected, else +Y. */
function reference(a) { const x = [1, 0, 0], y = [0, 1, 0], r = Math.abs(dot(a, x)) < 0.9 ? x : y; return unit(sub(r, scl(a, dot(r, a)))); }
/** The hub's keyway cut into `target` at its bore face. */
export function keywayCut(target, spec, id) {
    const face = target.faces.find(f => f.name === spec.face) ?? target.faces.find(f => f.name?.replace(/#\d+$/, '') === spec.face) ?? target.faces.find(f => f.id === spec.face);
    if (!face)
        return fail('INVALID_INPUT', `no face ${spec.face} on the hub`);
    const g = faceGeometry(face);
    if (g.kind !== 'cylinder' || g.out !== -1)
        fail('KEY_FIT', `${spec.face} is not a bore (a cylindrical hole's face): a keyway is cut into a hub's bore`);
    const cyl = g, b = pos(spec.width, 'the keyway\'s width'), t2 = pos(spec.depth, 'the keyway\'s depth'), r = cyl.r, a = unit([...cyl.a]);
    if (!(b < 2 * r))
        fail('KEY_FIT', `a keyway ${b} mm wide is no narrower than its Ø${mm(2 * r)} bore`);
    // The face's extent along its axis (its loops' vertices).
    const loops = new Set(face.loops), edges = new Map(target.edges.map(e => [e.id, e])), verts = new Map(target.vertices.map(v => [v.id, v.point]));
    let lo = Infinity, hi = -Infinity;
    for (const c of target.coedges)
        if (loops.has(c.loop))
            for (const v of edges.get(c.edge).vertices) {
                const s = dot(sub(verts.get(v), cyl.c), a);
                lo = Math.min(lo, s);
                hi = Math.max(hi, s);
            }
    const deg = spec.angle ?? 0, u0 = reference(a), u = unit(add(scl(u0, Math.cos(deg * Math.PI / 180)), scl(cross(a, u0), Math.sin(deg * Math.PI / 180)))), v = cross(a, u);
    // (The box starts inside the bore's air, short of its chord at the keyway's sides, and ends at the floor r + t2.)
    const inner = Math.sqrt(r * r - b * b / 4) - Math.min(0.5, r / 4), origin = add(cyl.c, add(scl(u, inner), scl(a, lo - 1)));
    const tool = prism(`${id}__kw`, { profile: 'rectangle', min: [-b / 2, 0], max: [b / 2, hi - lo + 2], plane: { origin, normal: u, xAxis: v } }, r + t2 - inner);
    const brep = booleanAnalytic(target, named(tool, `${id}.keyway`), 'difference');
    return { brep, report: { face: spec.face, width: b, depth: t2, boreRadius: r, floorRadius: r + t2, axisPoint: [...cyl.c], axis: a, direction: u, angle: deg, from: lo, to: hi } };
}
/** A parallel key in keyseat `spec.keyseat` of a placed shaft; with a hub keyway, checked against it. */
export function keySolid(shaft, spec, id) {
    const seat = shaft.report.keyseats.find(k => k.index === spec.keyseat) ?? fail('INVALID_INPUT', `the shaft has no keyseat ${spec.keyseat} (it has ${shaft.report.keyseats.length})`);
    const b = spec.width === undefined ? seat.width : pos(spec.width, 'the key\'s width'), h = pos(spec.height, 'the key\'s height'), floorLen = seat.length;
    const l = spec.length === undefined ? floorLen : pos(spec.length, 'the key\'s length'), ends = spec.ends ?? (seat.ends === 'end-mill' ? 'round' : 'square');
    if (ends !== 'round' && ends !== 'square')
        fail('INVALID_INPUT', 'a key\'s ends are round or square');
    if (ends === 'round' && !(l > b))
        fail('KEY_FIT', `a round-ended key's length ${l} mm must exceed its width ${b} mm`);
    // Its length in the seat: an end-milled seat's ends are round (a square key's corners need the straight part), a square or disc seat's floor flat.
    const room = seat.ends === 'end-mill' && ends === 'square' ? floorLen - b - l : floorLen - l;
    if (room < -EPS)
        fail('KEY_FIT', `the key, ${l} mm long${ends === 'square' && seat.ends === 'end-mill' ? ' with square ends' : ''}, does not fit keyseat ${seat.index} (${floorLen} mm${seat.ends === 'end-mill' ? ', round-ended' : ''})`);
    const play = seat.width - b;
    let seatFit, hubFit;
    if (spec.fit) {
        // (Classes apply to one nominal size, so the key is modelled at its seat's width: the classes carry the limits, R12c.2.)
        if (Math.abs(play) > EPS)
            fail('KEY_FIT', `with fit classes the key is modelled at its seat's nominal width ${mm(seat.width)} mm (it is ${mm(b)}): the classes carry the limits`);
        if (spec.fit.seat)
            seatFit = fitLimits(spec.fit.tables, spec.fit.seat, spec.fit.key, seat.width);
        if (spec.fit.hub)
            hubFit = fitLimits(spec.fit.tables, spec.fit.hub, spec.fit.key, seat.width);
    }
    if (play < -EPS)
        fail('KEY_FIT', `the key is ${mm(b)} wide in a ${mm(seat.width)} mm seat: model it at the seat's width and declare its width fit (classes from your fit tables) for an interference, or make it narrower`);
    // Built in the shaft's frame on +X, turned to the seat's angle, then placed with the shaft.
    const rf = seat.floorRadius, z0 = seat.from + (floorLen - l) / 2, plane = { origin: [rf, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
    const local = ends === 'square' ? prism(`${id}__k`, { profile: 'rectangle', min: [-b / 2, z0], max: [b / 2, z0 + l], plane }, h)
        : prism(`${id}__k`, { profile: 'loop', segments: [{ kind: 'line', start: [b / 2, z0 + b / 2] }, { kind: 'arc', start: [b / 2, z0 + l - b / 2], center: [0, z0 + l - b / 2], direction: 'ccw' }, { kind: 'line', start: [-b / 2, z0 + l - b / 2] }, { kind: 'arc', start: [-b / 2, z0 + b / 2], center: [0, z0 + b / 2], direction: 'ccw' }], plane }, h);
    const brep = transformBrep(transformBrep(own(local, `${id}__k`, id), { matrix: turnZ(seat.angle) }), shaft.place);
    const stands = h - seat.depth;
    let hub;
    if (spec.hub) {
        // The hub's bore on the shaft's axis, its keyway over the seat, its floor above the key's top.
        const k = spec.hub, axisW = unit(dirOf(shaft.place, [0, 0, 1])), originW = apply(shaft.place, [0, 0, 0]), seatDir = unit(dirOf(shaft.place, [Math.cos(seat.angle * Math.PI / 180), Math.sin(seat.angle * Math.PI / 180), 0]));
        const off = sub(k.axisPoint, originW), offAxis = Math.hypot(...sub(off, scl(axisW, dot(off, axisW))));
        if (Math.abs(Math.abs(dot(k.axis, axisW)) - 1) > 1e-9 || offAxis > 1e-6)
            fail('KEY_FIT', `the hub's bore is not on the shaft's axis (${mm(offAxis)} mm off)`);
        if (dot(k.direction, seatDir) < 1 - 1e-9)
            fail('KEY_FIT', `the hub's keyway is not over keyseat ${seat.index} (${mm(Math.acos(Math.max(-1, Math.min(1, dot(k.direction, seatDir)))) * 180 / Math.PI)}° round from it)`);
        const top = rf + h, clear = k.floorRadius - top, kplay = k.width - b;
        if (clear <= EPS)
            fail('KEY_FIT', `the key's top at ${mm(top)} mm from the axis reaches the keyway's floor at ${mm(k.floorRadius)} (t1 + t2 − h = ${mm(seat.depth + k.depth - h)} with the bore at the shaft's size)`);
        if (kplay < -EPS)
            fail('KEY_FIT', `the key is ${mm(b)} wide in a ${mm(k.width)} mm keyway: widen the keyway (its fit on the key's width goes in the classes)`);
        // The key's span along the axis within the keyway's (the hub's frame: along its axis from its axis point).
        const zs = [z0, z0 + l].map(z => dot(sub(apply(shaft.place, [0, 0, z]), k.axisPoint), k.axis)), klo = Math.min(...zs), khi = Math.max(...zs);
        if (klo < k.from - EPS || khi > k.to + EPS) { /* (a key longer than its hub stands out of it: allowed, said in the notes by the length room) */ }
        hub = { keywayPlay: kplay, topClearance: clear };
    }
    return { brep, report: { keyseat: seat.index, width: b, height: h, length: l, ends, seatPlay: play, stands: stands, lengthRoom: room, ...(hub ? { hub } : {}), ...(seatFit ? { seatFit } : {}), ...(hubFit ? { hubFit } : {}) } };
}
/** A retaining ring's envelope in groove `spec.groove` of a placed shaft, checked against the user's row. */
export function ringSolid(shaft, spec, id) {
    const g = shaft.report.grooves.find(x => x.index === spec.groove) ?? fail('INVALID_INPUT', `the shaft has no groove ${spec.groove} (it has ${shaft.report.grooves.length})`);
    const step = shaft.report.steps[g.step - 1], s = pos(spec.thickness, 'the ring\'s thickness'), D = pos(spec.outerDiameter, 'the ring\'s outer diameter');
    if (s > g.width + EPS)
        fail('RING_FIT', `a ring ${mm(s)} thick does not fit groove ${g.index}, ${mm(g.width)} wide`);
    if (!(D > g.diameter))
        fail('RING_FIT', `the ring's outer Ø${mm(D)} must exceed the groove's Ø${mm(g.diameter)}`);
    const row = spec.row;
    if (row) {
        if ((row.source === undefined) === (row.estimate !== true))
            fail('INVALID_INPUT', 'a ring row cites its source or says estimate: true (one of them)');
        const near = (a, b) => a === undefined || Math.abs(a - b) <= 1e-6;
        if (!near(row.shaftDiameter, step.diameter))
            fail('RING_FIT', `the ring's row is for a Ø${row.shaftDiameter} shaft; step ${g.step} is Ø${mm(step.diameter)}`);
        if (!near(row.grooveDiameter, g.diameter))
            fail('RING_FIT', `the ring's row wants a Ø${row.grooveDiameter} groove; groove ${g.index} is Ø${mm(g.diameter)}`);
        if (!near(row.grooveWidth, g.width))
            fail('RING_FIT', `the ring's row wants a groove ${row.grooveWidth} mm wide; groove ${g.index} is ${mm(g.width)}`);
    }
    const z0 = g.from + (g.width - s) / 2;
    const local = prism(`${id}__r`, { profile: 'circle', center: [0, 0], radius: D / 2, holes: [[{ kind: 'arc', start: [g.diameter / 2, 0], center: [0, 0], direction: 'ccw' }, { kind: 'arc', start: [-g.diameter / 2, 0], center: [0, 0], direction: 'ccw' }]], plane: { origin: [0, 0, z0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, s);
    return { brep: transformBrep(own(local, `${id}__r`, id), shaft.place), report: { groove: g.index, thickness: s, innerDiameter: g.diameter, outerDiameter: D, axialPlay: g.width - s, estimate: !row || row.estimate === true, ...(row?.source ? { source: row.source } : {}) } };
}
/** A pin in cross hole `spec.hole` of a placed shaft. */
export function pinSolid(shaft, spec, id) {
    const h = shaft.report.holes.find(x => x.index === spec.hole) ?? fail('INVALID_INPUT', `the shaft has no cross hole ${spec.hole} (it has ${shaft.report.holes.length})`);
    const step = shaft.report.steps.find(s => h.at >= s.from - EPS && h.at <= s.to + EPS), d = spec.diameter === undefined ? h.diameter : pos(spec.diameter, 'the pin\'s diameter'), L = spec.length === undefined ? step.diameter : pos(spec.length, 'the pin\'s length');
    if (d > h.diameter + EPS && !spec.fit)
        fail('PIN_FIT', `a Ø${mm(d)} pin in a Ø${mm(h.diameter)} hole: declare their fit (classes on the hole and the pin, from your fit tables) for an interference`);
    // (Along +X in the shaft's frame, turned to the hole's angle: centred on the axis.)
    const local = prism(`${id}__p`, { profile: 'circle', center: [0, 0], radius: d / 2, plane: { origin: [-L / 2, 0, h.at], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, L);
    return { brep: transformBrep(transformBrep(own(local, `${id}__p`, id), { matrix: turnZ(h.angle) }), shaft.place), report: { hole: h.index, diameter: d, length: L, holeDiameter: h.diameter, clearance: h.diameter - d } };
}
